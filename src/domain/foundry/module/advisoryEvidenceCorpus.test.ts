import { describe, it, expect } from "vitest";
import {
  EVIDENCE_POLICY, EVIDENCE_SCOPE, assertsOverclaimByPolicy,
  evidencePolicyPromptLines, evidenceScopeLine, evidenceFamilyContrasts,
} from "./evidence-policy";
import { evidenceClaimBrief, semanticRepairInstruction, repairPatchContract, repairLicenseFor, PROGRAM_AUTHORSHIP_VERSION, PROGRAM_SCHEMA_NAME } from "./program-authorship";
import type { BuilderAnswers } from "./module-builder";

/**
 * SLICE 3.2P-A4-R2 — THE TITLE, THE ASSUMPTIONS AND THE WARNINGS ARE NOT EXCEPTIONS.
 *
 * Two live initial-authorship windows have now been refused on the advisory surface and nowhere
 * else — A1 (`6f93f7f4`, v15) and A4 (`8a7f2f6a`, v18), both `evidence_overclaim` / kind null /
 * path `program` — while no element has ever been refused for evidence. A4 also proved the
 * repair channel is mechanically sound: a 72-token narrative patch, `repair_freeze_violated`
 * false, merged and fully revalidated, refused again on the same surface.
 *
 * The validator sweeps assumptions, warnings and the title. The prompt never said so: every
 * rule declares `appliesTo` and only `promptLine` was ever rendered.
 *
 * THE PREDICATE HERE IS THE PRODUCTION ONE. A1-R1 measured this surface with
 * `claimsAboveCeiling`, which excludes `organisational_outcome` — the single most likely family
 * on an advisory field. Everything below runs `assertsOverclaimByPolicy`, which is what
 * `assertsOverclaim` calls and therefore what actually refuses a program.
 */

/** SAFE — a limitation, a missing condition, or an honest statement of what is unknown. */
const SAFE: [string, string][] = [
  ["Training alone cannot ensure consistency.", "limitation"],
  ["Training alone will not fix a staffing shortage.", "limitation"],
  ["A shared workflow may also be needed.", "condition"],
  ["Staffing coverage may need to be addressed separately.", "condition"],
  ["Access to the scheduling system is outside this training's control.", "condition"],
  ["This training does not establish whether the behavior was used in practice.", "unknown"],
  ["Nothing here shows what happens after the session.", "unknown"],
  ["Participants are able to attend the session.", "assumption-neutral"],
  ["There is time in the meeting to confirm each item.", "assumption-neutral"],
  ["Leaders have the authority to assign owners.", "assumption-neutral"],
  ["Naming an Owner for Every Agreed Action", "title-capability"],
  ["Closing the Loop on Reported Problems", "title-problem"],
  ["What to say when nobody volunteers", "title-problem"],
  ["This training does not replace a written escalation policy.", "warning-limitation"],
  ["Whether the standard is used at all is reviewed later, not here.", "warning-limitation"],
];

/** UNSAFE — one of the five families, on a field the validator sweeps. */
const UNSAFE: [string, string][] = [
  // OUTCOME
  ["A policy change will improve communication.", "outcome"],
  ["A shared workflow ensures accountability across shifts.", "outcome"],
  ["This leads to better outcomes for the team.", "outcome"],
  // HABIT
  ["The team now reliably follows the standard.", "habit"],
  ["This produces sustained change in how the team works.", "habit"],
  // READINESS
  ["Participants are ready to implement the standard.", "readiness"],
  ["Learners are equipped to handle this independently.", "readiness"],
  ["Participants now fully understand the standard.", "readiness"],
  // GUARANTEE
  ["This program guarantees every action has an owner.", "guarantee"],
  ["Completing the training guarantees consistent follow-up.", "guarantee"],
  // PROOF
  ["The follow-up confirms sustained adoption.", "proof"],
  ["This demonstrates improvement in how items are closed.", "proof"],
  // TITLES AND ASSUMPTIONS THAT CARRY A CLAIM
  ["Participants are equipped to apply the standard afterwards.", "assumption-readiness"],
  ["The team consistently performs the agreed follow-up.", "assumption-habit"],
];

