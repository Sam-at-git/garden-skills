# 论文解读视频（Paper Mode）

> 输入是一篇**研究论文**（arXiv / 会议 / 期刊 / 技术报告）时，在 `SKILL.md`
> 之上**加读本文件**。它给同一套 4 阶段流程叠加论文专属纪律，**不替代**
> `SKILL.md` / [`CHAPTER-CRAFT.md`](CHAPTER-CRAFT.md) / [`SCRIPT-STYLE.md`](SCRIPT-STYLE.md)
> / [`OUTLINE-FORMAT.md`](OUTLINE-FORMAT.md) —— 通用规则照样适用，本文件只补论文特有的东西。
>
> 论文本就比普通文章难讲：术语密、有公式有图表、结论和猜测常常混在一起。
> 本文件回答四件事，也就是一条论文视频必须让观众带走的：
>
> 1. **这篇为什么值得看？**（问题 / 失败演示）
> 2. **它到底做了什么？**（方法 / 机制 / 证据）
> 3. **我能信到什么程度？**（实验支持 vs 讲者推断，**分开标**）
> 4. **下一步怎么复现？**（研究者行动清单）

---

## 0. 什么时候进入 paper mode

命中**任意一条**即按本文件走：

- 源文件是 PDF 论文 / arXiv 页面 / 会议期刊 paper
- 源里出现 §章节号、`Fig N`、`Table N`、`Eq N`、`Algorithm N`、引用 `[12]`
- 标题/摘要里有 abstract / contributions / we propose / we show / SOTA / benchmark
- 用户明说"解读这篇论文 / 讲讲这篇 paper"

**不是论文**（博客 / 课程笔记 / 产品测评 / 公众号）→ 走 `SKILL.md` 默认流程，不读本文件。

> 💤 想让 agent **全程默认、不停下来问**？见 §12 静默模式（**仅论文输入**）。

> ⚠️ 读完本文件后，写章节时仍以 [`CHAPTER-CRAFT.md`](CHAPTER-CRAFT.md) 为单一
> 行为入口；本文件提供的是**内容结构 + 认识论纪律 + 论文专属动画/布局/公式**，
> 叠加在 CHAPTER-CRAFT 之上。两份都过才算合格。

---

## 1. Phase 0 —— 论文摘要 `paper-digest.md`（论文输入必做）

普通文章用 `article.md` 就够；论文必须**先做一份结构化摘要**，作为证据层
（§3）的引用来源。它是论文版的 `article.md`，但**带定位符（locator）**。

### 1.1 落盘位置（工作目录约定，仅论文输入出现）

```
my-paper-video/
├── article.md          # 论文原文（PDF→md / arXiv HTML→md）；保留不删
├── paper-digest.md     # ★ 仅论文输入：结构化摘要，证据层引用源
├── script.md           # 口播稿（节拍）
├── outline.md          # 开发计划（每章信息池条目带 locator）
└── presentation/
```

### 1.2 `paper-digest.md` 的 12 节（逐节填）

1. **书目**：标题 / 作者 / 会议或 `arXiv:XXXX.YYYYY` / url / **官方代码链接** / 附录链接
   —— 喂给角落常驻 citation chip（§3）+ 复现清单（§10）。
2. **论文类型 + 一句理由**：`empirical | methods | survey | theory | system`。
   **决定走 §2 哪一支叙事弧。**
3. **一句话主张**：论文的核心贡献，≤30 字。
4. **问题 / 失败演示**：没有这篇会怎样？旧方法在哪里翻车？—— cold-open 弹药。
5. **仅必要前置知识**：理解本文**必需**的 2–3 个概念，每个配一个例子（不是定义）。
   其它一律"先信我，后面用到再说"。
6. **方法总览（input → process → output）**：先画**完整流程图**，再放大细节。
   初学者必须先有"地图"。
