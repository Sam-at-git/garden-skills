#!/usr/bin/env node
/**
 * inspect-layout.mjs — static layout QA for web-video-presentation chapters.
 *
 * Scans every chapter folder under src/chapters/, parses the TSX + CSS,
 * and emits a JSON report + console summary. No puppeteer / no DOM — pure
 * source analysis. This is fast, zero-dependency, and catches the most
 * common visual QA issues BEFORE you open a browser.
 *
 * Checks (FAIL = exit 1):
 *   - chapter has a narrations.ts with correct step count vs. the highest
 *     step number referenced in the TSX (max N + 1 === narrations.length).
 *     Step references are recognised in all the usual shapes:
 *       `if (step === N)`, `step >= N`, `step > N`, `step <= N`, `step < N`,
 *       JSX inline `{step >= N && ...}` / ternaries, and `switch (step)`
 *       + `case N:`.
 *   - chapter scene root has data-composition="<one-of-8>"
 *   - data-composition values within a chapter: no consecutive run > 2
 *     (UNLESS chapter root has data-composition-stable="true")
 *   - chapter CSS does not contain hard-coded NON-NEUTRAL hex colors
 *   - chapter CSS does not contain hard-coded font-family literals
 *     (any `var(--...)` reference is fine — theme tokens are the contract)
 *   - chapter CSS: any font-size: <N>px with N < var(--body-min) = 20 (FAIL)
 *   - chapter CSS: any h1/h2/h3 with font-size ≥ 60px and no max-width (FAIL)
 *
 * Checks (WARN = exit 0):
 *   - chapter uses only 1 unique composition (consider varying)
 *   - chapter CSS uses a non-neutral rgb()/hsl() literal outside a var()
 *     fallback (suggest a token or color-mix())
 *   - chapter CSS contains no var(--body-min) / --headline-min / --max-text-width
 *     (suggests px hard-coding)
 *   - chapter TSX has a high text-node count (rough text-density heuristic)
 *   - chapter folder holds more than one candidate component .tsx
 *
 * Color escape hatches (NOT reported at all):
 *   - any color literal sitting in a `var(--token, <fallback>)` fallback slot
 *     — that is the correct "token first, literal as backstop" idiom
 *   - pure neutrals (r === g === b, or hsl with 0% saturation) — black/white
 *     scrims, veils and shadows carry no theme identity
 *
 * Usage:
 *   node scripts/inspect-layout.mjs [project-dir] [--json [path]]
 *   node scripts/inspect-layout.mjs .                      # current dir
 *   node scripts/inspect-layout.mjs ../my-proj             # another project
 *   node scripts/inspect-layout.mjs . --json report.json   # also write JSON
 *
 * Output:
 *   - console summary (per-chapter pass / warn / fail + counts)
 *   - a JSON report ONLY when --json is passed (nothing is written to the
 *     project root by default, so there is nothing to .gitignore)
 *
 * Exit codes:
 *   0  all chapters pass
 *   1  at least one FAIL
 *   2  bad invocation (missing dir, unreadable files)
 *
 * See references/VISUAL-QA.md §2 for the rules this implements.
 */

import fs from "node:fs";
import path from "node:path";
import process from "node:process";

// ─── Constants ───
const COMPOSITIONS = new Set([
  "centered-hero",
  "asymmetric-60-40",
  "split-screen",
  "rule-of-thirds",
  "full-width-strip",
  "layered-depth",
  "triptych",
  "diagram-canvas",
]);
const BODY_MIN_PX = 20;
const HEADLINE_MIN_PX = 60;
const MAX_TEXT_DENSITY_WARN = 40;
const MAX_CONSECUTIVE_SAME_COMPOSITION = 2;

// ─── CLI args ───
// Positional: project dir (default "."). Flag: --json [path] — when present
// (and only then) the full report is written to disk. Without it the script
// leaves no artifact behind, so no .gitignore entry is required.
function parseArgs(argv) {
  let dir = null;
  let json = null; // null = don't write; string = path
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--json") {
      const next = argv[i + 1];
      if (next && !next.startsWith("-")) { json = next; i++; }
      else json = ""; // resolved to the default path once PROJECT_DIR is known
    } else if (a.startsWith("--json=")) {
      json = a.slice("--json=".length) || "";
    } else if (a.startsWith("-")) {
      err(`✗ unknown flag: ${a}`);
      err(`  → usage: node scripts/inspect-layout.mjs [project-dir] [--json [path]]`);
      process.exit(2);
    } else if (dir === null) {
      dir = a;
    }
  }
  return { dir: dir || ".", json };
}

