/**
 * RULE-KIND-SCOPED CANONICAL TRUTH STATES (Slice 3.2I-R5B1A.1-R2.56).
 *
 * THIS FILE REPLACES A CHARACTERIZATION.
 *
 * R2.54 recorded, without approving, that `classifyTruthState` returned `prohibited_action_present`
 * for `present / not_applicable / not_applicable` at the c18 PREREQUISITE boundary. R2.55 traced it:
 * the row was scoped to prohibition rules in two source comments and in no row data, and the guard
 * meant to catch it — a `ruleKind` tiebreak applied only when two rows matched — was unreachable in
 * every commit of the table's history, because no fact combination has ever matched two rows.
 *
 * The characterization's executable expectations are therefore GONE, not relaxed. What was
 * "CURRENT BEHAVIOR, semantic correctness not approved" is now a decided contract, and the tests
 * that merely proved the old tiebreak was unreachable are deleted rather than kept green — a test
 * asserting that a deleted mechanism stays broken measures nothing.
 *
 * The historical intent is preserved in comments, because the next reader needs to know that the
 * behaviour was measured, deferred, and then decided — not that it was never noticed.
 */

import { describe, it, expect } from "vitest";
import {
  GOVERNING_RULE_KINDS,
  PREREQUISITE_RULE_KINDS,
  PROHIBITION_RULE_KINDS,
  TRUTH_STATES,
  TRUTH_STATE_IDS,
  classifyTruthState,
  deriveMechanism,
  truthStateAmbiguities,
} from "./boundaryTruthStates";
import { RULE_KINDS, buildSemanticFrames } from "./boundarySemanticFrame";
import { GOVERNED_ACTION_STATUSES, PREREQUISITE_STATUSES, TEMPORAL_RELATIONS } from "./narrowBoundaryReview";
import { C18_BOUNDARY } from "./c18BoundaryFixture";
import { PROHIBITION_BOUNDARY, PROHIBITION_BREACH_FACTS, PROHIBITION_EXPECTED, PROHIBITION_FRAME } from "./prohibitionBoundaryFixture";

/** The triple the whole slice is about. Read from the fixture so the two files cannot drift. */
const FACTS = PROHIBITION_BREACH_FACTS;

const C18_FRAME = buildSemanticFrames([C18_BOUNDARY])[0]!;

describe("[R2.56][3] rule kind is a FILTER DIMENSION, and it is demonstrably live", () => {
  it("the two frames under test are genuinely different rule kinds", () => {
    // The premise. Both come from the real parser; neither is a hand-forged frame object.
    expect(C18_FRAME.ruleKind).toBe("prerequisite_before_action");
    expect(PROHIBITION_FRAME.ruleKind).toBe("prohibition");
  });

  it("A — a PREREQUISITE rule refuses the prohibition-only triple", () => {
    // R2.55 measured this returning `prohibited_action_present`, deriving applies/violates and an
    // `explicit_boundary_contradiction` against a rule that forbids nothing.
    expect(classifyTruthState(FACTS as never, C18_FRAME.ruleKind)).toBeNull();
  });

  it("B — a PROHIBITION rule still accepts the same three fact values", () => {
    const state = classifyTruthState(FACTS as never, PROHIBITION_FRAME.ruleKind);
    expect(state).not.toBeNull();
    expect(state!.id).toBe(PROHIBITION_EXPECTED.stateId);
    expect(state!.derivedApplicability).toBe(PROHIBITION_EXPECTED.derivedApplicability);
    expect(state!.derivedCompliance).toBe(PROHIBITION_EXPECTED.derivedCompliance);
    expect(state!.verdictEffect).toBe(PROHIBITION_EXPECTED.verdictEffect);
    expect(state!.reasonAuthority).toBe(PROHIBITION_EXPECTED.reasonAuthority);
    expect(deriveMechanism(state!, "resulting_world_state", false)).toBe("explicit_boundary_contradiction");
  });

  it("the SAME facts produce DIFFERENT results under two rule kinds — the guard is not dead", () => {
    /**
     * The assertion R2.55 could not make. Before this slice, rule kind changed the answer in 0 of 90
     * cells; a guard that never fires looks exactly like a guard that works.
     */
    const byKind = Object.fromEntries(GOVERNING_RULE_KINDS.map((rk) => [rk, classifyTruthState(FACTS as never, rk)?.id ?? null]));
    expect(new Set(Object.values(byKind)).size).toBeGreaterThan(1);
    expect(byKind.prerequisite_before_action).toBeNull();
    expect(byKind.prohibition).toBe("prohibited_action_present");
  });

  it("rule kind changes the answer across MANY cells, not only the one this slice fixed", () => {
    // A single divergent cell could be a special case. Measured over the whole space, the filter is
    // structural.
    let divergent = 0;
    for (const g of GOVERNED_ACTION_STATUSES) {
      for (const p of PREREQUISITE_STATUSES) {
        for (const t of TEMPORAL_RELATIONS) {
          const ids = GOVERNING_RULE_KINDS.map((rk) => classifyTruthState({ governedActionStatus: g, prerequisiteStatus: p, temporalRelation: t } as never, rk)?.id ?? null);
          if (new Set(ids).size > 1) divergent++;
        }
      }
    }
    expect(divergent).toBeGreaterThan(1);
  });

  it("an UNKNOWN or undecomposable rule kind matches nothing — fail closed", () => {
    // `uncertain` frames are already refused one layer up; the classifier agrees rather than
    // offering a state for a rule nobody parsed.
    expect(classifyTruthState(FACTS as never, "uncertain")).toBeNull();
    expect(classifyTruthState(FACTS as never, "not_a_rule_kind")).toBeNull();
  });
});