7. **核心机制**：直觉 → 图 → 必要公式 → 微型样例（四步，见 §7）。
8. **关键图表方程（带 locator + 复用决策）**—— 摘要的心脏。每个 artifact 一块：
   ```
   - Fig 2 (§3.1)：架构总览。证明：input→process→output 地图。
     reuse：redraw（简化成 3 个盒子）；忠实度：保留数据流方向与模块命名。
   - Table 3 (§4.2)：消融。证明：移除 router 后 GLUE 4.6→1.1。
     reuse：redraw 成同坐标轴柱图（baseline vs 移除）；保留方差 ±0.3。
   - Eq 4 (§3.2)：路由目标。reuse：4 步揭示，q/k/v 固定配色（见 §7）。
   ```
   每个 artifact 明确 **redraw / animate / cite** 取舍（§6）+ 忠实度注（不扭曲数据/坐标/刻度，保留方差与基线）。
9. **结果**：数据集 / 基线 / 指标 / 头条增益 **+ 方差 + 公平性/稳定性说明**。
10. **消融与失败案例**：移除每个模块会怎样；在什么数据 / 规模 / 条件下失效。
11. **局限**：作者述的 + 讲者自己的（后者一律标 `infer`，§3）。
12. **复现**：官方代码 / checkpoint / 附录页 / 算力估计 / 推荐先跑哪个实验。

### 1.3 locator 纪律（铁律）

> 每个要上屏幕的 digest 条目**必须**带 `§X / Fig Y / Table Z / Eq N`。
> 没有 locator 的内容，证据层（§3）只能标 `infer`，**永远不能**标 `fact`/`supported`。

这逼着 chapter agent 实现"论文事实"时**回得去原文**，而不是凭印象。

---

## 2. 论文类型 menu → 叙事弧（非刚性 8 步，按类型分叉）

> **不要**把任何论文都塞进同一个 8 步模板。先定类型，再走对应弧。
> 弧是"节奏骨架"，章节切分 / step 数 / 估时仍按 [`OUTLINE-FORMAT.md`](OUTLINE-FORMAT.md)。

### 2.1 通用开场（所有类型）

论文视频固定用一个 **2 拍招呼式开场** 起手，再进入"问题失败" cold-open ——
这是**论文视频专属的开场惯例**（通用视频不受此约束，仍走 [`SCRIPT-STYLE.md`](SCRIPT-STYLE.md)
的"开头有钩子"）：

- **step 0 · 招呼** ——「大家好！」独占一屏。大字入场 + 一个**与论文主题相关的字形
  / wordmark 自绘画出**（SVG `stroke-dashoffset`，**禁 emoji、禁纯文字步**）。控制在
  ~1.5s 内，招呼要短。
  - 选形：取论文最辨识的符号。PhiZero → Φ（圆 + 竖线）；RL / 策略论文 → 策略箭头；
    系统论文 → 架构方块简笔；评测论文 → 基准靶心。
- **step 1 · 钩子式一句话概述** —— **一句**抓人的话 = **[钩子语气] + [这篇新造的核心概念]
  + [它的核心做法 / 范式]**，配一个范式小标签（如 `reason → render`）。
  - 例子（PhiZero）：「今天这篇 PhiZero，干了一件挺野的事：给物理世界，专门发明一门
    **语言**，让 AI 先想清楚，再画出来。」
  - **红线**：概述必须是**具体的核心想法**，不是"本期视频我们将探讨…"PPT 标题套话。
    通用 [`SCRIPT-STYLE.md`](SCRIPT-STYLE.md) 的反 AI 味五类在这里同样适用 —— 钩子语气
    可以自来熟，信息必须硬。
- **step 2 起 · cold-open 演"问题失败"** —— 原有规则：不从标题 / 作者 / 摘要开始，先让
  观众**看见**旧方法翻车。
- **角落常驻 citation chip**（标题缩写 · 作者 · arXiv id）从 step 1 就挂 —— 化解"不从标题
  开始"与"披露诚实"的冲突：**招呼 + 概述在前，画面演问题，角落挂出处**，两不耽误。
