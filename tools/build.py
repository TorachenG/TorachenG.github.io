# -*- coding: utf-8 -*-
"""Static blog generator for toracheng.github.io.

Reads posts/*.md (with simple front matter), renders Markdown, and writes:
  index.html, blog/index.html, blog/<slug>/index.html, 404.html,
  data/posts.json, feed.xml, sitemap.xml, assets/pygments.css
and copies the portfolio deck into portfolio/.
"""
import html
import io
import json
import os
import re
import shutil
from datetime import datetime, timezone
from email.utils import format_datetime

import markdown
from pygments.formatters import HtmlFormatter

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
POSTS_DIR = os.path.join(ROOT, "posts")
OUT = ROOT
SITE_NAME = "Torachen"
SITE_TITLE = "Torachen"
SITE_DESC = "浏览器、界面与手绘。记录产品设计、工程实践与反复打磨的细节。"
BASE_URL = "https://toracheng.github.io"
BUILD_ID = datetime.now().strftime("%Y%m%d%H%M%S")
PORTFOLIO_URL = "/portfolio/"
MOTE_URL = "https://toracheng.github.io/Mote"

MD = markdown.Markdown(
    extensions=["extra", "codehilite", "toc", "sane_lists", "admonition"],
    extension_configs={
        "codehilite": {"css_class": "hl", "guess_lang": False, "linenums": False},
        "toc": {"permalink": False, "toc_depth": "2-3"},
    },
)


def read_post(path):
    raw = io.open(path, encoding="utf-8").read().lstrip("\ufeff")
    meta, body = {}, raw
    m = re.match(r"^---\s*\n(.*?)\n---\s*\n", raw, re.S)
    if m:
        for line in m.group(1).splitlines():
            if ":" in line:
                k, v = line.split(":", 1)
                meta[k.strip()] = v.strip()
        body = raw[m.end():]
    slug = os.path.splitext(os.path.basename(path))[0]
    title = meta.get("title", slug)
    date = meta.get("date", "2026-01-01")
    tags = [t.strip() for t in meta.get("tags", "").split(",") if t.strip()]
    excerpt = meta.get("excerpt", "")
    MD.reset()
    content = MD.convert(body)
    toc_html = MD.toc
    plain = re.sub(r"<[^>]+>", " ", content)
    plain = re.sub(r"\s+", " ", html.unescape(plain)).strip()
    cjk = len(re.findall(r"[\u4e00-\u9fff]", plain))
    words = len(re.findall(r"[A-Za-z0-9_]+", plain))
    minutes = max(1, round((cjk / 380) + (words / 220)))
    if not excerpt:
        excerpt = plain[:110] + ("…" if len(plain) > 110 else "")
    return {
        "slug": slug, "title": title, "date": date, "tags": tags,
        "excerpt": excerpt, "content": content, "toc": toc_html,
        "plain": plain[:1200], "minutes": minutes,
    }


def fmt_date(d):
    dt = datetime.strptime(d, "%Y-%m-%d")
    return "%d.%02d.%02d" % (dt.year, dt.month, dt.day)


def badge(tag):
    return '<a class="tag" href="/blog/?tag=%s">%s</a>' % (tag, html.escape(tag))


EMPTY_STATE = """<div class="empty-state glass reveal">
  <div class="head-line"><h3>还没有文章</h3><span class="kicker">/ EMPTY</span></div>
  <p>这里暂时是空的。写好的文章会出现在这里。</p>
</div>"""


def post_card(p, i=0):
    return f"""<article class="post-card reveal" data-slug="{p['slug']}" data-tags="{html.escape(','.join(p['tags']))}" style="--i:{i}">
  <a class="pc-link" href="/blog/{p['slug']}/">
    <div class="pc-meta"><time datetime="{p['date']}">{fmt_date(p['date'])}</time><span class="dot"></span><span>{p['minutes']} 分钟</span></div>
    <h3 class="pc-title">{html.escape(p['title'])}</h3>
    <p class="pc-excerpt">{html.escape(p['excerpt'])}</p>
    <div class="pc-foot"><div class="pc-tags">{''.join('<span class="tag static">%s</span>' % html.escape(t) for t in p['tags'])}</div><span class="pc-arrow" aria-hidden="true">↗</span></div>
  </a>
</article>"""


