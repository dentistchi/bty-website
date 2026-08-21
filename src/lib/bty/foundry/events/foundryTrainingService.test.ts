import { describe, it, expect, beforeAll, beforeEach, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";

// Mock the canonical Core XP primitive so the test never touches arena_profiles/avatar.
vi.mock("@/lib/bty/arena/applyCoreXp", () => ({
  applyDirectCoreXp: vi.fn(async () => ({ newCoreTotal: 10 })),
}));

// Control the embeddability gate; keep the real allow/reason helpers. Default
// "embeddable" so the existing create-based setups proceed.
const embedState = { value: "embeddable" as string };
vi.mock("./youtubeEmbed", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./youtubeEmbed")>();
  return { ...actual, resolveYoutubeEmbeddable: async () => embedState.value };
});

import { applyDirectCoreXp } from "@/lib/bty/arena/applyCoreXp";
import { createEvent, joinEvent } from "./foundryEventService";
import { simulateClaimAssignment, seedAssignment, readAssignment } from "./__fixtures__/assignmentClaimSim";
import {
  createTrainingEvent,
  getOwnerTrainingSnapshot,
  getPublicTrainingSnapshot,
  startVideo,
  completeVideo,
  completeTraining,
  claimXp,
} from "./foundryTrainingService";

beforeAll(() => {
  process.env.FOUNDRY_ROOM_QR_SECRET = "test-foundry-training-secret-0123456789";
});

const awardSpy = applyDirectCoreXp as unknown as ReturnType<typeof vi.fn>;
// Program resolve-or-create RPC result (Slice 3.2C-R1). Default: a Host WITH one
// active-primary org → a resolved Program. A test may set an org error to prove
// Quick creation fails closed.
const programRpcState = { result: { data: [{ program_id: "prog-test" }] as unknown, error: null as unknown } };
beforeEach(() => {
  awardSpy.mockClear();
  embedState.value = "embeddable";
  programRpcState.result = { data: [{ program_id: "prog-test" }], error: null };
});

// ---- Capable in-memory fake (4 tables + core_xp_ledger, with unique constraints) ----
type Row = Record<string, unknown>;

const UNIQUE: Record<string, string[][]> = {
  foundry_event_participants: [["participant_session_token_hash"]],
  foundry_event_training_content: [["event_id"]],
  foundry_event_training_progress: [["event_id", "participant_id"]],
  core_xp_ledger: [["source_type", "source_id"]],
};

