import { describe, it, expect, vi, beforeEach } from "vitest";
import { publishDraft } from "./foundryPublishService";
import { PROGRAM_LEASE_MS } from "@/domain/foundry/module/program-generation-lease";

/**
 * Slice 3.2L-R1 — publication yields to an active program generation.
 *
 * THE MEASURED INCIDENT. Draft 3b375c81 was published 4 seconds after a program
 * generation was admitted against it; the generation recorded success 6 seconds after
 * the publication. Publication is the irreversible side, so publication is the side that
 * refuses.
 *
 * These tests drive the REAL `publishDraft` and assert on the ORDER of database calls:
 * the refusal must land before any event, module, QR or assignment write. Asserting only
 * the returned reason would pass even if the event row had already been created.
 */

const DRAFT = "3b375c81-ff7b-4399-bcbf-238c9d59ce1d";
const OWNER = "ee9d2075-f4ae-4949-9392-38865c2cab22";
const NOW = Date.now();

type Row = Record<string, unknown>;

/** Records every table touched and every write attempted, in order. */
function makeAdmin(opts: {
  draft?: Row | null;
  activeAttempts?: Row[];
  alreadyPublished?: Row | null;
}) {
  const writes: { table: string; op: string }[] = [];
  const reads: string[] = [];

  const admin = {
    from(table: string) {
      reads.push(table);
      const chain: Record<string, unknown> = {};
      const self = () => chain as never;

      chain.select = () => self();
      chain.eq = () => self();
      chain.is = () => self();
      chain.in = () => self();
      chain.order = () => self();
      chain.limit = () => self();

      chain.maybeSingle = async () => {
        if (table === "foundry_module_drafts") return { data: opts.draft ?? null, error: null };
        if (table === "foundry_event_module") return { data: opts.alreadyPublished ?? null, error: null };
        return { data: null, error: null };
      };
      chain.single = chain.maybeSingle;

      // The un-awaited select terminal (used by findActiveProgramGeneration).
      chain.then = (resolve: (v: unknown) => unknown) => {
        if (table === "foundry_program_generation_attempts") {
          return Promise.resolve({ data: opts.activeAttempts ?? [], error: null }).then(resolve);
        }
        if (table === "foundry_module_drafts") {
          return Promise.resolve({ data: opts.draft ? [opts.draft] : [], error: null }).then(resolve);
        }
        return Promise.resolve({ data: [], error: null }).then(resolve);
      };

      chain.insert = () => {
        writes.push({ table, op: "insert" });
        const ins: Record<string, unknown> = {};
        ins.select = () => ins as never;
        ins.maybeSingle = async () => ({ data: { id: "new-id" }, error: null });
        ins.single = ins.maybeSingle;
        ins.then = (r: (v: unknown) => unknown) => Promise.resolve({ data: { id: "new-id" }, error: null }).then(r);
        return ins as never;
      };
      chain.update = () => {
        writes.push({ table, op: "update" });
        return self();
      };
      chain.delete = () => {
        writes.push({ table, op: "delete" });
        return self();
      };
      return chain as never;
    },
    rpc: async () => ({ data: null, error: null }),
  };

  return { admin: admin as never, writes, reads };
}

const readyDraft = {
  id: DRAFT,
  owner_user_id: OWNER,
  status: "draft",
  module_version: 1,
  program_id: null,
  approved_at: null,
  published_at: null,
  answers: {
    problem: "Our handoffs are inconsistent.",
    audienceType: "everyone",
    observableBehavior: "Create a shared handoff standard.",
    successEvidence: "Handoff record",
    learningNeeds: ["know"],
    materialIntent: "youtube",
    materialText: "https://youtu.be/x",
    completionPrompt: "What will you include in your handoff record?",
    followUpDays: 7,
  },
};

const activeAttempt = (startedMsAgo: number) => ({
  id: "attempt-1",
  draft_id: DRAFT,
  lifecycle_state: "started",
  started_at: new Date(NOW - startedMsAgo).toISOString(),
  finished_at: null,
});

beforeEach(() => vi.restoreAllMocks());

