import { describe, it, expect } from "vitest";
import {
  materializeFollowupObligation,
  submitFollowupOutcome,
  getMyFollowupView,
  getEventFollowupsForOwner,
} from "./foundryFollowupService";
import { computeFollowUpDue } from "@/domain/foundry/followup/followUpObligation";

/**
 * Slice 3.1B-3K — follow-up obligation service. A chainable query stub feeds per-table single/rows;
 * rpc calls are captured. No real DB. Profile tz is fixed to "UTC" so due math is deterministic.
 */
function makeAdmin(cfg: {
  tables?: Record<string, { single?: unknown; rows?: unknown[] }>;
  rpc?: Record<string, unknown | ((p: Record<string, unknown>) => unknown)>;
}) {
  const rpcCalls: Array<{ name: string; params: Record<string, unknown> }> = [];
  const selectByTable: Record<string, string> = {};
  function builder(table: string) {
    const conf = cfg.tables?.[table] ?? {};
    const b: Record<string, unknown> = {};
    b.select = (arg: string) => {
      selectByTable[table] = arg;
      return b;
    };
    for (const m of ["eq", "in", "not", "order", "limit", "update"]) b[m] = () => b;
    b.maybeSingle = async () => ({ data: conf.single ?? null });
    (b as { then: unknown }).then = (res: (v: { data: unknown[] }) => unknown) =>
      Promise.resolve({ data: conf.rows ?? [] }).then(res);
    return b;
  }
  const admin = {
    from: (t: string) => builder(t),
    rpc: async (name: string, params: Record<string, unknown>) => {
      rpcCalls.push({ name, params });
      const r = cfg.rpc?.[name];
      const val = typeof r === "function" ? (r as (p: Record<string, unknown>) => unknown)(params) : r;
      return val ?? { data: null };
    },
  } as never;
  return { admin, rpcCalls, selectByTable };
}

const UTC_PROFILE = { tables: { arena_profiles: { single: { timezone: "UTC" } } } };

