/**
 * LATE ACCOUNT BINDING. Slice Teams Chat-Native Text Training + Quiz V1.
 *
 * An employee may complete a training in Teams before they have ever signed into BTY. That
 * completion is real; only the XP has nobody to belong to yet. When the same verified Microsoft
 * tuple later resolves to a canonical user, this settles the account side — with no claim code and
 * nothing the learner has to do.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";

const H = vi.hoisted(() => ({
  finalize: vi.fn<(a: unknown, i: { authUserId: string; progressId: string; completedAt: string }) => Promise<Record<string, unknown>>>(
    async () => ({ applyWindowResult: "skipped" }),
  ),
}));
vi.mock("@/lib/bty/foundry/events/foundryTrainingService", async (orig) => {
  const actual = await orig<typeof import("@/lib/bty/foundry/events/foundryTrainingService")>();
  return { ...actual, finalizeCanonicalTrainingCompletion: H.finalize };
});

import { bindTeamsTrainingParticipants } from "./bindTeamsParticipants.server";

const TENANT = "10110d5c-bd30-467e-9912-e44e67777647";
const OID = "aaaaaaaa-0000-4000-8000-000000000001";

type Row = Record<string, unknown>;

function makeAdmin(participants: Row[], progress: Row[] = []) {
  const tables: Record<string, Row[]> = {
    foundry_event_participants: participants,
    foundry_event_training_progress: progress,
    foundry_events: [{ id: "ev-1", owner_user_id: "owner-1", title: "T", status: "open", content_type: "written_guidance", join_version: 1, created_at: "t", closed_at: null }],
  };
  function from(table: string) {
    const rows = (tables[table] ??= []);
    const st = { op: "select" as string, f: [] as { c: string; v: unknown }[], nulls: [] as string[], patch: {} as Row };
    const match = () => rows.filter((r) => st.f.every((x) => r[x.c] === x.v) && st.nulls.every((c) => (r[c] ?? null) === null));
    const q: Record<string, unknown> = {
      select: () => q,
      eq: (c: string, v: unknown) => { st.f.push({ c, v }); return q; },
      is: (c: string, v: unknown) => { if (v === null) st.nulls.push(c); return q; },
      update: (p: Row) => { st.op = "update"; st.patch = p; return q; },
      returns: () => q,
      maybeSingle: () => Promise.resolve({ data: match()[0] ?? null, error: null }),
      then: (onF: (v: { data: unknown; error: unknown }) => unknown) => {
        const hits = match();
        if (st.op === "update") hits.forEach((r) => Object.assign(r, st.patch));
        return Promise.resolve({ data: hits.map((r) => ({ ...r })), error: null }).then(onF);
      },
    };
    return q;
  }
  return { admin: { from } as unknown as SupabaseClient, tables };
}

const unbound = (id: string) => ({ id, event_id: "ev-1", display_name: "Ari", user_id: null, microsoft_tenant_id: TENANT, microsoft_aad_object_id: OID });

beforeEach(() => vi.clearAllMocks());

describe("binding", () => {
  it("binds this person's unbound Teams participants", async () => {
    const { admin, tables } = makeAdmin([unbound("pt-1")]);
    expect(await bindTeamsTrainingParticipants(admin, "user-A", TENANT, OID)).toBe(1);
    expect(tables.foundry_event_participants[0]!.user_id).toBe("user-A");
  });

  it("★ NEVER re-points a participant already bound to another user", async () => {
    const taken = { ...unbound("pt-1"), user_id: "user-OTHER" };
    const { admin, tables } = makeAdmin([taken]);
    expect(await bindTeamsTrainingParticipants(admin, "user-A", TENANT, OID)).toBe(0);
    expect(tables.foundry_event_participants[0]!.user_id).toBe("user-OTHER");
    expect(H.finalize).not.toHaveBeenCalled();
  });

  it("★ never touches ANOTHER person's rows", async () => {
    const other = { ...unbound("pt-2"), microsoft_aad_object_id: "bbbbbbbb-0000-4000-8000-000000000002" };
    const { admin, tables } = makeAdmin([other]);
    expect(await bindTeamsTrainingParticipants(admin, "user-A", TENANT, OID)).toBe(0);
    expect(tables.foundry_event_participants[0]!.user_id ?? null).toBeNull();
  });

  it("creates nothing when there is nothing to bind", async () => {
    const { admin, tables } = makeAdmin([]);
    expect(await bindTeamsTrainingParticipants(admin, "user-A", TENANT, OID)).toBe(0);
    expect(tables.foundry_event_participants).toHaveLength(0);
  });

  it("refuses an incomplete identity rather than binding broadly", async () => {
    const { admin, tables } = makeAdmin([unbound("pt-1")]);
    expect(await bindTeamsTrainingParticipants(admin, "", TENANT, OID)).toBe(0);
    expect(await bindTeamsTrainingParticipants(admin, "user-A", "", OID)).toBe(0);
    expect(await bindTeamsTrainingParticipants(admin, "user-A", TENANT, "")).toBe(0);
    expect(tables.foundry_event_participants[0]!.user_id ?? null).toBeNull();
  });
});

describe("settling the account side of a completion that already happened", () => {
  it("★ re-runs the canonical finalizer with the now-known user", async () => {
    const { admin } = makeAdmin(
      [unbound("pt-1")],
      [{ id: "pr-1", event_id: "ev-1", participant_id: "pt-1", completed_at: "2026-09-21T00:00:00Z" }],
    );
    await bindTeamsTrainingParticipants(admin, "user-A", TENANT, OID);
    expect(H.finalize).toHaveBeenCalledTimes(1);
    const arg = H.finalize.mock.calls[0]![1];
    expect(arg.authUserId).toBe("user-A");
    expect(arg.progressId).toBe("pr-1");
    // The completion's OWN time, never "now".
    expect(arg.completedAt).toBe("2026-09-21T00:00:00Z");
  });

  it("a participant with no completion is bound but nothing is settled", async () => {
    const { admin } = makeAdmin([unbound("pt-1")], [{ id: "pr-1", event_id: "ev-1", participant_id: "pt-1", completed_at: null }]);
    expect(await bindTeamsTrainingParticipants(admin, "user-A", TENANT, OID)).toBe(1);
    expect(H.finalize).not.toHaveBeenCalled();
  });

  it("★ a settlement that throws never fails the sign-in", async () => {
    H.finalize.mockRejectedValue(new Error("xp path down"));
    const { admin, tables } = makeAdmin(
      [unbound("pt-1")],
      [{ id: "pr-1", event_id: "ev-1", participant_id: "pt-1", completed_at: "2026-09-21T00:00:00Z" }],
    );
    await expect(bindTeamsTrainingParticipants(admin, "user-A", TENANT, OID)).resolves.toBe(1);
    // The binding still stands, which is the durable half.
    expect(tables.foundry_event_participants[0]!.user_id).toBe("user-A");
  });
});
