# 录制与后期合成

网页做完 + 音频合成完之后，**Auto 模式 + 屏幕录制可以一镜到底**——
不需要手动点击推进 step、也不需要后期对音频。

选哪条路：

| 你在哪 | 走哪条 |
|---|---|
| 有桌面（本机 / 远程桌面） | **Auto 模式 + 录屏软件**（下一节），最省事 |
| **没有桌面**（服务器 / 容器 / agent 环境） | **无头录制管线**（§ 无头录制），两条命令出 mp4 |
| 没合成音频 | 手动点击 + 后期配（文末） |

---

## 推荐流程：Auto 模式一镜到底

### 前置

- 章节代码做完，每章都有 `narrations.ts`
- 已经跑过 `npm run extract-narrations` + `npm run synthesize-audio`，
  `public/audio/<id>/<step>.mp3` 全部就位
- `npm run dev` 跑着，浏览器能打开页面

### 录制步骤

1. **浏览器全屏**（F11 / Ctrl+Cmd+F），URL 改成
   `http://localhost:5173/?auto=1`
2. 看到 "Press SPACE to start" 蒙层 = Auto 模式就绪
3. **打开屏幕录制**（QuickTime / OBS / Cmd+Shift+5），开始录
4. **按一次 Space**（或直接点蒙层）→ 蒙层消失 → step 0 出现，1.mp3 自动播 →
   播完自动推进到 step 1 → 2.mp3 → … → 最后一个 step 播完 → 停在终态
5. **停止录制** → 后期裁掉头尾（Space 那一下、最后停在终态的尾巴）就是
   成品

> ⚠️ **第 0 步会不会被吃掉**：`useStepper` 把空格也绑成了「下一步」，所以
> 启动蒙层的那一次空格历史上会连带推进一步，**第 1 章第 0 步永远录不到**，
> 而且不报错。`AutoStartGate` 现在用 capture 阶段监听吞掉了这一次按键，
> 用旧脚手架生成的项目请对照回补，或者干脆**点蒙层**启动（它带
> `data-no-advance`，点击不会漏给 stepper）。录完先看第一帧对不对。

整个过程**完全不用点鼠标**。音视频天然同步，不需要后期对轨。

> **Auto 模式严格按音频结束推进**（+ 200ms 缓冲），没有"等动画跑完"
> 的兜底。如果你看到某步动画被切了一半 → 说明该 step 动画长于口播，
> 回章节代码改：写更长口播 / 拆 step / 调动画速度。

### 录屏工具

| 平台 | 工具 | 设置 |
|---|---|---|
| macOS | Cmd+Shift+5 → 录制选定窗口 | 选浏览器窗口；浏览器全屏后输出就是 1920×1080 |
| macOS | QuickTime → 文件 → 新建屏幕录制 | 同上 |
| 跨平台 | OBS Studio | 窗口捕获，Canvas 1920×1080，60fps |

### 模式速查

| URL / 快捷键 | 行为 |
|---|---|
| 直接打开（默认） | Manual：点击 / ←→ 推进，不播音频 |
| `?audio=1` 或按 `M` | Audio：进入 step 自动播音频，但**手动点鼠标推进** |
| `?audio=1` + 再按 `M` | Auto：进入 step 自动播 + 自动推进（录制用） |
| Auto 模式下首次按 `Space` | 启动 Auto 播放（绕过浏览器自动播放限制） |

也可以鼠标移到右上角，会出现一个隐藏的模式切换按钮。

---

## 无头录制：没有桌面也能出 mp4

服务器 / 容器 / agent 环境里没有屏幕录制软件可用。脚手架带了两条命令，
驱动 Playwright 把 `?auto=1` 从头播到尾，再把旁白贴回去：

```bash
# 前置：dev server 跑着 + public/audio/ 里音频齐了
npm run video:record -- --url=http://localhost:5173/   # → render/raw.webm + cues.json
npm run video:mux                                       # → render/<项目>.mp4
```

**先冒烟测**，别拿 20 分钟去试错：

```bash
npm run video:record -- --max-steps=6 && npm run video:mux
```

需要 `ffmpeg` + Playwright（项目依赖或全局 `@playwright/cli` 都行，
脚本会自己找）。

### 它替你解决的三件事

1. **录制分辨率**。`playwright-cli video-start` 固定录 800×492，没有尺寸
   参数，做不了成片。这里直接建 context，视口默认 2080×1280 —— 这个数是
   算出来的：`useStageScale` 留 80/100 边距，2080×1280 正好让 1920×1080 的
   舞台以 scale 1.0 渲染，裁切时像素级精确、不重采样。脚本还会**实测
   `.stage-frame` 的实际矩形**写进 cues.json，所以主题改了边距也不会裁错。

2. **音画同步**。Auto 模式按 `audio.ended` 推进，每步都带一点加载开销；
   一条按「音频时长 + trail」拼出来的固定音轨，跨上百步会累计漂移
   （实测 107 步漂了约 16 秒）。所以录制时在页面里以 25ms 轮询记录**每一次
   step 切换的真实时间戳**，出片时把每段 mp3 摆到它自己的时间戳上、空隙补
   静音。跟这条相比，`npm run audio:track` 拼的那条音轨只适合当独立音频用，
   不要拿去跟录屏对。

3. **片头片尾**。视频开头有加载页 + 启动蒙层，结尾有一段静帧。片头的切点
   靠**帧检测**定位：蒙层是暗的、正片是瓷白的，用 `signalstats` 找亮度跳变
   那一帧，比 wall-clock 估计准（实测差 0.5 秒 —— 半秒的口型不同步是看得
   出来的）。片尾按最后一段旁白结束 + 1.5 秒收。

### 产物

| 文件 | 是什么 |
|---|---|
| `render/<项目>.mp4` | 成片，1920×1080 H.264 + AAC |
| `render/chapters.txt` | 章节时间戳，直接贴视频简介做跳转 |
| `render/raw.webm` | 原始录制（~100MB / 25 分钟）。留着，改对齐参数只需重跑 `video:mux` |
| `render/cues.json` | 每步边界 + 裁切矩形 |
| `render/narration-aligned.mp3` | 对齐后的纯音轨 |

`render/` 已在脚手架的 `.gitignore` 里。

### 排查

| 症状 | 原因 |
|---|---|
| `只走到 N 步` | 某步的 mp3 缺了或解不了码 → `npm run audio:report` 看缺哪个 |
| `起播帧没检出` | 主题是暗色的，蒙层跟正片亮度差不够 → 退回 wall-clock 估计，误差约 0.5s；要精确就手动量一次 `raw.webm` |
| `找不到 playwright` | `npm i -D playwright && npx playwright install chromium` |
| 成片带缩放 | 舞台没按 1:1 渲染，脚本已经提示了要调多大视口 |

---

## 备用流程：没合成音频时手动录屏

如果你跳过了音频合成（`Checkpoint Audio` 选了"不合成"），按老方法：

1. 浏览器全屏 → 打开 `localhost:5173`（默认 Manual 模式）
2. **刷新一次**清空历史 step
3. 开始录屏 → 按口播节奏点击空白推进 step
4. 后期用任何剪辑软件配音 + 调时间线

### 后期工具

| 工具 | 适合 |
|---|---|
| **DaVinci Resolve** | 跨平台免费、能处理多段音频拼接 |
| **iMovie** | macOS 简单场景 |
| **CapCut / 剪映** | B 站 / 抖音风加字幕 |

---

> agent 在 Checkpoint Audio 后**主动告诉用户**上面 Auto 模式录屏的
> 路径，让用户知道下一步怎么把网页变成 mp4。
