/** @vitest-environment node */
import { describe, it, expect } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  curateMembershipResponsibility,
  listMembershipResponsibilities,
  listActiveResponsibilityKeys,
} from "./organizationResponsibilityService";

/**
 * Slice 3.1B-1 service. Proves server-authoritative curation: cross-organization injection
 * is rejected, the actor is never taken from the caller's payload, duplicates and invalid
 * keys are rejected, unknown dates stay NULL, and removal is honest.
 */

const ORG_A = { id: "org-a", organization_key: "BTY_LEGACY", display_name: "Legacy", enterprise_id: "ent-1", status: "active" };

function makeAdmin(opts: {
  orgs?: Array<Record<string, unknown>>;
  anchor?: { id: string; organization_id: string } | null;
  rows?: Array<{ id: string; membership_id?: string; responsibility_key: string; started_on: string | null }>;
  rpcResult?: { data: unknown; error: { message: string } | null };
  rpcSpy?: (name: string, params: Record<string, unknown>) => void;
}): SupabaseClient {
  const orgs = opts.orgs ?? [ORG_A];
  const anchor = opts.anchor === undefined ? { id: "m1", organization_id: "org-a" } : opts.anchor;
  const rows = opts.rows ?? [];
  return {
    from(table: string) {
      if (table === "bty_organizations") {
        const q: Record<string, unknown> = {
          select: () => q,
          eq: () => q,
          order: () => Promise.resolve({ data: orgs, error: null }),
        };
        return q;
      }
      if (table === "bty_org_memberships") {
        const q: Record<string, unknown> = {
          select: () => q,
          eq: () => q,
          maybeSingle: () => Promise.resolve({ data: anchor, error: null }),
        };
        return q;
      }
      if (table === "bty_org_membership_responsibilities") {
        const q: Record<string, unknown> = {
          select: () => q,
          eq: () => q,
          in: () => q,
          order: () => Promise.resolve({ data: rows, error: null }),
        };
        return q;
      }
      throw new Error(`unexpected table ${table}`);
    },
    rpc: (name: string, params: Record<string, unknown>) => {
      opts.rpcSpy?.(name, params);
      return Promise.resolve(
        opts.rpcResult ?? {
          data: [
            {
              responsibility_key: params.p_responsibility_key,
              action: params.p_action,
              prev_started_on: null,
              prev_status: null,
              new_started_on: params.p_started_on,
              new_status: "active",
            },
          ],
          error: null,
        },
      );
    },
  } as unknown as SupabaseClient;
}

const base = {
  membershipId: "m1",
  responsibilityKey: "PARTNER" as string | null,
  action: "assign",
  startedOn: "2020-01-01" as string | null,
  changedBy: "admin-1",
  todayISO: "2026-07-20",
};

