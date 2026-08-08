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
 * 关键手段：
 * - step 1 整张 input→model→output 地图淡入
 * - step 2 镜头推进：一个 .az-stage wrapper 上 transform: scale + translate，
 *   非焦点盒子灰化（opacity + filter）—— 这是"钻进去"的主导动作
 * - step 3 model 盒子内部 3 子模块逐个揭示（前面灰化保留作上下文）
 * - step 4 callout 线 stroke-dashoffset 自绘
 * - step 5 反向缩放复位 + model 盒子 accent 高亮 —— "退回总图"
 * - step 6 一句话 takeaway
 *
 * 证据层：右上 论文事实 badge + 左下 Fig 2 locator（step 2–5）。
 */

// 论文事实证据（真实项目放兄弟 evidence.ts；这里内联演示）
const EVIDENCE = [2, 3, 4, 5]; // 这些 step 挂 论文事实 / Fig 2

const SUBMODULES = ["Query", "Key", "Value"];

export default function PaperArchitectureZoom({ step }: ChapterStepProps) {
  const zoomed = step >= 2 && step <= 4; // step 2–4 镜头在 model 盒子里
  const revealCount = step >= 3 ? Math.min(step - 2, SUBMODULES.length) : 0;

  return (
    <div className="az-scene scene-pad">
      {/* 角落常驻出处 chip（paper mode：从 step 1 就挂） */}
      <div className="az-citation label-mono">Paper · RoutingNet · arXiv:2406.07223</div>
      {/* 证据层 badge（论文事实 + Fig 2） */}
      {EVIDENCE.includes(step) && (
        <>
          <span className="az-ev ev-fact">论文事实</span>
          <span className="az-locator label-mono">Fig 2 · §3.1</span>
        </>
      )}

      {/* 整体→局部→回总图 的镜头由 .az-stage 上的 class 控制 */}
      <div className={`az-stage ${zoomed ? "is-zoomed" : ""}`}>
        <div className="az-map">
          <div className={`az-box az-input ${zoomed ? "is-dim" : ""}`}>Input</div>
          <AzArrow />
          <div className={`az-box az-model ${step >= 5 ? "is-focus" : ""}`}>
            <span className="az-box-label">Model</span>
            {/* step 3+：model 内部子模块逐个揭示 */}
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

        {/* step 4：自绘 callout 指认一个子模块 */}
        {step === 4 && (
          <svg className="az-callout" viewBox="0 0 400 60" preserveAspectRatio="none">
            <path className="az-callout-line" d="M 10 30 C 120 30, 180 30, 300 30" />
          </svg>
        )}
      </div>

      {/* step 1 引子 / step 6 takeaway */}
      {step === 1 && <h2 className="az-intro">先看整张地图，再放大核心。</h2>}
      {step >= 6 && <h2 className="az-outro">Model 里的 router，就是这篇的关键。</h2>}
    </div>
  );
}

function AzArrow() {
  return <span className="az-arrow" aria-hidden>→</span>;
}
