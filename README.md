# toracheng.github.io

个人主页：一个静态博客 + 作品集。无框架、无后端，`git push` 即发布。

## 结构

```
/                      首页（Hero + 快捷入口 + 最新文章 + 标签 + 关于）
/blog/                 全部文章（搜索、标签筛选）
/blog/<slug>/          文章详情（目录、代码高亮、上一篇/下一篇）
/portfolio/            作品集（10 页，可滑动浏览）
/assets/               博客样式、脚本、代码高亮主题
/data/posts.json       搜索索引
/posts/*.md            文章源文件
/feed.xml              RSS
```

## 写一篇新文章

1. 在 `posts/` 新建 `my-post.md`：

```markdown
---
title: 标题
date: 2026-12-01
tags: 设计, 前端
excerpt: 列表页显示的摘要。
---

正文（Markdown）。
```

2. 在工程目录执行构建：

```bash
python build_blog.py
```

3. 把生成结果同步到仓库并 push：

```bash
python deploy_blog.py
```

## 技术

- Markdown → HTML：`markdown` + `codehilite` + `toc`
- 搜索：构建时生成 `posts.json`，浏览器端做子串匹配
- 样式：原生 CSS（Liquid Glass 风格、弹簧动效、深浅色）
- 作品集由 `build_site.py` 从 `作品集.pptx` 生成

## 本地预览

```bash
python -m http.server 8137 --directory site2
# 打开 http://127.0.0.1:8137
```
