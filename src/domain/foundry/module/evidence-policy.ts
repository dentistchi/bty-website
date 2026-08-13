/**
 * EVIDENCE POLICY — ONE DEFINITION, TWO CONSUMERS (Slice 3.2L-R11.4I).
 *
 * Three consecutive paid windows were refused for `evidence_overclaim` against a prompt
 * that carried an evidence ceiling each time. R11.4H aligned the two by hand, and the very
 * next window failed the same way — because hand-alignment is exactly the thing that
 * cannot be verified. The validator held eighteen phrases plus two structures; the prompt
 * described some of them; nothing made the difference visible.
 *
 * So the rules live here once. `assertsOverclaimByPolicy` is what the validator runs, and
 * `evidencePolicyPromptLines` is what the model reads, and both are built from the SAME
 * array. A rule added without a `promptLine` cannot compile, and a rule whose line never
 * reaches the brief fails a test. The two lists cannot drift again because there is only
 * one list.
 *
 * Nothing here is relaxed relative to R11.4H — every regex is carried over verbatim; the
 * only change is that each one now has to say, in words a model can act on, what it wants.
 */

/**
 * How an assertion is distinguished from its denial or its question.
 *
 * `negation` — "this does NOT show behaviour changed" is the sentence the product wants,
 * and it contains every word the rule matches.
 * `prospective` — additionally, "review WHETHER the standard was used" is the shape a
 * follow-up is supposed to have. Only rules that can legitimately appear inside a question
 * carry it; a causal-outcome promise cannot, so it does not.
 *
 * `negation-either-side` — Slice 3.2P-A4-R3, and used by exactly one rule. Every other rule
 * matches a VERB, and the denial of a verb always precedes it: "does not ensure consistency".
 * A mastery claim matches a NOUN or a gerund, which is routinely the SUBJECT of its own denial
 * — "Mastery is not established by this training", "Mastering the scheduling software is not
 * required" — where the negator can only ever appear afterwards.
 *
 * It is scoped to that one rule ON PURPOSE. Applied to a causal rule it would exempt "This
 * ensures consistency, not confusion", turning an assertion into a pass; a guard that creates
 * false negatives is worse than the false positive it was meant to fix.
 */
export type EvidenceGuard = "negation" | "negation+prospective" | "negation-either-side";

/**
 * WHERE THE POLICY BITES (Slice 3.2P-A4-R2).
 *
 * Every rule already declared this same sentence in its own `appliesTo`, eleven times, and
 * NONE of it reached the model: `evidencePolicyPromptLines` renders `promptLine` alone. So the
 * validator swept the title, the assumptions and the warnings while the prompt's evidence
 * block never once named them and closed by asking for "participant-facing text" — which
 * assumptions and warnings are not.
 *
 * Two live initial-authorship windows were refused on exactly that surface, A1 (v15) and A4
 * (v18), both `evidence_overclaim` / kind null / path `program`, and no element has ever been
 * refused for it. A rule the model is never told the reach of is a rule it can obey and still
 * break.
 *
 * One constant, referenced by every rule and rendered into both prompts. It cannot describe a
 * scope the rules do not have, because they have no other source for theirs.
 */
export const EVIDENCE_SCOPE =
  "every participant-visible sentence, plus assumptions, warnings and the title";

/**
 * The distinct WAYS a program can claim more than it can show. Coarser than `id` on purpose:
 * eleven rules, five ways to be wrong. The prompt illustrates one contrast per family rather
 * than all eleven pairs — see `evidenceFamilyContrasts`.
 */
export type EvidenceFamily = "outcome" | "habit" | "proof" | "readiness" | "guarantee";

