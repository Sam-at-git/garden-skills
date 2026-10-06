# 章节规格（spec.json）写法 —— 规格驱动开发的唯一规则书

你在为一部「看起来像视频」的网页演示写**一章的画面规格**。每次点击推进口播稿的一拍，一拍 = 一步，每一步独占整个 1920×1080 画面。你不写代码，只写数据：每一步用什么构图、标题是什么、放哪几块积木、谁是主角、这一步的证据类型。渲染器把它变成画面，字号 / 颜色 / 动画 / 对齐都由渲染器保证。

输出**只有一个 JSON 对象**，不要解释、不要 markdown 围栏。

## 1. 顶层结构

```json
{ "version": 1, "steps": [ { …step… }, … ] }
```

`steps.length` 必须等于本章的拍数（下面材料里会给出），一拍一步，不合并不拆分。

## 2. 一步（step）

| 字段 | 必填 | 说明 |
|---|---|---|
| `say` | ✓ | **这一拍口播的开头 6~10 个字，原样抄**。机器逐步核对画面和口播有没有错位，错一拍整段打回 |
| `composition` | ✓ | 八选一，见 §4 |
| `kicker` | | **已退役，不要写**（不上屏）。左上角只留标题；出处交给 `evidence.locator`（左下角） |
| `title` | | 这一步的一句话标题，≤40 字。是**结论 / 观点**，不是章节名 |
| `lead` | | 标题下一行补充，≤120 字，通常不需要 |
| `titleSize` | | `"h1"` 只给章首 / 英雄步；默认 `"h2"` |
| `blocks` | ✓ | 1~5 块积木，**恰好一块 `role: "primary"`** |
| `evidence` | | `{ "type": "fact"\|"supported"\|"infer"\|"background", "locator": "§3.1"\|null, "note": "…" }` 见 §6 |
| `stable` | | `true` = 有意和上一步同构图（对照 / 消融系列），否则同构图连续最多 2 步 |
| `focus` | | 步内焦点：口播推进时高亮依次移到哪里，按本步时长均分。`["左块id", "右块id"]` 整块点亮；`[{ "id": "chips", "items": [0,1,2] }]` 逐项点亮（Chips / Pipeline / RevealList / Compare 栏 / Stats 数字 / DataTable 行）。**不写就自动**：≥2 块主内容按顺序扫，单块多项按项扫；`false` 关掉。顺序要和口播里提到的顺序一致 |
| `arrange` | | `"row"` / `"stack"` 强制排布；默认按构图自动 |
| `note` | | 给自己的备注（不渲染）：这步的动效意图 / 为什么这么排 |

## 3. 积木（block）

公共字段：`type`（必填）· `role`（`primary` / `secondary` / `background` / `annotation`）· `id`（相邻步同 id = 同一块，不重播入场，只更新内容；逐项揭示 / 逐段点亮全靠它）· `delay`（入场延迟 ms，primary ≤150，secondary 常用 120~300）· `span`（并排时的份额，如 primary 想占 2/3 就写 2；`Diagram` / `BarChart` 的 `width` `height` 是像素，别混用）· `intent`（≤60 字，作者用这块图 / 表想证明什么，渲染成块下方「作者想说明」一行；论文的表、柱图、原图都该写）。

所有字符串支持 `**强调**`（accent 色）和 `` `等宽` ``；`\n` 换行。

