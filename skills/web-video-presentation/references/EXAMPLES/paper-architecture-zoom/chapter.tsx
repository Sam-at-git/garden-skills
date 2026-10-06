// ⚠️ 这是 anchor 参考代码，不会被任何项目编译。
//    抄到真实项目时（presentation/src/chapters/NN-method/）把两个 import 改成：
//      import type { ChapterStepProps } from "../../registry/types";
//      import "./chapter.css";
import type { ChapterStepProps } from "../../../templates/src/registry/types";
import "./chapter.css";

/**
 * paper-architecture-zoom · 论文架构章
 * ─────────────────────────────────────────
 * 演示 whole→local-zoom 布局 + 论文事实证据层。
 *
 * ⚠️ step 是 **0-indexed**：有效 step 0..5，narrations.ts 长度 6，
 *    第 N 句口播 ↔ step === N 的那一屏。step 0 一上来就是整张地图。
 *
 * 关键手段：
 * - step 0 整张 input→model→output 地图淡入 + 引子
 * - step 1 镜头推进：一个 .az-stage wrapper 上 transform: scale + translate，
 *   非焦点盒子灰化（opacity + filter）—— 这是"钻进去"的主导动作
 * - step 2 model 盒子内部 3 子模块逐个揭示（前面灰化保留作上下文）
 * - step 3 callout 线 stroke-dashoffset 自绘
 * - step 4 反向缩放复位 + model 盒子 accent 高亮 —— "退回总图"
 * - step 5 一句话 takeaway
 *
 * 证据层：右上 论文事实 badge + 左下 Fig 2 locator（step 1–4）。
 * class 走共享 <Evidence>（ev-badge / ev-locator / ev-citation），
 * 样式由 src/styles/evidence.css 提供。
 *
 * ── Composition ──
 * diagram-canvas：整章是节点 + 连线的自由图示，镜头在画布上推拉。
 */

// 论文事实证据（真实项目放兄弟 evidence.ts；这里内联演示）
const EVIDENCE = [1, 2, 3, 4]; // 这些 step 挂 论文事实 / Fig 2

const SUBMODULES = ["Query", "Key", "Value"];

export default function PaperArchitectureZoom({ step }: ChapterStepProps) {
  const zoomed = step >= 1 && step <= 3; // step 1–3 镜头在 model 盒子里
  const revealCount = step >= 2 ? Math.min(step - 1, SUBMODULES.length) : 0;

  return (
    <div className="az-scene scene-pad" data-composition="diagram-canvas">
      {/* 角落常驻出处 chip（paper mode：从 step 0 就挂） */}
      {/* 证据层 badge（论文事实 + Fig 2） */}
      {EVIDENCE.includes(step) && (
        <>
          <span className="ev-badge" data-evidence="fact" data-role="annotation">论文事实</span>
          <span className="ev-locator label-mono" data-role="annotation">Fig 2 · §3.1</span>
        </>
      )}

      {/* 整体→局部→回总图 的镜头由 .az-stage 上的 class 控制 */}
      <div className={`az-stage ${zoomed ? "is-zoomed" : ""}`} data-role="primary">
        <div className="az-map">
          <div className={`az-box az-input ${zoomed ? "is-dim" : ""}`}>Input</div>
          <AzArrow />
          <div className={`az-box az-model ${step >= 4 ? "is-focus" : ""}`}>
            <span className="az-box-label">Model</span>
            {/* step 2+：model 内部子模块逐个揭示 */}
            <div className="az-submodules">
              {SUBMODULES.map((name, i) => (
                <span
                  key={name}
                  className={`az-sub ${i < revealCount ? "is-on" : i === revealCount ? "is-active" : "is-ghost"}`}
                >
                  {name}
                </span>
              ))}
            </div>
          </div>
          <AzArrow />
          <div className={`az-box az-output ${zoomed ? "is-dim" : ""}`}>Output</div>
        </div>

        {/* step 3：自绘 callout 指认一个子模块 */}
        {step === 3 && (
          <svg className="az-callout" viewBox="0 0 400 60" preserveAspectRatio="none" data-role="annotation">
            <path className="az-callout-line" d="M 10 30 C 120 30, 180 30, 300 30" />
          </svg>
        )}
      </div>

      {/* step 0 引子 / step 5 takeaway */}
      {step === 0 && <h2 className="az-intro" data-role="secondary">先看整张地图，再放大核心。</h2>}
      {step >= 5 && <h2 className="az-outro" data-role="secondary">Model 里的 router，就是这篇的关键。</h2>}
    </div>
  );
}

function AzArrow() {
  return <span className="az-arrow" aria-hidden>→</span>;
}
