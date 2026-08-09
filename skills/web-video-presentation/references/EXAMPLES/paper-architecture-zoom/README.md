# Anchor: paper-architecture-zoom（整体→局部放大）

> ⚠️ **这是结构示意，不是抄袭模板。** 先走 [`../../CHAPTER-CRAFT.md`](../../CHAPTER-CRAFT.md)
> Part 0 五问 + [`../../PAPER-INTERPRETATION.md`](../../PAPER-INTERPRETATION.md) §4/§5。
> 保留这里的"形"（step 切分、整体→局部的镜头逻辑、字号关系），按你的论文 + 主题换动画。

## 定位

讲**模型架构**最有效的镜头：先让观众看见**完整 input→process→output 地图**，
再把镜头**推进到某一个核心模块**讲细节，讲完**退回总图**让观众重新定位。对应
[`PAPER-INTERPRETATION.md`](../../PAPER-INTERPRETATION.md) §4「架构 → whole-then-local-zoom」
+ §5「whole→local-zoom」布局。

> 这是初学者理解复杂架构的关键：**先有地图，再看局部**。一张大架构图从头到尾
> 缩在角落 = 论文专属反模式第 7 条。

## 假设的 outline.md 章节段

```markdown
## 3. method-overview — 架构总览与核心模块（6 steps · ~40s）

**信息池**：
- Fig 2 (§3.1)：三段式 input→router→output。reuse: redraw 三盒子 —— article Fig 2
- §3.2：router 内部含 query/key/value 三子模块 —— article §3.2

**开发计划**（outline 里习惯写 1-indexed；落到代码 **step 从 0 起**，见下表）：
- 第 1 步 (~6s) — 整张 input→model→output 地图淡入（3 盒子 + 连线）
- 第 2 步 (~7s) — 镜头推进到中间 model 盒子（scale + translate），两侧灰化
- 第 3 步 (~8s) — model 盒子内部 3 个子模块逐个揭示（1 项 = 1 step 性质）
- 第 4 步 (~7s) — 一个子模块的标注 callout 自绘连线（stroke-dashoffset）
- 第 5 步 (~7s) — 镜头退回总图，model 盒子高亮 accent，其余复位
- 第 6 步 (~5s) — 一句话 takeaway
```

## 关键节奏决策

> ⚠️ `ChapterStepProps.step` 是 **0-indexed**（`step: 0..narrations.length - 1`）。
> outline 里的"第 N 步"落到代码就是 `step === N - 1`。本 anchor 的
> `narrations.ts` 长度 6 ↔ 代码里最大阈值 `step >= 5`。

| step（代码） | 节奏意图 | 主导动作 |
|---|---|---|
| 0 | 给地图 —— 先有全局 | 三盒子 + 连线 mask reveal（**开场即有画面**） |
| 1 | **钻进去** —— 推进镜头 | wrapper `transform: scale + translate`，非焦点灰化到 `--surface-2` |
| 2 | 局部细节 —— 逐个揭示 | 子模块 1 项 1 揭示，前面灰化作上下文（**不**同时飞入） |
| 3 | 指认 —— 这块干嘛 | SVG callout 线 `stroke-dashoffset` 自绘 |
| 4 | **退回来** —— 重新定位 | 反向缩放复位 + model 盒子 accent 高亮 |
| 5 | 收束 —— 一句话 | hero takeaway |

## 布局

`data-composition="diagram-canvas"`（节点 + 连线的自由图示，镜头在画布上推拉）。
镜头容器 `.az-stage` 是 `data-role="primary"`，intro / outro 文字是 `secondary`，
citation / badge / locator / callout 是 `annotation`。

## 证据层（paper mode）

本步演的是**论文事实**（作者画的架构），所以右上挂 `论文事实` badge，左下挂
`Fig 2` locator。step 1–4 都挂。代码里用内联 `EVIDENCE` 数组演示
（真实项目用共享 `components/Evidence.tsx` + 兄弟 `evidence.ts`，见
[`PAPER-INTERPRETATION.md`](../../PAPER-INTERPRETATION.md) §3）。

badge / locator / citation 走**共享**的 `<Evidence>` class：
`ev-badge`（配 `data-evidence="fact|supported|infer|background"`）、`ev-locator`、`ev-citation`，
样式在 `src/styles/evidence.css`，`chapter.css` 里**不再**重复一份。

## 文件结构

```
paper-architecture-zoom/
├── README.md       ← 本文件
├── chapter.tsx     ← 6 步（step 0..5）整体→局部→回总图
├── chapter.css
└── narrations.ts   ← 6 条口播（= step 数，音频唯一真相源，具名导出 `export const narrations`）
```

## 切到其它主题

- `blueprint` —— 盒子换工程蓝图线框，连线用虚线 + 标注尺寸
- `terminal-green` —— 盒子换"MODULE_01"终端框，callout 用打字机
- `tufte-ink` —— 盒子去掉填充只剩 hairline 边，最学术；zoom 用更慢的缓动

**结构（6 步 = step 0..5、整体→局部→回总图、逐个揭示）保持不变。**