const ARGS = parseArgs(process.argv.slice(2));
const PROJECT_DIR = path.resolve(ARGS.dir);
const CHAPTERS_DIR = path.join(PROJECT_DIR, "src", "chapters");
// An explicit --json path resolves against the CWD (what the caller typed);
// bare --json falls back to <project>/layout-check.json.
const OUT_PATH = ARGS.json === null
  ? null
  : ARGS.json
    ? path.resolve(ARGS.json)
    : path.join(PROJECT_DIR, "layout-check.json");

// ─── Helpers ───
function log(msg) { process.stdout.write(msg + "\n"); }
function err(msg) { process.stderr.write(msg + "\n"); }

function walkChapters(root) {
  if (!fs.existsSync(root)) {
    err(`✗ Chapter directory not found: ${root}`);
    err(`  → pass the project root as the first arg, e.g. \`node scripts/inspect-layout.mjs ./my-project\``);
    process.exit(2);
  }
  return fs.readdirSync(root, { withFileTypes: true })
    .filter((d) => d.isDirectory() && /^\d{2}-/.test(d.name))
    .map((d) => d.name)
    .sort();
}

/**
 * Strip JS line + block comments from a TSX/JS source string.
 *
 * This is a real character scanner, not a regex pass: it tracks single-quoted,
 * double-quoted and template strings (honouring backslash escapes) and only
 * removes line/block comment markers that occur OUTSIDE a string. That matters
 * because narration text routinely contains URLs — a naive global regex
 * replace of "slash slash to end of line" turns
 *     "看 https://arxiv.org/abs/2401.00001 这篇"
 * into
 *     "看 https:
 * which unbalances the quote and cascades into a bogus step-count mismatch.
 *
 * Comment bodies are replaced with an equivalent run of spaces/newlines so
 * that byte offsets (used by the step-reference locator) stay meaningful.
 */
function stripJsComments(src) {
  let out = "";
  let i = 0;
  const n = src.length;

  while (i < n) {
    const ch = src[i];

    // ── String / template literal: copy through verbatim ──
    if (ch === '"' || ch === "'" || ch === "`") {
      const quote = ch;
      out += ch;
      i++;
      while (i < n) {
        const c = src[i];
        if (c === "\\") {
          // Escape pair — copy both chars, never let the 2nd terminate.
          out += src.slice(i, i + 2);
          i += 2;
          continue;
        }
        out += c;
        i++;
        if (c === quote) break;
        // ' and " cannot span lines. Bail on newline so a stray apostrophe
        // in prose (e.g. `don't`) can't swallow the rest of the file.
        if (quote !== "`" && c === "\n") break;
      }
      continue;
    }

    // ── Line comment (but not a URL scheme's `://`) ──
    if (ch === "/" && src[i + 1] === "/") {
      if (src[i - 1] === ":") {
        // `https://…` sitting in bare JSX text, not a comment.
        out += "//";
        i += 2;
        continue;
      }
      while (i < n && src[i] !== "\n") { out += " "; i++; }
      continue;
    }

    // ── Block comment ──
    if (ch === "/" && src[i + 1] === "*") {
      i += 2;
      out += "  ";
      while (i < n && !(src[i] === "*" && src[i + 1] === "/")) {
        out += src[i] === "\n" ? "\n" : " ";
        i++;
      }
      if (i < n) { out += "  "; i += 2; }
      continue;
    }

    out += ch;
    i++;
  }

  return out;
}

/**
 * Locate the LAST `if (step === N)` statement for a given N, tolerating any
 * whitespace style (`if(step===2)`, `if ( step === 2 )`, `==` as well as
 * `===`). Returns its byte offset, or -1.
 *
 * The old code matched the reference with a lax regex but then re-located it
 * with an exact literal `lastIndexOf("if (step === N)")` — so a chapter
 * written as `if(step===2)` silently skipped the implicit-final-step
 * compensation below. Both now go through the same lenient matcher.
 */
function lastIfStepEqualsIndex(src, n) {
  const re = new RegExp(`if\\s*\\(\\s*step\\s*===?\\s*${n}\\s*\\)`, "g");
  let last = -1;
  let m;
  while ((m = re.exec(src)) !== null) last = m.index;
  return last;
}

