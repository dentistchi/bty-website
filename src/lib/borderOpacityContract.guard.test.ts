import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

/**
 * TWO TAILWIND CLASSES THAT DO NOT EXIST — a source guard (sweep of 2026-09-02).
 *
 * ★ `border-white/8` and `border-white/12` COMPILE TO NOTHING.
 *
 * Tailwind 3.4.19 with this repo's default opacity scale has no `8` or `12` step (the scale runs
 * 0, 5, 10, 20, 25, 30 …), and these are written `/8` rather than `/[0.08]`, so the JIT generates
 * NO rule and raises NO error. The class silently does not exist.
 *
 * WHAT THE BROWSER DREW INSTEAD, measured rather than assumed: `rgb(229, 231, 235)` — Tailwind
 * PREFLIGHT's own `border-color` default, gray-200, at FULL opacity. Not `currentColor`, which is
 * the usual folk explanation. On BTY's navy ground that is a bright, opaque edge where a barely
 * visible hairline was intended, and it was live on 47 files across the whole product.
 *
 * The defect is invisible to every other gate: there is no build error, no type error, no failing
 * assertion, and the class name reads as though it works. Only compiled CSS or a screenshot shows
 * it. That is precisely why the ban lives here rather than in a reviewer's memory.
 *
 * THIS BANS EXACTLY TWO TOKENS, NOT A POLICY. `border-white/10`, `/20`, `/25`, `border-white/15`
 * and every arbitrary-alpha form are valid, emit correctly, and are deliberately untouched — a
 * general Tailwind linter is a different job with a different blast radius.
 *
 * SCOPE: production source only. Tests are excluded because they do not ship — and because this
 * file must state the banned tokens literally in order to prove it can still catch them, which
 * would otherwise make the guard flag itself.
 *
 * Comments are stripped too: two files legitimately QUOTE the old string while recording an
 * earlier defect's history, and rewriting a historical record to match today's code would falsify
 * it. A class in prose renders nothing.
 */

const ROOT = join(process.cwd(), "src");

/** Source with comments stripped — assertions must target real code, never prose about it. */
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

/** `/8` not followed by another digit or `[`, so `border-white/80` is never mistaken for it. */
const INVALID_8 = /border-white\/8(?![0-9[])/;
const INVALID_12 = /border-white\/12(?![0-9])/;
/** Anything the build actually emits: a scale step, or an arbitrary alpha. */
const ANY_BORDER_OPACITY = /border-white\/(?:\[[0-9.]+\]|\d+)/;

describe("★ border-white/8 and border-white/12 emit no CSS and are banned in source", () => {
  const files = walk(ROOT);

  it("no source file uses either invalid token", () => {
    const offenders: string[] = [];
    for (const { file, src } of files) {
      const c = code(src);
      if (INVALID_8.test(c)) offenders.push(`${file}  (border-white/8)`);
      if (INVALID_12.test(c)) offenders.push(`${file}  (border-white/12)`);
    }
    expect(
      offenders,
      `These classes compile to NOTHING, so the element falls back to Tailwind preflight's ` +
        `opaque gray-200 border. Use border-white/[0.08] and border-white/[0.12], which emit ` +
        `rgb(255 255 255/.08) and rgb(255 255 255/.12).\n  ` + offenders.join("\n  "),
    ).toEqual([]);
  });

  it("the guard is not vacuous — it really did inspect border-opacity classes", () => {
    // If a refactor ever moves these utilities out of `src`, this fails loudly rather than
    // leaving a green test that scans nothing.
    const inspected = files.filter(({ src }) => ANY_BORDER_OPACITY.test(code(src)));
    expect(files.length).toBeGreaterThan(100);
    expect(inspected.length, "no file with a border-white opacity class was scanned").toBeGreaterThan(30);
  });

  it("the valid replacements are present in source, so the sweep is real", () => {
    const withFixed = files.filter(({ src }) => /border-white\/\[0\.(08|12)\]/.test(code(src)));
    expect(withFixed.length).toBeGreaterThan(30);
  });

  it("does NOT ban valid opacity utilities", () => {
    for (const valid of ["border-white/10", "border-white/15", "border-white/20", "border-white/25"]) {
      expect(INVALID_8.test(valid)).toBe(false);
      expect(INVALID_12.test(valid)).toBe(false);
    }
    // The near-misses a naive substring match would wrongly flag.
    expect(INVALID_8.test("border-white/80")).toBe(false);
    expect(INVALID_8.test("border-white/[0.08]")).toBe(false);
    expect(INVALID_12.test("border-white/120")).toBe(false);
    expect(INVALID_12.test("border-white/[0.12]")).toBe(false);
    // ...while still catching the real thing inside a realistic class string.
    expect(INVALID_8.test("rounded-xl border border-white/8 bg-white/[0.02]")).toBe(true);
    expect(INVALID_12.test("rounded-lg border border-white/12 px-3")).toBe(true);
  });
});