export type EvidenceRule = {
  /** Stable id — appears in the policy map and in the tests, never shown to a Host. */
  readonly id: string;
  /** What the rule means, for the audit map. */
  readonly meaning: string;
  /** Which of the five ways of over-claiming this rule is an instance of. */
  readonly family: EvidenceFamily;
  /** The participant-visible fields it protects. Always `EVIDENCE_SCOPE` — never a local edit. */
  readonly appliesTo: typeof EVIDENCE_SCOPE;
  /** What the model is told, in its own terms. Required — this is the anti-drift device. */
  readonly promptLine: string;
  /** One sample that must be refused, and the nearest honest rewrite. */
  readonly forbiddenSample: string;
  readonly legalRewrite: string;
  readonly guard: EvidenceGuard;
  readonly pattern: RegExp;
};

/**
 * `creat\w*` added in Slice 3.2P-A4-R3, and it is a VERB gap, not a shape gap — proven by
 * single-variable swap: "will create consistent follow-through" passed while "will improve
 * consistent follow-through" was refused, same sentence otherwise.
 *
 * It stays safe because the rule is a RELATION: a causal verb must be pointed at an
 * organisational outcome within the same clause. "Create a checklist", "participants create an
 * action note" and "create a shared handoff record" — the prompt's own allowed phrasing — name
 * artifacts, not outcomes, and are unaffected.
 */
const CAUSAL_VERB =
  "ensur\\w*|prevent\\w*|improv\\w*|increas\\w*|boost\\w*|driv\\w*|support\\w*|strengthen\\w*|eliminat\\w*|reduc\\w*|enhanc\\w*|creat\\w*|guarantee\\w*|maximi[sz]\\w*|minimi[sz]\\w*|optimi[sz]\\w*|foster\\w*|promot\\w*|achiev\\w*|deliver\\w*|lead(?:s|ing)? to|result(?:s|ing)? in|make(?:s)? sure|so that";

/** The organisational outcomes a causal verb may not be pointed at. */
export const OUTCOME_OBJECTS = [
  "collaborat\\w*", "cooperat\\w*", "teamwork", "efficien\\w*", "productivit\\w*", "moral\\w*",
  "safet\\w*", "qualit\\w*", "performanc\\w*", "retention", "success", "workflows?", "outcomes?",
  "results?", "clarity", "responsibilit\\w*", "communicat\\w*", "accountabilit\\w*", "consisten\\w*",
  "adoption", "engagement", "alignment", "throughput", "error\\w*", "mistakes?", "delays?", "risks?",
  "rework", "falling through the cracks", "slipping through", "being missed", "getting missed",
  /*
    Slice 3.2P-A4-R3 — a NOUN gap, not a verb gap. "reduce" was already a causal verb and
    "reduce errors" was already refused; "reduce missed handoffs" and "reduce unfinished
    actions" passed only because the work that did not happen had no name here. The set knew
    "being missed" and "getting missed" and not the far more ordinary attributive form.

    An attributive-only form was tried first and rejected on measurement: `missed \w+` also
    matches "missed AT handover", so it separated nothing while costing a stem the prompt has
    to render. The overlap it was meant to dodge is real and belongs elsewhere — see
    `guarantee_claim`'s sample.
  */
  "missed", "unfinished", "reliab\\w*",
] as const;

/** The same set as a person says it — used in the prompt, checked against the regexes by test. */
export const OUTCOME_OBJECT_WORDS = [
  "collaboration", "cooperation", "teamwork", "efficiency", "productivity", "morale", "safety",
  "quality", "performance", "retention", "success", "workflows", "outcomes", "results", "clarity",
  "responsibilities", "communication", "accountability", "consistency", "adoption", "engagement",
  "alignment", "throughput", "errors", "mistakes", "delays", "risks", "rework",
  "things falling through the cracks", "things slipping through", "work being missed",
  "anything getting missed", "missed work or handoffs", "unfinished actions", "reliability",
] as const;

const OUTCOME_OBJECT = OUTCOME_OBJECTS.join("|");