function makeFakeAdmin() {
  const tables: Record<string, Row[]> = {
    foundry_events: [],
    foundry_event_participants: [],
    foundry_event_training_content: [],
    foundry_event_training_progress: [],
    core_xp_ledger: [],
  };
  let counter = 0;
  const nid = (t: string) => `${t}-${++counter}`;

  function defaults(table: string, r: Row): Row {
    const now = new Date().toISOString();
    if (table === "foundry_events")
      return { id: nid("ev"), status: "open", join_version: 1, created_at: now, closed_at: null, ...r };
    if (table === "foundry_event_participants")
      return { id: nid("pt"), status: "joined", joined_at: now, last_seen_at: now, removed_at: null, ...r };
    if (table === "foundry_event_training_content")
      return { youtube_title: null, youtube_channel_title: null, youtube_thumbnail_url: null, created_at: now, ...r };
    if (table === "foundry_event_training_progress")
      return {
        id: nid("pr"),
        video_started_at: null,
        video_completed_at: null,
        response_text: null,
        completed_at: null,
        linked_user_id: null,
        xp_awarded_at: null,
        created_at: now,
        updated_at: now,
        ...r,
      };
    return { id: nid("led"), created_at: now, ...r };
  }

  function violatesUnique(table: string, row: Row): boolean {
    const cons = UNIQUE[table] ?? [];
    return cons.some((cols) =>
      tables[table].some((existing) => cols.every((c) => existing[c] != null && existing[c] === row[c])),
    );
  }

  class Q {
    private filters: Array<{ col: string; val: unknown; kind: "eq" | "in" | "is" }> = [];
    private orderCol: string | null = null;
    private orderAsc = true;
    private mode: "select" | "insert" | "update" | "delete" = "select";
    private rows: Row[] = [];
    private patch: Row = {};
    private lastInserted: Row[] = [];
    private lastMatched: Row[] = [];
    private insertError: { code?: string; message: string } | null = null;
    constructor(private store: Row[], private table: string) {}
    select() {
      return this;
    }
    insert(r: Row | Row[]) {
      this.mode = "insert";
      this.rows = Array.isArray(r) ? r : [r];
      return this;
    }
    update(p: Row) {
      this.mode = "update";
      this.patch = p;
      return this;
    }
    delete() {
      this.mode = "delete";
      return this;
    }
    eq(col: string, val: unknown) {
      this.filters.push({ col, val, kind: "eq" });
      return this;
    }
    in(col: string, vals: unknown[]) {
      this.filters.push({ col, val: vals, kind: "in" });
      return this;
    }
    is(col: string, val: unknown) {
      this.filters.push({ col, val, kind: "is" });
      return this;
    }
    order(col: string, opts?: { ascending?: boolean }) {
      this.orderCol = col;
      this.orderAsc = opts?.ascending !== false;
      return this;
    }
    returns() {
      return this;
    }
    private match(row: Row) {
      return this.filters.every((f) => {
        if (f.kind === "eq") return row[f.col] === f.val;
        if (f.kind === "in") return (f.val as unknown[]).includes(row[f.col]);
        return (row[f.col] ?? null) === (f.val ?? null); // is
      });
    }
    private ordered(rows: Row[]) {
      if (!this.orderCol) return rows;
      const c = this.orderCol;
      return [...rows].sort((a, b) => {
        const av = a[c] as string;
        const bv = b[c] as string;
        return av < bv ? (this.orderAsc ? -1 : 1) : av > bv ? (this.orderAsc ? 1 : -1) : 0;
      });
    }
    private exec(): { data: Row[]; error: { code?: string; message: string } | null } {
      if (this.mode === "insert") {
        for (const r of this.rows) {
          const withDefaults = defaults(this.table, r);
          if (violatesUnique(this.table, withDefaults)) {
            this.insertError = { code: "23505", message: "duplicate key" };
            return { data: [], error: this.insertError };
          }
          this.lastInserted.push(withDefaults);
          this.store.push(withDefaults);
        }
        return { data: this.lastInserted, error: null };
      }
      if (this.mode === "update") {
        this.lastMatched = this.store.filter((r) => this.match(r));
        this.lastMatched.forEach((r) => Object.assign(r, this.patch));
        return { data: this.lastMatched, error: null };
      }
      if (this.mode === "delete") {
        const keep = this.store.filter((r) => !this.match(r));
        const removed = this.store.filter((r) => this.match(r));
        this.store.length = 0;
        this.store.push(...keep);
        return { data: removed, error: null };
      }
      return { data: this.ordered(this.store.filter((r) => this.match(r))), error: null };
    }
    single() {
      const res = this.exec();
      const first = this.mode === "insert" ? this.lastInserted[0] : res.data[0];
      return Promise.resolve({ data: first ?? null, error: res.error });
    }
    maybeSingle() {
      const res = this.exec();
      const first = this.mode === "update" ? this.lastMatched[0] : res.data[0];
      return Promise.resolve({ data: first ?? null, error: res.error });
    }
    then(onF: (v: { data: Row[]; error: unknown }) => unknown, onR?: (e: unknown) => unknown) {
      return Promise.resolve(this.exec()).then(onF, onR);
    }
  }

  // Simulate the atomic award RPC (mirrors bty_foundry_award_daily_capped SQL):
  // idempotency by source_id, one-per-(user,event), per-day cap; inserts ledger.
  function rpc(name: string, p: Record<string, unknown>) {
    if (name === "bty_foundry_claim_assignment") {
      // record the call so a test can prove the assignment claim runs even on the
      // XP-already-awarded early-return path (Slice 3.1B-3D fix).
      tables.__claim_calls = tables.__claim_calls ?? [];
      (tables.__claim_calls as Array<Record<string, unknown>>).push(p);
      return Promise.resolve(simulateClaimAssignment(tables, p));
    }
    if (name === "bty_foundry_resolve_or_create_program") {
      return Promise.resolve(programRpcState.result);
    }
    if (name !== "bty_foundry_award_daily_capped") {
      return Promise.resolve({ data: null, error: { message: "unknown rpc" } });
    }
    const led = tables.core_xp_ledger;
    const SRC = "foundry_training_completion";
    if (led.some((l) => l.source_type === SRC && l.source_id === p.p_source_id)) {
      return Promise.resolve({ data: "already_awarded", error: null });
    }
    const eventAwarded = led.some((l) => {
      if (l.source_type !== SRC || l.user_id !== p.p_user_id) return false;
      const pr = tables.foundry_event_training_progress.find((x) => x.id === l.source_id);
      return pr && pr.event_id === p.p_event_id;
    });
    if (eventAwarded) return Promise.resolve({ data: "event_already_awarded", error: null });
    const count = led.filter(
      (l) =>
        l.user_id === p.p_user_id &&
        l.source_type === SRC &&
        (l.created_at as string) >= (p.p_day_start as string) &&
        (l.created_at as string) < (p.p_day_end as string),
    ).length;
    if (count >= (p.p_max_per_day as number)) {
      return Promise.resolve({ data: "daily_limit", error: null });
    }
    led.push({
      id: nid("led"),
      user_id: p.p_user_id,
      delta_xp: p.p_xp,
      source_type: SRC,
      source_id: p.p_source_id,
      created_at: new Date().toISOString(),
    });
    return Promise.resolve({ data: "awarded", error: null });
  }

  return {
    admin: {
      from: (t: string) => new Q((tables[t] ??= []), t),
      rpc,
    } as unknown as SupabaseClient,
    tables,
  };
}

const OWNER = "owner-1";
const AUTH = "auth-user-9";
const YT = "https://www.youtube.com/watch?v=dQw4w9WgXcQ";

async function setupJoined() {
  const { admin, tables } = makeFakeAdmin();
  const created = await createTrainingEvent(admin, OWNER, {
    title: "Handling Difficult Conversations",
    youtube_url: YT,
    completion_prompt: "What will you do differently?",
  });
  if (!created.ok) throw new Error("setup create failed: " + created.reason);
  const eventId = created.value.event.id;
  const token = created.value.event.join_token;
  const joined = await joinEvent(admin, token, "Sarah", null);
  if (!joined.ok) throw new Error("setup join failed");
  return { admin, tables, eventId, token, session: joined.sessionToken };
}

