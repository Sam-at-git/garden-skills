// ⚠️ anchor 参考代码，不会被编译。抄到真实项目改 import：
//      import type { ChapterStepProps } from "../../registry/types";
//      import { Formula } from "../../components/Math";   // 需 --math 脚手架
//      import "./chapter.css";
import type { ChapterStepProps } from "../../../templates/src/registry/types";
// @ts-expect-error —— anchor 不编译；真实项目里 Math.tsx 由 --math 脚手架提供
import { Formula } from "../../../templates/src/components/Math";
import "./chapter.css";

/**
 * paper-formula-reveal · 公式 4 步揭示章
 * ─────────────────────────────────────────
 * 演示 left-fig-right-explain 布局 + 论文事实证据层 + KaTeX（需 --math）。
 *
 * 四步（5 step）：
 *   1. 先演问题（大白话，无数学）
 *   2. 整条公式弱化预览（所有符号 .muted）
 *   3. 点亮 Q（accent 固定色）—— 右图 Q 节点同色亮
 *   4. 点亮 K（中性墨）—— 右图 K 节点亮
 *   5. 代入微数字，结果真的变
 *
 * Formula 的 parts：part 在 step >= at 时解除 muted。
 *   step 2 → 全 muted（所有 at >= 3）；step 3 → Q 解除；step 4 → K；step 5 → 结果。
 */

export default function PaperFormulaReveal({ step }: ChapterStepProps) {
  const showFormula = step >= 2;
  return (
    <div className="pf-scene scene-pad">
      <div className="pf-citation label-mono">Paper · RoutingNet · arXiv:2406.07223</div>
      {showFormula && (
        <>
          <span className="pf-ev ev-fact">论文事实</span>
          <span className="pf-locator label-mono">Eq 4 · §3.2</span>
        </>
      )}

      <div className="pf-split">
        {/* 左 ~60%：问题 / 公式 */}
        <div className="pf-left">
          {step === 1 && (
            <div className="pf-problem">
              <span className="pf-kicker">先别看公式</span>
              <h2 className="pf-q">模型怎么知道，哪段信息跟当前最相关？</h2>
            </div>
          )}

          {showFormula && (
            <div className="pf-formula-wrap">
              <span className="pf-kicker">注意力打分</span>
              {/* parts: at <= step 时解除 muted。step2 全 muted；3 解除 Q；4 解除 K；5 出结果 */}
              <div className="pf-formula">
                <Formula
                  step={step}
                  parts={[
                    { tex: "\\textcolor{var(--accent)}{Q}", at: 3 },
                    { tex: "\\cdot", at: 3 },
                    { tex: "\\textcolor{var(--text)}{K^{T}}", at: 4 },
                    { tex: "=", at: 4 },
                    { tex: step >= 5 ? "\\textcolor{var(--accent)}{0.40}" : "\\textcolor{var(--text-mute)}{\\,?}",
                      at: 5 },
                  ]}
                />
              </div>
              {step >= 5 && <div className="pf-plug label-mono">代入 Q=0.8, K=0.5 →</div>}
            </div>
          )}
        </div>

        {/* 右 ~40%：图，符号节点与公式同色同步点亮 */}
        <div className="pf-right">
          <div className={`pf-node pf-q ${step >= 3 ? "is-on" : ""}`}>Q<div className="pf-node-tag label-mono">查询</div></div>
          <div className="pf-line" />
          <div className={`pf-node pf-k ${step >= 4 ? "is-on" : ""}`}>K<div className="pf-node-tag label-mono">键</div></div>
        </div>
      </div>
    </div>
  );
}
