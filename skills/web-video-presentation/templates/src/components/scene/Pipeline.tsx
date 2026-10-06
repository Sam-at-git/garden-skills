// Pipeline — 横向流程条：阶段 + 箭头。active 点亮当前，之前的算 done，之后的 todo（弱化）。
//
//   <Pipeline stages={[{ label: "Schema linking" }, { label: "生成 SQL", sub: "LLM" }, { label: "执行" }]} active={step - 1} role="primary" />
import { Fragment, useRef, type ReactNode } from "react";
import { useFitZoom } from "./fit";
import type { RoleProps } from "./common";
import { cx, delayStyle, focusClass, focusStyle } from "./common";
import type { FocusAt } from "./common";

export function Pipeline({
  stages, active, states, focusAt, role, delay, className,
}: RoleProps & {
  focusAt?: FocusAt;
  stages: { label: ReactNode; sub?: ReactNode }[];
  /** 当前阶段下标（0 起）；未给则全部 idle */
  active?: number;
  /** 显式每段状态，优先于 active */
  states?: ("idle" | "active" | "done" | "todo")[];
}) {
  const st = (i: number) => states?.[i] ?? (active === undefined ? "idle" : i < active ? "done" : i === active ? "active" : "todo");
  // 放不下就整条按宽度等比缩小（字、框、箭头一起缩），不在单词中间断开
  const ref = useRef<HTMLDivElement>(null);
  useFitZoom(ref, "width", 0.55, [stages.length]);
  return (
    <div className="sc-pipeline-fit" data-role={role}>
    <div ref={ref} className={cx("sc-pipeline sc-stagger", className)} style={delayStyle(delay)}>
      {stages.map((s, i) => (
        <Fragment key={i}>
          <div className={cx("sc-stage", `sc-stage-${st(i)}`, focusClass(focusAt, i))} style={focusStyle(focusAt, i, { "--i": i * 2 } as any)}>
            <div className="sc-stage-label">{s.label}</div>
            {s.sub && <div className="sc-stage-sub">{s.sub}</div>}
          </div>
          {i < stages.length - 1 && (
            <svg className="sc-stage-arrow" viewBox="0 0 48 24" style={{ "--i": i * 2 + 1 } as any} aria-hidden>
              <path d="M2 12 H34" /><polygon points="34,4 46,12 34,20" />
            </svg>
          )}
        </Fragment>
      ))}
    </div>
    </div>
  );
}
