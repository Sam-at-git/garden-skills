---
name: web-video-presentation
description: 把一篇文章或口播稿，做成"看起来像视频"的点击驱动 16:9 网页演示，可选合成口播音频。流程：原始文章 → **一次产出**口播稿 + outline 开发计划 → 用户**一次对齐** 5 件事（稿子 / outline / 主题 / 素材 / 开发模式）→ 网页开发（逐章 / 顺序 / 并行）→ 可选音频合成（provider-agnostic：内置 MiniMax mmx-cli + OpenAI TTS + VoxCPM 声音克隆，可换 ElevenLabs / edge-tts / Azure / 自带 TTS）。**outline 只规划节奏与信息密度，不规划动画** —— 动画由章节开发时按 PRINCIPLES + ANTI-AI 法则即时设计。每次点击推进口播稿的一个节拍，每一步独占整屏，进度条平时隐藏只在悬浮时出现。适用场景：用网页做视频（动态 PPT 但不像 PPT）、把口播稿 / 文章变成可交互的解说、为 B 站 / YouTube / 视频号录屏教程、做有电影感的产品 / talk demo。本 Skill 沉淀的是设计方法论 + 协作流程 —— 不绑定任何特定样式 / 字体 / 颜色 —— 因此能复用到任意主题与美学。**论文解读视频（arXiv / 顶会）额外读 references/PAPER-INTERPRETATION.md** —— **概念解释层**（骨架照抄论文、每个概念由讲者引外部通识用「锚→桥→术语→验算」四拍讲透）+ 证据层标注（论文事实 / 实验支持 / 解读推断 / 背景知识）+ 论文类型叙事弧 + 图表复用纪律 + opt-in KaTeX 公式揭示（--math）。
---

# Web Video Presentation

把一篇文章或口播稿，一步步做成可录屏的"伪装成视频的网页"，可选合成
口播音频。产出物 = Vite + React + TS 项目 + 按章节切分的音频。

## 适用场景

- "我有口播稿 / 一篇文章，帮我做成视频" —— 口播驱动的内容
- 想做 "动态 PPT"
- 16:9 横屏录屏，大字、留白、每屏都要有动效
- 教学 / 产品演示 / keynote 想要电影感
- B 站 / YouTube /抖音视频内容
- **论文解读（arXiv / 顶会 / 期刊）** —— 走 paper 模式，额外读
  [`references/PAPER-INTERPRETATION.md`](references/PAPER-INTERPRETATION.md)：
  **概念解释层（§2.5，先读这节）** + 证据层（论文事实 / 实验支持 / 解读推断 / 背景知识）
  + 论文类型叙事弧 + 图表复用 + 公式（`--math`）；
  可选**静默模式**（全程默认、不停下来问，仅论文，见该文件 §12）

本 Skill **以方法论 + 协作流程为核心**。脚手架模板提供 token 和原语，
但每个美学决策（配色、字型、动效气质）都应该针对你的主题重新设计 ——
不要照搬。

---

## 工作流总览

```
Phase 1   内容编写
   1.1  识别用户输入
   1.2  一次产出 script.md + outline.md
        （口播稿 + 开发计划）
   ▼
[Checkpoint Plan]      ← 必须停。一次对齐 5 件事：
                         稿子 / outline / 主题 / 素材 / 开发模式
   ▼
Phase 2   网页开发
   2.1  脚手架（按选定主题）
   2.2  第 1 章 = 主线程 + 完整版本（强制 anchor）
        ▼
        [硬节点] 用户验收第 1 章 ← 不可跳过
        ▼
   2.3  第 2~N 章（按选定模式：A 逐章 / B 顺序 / C 并行）
   ▼
[Checkpoint Audio]     ← 必须停。是否合成音频
   ▼
Phase 3   音频合成（可选）
   ▼
Phase 4   录屏 + 后期
```

工作目录约定（agent 在用户当前目录下创建 / 编辑）：

> **每个 paper / 口播 = 一个独立项目**，放在 `mypresentations/<id>/`
> 下，**禁止落到 `my-video/` 这种共享目录**——后者会被后续 paper 覆盖。
>
> `<id>` 取值（按这个优先级，slug 自动 sanitize）：
> 1. 用户给的口播主题 / 标题（中文/英文都行，kebab-case，例如
>    `agent-fundamentals`、`moss-xiaozhi-3`）
> 2. 论文 id（arXiv 用 `arxiv-2607.22997v1`，DOI / 顶会用 paper-short-name，
>    例如 `gpt-image-2`、`scaling-monosemanticity`）
>
> 非论文口播、临时 demo、给客户单次的产物可放 `mypresentations/_scratch/<id>/`
> —— 但也**必须放在 `mypresentations/` 下**，绝不写到 `my-video/`。

