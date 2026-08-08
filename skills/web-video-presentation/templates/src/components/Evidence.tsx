// Evidence.tsx — the paper-mode evidence layer.
//
// Every on-screen claim in a paper-interpretation video is one of three
// things, and the viewer is entitled to know which:
//
//   fact       the paper states it            → cite §X
//   supported  an experiment in it shows it   → cite Fig Y / Table Z
//   infer      the narrator concluded it      → no locator, visually weaker
//
// Keeping "the paper proved this" visually distinct from "I think this"
// is the whole point — see references/PAPER-INTERPRETATION.md §3.
//
// Usage: one `evidence.ts` per chapter, next to the chapter component.
//
//   // src/chapters/03-method/evidence.ts
//   import type { EvidenceMark } from "../../components/Evidence";
//   export const citation = { title: "…", authors: "…", venue: "arXiv:…" };
//   export const evidence: EvidenceMark[] = [
//     { step: 1, type: "fact",      locator: "§3.2",    note: "…" },
//     { step: 2, type: "supported", locator: "Table 2", note: "GLUE +4.6" },
//     { step: 3, type: "infer",     locator: null,      note: "我的解读：…" },
//   ];
//
//   // in the chapter component
//   <Evidence step={step} marks={evidence} />
//   <CitationChip citation={citation} />
//
// Evidence lives in its own file — NOT in narrations.ts. extract-narrations.ts
// throws on any narration that isn't a plain string, and narrations.ts is the
// source of truth for the audio pipeline.
//
// Styling is in styles/evidence.css: token-only, no new hues. A theme can
// retune the three by overriding --ev-fact / --ev-supported / --ev-infer.

export type ClaimType = "fact" | "supported" | "infer";

export interface EvidenceMark {
  /** 0-indexed, matching the chapter's own step numbering. */
  step: number;
  type: ClaimType;
  /** "§3.2" | "Fig 4" | "Table 2" | "Eq 7". Only `infer` may be null. */
  locator: string | null;
  /** Short note on the claim this step puts on screen. Not rendered. */
  note?: string;
}

export interface Citation {
  title: string;
  authors: string;
  venue: string;
}

const LABEL: Record<ClaimType, string> = {
  fact: "论文事实",
  supported: "实验支持",
  infer: "解读推断",
};

/** Badge + locator for whichever mark belongs to the current step. */
export function Evidence({ step, marks }: { step: number; marks: EvidenceMark[] }) {
  const mark = marks.find((m) => m.step === step);
  if (!mark) return null;
  return (
    <>
      <span className="ev-badge" data-evidence={mark.type}>
        {LABEL[mark.type]}
      </span>
      {mark.locator && (
        <span className="ev-locator label-mono" data-evidence={mark.type}>
          {mark.locator}
        </span>
      )}
    </>
  );
}

/** Corner chip naming the paper. Mount it from the first step so the source
 *  is on screen before any claim is — pairs with the cold-open (§2.1). */
export function CitationChip({ citation }: { citation: Citation }) {
  return (
    <div className="ev-citation label-mono">
      <span className="ev-cit-title">{citation.title}</span>
      <span className="ev-cit-dot">·</span>
      <span>{citation.authors}</span>
      <span className="ev-cit-dot">·</span>
      <span>{citation.venue}</span>
    </div>
  );
}
