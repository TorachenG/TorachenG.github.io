/* TorachenG blog interactions */
(function () {
  var doc = document;
  var html = doc.documentElement;

  /* ---------- theme ---------- */
  var themeBtn = doc.getElementById('themeToggle');
  var meta = doc.querySelector('meta[name="theme-color"]');
  var mq = window.matchMedia ? window.matchMedia('(prefers-color-scheme: light)') : null;
  var hasStored = false;
  try { hasStored = !!localStorage.getItem('theme'); } catch (e) {}
  function paintTheme(t, store) {
    html.dataset.theme = t;
    if (store) { try { localStorage.setItem('theme', t); hasStored = true; } catch (e) {} }
    if (meta) meta.setAttribute('content', t === 'light' ? '#eef0f6' : '#07080b');
  }
  if (mq && mq.addEventListener) {
    mq.addEventListener('change', function (e) {
      if (!hasStored) paintTheme(e.matches ? 'light' : 'dark', false);
    });
  }
  if (themeBtn) {
    themeBtn.addEventListener('click', function () {
      var next = html.dataset.theme === 'dark' ? 'light' : 'dark';
      paintTheme(next, true);
    });
  }
  var qTheme = new URLSearchParams(location.search).get('theme');
  paintTheme(qTheme === 'light' || qTheme === 'dark' ? qTheme : (html.dataset.theme || 'dark'), false);

  /* ---------- platform hint ---------- */
  (function () {
    var kbd = doc.querySelector('.search-wrap kbd');
    if (kbd && !/Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent)) kbd.textContent = 'Ctrl K';
  })();

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

  /* ---------- stale-build guard (GitHub Pages caches HTML for 10 min) ---------- */
  (function () {
    var meta = doc.querySelector('meta[name="build"]');
    if (!meta || !window.fetch) return;
    var id = meta.getAttribute('content');
    if (!id) return;
    // never reload twice for the same build, and never when already cache-busted
    if (location.search.indexOf('v=' + id) >= 0) return;
    var reloaded = false;
    try { reloaded = sessionStorage.getItem('build-reload-' + id) === '1'; } catch (e) { reloaded = false; }
    if (reloaded) return;
    fetch('/version.json?cb=' + Date.now(), { cache: 'no-store' })
      .then(function (r) { return r.json(); })
      .then(function (v) {
        if (!v || !v.id || v.id === id) return;
        try { sessionStorage.setItem('build-reload-' + v.id, '1'); } catch (e) { return; }
        var url = location.pathname + '?v=' + encodeURIComponent(v.id);
        location.replace(url);
      })
      .catch(function () {});
  })();

  /* ---------- external links open in a new tab ---------- */
  doc.querySelectorAll('a[href^="http"]').forEach(function (a) {
    try {
      var u = new URL(a.href, location.href);
      if (u.host !== location.host) {
        a.target = '_blank';
        a.rel = 'noopener noreferrer';
      }
    } catch (e) {}
  });

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
      if (empty) empty.hidden = !(shown === 0 && (q || tag));
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

  /* ---------- home link: smooth to top on home, real navigation elsewhere ---------- */
  doc.querySelectorAll('.links a').forEach(function (a) {
    if (a.getAttribute('href') !== '/' || location.pathname !== '/') return;
    a.addEventListener('click', function (e) {
      e.preventDefault();
      window.scrollTo({ top: 0, behavior: 'smooth' });
      history.replaceState(null, '', '/');
    });
  });

  /* ---------- smooth in-page anchors (also /#section) ---------- */
  function scrollToId(id) {
    var el = id && doc.getElementById(id);
    if (!el) return false;
    el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    history.replaceState(null, '', '#' + id);
    return true;
  }
  doc.querySelectorAll('a[href^="#"], a[href^="/#"]').forEach(function (a) {
    a.addEventListener('click', function (e) {
      var href = a.getAttribute('href');
      var id = href.replace(/^\/?#/, '');
      if (!id) return;
      if (href.charAt(0) === '/' && location.pathname !== '/') return;
      if (scrollToId(id)) e.preventDefault();
    });
  });
  if (location.hash.length > 1) {
    var target = location.hash.slice(1);
    setTimeout(function () {
      if (!scrollToId(target)) return;
      history.replaceState(null, '', location.pathname + location.search + '#' + target);
    }, 120);
  }
})();
