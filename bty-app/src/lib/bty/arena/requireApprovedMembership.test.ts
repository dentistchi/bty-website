import { describe, it, expect } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireApprovedMembership } from "./requireApprovedMembership";

/** Minimal RLS-client stub: from().select().eq().maybeSingle() → the given result. */
function sbWith(result: { data: unknown; error: unknown }): SupabaseClient {
  return {
    from: () => ({
      select: () => ({
        eq: () => ({ maybeSingle: () => Promise.resolve(result) }),
      }),
    }),
  } as unknown as SupabaseClient;
}

describe("requireApprovedMembership", () => {
  it("approves when status is approved", async () => {
    const r = await requireApprovedMembership(sbWith({ data: { status: "approved" }, error: null }), "u1");
    expect(r).toEqual({ approved: true });
  });

  it("denies (no_request) when there is no row", async () => {
    const r = await requireApprovedMembership(sbWith({ data: null, error: null }), "u1");
    expect(r).toEqual({ approved: false, status: 403, error: "MEMBERSHIP_REQUIRED", reason: "no_request" });
  });

  it("denies (pending) when status is pending", async () => {
    const r = await requireApprovedMembership(sbWith({ data: { status: "pending" }, error: null }), "u1");
    expect(r).toMatchObject({ approved: false, status: 403, reason: "pending" });
  });

  it("denies (rejected) when status is rejected", async () => {
    const r = await requireApprovedMembership(sbWith({ data: { status: "rejected" }, error: null }), "u1");
    expect(r).toMatchObject({ approved: false, status: 403, reason: "rejected" });
  });

  it("fails closed (no_request) on query error", async () => {
    const r = await requireApprovedMembership(sbWith({ data: null, error: { message: "boom" } }), "u1");
    expect(r).toMatchObject({ approved: false, status: 403, reason: "no_request" });
  });
});
