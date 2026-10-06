# 音频合成

把每个章节 `narrations.ts` 里的口播文字按 **step 颗粒度**合成 mp3，
落到 `presentation/public/audio/<chapter-id>/<step-N>.mp3`。运行时
Auto 模式会自动按 step 播放并自动推进——录屏可以一镜到底。

> **真相源**：每个章节的 `src/chapters/<NN>-<id>/narrations.ts` 是 step
> 数 + 口播文本的**唯一来源**。`outline.md` 不再参与音频合成，章节代码
> 也不再手写 `totalSteps`。这一改根除了"网页 step 和音频文件数对不上"
> 这个老问题。

合成器是 **provider-agnostic** 的：runner 本身不绑定任何 TTS 后端，每个
后端是 `scripts/tts-providers/<name>.sh` 一个文件。**内置 3 个 provider**：

| Provider | 默认 | 何时用 |
|---|---|---|
| `voxcpm`  | ✓ | **默认 / 本地离线声音克隆**；复刻任意音色。**首次必须先跑 `scripts/voxcpm/voxcpm-setup.sh`**（装 voxcpm + 下模型） |
| `minimax` | —— | 中文音色最稳，但要 MiniMax API key（用 `mmx-cli`）。显式 `PRESENTATION_TTS=minimax` 启用 |
| `openai`  | —— | 多数 agent 已有 `OPENAI_API_KEY`；curl-based、响应快 |

换 / 加 provider 见
[`scripts/tts-providers/README.md`](../templates/scripts/tts-providers/README.md)
（脚手架跑完后路径是 `presentation/scripts/tts-providers/README.md`）。
README 里还附了 5 套**可粘贴**的现成片段（ElevenLabs / edge-tts / macOS say /
Azure / Google Cloud）和写自定义 provider 的三函数契约。

---

## 文件命名约定

```
presentation/public/audio/
├── coldopen/
│   ├── 1.mp3
│   ├── 2.mp3
│   └── ...
├── hook/
│   └── ...
└── ...
```

- 章节子目录名 = `chapters.ts` 里的 `id`
- 文件名 = `<step-N>.mp3`（**1-indexed**，对齐 narrations 数组的 index + 1）
- 格式默认 mp3。如果你写的 provider 只能出 wav，在函数里加一步 `ffmpeg`
  转 mp3（参见 `tts-providers/README.md` 的 `say.sh` 示例）

---

## 标准流程

### 1. 抽取 segments

```bash
cd presentation
npm run extract-narrations
```

这会扫所有章节的 `narrations.ts`，按 `chapters.ts` 注册顺序生成
`audio-segments.json`：

```json
[
  { "chapter": "coldopen", "step": 1, "text": "...", "audio": "coldopen/1.mp3" },
  { "chapter": "coldopen", "step": 2, "text": "...", "audio": "coldopen/2.mp3" },
  ...
]
```

让用户**先扫一眼这个 json**，确认文本和切分都对，再开始烧 token 合成。

> 空字符串的 narration 会被自动跳过（不烧 TTS token）——运行时 Auto 模式
> 按字数估时撑过这种"无声过场"step。

### 2. 选 provider

```bash
ls scripts/tts-providers/    # 看本项目带了哪些
```

