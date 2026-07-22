import { describe, it, expect } from "vitest";
import { buildTodayReminders } from "./todayReminders.server";

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
function mockAdmin(cfg: { assignments?: unknown[]; contracts?: unknown[]; outcomes?: unknown[] }) {
  return {
    rpc: async () => ({ data: cfg.assignments ?? [] }),
    from: (table: string) =>
      query(table === "bty_action_contracts" ? (cfg.contracts ?? []) : table === "arena_pending_outcomes" ? (cfg.outcomes ?? []) : []),
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
      contracts: [{ id: "c1", contract_description: "submit QR", deadline_at: "2026-07-22T04:00:00Z" }],
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
        { id: "c1", contract_description: "overdue one", deadline_at: "2026-07-22T04:00:00Z" },
        { id: "c2", contract_description: "due later today", deadline_at: "2026-07-22T20:00:00Z" },
      ],
    });
    const out = await buildTodayReminders(admin, "u1", now, "UTC", "en");
    expect(out[0].stableId).toBe("action:c1"); // overdue ranks first
    expect(out[0].state).toBe("overdue");
    expect(out.every((r) => r.canonicalDeepLink.length > 0)).toBe(true);
  });

  it("dedupes a source already surfaced as the primary Today path", async () => {
    const admin = mockAdmin({ contracts: [{ id: "c1", contract_description: "x", deadline_at: "2026-07-22T20:00:00Z" }] });
    const out = await buildTodayReminders(admin, "u1", now, "UTC", "en", new Set(["action:c1"]));
    expect(out.find((r) => r.stableId === "action:c1")).toBeUndefined();
  });

  // REGRESSION (Slice 3.1B-3J.1): the old primary Today card that rendered an open Action Contract as
  // "PROMISE TO CARRY" was removed. With NO suppression set (the brief route no longer suppresses),
  // that same canonical Action Contract must remain discoverable — exactly once — as an ACTION_DUE
  // reminder, so removing the card never hides a real obligation.
  it("keeps the action contract from the removed primary card discoverable as a reminder (no suppression)", async () => {
    const admin = mockAdmin({
      contracts: [{ id: "blk1", contract_description: "submit QR proof", deadline_at: "2026-07-22T20:00:00Z" }],
    });
    const out = await buildTodayReminders(admin, "u1", now, "UTC", "en"); // no suppress arg
    const hits = out.filter((r) => r.stableId === "action:blk1");
    expect(hits).toHaveLength(1); // present, and never duplicated
    expect(hits[0].category).toBe("ACTION_DUE");
    expect(hits[0].canonicalDeepLink.length).toBeGreaterThan(0); // still deep-linkable
  });

  it("returns [] for an empty user id (never a cross-user read)", async () => {
    expect(await buildTodayReminders(mockAdmin({}), "", now, "UTC", "en")).toEqual([]);
  });
});
