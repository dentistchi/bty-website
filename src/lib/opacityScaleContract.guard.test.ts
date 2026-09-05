import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

/**
 * EVERY TAILWIND OPACITY MODIFIER IN THIS PRODUCT MUST ACTUALLY EXIST. Slice TQ-3.
 *
 * ★ WHAT REPLACED WHAT, AND WHY THE OLD GUARD WAS NOT ENOUGH.
 *
 * `borderOpacityContract.guard.test.ts` banned exactly two literals — `border-white/8` and
 * `border-white/12` — after a 2026-09-02 sweep found them live on 47 files. It said so in its own
 * words: "THIS BANS EXACTLY TWO TOKENS, NOT A POLICY."
 *
 * Measured on 2026-09-05, against the COMPILED stylesheet rather than by reading source: four more
 * of the same defect were live, and the guard could not see any of them, because none of them was
 * one of the two literals:
 *
 *   border-white/14      TodayPersonalBrief  — the Host-attention tag, on TODAY
 *   bg-white/12          MeThisWeek          — the empty-day dot, on ME
 *   border-white/6       BoundaryScopePanel
 *   bg-[#C9A66B]/12      FoundryMyLearning, FoundrySharedReview
 *   bg-[#0B1F3A]/92      FoundryJoinClient
 *
 * The two on Today and Me are surfaces the Founder looks at inside Teams.
 *
 * ★ THE ACTUAL RULE, WHICH IS CHECKABLE.
 *
 * Tailwind 3.4.19 with this repo's default theme has an opacity scale of MULTIPLES OF FIVE, 0
 * through 100. A bare-number modifier outside that scale generates NO rule and raises NO error —
 * verified here against `.next/static/css` when a build is present, and stated as the rule when it
 * is not. So the guard is now the rule itself, not a list of the instances that had been noticed.
 *
 * WHAT THE BROWSER DRAWS INSTEAD depends on the property, which is why this is not cosmetic:
 *   border-*  → Tailwind PREFLIGHT's `border-color` default, `rgb(229 231 235)` — gray-200 at FULL
 *               opacity. On BTY's navy that is a bright opaque box where a hairline was intended.
 *   bg-*      → no background at all; the element silently disappears into its parent.
 *   text-*    → the colour is inherited from an ancestor, so the intended tier is simply lost.
 *
 * Arbitrary alphas (`/[0.14]`) always emit and are the fix, never a workaround.
 *
 * SCOPE: production source only. Tests are excluded — they do not ship, and this file must state
 * the banned shapes literally to prove it can still catch them.
 */

const ROOT = join(process.cwd(), "src");

/** Source with comments stripped — a class named in prose renders nothing. */
const code = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

function walk(dir: string, out: { file: string; src: string }[] = []) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (/\.(ts|tsx)$/.test(e.name) && !/\.(test|spec)\.tsx?$/.test(e.name))
      out.push({ file: p.slice(process.cwd().length + 1), src: readFileSync(p, "utf8") });
  }
  return out;
}

/**
 * A colour utility carrying a BARE-NUMBER opacity modifier, with any variant prefix
 * (`hover:`, `md:`, `group-hover:` …). Arbitrary alphas end in `]` and never match.
 */
