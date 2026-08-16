import { describe, it, expect, vi, beforeEach } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * SLICE R4-R1 — the human named on the screen IS the human the evidence records.
 *
 * R4-R0 proved the defect these tests exist to prevent from ever returning: the observer
 * surfaces named the learner by taking the FIRST participant of the obligation's event, while
 * the evidence row was written against `foundry_participant_followups.user_id_snapshot`. On a
 * single-participant event the two coincide, which is exactly why every pre-R4-R1 fixture — all
 * of them single-participant — passed while production held obligation `4dc5f309`, displayed as
 * "한빛" and belonging to "테스트".
 *
 * So the central fixture here is deliberately MULTI-PARTICIPANT, with the target learner placed
 * second on purpose. Against the pre-R4-R1 implementation the first assertion below returns
 * "Wrong Person"; that failure is the point of the file.
 */
const authority = vi.fn();
vi.mock("@/lib/bty/arena/actionReviewAuthorityResolver.server", () => ({
  resolveEdgeAuthority: (...a: unknown[]) => authority(...a),
}));

import { getObservationRequest, submitObservation } from "./foundryObservationService";
import { listMyObservationOpportunities } from "./observationOpportunityService";

type Row = Record<string, unknown>;
type Tables = Record<string, Row[]>;

/** The same in-memory double the observation suites use: `eq` filters, `in`/`limit` do not. */
function makeAdmin(tables: Tables) {
  const inserted: Row[] = [];
  const admin = {
    from(table: string) {
      const b: Record<string, unknown> = { _rows: (tables[table] ?? []).slice() };
      b.select = () => b;
      b.eq = function (this: { _rows: Row[] }, c: string, v: unknown) {
        this._rows = this._rows.filter((r) => r[c] === v);
        return b;
      };
      for (const m of ["in", "not", "order", "limit", "is"]) b[m] = () => b;
      b.maybeSingle = async function (this: { _rows: Row[] }) {
        return { data: this._rows[0] ?? null };
      };
      b.insert = async (row: Row) => {
        inserted.push({ ...row, __table: table });
        (tables[table] = tables[table] ?? []).push(row);
        return { data: null, error: null };
      };
      (b as { then: unknown }).then = function (this: { _rows: Row[] }, res: (v: { data: Row[] }) => unknown) {
        return Promise.resolve({ data: this._rows }).then(res);
      };
      return b;
    },
  } as unknown as SupabaseClient;
  return { admin, inserted };
}

const FOLLOWUP = "fu-1";
const REVIEWER = "user-reviewer";
const LEARNER = "learner-user-2";
const STANDARD = "The outgoing person states each open item aloud and the incoming person repeats it back.";
const NOW = new Date("2026-08-20T12:00:00Z");

const CORRECT = "Correct Learner";
const WRONG = "Wrong Person";

const el = (kind: string, content: string, status = "grounded") => ({
  id: `el_${kind}`, kind, content, confirmationStatus: status,
  grounding: [{ sourceType: "host_statement", field: "problem" }],
});

/**
 * ONE EVENT, TWO PARTICIPANTS, AND THE TARGET IS NOT THE FIRST.
 *
 * `p-1` is listed first and belongs to somebody else entirely. The obligation's lineage
 * (progress `prog-2`) points at `p-2`. Any implementation that reaches the name through the
 * EVENT rather than through the OBLIGATION returns "Wrong Person" here.
 */
const seed = (over: Partial<Tables> = {}): Tables => ({
  bty_org_memberships: [
    { id: "m-rev", user_id: REVIEWER, organization_id: "org-1", status: "active" },
    { id: "m-learn", user_id: LEARNER, organization_id: "org-1", status: "active" },
  ],
  bty_org_action_review_authority: [
    {
      id: "edge-1", reviewer_membership_id: "m-rev", learner_membership_id: "m-learn",
      authority_key: "ACTION_REVIEWER", status: "active", revoked_at: null,
    },
  ],
  foundry_participant_followups: [
    { id: FOLLOWUP, event_id: "ev-1", progress_id: "prog-2", user_id_snapshot: LEARNER, follow_up_days: 7, timezone_snapshot: "UTC" },
  ],
  foundry_event_module: [{
    event_id: "ev-1",
    module_snapshot: { realityGroundedJourneyV1: { version: 1, displayTitle: "T", displayTitleStatus: "grounded",
      elements: [el("observable_standard", STANDARD)] } },
  }],
  foundry_event_training_progress: [
    { id: "prog-1", event_id: "ev-1", participant_id: "p-1", linked_user_id: "someone-else" },
    { id: "prog-2", event_id: "ev-1", participant_id: "p-2", linked_user_id: LEARNER },
  ],
  foundry_event_participants: [
    { id: "p-1", event_id: "ev-1", display_name: WRONG },
    { id: "p-2", event_id: "ev-1", display_name: CORRECT },
  ],
  foundry_behavior_observations: [],
  ...over,
});

