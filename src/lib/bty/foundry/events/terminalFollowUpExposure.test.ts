import { describe, it, expect, beforeAll, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { readEventFollowUpDays, linkLearnerIdentity, getPublicTrainingSnapshot } from "./foundryTrainingService";
import { signFoundryRoomToken } from "./foundry-room-token";
import { hashParticipantSessionToken } from "./participant-session";

/**
 * R4-R3B1 — THE TERMINAL SCREEN GETS THE CHECKPOINT, AND NOTHING ELSE.
 *
 * The learner clients needed one new fact to explain why signing in matters: did the Host set a
 * follow-up? These tests hold three things at the boundary.
 *
 *   THE ANSWER COMES FROM THE WRITER'S OWN PREDICATE. `readEventFollowUpDays` asks
 *   `isFollowUpDays`, exactly as `materializeFollowupObligation` does, so the screen can never
 *   promise a check-in the writer would refuse to create. Restating "which values count" is how
 *   R4-R3A shipped a read that disagreed with its own write.
 *
 *   IT IS EXPOSED NO EARLIER THAN THE JOURNEY. A viewer who has not joined — or who arrives on a
 *   rotated QR — learns nothing new about the event.
 *
 *   NOTHING ELSE MOVED. No private learner content, no Host-only field, no identity information,
 *   and the ownership contract is untouched: a browser without the participant cookie is still a
 *   stranger.
 */

beforeAll(() => {
  process.env.FOUNDRY_ROOM_QR_SECRET = "test-foundry-terminal-secret-0123456789";
});

const EVENT = "11111111-1111-4111-8111-111111111111";
const SESSION = "raw-session-token";

type Fixture = {
  snapshot?: Record<string, unknown> | null;
  hasModuleRow?: boolean;
  joinVersion?: number;
  participantSession?: string | null;
};

/** Minimal fake: enough tables for the public snapshot path, and a write trap on all of them. */
function makeAdmin(f: Fixture, onWrite?: (what: string) => void) {
  const rows: Record<string, Record<string, unknown>[]> = {
    foundry_events: [
      { id: EVENT, title: "Confirm Patient Understanding", status: "open", join_version: 1, owner_user_id: "owner-1", content_type: "youtube" },
    ],
    foundry_event_module: f.hasModuleRow === false ? [] : [{ event_id: EVENT, module_snapshot: f.snapshot ?? {} }],
    foundry_event_participants:
      f.participantSession === null
        ? []
        : [
            {
              id: "part-1",
              event_id: EVENT,
              display_name: "Hojin",
              status: "joined",
              joined_at: "2026-08-19T00:00:00Z",
              last_seen_at: "2026-08-19T00:00:00Z",
              participant_session_token_hash: hashParticipantSessionToken(f.participantSession ?? SESSION),
            },
          ],
    foundry_event_training_progress: [
      { id: "prog-1", event_id: EVENT, participant_id: "part-1", completed_at: "2026-08-19T01:00:00Z", xp_awarded_at: null, linked_user_id: null, video_completed_at: "2026-08-19T00:30:00Z", video_started_at: "2026-08-19T00:10:00Z" },
    ],
    foundry_event_content: [{ event_id: EVENT, youtube_video_id: "vid", completion_prompt: null, shared_question: null }],
    foundry_arena_practice: [],
  };

  const from = (table: string) => {
    let filtered = [...(rows[table] ?? [])];
    const q: Record<string, unknown> = {
      select() {
        return this;
      },
      eq(col: string, val: unknown) {
        filtered = filtered.filter((r) => r[col] === val);
        return this;
      },
      is(col: string, val: unknown) {
        filtered = filtered.filter((r) => (val === null ? r[col] == null : r[col] === val));
        return this;
      },
      in(col: string, vals: unknown[]) {
        filtered = filtered.filter((r) => vals.includes(r[col]));
        return this;
      },
      order() {
        return this;
      },
      limit() {
        return this;
      },
      maybeSingle: () => Promise.resolve({ data: filtered[0] ?? null, error: null }),
      single: () => Promise.resolve({ data: filtered[0] ?? null, error: null }),
      returns: () => Promise.resolve({ data: filtered, error: null }),
      then: (res: (v: { data: unknown; error: null }) => unknown) => Promise.resolve({ data: filtered, error: null }).then(res),
    };
    for (const m of ["insert", "update", "upsert", "delete"]) {
      q[m] = () => {
        onWrite?.(`${table}.${m}`);
        return q;
      };
    }
    return q;
  };
  return { from, rpc: () => { onWrite?.("rpc"); return Promise.resolve({ data: null, error: null }); } } as unknown as SupabaseClient;
}

const token = (joinVersion = 1) =>
  signFoundryRoomToken({ type: "foundry_room", eventId: EVENT, joinVersion, iat: 1_700_000_000_000 });

/* ------------------------------------------------------------------ the authority */

describe("R4-R3B1 · the checkpoint is read with the writer's own predicate", () => {
  it("7 and 30 are the only values that come back", async () => {
    for (const days of [7, 30] as const) {
      expect(await readEventFollowUpDays(makeAdmin({ snapshot: { followUpDays: days } }), EVENT)).toBe(days);
    }
  });

  it("0, absent, null and an out-of-domain number all resolve to null", async () => {
    // 14 materializes no obligation, so it must not be reported as a configured checkpoint.
    for (const raw of [0, null, undefined, 14, "7", true, {}]) {
      const snapshot = raw === undefined ? { problem: "x" } : { followUpDays: raw };
      expect(await readEventFollowUpDays(makeAdmin({ snapshot }), EVENT), `raw=${JSON.stringify(raw)}`).toBeNull();
    }
  });

  it("no module row at all resolves to null rather than throwing", async () => {
    expect(await readEventFollowUpDays(makeAdmin({ hasModuleRow: false }), EVENT)).toBeNull();
  });

  it("the Journey is never consulted — a grounded action_decision alone configures nothing", async () => {
    const snapshot = {
      realityGroundedJourneyV1: { elements: [{ kind: "action_decision", confirmationStatus: "grounded", content: "x" }] },
    };
    expect(await readEventFollowUpDays(makeAdmin({ snapshot }), EVENT)).toBeNull();
  });

  it("reading the checkpoint writes nothing", async () => {
    const writes: string[] = [];
    await readEventFollowUpDays(makeAdmin({ snapshot: { followUpDays: 7 } }, (w) => writes.push(w)), EVENT);
    expect(writes).toEqual([]);
  });
});

/* ------------------------------------------------------------- the public snapshot */

describe("R4-R3B1 · F · the public snapshot carries it, no earlier than the Journey does", () => {
  it("a joined participant receives the frozen checkpoint", async () => {
    const snap = await getPublicTrainingSnapshot(makeAdmin({ snapshot: { followUpDays: 30 } }), token(), SESSION);
    expect(snap.follow_up_days).toBe(30);
    /*
      R4-R5C4A widened this projection by exactly ONE field, and the assertion stays EXACT rather
      than becoming a `toMatchObject` — the point of pinning it was to notice a new field, and it
      did. `draft_ns` is an opaque per-participant namespace for the learner's own device-local
      draft: it authorises nothing, no route reads it, and it reveals neither the session token
      nor the account. Keeping the exact shape means the NEXT addition is noticed too.
    */
    expect(Object.keys(snap.participant ?? {}).sort()).toEqual(["display_name", "draft_ns"]);
    expect(snap.participant?.display_name).toBe("Hojin");
    expect(snap.participant?.draft_ns).toMatch(/^[A-Za-z0-9_-]{22}$/);
  });

  it("a training with no checkpoint carries null, so the screen promises nothing", async () => {
    const snap = await getPublicTrainingSnapshot(makeAdmin({ snapshot: { followUpDays: 0 } }), token(), SESSION);
    expect(snap.follow_up_days).toBeNull();
  });

  it("a viewer who has not joined learns nothing new", async () => {
    const snap = await getPublicTrainingSnapshot(makeAdmin({ snapshot: { followUpDays: 7 } }), token(), null);
    expect(snap.participant).toBeNull();
    expect(snap.follow_up_days ?? null).toBeNull();
  });

  it("a rotated QR still reveals nothing about the event", async () => {
    const admin = makeAdmin({ snapshot: { followUpDays: 7 } });
    const snap = await getPublicTrainingSnapshot(admin, token(99), null);
    expect(snap.event).toBeNull();
    expect(snap.stage).toBe("inactive");
    expect(snap.follow_up_days ?? null).toBeNull();
  });

  it("the payload gains no private, Host-only or identity field", async () => {
    const json = JSON.stringify(await getPublicTrainingSnapshot(makeAdmin({ snapshot: { followUpDays: 7 } }), token(), SESSION));
    for (const forbidden of [
      "response_text",
      "learner_reflection_text",
      "decision_response_text",
      "linked_user_id",
      "owner_user_id",
      "participant_session_token_hash",
      "part-1",
      "prog-1",
    ]) {
      expect(json, `must not expose ${forbidden}`).not.toContain(forbidden);
    }
  });

  it("reading the whole public snapshot still writes nothing but the existing last_seen touch", async () => {
    const writes: string[] = [];
    await getPublicTrainingSnapshot(makeAdmin({ snapshot: { followUpDays: 7 } }, (w) => writes.push(w)), token(), SESSION);
    // The pre-existing best-effort presence touch is the ONLY write on this path, unchanged.
    expect(writes).toEqual(["foundry_event_participants.update"]);
  });
});

/* ------------------------------------------------------- 15 · ownership invariants */

describe("R4-R3B1 · 15 · an existing identity is never reassigned", () => {
  it("linkLearnerIdentity guards on linked_user_id being null", async () => {
    /*
      The guard is the trailing `.is("linked_user_id", null)`. This asserts the CHAIN, because that
      is where the invariant lives: drop the clause and a second authenticated claimer would
      silently take over someone else's completion.
    */
    const calls: string[] = [];
    const chain: Record<string, unknown> = {};
    for (const m of ["update", "eq", "is"]) {
      chain[m] = (...args: unknown[]) => {
        calls.push(`${m}(${args.map((a) => JSON.stringify(a)).join(",")})`);
        return chain;
      };
    }
    const admin = { from: (t: string) => { calls.push(`from(${t})`); return chain; } } as unknown as SupabaseClient;

    await linkLearnerIdentity(admin, "prog-1", "user-2");
    expect(calls).toEqual([
      "from(foundry_event_training_progress)",
      "update({\"linked_user_id\":\"user-2\"})",
      "eq(\"id\",\"prog-1\")",
      "is(\"linked_user_id\",null)",
    ]);
  });

  it("a null user links nothing at all", async () => {
    const from = vi.fn();
    await linkLearnerIdentity({ from } as unknown as SupabaseClient, "prog-1", null);
    expect(from).not.toHaveBeenCalled();
  });
});
