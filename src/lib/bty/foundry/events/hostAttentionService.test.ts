import { describe, it, expect } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getHostDailyAttention } from "./hostAttentionService";

/**
 * Host Leadership Attention V1 — owner-scoped aggregation (Slice 3.1B-3L).
 * Covers required tests 1–20 (eligibility/ownership, follow-up overdue, shared review) + the
 * privacy allow-list (no response_text / no shared-response body ever selected or returned).
 *
 * A tiny fake Supabase admin resolves the exact queries the service issues and records every
 * `select` string so the privacy assertions can prove no private column is ever read.
 */

const NOW = new Date("2026-07-22T12:00:00.000Z");
const TZ = "UTC";

type World = {
  hostGrants: Array<{ user_id: string; status: "active" | "revoked" }>;
  events: Array<{ id: string; title: string | null; owner_user_id: string }>;
  followups: Array<{
    id: string;
    event_id: string;
    progress_id: string | null;
    follow_up_days: number;
    due_at: string;
    status: "PENDING" | "RESPONDED";
    source_training_title: string | null;
  }>;
  progress: Array<{
    id: string;
    event_id: string;
    participant_id: string;
    shared_understanding_response: string | null;
    response_text: string | null;
    shared_response_submitted_at: string | null;
    host_review_status: string | null;
    host_reviewed_at: string | null;
  }>;
  participants: Array<{ id: string; display_name: string }>;
};

type Op = [string, ...unknown[]];

function eqVal(ops: Op[], col: string): unknown {
  return ops.find((o) => o[0] === "eq" && o[1] === col)?.[2];
}
function inVal(ops: Op[], col: string): string[] {
  return (ops.find((o) => o[0] === "in" && o[1] === col)?.[2] as string[]) ?? [];
}
function hasInOn(ops: Op[], col: string): boolean {
  return ops.some((o) => o[0] === "in" && o[1] === col);
}

function makeAdmin(world: World, throwOnTable?: string) {
  const selects: Array<{ table: string; select: string }> = [];

  function resolve(table: string, select: string, ops: Op[]): { data: unknown } {
    selects.push({ table, select });
    if (table === throwOnTable) throw new Error(`simulated read failure on ${table}`);
    switch (table) {
      case "foundry_host_grants": {
        const userId = eqVal(ops, "user_id");
        const g = world.hostGrants.find((x) => x.user_id === userId && x.status === "active");
        return { data: g ? { status: "active" } : null };
      }
      case "foundry_events": {
        const owner = eqVal(ops, "owner_user_id");
        return { data: world.events.filter((e) => e.owner_user_id === owner).map((e) => ({ id: e.id, title: e.title })) };
      }
      case "foundry_participant_followups": {
        const ids = inVal(ops, "event_id");
        return {
          data: world.followups.filter((f) => ids.includes(f.event_id) && f.status === "PENDING" && f.due_at != null),
        };
      }
      case "foundry_event_training_progress": {
        if (hasInOn(ops, "id")) {
          const ids = inVal(ops, "id");
          return { data: world.progress.filter((p) => ids.includes(p.id)).map((p) => ({ id: p.id, participant_id: p.participant_id })) };
        }
        const ids = inVal(ops, "event_id");
        return {
          data: world.progress
            .filter((p) => ids.includes(p.event_id) && p.shared_understanding_response != null)
            .map((p) => ({
              id: p.id,
              event_id: p.event_id,
              participant_id: p.participant_id,
              shared_response_submitted_at: p.shared_response_submitted_at,
              host_review_status: p.host_review_status,
              host_reviewed_at: p.host_reviewed_at,
            })),
        };
      }
      case "foundry_event_participants": {
        const ids = inVal(ops, "id");
        return { data: world.participants.filter((p) => ids.includes(p.id)).map((p) => ({ id: p.id, display_name: p.display_name })) };
      }
      default:
        return { data: [] };
    }
  }

  function builder(table: string) {
    let select = "";
    const ops: Op[] = [];
    const chain = {
      select(s: string) { select = s; return chain; },
      eq(c: string, v: unknown) { ops.push(["eq", c, v]); return chain; },
      in(c: string, v: unknown) { ops.push(["in", c, v]); return chain; },
      not(c: string, op: string, v: unknown) { ops.push(["not", c, op, v]); return chain; },
      maybeSingle() {
        try {
          return Promise.resolve(resolve(table, select, ops));
        } catch (e) {
          return Promise.reject(e);
        }
      },
      then(onF: (v: { data: unknown }) => unknown, onR?: (e: unknown) => unknown) {
        try {
          return Promise.resolve(resolve(table, select, ops)).then(onF, onR);
        } catch (e) {
          return Promise.reject(e).then(onF, onR);
        }
      },
    };
    return chain;
  }

  const admin = { from: (t: string) => builder(t) } as unknown as SupabaseClient;
  return { admin, selects };
}

