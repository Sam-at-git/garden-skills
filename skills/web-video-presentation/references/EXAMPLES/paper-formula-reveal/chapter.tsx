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
 * ⚠️ step 是 **0-indexed**：有效 step 0..4，narrations.ts 长度 5，
 *    第 N 句口播 ↔ step === N 的那一屏。step 0 左栏就有内容（问题句）。
 *
 * 四步揭示（落到 5 个 step）：
 *   step 0. 先演问题（大白话，无数学）
 *   step 1. 整条公式弱化预览（所有符号 .muted）
 *   step 2. 点亮 Q —— 右图 Q 节点同步用 --accent 亮
 *   step 3. 点亮 K —— 右图 K 节点用中性墨亮
 *   step 4. 代入微数字，结果真的变
 *
 * Formula 的 parts：part 在 step >= at 时解除 muted。
 *   step 1 → 全 muted（所有 at >= 2）；step 2 → Q 解除；step 3 → K；step 4 → 结果。
 *
 * ⚠️ 逐符号配色**不要**写成 `\textcolor{var(--accent)}{Q}`：KaTeX 只认
 * #rgb / #rrggbb / 具名色，传 CSS 变量会整段回退成 KaTeX 硬编码的红色源码
 * （见 components/Math.tsx 顶部注释）。这里 TeX 保持纯净，"Q 是强调色"这个
 * 固定配色由**右图的 Q 节点**（.pf-node.pf-q.is-on → --accent）承担，公式侧
 * 只用 muted / 解除 muted 表达"轮到谁"。要在公式里也上色，就给 <Formula>
 * 传 color prop / 包一层带 class 的 span，别走 TeX。
 *
 * ── Composition ──
 * asymmetric-60-40：左 60% 公式/问题（primary），右 40% 图（secondary）。
 */

export default function PaperFormulaReveal({ step }: ChapterStepProps) {
  const showFormula = step >= 1;
  return (
    <div className="pf-scene scene-pad" data-composition="asymmetric-60-40">
      <div className="ev-citation label-mono" data-role="annotation">Paper · RoutingNet · arXiv:2406.07223</div>
      {showFormula && (
        <>
          <span className="ev-badge" data-evidence="fact" data-role="annotation">论文事实</span>
          <span className="ev-locator label-mono" data-role="annotation">Eq 4 · §3.2</span>
        </>
      )}

      <div className="pf-split">
        {/* 左 ~60%：问题 / 公式 */}
        <div className="pf-left" data-role="primary">
          {step === 0 && (
            <div className="pf-problem">
              <span className="pf-kicker">先别看公式</span>
              <h2 className="pf-q">模型怎么知道，哪段信息跟当前最相关？</h2>
            </div>
          )}

          {showFormula && (
            <div className="pf-formula-wrap">
              <span className="pf-kicker">注意力打分</span>
              {/* parts: at <= step 时解除 muted。step 1 全 muted；2 解除 Q；3 解除 K；4 出结果 */}
              <div className="pf-formula">
                <Formula
                  step={step}
                  parts={[
                    { tex: "Q", at: 2 },
                    { tex: "\\cdot", at: 2 },
                    { tex: "K^{T}", at: 3 },
                    { tex: "=", at: 3 },
                    { tex: step >= 4 ? "0.40" : "\\,?", at: 4 },
                  ]}
                />
              </div>
              {step >= 4 && <div className="pf-plug label-mono">代入 Q=0.8, K=0.5 →</div>}
            </div>
          )}
        </div>

        {/* 右 ~40%：图，符号节点固定配色，与公式同步点亮 */}
        <div className="pf-right" data-role="secondary">
          <div className={`pf-node pf-q ${step >= 2 ? "is-on" : ""}`}>Q<div className="pf-node-tag label-mono">查询</div></div>
          <div className="pf-line" />
          <div className={`pf-node pf-k ${step >= 3 ? "is-on" : ""}`}>K<div className="pf-node-tag label-mono">键</div></div>
        </div>
      </div>
    </div>
  );
}
