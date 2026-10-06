# 动画蓝图（Motion Blueprints）

论文 / 教学视频里反复出现的 13 种动画节拍，外加一组所有蓝图都要守的通用约束（§0）。**每个蓝图只规定内容关
系、推荐构图、主导动作、最终英雄帧、需要避免的错误** —— 不固定
颜色、毫秒数、具体 CSS（这留给 chapter agent 按内容自由发挥）。

> **为什么是蓝图而不是模板**：动画的"形"可以复用，动画的"节奏 /
> 缓动 / 调性"必须按章节内容决定。给具体 keyframes = 把 chapter
> agent 变翻译机；给蓝图 = 给它一张可以临摹的骨架图。

每个蓝图包含：

- **适用内容关系** —— 这一拍要表达什么
- **推荐构图** —— 通常搭配哪一种（见 [`VISUAL-DIRECTION.md`](VISUAL-DIRECTION.md) §1）
- **主导动作** —— primary 元素怎么动
- **最终英雄帧** —— 动作结束、画面静止时应该长什么样
- **常见错误** —— 必须避开的翻车

**§0 通用约束每次都读**（很短）；蓝图按索引只读命中的那一条。

---

## 0. 通用约束：一个动作只回答一个「比什么」

提炼自一组口碑很好的 GPU 编程讲解动画（7 个小动画同屏，每个只讲一件事）。
它们没有一处用到曲线变形、镜头运动或花哨缓动，却讲得非常清楚。原因全在下面
这几条约束上，和主题、配色无关，所有蓝图都适用：

1. **先找对照物，再设计动作。** 动起来的那一步必须能回答「和什么比」：
   PCIe 对 HBM、两次 kernel 对一次融合、CPU 逐个对 GPU 一起。找不到对照物
   的动画通常只是装饰，宁可不动。
2. **控制变量：只让一个视觉量不同。** 两边用同样的结构、同样的尺度、同样的
   节拍，只有被讲的那个量不一样。例：「延迟 vs 带宽」两条管道里数据包的
   **移动速度完全相同**（延迟相同），只有每个包的**宽度**不同（带宽不同），
   于是两个常被混为一谈的概念一眼分开。两边速度也不同 = 观众不知道该看哪个差。
3. **同一个对象，只改范围。** 讲层级（thread → warp → block → grid、token →
   句 → 段、像素 → patch → 图）时，**一张图从头用到底**，每一步只扩大高亮的
   范围，标签换成当前层级的名字。不要每一层换一张新图，否则观众看不出「上一层
   是这一层的一部分」。→ 蓝图 `scope-expand`
4. **把抽象代价变成能数的事件。** 访存次数、网络往返、重算次数这类「代价」，
   画成沿固定轨道来回跑的小方块，一趟一个；标签直接写出计数（「5 trips」对
   「3 trips: 40% less」）。数得出来比形容词有说服力。→ 蓝图 `trip-count`
5. **几何如实编码。** 长度、面积和数值成正比：显存按 N² 涨，就让正方形**边长**
   正比于 N（面积自然是 N²）；两个带宽差 50 倍，柱长就差 50 倍，不为好看压缩。
   扫参数的序列**锁死坐标上限**，否则比例尺每一步悄悄变，柱高不能互相比。
   → 蓝图 `scale-sweep`
6. **只动承载语义的那一边。** 数量级差距用静止的长短条摆出来就够了；动画留给
   「过程」本身（流动、累积、往返）。一个元素只做一种动作。整组动画只用四种
   动作：**沿路径平移、离散跳档、逐格填充、高亮扫描**。弹跳、旋转、变形、
   推拉镜头一概不需要。
7. **标签即状态。** 标签文字随状态一起换，并写出当前值：「32 threads = 1 warp」
   「N = 9,216 tokens → 5.1 GB」。数字、单位、代码用主题的 mono 字体 token，
   概念用正文字体 —— 一眼分清哪些是数据。
8. **强调只用同一色相的深浅。** idle 浅、active 深、done 介于两者；不为每个
   状态加一种新颜色（和 `compare-reveal` 里「别用红绿区分 A / B」是同一条）。
9. **屏幕上的派生数字要能用屏幕上的输入算出来。** 「64 GB」旁边要看得到
   「32 heads × N × N × 2 B」这几个因子，观众能自己验算。验算拍尤其如此。
10. **到达极值就定格。** 序列最后一步停在最大 / 最极端的状态，让观众看清
    「已经快撑满 80 GB」，不要立刻复位。