```
mypresentations/<id>/
├── article.md          # 用户给原文时必有 —— 不删！开发阶段画面信息源
├── paper-digest.md     # ★ 仅论文输入：结构化摘要（带 locator），证据层引用源
├── paper-figures/      # ★ 仅论文输入：抓下来的论文原图 + figures.json（PAPER-INTERPRETATION §6.5）
├── script.md           # 必有：保持原文语言的平台化口播稿（决定节拍）
├── outline.md          # 必有：开发计划（章节切分 + 每步内容 + 信息池）
└── presentation/       # 脚手架产出的 Vite + React + TS 项目
    ├── src/chapters/<NN>-<id>/
    │   ├── <Chapter>.tsx     # 视觉实现
    │   ├── <Chapter>.css
    │   └── narrations.ts     # ★ step 数 + 口播文本的唯一真相源
    ├── public/paper/         # ★ 仅论文输入：选中上屏的论文原图
    ├── scripts/
    │   ├── inspect-layout.mjs      # 静态结构检查（npm run layout:check）
    │   ├── smoke-render.mjs        # ★ 真浏览器逐步渲染，白屏必红（npm run smoke）
    │   ├── extract-narrations.ts   # 扫所有 narrations.ts → audio-segments.json
    │   ├── synthesize-audio.sh     # provider-agnostic runner（循环 segments）
    │   ├── audio-report.mjs        # 每章时长 + 偏长/偏短的步（npm run audio:report）
    │   ├── build-audio-track.mjs   # 拼一条连续旁白音轨（npm run audio:track）
    │   ├── record-auto.mjs         # 无头驱动 ?auto=1 录整片（npm run video:record）
    │   ├── build-video.mjs         # 裁切 + 对齐旁白 + 编码出 mp4（npm run video:mux）
    │   └── tts-providers/          # 每 provider 一个 .sh（内置 3 个）
    │       ├── README.md           # 三函数契约 + 5 段现成代码片段（11labs / edge-tts / say / azure / gcloud）
    │       ├── voxcpm.sh           # ★ 默认 —— 本地声音克隆（常驻 server + 参考音频；4.6G 模型外部）
    │       ├── minimax.sh          # 中文音色稳，用 mmx-cli（PRESENTATION_TTS=minimax）
    │       └── openai.sh           # OpenAI TTS（curl + OPENAI_API_KEY；PRESENTATION_TTS=openai）
    ├── audio-segments.json         # extract 产出（合成前 review）
    ├── public/audio/<id>/<N>.mp3   # 可选：合成的音频
    └── render/                     # 可选：录制与出片产物（已 gitignore）
        ├── <项目>.mp4              # 成片 1920×1080 H.264 + AAC
        ├── chapters.txt            # 章节时间戳，贴视频简介
        ├── raw.webm                # 原始录制，留着可只重跑 video:mux
        └── cues.json               # 每步边界 + 裁切矩形
```

> **关键**：`narrations.ts` 是 step 数和音频合成的**唯一真相源**。
> 章节 `.tsx` 里的 `if (step === N)` 出现的最大 N + 1 必须等于
> `narrations.length`。这保证 5 处地方（script / outline / 章节代码 /
> chapters.ts / 音频文件）永远不会漂。

---

## 硬性自检协议（贯穿整个 Skill）

下面三个产出，每一个**完成后必须走自检 → 修复 → 再汇报 / 推进**：

| 产出 | 自检清单出处 |
|---|---|
| `script.md` | [`SCRIPT-STYLE.md`](references/SCRIPT-STYLE.md) 三层自检（形式 / 风骨 / 念出来） |
| `outline.md` | [`OUTLINE-FORMAT.md`](references/OUTLINE-FORMAT.md) 自检 |
| 单章实现完成 | [`CHAPTER-CRAFT.md`](references/CHAPTER-CRAFT.md) 完工自检 |

**执行方式**（按能力降级，**优先用更隔离的方式**）：

1. **Agent Teams（最优）**：开一个独立的 reviewer agent，给它"产出文件
   路径 + 对应清单 + 关键上下文"，让它逐项核查并**严格汇报结论**
   （哪几条 pass / 哪几条 fail + 证据 + 改写建议）。
2. **subAgent（次优）**：没有 Teams 能力但能开 subagent 就用 subagent
   走同样流程。
3. **自检（兜底）**：当前 agent 都没有上述能力，就自己**严格逐项**
   核查 —— 不允许目测一遍就放行。

### 验证通道 —— 不要用 ad-hoc shell 手搓验证

自检 / 核查时按下面优先级选工具。**每一条 ad-hoc shell（`python3 -c` /
`node -e` / `awk` / 临时 `grep` 读 `/tmp` dump）都是一次人干预确认**——
本 Skill 要消灭的是这类"杂务型确认"，把人留在**决策型节点**（Checkpoint
Plan / 第 1 章验收 / Checkpoint Audio / 主题与稿子取舍）上。

1. **读文件 / 搜文件 → Read / Grep / Glob 工具**（零确认）。核查文件内容
   用这三个工具，**不要**用 shell 的 `cat` / `grep` / `awk`。
2. **机器可判定的结构不变量 → 具名 npm 脚本**（已被 allowlist 覆盖，
   跨项目 / 章节 / 端口永久免确认）：
   - `npm run verify` —— **一条命令跑完下面三道闸**，完工自检默认用它。
   - `npm run layout:check` —— 静态层。已覆盖 **narrations.ts 的 step 数 ↔
     章节代码 `if (step===N)` 最大 N + 1**（rule 名 `step-count-mismatch`）↔
     `data-composition` 合法性 ↔ 主题色 / 字 token ↔ **中文里的裸直引号**
     （`broken-string-literal`）。**这些不变量不要再手搓 `node -e` 验**。
   - `npm run build`（= `tsc -b && vite build`）—— 类型 + **解析**错误。
     **别用 `npx tsc --noEmit` 代替**：让页面白屏的是打包那一侧，两者
     判定不一定一致。
   - `npm run smoke` —— **真浏览器跑一遍，白屏 / 未捕获异常必红**。
     `layout:check` 是纯文本分析、从不加载页面，所以它全绿**不代表应用能跑**
     （见 [`references/VISUAL-QA.md`](references/VISUAL-QA.md) §2.5 的事故）。
     没装 playwright 会跳过并 exit 0 —— **跳过必须如实汇报，不许说成通过**。
   - `npm run extract-narrations` 同理。