| type | 用途 | 字段 |
|---|---|---|
| `Prose` | 一到三句话。`size`: `body`(24px) / `large`(40px，论文步主文字) / `display`(60px，结论句) | `text`(string 或 string[]) `size` `align` `stagger` |
| `Quote` | 论文原话 / 金句 + 出处 | `text` `by` |
| `Callout` | 要点卡：小标签 + 标题 + 正文 | `kicker` `title` `body`(string 或 string[]) `tone`: `base`/`accent`/`muted`/`plain` |
| `BigNumber` | 一个大数字。≥10 的数默认从 0 跳到目标（`countUp: false` 关），验算拍靠它让数字真的变 | `value` `unit` `label` `sub` `size`: `h1`(88px)/`d2`(128px)/`d1`(200px 全屏英雄) `countUp` `accent` |
| `Stats` | 一排 2~4 个数字并列 | `items`: [{value, unit, label, sub, countUp, accent}] |
| `RevealList` | 列表逐项揭示：`shown` = 已显示几项，已显示的项都保持正常亮度（同级信息），当前项有强调色竖条。**一项一步**：相邻步同 `id`，`shown` 递增 | `items`(string 或 {title, body}) `shown` `numbered` |
| `Chips` | 一排药丸：token 序列 / 模块 / 时间线。`active` 点亮、`done` 变淡、`arrows` 画箭头。同 `id` 逐步改 `active` = 逐个点亮 | `items`(string 或 {label, sub, state}) `active`(number 或 number[]) `done` `size`: `md`/`lg` `arrows` |
| `Pipeline` | 横向流程条：`active` 当前段点亮，之前 done，之后弱化 | `stages`: [{label, sub}] `active` 或 `states` |
| `Diagram` | 节点连线图。节点 `x` `y` 是百分比（0~100，中心点）；不给就排一行。`state`: idle/active/done/dim；边 `kind`: arrow/line/loop，`state`: idle/active/dim，`dashed`。`draw: true` 本步连线自绘入场 | `nodes` `edges` `width`(默认 1400) `height`(默认 600) `draw` |
| `BarChart` | 柱图，零基线、柱从 0 长起。`accent` 高亮一根，`delta` 柱顶差值（"+22.5"），`reference` 参考线，`err` 误差 | `items`: [{label, value, sub, accent, dim, delta, err:[lo,hi]}] `unit` `max` `title` `decimals` `reference`: {value, label} `orientation` |
| `DataTable` | 结果表，`shownRows` 逐行揭示。`marks` 圈出作者要你看的地方：`{row}` 整行 / `{col}` 整列 / `{row, col}` 单格（0 起，行不含表头，`note` 格旁小注如 `"+21.4"`），`dimOthers` 让其余格退后。≤8 行，大表拆步 | `columns` `rows` `shownRows` `marks` `dimOthers` `intent` `caption` |
| `Compare` | 2~3 栏同尺度对照 + 底部结论 | `columns`: [{title, body, tone}] `verdict` |
| `CodeBlock` | 代码 / 伪代码 / prompt，≤24 行。逐段解读：`notes` 每条 = `lines`: [起, 止]（1 起）+ `title` + `text`（这几行在干什么），`active` = 当前讲第几条（0 起），那几行点亮、注释框贴在旁边；`vars` 走例子时的变量快照（代码下方一条） | `code` `lang` `title` `highlight` `notes` `active` `vars`: [{name, value}] |
| `Figure` | 论文原图（只能用材料里列出的路径）。讲局部：`regions` 定义区域（原图百分比），`active` 当前区域 id（可多个，null = 整图），`mode`: `spotlight` 其余淡出（默认）/ `zoom` 推镜放大 / `crop` 只剩这一块；`minimap`: `"br"` 等 | `src` `label`("Fig 1") `alt`(图里画了什么) `credit` `regions`: {id: {x, y, w, h, label}} `active` `mode` `intent` `height` |
| `Formula` | 公式。**逐符号讲**：`tex` 整式里用 `[[ ]]` 圈出符号，`symbols` 每个符号 `{tex, name, meaning}`（tex 和 `[[ ]]` 里一字不差），`active` 当前讲第几个（0 起）—— 式子里它点亮、其余退后，下方词表逐行出现；`idea` 一句话「它在说什么」、`significance`「为什么重要」。简单拆分也可用 `parts` + `shown`：**parts 是同一条式子的几段，首尾相接拼成一行**，不是多行推导 —— 算式写成连续一条（`\\frac{3.93-3.35}{3.35}` · `= \\frac{0.58}{3.35}` · `\\approx 0.173`），别写成「= 0.58」「0.58/3.35」（拼出来是 0.580.58，自检会打回） | `tex` `symbols` `active` `idea` `significance` 或 `parts`: [{tex, color}] `shown` `caption` |
| `Grid` | **层级扩圈**：同一张网格从头用到底，`lit` 跨步变大（1 → 32 → 256 → 2048），新点亮的格依次填上；`done` 是上一级（更淡）。`label` 写「数量 = 名字」。总格数 ≤4096，不用真实规模 | `cols` `lit` `rows` `groups` `groupCols` `done` `label` `sub` |
| `Flow` | **往返计数 / 延迟 vs 带宽**：1~4 条等长轨道，数据包一趟一趟跑，所有轨道共用一个时钟（第 k 趟同时出发），跑完一趟留一道刻度，最后显示计数。`trips` 每项一趟：字符串 = 包上的标签（from → to），`{ "label": "t", "back": true }` = 回程；空字符串 = 不带标签的小方块。`width` 1~4 = 包有多宽（带宽）。一步内 ≤3.6 秒跑完，这一拍口播至少 5 秒；同 id 跨步加长 `trips` 只跑新加的 | `lanes`: [{from, to, label, trips, width, count, dim}] |
| `Gauge` | **扫参 + 有上限的容器**：左边正方形**边长 ∝ input.value / input.max**（面积 ∝ value²，平方增长看得见；线性量写 `shape: "bar"`），中间 `factors` 写换算因子，右边空心容器按 `value / capacity` 填充，超过上限标「超出上限」。同 id 连续几步只改 value，尺寸平滑过渡 | `value` `capacity` `unit` `label` `input`: {value, max, label, caption, shape} `factors` `decimals` |
| `Placeholder` | 缺素材占位（不编数据、不放无关图） | `label` `note` |

