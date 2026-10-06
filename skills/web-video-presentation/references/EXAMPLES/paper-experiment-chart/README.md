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

> ⚠️ `ChapterStepProps.step` 是 **0-indexed**（`step: 0..narrations.length - 1`）。
> `narrations.ts` 长度 5 ↔ 代码里最大阈值 `step >= 4`。step 0 一上来就有画面
> （坐标轴 + 刻度），不是空屏。

| step（代码） | 意图 | 主导动作 |
|---|---|---|
| 0 | 立坐标 | 空坐标轴自绘（SVG `stroke-dashoffset` 动画）+ 0/50/100 刻度就位 |
| 1 | **先画基线** | 旧方法柱**先**长起来（不是"本文方法最后出现"那种取巧排序） |
| 2 | 本文方法 | 同一把轴上，本文柱长起，更高 |
| 3 | 差值 + 方差 | Δ 数字砸下 + ±方差须（晚揭示） |
| 4 | **公不公平？** | 讲者评价用 `解读推断` badge（虚线、弱化）—— 与数据 `实验支持` 分开 |

## 布局

`data-composition="split-screen"`（严格两项对照：基线 vs 本文，左右等权对峙）。
图表 `.pe-chart` 是 `data-role="primary"`，标题与末步的公平性评价是 `secondary`，
citation / badge / locator / 刻度是 `annotation`。三项及以上的对照别用 split-screen——
看 `paper-ablation/` 的 `asymmetric-60-40`。

## 图表诚实性：柱高 = 数值，一把尺子到底

口播说"纵轴是准确率，**从 0 到 100**"，那画面就得真的是 0–100：

```tsx
const AXIS_MAX = 100;
const barHeight = (v: number) => `${(v / AXIS_MAX) * 100}%`;  // 71.4 → 71.4%
```

两根柱子**共用这一条线性映射**，`0 / 50 / 100` 三个刻度画在轴上，观众可以自己
验算。71.4 vs 86.2 在画面上就是真实的 **1.21 倍**。

> ❌ 反面写法（本 anchor 早期版本犯过）：`PRIOR { 71.4 → height 71 }` +
> `OURS { 86.2 → height 100 }`——让本文柱"顶满"。这等于给两根柱子各配一把尺子，
> 1.21 倍被视觉放大成 **1.41 倍**，正中
> [`PAPER-INTERPRETATION.md`](../../PAPER-INTERPRETATION.md) §9 第 1 条
> （图表无统一坐标轴 → 差异被视觉放大）和 §7「绝不扭曲数据 / 坐标轴 / 刻度来放大差异」。

14.8 分的差在 0–100 上已经很清楚，**不需要**截断轴。确实需要截断时（比如
`paper-ablation/` 那种 4.8 分的差），**必须**同时画出截断标记 + 在轴标注里写明
真实区间——见那个 anchor 的 README。

## 证据层（paper mode · 混合 claim）

- step 1–4 数字是**实验支持**（论文 Table 2）→ `实验支持` badge（`--accent`，权重最高）+ `Table 2` locator。
- step 4 **额外**挂一个 `解读推断` badge（虚线 + 弱化色）——因为"这评测公不公平"
  是**讲者自己的看法**，论文没下这个结论。**两种 badge 同屏，infer 视觉明显更弱**，
  这正是证据层的核心示范：观众一眼分得清"数据说的"和"讲者说的"。

badge / locator / citation 走**共享**的 `<Evidence>` class：
`ev-badge`（配 `data-evidence="fact|supported|infer|background"`）、`ev-locator`（`ev-citation` 已退役，不挂），
样式在 `src/styles/evidence.css`。`chapter.css` 里只留本章特有的那一行——同屏第二个
badge 的错位坐标 `.pe-ev-2`。

## 文件结构

```
paper-experiment-chart/
├── README.md · chapter.tsx · chapter.css · narrations.ts
```

`narrations.ts` 用**具名导出** `export const narrations: string[]` —— `registry/chapters.ts`
和 `scripts/extract-narrations.ts` 都只认这个形式，写成 `export default` 会让 TTS 管线直接报错。

## 切到其它主题

- `tufte-ink` —— 数据墨水最少：柱只留顶 hairline + 值标签，去填充；最学术诚实
- `newsroom` —— 差值用印章砸下；基线柱用斜线纹理、本文柱实心区分
- `swiss-ikb` —— 信息图风：克莱因蓝只给本文柱，基线纯灰

**结构（5 步 = step 0..4、同轴 0–100、先基线、方差晚揭示、混合证据 badge）保持不变。**
