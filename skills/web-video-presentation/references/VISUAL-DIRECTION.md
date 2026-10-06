# 视觉方向（Visual Direction）

每章开工前必读的视觉规划层 —— 把"舒服 / 突出 / 配色好"这些定性要求
翻译成可命名的构图、可声明的视觉角色、可静态验收的英雄帧。

> **为什么需要这一层**：[`CHAPTER-CRAFT.md`](CHAPTER-CRAFT.md) 已经规定
> 了"大字号 / 大留白 / 内容驱动动画 / 一项一个 step / 反 AI 味"等原则，
> 但很多表述仍是定性的。不同 agent 对"舒服"的解释差别很大 —— 它知道
> 不能做坏，却缺少一套稳定地产生好构图的中间表达。
>
> 这一层就是那套中间表达。读完这一份再开工，能避免 agent 直接跳进
> CSS 后凭感觉摆元素。
>
> **它不替代 [`CHAPTER-CRAFT.md`](CHAPTER-CRAFT.md)** —— 它是配套：
> CHAPTER-CRAFT.md 管"原则 + 节奏 + 反模式"，本文件管"构图 + 角色 +
> 密度 + 英雄帧"。开工时**两份都看**。

---

## 1. 八个构图（Composition Vocabulary）

内容驱动的有限构图词汇。**禁止在已有模板外另造花样** —— 八个够用了，
新花样只会让不同章节气质漂掉。

| 构图 | 适合内容 | 不适合 |
|---|---|---|
| **centered-hero** | 核心结论 / 概念名 / 关键数字 / 金句 | 多元素对比 / 数据列表 |
| **asymmetric-60-40** | 架构图 + 解释 / 论文图表 + 结论 / 公式 + 释义 | 单一物体特写 |
| **split-screen** | 基线 vs 新方法 / 成功 vs 失败 / A vs B | 三项及以上对照 |
| **rule-of-thirds** | 主视觉 + 短注释 / 大数字 + 出处 | 多焦点内容 |
| **full-width-strip** | 时间线 / token 序列 / 算法步骤 / 数据带 | 孤立的中心焦点 |
| **layered-depth** | 开场 / 抽象概念 / 机制总览 / 章节封面 | 信息密度低的 step |
| **triptych** | 严格的三项对照（红 / 绿 / 蓝三栏） | 两项或四项内容 |
| **diagram-canvas** | 模型架构 / 节点网络 / 计算流程 / 自由图示 | 文字主导 step |

### 1.1 八个构图的判定规则

实施时强制：

- **相邻 step 不用同一构图** —— 让视觉节奏呼吸
- **每章至少 3 种不同构图**（内容允许时）—— 单构图整章 = 视觉单一
- **主视觉占有效画面 ≥ 40%**（"主视觉"= primary 角色元素的视觉面积，
  不含 background / 装饰）—— 见 §2 角色定义
- **一主一辅**：每步一个主焦点 + 一个次级锚点，**禁止**多元素平权
  竞争观众视线
- **空白围绕焦点形成方向** —— 留白不是"内容没铺满"，是构图工具

### 1.2 八个构图的 CSS 原语

**统一用 `data-*` 属性，不用 class。** 构图和视觉角色都是"这个元素是什么"
的语义声明，属性选择器（`[data-composition="..."]`）比 class 更能表达这层
含义，也让 `layout:check`（静态扫源码）和 `?layout=1`（运行时读 DOM）用
**同一套契约**，不会出现"CSS 认 class、检查器认属性"的分裂。

[`templates/src/styles/composition.css`](../templates/src/styles/composition.css)
已实现全部八个，开箱即用。**在每步 scene 根元素上声明构图名**：

```tsx
<div className="scene-pad" data-composition="centered-hero">
```

八个合法值：

```
centered-hero        asymmetric-60-40
split-screen         rule-of-thirds
full-width-strip     layered-depth
triptych             diagram-canvas
```

**主视觉 / 次级 / 背景 / 注释元素**分别打 `data-role="primary"` /
`data-role="secondary"` / `data-role="background"` / `data-role="annotation"`：