3. **需要判气质 / 反 AI 味 / 双源原则 → reviewer agent**（Agent Teams /
   subagent）：它用 Read 工具读文件 = 零确认，且视角比自检独立。

只有上面三条都不覆盖的检查才考虑 shell；此时**优先把它沉淀成一条具名
npm 脚本**（写进项目 `scripts/` + `package.json`），一次性消灭整类确认，
而不是每次现场拼 `node -e`。

**铁律**：拿到结论后**先按 fail 项把产出改完**，再向用户汇报"做完了
+ 自检结论 + 改了什么"。**直接拿原始结论汇报但不修复 = 违规**。

**第二条铁律 —— agent 的 self-report 不是通过依据**：subagent / reviewer
说"全部 pass"**不能**作为完成的证据，只有**主线程自己跑出来的命令输出**
算数。这不是不信任，是有事故记录：并行 fan-out 那一轮多个 agent 自报
"all pass"，实际留下了引号 bug、缺 `max-width`、`const` 夹断 step 计数。
汇报前**自己跑一次 `npm run verify`**。

---

## 各阶段文件读取指南

不同阶段读不同的文件。**长会话里 agent 容易遗忘原则**，特别是
Phase 2.4 的"实现单章"会重复 N 次 —— 每次都要回看核心约束。

| 阶段 | 必读（每次都看） | 一次性看完 / 按需查 |
|---|---|---|
| Phase 1.1-1.2 内容编写 | `references/SCRIPT-STYLE.md` + `references/OUTLINE-FORMAT.md` + `article.md`（用户原文，如有） | —— |
| **Checkpoint Plan 选主题** | —— | `themes/*/theme.json`（动态读全部，列清单 + `bestFor` 推荐 + `descriptionZh`）；`references/THEMES.md`（用户想了解主题系统时） |
| Phase 2.1 脚手架 | —— | SKILL.md 本节看一次 |
| **Phase 2.4 实现单章（×N 次，被 2.2 / 2.3 调用）** | **`references/CHAPTER-CRAFT.md`** 单一入口 —— Part 0 十条原则 / ★ 静态布局阶段 / Part 1 开工 5 问 / Part 2 关系→动作决策树 / Part 3 视觉工具箱 / Part 4 时长参考 / Part 5 反 AI 味反模式 / Part 6 代码硬规则（**含 narrations.ts 强制约束**）/ Part 7 完工自检 / Part 8 反馈速查 + 当前主题的 `themes/<id>/theme.json` + 当前章节的 outline.md 段落 + **`article.md` 本章对应段落** + 素材清单 | **`VISUAL-DIRECTION.md`**（首次开工读一次建词汇表，之后卡壳回查）；**`MOTION-BLUEPRINTS.md`**（按 content relationship 索引，只读命中的那一条）；**`VISUAL-QA.md`**（工具手册，报了 rule 名再查）；`references/EXAMPLES/`（结构示意，不是抄袭模板）；`references/THEMES.md` 完整 token 契约 |
| Phase 3 音频合成 | `references/AUDIO.md`（含 narrations.ts → segments.json → 任意 provider 流程，内置 voxcpm / minimax / openai） | `templates/scripts/tts-providers/README.md`（换 provider / 自带 TTS 时） |
| Phase 4 录屏 + 后期 | `references/RECORDING.md`（含 `?auto=1` 自动录屏） | —— |
| 选 / 造 / 切主题 | —— | `references/THEMES.md` |
| 视觉 QA / 调试 | `references/VISUAL-QA.md`（`npm run verify` = layout:check + build + smoke；再开 `?layout=1` overlay） | —— |

> **`CHAPTER-CRAFT.md` 是写章节的单一入口**。十条原则 / 开工 self-prompting /
> 决策树 / 反 AI 味反模式 / 完工自检全部并入这一份，**每章都从它开始**。
>
> 另外三份是**按需展开**，不要每章通读一遍：
> - [`VISUAL-DIRECTION.md`](references/VISUAL-DIRECTION.md) —— **首次开工读一次**
>   （建立 8 构图 + 视觉角色的词汇表），之后只在选构图卡壳时回查 §1 / §4
> - [`MOTION-BLUEPRINTS.md`](references/MOTION-BLUEPRINTS.md) —— **按索引读一条**：
>   照本步的 content relationship 找到对应蓝图，只读那一条，不要通读 10 条
> - [`VISUAL-QA.md`](references/VISUAL-QA.md) —— **工具手册**：知道跑
>   `npm run layout:check` 和 `?layout=1` 就够；报了具体 rule 名再按名查对应小节
>
> 这么切分是有原因的：Phase 2.4 会重复 N 次，如果四份全量必读，每章要吃掉
> 一千多行文档。`EXAMPLES/` 同理 —— **不是必读**，先按内容自由设计，卡壳才翻
> （按 anchor 翻"形"，不要照搬）。

---

## Phase 1 —— 内容编写（一次产出）