describe("[R2.56][3] the canonical table defines a FUNCTION over (ruleKind x facts)", () => {
  it("no cell resolves to more than one row", () => {
    // The invariant that replaces the tiebreak. `classifyTruthState` throws rather than picking
    // `matches[0]`, so this failing would be a table defect, not a classification to adjudicate.
    expect(truthStateAmbiguities(RULE_KINDS, GOVERNED_ACTION_STATUSES, PREREQUISITE_STATUSES, TEMPORAL_RELATIONS)).toEqual([]);
  });

  it("every row declares an explicit, non-empty, valid rule-kind scope", () => {
    expect(TRUTH_STATES).toHaveLength(TRUTH_STATE_IDS.length);
    for (const s of TRUTH_STATES) {
      expect(s.appliesToRuleKinds.length, s.id).toBeGreaterThan(0);
      for (const rk of s.appliesToRuleKinds) expect(RULE_KINDS, s.id).toContain(rk);
      // `uncertain` is never a scope: a rule nobody parsed has no canonical states.
      expect(s.appliesToRuleKinds, s.id).not.toContain("uncertain");
    }
  });

  it("the scope is what the source comments always claimed", () => {
    const scopeOf = (id: string) => TRUTH_STATES.find((s) => s.id === id)!.appliesToRuleKinds;
    expect(scopeOf("prohibited_action_present")).toEqual(PROHIBITION_RULE_KINDS);
    for (const id of [
      "governed_action_prerequisite_satisfied",
      "governed_action_prerequisite_missing",
      "governed_action_prerequisite_contradicted",
      "governed_action_prerequisite_not_established",
      "temporal_relation_uncertain",
      "prerequisite_truth_uncertain",
    ]) {
      expect(scopeOf(id), id).toEqual(PREREQUISITE_RULE_KINDS);
    }
    // Only these two ask about the governed action rather than the rule's structure.
    expect(scopeOf("non_governing")).toEqual(GOVERNING_RULE_KINDS);
    expect(scopeOf("governed_action_uncertain")).toEqual(GOVERNING_RULE_KINDS);
  });

  it("every row is reachable under at least one rule kind — no row is scoped into oblivion", () => {
    const reached = new Set<string>();
    for (const rk of GOVERNING_RULE_KINDS) {
      for (const g of GOVERNED_ACTION_STATUSES) {
        for (const p of PREREQUISITE_STATUSES) {
          for (const t of TEMPORAL_RELATIONS) {
            const s = classifyTruthState({ governedActionStatus: g, prerequisiteStatus: p, temporalRelation: t } as never, rk);
            if (s) reached.add(s.id);
          }
        }
      }
    }
    expect([...reached].sort()).toEqual([...TRUTH_STATE_IDS].sort());
  });
});