```tsx
<div className="scene-pad" data-composition="asymmetric-60-40">
  <div className="ch-grid"    data-role="background" />
  <figure className="ch-chart" data-role="primary">…</figure>
  <p className="ch-caption"    data-role="secondary">…</p>
  <span className="label-mono" data-role="annotation">Fig 3 · §4.2</span>
</div>
```

这样 `?layout=1` debug overlay 和 `npm run layout:check` 都能直接读出每步
的视觉骨架。

#### `data-composition` vs `data-composition-layout`（重要）

这两件事是分开的，别混：

| 你写的 | 效果 |
|---|---|
| `data-composition="split-screen"` | **只是命名锚点**。给 `npm run layout:check` 和 `?layout=1` 读出"这步用的是什么构图"，用于构图重复检查、bbox 归因、readout 显示。**不影响任何渲染** —— 布局仍然完全由你自己的 chapter CSS 决定 |
| `data-composition="split-screen" data-composition-layout` | **额外 opt-in**：composition.css 里对应那条布局规则接管这一步的布局（grid / padding / 安全区 / role 定位都由它给） |

`data-composition-layout` 是**无值属性**（写上即生效，不需要 `="true"`）。

也就是说：**8 条构图布局规则是 opt-in 的**。默认只声明 `data-composition`
时，composition.css 不会碰你的布局 —— 想让它接管，才额外加
`data-composition-layout`。

```tsx
{/* A. 只做语义标注：布局归 chapter CSS 自己管（默认、最常用） */}
<div className="ch-split" data-composition="split-screen">…</div>

{/* B. 让 composition.css 直接给布局：省掉手写 grid */}
<div data-composition="split-screen" data-composition-layout>
  <div data-role="primary">…</div>
  <div data-role="secondary">…</div>
</div>
```

即使走 A（不接管布局），**`data-composition` 也仍然是必填的** ——
`layout:check` 把"根元素没有 `data-composition`"判为 fail。

---

## 2. 视觉角色与层级（Visual Roles & Hierarchy）

每步画面分成四个角色层。**这是结构性要求，不是建议** —— 不声明角色
等于不知道哪是焦点，画出来一定平。

```
┌─────────────────────────────────────────────────────┐
│  background    环境层：网格、色场、装饰、ghost 文字   │
│                —— 不承担主要信息                     │
├─────────────────────────────────────────────────────┤
│  primary       这一拍的主要认知对象                   │
│                —— 观众的视线第一站                   │
├─────────────────────────────────────────────────────┤
│  secondary     帮助解释 primary 的次级锚点            │
│                —— 解释 / 注释 / 上下文图             │
├─────────────────────────────────────────────────────┤
│  annotation    数字 / 标签 / 单位 / 出处              │
│                —— 最后才被读到                       │
└─────────────────────────────────────────────────────┘
```

### 2.1 论文解读特化：单一焦点

通用教学视频可以允许"两个焦点"做并列概念。但**论文 / 概念解读需要
单一认知焦点**（观众同时消化不了两个新概念）—— 强制：

> **论文 / 教学 step：一主一辅。** primary 占视觉主导，secondary 只
> 做"协助 primary 被理解"的角色，不允许与 primary 平权。

### 2.2 层级建立手段（至少两种）

层级不是"把标题放大"。**至少同时使用以下手段中的两种**，否则层
级读不出来：

1. **尺寸比例** —— primary 与 secondary 字号差 ≥ 2×
2. **字重对比** —— primary 与 secondary weight 差 ≥ 300（700 vs 400）
3. **明暗 / 色彩对比** —— primary 用 `--text`，secondary 用 `--text-mute`
4. **位置** —— primary 居中或黄金分割点，secondary 偏侧
5. **动态强度** —— primary 入场动画更明确（位移 + 缩放），secondary
   只淡入
6. **前后景深度** —— background 用 `--surface-3` / `--text-faint`
   弱化，primary 用 `--text` 强化（见 `composition.css` 的 depth token）

---

## 3. 英雄帧（Hero Frame）契约

**英雄帧**：每步"最完整、最可读"的画面 —— 所有元素都在最终位置、
字号正确、对比充分、无溢出、留白平衡。**这是先要静态成立的状态**。