function baseWorld(): World {
  return {
    hostGrants: [{ user_id: "host-1", status: "active" }],
    events: [
      { id: "e1", title: "Consent Conversations", owner_user_id: "host-1" },
      { id: "e2", title: "Handoffs", owner_user_id: "host-1" },
      { id: "e9", title: "Foreign Event", owner_user_id: "host-2" },
    ],
    followups: [],
    progress: [],
    participants: [
      { id: "p1", display_name: "Kim" },
      { id: "p2", display_name: "Lee" },
      { id: "p9", display_name: "Stranger" },
    ],
  };
}

describe("getHostDailyAttention — eligibility & ownership (tests 1–6)", () => {
  it("(1) a non-Host (no grant) receives zero items", async () => {
    const w = baseWorld();
    w.hostGrants = [];
    const { admin } = makeAdmin(w);
    expect(await getHostDailyAttention(admin, "host-1", NOW, TZ, "en")).toEqual([]);
  });

  it("(2) a revoked Host receives zero items", async () => {
    const w = baseWorld();
    w.hostGrants = [{ user_id: "host-1", status: "revoked" }];
    const { admin } = makeAdmin(w);
    expect(await getHostDailyAttention(admin, "host-1", NOW, TZ, "en")).toEqual([]);
  });

  it("(5) an org responsibility alone does not grant it — only an active Foundry Host grant does", async () => {
    // The service never queries responsibility tables; a user without an active grant gets nothing,
    // regardless of any Trainer/People-Manager responsibility they may hold.
    const w = baseWorld();
    w.hostGrants = [];
    const { admin, selects } = makeAdmin(w);
    expect(await getHostDailyAttention(admin, "host-1", NOW, TZ, "en")).toEqual([]);
    expect(selects.some((s) => s.table.includes("responsibilit"))).toBe(false);
  });

  it("(6) an active Host with no owned events receives zero items", async () => {
    const w = baseWorld();
    w.events = [];
    const { admin } = makeAdmin(w);
    expect(await getHostDailyAttention(admin, "host-1", NOW, TZ, "en")).toEqual([]);
  });

  it("(3,4) an active Host receives only owned-event items, never another Host's", async () => {
    const w = baseWorld();
    w.followups = [
      { id: "fu1", event_id: "e1", progress_id: "pr1", follow_up_days: 7, due_at: "2026-07-15T05:00:00.000Z", status: "PENDING", source_training_title: "Consent Conversations" },
      { id: "fu9", event_id: "e9", progress_id: "pr9", follow_up_days: 7, due_at: "2026-07-15T05:00:00.000Z", status: "PENDING", source_training_title: "Foreign" },
    ];
    w.progress = [
      { id: "pr1", event_id: "e1", participant_id: "p1", shared_understanding_response: null, response_text: null, shared_response_submitted_at: null, host_review_status: null, host_reviewed_at: null },
      { id: "pr9", event_id: "e9", participant_id: "p9", shared_understanding_response: null, response_text: null, shared_response_submitted_at: null, host_review_status: null, host_reviewed_at: null },
    ];
    const { admin } = makeAdmin(w);
    const items = await getHostDailyAttention(admin, "host-1", NOW, TZ, "en");
    expect(items.map((i) => i.eventId)).toEqual(["e1"]);
    expect(items.every((i) => i.eventId !== "e9")).toBe(true);
  });
});

describe("getHostDailyAttention — FOLLOW_UP_OVERDUE (tests 7–12)", () => {
  function withFollowup(due_at: string, status: "PENDING" | "RESPONDED" = "PENDING") {
    const w = baseWorld();
    w.followups = [{ id: "fu1", event_id: "e1", progress_id: "pr1", follow_up_days: 7, due_at, status, source_training_title: "Consent Conversations" }];
    w.progress = [{ id: "pr1", event_id: "e1", participant_id: "p1", shared_understanding_response: null, response_text: null, shared_response_submitted_at: null, host_review_status: null, host_reviewed_at: null }];
    return w;
  }

  it("(7,12) an owned PENDING overdue follow-up appears with participant + no fabricated outcome", async () => {
    const { admin } = makeAdmin(withFollowup("2026-07-15T05:00:00.000Z"));
    const items = await getHostDailyAttention(admin, "host-1", NOW, TZ, "en");
    expect(items).toHaveLength(1);
    expect(items[0].category).toBe("FOLLOW_UP_OVERDUE");
    expect(items[0].focusId).toBe("fu1");
    expect(items[0].participantDisplayName).toBe("Kim");
    expect(items[0].deepLink).toBe("/en/app?tab=foundry&event=e1&section=followups&focus=fu1");
    // Navigation summary only — no outcome/verdict field exists on the item.
    expect(JSON.stringify(items[0])).not.toContain("outcome");
  });

  it("(8) a due-today follow-up does NOT appear (V1 is overdue-only)", async () => {
    const { admin } = makeAdmin(withFollowup("2026-07-22T05:00:00.000Z"));
    expect(await getHostDailyAttention(admin, "host-1", NOW, TZ, "en")).toEqual([]);
  });

  it("(9) an upcoming follow-up does NOT appear", async () => {
    const { admin } = makeAdmin(withFollowup("2026-07-29T05:00:00.000Z"));
    expect(await getHostDailyAttention(admin, "host-1", NOW, TZ, "en")).toEqual([]);
  });

  it("(10) a RESPONDED follow-up does NOT appear", async () => {
    const { admin } = makeAdmin(withFollowup("2026-07-15T05:00:00.000Z", "RESPONDED"));
    expect(await getHostDailyAttention(admin, "host-1", NOW, TZ, "en")).toEqual([]);
  });
});

