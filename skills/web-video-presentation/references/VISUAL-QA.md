# 视觉 QA（Visual Quality Assurance）

每章完工前、合成音频前、录屏前的**视觉检查机制**。三层：

1. **结构检查（机器·静态）** —— `npm run layout:check` 跑 `inspect-layout.mjs`，
   在源码层发现常见翻车（缺 `data-composition`、字号太小、长标题
   无 max-width、相邻 step 重复构图、字号超过安全密度等）
2. **运行检查（机器·真浏览器）** —— `npm run build` + `npm run smoke`，
   确认**应用真的能跑、每一步真的画出了东西**（§2.5）
3. **人工检查** —— 开 `?layout=1` debug overlay，逐 step 静态走一遍
   英雄帧，截图存档

三层缺一不可。**第 2 层不是冗余** —— 第 1 层从不加载页面，第 3 层要人眼，
中间那道「应用是不是白屏」的缺口只有它能堵（§2.5 有事故经过）。

> 三条一次跑完：`npm run verify`

---

## 1. 什么时候跑 QA

| 阶段 | 跑什么 |
|---|---|
| 章节实现完成 | `npm run verify`（= layout:check + build + smoke） + `?layout=1` 走一遍（人工） |
| 并行 fan-out 收口后 | **`npm run verify` 必跑**，且逐章确认文件齐全 —— 不信 subagent 的 self-report（SKILL.md §2.3） |
| 所有章节完成，进 Checkpoint Audio | 全章走一遍 `?layout=1` + 截 contact sheet |
| 音频合成完成，录屏前 | 复跑一次 `npm run verify`（防止合成脚本改动章节 CSS） |
| 录屏前 5 分钟 | 抽查 3~5 个 step 的 `?layout=1` 截图，确认无变化 |

---

## 2. `npm run layout:check` —— 机器检查

由 `inspect-layout.mjs` 执行。**纯 Node 静态分析，不依赖 puppeteer /
playwright**（保持零依赖、易集成）。覆盖以下检查：

### 2.1 必查项（fail = 阻止后续流程）

- **`narrations.ts` / `evidence.ts` 里不能有"中途断掉的字符串"**
  （rule `broken-string-literal`）—— 中文正文里写 ASCII 直引号，
  `"…所谓的"思维链压力"…"` 会被读成 字符串·标识符·字符串，
  **整个文件解析失败 → 整站白屏，而 HTTP 依然返回 200**。改用全角 `“ ”`
- **每章必须有 `narrations.ts`** 且数组长度与章节 TSX 中最大 `step === N` + 1 一致
  - **不需要为这条规则改写代码**。判定容忍：最后一个 `if` 不带花括号、
    终结 `return` 前面夹了 `const` / 其它语句、`if` 顺序打乱、`else` 分支
    承担最后一步、以及复合条件
    （`if (step === 6 || step === 7)` / `if (step >= 1 && step <= 4)` /
    `if (step === 4 && !collapsed)`）。
    **`return null` 不算一步**（它什么都不渲染，是防御性兜底）
- **每章 TSX 根元素必须有 `data-composition` 属性**，值在 8 个合法
  构图之一（`centered-hero` / `asymmetric-60-40` / `split-screen` /
  `rule-of-thirds` / `full-width-strip` / `layered-depth` / `triptych` /
  `diagram-canvas`）
- **每个 `data-composition` 值在 chapter 内部不能连续重复超过 2 次**
  （3 个连续 step 同构图 = fail）
- **正文 `font-size` 不能小于 `var(--body-min)`**（默认 20px）——
  检查 chapter.css 中的 `font-size: <N>px`，N < 20 = fail
- **长标题必须有 `max-width`**：h1 / h2 / h3 如果 `font-size` ≥ 60px
  且无 `max-width` = fail（标题一行铺满 1920 = 翻车）
- **章节 CSS 不能硬编码颜色 / 字体**：检测 `color: #` / `color: rgb` /
  `font-family: "..."`（不带 var(...)）= fail
- **章节根元素不能 `position: absolute` 作为内容容器**：检测
  `.scene { position: absolute; ... }` 内层继续 `position: absolute`
  且没有 `data-role="background"` = 警告（违反 [`VISUAL-DIRECTION.md`](VISUAL-DIRECTION.md)
  §3.1 的 hero frame 应基于 padding + flex 而非绝对定位）

### 2.2 建议项（warn = 不阻止，但人工复查）

- **中文不要用 ASCII 直引号包**（rule `ascii-quote-in-cjk`）—— `"直引号"`
  改成 `“全角”`。现在能跑，但它离上面那条 fail 只差一次改写。
  （用 ASCII 引号包**英文**短语不报，那是正确排版）
