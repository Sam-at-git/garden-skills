// ⚠️ anchor 参考代码，不会被编译。抄到真实项目改两个 import：
//      import type { ChapterStepProps } from "../../registry/types";
//      import "./chapter.css";
import type { ChapterStepProps } from "../../../templates/src/registry/types";
import "./chapter.css";

/**
 * paper-ablation · 消融实验章
 * ─────────────────────────────────────────
 * 演示 two-col-compare 布局（同坐标轴柱图）+ 实验支持证据层。
 *
 * ⚠️ step 是 **0-indexed**：有效 step 0..4，narrations.ts 长度 5，
 *    第 N 句口播 ↔ step === N 的那一屏。step 0 一上来就有内容（基线柱）。
 *
 * 关键手段：
 * - 三根柱子在**同一条基线 + 同一把刻度**上（反"无统一坐标轴"反模式）
 * - step 0 基线柱先长满（数字 86.2）
 * - step 1/2 逐个"移除模块" → 对应柱子在同一把刻度上长到更矮的位置
 *   + Δ 数字 accent 砸下；讲第二根时第一根灰化保留作上下文
 * - step 3 方差须 ±0.3 **刻意晚揭示**（反"只晒最好结果"——先让观众看见下降，
 *   再问"这是不是噪声"）
 * - step 4 takeaway
 *
 * ⚠️ **截断轴（truncated axis）**：4.8 分的差落在 0–100 的刻度上只有 17px，
 * 消融章的"掉下来"就看不见了，所以纵轴从 68 起、到 88 止。截断是允许的，
 * 但**必须同时**做到两件事，否则就是 PAPER-INTERPRETATION.md §9 第 1 条
 * （图表无统一坐标轴 → 差异被视觉放大）：
 *   ① 画面上画出 Y 轴根部的截断标记（`.pa-axis-break` 两道斜杠）；
 *   ② 轴标注写明真实区间「GLUE · 68–88（轴已截断）」，不能只写「100 · GLUE」。
 * 三根柱子仍然共用这**同一把**刻度 —— 截断的是起点，不是每根柱子各自的尺子。
 *
 * 证据层：右上 实验支持 badge（= --accent，权重最高，因有数据撑腰）+ 左下 Table 3。
 * badge / locator / citation 用共享 <Evidence> 的 class（ev-badge / ev-locator /
 * ev-citation），样式由 src/styles/evidence.css 提供。
 *
 * ── Composition ──
 * All 5 steps share `asymmetric-60-40` (chart 60% + annotation 40%) —
 * intentionally. Ablation series NEED a stable frame so the eye sees
 * "same chart, only this bar moved" across steps. This is the legitimate
 * exception to the "no consecutive same composition" rule, marked by
 * `data-composition-stable="true"` so inspect-layout.mjs knows.
 * See references/VISUAL-DIRECTION.md §1.1 for the rationale.
 */

// 纵轴：GLUE 分数，**截断区间 68–88**（见上方 ⚠️）。三根柱子共用这把刻度。
const AXIS = { min: 68, max: 88 };
const pct = (v: number) => ((v - AXIS.min) / (AXIS.max - AXIS.min)) * 100;

// 数字来自 paper-digest §9 / Table 3。高度不再手写 —— 一律由 pct() 线性算出，
// 避免"每根柱子一把尺子"。
const BARS = [
  { id: "full",  label: "完整模型",       value: 86.2, delta: null },
  { id: "noR",   label: "− router",       value: 81.4, delta: "−4.8" },
  { id: "noG",   label: "− gate",         value: 83.1, delta: "−3.1" },
];

// 第 i 根柱子在哪一步"被移除"（= 在图上长出来）：router → step 1，gate → step 2。
// 基线（i === 0）从 step 0 就在场。
const removedAt = (i: number) => (i === 1 ? 1 : i === 2 ? 2 : Infinity);
const LAST_REVEAL_STEP = 2; // 最后一根消融柱出场的 step

export default function PaperAblation({ step }: ChapterStepProps) {
  return (
    <div
      className="pa-scene scene-pad"
      data-composition="asymmetric-60-40"
      data-composition-stable="true"
    >
      {/* step 1+ 挂 实验支持 / Table 3 */}
      {step >= 1 && (
        <>
          <span className="ev-badge" data-evidence="supported" data-role="annotation">实验支持</span>
          <span className="ev-locator label-mono" data-role="annotation">Table 3 · §4.2</span>
        </>
      )}

      <header className="pa-head" data-role="secondary">
        <span className="pa-kicker">消融实验</span>
        <h2 className="pa-title">哪个模块真正有效？</h2>
      </header>

      {/* 同坐标轴柱图：三根柱子共享基线 + 刻度（截断轴，见 .pa-axis-break） */}
      <div className="pa-chart" data-role="primary">
        <div className="pa-axis-y label-mono" data-role="annotation">GLUE · 68–88（轴已截断）</div>
        <div className="pa-bars">
          {BARS.map((b, i) => {
            const isBaseline = i === 0;
            const shown = isBaseline || step >= removedAt(i);
            // 讲下一根时，上一根灰化保留作上下文；揭示阶段结束（step 3+）全部复位
            const isContext =
              shown && !isBaseline && step <= LAST_REVEAL_STEP && step > removedAt(i);
            return (
              <div key={b.id} className={`pa-col ${isContext ? "is-context" : ""} ${isBaseline ? "is-baseline" : ""}`}>
                {shown && b.delta && <span className="pa-delta">Δ {b.delta}</span>}
                <div className="pa-bar-track">
                  <div
                    className="pa-bar"
                    style={{ height: shown ? `${pct(b.value)}%` : 0 }}
                  />
                  {/* step 3：方差须（刻意晚揭示） */}
                  {step >= 3 && !isBaseline && shown && (
                    <span className="pa-whisker">±0.3</span>
                  )}
                </div>
                <span className="pa-value">{shown ? b.value.toFixed(1) : ""}</span>
                <span className="pa-col-label label-mono">{b.label}</span>
              </div>
            );
          })}
        </div>
        {/* 截断标记：Y 轴根部两道斜杠 = "这里剪掉了 0–68" */}
        <span className="pa-axis-break" aria-hidden />
        <div className="pa-axis-x" />
      </div>

      {step >= 4 && <p className="pa-takeaway" data-role="primary">router 一去掉，掉得最多——它才是关键。</p>}
    </div>
  );
}