describe("getHostDailyAttention — shared review (tests 13–20)", () => {
  function withProgress(host_review_status: string | null, shared: string | null) {
    const w = baseWorld();
    w.progress = [{
      id: "pr1", event_id: "e1", participant_id: "p1",
      shared_understanding_response: shared, response_text: "PRIVATE_REFLECTION_XYZ",
      shared_response_submitted_at: "2026-07-18T06:00:00.000Z", host_review_status, host_reviewed_at: host_review_status && host_review_status !== "NOT_REVIEWED" ? "2026-07-19T06:00:00.000Z" : null,
    }];
    return w;
  }

  it("(13) a submitted shared response with NULL review status appears as SHARED_REVIEW_DUE", async () => {
    const { admin } = makeAdmin(withProgress(null, "SHARED_BODY_XYZ"));
    const items = await getHostDailyAttention(admin, "host-1", NOW, TZ, "en");
    expect(items.map((i) => i.category)).toEqual(["SHARED_REVIEW_DUE"]);
    expect(items[0].focusId).toBe("pr1");
    expect(items[0].deepLink).toBe("/en/app?tab=foundry&event=e1&section=shared-understanding&focus=pr1");
  });

  it("(14) NOT_REVIEWED appears as SHARED_REVIEW_DUE", async () => {
    const { admin } = makeAdmin(withProgress("NOT_REVIEWED", "SHARED_BODY_XYZ"));
    const items = await getHostDailyAttention(admin, "host-1", NOW, TZ, "en");
    expect(items.map((i) => i.category)).toEqual(["SHARED_REVIEW_DUE"]);
  });

  it("(15) no shared response + NULL status does NOT appear (not a legacy backlog)", async () => {
    const { admin } = makeAdmin(withProgress(null, null));
    expect(await getHostDailyAttention(admin, "host-1", NOW, TZ, "en")).toEqual([]);
  });

  it("(16,17,19) ALIGNED / PARTIALLY_CLEAR do NOT appear (re-review clears the item)", async () => {
    for (const s of ["ALIGNED", "PARTIALLY_CLEAR"]) {
      const { admin } = makeAdmin(withProgress(s, "SHARED_BODY_XYZ"));
      expect(await getHostDailyAttention(admin, "host-1", NOW, TZ, "en")).toEqual([]);
    }
  });

  it("(18) FOLLOW_UP_NEEDED appears in its own category", async () => {
    const { admin } = makeAdmin(withProgress("FOLLOW_UP_NEEDED", "SHARED_BODY_XYZ"));
    const items = await getHostDailyAttention(admin, "host-1", NOW, TZ, "en");
    expect(items.map((i) => i.category)).toEqual(["FOLLOW_UP_NEEDED"]);
    expect(items[0].focusId).toBe("pr1");
  });

  it("(20) another Host's shared response does NOT appear", async () => {
    const w = baseWorld();
    w.progress = [{ id: "pr9", event_id: "e9", participant_id: "p9", shared_understanding_response: "X", response_text: null, shared_response_submitted_at: "2026-07-18T06:00:00.000Z", host_review_status: null, host_reviewed_at: null }];
    const { admin } = makeAdmin(w);
    expect(await getHostDailyAttention(admin, "host-1", NOW, TZ, "en")).toEqual([]);
  });
});

