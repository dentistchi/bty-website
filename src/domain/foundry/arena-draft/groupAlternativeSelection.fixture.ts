/**
 * PLAN-DERIVED GROUP SELECTION — MOCK SIDE ONLY (Slice 3.2I-R5B1A.1-R2.54 Part 5).
 *
 * WHAT THIS IS FOR
 *
 * Something has to stand in for the model: the deterministic replay mock, and every test that needs
 * a patch the plan would accept. Before R2.54 that stand-in was a `PREFERRED` map — a hand-written
 * second copy of "what a valid prerequisite group looks like", living in the mock. R2.48 measured
 * what a second copy of a requirement costs: it had already drifted from the table it duplicated,
 * and nothing noticed.
 *
 * So this module holds no knowledge of its own. It is given a PLAN'S OWN dependency group, it picks
 * one of the canonical alternatives that plan generated, and it reads every value out of that
 * alternative: the fixed status, the head of its temporal domain, an id from its own per-role
 * domain, and a reason whose shape its `reasonConstraint` dictates. Regenerate the plan differently
 * and the available selections change with it, which is the property the map could not have.
 *
 * WHAT THIS IS NOT
 *
 * It is NOT part of the server. The server may validate a group and may never choose one — nothing
 * in `src/lib` or `src/app` imports this, and a repair value the server picked would be the server
 * answering its own question. It lives beside the captured fixtures for the same reason they do: it
 * is evidence-shaped input to a measurement, not a rule.
 *
 * Pure: no I/O, no provider, no clock.
 */

import { NO_CANDIDATE } from "./boundaryTruthContractTypes";
import { R252_CAPTURED_GROUP_SELECTION, R252_FROZEN_REASON } from "./r252LiveDtoFixture";
import type { FieldRepairTarget } from "./boundaryFieldRepair";

export type SelectedOperation = { surfaceRef: string; field: string; value: string };

/** R2.59 — the provider response shape: scalars for standalone targets, selections for groups. */
export type SelectedResponse = {
  repairs: SelectedOperation[];
  groupSelections: Array<{ groupId: string; alternativeId: string; reason: string }>;
};

/**
 * The alternative the canonical mock answers with, named by its STABLE SEMANTIC ID.
 *
 * `governed_action_prerequisite_satisfied` is the shape the R2.50 and R2.52 mock legs answered with,
 * and keeping it keeps the measured downstream semantics of those legs comparable across slices.
 */
export const MOCK_PREFERRED_STATE_ID = "governed_action_prerequisite_satisfied";

/** How the mock picks among the ids an alternative offers: by excerpt text, never a literal id. */
export const MOCK_SATISFACTION_EXCERPT = /verified identifiers for both/i;

/**
 * Build ONE group's operations from ONE canonical alternative the plan actually generated.
 *
 * Throws — loudly, naming the group and the state it wanted — when the plan offers no alternative at
 * all. Silently answering something else would turn a plan regression into a green test.
 */
export function selectCanonicalGroupOperations(
  targets: readonly FieldRepairTarget[],
  preferredStateId: string = MOCK_PREFERRED_STATE_ID,
): SelectedOperation[] {
  const first = targets[0];
  if (!first) return [];
  const alt = first.alternatives.find((a) => a.stateId === preferredStateId) ?? first.alternatives[0];
  if (!alt) {
    throw new Error(
      `plan-derived selection failed for group ${first.groupId} on ${first.surfaceRef}: ` +
        `the plan offered 0 canonical alternatives (wanted ${preferredStateId}). ` +
        `This selector reads its answer from the plan and will not invent one.`,
    );
  }

  const fromDomain = (domain: readonly string[], menu: Array<{ candidateId: string; excerpt: string }> | null): string => {
    const real = domain.filter((id) => id !== NO_CANDIDATE);
    if (real.length === 0) return NO_CANDIDATE;
    const preferred = (menu ?? []).find((c) => MOCK_SATISFACTION_EXCERPT.test(c.excerpt) && real.includes(c.candidateId));
    return preferred?.candidateId ?? real[0]!;
  };

  return targets.map((t) => {
    const value = ((): string => {
      switch (t.field) {
        case "prerequisiteStatus":
          return alt.prerequisiteStatus;
        case "temporalRelation":
          return alt.temporalDomain[0]!;
        case "prerequisiteSatisfactionCandidateId":
          return alt.satisfactionCandidateRequirement === "forbidden" ? NO_CANDIDATE : fromDomain(alt.satisfactionCandidateDomain, t.candidateMenu);
        case "prerequisiteFailureCandidateId":
          return alt.failureCandidateRequirement === "forbidden" ? NO_CANDIDATE : fromDomain(alt.failureCandidateDomain, t.candidateMenu);
        case "reason":
          /**
           * The ALTERNATIVE decides, not this module. A server-derived shape takes the canonical
           * empty string; a model-required one takes prose, because in that state the model's own
           * words are the only possible source. A stand-in for the model may author it. The SERVER
           * never does, and nothing in `src/lib` reaches this line.
           */
          return alt.reasonConstraint === "model_required" ? modelReasonFor(alt.stateId) : "";
        default:
          throw new Error(`plan-derived selection cannot answer grouped field ${t.field}: it is not part of the prerequisite alternative shape`);
      }
    })();
    return { surfaceRef: t.surfaceRef, field: t.field, value };
  });
}

/** Specific enough to clear the existing reason contract, short enough for the operation cap. */
export const modelReasonFor = (stateId: string): string =>
  `the surface text does not settle the ${stateId.replace(/_/g, " ")} condition before the governed action`.slice(0, 118);