def page(title, body, path_prefix="", extra_head="", body_class=""):
    return f"""<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="build" content="{BUILD_ID}">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>{html.escape(title)}</title>
<meta name="description" content="{html.escape(SITE_DESC)}">
<meta name="theme-color" content="#07080b">
<meta property="og:title" content="{html.escape(title)}">
<meta property="og:description" content="{html.escape(SITE_DESC)}">
<meta property="og:type" content="website">
<link rel="icon" href="/assets/favicon.svg" type="image/svg+xml">
<link rel="stylesheet" href="/assets/site.css?v={BUILD_ID}">
<link rel="stylesheet" href="/assets/pygments.css?v={BUILD_ID}">
<script>try{{var t=localStorage.getItem('theme');if(!t){{t=(window.matchMedia&&matchMedia('(prefers-color-scheme: light)').matches)?'light':'dark';}}document.documentElement.dataset.theme=t;}}catch(e){{document.documentElement.dataset.theme='dark';}}</script>
{extra_head}
</head>
<body class="{body_class}">
<div class="site-bg" aria-hidden="true">
  <span class="blob b1"></span><span class="blob b2"></span><span class="blob b3"></span>
  <span class="grain"></span>
</div>
{NAV}
{body}
<footer class="footer">
  <div class="footer-inner">
    <div class="f-brand">TORACHEN</div>
    <div class="f-links">
      <a href="/blog/">文章</a><a href="/portfolio/">作品集</a><a href="{MOTE_URL}" target="_blank" rel="noopener">Mote</a>
    </div>
    <div class="f-copy">© {datetime.now().year} Torachen</div>
  </div>
</footer>
<script src="/assets/site.js?v={BUILD_ID}" defer></script>
</body>
</html>"""


NAV = """<header class="island" id="island">
  <a class="brand" href="/" aria-label="返回首页"><b>Torachen</b></a>
  <nav class="links" aria-label="主导航">
    <a href="/">首页</a>
    <a href="/blog/">文章</a>
    <a href="/#about">关于</a>
  </nav>
  <button class="theme" id="themeToggle" type="button" aria-label="切换深浅色">
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path class="sun" d="M12 4V2m0 20v-2m8-8h2M2 12h2m13.66-5.66 1.42-1.42M4.92 19.08l1.42-1.42m0-11.32L4.92 4.92m14.16 14.16-1.42-1.42" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/><circle class="sun" cx="12" cy="12" r="4" stroke="currentColor" stroke-width="1.7" fill="none"/><path class="moon" d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5Z" stroke="currentColor" stroke-width="1.7" fill="none" stroke-linejoin="round"/></svg>
  </button>
</header>"""


