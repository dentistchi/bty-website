import { describe, it, expect } from "vitest";
import {
  decideActionReviewAuthority,
  type ActionReviewFacts,
  type MembershipFact,
  type AuthorityEdgeFact,
} from "./actionReviewAuthority";

const TODAY = "2026-07-23";
const ORG = "org-1";

// canonical actors
const HOST_A_USER = "u-host-a";
const HOST_B_USER = "u-host-b";
const LEARNER_A_USER = "u-learner-a";
const LEARNER_B_USER = "u-learner-b";

const HOST_A_MEM = "m-host-a";
const HOST_B_MEM = "m-host-b";
const LEARNER_A_MEM = "m-learner-a";
const LEARNER_B_MEM = "m-learner-b";

const mem = (id: string, userId: string | null, org = ORG, status = "active"): MembershipFact => ({
  id,
  userId,
  organizationId: org,
  status,
});

const edge = (
  id: string,
  reviewerMembershipId: string,
  learnerMembershipId: string,
  overrides: Partial<AuthorityEdgeFact> = {},
): AuthorityEdgeFact => ({
  id,
  reviewerMembershipId,
  learnerMembershipId,
  organizationId: ORG,
  authorityKey: "ACTION_REVIEWER",
  status: "active",
  revokedAt: null,
  startedOn: "2026-07-20",
  ...overrides,
});

function facts(over: Partial<ActionReviewFacts>): ActionReviewFacts {
  return {
    actorUserId: HOST_A_USER,
    actionContractId: "c-1",
    contract: { id: "c-1", ownerUserId: LEARNER_A_USER, verificationMode: "hybrid" },
    actorMemberships: [mem(HOST_A_MEM, HOST_A_USER)],
    learnerMemberships: [mem(LEARNER_A_MEM, LEARNER_A_USER)],
    edges: [edge("e-a", HOST_A_MEM, LEARNER_A_MEM)],
    today: TODAY,
    ...over,
  };
}

