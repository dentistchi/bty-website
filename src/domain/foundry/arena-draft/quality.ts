/**
 * Foundry Guided Arena Builder — difficult-choice quality gate (pure) [Slice 3.2H].
 *
 * The schema validator (./validate) proves a draft is STRUCTURALLY well-formed. This
 * layer is the DELIBERATELY-NARROW deterministic guard against the obvious-answer
 * failure mode: a scenario where the learner can reject an option from its wording
 * alone (an obviously careless / passive / morally-loaded throwaway), turning
 * judgment Practice into a correct-answer quiz.
 *
 * IMPORTANT — this is anti-pattern REJECTION, not a semantic quality guarantee. A
 * keyword check cannot prove that two options protect genuinely competing legitimate
 * values at real cost; that is the job of the generation contract (prompt) and the
 * authored template. This gate exists so the clearest defects are caught and never
 * silently used: on failure the generation service falls back to the authored
 * template (which passes) rather than persisting a didactic draft.
 *
 * No DB, no I/O, no providers, no display strings.
 */

import { isBranchAware, type ActionDecisionChoice, type ArenaScenarioDraft, type ScenarioDraftChoice } from "./types";

export type QualityValidation = {
  ok: boolean;
  /** Blocking, stable machine codes — a draft with any of these fails the gate. */
  errors: string[];
  /** Non-blocking advisories the Manager may want to review before publishing. */
  warnings: string[];
};

// ---------------------------------------------------------------------------
// Anti-pattern lexicons (en + ko). Matched case-insensitively on learner-facing
// text. Kept conservative: only phrases that are unambiguous defects, so a
// legitimate difficult-choice draft is never falsely rejected.
// ---------------------------------------------------------------------------

/**
 * Answer-key / moral-label language. A judgment Practice must never tell the learner
 * which option is right, or praise/blame a choice — that reveals a hidden answer key.
 * (Also future-proofs any generated feedback-like copy.)
 */
const MORAL_LABEL_PATTERNS: readonly RegExp[] = [
  // Answer-key sense only — the ADJECTIVE + a judgment noun. Deliberately excludes the
  // verb "correct" / "correction" (a legitimate action: correcting an error).
  /\b(correct|incorrect|right|wrong|best|ideal|poor|smart|foolish|responsible|irresponsible)\s+(answer|choice|decision|option|response|leader|move)\b/i,
  // Standalone verdict word as the whole label / sentence opener (e.g. "Correct!").
  /^(correct|incorrect|right|wrong)\b\s*[.!]?$/i,
  /\bthe right thing\b/i,
  /\bdo the right thing\b/i,
  /\byou should have\b/i,
  /\bgood choice\b/i,
  /\bbad choice\b/i,
  /\bmoral(ly)?\b/i,
  // Korean
  /정답|오답/,
  /(올바른|옳은|최선의|잘못된|나쁜)\s*(선택|답|결정)/,
  /옳은 일/,
];

/**
 * Hollow options — pure avoidance / negligence / passive throwaways with no
 * legitimate protected value or concrete action. These are the classic "obvious
 * wrong answer" the learner eliminates on sight.
 */
