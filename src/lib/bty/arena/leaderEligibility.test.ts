/** @vitest-environment node */
import { describe, it, expect } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  resolveLeaderEligibility,
  resolveOwnOrganizationId,
} from "./organizationResponsibilityService";

/**
 * Slice 3.1B-2 — Leaders eligibility resolution (PREVIEW ONLY; assigns nothing).
 * Proves organization isolation, exclusion of inactive memberships and removed
 * responsibilities, and that a member appears exactly once.
 */

type M = { id: string; user_id: string; organization_id: string; status: string };
type R = { id: string; membership_id: string; responsibility_key: string; started_on: string | null; status: string };

function makeAdmin(memberships: M[], responsibilities: R[]): SupabaseClient {
  return {
    from(table: string) {
      if (table === "bty_org_memberships") {
        const f: { org?: string; status?: string; user?: string; primary?: boolean } = {};
        const q: Record<string, unknown> = {
          select: () => q,
          eq: (col: string, val: unknown) => {
            if (col === "organization_id") f.org = String(val);
            if (col === "status") f.status = String(val);
            if (col === "user_id") f.user = String(val);
            if (col === "is_primary") f.primary = Boolean(val);
            const rows = memberships.filter(
              (m) =>
                (f.org === undefined || m.organization_id === f.org) &&
                (f.status === undefined || m.status === f.status) &&
                (f.user === undefined || m.user_id === f.user),
            );
            // terminal-awaitable AND chainable
            return Object.assign(
              Promise.resolve({ data: rows, error: null }),
              q,
              { maybeSingle: () => Promise.resolve({ data: rows[0] ?? null, error: null }) },
            );
          },
          in: () => Promise.resolve({ data: memberships, error: null }),
          maybeSingle: () => Promise.resolve({ data: null, error: null }),
        };
        return q;
      }
      if (table === "bty_org_membership_responsibilities") {
        // Emulates the real chain: .select().in(ids).eq("status","active").order(...)
        const f: { ids?: string[]; status?: string } = {};
        const rows = () =>
          responsibilities.filter(
            (r) =>
              (f.ids === undefined || f.ids.includes(r.membership_id)) &&
              (f.status === undefined || r.status === f.status),
          );
        const q: Record<string, unknown> = {
          select: () => q,
          in: (_c: string, ids: string[]) => {
            f.ids = ids;
            return q;
          },
          eq: (col: string, val: unknown) => {
            if (col === "status") f.status = String(val);
            return q;
          },
          order: () => Promise.resolve({ data: rows(), error: null }),
        };
        return q;
      }
      throw new Error(`unexpected table ${table}`);
    },
  } as unknown as SupabaseClient;
}

const ORG_A = "org-a";
const ORG_B = "org-b";

const MEMBERS: M[] = [
  { id: "m-leader", user_id: "u1", organization_id: ORG_A, status: "active" },
  { id: "m-plain", user_id: "u2", organization_id: ORG_A, status: "active" },
  { id: "m-inactive", user_id: "u3", organization_id: ORG_A, status: "inactive" },
  { id: "m-otherorg", user_id: "u4", organization_id: ORG_B, status: "active" },
];

const r = (id: string, membership: string, key: string, status = "active"): R => ({
  id, membership_id: membership, responsibility_key: key, started_on: null, status,
});

describe("resolveLeaderEligibility", () => {
  it("includes a member with canonical responsibilities and excludes one with none", async () => {
    const admin = makeAdmin(MEMBERS, [r("r1", "m-leader", "PARTNER")]);
    const out = await resolveLeaderEligibility(admin, ORG_A);
    expect(out.eligibleCount).toBe(1);
    expect(out.members.map((m) => m.membershipId)).toEqual(["m-leader"]);
  });

  it("counts a member with THREE responsibilities exactly once", async () => {
    const admin = makeAdmin(MEMBERS, [
      r("r1", "m-leader", "PARTNER"),
      r("r2", "m-leader", "CLINICAL_DIRECTOR"),
      r("r3", "m-leader", "PEOPLE_MANAGER"),
    ]);
    const out = await resolveLeaderEligibility(admin, ORG_A);
    expect(out.eligibleCount).toBe(1);
    expect(out.members).toHaveLength(1);
    expect(out.members[0].matchedResponsibilityKeys).toEqual([
      "PARTNER", "CLINICAL_DIRECTOR", "PEOPLE_MANAGER",
    ]);
  });

  it("excludes a REMOVED responsibility", async () => {
    const admin = makeAdmin(MEMBERS, [r("r1", "m-leader", "PARTNER", "removed")]);
    const out = await resolveLeaderEligibility(admin, ORG_A);
    expect(out.eligibleCount).toBe(0);
  });

  it("excludes an INACTIVE membership even when it holds a responsibility", async () => {
    const admin = makeAdmin(MEMBERS, [r("r1", "m-inactive", "PARTNER")]);
    const out = await resolveLeaderEligibility(admin, ORG_A);
    expect(out.eligibleCount).toBe(0);
  });

  it("ORGANIZATION ISOLATION — a responsibility in org B never qualifies anyone in org A", async () => {
    const admin = makeAdmin(MEMBERS, [r("r1", "m-otherorg", "PARTNER")]);
    const outA = await resolveLeaderEligibility(admin, ORG_A);
    expect(outA.eligibleCount).toBe(0);
    const outB = await resolveLeaderEligibility(admin, ORG_B);
    expect(outB.members.map((m) => m.membershipId)).toEqual(["m-otherorg"]);
  });

  it("returns zero (never a fallback to everyone) when nobody qualifies", async () => {
    const admin = makeAdmin(MEMBERS, []);
    const out = await resolveLeaderEligibility(admin, ORG_A);
    expect(out.eligibleCount).toBe(0);
    expect(out.members).toEqual([]);
    // critically: it does NOT return the full membership list
    expect(out.members.length).not.toBe(MEMBERS.length);
  });

  it("matches the live staging baseline shape: exactly one leader in BTY Legacy", async () => {
    const admin = makeAdmin(MEMBERS, [
      r("r1", "m-leader", "PARTNER"),
      r("r2", "m-leader", "CLINICAL_DIRECTOR"),
      r("r3", "m-leader", "PEOPLE_MANAGER"),
    ]);
    const out = await resolveLeaderEligibility(admin, ORG_A);
    expect(out.eligibleCount).toBe(1);
  });
});

describe("resolveOwnOrganizationId", () => {
  it("resolves the caller's own active primary organization", async () => {
    const admin = makeAdmin(
      [{ id: "m1", user_id: "u1", organization_id: ORG_A, status: "active" }],
      [],
    );
    expect(await resolveOwnOrganizationId(admin, "u1")).toBe(ORG_A);
  });

  it("returns null when the caller has no active membership", async () => {
    const admin = makeAdmin([], []);
    expect(await resolveOwnOrganizationId(admin, "nobody")).toBeNull();
  });
});