describe("curateMembershipResponsibility — authority order", () => {
  it("(1) adds one responsibility", async () => {
    const res = await curateMembershipResponsibility(makeAdmin({}), base);
    expect(res).toMatchObject({ ok: true, responsibilityKey: "PARTNER", action: "assign" });
  });

  it("(2) adds multiple distinct responsibilities to one membership", async () => {
    const calls: Array<Record<string, unknown>> = [];
    const admin = makeAdmin({ rpcSpy: (_n, p) => calls.push(p) });
    for (const key of ["PARTNER", "CLINICAL_DIRECTOR", "PEOPLE_MANAGER"]) {
      const r = await curateMembershipResponsibility(admin, { ...base, responsibilityKey: key });
      expect(r.ok).toBe(true);
    }
    expect(calls.map((c) => c.p_responsibility_key)).toEqual([
      "PARTNER",
      "CLINICAL_DIRECTOR",
      "PEOPLE_MANAGER",
    ]);
    // all against the SAME membership
    expect(new Set(calls.map((c) => c.p_membership_id))).toEqual(new Set(["m1"]));
  });

  it("(4) keeps an unknown date NULL — never back-filled", async () => {
    const calls: Array<Record<string, unknown>> = [];
    await curateMembershipResponsibility(makeAdmin({ rpcSpy: (_n, p) => calls.push(p) }), {
      ...base,
      startedOn: null,
    });
    expect(calls[0].p_started_on).toBeNull();
  });

  it("(5) revises a responsibility date", async () => {
    const calls: Array<Record<string, unknown>> = [];
    const res = await curateMembershipResponsibility(makeAdmin({ rpcSpy: (_n, p) => calls.push(p) }), {
      ...base,
      action: "revise_date",
      startedOn: "2021-06-01",
    });
    expect(res.ok).toBe(true);
    expect(calls[0].p_action).toBe("revise_date");
    expect(calls[0].p_started_on).toBe("2021-06-01");
  });

  it("(6) removal sends no date and is a status change, not a delete", async () => {
    const calls: Array<Record<string, unknown>> = [];
    await curateMembershipResponsibility(makeAdmin({ rpcSpy: (_n, p) => calls.push(p) }), {
      ...base,
      action: "remove",
      startedOn: "2020-01-01", // even if supplied, removal carries no date
    });
    expect(calls[0].p_action).toBe("remove");
    expect(calls[0].p_started_on).toBeNull();
  });

  it("(7) rejects a duplicate active assignment", async () => {
    const admin = makeAdmin({
      rpcResult: { data: null, error: { message: 'raise exception "responsibility_already_active"' } },
    });
    const res = await curateMembershipResponsibility(admin, base);
    expect(res).toEqual({ ok: false, reason: "responsibility_already_active" });
  });

  it("(8) rejects an invalid key before any DB call", async () => {
    const calls: Array<Record<string, unknown>> = [];
    const res = await curateMembershipResponsibility(makeAdmin({ rpcSpy: (_n, p) => calls.push(p) }), {
      ...base,
      responsibilityKey: "LEAD",
    });
    expect(res).toEqual({ ok: false, reason: "invalid_responsibility" });
    expect(calls).toHaveLength(0); // never reached the RPC
  });

  it("(9) rejects a future start date before any DB call", async () => {
    const calls: Array<Record<string, unknown>> = [];
    const res = await curateMembershipResponsibility(makeAdmin({ rpcSpy: (_n, p) => calls.push(p) }), {
      ...base,
      startedOn: "2026-07-21",
    });
    expect(res).toEqual({ ok: false, reason: "start_date_in_future" });
    expect(calls).toHaveLength(0);
  });

  it("(10) rejects cross-organization injection (membership outside admin scope)", async () => {
    const calls: Array<Record<string, unknown>> = [];
    const admin = makeAdmin({
      anchor: { id: "m1", organization_id: "org-ELSEWHERE" },
      rpcSpy: (_n, p) => calls.push(p),
    });
    const res = await curateMembershipResponsibility(admin, base);
    expect(res).toEqual({ ok: false, reason: "member_out_of_scope" });
    expect(calls).toHaveLength(0);
  });

  it("rejects a membership that does not exist", async () => {
    const res = await curateMembershipResponsibility(makeAdmin({ anchor: null }), base);
    expect(res).toEqual({ ok: false, reason: "membership_not_found" });
  });

  it("rejects curation on an inactive membership", async () => {
    const admin = makeAdmin({
      rpcResult: { data: null, error: { message: "organization_membership_inactive" } },
    });
    const res = await curateMembershipResponsibility(admin, base);
    expect(res).toEqual({ ok: false, reason: "organization_membership_inactive" });
  });

  it("maps revise/remove of a non-active responsibility to a stable reason", async () => {
    const admin = makeAdmin({
      rpcResult: { data: null, error: { message: "responsibility_not_active" } },
    });
    const res = await curateMembershipResponsibility(admin, { ...base, action: "remove" });
    expect(res).toEqual({ ok: false, reason: "responsibility_not_active" });
  });

  it("passes the authenticated admin as the actor — never a caller-supplied one", async () => {
    const calls: Array<Record<string, unknown>> = [];
    // a forged actor / user id on the input object must be ignored entirely
    const forged = { ...base, changedBy: "admin-1", p_changed_by: "attacker", userId: "attacker" };
    await curateMembershipResponsibility(
      makeAdmin({ rpcSpy: (_n, p) => calls.push(p) }),
      forged as unknown as Parameters<typeof curateMembershipResponsibility>[1],
    );
    expect(calls[0].p_changed_by).toBe("admin-1");
  });

  it("never sends a user id — the RPC is addressed by MEMBERSHIP only", async () => {
    const calls: Array<Record<string, unknown>> = [];
    await curateMembershipResponsibility(makeAdmin({ rpcSpy: (_n, p) => calls.push(p) }), base);
    expect(Object.keys(calls[0]).sort()).toEqual(
      ["p_membership_id", "p_responsibility_key", "p_action", "p_started_on", "p_changed_by"].sort(),
    );
  });
});

describe("responsibility reads (3) + the 3.1B-2 resolver seam", () => {
  const rows = [
    { id: "r1", responsibility_key: "PARTNER", started_on: "2020-01-01" },
    { id: "r2", responsibility_key: "CLINICAL_DIRECTOR", started_on: null },
  ];

  it("(3) returns all active assignments so a reload restores them", async () => {
    const out = await listMembershipResponsibilities(makeAdmin({ rows }), "m1");
    expect(out).toEqual([
      { id: "r1", responsibilityKey: "PARTNER", startedOn: "2020-01-01" },
      { id: "r2", responsibilityKey: "CLINICAL_DIRECTOR", startedOn: null },
    ]);
  });

  it("preserves an unknown date as null on read", async () => {
    const out = await listMembershipResponsibilities(makeAdmin({ rows }), "m1");
    expect(out[1].startedOn).toBeNull();
  });

  it("exposes a keys-only seam for Slice 3.1B-2 with no access semantics attached", async () => {
    const keys = await listActiveResponsibilityKeys(makeAdmin({ rows }), "m1");
    expect(keys).toEqual(["PARTNER", "CLINICAL_DIRECTOR"]);
  });

  it("returns an empty list for a member with no responsibilities (never inferred)", async () => {
    const out = await listMembershipResponsibilities(makeAdmin({ rows: [] }), "m2");
    expect(out).toEqual([]);
  });
});