- **一句话主张**，并**当场标清**：这是作者声称的（claim），还是实验已证的（proven）。
  见 §3 证据层。

> 这 2 拍和 SCRIPT-STYLE 的"开头要有钩子"不冲突：招呼只是破冰，真正的钩子是 step 1
> 那句概述 + step 2 的问题演示。

### 2.2 五类弧（按 §1.2 第 2 节定的类型选）

| 类型 | 叙事弧（粗略章节顺序） | 关键差异 |
|---|---|---|
| **empirical**（实证：新数据/评测/发现） | 问题→主张→前置→方法总览→实验证据→消融→行动清单 | 证据章是重心；图表主场（§5） |
| **methods**（新方法/新架构/新算法） | 问题→主张→input→process→output 地图→核心机制（直觉→图→公式→样例）→证据→消融→适用边界清单 | 机制章是重心；整体→局部放大（§5） |
| **survey**（综述/分类） | 问题→主张→**分类地图**→每类一个代表→开放问题→"怎么用这篇综述"清单 | **无消融**；用分类地图/象限，不深挖单一机制 |
| **theory**（理论/证明/界） | 问题→主张→直觉→**证明 sketch（非完整证明）**→这个界给你换来什么→紧致度→含义清单 | 公式/界是重心；只画证明草图，别整段推 |
| **system**（系统/工程/infra） | 问题→主张→架构（先整体）→benchmark→工程取舍→部署清单 | 架构图 + 真实跑分；讲清工程权衡 |

> 经验法则：empirical / methods 通常 7–9 章；survey 用分类地图可少到 5–6 章；
> theory 别超过 6 章（证明讲多了观众跑光）。每章仍守 [`OUTLINE-FORMAT.md`](OUTLINE-FORMAT.md)
> 的 3–8 step / 30–60s。

---

## 3. 证据层（核心）—— fact / supported / infer 三类标注

> **这是论文视频最该补的纪律。** 通用 skill 只有形式/风格纪律，没有认识论纪律。
> 初学者最大的坑：**把讲者的猜测当成论文结论**。证据层用一致的视觉语言把三者分开。

### 3.1 三类 claim

| 类型 | 中文 | 含义 | 视觉权重 |
|---|---|---|---|
| `fact` | **论文事实** | 作者**实际写了**的（正文/图/表/方程，可回引 locator） | 中性墨色，不偏不倚 |
| `supported` | **实验支持** | 论文**数据能证明**的（cite 到具体 Table/Fig 的数字） | 唯一的强调色（= 主题 accent） |
| `infer` | **解读推断** | 讲者**自己的理解/猜测**，论文里**没有** | 明显弱化 + 虚线（讲者之声，非论文结论） |

**铁律**：一个 `infer` 步骤的视觉**必须**读作"讲者在插嘴"，**绝不能**和论文结论同等
权重。否则就是证据层最大的罪（§9）。

### 3.2 落地：独立 `evidence.ts`（章节 `narrations.ts` 的兄弟文件）

> ⚠️ **绝不**扩展 `narrations.ts`。`extract-narrations.ts` 对非 string 的 narration
> 直接 `throw`，且 `narrations.ts` 是 step 数 + 音频的**唯一真相源**。证据是**独立的
> 兄弟文件**，只被章节 `.tsx` import，音频管线根本不读它。

每章一个 `evidence.ts`（与 `<Chapter>.tsx` 同目录）：

```ts
// src/chapters/03-method/evidence.ts
export type ClaimType = "fact" | "supported" | "infer";

// 类型从组件里 import，不用重复声明：
//   import type { EvidenceMark } from "../../components/Evidence";
//
// export interface EvidenceMark {
//   step: number;               // 0-indexed，对齐章节的 step
//   type: ClaimType;
//   locator: string | null;     // "§3.2" | "Fig 4" | "Table 2" | "Eq 7" | null（仅 infer 可 null）
//   note?: string;              // 简注：屏幕上挂的那个数字/论点
// }

export const citation = {
  title: "Memory for Large Language Models",
  authors: "Zhoubian et al., 2024",
  venue: "arXiv:2406.07223",
};

export const evidence: EvidenceMark[] = [
  { step: 2, type: "fact",      locator: "§3.2",    note: "作者定义的 query-token 路由" },
  { step: 3, type: "supported", locator: "Table 2", note: "GLUE +4.6，方差 ±0.3" },
  { step: 4, type: "infer",     locator: null,      note: "我的解读：这可能解释长上下文掉点" },
];
```