### 1.1 识别用户输入

| 用户给的东西 | 该做的 |
|---|---|
| 原始文章（书面语 / 公众号 / 论文 / 博客） | 一次产出 `script.md` + `outline.md`（1.2），过 Checkpoint Plan |
| 直接的口播稿 / 视频脚本 | 落盘成 `script.md`，一次产出 `outline.md`（1.2 简化版），过 Checkpoint Plan |
| 啥都没有，只说"帮我做个 X 主题的视频" | **反问**：先给一段素材或大纲。Skill 不替用户构思内容 |

### 1.2 一次产出 script.md + outline.md

**两份产出物在一次思考中完成**：

1. **生成 `script.md`**：按 [`references/SCRIPT-STYLE.md`](references/SCRIPT-STYLE.md)
   的规则把 article 转成保持原文语言的平台化口播稿。**保留 `article.md` 不删**——它是
   outline 写信息池和章节实现画面时的细节源（双源原则）。
2. **生成 `outline.md`**：按 [`references/OUTLINE-FORMAT.md`](references/OUTLINE-FORMAT.md)
   规则切章节 + 切 step + 每章首段抽**信息池**。

**outline 的边界**（关键）：

| outline 必须写 | outline 不要写 |
|---|---|
| 章节切分 / 每章 step 数 / 估时 | 具体动画类型（blur clear / wipe / 弹簧） |
| 每步屏幕内容（hero / 数据 / 标语 / 列表项） | CSS 实现手段（filter / SVG / clip-path） |
| 章节级**信息池**：从 article 抽的数字 / 引用 / 案例 / 标签 | 时长数值（不写 ~2.5s / 80~120ms） |
| 步级关系名前缀（"反差对照" / "递进列表" / "金句" 等可选 hint） | 持续微动 / 错峰量等微观节奏 |

> **outline 不写动画的理由**：写死动画 = chapter agent 退化为翻译机；
> 留白让 chapter agent 在每步开工时按 [`CHAPTER-CRAFT.md`](references/CHAPTER-CRAFT.md)
> 的"内容驱动决策树"自由设计，才有真正的视频感。详见
> [`CHAPTER-CRAFT.md`](references/CHAPTER-CRAFT.md) Part 0 原则 7。

**落盘后必须先走自检再进 Checkpoint Plan**：按上文「硬性自检协议」分别
对 `script.md` / `outline.md` 执行（优先 Agent Teams → subAgent → 自检），
按结论修复完成后再进入 Checkpoint Plan。

---

## Checkpoint Plan —— 5 件事一次对齐（**硬节点**）

`script.md` + `outline.md` 写完后必须停下来。**用户在这一个节点同时确认
5 件事**。

### agent 此时要做的预备工作

1. 读所有 `themes/*/theme.json` 拿 `nameZh` / `descriptionZh` / `bestFor`
   / `mood` —— **不要硬编码清单**
2. 根据 `script.md` 的内容类型 / 关键词 / 语气，**主动**从主题里挑 2~3
   套**最匹配的推荐**（匹配 `bestFor` 字段）
3. 扫一遍 `outline.md` 末尾"素材清单"部分

### 总结模板（骨架，agent 按情况填充）

```
内容计划写完，产出文件：
  📄 article.md     {若用户给原文则保留}
  📄 script.md      {X} 字 / ~{T} 分钟
  📄 outline.md     {N} 章 / {M} 步 + 每章信息池 + 末尾素材清单

章节速览：
  1. <id>     <章节标题>    <S> 步 ~<T>s
  2. ...

接下来一次对齐 5 件事：

  1. 稿子 (script.md) 要不要改？
     可以直接编辑文件，或口头告诉我修改方向。

  2. 开发计划 (outline.md) 要不要改？重点看：
     - 章节切分 / step 数 / 估时是否合理（合理判断：每章 30~60s）
     - 每步屏幕内容是否清晰
     - 每章首段「信息池」是否有足够的 article 细节供画面挂
     - 末尾素材清单是否完整

  3. 选哪个主题？我的推荐：
     ★ <推荐 1：nameZh (id)> — 因为 <bestFor 命中>；<descriptionZh 摘要>
     ★ <推荐 2 / 推荐 3>
     其它可选：<剩余主题，nameZh + 一句话>
     也可以让我帮你做新主题（详见 references/THEMES.md）。

  4. 真素材怎么准备？粗看本视频要的图：<列粗略清单>
     a) 我从 <现有素材路径> 帮你挑   b) 你自己提供   c) 全部 placeholder

  5. 开发模式选哪个？

     **第 1 章无论哪种模式都必须主线程做完 + 用户验收**（强制 anchor）。
     差异在第 2 章及之后：

     A) 默认 · 逐章确认（推荐）
        每章做完都暂停验收 → 风险可控 / 节奏最稳
     B) 第 1 章后顺序开发（不并行）
        第 2~N 章主线程顺序做完后统一验收 → 速度中 / 适合 agent 不支持并行
     C) 第 1 章后并行开发（subagent）
        第 2~N 章用 subagent 并行 → 最快 / 用户控并行数（一次几章）
        ⚠️ 风格各章会有差异（这是预期，主题禁区兜底）
```

**📄 论文输入额外对齐第 6 件事**（仅 paper 模式；详见
[`references/PAPER-INTERPRETATION.md`](references/PAPER-INTERPRETATION.md)）：

