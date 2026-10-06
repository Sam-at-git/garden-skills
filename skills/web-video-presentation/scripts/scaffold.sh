#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────
# scaffold.sh —— 一键脚手架，创建一个 video-presentation 项目。
#
# 用法：
#   bash scripts/scaffold.sh <target-dir> [--theme=<id>] [--math]
#   bash scripts/scaffold.sh --list-themes
#
# 例子：
#   bash <path-to-web-video-presentation>/scripts/scaffold.sh ./presentation
#   bash <path-to-web-video-presentation>/scripts/scaffold.sh ./talk --theme=paper-press
#   bash <path-to-web-video-presentation>/scripts/scaffold.sh ./paper-talk --theme=tufte-ink --math
#   bash <path-to-web-video-presentation>/scripts/scaffold.sh --list-themes
#
# --math：可选。注入 KaTeX + <Math>/<Formula> 组件 + math.css，用于论文模式
#         的公式揭示（见 references/PAPER-INTERPRETATION.md §7）。不传时脚手架
#         与不传完全一致。
#
# 跑完后，看 SKILL.md "Phase 2.4 实现单章" + references/CHAPTER-CRAFT.md
# 了解每章怎么写。卡壳时翻 references/EXAMPLES/ 找完整章节 anchor。
#
# 之后切换主题，覆盖一个文件即可：
#   cp <path-to-web-video-presentation>/themes/<id>/tokens.css \
#      <project>/src/styles/tokens.css
# ─────────────────────────────────────────────────────────────
set -euo pipefail

SKILL_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TEMPLATES="$SKILL_DIR/templates"
THEMES_DIR="$SKILL_DIR/themes"
DEFAULT_THEME="midnight-press"

list_themes() {
  echo "可用主题（来自 ${THEMES_DIR}）:"
  echo
  for dir in "$THEMES_DIR"/*/; do
    [[ -d "$dir" ]] || continue
    local meta="$dir/theme.json"
    [[ -f "$meta" ]] || continue
    # 没有 jq，简单 grep + sed 提字段
    local id name desc
    id=$(grep -E '"id"' "$meta" | head -n1 | sed -E 's/.*"id":[[:space:]]*"([^"]+)".*/\1/')
    name=$(grep -E '"nameZh"' "$meta" | head -n1 | sed -E 's/.*"nameZh":[[:space:]]*"([^"]+)".*/\1/')
    desc=$(grep -E '"descriptionZh"' "$meta" | head -n1 | sed -E 's/.*"descriptionZh":[[:space:]]*"([^"]+)".*/\1/')
    printf "  • %-18s %s\n      %s\n\n" "$id" "$name" "$desc"
  done
  echo "用 --theme=<id> 选定一个。默认：${DEFAULT_THEME}。"
}

# ── 解析参数 ──
TARGET=""
THEME="$DEFAULT_THEME"
MATH=0
for arg in "$@"; do
  case "$arg" in
    --list-themes)
      list_themes
      exit 0
      ;;
    --theme=*)
      THEME="${arg#--theme=}"
      ;;
    --math)
      MATH=1
      ;;
    --*)
      echo "✗ 未知参数: $arg" >&2
      exit 1
      ;;
    *)
      if [[ -z "$TARGET" ]]; then TARGET="$arg"; fi
      ;;
  esac
done

TARGET="${TARGET:-presentation}"
THEME_DIR="$THEMES_DIR/$THEME"
THEME_TOKENS="$THEME_DIR/tokens.css"