describe("createTrainingEvent", () => {
  it("creates event + content and returns a training snapshot", async () => {
    const { admin } = makeFakeAdmin();
    const r = await createTrainingEvent(admin, OWNER, {
      title: "Safety Training",
      youtube_url: YT,
      completion_prompt: "One safety habit?",
    });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.event.training?.youtube_video_id).toBe("dQw4w9WgXcQ");
      expect(r.value.event.join_token.startsWith("btyfr1.")).toBe(true);
      expect(r.value.joined_count).toBe(0);
      expect(r.value.completed_count).toBe(0);
    }
  });

  it("rejects an invalid YouTube URL (and leaves no event behind)", async () => {
    const { admin, tables } = makeFakeAdmin();
    const r = await createTrainingEvent(admin, OWNER, {
      title: "Bad",
      youtube_url: "https://vimeo.com/12345",
      completion_prompt: "q",
    });
    expect(r).toEqual({ ok: false, reason: "youtube_url_invalid" });
    expect(tables.foundry_events).toHaveLength(0);
  });

  it("rejects a blank prompt", async () => {
    const { admin } = makeFakeAdmin();
    const r = await createTrainingEvent(admin, OWNER, { title: "T", youtube_url: YT, completion_prompt: "  " });
    expect(r).toEqual({ ok: false, reason: "prompt_required" });
  });

  it("links the created run to a Program identity (Quick Program, 3.2C)", async () => {
    const { admin, tables } = makeFakeAdmin();
    const r = await createTrainingEvent(admin, OWNER, { title: "Prog", youtube_url: YT, completion_prompt: "q?" });
    expect(r.ok).toBe(true);
    expect(tables.foundry_events[0]?.program_id).toBe("prog-test"); // non-null Program on the run
  });

  it("FAILS CLOSED (no event/content) when the owner has no canonical org (3.2C-R1)", async () => {
    programRpcState.result = { data: null, error: { message: "organization_unresolved" } };
    const { admin, tables } = makeFakeAdmin();
    const r = await createTrainingEvent(admin, OWNER, { title: "NoOrg", youtube_url: YT, completion_prompt: "q?" });
    expect(r).toEqual({ ok: false, reason: "organization_unresolved" });
    expect(tables.foundry_events).toHaveLength(0); // no silent unlinked event
    expect(tables.foundry_event_training_content ?? []).toHaveLength(0);
  });
});

describe("createTrainingEvent — embeddability gate (atomic)", () => {
  const input = { title: "T", youtube_url: YT, completion_prompt: "q?" };

  it("embeddable → creates the event", async () => {
    const { admin } = makeFakeAdmin();
    embedState.value = "embeddable";
    expect((await createTrainingEvent(admin, OWNER, input)).ok).toBe(true);
  });

  it("not_embeddable → rejected with NO event/content rows (atomic)", async () => {
    const { admin, tables } = makeFakeAdmin();
    embedState.value = "not_embeddable";
    expect(await createTrainingEvent(admin, OWNER, input)).toEqual({
      ok: false,
      reason: "video_not_embeddable",
    });
    expect(tables.foundry_events).toHaveLength(0);
    expect(tables.foundry_event_training_content).toHaveLength(0);
  });

  it("missing video → video_not_found, no rows", async () => {
    const { admin, tables } = makeFakeAdmin();
    embedState.value = "not_found";
    expect(await createTrainingEvent(admin, OWNER, input)).toEqual({
      ok: false,
      reason: "video_not_found",
    });
    expect(tables.foundry_events).toHaveLength(0);
  });

  it("API failure → youtube_check_failed, no rows (fail closed)", async () => {
    const { admin, tables } = makeFakeAdmin();
    embedState.value = "check_failed";
    expect(await createTrainingEvent(admin, OWNER, input)).toEqual({
      ok: false,
      reason: "youtube_check_failed",
    });
    expect(tables.foundry_events).toHaveLength(0);
  });

  it("unconfigured (local/dev only) → allowed to create", async () => {
    const { admin } = makeFakeAdmin();
    embedState.value = "unconfigured";
    expect((await createTrainingEvent(admin, OWNER, input)).ok).toBe(true);
  });
});

