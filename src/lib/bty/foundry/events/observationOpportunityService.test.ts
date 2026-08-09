import { describe, it, expect, vi, beforeEach } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * SLICE 3.2N — which behaviours a reviewer is offered, and what the card is allowed to contain.
 *
 * The authority resolver is mocked at its boundary (as in 3.2M-4/-5) so these tests are about the
 * questions this slice owns: is the narrowing correct, is authority re-resolved per candidate, is
 * the card thinner than the page it opens, and does one reviewer's card ever describe another
 * reviewer's answers.
 */
const authority = vi.fn();
vi.mock("@/lib/bty/arena/actionReviewAuthorityResolver.server", () => ({
  resolveEdgeAuthority: (...a: unknown[]) => authority(...a),
}));

import {
  hasEligibleObserver,
  learnersWithAnEligibleObserver,
  listMyObservationOpportunities,
} from "./observationOpportunityService";

type Row = Record<string, unknown>;
type Tables = Record<string, Row[]>;

/** Mock PostgREST: supports select/eq/in/is/limit and awaiting the builder for rows. */
function makeAdmin(tables: Tables) {
  return {
    from(table: string) {
      const b: Record<string, unknown> = { _rows: (tables[table] ?? []).slice() };
      b.select = () => b;
      b.eq = function (this: { _rows: Row[] }, c: string, v: unknown) {
        this._rows = this._rows.filter((r) => r[c] === v);
        return b;
      };
      b.is = function (this: { _rows: Row[] }, c: string, v: unknown) {
        this._rows = this._rows.filter((r) => (r[c] ?? null) === v);
        return b;
      };
      b.in = function (this: { _rows: Row[] }, c: string, vs: unknown[]) {
        this._rows = this._rows.filter((r) => vs.includes(r[c]));
        return b;
      };
      b.limit = () => b;
      b.maybeSingle = async function (this: { _rows: Row[] }) {
        return { data: this._rows[0] ?? null };
      };
      (b as { then: unknown }).then = function (this: { _rows: Row[] }, res: (v: { data: Row[] }) => unknown) {
        return Promise.resolve({ data: this._rows }).then(res);
      };
      return b;
    },
  } as unknown as SupabaseClient;
}

const REVIEWER = "user-reviewer";
const REVIEWER2 = "user-reviewer-2";
const LEARNER = "user-learner";
const STANDARD = "The outgoing person states each open item aloud and the incoming person repeats it back.";

const el = (kind: string, content: string, status = "grounded") => ({
  id: `el_${kind}`, kind, content, confirmationStatus: status,
  grounding: [{ sourceType: "host_statement", field: "problem" }],
});

const seed = (over: Partial<Tables> = {}): Tables => ({
  bty_org_memberships: [
    { id: "m-rev", user_id: REVIEWER, organization_id: "org-1", status: "active" },
    { id: "m-rev2", user_id: REVIEWER2, organization_id: "org-1", status: "active" },
    { id: "m-learn", user_id: LEARNER, organization_id: "org-1", status: "active" },
  ],
  bty_org_action_review_authority: [
    {
      id: "edge-1", reviewer_membership_id: "m-rev", learner_membership_id: "m-learn",
      authority_key: "ACTION_REVIEWER", status: "active", revoked_at: null,
    },
  ],
  foundry_participant_followups: [
    { id: "fu-1", event_id: "ev-1", user_id_snapshot: LEARNER, follow_up_days: 7 },
  ],
  foundry_event_module: [{
    event_id: "ev-1",
    module_snapshot: { realityGroundedJourneyV1: { version: 1, displayTitle: "T", displayTitleStatus: "grounded",
      elements: [el("observable_standard", STANDARD)] } },
  }],
  foundry_event_participants: [{ event_id: "ev-1", display_name: "Yoon Learner" }],
  foundry_behavior_observations: [],
  ...over,
});