/**
 * Deliberately excludes "do"/"does": it collides with "does not", the exact negation this
 * policy exists to keep legal — "this does not mean the team consistently performs…" was
 * matched at "does" and refused as an assertion.
 *
 * `assign\w*` added in Slice 3.2P-A4-R3 — again a verb gap proven by swap: "consistently
 * follow the standard" was refused while "consistently assign an owner" passed. This is NOT a
 * ban on the word. The rule still needs a REGULARITY marker in the same clause, so "practice
 * how to assign an owner", "ask participants to assign an owner" and "leaders have the
 * authority to assign owners" are untouched — assigning is a thing people do here.
 */
const PERFORMANCE_VERB =
  "perform\\w*|follow\\w*|appl(?:y|ies|ied)|us(?:e|es|ed|ing)|execut\\w*|carr(?:y|ies|ied)\\s+out|conduct\\w*|assign\\w*";
const REGULARITY = "consistently|reliably|routinely|habitually|regularly|always|every time|each time";
const PROOF_VERB = "demonstrat\\w*|prov(?:e|es|ed|en)|confirm\\w*|verif\\w*|validat\\w*|establish(?:es|ed)";
const HIGH_RUNG =
  "sustained|lasting|permanent\\w*|behaviou?r change|competenc\\w*|mastery|master(?:ed|y)|improvement\\w*|improv(?:es|ed)|adoption|applied|application|reliab\\w*|consisten\\w*";

/**
 * THE POLICY. Order is the diagnosis order, not a precedence: the first match names the
 * rule, and every rule refuses the same code.
 */
