---
title: 这个博客是怎么搭的：Markdown、构建脚本与一次 push
date: 2026-11-21
tags: 工程, 博客, 构建
excerpt: 没有数据库、没有后台、没有框架。四个静态文件加一个 300 行的生成器，就是现在这个站点。
---

很多人以为「博客」需要一个 CMS。这个站点没有任何后端：文章是 Markdown，构建脚本把它变成 HTML，push 之后 GitHub Pages 自动发布。

## 目录结构

```
/
├── index.html            # 首页
├── blog/
│   ├── index.html        # 文章列表（搜索 + 标签）
│   └── <slug>/index.html # 每篇文章
├── portfolio/index.html  # 作品集
├── assets/               # 样式、脚本、高亮主题
├── data/posts.json       # 搜索索引
├── posts/*.md            # 文章源文件
├── feed.xml
└── sitemap.xml
```

## 写作流程

新增一篇文章只要两步：

1. 在 `posts/` 里放一个 `.md`，开头写 front matter
2. 跑一次构建，push

```markdown
---
title: 标题
date: 2026-11-21
tags: 设计, 前端
excerpt: 列表页显示的摘要。
---

正文从这里开始。
```

front matter 只解析 `key: value`，够用就行，不引入依赖。

## 生成器做了什么

一个 Python 脚本，主要四件事：

- 用 `markdown` 渲染正文，`codehilite` 做代码高亮，`toc` 生成目录
- 计算阅读时长：中文按 380 字/分钟，英文按 220 词/分钟
- 生成 `posts.json`（搜索用的纯文本索引）和 `feed.xml`
- 拷贝作品集到 `portfolio/`，保证一个仓库发布两个站点

```python
MD = markdown.Markdown(extensions=[
    "extra", "codehilite", "toc", "sane_lists"
], extension_configs={
    "codehilite": {"css_class": "hl", "guess_lang": False}
})
```

## 搜索是怎么实现的

没有服务端，就在浏览器里搜。页面加载时拉一份 `posts.json`（目前 20KB 左右），对标题、标签、摘要和正文前 800 字做子串匹配，命中就显示卡片。

```js
const hay = [p.title, p.tags.join(' '), p.excerpt, p.text].join(' ').toLowerCase();
return hay.includes(q);
```

文章多了以后可以换成倒排索引，但对几十篇的规模来说，这样已经够快。

## 为什么不用框架

- 首屏不需要 hydration，静态 HTML 直接可看
- 部署只需要 `git push`，没有构建服务
- 十年后还能跑

代价是少了一些能力：评论、阅读统计、草稿预览。这些需要的时候再接，不提前上。

## 下一步

- 文章内的图片灯箱
- 按标签生成归档页
- 中英文双语

如果你也想搭一个，直接把仓库 fork 走，改 `posts/` 就行。