### 3.1 为什么 hero frame 是契约不是建议

动画的入场状态（`opacity: 0`、`translateY(20px)`、`scale(0.9)`）
会**掩盖**重叠、越界、视觉失衡 —— 元素都在位置上时这些问题才暴露。
如果先写动画，bug 会被藏到视频渲染完才发现。

> **铁律**：每步实现顺序 = 关系 → 构图 → 英雄帧 → 动作 → 持留
>
> 1. **关系**：这一步讲什么，primary / secondary 是什么
> 2. **构图**：从 §1 八个里选一个
> 3. **英雄帧**：写完静态终态，**关掉所有动画**看一遍
>    （或开 `?layout=1` 模式逐 step 检查）
> 4. **动作**：给 primary / secondary 加 entrance / accent 动画
> 5. **持留**：动作结束后稳态保持，与下一 step 衔接

### 3.2 英雄帧验收清单（每步静态检查）

- [ ] 主视觉占有效画面 ≥ 40%
- [ ] 没有元素溢出 1920×1080（含 transform 后的视觉边界）
- [ ] 没有小于 `var(--text-min)` 的正文（默认 20px）
- [ ] 长标题都有 `max-width` 约束，不会一行铺满 1920
- [ ] 留白围绕焦点形成方向，不是四角均匀空白
- [ ] 至少两种层级手段生效（§2.2）
- [ ] background 不抢戏（饱和度 / 亮度与 primary 拉开差距）
- [ ] 与上一步 / 下一步构图不同（相邻 step 同构图 = 视觉无呼吸）

---

## 4. 密度规则（Density Tokens）

观众离屏幕远 + 录屏后视频编码压缩细节，所以**字号不能按网页标准**。
这套默认下限在 [`templates/src/styles/base.css`](../templates/src/styles/base.css)
以 CSS 变量定义，主题 / 章节可覆盖：

| Token | 默认值 | 含义 |
|---|---|---|
| `--headline-min` | 60px | hero / h1 字号下限 |
| `--body-min` | 20px | 正文下限（绝对不要写 14px / 16px） |
| `--data-min` | 16px | 数据标签 / 出处 / 角标下限 |
| `--max-text-width` | 60ch | 长正文 max-width 锚点（标题用 24~28ch） |
| `--safe-bottom` | 80px | 底部安全区（保留给字幕 / 进度条） |
| `--safe-side` | 80px | 左右安全区 |
| `--safe-top` | 80px | 顶部安全区 |

**章节 CSS 应消费这些 token 而非写死 px**：

```css
.bad-example { font-size: 14px; max-width: 100%; }   /* ✗ 踩下限 */
.good-example {
  font-size: var(--body-min);
  max-width: var(--max-text-width);
}
```

### 4.1 字距 / 数字

- **大字号（≥ 60px）**：`letter-spacing: -0.02em ~ -0.04em`（视频编码压缩字
  间距细节，宽松会被放大成松散）
- **小字号数据列**：`font-variant-numeric: tabular-nums`（垂直堆叠数字
  必须等宽，否则基线歪）
- **全大写小字 mono 标签**：`letter-spacing: 0.18em ~ 0.22em`（已是
  primitive `.label-mono` / `.kicker` 的默认）

---

## 5. 反 AI 味检查清单（**AI Tells**）

每章完工前**逐项过**。任何一项出现 = 必须回去改 —— 哪怕只出现一处。

**通用 AI 视觉指纹**：

- [ ] 紫粉 / 蓝紫对角渐变背景（**任何方向**）
- [ ] 圆角卡片 + 彩色左边框装饰条
- [ ] 渐变按钮 / 大圆角药丸 / glassmorphism 默认
- [ ] emoji 当图标（任何地方）
- [ ] 假数据 / 假 logo / 假 "X 万用户"
- [ ] 整章 N 步用同一种入场动画（全场 fade / 全场 blur）
- [ ] 每步都挂 ken burns / 光晕呼吸 / 持续闪烁
- [ ] 每屏右下角都挂 mono 角标 / 序号（除非 chapter 自有意图）
- [ ] `background-clip: text` 渐变文字
- [ ] Inter / Roboto / Open Sans / Noto Sans / Poppins / Nunito /
      Outfit / Sora / Playfair Display / Syne 默认字体
