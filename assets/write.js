/* ============================================================
   /write/ — rich text editor, exports Markdown
   ============================================================ */
(function () {
  var $ = function (id) { return document.getElementById(id); };
  var fTitle = $('fTitle'), fDate = $('fDate'), fTags = $('fTags'), fExcerpt = $('fExcerpt'),
      surface = $('fBody'), toolbar = $('toolbar'), status = $('status');
  if (!surface) return;

  var shell = $('editorShell'), previewPane = $('previewPane'), btnPreview = $('btnPreview');
  var pTitle = $('pTitle'), pExcerpt = $('pExcerpt'), pTags = $('pTags'),
      pDate = $('pDate'), pMin = $('pMin'), pBody = $('pBody');
  var imgbar = $('imgbar'), imgModal = $('imgModal'), imgFile = $('imgFile'), imgUrl = $('imgUrl');
  var DRAFT = 'torachen_draft_v2';
  var currentFig = null;

  /* ---------------- helpers ---------------- */
  function esc(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function tags() {
    return fTags.value.split(/[,，]/).map(function (t) { return t.trim(); }).filter(Boolean);
  }

  function readingTime(text) {
    var cjk = (text.match(/[\u4e00-\u9fff]/g) || []).length;
    var words = (text.match(/[A-Za-z0-9_]+/g) || []).length;
    return Math.max(1, Math.round(cjk / 380 + words / 220));
  }

  function flash(msg, err) {
    status.textContent = msg;
    status.className = 'status show' + (err ? ' err' : '');
    clearTimeout(flash._t);
    flash._t = setTimeout(function () { status.className = 'status'; }, 2400);
  }

  function focusSurface() { surface.focus(); }

  /* ---------------- toolbar ---------------- */
  function cmd(name, value) {
    focusSurface();
    try { document.execCommand(name, false, value || null); } catch (e) {}
    refreshToolbar();
    onChange();
  }

  toolbar.addEventListener('mousedown', function (e) {
    // keep the selection inside the editor
    if (e.target.closest('button')) e.preventDefault();
  });

  toolbar.addEventListener('click', function (e) {
    var b = e.target.closest('button');
    if (!b) return;
    if (b.dataset.block) { cmd('formatBlock', '<' + b.dataset.block + '>'); return; }
    if (b.dataset.cmd === 'createLink') {
      var url = prompt('链接地址', 'https://');
      if (url) cmd('createLink', url);
      return;
    }
    if (b.dataset.cmd) cmd(b.dataset.cmd, b.dataset.value);
  });

  function refreshToolbar() {
    ['bold', 'italic', 'strikeThrough', 'insertUnorderedList', 'insertOrderedList',
     'justifyLeft', 'justifyCenter', 'justifyRight'].forEach(function (name) {
      var btn = toolbar.querySelector('[data-cmd="' + name + '"]');
      if (!btn) return;
      var on = false;
      try { on = document.queryCommandState(name); } catch (e) {}
      btn.classList.toggle('on', !!on);
    });
  }

  document.addEventListener('selectionchange', function () {
    if (document.activeElement === surface) refreshToolbar();
  });

  /* ---------------- images ---------------- */
  function insertFigure(src, caption) {
    surface.focus();
    var sel = window.getSelection();
    if (!sel.rangeCount) return;
    var fig = document.createElement('figure');
    fig.className = 'fig fig-center fig-100';
    fig.innerHTML = '<img src="' + esc(src) + '" alt="">' +
      '<figcaption contenteditable="true">' + esc(caption || '') + '</figcaption>';
    var range = sel.getRangeAt(0);
    range.deleteContents();
    range.insertNode(fig);
    var p = document.createElement('p');
    p.innerHTML = '<br>';
    fig.parentNode.insertBefore(p, fig.nextSibling);
    var r2 = document.createRange();
    r2.setStart(p, 0); r2.collapse(true);
    sel.removeAllRanges(); sel.addRange(r2);
    selectFig(fig);
    onChange();
  }

  function selectFig(fig) {
    document.querySelectorAll('.editor-surface figure.selected').forEach(function (f) {
      f.classList.remove('selected');
    });
    currentFig = fig;
    if (!fig) { imgbar.hidden = true; return; }
    fig.classList.add('selected');
    updateImgbar();
    imgbar.hidden = false;
    positionImgbar();
    var cls = fig.className;
    imgbar.querySelectorAll('[data-w]').forEach(function (b) {
      b.classList.toggle('on', cls.indexOf('fig-' + b.dataset.w) >= 0);
    });
    imgbar.querySelectorAll('[data-a]').forEach(function (b) {
      b.classList.toggle('on', cls.indexOf('fig-' + b.dataset.a) >= 0);
    });
  }

  function updateImgbar() {
    if (!currentFig) return;
    var w = (currentFig.className.match(/fig-(\d+)/) || []) [1];
    var a = (currentFig.className.match(/fig-(left|center|right)/) || []) [1];
    imgbar.querySelectorAll('[data-w]').forEach(function (b) { b.classList.toggle('on', b.dataset.w === w); });
    imgbar.querySelectorAll('[data-a]').forEach(function (b) { b.classList.toggle('on', b.dataset.a === a); });
  }

  function positionImgbar() {
    if (!currentFig) return;
    var r = currentFig.getBoundingClientRect();
    var h = imgbar.offsetHeight || 40;
    var top = r.top - h - 10;
    if (top < 8) top = r.bottom + 10;
    imgbar.style.left = Math.max(8, Math.min(window.innerWidth - 340, r.left)) + 'px';
    imgbar.style.top = Math.max(8, top) + 'px';
  }

  imgbar.addEventListener('mousedown', function (e) { e.preventDefault(); });
  imgbar.addEventListener('click', function (e) {
    var b = e.target.closest('button');
    if (!b || !currentFig) return;
    if (b.dataset.w) {
      ['25', '40', '60', '75', '100'].forEach(function (w) {
        currentFig.classList.remove('fig-' + w);
      });
      currentFig.classList.add('fig-' + b.dataset.w);
    } else if (b.dataset.a) {
      ['left', 'center', 'right'].forEach(function (a) {
        currentFig.classList.remove('fig-' + a);
      });
      currentFig.classList.add('fig-' + b.dataset.a);
    } else if (b.id === 'figDel') {
      currentFig.remove();
      selectFig(null);
    }
    updateImgbar();
    onChange();
  });

  surface.addEventListener('click', function (e) {
    if (e.target.tagName === 'IMG') selectFig(e.target.closest('figure'));
    else if (!e.target.closest('figure')) selectFig(null);
  });

  addEventListener('scroll', function () { if (currentFig && !imgbar.hidden) positionImgbar(); }, { passive: true });
  addEventListener('resize', function () { if (currentFig && !imgbar.hidden) positionImgbar(); });

  /* image modal */
  $('btnImage').addEventListener('click', function () {
    imgUrl.value = '';
    imgModal.hidden = false;
    setTimeout(function () { imgUrl.focus(); }, 30);
  });
  $('btnCancelUrl').addEventListener('click', function () { imgModal.hidden = true; });
  $('btnInsertUrl').addEventListener('click', function () {
    var u = imgUrl.value.trim();
    if (!u) { flash('请填写图片地址', true); return; }
    imgModal.hidden = true;
    insertFigure(u, '');
  });
  imgUrl.addEventListener('keydown', function (e) {
    if (e.key === 'Enter') { e.preventDefault(); $('btnInsertUrl').click(); }
  });
  $('btnPickFile').addEventListener('click', function () { imgFile.click(); });
  imgModal.addEventListener('click', function (e) { if (e.target === imgModal) imgModal.hidden = true; });

  imgFile.addEventListener('change', function () {
    var file = imgFile.files && imgFile.files[0];
    if (!file) return;
    var reader = new FileReader();
    reader.onload = function () {
      var img = new Image();
      img.onload = function () {
        var max = 1600;
        var scale = Math.min(1, max / Math.max(img.width, img.height));
        var canvas = document.createElement('canvas');
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
        var type = /png/i.test(file.type) ? 'image/png' : 'image/jpeg';
        var data = canvas.toDataURL(type, 0.86);
        imgModal.hidden = true;
        insertFigure(data, '');
        flash('图片已插入（已压缩到 ' + canvas.width + 'px）');
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
    imgFile.value = '';
  });

  /* ---------------- preview ---------------- */
  function togglePreview(show) {
    var on = typeof show === 'boolean' ? show : previewPane.hidden;
    previewPane.hidden = !on;
    shell.classList.toggle('no-preview', !on);
    btnPreview.textContent = on ? '隐藏预览' : '显示预览';
    btnPreview.setAttribute('aria-pressed', on ? 'true' : 'false');
    if (on) renderPreview();
  }
  btnPreview.addEventListener('click', function () { togglePreview(); });

  function clean(html) {
    var t = document.createElement('div');
    t.innerHTML = html;
    t.querySelectorAll('script, style, iframe, object, embed').forEach(function (n) { n.remove(); });
    t.querySelectorAll('*').forEach(function (n) {
      Array.from(n.attributes).forEach(function (a) {
        if (/^on/i.test(a.name)) n.removeAttribute(a.name);
      });
    });
    return t.innerHTML;
  }

  function renderPreview() {
    pTitle.textContent = fTitle.value.trim() || '文章标题';
    pExcerpt.textContent = fExcerpt.value.trim() || '摘要会显示在这里。';
    pDate.textContent = fDate.value ? fDate.value.replace(/-/g, '.') : '—';
    pMin.textContent = readingTime(surface.textContent) + ' 分钟';
    pTags.innerHTML = tags().map(function (x) { return '<span class="tag static">' + esc(x) + '</span>'; }).join('');
    pBody.innerHTML = clean(surface.innerHTML) || '<p>正文预览…</p>';
  }

  /* ---------------- state ---------------- */
  function onChange() {
    if (!previewPane.hidden) renderPreview();
    save();
  }

  function save() {
    try {
      localStorage.setItem(DRAFT, JSON.stringify({
        title: fTitle.value, date: fDate.value, tags: fTags.value,
        excerpt: fExcerpt.value, html: surface.innerHTML
      }));
    } catch (e) {}
  }

  /* ---------------- markdown export ---------------- */
  function serializeNode(node) {
    if (node.nodeType === 3) return node.nodeValue.replace(/\s+/g, ' ');
    if (node.nodeType !== 1) return '';
    var tag = node.tagName.toLowerCase();
    var inner = function (n) {
      return Array.prototype.map.call(n.childNodes, serializeNode).join('');
    };
    switch (tag) {
      case 'br': return '\n';
      case 'strong': case 'b': return '**' + inner(node) + '**';
      case 'em': case 'i': return '*' + inner(node) + '*';
      case 's': case 'del': case 'strike': return '~~' + inner(node) + '~~';
      case 'code': return '`' + node.textContent + '`';
      case 'a': return '[' + inner(node) + '](' + (node.getAttribute('href') || '') + ')';
      case 'img': return '![' + (node.getAttribute('alt') || '') + '](' + node.getAttribute('src') + ')';
      case 'hr': return '\n---\n\n';
      case 'h1': case 'h2': case 'h3': case 'h4': case 'h5': case 'h6':
        return '#'.repeat(+tag[1]) + ' ' + inner(node).trim() + '\n\n';
      case 'p': return inner(node).trim() + '\n\n';
      case 'blockquote':
        return inner(node).trim().split('\n').filter(Boolean)
          .map(function (l) { return '> ' + l; }).join('\n') + '\n\n';
      case 'ul':
        return Array.prototype.map.call(node.children, function (li) {
          return '- ' + inner(li).trim();
        }).join('\n') + '\n\n';
      case 'ol':
        return Array.prototype.map.call(node.children, function (li, i) {
          return (i + 1) + '. ' + inner(li).trim();
        }).join('\n') + '\n\n';
      case 'pre': return '```\n' + node.textContent.replace(/\n$/, '') + '\n```\n\n';
      case 'figure': return serializeFigure(node) + '\n\n';
      case 'figcaption': return '';
      default: return inner(node);
    }
  }

  function serializeFigure(fig) {
    var img = fig.querySelector('img');
    if (!img) return '';
    var classes = ['fig'];
    if (/fig-(left|center|right)/.test(fig.className)) classes.push(fig.className.match(/fig-(left|center|right)/)[0]);
    else classes.push('fig-center');
    if (/fig-\d+/.test(fig.className)) classes.push(fig.className.match(/fig-\d+/)[0]);
    else classes.push('fig-100');
    var cap = fig.querySelector('figcaption');
    var html = '<figure class="' + classes.join(' ') + '">\n  <img src="' + img.getAttribute('src') + '" alt="' +
      (img.getAttribute('alt') || '') + '">';
    if (cap && cap.textContent.trim()) html += '\n  <figcaption>' + cap.textContent.trim() + '</figcaption>';
    return html + '\n</figure>';
  }

  function toMarkdown() {
    var md = Array.prototype.map.call(surface.childNodes, serializeNode).join('')
      .replace(/\n{3,}/g, '\n\n').trim();
    return md;
  }

  function markdownFile() {
    var t = fTitle.value.trim() || '未命名文章';
    var d = fDate.value || new Date().toISOString().slice(0, 10);
    return ['---', 'title: ' + t, 'date: ' + d, 'tags: ' + tags().join(', '),
            'excerpt: ' + fExcerpt.value.trim(), '---', '', toMarkdown(), ''].join('\n');
  }

  function slugify(s) {
    var base = String(s || '').toLowerCase().replace(/[^a-z0-9\u4e00-\u9fff]+/g, '-').replace(/^-+|-+$/g, '');
    if (!base) {
      var d = new Date();
      base = 'post-' + d.getFullYear() + String(d.getMonth() + 1).padStart(2, '0') + String(d.getDate()).padStart(2, '0');
    }
    return base.slice(0, 60);
  }

  function download() {
    var name = slugify(fTitle.value) + '.md';
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
      navigator.clipboard.writeText(text).then(function () { flash('已复制'); },
        function () { flash('复制失败', true); });
    } else flash('当前浏览器不支持复制', true);
  }

  /* ---------------- init ---------------- */
  try {
    var raw = localStorage.getItem(DRAFT);
    if (raw) {
      var d = JSON.parse(raw);
      fTitle.value = d.title || '';
      fDate.value = d.date || '';
      fTags.value = d.tags || '';
      fExcerpt.value = d.excerpt || '';
      surface.innerHTML = d.html || '';
    }
  } catch (e) {}
  if (!fDate.value) fDate.value = new Date().toISOString().slice(0, 10);

  [fTitle, fDate, fTags, fExcerpt].forEach(function (el) {
    el.addEventListener('input', onChange);
  });
  surface.addEventListener('input', onChange);
  surface.addEventListener('keyup', function () { if (currentFig) positionImgbar(); });
  surface.addEventListener('paste', function (e) {
    var items = e.clipboardData && e.clipboardData.items;
    if (!items) return;
    for (var i = 0; i < items.length; i++) {
      if (items[i].type.indexOf('image') === 0) {
        e.preventDefault();
        var file = items[i].getAsFile();
        var reader = new FileReader();
        reader.onload = function () { insertFigure(reader.result, ''); };
        reader.readAsDataURL(file);
        return;
      }
    }
  });

  $('btnDownload').addEventListener('click', download);
  $('btnCopy').addEventListener('click', copy);
  $('btnClear').addEventListener('click', function () {
    if (!confirm('清空当前草稿？')) return;
    fTitle.value = ''; fTags.value = ''; fExcerpt.value = '';
    fDate.value = new Date().toISOString().slice(0, 10);
    surface.innerHTML = '';
    try { localStorage.removeItem(DRAFT); } catch (e) {}
    selectFig(null);
    surface.innerHTML = '<p><br></p>';
    updateEmpty();
    onChange();
    flash('已清空');
  });

  addEventListener('keydown', function (e) {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's') {
      e.preventDefault();
      download();
    }
    if (e.key === 'Escape') { imgModal.hidden = true; selectFig(null); }
    if ((e.key === 'Delete' || e.key === 'Backspace') && currentFig && document.activeElement !== surface) {
      e.preventDefault();
      currentFig.remove();
      selectFig(null);
      onChange();
    }
  });

  /* paragraph separator + initial paragraph so typing produces clean blocks */
  try { document.execCommand('defaultParagraphSeparator', false, 'p'); } catch (e) {}
  function updateEmpty() {
    var empty = !surface.textContent.trim() && !surface.querySelector('figure');
    surface.classList.toggle('is-empty', empty);
  }

  if (!surface.innerHTML.trim()) surface.innerHTML = '<p><br></p>';
  surface.addEventListener('input', updateEmpty);
  updateEmpty();

  togglePreview(false);
  renderPreview();
})();
