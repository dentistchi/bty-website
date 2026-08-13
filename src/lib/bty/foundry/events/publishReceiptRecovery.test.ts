import { describe, it, expect, vi, beforeEach } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * SLICE 3.2Q-R1 — A LIVE SESSION BEHIND A ROW THAT STILL SAYS "DRAFT".
 *
 * `publishDraft` writes the event, then the immutable module snapshot, then the draft's
 * publication stamp LAST — deliberately, so a failure before that leaves the draft editable
 * instead of stranded in an approved limbo. The preflight measured what happens when the FINAL
 * stamp is the thing that fails: the event and snapshot are durable, the next click finds the
 * winner by `source_draft_id` and returns `reused: true`, and nothing ever repairs the draft.
 * A permanent disagreement between the database and the product.
 *
 * The second defect is its mirror. After every durable write commits, the response builds a
 * control-room snapshot; if that READ failed, the service said `snapshot_failed` and the Builder
 * told the Host "Couldn't create the session. Please try once more." — false, and an invitation
 * to press a button for a training that is already live.
 *
 * NO NEW RECEIPT WAS ADDED. `foundry_event_module.source_draft_id` is UNIQUE and its row already
 * names the event, the source draft and the module version. Publication completion was always
 * durable and provable; it simply was not consulted on retry.
 */
const createTrainingEvent = vi.fn();
const getOwnerRoomSnapshot = vi.fn();
vi.mock("./foundryTrainingService", () => ({ createTrainingEvent: (...a: unknown[]) => createTrainingEvent(...a) }));
vi.mock("./foundryDocumentService", () => ({ getOwnerRoomSnapshot: (...a: unknown[]) => getOwnerRoomSnapshot(...a) }));

import { publishDraft } from "./foundryPublishService";

type Row = Record<string, unknown>;
type Tables = Record<string, Row[]>;
const OWNER = "owner-1";
const V2 = "d-v2";

/** A fake admin that can be told to fail one specific write, so a partial commit is reachable. */
function makeFakeAdmin(tables: Tables, fail: { table: string; op: "insert" | "update" } | null = null) {
  function from(table: string) {
    const rows = tables[table] ?? (tables[table] = []);
    const q: Record<string, unknown> = {
      _op: "select", _filters: [] as { c: string; v: unknown }[], _ins: [] as { c: string; arr: unknown[] }[],
      _patch: {} as Row, _insert: null as Row | null,
      insert(this: Record<string, unknown>, row: Row) { this._op = "insert"; this._insert = row; return this; },
      update(this: Record<string, unknown>, patch: Row) { this._op = "update"; this._patch = patch; return this; },
      delete(this: Record<string, unknown>) { this._op = "delete"; return this; },
      select() { return this; },
      eq(this: { _filters: { c: string; v: unknown }[] }, c: string, v: unknown) { this._filters.push({ c, v }); return this; },
      in(this: { _ins: { c: string; arr: unknown[] }[] }, c: string, arr: unknown[]) { this._ins.push({ c, arr }); return this; },
      order() { return this; }, limit() { return this; },
      _match(this: { _filters: { c: string; v: unknown }[]; _ins: { c: string; arr: unknown[] }[] }, r: Row) {
        return this._filters.every((f) => r[f.c] === f.v) && this._ins.every((f) => f.arr.includes(r[f.c]));
      },
      maybeSingle(this: Record<string, unknown>) { return (this.single as () => Promise<unknown>)(); },
      single(this: Record<string, unknown>) {
        const failing = fail && fail.table === table && fail.op === this._op;
        if (this._op === "insert" && this._insert) {
          if (failing) return Promise.resolve({ data: null, error: { message: "forced" } });
          const row = { ...(this._insert as Row) };
          if (table === "foundry_events" && !row.id) row.id = `ev-${rows.length + 1}`;
          rows.push(row);
          return Promise.resolve({ data: { ...row }, error: null });
        }
        const found = rows.filter((r) => (this._match as (r: Row) => boolean)(r));
        return Promise.resolve({ data: found[0] ? { ...found[0] } : null, error: null });
      },
      then(this: Record<string, unknown>, res: (v: { data: unknown; error: unknown }) => unknown) {
        const failing = fail && fail.table === table && fail.op === this._op;
        const matched = rows.filter((r) => (this._match as (r: Row) => boolean)(r));
        if (this._op === "insert" && this._insert) {
          if (failing) return Promise.resolve({ data: null, error: { message: "forced" } }).then(res);
          const row = { ...(this._insert as Row) };
          if (table === "foundry_events" && !row.id) row.id = `ev-${rows.length + 1}`;
          rows.push(row);
          return Promise.resolve({ data: [row], error: null }).then(res);
        }
        if (this._op === "update") {
          if (failing) return Promise.resolve({ data: null, error: { message: "forced" } }).then(res);
          for (const r of matched) Object.assign(r, this._patch as Row);
          return Promise.resolve({ data: matched, error: null }).then(res);
        }
        if (this._op === "delete") {
          for (const r of matched) rows.splice(rows.indexOf(r), 1);
          return Promise.resolve({ data: matched, error: null }).then(res);
        }
        return Promise.resolve({ data: matched, error: null }).then(res);
      },
    };
    return q;
  }
  return { from, rpc: () => Promise.resolve({ data: null, error: null }) } as unknown as SupabaseClient;
}