- [ ] 纯 `#000` 或 `#fff` 当唯一底色
- [ ] 整章全部 step 同一个字号
- [ ] 多卡片完全一样的圆角 + 阴影 + 内边距（grid-of-identical-cards）

**论文专属反模式**（[`PAPER-INTERPRETATION.md`](PAPER-INTERPRETATION.md) §9
已有完整版，本文件不重复）：无统一坐标轴放大差异 / 只晒最好结果 /
讲者猜测伪装成论文结论 / 重绘图悄悄改坐标 / 强塞公式 / 屏幕念摘要。

---

## 6. 如何把这一层接进现有流程

### 6.1 与 outline.md 的边界

**outline.md 仍然不规划视觉** —— 这是核心原则，本文件不打破。
但 outline 现在每步要写 3 个新字段（不改 outline 格式就不算"规划
视觉"，只是"声明意图"）：

```
- step 3 (~7s) — 移除模块 B 后 GLUE 分数从 86.2 掉到 81.4
    purpose: 解释模块 B 在消融实验中的作用
    focal: Δ 数字与下降柱顶
    content relationship: 反差对照（消融 vs 基线）
```

字段含义：

- **purpose** —— 这步在讲什么（一个动词 + 一个对象）
- **focal** —— 观众视线第一站是什么（一件具体物）
- **content relationship** —— 这一拍与上 / 下拍的关系（递进 /
  反差 / 收束 / 铺垫 / 揭示 / 持留 / 列举 / 总览）

详见 [`OUTLINE-FORMAT.md`](OUTLINE-FORMAT.md) 的更新章节。

### 6.2 与章节实现顺序的边界

CHAPTER-CRAFT.md 是单一必读入口。本文件提供的额外步骤**插入在**
"开工 5 问"之后、"写 JSX"之前：

```
读完 CHAPTER-CRAFT.md
  ↓
Part 1 开工 5 问（CHAPTER-CRAFT.md）
  ↓
★ 新增：选构图（从 §1 八个里挑一个）
  ↓
★ 新增：标视觉角色（primary / secondary / background / annotation）
  ↓
★ 新增：写静态英雄帧（无动画，?layout=1 看一遍）
  ↓
Part 2 关系 → 动作决策树（CHAPTER-CRAFT.md）
  ↓
Part 3 视觉工具箱（CHAPTER-CRAFT.md）
  ↓
Part 4 时长（CHAPTER-CRAFT.md）
  ↓
Part 5 反 AI 味（含本文件 §5）
  ↓
Part 6 代码硬规则（CHAPTER-CRAFT.md）
  ↓
Part 7 完工自检（含本文件 §3.2 英雄帧验收）
```

### 6.3 与动画蓝图的边界

本文件管"每步看起来怎么样"。**动画蓝图**（怎么动、按什么顺序进
入 / 退出）见 [`MOTION-BLUEPRINTS.md`](MOTION-BLUEPRINTS.md) —— 论文
/ 教学常用的 13 种动画节拍模板，以及所有动画都要守的 §0 通用约束。

---

## 7. 给 chapter agent 的最短路径

如果时间紧 / 内容简单，按下面四步走就足以避免最常见的视觉崩塌：

1. **选构图**：从 §1 八个里选一个（不知道选哪个就 `centered-hero`
   起手，最稳）
2. **标角色**：在 JSX 根元素加 `data-composition="..."`，primary
   元素加 `data-role="primary"`，其他同理（`secondary` / `background` /
   `annotation`）。想让 composition.css 直接给布局，再在根元素补一个
   `data-composition-layout`（见 §1.2）
3. **写静态英雄帧**：先不加任何 animation / transition，写完打开
   `?layout=1` 走一遍所有 step，看主视觉占位、留白方向、出界
4. **加最小动画**：primary 用一个 600ms 的入场；其他元素按内容
   关系决定（参考 [`MOTION-BLUEPRINTS.md`](MOTION-BLUEPRINTS.md)）

任何一步发现"这步做完看着就是 PPT" → 回 §3 英雄帧验收清单，逐
项修复。
