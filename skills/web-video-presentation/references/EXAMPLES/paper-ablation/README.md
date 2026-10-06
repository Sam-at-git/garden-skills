# Anchor: paper-ablation（消融实验：移除模块→指标下降）

> ⚠️ **结构示意，不是抄袭模板。** 先走 [`../../CHAPTER-CRAFT.md`](../../CHAPTER-CRAFT.md)
> Part 0 五问 + [`../../PAPER-INTERPRETATION.md`](../../PAPER-INTERPRETATION.md) §4/§5。

## 定位

消融实验是培养**研究判断力**的章节：哪个组件真正有效？对应
[`PAPER-INTERPRETATION.md`](../../PAPER-INTERPRETATION.md) §4「ablation → remove-module-metric-drops」
+ §5「two-col-compare」布局。**同一坐标轴**，逐个移除模块，指标同步下降。

> 反模式（§9 第 2 条）：只晒最好结果，不讲基线 / 方差 / 失败。本 anchor
> **先画完整模型基线，再逐个移除**，并且最后揭示**方差**——让观众看见"提升
> 是否稳定"，而不只是"降了多少"。

## 假设的 outline.md 章节段

```markdown
## 7. ablation — 哪个模块真正有效（5 steps · ~35s）

**信息池**：
- Table 3 (§4.2)：完整模型 GLUE 86.2；移除 router → 81.4（Δ -4.8）；移除 gate → 83.1（Δ -3.1）—— article Table 3
- 方差 ±0.3（3 次种子）—— article §4.2 脚注

**开发计划**（outline 里习惯写 1-indexed；落到代码 **step 从 0 起**，见下表）：
- 第 1 步 (~7s) — 完整模型基线柱长满，数字 86.2
- 第 2 步 (~8s) — "移除 router" → 柱子长到更矮处，Δ -4.8 砸下
- 第 3 步 (~7s) — "移除 gate" → 第二根出场，Δ -3.1
- 第 4 步 (~7s) — 方差须 ±0.3 显出（晚揭示 = 反"只晒最好"）
- 第 5 步 (~6s) — takeaway：router 才是关键
```

## 关键节奏决策

> ⚠️ `ChapterStepProps.step` 是 **0-indexed**（`step: 0..narrations.length - 1`）。
> outline 里的"第 N 步"落到代码就是 `step === N - 1`。本 anchor 的
> `narrations.ts` 长度 5 ↔ 代码里最大阈值 `step >= 4`。

| step（代码） | 意图 | 主导动作 |
|---|---|---|
| 0 | 立基线 | 基线柱 `height` 过渡到满刻度 + 数字 86.2（**开场即有画面**） |
| 1 | 移除一个 | 柱子长到更矮处 + Δ 数字 accent 砸下（`-4.8`） |
| 2 | 再移除一个 | 第二根出场 + Δ；第一根灰化（`.is-context`）作上下文 |
| 3 | **稳不稳？** | 方差须 `±0.3` 后揭示（刻意晚，逼观众想"这是不是噪声") |
| 4 | 判断 | takeaway：router 掉得最多 = 它最关键 |

## 图表诚实性：截断轴必须**标出来**

三根柱子共用**同一把刻度**，但这把刻度是**截断的**——纵轴从 68 起、到 88 止
（`AXIS = { min: 68, max: 88 }`，高度一律由 `pct()` 线性算出，没有任何一根柱子
自带手写高度）。理由：4.8 分的差落在 0–100 上只有 17px，消融章要演的"掉下来"
就没了。

截断是允许的，但**必须同时**做到两件事，否则就是
[`PAPER-INTERPRETATION.md`](../../PAPER-INTERPRETATION.md) §9 第 1 条
（图表无统一坐标轴 → 差异被视觉放大）：

1. 画面上画出 Y 轴根部的**截断标记**（`.pa-axis-break`，两道斜杠）；
2. 轴标注写明**真实区间**：`GLUE · 68–88（轴已截断）`——不是含糊的 `100 · GLUE`。

> 对比：`paper-experiment-chart/` 的差值有 14.8 分，0–100 的诚实线性映射就够看，
> 那里**不**截断。**能不截断就不截断**。

## 证据层（paper mode）

这是**实验支持**（论文 Table 3 的数字能证明），右上挂 `实验支持` badge，左下挂
`Table 3` locator。step 1–4 都挂。注意：`实验支持` 用主题唯一强调色 `--accent`，
视觉权重最高——因为它**有数据撑腰**。

badge / locator / citation 走**共享**的 `<Evidence>` class：
`ev-badge`（配 `data-evidence="fact|supported|infer|background"`）、`ev-locator`（`ev-citation` 已退役，不挂），
样式在 `src/styles/evidence.css`，`chapter.css` 里**不再**重复一份。

## 文件结构

```
paper-ablation/
├── README.md · chapter.tsx · chapter.css · narrations.ts
```

`narrations.ts` 用**具名导出** `export const narrations: string[]` —— `registry/chapters.ts`
和 `scripts/extract-narrations.ts` 都只认这个形式，写成 `export default` 会让 TTS 管线直接报错。

布局：`data-composition="asymmetric-60-40"` + `data-composition-stable="true"`
（消融序列刻意 5 步同构图，理由见 [`VISUAL-DIRECTION.md`](../../VISUAL-DIRECTION.md) §1.1）。
图表 `.pa-chart` 是 `data-role="primary"`，标题是 `secondary`，证据层是 `annotation`。

## 切到其它主题

- `tufte-ink` —— 柱子去掉填充只剩 hairline 边框 + 数据墨水最少；方差须用虚线
- `newsroom` —— Δ 数字用印章砸下；基线柱用实心、消融柱用斜线纹理区分
- `terminal-green` —— 数字用打字机滚动；柱子用 phosphor 绿渐变

**结构（5 步 = step 0..4、同轴、先基线后移除、截断轴必标、方差晚揭示）保持不变。**