- 用默认 `voxcpm`（本地离线 / 克隆某个人的声音） → 走 [2.A](#2a-用默认-voxcpm-克隆声音合成)
- 用内置 `minimax`（中文音色更稳，要 MiniMax key） → 走 [2.B](#2b-用内置-minimax-合成)
- 用内置 `openai` → 走 [2.C](#2c-用内置-openai-合成)
- 想用别的 TTS / 自带 TTS → 走 [2.D](#2d-换-provider--加自定义-provider)
- 一个都没装好 → 走 [2.E](#2e-退化路径)

#### 2.A 用默认 voxcpm 克隆声音合成

VoxCPM2 = 本地、离线、可克隆任意音色的 TTS（2B，48kHz，30 语言），是本 skill 的
**默认 provider**（`synthesize-audio.sh` 里 `PRESENTATION_TTS` 缺省即 `voxcpm`）。
模型 4.6G 不打包，但 setup 脚本会自动找/装/下。模型加载要 ~9s，provider 会拉起
**常驻 server**（模型只加载一次），之后每段合成转发给它。

```bash
bash scripts/voxcpm/voxcpm-setup.sh   # 首次必跑：自动找/装 python+voxcpm、找/下模型、写配置（已就绪则秒过）
npm run synthesize-audio              # 默认 voxcpm；用克隆声音念全部 step
npm run synthesize-audio -- --force   # 全部重合成
```

> **`voxcpm-setup.sh` 是硬前置**：`tts_check` 只做校验、**不会**替你跑 setup。
> 没跑过 setup（python 里没有 voxcpm、或找不到模型）就直接合成 = 立刻失败。

setup 会写好 `scripts/voxcpm/voxcpm.env`（python / 模型 / 声音路径），之后就零配置。
只有模型在别处 / 想换音色或解释器时才手动改该文件：`VOXCPM_MODEL_PATH` /
`VOXCPM_VOICE` / `VOXCPM_PYTHON`。换音色见 `references/voices/README.md`。

可选 env：`VOXCPM_PYTHON`（装了 voxcpm 的解释器，conda/venv 全路径）、
`VOXCPM_DEVICE`（默认 `auto`，Mac 走 mps）、`VOXCPM_PORT`（`8765`）、
`VOXCPM_CFG`/`VOXCPM_STEPS`（`2.0`/`10`）。完整说明见
`scripts/tts-providers/README.md` 的 VoxCPM 段。

`--voice=<wav>` 可临时换参考音频（覆盖 `VOXCPM_VOICE`）。想用自己的
声音克隆见 `references/voices/README.md`。

#### 2.B 用内置 minimax 合成

中文音色最稳，但要 MiniMax API key，且**必须显式指定** `PRESENTATION_TTS=minimax`
（默认走的是 voxcpm）：

```bash
PRESENTATION_TTS=minimax npm run synthesize-audio              # 增量：跳过已存在的 mp3
PRESENTATION_TTS=minimax npm run synthesize-audio -- --force   # 全部重合成
PRESENTATION_TTS=minimax npm run synthesize-audio -- --voice=<voice-id>  # 指定音色
```

**非英文旁白记得加 language boost** —— MiniMax 被告知语种之后，发音和语调
明显更稳：

```bash
PRESENTATION_TTS=minimax \
  PRESENTATION_TTS_VOICE="Chinese (Mandarin)_Radio_Host" \
  PRESENTATION_TTS_LANG=Chinese \
  npm run synthesize-audio
```

音色 id 用 `mmx speech voices` 列，中文的长这样：
`Chinese (Mandarin)_Radio_Host` / `_Sincere_Adult` / `_Gentleman` / `_News_Anchor`。
讲解片用 Radio_Host 一类的稳。

启动时 runner 会先调 provider 的 `tts_check`：

- mmx 未安装 → 报 `mmx CLI not found in PATH`，并打印安装说明
- mmx 未登录 → 报 `mmx is not authenticated`，并提示登录命令

修完再跑。每条段打印进度：

```
[  3/24] coldopen/3.mp3   ✓ 4s
[  4/24] coldopen/4.mp3   skip (exists)
```

合成串行（避免 rate limit），**自动跳过已存在文件**（断点续合，不烧
重复 token）。

#### 2.C 用内置 openai 合成

```bash
export OPENAI_API_KEY=sk-...                   # 在 platform.openai.com 拿
PRESENTATION_TTS=openai npm run synthesize-audio
# 换音色 + HD 模型
OPENAI_TTS_MODEL=tts-1-hd PRESENTATION_TTS=openai \
  npm run synthesize-audio -- --voice=nova
```

可选 env：

| 变量 | 默认 | 作用 |
|---|---|---|
| `OPENAI_API_KEY` | —— **必须** | API key |
| `OPENAI_BASE_URL` | `https://api.openai.com/v1` | 切代理 / Azure-OpenAI |
| `OPENAI_TTS_MODEL` | `tts-1` | `tts-1` 快 / `tts-1-hd` 高质量约 2× 价 |
| `--voice=` / `PRESENTATION_TTS_VOICE` | `alloy` | 可选 alloy / echo / fable / onyx / nova / shimmer |

`tts_check` 会检查 curl / jq / `OPENAI_API_KEY` 三件套，缺哪个报哪个。

#### 2.D 换 provider / 加自定义 provider

内置之外的常见后端在 `scripts/tts-providers/README.md` 里有 5 段
**可粘贴**代码片段（ElevenLabs / edge-tts / macOS `say` / Azure / Google
Cloud）。

挑一个 → 复制 README 里的代码块 → 保存为
`scripts/tts-providers/<name>.sh` → 设好环境变量 → 切换 provider 跑：

```bash
PRESENTATION_TTS=elevenlabs npm run synthesize-audio
# 或
npm run synthesize-audio -- --provider=edge-tts
```

如果用户的 TTS 完全自研，**按三函数契约**写一个 `<name>.sh` 即可：

| 函数 | 必需 | 作用 |
|---|---|---|
| `tts_synthesize <text> <out_path> [<voice>]` | ✓ | 把一段文字写成 mp3 到指定路径 |
| `tts_check` | 可选 | 启动时校验环境（CLI / key / auth），未就绪 return 非零 |
| `tts_install_help` | 可选 | `tts_check` 失败时打印怎么修 |

抄 `openai.sh`（HTTP-based）或 `minimax.sh`（CLI-based）起手最快。
详细规范在 `scripts/tts-providers/README.md`。

#### 2.E 退化路径

如果三个内置 provider 都没就绪（voxcpm 没 setup、没装 mmx、也没有 OpenAI key）
告诉用户：

```
我可以：

  1. 用默认 voxcpm 克隆某个人的声音（本地 / 离线，不要 key）
     先跑 bash scripts/voxcpm/voxcpm-setup.sh（自动装 voxcpm + 下 4.6G 模型），
     再 npm run synthesize-audio。详见上面的 2.A

  2. 用内置 openai provider（如果你已有 OpenAI key）
     export OPENAI_API_KEY=sk-...
     PRESENTATION_TTS=openai npm run synthesize-audio

  3. 帮你装 MiniMax CLI（中文音色更稳，要 MiniMax key）
     npm install -g mmx-cli && mmx auth login --api-key sk-xxxxx
     API key 在 https://platform.minimaxi.com 获取
     装好后显式启用：PRESENTATION_TTS=minimax npm run synthesize-audio

  4. 换其它 provider
     scripts/tts-providers/README.md 里有 5 种现成代码片段：
       • ElevenLabs  (要 ELEVENLABS_API_KEY，英文音色最佳)
       • edge-tts    (免费 / 无 key / pip install edge-tts)
       • macOS say   (零依赖离线，质量一般，适合预览)
       • Azure       (要 AZURE_SPEECH_KEY)
       • Google      (要 gcloud auth)
     复制一段保存成 tts-providers/<name>.sh，
     再 PRESENTATION_TTS=<name> npm run synthesize-audio

  5. 暂时跳过
     稿子和 narrations 都在，你自己用任意 TTS 录制即可——文件
     按 audio-segments.json 的 audio 字段命名就行。
```

不要假装合成成功。

---

## 校验时长

合成完后跑：

```bash
npm run audio:report
```

它打每章时长、全片总长、平均每步秒数，并单独列出两类异常：

> ⚠️ **合成之前的 4 字/秒只是规划用的估算，实际 TTS 明显更快。** 实测
> MiniMax 中文约 **5.4 字/秒**，也就是同一份稿子的真实成片比估算短约四分之一
> （9,474 字：估 39 分半，实际 29 分半）。这不只是数字好看不好看的问题 ——
> **动画时长预算是照口播时长定的**，你按 4 字/秒给某一步排了 12 秒的动画，
> 真实音频只有 9 秒，Auto 模式会当场切走，动画演一半就跳下一步。
>
> 所以：**合成完必须拿真实时长再核一遍动画预算**，重点看
> `audio:report` 里最短的那几步（尤其 < 4s 的），确认它们的
> 最长 `animation-delay + duration` 还在音频长度之内。

- **偏长（> 26s）** —— 一屏挂太久。要么拆 step，要么确认画面在这一步**内部**
  确实还在生长（分句点亮 / 逐项落位 / 数字滚动），不是静止 26 秒。
- **偏短（< 3s）** —— 文案太薄，撑不起一整屏。例外：论文模式的开场招呼
  （「大家好！」）本来就该 ≤1.5s，那条可以无视。

把总时长和异常项汇总告诉用户，让他决定**改稿子重合**还是**回章节代码拆
step**。（这条以前是一段 shell 循环 —— 每跑一次就是一次权限确认，所以沉淀
成了具名脚本，见 SKILL.md「验证通道」。）

> 想要一条连续的旁白音频（播客剪辑 / 丢进剪辑软件）：`npm run audio:track`
> → `render/narration.mp3` + `render/chapters.txt`。
> **但它不适合跟录屏对轨** —— 它假设每步零加载开销，跨上百步会漂。录屏对
> 齐走 `npm run video:mux`，见 [`RECORDING.md`](RECORDING.md)。

---

## 运行时如何使用合成的音频

合成完成后，**不需要任何额外配置**——脚手架的 `App.tsx` 已经接好：

| 模式 | 触发方式 | 行为 |
|---|---|---|
| **Manual**（默认） | 直接打开页面 | 不播音频，点击 / 方向键推进 |
| **Audio**（半自动） | URL `?audio=1` 或按 `M` 键 | 进入 step 自动播音频，但你手动推进（点鼠标） |
| **Auto**（全自动） | URL `?auto=1` 或按两次 `M` 键 | 进入 step 播音频 → 播完自动 next() → 进下个 step → ...；**点画面 = 暂停 / 再点 = 继续** |

Auto 模式首次需要按一次 `Space` 启动（绕过浏览器自动播放限制），之后
全自动跑。**录屏时打开屏幕录制 → 按 Space → 整片自动跑完 → stop**。

> **点击在三种模式下的含义不同**：Manual / Audio 里"谁推进"是你，点画面
> = 下一步；Auto 里推进的是页面本身，点画面 = 按住不动（再点继续）——
> 在音频还在播的时候点一下就跳走，只会把自己的旁白切断。暂停期间音频停在
> 原处、自动推进的倒计时也冻住，继续时从断点接着播（不是重头播）。
> 暂停是一个独立状态，不是第四种模式：`mode` 仍是 auto、URL 仍是 `?auto=1`，
> 按 `M` 切模式会顺手清掉暂停。方向键在任何模式下都推进，所以**暂停后可以
> 用 ←/→ 翻着看**，翻到的新 step 会保持暂停、音频停在 0，点一下才开始播。

> **倍速**：右上角悬浮面板里选 1× / 1.25× / 1.5× / 2×，或 `>`/`.` 加速、`<`/`,`
> 减速、`0` 复位；URL `?rate=1.5` 可直接指定，最后一次选择记在 localStorage。
> 只在 Audio / Auto 下生效（改 `audio.playbackRate`，保持音高）；切倍速不会重播
> 当前段，Auto 的字数估时兜底和规格章的 `--sc-step-dur` 同比缩短。
> **录成片一律 1×**——`record-auto.mjs` 起的是全新浏览器，不带 `?rate=` 就是 1×。

> **Auto 模式的推进规则就一句话**：每段音频播完 + 200ms 缓冲 → 自动 next。
> **没有"等动画跑完"的兜底**——如果你写的视觉动画比口播长，会被当场切。
> 解决办法：写更长口播 / 拆 step / 调动画速度（详见
> [`CHAPTER-CRAFT.md`](CHAPTER-CRAFT.md) 「代码层最小约束」）。
>
> 音频文件缺失（还没合成 / 404）或 narration 是空串 → 退化到字数估时
> （`max(1500ms, 字数 × 250ms)`），保证预览也能整片跑通。

---

## 故障排查

通用：

| 现象 | 原因 / 修法 |
|---|---|
| `chapter id "X" registered but no matching folder found` | 章节文件夹应命名为 `NN-<id>`；id 必须等于 chapters.ts 里注册的 |
| `narrations.ts in X must export an array named "narrations"` | 该章节的 narrations.ts 没 export 名为 narrations 的数组 |
| `TTS provider 'X' not found` | `scripts/tts-providers/X.sh` 不存在；列出来看哪些可用，或抄 README 加一个 |
| `provider 'X' does not define tts_synthesize` | 你的 `<X>.sh` 没定义必需的函数。看 README 的契约部分 |
| 中间断了几条没合成 | `npm run synthesize-audio` 重跑 —— 已存在文件会跳过 |
| 浏览器没播音频 | Auto / Audio 模式下首次需要用户手势——确认你按了 SPACE 启动 Auto，或者点过页面 |
| 音频 404 但 Auto 模式还能跑 | 找不到 mp3 时 useAudioPlayer 退化到字数估时（4 字/秒），保证预览不中断 |

minimax 专属：

| 现象 | 原因 / 修法 |
|---|---|
| `mmx: command not found` | `npm install -g mmx-cli`；npm 全局 bin 不在 PATH 时 `npm config get prefix` 看一下 |
| `mmx is not authenticated` | `mmx auth login --api-key sk-xxxxx` 重新登录 |
| 中文音色不自然 | mmx 默认音色未必最佳；查 `mmx speech --help` 看 `--voice` 可选项，传 `--voice=<id>` |
| 整段合成被截断 | 单段过长（mmx 默认上限约 5000 字符）。在 narrations.ts 里把这条拆成两条（也意味着该 step 应该拆成两个 step） |

openai 专属：

| 现象 | 原因 / 修法 |
|---|---|
| `OPENAI_API_KEY is not set` | `export OPENAI_API_KEY=sk-...`，或者把它加到 shell rc / `.env` |
| 全部段 FAILED + key 是对的 | 多半 model / voice 名字错。`--voice=alloy` 试默认值；`OPENAI_TTS_MODEL=tts-1` 试默认模型；用 `bash -x scripts/synthesize-audio.sh` 看请求体 |
| 走代理 / 走 Azure-OpenAI | `export OPENAI_BASE_URL=https://your-proxy/v1` |
| HD 太慢 | 改成 `OPENAI_TTS_MODEL=tts-1`（默认）；HD 大约慢 2 倍 |
| 中文音色不像真人 | OpenAI 6 种音色都是英语偏向；中文角色用 `minimax` 更合适 |

voxcpm 专属：

| 现象 | 原因 / 修法 |
|---|---|
| `✗ voxcpm not importable by <python>` | 先跑 `bash scripts/voxcpm/voxcpm-setup.sh`；或 `pip install voxcpm soundfile`，再用装好的环境设 `VOXCPM_PYTHON=/path/to/python` |
| `✗ Couldn't auto-find the VoxCPM2 model.` | 三个自动探测位置（`./pretrained_models/VoxCPM2`、`~/.cache/huggingface/hub/VoxCPM2`、`~/pretrained_models/VoxCPM2`）都没命中。跑 setup 脚本下模型，或把 `VOXCPM_MODEL_PATH` 指到含 `model.safetensors` 的目录 |
| `✗ VOXCPM_MODEL_PATH is not a directory: <path>` | 路径写错 / 模型被挪走；重设为本地 VoxCPM2 目录（4.6G） |
| `⚠ VOXCPM_VOICE not set` | 警告不是错误：没参考音频也能跑（用 `VOXCPM_VOICE_DESIGN`）。要克隆音色就设 `VOXCPM_VOICE=<wav>` 或传 `--voice=<wav>` |
| `VoxCPM server did not come up` | 看 `/tmp/voxcpm_server.log`；多为模型路径错或内存不足。MPS 上 dtype 自动降到 float32，长文本吃内存 |
| `voxcpm server request failed` | server 崩了；`lsof -ti:8765 \| xargs kill` 后重跑（会自动重启） |
| 克隆音色不像 | 参考音频太短 / 有噪 / 多人；换更干净的 10–30s 单人片段，重设 `VOXCPM_VOICE` |
| 合成很慢 | MPS + float32 本就比 CUDA 慢；长 narration 拆 step；要更快上 CUDA 机器 |

换其它（自定义）provider 之后：

| 现象 | 原因 / 修法 |
|---|---|
| `<X>_API_KEY not set` | 你的 provider 需要 API key，但 env 里没设。`export <X>_API_KEY=...` 或写到 `.env` 再 `set -a; source .env; set +a` |
| 合成的 mp3 浏览器播不了 | 检查 provider 是否真的出了 mp3（不是 wav / opus / aac）。`file public/audio/*/*.mp3` 看 magic header |
| 一切看起来都对，但全部 FAILED | `bash -x scripts/synthesize-audio.sh` 看每段实际调了什么 |

---

## 相关链接

- Provider 契约 + 现成片段：[`scripts/tts-providers/README.md`](../templates/scripts/tts-providers/README.md)
- mmx-cli 仓库：<https://github.com/MiniMax-AI/cli>
- mmx 官方文档：<https://platform.minimaxi.com/docs/token-plan/minimax-cli>
- mmx 参数 / 音色查询：`mmx speech --help`
