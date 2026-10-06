// EndCredits — 片尾：「谢谢收看」+ 作者（像电影片尾一样逐个浮现）+ 参考文献滚动。
//
// 不是章节：App 在最后一章最后一步之后再「下一步」时切到这里，所以不占 narrations、
// 不进步数统计，各道闸、音频管线、script:drift 都不受影响。
//
// 数据在 src/credits.json（流水线 80-build 前由 extract-credits 生成；脚手架给的是空壳）：
//   { "title": "…", "authors": ["…"], "references": ["…"] }
// 全空也能用 —— 只剩「谢谢收看」。
//
// 参考文献：窗口固定 6 行，整列从窗口下沿匀速向上滚，最后一条到达窗口下沿后停住；
// 窗口上沿用 mask 渐隐。整页 5 秒内放完：条数少按片尾速度（ROW_SEC 一行），条数多就
// 加速到塞进 ROLL_MAX_MS；超过 MAX_ROLL_REFS 条只滚前面这些，末尾一行「…… 等 N 篇」
// （再多就快到看不清了）。总时长写到 window.__presentationCredits，录屏据此等片尾放完再停。
import type React from "react";
import { useEffect } from "react";

export interface Credits {
  title?: string;
  authors?: string[];
  references?: string[];
}

const ROWS = 6; // 同时显示的条数
const ROW_H = 46; // px，一行的高度（字号 22）
const ROW_SEC = 0.6; // 条数少时每滚过一行用的秒数
const ROLL_DELAY_MS = 1000; // 「谢谢收看」和作者浮现后开始滚
const ROLL_MAX_MS = 3500; // 滚动最多用这么久 —— 条数多就加速（整页 ≤ 5 秒）
const HOLD_MS = 500; // 滚完停留
const AUTHORS_SPAN_MS = 600; // 作者逐个浮现的总跨度（人多就缩短间隔）
const MAX_AUTHORS = 24;
const MAX_ROLL_REFS = 24; // 最多滚这么多条：24 条 + 「等 N 篇」一行塞进 3.5 秒 ≈ 每秒 7 条

/** 实际要滚的行数：全部文献，或前 MAX_ROLL_REFS 条 + 「等 N 篇」一行 */
function rollRows(n: number): number {
  return n > MAX_ROLL_REFS ? MAX_ROLL_REFS + 1 : n;
}

function rollMs(n: number): number {
  return Math.min(n * ROW_SEC * 1000, ROLL_MAX_MS);
}

/** 片尾总时长（ms）：录屏据此判断放完没有 */
export function creditsDurationMs(c: Credits): number {
  const n = (c.references ?? []).filter(Boolean).length;
  if (!n) return 2000; // 只有「谢谢收看」和作者：浮现完就算放完
  return ROLL_DELAY_MS + rollMs(rollRows(n)) + HOLD_MS;
}

export function EndCredits({ credits }: { credits: Credits }) {
  const authors = (credits.authors ?? []).filter(Boolean);
  const shown = authors.slice(0, MAX_AUTHORS);
  const more = authors.length - shown.length;
  const refs = (credits.references ?? []).filter(Boolean);
  const n = refs.length;
  const rolled = n > MAX_ROLL_REFS ? refs.slice(0, MAX_ROLL_REFS) : refs;
  const rows = rollRows(n);
  // 从「整列在窗口下方」滚到「最后一行贴窗口下沿」：位移恰好一个列高
  const winH = ROWS * ROW_H;
  const from = winH;
  const to = winH - rows * ROW_H;
  const rollSec = rollMs(rows) / 1000;
  const stagger = Math.min(90, AUTHORS_SPAN_MS / Math.max(1, authors.length));
  const total = creditsDurationMs(credits);

  useEffect(() => {
    const w = window as unknown as { __presentationCredits?: { active: boolean; durationMs: number; startedAt: number } };
    w.__presentationCredits = { active: true, durationMs: total, startedAt: performance.now() };
    return () => {
      w.__presentationCredits = { active: false, durationMs: total, startedAt: 0 };
    };
  }, [total]);

  return (
    <div className="scene ec-scene" data-composition="centered-hero" data-credits="">
      <h1 className="ec-thanks" data-role="primary">谢谢收看</h1>
      {credits.title && <div className="ec-title">{credits.title}</div>}
      {shown.length > 0 && (
        <div className="ec-block">
          <div className="ec-label">作者</div>
          <div className="ec-authors">
            {shown.map((a, i) => (
              <span key={i} className="ec-author" style={{ "--i": i, "--ec-stagger": `${stagger}ms` } as React.CSSProperties}>{a}</span>
            ))}
            {more > 0 && <span className="ec-author ec-more" style={{ "--i": shown.length, "--ec-stagger": `${stagger}ms` } as React.CSSProperties}>等 {authors.length} 位</span>}
          </div>
        </div>
      )}
      {n > 0 && (
        <div className="ec-block ec-refs-block">
          <div className="ec-label">参考文献 · {n} 篇</div>
          <div className="ec-refs" style={{ height: winH } as React.CSSProperties}>
            <ol
              className="ec-refs-list"
              style={{
                "--ec-from": `${from}px`,
                "--ec-to": `${to}px`,
                "--ec-roll": `${rollSec}s`,
                "--ec-delay": `${ROLL_DELAY_MS}ms`,
                "--ec-row": `${ROW_H}px`,
              } as React.CSSProperties}
            >
              {rolled.map((r, i) => (
                <li key={i} className="ec-ref">
                  <span className="ec-ref-n">{i + 1}</span>
                  <span className="ec-ref-t">{r}</span>
                </li>
              ))}
              {n > rolled.length && (
                <li className="ec-ref ec-ref-more">
                  <span className="ec-ref-n" />
                  <span className="ec-ref-t">…… 等 {n} 篇</span>
                </li>
              )}
            </ol>
          </div>
        </div>
      )}
    </div>
  );
}