def build_home(posts):
    cards = "\n".join(post_card(p, i) for i, p in enumerate(posts[:4])) or EMPTY_STATE
    tags = {}
    for p in posts:
        for t in p["tags"]:
            tags[t] = tags.get(t, 0) + 1
    tag_html = "".join('<a class="chip" href="/blog/?tag=%s">%s</a>' % (html.escape(t), html.escape(t))
                       for t, _ in sorted(tags.items(), key=lambda kv: -kv[1]))
    topics_block = ""
    if tag_html:
        topics_block = ("""
  <section class="section" id="topics">
    <div class="section-head reveal">
      <div><div class="head-line"><h2>都在聊什么</h2><span class="kicker">/ TOPICS</span></div></div>
    </div>
    <div class="tag-cloud reveal">%s</div>
  </section>""" % tag_html)
    body = f"""
<main>
  <section class="hero">
    <p class="eyebrow reveal">TORACHEN <span>·</span> STUDIO NOTES</p>
    <h1 class="reveal" style="--i:1">把想法，<br>做成能用的东西。</h1>
    <p class="lede reveal" style="--i:2">记录软件开发、视觉设计、旅游奇遇等等~<br>欢迎来到我的博客。</p>
    <div class="actions">
      <a class="action-card reveal" style="--i:3" href="{MOTE_URL}" target="_blank" rel="noopener">
        <span class="ac-glow" aria-hidden="true"></span>
        <span class="ac-icon mote"><img src="/assets/mote-icon.png" alt="Mote 图标" width="30" height="30"></span>
        <span class="ac-body"><b>Mote 浏览器</b><i>纯净如纸，强大如城</i></span>
        <span class="ac-arrow">↗</span>
      </a>
      <a class="action-card reveal" style="--i:4" href="{PORTFOLIO_URL}">
        <span class="ac-glow" aria-hidden="true"></span>
        <span class="ac-icon portfolio">
          <svg viewBox="0 0 24 24" width="27" height="27" fill="none" stroke="currentColor" stroke-width="1.7"><rect x="3" y="4" width="18" height="16" rx="3"/><path d="M3 9h18M8 13h8M8 16.5h5"/></svg>
        </span>
        <span class="ac-body"><b>作品集</b><i>UI/UX · 平面视觉 · 油画</i></span>
        <span class="ac-arrow">↗</span>
      </a>
      <a class="action-card reveal" style="--i:5" href="https://github.com/TorachenG" target="_blank" rel="noopener">
        <span class="ac-glow" aria-hidden="true"></span>
        <span class="ac-icon github">
          <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor" aria-hidden="true"><path d="M12 .5C5.73.5.5 5.73.5 12a11.5 11.5 0 0 0 7.86 10.92c.58.1.79-.25.79-.56v-2.17c-3.2.7-3.87-1.54-3.87-1.54-.52-1.33-1.28-1.68-1.28-1.68-1.05-.72.08-.7.08-.7 1.16.08 1.77 1.19 1.77 1.19 1.03 1.76 2.7 1.25 3.36.96.1-.75.4-1.25.73-1.54-2.55-.29-5.24-1.28-5.24-5.7 0-1.26.45-2.29 1.19-3.1-.12-.29-.52-1.46.11-3.05 0 0 .97-.31 3.18 1.18a11 11 0 0 1 5.8 0c2.2-1.49 3.17-1.18 3.17-1.18.63 1.59.23 2.76.11 3.05.74.81 1.19 1.84 1.19 3.1 0 4.43-2.7 5.41-5.26 5.69.41.36.78 1.06.78 2.14v3.17c0 .31.21.67.8.56A11.5 11.5 0 0 0 23.5 12C23.5 5.73 18.27.5 12 .5Z"/></svg>
        </span>
        <span class="ac-body"><b>GitHub</b><i>代码仓库与开源项目</i></span>
        <span class="ac-arrow">↗</span>
      </a>
      <a class="action-card reveal" style="--i:6" href="https://space.bilibili.com/163472233" target="_blank" rel="noopener">
        <span class="ac-glow" aria-hidden="true"></span>
        <span class="ac-icon bilibili">
          <svg viewBox="0 0 24 24" width="25" height="25" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="7" width="18" height="13" rx="3.5"/><path d="M7 3l3 4M17 3l-3 4"/><path d="M9 12v3M15 12v3"/></svg>
        </span>
        <span class="ac-body"><b>哔哩哔哩</b><i>视频与日常</i></span>
        <span class="ac-arrow">↗</span>
      </a>
    </div>
  </section>

  <section class="section" id="posts">
    <div class="section-head reveal">
      <div><div class="head-line"><h2>最近写的东西</h2><span class="kicker">/ LATEST</span></div></div>
      <a class="more" href="/blog/">全部文章 <span>→</span></a>
    </div>
    <div class="posts">
      {cards}
    </div>
  </section>

  {topics_block}

  <section class="section about" id="about">
    <div class="about-card reveal">
      <div class="about-text">
        <div class="head-line"><h2>兴趣使然的 Furry 控</h2><span class="kicker">/ ABOUT US</span></div>
        <div class="bio">
          <p>美术学油画系本科毕业，目前是平凡的设计类岗社畜。平时喜欢设计一些小玩意儿，偶尔接单绘画。</p>
          <p>当前坐标湖南省长沙市。爱好外出旅游（尤其是自然风景）、与列表面基、健身锻炼、胡吃海喝、看沙雕爽文短剧...</p>
          <p class="impress">同学对我的第一印象：高冷壮汉 💪<br>与同学相互熟络之后：抽象傻福 🧠</p>
          <p>希望你能喜欢我的作品~</p>
        </div>
      </div>
      <div class="about-avatar">
        <img src="https://q1.qlogo.cn/g?b=qq&amp;nk=2757004736&amp;s=640" alt="QQ 头像"
             width="640" height="640" loading="lazy" referrerpolicy="no-referrer"
             onerror="this.onerror=null;this.src='/assets/avatar-fallback.jpg'">
      </div>
    </div>
  </section>
</main>"""
    return page(SITE_TITLE, body)


