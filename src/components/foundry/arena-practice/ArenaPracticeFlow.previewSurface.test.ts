import { describe, it, expect } from "vitest";
import { readFileSync, existsSync, readdirSync } from "node:fs";
import { join } from "node:path";

/**
 * HOST TEST PREVIEW SURFACE — the prose was painted and never visible.
 *
 * FOUNDER DEVICE, cold restart, live SHA 7bed4216. Practice → 연습 만들기 → "No confirmation
 * calls made" → 학습자로 해보기 → 시작 → "Delay the confirmation calls until after the project".
 * The p2 tradeoff choices rendered — so the right draft loaded, the right branch resolved, and
 * the phase was right — above a large blank space where 그 결과, the consequence, 상황이 더
 * 어려워집니다 and the escalation should have been.
 *
 * NOT A STALE BUNDLE, measured rather than assumed: the live Worker serves
 * `_next/static/chunks/1790-…js` containing both `practice-consequence` and `그 결과`, and the
 * iOS app is a hosted-URL webview loading that same origin.
 *
 * THE WRAPPER WAS THE DEFECT. The test-preview mount used `bg-bty-soft/40`, and `bty-soft` is
 * declared in `tailwind.config.ts` as a bare `var(...)` with no `<alpha-value>` placeholder, so
 * Tailwind v3 cannot compute the alpha and DROPS THE CLASS. The shipped stylesheet carries
 * `.bg-bty-soft` and nothing for `/40`. The preview therefore painted no background at all and
 * inherited the app shell's `bg-[#0B1F3A]`, putting navy prose on navy while the choice cards —
 * which carry their own `bg-white` — stayed perfectly readable.
 *
 * THE REPOSITORY ALREADY KNEW. `ArenaRoom.tsx` recorded it at R4-R5A-R1 closure: "this comment
 * originally cited `ArenaPracticeFlow`'s `bg-bty-soft/40` wrapper as a working precedent this
 * mount was copying. IT IS NOT ONE. … meaning the Host draft preview paints no background
 * either." That slice repaired the learner play surface and left this one, with the finding in a
 * comment on the other file. This is the same repair, on the surface it was written about.
 *
 * SOURCE-LEVEL BY DESIGN. Rendering this flow needs the draft/source fetch sequence mocked, and
 * a browser cannot compute contrast in jsdom anyway. What is decidable — and what actually broke
 * — is which background token the mount asks for. `ArenaRoom.learnerSurface.test.tsx` holds the
 * rendered-containment half for the learner surface; this holds the token contract for the Host
 * one, and pins both to the same value so they cannot drift apart again.
 */

const read = (p: string) => readFileSync(join(process.cwd(), p), "utf8");

/** Comments stripped: this file's own root-cause note quotes the dropped class by name. */
const stripComments = (src: string) => src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

const FLOW = stripComments(read("src/components/foundry/arena-practice/ArenaPracticeFlow.tsx"));
const ROOM = stripComments(read("src/components/app-shell/ArenaRoom.tsx"));
const CONFIG = read("tailwind.config.ts");

/** The wrapper the `mode="test"` mount is rendered inside. */
const previewWrapperClass = (): string => {
  const at = FLOW.indexOf('mode="test"');
  expect(at, 'the test-mode mount should exist in ArenaPracticeFlow').toBeGreaterThan(-1);
  // The enclosing element is the last className opened before the mount.
  const before = FLOW.slice(0, at);
  const m = [...before.matchAll(/className="([^"]*)"/g)].pop();
  return m?.[1] ?? "";
};

/** The wrapper the repaired learner play mount is rendered inside. */
const playWrapperClass = (): string => {
  const at = ROOM.indexOf('mode="play"');
  const before = ROOM.slice(0, at);
  const m = [...before.matchAll(/className="([^"]*)"/g)].pop();
  return m?.[1] ?? "";
};

describe("[Host preview contrast · premise] the token cannot carry an alpha", () => {
  it("bty-soft is a bare var() with no <alpha-value>, so any /NN on it compiles to nothing", () => {
    const soft = CONFIG.match(/soft:\s*"([^"]+)"/)?.[1] ?? "";
    expect(soft).toContain("var(");
    expect(soft).not.toContain("<alpha-value>");
  });
});

describe("[Host preview contrast · T1-T3] the preview is mounted on a surface that exists", () => {
  it("T1 the test-preview wrapper asks for the opaque bty-soft background", () => {
    expect(previewWrapperClass()).toContain("bg-bty-soft");
  });

  it("T2 it carries no alpha modifier — the class that emitted no rule at all", () => {
    expect(previewWrapperClass()).not.toMatch(/bg-bty-soft\/\d/);
    // And the file as a whole no longer references the dropped utility anywhere.
    expect(FLOW).not.toContain("bg-bty-soft/40");
  });

  it("T3 it is the SAME background token the repaired learner surface uses", () => {
    /*
      The invariant, not a colour: both mounts paint the light surface `ArenaPracticePlayer` was
      written for. Pinning them to each other is what stops one being repaired and the other left,
      which is exactly how this defect survived R4-R5A-R1.
    */
    const play = playWrapperClass();
    expect(play).toContain("bg-bty-soft");
    expect(play).not.toMatch(/bg-bty-soft\/\d/);
    const token = (cls: string) => (cls.match(/bg-bty-soft(?:\/\d+)?/) ?? [])[0];
    expect(token(previewWrapperClass())).toBe(token(play));
  });

  it("the compiled stylesheet emits the class the wrapper asks for, and nothing for the alpha form", () => {
    /*
      Runs against the real build output when one is present — the artifact check the dispatch
      asked for. Skipped when the tree has not been built, because a unit run must not require a
      full Next build; `cf:build` in the gate set is where this is guaranteed to have run.
    */
    const dir = join(process.cwd(), ".next/static/css");
    if (!existsSync(dir)) return;
    const css = readdirSync(dir).filter((f) => f.endsWith(".css")).map((f) => read(`.next/static/css/${f}`)).join("");
    expect(css).toContain(".bg-bty-soft{");
    expect(css).not.toContain("bg-bty-soft\\/40");
  });
});
