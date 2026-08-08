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

**开发计划**：
- step 1 (~7s) — 完整模型基线柱顶满，数字 86.2
- step 2 (~8s) — "移除 router" → 柱子缩矮，Δ -4.8 砸下
- step 3 (~7s) — "移除 gate" → 第二根缩矮，Δ -3.1
- step 4 (~7s) — 方差须 ±0.3 显出（晚揭示 = 反"只晒最好"）
- step 5 (~6s) — takeaway：router 才是关键
```

## 关键节奏决策

| step | 意图 | 主导动作 |
|---|---|---|
| 1 | 立基线 | 基线柱 `height` 过渡到满 + 数字 86.2 |
| 2 | 移除一个 | 柱子 `height` 缩 + Δ 数字 accent 砸下（`-4.8`） |
| 3 | 再移除一个 | 第二根缩 + Δ；第一根灰化作上下文 |
| 4 | **稳不稳？** | 方差须 `±0.3` 后揭示（刻意晚，逼观众想"这是不是噪声") |
| 5 | 判断 | takeaway：router 掉得最多 = 它最关键 |

## 证据层（paper mode）

这是**实验支持**（论文 Table 3 的数字能证明），右上挂 `实验支持` badge，左下挂
`Table 3` locator。step 2–5 都挂。注意：`实验支持` 用主题唯一强调色 `--accent`，
视觉权重最高——因为它**有数据撑腰**。

## 文件结构

```
paper-ablation/
├── README.md · chapter.tsx · chapter.css · narrations.ts
```

## 切到其它主题

- `tufte-ink` —— 柱子去掉填充只剩 hairline 边框 + 数据墨水最少；方差须用虚线
- `newsroom` —— Δ 数字用印章砸下；基线柱用实心、消融柱用斜线纹理区分
- `terminal-green` —— 数字用打字机滚动；柱子用 phosphor 绿渐变

**结构（5 步、同轴、先基线后移除、方差晚揭示）保持不变。**