## 3.1 讲公式、代码、表和图（论文的硬骨头，给足步数）

材料里的讲法设计（teaching-plan）和 outline 会写明哪些步在讲哪条式子 / 哪段算法 / 哪张表（`explains: Eq 3 · 符号`）。照它排画面：

- **公式**（一条关键式子通常 5~8 步）：① 它要解决什么问题（不上式子，用 `BigNumber` / `Diagram` / `Prose`）→ ② 整式出现，`shown: 0` 只看结构 → ③ 逐符号：**同一个 `id` 的 Formula 连续几步**，每步 `active` 加一（两三个紧密相关的符号可以同一步 `active: [1, 2]`），`symbols[i].meaning` 写这个符号在这篇论文里具体是什么（形状 / 单位 / 取值范围），不写教科书定义 → ④ 思想：`idea` 一句大白话 → ⑤ 意义：`significance`（带来了什么、和旧做法比好在哪）→ ⑥ 代入一组小数字算一遍（第二条 Formula 写代入后的式子，或 `BigNumber` / `BarChart`）。
- **代码 / 伪代码**：① 输入是什么、输出是什么（`Compare` 或 `Chips`）→ ② 同一个 `id` 的 CodeBlock，`notes` 把代码切成 3~5 段，每步 `active` 加一，`text` 讲这段**为什么这么写**，不要逐字翻译代码 → ③ 用一个小例子走一遍：`vars` 每步更新变量值 → ④ 对回公式或原图。代码超过 24 行就只留核心段，其余写成 `…`。
- **表格**：先说「看哪里」再说「说明什么」：`marks` 圈出作者要你比的那几格（通常是自己的方法那一行 + 最强基线 + 差值那一格），`dimOthers: true`，`intent` 写作者用这几格证明的那句话。大表拆成几步，每步只回答一个问题。
- **图 / 柱图**：原图用 `regions` + `active` 一步指一处（同 id 连续几步，镜头会在区域间滑），`intent` 写结论；重画的柱图用 `accent` / `delta` 指出重点，`intent` 写结论。作者没说、是你的判断的，放到另一步并标 `infer`，不要写进 `intent`。
- 连着讲同一块的几步用**同一个 composition + 同一个 id**（渲染器会自动标 `stable`），换构图会整屏重挂，高亮就不是「滑过去」而是重新出现。

## 4. 构图（composition）与排布