function draft(over: Row = {}): Row {
  return {
    id: V2, owner_user_id: OWNER, status: "draft", module_version: 2,
    approved_at: null, published_at: null, program_id: "prog-shared",
    answers: {
      problem: "Handoffs skip the double-check.", audienceType: "everyone",
      recurringMoment: "at each handoff point",
      observableBehavior: "The charge nurse reads back the dosage before sign-off.",
      successEvidence: "Sign-offs include a witnessed read-back.", evidenceType: "seen",
      learningNeeds: ["practice"], materialIntent: "youtube",
      materialText: "https://youtu.be/dQw4w9WgXcQ", followUpDays: 7,
      completionPrompt: "What read-back will you commit to?",
    },
    ...over,
  };
}
const SNAP = { event: { id: "ev-1", title: "T", status: "open", join_token: "tok", content_type: "youtube" }, participants: [], joined_count: 0, completed_count: 0 };

beforeEach(() => {
  createTrainingEvent.mockReset();
  getOwnerRoomSnapshot.mockReset();
  getOwnerRoomSnapshot.mockResolvedValue(SNAP);
  createTrainingEvent.mockResolvedValue({ ok: true, value: { event: { id: "ev-1" } } });
});

describe("[3.2Q-R1] §8E — a failed final stamp is repaired by the retry, never duplicated", () => {
  it("first attempt: the durable session exists even though the draft stamp failed", async () => {
    const tables: Tables = { foundry_module_drafts: [draft()], foundry_event_module: [], foundry_events: [] };
    const admin = makeFakeAdmin(tables, { table: "foundry_module_drafts", op: "update" });
    const r = await publishDraft(admin, OWNER, V2, "en");
    expect(r.ok, "the session WAS created — the response must not deny it").toBe(true);
    expect(tables.foundry_event_module).toHaveLength(1);
    // The measured defect: durable event, draft still says draft.
    expect(tables.foundry_module_drafts[0].status).toBe("draft");
  });

  it("the retry reconciles the draft and returns the SAME event — no second session", async () => {
    const tables: Tables = {
      foundry_module_drafts: [draft()],
      foundry_event_module: [{ event_id: "ev-1", source_draft_id: V2, module_version: 2, module_snapshot: {}, created_at: "2026-08-13T00:00:00.000Z" }],
      foundry_events: [{ id: "ev-1", owner_user_id: OWNER, created_at: "2026-08-13T00:00:00.000Z" }],
    };
    const admin = makeFakeAdmin(tables);
    const r = await publishDraft(admin, OWNER, V2, "en");
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.reused).toBe(true);
    expect(createTrainingEvent, "no new event may be created on a retry").not.toHaveBeenCalled();
    expect(tables.foundry_event_module).toHaveLength(1);

    const d = tables.foundry_module_drafts[0];
    expect(d.status).toBe("published");
    /*
      THE SERVER'S TIMESTAMP, NOT THE RETRY'S. `foundry_event_module.created_at` is when the
      publish actually committed; `new Date()` here would record whenever someone happened to
      click again, which can be days later and is not when the training went live.
    */
    expect(d.published_at).toBe("2026-08-13T00:00:00.000Z");
    expect(d.approved_at).toBe("2026-08-13T00:00:00.000Z");
  });

  it("an already-published draft is left exactly as it is", async () => {
    const tables: Tables = {
      foundry_module_drafts: [draft({ status: "published", approved_at: "t-approved", published_at: "t-published" })],
      foundry_event_module: [{ event_id: "ev-1", source_draft_id: V2, module_version: 2, module_snapshot: {}, created_at: "2026-08-13T00:00:00.000Z" }],
      foundry_events: [{ id: "ev-1", owner_user_id: OWNER, created_at: "2026-08-13T00:00:00.000Z" }],
    };
    const admin = makeFakeAdmin(tables);
    const r = await publishDraft(admin, OWNER, V2, "en");
    expect(r.ok).toBe(true);
    expect(tables.foundry_module_drafts[0].approved_at).toBe("t-approved");
    expect(tables.foundry_module_drafts[0].published_at).toBe("t-published");
  });
});