/**
 * The R2.52 LIVE selection, replayed against the plan.
 *
 * The four captured values verbatim plus the frozen empty `reason`: the exact tuple that reached
 * merge in R2.52 and lost the run its verdict. Retained as a SCALAR group answer because that is
 * what the provider actually sent; under R2.59 that representation is itself refused, which is the
 * point of keeping it. Captured regression input, never constructed.
 */
export function capturedR252GroupOperations(targets: readonly FieldRepairTarget[]): SelectedOperation[] {
  const captured: Record<string, string> = { ...R252_CAPTURED_GROUP_SELECTION, reason: R252_FROZEN_REASON };
  return targets.map((t) => {
    const value = captured[t.field];
    if (value === undefined) {
      throw new Error(`the captured R2.52 selection has no value for grouped field ${t.field}; it will not be invented`);
    }
    return { surfaceRef: t.surfaceRef, field: t.field, value };
  });
}

/**
 * R2.59 — the whole RESPONSE, plan-derived.
 *
 * Standalone targets become scalar `repairs`; every multi-field group becomes ONE
 * `groupSelection` naming the alternative and carrying only the reason that alternative demands.
 * The four canonical scalars are deliberately absent: the server expands them.
 */
export function selectPlanDerivedResponse(
  targets: readonly FieldRepairTarget[],
  preferredStateId: string = MOCK_PREFERRED_STATE_ID,
): SelectedResponse {
  const byGroup = new Map<string, FieldRepairTarget[]>();
  for (const t of targets) byGroup.set(t.groupId, [...(byGroup.get(t.groupId) ?? []), t]);

  const repairs: SelectedOperation[] = [];
  const groupSelections: SelectedResponse["groupSelections"] = [];
  for (const group of byGroup.values()) {
    const first = group[0]!;
    if (first.valueAuthority === "canonical_group_alternative") {
      const alt = first.alternatives.find((a) => a.stateId === preferredStateId) ?? first.alternatives[0];
      if (!alt) {
        throw new Error(
          `plan-derived selection failed for group ${first.groupId} on ${first.surfaceRef}: ` +
            `the plan offered 0 canonical alternatives (wanted ${preferredStateId}). ` +
            `This selector reads its answer from the plan and will not invent one.`,
        );
      }
      groupSelections.push({
        groupId: first.groupId,
        alternativeId: alt.alternativeId,
        // The ALTERNATIVE decides, not this module — see `selectCanonicalGroupOperations`.
        reason: alt.reasonConstraint === "model_required" ? modelReasonFor(alt.stateId) : "",
      });
      continue;
    }
    for (const t of group) {
      if (t.field.endsWith("CandidateId")) {
        const menu = t.candidateMenu ?? [];
        const hit = menu.find((c) => MOCK_SATISFACTION_EXCERPT.test(c.excerpt)) ?? menu[0];
        repairs.push({ surfaceRef: t.surfaceRef, field: t.field, value: hit ? hit.candidateId : NO_CANDIDATE });
        continue;
      }
      const value = t.allowedValues[0];
      if (value === undefined) throw new Error(`plan-derived selection failed: standalone target ${t.surfaceRef}/${t.field} published no allowed values`);
      repairs.push({ surfaceRef: t.surfaceRef, field: t.field, value });
    }
  }
  const order = new Map(targets.map((t, i) => [`${t.surfaceRef} ${t.field}`, i]));
  repairs.sort((a, b) => (order.get(`${a.surfaceRef} ${a.field}`) ?? 0) - (order.get(`${b.surfaceRef} ${b.field}`) ?? 0));
  return { repairs, groupSelections };
}

/**
 * The whole patch as SCALAR operations only — the pre-R2.59 representation.
 *
 * Retained because the historical regressions need to send exactly what the old contract accepted
 * and prove it is now refused. Not the shape any live request asks for.
 */
export function selectPlanDerivedOperations(
  targets: readonly FieldRepairTarget[],
  groupSelector: (group: readonly FieldRepairTarget[]) => SelectedOperation[] = (g) => selectCanonicalGroupOperations(g),
): SelectedOperation[] {
  const byGroup = new Map<string, FieldRepairTarget[]>();
  for (const t of targets) byGroup.set(t.groupId, [...(byGroup.get(t.groupId) ?? []), t]);

  const out: SelectedOperation[] = [];
  for (const group of byGroup.values()) {
    const first = group[0]!;
    if (first.valueAuthority === "canonical_group_alternative") {
      out.push(...groupSelector(group));
      continue;
    }
    for (const t of group) {
      if (t.field.endsWith("CandidateId")) {
        const menu = t.candidateMenu ?? [];
        const hit = menu.find((c) => MOCK_SATISFACTION_EXCERPT.test(c.excerpt)) ?? menu[0];
        out.push({ surfaceRef: t.surfaceRef, field: t.field, value: hit ? hit.candidateId : NO_CANDIDATE });
        continue;
      }
      const value = t.allowedValues[0];
      if (value === undefined) throw new Error(`plan-derived selection failed: standalone target ${t.surfaceRef}/${t.field} published no allowed values`);
      out.push({ surfaceRef: t.surfaceRef, field: t.field, value });
    }
  }
  const order = new Map(targets.map((t, i) => [`${t.surfaceRef} ${t.field}`, i]));
  return out.sort((a, b) => (order.get(`${a.surfaceRef} ${a.field}`) ?? 0) - (order.get(`${b.surfaceRef} ${b.field}`) ?? 0));
}