- **每章应该使用至少 3 种不同构图** —— 只用 1~2 种 = warn
- **每个 step 的文本节点数不应过多** —— 同一 scene 内 text 节点 >
  40 = warn（信息密度过高，建议拆分 step 或减装饰文字）
- **每个 chapter CSS 应该消费 density tokens** —— 没找到 `var(--body-min)` /
  `var(--max-text-width)` / `var(--headline-min)` 中的任一个 = warn
  （说明 chapter 写死了 px）
- **`ch` 写在没有 `font-size` 的块上**（rule `ch-width-without-font-size`）——
  `ch` 按元素**自己**的字号算。写在只管布局的外层容器上，它按继承的 16px 算：
  `max-width: 40ch` ≈ 330px，而不是给里面 54px 标题预想的 ~1300px。
  症状是标题每行三五个字、纵向顶出舞台。把 measure 挪到那段文字上，
  容器改 px。
- **定位 transform 被自己的动画覆盖**（rule `transform-clobbered-by-animation`）——
  `transform: translateX(-50%)` 配一个 keyframe 里也写 `transform` 的入场动画，
  keyframe 会**替换**掉居中那一条，元素永久偏移半个自身宽度，挂在它上面的
  连线全部错位。绝对定位用 `left` / `top`，入场只动 `opacity`。

### 2.3 输出格式

**默认只打控制台，不落盘** —— `npm run layout:check` 零副作用，不需要往
`.gitignore` 里加东西。要拿到完整 JSON 报告时**显式加 `--json`**：

```bash
npm run layout:check                       # 默认：只打控制台
npm run layout:check -- --json             # 写到 <project>/layout-check.json
npm run layout:check -- --json report.json # 写到你指定的路径（相对当前目录解析）
```

落盘时的 JSON 结构：

```json
{
  "summary": { "ok": 8, "warn": 2, "fail": 1, "chapters": 4 },
  "chapters": [
    {
      "id": "01-coldopen",
      "checks": [
        { "level": "fail", "rule": "composition-present", "detail": "no data-composition attribute on scene root — see VISUAL-DIRECTION.md §1" },
        { "level": "warn", "rule": "composition-variety", "detail": "chapter uses only 1 unique composition across all steps" }
      ]
    }
  ]
}
```

`fail` 数 > 0 → process.exit(1)，CI 会红。

---

## 2.5 `npm run build` + `npm run smoke` —— 运行检查

### 为什么必须有这一层（真实事故）

某章 `narrations.ts` 的中文里混进了 ASCII 直引号。当时的验证组合是
`layout:check` + `tsc --noEmit`，**两个都是绿的**。但 esbuild 的依赖扫描在
这个解析错误上挂掉 → `react-dom` 没有被预打包 → **每一页都是空白**，而
HTTP 照常 200。排查从"截图全是 8.5KB 空白"一路追到一句引号。

根因不是某个规则漏了，是**整条流水线从来没有真的渲染过页面**：
`layout:check` 是纯文本分析（不加载 DOM），`?layout=1` 要人眼。

### 两道闸，按顺序跑

```bash
npm run build     # tsc -b && vite build —— 不用浏览器，直接指出出问题的文件和行号
npm run smoke     # 真浏览器逐步走一遍，白屏 / 未捕获异常 = 红
```

- **`build` 先跑**：它最便宜，而且解析错误 / 类型错误会带着行号一次报清。
  **别用 `tsc --noEmit` 代替**——真正让页面白屏的是打包那一侧。
- **`smoke` 后跑**：它抓的是 build 抓不到的东西——运行时异常、某一步渲染
  成空场景、console error。

### `npm run smoke` 判什么

| 级别 | 判定 |
|---|---|
| **fail** | 应用没挂载（`#root` 空 / 没有 `.stage-frame`）= 白屏 |
| **fail** | 某一步 `.scene` 里既没有可见文字也没有 svg / canvas / img = 空屏 |
| **fail** | 未捕获异常（pageerror）、console error |
| **warn** | 某步没有可见的 `[data-role="primary"]` |
| **warn** | 子资源加载失败（字体 CDN / 缺图 / 缺音频不计入） |

> **primary 的采样窗口只有 ~220ms。** smoke 进入一步后很快就取样，所以
> `data-role="primary"` 那个元素的**入场 delay 必须 ≤150ms**，否则取样时它
> 还是 `opacity: 0`，报 "没有可见的 primary" —— 这是 warn，不是 bug，但每次
> 都得回去确认一遍。想表达"次要的先来、主角后到"，改成让 secondary 延后，
> 别延后 primary。

失败会把那一步截图写到 `render/smoke/`，直接看图定位。

