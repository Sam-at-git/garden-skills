# Anchor: paper-formula-reveal（公式 4 步揭示 · 需 `--math`）

> ⚠️ **结构示意，不是抄袭模板。** 先走 [`../../CHAPTER-CRAFT.md`](../../CHAPTER-CRAFT.md)
> Part 0 五问 + [`../../PAPER-INTERPRETATION.md`](../../PAPER-INTERPRETATION.md) §7。

> 🔧 **本 anchor 依赖 KaTeX**：项目必须用 `--math` 脚手架（
> `bash scaffold.sh ./p --theme=tufte-ink --math`），否则没有 `src/components/Math.tsx`。
> 没 `--math` 时，把 `<Formula>` 换成手搓 SVG/styled span 也能复刻这套 4 步节奏。

## 定位

讲公式最不劝退的做法：**别上来推数学**，按四步——先演它解决的问题 → 整条公式
弱化预览 → 逐个点亮符号（每个符号固定配色，同时点亮图中对象）→ 代入微数字让
结果真的变。对应 [`PAPER-INTERPRETATION.md`](../../PAPER-INTERPRETATION.md) §7
+ §4「math → one-symbol-at-a-time」+ §5「left-fig-right-explain」布局。

> 反模式（§9 第 5 条）：不服务理解的公式直接砍。**不是每篇都要推公式**；
> survey / system 常一个公式都不用。

## 四步（= 5 个 step）

> ⚠️ `ChapterStepProps.step` 是 **0-indexed**（`step: 0..narrations.length - 1`）。
> `narrations.ts` 长度 5 ↔ 代码里最大阈值 `step >= 4`。step 0 左栏就有内容
> （那句问题），不是空栏。

| step（代码） | 意图 | 画面 |
|---|---|---|
| 0 | **先演问题** | 大白话：模型怎么算"哪段信息最相关"——还没上数学 |
| 1 | **整条公式弱化预览** | KaTeX 渲染 `score = Q·Kᵀ`，所有符号 `.muted`（结构先到位） |
| 2 | **点亮 Q** | Q 解除 muted；**右侧图里的 Q 节点用 `--accent` 同步亮起** |
| 3 | **点亮 K** | K 解除 muted；右侧 K 节点用中性墨色（`--text`）亮起 |
| 4 | **代入微数字** | Q=0.8, K=0.5 → 结果 `0.40` 真的变出来 |

> **固定配色原则**：Q 全片永远是 accent，K 永远是中性墨——**图里**认这个色，
> 观众看一眼就知道公式里的符号对应图上哪个对象。
> （守"单一 accent"规则：只 Q 用强调色，K 用中性墨。若公式需要第三个符号 V，
> 在 `tufte-ink` 这种近单色主题里用粗细/字形区分，不要硬塞第二个饱和色。）

> ⚠️ **KaTeX 里不能用 CSS 变量上色**：`\textcolor{var(--accent)}{Q}` 会被 KaTeX
> 判为非法颜色，配上 `throwOnError:false` 就整段回退成硬编码红色的 TeX 源码
> （见 [`templates/src/components/Math.tsx`](../../../templates/src/components/Math.tsx)
> 顶部注释）。所以本 anchor 的 `parts` 里 TeX 保持纯净（`"Q"` / `"K^{T}"`），
> 公式侧只用 muted / 解除 muted 表达"轮到谁"，颜色由右图节点承担。要在公式里
> 也上色，走 `<Formula>` 的 `color` prop 或外层 span 的 class，别走 TeX。

## 布局

`data-composition="asymmetric-60-40"`（左 60% 公式/问题 = `data-role="primary"`，
右 40% 图 = `data-role="secondary"`）。

## 证据层（paper mode）

这是**论文事实**（作者写的方程），右上挂 `论文事实` badge，左下挂 `Eq 4 · §3.2`
locator。step 1–4 挂。

badge / locator / citation 走**共享**的 `<Evidence>` class：
`ev-badge`（配 `data-evidence="fact|supported|infer|background"`）、`ev-locator`、`ev-citation`，
样式在 `src/styles/evidence.css`，`chapter.css` 里**不再**重复一份。

## 文件结构

```
paper-formula-reveal/
├── README.md · chapter.tsx · chapter.css · narrations.ts
```
依赖（`--math` 脚手架产出）：`src/components/Math.tsx`（导出 `<Formula>`）。

`narrations.ts` 用**具名导出** `export const narrations: string[]` —— `registry/chapters.ts`
和 `scripts/extract-narrations.ts` 都只认这个形式，写成 `export default` 会让 TTS 管线直接报错。

## 切到其它主题

- `tufte-ink` —— 公式用 Source Serif，符号配色克制；最学术
- `terminal-green` —— 符号点亮用 phosphor 绿；代入数字用打字机滚出
- `blueprint` —— 公式像蓝图标注，连线把符号拉到图里的对象

**结构（5 步 = step 0..4、4 步揭示、固定配色、左右分屏）保持不变。**