describe("progress: watch → response → complete", () => {
  it("advances stages and gates the response on video completion", async () => {
    const { admin, token, session } = await setupJoined();

    // Watch stage exposes the video, not the prompt.
    let snap = await getPublicTrainingSnapshot(admin, token, session);
    expect(snap.stage).toBe("watch");
    expect(snap.training?.youtube_video_id).toBe("dQw4w9WgXcQ");
    expect(snap.training?.completion_prompt).toBeNull();

    // Cannot submit a response before the video is server-marked complete.
    const early = await completeTraining(admin, token, session, "too soon", null);
    expect(early).toEqual({ ok: false, reason: "video_not_complete" });

    await startVideo(admin, token, session);
    const afterVideo = await completeVideo(admin, token, session);
    expect(afterVideo.ok && afterVideo.snapshot.stage).toBe("response");
    expect(afterVideo.ok && afterVideo.snapshot.training?.completion_prompt).toBe("What will you do differently?");

    // Anonymous completion → claimable, no XP written.
    const done = await completeTraining(admin, token, session, "I will pause before replying.", null);
    expect(done.ok && done.snapshot.stage).toBe("completed_claimable");
    expect(done.ok && done.snapshot.xp_status).toBe("claimable");
    expect(awardSpy).not.toHaveBeenCalled();

    // Idempotent: re-completing does not re-open or re-award.
    const again = await completeTraining(admin, token, session, "changed answer", null);
    expect(again.ok && again.snapshot.stage).toBe("completed_claimable");
  });

  it("blank response is rejected", async () => {
    const { admin, token, session } = await setupJoined();
    await completeVideo(admin, token, session);
    expect(await completeTraining(admin, token, session, "   ", null)).toEqual({
      ok: false,
      reason: "response_required",
    });
  });
});

describe("XP: authenticated award vs anonymous claim", () => {
  it("authenticated completion awards 10 Core XP once via the canonical path", async () => {
    const { admin, token, session, tables } = await setupJoined();
    await completeVideo(admin, token, session);
    const done = await completeTraining(admin, token, session, "My reflection.", AUTH);
    expect(done.ok && done.snapshot.stage).toBe("completed_awarded");
    expect(done.ok && done.snapshot.xp_status).toBe("awarded");
    expect(awardSpy).toHaveBeenCalledTimes(1);
    expect(awardSpy).toHaveBeenCalledWith(admin, AUTH, 10);
    // Exactly one ledger row, attributed to Foundry training.
    expect(tables.core_xp_ledger).toHaveLength(1);
    expect(tables.core_xp_ledger[0].source_type).toBe("foundry_training_completion");
  });

  it("anonymous completion then claim awards exactly once", async () => {
    const { admin, token, session, tables } = await setupJoined();
    await completeVideo(admin, token, session);
    await completeTraining(admin, token, session, "Anon reflection.", null);
    expect(awardSpy).not.toHaveBeenCalled();

    const claim = await claimXp(admin, token, session, AUTH);
    expect(claim.ok && claim.snapshot.stage).toBe("completed_awarded");
    expect(awardSpy).toHaveBeenCalledTimes(1);

    // Second claim is idempotent — no second award.
    const claim2 = await claimXp(admin, token, session, AUTH);
    expect(claim2.ok && claim2.snapshot.stage).toBe("completed_awarded");
    expect(awardSpy).toHaveBeenCalledTimes(1);

    // Slice 3.1B-3D fix: the assignment claim runs on BOTH the awarding call AND the
    // idempotent early-return call (XP already awarded). The earlier bug ran it only on the
    // awarding call, so a previously-awarded session never connected its assignment.
    const claimCalls = (tables.__claim_calls as Array<Record<string, unknown>>) ?? [];
    expect(claimCalls.length).toBeGreaterThanOrEqual(2);
    expect(claimCalls.every((c) => c.p_auth_user_id === AUTH)).toBe(true);
  });

  it("claim requires a completed progress row", async () => {
    const { admin, token, session } = await setupJoined();
    expect(await claimXp(admin, token, session, AUTH)).toEqual({ ok: false, reason: "not_completed" });
  });
});