| composition | 用在 | 自动排布 |
|---|---|---|
| `centered-hero` | 核心结论 / 概念名 / 关键数字 / 金句 | 单列居中 |
| `asymmetric-60-40` | 图 / 图表 / 公式 + 一栏解释 | primary 左 60% · secondary 右 40% |
| `split-screen` | 基线 vs 新方法 / 成功 vs 失败 | 左右各半 |
| `rule-of-thirds` | 主视觉 + 短注 / 大数字 + 出处 | primary 2/3 · secondary 1/3 |
| `full-width-strip` | 时间线 / token 序列 / 流程 / 数据带 | 上下堆叠、全宽 |
| `layered-depth` | 开场 / 抽象概念 / 机制总览 | 居中，`background` 积木铺底（只能是 `Diagram` / `Grid` / `Figure`，铺底时文字隐藏只留形状；别的积木写成 background 会被改成 secondary） |
| `triptych` | 严格三项对照 | 三等分 |
| `diagram-canvas` | 架构 / 节点网络 / 计算流程 | Diagram 全宽，解释在下 |

规则：同构图**连续 ≤2 步**（除非 `stable: true`）；一章 ≥3 种构图；一步只放本拍最值得放大的 1~3 样东西；`primary` 是视线第一站，`secondary` 协助理解，`annotation` 落在底部一行（出处 / 单位 / 小注）。

## 5. 怎么设计每一步

1. 读这一拍的口播和 outline 给的 `purpose / focal / content relationship`，先定**关系**（递进 / 反差 / 收束 / 铺垫 / 揭示 / 持留 / 列举 / 总览）。
2. 按关系选积木：数量 → `BigNumber` / `BarChart`；层级 → `Grid`；搬运 / 往返代价 → `Flow`；扫参到上限 → `Gauge`；对照 → `Compare` / `split-screen` 两块；流程 / 架构 → `Pipeline` / `Diagram`；序列 → `Chips`；列举 → `RevealList`（一项一步）；论文图 → `Figure`；公式 → `Formula`（逐符号）；算法 → `CodeBlock`（逐段）；结果表 → `DataTable`（圈格 + intent）；原话 → `Quote`。
3. 画面信息密度 > 口播：细节从材料里的 article 小节抽（数字 / 原话 / 出处），**不要把口播打字上屏**。每个字符串 ≤120 字，一步上屏总字数 ≤260。
4. 让画面**真的变**：相邻步用同 `id` 的积木推进（`shown` / `active` / `highlight` / `draw` / `countUp`），整章至少两处这种「动起来」的序列；整章纯 Prose / Callout = 不合格。
5. 概念四拍（outline 标了 `explains: … · 锚/桥/术语/验算`）：锚拍画观众已有经验，**不出现论文术语和符号**；桥拍说清同构在哪；术语拍才贴论文符号 + locator；验算拍屏幕上的数字必须真的算一次（`countUp` 或 `BarChart` / `DataTable` 逐步揭示）。
6. 缺图就 `Placeholder`，不编路径、不编数据。数据图要保留基线 / 单位 / 方差；定性材料（热图 / 样例）只能 `Figure` 原图。
7. 避免：一屏五六张卡片；每步同一种构图；所有步都是「标题 + 一段话」；emoji；编造的数字。
8. **画面不是字幕**：上屏文字和这一拍口播逐字重合超过四成判失败。口播负责解释，画面负责让人「看见」：一个数字、一张图、一个结构、一个短语。`kicker` / `title` 里不许出现「锚 / 桥 / 术语 / 验算 / 概念 #N」这类写稿方法的词，标题要写观众能懂的话（「同一道题，8 个答案互相比」而不是「GRPO · 锚」）。