describe("[R2.56][3] the prerequisite states this slice must NOT disturb", () => {
  const under = (facts: Record<string, string>) => classifyTruthState(facts as never, C18_FRAME.ruleKind);

  it("C — not_established stays valid, inconclusive and model-required", () => {
    // The state the R2.53 arc turns on. Silence is still never a violation.
    const s = under({ governedActionStatus: "present", prerequisiteStatus: "not_established", temporalRelation: "not_applicable" })!;
    expect(s.id).toBe("governed_action_prerequisite_not_established");
    expect(s.derivedCompliance).toBe("uncertain");
    expect(s.verdictEffect).toBe("inconclusive");
    expect(s.reasonAuthority).toBe("model_required");
  });

  it("D — satisfied stays valid, complying and server-derived", () => {
    const s = under({ governedActionStatus: "present", prerequisiteStatus: "satisfied", temporalRelation: "prerequisite_before_action" })!;
    expect(s.id).toBe("governed_action_prerequisite_satisfied");
    expect(s.derivedCompliance).toBe("complies");
    expect(s.reasonAuthority).toBe("server_derived");
  });

  it("the measured live violation state is unchanged", () => {
    // 45 of the 232 captured live assessments carry exactly this triple.
    const s = under({ governedActionStatus: "present", prerequisiteStatus: "explicitly_missing", temporalRelation: "action_before_prerequisite" })!;
    expect(s.id).toBe("governed_action_prerequisite_missing");
    expect(s.derivedCompliance).toBe("violates");
    expect(deriveMechanism(s, "resulting_world_state", false)).toBe("resulting_state_missing_prerequisite");
  });

  it("the administrative state is unchanged under BOTH rule kinds", () => {
    // 125 of 232 captured live assessments. `non_governing` is rule-kind agnostic by design.
    for (const frame of [C18_FRAME, PROHIBITION_FRAME]) {
      const s = classifyTruthState({ governedActionStatus: "absent", prerequisiteStatus: "not_applicable", temporalRelation: "not_applicable" } as never, frame.ruleKind)!;
      expect(s.id, frame.ruleKind).toBe("non_governing");
      expect(s.derivedApplicability, frame.ruleKind).toBe("not_applicable");
      expect(s.derivedCompliance, frame.ruleKind).toBe("not_assessed");
    }
  });

  it("E — combinations outside the table stay null for every rule kind", () => {
    for (const rk of RULE_KINDS) {
      expect(classifyTruthState({ governedActionStatus: "absent", prerequisiteStatus: "satisfied", temporalRelation: "action_before_prerequisite" } as never, rk), rk).toBeNull();
    }
  });
});

describe("[R2.56][4] no layer classifies under one rule kind and concludes under another", () => {
  it("the prohibition boundary is not silently evaluated as a prerequisite rule", () => {
    // The failure mode the hard-coded literals would have produced: a prohibition row classified
    // under `prerequisite_before_action` collapses to null and loses its verdict entirely.
    expect(classifyTruthState(FACTS as never, "prerequisite_before_action")).toBeNull();
    expect(classifyTruthState(FACTS as never, PROHIBITION_FRAME.ruleKind)!.id).toBe("prohibited_action_present");
    expect(PROHIBITION_BOUNDARY.id).not.toBe(C18_BOUNDARY.id);
  });

  it("and the prerequisite boundary is not silently evaluated as a prohibition", () => {
    const prereqOnly = { governedActionStatus: "present", prerequisiteStatus: "explicitly_missing", temporalRelation: "action_before_prerequisite" };
    expect(classifyTruthState(prereqOnly as never, "prohibition")).toBeNull();
    expect(classifyTruthState(prereqOnly as never, C18_FRAME.ruleKind)!.id).toBe("governed_action_prerequisite_missing");
  });
});