describe("getHostDailyAttention — priority + privacy (tests 21–23 integrated, 34/35/52)", () => {
  function fullWorld(): World {
    const w = baseWorld();
    w.followups = [{ id: "fu1", event_id: "e1", progress_id: "pr1", follow_up_days: 7, due_at: "2026-07-10T05:00:00.000Z", status: "PENDING", source_training_title: "Consent Conversations" }];
    w.progress = [
      { id: "pr1", event_id: "e1", participant_id: "p1", shared_understanding_response: null, response_text: "PRIVATE_REFLECTION_XYZ", shared_response_submitted_at: null, host_review_status: null, host_reviewed_at: null },
      { id: "pr2", event_id: "e2", participant_id: "p2", shared_understanding_response: "SHARED_BODY_XYZ", response_text: "PRIVATE_REFLECTION_XYZ", shared_response_submitted_at: "2026-07-18T06:00:00.000Z", host_review_status: "FOLLOW_UP_NEEDED", host_reviewed_at: "2026-07-19T06:00:00.000Z" },
      { id: "pr3", event_id: "e2", participant_id: "p1", shared_understanding_response: "SHARED_BODY_XYZ", response_text: "PRIVATE_REFLECTION_XYZ", shared_response_submitted_at: "2026-07-17T06:00:00.000Z", host_review_status: null, host_reviewed_at: null },
    ];
    return w;
  }

  it("(21–23) categories order overdue → follow-up-needed → shared-review-due", async () => {
    const { admin } = makeAdmin(fullWorld());
    const items = await getHostDailyAttention(admin, "host-1", NOW, TZ, "en");
    expect(items.map((i) => i.category)).toEqual(["FOLLOW_UP_OVERDUE", "FOLLOW_UP_NEEDED", "SHARED_REVIEW_DUE"]);
  });

  it("(34,35,52) never SELECTS or RETURNS response_text or the shared-response body", async () => {
    const { admin, selects } = makeAdmin(fullWorld());
    const items = await getHostDailyAttention(admin, "host-1", NOW, TZ, "en");
    // No SELECT string ever names a private column.
    for (const s of selects) {
      expect(s.select).not.toContain("response_text");
      expect(s.select).not.toContain("shared_understanding_response");
      expect(s.select).not.toContain("host_review_note");
    }
    // No private body/reflection text ever leaves in the returned items.
    const json = JSON.stringify(items);
    expect(json).not.toContain("PRIVATE_REFLECTION_XYZ");
    expect(json).not.toContain("SHARED_BODY_XYZ");
  });

  it("localizes the reason line (ko)", async () => {
    const { admin } = makeAdmin(fullWorld());
    const items = await getHostDailyAttention(admin, "host-1", NOW, TZ, "ko");
    expect(items[0].reason).toContain("응답하지 않았습니다");
    expect(items[0].deepLink.startsWith("/ko/app")).toBe(true);
  });

  it("a projection-source failure returns FEWER items but only OWNER-SCOPED ones — never unscoped", async () => {
    // The follow-up projection read throws; the shared projection still resolves. The result must
    // drop the failed category (no items) yet remain strictly owner-scoped — never a thrown 500 and
    // never a partially/unscoped row. Distinguishes projection-source failure from a legit empty.
    const w = fullWorld();
    // Add a FOREIGN owner's submitted shared response — it must never appear even under partial failure.
    w.events.push({ id: "e9b", title: "Foreign", owner_user_id: "host-2" });
    w.progress.push({ id: "pr9", event_id: "e9b", participant_id: "p9", shared_understanding_response: "SHARED_BODY_XYZ", response_text: "PRIVATE_REFLECTION_XYZ", shared_response_submitted_at: "2026-07-16T06:00:00.000Z", host_review_status: null, host_reviewed_at: null });
    const { admin } = makeAdmin(w, "foundry_participant_followups");
    const items = await getHostDailyAttention(admin, "host-1", NOW, TZ, "en");
    // FOLLOW_UP_OVERDUE dropped (its read failed); shared items survive.
    expect(items.every((i) => i.category !== "FOLLOW_UP_OVERDUE")).toBe(true);
    expect(items.length).toBeGreaterThan(0);
    // Strictly owner-scoped — the foreign event never leaks even under partial failure.
    expect(items.every((i) => i.eventId === "e1" || i.eventId === "e2")).toBe(true);
    expect(items.some((i) => i.eventId === "e9b")).toBe(false);
  });

  it("a Host-gate failure yields no items and never reaches attention reads (structural, not masked)", async () => {
    // If the eligibility read itself fails, the service rejects (the route's outer catch maps it to
    // []). Critically, no attention/data read runs before ownership is proven — no unscoped rows.
    const { admin, selects } = makeAdmin(fullWorld(), "foundry_host_grants");
    await expect(getHostDailyAttention(admin, "host-1", NOW, TZ, "en")).rejects.toThrow();
    expect(selects.some((s) => s.table === "foundry_participant_followups")).toBe(false);
    expect(selects.some((s) => s.table === "foundry_event_training_progress")).toBe(false);
  });
});