9. **会动的序列要回答「和什么比」**（同 `id` 跨步推进的那几步尤其如此）：
   - **控制变量**：对照的两边用同样的积木、同样的单位和尺度，只让被讲的那个量不同。`split-screen` 两块 `BarChart` 要同 `unit`、同 `max`；`Compare` 各栏写同样的几项、同样的顺序。
   - **层级 = 同一张图扩范围**：讲「小单元组成大单元」（thread→warp→block、字→词→句），用同一个 `id` 的 `Grid` 连续几步，`lit` 一步比一步大、`done` 写上一步的 `lit`，`label` 写成「32 个线程 = 1 个 warp」这种「数量 = 名字」。层级只有三四个、每级是有名字的模块时用同 id 的 `Chips`（`active` 给数组）或 `Diagram` 节点 `state`。不要每一级换一块新积木。
   - **代价要能数**：访存 / 往返 / 网络调用 / 重算次数，用 `Flow`：旧方案、新方案各一条轨道，`trips` 逐趟写出（中间结果写回又读出就写成 `{"label":"t","back":true}`、`"t"` 两趟），计数默认「N 趟」，可写 `count: "3 趟 · 少 40%"`。标题写趟数，不要只写「更少」。延迟 vs 带宽：两条轨道趟数一样、只改 `width`。
   - **扫参数**：一个输入一档档变大，另一个量非线性跟涨、而且有上限（序列长度 → 显存、batch → 显存）用同一个 `id` 的 `Gauge` 连续几步，只改 `input.value` / `value`，`input.max` 和 `capacity` 每步保持一样（渲染器也会统一），最后一步停在极值或超出上限。没有容器上限、只是比几组数时用同 id 的 `BarChart`，渲染器会把序列的纵轴上限锁成一致。档位用真实值。
   - **派生数字带算式**：屏幕上算出来的数（「64 GB」）在 `Gauge.factors` 或 `sub` / `label` 里写出因子（「× 32 头 × 2 字节」），观众能自己验算。数字和单位放 `` `等宽` ``。

## 6. 证据层（论文模式）

每步给 `evidence`：论文明说的 → `fact` + locator（`§3.1`）；实验数字支撑的 → `supported` + locator（`Table 2` / `Fig 4`）；讲者的判断 → `infer`，locator 必须 `null`；通识 / 类比（锚拍、桥拍）→ `background`，locator 必须 `null`。

## 7. 格式示例（只示范写法；内容必须来自你拿到的材料，不要照抄这里的题材）

```json
{ "version": 1, "steps": [
  { "say": "一开始就全速训练", "composition": "centered-hero", "title": "一开始就全速，会把还没站稳的模型推翻", "titleSize": "h1",
    "blocks": [
      { "type": "Quote", "role": "primary", "text": "前 2000 步，学习率从 0 线性升到峰值", "by": "§5.3 · 训练设置" } ],
    "evidence": { "type": "fact", "locator": "§5.3", "note": "warmup 步数" } },
  { "composition": "full-width-strip", "title": "冷车起步：先低速，再上高速",
    "blocks": [
      { "type": "Pipeline", "id": "drive", "role": "primary", "stages": [ { "label": "点火", "sub": "0 km/h" }, { "label": "小区里慢开", "sub": "20" }, { "label": "上高速", "sub": "120" } ], "active": 1 },
      { "type": "Prose", "role": "secondary", "delay": 200, "size": "large", "text": "机器还凉着就地板油，最先坏的是变速箱" } ],
    "evidence": { "type": "background", "locator": null } },
  { "composition": "asymmetric-60-40", "title": "模型的「凉车期」叫 warmup：学习率从 0 爬到峰值",
    "blocks": [
      { "type": "BarChart", "id": "lr", "role": "primary", "title": "学习率 × 10⁻⁴", "items": [ { "label": "step 0", "value": 0 }, { "label": "500", "value": 1.25 }, { "label": "1000", "value": 2.5 }, { "label": "2000", "value": 5, "accent": true, "delta": "峰值" } ], "decimals": 2 },
      { "type": "Callout", "role": "secondary", "delay": 200, "tone": "accent", "kicker": "为什么", "title": "参数还在随机初始化附近，梯度方向不可信", "body": "大步子只会放大噪声；等统计量稳定了再提速" } ],
    "evidence": { "type": "fact", "locator": "§5.3" } },
  { "composition": "split-screen", "title": "同一模型：有无预热，前 1k 步的损失",
    "blocks": [
      { "type": "BigNumber", "role": "secondary", "value": 7.9, "label": "无预热", "sub": "第 1000 步 loss，发散过一次", "size": "h1" },
      { "type": "BigNumber", "role": "primary", "value": 3.2, "label": "2000 步预热", "sub": "Table 4 · 同批数据", "countUp": true, "accent": true, "size": "d2" } ],
    "evidence": { "type": "supported", "locator": "Table 4" } }
] }
```

注意示例里的题材、数字、出处都是编的，只用来展示字段怎么填；你的每一个数字和 locator 都必须能在材料里找到。