```
  6. 论文模式对齐：
     - paper type 确认？（empirical / methods / survey / theory / system）→ 决定走哪支叙事弧
     - **前置知识台账**列全了吗？每个术语都判了 必讲 / 一句带过 / 明确跳过？（§1.2 第 5 节）
     - 「必讲」的概念在 outline 里都有对应的 `explains:` step 吗？（§2.5）
     - 时长是按**概念预算**算的，不是按字数比例砍的吗？（§2.5.5 —— methods 论文 20~35 分钟是常态）
     - paper-digest.md 的 locator 够不够撑证据层？（每个关键画面能否挂 §X / Fig Y）
     - claim vs proven 边界标清了吗？（一句话主张 / 论文已证 / 我的推断）
     - **论文原图抓了吗？**（`node <skill>/scripts/fetch-paper-figures.mjs <arxiv-id>`，§6.5）
       —— 招牌图和**全部定性材料**（注意力图 / 样例 / 失败案例）应当直接用原图，别重画
     - 哪些图表 cite 原图 / 哪些 redraw / 哪些 animate？（§6 决策树；不扭曲数据 / 坐标）
     - license 查了吗？画面署名 + 口播点名（§6.2）都安排了吗？
     - 要不要 --math？（公式多的 methods / theory 论文建议要）
```

收到反馈后：
- 稿子 / outline 要改：直接编辑文件，编辑完 ping 一次（或口头描述 agent 改）
- **主题必须明确**才进入 Phase 2。用户说"主题你帮我选" → 取你推荐的第 1 个，
  **告诉用户你选了什么、为什么**，给反悔机会
- 模式选定 → 进 Phase 2

---

## Phase 2 —— 网页开发

### 2.1 脚手架

```bash
bash <path-to-web-video-presentation>/scripts/scaffold.sh \
  ./presentation \
  --theme=<用户选的主题 id>

# 论文模式公式多时加 --math（注入 KaTeX + <Math>/<Formula>，详见 PAPER-INTERPRETATION.md §7）
bash <path-to-web-video-presentation>/scripts/scaffold.sh \
  ./paper-talk --theme=tufte-ink --math

bash <path-to-web-video-presentation>/scripts/scaffold.sh --list-themes
```

> 自定义主题 → 先按 [`references/THEMES.md`](references/THEMES.md)
> "创作新主题"流程做一个 `themes/<my-theme>/`，再 `--theme=<my-theme>`。

脚手架带一个 `01-example` demo。在写第一章真实内容前**删掉**：

```bash
rm -rf presentation/src/chapters/01-example
```

并把 `presentation/src/registry/chapters.ts` 里 `EXAMPLE_CHAPTER`
的 import 和数组项移除。

### 2.2 第 1 章 —— 主线程 + 强制验收

**核心**：第 1 章 = 完整版本一次到位（节奏 + 视觉 + 真素材齐全）。
**没有"骨架版"概念** —— 第一章就要做出**用户能直接验收**的样板。

为什么第 1 章必须主线程：

- 它是 [`CHAPTER-CRAFT.md`](references/CHAPTER-CRAFT.md) 这套指引在**当前
  主题 + 当前题材**下的第一次落地
- 如果指引有盲区 / 主题颜色 / 字体 token 不够用，第 1 章一定会暴露 ——
  这时候有人类反馈就能修指引 / 调主题，**早改成本最低**
- 后续章节（无论顺序 / 并行）都要参考第 1 章的代码模式，所以第 1 章 =
  当次项目的"风格锚点（不强求章节间一致，但单章自身得有完整说服力）"

**做完第 1 章后必须停下来**等用户验收：

```
第 1 章 <id> 做完了，dev server 在 localhost:5173 运行。

验收重点：
  □ 视觉气质对不对？符合 <theme nameZh> 的预期吗？
  □ 节奏对不对？某些步太快 / 太慢 / 信息太薄？
  □ 内容驱动动画是否到位？还是有几步是无脑入场动画？
  □ 双源原则：屏幕画面有没有"口播没念但 article 能挂"的细节？
  □ 反 AI 味检查：紫粉渐变 / 圆角彩色边框 / 假插画 / emoji 是否有？

问题告诉我，我针对性改。OK 了告诉我"继续"，我按选定模式做第 2 章及之后。
```

### 2.3 第 2~N 章 —— 按选定模式

**所有模式下的共同规则**：每章独立按 [`CHAPTER-CRAFT.md`](references/CHAPTER-CRAFT.md)
开发。**风格不强求章节间完全一致** —— 主题颜色 / 字体 token 兜底视觉
统一，动画 / 节奏 / 视觉演示由章节自由发挥是设计预期。

#### 模式 A · 默认 · 逐章确认

第 2 章做完 → 暂停验收 → OK → 第 3 章 → 暂停 → ... → 第 N 章。**每章
独立验收**，问题随时改，**风险最低，节奏最稳**。**用户不明确选模式时
默认走这个**。

#### 模式 B · 第 1 章后顺序开发

第 2 章 → 第 3 章 → ... → 第 N 章 **主线程顺序做完，最后统一验收**。
速度中等，适合 agent 不支持并行任务的环境。

#### 模式 C · 第 1 章后并行开发（subagent）

用 subagent 把第 2~N 章并行做完。**最快，但风格各章会有差异** —— 这是预期，因为：

