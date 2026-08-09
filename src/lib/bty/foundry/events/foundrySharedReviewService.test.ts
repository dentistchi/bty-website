import { describe, it, expect, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getSharedUnderstandingForOwner, setSharedReview } from "./foundrySharedReviewService";

/**
 * Slice 3.1B-3G CHECKPOINT 2 — the Host Shared Understanding review contract:
 *  - owner-scoping (an unrelated owner sees nothing),
 *  - PRIVACY: the Host payload NEVER carries response_text or the AI reflection, even though the
 *    underlying progress row holds them,
 *  - only SUBMITTED shared responses appear (no legacy "unreviewed backlog"),
 *  - the review write maps the atomic RPC result codes (idempotent 'unchanged').
 */

type Row = Record<string, unknown>;
type Tables = Record<string, Row[]>;

function makeFakeAdmin(tables: Tables, rpc?: (name: string, args: Row) => { data: unknown; error: unknown }) {
  function from(table: string) {
    const q: Record<string, unknown> = {
      _rows: (tables[table] ?? []).slice(),
      select() { return this; },
      eq(this: { _rows: Row[] }, c: string, v: unknown) { this._rows = this._rows.filter((r) => r[c] === v); return this; },
      in(this: { _rows: Row[] }, c: string, vs: unknown[]) { this._rows = this._rows.filter((r) => vs.includes(r[c])); return this; },
      not(this: { _rows: Row[] }, c: string) { this._rows = this._rows.filter((r) => r[c] !== null && r[c] !== undefined); return this; },
      order() { return this; },
      maybeSingle(this: { _rows: Row[] }) { return Promise.resolve({ data: this._rows[0] ?? null, error: null }); },
      then(this: { _rows: Row[] }, onF: (v: { data: Row[]; error: null }) => unknown) {
        return Promise.resolve({ data: this._rows, error: null }).then(onF);
      },
    };
    return q;
  }
  return { from, rpc: async (name: string, args: Row) => (rpc ? rpc(name, args) : { data: null, error: null }) } as unknown as SupabaseClient;
}

const HOST = "host-1";
const OTHER = "host-2";
const EVENT = "ev-1";
const SECRET_REFLECTION = "SECRET PRIVATE REFLECTION BODY";
const SECRET_AI = "SECRET AI REFLECTION";

function seed(): Tables {
  return {
    foundry_events: [{ id: EVENT, owner_user_id: HOST, content_type: "youtube" }],
    foundry_event_training_content: [{ event_id: EVENT, shared_question: "Explain the standard in your own words." }],
    foundry_event_participants: [
      { id: "p1", event_id: EVENT, display_name: "Hanbit" },
      { id: "p2", event_id: EVENT, display_name: "Legacy Learner" },
    ],
    foundry_event_training_progress: [
      {
        // submitted shared response → appears; carries private fields that must NOT leak.
        event_id: EVENT, participant_id: "p1", completed_at: "2026-07-22T00:00:00Z",
        response_text: SECRET_REFLECTION, reflection: SECRET_AI,
        shared_understanding_response: "Always confirm PPE before the procedure.",
        shared_response_submitted_at: "2026-07-22T00:00:00Z",
        host_review_status: "NOT_REVIEWED", host_review_note: null, host_reviewed_at: null,
      },
      {
        // legacy: NO shared response → excluded (never an unreviewed backlog).
        event_id: EVENT, participant_id: "p2", completed_at: "2026-07-20T00:00:00Z",
        response_text: SECRET_REFLECTION, reflection: SECRET_AI,
        shared_understanding_response: null, shared_response_submitted_at: null,
        host_review_status: null, host_review_note: null, host_reviewed_at: null,
      },
    ],
  };
}