describe("materializeFollowupObligation", () => {
  it("test 7 — followUpDays=0 creates NOTHING (no rpc)", async () => {
    const { admin, rpcCalls } = makeAdmin({
      tables: { ...UTC_PROFILE.tables, foundry_event_module: { single: { module_snapshot: { followUpDays: 0 } } } },
    });
    const res = await materializeFollowupObligation(admin, {
      eventId: "e1",
      progressId: "p1",
      authUserId: "u1",
      completedAtIso: "2026-07-22T06:00:00Z",
    });
    expect(res).toBe("skipped");
    expect(rpcCalls.find((c) => c.name === "bty_foundry_materialize_followup")).toBeUndefined();
  });

  it("test 8/9/16 — followUpDays=7 materializes ONE with the fixed due_at + assignment binding", async () => {
    const { admin, rpcCalls } = makeAdmin({
      tables: {
        ...UTC_PROFILE.tables,
        foundry_event_module: { single: { module_snapshot: { followUpDays: 7 } } },
        foundry_events: { single: { title: "Confirm Patient Understanding" } },
        foundry_event_assignments: { single: { id: "asn1", organization_id: "org1" } },
      },
      rpc: { bty_foundry_materialize_followup: { data: [{ result: "created" }] } },
    });
    const res = await materializeFollowupObligation(admin, {
      eventId: "e1",
      progressId: "p1",
      authUserId: "u1",
      completedAtIso: "2026-07-22T06:00:00Z",
      deviceTz: "UTC",
    });
    expect(res).toBe("created");
    const call = rpcCalls.find((c) => c.name === "bty_foundry_materialize_followup")!;
    const expected = computeFollowUpDue("2026-07-22T06:00:00Z", "UTC", 7);
    expect(call.params.p_follow_up_days).toBe(7);
    expect(call.params.p_due_at).toBe(expected.dueAtIso);
    expect(call.params.p_completion_bty_day).toBe(expected.completionBtyDay);
    expect(call.params.p_due_bty_day).toBe(expected.dueBtyDay);
    expect(call.params.p_source_training_title).toBe("Confirm Patient Understanding");
    expect(call.params.p_assignment_id).toBe("asn1"); // captured only because snapshot matched
    expect(call.params.p_organization_id).toBe("org1");
    expect(call.params.p_user_id_snapshot).toBe("u1");
  });

  it("test 9 — followUpDays=30 materializes with a 30-day due", async () => {
    const { admin, rpcCalls } = makeAdmin({
      tables: {
        ...UTC_PROFILE.tables,
        foundry_event_module: { single: { module_snapshot: { followUpDays: 30 } } },
        foundry_events: { single: { title: "T" } },
      },
      rpc: { bty_foundry_materialize_followup: { data: [{ result: "created" }] } },
    });
    await materializeFollowupObligation(admin, {
      eventId: "e1",
      progressId: "p1",
      authUserId: "u1",
      completedAtIso: "2026-07-22T06:00:00Z",
      deviceTz: "UTC",
    });
    const call = rpcCalls.find((c) => c.name === "bty_foundry_materialize_followup")!;
    expect(call.params.p_follow_up_days).toBe(30);
    expect(call.params.p_due_bty_day).toBe(computeFollowUpDue("2026-07-22T06:00:00Z", "UTC", 30).dueBtyDay);
  });

  it("test 17 — open-link (no matching assignment) → assignment_id null", async () => {
    const { admin, rpcCalls } = makeAdmin({
      tables: {
        ...UTC_PROFILE.tables,
        foundry_event_module: { single: { module_snapshot: { followUpDays: 7 } } },
        foundry_events: { single: { title: "T" } },
        foundry_event_assignments: { single: null }, // no assignment for this user_id_snapshot
      },
      rpc: { bty_foundry_materialize_followup: { data: [{ result: "created" }] } },
    });
    await materializeFollowupObligation(admin, {
      eventId: "e1",
      progressId: "p1",
      authUserId: "u1",
      completedAtIso: "2026-07-22T06:00:00Z",
      deviceTz: "UTC",
    });
    const call = rpcCalls.find((c) => c.name === "bty_foundry_materialize_followup")!;
    expect(call.params.p_assignment_id).toBeNull();
    expect(call.params.p_organization_id).toBeNull();
  });

  it("test 10/11/15 — idempotency is delegated: rpc 'exists' surfaces as 'exists' (no duplicate)", async () => {
    const { admin } = makeAdmin({
      tables: {
        ...UTC_PROFILE.tables,
        foundry_event_module: { single: { module_snapshot: { followUpDays: 7 } } },
        foundry_events: { single: { title: "T" } },
      },
      rpc: { bty_foundry_materialize_followup: { data: [{ result: "exists" }] } },
    });
    const res = await materializeFollowupObligation(admin, {
      eventId: "e1",
      progressId: "p1",
      authUserId: "u1",
      completedAtIso: "2026-07-22T06:00:00Z",
      deviceTz: "UTC",
    });
    expect(res).toBe("exists");
  });

  it("test 14 — no authUserId → skipped (anonymous completion materializes nothing)", async () => {
    const { admin, rpcCalls } = makeAdmin(UTC_PROFILE);
    const res = await materializeFollowupObligation(admin, {
      eventId: "e1",
      progressId: "p1",
      authUserId: "",
      completedAtIso: "2026-07-22T06:00:00Z",
    });
    expect(res).toBe("skipped");
    expect(rpcCalls.length).toBe(0);
  });

  it("fails soft (never throws) when the rpc errors", async () => {
    const { admin } = makeAdmin({
      tables: {
        ...UTC_PROFILE.tables,
        foundry_event_module: { single: { module_snapshot: { followUpDays: 7 } } },
        foundry_events: { single: { title: "T" } },
      },
      rpc: { bty_foundry_materialize_followup: { error: new Error("boom") } },
    });
    const res = await materializeFollowupObligation(admin, {
      eventId: "e1",
      progressId: "p1",
      authUserId: "u1",
      completedAtIso: "2026-07-22T06:00:00Z",
      deviceTz: "UTC",
    });
    expect(res).toBe("error");
  });
});

describe("submitFollowupOutcome", () => {
  const now = new Date("2026-07-29T06:00:00Z");
  void now;

  it("test 36 — rejects an invalid outcome without calling the rpc", async () => {
    const { admin, rpcCalls } = makeAdmin({});
    const res = await submitFollowupOutcome(admin, "u1", "f1", "VERIFIED");
    expect(res.result).toBe("invalid_outcome");
    expect(rpcCalls.length).toBe(0);
  });

  it("test 35/39/40 — a valid outcome transitions to RESPONDED", async () => {
    const { admin } = makeAdmin({
      rpc: { bty_foundry_submit_followup: { data: [{ result: "responded", status: "RESPONDED", outcome: "APPLIED" }] } },
    });
    const res = await submitFollowupOutcome(admin, "u1", "f1", "APPLIED");
    expect(res).toEqual({ result: "responded", status: "RESPONDED", outcome: "APPLIED" });
  });

  it("test 37 — a conflicting second outcome does NOT overwrite (already_responded + settled state)", async () => {
    const { admin } = makeAdmin({
      rpc: { bty_foundry_submit_followup: { data: [{ result: "already_responded", status: "RESPONDED", outcome: "APPLIED" }] } },
    });
    const res = await submitFollowupOutcome(admin, "u1", "f1", "BLOCKED");
    expect(res).toEqual({ result: "already_responded", status: "RESPONDED", outcome: "APPLIED" });
  });

  it("test 38 — an identical resubmission is idempotent (unchanged)", async () => {
    const { admin } = makeAdmin({
      rpc: { bty_foundry_submit_followup: { data: [{ result: "unchanged", status: "RESPONDED", outcome: "APPLIED" }] } },
    });
    const res = await submitFollowupOutcome(admin, "u1", "f1", "APPLIED");
    expect(res.result).toBe("unchanged");
  });

  it("test 34 — another user cannot submit (not_owner)", async () => {
    const { admin } = makeAdmin({ rpc: { bty_foundry_submit_followup: { data: [{ result: "not_owner" }] } } });
    const res = await submitFollowupOutcome(admin, "intruder", "f1", "APPLIED");
    expect(res.result).toBe("not_owner");
  });
});