describe("[3.2Q-R1] §3 — recovery is claim-bound, never 'an event exists'", () => {
  it("H — v1's event on the SAME program_id can never reconcile v2", async () => {
    /*
      THE PILOT'S ACTUAL RISK. Canonical v1 and v2 share one Program root, and v1's event is
      still open. If reconciliation keyed on `program_id`, publishing v2 would find v1's event
      and stamp v2 published against a session that is not its own. Every query keys on
      `source_draft_id`; `program_id` is consulted nowhere in this path.
    */
    const tables: Tables = {
      foundry_module_drafts: [draft()],
      // v1's module row: same program root, DIFFERENT source draft and version.
      foundry_event_module: [{ event_id: "ev-v1", source_draft_id: "d-v1", module_version: 1, module_snapshot: {}, created_at: "2026-07-26T00:00:00.000Z" }],
      foundry_events: [{ id: "ev-v1", owner_user_id: OWNER, program_id: "prog-shared", created_at: "2026-07-26T00:00:00.000Z" }],
    };
    const admin = makeFakeAdmin(tables);
    const r = await publishDraft(admin, OWNER, V2, "en");
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    // v2 published on its OWN new event; v1's row is untouched.
    expect(r.value.reused).toBe(false);
    expect(tables.foundry_event_module).toHaveLength(2);
    const v1 = tables.foundry_event_module.find((m) => m.source_draft_id === "d-v1")!;
    expect(v1.event_id).toBe("ev-v1");
    expect(v1.module_version).toBe(1);
  });

  it("a module row whose version disagrees with the draft does not reconcile it", async () => {
    const tables: Tables = {
      foundry_module_drafts: [draft({ module_version: 2 })],
      foundry_event_module: [{ event_id: "ev-1", source_draft_id: V2, module_version: 1, module_snapshot: {}, created_at: "2026-08-13T00:00:00.000Z" }],
      foundry_events: [{ id: "ev-1", owner_user_id: OWNER, created_at: "2026-08-13T00:00:00.000Z" }],
    };
    const admin = makeFakeAdmin(tables);
    const r = await publishDraft(admin, OWNER, V2, "en");
    expect(r.ok, "a version mismatch must be reported, never silently reconciled").toBe(false);
    if (r.ok) return;
    expect(r.reason).toBe("publish_receipt_unreconciled");
    expect(tables.foundry_module_drafts[0].status).toBe("draft");
  });

  it("a module row whose event is gone does not stamp a draft published", async () => {
    // The event was compensated away: the publish did NOT survive, and saying otherwise would
    // be the same untruth in the opposite direction.
    const tables: Tables = {
      foundry_module_drafts: [draft()],
      foundry_event_module: [{ event_id: "ev-vanished", source_draft_id: V2, module_version: 2, module_snapshot: {}, created_at: "2026-08-13T00:00:00.000Z" }],
      foundry_events: [],
    };
    const admin = makeFakeAdmin(tables);
    const r = await publishDraft(admin, OWNER, V2, "en");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("publish_receipt_unreconciled");
    expect(tables.foundry_module_drafts[0].status).toBe("draft");
  });

  it("another owner's event cannot reconcile this draft", async () => {
    const tables: Tables = {
      foundry_module_drafts: [draft()],
      foundry_event_module: [{ event_id: "ev-1", source_draft_id: V2, module_version: 2, module_snapshot: {}, created_at: "2026-08-13T00:00:00.000Z" }],
      foundry_events: [{ id: "ev-1", owner_user_id: "someone-else", created_at: "2026-08-13T00:00:00.000Z" }],
    };
    const admin = makeFakeAdmin(tables);
    const r = await publishDraft(admin, OWNER, V2, "en");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("publish_receipt_unreconciled");
  });
});

