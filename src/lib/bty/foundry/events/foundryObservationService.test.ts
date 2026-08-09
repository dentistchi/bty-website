import { describe, it, expect, vi, beforeEach } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * SLICE 3.2M-4 — who may attest, to what, and what it establishes.
 * SLICE 3.2M-5 — WHEN they saw it, and whether the same person saying it twice can be stored.
 *
 * The authority is the existing explicit non-self reviewer edge. These tests drive the service
 * with that resolver mocked at its boundary, so the questions under test are the ones these
 * slices own: is the subject the frozen standard, is the learner resolved from the obligation,
 * is a repeat a double tap, and does anything but a positive observation establish the rung.
 */
const authority = vi.fn();
vi.mock("@/lib/bty/arena/actionReviewAuthorityResolver.server", () => ({
  resolveEdgeAuthority: (...a: unknown[]) => authority(...a),
}));

import {
  getObservationRequest,
  getSustainedEvidence,
  hasIndependentObservation,
  listObservations,
  submitObservation,
} from "./foundryObservationService";

type Row = Record<string, unknown>;
type Tables = Record<string, Row[]>;

function makeAdmin(tables: Tables, insertError: { code?: string } | null = null) {
  const inserted: Row[] = [];
  // Deterministic, monotonic stand-in for the column's `now()` default: seeded rows are stamped
  // at T00:00 and every insert lands strictly after them, so tie-breaking by submission order is
  // reproducible instead of depending on the machine clock.
  let clock = 0;
  const admin = {
    from(table: string) {
      const b: Record<string, unknown> = { _rows: (tables[table] ?? []).slice() };
      b.select = () => b;
      b.eq = function (this: { _rows: Row[] }, c: string, v: unknown) {
        this._rows = this._rows.filter((r) => r[c] === v);
        return b;
      };
      for (const m of ["in", "not", "order", "limit"]) b[m] = () => b;
      b.maybeSingle = async function (this: { _rows: Row[] }) {
        return { data: this._rows[0] ?? null };
      };
      b.insert = async (row: Row) => {
        // The database, not the service, is the last line against a duplicate episode: the
        // injected error stands in for the unique index catching a concurrent identical insert.
        if (insertError) return { data: null, error: insertError };
        inserted.push(row);
        clock += 1;
        // `submitted_at` is NOT NULL with a `now()` default; the double stamps it the same way.
        (tables[table] = tables[table] ?? []).push({
          submitted_at: new Date(Date.UTC(2026, 7, 20, 12, 0, clock)).toISOString(),
          ...row,
        });
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
const LEARNER = "user-learner";
const OBSERVER = "user-observer";
const STANDARD = "The outgoing person states each open item aloud and the incoming person repeats it back.";

/** A fixed "now" so every date assertion is deterministic. 12:00Z is past the 05:00 boundary. */
const NOW = new Date("2026-08-20T12:00:00Z");
const TODAY = "2026-08-20";

const el = (kind: string, content: string, status = "grounded") => ({
  id: `el_${kind}`, kind, content, confirmationStatus: status,
  grounding: [{ sourceType: "host_statement", field: "problem" }],
});

const seed = (over: Partial<Tables> = {}): Tables => ({
  foundry_participant_followups: [
    { id: FOLLOWUP, event_id: "ev-1", user_id_snapshot: LEARNER, follow_up_days: 7, timezone_snapshot: "UTC" },
  ],
  foundry_event_module: [{
    event_id: "ev-1",
    module_snapshot: { realityGroundedJourneyV1: { version: 1, displayTitle: "T", displayTitleStatus: "grounded",
      elements: [el("observable_standard", STANDARD), el("field_application", "At your next handover, state the open items.")] } },
  }],
  foundry_event_participants: [{ id: "p-1", event_id: "ev-1", display_name: "Hanbit" }],
  foundry_behavior_observations: [],
  ...over,
});

/** A stored observation row, as the table actually holds one after Slice 3.2M-5. */
const row = (outcome: string, observedOn: string, observer = OBSERVER, standard = STANDARD) => ({
  followup_id: FOLLOWUP,
  observer_user_id: observer,
  outcome,
  observed_on: observedOn,
  observed_standard_snapshot: standard,
  submitted_at: `${observedOn}T00:00:00Z`,
  observation_timezone_snapshot: "UTC",
});

const ALLOW = { allowed: true, actorUserId: OBSERVER, authorityId: "edge-1", reviewerMembershipId: "m-r", learnerMembershipId: "m-l", organizationId: "org-1" };

beforeEach(() => {
  authority.mockReset();
  authority.mockResolvedValue(ALLOW);
});

describe("[3.2M-4] who may observe", () => {
  it("an authorised distinct observer gets the request", async () => {
    const { admin } = makeAdmin(seed());
    const r = await getObservationRequest(admin, OBSERVER, FOLLOWUP, NOW);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.observableStandard).toBe(STANDARD);
  });

  it("the learner is resolved from the OBLIGATION, never from the caller", async () => {
    const { admin } = makeAdmin(seed());
    await getObservationRequest(admin, OBSERVER, FOLLOWUP, NOW);
    expect(authority).toHaveBeenCalledWith(expect.anything(), { actorUserId: OBSERVER, learnerUserId: LEARNER });
  });

  it("no authority → refused, and indistinguishable from a missing request", async () => {
    authority.mockResolvedValue({ allowed: false, reason: "AUTHORITY_EDGE_MISSING" });
    const { admin } = makeAdmin(seed());
    expect(await getObservationRequest(admin, "stranger", FOLLOWUP, NOW)).toEqual({ ok: false, reason: "not_authorized" });
  });

  it("self-observation is refused by the same authority — the learner is not their own witness", async () => {
    authority.mockResolvedValue({ allowed: false, reason: "SELF_REVIEW_FORBIDDEN" });
    const { admin, inserted } = makeAdmin(seed());
    expect(await submitObservation(admin, LEARNER, FOLLOWUP, "OBSERVED", TODAY, NOW)).toEqual({ ok: false, reason: "not_authorized" });
    expect(inserted, "nothing is written for a refused attestation").toHaveLength(0);
  });

  it("an unknown obligation is not found", async () => {
    const { admin } = makeAdmin(seed());
    expect(await getObservationRequest(admin, OBSERVER, "nope", NOW)).toEqual({ ok: false, reason: "not_found" });
  });
});

describe("[3.2M-4] the subject is the frozen standard, with NO fallback", () => {
  it("a training without a grounded observable_standard offers no observation at all", async () => {
    const t = seed({
      foundry_event_module: [{ event_id: "ev-1", module_snapshot: { realityGroundedJourneyV1: { version: 1, displayTitle: "T", displayTitleStatus: "grounded",
        elements: [el("field_application", "At your next handover, state the open items."), el("completion_check", "What will you say?")] } } }],
    });
    const { admin, inserted } = makeAdmin(t);
    expect(await getObservationRequest(admin, OBSERVER, FOLLOWUP, NOW)).toEqual({ ok: false, reason: "no_observable_standard" });
    expect(await submitObservation(admin, OBSERVER, FOLLOWUP, "OBSERVED", TODAY, NOW)).toEqual({ ok: false, reason: "no_observable_standard" });
    expect(inserted, "never invent a standard from the field application").toHaveLength(0);
  });

  it("an UNCONFIRMED standard is not a standard", async () => {
    const t = seed({
      foundry_event_module: [{ event_id: "ev-1", module_snapshot: { realityGroundedJourneyV1: { version: 1, displayTitle: "T", displayTitleStatus: "grounded",
        elements: [el("observable_standard", STANDARD, "needs_confirmation")] } } }],
    });
    const { admin } = makeAdmin(t);
    expect(await getObservationRequest(admin, OBSERVER, FOLLOWUP, NOW)).toEqual({ ok: false, reason: "no_observable_standard" });
  });

  it("a legacy training with no module snapshot offers nothing", async () => {
    const { admin } = makeAdmin(seed({ foundry_event_module: [] }));
    expect(await getObservationRequest(admin, OBSERVER, FOLLOWUP, NOW)).toEqual({ ok: false, reason: "no_observable_standard" });
  });
});

describe("[3.2M-4] recording an observation", () => {
  it("a positive observation is stored with the observer, the learner and the exact standard", async () => {
    const { admin, inserted } = makeAdmin(seed());
    expect(await submitObservation(admin, OBSERVER, FOLLOWUP, "OBSERVED", TODAY, NOW))
      .toEqual({ ok: true, outcome: "OBSERVED", observedOn: TODAY, created: true });
    expect(inserted[0]).toMatchObject({
      followup_id: FOLLOWUP, observer_user_id: OBSERVER, learner_user_id_snapshot: LEARNER,
      authority_edge_id: "edge-1", organization_id_snapshot: "org-1",
      observed_standard_snapshot: STANDARD, outcome: "OBSERVED",
    });
  });

  it("rejects anything outside the vocabulary before touching authority", async () => {
    const { admin, inserted } = makeAdmin(seed());
    for (const bad of ["YES", "APPLIED", "", null, 1]) {
      expect(await submitObservation(admin, OBSERVER, FOLLOWUP, bad, TODAY, NOW)).toEqual({ ok: false, reason: "invalid_outcome" });
    }
    expect(inserted).toHaveLength(0);
  });

  it("a CHANGED answer on the SAME date appends — both facts survive", async () => {
    const t = seed({ foundry_behavior_observations: [row("NOT_OBSERVED", TODAY)] });
    const { admin, inserted } = makeAdmin(t);
    expect(await submitObservation(admin, OBSERVER, FOLLOWUP, "OBSERVED", TODAY, NOW))
      .toEqual({ ok: true, outcome: "OBSERVED", observedOn: TODAY, created: true });
    expect(inserted).toHaveLength(1);
    const all = await listObservations(admin, FOLLOWUP);
    expect(all.map((o) => o.outcome), "the earlier report is not erased").toEqual(["NOT_OBSERVED", "OBSERVED"]);
  });
});

describe("[3.2M-5] the occurrence date, and the idempotency boundary that depends on it", () => {
  it("the SAME answer on the SAME date is a double tap — nothing written", async () => {
    const t = seed({ foundry_behavior_observations: [row("OBSERVED", "2026-08-10")] });
    const { admin, inserted } = makeAdmin(t);
    expect(await submitObservation(admin, OBSERVER, FOLLOWUP, "OBSERVED", "2026-08-10", NOW))
      .toEqual({ ok: true, outcome: "OBSERVED", observedOn: "2026-08-10", created: false });
    expect(inserted).toHaveLength(0);
  });

  /** The 3.2M-4 defect this slice exists to fix: consistency was the one thing that could not be stored. */
  it("the SAME answer on a LATER date is a second sighting — appended", async () => {
    const t = seed({ foundry_behavior_observations: [row("OBSERVED", "2026-08-10")] });
    const { admin, inserted } = makeAdmin(t);
    expect(await submitObservation(admin, OBSERVER, FOLLOWUP, "OBSERVED", "2026-08-17", NOW))
      .toEqual({ ok: true, outcome: "OBSERVED", observedOn: "2026-08-17", created: true });
    expect(inserted).toHaveLength(1);
    expect(inserted[0]).toMatchObject({ observed_on: "2026-08-17", observation_timezone_snapshot: "UTC" });
  });

  it("the same answer on a date reported OUT OF ORDER is still a distinct episode", async () => {
    // They told us about last week today, and about the week before that tomorrow. Two events.
    const t = seed({ foundry_behavior_observations: [row("OBSERVED", "2026-08-17")] });
    const { admin, inserted } = makeAdmin(t);
    expect(await submitObservation(admin, OBSERVER, FOLLOWUP, "OBSERVED", "2026-08-10", NOW))
      .toEqual({ ok: true, outcome: "OBSERVED", observedOn: "2026-08-10", created: true });
    expect(inserted).toHaveLength(1);
  });

  it("a concurrent identical episode caught by the unique index reports the double-tap answer", async () => {
    // Two devices, one act: the read saw nothing, the write lost. Not a second sighting.
    const { admin, inserted } = makeAdmin(seed(), { code: "23505" });
    expect(await submitObservation(admin, OBSERVER, FOLLOWUP, "OBSERVED", TODAY, NOW))
      .toEqual({ ok: true, outcome: "OBSERVED", observedOn: TODAY, created: false });
    expect(inserted).toHaveLength(0);
  });

  it("a real write failure says so — never a silent success", async () => {
    const { admin } = makeAdmin(seed(), { code: "08006" });
    expect(await submitObservation(admin, OBSERVER, FOLLOWUP, "OBSERVED", TODAY, NOW)).toEqual({ ok: false, reason: "error" });
  });

  it("nobody observes the future", async () => {
    const { admin, inserted } = makeAdmin(seed());
    expect(await submitObservation(admin, OBSERVER, FOLLOWUP, "OBSERVED", "2026-08-21", NOW)).toEqual({ ok: false, reason: "future_date" });
    // Today itself is fine — the boundary is inclusive.
    expect((await submitObservation(admin, OBSERVER, FOLLOWUP, "OBSERVED", TODAY, NOW)).ok).toBe(true);
    expect(inserted).toHaveLength(1);
  });

  it("an older occurrence is NOT refused for being reported late", async () => {
    // No lower bound exists, and inventing one would discard a truthful memory.
    const { admin } = makeAdmin(seed());
    expect((await submitObservation(admin, OBSERVER, FOLLOWUP, "OBSERVED", "2026-05-02", NOW)).ok).toBe(true);
  });

  it("a malformed or impossible date is refused before authority is consulted", async () => {
    const { admin, inserted } = makeAdmin(seed());
    for (const bad of ["", "20-08-2026", "2026-8-1", "2026-02-31", "yesterday", null, 20260810]) {
      expect(await submitObservation(admin, OBSERVER, FOLLOWUP, "OBSERVED", bad, NOW), String(bad))
        .toEqual({ ok: false, reason: "invalid_date" });
    }
    expect(inserted).toHaveLength(0);
  });

  it("today is decided by the OBLIGATION's timezone, never the client's", async () => {
    /*
      20:00Z is 08:00 on the 21st in Auckland — past the 05:00 BTY boundary, so that obligation's
      today is the 21st, while a UTC-resolved obligation is still on the 20th at the same instant.
      Same moment, two canonical answers, and the one that applies is the one stored on the
      obligation. Nothing the caller sends participates.
    */
    const late = new Date("2026-08-20T20:00:00Z");
    const t = seed({
      foundry_participant_followups: [
        { id: FOLLOWUP, event_id: "ev-1", user_id_snapshot: LEARNER, follow_up_days: 7, timezone_snapshot: "Pacific/Auckland" },
      ],
    });
    const { admin } = makeAdmin(t);
    const r = await getObservationRequest(admin, OBSERVER, FOLLOWUP, late);
    expect(r.ok && r.value.maxObservedOn).toBe("2026-08-21");

    const { admin: utcAdmin } = makeAdmin(seed());
    const u = await getObservationRequest(utcAdmin, OBSERVER, FOLLOWUP, late);
    expect(u.ok && u.value.maxObservedOn).toBe(TODAY);

    // And the boundary is enforced on write, in that same frame.
    const { admin: utcWrite } = makeAdmin(seed());
    expect(await submitObservation(utcWrite, OBSERVER, FOLLOWUP, "OBSERVED", "2026-08-21", late))
      .toEqual({ ok: false, reason: "future_date" });
  });

  it("a missing or invalid stored timezone falls back to UTC rather than failing", async () => {
    const t = seed({
      foundry_participant_followups: [
        { id: FOLLOWUP, event_id: "ev-1", user_id_snapshot: LEARNER, follow_up_days: 7, timezone_snapshot: "Mars/Olympus" },
      ],
    });
    const { admin } = makeAdmin(t);
    const r = await getObservationRequest(admin, OBSERVER, FOLLOWUP, NOW);
    expect(r.ok && r.value.maxObservedOn).toBe(TODAY);
  });

  it("the request is never terminal — a reviewer who already answered can still answer again", async () => {
    const t = seed({ foundry_behavior_observations: [row("OBSERVED", "2026-08-10")] });
    const { admin } = makeAdmin(t);
    const r = await getObservationRequest(admin, OBSERVER, FOLLOWUP, NOW);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.myObservations).toEqual([{ outcome: "OBSERVED", observedOn: "2026-08-10", submittedAt: "2026-08-10T00:00:00Z" }]);
  });
});

describe("[3.2M-4] what establishes the rung", () => {
  const withRows = (rows: Row[]) => makeAdmin(seed({ foundry_behavior_observations: rows }));

  it("no observation establishes nothing", async () => {
    const { admin } = withRows([]);
    expect(await hasIndependentObservation(admin, FOLLOWUP)).toBe(false);
  });

  it("only a positive observation establishes it", async () => {
    const { admin } = withRows([row("NOT_OBSERVED", "2026-08-01"), row("UNABLE_TO_TELL", "2026-08-02", "user-o2")]);
    expect(await hasIndependentObservation(admin, FOLLOWUP)).toBe(false);
  });

  it("a later negative does not erase an earlier positive", async () => {
    const { admin } = withRows([row("OBSERVED", "2026-08-01"), row("NOT_OBSERVED", "2026-08-02", "user-o2")]);
    expect(await hasIndependentObservation(admin, FOLLOWUP)).toBe(true);
    expect((await listObservations(admin, FOLLOWUP)).map((o) => o.outcome)).toEqual(["OBSERVED", "NOT_OBSERVED"]);
  });

  it("another obligation's observations never count for this one", async () => {
    const { admin } = withRows([{ ...row("OBSERVED", "2026-08-01"), followup_id: "other" }]);
    expect(await hasIndependentObservation(admin, FOLLOWUP)).toBe(false);
  });
});

describe("[3.2M-5] SUSTAINED, assembled from the obligation's own identity", () => {
  const withRows = (rows: Row[], over: Partial<Tables> = {}) =>
    makeAdmin(seed({ foundry_behavior_observations: rows, ...over }));

  it("two positives a full follow-up window apart are sustained", async () => {
    const { admin } = withRows([row("OBSERVED", "2026-08-01"), row("OBSERVED", "2026-08-08")]);
    const s = await getSustainedEvidence(admin, FOLLOWUP);
    expect(s.sustained).toBe(true);
    expect([s.firstObservedOn, s.lastObservedOn]).toEqual(["2026-08-01", "2026-08-08"]);
    expect(s.spanDays).toBe(7);
  });

  it("a day short of the window is not sustained", async () => {
    const { admin } = withRows([row("OBSERVED", "2026-08-01"), row("OBSERVED", "2026-08-07")]);
    const s = await getSustainedEvidence(admin, FOLLOWUP);
    expect(s.sustained).toBe(false);
    expect(s.spanDays).toBe(6);
  });

  it("an attestation against a DIFFERENT standard snapshot is discarded, not counted", async () => {
    // The stored sentence is the one the observer read. If it is not this training's sentence,
    // it is evidence about some other behaviour.
    const { admin } = withRows([
      row("OBSERVED", "2026-08-01"),
      row("OBSERVED", "2026-08-08", OBSERVER, "Some other standard entirely."),
    ]);
    const s = await getSustainedEvidence(admin, FOLLOWUP);
    expect(s.sustained).toBe(false);
    expect(s.outOfScope).toBe(1);
  });

  it("a training with no grounded standard has no sustained path", async () => {
    const { admin } = withRows([row("OBSERVED", "2026-08-01"), row("OBSERVED", "2026-08-08")], {
      foundry_event_module: [],
    });
    expect((await getSustainedEvidence(admin, FOLLOWUP)).sustained).toBe(false);
  });

  it("a 30-day training needs a 30-day span, not a 7-day one", async () => {
    const thirty = {
      foundry_participant_followups: [
        { id: FOLLOWUP, event_id: "ev-1", user_id_snapshot: LEARNER, follow_up_days: 30, timezone_snapshot: "UTC" },
      ],
    };
    const { admin: shortSpan } = withRows([row("OBSERVED", "2026-08-01"), row("OBSERVED", "2026-08-08")], thirty);
    expect((await getSustainedEvidence(shortSpan, FOLLOWUP)).sustained).toBe(false);
    const { admin: longSpan } = withRows([row("OBSERVED", "2026-08-01"), row("OBSERVED", "2026-08-31")], thirty);
    expect((await getSustainedEvidence(longSpan, FOLLOWUP)).sustained).toBe(true);
  });
});

describe("[3.2M-4] the observer sees only what they need", () => {
  it("no private learner evidence reaches the observer payload", async () => {
    const t = seed();
    // Private facts live on the progress row; the observer path never selects it.
    t.foundry_event_training_progress = [{
      id: "p-1", event_id: "ev-1", response_text: "PRIVATE REFLECTION",
      decision_response_text: "MY DECISION", shared_understanding_response: "SHARED ANSWER",
    }];
    const { admin } = makeAdmin(t);
    const r = await getObservationRequest(admin, OBSERVER, FOLLOWUP, NOW);
    expect(r.ok).toBe(true);
    const payload = JSON.stringify(r);
    for (const secret of ["PRIVATE REFLECTION", "MY DECISION", "SHARED ANSWER"]) {
      expect(payload, secret).not.toContain(secret);
    }
  });

  it("an observer sees their OWN prior reports and nobody else's", async () => {
    const t = seed({
      foundry_behavior_observations: [row("NOT_OBSERVED", "2026-08-01"), row("OBSERVED", "2026-08-02", "user-o2")],
    });
    const { admin } = makeAdmin(t);
    const r = await getObservationRequest(admin, OBSERVER, FOLLOWUP, NOW);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.myObservations.map((o) => o.outcome)).toEqual(["NOT_OBSERVED"]);
  });
});
