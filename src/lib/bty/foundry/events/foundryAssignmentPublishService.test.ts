/** @vitest-environment node */
import { describe, it, expect, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  preflightAssignedAudience,
  publishAssignmentsForEvent,
  readCommittedParticipation,
  claimAssignmentForParticipant,
} from "./foundryAssignmentPublishService";

/**
 * Slice 3.1B-3C service. The RPCs own resolution + the atomic write; this layer proves the
 * result/reason mapping, the zero-recipient contract, and that the client never supplies a
 * recipient set.
 */

function rpcAdmin(impl: (name: string, params: Record<string, unknown>) => { data: unknown; error: { message: string } | null }): SupabaseClient {
  return { rpc: (name: string, params: Record<string, unknown>) => Promise.resolve(impl(name, params)) } as unknown as SupabaseClient;
}

const LEADERS = { audienceType: "leaders" as const, audienceDetail: null };

describe("preflightAssignedAudience", () => {
  it("returns the eligible count + org for a non-empty audience", async () => {
    const admin = rpcAdmin(() => ({
      data: [
        { membership_id: "m1", user_id: "u1", organization_id: "org-a" },
      ],
      error: null,
    }));
    const r = await preflightAssignedAudience(admin, "host-1", LEADERS);
    expect(r).toEqual({ ok: true, eligibleCount: 1, organizationId: "org-a" });
  });

  it("treats an EMPTY resolved set as zero_recipients (never a silent everyone)", async () => {
    const admin = rpcAdmin(() => ({ data: [], error: null }));
    const r = await preflightAssignedAudience(admin, "host-1", LEADERS);
    expect(r).toEqual({ ok: false, reason: "zero_recipients" });
  });

  it("maps unresolved actor org", async () => {
    const admin = rpcAdmin(() => ({ data: null, error: { message: "actor_organization_unresolved" } }));
    expect(await preflightAssignedAudience(admin, "host-1", LEADERS)).toEqual({
      ok: false,
      reason: "actor_organization_unresolved",
    });
  });

  it("maps unsupported audience + missing detail", async () => {
    const bad = rpcAdmin(() => ({ data: null, error: { message: "unsupported_audience" } }));
    expect((await preflightAssignedAudience(bad, "h", { audienceType: "everyone", audienceDetail: null })).ok).toBe(false);
    const detail = rpcAdmin(() => ({ data: null, error: { message: "audience_detail_required" } }));
    expect(await preflightAssignedAudience(detail, "h", { audienceType: "job_group", audienceDetail: null })).toEqual({
      ok: false,
      reason: "audience_detail_required",
    });
  });

  it("passes ONLY actor + audience type/detail to the RPC — never member ids or org", async () => {
    const seen: Record<string, unknown>[] = [];
    const admin = rpcAdmin((_n, p) => {
      seen.push(p);
      return { data: [{ membership_id: "m1", user_id: "u1", organization_id: "org-a" }], error: null };
    });
    await preflightAssignedAudience(admin, "host-1", { audienceType: "job_group", audienceDetail: "CLINICAL_PROVIDER" });
    expect(Object.keys(seen[0]).sort()).toEqual(["p_actor_user_id", "p_audience_detail", "p_audience_type"].sort());
    expect(seen[0].p_actor_user_id).toBe("host-1");
  });
});

describe("publishAssignmentsForEvent", () => {
  it("returns the assignment count on success", async () => {
    const admin = rpcAdmin(() => ({ data: [{ assignment_count: 1, organization_id: "org-a" }], error: null }));
    expect(await publishAssignmentsForEvent(admin, "evt-1", "host-1", LEADERS)).toEqual({
      ok: true,
      assignmentCount: 1,
    });
  });

  it("maps zero_recipients, not_a_host, and generic write failure", async () => {
    for (const [msg, reason] of [
      ["zero_recipients", "zero_recipients"],
      ["not_a_host", "not_a_host"],
      ["some sql explosion", "assignment_write_failed"],
    ] as const) {
      const admin = rpcAdmin(() => ({ data: null, error: { message: msg } }));
      expect(await publishAssignmentsForEvent(admin, "e", "h", LEADERS)).toEqual({ ok: false, reason });
    }
  });

  it("addresses the event + actor + audience only — no recipient list is sent", async () => {
    const seen: Record<string, unknown>[] = [];
    const admin = rpcAdmin((_n, p) => {
      seen.push(p);
      return { data: [{ assignment_count: 1 }], error: null };
    });
    await publishAssignmentsForEvent(admin, "evt-1", "host-1", LEADERS);
    expect(Object.keys(seen[0]).sort()).toEqual(
      ["p_event_id", "p_actor_user_id", "p_audience_type", "p_audience_detail"].sort(),
    );
  });
});