export const EVIDENCE_POLICY: readonly EvidenceRule[] = [
  {
    id: "organisational_outcome",
    family: "outcome",
    meaning: "A causal verb pointed at an organisational outcome — a promise about what the training will achieve.",
    appliesTo: EVIDENCE_SCOPE,
    promptLine: `Never point a causal verb at an organisational outcome. Not only "improves productivity" — "ensures consistency", "prevents work being missed" and "so that responsibilities are clear" are the same claim. The outcomes that trigger this: ${OUTCOME_OBJECT_WORDS.join(", ")}.`,
    forbiddenSample: "This ensures consistency across every shift.",
    legalRewrite: "This training asks each person to state their open items at handover.",
    guard: "negation",
    pattern: new RegExp(`\\b(?:${CAUSAL_VERB})\\b[^.!?]{0,48}?\\b(?:${OUTCOME_OBJECT})\\b`, "i"),
  },
  {
    id: "habitual_performance",
    family: "habit",
    meaning: "Asserting the behaviour is now performed regularly — an APPLIED/SUSTAINED claim.",
    appliesTo: EVIDENCE_SCOPE,
    promptLine:
      'Never say the behaviour is done consistently, reliably, routinely, regularly, habitually or always. Nothing in a training can show what someone does at work afterwards. Say what the training asks for instead: "state each open item at your next handover".',
    forbiddenSample: "The team consistently performs complete handovers.",
    legalRewrite: "At your next handover, state each open item before you leave.",
    guard: "negation+prospective",
    pattern: new RegExp(
      `\\b(?:${REGULARITY})\\b[^.!?]{0,40}?\\b(?:${PERFORMANCE_VERB})\\b` +
        `|\\b(?:${PERFORMANCE_VERB})\\b[^.!?]{0,40}?\\b(?:${REGULARITY})\\b`,
      "i",
    ),
  },
  {
    id: "proof_of_high_rung",
    family: "proof",
    meaning: "A verb of demonstration pointed at applied, observed or sustained evidence.",
    appliesTo: EVIDENCE_SCOPE,
    promptLine:
      'Never say anything is demonstrated, proved, confirmed, verified or validated — and never attach those to change, adoption, competence, mastery, improvement, reliability or consistency. A follow-up REVIEWS; it never confirms.',
    forbiddenSample: "This demonstrates sustained change in how people work.",
    legalRewrite: "At follow-up, review whether the record was used in a real handover.",
    guard: "negation+prospective",
    pattern: new RegExp(`\\b(?:${PROOF_VERB})\\b[^.!?]{0,48}?\\b(?:${HIGH_RUNG})\\b`, "i"),
  },
  {
    id: "readiness_claim",
    family: "readiness",
    meaning: "Declaring the participant ready or equipped to act — a competence claim a program cannot make.",
    appliesTo: EVIDENCE_SCOPE,
    promptLine:
      'Never say anyone is "equipped to" do something, or "ready to implement", "ready to lead" or "ready to deliver". Finishing a program is not readiness.',
    forbiddenSample: "Participants are equipped to run a complete handover.",
    legalRewrite: "Participants have decided which items they will state at handover.",
    guard: "negation",
    pattern: /\bequipped to\b|\bready to (?:implement|lead|deliver)\b/i,
  },
  {
    id: "competence_claim",
    family: "readiness",
    meaning: "Asserting understanding, competence or mastery was achieved.",
    appliesTo: EVIDENCE_SCOPE,
    promptLine:
      'Never say anyone is "now competent", "fully understands" anything, or has "mastered" it. A written answer shows reflection, not competence.',
    forbiddenSample: "Participants now fully understand the standard.",
    legalRewrite: "Participants wrote what they would include in the record.",
    guard: "negation",
    pattern: /\bnow competent\b|\bfully (?:understand|understood|understands)\b|\bmastered\b/i,
  },
  {
    /*
      SLICE 3.2P-A4-R3 — MORPHOLOGY, MEASURED.

      `competence_claim` matched the past participle and nothing else, so "the skill was
      mastered" was refused while "Mastering Accountability in Every Meeting" — a TITLE, the
      most visible sentence in the program — passed. "mastery" was reachable only through
      `proof_of_high_rung`, which needs a verb of demonstration in front of it, so "builds
      mastery of the standard" passed too.

      Same family, same meaning, one more rule rather than a new concept: the readiness family
      already owns "this person can now do it".

      The bare form is deliberately NOT matched on its own. "Use the master checklist" is a
      noun; the claim lives under a modal or an infinitive — "will master", "to master" — which
      is what this matches instead of banning a word.
    */
    id: "mastery_claim",
    family: "readiness",
    meaning: "Presenting the training as mastery — in a title, as a promise, or as something it builds.",
    appliesTo: EVIDENCE_SCOPE,
    promptLine:
      'Never present the training as mastery — not "Mastering …" in a title, not "will master", not "builds mastery of". People practise here; nothing shows anyone has mastered anything. Name the capability or the practice instead.',
    forbiddenSample: "Mastering Consistent Handoffs",
    legalRewrite: "Practising a Consistent Handover",
    guard: "negation-either-side",
    pattern: /\bmaster(?:ing|y|ies)\b|\b(?:will|to|can|could|would|should|may|might|now)\s+master\b/i,
  },
  {
    id: "permanence_claim",
    family: "habit",
    meaning: "Asserting the change is permanent or sustained.",
    appliesTo: EVIDENCE_SCOPE,
    promptLine:
      'Never say anything is "permanent", produces "sustained change", or that "behaviour changed". Nothing here can show that anything lasted.',
    forbiddenSample: "This produces sustained change in how the team hands over.",
    legalRewrite: "This training asks the team to agree what a handover must include.",
    guard: "negation",
    pattern: /\bpermanently\b|\bsustained change\b|\bbehaviou?r (?:has |was )?(?:permanently )?changed\b/i,
  },
  {
    id: "verification_claim",
    family: "proof",
    meaning: "Asserting something has been verified, or that the program proves what someone can do.",
    appliesTo: EVIDENCE_SCOPE,
    promptLine:
      'Never say something "has been verified", and never say the program "proves that you can" or "proves that they will" do anything. Nobody observed it.',
    forbiddenSample: "This proves that you can hand over safely.",
    legalRewrite: "This records what you said you would do at your next handover.",
    guard: "negation",
    pattern: /\bhas been verified\b|\bproves? (?:that )?(?:you|they) (?:can|will)\b/i,
  },
  {
    id: "relationship_repair_claim",
    family: "outcome",
    meaning: "Asserting trust or a relationship was restored.",
    appliesTo: EVIDENCE_SCOPE,
    promptLine: 'Never say trust "was restored" or that a relationship improved. A training cannot show that.',
    forbiddenSample: "Trust was restored between the two shifts.",
    legalRewrite: "Both shifts agreed what the outgoing person will state.",
    guard: "negation",
    pattern: /\btrust (?:was|is|has been) restored\b/i,
  },
  {
    id: "dependency_removed_claim",
    family: "outcome",
    meaning: "Asserting a need has gone away.",
    appliesTo: EVIDENCE_SCOPE,
    promptLine: 'Never say anyone "no longer needs" something as a result of the training.',
    forbiddenSample: "The team no longer needs a written checklist.",
    legalRewrite: "The team decides together which items belong in the record.",
    guard: "negation",
    pattern: /\bno longer needs?\b/i,
  },
  {
    id: "guarantee_claim",
    family: "guarantee",
    meaning: "Guaranteeing an outcome.",
    appliesTo: EVIDENCE_SCOPE,
    promptLine: "Never guarantee anything.",
    /*
      SAMPLE REPLACED IN SLICE 3.2P-A4-R3, and not to make a test pass.
      "This guarantees nothing is missed at handover" asserts TWO things — a guarantee, and a
      causal verb pointed at work not happening — and once "missed" became an outcome noun the
      earlier, more general rule claimed it first. The sentence was always ambiguous; it just
      could not show it before. A representative sample has one job, and this family's contrast
      is rendered to the model, so it now illustrates a guarantee and nothing else.
    */
    forbiddenSample: "Completing this guarantees the standard is followed.",
    legalRewrite: "This asks each person to name what is still open at handover.",
    guard: "negation",
    pattern: /\bguarantees?\b/i,
  },
  {
    id: "improvement_claim",
    family: "outcome",
    meaning: "Asserting performance improved, or that the training leads to or results in something better.",
    appliesTo: EVIDENCE_SCOPE,
    promptLine:
      'Never say performance improved, or that this "leads to better", "results in better/fewer/greater" anything, or "ultimately affects" anything. Describe what the training asks people to do, not what it will achieve.',
    forbiddenSample: "This leads to better handovers across the team.",
    legalRewrite: "This training asks the team to state open items at every handover.",
    guard: "negation",
    pattern:
      /\bperformance improved\b|\bleads? to (?:better|improved|stronger|greater)\b|\bresults? in (?:better|improved|fewer|greater)\b|\bultimately (?:affects?|improves?|leads? to|results? in|drives?)\b/i,
  },
];