1. 每个 subagent 看不到别的 subagent 产出，无法机械对齐
2. 章节代码物理分离（每章一个文件夹 / 自己的 CSS 前缀），不会互相
   破坏
3. 主题 token 兜底视觉统一（颜色 / 字体 / hero 数字 / 卡片 / 分割线
   性格 / 装饰），气质不会跑偏
4. **风格不一致 = 人手写视频的呼吸感**（多 voice / 多视角）

**并发上限：一次最多 3~4 章**（用户可以往下调，**不要往上加**）。
一次派 13 个 chapter-builder 触发过账号级速率限制，4 个 agent 中途挂掉，
留下只有 2~3 个文件的残缺章节 —— 而它们的 self-report 还写着 "all pass"。
章多就分批：做完一批、扫一遍完整性、再派下一批。

**每批 fan-out 收口后必须做完整性扫描**（主线程自己做，不看 self-report）：

1. **文件齐不齐** —— 每章 `src/chapters/<NN>-<id>/` 下应有
   `<Chapter>.tsx` + `<Chapter>.css` + `narrations.ts`（论文章节多一个
   `evidence.ts`）。用 Glob 工具列一遍，缺文件 = 那个 agent 中途挂了，
   **重派该章**，别手工补半个。
2. **`npm run verify`** —— layout:check + build + smoke 一次跑完。
   这一步会把残缺章节、引号 bug、step 数错位、白屏全部照出来。
3. **fail 全部修完**再向用户汇报。

并行 subagent 的 prompt 必须包含：

- 当前章节 outline 段落（含信息池）
- `references/CHAPTER-CRAFT.md` 的路径（**单一必读** —— 视觉演示要求 +
  逐步揭示 + 双源原则 + 反 AI 味 + 代码红线 + 完工自检全部在这一份里）
- 当前主题 `theme.json` 的 `descriptionZh` / `mood` / `bestFor`（参考气质
  即可，动画 / 时长 / 字号 / emoji 由 chapter agent 自由决定）
- **第 1 章代码作为"代码风格"参考**（不是"视觉抄袭对象"）
- 硬规则：每章独立 CSS 前缀（`.cd-` / `.mg-` / `.pm-` / ...）；
  不修改 `chapters.ts`；完工跑 `npm run verify`；**中文字符串一律用全角
  `“ ”`，禁止 ASCII 直引号**（直引号会让整个文件解析失败 → 整站白屏）

**重要**：无论选哪种模式，**用户随时可以中途切换模式**。第 2 章 OK
后用户说"剩下的并行" / "剩下的逐章" 都行。

### 2.4 实现单章（每章必走）

详细指引见 [`references/CHAPTER-CRAFT.md`](references/CHAPTER-CRAFT.md) ——
**单一必读入口**，覆盖：视觉演示要求 / ★ 静态布局阶段 / 逐步揭示 /
内容取舍 / 双源原则 / 视频演示基本审美 / 反 AI 味 / 代码红线 / 完工自检。

**核心要点**（CHAPTER-CRAFT.md 详述）：

- **★ 静态布局阶段（必走，铁律）**：每步实现顺序 = **关系 → 构图 → 英
  雄帧 → 动作 → 持留** —— 先写静态终态，再加入场动画。配套：
  - [`references/VISUAL-DIRECTION.md`](references/VISUAL-DIRECTION.md) —— 8 个
    构图 / 视觉角色 / 英雄帧契约 / 密度规则 / AI 味清单
  - [`references/MOTION-BLUEPRINTS.md`](references/MOTION-BLUEPRINTS.md) —— 论
    文 / 教学常用 10 种动画节拍（process-build / compare-reveal /
    ablation-remove / ...）
- **每章必须有 CSS / SVG / Canvas / JS 视觉演示**，禁纯文字章节
- **逐步揭示**：清单 / 列表必须 1 项 = 1 step，禁一次全展示
- **双源原则**：节奏跟口播稿（顺序不能乱），细节回原文章抽（信息池 +
  本章 article 段落）
- **每章 scene 根元素加 `data-composition="..."`**（8 个合法值之一），
  主要元素加 `data-role="primary|secondary|background|annotation"` ——
  这两个属性是 `npm run layout:check` 机器检查 + `?layout=1` 人工检查的
  **命名锚点**，光写它们不改变渲染。想让 `composition.css` 的构图真的
  接管布局，再额外加一个无值属性 `data-composition-layout`（opt-in）。
  **契约只有 data-\* 属性一套**，不要写 `className="role-primary"`
- 📄 **论文章节的证据层**：用 `<Evidence step marks>` + `<CitationChip>`
  （`src/components/Evidence.tsx`，脚手架自带），证据数据放本章
  `evidence.ts`——**不要塞进 narrations.ts**，那是音频管线的真相源，
  `extract-narrations.ts` 遇到非字符串会直接抛错
- **完工自检分四层**（详见 [`references/VISUAL-QA.md`](references/VISUAL-QA.md)）：
  1. **结构层**：`npm run layout:check` 跑 `inspect-layout.mjs`
  2. **运行层**：`npm run build` + `npm run smoke` —— 应用真的能跑吗、每步
     真的画出东西了吗。**第 1、3 层全绿而整站白屏是发生过的**（VISUAL-QA §2.5）
  3. **视觉层**：开 `?layout=1` debug overlay 逐 step 走英雄帧
  4. **气质层**：CHAPTER-CRAFT.md Part 5 + VISUAL-DIRECTION.md §5
     + MOTION-BLUEPRINTS.md 选不同蓝图

  前两层一条命令跑完：**`npm run verify`**