### 3.3 `<Evidence>` / `<CitationChip>` —— 脚手架自带，不用拷贝

证据层是**随脚手架一起装好的**，不是一段要往项目里粘的代码：

- `src/components/Evidence.tsx` —— 组件 + `EvidenceMark` / `ClaimType` 类型
- `src/styles/evidence.css` —— 配套样式，已由 `App.tsx` import

用法（`EvidenceMark` 的类型直接从组件里 import，不用另建类型文件）：

```tsx
import { Evidence, CitationChip } from "../../components/Evidence";
import { evidence, citation } from "./evidence";

// 章节里，本步该挂哪个 badge 由 step 自动决定
<Evidence step={step} marks={evidence} />
<CitationChip citation={citation} />
```

样式是 **token-only、0 新色相**：三类 claim 走 `--ev-fact` /
`--ev-supported` / `--ev-infer`，全部带内联 fallback（分别退到 `--text` /
`--accent` / `--text-mute`），所以 24 套主题开箱即用；主题想调就在自己的
`tokens.css` 里覆盖这三个变量（`tufte-ink` 已经这么做了）。

claim 类型走 `data-evidence="fact|supported|infer"` 属性 —— 与
`data-composition` / `data-role` 同一套属性驱动约定，不用 class 变体。
`infer` 除了颜色更弱，还额外走**虚线边框**，这样即使录屏被转成灰度，
"这是讲者的推断"这件事也不会丢。

badge / locator / citation 的落位用 `--safe-*`（跟随主题的 stage padding），
不写死 48px —— 宽边距主题（`dune` 150px、`tufte-ink` 110px）下不会贴边。

### 3.4 三种落位（ASCII）

```
┌─ ev-citation（常驻出处） ───────────────── ev-badge（本步主导 claim 类型） ─┐
│  Memory for LLMs · Zhoubian · arXiv:2406.07223            [ 实验支持 ]      │
│                                                                            │
│                       …… 主舞台（这一步演的东西）……                         │
│                                                                            │
│  ev-locator（§X / Fig Y / Table Z）                                        │
└──────────────────────────── 16:9 1920×1080 ────────────────────────────────┘
```

- **右上 badge**：本步**主导** claim 的类型（一个步通常一个主导类型；混时取主）。
- **左下 locator**：仅 `locator !== null` 时出现（fact/supported 必有；infer 通常 null）。
- **左上 citation chip**：全片常驻，**不是**每步换。

> 一个 step 可以挂**多个** badge（如实验章最后一步：数字是 `supported`，讲者对
> "公不公平"的评价是 `infer`）—— `infer` 那个必须视觉更弱。EXAMPLES 里
> `paper-experiment-chart/` 演示这种混合。

---

## 4. 内容 → 动画 → 布局 map（论文专属，叠加在 CHAPTER-CRAFT Part 2 决策树之上）

> 原则不变（[`CHAPTER-CRAFT.md`](CHAPTER-CRAFT.md) Part 0 原则 7）：**内容关系决定动画**，
> 不是先选动画效果。下表是论文场景的关系→动作→布局速查。