describe("getSharedUnderstandingForOwner — authorization + privacy", () => {
  it("owner sees the shared question + only SUBMITTED responses (legacy excluded)", async () => {
    const view = await getSharedUnderstandingForOwner(makeFakeAdmin(seed()), HOST, EVENT);
    expect(view).not.toBeNull();
    expect(view!.sharedQuestion).toBe("Explain the standard in your own words.");
    expect(view!.responses).toHaveLength(1);
    expect(view!.responses[0]!.participantId).toBe("p1");
    expect(view!.responses[0]!.displayName).toBe("Hanbit");
    expect(view!.responses[0]!.sharedResponse).toBe("Always confirm PPE before the procedure.");
    expect(view!.responses[0]!.reviewStatus).toBe("NOT_REVIEWED");
  });

  it("PRIVACY: the serialized Host payload NEVER contains response_text or the AI reflection", async () => {
    const view = await getSharedUnderstandingForOwner(makeFakeAdmin(seed()), HOST, EVENT);
    const json = JSON.stringify(view);
    expect(json).not.toContain(SECRET_REFLECTION);
    expect(json).not.toContain(SECRET_AI);
    expect(json).not.toContain("response_text");
    expect(json).not.toContain("reflection");
  });

  /*
    SLICE 3.2M-1 — the learner's own decision, surfaced beside the shared answer. The privacy
    posture is unchanged: the allow-list still never selects response_text or reflection, and a
    decision is Host-visible for the same reason a shared answer is — the learner was told so.
  */
  it("the Host sees the learner's DECISION, and it is theirs, not BTY's proposal", async () => {
    const t = seed();
    (t.foundry_event_training_progress[0] as Row).decision_response_text = "I will say the two open items out loud.";
    (t.foundry_event_training_progress[0] as Row).decision_submitted_at = "2026-07-22T00:05:00Z";
    const view = await getSharedUnderstandingForOwner(makeFakeAdmin(t), HOST, EVENT);
    expect(view?.responses[0]?.decisionResponse).toBe("I will say the two open items out loud.");
    expect(view?.responses[0]?.decisionSubmittedAt).toBe("2026-07-22T00:05:00Z");
    expect(JSON.stringify(view)).not.toContain(SECRET_REFLECTION);
    expect(JSON.stringify(view)).not.toContain(SECRET_AI);
  });

  it("a decision WITHOUT a shared answer still reaches the Host — a training may ask only one", async () => {
    const t = seed();
    (t.foundry_event_training_progress[1] as Row).decision_response_text = "I will confirm the owner of each task.";
    (t.foundry_event_training_progress[1] as Row).decision_submitted_at = "2026-07-20T00:05:00Z";
    const view = await getSharedUnderstandingForOwner(makeFakeAdmin(t), HOST, EVENT);
    const legacy = view?.responses.find((r) => r.displayName === "Legacy Learner");
    expect(legacy?.decisionResponse).toBe("I will confirm the owner of each task.");
    expect(legacy?.sharedResponse ?? null, "they answered no shared question").toBeNull();
  });

  it("a participant with NEITHER is still excluded — no empty backlog rows", async () => {
    const view = await getSharedUnderstandingForOwner(makeFakeAdmin(seed()), HOST, EVENT);
    expect(view?.responses.map((r) => r.displayName)).toEqual(["Hanbit"]);
  });

  it("an unrelated owner cannot read another event's decision", async () => {
    const t = seed();
    (t.foundry_event_training_progress[0] as Row).decision_response_text = "I will say the two open items out loud.";
    (t.foundry_event_training_progress[0] as Row).decision_submitted_at = "2026-07-22T00:05:00Z";
    expect(await getSharedUnderstandingForOwner(makeFakeAdmin(t), OTHER, EVENT)).toBeNull();
  });

  it("an UNRELATED owner receives null (no foreign disclosure)", async () => {
    const view = await getSharedUnderstandingForOwner(makeFakeAdmin(seed()), OTHER, EVENT);
    expect(view).toBeNull();
  });

  it("returns null for a missing owner/event id", async () => {
    expect(await getSharedUnderstandingForOwner(makeFakeAdmin(seed()), "", EVENT)).toBeNull();
    expect(await getSharedUnderstandingForOwner(makeFakeAdmin(seed()), HOST, "")).toBeNull();
  });
});

describe("setSharedReview — RPC result mapping (owner authz + idempotency handled in-DB)", () => {
  const cases: Array<[string, string]> = [
    ["reviewed", "reviewed"],
    ["unchanged", "unchanged"],
    ["not_owner", "not_owner"],
    ["no_shared_response", "no_shared_response"],
    ["no_progress", "no_progress"],
    ["invalid_status", "invalid_status"],
  ];
  for (const [rpcResult, expected] of cases) {
    it(`maps RPC '${rpcResult}' → '${expected}'`, async () => {
      const admin = makeFakeAdmin(seed(), () => ({ data: [{ result: rpcResult }], error: null }));
      const r = await setSharedReview(admin, HOST, EVENT, "p1", "ALIGNED", null);
      expect(r).toBe(expected);
    });
  }

  it("passes ONLY event/participant/owner/status/note to the RPC (no client-forgeable identity)", async () => {
    const spy = vi.fn();
    const admin = makeFakeAdmin(seed(), (name, args) => { spy(name, args); return { data: [{ result: "reviewed" }], error: null }; });
    await setSharedReview(admin, HOST, EVENT, "p1", "FOLLOW_UP_NEEDED", "revisit sterilization step");
    expect(spy).toHaveBeenCalledWith("bty_foundry_set_shared_review", {
      p_event_id: EVENT, p_participant_id: "p1", p_owner_user_id: HOST,
      p_status: "FOLLOW_UP_NEEDED", p_note: "revisit sterilization step",
    });
  });

  it("a transient RPC error degrades safely (never throws)", async () => {
    const admin = makeFakeAdmin(seed(), () => ({ data: null, error: { message: "boom" } }));
    const r = await setSharedReview(admin, HOST, EVENT, "p1", "ALIGNED", null);
    expect(r).toBe("no_progress");
  });
});
