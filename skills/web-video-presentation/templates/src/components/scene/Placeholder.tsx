// Placeholder — 缺素材时的占位卡（不要编数据、不要放无关图）。
import type { RoleProps } from "./common";
import { cx, delayStyle } from "./common";

export function Placeholder({
  label, note, width = 900, ratio = 16 / 9, role, delay, className,
}: RoleProps & { label: string; note?: string; width?: number; ratio?: number }) {
  return (
    <div className={cx("sc-placeholder sc-in", className)} data-role={role} style={delayStyle(delay, { width, height: Math.round(width / ratio) })}>
      <div className="sc-placeholder-label">{label}</div>
      {note && <div className="sc-placeholder-note">{note}</div>}
    </div>
  );
}