/**
 * Collect every step number referenced by a `switch (step)` statement's
 * `case N:` labels. Brace-matches the switch body so unrelated `case`
 * labels elsewhere in the file aren't harvested.
 */
function switchStepCases(src) {
  const found = [];
  const head = /switch\s*\(\s*step\s*\)\s*\{/g;
  let m;
  while ((m = head.exec(src)) !== null) {
    let depth = 1;
    let i = m.index + m[0].length;
    const start = i;
    while (i < src.length && depth > 0) {
      if (src[i] === "{") depth++;
      else if (src[i] === "}") depth--;
      i++;
    }
    const body = src.slice(start, i);
    const caseRe = /\bcase\s+(\d+)\s*:/g;
    let c;
    while ((c = caseRe.exec(body)) !== null) found.push(parseInt(c[1], 10));
  }
  return found;
}

/**
 * Walk a TSX source and find the highest step index it branches on (0-indexed).
 *
 * Real chapters express step gating in many shapes, and only counting
 * `if (step === N)` made `maxStep` collapse to -1 for most of them — which
 * then reported every chapter as a step-count mismatch. Recognised forms:
 *
 *   if (step === N) { … }          // statement branch (any whitespace)
 *   {step >= N && <Foo/>}          // JSX inline conditional
 *   step > N ? a : b               // ternary
 *   const on = step <= N           // any comparison, either operand order
 *   switch (step) { case N: … }    // switch dispatch
 *
 * Returns the maximum N encountered, or -1 if the source never mentions step.
 * If a terminal `return` exists after the last explicit `if (step === N)`
 * branch (the "fallthrough default" pattern), bump by 1 for the implicit
 * final step.
 */
function maxStepRef(jsx) {
  const stripped = stripJsComments(jsx);
  let max = -1;
  const bump = (n) => { if (Number.isFinite(n) && n > max) max = n; };

  // `step <op> N` — ===, ==, >=, <=, >, <
  const fwd = /\bstep\s*(?:===|==|>=|<=|>|<)\s*(\d+)/g;
  let m;
  while ((m = fwd.exec(stripped)) !== null) bump(parseInt(m[1], 10));

  // `N <op> step` — the mirrored spelling (e.g. `2 <= step`).
  const rev = /(\d+)\s*(?:===|==|>=|<=|>|<)\s*step\b/g;
  while ((m = rev.exec(stripped)) !== null) bump(parseInt(m[1], 10));

  // `switch (step) { case N: … }`
  for (const n of switchStepCases(stripped)) bump(n);

  // Detect implicit-terminal-return pattern: a top-level `return ...;`
  // at the function's outermost scope AFTER all `if (step === N)`
  // branches. This indicates the chapter handles one extra step
  // without an explicit if check.
  if (max >= 0) {
    const lastIfIdx = lastIfStepEqualsIndex(stripped, max);
    if (lastIfIdx !== -1) {
      const after = stripped.slice(lastIfIdx);
      // Find the closing brace of the if-block.
      let depth = 0;
      let sawOpen = false;
      let endOfIf = -1;
      for (let i = 0; i < after.length; i++) {
        if (after[i] === "{") { depth++; sawOpen = true; }
        else if (after[i] === "}") {
          depth--;
          if (sawOpen && depth === 0) { endOfIf = lastIfIdx + i; break; }
        }
      }
      if (endOfIf !== -1) {
        const tail = stripped.slice(endOfIf + 1);
        // If the tail (after stripping whitespace) starts with `return`
        // (i.e. no more if statements, no more branches), bump count.
        if (/^\s*return\b/.test(tail)) {
          return max + 1;
        }
      }
    }
  }

  // Special case: no step branching at all but the component returns
  // something — a single-step chapter (step 0 served by default).
  // NOTE: needs the `m` flag; the source always starts with imports, so an
  // unanchored `^` could never match and this branch was dead code.
  if (max === -1 && /^\s*return\b/m.test(stripped)) return 0;

  return max;
}

/**
 * Extract every `data-composition="..."` attribute value from TSX.
 * In source order. Multiple matches (rare) returned as-is.
 */
function dataCompositions(jsx) {
  const stripped = stripJsComments(jsx);
  const out = [];
  const re = /data-composition="([^"]+)"/g;
  let m;
  while ((m = re.exec(stripped)) !== null) out.push(m[1]);
  return out;
}

