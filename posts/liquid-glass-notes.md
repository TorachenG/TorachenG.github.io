---
title: Liquid Glass 之后：网页里怎么做出「灵动」
date: 2026-11-20
tags: 设计, 动效, CSS
excerpt: 玻璃材质只是表皮，真正让人觉得「灵动」的是三件事：分层的入场、带过冲的曲线、以及随手指走的微光。
---

iOS 26 的 Liquid Glass 出来之后，「玻璃」几乎成了所有界面的默认材质。但照抄模糊和半透明，通常只会得到一个脏兮兮的毛玻璃。

我把「灵动」拆成三个可执行的部分：**材质、节奏、反馈**。

## 一、材质：三层，而不是一层

一块好看的玻璃至少有三层：

1. **底色**：一层很淡的白色渐变，负责明度
2. **模糊**：`backdrop-filter: blur(30px) saturate(180%)`，负责透出背后的颜色
3. **高光边**：用渐变 + mask 做出 1px 的镜面边，负责「玻璃感」

```css
.glass::before{
  content:"";position:absolute;inset:0;border-radius:inherit;padding:1px;
  background:linear-gradient(160deg,rgba(255,255,255,.55),rgba(255,255,255,.06) 38%,rgba(255,255,255,.02) 62%,rgba(255,255,255,.3));
  -webkit-mask:linear-gradient(#000 0 0) content-box,linear-gradient(#000 0 0);
  -webkit-mask-composite:xor;
  mask-composite:exclude;
}
```

没有那一圈高光边，玻璃会立刻退化成「半透明色块」。

## 二、节奏：弹簧不是「缓动得更慢」

系统的动效之所以舒服，是因为它有**过冲**。线性或 ease-out 永远不会给你「弹一下」的感觉。

我常用两条曲线：

```css
:root{
  --spring: cubic-bezier(.34,1.56,.64,1);      /* 有回弹，适合按压、弹入 */
  --spring-soft: cubic-bezier(.22,.9,.24,1);   /* 无回弹，适合大块位移 */
}
```

如果要做明显的过冲，直接写关键帧更可控：

```css
@keyframes pop{
  0%   { opacity:0; transform: translateY(24px) scale(.90); }
  55%  { opacity:1; transform: translateY(-3px) scale(1.02); }
  78%  { transform: translateY(1px) scale(.997); }
  100% { opacity:1; transform: none; }
}
```

观察真实控件会发现：**过冲量很小**。放大 2% 就够，超过 5% 就会显得廉价。

## 三、反馈：让界面「跟着手」

最后是反馈。静态的玻璃再漂亮也不会动，加一点随指针移动的高光，立刻就有生命：

```js
card.addEventListener('pointermove', e => {
  const r = card.getBoundingClientRect();
  card.style.setProperty('--mx', (e.clientX - r.left) + 'px');
  card.style.setProperty('--my', (e.clientY - r.top) + 'px');
});
```

```css
.card::after{
  background: radial-gradient(320px circle at var(--mx) var(--my), rgba(255,255,255,.22), transparent 70%);
  opacity:0; transition:opacity .4s;
}
.card:hover::after{ opacity:1; }
```

## 四、别过头

三个容易翻车的地方：

- **模糊层太多**：每多一层 `backdrop-filter` 就多一次离屏合成，移动端会掉帧。控制在 3 层以内。
- **所有东西都在动**：入场动画只给首屏和关键卡片，滚动到视口外的内容不要再动。
- **忽略 reduced-motion**：系统开了减弱动效，就把位移和缩放全关掉，只保留透明度。

这套规则我在这个站点和 [作品集](/portfolio/) 里都用了，可以对照着看。
