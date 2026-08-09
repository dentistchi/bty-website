import { describe, it, expect, vi, beforeEach } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * SLICE 3.2M-4 — who may attest, to what, and what it establishes.
 *
 * The authority is the existing explicit non-self reviewer edge. These tests drive the service
 * with that resolver mocked at its boundary, so the questions under test are the ones this
 * slice owns: is the subject the frozen standard, is the learner resolved from the obligation,
 * is a repeat a double tap, and does anything but a positive observation establish the rung.
 */
const authority = vi.fn();
vi.mock("@/lib/bty/arena/actionReviewAuthorityResolver.server", () => ({
  resolveEdgeAuthority: (...a: unknown[]) => authority(...a),
}));

import {
  getObservationRequest,
  hasIndependentObservation,
  listObservations,
  submitObservation,
} from "./foundryObservationService";

type Row = Record<string, unknown>;
type Tables = Record<string, Row[]>;

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
      for (const m of ["in", "not", "order", "limit"]) b[m] = () => b;
      b.maybeSingle = async function (this: { _rows: Row[] }) {
        return { data: this._rows[0] ?? null };
      };
      b.insert = async (row: Row) => {
        inserted.push(row);
        // The column is NOT NULL with a `now()` default; the double stamps it the same way.
        (tables[table] = tables[table] ?? []).push({ submitted_at: new Date().toISOString(), ...row });
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

const el = (kind: string, content: string, status = "grounded") => ({
  id: `el_${kind}`, kind, content, confirmationStatus: status,
  grounding: [{ sourceType: "host_statement", field: "problem" }],
});

const seed = (over: Partial<Tables> = {}): Tables => ({
  foundry_participant_followups: [{ id: FOLLOWUP, event_id: "ev-1", user_id_snapshot: LEARNER }],
  foundry_event_module: [{
    event_id: "ev-1",
    module_snapshot: { realityGroundedJourneyV1: { version: 1, displayTitle: "T", displayTitleStatus: "grounded",
      elements: [el("observable_standard", STANDARD), el("field_application", "At your next handover, state the open items.")] } },
  }],
  foundry_event_participants: [{ id: "p-1", event_id: "ev-1", display_name: "Hanbit" }],
  foundry_behavior_observations: [],
  ...over,
});

const ALLOW = { allowed: true, actorUserId: OBSERVER, authorityId: "edge-1", reviewerMembershipId: "m-r", learnerMembershipId: "m-l", organizationId: "org-1" };

beforeEach(() => {
  authority.mockReset();
  authority.mockResolvedValue(ALLOW);
});

describe("[3.2M-4] who may observe", () => {
  it("an authorised distinct observer gets the request", async () => {
    const { admin } = makeAdmin(seed());
    const r = await getObservationRequest(admin, OBSERVER, FOLLOWUP);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.observableStandard).toBe(STANDARD);
  });

  it("the learner is resolved from the OBLIGATION, never from the caller", async () => {
    const { admin } = makeAdmin(seed());
    await getObservationRequest(admin, OBSERVER, FOLLOWUP);
    expect(authority).toHaveBeenCalledWith(expect.anything(), { actorUserId: OBSERVER, learnerUserId: LEARNER });
  });

  it("no authority → refused, and indistinguishable from a missing request", async () => {
    authority.mockResolvedValue({ allowed: false, reason: "AUTHORITY_EDGE_MISSING" });
    const { admin } = makeAdmin(seed());
    expect(await getObservationRequest(admin, "stranger", FOLLOWUP)).toEqual({ ok: false, reason: "not_authorized" });
  });

  it("self-observation is refused by the same authority — the learner is not their own witness", async () => {
    authority.mockResolvedValue({ allowed: false, reason: "SELF_REVIEW_FORBIDDEN" });
    const { admin, inserted } = makeAdmin(seed());
    expect(await submitObservation(admin, LEARNER, FOLLOWUP, "OBSERVED")).toEqual({ ok: false, reason: "not_authorized" });
    expect(inserted, "nothing is written for a refused attestation").toHaveLength(0);
  });

  it("an unknown obligation is not found", async () => {
    const { admin } = makeAdmin(seed());
    expect(await getObservationRequest(admin, OBSERVER, "nope")).toEqual({ ok: false, reason: "not_found" });
  });
});

describe("[3.2M-4] the subject is the frozen standard, with NO fallback", () => {
  it("a training without a grounded observable_standard offers no observation at all", async () => {
    const t = seed({
      foundry_event_module: [{ event_id: "ev-1", module_snapshot: { realityGroundedJourneyV1: { version: 1, displayTitle: "T", displayTitleStatus: "grounded",
        elements: [el("field_application", "At your next handover, state the open items."), el("completion_check", "What will you say?")] } } }],
    });
    const { admin, inserted } = makeAdmin(t);
    expect(await getObservationRequest(admin, OBSERVER, FOLLOWUP)).toEqual({ ok: false, reason: "no_observable_standard" });
    expect(await submitObservation(admin, OBSERVER, FOLLOWUP, "OBSERVED")).toEqual({ ok: false, reason: "no_observable_standard" });
    expect(inserted, "never invent a standard from the field application").toHaveLength(0);
  });

  it("an UNCONFIRMED standard is not a standard", async () => {
    const t = seed({
      foundry_event_module: [{ event_id: "ev-1", module_snapshot: { realityGroundedJourneyV1: { version: 1, displayTitle: "T", displayTitleStatus: "grounded",
        elements: [el("observable_standard", STANDARD, "needs_confirmation")] } } }],
    });
    const { admin } = makeAdmin(t);
    expect(await getObservationRequest(admin, OBSERVER, FOLLOWUP)).toEqual({ ok: false, reason: "no_observable_standard" });
  });

  it("a legacy training with no module snapshot offers nothing", async () => {
    const { admin } = makeAdmin(seed({ foundry_event_module: [] }));
    expect(await getObservationRequest(admin, OBSERVER, FOLLOWUP)).toEqual({ ok: false, reason: "no_observable_standard" });
  });
});

