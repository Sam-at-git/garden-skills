// Evidence.tsx — the paper-mode evidence layer.
//
// Every on-screen claim in a paper-interpretation video is one of four
// things, and the viewer is entitled to know which:
//
//   fact        the paper states it            → cite §X
//   supported   an experiment in it shows it   → cite Fig Y / Table Z
//   infer       the narrator concluded it      → no locator, visually weaker
//   background  textbook knowledge or the narrator's own analogy, brought in
//               to make a concept land (PAPER-INTERPRETATION.md §2.5). Not in
//               the paper — but not a claim about it either → no locator.
//
// infer vs background: would a different narrator say something different?
// Yes → infer (a judgement). No → background (common knowledge). When torn,
// pick infer; overstating your own voice is safer than understating it.
//
// Keeping "the paper proved this" visually distinct from "I think this" and
// from "here is the background you need" is the whole point — see
// references/PAPER-INTERPRETATION.md §3.
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
//   (CitationChip is retired — renders nothing; don't mount it.)
//
// Evidence lives in its own file — NOT in narrations.ts. extract-narrations.ts
// throws on any narration that isn't a plain string, and narrations.ts is the
// source of truth for the audio pipeline.
//
// Styling is in styles/evidence.css: token-only, no new hues. A theme can
// retune the three by overriding --ev-fact / --ev-supported / --ev-infer.

export type ClaimType = "fact" | "supported" | "infer" | "background";

export interface EvidenceMark {
  /** 0-indexed, matching the chapter's own step numbering. */
  step: number;
  type: ClaimType;
  /** "§3.2" | "Fig 4" | "Table 2" | "Eq 7".
   *  Required for `fact` / `supported`; MUST be null for `infer` /
   *  `background` — neither is in the paper, so neither may point at one of
   *  its section numbers. */
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
  background: "背景知识",
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

/** Retired: the top-left citation line crowded the chapter title. Kept as a
 *  no-op so chapters that still mount it compile and render nothing — the
 *  paper's name / authors / id belong in the cold-open narration instead. */
export function CitationChip(_props: { citation: Citation }) {
  return null;
}
