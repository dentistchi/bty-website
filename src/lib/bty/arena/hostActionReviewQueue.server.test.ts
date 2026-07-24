/**
 * Host Action Review queue service (Slice 3.1B-3N Phase 5B). Covers candidate eligibility
 * (status='submitted' + verified_at null + mode in hybrid/link + reachable owner), per-candidate
 * authority gating (resolver mocked), label resolution, and detail deny→null. Uses status +
 * verified_at as the source of truth (never verification_status).
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const mockResolve = vi.fn();
vi.mock("@/lib/bty/arena/actionReviewAuthorityResolver.server", () => ({
  resolveActionReviewAuthority: (...a: unknown[]) => mockResolve(...a),
}));

import { listHostActionReviewQueue, getHostActionReviewDetail } from "./hostActionReviewQueue.server";

type Row = Record<string, unknown>;

// Minimal filtering fake of the supabase query builder (eq / is / in / limit / maybeSingle / thenable).
function fakeAdmin(tables: Record<string, Row[]>) {
  return {
    from(table: string) {
      const filters: Array<(r: Row) => boolean> = [];
      let limit = Infinity;
      const builder: Record<string, unknown> = {
        select() {
          return builder;
        },
        eq(col: string, val: unknown) {
          filters.push((r) => r[col] === val);
          return builder;
        },
        is(col: string, val: unknown) {
          filters.push((r) => (val === null ? r[col] == null : r[col] === val));
          return builder;
        },
        in(col: string, vals: unknown[]) {
          filters.push((r) => vals.includes(r[col]));
          return builder;
        },
        limit(n: number) {
          limit = n;
          return builder;
        },
        order() {
          return builder;
        },
        maybeSingle() {
          const rows = (tables[table] ?? []).filter((r) => filters.every((f) => f(r)));
          return Promise.resolve({ data: rows[0] ?? null, error: null });
        },
        then(resolve: (v: { data: Row[]; error: null }) => unknown) {
          const rows = (tables[table] ?? []).filter((r) => filters.every((f) => f(r))).slice(0, limit);
          return Promise.resolve({ data: rows, error: null }).then(resolve);
        },
      };
      return builder;
    },
  };
}

const MEM_ACTOR = { id: "m-actor", user_id: "host-a", organization_id: "o1", status: "active" };
const MEM_LEARNER = { id: "m-learner", user_id: "learner-a", organization_id: "o1", status: "active" };
const EDGE = {
  id: "e1",
  reviewer_membership_id: "m-actor",
  learner_membership_id: "m-learner",
  organization_id: "o1",
  authority_key: "ACTION_REVIEWER",
  status: "active",
  revoked_at: null,
};
const base = (over: Partial<Row>): Row => ({
  id: "c",
  user_id: "learner-a",
  contract_description: "Do the thing",
  submitted_at: "2026-07-01T00:00:00Z",
  deadline_at: "2026-07-05T00:00:00Z",
  verification_mode: "hybrid",
  status: "submitted",
  verified_at: null,
  verification_status: "pending",
  created_at: "2026-06-30T00:00:00Z",
  who: "team",
  what: "check-in",
  how: "in person",
  step_when: "Mon",
  ...over,
});

function world(contracts: Row[]) {
  return fakeAdmin({
    bty_org_memberships: [MEM_ACTOR, MEM_LEARNER],
    bty_org_action_review_authority: [EDGE],
    bty_action_contracts: contracts,
    arena_profiles: [{ user_id: "learner-a", display_name: "Nickname", sub_name: "code" }],
  });
}

describe("listHostActionReviewQueue", () => {
  beforeEach(() => mockResolve.mockReset());

  it("returns only eligible submitted hybrid/link candidates that the resolver allows", async () => {
    mockResolve.mockImplementation((...args: unknown[]) => {
      const params = args[1] as { actionContractId?: string } | undefined;
      return Promise.resolve(
        params?.actionContractId === "c1"
          ? { allowed: true, verificationMode: "hybrid" }
          : { allowed: false, reason: "AUTHORITY_EDGE_MISSING" },
      );
    });
    const admin = world([
      base({ id: "c1", verification_mode: "hybrid" }),
      base({ id: "c-qr", verification_mode: "qr" }), // excluded by mode filter (never a candidate)
      base({ id: "c-pending", status: "pending" }), // excluded by status filter
      base({ id: "c-verified", verified_at: "2026-07-02T00:00:00Z" }), // excluded by verified_at filter
      base({ id: "c-otherowner", user_id: "learner-b" }), // owner not reachable
    ]);
    const items = await listHostActionReviewQueue(admin as never, "host-a", "en");
    expect(items.map((i) => i.actionContractId)).toEqual(["c1"]);
    expect(items[0].learnerLabel).toBe("Nickname");
    expect(items[0].verificationMode).toBe("hybrid");
    expect(items[0].statusLabel).toBe("Awaiting your review");
  });

  it("returns empty when the resolver denies every candidate", async () => {
    mockResolve.mockResolvedValue({ allowed: false, reason: "AUTHORITY_EDGE_MISSING" });
    const admin = world([base({ id: "c1" })]);
    expect(await listHostActionReviewQueue(admin as never, "host-a", "en")).toEqual([]);
  });

  it("returns empty for an actor with no active membership (no candidate scan)", async () => {
    const admin = fakeAdmin({
      bty_org_memberships: [{ ...MEM_ACTOR, status: "inactive" }],
      bty_org_action_review_authority: [EDGE],
      bty_action_contracts: [base({ id: "c1" })],
      arena_profiles: [],
    });
    expect(await listHostActionReviewQueue(admin as never, "host-a", "en")).toEqual([]);
    expect(mockResolve).not.toHaveBeenCalled();
  });

  it("link-mode candidates are eligible", async () => {
    mockResolve.mockResolvedValue({ allowed: true, verificationMode: "link" });
    const admin = world([base({ id: "c1", verification_mode: "link" })]);
    const items = await listHostActionReviewQueue(admin as never, "host-a", "en");
    expect(items).toHaveLength(1);
    expect(items[0].verificationMode).toBe("link");
  });

  // Slice 3.1B-3N-5C.3: a submitted field_action (NULL Arena fields) belongs in the SAME queue as
  // an arena_run_completion contract; a pending one is excluded by the status filter.
  it("includes a submitted field_action (NULL run_id/scenario/pattern_family), excludes a pending one", async () => {
    mockResolve.mockResolvedValue({ allowed: true, verificationMode: "hybrid" });
    const admin = world([
      base({ id: "fa1", action_type: "field_action", run_id: null, arena_scenario_id: null, pattern_family: null }),
      base({ id: "fa-pending", action_type: "field_action", status: "pending" }),
    ]);
    const items = await listHostActionReviewQueue(admin as never, "host-a", "en");
    expect(items.map((i) => i.actionContractId)).toEqual(["fa1"]); // pending excluded
    expect(items[0].verificationMode).toBe("hybrid");
  });
});

describe("getHostActionReviewDetail", () => {
  beforeEach(() => mockResolve.mockReset());

  it("returns safe detail when the resolver allows", async () => {
    mockResolve.mockResolvedValue({ allowed: true, verificationMode: "hybrid" });
    const admin = world([base({ id: "c1" })]);
    const detail = await getHostActionReviewDetail(admin as never, "host-a", "c1", "en");
    expect(detail?.actionContractId).toBe("c1");
    expect(detail?.who).toBe("team");
    expect(detail?.learnerLabel).toBe("Nickname");
    expect(detail?.sourceLabel).toBeNull(); // arena contract → no source label
  });

  it("field_action detail returns the 'Real-world application' source label + Who/What/How/When (NULL Arena fields OK)", async () => {
    mockResolve.mockResolvedValue({ allowed: true, verificationMode: "hybrid" });
    const admin = world([base({ id: "fa1", action_type: "field_action", run_id: null, arena_scenario_id: null, pattern_family: null })]);
    const detail = await getHostActionReviewDetail(admin as never, "host-a", "fa1", "en");
    expect(detail?.sourceLabel).toBe("Real-world application");
    expect(detail?.who).toBe("team");
    expect(detail?.what).toBe("check-in");
  });

  it("returns null (→ generic 404) when the resolver denies", async () => {
    mockResolve.mockResolvedValue({ allowed: false, reason: "AUTHORITY_EDGE_MISSING" });
    const admin = world([base({ id: "c1" })]);
    expect(await getHostActionReviewDetail(admin as never, "host-b", "c1", "en")).toBeNull();
  });
});
