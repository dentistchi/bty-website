import { describe, it, expect } from "vitest";
import { buildTodayReminders, buildActionStatus } from "./todayReminders.server";

/**
 * Slice 3.1B-3J — deterministic reminder projection over the three canonical owner-scoped sources.
 * A chainable+thenable query stub feeds configured rows per table; no real DB.
 */

function query(data: unknown[]) {
  const obj: Record<string, unknown> = {};
  for (const m of ["select", "eq", "in", "not", "order", "limit"]) obj[m] = () => obj;
  (obj as { then: unknown }).then = (res: (v: { data: unknown[] }) => unknown) => Promise.resolve({ data }).then(res);
  return obj;
}
function mockAdmin(cfg: { assignments?: unknown[]; contracts?: unknown[]; outcomes?: unknown[]; followups?: unknown[] }) {
  return {
    rpc: async () => ({ data: cfg.assignments ?? [] }),
    from: (table: string) =>
      query(
        table === "bty_action_contracts"
          ? (cfg.contracts ?? [])
          : table === "arena_pending_outcomes"
            ? (cfg.outcomes ?? [])
            : table === "foundry_participant_followups"
              ? (cfg.followups ?? [])
              : [],
      ),
  } as never;
}

const now = new Date("2026-07-22T12:00:00Z");