describe("XP integrity hardening (owner / daily cap / same-user-same-event)", () => {
  async function makeEvent(admin: SupabaseClient, owner: string, title: string) {
    const c = await createTrainingEvent(admin, owner, {
      title,
      youtube_url: YT,
      completion_prompt: "q?",
    });
    if (!c.ok) throw new Error("create failed");
    return { eventId: c.value.event.id, token: c.value.event.join_token };
  }
  async function joinComplete(
    admin: SupabaseClient,
    token: string,
    name: string,
    authUser: string | null,
  ) {
    const j = await joinEvent(admin, token, name, null);
    if (!j.ok) throw new Error("join failed");
    await completeVideo(admin, token, j.sessionToken);
    return completeTraining(admin, token, j.sessionToken, "reflection", authUser);
  }

  /*
    SLICE 3.2M-2R1 — identity is not a reward.

    `linked_user_id` used to be written only inside `if (outcome === "awarded")`, so a learner
    who hit the daily cap, or who owned the event, completed the training and the system then
    did not know who they were: no practice doorway, no attribution, no PRACTICED. These pin
    the rule that identity now survives every XP outcome.
  */
  const linkedFor = (tables: Record<string, Record<string, unknown>[]>) =>
    (tables.foundry_event_training_progress ?? []).map((r) => r.linked_user_id ?? null);

  it("XP AWARDED → identity linked (unchanged)", async () => {
    const { admin, tables } = makeFakeAdmin();
    const { token } = await makeEvent(admin, OWNER, "E");
    const r = await joinComplete(admin, token, "Lee", "learner-1");
    expect(r.ok && r.snapshot.xp_status).toBe("awarded");
    expect(linkedFor(tables)).toEqual(["learner-1"]);
  });

  it("OWNER_INELIGIBLE → identity STILL linked — the owner is who completed it", async () => {
    const { admin, tables } = makeFakeAdmin();
    const { token } = await makeEvent(admin, OWNER, "Owner's own");
    const r = await joinComplete(admin, token, "TheOwner", OWNER);
    expect(r.ok && r.snapshot.xp_status).toBe("owner_ineligible");
    expect(tables.core_xp_ledger, "XP policy is untouched").toHaveLength(0);
    expect(linkedFor(tables)).toEqual([OWNER]);
  });

  it("DAILY_LIMIT → identity STILL linked on the capped completion", async () => {
    const { admin, tables } = makeFakeAdmin();
    const LEARNER = "learner-capped";
    for (let i = 1; i <= 3; i++) {
      const { token } = await makeEvent(admin, OWNER, `E${i}`);
      await joinComplete(admin, token, "Lee", LEARNER);
    }
    const { token } = await makeEvent(admin, OWNER, "E4");
    const r = await joinComplete(admin, token, "Lee", LEARNER);
    expect(r.ok && r.snapshot.xp_status).toBe("daily_limit");
    expect(tables.core_xp_ledger, "the cap still holds").toHaveLength(3);
    // Every one of the four completions knows who did it, including the capped one.
    expect(linkedFor(tables)).toEqual([LEARNER, LEARNER, LEARNER, LEARNER]);
  });

  it("ANONYMOUS completion stays anonymous — identity is never inferred", async () => {
    const { admin, tables } = makeFakeAdmin();
    const { token } = await makeEvent(admin, OWNER, "E");
    const r = await joinComplete(admin, token, "Anon", null);
    expect(r.ok).toBe(true);
    expect(linkedFor(tables)).toEqual([null]);
  });

  it("the FIRST identified learner keeps the row — a second account cannot take it over", async () => {
    const { admin, tables } = makeFakeAdmin();
    const { token } = await makeEvent(admin, OWNER, "E");
    const j = await joinEvent(admin, token, "Lee", null);
    if (!j.ok) throw new Error("join failed");
    await completeVideo(admin, token, j.sessionToken);
    await completeTraining(admin, token, j.sessionToken, "reflection", "learner-1");
    // A repeat completion by a different account is idempotent AND non-transferring.
    await completeTraining(admin, token, j.sessionToken, "again", "learner-2");
    expect(linkedFor(tables)).toEqual(["learner-1"]);
  });

  it("event owner earns no XP from their own event (owner_ineligible, completion valid)", async () => {
    const { admin, tables } = makeFakeAdmin();
    const { token } = await makeEvent(admin, OWNER, "Owner's own");
    const r = await joinComplete(admin, token, "TheOwner", OWNER); // owner completes own event
    expect(r.ok && r.snapshot.stage).toBe("completed_claimable");
    expect(r.ok && r.snapshot.xp_status).toBe("owner_ineligible");
    expect(tables.core_xp_ledger).toHaveLength(0);
    expect(awardSpy).not.toHaveBeenCalled();
  });

  it("caps at 3 Core XP awards per canonical BTY day; 4th returns daily_limit", async () => {
    const { admin, tables } = makeFakeAdmin();
    const LEARNER = "learner-1";
    for (let i = 1; i <= 3; i++) {
      const { token } = await makeEvent(admin, OWNER, `E${i}`);
      const r = await joinComplete(admin, token, "Lee", LEARNER);
      expect(r.ok && r.snapshot.xp_status).toBe("awarded");
    }
    expect(tables.core_xp_ledger).toHaveLength(3);
    expect(awardSpy).toHaveBeenCalledTimes(3);

    const { token: t4 } = await makeEvent(admin, OWNER, "E4");
    const r4 = await joinComplete(admin, t4, "Lee", LEARNER);
    expect(r4.ok && r4.snapshot.xp_status).toBe("daily_limit");
    expect(tables.core_xp_ledger).toHaveLength(3); // no 4th ledger row
    expect(awardSpy).toHaveBeenCalledTimes(3); // no 4th total bump
  });

  it("same user, two participants, same event → awarded once, delta exactly 10", async () => {
    const { admin, tables } = makeFakeAdmin();
    const LEARNER = "learner-2";
    const { token } = await makeEvent(admin, OWNER, "One event");

    const first = await joinComplete(admin, token, "Kim (phone)", LEARNER);
    expect(first.ok && first.snapshot.xp_status).toBe("awarded");

    // Second device: new participant + session, same event, same user.
    const second = await joinComplete(admin, token, "Kim (laptop)", LEARNER);
    expect(second.ok && second.snapshot.xp_status).toBe("awarded"); // already holds it
    expect(tables.core_xp_ledger).toHaveLength(1); // exactly one award
    expect(awardSpy).toHaveBeenCalledTimes(1); // total bumped once
    expect(tables.core_xp_ledger[0].delta_xp).toBe(10);
  });
});