def build_blog_index(posts):
    cards = "\n".join(post_card(p, i) for i, p in enumerate(posts)) or EMPTY_STATE
    tags = sorted({t for p in posts for t in p["tags"]})
    chips = '<button class="chip active" data-tag="">全部</button>' + "".join(
        '<button class="chip" data-tag="%s">%s</button>' % (html.escape(t), html.escape(t)) for t in tags)
    controls = ""
    if posts:
        controls = f"""<p class="lede reveal" style="--i:2">共 {len(posts)} 篇 · 按时间倒序。可以搜索标题、正文或按标签筛选。</p>
    <div class="search-wrap reveal" style="--i:3">
      <svg class="s-icon" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.2-3.2"/></svg>
      <input id="q" type="search" placeholder="搜索文章、标签或关键词…" autocomplete="off" aria-label="搜索文章">
      <kbd>⌘K</kbd>
    </div>
    <div class="chips" id="chips">{chips}</div>"""
    body = f"""
<main class="page">
  <section class="list-head">
    <div class="head-line reveal"><h1>全部文章</h1><span class="kicker">/ ARCHIVE</span></div>
    {controls}
  </section>
  <div class="posts" id="posts">
    {cards}
  </div>
  <p class="empty" id="empty" hidden>没有找到匹配的文章，换个关键词试试。</p>
  <div class="list-json" id="json" data-src="/data/posts.json"></div>
</main>"""
    return page(SITE_NAME + " · 全部文章", body)


def build_post(p, prev, nxt):
    toc = p["toc"]
    toc_block = f'<aside class="toc"><p class="toc-title">目录</p>{toc}</aside>' if toc else ""
    pager = ""
    if prev or nxt:
        left = f'<a class="pager-link prev" href="/blog/{prev["slug"]}/"><span>← 上一篇</span><b>{html.escape(prev["title"])}</b></a>' if prev else "<span></span>"
        right = f'<a class="pager-link next" href="/blog/{nxt["slug"]}/"><span>下一篇 →</span><b>{html.escape(nxt["title"])}</b></a>' if nxt else "<span></span>"
        pager = f'<nav class="pager">{left}{right}</nav>'
    body = f"""
<div class="progress" id="progress"></div>
<main class="article-wrap">
  <article class="article">
    <header class="article-head">
      <a class="back" href="/blog/">← 返回文章列表</a>
      <h1>{html.escape(p['title'])}</h1>
      <div class="meta"><time datetime="{p['date']}">{fmt_date(p['date'])}</time><span class="dot"></span><span>{p['minutes']} 分钟阅读</span><span class="dot"></span>{''.join(badge(t) for t in p['tags'])}</div>
    </header>
    <div class="article-body">
      <div class="prose">{p['content']}</div>
      {toc_block}
    </div>
    {pager}
  </article>
</main>"""
    return page(SITE_NAME + " · " + p["title"], body, extra_head='<meta property="og:type" content="article">')