```bash
npm run smoke                        # 默认 :5173，走全部步骤
npm run smoke -- --max-steps=12      # 边写边测，快速过一遍
npm run smoke -- --chapter=3         # 只测第 4 章（0-indexed）
npm run smoke -- --shots             # 每步都截图，当 contact sheet 用
npm run smoke -- --url=http://localhost:5174/
```

开发服务器没在跑时，它会**自动用 `vite preview` 起 `dist/`**，所以
`npm run verify` 不依赖你另开一个终端。

> ⚠️ **没装 playwright 时 smoke 会跳过并 exit 0**（装：
> `npm i -D playwright && npx playwright install chromium`）。
> **跳过 ≠ 通过** —— 汇报时必须写明「smoke 已跳过，白屏类问题未覆盖」。

---

## 3. `?layout=1` —— 人工检查

打开 URL 时加 `?layout=1`，**所有 step 强制显示静态英雄帧**（禁用
所有 CSS animation / transition / MaskReveal / letter-stagger / 任
何入场动效），并在屏幕上叠加 debug 层：

```
┌──────────────────────────────────────────────────────────────┐
│ ┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓ │
│ ┃  ← safe-area: 80px                                       ┃ │
│ ┃   ┌─────────────────────────────────────────────────────┐ ┃ │
│ ┃   │  ← caption-avoid: 80px bottom reserved              │ ┃ │
│ ┃   │                                                     │ ┃ │
│ ┃   │      [primary]              [secondary]             │ ┃ │
│ ┃   │                                                     │ ┃ │
│ ┃   │   ← rule-of-thirds 1/3 | 2/3 vertical               │ ┃ │
│ ┃   │                                                     │ ┃ │
│ ┃   └─────────────────────────────────────────────────────┘ ┃ │
│ ┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛ │
│                                                              │
│ step 03 · composition=asymmetric-60-40                       │
│ primary: 1240×680 (51%)                                      │
│ secondary: 360×680 (9%)                                      │
│ [L] overlay · [G] grid · [B] bg · [→] next                   │
└──────────────────────────────────────────────────────────────┘
```

### 3.1 Debug overlay 显示什么

- **safe-area 框**（80px 四周）—— 红 / 黄边框，**所有内容应在框内**
- **caption-avoid 区**（底部 80px）—— 黄色半透明，**字幕 / 进度条
  之外的内容不应进入**
- **rule-of-thirds 线**（1/3、2/3 垂直 + 水平）—— 蓝色虚线，**主视
  觉中心应靠近交点**
- **每个元素的 bbox 边框** —— 半透明绿框，**有重叠 = 警告**（`data-role="primary"` /
  `data-role="secondary"` 之间重叠会被标红）
- **左上角读出条**（4 行）——
  1. `step N · composition=<name>`（从 scene 根的 `data-composition` 读）
  2. `primary: <w>×<h> (<pct>%)`
  3. `secondary: <w>×<h> (<pct>%)`
  4. 快捷键提示

  > 读出条**不输出信息密度**（没有 `density=` 字段）—— 密度只由
  > `npm run layout:check` 的文本节点数 warn 覆盖。

### 3.2 键盘快捷键

`LayoutDebug.tsx` 实现了三个键：

- `L` —— toggle 整个 overlay（关掉 = 恢复正常动画播放）
- `G` —— 只保留 grid + safe-area（关掉所有 bbox 描边）
- `B` —— 切换 `data-role="background"` 元素显隐（看背景层是否抢戏）

推进 step 用页面本来的方式（点击 / `→` / `Space`），overlay 不拦截。

> **没有截图快捷键**。`S` 存图（`layout-screenshots/<chapter>/<step>.png`）
> 曾在计划里，但**尚未实现** —— overlay 里没有任何 canvas / 导出代码。
> 需要存图就用系统截图或浏览器 DevTools 的 "Capture node screenshot"。

### 3.3 怎么用 `?layout=1` 做 contact sheet

每章录屏前（**手工截图**，见上面的说明）：

```bash
mkdir -p presentation/layout-screenshots/01-coldopen
# 浏览器开 http://localhost:5174/?layout=1，按 → 走过每步，
# 每步用系统截图 / DevTools "Capture node screenshot" 存到上面的目录，
# 然后用任意拼图工具（macOS 预览 / ffmpeg montage / ImageMagick）拼成网格
```

contact sheet 的好处：

- **一眼能看出哪几步构图重复**
- **一眼能看出哪几步 primary 太弱**
- **一眼能看出哪几步有元素溢出安全区**
- **交付前 / 录屏前最后一次体检**

---

## 4. 常见缺陷 → 修复（Fix Catalog）

