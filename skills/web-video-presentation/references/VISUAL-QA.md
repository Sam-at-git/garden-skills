# 视觉 QA（Visual Quality Assurance）

每章完工前、合成音频前、录屏前的**视觉检查机制**。两层：

1. **机器检查** —— `npm run layout:check` 跑 `inspect-layout.mjs`，
   在源码层发现常见翻车（缺 `data-composition`、字号太小、长标题
   无 max-width、相邻 step 重复构图、字号超过安全密度等）
2. **人工检查** —— 开 `?layout=1` debug overlay，逐 step 静态走一遍
   英雄帧，截图存档

两层缺一不可 —— 机器检查覆盖结构性问题，人工检查覆盖视觉气质。

---

## 1. 什么时候跑 QA

| 阶段 | 跑什么 |
|---|---|
| 章节实现完成 | `npm run layout:check`（机器） + `?layout=1` 走一遍（人工） |
| 所有章节完成，进 Checkpoint Audio | 全章走一遍 `?layout=1` + 截 contact sheet |
| 音频合成完成，录屏前 | 复跑一次 `npm run layout:check`（防止合成脚本改动章节 CSS） |
| 录屏前 5 分钟 | 抽查 3~5 个 step 的 `?layout=1` 截图，确认无变化 |

---

## 2. `npm run layout:check` —— 机器检查

由 `inspect-layout.mjs` 执行。**纯 Node 静态分析，不依赖 puppeteer /
playwright**（保持零依赖、易集成）。覆盖以下检查：

### 2.1 必查项（fail = 阻止后续流程）

- **每章必须有 `narrations.ts`** 且数组长度与章节 TSX 中最大 `step === N` + 1 一致
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

- **每章应该使用至少 3 种不同构图** —— 只用 1~2 种 = warn
- **每个 step 的文本节点数不应过多** —— 同一 scene 内 text 节点 >
  40 = warn（信息密度过高，建议拆分 step 或减装饰文字）
- **每个 chapter CSS 应该消费 density tokens** —— 没找到 `var(--body-min)` /
  `var(--max-text-width)` / `var(--headline-min)` 中的任一个 = warn
  （说明 chapter 写死了 px）

### 2.3 输出格式

控制台 + `layout-check.json`：

```json
{
  "summary": { "ok": 8, "warn": 2, "fail": 1, "chapters": 4 },
  "chapters": [
    {
      "id": "01-coldopen",
      "checks": [
        { "level": "fail", "rule": "composition-present", "detail": "no data-composition attribute found on root" },
        { "level": "warn", "rule": "composition-variety", "detail": "chapter uses only 1 unique composition across all steps" }
      ]
    }
  ]
}
```

`fail` 数 > 0 → process.exit(1)，CI 会红。

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
│ step 03 · composition=asymmetric-60-40 · density=medium     │
│ primary bbox: 1240×680 (51%) · secondary bbox: 360×680 (9%) │
│ [L] toggle overlay · [→] next step · [G] grid only · [S] save│
└──────────────────────────────────────────────────────────────┘
```

### 3.1 Debug overlay 显示什么

- **safe-area 框**（80px 四周）—— 红 / 黄边框，**所有内容应在框内**
- **caption-avoid 区**（底部 80px）—— 黄色半透明，**字幕 / 进度条
  之外的内容不应进入**
- **rule-of-thirds 线**（1/3、2/3 垂直 + 水平）—— 蓝色虚线，**主视
  觉中心应靠近交点**
- **每个元素的 bbox 边框** —— 半透明绿框，**有重叠 = 警告**
- **顶部信息条** —— `step N · composition=<name> · density=<low|medium|high>`
  · primary bbox size + % · secondary bbox size + %

### 3.2 键盘快捷键

- `L` —— toggle 整个 overlay
- `G` —— 只保留 grid + safe-area（关掉所有 bbox）
- `S` —— 保存当前 step 截图到 `layout-screenshots/<chapter>/<step>.png`
  （用 `html2canvas`-free 的方式：直接 `canvas.toDataURL`）
- `B` —— 切换背景 / 装饰元素显隐（看背景层是否抢戏）
- `→` / `Space` —— 下一个 step（与正常推进一致）

### 3.3 怎么用 `?layout=1` 做 contact sheet

每章录屏前：

```bash
mkdir -p presentation/layout-screenshots/01-coldopen
# 浏览器开 http://localhost:5174/?layout=1，按 → 走过每步，每步按 S 截图
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