def build_write():
    body = f"""
<main class="page write-page">
  <section class="list-head">
    <div class="head-line reveal"><h1>写文章</h1><span class="kicker">/ WRITE</span></div>
  </section>

  <div class="editor" id="editorShell">
    <aside class="editor-preview" id="previewPane">
      <article class="post-card preview-card">
        <div class="pc-link">
          <div class="pc-meta"><time id="pDate">—</time><span class="dot"></span><span id="pMin">1 分钟</span></div>
          <h3 class="pc-title" id="pTitle">文章标题</h3>
          <p class="pc-excerpt" id="pExcerpt">摘要会显示在这里。</p>
          <div class="pc-foot"><div class="pc-tags" id="pTags"></div><span class="pc-arrow">↗</span></div>
        </div>
      </article>
      <div class="prose preview-body" id="pBody"></div>
    </aside>

    <form class="editor-form glass" id="postForm" autocomplete="off">
      <div class="field">
        <label for="fTitle">标题</label>
        <input id="fTitle" placeholder="文章标题">
      </div>
      <div class="field-row">
        <div class="field"><label for="fDate">日期</label><input id="fDate" type="date"></div>
        <div class="field"><label for="fTags">标签</label><input id="fTags" placeholder="用逗号分隔"></div>
      </div>

      <div class="toolbar" id="toolbar">
        <button type="button" data-cmd="bold" title="加粗"><b>B</b></button>
        <button type="button" data-cmd="italic" title="斜体"><i>I</i></button>
        <button type="button" data-cmd="strikeThrough" title="删除线"><s>S</s></button>
        <span class="sep"></span>
        <button type="button" data-block="h2" title="大标题">H2</button>
        <button type="button" data-block="h3" title="小标题">H3</button>
        <button type="button" data-cmd="formatBlock" data-value="p" title="正文">P</button>
        <span class="sep"></span>
        <button type="button" data-cmd="insertUnorderedList" title="无序列表">•</button>
        <button type="button" data-cmd="insertOrderedList" title="有序列表">1.</button>
        <button type="button" data-cmd="formatBlock" data-value="blockquote" title="引用">❝</button>
        <span class="sep"></span>
        <button type="button" data-cmd="createLink" title="链接"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M10 13a5 5 0 0 0 7 0l2-2a5 5 0 0 0-7-7l-1 1"/><path d="M14 11a5 5 0 0 0-7 0l-2 2a5 5 0 0 0 7 7l1-1"/></svg></button>
        <button type="button" id="btnImage" title="图片"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="4" width="18" height="16" rx="2.5"/><circle cx="9" cy="10" r="1.6"/><path d="m4 17 5-4 4 3 3-2 4 4"/></svg></button>
        <span class="sep"></span>
        <button type="button" data-cmd="justifyLeft" title="左对齐">⇤</button>
        <button type="button" data-cmd="justifyCenter" title="居中">↔</button>
        <button type="button" data-cmd="justifyRight" title="右对齐">⇥</button>
        <span class="sep"></span>
        <button type="button" data-cmd="undo" title="撤销">↶</button>
        <button type="button" data-cmd="redo" title="重做">↷</button>
        <button type="button" data-cmd="removeFormat" title="清除格式">⌫</button>
      </div>

      <div class="editor-surface" id="fBody" contenteditable="true" spellcheck="false"
           data-placeholder="从这里开始写…"></div>

      <div class="editor-actions">
        <button type="button" class="btn ghost" id="btnPreview" aria-pressed="true">隐藏预览</button>
        <span class="spacer"></span>
        <div class="dropdown" id="exportDrop">
          <button type="button" class="btn ghost" id="btnExport" aria-haspopup="true" aria-expanded="false">导出 <span class="caret">▾</span></button>
          <div class="menu" role="menu">
            <button type="button" data-act="copy" role="menuitem">复制 Markdown</button>
            <button type="button" data-act="download" role="menuitem">下载 .md</button>
          </div>
        </div>
        <button type="button" class="btn accent" id="btnPublish">确定发布</button>
        <span class="status" id="status"></span>
      </div>
    </form>
  </div>

  <input type="file" id="imgFile" accept="image/*" hidden>
  <div class="imgbar" id="imgbar" hidden>
    <span class="imgbar-label">宽度</span>
    <button type="button" data-w="25">25%</button>
    <button type="button" data-w="40">40%</button>
    <button type="button" data-w="60">60%</button>
    <button type="button" data-w="75">75%</button>
    <button type="button" data-w="100">100%</button>
    <span class="sep"></span>
    <span class="imgbar-label">对齐</span>
    <button type="button" data-a="left">左</button>
    <button type="button" data-a="center">中</button>
    <button type="button" data-a="right">右</button>
    <span class="sep"></span>
    <button type="button" id="figDel" title="删除图片">✕</button>
  </div>

  <div class="imgmodal" id="imgModal">
    <div class="imgmodal-card glass">
      <p class="kicker">插入图片</p>
      <div class="field"><label for="imgUrl">图片地址</label><input id="imgUrl" placeholder="https://…"></div>
      <div class="imgmodal-or">或</div>
      <button type="button" class="btn ghost" id="btnPickFile">从本机选择图片</button>
      <div class="imgmodal-actions">
        <button type="button" class="btn" id="btnInsertUrl">插入</button>
        <button type="button" class="btn ghost" id="btnCancelUrl">取消</button>
      </div>
    </div>
  </div>

  <div class="imgmodal" id="pubModal">
    <div class="imgmodal-card glass">
      <p class="kicker">发布到 GitHub</p>
      <p class="pub-note">Token 只保存在这台设备的浏览器里，用于提交文章文件；提交后由 GitHub Actions 自动重新构建。</p>
      <div class="field"><label for="pubRepo">仓库</label><input id="pubRepo" placeholder="owner/repo"></div>
      <div class="field"><label for="pubBranch">分支</label><input id="pubBranch" placeholder="main"></div>
      <div class="field"><label for="pubToken">访问令牌</label><input id="pubToken" type="password" placeholder="ghp_… / github_pat_…"></div>
      <div class="imgmodal-actions">
        <button type="button" class="btn accent" id="btnPubGo">发布</button>
        <button type="button" class="btn ghost" id="btnPubCancel">取消</button>
      </div>
    </div>
  </div>
</main>"""
    return page(SITE_NAME + " · 写文章", body, extra_head='<link rel="stylesheet" href="/assets/write.css?v={BUILD_ID}"><script src="/assets/write.js?v={BUILD_ID}" defer></script>')


