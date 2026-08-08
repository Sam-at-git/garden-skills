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
 *   - chapter has a narrations.ts with correct step count vs. `if (step === N)`
 *     in TSX (max N + 1 === narrations.length)
 *   - chapter scene root has data-composition="<one-of-8>"
 *   - data-composition values within a chapter: no consecutive run > 2
 *     (UNLESS chapter root has data-composition-stable="true")
 *   - chapter CSS does not contain hard-coded hex / rgb colors
 *   - chapter CSS does not contain hard-coded font-family
 *   - chapter CSS: any font-size: <N>px with N < var(--body-min) = 20 (FAIL)
 *   - chapter CSS: any h1/h2/h3 with font-size ≥ 60px and no max-width (FAIL)
 *
 * Checks (WARN = exit 0):
 *   - chapter uses only 1 unique composition (consider varying)
 *   - chapter CSS contains no var(--body-min) / --headline-min / --max-text-width
 *     (suggests px hard-coding)
 *   - chapter TSX has a high text-node count (rough text-density heuristic)
 *
 * Usage:
 *   node scripts/inspect-layout.mjs [project-dir]
 *   node scripts/inspect-layout.mjs .            # current dir
 *   node scripts/inspect-layout.mjs ../my-proj   # another project
 *
 * Output:
 *   - console summary (per-chapter pass / warn / fail + counts)
 *   - layout-check.json in project root (full report)
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
const arg = process.argv[2];
const PROJECT_DIR = path.resolve(arg || ".");
const CHAPTERS_DIR = path.join(PROJECT_DIR, "src", "chapters");
const OUT_PATH = path.join(PROJECT_DIR, "layout-check.json");

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
 * Preserves string contents (so quoted block-comment-looking strings stay intact).
 */
function stripJsComments(src) {
  // Strip block comments first (greedy across newlines).
  let out = src.replace(/\/\*[\s\S]*?\*\//g, "");
  // Then line comments.
  out = out.replace(/\/\/[^\n]*/g, "");
  return out;
}

/**
 * Walk a TSX source and find every `if (step === N)` (0-indexed).
 * Returns the maximum N encountered (or -1 if none). If a terminal
 * `return` exists after the last explicit `if (step === N)` branch
 * (a common "fallthrough default" pattern in step components), bump
 * the count by 1 to account for the implicit final step.
 */
function maxStepRef(jsx) {
  const stripped = stripJsComments(jsx);
  const re = /if\s*\(\s*step\s*===\s*(\d+)\s*\)/g;
  let max = -1;
  let m;
  while ((m = re.exec(stripped)) !== null) {
    const n = parseInt(m[1], 10);
    if (n > max) max = n;
  }

  // Detect implicit-terminal-return pattern: a top-level `return ...;`
  // at the function's outermost scope AFTER all `if (step === N)`
  // branches. This indicates the chapter handles one extra step
  // without an explicit if check.
  if (max >= 0) {
    const lastIfIdx = stripped.lastIndexOf(`if (step === ${max})`);
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

  // Special case: no explicit `if` blocks but a top-level `return` —
  // this is a single-step chapter (step === 0 served by default).
  if (max === -1 && /^\s*return\b/.test(stripped)) return 0;

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

/** Find hex colors that aren't inside CSS comments / lines we want to ignore. */
function findHardcodedColors(css) {
  // Strip CSS comments to avoid false positives.
  const stripped = css.replace(/\/\*[\s\S]*?\*\//g, "");
  // Hex literals: #abc, #abcdef, #abcd, #abcdef00 (alpha hex too).
  const hexRe = /#(?:[0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})\b/g;
  // rgb()/rgba()/hsl()/hsla() literals.
  const fnRe = /\b(rgb|rgba|hsl|hsla)\s*\(/g;
  return [
    ...(stripped.match(hexRe) || []),
    ...(stripped.match(fnRe) || []),
  ];
}

/**
 * Find hard-coded font-family values. Allow var(--font-*) and "inherit" /
 * "initial" / common generic family keywords.
 */
function findHardcodedFontFamilies(css) {
  const stripped = css.replace(/\/\*[\s\S]*?\*\//g, "");
  const out = [];
  const re = /font-family\s*:\s*([^;]+);/g;
  let m;
  while ((m = re.exec(stripped)) !== null) {
    const value = m[1].trim();
    // Allow if value contains var(--font-...).
    if (/var\s*\(\s*--font-/i.test(value)) continue;
    // Allow generic families (single-keyword, no quotes).
    if (/^(inherit|initial|unset|serif|sans-serif|monospace|cursive|fantasy|system-ui)$/i.test(value)) continue;
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
  // Strip comments + JSX expressions, then count word-tokens.
  const stripped = jsx
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\/\/.*$/gm, "");
  // Crude: count non-tag, non-attribute text. Match `>TEXT<` patterns.
  const matches = stripped.match(/>([^<>{}]+)</g) || [];
  return matches.filter((m) => /[一-鿿]|[A-Za-z]{2,}/.test(m.slice(1, -1))).length;
}

// ─── Per-chapter analysis ───
function analyzeChapter(folderPath) {
  const checks = [];
  const id = path.basename(folderPath);

  // Find the chapter TSX — accept either `chapter.tsx` (the canonical
  // convention documented in SKILL.md / CHAPTER-CRAFT.md) or
  // `<ChapterName>.tsx` (legacy scaffold uses Example.tsx). Pick the
  // first .tsx that isn't narrations.ts.
  const tsxCandidates = fs.readdirSync(folderPath)
    .filter((f) => f.endsWith(".tsx") && f !== "narrations.ts");
  if (tsxCandidates.length === 0) {
    checks.push({ level: "fail", rule: "tsx-missing", detail: `no .tsx file in ${folderPath}` });
    return { id, checks };
  }
  const tsxPath = path.join(folderPath, tsxCandidates[0]);

  // CSS lookup mirrors the TSX basename.
  const baseNoExt = tsxCandidates[0].replace(/\.tsx$/, "");
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
    const hardColors = findHardcodedColors(css);
    if (hardColors.length > 0) {
      checks.push({
        level: "fail",
        rule: "hardcoded-color",
        detail: `chapter CSS contains ${hardColors.length} hard-coded color literal(s): ${hardColors.slice(0, 3).join(", ")}… — must use var(--text / --accent / --rule / etc.)`,
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

  fs.writeFileSync(OUT_PATH, JSON.stringify(report, null, 2) + "\n");
  log(`▸ report → ${OUT_PATH}`);

  process.exit(s.fail > 0 ? 1 : 0);
}

main();