> **循环 → 跨步**：原作是 2 秒循环的 GIF，每个状态一闪而过。我们是点击驱动、
> 每步要定格可读的视频（[`CHAPTER-CRAFT.md`](CHAPTER-CRAFT.md) 禁止用 `infinite`
> 循环表达关键信息）。所以要把**循环里的每一个状态翻译成一步**：同一个元素
> （规格驱动里是同一个 `id`）跨步推进，每步停在一个可读的状态上。

---

## 1. `process-build`（流程构建）

**适用**：架构图 / 流程图 / 算法步骤逐步出现 —— "我们来看这个流
程是怎么走的"

**推荐构图**：`diagram-canvas`（架构图主体居中）+ `full-width-strip`
（流程顺序从左到右）

**主导动作**：
- 节点从中心点 fade-in + scale（0.85 → 1.0）
- 连线在两个节点之间用 stroke-dashoffset draw-on
- 节点出现顺序 = 数据流 / 算法执行顺序
- 最后一个节点出现后，加一次轻微的高亮脉冲（accent glow）

**最终英雄帧**：所有节点 + 连线全部就位，可读、可指、不混乱。观众
能用眼睛跟着节拍重走一遍流程。

**避免**：
- 所有节点同时入场（= 退化为 PPT）
- 连线在节点到位前画完（视觉因果关系颠倒）
- 节点入场用旋转 / 弹跳等花哨动效（盖住流程本身的语义）

---

## 2. `compare-reveal`（对照揭示）

**适用**：基线 vs 新方法 / 旧 vs 新 / 错误 vs 正确 / A vs B

**推荐构图**：`split-screen`（左 A 右 B 对照）或 `asymmetric-60-40`
（一主一辅，主方法占 60%）

**主导动作**：
- 左半（A）先入场（观众先建立基线认知）
- 右半（B）在下一个 step 入场，用 wipe 或 mask reveal 划过中线
- 关键差异点（数字 / 高亮 / 标注）在最后一个 step 用 accent 颜色砸下

**最终英雄帧**：A 与 B 并列，关键差异被 accent 强调，视线能在一秒
内找到"为什么 B 更好"。

**避免**：
- A 与 B 同时入场（观众没有基线）
- 用颜色区分 A vs B（容易变成 AI 味的"红绿对比"）
- 差异强调用箭头（应该用位置 / 字号 / accent 颜色）

---

## 3. `ablation-remove`（消融移除）

**适用**：论文消融实验 —— 移除某个模块，看指标如何变化

**推荐构图**：`asymmetric-60-40`（指标变化图 60% + 被移除模块结构 40%）
或 `diagram-canvas`（模块图主体）

**主导动作**：
- 基线柱先填满（step 1）
- 移除模块 → 对应柱子用 height 收缩动画落到新值
- Δ 数字 accent 颜色"砸下"（从 -30% 位置 translateY 进入）
- 已移除的模块（不在 focus 的）灰化作上下文（opacity 0.35 +
  grayscale 0.5）

**最终英雄帧**：所有柱子就位、Δ 数字清晰、灰化的模块仍在但不再
抢戏。观众一眼能看出"哪个模块去掉后掉得最多"。

**避免**：
- 把所有柱子一起画出来再标 Δ（弱化"消融"这个动作的因果）
- 灰化用 `display: none`（消失的模块应该作为上下文保留可见）
- Δ 数字用 fade-in 而不是 translateY 砸下（缺乏冲击力）

参考实现：[`EXAMPLES/paper-ablation/`](../EXAMPLES/paper-ablation/)

---

## 4. `formula-assemble`（公式组装）

**适用**：论文公式逐项揭示 —— "这个公式是怎么搭起来的"

**推荐构图**：`centered-hero`（公式居中主导）或 `asymmetric-60-40`
（公式 60% + 图示 40%）

**主导动作**：
- KaTeX 公式按项依次高亮（每个项 400~800ms）
- 每项高亮时，旁边图示的对应部分同步 accent 描边 / 放大
- 最后一步：所有项合成完整公式，加一次轻微的 accent glow 脉冲

**最终英雄帧**：完整公式居中清晰可读，旁边图示的对应部分仍处于
accent 状态。**关键原则：最后一步必须把高亮收回去**，让公式回到
"普通可读"状态 —— 否则观众永远在看高亮，没法读懂整体。

**避免**：
- 一开始就把完整公式显示出来（失去"组装"的因果）
- 高亮颜色用 primary accent（应该用更弱的 secondary highlight，
  否则公式本身被盖住）
- 公式旁边没有图示对应（观众不知道符号指什么）

