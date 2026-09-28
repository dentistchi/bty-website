/**
 * APPLY ACTION DAY V1 — the learner's token travels ONE road: completion route → complete* service
 * → the completion-path materializeApplyWindow. Claim / reload / retry paths must NOT carry it
 * (no durable second timing store exists; a window created there keeps the 7-day rule).
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const read = (p: string) => readFileSync(p, "utf8");

describe("apply_action wiring", () => {
  it.each(["progress", "guidance", "doc"])("the %s completion route forwards body.apply_action", (r) => {
    expect(read(`src/app/api/bty/foundry/public/[token]/${r}/complete/route.ts`)).toContain("body?.apply_action");
  });

  it.each(["foundryTrainingService.ts", "foundryGuidanceService.ts", "foundryDocumentService.ts"])(
    "%s passes the token to exactly ONE materializeApplyWindow call — the completion path",
    (f) => {
      const src = read(`src/lib/bty/foundry/events/${f}`);
      const calls = src.split("materializeApplyWindow(admin, {").slice(1).map((c) => c.slice(0, c.indexOf("});")));
      const carrying = calls.filter((c) => c.includes("actionChoice"));
      expect(carrying).toHaveLength(1);
      expect(carrying[0]).toContain("completedAtIso: now");
      expect(carrying[0]).toContain("actionChoice: rawApplyAction");
    },
  );

  it("no progress-row column or second store holds the action day", () => {
    for (const f of ["foundryTrainingService.ts", "foundryGuidanceService.ts", "foundryDocumentService.ts"]) {
      expect(read(`src/lib/bty/foundry/events/${f}`)).not.toMatch(/action_bty_day|apply_action_day/);
    }
  });
});