/**
 * FOUND BY THIS CORPUS, DELIBERATELY NOT FIXED HERE.
 *
 * These four are over-claims by meaning and the validator does not refuse them. Each escapes
 * for a specific, boring lexical reason:
 *
 *   "create" is not in CAUSAL_VERB · "missed handoffs" is not in OUTCOME_OBJECTS ("being
 *   missed" is) · "assign" is not in PERFORMANCE_VERB · competence_claim matches "mastered"
 *   and "mastery", not "Mastering".
 *
 * A4-R2's authorized defect is the PROMPT, and §10 says the validator does not move in this
 * slice. Widening these patterns is a separate decision that needs its own false-positive
 * audit — "reduce" pointed at anything, or "assign" under a regularity adverb, is exactly the
 * kind of widening that starts refusing honest sentences. So the gap is asserted as a known
 * state, the way A3-R2 recorded the moment floor's recall gap, rather than quietly patched or
 * quietly dropped from the corpus.
 *
 * WORTH SAYING: the PROMPT does cover all four in words — the outcome-noun list, the
 * regularity line and the "mastered" line all speak to these — so the instruction the model
 * reads is broader than the regex that judges it. That is the safe direction for the two to
 * differ, and it is the whole argument for fixing this slice in the prompt.
 */
const KNOWN_UNCAUGHT: [string, string][] = [
  ["Manager reinforcement will create consistent follow-through.", "outcome — 'create' is not a causal verb in the policy"],
  ["This training will reduce missed handoffs.", "outcome — 'missed handoffs' is not in the outcome-noun set"],
  ["Participants will consistently assign an owner.", "habit — 'assign' is not a performance verb in the policy"],
  ["Mastering Accountability in Every Meeting", "readiness — the rule matches 'mastered'/'mastery', not 'Mastering'"],
];

describe("[3.2P-A4-R2] the advisory corpus, under the production predicate", () => {
  it("every honest limitation, condition and neutral assumption stays authorable", () => {
    const wrong = SAFE.filter(([t]) => assertsOverclaimByPolicy(t) !== null);
    for (const [t, kind] of wrong) console.log(`  FALSE POSITIVE (${kind}) ${assertsOverclaimByPolicy(t)!.id} ${JSON.stringify(t)}`);
    console.log(`SAFE ${SAFE.length - wrong.length}/${SAFE.length} allowed`);
    /*
      D — THE PROTECTED SPACE. A warning that cannot say what the training will not do is not a
      warning, and the negation guard is what keeps that space open. If widening the PROMPT ever
      tempts someone to widen the RULE, this fails first.
    */
    expect(wrong.map(([t]) => t), "honest limitation language must stay authorable").toEqual([]);
  });

  it("every over-claim is still refused, and the remedy→outcome shape with them", () => {
    const missed = UNSAFE.filter(([t]) => assertsOverclaimByPolicy(t) === null);
    for (const [t, kind] of missed) console.log(`  MISSED (${kind}) ${JSON.stringify(t)}`);
    console.log(`UNSAFE ${UNSAFE.length - missed.length}/${UNSAFE.length} refused`);
    expect(missed.map(([t]) => t)).toEqual([]);
  });

  it("and the four the validator does NOT catch stay recorded, not quietly dropped", () => {
    const caught = KNOWN_UNCAUGHT.filter(([t]) => assertsOverclaimByPolicy(t) !== null);
    for (const [t, why] of KNOWN_UNCAUGHT) console.log(`  UNCAUGHT ${JSON.stringify(t)} — ${why}`);
    /*
      If a later slice widens the policy, this fails — which is the point. It is a marker for a
      decision that has not been taken, not a permanent exemption. Do not delete it to make the
      suite green; move the sentence into UNSAFE.
    */
    expect(caught.map(([t]) => t), "the policy now catches one of these — move it to UNSAFE").toEqual([]);
  });

  it("F — the four named families are each represented in the refusals", () => {
    const byFamily = new Map<string, number>();
    for (const [t] of UNSAFE) {
      const r = assertsOverclaimByPolicy(t);
      if (r) byFamily.set(r.family, (byFamily.get(r.family) ?? 0) + 1);
    }
    for (const f of ["outcome", "habit", "readiness", "guarantee", "proof"]) {
      expect(byFamily.get(f) ?? 0, `family ${f} unexercised by the corpus`).toBeGreaterThan(0);
    }
  });
});

