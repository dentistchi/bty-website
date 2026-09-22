import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { classifyBtyHref } from "./btyDestination";

/**
 * Slice No-Browser-Escape V1 — SOURCE-LEVEL guards for the two regressions that cannot be caught
 * by exercising the transport, because they are about what the product WRITES into a link.
 *
 * Deliberately scans the source tree rather than a diff: a `git diff` guard passes vacuously on a
 * clean tree and misfires on the next unrelated slice, so it protects nothing over time.
 */

const ROOT = join(process.cwd(), "src");
const ORIGIN = "https://arena.btydaily.com";

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.tsx?$/.test(entry) && !/\.test\.tsx?$/.test(entry)) out.push(full);
  }
  return out;
}

describe("the bot opens the app, not a web page", () => {
  it("the proactive notification's Open BTY link is a Personal App link", () => {
    const src = readFileSync(join(ROOT, "lib/bty/announcement/notifyRecipient.server.ts"), "utf8");
    expect(src).toContain("buildPersonalAppLink");
    /*
      The exact shape of the original defect: a bare BTY web address used AS the link. It may still
      appear as the `origin` argument and as a last-resort fallback, so the assertion is about the
      assignment that made it the destination.
    */
    expect(src).not.toMatch(/const OPEN_URL = "https:\/\/arena\.btydaily\.com\/?";/);
  });
});

describe("product code does not scatter absolute BTY web URLs", () => {
  it("no shell surface links to an absolute arena.btydaily.com destination", () => {
    const surfaces = [join(ROOT, "components/app-shell"), join(ROOT, "components/foundry")];
    const offenders: string[] = [];
    for (const dir of surfaces) {
      for (const file of walk(dir)) {
        const src = readFileSync(file, "utf8");
        // An absolute BTY URL inside an href/window.open is a browser handoff by construction.
        for (const m of src.matchAll(/(href=|window\.open\(|openLink\()\s*[{("'`]*\s*(https:\/\/arena\.btydaily\.com[^"'`)\s]*)/g)) {
          offenders.push(`${file.replace(ROOT, "src")} → ${m[2]}`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });
});

describe("the known regression points keep classifying as BTY_INTERNAL", () => {
  const cases: [string, RegExp][] = [
    /*
      The Center reflection link MOVED from the My Learning list to the training detail (Slice My
      Learning Simplification). The destination and the containment rule are unchanged — it is
      still a real anchor to an in-shell `/app?tab=center` address — so this case follows it rather
      than being deleted.
    */
    ["components/foundry/event-rooms/FoundryMyLearning.tsx", /reflectionHref=\{`(\/\$\{loc\}\/app\?tab=center[^`]*)`\}/],
    ["components/foundry/event-rooms/FoundryCompletionReview.tsx", /href=\{`(\/\$\{loc\}\/app\?tab=today[^`]*)`\}/],
    ["components/app-shell/TodayPersonalBrief.tsx", /href=\{`(\/\$\{locale\}\/app\?tab=today[^`]*)`\}/],
    ["components/app-shell/FieldActionForm.tsx", /href=\{`(\/\$\{loc\}\/app\?tab=foundry[^`]*)`\}/],
  ];

  it.each(cases)("%s still targets a shell destination", (rel, pattern) => {
    const src = readFileSync(join(ROOT, rel), "utf8");
    const match = src.match(pattern);
    expect(match, `no internal /app link found in ${rel}`).toBeTruthy();
    // Substitute the template holes with a real locale/id to classify the concrete href.
    const href = match![1].replace(/\$\{loc\}|\$\{locale\}/g, "ko").replace(/\$\{[^}]+\}/g, "x");
    expect(classifyBtyHref(href, ORIGIN), href).toBe("shell");
  });
});

describe("the completion-code surface is gone from My Learning", () => {
  it("renders no code field, hint, or Add it button", () => {
    const src = readFileSync(join(ROOT, "components/foundry/event-rooms/FoundryMyLearning.tsx"), "utf8");
    for (const gone of ["my-learning-claim", "claimInput", "claimState", "submitClaim", "XXXX-XXXX-XXXX"]) {
      expect(src, gone).not.toContain(gone);
    }
  });
});