describe("readCommittedParticipation — authoritative committed state", () => {
  function admin(mode: string | null, snap: { audience_type: string; resolved_count: number } | null): SupabaseClient {
    return {
      from(table: string) {
        const q: Record<string, unknown> = {
          select: () => q,
          eq: () => q,
          maybeSingle: () =>
            Promise.resolve({
              data: table === "foundry_event_participation_mode" ? (mode ? { mode } : null) : snap,
              error: null,
            }),
        };
        return q;
      },
    } as unknown as SupabaseClient;
  }

  it("reports open_link + 0 when no mode row exists (default / compensated publish)", async () => {
    const r = await readCommittedParticipation(admin(null, null), "evt");
    expect(r).toEqual({ mode: "open_link", assignmentCount: 0, audienceType: null });
  });

  it("reports the committed assignment count from the snapshot for assigned_overlay", async () => {
    const r = await readCommittedParticipation(admin("assigned_overlay", { audience_type: "leaders", resolved_count: 1 }), "evt");
    expect(r).toEqual({ mode: "assigned_overlay", assignmentCount: 1, audienceType: "leaders" });
  });

  it("never trusts a stray open_link-with-snapshot combination — mode row governs", async () => {
    // a mode row of open_link means open_link regardless of any snapshot
    const r = await readCommittedParticipation(admin("open_link", { audience_type: "leaders", resolved_count: 9 }), "evt");
    expect(r.mode).toBe("open_link");
    expect(r.assignmentCount).toBe(0);
  });
});

describe("claimAssignmentForParticipant — 3.1B-3D result mapping (assignment claim is separate from XP)", () => {
  function rpc(result: string | null, error?: string): SupabaseClient {
    return {
      rpc: (_n: string, _p: Record<string, unknown>) =>
        Promise.resolve(error ? { data: null, error: { message: error } } : { data: [{ result, assignment_id: "a1" }], error: null }),
    } as unknown as SupabaseClient;
  }

  it("maps a fresh claim", async () => {
    expect(await claimAssignmentForParticipant(rpc("claimed"), "e", "p", "u")).toBe("claimed");
  });
  it("maps idempotent re-claim by the same participant", async () => {
    expect(await claimAssignmentForParticipant(rpc("already_claimed"), "e", "p", "u")).toBe("already_claimed");
  });
  it("maps a conflict (different participant already claimed) — never a transfer", async () => {
    expect(await claimAssignmentForParticipant(rpc("claim_conflict"), "e", "p", "u")).toBe("claim_conflict");
  });
  it("maps a wrong-account / open-link event to the neutral no_matching_assignment", async () => {
    expect(await claimAssignmentForParticipant(rpc("no_matching_assignment"), "e", "p", "u")).toBe("no_matching_assignment");
  });
  it("an RPC error degrades to neutral (never fails the XP claim)", async () => {
    expect(await claimAssignmentForParticipant(rpc(null, "boom"), "e", "p", "u")).toBe("no_matching_assignment");
  });
  it("passes ONLY event/participant/auth-user — no client-forgeable targeting", async () => {
    const seen: Record<string, unknown>[] = [];
    const admin = {
      rpc: (_n: string, p: Record<string, unknown>) => {
        seen.push(p);
        return Promise.resolve({ data: [{ result: "claimed" }], error: null });
      },
    } as unknown as SupabaseClient;
    await claimAssignmentForParticipant(admin, "evt", "part", "user");
    expect(Object.keys(seen[0]).sort()).toEqual(["p_event_id", "p_participant_id", "p_auth_user_id"].sort());
    expect(seen[0]).toEqual({ p_event_id: "evt", p_participant_id: "part", p_auth_user_id: "user" });
  });
});