详见 [`PAPER-INTERPRETATION.md`](PAPER-INTERPRETATION.md) §7 的
`<Math>` / `<Formula>` 4 步揭示机制。

---

## 5. `data-countup`（数据累加 / 数字落定）

**适用**：柱图 / 排名 / 计数器 / 数值变化 —— "看这个数字一路涨到 X"

**推荐构图**：`full-width-strip`（横向条带）或 `rule-of-thirds`（大
数字 + 出处）

**主导动作**：
- 数字用 600~1200ms 的 count-up 动画（`textContent` 从 0 滚到目标
  值，ease-out）
- 横条用 width 0 → 目标% 的填充动画（与数字同步）
- 数字落定后，加一次"砰"的 micro-bounce（scale 1.0 → 1.05 → 1.0）

**最终英雄帧**：数字 + 横条全部落定，视觉重心稳定。**关键原则**：
不要让 count-up 持续超过 step 的口播时长 —— 否则 Auto 模式录屏会
当场切到下一步。

**避免**：
- 数字 count-up 时没有视觉锚（横条 + 数字必须同步）
- 数字用 `tabular-nums` 但其他元素没用（视觉不齐）
- 横条用 px 而非 %（容器宽度一变就错位）

---

## 6. `focus-drilldown`（聚焦钻取）

**适用**：总架构 → 核心模块 —— "我们来看 X 的内部"

**推荐构图**：`diagram-canvas`（总架构全图）→ `layered-depth`（钻取
后只剩核心模块，前后景深度拉开）

**主导动作**：
- step 1：全架构图就位（hero frame）
- step 2：非核心模块 opacity → 0.15 + 轻微 blur（2~4px）
- step 3：核心模块 scale 1.0 → 1.3 + 居中位移
- step 4：核心模块内部结构展开（之前隐藏的细节 fade-in）

**最终英雄帧**：核心模块占据画面中心 ≥ 40%，其他元素弱化为前后景
上下文。观众视线只能落到这一处。

**避免**：
- 用 `transform: scale()` 但不预留空间（核心模块放大后会越界）
- 非核心模块直接 `display: none`（失去"这是从全图中选出的"的语义）
- 模糊用 `filter: blur(8px)` 过大（变成"看不清"而不是"不重要的背景"）

---

## 7. `failure-inspect`（失败案例检视）

**适用**：模型失败样例 / 错误预测 / 边界情况 —— "看这个例子它错了"

**推荐构图**：`asymmetric-60-40`（错误样本 60% + 解释 40%）或
`layered-depth`（样本前景 + 解释后景）

**主导动作**：
- 样本（图像 / 文本 / 数据）从中心 fade-in
- 错误区域用 accent border + 轻微 pulse 标出
- 解释文字在下一 step 从右侧或底部入场
- 最后一步：正确答案与错误答案并列对照（compare-reveal 子模式）

**最终英雄帧**：错误样本占据画面主导，错误区域被清晰标出，解释
文字在边上。观众一眼能看出"哪里错了、为什么错"。

**避免**：
- 错误区域用红色（容易 AI 味；用 accent + dashed border 更专业）
- 样本尺寸过小（看不清楚错在哪）
- 没有正确答案对照（观众不知道什么是"对"）

---

## 8. `token-transform`（token / embedding 变换）

**适用**：NLP / CV 论文里的 token / embedding / 特征逐步变换

**推荐构图**：`full-width-strip`（token 序列从左到右）或
`diagram-canvas`（变换网络居中）

**主导动作**：
- 原始 token 序列（step 1）：每个 token 用方块 / 色块表示
- 变换过程（step 2-N）：每个 token 按规则变形（颜色 / 大小 / 位置
  变化），用 staggered animation
- 最终状态（最后 step）：所有 token 就位 + 一条连线画出 token 间
  的新关系

**最终英雄帧**：原始 + 变换后 + 关系网三件并列（或变换后为主、原
始为辅）。观众能看出"什么变成了什么"。

**避免**：
- Token 用真实文字（应该用色块 / 编号 —— 视觉密度太高反而看不清）
- 变换动画用随机抖动（必须按语义规则变形）
- 没有前后对照（观众不知道 token 之前长什么样）

---

## 9. `evidence-stack`（证据累积）

**适用**：实验依据 / 数据点 / 实验结果逐项展示 —— "证据 X、证据
Y、证据 Z 一起指向结论"

**推荐构图**：`triptych`（三项证据）或 `full-width-strip`（多项证
据累积）

**主导动作**：
- 证据 1 入场 → 短暂停 → 证据 2 入场 → ... → 结论砸下
- 每个证据入场时，前面的证据**灰化但不消失**（保留作为已建立的
  上下文）
