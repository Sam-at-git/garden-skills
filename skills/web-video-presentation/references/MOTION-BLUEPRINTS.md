# 动画蓝图（Motion Blueprints）

论文 / 教学视频里反复出现的 10 种动画节拍。**每个蓝图只规定内容关
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

构图是"画面怎么摆"，蓝图是"动画怎么走"。**两者正交**：同一构图
可以走不同蓝图（split-screen 可以 compare-reveal 也可以
evidence-stack）；同一蓝图可以配不同构图（focus-drilldown 常用
diagram-canvas 也可以用 layered-depth）。

---

## 蓝图选型决策树

开工前问自己：

1. **这一拍在表达什么关系？**
   - 单物体介绍 / 抽象概念 → `process-build` 或 `focus-drilldown`
   - 多个物体对照 → `compare-reveal` 或 `triptych`
   - 因果 / 累积 → `evidence-stack` 或 `ablation-remove`
   - 数量 / 数值 → `data-countup` 或 `token-transform`
   - 公式 / 规则 → `formula-assemble`
   - 反例 / 边界 → `failure-inspect` 或 `boundary-contract`

2. **这一步的主视觉是单一焦点还是累积？**
   - 单一 → process-build / focus-drilldown / formula-assemble /
     data-countup / failure-inspect / boundary-contract
   - 累积 → compare-reveal / ablation-remove / token-transform /
     evidence-stack

3. **这一拍结束后，画面应该停在什么状态？**
   - 全图就位 → process-build / focus-drilldown / evidence-stack
   - 对照就位 → compare-reveal / ablation-remove
   - 公式完整 → formula-assemble
   - 数字落定 → data-countup
   - 错误清晰 → failure-inspect
   - 边界明确 → boundary-contract

每条决策都对得上一个或多个蓝图。**选不出来 = 可能是 outline 这
一步没想清楚** —— 回 [`OUTLINE-FORMAT.md`](OUTLINE-FORMAT.md) 补
purpose / focal / content relationship 三个字段。