describe("[3.2Q-R1] §8F/G — a read failure after commit is not a creation failure", () => {
  it("F — the durable writes land and the reason says the session EXISTS", async () => {
    const tables: Tables = { foundry_module_drafts: [draft()], foundry_event_module: [], foundry_events: [] };
    const admin = makeFakeAdmin(tables);
    getOwnerRoomSnapshot.mockResolvedValue(null);
    const r = await publishDraft(admin, OWNER, V2, "en");
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.reason, "'snapshot_failed' mapped to 'Couldn't create the session' — which was false").toBe("session_created_view_unavailable");
    // Everything durable committed, including the publication stamp.
    expect(tables.foundry_event_module).toHaveLength(1);
    expect(tables.foundry_module_drafts[0].status).toBe("published");
  });

  it("G — the retry after that returns the same event, and creates nothing", async () => {
    const tables: Tables = {
      foundry_module_drafts: [draft({ status: "published", approved_at: "t", published_at: "t" })],
      foundry_event_module: [{ event_id: "ev-1", source_draft_id: V2, module_version: 2, module_snapshot: {}, created_at: "2026-08-13T00:00:00.000Z" }],
      foundry_events: [{ id: "ev-1", owner_user_id: OWNER, created_at: "2026-08-13T00:00:00.000Z" }],
    };
    const admin = makeFakeAdmin(tables);
    const r = await publishDraft(admin, OWNER, V2, "en");
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.reused).toBe(true);
    expect(createTrainingEvent).not.toHaveBeenCalled();
    expect(tables.foundry_event_module).toHaveLength(1);
  });
});

describe("[3.2Q-R1] §8A–D — nothing before the final stamp writes a draft", () => {
  it("A — a gate refusal writes nothing at all", async () => {
    const tables: Tables = {
      foundry_module_drafts: [draft({ answers: { ...(draft().answers as Row), materialIntent: "youtube", materialText: "" } })],
      foundry_event_module: [], foundry_events: [],
    };
    const admin = makeFakeAdmin(tables);
    const r = await publishDraft(admin, OWNER, V2, "en");
    expect(r.ok).toBe(false);
    expect(tables.foundry_event_module).toHaveLength(0);
    expect(tables.foundry_events).toHaveLength(0);
    expect(tables.foundry_module_drafts[0].status).toBe("draft");
  });

  it("B — an event-creation failure leaves the draft untouched", async () => {
    const tables: Tables = { foundry_module_drafts: [draft()], foundry_event_module: [], foundry_events: [] };
    createTrainingEvent.mockResolvedValue({ ok: false, reason: "youtube_url_invalid" });
    const r = await publishDraft(makeFakeAdmin(tables), OWNER, V2, "en");
    expect(r.ok).toBe(false);
    expect(tables.foundry_module_drafts[0].status).toBe("draft");
    expect(tables.foundry_event_module).toHaveLength(0);
  });

  it("C — a module-snapshot failure compensates the event and leaves the draft untouched", async () => {
    const tables: Tables = { foundry_module_drafts: [draft()], foundry_event_module: [], foundry_events: [] };
    const admin = makeFakeAdmin(tables, { table: "foundry_event_module", op: "insert" });
    const r = await publishDraft(admin, OWNER, V2, "en");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("publish_conflict");
    expect(tables.foundry_event_module).toHaveLength(0);
    expect(tables.foundry_module_drafts[0].status).toBe("draft");
  });
});

describe("[3.2Q-R1] §7 — the concurrent loser reconciles too", () => {
  it("the UNIQUE collision returns the winner, reconciles this draft, and leaves one event", async () => {
    /*
      FOUND BY GREP, NOT BY THIS SUITE. The first version of this repair fixed the retry path
      and left the concurrent-loser branch returning `snapshot_failed` over a winner whose
      session exists — the same falsehood, one branch over. Both paths now reconcile and both
      report existence rather than failure.
    */
    const tables: Tables = {
      foundry_module_drafts: [draft()],
      // The winner landed first: its module row is already there, its final stamp is not.
      foundry_event_module: [{ event_id: "ev-winner", source_draft_id: V2, module_version: 2, module_snapshot: {}, created_at: "2026-08-13T00:00:00.000Z" }],
      foundry_events: [{ id: "ev-winner", owner_user_id: OWNER, created_at: "2026-08-13T00:00:00.000Z" }],
    };
    const admin = makeFakeAdmin(tables, { table: "foundry_event_module", op: "insert" });
    const r = await publishDraft(admin, OWNER, V2, "en");
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.reused).toBe(true);
    // Exactly one event survives, and it is the winner's.
    expect(tables.foundry_event_module).toHaveLength(1);
    expect(tables.foundry_event_module[0].event_id).toBe("ev-winner");
    expect(tables.foundry_module_drafts[0].status).toBe("published");
    expect(tables.foundry_module_drafts[0].published_at).toBe("2026-08-13T00:00:00.000Z");
  });
});
