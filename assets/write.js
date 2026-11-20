/* Markdown editor for /write/ — drafts in localStorage, exports a .md file */
(function () {
  var $ = function (id) { return document.getElementById(id); };
  var fTitle = $('fTitle'), fDate = $('fDate'), fSlug = $('fSlug'), fTags = $('fTags'),
      fExcerpt = $('fExcerpt'), fBody = $('fBody'), status = $('status');
  if (!fTitle) return;

  var pTitle = $('pTitle'), pExcerpt = $('pExcerpt'), pTags = $('pTags'),
      pDate = $('pDate'), pMin = $('pMin'), pBody = $('pBody');

  var DRAFT = 'torachen_draft_v1';
  var slugTouched = false;

  function esc(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function inline(s) {
    s = s.replace(/`([^`]+)`/g, '<code>$1</code>');
    s = s.replace(/!\[([^\]]*)\]\(([^)\s]+)\)/g, '<img alt="$1" src="$2">');
    s = s.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
    s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    s = s.replace(/(^|[^*])\*([^*]+)\*/g, '$1<em>$2</em>');
    return s;
  }

  function md(src) {
    var lines = esc(src).split(/\r?\n/), out = [], i = 0, inCode = false, buf = [], lang = '';
    var isBlock = /^(#{1,6}\s|>|```|\s*[-*+]\s|\s*\d+[.)]\s)/;
    while (i < lines.length) {
      var line = lines[i];
      if (/^```/.test(line)) {
        if (!inCode) { inCode = true; lang = line.slice(3).trim(); buf = []; }
        else {
          out.push('<pre><code' + (lang ? ' class="language-' + lang + '"' : '') + '>' + buf.join('\n') + '</code></pre>');
          inCode = false;
        }
        i++; continue;
      }
      if (inCode) { buf.push(line); i++; continue; }
      if (/^\s*$/.test(line)) { i++; continue; }
      var h = line.match(/^(#{1,6})\s+(.*)$/);
      if (h) { out.push('<h' + h[1].length + '>' + inline(h[2]) + '</h' + h[1].length + '>'); i++; continue; }
      if (/^>\s?/.test(line)) {
        var q = [];
        while (i < lines.length && /^>\s?/.test(lines[i])) { q.push(lines[i].replace(/^>\s?/, '')); i++; }
        out.push('<blockquote>' + inline(q.join(' ')) + '</blockquote>'); continue;
      }
      if (/^(-{3,}|\*{3,})$/.test(line.trim())) { out.push('<hr>'); i++; continue; }
      if (/^\s*[-*+]\s+/.test(line)) {
        var items = [];
        while (i < lines.length && /^\s*[-*+]\s+/.test(lines[i])) { items.push(lines[i].replace(/^\s*[-*+]\s+/, '')); i++; }
        out.push('<ul>' + items.map(function (t) { return '<li>' + inline(t) + '</li>'; }).join('') + '</ul>'); continue;
      }
      if (/^\s*\d+[.)]\s+/.test(line)) {
        var oitems = [];
        while (i < lines.length && /^\s*\d+[.)]\s+/.test(lines[i])) { oitems.push(lines[i].replace(/^\s*\d+[.)]\s+/, '')); i++; }
        out.push('<ol>' + oitems.map(function (t) { return '<li>' + inline(t) + '</li>'; }).join('') + '</ol>'); continue;
      }
      var para = [line]; i++;
      while (i < lines.length && !/^\s*$/.test(lines[i]) && !isBlock.test(lines[i])) { para.push(lines[i]); i++; }
      out.push('<p>' + inline(para.join(' ')) + '</p>');
    }
    return out.join('\n');
  }

  function slugify(s) {
    var base = String(s || '').toLowerCase()
      .replace(/[^a-z0-9\u4e00-\u9fff]+/g, '-')
      .replace(/^-+|-+$/g, '');
    if (!base) {
      var d = new Date();
      base = 'post-' + d.getFullYear() + String(d.getMonth() + 1).padStart(2, '0') + String(d.getDate()).padStart(2, '0');
    }
    return base.slice(0, 60);
  }

  function readingTime(text) {
    var cjk = (text.match(/[\u4e00-\u9fff]/g) || []).length;
    var words = (text.match(/[A-Za-z0-9_]+/g) || []).length;
    return Math.max(1, Math.round(cjk / 380 + words / 220));
  }

  function tags() {
    return fTags.value.split(/[,，]/).map(function (t) { return t.trim(); }).filter(Boolean);
  }

  function render() {
    var t = fTitle.value.trim();
    pTitle.textContent = t || '文章标题';
    pExcerpt.textContent = fExcerpt.value.trim() || '摘要会显示在这里。';
    pDate.textContent = fDate.value ? fDate.value.replace(/-/g, '.') : '—';
    pMin.textContent = readingTime(fBody.value) + ' 分钟';
    pTags.innerHTML = tags().map(function (x) { return '<span class="tag static">' + esc(x) + '</span>'; }).join('');
    pBody.innerHTML = fBody.value.trim() ? md(fBody.value) : '<p>正文预览…</p>';
  }

  function save() {
    try {
      localStorage.setItem(DRAFT, JSON.stringify({
        title: fTitle.value, date: fDate.value, slug: fSlug.value,
        tags: fTags.value, excerpt: fExcerpt.value, body: fBody.value
      }));
    } catch (e) {}
  }

  function flash(msg, err) {
    status.textContent = msg;
    status.className = 'status show' + (err ? ' err' : '');
    clearTimeout(flash._t);
    flash._t = setTimeout(function () { status.className = 'status'; }, 2200);
  }

  function markdownFile() {
    var t = fTitle.value.trim() || '未命名文章';
    var d = fDate.value || new Date().toISOString().slice(0, 10);
    var ex = fExcerpt.value.trim();
    return [
      '---',
      'title: ' + t,
      'date: ' + d,
      'tags: ' + tags().join(', '),
      'excerpt: ' + ex,
      '---',
      '',
      fBody.value.replace(/\s+$/, ''),
      ''
    ].join('\n');
  }

  function download() {
    var name = (fSlug.value.trim() || slugify(fTitle.value)).replace(/[\\/:*?"<>|]/g, '-') + '.md';
    var blob = new Blob([markdownFile()], { type: 'text/markdown;charset=utf-8' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    document.body.appendChild(a);
    a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
    flash('已导出 ' + name);
  }

  function copy() {
    var text = markdownFile();
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function () { flash('已复制到剪贴板'); },
        function () { flash('复制失败，请手动选择', true); });
    } else {
      flash('当前浏览器不支持一键复制', true);
    }
  }

  /* restore draft */
  try {
    var raw = localStorage.getItem(DRAFT);
    if (raw) {
      var d = JSON.parse(raw);
      fTitle.value = d.title || '';
      fDate.value = d.date || new Date().toISOString().slice(0, 10);
      fSlug.value = d.slug || '';
      fTags.value = d.tags || '';
      fExcerpt.value = d.excerpt || '';
      fBody.value = d.body || '';
      slugTouched = !!d.slug;
    }
  } catch (e) {}

  if (!fDate.value) fDate.value = new Date().toISOString().slice(0, 10);
  render();

  fTitle.addEventListener('input', function () {
    if (!slugTouched) fSlug.value = slugify(fTitle.value);
    render(); save();
  });
  fSlug.addEventListener('input', function () { slugTouched = !!fSlug.value.trim(); save(); });
  [fDate, fTags, fExcerpt, fBody].forEach(function (el) {
    el.addEventListener('input', function () { render(); save(); });
  });

  $('btnDownload').addEventListener('click', download);
  $('btnCopy').addEventListener('click', copy);
  $('btnClear').addEventListener('click', function () {
    if (!confirm('清空当前草稿？')) return;
    fTitle.value = ''; fSlug.value = ''; fTags.value = ''; fExcerpt.value = ''; fBody.value = '';
    fDate.value = new Date().toISOString().slice(0, 10);
    slugTouched = false;
    try { localStorage.removeItem(DRAFT); } catch (e) {}
    render(); flash('已清空');
  });

  /* ⌘S / Ctrl+S saves the file */
  addEventListener('keydown', function (e) {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's') {
      e.preventDefault();
      download();
    }
  });
})();