const HOLLOW_OPTION_PATTERNS: readonly RegExp[] = [
  /\bdo nothing\b/i,
  /\bignore (it|the|this|them)\b/i,
  /\bpretend\b/i,
  /\blook the other way\b/i,
  /\bturn a blind eye\b/i,
  /\bbrush (it|this) (off|aside)\b/i,
  /\bsomeone else('s| )/i,
  /\ban easier time\b/i,
  /\beasier time\b/i,
  /\bput (it|this) off\b/i,
  /\bwait and see\b/i,
  /\bhope (it|they|the)\b/i,
  // Korean
  /아무것도\s*(안|하지)/,
  /모른\s*척/,
  /(무시|외면)(한다|하기|하고|해)/,
  /남에게\s*(넘긴다|미룬다)/,
  /더\s*편한\s*때/,
];

/**
 * A bare deferral with no stated cost — "wait", "defer", "postpone" as the whole
 * strategy. Legitimate when it carries a visible cost (a verify-first strategy that
 * names what the delay sacrifices); a defect when it is just "wait a bit longer".
 */
const BARE_DEFERRAL_START = /^(?:wait|defer|delay|postpone|hold off|기다|미루|나중)/i;
const COST_CONNECTIVE = /\b(but|while|delaying|risking|accepting|at the cost of|even though|leaving)\b|,|하지만|대신|미루면|—/i;

/**
 * Branch-presupposition (escalation). The flat playable schema has ONE shared
 * escalation for all Primary choices, so it must never assert a SPECIFIC prior action
 * that only some paths took (a delay, a message sent, a disclosure, a commitment). Such
 * an escalation is incoherent for the paths that did not take that action.
 */
const BRANCH_PRESUPPOSE_PATTERNS: readonly RegExp[] = [
  /\bbased on your delay\b/i,
  /\byour delay\b/i,
  /\bbecause you (waited|delayed|held back|stayed quiet|said nothing)\b/i,
  /\byou (delayed|waited too long|stayed silent)\b/i,
  /\bnow that you('ve| have) (told|informed|notified|announced|gone public|disclosed|admitted|come clean)\b/i,
  /\bsince you (told|announced|disclosed|went public|admitted|committed)\b/i,
  /\byour (original )?(message|announcement|statement|email) (you )?(sent|made|posted)\b/i,
  /\bthe (message|announcement|statement) you (sent|made|posted)\b/i,
  /\byou already (committed|promised|pledged|announced)\b/i,
  /\bthe (public )?commitment you (already )?made\b/i,
  // Korean
  /당신의 지연|당신이 (미뤄|지연|침묵)/,
  /이미 (알렸|공개했|약속했)으?니/,
];

/**
 * Branch-artifact reference (Tradeoff / Action choices). A follow-on choice must not
 * refer to an action or artifact that a given branch never produced (e.g. "stand by
 * your original message" is invalid when no message was sent). Branch-NEUTRAL back-
 * references ("your first move", "your earlier call", "your first approach") are fine.
 */
const BRANCH_ARTIFACT_PATTERNS: readonly RegExp[] = [
  /\bstand by your (original )?(message|statement|announcement|answer|post)\b/i,
  /\byour (original )?(message|statement|announcement) (you )?(sent|made|posted)\b/i,
  /\b(continue|finish|complete|resume) (the|your|what) [^.]*?you (started|began|announced|sent|posted)\b/i,
  /\bfinish what you (started|began)\b/i,
  /\bkeep to the (message|announcement|commitment) you (made|sent)\b/i,
  // Korean
  /당신이 보낸 (메시지|공지|메일)|보낸 메시지를 (고수|유지)/,
];

/**
 * Language parity — legitimizing vs condemning. A difficult choice must not frame one
 * option as principled and another as a knowing wrong. If one option in a phase reads
 * as "the principled thing" while another reads as "discount / downplay / shortcut", the
 * moral answer is exposed and it is no longer a genuine tradeoff.
 */
const LEGITIMIZING_PATTERNS: readonly RegExp[] = [
  /\bon its merits\b/i,
  /\bon principle\b/i,
  /\bthe principled (thing|choice|path|option)\b/i,
  /\buphold (the|your) (standard|complaint|rule|principle)\b/i,
  /\bdo what('s| is) right\b/i,
  /\bthe right thing to do\b/i,
  /\bstand on principle\b/i,
];
const MINIMIZING_PATTERNS: readonly RegExp[] = [
  /\b(partly |quietly )?(discount|downplay|dismiss|minimize|overlook|sweep|gloss over|water down|brush off) (the|their|it|this|your)\b/i,
  /\bpartly (ignore|discount|dismiss)\b/i,
  /\btake a shortcut\b/i,
  /\bcut a corner\b/i,
  /\bpretend it('s| is) fine\b/i,
];

function textOf(c: ScenarioDraftChoice): string {
  return c.label.trim();
}

function matchesAny(text: string, patterns: readonly RegExp[]): boolean {
  return patterns.some((re) => re.test(text));
}

/** A choice that reads as a hollow throwaway (no legitimate value, no real action). */
function isHollow(label: string): boolean {
  if (matchesAny(label, HOLLOW_OPTION_PATTERNS)) return true;
  // A short, cost-free deferral is hollow; a deferral that names its cost is not.
  if (BARE_DEFERRAL_START.test(label.trim()) && label.trim().length < 48 && !COST_CONNECTIVE.test(label)) {
    return true;
  }
  return false;
}

/** All learner-facing strings, for a moral-label sweep. */
function allText(draft: ArenaScenarioDraft): string[] {
  const out = [draft.title, draft.opening, draft.tradeoff.escalationText, draft.actionDecision.prompt];
  for (const c of draft.primary.choices) out.push(c.label);
  for (const c of draft.tradeoff.choices) out.push(c.label);
  for (const c of draft.actionDecision.choices) out.push(c.label);
  return out.map((s) => (s ?? "").trim()).filter((s) => s.length > 0);
}

function lengthAsymmetry(choices: ScenarioDraftChoice[]): number {
  const lens = choices.map((c) => textOf(c).length).filter((n) => n > 0);
  if (lens.length < 2) return 1;
  const min = Math.min(...lens);
  const max = Math.max(...lens);
  return min === 0 ? Infinity : max / min;
}

// Balance thresholds — lenient enough that a genuinely balanced draft passes, tight
// enough that a one-nuanced-one-throwaway pair is flagged.
const ASYMMETRY_WARN = 3;
const ASYMMETRY_BLOCK = 6;

/**
 * Run the difficult-choice gate on a STRUCTURALLY-VALID draft. Assumes the schema
 * validator has already passed (phases + cardinality present). Pure.
 */
export function validateDifficultChoice(
  draft: ArenaScenarioDraft,
  opts: { branchMode?: boolean } = {},
): QualityValidation {
  const errors: string[] = [];
  const warnings: string[] = [];

  // 1. No answer-key / moral-label language anywhere.
  for (const s of allText(draft)) {
    if (matchesAny(s, MORAL_LABEL_PATTERNS)) {
      errors.push("moral_label_language");
      break;
    }
  }

  // 2. No hollow / obvious-throwaway option in any phase.
  const phases: Array<{ name: string; choices: ScenarioDraftChoice[] }> = [
    { name: "primary", choices: draft.primary.choices },
    { name: "tradeoff", choices: draft.tradeoff.choices },
    { name: "action", choices: draft.actionDecision.choices },
  ];
  for (const p of phases) {
    if (p.choices.some((c) => isHollow(textOf(c)))) {
      errors.push(`${p.name}_hollow_option`);
    }
  }

  // 3. Action Decision must not reduce to act-vs-avoidance. At least one choice is an
  //    action commitment (schema-enforced); the OTHER(s) must be a concrete, cost-
  //    bearing strategy, not a bare "wait".
  const nonCommitment = draft.actionDecision.choices.filter((c) => !(c as ActionDecisionChoice).isActionCommitment);
  if (nonCommitment.length > 0 && nonCommitment.every((c) => isHollow(textOf(c)))) {
    if (!errors.includes("action_hollow_option")) errors.push("action_act_vs_avoidance");
  }

  // 4. Choice-length balance per phase (a nuanced option paired with a curt throwaway
  //    is a giveaway). Extreme asymmetry blocks; moderate warns.
  for (const p of phases) {
    const ratio = lengthAsymmetry(p.choices);
    if (ratio >= ASYMMETRY_BLOCK) errors.push(`${p.name}_choice_asymmetry`);
    else if (ratio >= ASYMMETRY_WARN) warnings.push(`${p.name}_choice_asymmetry`);
  }

  // 5. Escalation must add pressure, not restate the opening (advisory — the prompt +
  //    template own this; a near-duplicate is a soft signal, not a hard block).
  const opening = draft.opening.trim().toLowerCase();
  const escalation = draft.tradeoff.escalationText.trim().toLowerCase();
  if (escalation.length > 0 && (opening.includes(escalation) || escalation === opening)) {
    warnings.push("escalation_repeats_opening");
  }

  // 6 & 7 are FLAT-ONLY coherence rules: they exist because a flat scenario shows ONE
  // shared escalation to every path. In branch mode (Slice 3.2I) each escalation is
  // legitimately primary-specific and a branch may reference its OWN primary's action,
  // so these rules are skipped — cross-branch coherence is enforced structurally by the
  // parser (keys ↔ primary ids) and the per-branch checks below.
  if (!opts.branchMode) {
    // 6. Branch coherence — the SHARED escalation must not presuppose a specific prior
    //    action that only some Primary choices took (the flat schema has one escalation
    //    for every path). Heuristic; anti-pattern rejection, not a semantic proof.
    if (matchesAny(draft.tradeoff.escalationText, BRANCH_PRESUPPOSE_PATTERNS)) {
      errors.push("branch_incoherent_escalation");
    }

    // 7. Branch coherence — a follow-on (Tradeoff or Action) choice must not reference an
    //    artifact/action a branch may never have produced ("stand by your original
    //    message"). Branch-neutral back-references are allowed.
    for (const c of [...draft.tradeoff.choices, ...draft.actionDecision.choices]) {
      if (matchesAny(textOf(c), BRANCH_ARTIFACT_PATTERNS)) {
        errors.push("branch_incoherent_reference");
        break;
      }
    }
  }

  // 8. Language parity — no legitimizing-vs-condemning asymmetry within a phase (one
  //    option "on its merits", another "partly discount"). That exposes a preferred
  //    answer and collapses the tradeoff.
  for (const p of phases) {
    const labels = p.choices.map(textOf);
    const hasLegit = labels.some((l) => matchesAny(l, LEGITIMIZING_PATTERNS));
    const hasMinim = labels.some((l) => matchesAny(l, MINIMIZING_PATTERNS));
    if (hasLegit && hasMinim) {
      errors.push(`${p.name}_moral_asymmetry`);
    }
  }

  // de-dupe stable codes
  const uniq = (a: string[]) => Array.from(new Set(a));
  return { ok: errors.length === 0, errors: uniq(errors), warnings: uniq(warnings) };
}

// ---------------------------------------------------------------------------
// Concrete-scene gate (Slice 3.2I-R1) — realism, not just difficulty. A scenario must
// read like an actual moment (an actor, an incident, a stakeholder, a decision now),
// with concrete-action choices and branch-specific reactions — never a training
// DESCRIPTION, a raw-Capability interpolation, or repetitive machine boilerplate.
// Deterministic anti-pattern rejection (NOT a proof of natural language).
// ---------------------------------------------------------------------------

/** Openings that describe training instead of a scene, or raw-Capability interpolation. */
const NON_SCENE_OPENING: readonly RegExp[] = [
  /a realistic moment/i,
  /a difficult situation/i,
  /leadership is required/i,
  /\bis called for\b/i,
  /you cannot (fully )?protect both/i,
  /this (training|practice|scenario)\b/i,
  /현실적인 상황|어려운 상황이 발생|리더십이 필요/,
];

/** Template markers / placeholders that must never reach a learner. */
const PLACEHOLDER = /\{\{|\}\}|\[[A-Za-z_]{2,}\]|<[a-z_]{2,}>|\bTODO\b|\bTBD\b|\{[a-z_]+\}/;

/** A concrete actor / stakeholder the opening must reference (en + ko). */
const ACTOR = /\b(teammate|colleague|co-?worker|client|customer|patient|manager|lead|team|the person|a peer|staff|assistant|nurse|doctor|someone|reviewer|supervisor|director|the group|the other|owner|vendor|partner|executive|employee)\b|팀원|동료|고객|환자|담당자|상사|직원|사람|리더|경영진/i;

/**
 * A choice that is abstract INTENT ("protect trust", "demonstrate accountability") rather
 * than a concrete action. A denylist is more robust than a concrete-verb allowlist (which
 * whack-a-moles legitimate verbs like "restart"/"recall"); a purely-abstract choice matches
 * one of these openers + a value noun. (en + ko.)
 */
const ABSTRACT_CHOICE =
  /^\s*(protect|prioriti[sz]e|demonstrate|support|uphold|maintain|ensure|value|embrace|foster|show)\s+(trust|fairness|accountability|leadership|the\s+standard|integrity|transparency|the\s+relationship|respect|honesty)\b/i;

/** Generic, reaction-free escalations. */
const GENERIC_ESCALATION =
  /creates more pressure|people are concerned|questions (now )?surface|more pressure and people|the outcome may be lost|becomes harder for everyone|things get more difficult/i;

function fourGramRepeats(texts: string[]): boolean {
  const counts = new Map<string, number>();
  for (const raw of texts) {
    const words = raw.toLowerCase().replace(/[^a-z0-9가-힣\s]/g, " ").split(/\s+/).filter(Boolean);
    const seenHere = new Set<string>();
    for (let i = 0; i + 4 <= words.length; i++) {
      const gram = words.slice(i, i + 4).join(" ");
      if (seenHere.has(gram)) continue; // count each text once per gram
      seenHere.add(gram);
      counts.set(gram, (counts.get(gram) ?? 0) + 1);
    }
  }
  for (const n of counts.values()) if (n >= 3) return true;
  return false;
}

/** Every learner-facing CHOICE label across flat + branches. */
function allChoiceLabels(draft: ArenaScenarioDraft): string[] {
  const out = [
    ...draft.primary.choices,
    ...draft.tradeoff.choices,
    ...draft.actionDecision.choices,
  ].map((c) => c.label);
  for (const b of Object.values(draft.branches ?? {})) {
    out.push(...b.tradeoffChoices.map((c) => c.label), ...b.actionDecision.choices.map((c) => c.label));
  }
  return out;
}

/** All escalation texts (flat + per-branch) that must each be a concrete reaction. */
function allEscalations(draft: ArenaScenarioDraft): string[] {
  if (isBranchAware(draft)) return Object.values(draft.branches).map((b) => b.escalationText);
  return [draft.tradeoff.escalationText];
}

/**
 * Reject a scenario that is structurally fine but does not read like a real scene
 * (Slice 3.2I-R1). Applies to flat and branch-aware drafts. Pure.
 */
export function validateConcreteScene(draft: ArenaScenarioDraft): QualityValidation {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Placeholder / template-marker leakage anywhere.
  const everyString = [draft.title, draft.opening, ...allEscalations(draft), ...allChoiceLabels(draft)];
  if (everyString.some((s) => PLACEHOLDER.test(s))) errors.push("placeholder_leak");

  // Opening must be a SCENE with a concrete actor — not a training description.
  if (matchesAny(draft.opening, NON_SCENE_OPENING)) errors.push("opening_not_a_scene");
  if (!ACTOR.test(draft.opening)) errors.push("opening_no_actor");

  // No choice may be pure abstract intent (a management value, not a concrete action).
  for (const label of allChoiceLabels(draft)) {
    if (ABSTRACT_CHOICE.test(label)) {
      errors.push("choice_no_concrete_action");
      break;
    }
  }

  // Each escalation must be a specific reaction, not a generic "more pressure" line.
  if (allEscalations(draft).some((e) => GENERIC_ESCALATION.test(e))) errors.push("generic_escalation");

  // No repeated machine boilerplate across the opening + escalations.
  if (fourGramRepeats([draft.opening, ...allEscalations(draft)])) errors.push("boilerplate_repetition");

  return { ok: errors.length === 0, errors: Array.from(new Set(errors)), warnings };
}

// ---------------------------------------------------------------------------
// Incident-specificity gate (Slice 3.2I-R2) — the three branches must be genuinely
// different reactions to the incident, not paraphrases of one continuation or the same
// generic actor reaction. A real product must never ship a scaffold. Pure heuristic.
// ---------------------------------------------------------------------------

/** Generic, incident-agnostic branch reactions that could be pasted into any dilemma. */
const GENERIC_REACTION =
  /the team splits|people are concerned|someone asks why|a colleague pushes back|questions (now )?surface|팀의 의견이 갈리|사람들이 걱정|왜 그랬냐/i;

function shingles(text: string): Set<string> {
  const w = text.toLowerCase().replace(/[^a-z0-9가-힣\s]/g, " ").split(/\s+/).filter(Boolean);
  const out = new Set<string>();
  for (let i = 0; i + 3 <= w.length; i++) out.add(w.slice(i, i + 3).join(" "));
  return out;
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let inter = 0;
  for (const s of a) if (b.has(s)) inter++;
  return inter / (a.size + b.size - inter);
}

/**
 * Reject a scenario whose branches are not incident-specific (Slice 3.2I-R2). Requires
 * true branches; rejects branch escalations that are paraphrases of each other or all
 * the same generic actor reaction. Cross-SCENARIO diversity (across a corpus) is the
 * evaluation harness's job — this is per-draft. Pure.
 */
export function validateIncidentSpecific(draft: ArenaScenarioDraft): QualityValidation {
  const errors: string[] = [];
  if (!isBranchAware(draft)) {
    return { ok: false, errors: ["not_branch_aware"], warnings: [] };
  }
  const escalations = Object.values(draft.branches).map((b) => b.escalationText);
  for (let i = 0; i < escalations.length; i++) {
    for (let j = i + 1; j < escalations.length; j++) {
      if (jaccard(shingles(escalations[i]), shingles(escalations[j])) >= 0.5) {
        errors.push("branch_paraphrase");
      }
    }
  }
  if (escalations.length > 0 && escalations.every((e) => GENERIC_REACTION.test(e))) {
    errors.push("generic_branch_reaction");
  }
  return { ok: errors.length === 0, errors: Array.from(new Set(errors)), warnings: [] };
}

/**
 * Difficult-choice gate for a whole scenario, branch-aware (Slice 3.2I). For a legacy
 * flat draft this is exactly `validateDifficultChoice`. For a branch-aware draft it runs
 * the gate INDEPENDENTLY on every branch (the shared primary + that branch's escalation /
 * tradeoff / action) in branch mode, and prefixes each branch's error codes with its
 * key so a single obvious-answer branch fails the whole draft. Assumes the draft already
 * passed structural validation (`validateArenaScenarioDraft`). Pure.
 */
export function validateBranchedScenario(draft: ArenaScenarioDraft): QualityValidation {
  if (!isBranchAware(draft)) return validateDifficultChoice(draft);

  const errors: string[] = [];
  const warnings: string[] = [];
  for (const [key, branch] of Object.entries(draft.branches)) {
    // Synthesize a flat draft for this branch: shared opening + primary, this branch's
    // continuation. Branch mode skips the flat-only escalation/artifact rules.
    const perBranch = validateDifficultChoice(
      {
        title: draft.title,
        opening: draft.opening,
        primary: draft.primary,
        tradeoff: { escalationText: branch.escalationText, choices: branch.tradeoffChoices },
        actionDecision: branch.actionDecision,
      },
      { branchMode: true },
    );
    for (const e of perBranch.errors) errors.push(`branch:${key}:${e}`);
    for (const w of perBranch.warnings) warnings.push(`branch:${key}:${w}`);
  }
  return { ok: errors.length === 0, errors, warnings };
}