describe("[3.2P-A4-R2] one policy, three consumers — validator, brief, repair", () => {
  const ANSWERS = {
    problem: "During morning huddles, team members leave without naming who will act.",
    audienceType: "leaders", recurringMoment: "During morning huddles",
    observableBehavior: "Confirm the owner and the deadline.", successEvidence: "The huddle note records one owner.",
    learningNeeds: ["shared_standard", "practice"], materialIntent: "pdf", followUpDays: 7, arenaRecommended: true,
  } as unknown as BuilderAnswers;
  const BRIEF = evidenceClaimBrief(ANSWERS).join("\n");

  it("A/B — every validator-live family reaches the provider, through the policy itself", () => {
    // Membership is single-source: the brief renders EVERY rule's own line, not a summary.
    expect(evidencePolicyPromptLines()).toHaveLength(EVIDENCE_POLICY.length);
    for (const r of EVIDENCE_POLICY) expect(BRIEF, r.id).toContain(r.promptLine);
  });

  it("C — the scope is stated, and it is the scope the rules actually declare", () => {
    expect(BRIEF).toContain(EVIDENCE_SCOPE);
    expect(BRIEF).toContain(evidenceScopeLine());
    // The anti-drift device: no rule may carry a locally edited scope.
    for (const r of EVIDENCE_POLICY) expect(r.appliesTo, r.id).toBe(EVIDENCE_SCOPE);
  });

  it("the remedy-clause relation is taught, with illustrations the validator agrees with", () => {
    expect(BRIEF).toContain("LIMITATIONS ARE WELCOME; THE OUTCOME OF A REMEDY IS NOT");
    /*
      An illustration the validator disagrees with is worse than none: it teaches the model a
      rule the server does not hold. Every ALLOWED sentence in the brief must pass the
      production predicate and every REFUSED one must fail it — checked here, not asserted.
    */
    const quoted = (marker: string) =>
      (BRIEF.split("\n").find((l) => l.trim().startsWith(marker)) ?? "").match(/"([^"]+)"/g)?.map((s) => s.slice(1, -1)) ?? [];
    const allowed = quoted("ALLOWED, and wanted:");
    const refused = quoted("REFUSED, the same sentence");
    expect(allowed.length).toBeGreaterThanOrEqual(3);
    expect(refused.length).toBeGreaterThanOrEqual(2);
    for (const t of allowed) expect(assertsOverclaimByPolicy(t)?.id ?? null, `ALLOWED example is refused: ${t}`).toBeNull();
    for (const t of refused) expect(assertsOverclaimByPolicy(t), `REFUSED example is allowed: ${t}`).not.toBeNull();
  });

  it("five contrasts, one per family — the measured choice, not all eleven pairs", () => {
    const contrasts = evidenceFamilyContrasts();
    expect(contrasts).toHaveLength(new Set(EVIDENCE_POLICY.map((r) => r.family)).size);
    expect(contrasts).toHaveLength(5);
    for (const c of contrasts) {
      expect(BRIEF, c.family).toContain(c.forbidden);
      expect(BRIEF, c.family).toContain(c.legal);
      // Each pair must be exactly what it claims to be under the production predicate.
      expect(assertsOverclaimByPolicy(c.forbidden), `${c.family} forbidden sample is not refused`).not.toBeNull();
      expect(assertsOverclaimByPolicy(c.legal)?.id ?? null, `${c.family} legal rewrite is refused`).toBeNull();
    }
  });

  it("G/H — the narrative repair carries the same scope, and stays patch-only", () => {
    const t = semanticRepairInstruction("evidence_overclaim", ANSWERS);
    expect(t).toContain(evidenceScopeLine());
    expect(t).toContain("what is outside this training's control");
    expect(t).toContain("the response shape contains those fields and nothing else");
    for (const stale of ["Return the SAME program", "Do NOT add, remove, rename or reorder any element"]) {
      expect(t, `repair reintroduced whole-program wording: ${stale}`).not.toContain(stale);
    }
    expect(Object.keys(repairPatchContract(repairLicenseFor("evidence_overclaim", undefined))!.schema.properties as object))
      .toEqual(["display_title", "assumptions", "warnings"]);
  });

  it("I — the semantic contract moved; the wire and repair shapes did not", () => {
    expect(PROGRAM_AUTHORSHIP_VERSION).toBe("program_authorship_v19");
    expect(PROGRAM_SCHEMA_NAME).toBe("bty_guided_program_v11");
    expect(repairPatchContract(repairLicenseFor("scenario_without_pressure", "scenario"))!.name)
      .toBe("bty_guided_program_repair_scenario_pressure_v1");
    expect(repairPatchContract({ surface: "narrative" })!.name).toBe("bty_guided_program_repair_narrative_v1");
  });
});