const NEGATOR =
  /\b(?:not|never|cannot|can't|doesn't|does not|don't|do not|isn't|is not|won't|will not|without|neither|nor|nothing|none|no|rather than|instead of)\b|않|아니|없/i;
const NEGATION_WINDOW = 48;

/** Framing that ASKS rather than asserts — the shape a follow-up is supposed to have. */
const PROSPECTIVE_FRAME =
  /\b(?:whether|ask|asks|asked|review|reviews|reviewing|check|checks|checking|if|invite|prompt|consider|discuss)\b/i;
const PROSPECTIVE_WINDOW = 70;

/**
 * The first policy rule this text ASSERTS, or null.
 *
 * Returns the rule id so a refusal can be diagnosed — and, in R11.4I, so one bounded repair
 * call can be told what to fix — without ever echoing the model's own words.
 */
export function assertsOverclaimByPolicy(text: string): EvidenceRule | null {
  for (const rule of EVIDENCE_POLICY) {
    rule.pattern.lastIndex = 0;
    const m = rule.pattern.exec(text);
    if (!m) continue;
    if (NEGATOR.test(text.slice(Math.max(0, m.index - NEGATION_WINDOW), m.index))) continue;
    // A noun-headed claim carries its denial after it — see `EvidenceGuard`. One rule only.
    if (
      rule.guard === "negation-either-side" &&
      NEGATOR.test(text.slice(m.index + m[0].length, m.index + m[0].length + NEGATION_WINDOW))
    ) {
      continue;
    }
    if (
      rule.guard === "negation+prospective" &&
      PROSPECTIVE_FRAME.test(text.slice(Math.max(0, m.index - PROSPECTIVE_WINDOW), m.index))
    ) {
      continue;
    }
    return rule;
  }
  return null;
}

/**
 * Every rule, as instructions. This is the whole policy — a rule that exists but says
 * nothing here is impossible, because `promptLine` is required to construct one.
 */
export function evidencePolicyPromptLines(): string[] {
  return EVIDENCE_POLICY.map((r) => `- ${r.promptLine}`);
}

/**
 * The scope, as the model is told it (Slice 3.2P-A4-R2). Built from `EVIDENCE_SCOPE`, which is
 * also every rule's `appliesTo`, so the sentence cannot claim a reach the rules do not have.
 */
export function evidenceScopeLine(): string {
  return `THIS APPLIES TO THE WHOLE PROGRAM — ${EVIDENCE_SCOPE}. A title, an assumption or a warning is NOT an exception; they are checked by exactly the same rules.`;
}

/**
 * ONE CONTRAST PER FAMILY, not eleven (Slice 3.2P-A4-R2, measured).
 *
 * The policy carries a `forbiddenSample`/`legalRewrite` pair for all eleven rules and NONE of
 * them reached the model. Rendering all twenty-two was measured against rendering one per
 * family: +762 characters for six extra pairs whose failure mode is already illustrated by a
 * sibling in the same family. Every rule still states itself through `promptLine`; what the
 * contrasts add is the SHAPE of the fix, and there are five distinct shapes.
 *
 * The representative is the first rule of its family in policy order, so a new family gets a
 * contrast automatically and a new rule inside an existing family does not.
 */
export function evidenceFamilyContrasts(): { family: EvidenceFamily; forbidden: string; legal: string }[] {
  const seen = new Set<EvidenceFamily>();
  const out: { family: EvidenceFamily; forbidden: string; legal: string }[] = [];
  for (const r of EVIDENCE_POLICY) {
    if (seen.has(r.family)) continue;
    seen.add(r.family);
    out.push({ family: r.family, forbidden: r.forbiddenSample, legal: r.legalRewrite });
  }
  return out;
}

/**
 * The three rules that are OUTCOME PROMISES — a claim about what the training will achieve.
 *
 * Narrower than the whole policy on purpose. `outcomeClaimIndex` exists so the physical
 * preview can CUT an authentic promise out of a replayed proposal; pointing it at every
 * rule made it match the honest ceiling sentence "Nothing here can show that behaviour
 * changed", which is a denial, not a promise.
 */
const OUTCOME_PROMISE_RULE_IDS = ["organisational_outcome", "readiness_claim", "improvement_claim"] as const;

/** Where an ASSERTED outcome promise starts, or -1. Denials and questions are not promises. */
export function outcomePromiseIndex(text: string): number {
  let best = -1;
  for (const rule of EVIDENCE_POLICY) {
    if (!(OUTCOME_PROMISE_RULE_IDS as readonly string[]).includes(rule.id)) continue;
    rule.pattern.lastIndex = 0;
    const m = rule.pattern.exec(text);
    if (!m) continue;
    if (NEGATOR.test(text.slice(Math.max(0, m.index - NEGATION_WINDOW), m.index))) continue;
    if (best < 0 || m.index < best) best = m.index;
  }
  return best;
}

/** The adversarial matrix, derived from the policy rather than hand-listed beside it. */
export function evidencePolicyMatrix(): { id: string; forbidden: string; legal: string }[] {
  return EVIDENCE_POLICY.map((r) => ({ id: r.id, forbidden: r.forbiddenSample, legal: r.legalRewrite }));
}