if [[ ! -d "$THEME_DIR" || ! -f "$THEME_TOKENS" ]]; then
  echo "✗ 找不到主题 '${THEME}'。可用主题：" >&2
  echo >&2
  for dir in "$THEMES_DIR"/*/; do
    [[ -d "$dir" ]] || continue
    echo "    • $(basename "$dir")" >&2
  done
  exit 1
fi

if [[ -d "$TARGET" && -n "$(ls -A "$TARGET" 2>/dev/null || true)" ]]; then
  echo "✗ 目标目录 '${TARGET}' 已存在且非空，已中止。" >&2
  exit 1
fi

if ! command -v npm >/dev/null; then
  echo "✗ 需要 npm，但在 PATH 里没找到。" >&2
  exit 1
fi

echo "▸ 在 $TARGET 创建 Vite + React + TS 项目"
echo "▸ 使用主题：$THEME"
npm create vite@latest "$TARGET" -- --template react-ts >/dev/null

cd "$TARGET"
echo "▸ 安装依赖（可能要等一会）..."
npm install >/dev/null 2>&1

echo "▸ 安装 tsx（用于 extract-narrations 脚本）..."
npm install --save-dev tsx >/dev/null 2>&1

echo "▸ 用演示骨架替换默认 boilerplate"

# 干掉我们不要的 Vite 默认 boilerplate
rm -f \
  src/App.tsx src/App.css \
  src/main.tsx src/index.css \
  src/assets/react.svg \
  public/vite.svg \
  public/icons.svg \
  README.md
rmdir src/assets 2>/dev/null || true

# 把脚手架文件拷到项目根
mkdir -p \
  src/styles src/hooks src/components src/registry \
  src/chapters/01-example \
  public scripts

cp "$TEMPLATES/vite.config.ts" .
cp "$TEMPLATES/index.html" .

cp "$TEMPLATES/src/main.tsx" src/main.tsx
cp "$TEMPLATES/src/App.tsx"  src/App.tsx

# tokens.css 来自所选主题
cp "$THEME_TOKENS"                          src/styles/tokens.css
cp "$TEMPLATES/src/styles/base.css"         src/styles/base.css
cp "$TEMPLATES/src/styles/composition.css"  src/styles/composition.css
cp "$TEMPLATES/src/styles/evidence.css"     src/styles/evidence.css
cp "$TEMPLATES/src/styles/paper-figure.css" src/styles/paper-figure.css
cp "$TEMPLATES/src/styles/figure-lens.css"  src/styles/figure-lens.css
cp "$TEMPLATES/src/styles/animations.css"   src/styles/animations.css
cp "$TEMPLATES/src/styles/fonts.css"        src/styles/fonts.css
# 场景组件层（components/scene/* + scene.css）—— App.tsx 引用了它，漏拷会让 build 直接挂
cp "$TEMPLATES/src/styles/scene.css"        src/styles/scene.css
cp "$TEMPLATES/src/styles/end-credits.css"  src/styles/end-credits.css
mkdir -p src/components/scene
cp "$TEMPLATES/src/components/scene/"*      src/components/scene/

cp "$TEMPLATES/src/hooks/useStageScale.ts"   src/hooks/useStageScale.ts
cp "$TEMPLATES/src/hooks/useStepper.ts"      src/hooks/useStepper.ts
cp "$TEMPLATES/src/hooks/useAudioPlayer.ts"  src/hooks/useAudioPlayer.ts
cp "$TEMPLATES/src/hooks/useAutoMode.ts"     src/hooks/useAutoMode.ts
cp "$TEMPLATES/src/hooks/usePlaybackRate.ts" src/hooks/usePlaybackRate.ts

cp "$TEMPLATES/src/components/Stage.tsx"          src/components/Stage.tsx
cp "$TEMPLATES/src/components/MaskReveal.tsx"     src/components/MaskReveal.tsx
cp "$TEMPLATES/src/components/LayoutDebug.tsx"    src/components/LayoutDebug.tsx
cp "$TEMPLATES/src/components/Evidence.tsx"       src/components/Evidence.tsx
cp "$TEMPLATES/src/components/PaperFigure.tsx"    src/components/PaperFigure.tsx
cp "$TEMPLATES/src/components/FigureLens.tsx"     src/components/FigureLens.tsx
cp "$TEMPLATES/src/components/ProgressBar.tsx"    src/components/ProgressBar.tsx
cp "$TEMPLATES/src/components/ProgressBar.css"    src/components/ProgressBar.css
cp "$TEMPLATES/src/components/AutoStartGate.tsx"  src/components/AutoStartGate.tsx
cp "$TEMPLATES/src/components/AutoStartGate.css"  src/components/AutoStartGate.css
cp "$TEMPLATES/src/components/AutoToggle.tsx"     src/components/AutoToggle.tsx
cp "$TEMPLATES/src/components/AutoToggle.css"     src/components/AutoToggle.css
# App.tsx imports PausedIndicator unconditionally — omitting these two made the
# very first `npm run build` of every new project fail with TS2307.
cp "$TEMPLATES/src/components/PausedIndicator.tsx" src/components/PausedIndicator.tsx
cp "$TEMPLATES/src/components/PausedIndicator.css" src/components/PausedIndicator.css
# 片尾（谢谢收看 + 作者 + 参考文献滚动）；credits.json 是空壳，流水线出片前用真实数据覆盖
cp "$TEMPLATES/src/components/EndCredits.tsx"   src/components/EndCredits.tsx
cp "$TEMPLATES/src/credits.json"                src/credits.json

# 论文模式公式渲染（可选，仅 --math）：注入 KaTeX + <Math>/<Formula> 组件 +
# math.css。不传 --math 时整段跳过 —— 脚手架输出与不传时字节一致。
# （放这里是因为 src/styles 与 src/components 已由上方 mkdir + cp 建好。）
if [[ "$MATH" == "1" ]]; then
  echo "▸ 安装 KaTeX（--math：论文模式公式揭示）..."
  # 不吞错误：装不上就当场停，否则 Math.tsx 会引用一个不存在的包，
  # 直到最后 tsc / 首次渲染才炸，报错点离真正的原因很远。
  if ! npm install katex >/dev/null; then
    echo "✗ --math: npm install katex 失败（见上方 npm 输出）。" >&2
    echo "  网络/镜像 OK 后重跑脚手架，或手动 npm install katex 再补两个文件。" >&2
    exit 1
  fi
  cp "$TEMPLATES/src/styles/math.css"     src/styles/math.css
  cp "$TEMPLATES/src/components/Math.tsx" src/components/Math.tsx
  # 规格驱动章节的公式槽：有 KaTeX 就换成真渲染版（同名同导出，覆盖 scene/ 里的桩）
  cp "$TEMPLATES/src/components/MathSlot.katex.tsx" src/components/scene/MathSlot.tsx
fi

cp "$TEMPLATES/src/registry/types.ts"    src/registry/types.ts
cp "$TEMPLATES/src/registry/chapters.ts" src/registry/chapters.ts

cp "$TEMPLATES/src/chapters/01-example/Example.tsx"     src/chapters/01-example/Example.tsx
cp "$TEMPLATES/src/chapters/01-example/Example.css"     src/chapters/01-example/Example.css
cp "$TEMPLATES/src/chapters/01-example/narrations.ts"   src/chapters/01-example/narrations.ts

# Audio pipeline scripts (extract-narrations + synthesize-audio runner +
# pluggable TTS providers under tts-providers/).
cp "$TEMPLATES/scripts/extract-narrations.ts"  scripts/extract-narrations.ts
cp "$TEMPLATES/scripts/synthesize-audio.sh"    scripts/synthesize-audio.sh
chmod +x scripts/synthesize-audio.sh

# Visual QA — static analyzer that catches structural layout problems
# in chapter TSX/CSS before opening a browser. See references/VISUAL-QA.md.
cp "$TEMPLATES/scripts/inspect-layout.mjs"     scripts/inspect-layout.mjs
cp "$TEMPLATES/scripts/spec-check.mjs"         scripts/spec-check.mjs

# Render smoke test — the one gate that actually runs the app. layout:check is
# pure source analysis and can be fully green while the page renders blank
# (see the header of smoke-render.mjs for the incident). Needs Playwright at
# run time only; skips loudly with exit 0 when it isn't installed.
cp "$TEMPLATES/scripts/smoke-render.mjs"       scripts/smoke-render.mjs
cp "$TEMPLATES/scripts/dom-check.mjs"          scripts/dom-check.mjs    # smoke --dom 的画面检查

# 内容与视觉层的闸（VISUAL-QA.md §2.6~2.8）：证据层（论文模式）/ 动画预算 / 口播漂移 /
# 音频验收 / contact sheet / 视觉评审（多模态模型按事故清单看截图）。
# 以前只有站点 worker 自带，交互式用 skill 时这几类事故没人拦。
cp "$TEMPLATES/scripts/evidence-check.mjs"     scripts/evidence-check.mjs
cp "$TEMPLATES/scripts/anim-budget.mjs"        scripts/anim-budget.mjs
cp "$TEMPLATES/scripts/script-drift.mjs"       scripts/script-drift.mjs
cp "$TEMPLATES/scripts/audio-check.mjs"        scripts/audio-check.mjs
cp "$TEMPLATES/scripts/contact-sheet.mjs"      scripts/contact-sheet.mjs
cp "$TEMPLATES/scripts/visual-review.mjs"      scripts/visual-review.mjs

# Audio measurement + the headless record → mux pipeline (references/RECORDING.md).
# record-auto/build-video only need ffmpeg + Playwright at RUN time, so they
# ship unconditionally — nothing is installed for projects that never record
# headlessly.
cp "$TEMPLATES/scripts/audio-report.mjs"       scripts/audio-report.mjs
cp "$TEMPLATES/scripts/build-audio-track.mjs"  scripts/build-audio-track.mjs
cp "$TEMPLATES/scripts/record-auto.mjs"        scripts/record-auto.mjs
cp "$TEMPLATES/scripts/build-video.mjs"        scripts/build-video.mjs

mkdir -p scripts/tts-providers
cp "$TEMPLATES/scripts/tts-providers/README.md"   scripts/tts-providers/README.md
cp "$TEMPLATES/scripts/tts-providers/minimax.sh"  scripts/tts-providers/minimax.sh
cp "$TEMPLATES/scripts/tts-providers/openai.sh"   scripts/tts-providers/openai.sh
cp "$TEMPLATES/scripts/tts-providers/voxcpm.sh"   scripts/tts-providers/voxcpm.sh

# VoxCPM voice-cloning provider — adapter + the persistent model server it
# talks to, plus the bundled reference voice so cloning is zero-config.
# (The 4.6G model itself is NOT bundled; the provider auto-detects it in
# conventional locations — see scripts/voxcpm/voxcpm.env.example to override.)
mkdir -p scripts/voxcpm/voices
cp "$TEMPLATES/scripts/voxcpm/voxcpm_server.py"    scripts/voxcpm/voxcpm_server.py
cp "$TEMPLATES/scripts/voxcpm/voxcpm-setup.sh"     scripts/voxcpm/voxcpm-setup.sh
cp "$TEMPLATES/scripts/voxcpm/voxcpm.env.example"  scripts/voxcpm/voxcpm.env.example
cp "$SKILL_DIR/references/voices/sam_voice_ref.wav" scripts/voxcpm/voices/sam_voice_ref.wav

# Everything the audio + QA pipelines generate at runtime. Without these,
# a single `git add -A` in the project stages the 4.6G VoxCPM model and the
# multi-GB torch venv that voxcpm-setup.sh downloads, plus voxcpm.env, which
# contains absolute paths from this machine.
cat >> .gitignore <<'GITIGNORE'

# ── web-video-presentation: generated / downloaded at runtime ──
pretrained_models/          # 4.6G VoxCPM2 model (voxcpm-setup.sh)
.venv-voxcpm/               # torch + voxcpm, multi-GB
scripts/voxcpm/voxcpm.env   # absolute paths from the machine that ran setup
scripts/voxcpm/voices/*.wav # voice references — the scaffold re-supplies the
                            # bundled one; your own belong outside git
public/audio/               # synthesized narration mp3s
layout-check.json           # npm run layout:check report
render/                     # recording + mux output (raw.webm is ~100MB/25min)
GITIGNORE

# Wire the audio scripts into npm so contributors don't have to remember
# the exact command. Uses node to merge into the existing package.json.
# (--math: 同一个 node 进程里把 math.css 接进 App.tsx，找不到锚点就报错退出。)
SCAFFOLD_MATH="$MATH" node -e '
const fs = require("fs");
const p = JSON.parse(fs.readFileSync("package.json", "utf8"));
p.scripts = Object.assign({}, p.scripts, {
  "extract-narrations": "tsx scripts/extract-narrations.ts",
  "synthesize-audio":   "bash scripts/synthesize-audio.sh",
  "layout:check":       "node scripts/inspect-layout.mjs .",
  "smoke":              "node scripts/smoke-render.mjs",
  "evidence:check":     "node scripts/evidence-check.mjs",
  "anim:budget":        "node scripts/anim-budget.mjs",
  "script:drift":       "node scripts/script-drift.mjs",
  "audio:check":        "node scripts/audio-check.mjs",
  "sheet":              "node scripts/contact-sheet.mjs",
  "visual:review":      "node scripts/visual-review.mjs",
  "verify":             "npm run layout:check && npm run evidence:check && npm run anim:budget && npm run script:drift && npm run build && npm run smoke",
  "audio:report":       "node scripts/audio-report.mjs",
  "audio:track":        "node scripts/build-audio-track.mjs",
  "video:record":       "node scripts/record-auto.mjs",
  "video:mux":          "node scripts/build-video.mjs",
});
fs.writeFileSync("package.json", JSON.stringify(p, null, 2) + "\n");

if (process.env.SCAFFOLD_MATH === "1") {
  const anchor = "import \"./styles/animations.css\";";
  const appPath = "src/App.tsx";
  const app = fs.readFileSync(appPath, "utf8");
  if (!app.includes(anchor)) {
    console.error("✗ --math: 在 App.tsx 里找不到锚点 " + JSON.stringify(anchor) +
      " —— 脚手架模板可能已变更，请检查 scripts/scaffold.sh 的 --math 接线。");
    process.exit(1);
  }
  if (!app.includes("styles/math.css")) {
    fs.writeFileSync(appPath,
      app.replace(anchor, anchor + "\nimport \"./styles/math.css\"; // KaTeX (--math)"));
  }
}
'

# 留个标记，以后能查这个项目从哪个主题起步的
{
  echo "$THEME"
} > .theme

# 跑一次 typecheck 确认接线 OK
echo "▸ 跑 typecheck ..."
if npx tsc --noEmit; then
  echo "✓ typecheck 通过"
else
  echo "✗ typecheck 失败 —— 请看上面的错误" >&2
  exit 1
fi

if [[ "$MATH" == "1" ]]; then
  echo "▸ 已启用 KaTeX（--math）：公式用 <Math tex=... /> 或 <Formula step={s} parts=[...] />，"
  echo "  4 步揭示见 references/PAPER-INTERPRETATION.md §7 与 EXAMPLES/paper-formula-reveal/。"
fi

cat <<EOF

✓ 完成。下一步：

  1. cd $TARGET
  2. npm run dev      # 默认 http://localhost:5174（被占会自动换端口）

当前主题：${THEME}（见 .theme）

然后：

  • 点舞台任意位置推进全局 step 计数器。
  • 鼠标移到底部边缘可显出进度条；鼠标移到右上角可显出播放模式切换。
  • 把 src/chapters/01-example/ 替换成你自己的章节
    （流程见 SKILL.md "Phase 2.4 实现单章" —— 每章一次到位完整版本，
     不分骨架 / 精修两步；动画选型由 chapter agent 按 CHAPTER-CRAFT.md
     Part 0 原则 7 + Part 1 五问决定）。
  • 在 src/registry/chapters.ts 注册每个新章节。
  • **每章必须有 narrations.ts**（与 Example.tsx 同目录），
    数组长度 = step 数，是音频合成 + Auto 模式的唯一真相源。
  • 章节改了就 bump src/hooks/useStepper.ts 的 STORAGE_KEY 末尾版本号。

音频合成（可选，录制前做）：

  npm run extract-narrations    # 扫所有章节 narrations.ts → audio-segments.json
  npm run synthesize-audio      # 默认 minimax provider 合成 → public/audio/<id>/<step>.mp3
                                # 换 provider：PRESENTATION_TTS=<name> npm run synthesize-audio
                                # 非英文旁白记得给 language boost：
                                #   PRESENTATION_TTS_LANG=Chinese
                                # 自定义 / 没装 mmx 见 scripts/tts-providers/README.md
  npm run audio:report          # 每章时长 + 偏长 / 偏短的步（录之前先看这个）

录制 —— 三条路：

  • 手动：直接打开 http://localhost:5174（点击 / 方向键推进），自己开录屏软件
  • 半自动：URL 加 ?audio=1 — 音频跟 step 切，但你手动推进
  • 全自动：URL 加 ?auto=1 — 整片自动播 + 推进；按 M 键随时切换三种模式

  有桌面时用 ?auto=1 + OBS 一镜到底最省事。**没有桌面（服务器 / 容器）就用
  这两条命令**，无头跑完再合成，音画对齐不用手动对：

  npm run video:record          # 驱动 ?auto=1 录完整片 → render/raw.webm + cues.json
  npm run video:mux             # 裁切 + 按 cues 对齐旁白 + 编码 → render/<项目>.mp4

  先冒烟测一遍，别拿 20 分钟去试错：
      npm run video:record -- --max-steps=6

  详见 $SKILL_DIR/references/RECORDING.md。

写章节时必读（单一入口，路径在 SKILL 仓库内）：

  • $SKILL_DIR/references/CHAPTER-CRAFT.md
      Part 0 十条原则 / ★ 静态布局阶段 / Part 1 开工 5 问 /
      Part 2 关系→动作决策树 / Part 3 视觉工具箱 / Part 4 时长 /
      Part 5 反 AI 味反模式 / Part 6 代码硬规则 / Part 7 完工自检 /
      Part 8 反馈速查
  • 视觉规划三件套（首次开工读一次 / 卡壳时翻）：
      $SKILL_DIR/references/VISUAL-DIRECTION.md
        8 构图 + 视觉角色 + 英雄帧契约 + 密度 tokens + AI 味清单
      $SKILL_DIR/references/MOTION-BLUEPRINTS.md
        10 种论文 / 教学动画节拍
      $SKILL_DIR/references/VISUAL-QA.md
        layout:check 机器检查 + ?layout=1 overlay 人工检查 + 修复 catalog
  • 解读论文（arXiv / 顶会）→ 额外读 $SKILL_DIR/references/PAPER-INTERPRETATION.md
      （论文类型叙事弧 / 证据层 fact·supported·infer 标注 / 公式 4 步揭示 / 图表复用）
  • $SKILL_DIR/themes/$THEME/theme.json
      看 descriptionZh / mood / bestFor —— 参考主题气质
      （动画 / 时长 / 字号 / emoji 由 chapter agent 在每章自由决定）

视觉自检（每章完工 / 录屏前必走）：

  • npm run verify              # 一条命令跑完下面六道机器闸
      ├ npm run layout:check    #   结构层：静态分析（含中文裸直引号检测）
      ├ npm run evidence:check  #   证据层：fact/supported 挂 locator（没有 evidence.ts 时跳过）
      ├ npm run anim:budget     #   动画时长 ≤ 口播时长（Auto 模式不等动画）
      ├ npm run script:drift    #   narrations 相对 ../script.md 没缩水（找不到 script.md 时跳过）
      ├ npm run build           #   tsc -b && vite build —— 类型 + 解析错误
      └ npm run smoke           #   运行层：真浏览器逐步走，白屏必红
  • 画面层（verify 之后，录屏前）：
      npm run smoke -- --shots --settle=3000   # 每步留一帧
      npm run sheet                            # 拼成每章一张 contact sheet，人看
      npm run visual:review                    # 多模态模型按事故清单逐帧评审（要配视觉模型）
  • 浏览器开 http://localhost:5174/?layout=1
                                  # 走一遍英雄帧（视觉层人工检查）
  • 详见 $SKILL_DIR/references/VISUAL-QA.md

  ⚠️ layout:check 从不加载页面，全绿不代表应用能跑 —— 白屏只有 smoke 抓得到。
     没装 playwright 时 smoke 会跳过并 exit 0，跳过就如实说「smoke 已跳过」。
     装它：npm i -D playwright && npx playwright install chromium
  ⚠️ 中文字符串一律用全角 “ ” —— ASCII 直引号会让整个文件解析失败 → 整站白屏，
     而 HTTP 仍然返回 200，极难排查。

卡壳时可翻：

  • $SKILL_DIR/references/EXAMPLES/
      完整章节 anchor（钩子型 / 列举型）—— 看"形"，不要照搬

要换一个主题，覆盖 tokens.css 即可：
  cp $SKILL_DIR/themes/<id>/tokens.css src/styles/tokens.css

想自创主题，看 $SKILL_DIR/references/THEMES.md。

EOF