### 2.5 大改后 bump STORAGE_KEY

改动 `chapters.ts`（增加 / 删除 / 重排章节，或某章 `narrations.ts`
长度变化）后，**bump** `presentation/src/hooks/useStepper.ts` 的
`STORAGE_KEY`（如 `v4` → `v5`），避免持久化游标落到不存在的 step 上。

---

## Checkpoint Audio —— 是否合成音频（**硬节点**）

Phase 2 结束后必须停下来，问用户：

```
网页做完，{N} 章 {M} 步，dev server 在 localhost:5173 跑着。

要不要合成音频做"自动播放录屏"？
  ✓ 合成 → 扫所有章节的 narrations.ts 出 audio-segments.json，
           调 TTS provider 合成每步一个 mp3 到 public/audio/。
           合成完后用 ?auto=1 模式可以一镜到底录屏（音视频天然同步）。
           内置三个 provider（默认 voxcpm —— 本地声音克隆，离线、可复刻任意音色）：
             • voxcpm  (本地声音克隆) —— 默认。首次跑 scripts/voxcpm/voxcpm-setup.sh：
                       自动找/装 python+voxcpm、找/下 4.6G 模型、写配置（已就绪则秒过）
             • minimax (mmx-cli)       —— 中文音色稳，要 MiniMax key；显式 PRESENTATION_TTS=minimax
             • openai  (OPENAI_API_KEY) —— curl-based；显式 PRESENTATION_TTS=openai
           其它后端 (ElevenLabs / edge-tts 免费 / macOS say 离线 /
           Azure / Google) 见 scripts/tts-providers/README.md 的现成片段。
  ✗ 不合成 → 跳过 Phase 3，直接 Phase 4 用手动录屏 + 后期配音。
```

要合成 → Phase 3。不合成 → 直接 Phase 4。

---

## Phase 3 —— 音频合成（可选）

详细流程见 [`references/AUDIO.md`](references/AUDIO.md)。简版：

```bash
cd presentation
npm run extract-narrations           # 扫所有 narrations.ts → audio-segments.json
# 让用户扫一眼 audio-segments.json 确认文本对
bash scripts/voxcpm/voxcpm-setup.sh  # 首次（默认 voxcpm）：自动装 voxcpm + 找/下模型；已就绪则秒过
npm run synthesize-audio             # 默认 voxcpm，增量；用克隆声音念全部 step
# 显式换线上 TTS：
PRESENTATION_TTS=minimax npm run synthesize-audio   # MiniMax（要 mmx-cli + key）
PRESENTATION_TTS=openai  npm run synthesize-audio   # OpenAI（要 OPENAI_API_KEY）
# 或自定义：写一个 scripts/tts-providers/<name>.sh，见该目录的 README.md
# 非英文旁白记得给 language boost（minimax）：PRESENTATION_TTS_LANG=Chinese
npm run audio:report                 # 每章时长 + 偏长/偏短的步
```

合成完**跑一次 `npm run audio:report`**，把输出位置 / 总时长 / 时长异常的段
（太长 = 该 step 拆分；太短 = 文案太薄）告诉用户 —— 给最后一次校准节奏的
机会。然后进入 Phase 4。

---

## Phase 4 —— 录屏 + 后期

详见 [`references/RECORDING.md`](references/RECORDING.md)。三种路径：

| 场景 | 推荐路径 |
|---|---|
| 已合成音频 · **有桌面** | **Auto 模式一镜到底**：浏览器开 `localhost:5173/?auto=1` → 点蒙层启动 → 整片自动播完 → 停录 → 裁头尾即成片，**无需后期对音轨** |
| 已合成音频 · **没有桌面**（服务器 / 容器 / agent 环境） | **无头管线**：`npm run video:record` → `npm run video:mux` → `render/<项目>.mp4`。先 `-- --max-steps=6` 冒烟测 |
| 跳过了音频 | 默认 Manual 模式手动点击推进 → 后期任意剪辑工具配音 |

> agent 在 Phase 3 / Checkpoint Audio 后**主动告诉用户**适合的录屏路径。
> agent 自己出片时走无头管线 —— 它不需要屏幕录制软件。

---

## 十条原则（一句话清单）

完整展开见 [`references/CHAPTER-CRAFT.md`](references/CHAPTER-CRAFT.md)
Part 0 —— **写章节时回那里查**，下面只是索引。

| # | 原则 | 一句话 |
|---|---|---|
| 1 | 16:9 固定舞台 | 内容 1920×1080 + transform scale，没有响应式 |
| 2 | 全局 step 计数器 | 章节是 step 的纯函数，无定时器 |
| 3 | 每步独占整屏 | `if (step === N) return <FullScene />` |
| 4 | 口播节拍 = step | 一节拍 = 一 step = 一聚焦想法 |
| 5 | 隐藏的边角控件 | 进度条 / 翻页器默认 opacity 0 |
| 6 | 舞台无 chrome | 没有 header / footer / 页码 / 品牌条 |
| 7 | **内容驱动动画** | 先找内在动作，找不到才入场动画兜底；持续微动慎用 |
| 8 | 多点逐个揭示 | 1 项 = 1 step，禁同步 stagger 上 N 项 |
| 9 | 整片同一主题 | 章节间不翻表面色；**颜色 / 字体走 token**，其它尺度章节自由 |
| 10 | 双源原则 | script 定节拍，**article 定画面密度**（落到信息池） |