beforeEach(() => {
  authority.mockReset();
  authority.mockResolvedValue({
    allowed: true, actorUserId: REVIEWER, authorityId: "edge-1",
    reviewerMembershipId: "m-rev", learnerMembershipId: "m-learn", organizationId: "org-1",
  });
});

describe("[R4-R1] multi-participant event — the observer is asked about the RIGHT person", () => {
  it("the observation page names the obligation's learner, NOT the event's first participant", async () => {
    const { admin } = makeAdmin(seed());
    const r = await getObservationRequest(admin, REVIEWER, FOLLOWUP, NOW);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    // THE REGRESSION. Pre-R4-R1 this returned "Wrong Person".
    expect(r.value.learnerDisplayName).toBe(CORRECT);
    expect(r.value.learnerDisplayName).not.toBe(WRONG);
  });

  it("the discovery card names the same person — the defect was never page-only", async () => {
    const { admin } = makeAdmin(seed());
    const items = await listMyObservationOpportunities(admin, REVIEWER);
    expect(items).toHaveLength(1);
    expect(items[0]!.learnerLabel).toBe(CORRECT);
    expect(items[0]!.learnerLabel).not.toBe(WRONG);
  });

  it("card label == page label == the obligation's learner, from ONE resolver", async () => {
    const card = (await listMyObservationOpportunities(makeAdmin(seed()).admin, REVIEWER))[0]!;
    const page = await getObservationRequest(makeAdmin(seed()).admin, REVIEWER, card.followupId, NOW);
    expect(page.ok).toBe(true);
    if (!page.ok) return;
    expect(card.learnerLabel).toBe(page.value.learnerDisplayName);
    expect(card.followupId).toBe(FOLLOWUP);
  });

  it("the stored subject is still the obligation's user_id_snapshot — naming changed, not authority", async () => {
    const { admin, inserted } = makeAdmin(seed());
    const r = await submitObservation(admin, REVIEWER, FOLLOWUP, "OBSERVED", "2026-08-19", NOW);
    expect(r).toMatchObject({ ok: true, created: true });
    expect(inserted).toHaveLength(1);
    expect(inserted[0]!.learner_user_id_snapshot).toBe(LEARNER);
    expect(inserted[0]!.observer_user_id).toBe(REVIEWER);
  });
});

/**
 * FAIL CLOSED, EVERY WAY THE CHAIN CAN BREAK.
 *
 * An observer who cannot be told who they are attesting about cannot give meaningful evidence,
 * so the request is refused outright rather than rendered with a blank, a guess, or an
 * "Unknown". Each case also proves the write path stays shut and nothing is stored.
 */
describe("[R4-R1] an unnameable subject yields no observation surface", () => {
  const BROKEN: Array<[string, Tables]> = [
    ["missing progress_id on the obligation", seed({
      foundry_participant_followups: [
        { id: FOLLOWUP, event_id: "ev-1", progress_id: null, user_id_snapshot: LEARNER, follow_up_days: 7, timezone_snapshot: "UTC" },
      ],
    })],
    ["missing training_progress row", seed({ foundry_event_training_progress: [] })],
    ["training_progress with no participant_id", seed({
      foundry_event_training_progress: [{ id: "prog-2", event_id: "ev-1", participant_id: null, linked_user_id: LEARNER }],
    })],
    ["missing participant record", seed({ foundry_event_participants: [{ id: "p-1", event_id: "ev-1", display_name: WRONG }] })],
    ["participant belongs to another event", seed({
      foundry_event_participants: [
        { id: "p-1", event_id: "ev-1", display_name: WRONG },
        { id: "p-2", event_id: "ev-OTHER", display_name: CORRECT },
      ],
    })],
    ["progress row belongs to another event", seed({
      foundry_event_training_progress: [{ id: "prog-2", event_id: "ev-OTHER", participant_id: "p-2", linked_user_id: LEARNER }],
    })],
    ["blank display_name names nobody", seed({
      foundry_event_participants: [
        { id: "p-1", event_id: "ev-1", display_name: WRONG },
        { id: "p-2", event_id: "ev-1", display_name: "   " },
      ],
    })],
    ["progress row is claimed by a DIFFERENT user than the obligation's subject", seed({
      foundry_event_training_progress: [{ id: "prog-2", event_id: "ev-1", participant_id: "p-2", linked_user_id: "somebody-else" }],
    })],
  ];

  for (const [label, tables] of BROKEN) {
    it(`refuses the request — ${label}`, async () => {
      const { admin } = makeAdmin(structuredClone(tables));
      const r = await getObservationRequest(admin, REVIEWER, FOLLOWUP, NOW);
      expect(r).toEqual({ ok: false, reason: "subject_identity_unresolved" });
    });

    it(`writes nothing — ${label}`, async () => {
      const { admin, inserted } = makeAdmin(structuredClone(tables));
      const r = await submitObservation(admin, REVIEWER, FOLLOWUP, "OBSERVED", "2026-08-19", NOW);
      expect(r).toEqual({ ok: false, reason: "subject_identity_unresolved" });
      expect(inserted, "no observation row may be created for an unnameable subject").toHaveLength(0);
    });

    it(`offers no discovery card — ${label}`, async () => {
      const { admin } = makeAdmin(structuredClone(tables));
      expect(await listMyObservationOpportunities(admin, REVIEWER)).toEqual([]);
    });
  }

  /*
    An UNCLAIMED completion is not a contradiction. `linked_user_id` is null on real production
    rows whose learner never claimed the completion, and treating that as identity drift would
    fail-close honest obligations over a gap that has nothing to do with who the person is.
  */
  it("tolerates an unclaimed progress row — null linked_user_id is not a contradiction", async () => {
    const t = seed({
      foundry_event_training_progress: [{ id: "prog-2", event_id: "ev-1", participant_id: "p-2", linked_user_id: null }],
    });
    const r = await getObservationRequest(makeAdmin(t).admin, REVIEWER, FOLLOWUP, NOW);
    expect(r.ok && r.value.learnerDisplayName).toBe(CORRECT);
  });
});

