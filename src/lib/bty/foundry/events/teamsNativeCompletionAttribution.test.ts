/**
 * NO GOOGLE LOGIN AT COMPLETION — the hard acceptance condition.
 * Slice Teams-Native Delivery V1.
 *
 * A learner who entered through a Teams-native invitation already has a canonical BTY account, so
 * finishing must credit that account DIRECTLY. This file proves the mechanism rather than the
 * screen: the canonical finalizer awards Core XP through the ordinary ledger path and issues NO
 * deferred claim, which is what removes the "Save my XP" / sign-in CTA from the terminal.
 *
 * The anonymous web path is asserted in the same file, unchanged, because "unchanged" is the other
 * half of the claim.
 */
import { describe, it, expect, beforeAll, beforeEach, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";

vi.mock("@/lib/bty/arena/applyCoreXp", () => ({
  applyDirectCoreXp: vi.fn(async () => ({ newCoreTotal: 10 })),
}));
vi.mock("./foundryFollowupService", () => ({ materializeFollowupObligation: vi.fn(async () => {}) }));
vi.mock("./foundryApplyWindowService", () => ({
  materializeApplyWindow: vi.fn(async () => "skipped"),
  applyNarration: () => ({}),
}));
vi.mock("./foundryAssignmentPublishService", () => ({
  claimAssignmentForParticipant: vi.fn(async () => "not_applicable"),
}));

import { finalizeCanonicalTrainingCompletion } from "./foundryTrainingService";

beforeAll(() => {
  process.env.FOUNDRY_ROOM_QR_SECRET = "test-teams-native-completion-secret-0123456789";
});

type Row = Record<string, unknown>;

function makeFakeAdmin() {
  const tables: Record<string, Row[]> = {
    foundry_event_training_progress: [
      { id: "pr-1", event_id: "ev-1", participant_id: "pt-1", completed_at: "2026-09-21T00:00:00Z", xp_awarded_at: null, linked_user_id: null, claim_secret_hash: null },
    ],
    core_xp_ledger: [],
  };
  function from(table: string) {
    const rows = (tables[table] ??= []);
    const st = { op: "select" as string, filters: [] as Array<{ c: string; v: unknown }>, patch: {} as Row };
    const matches = () =>
      rows.filter((r) => st.filters.every((f) => (f.v === null ? (r[f.c] ?? null) === null : r[f.c] === f.v)));
    const q: Record<string, unknown> = {
      select: () => q,
      update: (p: Row) => { st.op = "update"; st.patch = p; return q; },
      insert: (r: Row) => { rows.push({ id: `${table}-${rows.length + 1}`, ...r }); return q; },
      eq: (c: string, v: unknown) => { st.filters.push({ c, v }); return q; },
      is: (c: string, v: unknown) => { if (v === null) st.filters.push({ c, v: null }); return q; },
      not: () => q,
      maybeSingle: () => {
        if (st.op === "update") {
          const hits = matches();
          hits.forEach((r) => Object.assign(r, st.patch));
          return Promise.resolve({ data: hits[0] ? { ...hits[0] } : null, error: null });
        }
        return Promise.resolve({ data: matches()[0] ?? null, error: null });
      },
      single: () => Promise.resolve({ data: matches()[0] ?? null, error: null }),
      then: (onF: (v: { data: unknown; error: unknown }) => unknown) => {
        // An awaited builder resolves to the ROW SET — `issueCompletionClaim` reads `data.length`.
        const hits = matches();
        if (st.op === "update") hits.forEach((r) => Object.assign(r, st.patch));
        return Promise.resolve({ data: hits.map((r) => ({ ...r })), error: null }).then(onF);
      },
    };
    return q;
  }
  const rpc = (name: string, p: Record<string, unknown>) => {
    if (name !== "bty_foundry_award_daily_capped") return Promise.resolve({ data: null, error: null });
    tables.core_xp_ledger.push({ user_id: p.p_user_id, source_id: p.p_source_id, source_type: "foundry_training_completion" });
    return Promise.resolve({ data: "awarded", error: null });
  };
  return { admin: { from, rpc } as unknown as SupabaseClient, tables };
}

const EVENT = { id: "ev-1", owner_user_id: "owner-1", title: "T", status: "open", join_version: 1 } as never;

function participant(userId: string | null) {
  return { id: "pt-1", event_id: "ev-1", display_name: "Ari Kim", status: "joined", user_id: userId } as never;
}

async function finalize(admin: SupabaseClient, participantUserId: string | null, authUserId: string | null) {
  return finalizeCanonicalTrainingCompletion(admin, {
    event: EVENT,
    participant: participant(participantUserId),
    progressId: "pr-1",
    completedAt: "2026-09-21T00:00:00Z",
    authUserId,
    deviceTz: "Asia/Seoul",
  });
}

beforeEach(() => vi.clearAllMocks());

describe("TEAMS-NATIVE: the account is credited directly, with nothing left to claim", () => {
  it("awards Core XP to the canonical account and issues NO claim code", async () => {
    const { admin, tables } = makeFakeAdmin();
    const result = await finalize(admin, "user-A", "user-A");

    expect(result.xpOverride).toBe("awarded");
    expect(tables.core_xp_ledger).toHaveLength(1);
    expect(tables.core_xp_ledger[0]).toMatchObject({ user_id: "user-A", source_id: "pr-1" });

    // THE ACCEPTANCE CONDITION: no deferred claim means no "Save my XP" / sign-in CTA.
    expect(result.claimCode).toBeUndefined();
    expect(result.claimExpiresAt).toBeUndefined();
    expect(tables.foundry_event_training_progress[0]!.claim_secret_hash ?? null).toBeNull();
  });

  it("stamps the identity link and the award on the progress row", async () => {
    const { admin, tables } = makeFakeAdmin();
    await finalize(admin, "user-A", "user-A");
    const progress = tables.foundry_event_training_progress[0]!;
    expect(progress.linked_user_id).toBe("user-A");
    expect(progress.xp_awarded_at).toBeTruthy();
  });
});

describe("the anonymous public path is unchanged", () => {
  it("an anonymous participant with no session still gets a deferred claim, not an award", async () => {
    const { admin, tables } = makeFakeAdmin();
    const result = await finalize(admin, null, null);
    expect(result.xpOverride).toBeUndefined();
    expect(tables.core_xp_ledger).toHaveLength(0);
    expect(typeof result.claimCode).toBe("string");
  });
});

describe("a Teams user cannot inherit another account's participant", () => {
  it("a participant bound to A is NOT credited to B — and B gets no claim over it either", async () => {
    const { admin, tables } = makeFakeAdmin();
    const result = await finalize(admin, "user-A", "user-B");
    expect(tables.core_xp_ledger).toHaveLength(0);
    expect(tables.foundry_event_training_progress[0]!.linked_user_id ?? null).toBeNull();
    expect(result.xpOverride).toBeUndefined();
  });
});