describe("getMyFollowupView", () => {
  const now = new Date("2026-07-29T06:00:00Z");

  it("test 33 — owner reads their obligation; dueState is derived; expectedBehavior from snapshot", async () => {
    const { admin } = makeAdmin({
      tables: {
        foundry_event_module: { single: { module_snapshot: { completionPrompt: "Greet every patient by name" } } },
      },
      rpc: {
        bty_foundry_get_my_followup: {
          data: [
            {
              id: "f1",
              event_id: "e1",
              source_training_title: "T",
              follow_up_days: 7,
              completed_at: "2026-07-22T06:00:00Z",
              due_at: "2026-07-29T05:00:00Z",
              due_bty_day: "2026-07-29",
              status: "PENDING",
              outcome: null,
              responded_at: null,
            },
          ],
        },
      },
    });
    const view = await getMyFollowupView(admin, "u1", "f1", now, "UTC");
    expect(view?.id).toBe("f1");
    expect(view?.dueState).toBe("due_today"); // due_at 05:00 same BTY day as now 06:00
    expect(view?.expectedBehavior).toBe("Greet every patient by name");
    expect(view?.status).toBe("PENDING");
  });

  it("test 34 — a not-owned / missing id resolves to null (safe 404)", async () => {
    const { admin } = makeAdmin({ rpc: { bty_foundry_get_my_followup: { data: [] } } });
    expect(await getMyFollowupView(admin, "u1", "nope", now, "UTC")).toBeNull();
  });
});

describe("getEventFollowupsForOwner", () => {
  const now = new Date("2026-07-29T06:00:00Z");

  it("test 47 — a foreign / not-owned event resolves to null (no leak)", async () => {
    const { admin } = makeAdmin({ tables: { foundry_events: { single: null } } });
    expect(await getEventFollowupsForOwner(admin, "owner1", "e1", now, "UTC")).toBeNull();
  });

  it("test 46/48/49 — owner sees rows (independent of shared question), learner-reported outcome + state", async () => {
    const { admin, selectByTable } = makeAdmin({
      tables: {
        foundry_events: { single: { id: "e1" } }, // owned
        foundry_participant_followups: {
          rows: [
            { id: "f1", progress_id: "pr1", follow_up_days: 7, due_at: "2026-07-29T05:00:00Z", status: "RESPONDED", outcome: "APPLIED", responded_at: "2026-07-29T05:30:00Z" },
            { id: "f2", progress_id: "pr2", follow_up_days: 30, due_at: "2026-07-25T05:00:00Z", status: "PENDING", outcome: null, responded_at: null },
          ],
        },
        foundry_event_training_progress: { rows: [{ id: "pr1", participant_id: "pt1" }, { id: "pr2", participant_id: "pt2" }] },
        foundry_event_participants: { rows: [{ id: "pt1", display_name: "Ann" }, { id: "pt2", display_name: "Ben" }] },
      },
    });
    const view = await getEventFollowupsForOwner(admin, "owner1", "e1", now, "UTC");
    expect(view?.rows).toHaveLength(2);
    const responded = view!.rows.find((r) => r.followupId === "f1")!;
    expect(responded.state).toBe("responded");
    expect(responded.outcome).toBe("APPLIED");
    expect(responded.displayName).toBe("Ann");
    const pending = view!.rows.find((r) => r.followupId === "f2")!;
    expect(pending.state).toBe("overdue"); // due 07-25 < now 07-29
    expect(pending.outcome).toBeNull();
    // test 48: the projection never reads a shared_question (independent of that gate).
    expect(selectByTable.foundry_participant_followups).not.toMatch(/shared/i);
  });

  it("test 50/51 — the Host projection SELECT never includes response_text / private fields", async () => {
    const { admin, selectByTable } = makeAdmin({
      tables: {
        foundry_events: { single: { id: "e1" } },
        foundry_participant_followups: { rows: [] },
      },
    });
    await getEventFollowupsForOwner(admin, "owner1", "e1", now, "UTC");
    expect(selectByTable.foundry_participant_followups).not.toMatch(/response_text|reflection|shared_understanding/i);
  });
});