const obs = (over: Partial<Row> = {}): Row => ({
  followup_id: "fu-1", observer_user_id: REVIEWER, outcome: "OBSERVED",
  observed_on: "2026-08-01", submitted_at: "2026-08-01T09:00:00Z",
  observed_standard_snapshot: STANDARD, ...over,
});

beforeEach(() => {
  authority.mockReset();
  authority.mockResolvedValue({ allowed: true, authorityId: "edge-1", organizationId: "org-1" });
});

describe("[3.2N] who is offered an observation", () => {
  it("an authorised reviewer is offered their learner's behaviour", async () => {
    const items = await listMyObservationOpportunities(makeAdmin(seed()), REVIEWER);
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ followupId: "fu-1", learnerLabel: "Yoon Learner", behavior: STANDARD, state: "none" });
  });

  it("no edge → empty, and authority is never even consulted", async () => {
    const t = seed({ bty_org_action_review_authority: [] });
    expect(await listMyObservationOpportunities(makeAdmin(t), REVIEWER)).toEqual([]);
    expect(authority).not.toHaveBeenCalled();
  });

  it("a REVOKED edge offers nothing", async () => {
    const t = seed({
      bty_org_action_review_authority: [{
        id: "edge-1", reviewer_membership_id: "m-rev", learner_membership_id: "m-learn",
        authority_key: "ACTION_REVIEWER", status: "revoked", revoked_at: "2026-08-01T00:00:00Z",
      }],
    });
    expect(await listMyObservationOpportunities(makeAdmin(t), REVIEWER)).toEqual([]);
  });

  it("the learner is never offered their own behaviour", async () => {
    // No edge points learner → learner, and the resolver would refuse it anyway (non-self).
    expect(await listMyObservationOpportunities(makeAdmin(seed()), LEARNER)).toEqual([]);
  });

  it("an unrelated authenticated user is offered nothing", async () => {
    expect(await listMyObservationOpportunities(makeAdmin(seed()), "user-stranger")).toEqual([]);
  });

  it("a same-org user WITHOUT an edge is offered nothing", async () => {
    expect(await listMyObservationOpportunities(makeAdmin(seed()), REVIEWER2)).toEqual([]);
  });

  it("an inactive reviewer membership grants nothing", async () => {
    const t = seed();
    t.bty_org_memberships = [
      { id: "m-rev", user_id: REVIEWER, organization_id: "org-1", status: "inactive" },
      { id: "m-learn", user_id: LEARNER, organization_id: "org-1", status: "active" },
    ];
    expect(await listMyObservationOpportunities(makeAdmin(t), REVIEWER)).toEqual([]);
  });

  it("authority is RE-RESOLVED per candidate — narrowing is not authorisation", async () => {
    authority.mockResolvedValue({ allowed: false, reason: "AUTHORITY_EDGE_MISSING" });
    expect(await listMyObservationOpportunities(makeAdmin(seed()), REVIEWER)).toEqual([]);
    expect(authority).toHaveBeenCalledWith(expect.anything(), { actorUserId: REVIEWER, learnerUserId: LEARNER }, expect.anything());
  });

  it("a training with NO grounded standard is never offered", async () => {
    const t = seed({
      foundry_event_module: [{ event_id: "ev-1", module_snapshot: { realityGroundedJourneyV1: { version: 1,
        displayTitle: "T", displayTitleStatus: "grounded", elements: [el("field_application", "Do the thing")] } } }],
    });
    expect(await listMyObservationOpportunities(makeAdmin(t), REVIEWER)).toEqual([]);
  });

  it("an UNCONFIRMED standard is not a standard", async () => {
    const t = seed({
      foundry_event_module: [{ event_id: "ev-1", module_snapshot: { realityGroundedJourneyV1: { version: 1,
        displayTitle: "T", displayTitleStatus: "grounded", elements: [el("observable_standard", STANDARD, "needs_confirmation")] } } }],
    });
    expect(await listMyObservationOpportunities(makeAdmin(t), REVIEWER)).toEqual([]);
  });

  it("an empty caller id is not a reviewer", async () => {
    expect(await listMyObservationOpportunities(makeAdmin(seed()), "  ")).toEqual([]);
  });
});

