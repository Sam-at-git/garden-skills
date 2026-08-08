# Anchor: paper-experiment-chart（基线对比 · 图表主场）

> ⚠️ **结构示意，不是抄袭模板。** 先走 [`../../CHAPTER-CRAFT.md`](../../CHAPTER-CRAFT.md)
> Part 0 五问 + [`../../PAPER-INTERPRETATION.md`](../../PAPER-INTERPRETATION.md) §4/§5/§6。

## 定位

实验章的镜头：**同一坐标轴**上，**先画基线**（旧方法），再画本文方法，给差值 +
方差，最后**讲者点评公不公平**。对应 [`PAPER-INTERPRETATION.md`](../../PAPER-INTERPRETATION.md)
§4「baseline-compare → same-axis-bars ★」+ §5「chart-dominant」+ §6 图表复用纪律。

> 这是论文视频最该"诚实"的章节。反模式（§9 第 1/2 条）：无统一坐标轴放大差异、
> 只晒最好结果。本 anchor **先画基线、同轴、给方差**，并在最后一步**把讲者的
> 公平性评价用 `解读推断` 单独标出**——不和论文数据混为一谈。

## 五步

| step | 意图 | 主导动作 |
|---|---|---|
| 1 | 立坐标 | 空坐标轴自绘（SVG `stroke-dashoffset`）+ 轴标签 |
| 2 | **先画基线** | 旧方法柱**先**长起来（不是"本文方法最后出现"那种取巧排序） |
| 3 | 本文方法 | 同一把轴上，本文柱长起，更高 |
| 4 | 差值 + 方差 | Δ 数字砸下 + ±方差须（晚揭示） |
| 5 | **公不公平？** | 讲者评价用 `解读推断` badge（虚线、弱化）—— 与数据 `实验支持` 分开 |

## 证据层（paper mode · 混合 claim）

- step 2–5 数字是**实验支持**（论文 Table 2）→ `实验支持` badge（`--accent`，权重最高）+ `Table 2` locator。
- step 5 **额外**挂一个 `解读推断` badge（虚线 + 弱化色）——因为"这评测公不公平"
  是**讲者自己的看法**，论文没下这个结论。**两种 badge 同屏，infer 视觉明显更弱**，
  这正是证据层的核心示范：观众一眼分得清"数据说的"和"讲者说的"。

## 文件结构

```
paper-experiment-chart/
├── README.md · chapter.tsx · chapter.css · narrations.ts
```

## 切到其它主题

- `tufte-ink` —— 数据墨水最少：柱只留顶 hairline + 值标签，去填充；最学术诚实
- `newsroom` —— 差值用印章砸下；基线柱用斜线纹理、本文柱实心区分
- `swiss-ikb` —— 信息图风：克莱因蓝只给本文柱，基线纯灰

**结构（5 步、同轴、先基线、方差晚揭示、混合证据 badge）保持不变。**