describe("public snapshot — Reality-Grounded Journey (B3A)", () => {
  const JMOD = {
    version: 1,
    displayTitle: "Owning the next step",
    displayTitleStatus: "grounded",
    elements: [
      { id: "el_why_it_matters", kind: "why_it_matters", content: "People leave the huddle without naming who acts.", grounding: [{ sourceType: "host_statement", field: "problem" }], confirmationStatus: "grounded" },
      { id: "el_observable_standard", kind: "observable_standard", content: "The owner repeats the action and deadline aloud.", grounding: [{ sourceType: "host_statement", field: "observableBehavior" }], confirmationStatus: "grounded" },
      { id: "el_completion_check", kind: "completion_check", content: "What action had a named owner?", grounding: [{ sourceType: "host_statement", field: "completionPrompt" }], confirmationStatus: "grounded" },
    ],
  };

  it("exposes the approved Journey (learner-safe) from the module snapshot", async () => {
    const { admin, token, session, eventId } = await setupJoined();
    await admin.from("foundry_event_module").insert({ event_id: eventId, source_draft_id: "d-src", module_version: 1, module_snapshot: { realityGroundedJourneyV1: JMOD } });
    const snap = await getPublicTrainingSnapshot(admin, token, session);
    expect(snap.journey?.displayTitle).toBe("Owning the next step");
    expect(snap.journey?.elements.map((e) => e.kind)).toEqual(["why_it_matters", "observable_standard", "completion_check"]);
    for (const e of snap.journey!.elements) expect(Object.keys(e).sort()).toEqual(["content", "id", "kind"]); // no grounding/status leak
  });

  it("legacy Run with no module snapshot → journey null (fallback preserved)", async () => {
    const { admin, token, session } = await setupJoined();
    const snap = await getPublicTrainingSnapshot(admin, token, session);
    expect(snap.journey ?? null).toBeNull();
  });
});

/**
 * SLICE 3.2M-1 — the learner's own decision.
 *
 * A client-side required field is not a guard, so these drive `completeTraining` directly with a
 * published module snapshot that does — or does not — contain a grounded `action_decision`.
 */
describe("[3.2M-1] completion requires the learner's own decision", () => {
  const DECISION_EL = {
    id: "el_action_decision",
    kind: "action_decision",
    content: "I will state each open item at my next handover.",
    grounding: [{ sourceType: "host_statement", field: "problem" }],
    confirmationStatus: "grounded",
  };
  const journeyWith = (elements: unknown[]) => ({
    version: 1,
    displayTitle: "Handing over without gaps",
    displayTitleStatus: "grounded",
    elements,
  });

  async function publishedWithJourney(elements: unknown[]) {
    const ctx = await setupJoined();
    await ctx.admin.from("foundry_event_module").insert({
      event_id: ctx.eventId,
      source_draft_id: `d-${elements.length}-${Math.round(1)}`,
      module_version: 1,
      module_snapshot: { realityGroundedJourneyV1: journeyWith(elements) },
    });
    await completeVideo(ctx.admin, ctx.token, ctx.session);
    return ctx;
  }

  const progressRow = async (admin: Awaited<ReturnType<typeof setupJoined>>["admin"], eventId: string) => {
    const { data } = await admin.from("foundry_event_training_progress").select("*").eq("event_id", eventId);
    return (data ?? [])[0] as Record<string, unknown> | undefined;
  };

  it("REFUSES completion when the program asked for a decision and none was given", async () => {
    const { admin, token, session, eventId } = await publishedWithJourney([DECISION_EL]);
    expect(await completeTraining(admin, token, session, "My reflection.", null)).toEqual({
      ok: false,
      reason: "decision_required",
    });
    // Nothing was recorded — no half-complete row claiming a decision.
    const row = await progressRow(admin, eventId);
    expect(row?.completed_at ?? null).toBeNull();
    expect(row?.decision_response_text ?? null).toBeNull();
  });

  it("a blank decision is not a decision", async () => {
    const { admin, token, session } = await publishedWithJourney([DECISION_EL]);
    expect(await completeTraining(admin, token, session, "My reflection.", null, undefined, undefined, "   ")).toEqual({
      ok: false,
      reason: "decision_required",
    });
  });

  it("ACCEPTS completion with a decision, and stores it exactly — beside the reflection, never in it", async () => {
    const { admin, token, session, eventId } = await publishedWithJourney([DECISION_EL]);
    const decision = "I will say the two open items out loud before I leave the floor.";
    const done = await completeTraining(admin, token, session, "My private reflection.", null, undefined, undefined, decision);
    expect(done.ok).toBe(true);
    const row = await progressRow(admin, eventId);
    expect(row?.decision_response_text).toBe(decision);
    expect(row?.decision_submitted_at).toBeTruthy();
    expect(row?.response_text, "the private reflection is untouched").toBe("My private reflection.");
    expect(row?.completed_at).toBeTruthy();
  });

  it("retry and repeated completion keep ONE decision — the first one", async () => {
    const { admin, token, session, eventId } = await publishedWithJourney([DECISION_EL]);
    const first = "I will state the open items.";
    await completeTraining(admin, token, session, "reflection", null, undefined, undefined, first);
    // A retry after a dropped response, then a plain re-submit with different words.
    await completeTraining(admin, token, session, "reflection", null, undefined, undefined, first);
    await completeTraining(admin, token, session, "different", null, undefined, undefined, "I changed my mind entirely.");
    const { data } = await admin.from("foundry_event_training_progress").select("*").eq("event_id", eventId);
    expect((data ?? []).length, "no duplicate progress row").toBe(1);
    expect(((data ?? [])[0] as Record<string, unknown>).decision_response_text).toBe(first);
  });

  it("a training WITHOUT action_decision completes exactly as before, and stores no decision", async () => {
    const { admin, token, session, eventId } = await publishedWithJourney([
      { ...DECISION_EL, id: "el_why_it_matters", kind: "why_it_matters", content: "Handovers miss steps." },
    ]);
    const done = await completeTraining(admin, token, session, "My reflection.", null, undefined, undefined, "unsolicited");
    expect(done.ok).toBe(true);
    const row = await progressRow(admin, eventId);
    expect(row?.completed_at).toBeTruthy();
    expect(row?.decision_response_text ?? null, "an unasked decision must not be stored").toBeNull();
  });

  it("a legacy Run with no module snapshot is unaffected", async () => {
    const { admin, token, session } = await setupJoined();
    await completeVideo(admin, token, session);
    expect((await completeTraining(admin, token, session, "My reflection.", null)).ok).toBe(true);
  });

  it("an UNCONFIRMED action_decision asks for nothing — the learner never saw it", async () => {
    const { admin, token, session } = await publishedWithJourney([
      { ...DECISION_EL, confirmationStatus: "needs_confirmation" },
    ]);
    expect((await completeTraining(admin, token, session, "My reflection.", null)).ok).toBe(true);
  });
});