- 最后一个 step：所有证据 + 结论同时清晰可读

**最终英雄帧**：所有证据累积起来指向一个共同结论。观众能看到"这
些证据一起构成了什么"。

**避免**：
- 所有证据一起入场（变成列表）
- 证据之间没有视觉关系（应该是累积而非并列）
- 结论用大字但证据用小字（应该用位置 + accent 强调结论，证据字
  号不变）

---

## 10. `boundary-contract`（边界收缩）

**适用**：模型适用范围 / 限制条件 / 失败前提 —— "这个方法只在 X
条件下有效"

**推荐构图**：`layered-depth`（适用范围中心 + 边界圈外围）或
`diagram-canvas`（边界条件画成包围圈）

**主导动作**：
- step 1：完整适用范围（一个大圈 / 一个宽条件）
- step 2-N：逐个施加限制条件（圈缩小 / 条件收窄）
- 每个限制条件入场用 stroke-dashoffset draw-on（边界"画出来"）
- 最后一步：稳定在"最小有效范围"，加一次 accent pulse 强调"这就是
  边界"

**最终英雄帧**：被多个边界圈包围的"有效范围"清晰可见。观众一眼
能看出"这个方法在哪些条件下能用、在哪些条件下不能用"。

**避免**：
- 边界圈用红色虚线（AI 味）
- 边界与适用范围颜色冲突（应该用同一色系不同明度）
- 没有标注边界条件文字（圈只是视觉，必须有文字说明这是什么边界）

---

## 11. `scope-expand`（层级扩圈）

**适用**：讲一个嵌套层级 —— 一个单元组成上一级、上一级再组成更上一级
（thread / warp / block / grid、字 / 词 / 句、样本 / batch / epoch、
pod / node / cluster）

**推荐构图**：`centered-hero`（整张网格居中）或 `diagram-canvas`

**主导动作**：
- step 1：整张结构一次就位，全部是 idle 浅色；只有**一个最小单元**变深
- step 2-N：每步把深色范围扩大到上一级（一个 → 一行 → 一块 → 全部），
  其余保持 idle；标签换成「32 threads = 1 warp」这样的「数量 = 名字」句式
- 已经讲过的层级可以退到 done 色，让当前层级最突出

**现成积木**：`Grid`（规格驱动写 `{"type":"Grid","id":…,"lit":…}`，手写章节 `<Grid>`）。

**最终英雄帧**：整张结构全部点亮到最上一级，标签写着最上一级的定义。
观众看得出每一级都是上一张图里的一部分。

**避免**：
- 每一级换一张新图（层级关系断掉）
- 一开始只画最小单元、后面再「长出」更多格子（观众不知道全貌有多大）
- 标签只写名字不写数量（「warp」不如「32 threads = 1 warp」）

---

## 12. `trip-count`（往返计数）

**适用**：用「搬运了几次」讲代价 —— 访存次数、显存读写、网络往返、
重算、跨服务调用；尤其是「优化前 vs 优化后」

**推荐构图**：`full-width-strip` / `diagram-canvas`（旧 / 新两条轨道上下排）

**主导动作**：
- 两栏用**同一套**几何：上面是计算单元，下面是存储 / 远端，中间是固定的竖轨道
- 小方块沿轨道一趟一趟地跑，每一趟都是一步里看得见的一次移动；
  旧方案多出来的那几趟（例：中间结果 t 写回显存又读出来）是本步的焦点
- 两边同时开始、同样速度（控制变量）；新方案先跑完，停在终点
- 标签写计数：「5 trips」/「3 trips: 40% less traffic」

**现成积木**：`Flow`。注意它是上下两条**等长**横向轨道（不是左右两栏），列宽由 subgrid 对齐，保证「轨道等长 + 时长相同 = 速度相同」。

**最终英雄帧**：两条轨道并列，右侧留下各自的趟数刻度，计数标签清晰。
观众不用听解释也能数出差了几趟。

**避免**：
- 两边速度不同（观众会以为差别在速度）
- 用箭头代替移动的小方块（箭头表达「有关系」，不表达「跑了一趟」）
- 只写「更快」不写趟数

---

## 13. `scale-sweep`（扫参放大）

**适用**：一个输入一档档变大，另一个量按非线性规律跟着涨 —— 序列长度对
显存（N²）、batch 对延迟、副本数对吞吐（先涨后平）、阈值对成本

**推荐构图**：`asymmetric-60-40`（左边几何量 60% + 右边容量条 40%）
或 `rule-of-thirds`