| 论文内容 | 推荐主导动画 | 推荐布局（§5） |
|---|---|---|
| 研究问题 / 旧方法失败 | 失败样例运行→错误区域被高亮放大 | central-hero（全屏案例） |
| input—模型—output 总览 | 数据沿路径移动，节点依次点亮 | central-hero（横向流程） |
| 模型架构 | **先整体再逐层放大**核心模块 | whole→local-zoom |
| 注意力/对齐机制 | query 与相关 token 连线，权重强弱渐变 | left-fig-right-explain |
| 训练目标/损失 | 预测结果向标签靠近，损失值随之变化 | two-col-compare |
| 数学公式/目标函数 | **每次只突出一个符号**，对应回图中对象 | left-fig-right-explain（+ KaTeX §7） |
| 基线比较 | **同一坐标轴**柱形，先基线后当前 | chart-dominant ★ |
| 消融实验 | 逐个移除模块，指标同步下降 | two-col-compare |
| 推理过程 | 状态/token 一步一步更新 | central-hero（时间轴/状态机） |
| 失败案例 | 成功与失败样例切开对照，错误聚焦 | two-col-compare（50/50） |
| 适用边界 | 能力范围扩大/收缩，边界条件逐个出现 | central-hero（能力圈/象限） |

**节奏规则**（强化 [`CHAPTER-CRAFT.md`](CHAPTER-CRAFT.md) Part 0 原则 7/8 + 时长）：

- 一节拍口播 = 一个画面动作。讲三个原因 → 三个 step，**不**三项一起飞进来。
- 讲到第二项时，第一项**灰化保留**作上下文（不是消失）。
- **动画演完就安静停住**——不要持续漂浮/闪烁/呼吸（呼应"持续微动慎用"）。
- 连线 / 移动 / 替换 / 拆解 / 聚合，通常比淡入 / 旋转 / 缩放更有解释力。
- **动画时长 ≤ 该步口播时长**（Auto 模式按音频结束推进，没有"等动画跑完"兜底）。

### ★ 批判注（这几行最容易翻车）

- **基线比较**：必须**同坐标轴** + **显示方差** + **先画基线**（不是"当前方法最后
  出现"那种靠排序视觉放大差异的取巧）。诚实做图见 §6 + dataviz skill。
- **适用边界象限**：两个轴**必须**用论文真实的评测维度命名，**不得杜撰**轴含义来
  把论文放进好看的象限。
- **架构图**：别让复杂架构图从头到尾缩在角落；要么整体→局部放大（§5），要么拆成
  几步逐步搭建。

---

## 5. 五种布局 archetype（§4 的布局词汇）

固定 16:9 舞台 1920×1080，四边 ≥80px 安全区。整片控制在**这五种**布局内，保证
视觉一致（每章内部自由发挥，但跳不出这五种骨架）。

| archetype | 何时用 | 骨架 |
|---|---|---|
| **central-hero** | 核心结论 / 关键数字 / 一句话主张 / 失败案例聚焦 | 一个明确视觉中心，hero 80–140px，四周 ≥80px 留白 |
| **left-fig-right-explain** | 模型结构 / 算法步骤 / 实验结果 | 左 ~65% 图/流程/实验，右 ~35% 当前结论（≤3 短句） |
| **two-col-compare** | 旧/新、成功/失败、有/无模块 | 两栏**同尺度同坐标基准**，差异靠移动/遮罩/标记表达，别两边塞满文字 |
| **whole→local-zoom** | 复杂架构 | 先看完整流程→当前模块高亮其余灰化→放大到全屏讲→回总图重新定位 |
| **chart-dominant** | 实验部分 | 图表占画面 ≥70%，每步只回答一个问题（"是否优于基线？"），不一次塞整张复杂表 |

> 底部可留字幕安全区，但**别做永久页脚**。主文字 44–64px，重要结论 80px+；出处/
> 注释也要录屏后可读（≥ `--t-micro` 起步，别再小）。

---

## 6. 图表复用纪律（redraw / animate / cite）

论文自带图表。每个要上屏幕的图/表，在 `paper-digest.md` §8 就定好**怎么复用**：