describe("close + privacy + roster projection", () => {
  it("blocks new completion after close but keeps completed results", async () => {
    const { admin, token, session, eventId } = await setupJoined();
    await completeVideo(admin, token, session);
    // Close the event directly (owner-close path is covered by the base service test).
    await admin.from("foundry_events").update({ status: "closed" }).eq("id", eventId);

    expect(await completeTraining(admin, token, session, "late", null)).toEqual({
      ok: false,
      reason: "event_closed",
    });
    const snap = await getPublicTrainingSnapshot(admin, token, session);
    expect(snap.stage).toBe("closed_incomplete");
  });

  it("manager roster shows training status + counts, never the response text", async () => {
    const { admin, token, session } = await setupJoined();
    await completeVideo(admin, token, session);
    await completeTraining(admin, token, session, "A private reflection.", null);

    const owner = await getOwnerTrainingSnapshot(admin, OWNER, (await getFirstEventId(admin)));
    expect(owner).not.toBeNull();
    if (owner) {
      expect(owner.joined_count).toBe(1);
      expect(owner.completed_count).toBe(1);
      expect(owner.participants[0].training_status).toBe("complete");
      // Privacy: no response text anywhere in the manager snapshot.
      const json = JSON.stringify(owner);
      expect(json).not.toContain("A private reflection.");
      expect(owner.participants[0]).not.toHaveProperty("response_text");
    }
  });
});

async function getFirstEventId(admin: SupabaseClient): Promise<string> {
  const { data } = await admin.from("foundry_events").select("id").maybeSingle();
  return (data as { id: string }).id;
}

/**
 * R4-R5B1 — ASSIGNMENT COMPLETION TRUTH (video room).
 *
 * Measured before this slice: an authenticated assigned learner received every durable consequence
 * of completion — `linked_user_id`, Core XP, the follow-up obligation, the apply window — while
 * `foundry_event_assignments.status` stayed `assigned`, because the claim ran only inside `claimXp`
 * and a signed-in learner never reaches it (completion awards XP inline, the stage is
 * `completed_awarded`, and the claim control renders only at `completed_claimable`).
 *
 * These assert the TRANSITION, not the invocation: the RPC is simulated faithfully from the shipped
 * SQL, so the assertions read the assignment row the way the learner's Required Learning card does.
 */