describe("decideActionReviewAuthority", () => {
  it("1. exact Host A -> Learner A edge allows", () => {
    const d = decideActionReviewAuthority(facts({}));
    expect(d.allowed).toBe(true);
    if (d.allowed) {
      expect(d.reviewerMembershipId).toBe(HOST_A_MEM);
      expect(d.learnerMembershipId).toBe(LEARNER_A_MEM);
      expect(d.organizationId).toBe(ORG);
      expect(d.verificationMode).toBe("hybrid");
      expect(d.authorityId).toBe("e-a");
    }
  });

  it("2. exact Host B -> Learner B edge allows (link mode)", () => {
    const d = decideActionReviewAuthority(
      facts({
        actorUserId: HOST_B_USER,
        contract: { id: "c-2", ownerUserId: LEARNER_B_USER, verificationMode: "link" },
        actorMemberships: [mem(HOST_B_MEM, HOST_B_USER)],
        learnerMemberships: [mem(LEARNER_B_MEM, LEARNER_B_USER)],
        edges: [edge("e-b", HOST_B_MEM, LEARNER_B_MEM)],
      }),
    );
    expect(d.allowed).toBe(true);
    if (d.allowed) expect(d.verificationMode).toBe("link");
  });

  it("3. Host A -> Learner B denies (edge missing)", () => {
    const d = decideActionReviewAuthority(
      facts({
        contract: { id: "c-2", ownerUserId: LEARNER_B_USER, verificationMode: "hybrid" },
        learnerMemberships: [mem(LEARNER_B_MEM, LEARNER_B_USER)],
        edges: [edge("e-a", HOST_A_MEM, LEARNER_A_MEM)], // edge is to learner A, not B
      }),
    );
    expect(d).toEqual({ allowed: false, reason: "AUTHORITY_EDGE_MISSING" });
  });

  it("4. Host B -> Learner A denies (edge missing)", () => {
    const d = decideActionReviewAuthority(
      facts({
        actorUserId: HOST_B_USER,
        actorMemberships: [mem(HOST_B_MEM, HOST_B_USER)],
        edges: [edge("e-a", HOST_A_MEM, LEARNER_A_MEM)],
      }),
    );
    expect(d).toEqual({ allowed: false, reason: "AUTHORITY_EDGE_MISSING" });
  });

  it("5. same organization without an edge denies", () => {
    const d = decideActionReviewAuthority(facts({ edges: [] }));
    expect(d).toEqual({ allowed: false, reason: "AUTHORITY_EDGE_MISSING" });
  });

  it("6. role/title without an edge denies (title is not modeled here => still no edge)", () => {
    // Even if the actor is a 'leader' elsewhere, decision sees only edges: none => deny.
    const d = decideActionReviewAuthority(facts({ edges: [] }));
    expect(d.allowed).toBe(false);
  });

  it("7. responsibility without an edge denies", () => {
    // responsibilities are not an input to this decision; absent edge => deny.
    const d = decideActionReviewAuthority(facts({ edges: [] }));
    expect(d.allowed).toBe(false);
  });

  it("8. self-review denies", () => {
    const d = decideActionReviewAuthority(
      facts({
        actorUserId: LEARNER_A_USER, // actor is the contract owner
        actorMemberships: [mem(LEARNER_A_MEM, LEARNER_A_USER)],
        edges: [],
      }),
    );
    expect(d).toEqual({ allowed: false, reason: "SELF_REVIEW_FORBIDDEN" });
  });

  it("9. qr mode denies", () => {
    const d = decideActionReviewAuthority(
      facts({ contract: { id: "c-1", ownerUserId: LEARNER_A_USER, verificationMode: "qr" } }),
    );
    expect(d).toEqual({ allowed: false, reason: "VERIFICATION_MODE_NOT_REVIEWABLE" });
  });

  it("10. missing/unknown verification mode denies", () => {
    expect(decideActionReviewAuthority(facts({ contract: { id: "c-1", ownerUserId: LEARNER_A_USER, verificationMode: null } })))
      .toEqual({ allowed: false, reason: "VERIFICATION_MODE_NOT_REVIEWABLE" });
    expect(decideActionReviewAuthority(facts({ contract: { id: "c-1", ownerUserId: LEARNER_A_USER, verificationMode: "self_report" } })))
      .toEqual({ allowed: false, reason: "VERIFICATION_MODE_NOT_REVIEWABLE" });
  });

  it("11. revoked edge denies", () => {
    const d = decideActionReviewAuthority(
      facts({ edges: [edge("e-a", HOST_A_MEM, LEARNER_A_MEM, { status: "revoked", revokedAt: "2026-07-22T00:00:00Z" })] }),
    );
    expect(d).toEqual({ allowed: false, reason: "AUTHORITY_EDGE_REVOKED_OR_INEFFECTIVE" });
  });

  it("12. future-start edge denies", () => {
    const d = decideActionReviewAuthority(
      facts({ edges: [edge("e-a", HOST_A_MEM, LEARNER_A_MEM, { startedOn: "2026-07-25" })] }),
    );
    expect(d).toEqual({ allowed: false, reason: "AUTHORITY_EDGE_REVOKED_OR_INEFFECTIVE" });
  });

  it("13. inactive reviewer membership denies", () => {
    const d = decideActionReviewAuthority(
      facts({ actorMemberships: [mem(HOST_A_MEM, HOST_A_USER, ORG, "inactive")] }),
    );
    expect(d).toEqual({ allowed: false, reason: "REVIEWER_MEMBERSHIP_INACTIVE" });
  });

  it("14. unbound reviewer membership denies", () => {
    const d = decideActionReviewAuthority(
      facts({ actorMemberships: [mem(HOST_A_MEM, null, ORG, "active")] }),
    );
    expect(d).toEqual({ allowed: false, reason: "REVIEWER_MEMBERSHIP_UNBOUND" });
  });

  it("15. inactive learner membership denies", () => {
    const d = decideActionReviewAuthority(
      facts({ learnerMemberships: [mem(LEARNER_A_MEM, LEARNER_A_USER, ORG, "inactive")] }),
    );
    expect(d).toEqual({ allowed: false, reason: "LEARNER_MEMBERSHIP_INACTIVE" });
  });

  it("16. unbound learner membership denies", () => {
    const d = decideActionReviewAuthority(
      facts({ learnerMemberships: [mem(LEARNER_A_MEM, null, ORG, "active")] }),
    );
    expect(d).toEqual({ allowed: false, reason: "LEARNER_MEMBERSHIP_UNBOUND" });
  });

  it("17. cross-org / corrupted org value denies", () => {
    const d = decideActionReviewAuthority(
      facts({
        // reviewer in org-1, learner in org-2; edge claims org-1 -> org inconsistent
        learnerMemberships: [mem(LEARNER_A_MEM, LEARNER_A_USER, "org-2")],
        edges: [edge("e-a", HOST_A_MEM, LEARNER_A_MEM, { organizationId: ORG })],
      }),
    );
    expect(d).toEqual({ allowed: false, reason: "ORGANIZATION_MISMATCH" });
  });

  it("18. unknown contract denies (not found)", () => {
    const d = decideActionReviewAuthority(facts({ contract: null }));
    expect(d).toEqual({ allowed: false, reason: "CONTRACT_NOT_FOUND" });
  });

  it("19+20. authority is derived from contract owner, never from client-supplied membership ids", () => {
    // The decision has NO channel for client reviewer/learner ids: learner comes from
    // contract.ownerUserId. Supplying an edge whose learner membership is NOT one of the
    // contract owner's memberships cannot authorize.
    const d = decideActionReviewAuthority(
      facts({
        learnerMemberships: [mem(LEARNER_A_MEM, LEARNER_A_USER)],
        edges: [edge("e-x", HOST_A_MEM, "m-attacker-supplied")], // learner id not owned by contract owner
      }),
    );
    expect(d).toEqual({ allowed: false, reason: "AUTHORITY_EDGE_MISSING" });
  });

  it("21. multiple effective edges fail closed as ambiguous", () => {
    // actor holds two active memberships, each with an active edge to the (two) learner memberships
    const d = decideActionReviewAuthority(
      facts({
        actorMemberships: [mem(HOST_A_MEM, HOST_A_USER), mem("m-host-a2", HOST_A_USER)],
        learnerMemberships: [mem(LEARNER_A_MEM, LEARNER_A_USER), mem("m-learner-a2", LEARNER_A_USER)],
        edges: [
          edge("e-a", HOST_A_MEM, LEARNER_A_MEM),
          edge("e-a2", "m-host-a2", "m-learner-a2"),
        ],
      }),
    );
    expect(d).toEqual({ allowed: false, reason: "AMBIGUOUS_AUTHORITY" });
  });

  it("22. one valid edge plus irrelevant extra memberships still allows", () => {
    const d = decideActionReviewAuthority(
      facts({
        actorMemberships: [mem(HOST_A_MEM, HOST_A_USER), mem("m-host-a-idle", HOST_A_USER)],
        learnerMemberships: [mem(LEARNER_A_MEM, LEARNER_A_USER), mem("m-learner-idle", LEARNER_A_USER)],
        edges: [edge("e-a", HOST_A_MEM, LEARNER_A_MEM)], // only one edge
      }),
    );
    expect(d.allowed).toBe(true);
    if (d.allowed) expect(d.authorityId).toBe("e-a");
  });

  it("23. an allow decision carries no reusable token — it is derived per-call from live facts", () => {
    // Same facts but with the edge revoked between calls => the *new* call denies. Proves a
    // previously-allowed result cannot be replayed as mutation proof.
    const base = facts({});
    expect(decideActionReviewAuthority(base).allowed).toBe(true);
    const afterRevoke = decideActionReviewAuthority({
      ...base,
      edges: [edge("e-a", HOST_A_MEM, LEARNER_A_MEM, { status: "revoked", revokedAt: "2026-07-23T01:00:00Z" })],
    });
    expect(afterRevoke).toEqual({ allowed: false, reason: "AUTHORITY_EDGE_REVOKED_OR_INEFFECTIVE" });
  });

  it("extra: missing actor denies", () => {
    expect(decideActionReviewAuthority(facts({ actorUserId: null }))).toEqual({ allowed: false, reason: "ACTOR_MISSING" });
  });

  it("extra: reviewer with no membership at all denies as MISSING", () => {
    expect(decideActionReviewAuthority(facts({ actorMemberships: [] }))).toEqual({
      allowed: false,
      reason: "REVIEWER_MEMBERSHIP_MISSING",
    });
  });
});