function dataCompositionStable(jsx) {
  const stripped = stripJsComments(jsx);
  return /data-composition-stable="(true|1)"/i.test(stripped);
}

function dataRoles(jsx) {
  const stripped = stripJsComments(jsx);
  const out = [];
  const re = /data-role="([^"]+)"/g;
  let m;
  while ((m = re.exec(stripped)) !== null) out.push(m[1]);
  return out;
}

/**
 * Byte ranges covered by `var(...)` calls, so a literal used as a token
 * FALLBACK can be recognised and allowed:
 *
 *     background: var(--scrim, rgba(0, 0, 0, .5));
 *
 * That is the *correct* idiom (token first, literal as a backstop), not a
 * theme violation, so anything inside those parens is exempt.
 */
function varCallSpans(css) {
  const spans = [];
  const re = /\bvar\s*\(/g;
  let m;
  while ((m = re.exec(css)) !== null) {
    let depth = 1;
    let i = m.index + m[0].length;
    while (i < css.length && depth > 0) {
      if (css[i] === "(") depth++;
      else if (css[i] === ")") depth--;
      i++;
    }
    spans.push([m.index, i]);
  }
  return spans;
}

function inSpans(idx, spans) {
  return spans.some(([a, b]) => idx >= a && idx < b);
}

/** True for a hex literal whose R, G and B channels are equal (pure neutral). */
function isNeutralHex(hex) {
  const h = hex.slice(1);
  if (h.length === 3 || h.length === 4) return h[0] === h[1] && h[1] === h[2];
  if (h.length === 6 || h.length === 8) {
    return h.slice(0, 2).toLowerCase() === h.slice(2, 4).toLowerCase()
      && h.slice(2, 4).toLowerCase() === h.slice(4, 6).toLowerCase();
  }
  return false;
}

/**
 * True for a color function that carries no hue — black / white / grey at any
 * alpha. These are the scrims, veils and drop-shadows every chapter needs and
 * they don't encode theme identity, so they get a pass.
 */
function isNeutralColorFn(name, args) {
  const parts = args.split(/[,/]/).map((s) => s.trim()).filter(Boolean);
  if (name.startsWith("hsl")) {
    // Neutral when saturation is 0 (grey axis).
    return parts.length >= 2 && /^0%?$/.test(parts[1]);
  }
  // rgb()/rgba(): r === g === b (unit-agnostic string compare after
  // normalising trivial formatting).
  if (parts.length < 3) return false;
  const [r, g, b] = parts.slice(0, 3).map((s) => s.replace(/\s+/g, ""));
  return r === g && g === b;
}

/**
 * Find hard-coded color literals in chapter CSS.
 *
 * Returns { fails, warns } rather than one flat list, because a blanket FAIL
 * on `rgb|rgba|hsl|hsla` swept up legitimate code — `box-shadow: 0 2px 8px
 * rgba(0,0,0,.2)` and even `var(--scrim, rgba(0,0,0,.5))`. Alpha shadows and
 * scrims are load-bearing, so:
 *
 *   - inside a var() fallback  → allowed (not reported)
 *   - pure neutral (r=g=b)     → allowed (not reported)
 *   - other hex literal        → FAIL (a real theme color hard-coded)
 *   - other color function     → WARN + a concrete suggestion
 */
function findHardcodedColors(css) {
  const stripped = css.replace(/\/\*[\s\S]*?\*\//g, "");
  const spans = varCallSpans(stripped);
  const fails = [];
  const warns = [];

  // Hex literals: #abc, #abcd, #abcdef, #abcdef00.
  const hexRe = /#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{3,4})\b/g;
  let m;
  while ((m = hexRe.exec(stripped)) !== null) {
    if (inSpans(m.index, spans)) continue;
    if (isNeutralHex(m[0])) continue;
    fails.push(m[0]);
  }

  // rgb()/rgba()/hsl()/hsla() literals, with their argument list.
  const fnRe = /\b(rgba?|hsla?)\s*\(([^()]*)\)/g;
  while ((m = fnRe.exec(stripped)) !== null) {
    if (inSpans(m.index, spans)) continue;
    if (isNeutralColorFn(m[1].toLowerCase(), m[2])) continue;
    warns.push(`${m[1]}(${m[2].trim()})`);
  }

  return { fails, warns };
}

/**
 * Find hard-coded font-family values.
 *
 * ANY `var(--...)` reference is accepted, not just `var(--font-*)`: the theme
 * contract also ships composed tokens such as `--hero-num-font` (see
 * references/THEMES.md and src/styles/base.css), which the old `--font-`
 * prefix test flagged as hard-coded. Only literal family names
 * (`font-family: Inter, sans-serif`) are reported.
 */
function findHardcodedFontFamilies(css) {
  const stripped = css.replace(/\/\*[\s\S]*?\*\//g, "");
  const out = [];
  const re = /font-family\s*:\s*([^;}]+)/g;
  let m;
  while ((m = re.exec(stripped)) !== null) {
    const value = m[1].trim();
    // Allow any custom-property reference — theme tokens are the contract.
    if (/var\s*\(\s*--/i.test(value)) continue;
    // Allow generic families (single-keyword, no quotes).
    if (/^(inherit|initial|revert|unset|serif|sans-serif|monospace|cursive|fantasy|system-ui|ui-monospace|ui-serif|ui-sans-serif)$/i.test(value)) continue;
    out.push(value);
  }
  return out;
}

/**
 * Find `font-size: <N>px` literals smaller than the body floor.
 * Returns array of { selector, value, line } — selector is best-effort
 * (line context back to the nearest `{`).
 */
function findSubfloorFontSizes(css) {
  const stripped = css.replace(/\/\*[\s\S]*?\*\//g, "");
  const out = [];
  // Match font-size in any selector block — naive but works.
  const blockRe = /([^{}]+)\{([^{}]*)\}/g;
  let m;
  while ((m = blockRe.exec(stripped)) !== null) {
    const selector = m[1].trim().split("\n").pop().trim();
    const body = m[2];
    const sizeRe = /font-size\s*:\s*(\d+)\s*px/g;
    let s;
    while ((s = sizeRe.exec(body)) !== null) {
      const px = parseInt(s[1], 10);
      if (px < BODY_MIN_PX && px !== 0) {
        out.push({ selector, value: `${px}px` });
      }
    }
  }
  return out;
}

/**
 * Find `h1/h2/h3` (and other hero text classes) with font-size ≥
 * HEADLINE_MIN_PX and no max-width declaration in the same block.
 */
function findHeadlinesWithoutMaxWidth(css) {
  const stripped = css.replace(/\/\*[\s\S]*?\*\//g, "");
  const out = [];
  const blockRe = /([^{}]+)\{([^{}]*)\}/g;
  let m;
  while ((m = blockRe.exec(stripped)) !== null) {
    const selector = m[1].trim();
    const body = m[2];
    if (!/\bh[12]\b|\bhero\b|\bdisplay\b/i.test(selector)) continue;
    const sizeMatch = body.match(/font-size\s*:\s*(\d+)\s*px/);
    if (!sizeMatch) continue;
    const px = parseInt(sizeMatch[1], 10);
    if (px < HEADLINE_MIN_PX) continue;
    if (/max-width\s*:/i.test(body)) continue;
    out.push({ selector, value: `${px}px` });
  }
  return out;
}

/** True if chapter CSS uses any density token. */
function usesDensityTokens(css) {
  return /var\s*\(\s*--(body-min|headline-min|data-min|max-text-width|max-title-width)/.test(css);
}

/**
 * Count narration entries in a narrations.ts source.
 *
 * Approach: locate the `narrations: Narration[] = [` (or `narrations = [`)
 * declaration, then count top-level comma-separated entries inside the
 * array literal. Strips comments first. Empty strings count as entries
 * (silent steps).
 */
function countNarrationEntries(src) {
  const stripped = stripJsComments(src);
  // Find the array start.
  const openMatch = stripped.match(/narrations(?:\s*:\s*[^=]+)?\s*=\s*\[/);
  if (!openMatch) return 0;
  const openIdx = openMatch.index + openMatch[0].length;
  // Walk braces, tracking nesting and string boundaries.
  let depth = 1;
  let i = openIdx;
  let entryCount = 0;
  let lastNonWs = "";
  let currentEntry = "";
  while (i < stripped.length && depth > 0) {
    const ch = stripped[i];
    if (ch === "[") depth++;
    else if (ch === "]") {
      depth--;
      if (depth === 0) {
        if (currentEntry.trim() !== "") entryCount++;
        break;
      }
    } else if (ch === "," && depth === 1) {
      // End of an entry. Empty entries (consecutive commas) don't count.
      if (currentEntry.trim() !== "") entryCount++;
      currentEntry = "";
    } else if (ch === '"' || ch === "'" || ch === "`") {
      // Skip a string literal in full.
      const quote = ch;
      i++;
      while (i < stripped.length && stripped[i] !== quote) {
        if (stripped[i] === "\\") i++; // skip escape
        i++;
      }
      currentEntry += "x"; // mark as non-empty
    } else {
      currentEntry += ch;
    }
    i++;
  }
  return entryCount;
}

/** Rough text-node density: count JSX text fragments inside return tree. */
function roughTextNodeCount(jsx) {
  // Strip comments (string-aware — a URL in narration text is not a comment),
  // then count word-tokens.
  const stripped = stripJsComments(jsx);
  // Crude: count non-tag, non-attribute text. Match `>TEXT<` patterns.
  const matches = stripped.match(/>([^<>{}]+)</g) || [];
  return matches.filter((m) => /[一-鿿]|[A-Za-z]{2,}/.test(m.slice(1, -1))).length;
}

/**
 * Pick the chapter's entry component out of a folder, deterministically.
 *
 * The old rule was `f.endsWith(".tsx") && f !== "narrations.ts"` — the second
 * clause is vacuously true (a .tsx is never narrations.ts) — and then took
 * whatever readdirSync happened to return first, so a chapter with a helper
 * component could be analysed against the wrong file depending on FS order.
 *
 * Precedence, first match wins, ties broken alphabetically:
 *   1. `chapter.tsx`                         — the documented convention
 *   2. `<folder-id>.tsx` / `<PascalCaseId>.tsx` (with the NN- prefix stripped)
 *   3. `index.tsx`
 *   4. any file starting with an uppercase letter (React component convention)
 *   5. alphabetically first remaining candidate
 *
 * Helper/partial files (leading `_`) and test/story files are never eligible.
 * Returns { file, others } or null.
 */
function pickChapterTsx(folderPath, id) {
  const all = fs.readdirSync(folderPath)
    .filter((f) => f.endsWith(".tsx"))
    .filter((f) => !/\.(test|spec|stories)\.tsx$/i.test(f))
    .filter((f) => !f.startsWith("_"))
    .sort();
  if (all.length === 0) return null;

  const slug = id.replace(/^\d+-/, "");
  const pascal = slug.split(/[-_ ]+/)
    .filter(Boolean)
    .map((w) => w[0].toUpperCase() + w.slice(1))
    .join("");

  const tiers = [
    (f) => f === "chapter.tsx",
    (f) => f === `${slug}.tsx` || f.toLowerCase() === `${pascal.toLowerCase()}.tsx`,
    (f) => f === "index.tsx",
    (f) => /^[A-Z]/.test(f),
    () => true,
  ];

  for (const match of tiers) {
    const hit = all.find(match);
    if (hit) return { file: hit, others: all.filter((f) => f !== hit) };
  }
  return null;
}

// ─── Per-chapter analysis ───
function analyzeChapter(folderPath) {
  const checks = [];
  const id = path.basename(folderPath);

  // Find the chapter TSX (see pickChapterTsx for the precedence rules).
  const picked = pickChapterTsx(folderPath, id);
  if (!picked) {
    checks.push({ level: "fail", rule: "tsx-missing", detail: `no chapter .tsx file in ${folderPath}` });
    return { id, checks };
  }
  if (picked.others.length > 0) {
    checks.push({
      level: "warn",
      rule: "tsx-ambiguous",
      detail: `${picked.others.length + 1} component .tsx files in ${id}/ — analysing ${picked.file} (ignoring ${picked.others.join(", ")}). Name the entry \`chapter.tsx\` to make this unambiguous.`,
    });
  }
  const tsxPath = path.join(folderPath, picked.file);

  // CSS lookup mirrors the TSX basename.
  const baseNoExt = picked.file.replace(/\.tsx$/, "");
  const cssPath = path.join(folderPath, `${baseNoExt}.css`);
  const narPath = path.join(folderPath, "narrations.ts");

  if (!fs.existsSync(cssPath)) {
    checks.push({ level: "warn", rule: "css-missing", detail: `no ${baseNoExt}.css at ${cssPath}` });
  }

  const tsx = fs.readFileSync(tsxPath, "utf8");
  const css = fs.existsSync(cssPath) ? fs.readFileSync(cssPath, "utf8") : "";

  // 1. narrations.ts presence + step count.
  if (!fs.existsSync(narPath)) {
    checks.push({ level: "fail", rule: "narrations-missing", detail: `no narrations.ts` });
  } else {
    const narSrc = fs.readFileSync(narPath, "utf8");
    const narLen = countNarrationEntries(narSrc);
    const maxStep = maxStepRef(tsx);
    const expected = maxStep + 1;
    if (expected !== narLen) {
      checks.push({
        level: "fail",
        rule: "step-count-mismatch",
        detail: `narrations has ${narLen} entries but TSX max step is ${maxStep} → expected ${expected}`,
      });
    } else {
      checks.push({ level: "pass", rule: "step-count", detail: `${narLen} steps aligned` });
    }
  }

  // 2. data-composition present + valid value.
  const compositions = dataCompositions(tsx);
  if (compositions.length === 0) {
    checks.push({
      level: "fail",
      rule: "composition-present",
      detail: "no data-composition attribute on scene root — see VISUAL-DIRECTION.md §1",
    });
  } else {
    const valid = compositions.every((c) => COMPOSITIONS.has(c));
    if (!valid) {
      const bad = compositions.filter((c) => !COMPOSITIONS.has(c));
      checks.push({
        level: "fail",
        rule: "composition-value",
        detail: `unknown composition(s): ${bad.join(", ")} — must be one of: ${[...COMPOSITIONS].join(", ")}`,
      });
    } else {
      checks.push({ level: "pass", rule: "composition-value", detail: `composition: ${compositions[0]}` });
    }
  }

  // 3. Consecutive same composition.
  const stable = dataCompositionStable(tsx);
  const counts = new Map();
  if (!stable) {
    let run = 1;
    let maxRun = 1;
    for (let i = 1; i < compositions.length; i++) {
      if (compositions[i] === compositions[i - 1]) {
        run++;
        if (run > maxRun) maxRun = run;
      } else {
        run = 1;
      }
    }
    // We don't know how many step branches use each composition from
    // a single attribute (the attribute is on the shared root) — this
    // check only fires when MULTIPLE distinct data-composition attributes
    // exist in the TSX, which happens when a chapter splits steps via
    // branch. Single root = no run to count.
    if (compositions.length > 1 && maxRun > MAX_CONSECUTIVE_SAME_COMPOSITION) {
      checks.push({
        level: "fail",
        rule: "composition-variety",
        detail: `max consecutive same composition run = ${maxRun} (limit ${MAX_CONSECUTIVE_SAME_COMPOSITION}); consider data-composition-stable="true" if intentional (ablation / comparison series)`,
      });
    }
  } else {
    checks.push({ level: "pass", rule: "composition-stable", detail: `chapter marked stable — skip rhythm check` });
  }
  counts.set("compositions_seen", compositions.length);

  // 4. Hard-coded colors / fonts in chapter CSS.
  if (css) {
    const { fails: hardColors, warns: softColors } = findHardcodedColors(css);
    if (hardColors.length > 0) {
      checks.push({
        level: "fail",
        rule: "hardcoded-color",
        detail: `chapter CSS contains ${hardColors.length} hard-coded color literal(s): ${hardColors.slice(0, 3).join(", ")}${hardColors.length > 3 ? "…" : ""} — must use var(--text / --accent / --rule / etc.)`,
      });
    }
    if (softColors.length > 0) {
      checks.push({
        level: "warn",
        rule: "tinted-color-literal",
        detail: `chapter CSS has ${softColors.length} tinted color function(s) outside a var() fallback: ${softColors.slice(0, 3).join(", ")}${softColors.length > 3 ? "…" : ""} — prefer a token, \`var(--token, <literal>)\`, or \`color-mix(in oklab, var(--accent) 30%, transparent)\`. (Pure black/white/grey scrims and shadows are exempt.)`,
      });
    }
    const hardFonts = findHardcodedFontFamilies(css);
    if (hardFonts.length > 0) {
      checks.push({
        level: "fail",
        rule: "hardcoded-font",
        detail: `chapter CSS contains ${hardFonts.length} hard-coded font-family value(s) — must use var(--font-display-cn / --font-body / --font-mono)`,
      });
    }

    // 5. Subfloor font-size.
    const subfloor = findSubfloorFontSizes(css);
    if (subfloor.length > 0) {
      checks.push({
        level: "fail",
        rule: "subfloor-font-size",
        detail: `${subfloor.length} font-size(s) below body-min ${BODY_MIN_PX}px: ${subfloor.slice(0, 3).map((x) => `${x.selector}={${x.value}}`).join(", ")}… — use var(--body-min)`,
      });
    }

    // 6. Headlines without max-width.
    const noMaxWidth = findHeadlinesWithoutMaxWidth(css);
    if (noMaxWidth.length > 0) {
      checks.push({
        level: "fail",
        rule: "headline-no-max-width",
        detail: `${noMaxWidth.length} hero headline(s) ≥ ${HEADLINE_MIN_PX}px without max-width: ${noMaxWidth.slice(0, 3).map((x) => x.selector).join(", ")}… — use max-width: var(--max-title-width) or 24~28ch`,
      });
    }

    // 7. WARN: chapter CSS doesn't consume density tokens.
    if (!usesDensityTokens(css)) {
      checks.push({
        level: "warn",
        rule: "no-density-tokens",
        detail: "chapter CSS doesn't reference any density token (--body-min / --headline-min / --max-text-width / ...) — likely px hard-coding",
      });
    }
  }

  // 8. WARN: rough text-node density.
  const textNodes = roughTextNodeCount(tsx);
  if (textNodes > MAX_TEXT_DENSITY_WARN) {
    checks.push({
      level: "warn",
      rule: "high-text-density",
      detail: `${textNodes} text-bearing nodes in chapter TSX (warn > ${MAX_TEXT_DENSITY_WARN}) — consider splitting into more steps`,
    });
  }

  // 9. WARN: visual roles declared.
  const roles = dataRoles(tsx);
  if (roles.length === 0) {
    checks.push({
      level: "warn",
      rule: "no-data-roles",
      detail: "no data-role attributes on elements — LayoutDebug overlay can't show primary/secondary breakdown",
    });
  } else {
    const uniqueRoles = [...new Set(roles)];
    checks.push({
      level: "pass",
      rule: "data-roles",
      detail: `roles: ${uniqueRoles.join(", ")}`,
    });
  }

  return { id, checks };
}

// ─── Main ───
function main() {
  log(`▸ layout-check · scanning ${CHAPTERS_DIR}`);
  const folders = walkChapters(CHAPTERS_DIR);
  if (folders.length === 0) {
    err(`✗ no chapters found under ${CHAPTERS_DIR}`);
    err(`  → chapters must be named NN-<id>/ (e.g. 01-coldopen/)`);
    process.exit(2);
  }

  const report = { summary: { ok: 0, warn: 0, fail: 0, chapters: folders.length }, chapters: [] };

  for (const folder of folders) {
    const folderPath = path.join(CHAPTERS_DIR, folder);
    const result = analyzeChapter(folderPath);
    result.checks.forEach((c) => {
      if (c.level === "fail") report.summary.fail++;
      else if (c.level === "warn") report.summary.warn++;
      else report.summary.ok++;
    });
    report.chapters.push(result);
  }

  // Console summary.
  log("");
  for (const ch of report.chapters) {
    const fails = ch.checks.filter((c) => c.level === "fail").length;
    const warns = ch.checks.filter((c) => c.level === "warn").length;
    const icon = fails > 0 ? "✗" : warns > 0 ? "!" : "✓";
    log(`${icon} ${ch.id}  (${fails} fail · ${warns} warn)`);
    for (const c of ch.checks) {
      if (c.level === "pass") continue;
      const marker = c.level === "fail" ? "  ✗" : "  !";
      log(`${marker} [${c.rule}] ${c.detail}`);
    }
  }
  log("");
  const s = report.summary;
  log(`▸ ${s.chapters} chapter(s) · ${s.ok} pass · ${s.warn} warn · ${s.fail} fail`);

  // Only write a file when explicitly asked. Writing layout-check.json into
  // the project root by default littered every scaffold with an untracked
  // artifact nobody had .gitignore'd.
  if (OUT_PATH) {
    fs.mkdirSync(path.dirname(OUT_PATH), { recursive: true });
    fs.writeFileSync(OUT_PATH, JSON.stringify(report, null, 2) + "\n");
    log(`▸ report → ${OUT_PATH}`);
  } else if (s.fail > 0 || s.warn > 0) {
    log(`▸ full report: re-run with \`--json layout-check.json\``);
  }

  process.exit(s.fail > 0 ? 1 : 0);
}

main();