describe("R4-R5B1 · assignment completion truth — video", () => {
  const participantId = (tables: Record<string, Array<Record<string, unknown>>>) =>
    String(tables.foundry_event_participants[0]!.id);
  const claimCalls = (tables: Record<string, Array<Record<string, unknown>>>) =>
    (tables.__claim_calls as Array<Record<string, unknown>> | undefined) ?? [];

  async function reachResponse(admin: SupabaseClient, token: string, session: string) {
    await startVideo(admin, token, session);
    await completeVideo(admin, token, session);
  }

  it("T1 — an authenticated assigned completion drives the assignment to completed, server-side", async () => {
    const { admin, tables, eventId, token, session } = await setupJoined();
    seedAssignment(tables, eventId, AUTH);
    expect(readAssignment(tables, eventId, AUTH)!.status).toBe("assigned");

    await reachResponse(admin, token, session);
    const done = await completeTraining(admin, token, session, "I will pause before replying.", AUTH);

    expect(done.ok && done.snapshot.stage).toBe("completed_awarded");
    // THE INVARIANT: no second button, no revisit, no refresh, no React effect.
    const a = readAssignment(tables, eventId, AUTH)!;
    expect(a.status).toBe("completed");
    expect(a.participant_id).toBe(participantId(tables));
    expect(a.completed_at).not.toBeNull();
    // …and the match keys were the server-derived pair, never anything from a browser.
    expect(claimCalls(tables)).toHaveLength(1);
    expect(claimCalls(tables)[0]).toMatchObject({ p_event_id: eventId, p_auth_user_id: AUTH });
    // Existing behaviour untouched: XP awarded exactly once, progress linked.
    expect(awardSpy).toHaveBeenCalledTimes(1);
    expect(tables.foundry_event_training_progress[0]!.linked_user_id).toBe(AUTH);
    expect(tables.foundry_event_training_progress[0]!.completed_at).not.toBeNull();
  });

  it("T4 — an anonymous completion runs NO assignment claim and leaves the assignment alone", async () => {
    const { admin, tables, eventId, token, session } = await setupJoined();
    seedAssignment(tables, eventId, AUTH);

    await reachResponse(admin, token, session);
    const done = await completeTraining(admin, token, session, "Anonymous answer.", null);

    expect(done.ok && done.snapshot.stage).toBe("completed_claimable");
    expect(claimCalls(tables)).toHaveLength(0); // no trusted identity to match on
    expect(readAssignment(tables, eventId, AUTH)!.status).toBe("assigned");
    expect(awardSpy).not.toHaveBeenCalled();
    // The existing claim path still connects it later, unchanged.
    await claimXp(admin, token, session, AUTH);
    expect(readAssignment(tables, eventId, AUTH)!.status).toBe("completed");
  });

  it("T5 — a signed-in OPEN-LINK completion answers not_applicable and fabricates no assignment", async () => {
    const { admin, tables, eventId, token, session } = await setupJoined();
    // No assignment, no participation-mode row — an ordinary open-link room.
    await reachResponse(admin, token, session);
    const done = await completeTraining(admin, token, session, "Open-link answer.", AUTH);

    expect(done.ok && done.snapshot.stage).toBe("completed_awarded");
    expect(tables.foundry_event_assignments ?? []).toHaveLength(0); // nothing fabricated
    expect(claimCalls(tables)[0]).toMatchObject({ p_event_id: eventId, p_auth_user_id: AUTH });
    expect(awardSpy).toHaveBeenCalledTimes(1); // XP behaviour unchanged
  });

  it("T6 — a repeat completion neither re-awards XP nor re-transitions the assignment", async () => {
    const { admin, tables, eventId, token, session } = await setupJoined();
    seedAssignment(tables, eventId, AUTH);
    await reachResponse(admin, token, session);
    await completeTraining(admin, token, session, "First answer.", AUTH);
    const firstClaimedAt = readAssignment(tables, eventId, AUTH)!.claimed_at;

    const again = await completeTraining(admin, token, session, "Changed answer.", AUTH);

    expect(again.ok).toBe(true);
    expect(awardSpy).toHaveBeenCalledTimes(1); // no duplicate XP
    expect(claimCalls(tables)).toHaveLength(1); // idempotent early-return never re-runs it
    const a = readAssignment(tables, eventId, AUTH)!;
    expect(a.status).toBe("completed");
    expect(a.claimed_at).toBe(firstClaimedAt); // not re-stamped
    expect(tables.foundry_event_training_progress[0]!.response_text).toBe("First answer.");
  });

  it("T7 — a reconciliation ERROR cannot fail a truthful completion, and claims no transition", async () => {
    const { admin, tables, eventId, token, session } = await setupJoined();
    seedAssignment(tables, eventId, AUTH);
    tables.__claim_fault = [{ mode: "error" }];

    await reachResponse(admin, token, session);
    const done = await completeTraining(admin, token, session, "Answer despite the fault.", AUTH);

    expect(done.ok).toBe(true); // the completion the learner earned still stands
    expect(done.ok && done.snapshot.stage).toBe("completed_awarded");
    expect(awardSpy).toHaveBeenCalledTimes(1);
    expect(tables.foundry_event_training_progress[0]!.completed_at).not.toBeNull();
    // …and nothing anywhere claims a transition that did not happen.
    expect(readAssignment(tables, eventId, AUTH)!.status).toBe("assigned");
    expect(Object.keys(done.ok ? done.snapshot : {})).not.toContain("assignmentClaim");
  });

  it("T7b — a THROWN reconciliation failure is contained too (the completion still stands)", async () => {
    const { admin, tables, eventId, token, session } = await setupJoined();
    seedAssignment(tables, eventId, AUTH);
    tables.__claim_fault = [{ mode: "throw" }];

    await reachResponse(admin, token, session);
    const done = await completeTraining(admin, token, session, "Answer despite the throw.", AUTH);

    expect(done.ok).toBe(true);
    expect(tables.foundry_event_training_progress[0]!.completed_at).not.toBeNull();
    expect(readAssignment(tables, eventId, AUTH)!.status).toBe("assigned");
  });

  it("conflict — an assignment already claimed by ANOTHER participant is never overwritten", async () => {
    const { admin, tables, eventId, token, session } = await setupJoined();
    seedAssignment(tables, eventId, AUTH, {
      participant_id: "someone-elses-participant",
      status: "completed",
      claimed_at: "2026-01-01T00:00:00.000Z",
      completed_at: "2026-01-01T00:00:00.000Z",
    });

    await reachResponse(admin, token, session);
    const done = await completeTraining(admin, token, session, "Second device.", AUTH);

    expect(done.ok).toBe(true); // truthful progress completion is never broken by a conflict
    const a = readAssignment(tables, eventId, AUTH)!;
    expect(a.participant_id).toBe("someone-elses-participant"); // preserved, not stolen
    expect(a.claimed_at).toBe("2026-01-01T00:00:00.000Z");
  });
});
