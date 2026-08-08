// ⚠️ anchor 参考代码，不会被编译。抄到真实项目改 import：
//      import type { ChapterStepProps } from "../../registry/types";
//      import "./chapter.css";
import type { ChapterStepProps } from "../../../templates/src/registry/types";
import "./chapter.css";

/**
 * paper-experiment-chart · 基线对比章（chart-dominant）
 * ─────────────────────────────────────────
 * 演示 chart-dominant 布局 + 同坐标轴诚实做图 + 混合证据层。
 *
 * 关键手段：
 * - step 1 空坐标轴自绘（SVG stroke-dashoffset）
 * - step 2 **基线柱先长**（旧方法）—— 反"本文方法最后出现"取巧
 * - step 3 本文柱在同把轴上长起，更高
 * - step 4 Δ 数字砸下 + ±方差须（晚揭示）
 * - step 5 讲者"公不公平"评价 → 额外挂 解读推断 badge（虚线弱化）
 *
 * 证据层（混合）：step 2+ 实验支持 / Table 2；step 5 额外 解读推断。
 * 两种 badge 同屏，infer 视觉明显更弱 —— 这是证据层核心示范。
 */

const PRIOR = { label: "Prior", value: 71.4, height: 71 };
const OURS = { label: "Ours", value: 86.2, height: 100 };

export default function PaperExperimentChart({ step }: ChapterStepProps) {
  const showPrior = step >= 2;
  const showOurs = step >= 3;
  const showDelta = step >= 4;
  const showFairness = step >= 5;

  return (
    <div className="pe-scene scene-pad">
      <div className="pe-citation label-mono">Paper · RoutingNet · arXiv:2406.07223</div>

      {/* step 2+：数据是实验支持 / Table 2 */}
      {step >= 2 && (
        <>
          <span className="pe-ev ev-supported">实验支持</span>
          <span className="pe-locator label-mono">Table 2 · §4.1</span>
        </>
      )}
      {/* step 5：讲者评价是解读推断（虚线弱化，与数据分开）—— 多挂一个 badge */}
      {showFairness && <span className="pe-ev ev-infer pe-ev-2">解读推断</span>}

      <header className="pe-head">
        <span className="pe-kicker">实验结果</span>
        <h2 className="pe-title">比基线强多少？强得稳不稳？</h2>
      </header>

      {/* chart-dominant：图表 ≥70%，每步只回答一个问题 */}
      <div className="pe-chart">
        <svg className="pe-axis" viewBox="0 0 100 100" preserveAspectRatio="none">
          <line className={`pe-axis-line ${step >= 1 ? "is-drawn" : ""}`} x1="6" y1="92" x2="98" y2="92" />
          <line className={`pe-axis-line ${step >= 1 ? "is-drawn" : ""}`} x1="6" y1="6" x2="6" y2="92" />
        </svg>

        <div className="pe-bars">
          {/* 基线柱先长（step 2） */}
          <div className="pe-col">
            {showDelta && <span className="pe-delta">基线</span>}
            <div className="pe-bar-track">
              <div className="pe-bar pe-prior" style={{ height: showPrior ? `${PRIOR.height}%` : 0 }} />
              {showDelta && <span className="pe-whisker">±0.4</span>}
            </div>
            <span className="pe-value">{showPrior ? PRIOR.value.toFixed(1) : ""}</span>
            <span className="pe-col-label label-mono">{PRIOR.label}</span>
          </div>

          {/* 本文柱（step 3），更高 */}
          <div className="pe-col pe-col-ours">
            {showDelta && <span className="pe-delta pe-delta-ours">+14.8</span>}
            <div className="pe-bar-track">
              <div className="pe-bar pe-ours" style={{ height: showOurs ? `${OURS.height}%` : 0 }} />
              {showDelta && <span className="pe-whisker">±0.3</span>}
            </div>
            <span className="pe-value">{showOurs ? OURS.value.toFixed(1) : ""}</span>
            <span className="pe-col-label label-mono">{OURS.label}</span>
          </div>
        </div>
      </div>

      {showFairness && (
        <p className="pe-fairness">
          数据是真的强。但注意——基线是两年前的老方法，这个对比公不公平，<em>是我的看法</em>，不是论文的结论。
        </p>
      )}
    </div>
  );
}