describe("buildTodayReminders", () => {
  it("projects REQUIRED (assigned only), ACTION, PRACTICE — completed excluded, no fake due dates", async () => {
    const admin = mockAdmin({
      assignments: [
        { assignment_id: "a1", status: "assigned", title: "OSHA basics" },
        { assignment_id: "a2", status: "completed", title: "done" },
      ],
      contracts: [{ id: "c1", status: "pending", contract_description: "submit QR", deadline_at: "2026-07-22T04:00:00Z" }],
      outcomes: [{ id: "o1", outcome_title: "replay", scheduled_for: "2026-07-22T20:00:00Z" }],
    });
    const out = await buildTodayReminders(admin, "u1", now, "UTC", "en");
    const ids = out.map((r) => r.stableId);
    expect(ids).toContain("req:a1");
    expect(ids).not.toContain("req:a2"); // completed excluded
    const req = out.find((r) => r.stableId === "req:a1")!;
    expect(req.state).toBe("incomplete_required");
    expect(req.sourceTimestamp).toBeNull(); // NEVER a fabricated deadline
    expect(req.canonicalDeepLink).toBe("/en/app?tab=foundry");
  });

  it("orders overdue first (priority) and every reminder has a canonical deep link", async () => {
    const admin = mockAdmin({
      contracts: [
        { id: "c1", status: "pending", contract_description: "overdue one", deadline_at: "2026-07-22T04:00:00Z" },
        { id: "c2", status: "pending", contract_description: "due later today", deadline_at: "2026-07-22T20:00:00Z" },
      ],
    });
    const out = await buildTodayReminders(admin, "u1", now, "UTC", "en");
    expect(out[0].stableId).toBe("action:c1"); // overdue ranks first
    expect(out[0].state).toBe("overdue");
    expect(out.every((r) => r.canonicalDeepLink.length > 0)).toBe(true);
  });

  it("dedupes a source already surfaced as the primary Today path", async () => {
    const admin = mockAdmin({ contracts: [{ id: "c1", status: "pending", contract_description: "x", deadline_at: "2026-07-22T20:00:00Z" }] });
    const out = await buildTodayReminders(admin, "u1", now, "UTC", "en", new Set(["action:c1"]));
    expect(out.find((r) => r.stableId === "action:c1")).toBeUndefined();
  });

  // REGRESSION (Slice 3.1B-3J.1): the old primary Today card that rendered an open Action Contract as
  // "PROMISE TO CARRY" was removed. With NO suppression set (the brief route no longer suppresses),
  // that same canonical Action Contract must remain discoverable — exactly once — as an ACTION_DUE
  // reminder, so removing the card never hides a real obligation.
  it("keeps the action contract from the removed primary card discoverable as a reminder (no suppression)", async () => {
    const admin = mockAdmin({
      contracts: [{ id: "blk1", status: "pending", contract_description: "submit QR proof", deadline_at: "2026-07-22T20:00:00Z" }],
    });
    const out = await buildTodayReminders(admin, "u1", now, "UTC", "en"); // no suppress arg
    const hits = out.filter((r) => r.stableId === "action:blk1");
    expect(hits).toHaveLength(1); // present, and never duplicated
    expect(hits[0].category).toBe("ACTION_DUE");
    expect(hits[0].canonicalDeepLink.length).toBeGreaterThan(0); // still deep-linkable
  });

  // Slice 3.1B-3L device-gate fix: ACTION_DUE / PRACTICE_DUE reminders must stay INSIDE the 5-tab app
  // shell (the in-shell Arena tab), never the legacy `/{locale}/bty-arena` standalone route that
  // rendered a second app navigation + old practice cards (a shell escape).
  it("(#8/#9/#11) ACTION_DUE + PRACTICE_DUE deep-link to the in-shell Arena tab, never the legacy /bty-arena route", async () => {
    const admin = mockAdmin({
      contracts: [{ id: "c1", status: "pending", contract_description: "submit QR", deadline_at: "2026-07-22T04:00:00Z" }],
      outcomes: [{ id: "o1", outcome_title: "replay", scheduled_for: "2026-07-22T04:00:00Z" }],
    });
    const out = await buildTodayReminders(admin, "u1", now, "UTC", "en");
    const action = out.find((r) => r.stableId === "action:c1")!;
    const practice = out.find((r) => r.stableId === "practice:o1")!;
    expect(action.canonicalDeepLink).toBe("/en/app?tab=arena");
    expect(practice.canonicalDeepLink).toBe("/en/app?tab=arena");
    // Never the legacy standalone route (the shell escape) for ANY reminder.
    expect(out.every((r) => !r.canonicalDeepLink.includes("/bty-arena"))).toBe(true);
    // Every reminder link stays within the canonical /{locale}/app shell.
    expect(out.every((r) => r.canonicalDeepLink.startsWith("/en/app"))).toBe(true);
  });

  // Field Actions Focused Surface V1: a PENDING field_action reminder deep-links to the FOCUSED
  // Field Actions surface under Practice (?tab=practice&fieldAction=), so the Today primary CTA opens
  // the specific action there — never generic Today; a non-field pending keeps the Arena tab.
  it("field_action ACTION_DUE deep-links to the focused Field Actions surface; arena contracts keep the Arena tab", async () => {
    const admin = mockAdmin({
      contracts: [
        { id: "fa1", status: "pending", action_type: "field_action", contract_description: "Apply: module", deadline_at: "2026-07-22T20:00:00Z" },
        { id: "ar1", status: "pending", action_type: "arena_run_completion", contract_description: "arena action", deadline_at: "2026-07-22T20:00:00Z" },
      ],
    });
    const out = await buildTodayReminders(admin, "u1", now, "UTC", "en");
    const fa = out.find((r) => r.stableId === "action:fa1")!;
    const ar = out.find((r) => r.stableId === "action:ar1")!;
    expect(fa.category).toBe("ACTION_DUE");
    expect(fa.canonicalDeepLink).toBe("/en/app?tab=practice&fieldAction=fa1");
    expect(ar.canonicalDeepLink).toBe("/en/app?tab=arena");
    expect(out.every((r) => !r.canonicalDeepLink.includes("/bty-arena"))).toBe(true);
  });

  it("(#10/#16) distinct Action contracts with identical titles stay distinct (unique stableIds), not merged", async () => {
    const admin = mockAdmin({
      contracts: [
        { id: "dup-a", status: "pending", contract_description: "Within 48 hours, schedule a review", deadline_at: "2026-07-22T04:00:00Z" },
        { id: "dup-b", status: "pending", contract_description: "Within 48 hours, schedule a review", deadline_at: "2026-07-22T05:00:00Z" },
      ],
    });
    const out = await buildTodayReminders(admin, "u1", now, "UTC", "en");
    expect(out.filter((r) => r.category === "ACTION_DUE")).toHaveLength(2);
    expect(new Set(out.map((r) => r.stableId)).size).toBe(out.length); // all distinct
  });

  // ===== Slice 3.1B-3M Action Hygiene: classify by STORED status before deadline =====

  it("(1/2) PENDING → ACTION_DUE (overdue past deadline / due_today same BTY day)", async () => {
    const admin = mockAdmin({
      contracts: [
        { id: "p1", status: "pending", contract_description: "overdue pending", deadline_at: "2026-07-22T04:00:00Z", pattern_family: "future_deferral" },
        { id: "p2", status: "pending", contract_description: "due today pending", deadline_at: "2026-07-22T20:00:00Z", pattern_family: "future_deferral" },
      ],
    });
    const out = await buildTodayReminders(admin, "u1", now, "UTC", "en");
    const a1 = out.find((r) => r.stableId === "action:p1")!;
    const a2 = out.find((r) => r.stableId === "action:p2")!;
    expect(a1.category).toBe("ACTION_DUE");
    expect(a1.state).toBe("overdue");
    expect(a2.category).toBe("ACTION_DUE");
    expect(a2.state).toBe("due_today");
  });

  it("(8) REJECTED → ACTION_REVISION with state needs_revision, never plain overdue", async () => {
    const admin = mockAdmin({
      contracts: [{ id: "r1", status: "rejected", contract_description: "fix this", deadline_at: "2026-07-01T04:00:00Z", pattern_family: "blame_shift" }],
    });
    const out = await buildTodayReminders(admin, "u1", now, "UTC", "en");
    const r = out.find((x) => x.stableId === "action:r1")!;
    expect(r.category).toBe("ACTION_REVISION");
    expect(r.state).toBe("needs_revision");
  });

  it("(4/6/9/10) SUBMITTED, ESCALATED, APPROVED, MISSED never appear in reminders", async () => {
    const admin = mockAdmin({
      contracts: [
        { id: "s1", status: "submitted", contract_description: "submitted", deadline_at: "2026-05-01T04:00:00Z", pattern_family: "x" },
        { id: "e1", status: "escalated", contract_description: "escalated", deadline_at: "2026-05-01T04:00:00Z", pattern_family: "y" },
        { id: "ap", status: "approved", contract_description: "approved", deadline_at: "2026-05-01T04:00:00Z", pattern_family: "z" },
        { id: "mi", status: "missed", contract_description: "missed", deadline_at: "2026-05-01T04:00:00Z", pattern_family: "w" },
      ],
    });
    const out = await buildTodayReminders(admin, "u1", now, "UTC", "en");
    expect(out.filter((r) => r.category === "ACTION_DUE" || r.category === "ACTION_REVISION")).toHaveLength(0);
  });

  it("(11/12/14) ten distinct SUBMITTED contracts → 0 overdue reminders, 10 verification_pending (no family grouping)", async () => {
    const fams = ["ownership_act", "future_deferral", "blame_shift", "truth_naming", "delegation_deflection", "reputation_protection", "system_thinking", "unknown", "ownership_clarity", "integrity_compromise"];
    const contracts = fams.map((f, i) => ({ id: `sub${i}`, status: "submitted", contract_description: `Within 48 hours, schedule a review`, deadline_at: `2026-05-0${(i % 9) + 1}T04:00:00Z`, pattern_family: f }));
    const admin = mockAdmin({ contracts });
    const reminders = await buildTodayReminders(admin, "u1", now, "UTC", "en");
    expect(reminders.filter((r) => r.category === "ACTION_DUE" || r.category === "ACTION_REVISION" || r.state === "overdue")).toHaveLength(0);
    const status = await buildActionStatus(admin, "u1", "en");
    expect(status).toHaveLength(10);
    expect(status.every((s) => s.status === "verification_pending")).toBe(true);
    expect(new Set(status.map((s) => s.stableId)).size).toBe(10); // distinct, never merged by title
  });

  it("(5/7) buildActionStatus maps submitted→verification_pending, escalated→awaiting_resolution; approved/missed excluded; stays in-shell", async () => {
    const admin = mockAdmin({
      contracts: [
        { id: "s1", status: "submitted", contract_description: "sub", deadline_at: "2026-05-05T04:00:00Z", pattern_family: "a" },
        { id: "e1", status: "escalated", contract_description: "esc", deadline_at: "2026-05-01T04:00:00Z", pattern_family: "b" },
        { id: "ap", status: "approved", contract_description: "ok", deadline_at: "2026-05-01T04:00:00Z", pattern_family: "c" },
      ],
    });
    const status = await buildActionStatus(admin, "u1", "en");
    expect(status.map((s) => s.status)).toEqual(["verification_pending", "awaiting_resolution"]); // sorted, approved excluded
    expect(status.every((s) => s.deepLink === "/en/app?tab=arena")).toBe(true);
    expect(status.every((s) => !s.deepLink.includes("/bty-arena"))).toBe(true);
    expect(status.find((s) => s.contractId === "s1")!.originalDeadline).toBe("2026-05-05T04:00:00Z");
    expect(status.every((s) => s.sourceTitle === null)).toBe(true); // never guessed in V1
  });

  it("buildActionStatus returns [] for an empty user id", async () => {
    expect(await buildActionStatus(mockAdmin({}), "", "en")).toEqual([]);
  });

  it("returns [] for an empty user id (never a cross-user read)", async () => {
    expect(await buildTodayReminders(mockAdmin({}), "", now, "UTC", "en")).toEqual([]);
  });

  // Slice 3.1B-3K — FOLLOW_UP_DUE joins the projection from foundry_participant_followups.
  describe("FOLLOW_UP_DUE (Slice 3.1B-3K)", () => {
    it("test 25/26/29 — a due-today AND an overdue PENDING follow-up appear with the followup: prefix", async () => {
      const admin = mockAdmin({
        followups: [
          { id: "f1", source_training_title: "Confirm Understanding", follow_up_days: 7, due_at: "2026-07-22T05:00:00Z", status: "PENDING" }, // due today (same BTY day as now)
          { id: "f2", source_training_title: "Old one", follow_up_days: 30, due_at: "2026-07-20T05:00:00Z", status: "PENDING" }, // overdue
        ],
      });
      const out = await buildTodayReminders(admin, "u1", now, "UTC", "en");
      const f1 = out.find((r) => r.stableId === "followup:f1")!;
      const f2 = out.find((r) => r.stableId === "followup:f2")!;
      expect(f1.category).toBe("FOLLOW_UP_DUE");
      expect(f1.state).toBe("due_today");
      expect(f1.title).toContain("7-day follow-up");
      expect(f1.title).toContain("Confirm Understanding");
      expect(f1.canonicalDeepLink).toBe("/en/app?tab=foundry&followup=f1");
      expect(f2.state).toBe("overdue");
      expect(f2.title).toContain("30-day follow-up");
    });

    it("test 27 — an UPCOMING follow-up (future BTY day) does NOT appear in V1", async () => {
      const admin = mockAdmin({
        followups: [{ id: "f9", source_training_title: "Later", follow_up_days: 7, due_at: "2026-07-25T05:00:00Z", status: "PENDING" }],
      });
      const out = await buildTodayReminders(admin, "u1", now, "UTC", "en");
      expect(out.find((r) => r.stableId === "followup:f9")).toBeUndefined();
    });

    it("test 30 — overdue follow-up ranks by the existing state priority (before due_today)", async () => {
      const admin = mockAdmin({
        followups: [
          { id: "due", source_training_title: "A", follow_up_days: 7, due_at: "2026-07-22T05:00:00Z", status: "PENDING" },
          { id: "over", source_training_title: "B", follow_up_days: 7, due_at: "2026-07-19T05:00:00Z", status: "PENDING" },
        ],
      });
      const out = await buildTodayReminders(admin, "u1", now, "UTC", "en");
      expect(out[0].stableId).toBe("followup:over"); // overdue ranks first via STATE_RANK
    });

    it("test 28 — a RESPONDED follow-up is filtered out by the source query (status=PENDING) → absent", async () => {
      // The projection query filters .eq(status, 'PENDING'); a RESPONDED row is never returned by the DB.
      const admin = mockAdmin({ followups: [] });
      const out = await buildTodayReminders(admin, "u1", now, "UTC", "en");
      expect(out.find((r) => r.category === "FOLLOW_UP_DUE")).toBeUndefined();
    });

    it("KO — localized checkpoint eyebrow", async () => {
      const admin = mockAdmin({
        followups: [{ id: "f1", source_training_title: "환자 이해 확인", follow_up_days: 7, due_at: "2026-07-22T05:00:00Z", status: "PENDING" }],
      });
      const out = await buildTodayReminders(admin, "u1", now, "UTC", "ko");
      expect(out.find((r) => r.stableId === "followup:f1")!.title).toContain("7일 후 확인");
    });
  });
});