def build_404():
    body = """
<main class="page notfound">
  <div class="head-line"><h1>这页不见了</h1><span class="kicker">/ 404</span></div>
  <p class="lede">链接可能被移动或删除了。回首页，或者去看看作品集。</p>
  <div class="actions">
    <a class="action-card small" href="/"><span class="ac-body"><b>回到首页</b><i>Torachen</i></span><span class="ac-arrow">→</span></a>
    <a class="action-card small" href="/portfolio/"><span class="ac-body"><b>作品集</b><i>DESIGN PORTFOLIO</i></span><span class="ac-arrow">→</span></a>
  </div>
</main>"""
    return page(SITE_NAME + " · 页面不存在", body)


def write(path, text):
    full = os.path.join(OUT, path)
    os.makedirs(os.path.dirname(full), exist_ok=True)
    io.open(full, "w", encoding="utf-8", newline="\n").write(text)
    return len(text)


def main():
    files = sorted([f for f in os.listdir(POSTS_DIR) if f.endswith(".md")]) if os.path.isdir(POSTS_DIR) else []
    posts = [read_post(os.path.join(POSTS_DIR, f)) for f in files]
    posts.sort(key=lambda p: p["date"], reverse=True)

    write("index.html", build_home(posts))
    write("blog/index.html", build_blog_index(posts))
    for i, p in enumerate(posts):
        prev = posts[i + 1] if i + 1 < len(posts) else None
        nxt = posts[i - 1] if i > 0 else None
        write("blog/%s/index.html" % p["slug"], build_post(p, prev, nxt))
    write("write/index.html", build_write())
    write("404.html", build_404())

    keep = set(p["slug"] for p in posts)
    blog_root = os.path.join(OUT, "blog")
    if os.path.isdir(blog_root):
        for name in os.listdir(blog_root):
            path = os.path.join(blog_root, name)
            if os.path.isdir(path) and name not in keep:
                shutil.rmtree(path)

    write("data/posts.json", json.dumps([{
        "slug": p["slug"], "title": p["title"], "date": p["date"], "tags": p["tags"],
        "excerpt": p["excerpt"], "text": p["plain"], "minutes": p["minutes"],
    } for p in posts], ensure_ascii=False))

    items = []
    for p in posts:
        dt = datetime.strptime(p["date"], "%Y-%m-%d").replace(hour=9, tzinfo=timezone.utc)
        items.append(f"""  <item>
    <title>{html.escape(p['title'])}</title>
    <link>{BASE_URL}/blog/{p['slug']}/</link>
    <guid isPermaLink="true">{BASE_URL}/blog/{p['slug']}/</guid>
    <pubDate>{format_datetime(dt)}</pubDate>
    <description>{html.escape(p['excerpt'])}</description>
  </item>""")
    write("feed.xml", f"""<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0"><channel>
  <title>{SITE_NAME}</title>
  <link>{BASE_URL}/</link>
  <description>{html.escape(SITE_DESC)}</description>
  <language>zh-CN</language>
{chr(10).join(items)}
</channel></rss>""")

    urls = [BASE_URL + "/", BASE_URL + "/blog/", BASE_URL + "/portfolio/", BASE_URL + "/write/"] + \
           [BASE_URL + "/blog/%s/" % p["slug"] for p in posts]
    write("sitemap.xml", '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
          "\n".join("  <url><loc>%s</loc></url>" % u for u in urls) + "\n</urlset>")

    print("built %d posts" % len(posts))
    for p in posts:
        print("  -", p["date"], p["slug"])


if __name__ == "__main__":
    main()