> 📄 **论文输入**：在十条原则之上再叠两层 ——
> **① 概念解释层**（[`PAPER-INTERPRETATION.md`](references/PAPER-INTERPRETATION.md) §2.5）：
> 叙事骨架照抄论文，但每个概念 / 原理 / 推理都要由讲者引入外部通识、
> 按「锚 → 桥 → 术语 → 验算」四拍重新讲透。**把解释压成断言是论文视频
> 最高频的翻车。**
> **② 认识论纪律**（§3 证据层）：论文事实 / 实验支持 / 解读推断 / 背景知识
> 分开标。先读 [`references/PAPER-INTERPRETATION.md`](references/PAPER-INTERPRETATION.md)。

---

## 常见用户反馈速查

简化表见 [`references/CHAPTER-CRAFT.md`](references/CHAPTER-CRAFT.md)
Part 8「常见反馈速查」。**关键**：先定位是哪一层（节奏 / 视觉 / 内容
/ 代码），再改最小切片，**不要重做整章**。

---

## 相关资源

按"何时读"标注，避免一次性全读：

| 文件 | 何时读 | 内容 |
|---|---|---|
| [`references/SCRIPT-STYLE.md`](references/SCRIPT-STYLE.md) | Phase 1.2 必读 | 文章 → 口播稿规则、平台变体 |
| [`references/OUTLINE-FORMAT.md`](references/OUTLINE-FORMAT.md) | Phase 1.2 必读 | outline.md 字段 spec、命名约定、章节切分、信息池 |
| [`references/CHAPTER-CRAFT.md`](references/CHAPTER-CRAFT.md) | **Phase 2.4 每章单一必读入口** | Part 0 十条原则 / ★ 静态布局阶段 / Part 1 开工 5 问 / Part 2 关系→动作决策树 / Part 3 视觉工具箱 / Part 4 时长 / Part 5 反 AI 味反模式 / Part 6 代码硬规则 / Part 7 完工自检 / Part 8 反馈速查 |
| [`references/VISUAL-DIRECTION.md`](references/VISUAL-DIRECTION.md) | **Phase 2.4 ★ 静态布局阶段** | 8 个构图（centered-hero / asymmetric-60-40 / split-screen / rule-of-thirds / full-width-strip / layered-depth / triptych / diagram-canvas）+ 视觉角色 / 英雄帧契约 / 密度 tokens / 反 AI 味完整清单 |
| [`references/MOTION-BLUEPRINTS.md`](references/MOTION-BLUEPRINTS.md) | **Phase 2.4 选动画节拍** | 论文 / 教学常用 10 种蓝图（process-build / compare-reveal / ablation-remove / formula-assemble / data-countup / focus-drilldown / failure-inspect / token-transform / evidence-stack / boundary-contract） |
| [`references/VISUAL-QA.md`](references/VISUAL-QA.md) | **Phase 2.4 完工自检** | 三层检查：`npm run layout:check` 静态检查 + **`npm run build` / `npm run smoke` 运行检查（§2.5）** + `?layout=1` overlay 人工检查 + 修复 catalog |
| [`references/PAPER-INTERPRETATION.md`](references/PAPER-INTERPRETATION.md) | **论文输入时必读**（叠加在 SKILL + CHAPTER-CRAFT 之上） | paper-digest（含**前置知识台账**）/ 论文类型叙事弧 / **§2.5 概念解释层（骨架照抄论文·血肉自己长，四拍 + 断言测试）** / 证据层（事实·证据·推断·背景）/ 内容→动画→布局 map / 公式（KaTeX `--math`）/ 图表复用 / 论文级验收 |
| [`references/EXAMPLES/`](references/EXAMPLES/) | **可选** —— 看结构 | 章节结构示意（hook / list-reveal / case-tech-review / **paper-*** 4 个论文 anchor）；**不是抄袭模板** |
| [`references/THEMES.md`](references/THEMES.md) | 选 / 造 / 切主题时 | 完整 token 契约 + 内置主题清单 + 创作流程 |
| [`references/AUDIO.md`](references/AUDIO.md) | Phase 3 才读 | provider-agnostic 音频合成流程、内置 minimax / voxcpm 用法、换 provider 路径、故障排查 |
| [`references/voices/`](references/voices/) | 用 voxcpm 克隆声音时 | 自带 Sam 克隆样本 + 加自己声音的流程（克隆心智模型） |
| [`templates/scripts/tts-providers/README.md`](templates/scripts/tts-providers/README.md) | 换 / 加 TTS provider 时 | 三函数契约 + 内置 3 个 (minimax / openai / voxcpm) + 5 种现成代码片段（ElevenLabs / edge-tts / macOS say / Azure / Google） |
| [`references/RECORDING.md`](references/RECORDING.md) | Phase 4 才读 | 录屏工具 + 后期合成 + **无头录制管线**（没有桌面时用 `video:record` / `video:mux` 出 mp4） |
| [`themes/`](themes) | Checkpoint Plan / Phase 1.2 时翻 | 内置主题（每个含 `theme.json` + `tokens.css`） |
| [`scripts/scaffold.sh`](scripts/scaffold.sh) | Phase 2.1 跑一次 | 一键项目脚手架 |