const OPACITY_UTILITY =
  /\b(?:[a-z-]+:)*(?:text|bg|border|ring|divide|shadow|from|via|to|fill|stroke|outline|decoration|placeholder|accent|caret)-(?:white|black|\[#[0-9A-Fa-f]{3,8}\])\/(\d+)\b/g;

/** The scale Tailwind actually emits: multiples of five, 0–100. */
export const emitsCss = (step: number) => step % 5 === 0 && step >= 0 && step <= 100;

export function findDeadOpacityUtilities(src: string): string[] {
  const out: string[] = [];
  for (const m of code(src).matchAll(OPACITY_UTILITY)) {
    if (!emitsCss(Number(m[1]))) out.push(m[0]);
  }
  return out;
}

describe("★ a Tailwind opacity step outside the scale emits nothing — banned in source", () => {
  const files = walk(ROOT);

  it("no production source file carries an opacity modifier that compiles to nothing", () => {
    const offenders: string[] = [];
    for (const { file, src } of files) {
      for (const cls of findDeadOpacityUtilities(src)) offenders.push(`${file}  ${cls}`);
    }
    expect(
      offenders,
      "These classes generate NO CSS. A border- falls back to preflight's opaque gray-200, a bg- " +
        "renders no background, a text- silently inherits. Use an arbitrary alpha — border-white/" +
        "[0.14] — or snap to a multiple of five.\n  " + offenders.join("\n  "),
    ).toEqual([]);
  });

  it("the rule matches what the compiled stylesheet actually contains", () => {
    /*
      The rule is asserted against BUILD OUTPUT when one exists, because "multiples of five" is
      itself a claim about Tailwind's theme and this repo has been wrong about that shape before.
      Skipped rather than faked when no build is present — a guard that invents its own evidence is
      worse than one that admits it has none.
    */
    let css = "";
    try {
      const dir = join(process.cwd(), ".next/static/css");
      css = readdirSync(dir).filter((f) => f.endsWith(".css"))
        .map((f) => readFileSync(join(dir, f), "utf8")).join("");
    } catch {
      return;
    }
    if (css.length < 1000) return;
    const has = (cls: string) =>
      css.includes("." + cls.replace(/\[/g, "\\[").replace(/\]/g, "\\]").replace(/#/g, "\\#").replace(/\//g, "\\/"));
    // Present in source and on the scale → emitted.
    for (const valid of ["text-white/45", "text-white/85", "border-white/15", "text-white/35"]) {
      expect(has(valid), `${valid} should emit`).toBe(true);
    }
    // Off the scale → nothing, no matter how reasonable the name looks.
    for (const dead of ["border-white/14", "bg-white/12", "border-white/8", "border-white/6"]) {
      expect(has(dead), `${dead} must NOT emit`).toBe(false);
    }
  });

  it("the guard is not vacuous — it really did scan opacity utilities", () => {
    const inspected = files.filter(({ src }) => /\/(?:\d+)\b/.test(code(src)) && OPACITY_UTILITY.test(code(src)));
    OPACITY_UTILITY.lastIndex = 0;
    expect(files.length).toBeGreaterThan(100);
    expect(inspected.length, "no file with a bare-number opacity class was scanned").toBeGreaterThan(30);
  });

  it("catches the real shapes and never the near-misses", () => {
    expect(findDeadOpacityUtilities('className="rounded border border-white/14 px-2"')).toEqual(["border-white/14"]);
    expect(findDeadOpacityUtilities('className="bg-white/12"')).toEqual(["bg-white/12"]);
    expect(findDeadOpacityUtilities('className="bg-[#C9A66B]/12"')).toEqual(["bg-[#C9A66B]/12"]);
    expect(findDeadOpacityUtilities('className="hover:bg-[#C9A66B]/12"')).toEqual(["hover:bg-[#C9A66B]/12"]);
    // Valid: on the scale, arbitrary, or simply not an opacity modifier at all.
    for (const ok of [
      'className="border-white/10"', 'className="border-white/15"', 'className="border-white/80"',
      'className="border-white/[0.14]"', 'className="bg-white/[0.02]"', 'className="grid-cols-1/2"',
      'className="hover:bg-[#C9A66B]/90"', 'className="text-white/45"',
    ]) expect(findDeadOpacityUtilities(ok), ok).toEqual([]);
    // Prose naming the old defect must not re-trip the guard.
    expect(findDeadOpacityUtilities("/* we used to ship border-white/8 here */")).toEqual([]);
  });

  it("the two originally-swept literals stay banned — this guard supersedes, never relaxes", () => {
    expect(emitsCss(8)).toBe(false);
    expect(emitsCss(12)).toBe(false);
    expect(emitsCss(10)).toBe(true);
    expect(emitsCss(100)).toBe(true);
    expect(emitsCss(105)).toBe(false);
  });
});