| 复用方式 | 何时用 | 忠实度要求 |
|---|---|---|
| **cite**（截图原 fig，挂 locator） | 复杂图、难忠实重画的表 | 不改原样；标清来源 `Fig N` |
| **redraw**（简化重画） | 简单图、想突出某部分 | **保留**数据/坐标/刻度/标签/方差/基线；重画要像重画，不冒充原图 |
| **animate**（重建过程） | 流程/机制/推理过程 | 只为"演机制"，不为"好看"；演的数据点必须真实 |

**铁律**：

- **绝不**扭曲数据 / 坐标轴 / 刻度来放大差异（§9 第 1 条）。
- **绝不**用假数据 / 假基线凑画面（通用 skill 已禁，论文里更严重）。
- 画图前先读 **`dataviz` skill**（如果环境里加载了它）的诚实做图规则——配色、
  同坐标轴、误差棒、不误导。**本文件不复制那些规则**，按名引用 dataviz skill。
- 复杂表（论文里那种 8 列大表）**别整张搬上屏**：先隐藏非关键行列，按 step 逐步
  恢复必要上下文，每步只回答一个问题。

---

## 7. 公式处理 + KaTeX（4 步揭示）

> **不是每篇都要推公式。** 公式**只在帮助理解机制 / 实验指标 / 复现**时才留；
> survey / system 常一个公式都不用。别为"显得专业"强塞公式。

要讲公式时，按**四步**（每步一个 step）：

1. **先演它解决的问题**（大白话，别先上数学）。
2. **整条公式出现**，所有符号先**弱化**（`.muted`）—— 给结构预览。
3. **逐个点亮符号**：每个符号配**固定颜色**，且这个颜色**同时点亮**图中对应对象
   （用 `--accent` / `--ev-*` 等主题色，走 `<Formula>` 的 `color` 字段；
   **同一符号全片同色**）。
   ⚠️ **不要**写 `\textcolor{var(--accent)}{Q}`：KaTeX 的颜色参数只认
   `#rgb` / `#rrggbb` / 具名色，喂 CSS 变量会抛 `Invalid color`，而组件
   传的是 `throwOnError: false`，于是**整段 TeX 源码会以 KaTeX 硬编码的
   `#cc0000` 红色原样打在屏幕上** —— 既不报错也不好查。着色一律在外层
   元素上做。
4. **代入一个微数字**，让结果**真的变一次**（不是抽象推导）。

**别**逐字符书写整条公式；**别**花大量时间做纯数学推导。

### 7.1 KaTeX 是 opt-in（`--math`）

脚手架加 `--math` 才注入 KaTeX：

```bash
bash <skill>/scripts/scaffold.sh ./paper-talk --theme=tufte-ink --math
```

项目里即可用 `<Math>` / `<Formula>`（见 `src/components/Math.tsx`）：

```tsx
import { Formula } from "../../components/Math";
// step 是 0-indexed：第 3 个 step 点亮 Q，第 4 个点亮 K，第 5 个代入数字。
// 颜色走 color 字段（组件把它加在包裹 span 上），不要写进 TeX。
<Formula step={step} parts={[
  { tex: "Q",                at: 2, color: "var(--accent)" },
  { tex: "\\cdot",           at: 2 },
  { tex: "K^T",              at: 3, color: "var(--accent-2, var(--text))" },
  { tex: "\\Rightarrow 0.83", at: 4 },
]} />
```

> 没 `--math` 的项目用 SVG / styled span 手搓也行，但复杂公式 fidelity 会漂；
> 论文视频建议直接 `--math`。接线细节见 [`CHAPTER-CRAFT.md`](CHAPTER-CRAFT.md)
> 代码层约束 + `scripts/scaffold.sh` 的 `--math` 段。

---

## 8. `--math` 开关接线（给改脚手架的人）

- `scripts/scaffold.sh` 解析 `--math` → `MATH=1`。
- 仅 `MATH=1` 时：`npm install katex` + 拷 `templates/src/styles/math.css` 到
  `src/styles/math.css` + 拷 `templates/src/components/Math.tsx` 到 `src/components/Math.tsx`。
- `App.tsx` 在 `import "./styles/animations.css";` 后追加 `import "./styles/math.css";`
  （pin 该锚点字符串；找不到锚点**报错退出**，防未来重构静默跳过）。