describe("[3.2N] the card describes MY record, never a colleague's", () => {
  it("another reviewer's sighting does not change my card", async () => {
    const t = seed({ foundry_behavior_observations: [obs({ observer_user_id: REVIEWER2 })] });
    const items = await listMyObservationOpportunities(makeAdmin(t), REVIEWER);
    expect(items[0].state, "I have recorded nothing").toBe("none");
    expect(items[0].positiveDates).toBe(0);
  });

  it("my own sighting does", async () => {
    const t = seed({ foundry_behavior_observations: [obs()] });
    const items = await listMyObservationOpportunities(makeAdmin(t), REVIEWER);
    expect(items[0].state).toBe("seen_once");
    expect(items[0].lastObservedOn).toBe("2026-08-01");
  });

  it("my own negative reads as not_seen, never as a failure", async () => {
    const t = seed({ foundry_behavior_observations: [obs({ outcome: "NOT_OBSERVED" })] });
    expect((await listMyObservationOpportunities(makeAdmin(t), REVIEWER))[0].state).toBe("not_seen");
  });

  it("two of my own dates a window apart read as sustained", async () => {
    const t = seed({
      foundry_behavior_observations: [obs(), obs({ observed_on: "2026-08-08" })],
    });
    const items = await listMyObservationOpportunities(makeAdmin(t), REVIEWER);
    expect(items[0].state).toBe("sustained");
    expect([items[0].firstObservedOn, items[0].lastObservedOn]).toEqual(["2026-08-01", "2026-08-08"]);
  });

  it("two of my dates inside the window read as seen_repeatedly", async () => {
    const t = seed({ foundry_behavior_observations: [obs(), obs({ observed_on: "2026-08-05" })] });
    expect((await listMyObservationOpportunities(makeAdmin(t), REVIEWER))[0].state).toBe("seen_repeatedly");
  });

  it("the opportunity REMAINS after I have reported — it is not consumed", async () => {
    const t = seed({ foundry_behavior_observations: [obs()] });
    const items = await listMyObservationOpportunities(makeAdmin(t), REVIEWER);
    expect(items, "still offered, so a later sighting is reachable").toHaveLength(1);
  });
});

describe("[3.2N] privacy of the card", () => {
  it("carries only what the observation page carries — and no learner evidence", async () => {
    const t = seed({ foundry_behavior_observations: [obs()] });
    // Private facts live on the progress row; this path never selects it.
    t.foundry_event_training_progress = [{
      id: "p-1", event_id: "ev-1", response_text: "PRIVATE REFLECTION",
      decision_response_text: "MY DECISION", shared_understanding_response: "SHARED ANSWER",
    }];
    const items = await listMyObservationOpportunities(makeAdmin(t), REVIEWER);
    expect(Object.keys(items[0]).sort()).toEqual(
      ["behavior", "firstObservedOn", "followupId", "lastObservedOn", "learnerLabel", "positiveDates", "state"].sort(),
    );
    const payload = JSON.stringify(items);
    for (const secret of [
      "PRIVATE REFLECTION", "MY DECISION", "SHARED ANSWER", LEARNER, "edge-1", "organization_id",
      "APPLIED", "user_id_snapshot", "ACTION_REVIEWER",
    ]) {
      expect(payload, secret).not.toContain(secret);
    }
  });

  it("the learner label comes from the SAME source as the observation page", async () => {
    // foundry_event_participants.display_name — so the card and the page it opens agree.
    const t = seed({ foundry_event_participants: [{ event_id: "ev-1", display_name: "Room Name" }] });
    // An arena_profiles nickname must NOT be preferred, even when one exists.
    t.arena_profiles = [{ user_id: LEARNER, display_name: "Arena Nickname", sub_name: "sub" }];
    expect((await listMyObservationOpportunities(makeAdmin(t), REVIEWER))[0].learnerLabel).toBe("Room Name");
  });
});

