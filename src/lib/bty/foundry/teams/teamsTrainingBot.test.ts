/**
 * THE TEAMS LEARNER LOOP. Slice Teams Chat-Native Text Training + Quiz V1.
 *
 * Read → questions → canonical score → completion, driven through the real handler against a
 * faithful in-memory database. The heavy account machinery is mocked at its own boundary; the
 * delivery authorization, the session, the exposure stamp and the canonical attempt are all real.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";

const H = vi.hoisted(() => ({
  finalizeCanonical: vi.fn<(a: unknown, i: { authUserId: string | null }) => Promise<Record<string, unknown>>>(async () => ({ applyWindowResult: "skipped" })),
  resolveUser: vi.fn<(a: unknown, t: string, o: string) => Promise<{ status: string; userId: string | null }>>(async () => ({ status: "NOT_LINKED", userId: null })),
  displayNames: vi.fn<(a: unknown, ids: readonly string[]) => Promise<Map<string, string | null>>>(async () => new Map()),
}));

vi.mock("@/lib/bty/foundry/events/foundryTrainingService", async (orig) => {
  const actual = await orig<typeof import("@/lib/bty/foundry/events/foundryTrainingService")>();
  return { ...actual, finalizeCanonicalTrainingCompletion: H.finalizeCanonical };
});
vi.mock("@/lib/bty/identity-link/microsoftIdentityLink.server", () => ({
  resolveBtyUserFromMicrosoftIdentity: H.resolveUser,
}));
vi.mock("@/lib/bty/announcement/recipientDisplayName.server", () => ({ resolveDisplayNames: H.displayNames }));

import { handleTrainingCardAction } from "./teamsTrainingBot.server";
import { BTY_TRAINING_VERBS } from "@/domain/teams/trainingCard";

const TENANT = "10110d5c-bd30-467e-9912-e44e67777647";
const OID_A = "aaaaaaaa-0000-4000-8000-000000000001";
const OID_B = "bbbbbbbb-0000-4000-8000-000000000002";
const DELIVERY_A = "dddddddd-0000-4000-8000-00000000000a";
const DELIVERY_B = "dddddddd-0000-4000-8000-00000000000b";

const QUIZ = {
  schemaVersion: 1,
  questions: [
    { id: "q1", text: "Q1?", position: 1, correctChoiceId: "a", choices: [{ id: "a", label: "Yes" }, { id: "b", label: "No" }] },
    { id: "q2", text: "Q2?", position: 2, correctChoiceId: "b", choices: [{ id: "a", label: "Yes" }, { id: "b", label: "No" }] },
  ],
};

type Row = Record<string, unknown>;

function makeAdmin(over: { secondEvent?: boolean } = {}) {
  let n = 0;
  const tables: Record<string, Row[]> = {
    foundry_events: [
      { id: "ev-1", owner_user_id: "owner-1", title: "Morning Office Opening", status: "open", content_type: "written_guidance", join_version: 1, created_at: "t", closed_at: null },
      ...(over.secondEvent ? [{ id: "ev-2", owner_user_id: "owner-1", title: "Other", status: "open", content_type: "written_guidance", join_version: 1, created_at: "t", closed_at: null }] : []),
    ],
    foundry_event_module: [
      { event_id: "ev-1", module_snapshot: { publishedGuidanceV1: { version: 1, contentType: "written_guidance", materialText: "Escalate within 24 hours.", completionPrompt: null, sharedQuestion: null, completionEvidence: "quiz" } } },
      ...(over.secondEvent ? [{ event_id: "ev-2", module_snapshot: { publishedGuidanceV1: { version: 1, contentType: "written_guidance", materialText: "Other text.", completionPrompt: null, sharedQuestion: null, completionEvidence: "quiz" } } }] : []),
    ],
    foundry_event_quizzes: [
      { event_id: "ev-1", quiz_snapshot: QUIZ },
      ...(over.secondEvent ? [{ event_id: "ev-2", quiz_snapshot: QUIZ }] : []),
    ],
    foundry_teams_training_deliveries: [
      { id: DELIVERY_A, event_id: "ev-1", tenant_id: TENANT, aad_object_id: OID_A, display_name_snapshot: "Ari Kim" },
      { id: DELIVERY_B, event_id: over.secondEvent ? "ev-2" : "ev-1", tenant_id: TENANT, aad_object_id: OID_B, display_name_snapshot: "Bo Lee" },
    ],
    foundry_event_participants: [],
    foundry_event_training_progress: [],
    foundry_teams_training_sessions: [],
    foundry_event_quiz_attempts: [],
  };

  function from(table: string) {
    const rows = (tables[table] ??= []);
    const st = { op: "select" as string, f: [] as { c: string; v: unknown }[], nulls: [] as string[], patch: {} as Row, ins: null as Row | null, conflict: "" };
    const match = () =>
      rows.filter((r) => st.f.every((x) => r[x.c] === x.v) && st.nulls.every((c) => (r[c] ?? null) === null));
    const q: Record<string, unknown> = {
      select: () => q,
      eq: (c: string, v: unknown) => { st.f.push({ c, v }); return q; },
      is: (c: string, v: unknown) => { if (v === null) st.nulls.push(c); return q; },
      insert: (r: Row) => { st.op = "insert"; st.ins = r; return q; },
      update: (p: Row) => { st.op = "update"; st.patch = p; return q; },
      upsert: (r: Row, o?: { onConflict?: string }) => { st.op = "upsert"; st.ins = r; st.conflict = o?.onConflict ?? ""; return q; },
      returns: () => q,
      maybeSingle: () => {
        if (st.op === "insert" && st.ins) {
          const dup = table === "foundry_event_participants" && rows.some((r) => r.participant_session_token_hash === st.ins!.participant_session_token_hash);
          if (dup) return Promise.resolve({ data: null, error: { code: "23505", message: "dup" } });
          const row = { id: `${table}-${++n}`, status: "joined", ...st.ins };
          rows.push(row);
          return Promise.resolve({ data: { ...row }, error: null });
        }
        if (st.op === "upsert" && st.ins) {
          const keys = st.conflict ? st.conflict.split(",") : ["id"];
          const hit = rows.find((r) => keys.every((k) => r[k] === st.ins![k]));
          if (hit) { Object.assign(hit, st.ins); return Promise.resolve({ data: { ...hit }, error: null }); }
          const row = { id: `${table}-${++n}`, ...st.ins };
          rows.push(row);
          return Promise.resolve({ data: { ...row }, error: null });
        }
        if (st.op === "update") {
          const hits = match();
          hits.forEach((r) => Object.assign(r, st.patch));
          return Promise.resolve({ data: hits[0] ? { ...hits[0] } : null, error: null });
        }
        const hit = match()[0] ?? null;
        return Promise.resolve({ data: hit ? { ...hit } : null, error: null });
      },
      single: () => (q.maybeSingle as () => unknown)(),
      then: (onF: (v: { data: unknown; error: unknown }) => unknown) => {
        if (st.op === "upsert" && st.ins) {
          const keys = st.conflict ? st.conflict.split(",") : ["id"];
          const hit = rows.find((r) => keys.every((k) => r[k] === st.ins![k]));
          if (hit) Object.assign(hit, st.ins); else rows.push({ id: `${table}-${++n}`, ...st.ins });
          return Promise.resolve({ data: null, error: null }).then(onF);
        }
        const hits = match();
        if (st.op === "update") hits.forEach((r) => Object.assign(r, st.patch));
        return Promise.resolve({ data: hits.map((r) => ({ ...r })), error: null }).then(onF);
      },
    };
    return q;
  }
  return { admin: { from, rpc: async () => ({ data: null, error: null }) } as unknown as SupabaseClient, tables };
}

const caller = (oid: string) => ({ tenantId: TENANT, aadObjectId: oid });
const read = (deliveryId: string) => ({ verb: BTY_TRAINING_VERBS.read, deliveryId, questionIndex: null, choiceId: null });
const answer = (deliveryId: string, i: number, choiceId: string) => ({ verb: BTY_TRAINING_VERBS.answer, deliveryId, questionIndex: i, choiceId });
const body = (card: Record<string, unknown>) => JSON.stringify(card);

beforeEach(() => {
  vi.clearAllMocks();
  H.finalizeCanonical.mockResolvedValue({ applyWindowResult: "skipped" });
  H.resolveUser.mockResolvedValue({ status: "NOT_LINKED", userId: null });
  H.displayNames.mockResolvedValue(new Map());
});

describe("★ a delivery is only answerable by the person it was sent to", () => {
  it("recipient A cannot act on recipient B's delivery", async () => {
    const { admin, tables } = makeAdmin();
    const res = await handleTrainingCardAction(admin, read(DELIVERY_B), caller(OID_A));
    expect(body(res.card)).toContain("sent to someone else");
    expect(tables.foundry_event_participants).toHaveLength(0);
    expect(tables.foundry_teams_training_sessions).toHaveLength(0);
  });

  it("a foreign TENANT with the right object id is refused", async () => {
    const { admin } = makeAdmin();
    const res = await handleTrainingCardAction(admin, read(DELIVERY_A), { tenantId: "99999999-9999-4999-8999-999999999999", aadObjectId: OID_A });
    expect(body(res.card)).toContain("sent to someone else");
  });

  it("★ another EVENT's delivery cannot cross-bind a participant", async () => {
    const { admin, tables } = makeAdmin({ secondEvent: true });
    await handleTrainingCardAction(admin, read(DELIVERY_A), caller(OID_A));
    // B's delivery belongs to ev-2; A may not touch it, so no ev-2 participant appears for A.
    await handleTrainingCardAction(admin, read(DELIVERY_B), caller(OID_A));
    const events = tables.foundry_event_participants.map((p) => p.event_id);
    expect(events).toEqual(["ev-1"]);
  });

  it("an unknown delivery id names nothing", async () => {
    const { admin, tables } = makeAdmin();
    const res = await handleTrainingCardAction(admin, read("ffffffff-0000-4000-8000-00000000ffff"), caller(OID_A));
    expect(body(res.card)).toContain("sent to someone else");
    expect(tables.foundry_event_participants).toHaveLength(0);
  });
});

describe("the read action", () => {
  it("creates the Microsoft-bound participant, stamps exposure, and shows question 1", async () => {
    const { admin, tables } = makeAdmin();
    const res = await handleTrainingCardAction(admin, read(DELIVERY_A), caller(OID_A));

    const participant = tables.foundry_event_participants[0]!;
    expect(participant.microsoft_tenant_id).toBe(TENANT);
    expect(participant.microsoft_aad_object_id).toBe(OID_A);
    expect(participant.user_id ?? null).toBeNull(); // unlinked is ordinary
    expect(tables.foundry_event_training_progress[0]!.written_guidance_read_at).toBeTruthy();
    expect(body(res.card)).toContain("Q1?");
    // NO completion and NO XP at the read step.
    expect(tables.foundry_event_training_progress[0]!.completed_at ?? null).toBeNull();
    expect(H.finalizeCanonical).not.toHaveBeenCalled();
  });

  it("is idempotent — reading twice does not restamp or rewind", async () => {
    const { admin, tables } = makeAdmin();
    await handleTrainingCardAction(admin, read(DELIVERY_A), caller(OID_A));
    const stamp = tables.foundry_event_training_progress[0]!.written_guidance_read_at;
    await handleTrainingCardAction(admin, answer(DELIVERY_A, 0, "a"), caller(OID_A));
    await handleTrainingCardAction(admin, read(DELIVERY_A), caller(OID_A));
    expect(tables.foundry_event_training_progress[0]!.written_guidance_read_at).toBe(stamp);
    expect(tables.foundry_event_participants).toHaveLength(1);
    // Still on question 2 — the read did not send them back to the start.
    expect(tables.foundry_teams_training_sessions[0]!.current_question_index).toBe(1);
  });
});

describe("the sequential quiz", () => {
  async function runToEnd(admin: SupabaseClient, choices: string[]) {
    await handleTrainingCardAction(admin, read(DELIVERY_A), caller(OID_A));
    let last: { card: Record<string, unknown> } = { card: {} };
    for (let i = 0; i < choices.length; i += 1) {
      last = await handleTrainingCardAction(admin, answer(DELIVERY_A, i, choices[i]!), caller(OID_A));
    }
    return last;
  }

  it("walks the questions and finishes with ONE canonical attempt", async () => {
    const { admin, tables } = makeAdmin();
    const last = await runToEnd(admin, ["a", "b"]);

    expect(tables.foundry_event_quiz_attempts).toHaveLength(1);
    const attempt = tables.foundry_event_quiz_attempts[0]!;
    expect(attempt.correct_count).toBe(2);
    expect(attempt.total_count).toBe(2);
    expect(H.finalizeCanonical).toHaveBeenCalledTimes(1);
    expect(body(last.card)).toContain("2 / 2");
    expect(body(last.card)).toContain("100%");
  });

  it("scores from the SERVER's session, not from the card", async () => {
    const { admin, tables } = makeAdmin();
    await runToEnd(admin, ["b", "a"]); // both wrong
    expect(tables.foundry_event_quiz_attempts[0]!.correct_count).toBe(0);
  });

  it("★ a replayed answer does not create a second attempt or change the first", async () => {
    const { admin, tables } = makeAdmin();
    await runToEnd(admin, ["a", "b"]);
    await handleTrainingCardAction(admin, answer(DELIVERY_A, 1, "a"), caller(OID_A));
    await handleTrainingCardAction(admin, answer(DELIVERY_A, 0, "b"), caller(OID_A));
    expect(tables.foundry_event_quiz_attempts).toHaveLength(1);
    expect(tables.foundry_event_quiz_attempts[0]!.correct_count).toBe(2);
    expect(H.finalizeCanonical).toHaveBeenCalledTimes(1);
  });

  it("a stale card index re-renders where the learner is, and writes nothing", async () => {
    const { admin, tables } = makeAdmin();
    await handleTrainingCardAction(admin, read(DELIVERY_A), caller(OID_A));
    const res = await handleTrainingCardAction(admin, answer(DELIVERY_A, 1, "a"), caller(OID_A));
    expect(body(res.card)).toContain("Q1?");
    expect(tables.foundry_event_quiz_attempts).toHaveLength(0);
  });

  it("a choice that is not on the question is refused", async () => {
    const { admin, tables } = makeAdmin();
    await handleTrainingCardAction(admin, read(DELIVERY_A), caller(OID_A));
    const res = await handleTrainingCardAction(admin, answer(DELIVERY_A, 0, "zzz"), caller(OID_A));
    expect(body(res.card)).toContain("Q1?");
    expect(tables.foundry_teams_training_sessions[0]!.current_question_index).toBe(0);
  });

  it("★ the session never stores a correct answer or a score", async () => {
    const { admin, tables } = makeAdmin();
    await runToEnd(admin, ["a", "b"]);
    const s = JSON.stringify(tables.foundry_teams_training_sessions);
    expect(s).not.toMatch(/correct/i);
    expect(s).not.toMatch(/score/i);
  });

  it("a finished training keeps showing its result", async () => {
    const { admin } = makeAdmin();
    await runToEnd(admin, ["a", "b"]);
    const again = await handleTrainingCardAction(admin, read(DELIVERY_A), caller(OID_A));
    expect(body(again.card)).toContain("2 / 2");
  });
});

describe("the account link is optional and never blocks learning", () => {
  it("an UNLINKED employee still completes, and the finalizer is told there is no user", async () => {
    const { admin, tables } = makeAdmin();
    await handleTrainingCardAction(admin, read(DELIVERY_A), caller(OID_A));
    await handleTrainingCardAction(admin, answer(DELIVERY_A, 0, "a"), caller(OID_A));
    await handleTrainingCardAction(admin, answer(DELIVERY_A, 1, "b"), caller(OID_A));
    expect(tables.foundry_event_quiz_attempts).toHaveLength(1);
    expect(H.finalizeCanonical.mock.calls[0]![0]).toBeDefined();
    expect(H.finalizeCanonical.mock.calls[0]![1].authUserId).toBeNull();
  });

  it("a LINKED employee is attributed directly", async () => {
    H.resolveUser.mockResolvedValue({ status: "RESOLVED", userId: "user-A" });
    const { admin, tables } = makeAdmin();
    await handleTrainingCardAction(admin, read(DELIVERY_A), caller(OID_A));
    await handleTrainingCardAction(admin, answer(DELIVERY_A, 0, "a"), caller(OID_A));
    await handleTrainingCardAction(admin, answer(DELIVERY_A, 1, "b"), caller(OID_A));
    expect(tables.foundry_event_participants[0]!.user_id).toBe("user-A");
    expect(H.finalizeCanonical.mock.calls[0]![1].authUserId).toBe("user-A");
  });
});