/**
 * The refusal must not become a disclosure, and must not become an authority.
 */
describe("[R4-R1] the new refusal changes nothing else", () => {
  it("an unauthorised caller is still refused BEFORE identity is even considered", async () => {
    authority.mockResolvedValue({ allowed: false, reason: "AUTHORITY_EDGE_MISSING" });
    // The chain here is perfectly resolvable; authority must still win, and say `not_authorized`.
    const r = await getObservationRequest(makeAdmin(seed()).admin, REVIEWER, FOLLOWUP, NOW);
    expect(r).toEqual({ ok: false, reason: "not_authorized" });
  });

  it("a missing obligation is still not_found, never the identity refusal", async () => {
    const r = await getObservationRequest(makeAdmin(seed({ foundry_participant_followups: [] })).admin, REVIEWER, FOLLOWUP, NOW);
    expect(r).toEqual({ ok: false, reason: "not_found" });
  });

  it("no observable standard still outranks identity — the earlier refusal is unchanged", async () => {
    const t = seed({ foundry_event_module: [], foundry_event_training_progress: [] });
    const r = await getObservationRequest(makeAdmin(t).admin, REVIEWER, FOLLOWUP, NOW);
    expect(r).toEqual({ ok: false, reason: "no_observable_standard" });
  });

  it("the observer payload still carries no private learner writing", async () => {
    const t = seed();
    t.foundry_event_training_progress = [
      { id: "prog-1", event_id: "ev-1", participant_id: "p-1", linked_user_id: "someone-else" },
      {
        id: "prog-2", event_id: "ev-1", participant_id: "p-2", linked_user_id: LEARNER,
        response_text: "PRIVATE REFLECTION", decision_response_text: "MY DECISION",
        learner_reflection_text: "MY REFLECTION", shared_understanding_response: "SHARED ANSWER",
      },
    ];
    const r = await getObservationRequest(makeAdmin(t).admin, REVIEWER, FOLLOWUP, NOW);
    expect(r.ok).toBe(true);
    const payload = JSON.stringify(r);
    for (const secret of ["PRIVATE REFLECTION", "MY DECISION", "MY REFLECTION", "SHARED ANSWER", "someone-else"]) {
      expect(payload, secret).not.toContain(secret);
    }
  });

  it("APPLIED is still NOT a prerequisite — an unanswered obligation is fully observable", async () => {
    // outcome null / status PENDING, exactly like the two production-reachable opportunities.
    const t = seed();
    (t.foundry_participant_followups[0] as Row).outcome = null;
    (t.foundry_participant_followups[0] as Row).status = "PENDING";
    const r = await getObservationRequest(makeAdmin(t).admin, REVIEWER, FOLLOWUP, NOW);
    expect(r.ok && r.value.learnerDisplayName).toBe(CORRECT);
    const { admin, inserted } = makeAdmin(t);
    expect(await submitObservation(admin, REVIEWER, FOLLOWUP, "OBSERVED", "2026-08-19", NOW))
      .toMatchObject({ ok: true, created: true });
    expect(inserted).toHaveLength(1);
  });
});