- **不传 `--math` 时**：以上全跳过，脚手架输出与不传时**字节一致**。

---

## 9. 论文专属反模式（只列新增，不重复通用反 AI 味）

> 通用反 AI 味（紫粉渐变 / emoji / 假数据 / 整章一种入场动画 / ken-burns 滥用……）
> 见 [`CHAPTER-CRAFT.md`](CHAPTER-CRAFT.md) Part 5 + [`SCRIPT-STYLE.md`](SCRIPT-STYLE.md)
> 去 AI 味五类。下面**只列论文专属**：

1. **图表无统一坐标轴** → 差异被视觉放大。基线比较必须同轴（§4 ★）。
2. **只晒最好结果** → 不讲基线 / 方差 / 失败案例。实验章必须给基线 + 方差 + 失败。
3. **讲者猜测伪装成论文结论** → 证据层大罪。`infer` 必须虚线 + 弱化（§3）。
4. **重绘图悄悄改坐标 / 刻度** → 不忠实（§6）。
5. **强塞公式** → 不服务理解的公式直接砍（§7）。
6. **屏幕念摘要** → 把 abstract 逐句打上屏再读一遍 = PPT。
7. **复杂架构图一直缩在角落** → 用 whole→local-zoom 或逐步搭建（§4/§5）。
8. **一屏六七张圆角卡片** → 像仪表盘不像视频（通用反 AI 味的论文版）。
9. **无关插画 / 装饰性 AI 图标** → 论文视频禁；缺素材就承认缺（placeholder）。
10. **字太小信息太满** → 观众只能暂停截图。主文字 ≥44px，结论 ≥80px。

---

## 10. 论文专属验收标准（叠加在 CHAPTER-CRAFT Part 7 完工自检之上）

> 通用完工自检（每章 ≥1–2 处视觉演示 / 逐个揭示 / 走 token / `npx tsc --noEmit` /
> narrations.ts 一致……）见 [`CHAPTER-CRAFT.md`](CHAPTER-CRAFT.md) Part 7。**论文章节额外过：**

**四测**（做完一章逐项问自己）：

- **静音测试**：关掉声音，光看画面，能懂这一屏在说明什么吗？
- **纯听觉测试**：闭上眼只听口播，论证还连贯吗？（音画应**互补**而非互相抄写。）
- **阶段感知**：观众在任何时刻，都知道自己在"问题 / 方法 / 实验 / 结论"的哪一段吗？
- **初学者带走物**：看完，初级研究员能说出 —— **主张** + **证据** + **局限** + **复现入口**？

**证据层自检**：

- [ ] 每个 `fact` / `supported` 步骤都挂了 locator chip（§X / Fig Y / Table Z）
- [ ] 每个 `infer` 步骤视觉读作"讲者之声"（虚线 badge + 弱化色），不冒充论文结论
- [ ] `paper-digest.md` 里每个上屏的 artifact 都有 redraw/animate/cite 决策 + 忠实度注
- [ ] 角落常驻 citation chip 从 step 1 就在，出处诚实
- [ ] 基线/比较图同坐标轴 + 有方差 + 先画基线（§4 ★）
- [ ] 公式（若有）走四步揭示，符号固定配色，且 ≤ 口播时长

> 这些检查挂 [`SKILL.md`](../SKILL.md) 的**硬性自检协议**（Agent Teams → subAgent
> → 自检，按能力降级）。拿到结论后**先按 fail 项改完再汇报**，不许"先放着"。

---

## 11. 论文选主题

按论文类型 + 气质选，别按习惯：