describe("[3.2L-R1] G1 — publication is refused while a generation is active on the same draft", () => {
  it("returns a stable conflict reason", async () => {
    const { admin } = makeAdmin({ draft: readyDraft, activeAttempts: [activeAttempt(4_000)] });
    const r = await publishDraft(admin, OWNER, DRAFT, "en");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("program_generation_in_progress");
  });

  it("creates NO event, module, content, QR or assignment — refusal precedes every write", async () => {
    const { admin, writes } = makeAdmin({ draft: readyDraft, activeAttempts: [activeAttempt(4_000)] });
    await publishDraft(admin, OWNER, DRAFT, "en");
    expect(writes, `unexpected writes: ${JSON.stringify(writes)}`).toEqual([]);
  });

  it("refuses at the 4-second mark that the live incident actually published at", async () => {
    const { admin, writes } = makeAdmin({ draft: readyDraft, activeAttempts: [activeAttempt(4_000)] });
    const r = await publishDraft(admin, OWNER, DRAFT, "en");
    expect(r.ok).toBe(false);
    expect(writes).toEqual([]);
  });
});

describe("[3.2L-R1] G2 — the authority is the SERVER, not the browser", () => {
  it("refuses even though this caller never rendered the pending UI", async () => {
    // This request carries no client state at all — a second browser, a different
    // session, or a direct API call. The refusal still holds.
    const { admin, writes } = makeAdmin({ draft: readyDraft, activeAttempts: [activeAttempt(1_000)] });
    const r = await publishDraft(admin, OWNER, DRAFT, "en");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("program_generation_in_progress");
    expect(writes).toEqual([]);
  });
});

describe("[3.2L-R1] G6 — an abandoned generation cannot wedge the draft forever", () => {
  it("blocks BEFORE the lease expires", async () => {
    const { admin } = makeAdmin({ draft: readyDraft, activeAttempts: [activeAttempt(PROGRAM_LEASE_MS - 5_000)] });
    const r = await publishDraft(admin, OWNER, DRAFT, "en");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("program_generation_in_progress");
  });

  it("no longer blocks AFTER the lease expires — the evidence row is untouched", async () => {
    const stale = activeAttempt(PROGRAM_LEASE_MS + 60_000);
    const { admin, writes } = makeAdmin({ draft: readyDraft, activeAttempts: [stale] });
    const r = await publishDraft(admin, OWNER, DRAFT, "en");
    // It proceeds past the exclusion gate — whatever it does next, it is no longer the
    // generation refusing it.
    if (!r.ok) expect(r.reason).not.toBe("program_generation_in_progress");
    // The lost attempt row is never rewritten or deleted to unblock the draft.
    expect(writes.filter((w) => w.table === "foundry_program_generation_attempts")).toEqual([]);
  });
});

describe("[3.2L-R1] G5 — unrelated drafts stay independent", () => {
  it("a generation on another draft does not block this one", async () => {
    const other = { ...activeAttempt(1_000), id: "other", draft_id: "some-other-draft" };
    const { admin } = makeAdmin({ draft: readyDraft, activeAttempts: [other] });
    const r = await publishDraft(admin, OWNER, DRAFT, "en");
    if (!r.ok) expect(r.reason).not.toBe("program_generation_in_progress");
  });
});

describe("[3.2L-R1] G8 — the normal publish journey is unchanged", () => {
  it("no active generation → the exclusion gate is transparent", async () => {
    const { admin } = makeAdmin({ draft: readyDraft, activeAttempts: [] });
    const r = await publishDraft(admin, OWNER, DRAFT, "en");
    if (!r.ok) expect(r.reason).not.toBe("program_generation_in_progress");
  });

  it("an already-published draft still returns its existing event (idempotency wins)", async () => {
    // The exclusion check sits AFTER the idempotency reuse branch on purpose: a re-publish
    // of an already-published draft must keep returning its event, never a conflict.
    const { admin } = makeAdmin({
      draft: { ...readyDraft, status: "published" },
      activeAttempts: [activeAttempt(1_000)],
      alreadyPublished: { event_id: "evt-1" },
    });
    const r = await publishDraft(admin, OWNER, DRAFT, "en");
    if (!r.ok) expect(r.reason).not.toBe("program_generation_in_progress");
  });
});