**主导动作**：
- 输入按**真实档位**离散跳变（1,024 → 2,048 → … → 32,768），每档一步或一步内
  几档；输入值写在 mono 标签里
- 几何量按真实比例跟着变（面积 ∝ N² 就让边长 ∝ N）
- 旁边放一个**有上限的容器**（「HBM: 80 GB」空心竖条），填充量和读数同步涨，
  让「快撑满」被看见
- 最后一档定格在极值

**现成积木**：`Gauge`（正方形边长 ∝ value / max、容器、换算因子三件套；超出上限自动标出）。

**最终英雄帧**：极值状态 —— 几何量最大、容器接近满、读数和上限同框。

**避免**：
- 比例尺每步自动重算（柱子永远「看起来差不多高」）—— 规格驱动里同 id
  的 `BarChart` 跨步扫参由 `normalizeSpec` 自动锁 `max`，手写章节要自己固定
- 为了好看把平方压成线性，或把档位改成等差（失去「越来越快」的感觉）
- 只给最终值、不给中间档（看不出增长规律）

---

## 蓝图组合策略

### 同章多蓝图

一章节 5~8 step 里通常用 2~4 个蓝图。例如论文方法章：

```
step 1  process-build         （架构图全貌）
step 2  focus-drilldown       （钻取核心模块）
step 3  formula-assemble      （核心公式揭示）
step 4  compare-reveal        （vs baseline）
step 5  ablation-remove       （消融实验）
step 6  data-countup          （最终结果）
```

### 蓝图 vs 构图

| 蓝图 | 偏好构图 | 但也兼容 |
|---|---|---|
| process-build | diagram-canvas | full-width-strip |
| compare-reveal | split-screen | asymmetric-60-40 |
| ablation-remove | asymmetric-60-40 | diagram-canvas |
| formula-assemble | centered-hero | asymmetric-60-40 |
| data-countup | full-width-strip | rule-of-thirds |
| focus-drilldown | diagram-canvas | layered-depth |
| failure-inspect | asymmetric-60-40 | layered-depth |
| token-transform | full-width-strip | diagram-canvas |
| evidence-stack | triptych | full-width-strip |
| boundary-contract | layered-depth | diagram-canvas |
| scope-expand | centered-hero | diagram-canvas |
| trip-count | full-width-strip | diagram-canvas |
| scale-sweep | asymmetric-60-40 | rule-of-thirds |

构图是"画面怎么摆"，蓝图是"动画怎么走"。**两者正交**：同一构图
可以走不同蓝图（split-screen 可以 compare-reveal 也可以
evidence-stack）；同一蓝图可以配不同构图（focus-drilldown 常用
diagram-canvas 也可以用 layered-depth）。

---

## 蓝图选型决策树

开工前问自己：

1. **这一拍在表达什么关系？**
   - 单物体介绍 / 抽象概念 → `process-build` 或 `focus-drilldown`
   - 嵌套层级（小单元组成大单元）→ `scope-expand`
   - 多个物体对照 → `compare-reveal` 或 `triptych`
   - 用「搬了几次 / 跑了几趟」讲代价 → `trip-count`
   - 因果 / 累积 → `evidence-stack` 或 `ablation-remove`
   - 数量 / 数值 → `data-countup` 或 `token-transform`
   - 一个输入变大、另一个量非线性跟涨 → `scale-sweep`
   - 公式 / 规则 → `formula-assemble`
   - 反例 / 边界 → `failure-inspect` 或 `boundary-contract`

2. **这一步的主视觉是单一焦点还是累积？**
   - 单一 → process-build / focus-drilldown / formula-assemble /
     data-countup / failure-inspect / boundary-contract
   - 累积 → compare-reveal / ablation-remove / token-transform /
     evidence-stack / scope-expand / trip-count / scale-sweep

3. **这一拍结束后，画面应该停在什么状态？**
   - 全图就位 → process-build / focus-drilldown / evidence-stack
   - 对照就位 → compare-reveal / ablation-remove
   - 公式完整 → formula-assemble
   - 数字落定 → data-countup
   - 错误清晰 → failure-inspect
   - 边界明确 → boundary-contract
   - 最上一级全部点亮 → scope-expand
   - 两边趟数能数清 → trip-count
   - 停在极值、容器快满 → scale-sweep

每条决策都对得上一个或多个蓝图。**选不出来 = 可能是 outline 这
一步没想清楚** —— 回 [`OUTLINE-FORMAT.md`](OUTLINE-FORMAT.md) 补
purpose / focal / content relationship 三个字段。