| 论文情境 | 推荐 | 理由 |
|---|---|---|
| 默认 / 严谨学术 / 数据驱动 | **`tufte-ink`**（图夫墨） | Tufte 数据墨水：瓷白 + 墨黑 serif + 近无 accent + 侧注栏网格，最像学术 slide |
| 系统论文 / 架构拆解 | `blueprint` | 蓝图工程气质，适合架构图 |
| AI 产品分析 / 热点解读 / 深度评测 | `newsroom` | 报社纪录片，信息密度高 |
| 信息图 / 严肃国际化 | `swiss-ikb` | 瑞士克莱因蓝，信息驱动 |
| 技术 deep dive / 极客向 | `midnight-press` | 暗色电影感终端 |
| 思想型 / 综述 / 沉静 | `monochrome-print` / `indigo-porcelain` | 黑白印刷 / 学术 |

> 主题系统见 [`THEMES.md`](THEMES.md)。证据层的 `--ev-*` 默认对全部主题生效；
> `tufte-ink` 进一步把 `infer` badge 做成虚线，强化"讲者之声"。

---

## 12. 静默模式（Silent · 全程默认 · **仅论文输入**）

> 想让 agent **一口气把论文视频做完、全程不停下来问**？用静默模式。
> **仅论文输入适用**；普通文章 / 口播稿仍走 [`SKILL.md`](../SKILL.md) 默认流程
> （有用户确认节点）。

### 12.1 触发（说出任一即进入）

`静默模式` / `silent` / `全程默认` / `不要停下来确认` / `一条龙做完别问我` /
`autonomous` / `hands-off` / `全自动`。

### 12.2 含义

跳过所有**面向用户的确认节点**，每个决策取**默认值**，从 paper-digest 一路跑到
网页成品。**但硬性自检协议照常跑**（[SKILL.md 硬性自检协议](../SKILL.md)）——
**静默 = 不问用户，不等于跳过完工自检 / 论文级验收（§10）**。

### 12.3 各节点默认（覆盖 [`SKILL.md`](../SKILL.md) 的硬节点行为 · 仅论文 + 静默时）

| 节点 | 默认会停 | 静默默认 |
|---|---|---|
| Phase 0 digest | —— | agent 自做 `paper-digest.md`（**自判 paper type + 写理由**，§1.2 第 2 节） |
| Checkpoint Plan（5+1 件事） | 停 | 全默认：script/outline 取自检后版；**主题取 `tufte-ink`**（论文默认，§11）；素材缺的用 placeholder；开发模式取 **B 顺序**；论文第 6 项：type 已自判、locator 尽量挂、claim vs proven 边界自标、图表默认 cite/redraw |
| Phase 2.2 第 1 章验收 | 停 | 不停：主线程做完 + 跑完工自检 + 修 fail → 直接进第 2 章 |
| Phase 2.3 逐章（模式 A） | 每章停 | 走 **B**：第 2~N 章顺序做完，不逐章停 |
| Checkpoint Audio | 停 | **默认不合成**（音频要外部 TTS provider，未必就绪）；成品后报告 + 给"要音频跑这条命令"。用户若说"静默 + 音频 / 全流程"，用默认 provider（voxcpm）尝试，失败则跳过并报告 |

### 12.4 静默结束后（一次汇报，**不问问题**）

- 选了什么 paper type / 主题 / 开发模式（**告诉用户选了啥、为什么**，给反悔机会）
- 做了几章几步、自检结论、改了什么
- 还缺哪些素材（placeholder 清单）
- 要音频 / 要录屏 各一条命令
- 证据层覆盖率：多少 fact/supported 步骤挂了 locator、几个 infer 步骤

### 12.5 仍照常（静默**不**豁免）

- 硬性自检（Agent Teams → subAgent → 自检）每个产出都跑、按 fail 修完
- narrations.ts 单一真相源、token、反 AI 味、§10 论文级验收、§3 证据层
- 双源原则、逐步揭示等所有硬规则

> ⚠️ 静默是**效率模式不是降质模式**：省的是"等用户拍板"的时间，不是"检查质量"
> 的步骤。跑完想调，随时可改 —— 换主题 = 覆盖 `tokens.css`；改章节 = 编辑后
> bump `STORAGE_KEY`（[SKILL.md 2.5](../SKILL.md)）。