describe("[3.2N] can anyone confirm this at all?", () => {
  it("true when an active edge points at a live reviewer", async () => {
    expect(await hasEligibleObserver(makeAdmin(seed()), LEARNER)).toBe(true);
  });

  it("false when there is no edge", async () => {
    expect(await hasEligibleObserver(makeAdmin(seed({ bty_org_action_review_authority: [] })), LEARNER)).toBe(false);
  });

  it("false when the edge is revoked", async () => {
    const t = seed({
      bty_org_action_review_authority: [{
        id: "edge-1", reviewer_membership_id: "m-rev", learner_membership_id: "m-learn",
        authority_key: "ACTION_REVIEWER", status: "revoked", revoked_at: "2026-08-01T00:00:00Z",
      }],
    });
    expect(await hasEligibleObserver(makeAdmin(t), LEARNER)).toBe(false);
  });

  it("false when the reviewer has left — a stale edge points at nobody", async () => {
    const t = seed();
    t.bty_org_memberships = [
      { id: "m-rev", user_id: REVIEWER, organization_id: "org-1", status: "inactive" },
      { id: "m-learn", user_id: LEARNER, organization_id: "org-1", status: "active" },
    ];
    expect(await hasEligibleObserver(makeAdmin(t), LEARNER)).toBe(false);
  });

  it("answers a whole roster in one batched read", async () => {
    const t = seed();
    t.bty_org_memberships = [
      ...(t.bty_org_memberships as Row[]),
      { id: "m-learn2", user_id: "user-learner-2", organization_id: "org-1", status: "active" },
    ];
    const covered = await learnersWithAnEligibleObserver(makeAdmin(t), [LEARNER, "user-learner-2"]);
    expect(covered.has(LEARNER)).toBe(true);
    expect(covered.has("user-learner-2"), "no edge → not covered").toBe(false);
  });

  it("an empty roster asks nothing", async () => {
    expect((await learnersWithAnEligibleObserver(makeAdmin(seed()), [])).size).toBe(0);
  });
});

describe("[3.2N] multiple reviewers", () => {
  it("both eligible reviewers are offered the SAME behaviour", async () => {
    const t = seed({
      bty_org_action_review_authority: [
        { id: "edge-1", reviewer_membership_id: "m-rev", learner_membership_id: "m-learn", authority_key: "ACTION_REVIEWER", status: "active", revoked_at: null },
        { id: "edge-2", reviewer_membership_id: "m-rev2", learner_membership_id: "m-learn", authority_key: "ACTION_REVIEWER", status: "active", revoked_at: null },
      ],
    });
    expect((await listMyObservationOpportunities(makeAdmin(t), REVIEWER))[0].followupId).toBe("fu-1");
    expect((await listMyObservationOpportunities(makeAdmin(t), REVIEWER2))[0].followupId).toBe("fu-1");
  });

  it("one reviewer reporting does NOT remove the other's opportunity", async () => {
    const t = seed({
      bty_org_action_review_authority: [
        { id: "edge-1", reviewer_membership_id: "m-rev", learner_membership_id: "m-learn", authority_key: "ACTION_REVIEWER", status: "active", revoked_at: null },
        { id: "edge-2", reviewer_membership_id: "m-rev2", learner_membership_id: "m-learn", authority_key: "ACTION_REVIEWER", status: "active", revoked_at: null },
      ],
      foundry_behavior_observations: [obs({ observer_user_id: REVIEWER })],
    });
    const forTwo = await listMyObservationOpportunities(makeAdmin(t), REVIEWER2);
    expect(forTwo, "no claim, no ownership").toHaveLength(1);
    expect(forTwo[0].state, "and no sight of what the other reviewer said").toBe("none");
  });
});
