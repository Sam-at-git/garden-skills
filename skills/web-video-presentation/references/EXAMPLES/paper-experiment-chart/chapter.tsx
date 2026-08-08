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
 * ⚠️ step 是 **0-indexed**：有效 step 0..4，narrations.ts 长度 5，
 *    第 N 句口播 ↔ step === N 的那一屏。
 *
 * 关键手段：
 * - step 0 空坐标轴自绘（SVG stroke-dashoffset）+ 0/50/100 刻度就位
 * - step 1 **基线柱先长**（旧方法）—— 反"本文方法最后出现"取巧
 * - step 2 本文柱在同把轴上长起，更高
 * - step 3 Δ 数字砸下 + ±方差须（晚揭示）
 * - step 4 讲者"公不公平"评价 → 额外挂 解读推断 badge（虚线弱化）
 *
 * ⚠️ **诚实的柱高映射**：口播说"纵轴是准确率，从 0 到 100"，那画面就得真的是
 * 0–100。柱高**直接等于数值百分比**（`height: ${value}%`，见 barHeight()），
 * 两根柱子在同一条线性映射上：71.4 → 71.4%，86.2 → 86.2%，视觉比 1.21 倍
 * 就是真实的 1.21 倍。**不要**手写 `{ 71.4 → 71, 86.2 → 100 }` 这种"让本文柱
 * 顶满"的高度——那等于给两根柱子各配一把尺子，差异被放大成 1.41 倍，正中
 * PAPER-INTERPRETATION.md §9 第 1 条反模式 + §7「绝不扭曲坐标轴/刻度」。
 * 这里 14.8 分的差在 0–100 上已经很清楚，**不需要**截断轴。
 * （真要截断，见 paper-ablation/：必须画截断标记 + 轴标注写明区间。）
 *
 * 证据层（混合）：step 1+ 实验支持 / Table 2；step 4 额外 解读推断。
 * 两种 badge 同屏，infer 视觉明显更弱 —— 这是证据层核心示范。
 * class 走共享 <Evidence>（ev-badge / ev-locator / ev-citation），
 * 样式由 src/styles/evidence.css 提供。
 *
 * ── Composition ──
 * split-screen：两根柱子严格 A vs B（基线 vs 本文），左右等权对峙。
 * 三项及以上的对照请改用别的构图（见 paper-ablation 的 asymmetric-60-40）。
 */

// 纵轴：准确率 0–100，诚实线性映射（柱高 % === 数值 / AXIS_MAX）。
const AXIS_MAX = 100;
const barHeight = (v: number) => `${(v / AXIS_MAX) * 100}%`;

const PRIOR = { label: "Prior", value: 71.4 };
const OURS = { label: "Ours", value: 86.2 };
const TICKS = [100, 50, 0];

export default function PaperExperimentChart({ step }: ChapterStepProps) {
  const showPrior = step >= 1;
  const showOurs = step >= 2;
  const showDelta = step >= 3;
  const showFairness = step >= 4;

  return (
    <div className="pe-scene scene-pad" data-composition="split-screen">
      <div className="ev-citation label-mono" data-role="annotation">Paper · RoutingNet · arXiv:2406.07223</div>

      {/* step 1+：数据是实验支持 / Table 2 */}
      {step >= 1 && (
        <>
          <span className="ev-badge" data-evidence="supported" data-role="annotation">实验支持</span>
          <span className="ev-locator label-mono" data-role="annotation">Table 2 · §4.1</span>
        </>
      )}
      {/* step 4：讲者评价是解读推断（虚线弱化，与数据分开）—— 多挂一个 badge */}
      {showFairness && (
        <span className="ev-badge pe-ev-2" data-evidence="infer" data-role="annotation">解读推断</span>
      )}

      <header className="pe-head" data-role="secondary">
        <span className="pe-kicker">实验结果</span>
        <h2 className="pe-title">比基线强多少？强得稳不稳？</h2>
      </header>

      {/* chart-dominant：图表 ≥70%，每步只回答一个问题 */}
      <div className="pe-chart" data-role="primary">
        <svg className="pe-axis" viewBox="0 0 100 100" preserveAspectRatio="none">
          <line className="pe-axis-line" x1="6" y1="92" x2="98" y2="92" />
          <line className="pe-axis-line" x1="6" y1="6" x2="6" y2="92" />
        </svg>
        {/* 刻度：把"0 到 100"真的画出来，观众能自己验柱高 */}
        <div className="pe-ticks label-mono" data-role="annotation">
          {TICKS.map((t) => (
            <span key={t} className="pe-tick">{t}</span>
          ))}
        </div>

        <div className="pe-bars">
          {/* 基线柱先长（step 1） */}
          <div className="pe-col">
            {showDelta && <span className="pe-delta">基线</span>}
            <div className="pe-bar-track">
              <div className="pe-bar pe-prior" style={{ height: showPrior ? barHeight(PRIOR.value) : 0 }} />
              {showDelta && <span className="pe-whisker">±0.4</span>}
            </div>
            <span className="pe-value">{showPrior ? PRIOR.value.toFixed(1) : ""}</span>
            <span className="pe-col-label label-mono">{PRIOR.label}</span>
          </div>

          {/* 本文柱（step 2），更高 —— 同一把 0–100 的尺子 */}
          <div className="pe-col pe-col-ours">
            {showDelta && <span className="pe-delta pe-delta-ours">+14.8</span>}
            <div className="pe-bar-track">
              <div className="pe-bar pe-ours" style={{ height: showOurs ? barHeight(OURS.value) : 0 }} />
              {showDelta && <span className="pe-whisker">±0.3</span>}
            </div>
            <span className="pe-value">{showOurs ? OURS.value.toFixed(1) : ""}</span>
            <span className="pe-col-label label-mono">{OURS.label}</span>
          </div>
        </div>
      </div>

      {showFairness && (
        <p className="pe-fairness" data-role="secondary">
          数据是真的强。但注意——基线是两年前的老方法，这个对比公不公平，<em>是我的看法</em>，不是论文的结论。
        </p>
      )}
    </div>
  );
}
