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
 * 关键手段：
 * - 三根柱子在**同一条基线 + 同一把刻度**上（反"无统一坐标轴"反模式）
 * - step 1 基线柱顶满（height 过渡）
 * - step 2/3 逐个"移除模块" → 对应柱子缩矮 + Δ 数字 accent 砸下；
 *   讲第二根时第一根灰化保留作上下文
 * - step 4 方差须 ±0.3 **刻意晚揭示**（反"只晒最好结果"——先让观众看见下降，
 *   再问"这是不是噪声"）
 *
 * 证据层：右上 实验支持 badge（= --accent，权重最高，因有数据撑腰）+ 左下 Table 3。
 *
 * ── Composition ──
 * All 5 steps share `asymmetric-60-40` (chart 60% + annotation 40%) —
 * intentionally. Ablation series NEED a stable frame so the eye sees
 * "same chart, only this bar moved" across steps. This is the legitimate
 * exception to the "no consecutive same composition" rule, marked by
 * `data-composition-stable="true"` so inspect-layout.mjs knows.
 * See references/VISUAL-DIRECTION.md §1.1 for the rationale.
 */

// 柱顶高度（%，同把刻度；数字来自 paper-digest §9 / Table 3）
const BARS = [
  { id: "full",  label: "完整模型",       value: 86.2, height: 100, delta: null },
  { id: "noR",   label: "− router",       value: 81.4, height: 72,  delta: "−4.8" },
  { id: "noG",   label: "− gate",         value: 83.1, height: 81,  delta: "−3.1" },
];

// step >= 2 才移除第 1 个（router）；step >= 3 移除第 2 个（gate）
const removedAt = (i: number) => (i === 1 ? 2 : i === 2 ? 3 : Infinity);

export default function PaperAblation({ step }: ChapterStepProps) {
  return (
    <div
      className="pa-scene scene-pad"
      data-composition="asymmetric-60-40"
      data-composition-stable="true"
    >
      <div className="pa-citation label-mono" data-role="annotation">Paper · RoutingNet · arXiv:2406.07223</div>
      {/* step 2+ 挂 实验支持 / Table 3 */}
      {step >= 2 && (
        <>
          <span className="pa-ev ev-supported" data-role="annotation">实验支持</span>
          <span className="pa-locator label-mono" data-role="annotation">Table 3 · §4.2</span>
        </>
      )}

      <header className="pa-head" data-role="secondary">
        <span className="pa-kicker">消融实验</span>
        <h2 className="pa-title">哪个模块真正有效？</h2>
      </header>

      {/* 同坐标轴柱图：三根柱子共享基线 + 刻度 */}
      <div className="pa-chart" data-role="primary">
        <div className="pa-axis-y label-mono">100 · GLUE</div>
        <div className="pa-bars">
          {BARS.map((b, i) => {
            const removed = step >= removedAt(i);
            const isBaseline = i === 0;
            return (
              <div key={b.id} className={`pa-col ${removed ? "is-removed" : ""} ${isBaseline ? "is-baseline" : ""}`}>
                {removed && b.delta && <span className="pa-delta">Δ {b.delta}</span>}
                <div className="pa-bar-track">
                  <div
                    className="pa-bar"
                    style={{ height: `${step >= 1 ? b.height : 0}%` }}
                  />
                  {/* step 4：方差须（刻意晚揭示） */}
                  {step >= 4 && !isBaseline && removed && (
                    <span className="pa-whisker">±0.3</span>
                  )}
                </div>
                <span className="pa-value">{step >= 1 ? b.value.toFixed(1) : ""}</span>
                <span className="pa-col-label label-mono">{b.label}</span>
              </div>
            );
          })}
        </div>
        <div className="pa-axis-x" />
      </div>

      {step >= 5 && <p className="pa-takeaway" data-role="primary">router 一去掉，掉得最多——它才是关键。</p>}
    </div>
  );
}