每条都是 `inspect-layout.mjs` 报 fail 或 `?layout=1` 截图发现的典型
问题，及修复手段：

### 4.1 字号太小

**症状**：`font-size: 14px` / `16px` / 漏写 font-size
**修复**：替换为 `var(--body-min)`（20px）或 `var(--data-min)`（16px）
后者只允许用于数据标签 / 角标 / 出处 chip
**根因**：agent 按网页标准写字号，没意识到录屏后细节压缩

### 4.2 长标题铺满 1920

**症状**：h1 一行 30+ 字，从左铺到右，没有断行
**修复**：加 `max-width: 24ch ~ 28ch`（中文）/ `max-width: 50ch`（英文）
**根因**：没意识到 hero text 应该"撑住主视觉但留白围绕"

### 4.2b 标题被挤成一条竖带

**症状**：一句话的标题每行只排 3~9 个字，纵向顶出舞台上下边界
**修复**：把外层容器的 `max-width: Nch` 改成 px；`ch` 留给设了 `font-size`
的那个文字元素
**根因**：`ch` 按元素自己的字号算。容器不设 `font-size` 就按继承的 16px 算，
`40ch` ≈ 330px —— 和作者脑子里那个"给 54px 标题的 40 个字"差了四倍。
两个声明单看都合理，所以源码 review 看不出来，只有渲染出来才现形。
`layout:check` 的 `ch-width-without-font-size` 会 warn。

### 4.3 主视觉面积不足

**症状**：primary 元素视觉面积 < 40% 有效画面，secondary 抢戏
**修复**：放大 primary 字号 / 缩短 secondary 文本 / 删掉多余装饰
**根因**：多个元素平权竞争视线，违反 [`VISUAL-DIRECTION.md`](VISUAL-DIRECTION.md)
§2.1 的"一主一辅"

### 4.4 元素溢出 1920×1080

**症状**：右下角 label 顶出右边界 / 长横条挤到数字上
**修复**：横条用 `flex: 1` + `min-width: 0` 而非写死 px / 长 label 加
`max-width` + `white-space: normal`
**根因**：固定宽之和 + gap + nowrap 文字宽 > 1728px

### 4.5 相邻 step 同构图

**症状**：3 个连续 step 都是 `centered-hero`，节奏单调
**修复**：交替使用不同构图（如 `centered-hero` → `asymmetric-60-40`
→ `full-width-strip`）
**根因**：agent 偷懒，没按 [`VISUAL-DIRECTION.md`](VISUAL-DIRECTION.md)
§1.1 的规则主动切换

### 4.6 背景层抢戏

**症状**：网格 / 色场 / 装饰元素的视觉权重接近 primary
**修复**：background 元素 opacity ≤ 0.15 / 用 `--surface-3` / `--text-faint`
/ blur 2~4px
**根因**：违反 [`VISUAL-DIRECTION.md`](VISUAL-DIRECTION.md) §2.2 的
"至少两种层级手段"

### 4.7 缺少英雄帧（入场状态即最终状态）

**症状**：元素入场前是 opacity 0 + translateY(20px)，入场动画结束后
突然变到最终位置 —— 中间帧看起来像 bug
**修复**：先写最终位置（hero frame），再加 entrance 动画 `from { opacity: 0; ... }`
**根因**：违反 [`VISUAL-DIRECTION.md`](VISUAL-DIRECTION.md) §3.1 的铁律

### 4.8 AI 味指纹

**症状**：紫粉渐变 / 圆角彩色边框 / emoji 图标 / glassmorphism
**修复**：参考 [`VISUAL-DIRECTION.md`](VISUAL-DIRECTION.md) §5 清单
逐项过
**根因**：agent 默认模型倾向生成"通用好看"的样式

---

## 5. 与 [`CHAPTER-CRAFT.md`](CHAPTER-CRAFT.md) 自检的关系

CHAPTER-CRAFT.md Part 7 的完工自检是基础门槛（节奏 / 内容 / 反 AI 味
/ 代码红线）。本文件扩展为：

- **结构层**：`npm run layout:check`（机器）
- **视觉层**：`?layout=1` debug overlay（人工）
- **气质层**：CHAPTER-CRAFT.md Part 5 反 AI 味（人工）

**所有三层都过 = 可以向用户汇报"本章完成"**。任一层未过 → 修完
再汇报，不允许"先放着以后改"。

---

## 6. 集成 CI（可选）

`scripts/release/lib/...` 的 CI gate（`npm run validate`）可以追加
`npm run layout:check` —— 但**只在所有章节都已实现**时跑（空脚手
架不应 fail）。具体接法留给仓库维护者按需启用，本文件不强制。
