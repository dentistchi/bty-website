import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { applyNarration } from "./foundryApplyWindowService";

/**
 * R4-R5C9A — the SERVER half: one outcome, mapped once, never re-derived.
 *
 * R4-R5C9 measured that the terminal's only forward-looking sentence describes a follow-up —
 * something BTY does TO the learner — while the product expects them to ACT during those days.
 * The fix narrates, and it may narrate only what the server actually did.
 */

const EVENTS = join(process.cwd(), "src/lib/bty/foundry/events");
const code = (s: string) =>
  s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
const read = (f: string) => readFileSync(join(EVENTS, f), "utf8");
const SERVICES = ["foundryTrainingService.ts", "foundryDocumentService.ts", "foundryGuidanceService.ts"];

describe("T1/T2/T3/T4/T12 — the outcome mapping", () => {
  it("T1 — created narrates", () => expect(applyNarration("created")).toEqual({ applyWindow: "created" }));
  it("T2/T12 — exists narrates identically in kind (state, not mutation history)", () =>
    expect(applyNarration("exists")).toEqual({ applyWindow: "exists" }));
  it("T3 — skipped says nothing", () => expect(applyNarration("skipped")).toEqual({}));
  it("T4 — error says nothing", () => expect(applyNarration("error")).toEqual({}));

  it("the absent cases spread to NOTHING, so no key reaches the client", () => {
    expect(Object.keys({ ok: true, ...applyNarration("skipped") })).toEqual(["ok"]);
    expect(Object.keys({ ok: true, ...applyNarration("error") })).toEqual(["ok"]);
  });
});

describe("T5/T6 — absence is produced by the materializer's own four conditions", () => {
  const svc = code(readFileSync(join(EVENTS, "foundryApplyWindowService.ts"), "utf8"));
  it("T6 — no account, no window", () => {
    expect(svc).toContain('if (!authUserId || !progressId || !eventId) return "skipped";');
  });
  it("T5 — no decision, no window", () => {
    expect(svc).toContain('if (decision.length < 1) return "skipped";');
  });
  it("the frozen journey still decides, not the answer's presence", () => {
    expect(svc).toContain("if (!journeyActionDecision(mod?.module_snapshot?.realityGroundedJourneyV1)) return \"skipped\";");
  });
  it("completion is still required", () => {
    expect(svc).toContain('if (!prog?.completed_at) return "skipped";');
  });
});

describe("T13/T18/T19 — plumbing, in all three families", () => {
  it("T13 — every service keeps the result and maps it through the ONE helper", () => {
    for (const f of SERVICES) {
      const c = code(read(f));
      expect(c, f).toContain("let applyWindowResult: MaterializeApplyResult");
      // Both call sites captured — completion AND the late authenticated claim.
      expect((c.match(/applyWindowResult = await materializeApplyWindow/g) ?? []).length, f).toBe(2);
      expect(c, f).toContain("...applyNarration(applyWindowResult)");
      // No second mapping anywhere.
      expect(c, f).not.toMatch(/applyWindow:\s*"(created|exists)"/);
    }
  });

  it("T18 — the server never re-derives readiness from decision text or auth", () => {
    for (const f of SERVICES) {
      const c = code(read(f));
      const line = c.split("\n").filter((l) => l.includes("applyNarration("));
      for (const l of line) expect(l, f).not.toMatch(/decision|authUserId|follow_up|xp_/);
    }
  });

  it("T19 — no private learner text was added to the response to support narration", () => {
    for (const f of SERVICES) {
      const c = code(read(f));
      // The completion result carries a snapshot, a claim outcome and the apply outcome. No text.
      expect(c, f).not.toMatch(/return \{ ok: true[^;]*decision_response_text/);
      expect(c, f).not.toMatch(/return \{ ok: true[^;]*response_text/);
    }
  });

  it("T15 — Today's projection is untouched by this slice", () => {
    const today = readFileSync(join(process.cwd(), "src/lib/bty/daily/todayReminders.server.ts"), "utf8");
    expect(today).toContain('category: "APPLY_DUE"');
    expect(today).toContain("title: decision.slice(0, 200)");
    expect(today).toContain("suppressApplyWindow({ followUpIsAsking");
    expect(code(today)).not.toMatch(/applyNarration|applyWindowResult/);
  });

  it("Apply semantics themselves are unchanged", () => {
    const dom = readFileSync(join(process.cwd(), "src/domain/foundry/apply-window/applyWindow.ts"), "utf8");
    expect(dom).toContain("export const APPLY_WINDOW_DAYS = 7 as const;");
    const svc = code(readFileSync(join(EVENTS, "foundryApplyWindowService.ts"), "utf8"));
    expect(svc).toContain("p_apply_days: APPLY_WINDOW_DAYS");
  });

  it("T10 — no migration was added", () => {
    const migs = readdirSync(join(process.cwd(), "supabase/migrations"))
      .filter((f) => /^\d{14}/.test(f) && f.slice(0, 8) > "20260826");
    expect(migs).toEqual([]);
  });
});

describe("routes forward the outcome, and stay otherwise unchanged", () => {
  const ROUTES = ["progress/complete", "doc/complete", "guidance/complete", "progress/claim-xp", "doc/claim-xp", "guidance/claim-xp"];
  it("all six serialize it", () => {
    for (const r of ROUTES) {
      const c = readFileSync(join(process.cwd(), "src/app/api/bty/foundry/public/[token]", r, "route.ts"), "utf8");
      expect(c, r).toContain("applyWindow: r.applyWindow");
    }
  });
  it("the guidance claim route's pre-existing snake_case field is left exactly as it was", () => {
    const c = readFileSync(join(process.cwd(), "src/app/api/bty/foundry/public/[token]/guidance/claim-xp/route.ts"), "utf8");
    expect(c).toContain("assignment_claim: r.assignmentClaim ?? null");
  });
});