describe("[3.2M-4] recording an observation", () => {
  it("a positive observation is stored with the observer, the learner and the exact standard", async () => {
    const { admin, inserted } = makeAdmin(seed());
    expect(await submitObservation(admin, OBSERVER, FOLLOWUP, "OBSERVED")).toEqual({ ok: true, outcome: "OBSERVED", created: true });
    expect(inserted[0]).toMatchObject({
      followup_id: FOLLOWUP, observer_user_id: OBSERVER, learner_user_id_snapshot: LEARNER,
      authority_edge_id: "edge-1", organization_id_snapshot: "org-1",
      observed_standard_snapshot: STANDARD, outcome: "OBSERVED",
    });
  });

  it("rejects anything outside the vocabulary before touching authority", async () => {
    const { admin, inserted } = makeAdmin(seed());
    for (const bad of ["YES", "APPLIED", "", null, 1]) {
      expect(await submitObservation(admin, OBSERVER, FOLLOWUP, bad)).toEqual({ ok: false, reason: "invalid_outcome" });
    }
    expect(inserted).toHaveLength(0);
  });

  it("the same answer again from the same observer is a double tap — nothing written", async () => {
    const t = seed({
      foundry_behavior_observations: [{ followup_id: FOLLOWUP, observer_user_id: OBSERVER, outcome: "OBSERVED", submitted_at: "2026-08-01T00:00:00Z" }],
    });
    const { admin, inserted } = makeAdmin(t);
    expect(await submitObservation(admin, OBSERVER, FOLLOWUP, "OBSERVED")).toEqual({ ok: true, outcome: "OBSERVED", created: false });
    expect(inserted).toHaveLength(0);
  });

  it("a CHANGED answer from the same observer appends — both facts survive", async () => {
    const t = seed({
      foundry_behavior_observations: [{ followup_id: FOLLOWUP, observer_user_id: OBSERVER, outcome: "NOT_OBSERVED", submitted_at: "2026-08-01T00:00:00Z" }],
    });
    const { admin, inserted } = makeAdmin(t);
    expect(await submitObservation(admin, OBSERVER, FOLLOWUP, "OBSERVED")).toEqual({ ok: true, outcome: "OBSERVED", created: true });
    expect(inserted).toHaveLength(1);
    const all = await listObservations(admin, FOLLOWUP);
    expect(all.map((o) => o.outcome), "the earlier report is not erased").toEqual(["NOT_OBSERVED", "OBSERVED"]);
  });
});

describe("[3.2M-4] what establishes the rung", () => {
  const withRows = (rows: Row[]) => makeAdmin(seed({ foundry_behavior_observations: rows }));
  const row = (outcome: string, observer = OBSERVER, day = 1) => ({
    followup_id: FOLLOWUP, observer_user_id: observer, outcome, submitted_at: `2026-08-0${day}T00:00:00Z`,
  });

  it("no observations → nothing", async () => {
    const { admin } = withRows([]);
    expect(await hasIndependentObservation(admin, FOLLOWUP)).toBe(false);
  });

  it("negative and uncertain reports → nothing", async () => {
    const { admin } = withRows([row("NOT_OBSERVED"), row("UNABLE_TO_TELL", "user-o2")]);
    expect(await hasIndependentObservation(admin, FOLLOWUP)).toBe(false);
  });

  it("one positive observation → OBSERVED", async () => {
    const { admin } = withRows([row("OBSERVED")]);
    expect(await hasIndependentObservation(admin, FOLLOWUP)).toBe(true);
  });

  it("disagreement is preserved: a later NOT_OBSERVED does not erase a true sighting", async () => {
    const { admin } = withRows([row("OBSERVED", OBSERVER, 1), row("NOT_OBSERVED", "user-o2", 2)]);
    expect(await hasIndependentObservation(admin, FOLLOWUP)).toBe(true);
    expect((await listObservations(admin, FOLLOWUP)).map((o) => o.outcome)).toEqual(["OBSERVED", "NOT_OBSERVED"]);
  });

  it("another obligation's observations never count for this one", async () => {
    const { admin } = withRows([{ followup_id: "other", observer_user_id: OBSERVER, outcome: "OBSERVED", submitted_at: "2026-08-01T00:00:00Z" }]);
    expect(await hasIndependentObservation(admin, FOLLOWUP)).toBe(false);
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
    const r = await getObservationRequest(admin, OBSERVER, FOLLOWUP);
    expect(r.ok).toBe(true);
    const payload = JSON.stringify(r);
    for (const secret of ["PRIVATE REFLECTION", "MY DECISION", "SHARED ANSWER"]) {
      expect(payload, secret).not.toContain(secret);
    }
  });

  it("an observer sees their OWN prior reports and nobody else's", async () => {
    const t = seed({
      foundry_behavior_observations: [
        { followup_id: FOLLOWUP, observer_user_id: OBSERVER, outcome: "NOT_OBSERVED", submitted_at: "2026-08-01T00:00:00Z" },
        { followup_id: FOLLOWUP, observer_user_id: "user-o2", outcome: "OBSERVED", submitted_at: "2026-08-02T00:00:00Z" },
      ],
    });
    const { admin } = makeAdmin(t);
    const r = await getObservationRequest(admin, OBSERVER, FOLLOWUP);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.myObservations.map((o) => o.outcome)).toEqual(["NOT_OBSERVED"]);
  });
});
