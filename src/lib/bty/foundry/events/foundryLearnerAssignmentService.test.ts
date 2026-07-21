/** @vitest-environment node */
import { describe, it, expect } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";

// A local/test secret so mintJoinToken (HMAC) can sign — no prod env is assumed.
process.env.FOUNDRY_ROOM_QR_SECRET = process.env.FOUNDRY_ROOM_QR_SECRET ?? "test-foundry-room-secret";

import { listMyAssignments } from "./foundryLearnerAssignmentService";
import { verifyFoundryRoomToken } from "./foundry-room-token";

function rpcAdmin(
  impl: (name: string, params: Record<string, unknown>) => { data: unknown; error: { message: string } | null },
): SupabaseClient {
  return { rpc: (name: string, params: Record<string, unknown>) => Promise.resolve(impl(name, params)) } as unknown as SupabaseClient;
}

const ROW = {
  assignment_id: "a1",
  event_id: "e5",
  status: "completed",
  title: "Onboarding Care",
  assigned_at: "2026-07-01T00:00:00Z",
  completed_at: "2026-07-10T00:00:00Z",
  join_version: 3,
  participation_mode: "assigned_overlay",
};

describe("listMyAssignments — learner read mapping (3.1B-3E)", () => {
  it("maps a row and mints a VALID Room token encoding the event + current join_version", async () => {
    const admin = rpcAdmin(() => ({ data: [ROW], error: null }));
    const out = await listMyAssignments(admin, "user-hanbit");
    expect(out).toHaveLength(1);
    const a = out[0];
    expect(a.assignmentId).toBe("a1");
    expect(a.eventId).toBe("e5");
    expect(a.status).toBe("completed");
    expect(a.title).toBe("Onboarding Care");
    expect(a.completedAt).toBe("2026-07-10T00:00:00Z");
    expect(a.participationMode).toBe("assigned_overlay");
    // The minted token round-trips to the same event + version (opening loads THIS room).
    const v = verifyFoundryRoomToken(a.joinToken);
    expect(v.ok).toBe(true);
    if (v.ok) {
      expect(v.payload.eventId).toBe("e5");
      expect(v.payload.joinVersion).toBe(3);
    }
  });

  it("passes ONLY the server-derived auth user id — no client-forgeable targeting", async () => {
    const seen: Record<string, unknown>[] = [];
    const admin = rpcAdmin((_n, p) => {
      seen.push(p);
      return { data: [], error: null };
    });
    await listMyAssignments(admin, "user-hanbit");
    expect(Object.keys(seen[0])).toEqual(["p_auth_user_id"]);
    expect(seen[0].p_auth_user_id).toBe("user-hanbit");
  });

  it("defensively drops any non assigned|completed row the RPC might return", async () => {
    const admin = rpcAdmin(() => ({
      data: [ROW, { ...ROW, assignment_id: "a2", status: "revoked" }],
      error: null,
    }));
    const out = await listMyAssignments(admin, "u");
    expect(out.map((a) => a.assignmentId)).toEqual(["a1"]);
  });

  it("fail-soft: an RPC error yields an EMPTY list (never an error surface)", async () => {
    const admin = rpcAdmin(() => ({ data: null, error: { message: "boom" } }));
    expect(await listMyAssignments(admin, "u")).toEqual([]);
  });

  it("returns [] for a learner with no assignments (empty required + completed)", async () => {
    const admin = rpcAdmin(() => ({ data: [], error: null }));
    expect(await listMyAssignments(admin, "u")).toEqual([]);
  });
});
