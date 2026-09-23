import { describe, expect, it } from "vitest";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
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

describe("the bot links nowhere at all", () => {
  /*
    REVERSED, ON DEVICE EVIDENCE. This once asserted that "Open BTY" must be a Personal App entity
    link rather than a web address. A fresh real-iPhone tap proved BOTH are wrong: an entity link
    302s to Microsoft's `dl/launcher` web page, so the Teams client is left before BTY is evaluated
    either way. There is no bot-side route into the personal app, so the bot carries no BTY link.
  */
  it("the proactive notification carries no link of any kind", () => {
    const src = readFileSync(join(ROOT, "lib/bty/announcement/notifyRecipient.server.ts"), "utf8");
    expect(src).not.toContain("buildPersonalAppLink");
    expect(src).not.toMatch(/const OPEN_URL =/);
    const msg = readFileSync(join(ROOT, "domain/teams/proactiveMessage.ts"), "utf8");
    expect(msg).not.toContain("openUrl");
    expect(msg).not.toContain("Open BTY");
  });

  it("no card action anywhere opens a URL", () => {
    /*
      Comments are stripped first: an explanation of why `Action.OpenUrl` must not be used is not
      an occurrence of it, and a guard that cannot tell those apart forces the reasoning out of
      the file it belongs in.
    */
    const code = (file: string) => readFileSync(file, "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
    for (const file of walk(join(ROOT, "domain/teams")).concat(walk(join(ROOT, "lib/bty/foundry/teams")))) {
      expect(code(file), file.replace(ROOT, "src")).not.toContain("Action.OpenUrl");
    }
  });

  it("the personal-app link builder is gone, so it cannot be reused by accident", () => {
    expect(existsSync(join(ROOT, "domain/teams/personalAppLink.ts"))).toBe(false);
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
