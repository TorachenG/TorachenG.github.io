/* TorachenG blog interactions */
(function () {
  var doc = document;
  var html = doc.documentElement;

  /* ---------- theme ---------- */
  var themeBtn = doc.getElementById('themeToggle');
  var meta = doc.querySelector('meta[name="theme-color"]');
  function paintTheme(t) {
    html.dataset.theme = t;
    try { localStorage.setItem('theme', t); } catch (e) {}
    if (meta) meta.setAttribute('content', t === 'light' ? '#eef0f6' : '#07080b');
  }
  if (themeBtn) {
    themeBtn.addEventListener('click', function () {
      var next = html.dataset.theme === 'dark' ? 'light' : 'dark';
      if (doc.startViewTransition) {
        doc.startViewTransition(function () { paintTheme(next); });
      } else {
        paintTheme(next);
      }
    });
  }
  var qTheme = new URLSearchParams(location.search).get('theme');
  paintTheme(qTheme === 'light' || qTheme === 'dark' ? qTheme : (html.dataset.theme || 'dark'));

  /* ---------- active nav ---------- */
  (function () {
    var path = location.pathname;
    var map = [["/blog/", "文章"], ["/portfolio/", "作品集"]];
    var links = doc.querySelectorAll('.links a');
    links.forEach(function (a) {
      var href = a.getAttribute('href');
      var hit = (href === '/' && path === '/') ||
                map.some(function (m) { return path.indexOf(m[0]) === 0 && a.textContent.trim() === m[1]; });
      if (hit) a.classList.add('active');
    });
  })();

  /* ---------- island condense ---------- */
  var island = doc.getElementById('island');
  var lastY = -1;
  function onScroll() {
    var y = window.scrollY || doc.documentElement.scrollTop;
    if (island && Math.abs(y - lastY) > 4) {
      island.classList.toggle('scrolled', y > 36);
      lastY = y;
    }
    var bar = doc.getElementById('progress');
    if (bar) {
      var h = doc.documentElement.scrollHeight - window.innerHeight;
      bar.style.width = (h > 0 ? Math.min(100, (y / h) * 100) : 0) + '%';
    }
  }
  addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  /* ---------- pointer glow ---------- */
  doc.querySelectorAll('.action-card, .post-card, .about-card').forEach(function (el) {
    el.addEventListener('pointermove', function (e) {
      var r = el.getBoundingClientRect();
      el.style.setProperty('--mx', (e.clientX - r.left) + 'px');
      el.style.setProperty('--my', (e.clientY - r.top) + 'px');
    });
  });

  /* ---------- reveal on scroll ---------- */
  var items = [].slice.call(doc.querySelectorAll('.reveal'));
  if (!('IntersectionObserver' in window)) {
    items.forEach(function (el) { el.classList.add('in'); });
  } else {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) {
          en.target.classList.add('in');
          io.unobserve(en.target);
        }
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -8% 0px' });
    items.forEach(function (el) { io.observe(el); });
  }

  /* ---------- archive: search + tags ---------- */
  var list = doc.getElementById('posts');
  var input = doc.getElementById('q');
  var chips = [].slice.call(doc.querySelectorAll('#chips .chip'));
  var empty = doc.getElementById('empty');
  if (list && input && doc.getElementById('json')) {
    var src = doc.getElementById('json').getAttribute('data-src');
    var cards = [].slice.call(list.querySelectorAll('.post-card'));
    var index = null;
    var tag = new URLSearchParams(location.search).get('tag') || '';

    fetch(src).then(function (r) { return r.json(); }).then(function (data) {
      index = data;
      apply();
    }).catch(function () { index = []; });

    function norm(s) { return (s || '').toLowerCase(); }

    function apply() {
      var q = norm(input.value.trim());
      var matched = null;
      if (index) {
        matched = {};
        index.forEach(function (p) {
          if (tag && p.tags.indexOf(tag) < 0) return;
          if (q) {
            var hay = norm(p.title + ' ' + p.tags.join(' ') + ' ' + p.excerpt + ' ' + p.text);
            if (hay.indexOf(q) < 0) return;
          }
          matched[p.slug] = true;
        });
      }
      var shown = 0;
      cards.forEach(function (c) {
        var slug = c.getAttribute('data-slug');
        var ok = !matched || matched[slug];
        c.classList.toggle('hidden', !ok);
        if (ok) { shown++; c.classList.add('in'); }
      });
      if (empty) empty.hidden = shown !== 0;
      chips.forEach(function (c) { c.classList.toggle('active', (c.getAttribute('data-tag') || '') === tag); });
    }

    var t = null;
    input.addEventListener('input', function () {
      clearTimeout(t);
      t = setTimeout(apply, 90);
    });
    chips.forEach(function (c) {
      c.addEventListener('click', function () {
        tag = c.getAttribute('data-tag') || '';
        var url = new URL(location.href);
        if (tag) url.searchParams.set('tag', tag); else url.searchParams.delete('tag');
        history.replaceState(null, '', url);
        apply();
      });
    });
    addEventListener('keydown', function (e) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        input.focus();
        input.select();
      }
    });
    apply();
  }

  /* ---------- smooth in-page anchors ---------- */
  doc.querySelectorAll('a[href^="#"]').forEach(function (a) {
    a.addEventListener('click', function (e) {
      var id = a.getAttribute('href').slice(1);
      var el = id && doc.getElementById(id);
      if (el) {
        e.preventDefault();
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        history.replaceState(null, '', '#' + id);
      }
    });
  });
})();
