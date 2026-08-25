/**
 * Program coherence — behavioral standard contract, operational construct lifecycle, and
 * whole-program dependency validation (Slice 3.2L-R4). Pure: no DB, no I/O, no providers.
 *
 * WHY THIS EXISTS. The fifth controlled window returned a structurally perfect program —
 * 7/7 required elements, strict schema, no fabricated artifact — that was not a usable
 * training program:
 *
 *   THE STANDARD       "A shared handoff standard is created and utilized by team members
 *                       during all relevant transitions of work."
 *   YOUR DECISION      "I will contribute to creating and implementing a shared handoff
 *                       standard for our team."
 *   APPLY IT           "During the next project handoff meeting, I will actively use the
 *                       shared handoff standard …"
 *   BEFORE YOU FINISH  "What specific elements will you include in the shared handoff
 *                       standard …?"
 *
 * Two defects, both invisible to the old validator:
 *
 *   1. THE STANDARD named no actor, no trigger, no visible action and no completion
 *      signal. It passed because the only gate was `wordCount >= 4` — a check whose
 *      refusal code was called `non_observable_standard` while measuring nothing about
 *      observability.
 *
 *   2. The program told the participant to USE a standard at the next handoff, then asked
 *      at the end what that standard should contain. The construct was required before it
 *      was defined. The old cross-section pass was two lexical rules (exact duplicate
 *      content, and a 0.05 vocabulary overlap between standard and decision); it modelled
 *      the program as seven independent strings, so an inverted dependency was unreachable.
 *
 * THE PRODUCT CONSTRAINT. The Host must NOT be pushed back into filling actor / trigger /
 * action / completion by hand — the Guided Builder is not a form. The AI proposes the
 * behavioral contract; BTY deterministically refuses one that does not actually contain a
 * behavior. Proposing a NEW standard stays legal. Claiming an unprovided existing
 * template, policy, tool or system stays forbidden.
 */

import { JOURNEY_KIND_ORDER, type JourneyElementKind } from "./journey";
import { journeyCopy, type JourneyLocale } from "./journeyLocaleCopy";
import { isInterrogativeAction } from "./observableStandardShape";

// ---------------------------------------------------------------------------
// Entity lifecycle — one authority for "does this text presuppose a thing exists?"
// ---------------------------------------------------------------------------

/**
 * Concrete deliverables: a thing you could attach, open or log into. A DEFINITE reference
 * to one presupposes it already exists, which only the Host's own context or a verified
 * upload can support.
 */
export const ARTIFACT_NOUNS = [
  "template", "templates", "checklist", "checklists", "form", "forms", "guide", "guides",
  "manual", "manuals", "policy", "policies", "procedure", "procedures", "sop", "sops",
  "document", "documents", "file", "files", "pdf", "pdfs", "spreadsheet", "spreadsheets",
  "dashboard", "dashboards", "tool", "tools", "system", "systems", "tracker", "trackers",
  "portal", "portals", "playbook", "playbooks", "handbook", "handbooks", "protocol", "protocols",
  "worksheet", "worksheets", "questionnaire", "questionnaires", "software", "platform", "platforms",
  "database", "databases", "app", "apps", "wiki", "wikis", "logbook", "logbooks",
  "record", "records", "log", "logs", "register", "registers", "sheet", "sheets",
] as const;

/**
 * OPERATIONAL CONSTRUCTS — a way of working the team agrees on. Deliberately NOT artifacts.
 *
 * These were the tempting fix after the live miss: drop `standard`, `process`, `workflow`
 * and the rest into `ARTIFACT_NOUNS` until the bad sentence refused. That would have been
 * wrong. "Create a shared handoff standard" is exactly what this product is FOR — a program
 * that may not propose a new way of working is not a training program. A construct is not a
 * file, and saying the team will agree on one claims nothing about what already exists.
 *
 * So a construct is governed by its LIFECYCLE instead: it may be proposed freely, it
 * becomes usable only once a section has actually defined the behavior, and it becomes a
 * fabrication only when the text asserts an EXISTING one.
 */
export const CONSTRUCT_NOUNS = [
  "standard", "standards", "process", "processes", "workflow", "workflows",
  "guideline", "guidelines", "framework", "frameworks", "criteria", "criterion",
  "agreement", "agreements", "norm", "norms", "rubric", "rubrics",
  "convention", "conventions", "routine", "routines", "ritual", "rituals",
  "cadence", "cadences", "practice", "practices",
] as const;

/** Singularise just enough to compare a head noun against the Host's own words. */
export function nounStem(noun: string): string {
  const n = noun.toLowerCase();
  if (n === "criteria") return "criterion";
  if (n.endsWith("ies")) return `${n.slice(0, -3)}y`;
  if (n.endsWith("es") && /(ch|sh|s|x|z)es$/.test(n)) return n.slice(0, -2);
  if (n.endsWith("s") && !n.endsWith("ss")) return n.slice(0, -1);
  return n;
}

const ARTIFACT_ALT = ARTIFACT_NOUNS.join("|");
const CONSTRUCT_ALT = CONSTRUCT_NOUNS.join("|");

/**
 * A MODIFIER TOKEN inside a noun phrase (Slice 3.2P-R3.1).
 *
 * Was `[\w'-]+`, which is ASCII-only and cannot contain a dot — so a FILENAME sitting between
 * the determiner and the artifact head made the whole pattern miss. Measured: "the checklist
 * lists five steps" and "the training checklist lists five steps" were both refused, while
 * "the education.pdf checklist lists five steps" passed, along with the same claim built on
 * `notes.txt`, `slides.pptx`, `training.v2.pdf`, `MRONJ-1.pdf` and `측정지표.pdf`. That is
 * exactly the shape this pilot invites, because its prompt legitimately names `education.pdf`.
 *
 * Two changes, each with evidence behind it and nothing more:
 *
 *   DOTS, ONLY INSIDE A TOKEN. `word(.word)*` — never a trailing dot. A trailing dot would
 *   let the phrase walk across a sentence boundary ("the team. The template lists…") and
 *   invent a claim out of two unrelated clauses. Measured on that exact sentence.
 *
 *   NON-ASCII LETTERS. `\w` excludes Hangul, and 8 of the 27 real filenames on staging are
 *   Korean. A Korean-named file broke the pattern the same way a dot did.
 */
export const MODIFIER_TOKEN = "[\\p{L}\\p{N}_'-]+(?:\\.[\\p{L}\\p{N}_'-]+)*";

/**
 * GREEDY modifiers on purpose. "the handoff record template" contains TWO artifact nouns;
 * a lazy match stops at "record", finds it grounded (the Host wrote "Handoff record") and
 * never examines "template" — the ungrounded one. Measured: that made the R2 live miss
 * pass. Greedy matching reaches the HEAD noun, which is the artifact being claimed.
 */
const DEFINITE_ARTIFACT = new RegExp(
  `\\b(?:the|our|your|its|their|this|that|these|those|existing|available|current|ready-made|pre-made)\\s+((?:${MODIFIER_TOKEN}\\s+){0,3}(${ARTIFACT_ALT}))\\b`,
  "giu",
);

/** "access to the necessary tools and templates" — an availability claim. */
const ACCESS_ARTIFACT = new RegExp(
  `\\baccess\\s+to\\s+(?:the\\s+|any\\s+)?(?:necessary\\s+|required\\s+|appropriate\\s+|relevant\\s+)?((?:${MODIFIER_TOKEN}\\s+){0,3}(${ARTIFACT_ALT}))\\b`,
  "giu",
);

/**
 * A construct asserted to ALREADY EXIST. "the existing process", "our approved workflow",
 * "access to the agreed criteria" — unlike a bare definite construct reference, an
 * existence marker is a claim about the world, and needs the same grounding an artifact does.
 */
const EXISTING_CONSTRUCT = new RegExp(
  `\\b(?:existing|available|current|established|approved|official|supplied|provided|ready-made|pre-made|in\\s+place)\\s+((?:[\\w'-]+\\s+){0,3}(${CONSTRUCT_ALT}))\\b`,
  "gi",
);

const ACCESS_CONSTRUCT = new RegExp(
  `\\baccess\\s+to\\s+(?:the\\s+|any\\s+)?(?:necessary\\s+|required\\s+|appropriate\\s+|relevant\\s+|agreed\\s+)?((?:[\\w'-]+\\s+){0,3}(${CONSTRUCT_ALT}))\\b`,
  "gi",
);

/**
 * A DEFINITE reference to a construct: "the shared handoff standard", "our new process".
 * Legal to write — but it is the reference the dependency graph gates, because a
 * participant cannot follow a standard whose behavior no section ever stated.
 */
const DEFINITE_CONSTRUCT = new RegExp(
  `\\b(?:the|our|your|its|their|this|that|these|those)\\s+((?:[\\w'-]+\\s+){0,3}(${CONSTRUCT_ALT}))\\b`,
  "gi",
);

/** Framing that PROPOSES something rather than presupposing it. */
export const CREATION_FRAME =
  /\b(?:create|creating|build|building|design|designing|develop|developing|establish|establishing|agree\s+on|agreeing\s+on|define|defining|decide\s+on|draft|drafting|set\s+up|setting\s+up|write|writing|make|making|introduce|introducing|adopt|adopting|choose|choosing|identify|identifying|contribute\s+to|propose|proposing)\b/i;

/** Conditional framing — "if your team has one" — is not an existence claim. */
export const CONDITIONAL_FRAME =
  /\bif\s+(?:you|your team|one|it|they|there)\b|\bif\s+\w+\s+(?:has|have|exists?)\b|\bwhere available\b|\bif any\b/i;

const LOOKBACK = 70;

/**
 * The first thing this text claims already EXISTS without grounding, or null.
 *
 * Covers artifacts (unchanged from R2 — the greedy head-noun rule that closed the live
 * miss) and, new in R4, constructs that carry an explicit existence marker. Returns the
 * offending head noun so a refusal can be diagnosed without echoing generated prose.
 */
export function ungroundedExistingEntity(text: string, corpus: string): string | null {
  for (const re of [DEFINITE_ARTIFACT, ACCESS_ARTIFACT, EXISTING_CONSTRUCT, ACCESS_CONSTRUCT]) {
    re.lastIndex = 0;
    for (let m = re.exec(text); m !== null; m = re.exec(text)) {
      const head = nounStem(m[2]);
      // Grounded: the Host named this kind of thing themselves, or a verified upload did.
      if (corpus.includes(head)) continue;
      // Proposed, not presupposed.
      const before = text.slice(Math.max(0, m.index - LOOKBACK), m.index);
      if (CREATION_FRAME.test(before)) continue;
      // Conditional anywhere in the surrounding sentence.
      const sentence = text.slice(
        Math.max(0, m.index - LOOKBACK),
        Math.min(text.length, m.index + m[0].length + LOOKBACK),
      );
      if (CONDITIONAL_FRAME.test(sentence)) continue;
      return head;
    }
  }
  return null;
}

/**
 * Every operational construct this text refers to DEFINITELY ("the shared handoff
 * standard"), as head-noun stems. A creation-framed mention ("create a shared handoff
 * standard") is a proposal, not a use, and is deliberately excluded — proposing is always
 * legal and never triggers the dependency gate.
 */
export function definiteConstructs(text: string): string[] {
  const out = new Set<string>();
  DEFINITE_CONSTRUCT.lastIndex = 0;
  for (let m = DEFINITE_CONSTRUCT.exec(text); m !== null; m = DEFINITE_CONSTRUCT.exec(text)) {
    const before = text.slice(Math.max(0, m.index - LOOKBACK), m.index);
    if (CREATION_FRAME.test(before)) continue;
    out.add(nounStem(m[2]));
  }
  return [...out];
}

/** Any construct head noun the text mentions at all, however framed. */
export function mentionsConstruct(text: string, stem: string): boolean {
  return new RegExp(`\\b${stem}s?\\b`, "i").test(text);
}

// ---------------------------------------------------------------------------
// Behavioral standard contract
// ---------------------------------------------------------------------------

/**
 * What THE STANDARD must actually say. Four fields, each answering a question a
 * participant would have to answer to know whether they did it:
 *
 *   actor             who performs the behavior
 *   trigger           the moment it must happen
 *   observableAction  what another person can see or hear the actor doing
 *   completionSignal  what confirms it is finished
 *
 * The model PROPOSES this for Host review. It asserts nothing about an organizational
 * policy already existing.
 */
/**
 * HOW COMPLETION IS RECOGNISED — SERVER-OWNED, FROM THE HOST (Slice 3.2P-R3.4-R1).
 *
 * R8 split this into `confirmedBy` + `confirmationAction`, on the reasoning that a named
 * confirmer makes the sentence's subject structural rather than hoped for. That fixed the
 * grammar and created a worse problem: the model had to NAME A PERSON, and
 * `ARTIFACT_OR_CONSTRUCT_HEAD` refused artifact heads, so any Host whose evidence is
 * agentless left the model no legal answer but to invent someone. W3 and W4 both did — a
 * "team lead" and a "records manager" the source never mentions.
 *
 * R3.3 measured that contradiction and R3.4 measured the way out: across all 34 real drafts,
 * the Host's own `successEvidence` is directly usable as the completion criterion for the
 * clear majority, and it already covers every shape the two-field form could not — an
 * artifact ("The huddle note records one owner and one deadline"), a system ("Supervisors
 * can access the software…"), an explicitly observed human ("A dentist observes … and
 * confirms"), a relational counterpart, and Korean.
 *
 * So completion stops being something the model authors and becomes something the server
 * carries: ONE string, the Host's sentence, never decomposed into person / role / artifact /
 * system. Nothing about generation needs that decomposition, and every attempt at it
 * manufactured a responsibility nobody assigned.
 */
export type CompletionAuthority = {
  /**
   * The Host's own `successEvidence`, verbatim. Rendered as a standalone sentence rather
   * than forced under "when …", because that is the only frame every real shape survives —
   * including Korean, which has no grammatical connection to an English subordinator.
   */
  criterion: string;
};

export type BehaviorContract = {
  actor: string;
  trigger: string;
  observableAction: string;
  completion: CompletionAuthority;
};

/**
 * Bounded so the RENDERED sentence cannot exceed the 700-character element ceiling:
 * four fields at 160 plus the connective text is ~665. Without this the standard could
 * validate as a contract and then overflow as content.
 */
export const CONTRACT_FIELD_LIMIT = 160;
const CONTRACT_FIELD_MIN = 3;

/**
 * The DIAGNOSTIC vocabulary, deliberately decoupled from `keyof BehaviorContract`. The live
 * CHECK on `behavior_contract_field` (migration 20260810000000) pins these four values, so
 * restructuring the contract must not silently change what the ledger can store —
 * `completionSignal` now names the whole completion authority rather than one string.
 */
export type ContractField = "actor" | "trigger" | "observableAction" | "completionSignal";

export const CONTRACT_FIELDS: readonly ContractField[] = ["actor", "trigger", "observableAction", "completionSignal"];

/**
 * The stored spelling of a contract role. The domain speaks camelCase and the provider
 * contract speaks snake_case; the ledger follows the provider, because that is the name a
 * reader will be holding when they look a refusal up.
 */
export const CONTRACT_FIELD_STORAGE: Record<ContractField, string> = {
  actor: "actor",
  trigger: "trigger",
  observableAction: "observable_action",
  completionSignal: "completion_signal",
};

/**
 * Every reason a behaviour-contract refusal has EVER carried. Closed vocabulary, never prose.
 *
 * WIDER THAN THE CURRENT RUNTIME, deliberately (Slice 3.2P-R3.4-R1). This is the ledger's
 * vocabulary, and the ledger holds history: `confirmer_unauthorized` is on a real W4 row, and
 * `not_a_role` / `no_confirmation` / `meta_only` are how completion used to fail. v11 removed
 * model authority over completion, so no current path can emit those four for
 * `completionSignal` — but a stored refusal must stay readable, and shrinking this list to
 * match today's runtime would make old rows undecodable and the CHECK constraint disagree
 * with the code. Removing a reason is a data-loss decision, not a cleanup.
 */
export const CONTRACT_DEFECT_REASONS = [
  "missing", "too_long", "meta_only", "not_a_role", "no_moment", "no_confirmation",
  /** Slice 3.2P-R2.1 — the action is a QUESTION. See `isInterrogativeAction`. */
  "interrogative_action",
  /**
   * Slice 3.2P-R3.2 — the role does not trace to the Host's authority.
   *
   * A SOURCE-authority fault rather than a shape fault, so it is decided where the source is in
   * scope (`validateProgramProposal`), not inside `validateBehaviorContract`.
   */
  /**
   * Slice 3.2P-R3.2-R1 — the confirmer is a responsibility-bearing person the source never
   * named. There is deliberately no `actor_unauthorized` beside it: the actor is server-written
   * (`CANONICAL_ACTOR`), so the model has nothing left to get wrong there.
   */
  "confirmer_unauthorized",
  /**
   * Slice 3.2P-R3.7 — the action reclaimed an authority it does not hold.
   *
   * ONE reason for both leaks, because they are one fault: the model wrote a part of the
   * sentence the server composes. W6 proved it with WHEN ("…during morning huddles" after the
   * server had already said it) and the same audit proved WHO ("you must you state…").
   * Splitting them would imply the Host or the product could act on the difference; they
   * cannot — the response is refused either way and the field is rewritten from scratch.
   */
  "action_reclaims_authority",
] as const;

/** Which field failed, so a refusal is diagnosable without echoing model prose. */
export type ContractDefect = { field: ContractField; reason: (typeof CONTRACT_DEFECT_REASONS)[number] };

/**
 * THE MODEL HAS NO FIELD FOR A SUBJECT (Slice 3.2P-R3.7-R2).
 *
 * R3.7 refused a subject it could SEE — a pronoun or a determiner — and measurement showed that
 * is as far as a free string goes. `team members name the owner` differs from `name the team
 * members who own each item` only by word order and by knowing that *team* is a noun and *name*
 * is a verb, which is lexical knowledge this system will not build. Scored across 28 real and
 * adversarial actions, the only heuristic that caught the bare-noun subjects also refused
 * `write owner and deadline in the note` — a real behaviour. Refusing real work to catch a leak
 * is the worse trade.
 *
 * So the leak stops being detectable and starts being unrepresentable. The model returns the
 * verb HEAD and the rest of the phrase separately, and the server composes them immediately
 * after `must`. There is no position for a subject to occupy.
 *
 *   state  + "the owner and deadline"          → "you must state the owner and deadline"
 *   follow + "up with the owner"               → "you must follow up with the owner"
 *   sign   + "off on the checklist"            → "you must sign off on the checklist"
 *
 * `action_detail` is deliberately NOT "the object": phrasal verbs put a particle there, and
 * forcing a grammatical object would mean inventing one.
 */

/** Function words that cannot be a verb head, whatever else they are. */
const NOT_A_VERB_HEAD = new Set([
  "you", "i", "we", "they", "he", "she", "it", "me", "us", "them", "him", "her",
  "the", "a", "an", "this", "that", "these", "those",
  "my", "your", "our", "their", "his", "its",
  "each", "every", "all", "both", "some", "any", "no",
]);

/** A Korean subject marker — the particle that makes an eojeol the SUBJECT, never the verb. */
const KOREAN_SUBJECT_PARTICLE = /(?:이|가|은|는|께서)$/;

export type ActionVerbDefect = "missing" | "not_one_word" | "not_a_verb_head" | "not_base_form";

/**
 * Is this a single lexical verb head? Shape only — no dictionary, and no claim to know what
 * verbs exist.
 *
 * THE RESIDUAL, STATED: `action_verb: "team"` with `action_detail: "members name the owner"` is
 * a real base form followed by a real phrase, and nothing here can prove it wrong. It is not so
 * much a subject leak as nonsense in a field labelled `verb`, and closing it needs the lexicon
 * this system does not have. It is not closed, and this comment is the honest record of that.
 */
export function actionVerbDefect(verb: string): ActionVerbDefect | null {
  const v = verb.trim();
  if (v.length === 0) return "missing";
  // A subject is almost always more than one word — "team members", "each team member",
  // "직원들이 담당자를". One token makes those unrepresentable rather than merely refused.
  if (/\s/.test(v)) return "not_one_word";
  const lower = v.toLowerCase();
  if (NOT_A_VERB_HEAD.has(lower)) return "not_a_verb_head";
  if (KOREAN_SUBJECT_PARTICLE.test(v) && /[\uac00-\ud7a3]/.test(v)) return "not_a_verb_head";
  /*
    BASE FORM, via the de-inflection the renderers already use. This is what catches a bare
    plural-noun subject without knowing it is a noun: `leaders` reduces to `leader` and
    `supervisors` to `supervisor`, exactly as `states` reduces to `state`. A word that changes
    under de-inflection was not written as a verb head following "must".
  */
  if (baseForm(lower) !== lower) return "not_base_form";
  return null;
}

/**
 * THE ONE ASSEMBLY PATH (Slice 3.2P-R3.7-R2).
 *
 * Every renderer consumes `observableAction`; none of them sees the two fields. Composition
 * happens once, here, so a second reconstruction cannot drift from this one.
 *
 * DELIBERATELY LOCALE-FREE, and that is a measurement rather than a preference: the derived
 * instructional renderers in this module take no locale and never have. They compose English
 * scaffolding — "you must", "Completion evidence:", "The next time this happens" — around
 * whatever the host and the model wrote, in any language. Adding a locale-aware join here would
 * be inventing Korean support the surrounding sentences do not have, and would hide the real
 * limitation instead of leaving it visible. THE PRE-EXISTING LIMITATION, recorded honestly: a
 * Korean program renders Korean content inside English sentence frames.
 */
export function composeObservableAction(verb: string, detail: string): string {
  const v = verb.trim();
  const d = detail.trim();
  return d.length > 0 ? `${v} ${d}` : v;
}

/**
 * THE ACTION MUST BE THE ACTION, AND NOTHING ELSE (Slice 3.2P-R3.7).
 *
 * W6 succeeded and was unusable. The proposal read:
 *
 *   "During morning huddles, you must state the owner, action, and deadline for each agreed
 *    item DURING MORNING HUDDLES."
 *
 * The model had written the Host's own occasion into `observable_action`, and the renderer —
 * which owns the moment — prepended it again. Measured afterwards, EVERY leak of every
 * server-owned role was accepted: "you state the owner…" rendered as "you must you state…",
 * "the leader states…" as "you must the leader states…", "at the next huddle, name an owner" as
 * "you must at the next huddle, name an owner".
 *
 * The prompt already said not to. The validator never asked. A rule that lives only in prose is
 * a rule with a floor of zero, which is the failure this arc keeps returning to.
 *
 * Since v13 the server supplies WHO, WHEN and COMPLETION. So the model's one field is a BARE
 * VERB PHRASE — what a person is seen or heard doing, as it would follow "must".
 */

/**
 * A SUBJECT the sentence already has (`you must …`).
 *
 * HIGH-CONFIDENCE SHAPES ONLY, and the boundary is stated rather than hidden. A verb phrase
 * begins with its verb; recognising that in general needs a lexicon this system will not build.
 * What it can recognise without one is the two ways a subject announces itself structurally:
 *
 *   a pronoun          "you state …", "they name …"
 *   a determiner       "the leader states …", "each member confirms …"
 *
 * RESIDUAL, deliberately left open: a bare plural noun subject — "team members name the owner"
 * — begins with neither, and separating it from a verb requires knowing that "team" is not one.
 * The prompt asks for the base form; this catches the shapes it can prove.
 */
const ACTION_HAS_SUBJECT =
  /^\s*(?:you|i|we|they|he|she|it|the|a|an|this|that|these|those|my|your|our|their|his|her|its|each|every|all|both|some|any)\b/i;

/**
 * A TEMPORAL ADJUNCT — the action saying WHEN, which the Host already answered.
 *
 * SHAPE, NOT VOCABULARY. The naive rule ("reject `daily`, `weekly`, `morning`") refuses ordinary
 * objects: "write the daily schedule", "record the morning reading", "complete the evening
 * checklist" are all actions, not occasions. Those same words are ADJECTIVES under a determiner
 * and ADVERBIALS without one, and that position is what this reads.
 *
 * Three shapes, each unambiguous on its own:
 *
 *   1. an unambiguously temporal head — `during`, `whenever`, `while`, `each/every time`,
 *      `as soon as`, `upon`, `until`. None of these introduces an object.
 *   2. a temporal preposition pointing at an ordinal/quantified occasion — "at the next huddle",
 *      "before each shift", "after the meeting ends, …". Plain `in the shared note` and
 *      `before signing off` are untouched: the complement is not `next|each|every|start|end`.
 *   3. a frequency adverbial — `every|each` + a CALENDAR unit, or a bare `-ly` adverb in
 *      adverbial position. The unit list is closed and universal (minute…year, shift, time); it
 *      is not a list of workplace occasions, and nothing in it is domain-specific.
 *
 * `every agreed action` is quantification over ITEMS, not time, and passes — which is why the
 * frequency rule names time units instead of accepting any `every`.
 */
const TIME_UNIT = "(?:morning|afternoon|evening|night|day|week|weekend|month|quarter|year|hour|minute|shift|time)s?";
const TEMPORAL_HEAD =
  /(?:^|[\s,;(])(?:during|whenever|while|until|as\s+soon\s+as|upon|each\s+time|every\s+time|any\s+time|anytime)\b/i;
const TEMPORAL_PREPOSITION =
  /(?:^|[\s,;(])(?:at|on|in|before|after|by|from)\s+(?:the\s+)?(?:next|each|every|following|start|end|beginning|close|first|last)\b/i;
/*
  THE `-ly` WORD IS THE HARD ONE, and position is what settles it. Measured: a first attempt
  flagged "write the daily schedule", "update the weekly report" and "enter the weekly total in
  the log" — three ordinary objects — because it matched the word anywhere. Those same words are
  ADJECTIVES in front of the noun they modify and ADVERBS when nothing follows them, so the rule
  fires only in adverbial position: phrase-final, or closing on punctuation.

    "report the total weekly"        → adverbial → WHEN
    "write the daily schedule"       → attributive → an object, untouched
*/
const FREQUENCY_ADVERBIAL = new RegExp(
  `(?:^|[\\s,;(])(?:every|each)\\s+${TIME_UNIT}\\b` +
    `|(?:^|[\\s,;(])(?:daily|weekly|monthly|hourly|nightly|yearly|annually)(?=[,.;)]|\\s*$)`,
  "i",
);
/** A leading subordinate clause that closes on a comma — "after the meeting ends, record it". */
const LEADING_TIME_CLAUSE = /^\s*(?:when|once|as|after|before|at|on)\b[^,]{0,80},/i;

/** Does this action name WHEN, which the Host owns? */
export function actionNamesMoment(action: string): boolean {
  const a = action.trim();
  if (a.length === 0) return false;
  return (
    TEMPORAL_HEAD.test(a) ||
    TEMPORAL_PREPOSITION.test(a) ||
    FREQUENCY_ADVERBIAL.test(a) ||
    LEADING_TIME_CLAUSE.test(a)
  );
}

/** Does this action supply its own subject, when the sentence already has one? */
export function actionNamesActor(action: string): boolean {
  return ACTION_HAS_SUBJECT.test(action.trim());
}

/**
 * THE ACTION IS A QUESTION (Slice 3.2P-R2.1) — the rule now lives in
 * `observableStandardShape`, because R4-R1A found the same defect arriving by a second road: a
 * HOST-typed question copied verbatim into `observable_standard`. `program-coherence` already
 * imports `journey`, so the shared floor could not be imported the other way; it was extracted
 * rather than duplicated. Re-exported here so every 3.2P caller and fixture is unchanged.
 */
export { isInterrogativeAction };

/**
 * Creating or adopting a construct, stated as the behavior itself. This is the exact live
 * defect: "a shared handoff standard is created and utilized" describes the STANDARD's
 * life cycle, not a person's observable action.
 */
const CONSTRUCT_CREATION_ACTIVE = new RegExp(
  `\\b(?:create|creates|creating|created|develop|develops|developing|developed|implement|implements|implementing|implemented|establish|establishes|establishing|established|design|designs|designing|designed|build|builds|building|built|draft|drafts|drafting|drafted|adopt|adopts|adopting|adopted|introduce|introduces|introducing|introduced|roll\\s+out|set\\s+up|sets\\s+up|setting\\s+up|put\\s+in\\s+place|agree\\s+on|agrees\\s+on|agreeing\\s+on|contribute\\s+to|contributes\\s+to|contributing\\s+to|utilis\\w*|utiliz\\w*)\\b[^.]{0,60}?\\b(?:${CONSTRUCT_ALT})\\b`,
  "i",
);

/**
 * The PASSIVE form, and the one that actually shipped: "a shared handoff standard IS
 * CREATED and utilized by team members". The construct comes first and the verb second, so
 * an active-voice pattern alone never sees it — which is exactly how this sentence reached
 * a Founder's screen.
 */
const CONSTRUCT_CREATION_PASSIVE = new RegExp(
  `\\b(?:${CONSTRUCT_ALT})\\b[^.]{0,40}?\\b(?:is|are|was|were|be|been|being|gets?|becomes?)\\s+(?:\\w+\\s+){0,2}?(?:created|developed|implemented|established|designed|built|drafted|adopted|introduced|utilis\\w*|utiliz\\w*|used|followed|applied|maintained|put\\s+in\\s+place|set\\s+up|rolled\\s+out)\\b`,
  "i",
);

/** Either voice. A construct's own life cycle is never a person's observable action. */
const CONSTRUCT_LIFECYCLE_CLAIM = (text: string): boolean =>
  CONSTRUCT_CREATION_ACTIVE.test(text) || CONSTRUCT_CREATION_PASSIVE.test(text);

/**
 * The whole action is nothing but "use the construct". Following a standard IS the point,
 * so this is only a defect when no visible behavior accompanies it — "uses the shared
 * handoff standard" tells the participant nothing they could be observed doing.
 */
const BARE_CONSTRUCT_USE = new RegExp(
  `^(?:will\\s+|actively\\s+|consistently\\s+|always\\s+){0,2}(?:use|uses|using|follow|follows|following|apply|applies|applying|refer\\s+to|refers\\s+to)\\s+(?:the|a|an|our|their|this|that)?\\s*(?:[\\w'-]+\\s+){0,3}(?:${CONSTRUCT_ALT})\\s*\\.?$`,
  "i",
);

/** A moment, not a mood. The trigger has to place the behavior in time or situation. */
const MOMENT_MARKER =
  /\b(?:when|whenever|before|after|during|while|as\s+soon\s+as|at\s+the\s+(?:start|end|beginning|close)|each|every|any\s+time|anytime|upon|on\s+(?:arrival|handover|handoff|completion|leaving)|at\s+(?:handover|handoff|shift|the\s+point)|in\s+the\s+moment|prior\s+to|by\s+the\s+end)\b|때|전에|후에|마다/i;

/** Something a second person could witness or record. */
const CONFIRMATION_MARKER =
  /\b(?:confirm\w*|acknowledg\w*|receipt|received|receives|repeat\w*|read\s+back|reads\s+back|sign\w*|verif\w*|check\w*|reply|replies|replied|respond\w*|response|states\s+back|summari\w*|agrees?|agreed|record\w*|logg?\w*|documented|notes?\s+back|no\s+questions?\s+remain|questions?\s+are\s+answered|both\s+(?:people|parties)|the\s+(?:other|receiving|incoming|oncoming)\s+(?:person|colleague|member|team)|recipient|hands?\s+back|marked\s+complete|ticks?\s+off|visible\s+to)\b|확인|서명|기록/i;

/** A role or person, not a thing. */
const ARTIFACT_OR_CONSTRUCT_HEAD = new RegExp(`\\b(?:${ARTIFACT_ALT}|${CONSTRUCT_ALT})\\b\\s*$`, "i");

const trimField = (v: unknown): string => (typeof v === "string" ? v.replace(/\s+/g, " ").trim() : "");

/**
 * Deterministically decide whether a proposed contract describes a real, observable,
 * repeatable behavior. Every rule below tests a DIFFERENT property — deliberately not one
 * proxy wearing four hats. Word count, passive voice, keyword overlap and "contains a verb"
 * were each rejected as the sole signal: the live sentence passes all four.
 */
/**
 * WHAT THE SERVER SUPPLIES, and the model cannot (Slice 3.2P-R3.6-R1).
 *
 * Three of the contract's four roles are now Host or product authority. They are passed IN
 * rather than read off the response, so no shape the model can return reaches them — a
 * `trigger`, `actor` or `completion` key on `raw` is IGNORED, not merged, not validated.
 */
export type ServerBehaviorAuthority = {
  /** From the Host's audience, via `CANONICAL_ACTOR`. Always the second person. */
  actor: string;
  /** From the Host's `recurringMoment`, verbatim. The program's one occasion. */
  trigger: string;
  /** From the Host's `successEvidence`, verbatim. Grounds WHAT SUCCESS LOOKS LIKE and nothing else. */
  criterion: string;
};

export function validateBehaviorContract(
  raw: unknown,
  server: ServerBehaviorAuthority,
): { ok: true; value: BehaviorContract } | { ok: false; defect: ContractDefect } {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    return { ok: false, defect: { field: "observableAction", reason: "missing" } };
  }
  const r = raw as Record<string, unknown>;
  const value: BehaviorContract = {
    actor: trimField(server.actor),
    trigger: trimField(server.trigger),
    observableAction: trimField(r.observable_action ?? r.observableAction),
    completion: { criterion: trimField(server.criterion) },
  };

  /*
    ONLY THE MODEL'S FIELD CARRIES THE MODEL'S BOUNDS. `CONTRACT_FIELD_LIMIT` exists to keep the
    RENDERED sentence inside the element ceiling, and it was written when four fields were the
    model's to overrun. The Host's moment and evidence are bounded where the Host writes them
    (`RECURRING_MOMENT_MAX`, `EVIDENCE_MAX`); refusing a generation because a Host wrote a long
    phrase would blame the model for the source. Length is caught on the rendered section.
  */
  if (value.observableAction.length < CONTRACT_FIELD_MIN) {
    return { ok: false, defect: { field: "observableAction", reason: "missing" } };
  }
  if (value.observableAction.length > CONTRACT_FIELD_LIMIT) {
    return { ok: false, defect: { field: "observableAction", reason: "too_long" } };
  }
  if (value.trigger.length < CONTRACT_FIELD_MIN) return { ok: false, defect: { field: "trigger", reason: "missing" } };
  /*
    The criterion is the HOST's sentence, so it is checked for presence and nothing else. It
    carries no upper bound here: `CONTRACT_FIELD_LIMIT` exists to keep the model's four fields
    inside the rendered element ceiling, and refusing a generation because the Host wrote a
    long evidence sentence would blame the model for the source. Length is caught where it
    actually matters, on the rendered section (`derived_too_long` / `LIMITS.content`).
  */
  if (value.completion.criterion.length < CONTRACT_FIELD_MIN) {
    return { ok: false, defect: { field: "completionSignal", reason: "missing" } };
  }

  /*
    NO ACTOR RULE, NO MOMENT RULE (Slice 3.2P-R3.6-R1). `not_a_role` guarded against the model
    making a construct perform itself, and `no_moment` against a trigger that named no time.
    Both policed model prose. The actor is now `CANONICAL_ACTOR` and the trigger is the Host's
    own phrase, already checked for repeatability at the source boundary — running a floor over
    the Host's words here would refuse the source in the model's name.

    Their reasons stay in `CONTRACT_DEFECT_REASONS` for the ledger rows that hold them.
  */

  // The action is a behavior, not the construct's own life cycle, and not a bare
  // instruction to follow something unspecified.
  if (CONSTRUCT_LIFECYCLE_CLAIM(value.observableAction) || BARE_CONSTRUCT_USE.test(value.observableAction)) {
    return { ok: false, defect: { field: "observableAction", reason: "meta_only" } };
  }

  /*
    …and it is a statement, not a question. Separate from `meta_only` on purpose: a question
    is not a claim about a construct's life cycle, it is a different failure with a different
    cause (a question-shaped Host answer copied through), and collapsing the two would make
    the ledger say something untrue about which rule fired.
  */
  if (isInterrogativeAction(value.observableAction)) {
    return { ok: false, defect: { field: "observableAction", reason: "interrogative_action" } };
  }

  /*
    …and it is the ACTION ALONE (Slice 3.2P-R3.7). The sentence around it already says who acts
    and when, from the Host's own answers, so an action that says either produces "you must you
    state…" or "During morning huddles, you must … during morning huddles" — both of which W6
    shipped to a Founder. Not repairable: a model that reclaims a settled authority is not one
    sentence away from right, and offering it a creative retry invites the same move again.
  */
  if (actionNamesActor(value.observableAction) || actionNamesMoment(value.observableAction)) {
    return { ok: false, defect: { field: "observableAction", reason: "action_reclaims_authority" } };
  }

  /*
    NOTHING ELSE IS ASKED OF THE CRITERION (Slice 3.2P-R3.4-R1).

    Three rules used to live here — `meta_only` on the confirming act, `not_a_role` on the
    confirmer, `no_confirmation` on the marker word. All three policed MODEL prose. Turned on
    the Host's own evidence they would refuse the corpus: `not_a_role` rejects every artifact
    a Host actually named, and R3.4 measured `CONFIRMATION_MARKER` refusing perfectly good
    evidence ("Feedback forms are completed after role-playing sessions") because it knows
    `record` and `confirm` but not `complete` or `submit`.

    Their reasons stay in `CONTRACT_DEFECT_REASONS` because the ledger already holds rows that
    used them. Nothing on the current path can emit them.
  */
  return { ok: true, value };
}

const stripTrailingStop = (s: string): string => s.replace(/[.。]+\s*$/, "");
const lowerFirst = (s: string): string => (s.length > 0 ? s[0].toLowerCase() + s.slice(1) : s);
const upperFirst = (s: string): string => (s.length > 0 ? s[0].toUpperCase() + s.slice(1) : s);


// ---------------------------------------------------------------------------
// Grammar authority (Slice 3.2L-R6.2)
// ---------------------------------------------------------------------------

/**
 * THE PHYSICAL DEFECT. On a real iPhone the Founder set the actor to "Doctors" and read:
 *
 *   IN CONTEXT   "doctors faces two colleagues…"
 *   APPLY IT     "doctors states each unfinished task…"
 *   YOUR DECISION "I will … starting at your next shift change."
 *   WHAT HAPPENS NEXT "what you actually said when you say it blunt."
 *
 * Every one is BTY's sentence composition, not the Host's meaning. The renderers pasted a
 * free-text actor label directly in front of a THIRD-PERSON-INFLECTED action, so they were
 * silently betting on the actor's grammatical number — a bet no free-text field can settle.
 *
 * THE FIX is to stop betting. The action is normalised to a BASE form and always follows a
 * modal ("must"), which is invariant across person and number: "the outgoing nurse must
 * state", "doctors must state", "everyone on the closing team must state". No renderer
 * chooses between faces/face or states/state ever again.
 */

/**
 * Function words that end in -s and would be corrupted by an agreement strip. Short tokens
 * are excluded by length; these are the ones long enough to slip through.
 */
const S_FINAL_FUNCTION_WORDS = new Set(["hers", "ours", "yours", "theirs", "this", "thus", "plus", "less", "unless"]);

/**
 * WHO THE PARTICIPANT IS — SERVER-WRITTEN (Slice 3.2P-R3.2-R1, sole authority since R3.6-R1).
 *
 * Every participant-facing sentence addresses the learner directly. The Host's audience already
 * decides who that is, so a model label naming the population was a second answer to a settled
 * question — and W3 gave a different one, calling a `leaders` training "a team member".
 *
 * R3.2-R1 kept the model's label and overwrote it. R3.6-R1 removed the field: the actor is now
 * passed into `validateBehaviorContract` as server authority, so there is nothing to overwrite
 * and nothing for the model to get wrong.
 */
export const CANONICAL_ACTOR = "you";

/**
 * The action as it appears after a modal.
 *
 * The HEAD verb is de-inflected, and — only when the head actually WAS inflected — so is a
 * verb immediately following a coordinating conjunction. A compound action is common
 * ("states each unfinished item and identifies its next owner") and rendering it as
 * "must state … and identifies …" is the same knowingly-malformed output R6.4 removed for
 * shouted verbs.
 *
 * The second reduction is deliberately timid: it only fires when the phrase was already
 * third-person, only on the token directly after the conjunction, only when that token is
 * at least four characters, and never on an -s function word. So "and its deadline" and
 * "and their owner" are untouched, which is what matters — corrupting the Host's nouns
 * would be worse than the awkwardness being fixed.
 */

export function baseActionPhrase(action: string): string {
  const t = stripTrailingStop(action.trim());
  if (t.length === 0) return t;
  const words = t.split(/\s+/);
  const head = baseForm(words[0]);
  const headWasInflected = head !== words[0].toLowerCase() || head !== words[0];
  const out = [head, ...words.slice(1)];
  if (headWasInflected) {
    for (let i = 1; i < out.length - 1; i++) {
      if (!/^(?:and|or|then)$/i.test(out[i])) continue;
      const next = out[i + 1];
      if (next.length < 4 || S_FINAL_FUNCTION_WORDS.has(next.toLowerCase()) || !/s$/i.test(next)) continue;
      const reduced = baseForm(next);
      if (reduced !== next.toLowerCase()) out[i + 1] = reduced;
    }
  }
  return out.join(" ");
}

/**
 * Can this value function as an action phrase after a modal? Deliberately permissive: a
 * colloquial Host phrase like "Say it blunt" is fine and must NOT be editorialised. What is
 * refused is a value with no verb-shaped head at all — punctuation, a bare number — which
 * would emit "doctors must ..." with nothing after it.
 */
export function isRenderableAction(action: string): boolean {
  const phrase = stripTrailingStop(action.trim());
  if (phrase.length < 2) return false;
  const head = phrase.split(/\s+/)[0] ?? "";
  return /^[\p{L}][\p{L}'-]*$/u.test(head);
}

/**
 * A context fragment rendered without a doubled preposition. "during a team meeting" keeps
 * its own; "the last ten minutes of a shift" gets "In". v5 prefixed unconditionally and
 * produced "In during a team meeting just before a project deadline".
 */
export function contextClause(context: string): string {
  const c = stripTrailingStop(context.trim());
  if (c.length === 0) return "";
  if (LEADING_TIME_WORD.test(c)) return upperFirst(c);
  return `In ${lowerFirst(c)}`;
}

/**
 * THE one completion sentence (Slice 3.2P-R3.4-R1).
 *
 * A STANDALONE SENTENCE, not a subordinate clause. "It is complete when you see X do Y"
 * needed a grammatical subject and a bare infinitive, which is precisely what forced a person
 * to be invented. The Host's evidence arrives in every shape English and Korean allow — a
 * declarative about an artifact, a passive about a form, a Korean noun phrase — and no "when
 * …" frame survives all of them:
 *
 *   when the huddle note records one owner …     ✓
 *   when a checklist review form is signed off … ✓
 *   when 바른 자세로 앉기                          ✗   ungrammatical, and not ours to fix
 *
 * A labelled sentence survives all of them, and preserves the Host's wording exactly — which
 * is the point: this is their sentence, not a paraphrase of it.
 */
export function renderCompletionEvidence(c: CompletionAuthority, locale?: JourneyLocale): string {
  const criterion = stripTrailingStop(c.criterion.trim());
  if (criterion.length === 0) return "";
  /*
    THE LABEL IS BTY'S, THE SENTENCE IS THE HOST'S (Slice R4-R5C13). Only the lead-in and the
    casing move with locale; `criterion` is interpolated exactly as written, in whatever
    language the Host wrote it. `lead` is gone as a parameter — R4-R5C11 left exactly one
    caller and one label, and a locale table is the wrong place to accept an arbitrary one.
  */
  return journeyCopy(locale).completionEvidence(criterion);
}

/**
 * ONE CRITERION, IN ONE PLACE (Slice R4-R5C11).
 *
 * THE ASSUMPTION THIS REPLACES, and why it was wrong. R3.4-R1 found the same criterion closing
 * THE STANDARD, IN CONTEXT, APPLY IT and WHY THIS MATTERS verbatim, and treated the defect as
 * SAMENESS OF WORDING — so it gave each section its own lead-in and kept all four copies. A
 * real learner then read one of those programs and reported being shown the answer repeatedly
 * and asked to type it back. Varying the four words in front of a repeated sentence does not
 * make it a second thing to think about; the participant was reading the criterion four times
 * either way.
 *
 * So the copies are gone rather than relabelled. The criterion is rendered by THE STANDARD,
 * whose behaviour contract it is a field of, and it is the Host's own subject in WHAT SUCCESS
 * LOOKS LIKE. No other section states it. The criterion itself is still never touched.
 */
/* The lead-in moved to `journeyLocaleCopy` in R4-R5C13 — one label, now in two languages. */

/** A moment that already begins with its own time preposition needs nothing added. */
const LEADING_DETERMINER = /^(?:the|a|an|my|your|our|their|his|her|its|each|every|this|that)\b/i;

const LEADING_TIME_WORD =
  /^(?:at|in|on|during|before|after|when|whenever|while|as|by|once|every|each|throughout|upon|next\s+time)\b/i;

/**
 * Strip ONLY a leading preposition + possessive, so a stored moment carries no participant
 * perspective of its own. Deliberately anchored: a global your → my replacement would
 * rewrite the inside of the Host's own prose, which is not ours to touch.
 */
export function momentCore(moment: string): string {
  return stripTrailingStop(moment.trim()).replace(/^(?:at|in|on)\s+(?:your|my|our|their|his|her)\s+/i, "");
}

/*
  `momentClause` IS GONE (Slice 3.2P-R3.7). It re-cased the host's moment and attached an English
  preposition per section — "At my next shift change" / "At the next shift change". Every caller
  now states the host's phrase verbatim instead, because the one thing this product must not do
  with a host's own words is quietly rewrite them. `momentCore` survives: `momentTokens` still
  uses it to compare two moments, which is reading, not rewriting.
*/

/**
 * THE participant-facing sentence, DERIVED from the contract rather than authored beside
 * it. One source of truth: there is no way for the displayed standard to say something the
 * structured contract does not, because the display IS the contract.
 *
 * The alternative — let the model write the sentence and verify it "materially represents"
 * the four fields — was rejected. Any check strong enough to catch a faithful-looking
 * paraphrase is a semantic equivalence test, and a weak one (shared keywords) is exactly
 * the kind of proxy that let the live sentence through.
 */
/**
 * NO LONGER A LEARNER-FACING PATH (Slice R4-R5C14A).
 *
 * THE STANDARD the learner reads is the Host's own `observableBehavior`, carried verbatim by
 * `deriveInstructionalContent`. This composition survives as what it always also was — a
 * derived-length backstop and a shape the contract tests assert over — and as the record of what
 * the section used to say. Nothing displays it. It is deliberately NOT deleted and deliberately
 * NOT localized: repairing the English actor and the English verb order inside a string no
 * participant reads would be work spent on an obsolete rendering.
 */
export function renderStandardSentence(c: BehaviorContract, locale?: JourneyLocale): string {
  const trigger = stripTrailingStop(c.trigger.trim());
  const actor = stripTrailingStop(c.actor.trim());
  const action = baseActionPhrase(c.observableAction);
  const copy = journeyCopy(locale);
  return `${copy.standard(trigger, actor, action)} ${renderCompletionEvidence(c.completion, locale)}`.trimEnd();
}

/**
 * A standard sentence that describes a construct being created or used instead of a
 * behavior being performed. Used where there is no contract to inspect — a Host rewrite —
 * so the same defect cannot re-enter through the edit surface.
 */
export function isMetaStandardText(text: string): boolean {
  const t = text.replace(/\s+/g, " ").trim();
  if (t.length === 0) return true;
  /**
   * A construct life-cycle claim with nothing a second person could witness.
   *
   * The time marker deliberately does NOT redeem it. The live sentence carried one —
   * "during all relevant transitions of work" — and was still meta: saying WHEN a standard
   * gets created adds no observable behavior.
   */
  if (CONSTRUCT_LIFECYCLE_CLAIM(t) && !CONFIRMATION_MARKER.test(t)) return true;
  if (BARE_CONSTRUCT_USE.test(t)) return true;
  return false;
}

// ---------------------------------------------------------------------------
// Behavior-grounded scenario contract (Slice 3.2L-R5)
// ---------------------------------------------------------------------------

/**
 * THE LIVE FALSE NEGATIVE. The R4 window produced a valid behavior contract and was then
 * refused `scenario_unrelated` — a rule that asked only whether the scenario shared a word
 * with the Host's problem statement:
 *
 *   max(overlap(scenario, "Create a shared handoff standard."),
 *       overlap(scenario, "Our handoffs are inconsistent.")) >= 0.12
 *
 * `overlapRatio` keeps tokens longer than three characters and divides by the SMALLER set,
 * so against references of four and two tokens the threshold collapsed to "share at least
 * one word". There is no stemmer, so `handoff` and `handoffs` are different tokens. A
 * scenario written as a handover, about the person taking over, shares nothing — and a
 * scenario about the office coffee machine that happens to say "standard" would have
 * passed. That is vocabulary coincidence, not relevance.
 *
 * THE REPAIR is not a bigger word list. A scenario is relevant because it exercises the
 * behavior the program already defined, so it is DERIVED from the behavior contract. The
 * model supplies only what the contract cannot: what makes the moment hard, and where it
 * happens.
 */
/**
 * TRIGGER-ANCHORED SCENARIO (Slice 3.2L-R8.1).
 *
 * v6 gave the scenario its own `contextDetail` — "where and when it happens" — and rendered
 * it as the leading clause. The live v5 proposal used that to open at "during a team meeting
 * just before a project deadline" while the behaviour was required "at the end of each
 * project or task", and R8 joined them with "Even then, …". Grammatical, and still two
 * different events: the participant never rehearses the trained action at the moment the
 * standard requires it.
 *
 * A lexical overlap check between the two moments would not fix this — two related-sounding
 * occasions share words and are still different occasions. So the SECOND MOMENT IS REMOVED
 * FROM THE CONTRACT. There is exactly one moment in a program — the behaviour trigger — and
 * the scenario may only say what makes holding the behaviour hard AT that moment. It cannot
 * relocate the action, because it has nowhere to relocate it to.
 */
/**
 * THE PRESSURE FRAMES — the model chooses the difficulty, the server writes it
 * (Slice 3.2P-A7-R2).
 *
 * WHAT FORCED THIS. A7 (`309c2bb1`) is the complete experiment. Its first call named an
 * occasion of its own; the licensed patch — narrow, freeze-clean, merged, revalidated — was
 * told in its own opening sentence that it had put the situation at a different time, was
 * given all seventeen difficulty families, and returned 32 tokens naming ANOTHER occasion.
 * Explicit prompt, correct validator, sound repair, same defect twice in one attempt.
 *
 * Detection was never the problem: `namesIndependentMoment` caught both. The problem is that a
 * free-text field can hold a time at all, and no amount of instruction removes that.
 *
 * So WHEN stops being something the model can express. It selects a KIND of difficulty from
 * this closed set and the server writes the sentence — the same move that made a subject
 * unrepresentable in R3.7-R2 by splitting `action_verb` from `action_detail`.
 *
 * DERIVED FROM MEASUREMENT, not from a tidy taxonomy. The 49 labelled legitimate pressures
 * across the A3-R2 and A5-R1 corpora all map to one of these twelve, every frame is used by at
 * least one, and none of the fourteen labelled non-pressures or eight relocations maps to any.
 *
 * TWO OF THE OLD SEVENTEEN FAMILIES ARE DELIBERATELY ABSENT. `named_pressure` matches the word
 * "pressure" itself and `korean_markers` is a locale lexicon — both are DETECTOR machinery for
 * reading free text, not kinds of workplace difficulty. A provider enum is durable product
 * vocabulary and must not inherit implementation shapes.
 *
 * THE CLAUSE IS THE PRODUCT. It is participant-facing, so it carries every rule the rest of the
 * program does: no occasion, no restatement of the trained action, no completion, no evidence
 * claim, and nothing invented about the Host's workplace — "time is running short", never "a
 * patient has been waiting for 37 minutes".
 */
export const PRESSURE_FRAMES = [
  { id: "time_is_short", meaning: "Too little time remains, or the occasion is overrunning and people want to finish.", clause: "time is running short" },
  { id: "others_are_waiting", meaning: "Someone or something else is queued behind this.", clause: "someone else is already waiting" },
  { id: "interruptions", meaning: "Something keeps cutting across before anything is settled.", clause: "the conversation keeps being interrupted" },
  { id: "attention_is_elsewhere", meaning: "Attention is divided — messages, the clock, another task pulling at people.", clause: "attention is somewhere else" },
  { id: "too_much_at_once", meaning: "More is happening or unresolved than can be handled at once.", clause: "several things need attention at once" },
  { id: "pushback", meaning: "Someone resists, disagrees or argues.", clause: "someone pushes back" },
  { id: "fatigue", meaning: "People are tired, worn down, or running out of attention.", clause: "everyone is tired" },
  { id: "someone_is_missing", meaning: "The person who would normally carry it is absent, or cover is thin.", clause: "the person you would usually rely on is not there" },
  { id: "unclear_information", meaning: "Something needed is missing, unknown or unsettled.", clause: "something important is still unclear" },
  { id: "unclear_ownership", meaning: "It is not obvious who is responsible — each person assumes another is.", clause: "it is not obvious who should take it" },
  { id: "being_watched", meaning: "It is exposed — someone senior is present, or it is a first time.", clause: "other people are watching" },
  { id: "nobody_steps_up", meaning: "People hesitate, go quiet, or avoid being the one.", clause: "nobody offers to take it" },
] as const;

export type PressureFrame = (typeof PRESSURE_FRAMES)[number]["id"];

/** Every frame id, for the provider enum, the validator and the tests — one source. */
export function pressureFrameIds(): PressureFrame[] {
  return PRESSURE_FRAMES.map((f) => f.id);
}

/**
 * THE ONE PLACE PRESSURE BECOMES WORDS. The model never sends this string and cannot influence
 * it; a frame the server does not know renders nothing rather than guessing.
 */
export function renderPressureFrame(frame: PressureFrame, locale?: JourneyLocale): string {
  /*
    ONE FRAME LIST, TWO LANGUAGES (Slice R4-R5C13). `PRESSURE_FRAMES` stays the single source of
    frame IDENTITY — the ids, the meanings the model chooses from, the validator's enum — and the
    participant-facing CLAUSE now comes from the locale table. The English clauses in the list
    below are unchanged and are still what `en` renders; a frame the table does not know renders
    nothing rather than guessing, exactly as before.
  */
  if (PRESSURE_FRAMES.every((f) => f.id !== frame)) return "";
  return journeyCopy(locale).pressure[frame] ?? "";
}

/** What the model is told it may choose from — derived from the frames, never a second list. */
export function pressureFramePromptLines(): string[] {
  return PRESSURE_FRAMES.map((f) => `  - ${f.id}: ${f.meaning}`);
}

export type ScenarioContract = {
  /** WHICH KIND of difficulty. The only thing the model contributes to the scenario. */
  frame: PressureFrame;
};

export const SCENARIO_FIELD_LIMIT = 120;
const SCENARIO_FIELD_MIN = 8;

/**
 * HISTORICAL BREADTH, KEPT ON PURPOSE (Slice 3.2P-A7-R2). `pressureCondition` and
 * `pressureDetail` no longer exist in the contract, and the ledger holds rows that named them.
 * A stored diagnostic must stay readable forever, so the vocabulary does not shrink.
 */
export type ScenarioField = "frame" | "pressureCondition" | "pressureDetail";

/**
 * THE CLOSED SCENARIO VOCABULARY (named in Slice 3.2P-A5-R2; the values themselves are older).
 *
 * It was an inline union, which is fine for a compiler and useless to a ledger: nothing could
 * enumerate it, so nothing could check that the database's CHECK constraint says the same
 * thing. It is now an array for the same reason `CONTRACT_DEFECT_REASONS` is one.
 *
 * NEVER SHRINK IT. Once a reason has been written to a row it is historical vocabulary, and
 * removing it makes an existing row unreadable.
 *
 * Every name here describes the FAULT, not the check that found it — `no_pressure`, not
 * `namesRealPressure_false` — so the regex behind any of them can be rewritten without
 * invalidating a single stored row.
 */
export const SCENARIO_DEFECT_REASONS = [
  /** Absent, or shorter than the field minimum — the same fault at two magnitudes. */
  "missing",
  /** Longer than the field limit. */
  "too_long",
  /** Names difficulty without naming any: "it is hard", "a busy day". */
  "generic",
  /** The pressure restates the trained action, so it describes no obstacle to it. */
  "restates_action",
  /** No family of real constraint is recognisable in the pressure. */
  "no_pressure",
  /** A field named an occasion of its own — the scenario moved somewhere else. */
  "independent_moment",
] as const;

export type ScenarioDefect = {
  field: ScenarioField;
  reason: (typeof SCENARIO_DEFECT_REASONS)[number];
};

/** Occasions — the kind of noun that names an event someone could be told to attend. */
const OCCASION_NOUN =
  "meetings?|handovers?|handoffs?|hand-offs?|shifts?|standups?|stand-ups?|huddles?|briefings?|debriefs?|reviews?|retros?|retrospectives?|calls?|sessions?|appointments?|rounds?|visits?|interviews?|classes|lessons?|sprints?|cycles?|projects?|tasks?|deadlines?|changeovers?|check-ins?|one-on-ones?|days?|weeks?|mornings?|afternoons?|evenings?|nights?";

/**
 * A phrase that names its OWN occasion: a temporal preposition governing an occasion noun.
 *
 * This is a structural test, not a word list about relevance. "a tight deadline is
 * approaching and team members are waiting for information" names a pressure and no
 * occasion, and passes. "during a team meeting just before a project deadline" and "at the
 * end of each project or task" both name occasions, and are refused — including when the
 * occasion is the SAME one as the trigger, because the scenario has no business restating
 * the moment it is already anchored to.
 */
const MOMENT_ANCHOR = new RegExp(
  `\\b(?:at|in|on|during|before|after|when|whenever|while|once|upon|throughout)\\b` +
    // Up to four intervening words, so "at the end of each project" and "during a team
    // meeting" are both reached without the list having to enumerate every modifier.
    `(?:\\s+[\\p{L}\\p{N}'’-]+){0,4}\\s+(?:${OCCASION_NOUN})\\b`,
  "iu",
);

/** Exported so the review surface and the tests share one authority on second moments. */
export function namesIndependentMoment(text: string): boolean {
  return MOMENT_ANCHOR.test(text);
}

/**
 * WHAT COUNTS AS PRESSURE — ONE DEFINITION, TWO CONSUMERS (Slice 3.2O-R2).
 *
 * Three paid windows were spent on one real training. The third was refused
 * `scenario_without_pressure` against a prompt that had just been hardened to say what
 * pressure MAY be — and two of the categories that prompt named ("workload", "operational
 * constraint") match nothing this floor recognises. The prompt was written from intuition
 * beside a regex written months earlier, and they disagreed.
 *
 * That is the same failure `EVIDENCE_POLICY` was built to end, and the same cure applies:
 * the families live here once, `namesRealPressure` is what the validator runs, and
 * `scenarioPressurePromptLines` is what the model reads, and both are built from the SAME
 * array. A family without a `promptLine` cannot compile, and an `example` that the real
 * validator refuses fails a test — so a category the product cannot accept can no longer be
 * recommended to the model.
 *
 * NOTHING IS RELAXED. Every alternative of the original regex is carried over verbatim and
 * regrouped; a characterization test proves the union still matches exactly what it did.
 * This is a FLOOR on the pressure field's own content — deliberately NOT the relevance
 * authority, which is structural: a scenario cannot become relevant by matching this list,
 * and cannot become irrelevant by missing it.
 */
export type PressureFamily = {
  /** Stable id — appears in tests and the audit map, never shown to a Host. */
  readonly id: string;
  /** What the model is told, in its own terms. Required — this is the anti-drift device. */
  readonly promptLine: string;
  /** One sentence that MUST survive the whole scenario validator. Machine-verified. */
  readonly example: string;
  readonly pattern: RegExp;
};

export const SCENARIO_PRESSURE_POLICY: readonly PressureFamily[] = [
  {
    id: "time_scarcity",
    promptLine: "there is no time, someone is running late, it is a rush, something is urgent, a deadline is close, there are only a few minutes",
    example: "there is no time left before the patient is due",
    /*
      A BARE `deadline` IS NOT A PRESSURE (Slice 3.2P-A3-R2). It accepted "state the owner and
      deadline" — a restatement of the trained action — and "every item has a deadline" — a
      completion claim. Both are exactly what this floor exists to refuse, and both had been
      passing since the family was written. What makes a deadline a pressure is its PROXIMITY,
      which is also what the family's own prompt line has always said: "a deadline is close".
    */
    pattern: /\b(?:no\s+time|not\s+enough\s+time|short\s+of\s+time|running\s+late|late|rush\w*|hurry|urgent|(?:close|near|approaching|looming|tight)\s+deadline|deadline\s+is\s+(?:close|near|approaching|looming|today|tight)|deadline\s+(?:has\s+)?(?:passed|slipped)|only\s+\w+\s+minutes)\b/i,
  },
  {
    id: "queue_or_busy",
    promptLine: "it is busy, a queue is building, someone is waiting, something is already under way, work is still running",
    example: "a queue is building at the desk and someone is waiting",
    pattern: /\b(?:busy|queue|waiting|already|still\s+\w+ing)\b/i,
  },
  {
    id: "interruption",
    promptLine: "there are interruptions, distractions, or it is noisy",
    example: "the phone keeps interrupting and the room is noisy",
    pattern: /\b(?:interrupt\w*|distract\w*|noisy|noise)\b/i,
  },
  {
    id: "resistance",
    promptLine: "someone pushes back, resists, disagrees, argues, or refuses",
    example: "a colleague disagrees and pushes back on doing it",
    pattern: /\b(?:push\w*\s+back|pushback|resist\w*|disagree\w*|argu\w*|refus\w*)\b/i,
  },
  {
    id: "fatigue",
    promptLine: "people are tired or exhausted, or it is the end of the shift or the day",
    example: "the person is exhausted and wants to get home",
    pattern: /\b(?:tired|exhaust\w*|end\s+of\s+(?:the\s+)?(?:shift|day))\b/i,
  },
  {
    id: "absence_or_staffing",
    promptLine: "someone is unavailable, absent, not there, has not arrived, has left, nobody is there, it is understaffed or stretched, or someone else is doing it",
    example: "the team is understaffed and the other person has not arrived",
    pattern: /\b(?:understaffed|short-staffed|short[- ]handed|stretched|unavailable|absent|nobody|no\s+one|someone\s+else|is\s+not\s+there|has\s+not\s+arrived|hasn't\s+arrived|left\s+(?:early|for\s+the\s+day)|coverage\s+is\s+thin)\b/i,
  },
  {
    id: "missing_or_unclear",
    promptLine: "information is missing, or someone is unclear or unsure",
    example: "the information is missing and staff are unsure what to say",
    pattern: /\b(?:missing|unclear|unsure)\b/i,
  },
  {
    id: "competing_demands",
    promptLine: "something is competing or conflicting, or another person, task or request is pulling attention away",
    example: "another task is competing for attention at the same desk",
    pattern: /\b(?:competing|conflict\w*|another\s+(?:person|task|request))\b/i,
  },
  {
    id: "social_exposure",
    promptLine: "it is awkward or uncomfortable, a senior or a manager is watching, someone is being watched, or it is their first time",
    example: "it is awkward because a senior colleague is watching",
    /*
      `manager\s+is` matched "the manager is speaking" — a neutral description of a meeting, not
      a pressure. Measured as the one false positive on the A3-R2 corpus. The exposure is being
      OBSERVED, so the verb has to be there.
    */
    pattern: /\b(?:awkward|uncomfortable|senior|being\s+watched|(?:manager|supervisor|lead)\s+is\s+(?:watching|listening|present)|first\s+time)\b/i,
  },
  /*
    THE SIX FAMILIES A3 EXPOSED (Slice 3.2P-A3-R2).

    A3's first call was refused `scenario_without_pressure`, the licensed patch asked for "a real
    constraint of one of these kinds", and the repaired pressure named a different occasion. The
    moment floor caught that correctly — it measures precision 1.00 — but the pressure floor is
    what sent the model looking: measured on a 36-phrase corpus of ordinary workplace difficulty
    it recognised 13. A model steered away from meeting dynamics has fewer places to go, and one
    of the remaining ones is a second occasion.

    These are the families that were missing, named by what they ARE rather than by this pilot's
    vocabulary. Every one reaches the prompt through the same array, so the model is now told
    about them in the same breath the validator accepts them.
  */
  {
    id: "overrun_or_pace",
    promptLine: "the session is running over or behind, or people want to wrap up, finish quickly or move on",
    example: "the session is running over time and people want to move on",
    pattern: /\b(?:running\s+over|overrun\w*|behind\b|finish\s+quick\w*|wrap\s+up|move\s+on|no\s+pause)\b/i,
  },
  {
    id: "divided_attention",
    promptLine: "attention is elsewhere — people are checking messages or the time, talking over each other, or half-listening",
    example: "people are checking messages and talking over each other",
    pattern: /\b(?:checking\s+(?:messages|phones|email|the\s+time)|talking\s+over|watching\s+the\s+clock|attention\s+is\s+(?:fading|drifting|elsewhere)|half[- ]?listening)\b/i,
  },
  {
    id: "simultaneity_or_volume",
    promptLine: "several things are happening at once, more is raised than can be handled, or items are still unresolved",
    example: "several issues are raised at once and some are still unresolved",
    pattern: /\b(?:at\s+once|one\s+after\s+another|unresolved|multiple|several\s+(?:possible|issues|items|things)|more\s+\w+\s+(?:are\s+)?(?:raised|added)\s+than)\b/i,
  },
  {
    id: "hesitation_or_avoidance",
    promptLine: "people hesitate, avoid it, go quiet, or nobody wants to be the one",
    example: "the room goes quiet and people avoid saying who will take it",
    pattern: /\b(?:hesitat\w*|avoid\w*|reluctan\w*|goes?\s+quiet|went\s+quiet|silence|nobody\s+wants|no\s+one\s+wants)\b/i,
  },
  {
    id: "ownership_ambiguity",
    promptLine: "it is not clear who owns it — each person assumes another does, or several people could",
    example: "each person assumes the other one owns it",
    pattern: /\b(?:who\s+(?:owns|will\s+take|should\s+take)|thinks?\s+the\s+other|assume\w*\s+(?:the\s+other|someone)|not\s+sure\s+who)\b/i,
  },
  {
    id: "flow_break",
    promptLine: "one thing cuts across another before it is settled, or questions keep breaking the flow",
    example: "questions keep breaking the flow before anything is settled",
    pattern: /\b(?:break\w*\s+the\s+flow|cuts?\s+across|before\s+(?:\w+\s+){0,3}(?:has\s+|is\s+)?(?:finished|resolved|settled|decided|closed))\b/i,
  },
  {
    id: "named_pressure",
    promptLine: "the word pressure itself, when it names a real one rather than standing alone",
    example: "there is pressure from the queue to move on quickly",
    pattern: /\bpressure\b/i,
  },
  {
    id: "korean_markers",
    // Deliberately unbounded, exactly as before: Korean has no \b word boundary.
    promptLine: "the Korean equivalents — 바쁘 (busy), 늦 (late), 압박 (pressure), 서둘 (hurry)",
    example: "환자가 기다리고 있어 바쁘다",
    pattern: /바쁘|늦|압박|서둘/,
  },
];

/**
 * Does this text name a real constraint? The validator's floor, derived from the families
 * above rather than from a second list nobody can compare against the first.
 */
export function namesRealPressure(text: string): boolean {
  return SCENARIO_PRESSURE_POLICY.some((f) => f.pattern.test(text));
}

/** Every family, as instructions. The whole policy — a family that says nothing is impossible. */
export function scenarioPressurePromptLines(): string[] {
  return SCENARIO_PRESSURE_POLICY.map((f) => `  - ${f.promptLine}`);
}

/** Placeholders that describe difficulty without naming any. */
const GENERIC_PRESSURE = [
  /^\s*(?:it\s+is\s+)?(?:difficult|hard|challenging|tricky|complicated|stressful)\.?\s*$/i,
  /^\s*there\s+is\s+(?:some\s+)?pressure\.?\s*$/i,
  /^\s*(?:time\s+)?pressure\.?\s*$/i,
  /^\s*(?:a\s+)?(?:busy|difficult|challenging)\s+(?:day|time|situation|environment)\.?\s*$/i,
];

/** Context that names no actual place, moment or people. */
const GENERIC_CONTEXT = [
  /^\s*(?:at|in)\s+(?:work|the\s+workplace|the\s+office|general|practice)\.?\s*$/i,
  /^\s*(?:the\s+)?(?:workplace|office|team|organisation|organization|company)\.?\s*$/i,
  /^\s*(?:day-to-day|everyday|normal|regular)\s+(?:work|operations|business)\.?\s*$/i,
];

/** Token containment: does `inner` say essentially what `outer` already said? */
function saysTheSameThing(a: string, b: string): boolean {
  const words = (s: string) =>
    new Set(
      s
        .toLowerCase()
        .replace(/[^\p{L}\p{N}\s]/gu, " ")
        .split(/\s+/)
        .filter((w) => w.length > 3),
    );
  const wa = words(a);
  const wb = words(b);
  if (wa.size === 0) return false;
  let shared = 0;
  for (const w of wa) if (wb.has(w)) shared++;
  // Nearly every content word of the pressure already appears in the action.
  return shared / wa.size >= 0.8;
}

/**
 * Validate what the model may supply for a scenario. Relevance is NOT decided here — it is
 * guaranteed by construction, because the displayed scenario is rendered from the behavior
 * contract. What is decided here is whether the difficulty is real, and whether the
 * scenario has tried to give itself a moment of its own.
 */
export function validateScenarioContract(
  raw: unknown,
  behavior: BehaviorContract,
): { ok: true; value: ScenarioContract } | { ok: false; defect: ScenarioDefect } {
  void behavior;
  /*
    WHAT IS LEFT TO VALIDATE (Slice 3.2P-A7-R2). Almost nothing, and that is the point.

    The five semantic checks this function used to run — generic prose, a second occasion in
    either field, a restatement of the trained action, and no recognisable difficulty — all
    existed to police free text. There is no free text. A frame is either one of twelve ids the
    server itself defined or it is not a frame at all, so `generic`, `restates_action`,
    `no_pressure` and `independent_moment` are now unreachable rather than merely rare.

    They stay in `SCENARIO_DEFECT_REASONS` because the ledger holds rows that carry them —
    A6 and A7 among them — and a vocabulary that shrinks makes history unreadable.

    An unknown or absent frame is a SHAPE fault, reported as `missing`, and repairable by the
    structural retry that already exists for a malformed response.
  */
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    return { ok: false, defect: { field: "frame", reason: "missing" } };
  }
  const r = raw as Record<string, unknown>;
  const frame = trimField(r.pressure_frame ?? r.frame);
  if (!pressureFrameIds().includes(frame as PressureFrame)) {
    return { ok: false, defect: { field: "frame", reason: "missing" } };
  }
  const value: ScenarioContract = { frame: frame as PressureFrame };

  return { ok: true, value };
}

/**
 * THE participant-facing scenario, DERIVED — so it cannot describe a different behavior
 * than the one the program defined. Same actor, same trigger, same required action, same
 * completion signal; the model contributes only the difficulty and the setting.
 */
export function renderScenarioSentence(b: BehaviorContract, s: ScenarioContract, locale?: JourneyLocale): string {
  /*
    SERVER-WRITTEN PRESSURE (Slice 3.2P-A7-R2). The clause comes from `PRESSURE_FRAMES`, not
    from the response, so the sentence between the Host's moment and the Host's action is now
    entirely BTY's. There is no second circumstance to append: one scenario needs one
    difficulty, and a catalogue of them is not a harder situation, only a longer one.
  */
  const condition = renderPressureFrame(s.frame, locale);
  /**
   * ONE MOMENT, SUBORDINATE PRESSURE. The sentence OPENS on the canonical trigger and the
   * pressure arrives inside it as a concessive clause. There is no leading context moment
   * and no "Even then" bridge, because there is no second event to bridge to — v6's
   * `contextDetail` is gone from the contract entirely.
   */
  /*
    THE HOST'S MOMENT VERBATIM, exactly as THE STANDARD states it (Slice 3.2P-R3.7). This used
    `momentClause`, which re-attaches an English preposition when the phrase does not open with
    a time word — so a Korean moment rendered as "At the 아침 허들 때마다". Nothing here needs to
    grammar-check the host's own words; it needs to repeat them.
  */
  /*
    A SITUATION, NOT THE INSTRUCTION AGAIN (Slice R4-R5C11). This rendered
    "<trigger>, even when <pressure>, <actor> must <action>. Completion evidence: <criterion>."
    — measured at 85% of THE STANDARD as one contiguous token run, which is the standard with
    a difficulty clause wedged into it, not a second thing to think about.

    IN CONTEXT now carries only what THE STANDARD cannot: the moment, the pressure, and why
    the behaviour is easy to lose there. It points at the standard with "this" rather than
    repeating it, and it no longer restates the Host's criterion.
  */
  return journeyCopy(locale).scenario(stripTrailingStop(b.trigger.trim()), condition);
}

// ---------------------------------------------------------------------------
// Whole-program dependency graph
// ---------------------------------------------------------------------------

export type ProgramSection = { kind: JourneyElementKind; content: string };

/** The three ways a program can be internally out of order. Fixed vocabulary, no prose. */
export type DependencyBranch = "used_before_defined" | "defined_after_use" | "authority_mismatch";

export type DependencyDefect = {
  kind: JourneyElementKind;
  /** The construct head noun the section depended on. A closed-vocabulary noun, never prose. */
  construct: string;
  branch: DependencyBranch;
  /** For `defined_after_use`, the earlier section that already required it. */
  counterpartKind: JourneyElementKind | null;
};

const orderOf = (k: JourneyElementKind): number => JOURNEY_KIND_ORDER.indexOf(k);

/**
 * A question whose answer would SUPPLY the construct's defining content: what goes in it,
 * what it contains, which steps it has. Legitimate as design work — and illegitimate as a
 * closing question about a construct an earlier section already told the participant to use.
 */
const DEFINITION_SEEKING = new RegExp(
  `\\b(?:what|which|how\\s+many)\\b[^?]{0,120}?\\b(?:elements?|fields?|steps?|components?|contents?|items?|parts?|sections?|criteria|criterion|points?|details?|information)\\b[^?]{0,120}?\\b(?:includ\\w*|contain\\w*|cover\\w*|go\\s+(?:in|into)|be\\s+in|make\\s+up|comprise\\w*|consist)\\b`,
  "i",
);

/**
 * Validate the program as an ORDERED dependency graph rather than seven independent
 * strings.
 *
 * THE RULE. A section may refer to an operational construct definitely — "the shared
 * handoff standard" — only once an earlier section has actually defined the behavior. The
 * only section that can define one is `observable_standard`, because it is the only one
 * carrying a validated behavioral contract.
 *
 * Host grounding deliberately does NOT satisfy this. The canonical draft's
 * `observableBehavior` is "Create a shared handoff standard": that authorises BTY to
 * PROPOSE the standard, and says nothing about its steps, its fields or its completion
 * rule. Treating the Host's topic as a definition is precisely how the live program
 * justified telling someone to use a standard that did not yet exist.
 */
export function validateProgramDependencies(
  sections: readonly ProgramSection[],
  standardContract: BehaviorContract | null,
  /** The one construct this program is about, when it has one (Slice 3.2L-R6). */
  construct: OperationalConstruct | null = null,
): DependencyDefect | null {
  /**
   * SEMANTIC ROLE SCOPING (Slice 3.2L-R6). Only INSTRUCTIONAL sections can create or
   * consume a dependency. The R5 window was refused because WHY THIS MATTERS — narrative,
   * instructing nobody — referred to the construct the Host had themselves named. A
   * narrative mention is context; it cannot define authority, and it cannot violate one.
   */
  const ordered = [...sections]
    .filter((s) => isInstructionalKind(s.kind))
    .sort((a, b) => orderOf(a.kind) - orderOf(b.kind));
  const standard = ordered.find((s) => s.kind === "observable_standard");

  /**
   * What the standard actually defined. A validated contract defines every construct the
   * standard NAMES — the contract states who does what, when, and how it is confirmed, so
   * a construct mentioned inside it has its behavior established.
   */
  const definedText = standardContract
    ? [standard?.content ?? "", standardContract.actor, standardContract.trigger, standardContract.observableAction, standardContract.completion.criterion].join(" ")
    : "";
  const defined = new Set(
    standardContract
      ? CONSTRUCT_NOUNS.map(nounStem).filter((stem) => mentionsConstruct(definedText, stem))
      : [],
  );
  /**
   * The canonical construct is defined the moment the behaviour contract is valid, whether
   * or not the contract's own wording happens to repeat its noun. That gap is exactly what
   * produced the R5 refusal: the behaviour was fully specified, the construct was named by
   * the Host, and nothing connected the two.
   */
  if (construct && standardContract) defined.add(construct.noun);

  /** Constructs an earlier section already told the participant to use. */
  const usedBy = new Map<string, JourneyElementKind>();

  for (const s of ordered) {
    if (s.kind === "observable_standard") continue;

    for (const stem of definiteConstructs(s.content)) {
      if (!defined.has(stem)) {
        // Used, but no section ever said what the behavior is.
        return { kind: s.kind, construct: stem, branch: "used_before_defined", counterpartKind: null };
      }
      if (!usedBy.has(stem)) usedBy.set(stem, s.kind);
    }

    // A closing question may verify understanding, a decision, or an application plan. It
    // may NOT be the place the construct's content is finally decided, when an earlier
    // section already required using it.
    if (s.kind === "completion_check" && DEFINITION_SEEKING.test(s.content)) {
      for (const stem of CONSTRUCT_NOUNS.map(nounStem)) {
        if (!mentionsConstruct(s.content, stem)) continue;
        const earlier = usedBy.get(stem);
        if (earlier !== undefined && orderOf(earlier) < orderOf(s.kind)) {
          return { kind: s.kind, construct: stem, branch: "defined_after_use", counterpartKind: earlier };
        }
      }
    }
  }

  return null;
}

// ---------------------------------------------------------------------------
// Canonical operational construct identity (Slice 3.2L-R6)
// ---------------------------------------------------------------------------

/**
 * THE LIVE ARCHITECTURAL DEFECT. The R5 window produced a valid behaviour contract and a
 * valid scenario contract, and was then refused `dependency_inversion` on WHY THIS MATTERS
 * — a narrative section that instructs nobody.
 *
 * The cause was not the rule's scope alone. The program had NO canonical identity for the
 * thing it was proposing. The behaviour contract described an action ("states each open
 * item aloud …") without naming a construct, so `defined` was empty; the narrative,
 * following the Host's own framing, said "the shared handoff standard"; and the graph
 * correctly concluded that a construct had been referenced which nothing defined.
 *
 * Both halves are repaired here. The construct now has ONE system-derived identity, and
 * the sections that instruct are DERIVED from one authority rather than validated after
 * the fact.
 */

export type ConstructAuthorityMode =
  /** BTY is introducing a new way of working. Claims nothing about the world. */
  | "proposed"
  /** The Host's own words established that it already exists. */
  | "host_grounded_existing"
  /** The application verified an uploaded or first-party resource identity. */
  | "verified_resource";

export type OperationalConstruct = {
  /** One normalized display label, e.g. `shared handoff standard`. */
  label: string;
  /** Head noun from the closed construct vocabulary — safe as diagnostic metadata. */
  noun: string;
  authorityMode: ConstructAuthorityMode;
};

/**
 * A CONSTRUCT IS A THING SOMEONE CAN POINT AT (Slice 3.2R-R2.3).
 *
 * Was `\b((?:[\w'-]+\s+){0,3}(NOUN))\b` — up to three ARBITRARY tokens before a construct
 * noun, with nothing checking they form a noun phrase. On the first live decide-program the
 * Host's problem read "Team huddles sometimes end with agreement, but no one clearly owns the
 * next action", `agreement` is in the construct vocabulary, and the pattern captured
 * `sometimes end with agreement` as the construct's LABEL. APPLY IT then rendered:
 *
 *     "This is the sometimes end with agreement in practice."
 *
 * An adverb, a verb and a preposition spliced into a noun phrase and shown to a learner.
 *
 * THE FIX IS STRUCTURAL, NOT A STOP-LIST FOR THAT PHRASE. English marks a nameable thing with a
 * determiner or a modifier: "a shared handoff standard", "the weekly cadence", "shared
 * standards". A bare mass noun governed by a preposition — "end WITH agreement", "agree ON a
 * process" — is not a named artifact, it is the abstract sense of the word. So the head noun is
 * matched on its own and the phrase is built by walking BACKWARD over modifier-eligible tokens
 * only, stopping at the first token that cannot modify a noun. If nothing modifier-like precedes
 * the noun and no determiner introduces it, this source names no construct and the derivation
 * moves on — which is the truthful outcome for the live problem above: APPLY IT simply omits the
 * "This is … in practice." clause rather than inventing a construct the Host never named.
 */
const CONSTRUCT_HEAD = new RegExp(`\\b(${CONSTRUCT_ALT})\\b`, "gi");

/** Determiners that introduce a noun phrase. Their presence alone makes the noun nameable. */
const CONSTRUCT_DETERMINER = /^(?:a|an|the|our|your|its|their|this|that|these|those|one|each|every)$/i;

/**
 * Tokens that can never sit inside a noun phrase's modifier run. Closed and bounded: prepositions
 * and conjunctions (which mark the noun as an object, not a name), frequency adverbs, and the
 * handful of light verbs that appear next to these nouns in ordinary problem statements. Anything
 * NOT listed is allowed through as a modifier, so the rule narrows the old pattern and never
 * widens it.
 */
const CONSTRUCT_NON_MODIFIER = new RegExp(
  "^(?:with|without|to|from|for|of|in|on|at|by|into|onto|about|after|before|during|through|" +
    "and|or|but|nor|so|yet|because|if|when|while|than|that|as|" +
    "sometimes|often|rarely|seldom|always|never|usually|occasionally|frequently|still|just|only|" +
    "is|are|was|were|be|been|being|has|have|had|do|does|did|" +
    "end|ends|ended|ending|start|starts|started|finish|finishes|finished|reach|reaches|reached|" +
    "follow|follows|followed|following|keep|keeps|kept|need|needs|needed|make|makes|made|" +
    "get|gets|got|use|uses|used|leave|leaves|left|come|comes|came|go|goes|went)$",
  "i",
);

/**
 * The construct phrase around a head noun: the noun plus up to three preceding modifier tokens.
 * Returns null when the noun is not introduced as a nameable thing.
 */
function constructPhraseAt(source: string, headIndex: number, head: string): string | null {
  const before = source.slice(0, headIndex).trim();
  const tokens = before.length > 0 ? before.split(/\s+/) : [];
  const mods: string[] = [];
  for (let i = tokens.length - 1; i >= 0 && mods.length < 3; i -= 1) {
    const raw = tokens[i]!.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, "");
    if (raw.length === 0) break;
    if (CONSTRUCT_DETERMINER.test(raw)) { mods.unshift(raw); break; } // a determiner closes the phrase
    if (CONSTRUCT_NON_MODIFIER.test(raw)) break;
    mods.unshift(raw);
  }
  // A nameable construct is introduced by a determiner or carries at least one modifier.
  const introduced = mods.length > 0;
  return introduced ? `${mods.join(" ")} ${head}` : null;
}

/** Determiners and existence adjectives are not part of the construct's identity. */
const LABEL_NOISE = /^(?:a|an|the|our|your|its|their|this|that|these|those|new|existing|available|current|established|approved|official|supplied|provided)\s+/i;

function normalizeLabel(raw: string): string {
  let s = raw.replace(/\s+/g, " ").trim().toLowerCase();
  // Strip leading noise repeatedly: "the new shared handoff standard" → "shared handoff standard".
  for (let prev = ""; prev !== s; ) {
    prev = s;
    s = s.replace(LABEL_NOISE, "");
  }
  return s;
}

const EXISTENCE_ADJECTIVE = /\b(?:existing|available|current|established|approved|official|supplied|provided|in\s+place)\b/i;

/**
 * The construct this program is about, or null when it is about a behaviour alone.
 *
 * SYSTEM-DERIVED, never model-asserted. The model cannot mark an ungrounded construct as
 * existing because the model does not supply this at all — it is read from the Host's own
 * answers and from artifacts the application actually verified. That is the whole point:
 * "authority_mode" is a claim about the world, and a model has no standing to make one.
 *
 * For the canonical draft's `observableBehavior` — "Create a shared handoff standard." —
 * this yields `{ label: "shared handoff standard", noun: "standard", mode: "proposed" }`:
 * BTY may propose it, and may not say it exists, is approved, has fields, or is available.
 */
export function deriveOperationalConstruct(
  fields: {
    observableBehavior?: string | null;
    successEvidence?: string | null;
    capabilityCandidate?: string | null;
    problem?: string | null;
  },
  verifiedArtifacts: readonly string[] = [],
): OperationalConstruct | null {
  // Ordered by authority: the behaviour the Host asked for outranks the problem statement.
  const sources = [fields.observableBehavior, fields.capabilityCandidate, fields.successEvidence, fields.problem];
  for (const source of sources) {
    if (typeof source !== "string" || source.trim().length === 0) continue;
    CONSTRUCT_HEAD.lastIndex = 0;
    let phrase: string | null = null;
    let head = "";
    let matchEnd = 0;
    for (let m = CONSTRUCT_HEAD.exec(source); m !== null; m = CONSTRUCT_HEAD.exec(source)) {
      const candidate = constructPhraseAt(source, m.index, m[1]!);
      if (candidate !== null) { phrase = candidate; head = m[1]!; matchEnd = m.index + m[0].length; break; }
    }
    if (phrase === null) continue;
    const label = normalizeLabel(phrase);
    if (label.length === 0) continue;
    const noun = nounStem(head);

    // A verified upload naming this kind of thing is the strongest authority available.
    const verified = verifiedArtifacts.some((a) => a.toLowerCase().includes(noun));
    if (verified) return { label, noun, authorityMode: "verified_resource" };

    // The Host framed it as something to create → a proposal, and only a proposal.
    const before = source.slice(0, matchEnd);
    if (CREATION_FRAME.test(before) && !EXISTENCE_ADJECTIVE.test(phrase)) {
      return { label, noun, authorityMode: "proposed" };
    }
    // The Host referred to it as a thing that exists. They are authoritative about their
    // own organisation; BTY is not.
    return { label, noun, authorityMode: "host_grounded_existing" };
  }
  return null;
}

/** True once the construct's behaviour has actually been stated, not merely named. */
export function constructIsBehaviorallyDefined(construct: OperationalConstruct | null, behavior: BehaviorContract | null): boolean {
  return construct !== null && behavior !== null;
}

// ---------------------------------------------------------------------------
// Semantic roles — which sections instruct, and which merely narrate
// ---------------------------------------------------------------------------

/**
 * NARRATIVE sections explain; they ask the participant to do nothing. A narrative mention
 * of a construct is context, not an operational dependency — which is exactly what the R5
 * refusal got wrong. They stay model-written prose and keep every safety and honesty check.
 */
export const NARRATIVE_KINDS: readonly JourneyElementKind[] = ["why_it_matters", "evidence", "reflection"];

/**
 * INSTRUCTIONAL sections tell someone to do something. All of them derive from the shared
 * behavioural authority, so an invalid order is difficult to represent rather than merely
 * detected afterwards. `follow_up` is deliberately INCLUDED: "what happens next" directs
 * observation, evidence gathering or confirmation, so it bears dependencies too.
 */
export const INSTRUCTIONAL_KINDS: readonly JourneyElementKind[] = [
  "observable_standard",
  "scenario",
  "action_decision",
  "field_application",
  "completion_check",
  "follow_up",
];

export function isNarrativeKind(k: JourneyElementKind): boolean {
  return NARRATIVE_KINDS.includes(k);
}

export function isInstructionalKind(k: JourneyElementKind): boolean {
  return INSTRUCTIONAL_KINDS.includes(k);
}

// ---------------------------------------------------------------------------
// Downstream instructional contracts (Slice 3.2L-R6)
// ---------------------------------------------------------------------------

/**
 * What APPLY IT and YOUR DECISION need that the behaviour contract cannot supply. The
 * actor and the observable action are INHERITED — re-authoring them is precisely how three
 * independent strings drifted apart in the live windows.
 */
/**
 * THE FIRST REAL INSTANCE OF THE CANONICAL TRIGGER (Slice 3.2L-R10-A).
 *
 * WHY THIS REPLACES A MODEL-AUTHORED MOMENT. Through v8 the model wrote its own
 * `application_moment` and BTY checked afterwards that it shared a word with the trigger.
 * The v8 live window died on exactly that check, and the audit that followed showed the
 * check is unfixable in kind: it correctly refused eight genuinely unrelated events, and it
 * also refused "when I next hand work over" against "at each handoff point" — a real
 * instance that happens to paraphrase. Nothing durable could tell the two apart, because
 * the difference IS the words.
 *
 * So the second occasion stops existing. The model has no idea what is actually in anyone's
 * calendar; the honest first instance of "at each handoff point" is "at the next handoff
 * point". That is a DETERMINISTIC SPECIALIZATION of a moment already validated — a
 * determiner swap, not a semantic guess.
 *
 * THE SUPPORTED GRAMMAR IS DELIBERATELY SMALL, and it is the grammar of recurrence:
 *
 *   each time / every time / any time X   →  the next time X
 *   whenever X                            →  the next time X
 *   … each|every N …                      →  … the next N …
 *
 * Anything else FAILS CLOSED. A trigger that never says the behaviour recurs cannot have a
 * "next" one derived from it, and inventing an occasion is the defect this removes.
 */
export type FirstInstance = { ok: true; value: string } | { ok: false; reason: "not_recurring" };

/** `each time` / `every time` / `any time` / `whenever`, only as the LEADING clause. */
const RECURRENCE_CLAUSE = /^\s*(?:each\s+time|every\s+time|any\s+time|whenever)\b\s*/i;
/** A quantifier used as a determiner — "at EACH handoff point", "of EVERY shift". */
const RECURRENCE_DETERMINER = /\b(?:each|every)\b(?!\s+(?:time|other)\b)/i;

/**
 * A BARE recurring occasion — "at shift change", "on handover". English drops the
 * quantifier here and still means every one of them, and this shape is already in the
 * fixtures, so refusing it would refuse a perfectly ordinary trigger.
 *
 * Deliberately narrow: only `at|on|during`, and only when no article or quantifier
 * already follows. A gerund that is really a noun ("at handover meeting") is refused
 * rather than guessed at.
 */
const BARE_RECURRING_OCCASION = /^(at|on|during)\s+(?!the\b|a\b|an\b|each\b|every\b|my\b|your\b|our\b|their\b|its\b|this\b|that\b|next\b)([\p{L}][\p{L}\d'-]*)/iu;

/** Words that introduce a gerund's OBJECT rather than continuing a noun phrase. */
const OBJECT_INTRODUCER = /^(?:the|a|an|my|your|our|their|his|her|its|this|that|these|those|them|it|him|us|me)\b/i;

/**
 * IS THE `-ing` WORD A GERUND, OR A MODIFIER? (Slice 3.2P-R3.5)
 *
 * THE MEASURED DEFECT. `bareRecurringInstance` refused any occasion whose first word ended
 * in `-ing`, to stop "on leaving the floor" folding into "on the next leaving the floor".
 * The suffix is not the distinction. `morning` and `evening` end in `-ing`, so the live W5
 * window (attempt `65923a21`) — a training about MORNING HUDDLES — could not express its own
 * moment. Isolated to one word: `at daily huddles` folded, `at morning huddles` did not.
 *
 * The rule's own stated example never even reached it: "before leaving the floor" is refused
 * by the preposition set, since `before` is not one of `at|on|during`. So the guard was
 * defending against a case it could not see, using a test that hit ordinary time words.
 *
 * WHAT ACTUALLY SEPARATES THEM IS PHRASE SHAPE, not vocabulary:
 *
 *   at MORNING huddles      → a noun follows, bare      → `morning` MODIFIES it   → an occasion
 *   at EVENING handover     → a noun follows, bare      → modifier                → an occasion
 *   on LEAVING the floor    → a determiner follows      → `the floor` is its OBJECT → a gerund
 *   on COMPLETING the form  → a determiner follows      → object                  → a gerund
 *   at BRIEFING             → nothing follows           → undecidable             → refused
 *
 * So: an `-ing` head is a modifier when another bare word follows it inside the occasion, and
 * a gerund when it is phrase-final or takes a determiner/pronoun. No temporal word list, no
 * job dictionary, no NLP dependency — and phrase-final stays refused, exactly as before.
 *
 * THE RESIDUAL AMBIGUITY, stated rather than hidden: "on finishing rounds" has a gerund with a
 * bare-plural object and is indistinguishable in shape from "at morning huddles". English does
 * not disambiguate it either without knowing the verb. It folds to "on the next finishing
 * rounds", which is awkward but not false — and it is a far rarer trigger than one naming a
 * morning. Trading a common refusal for a rare awkwardness is the deliberate choice here.
 */
function isGerundHead(head: string, rest: string): boolean {
  if (!/ing$/i.test(head)) return false;
  const following = rest.trim();
  if (following.length === 0) return true; // phrase-final: undecidable, stay conservative
  return OBJECT_INTRODUCER.test(following);
}

function bareRecurringInstance(core: string): string | null {
  /*
    Only the FIRST clause is specialized — "at shift change, before leaving the floor"
    becomes "at the next shift change, before leaving the floor" — and only when that
    clause is a short, unquantified occasion. "during all relevant transitions of work"
    is five words and starts on a quantifier; guessing there produced "the next all
    relevant transitions", which is why the bound exists.
  */
  const comma = core.indexOf(",");
  const head = comma > 0 ? core.slice(0, comma) : core;
  const m = BARE_RECURRING_OCCASION.exec(head);
  if (!m) return null;
  const phrase = head.slice(m[1].length).trim();
  if (isGerundHead(m[2], phrase.slice(m[2].length))) return null;
  if (phrase.split(/\s+/).length > 3) return null;
  if (/^(?:all|any|some|most|both|several|few|many|other)\b/i.test(phrase)) return null;
  return `${m[1]} the next ${phrase}${comma > 0 ? core.slice(comma) : ""}`;
}

/**
 * IS THIS CONFIDENTLY ONE SPECIFIC TIME? (Slice 3.2P-R3.7-R2)
 *
 * NEGATIVE CERTAINTY, never a failure to parse. R3.7 demoted the recurrence fold from readiness
 * authority because "I could not parse this" refused ordinary answers — "During the weekly
 * scheduling review" and every Korean moment. That decision stands. But the product now renders
 * "The next time this happens", and that sentence is false if the host named a date.
 *
 * So this asserts one-off-ness POSITIVELY, from four shapes that can only mean one occasion:
 * a singular deictic (`tomorrow`, `this Friday`), `the next …`, a calendar date or clock time,
 * and an explicit `one time`. Anything it cannot prove is accepted — which is the whole point,
 * and why it is a separate question from whether the fold succeeds. Measured: `"On August 20"`
 * FOLDS and is still one-off, so the two questions genuinely differ.
 *
 * The host is never corrected. "At the next huddle" is refused, not rewritten into "At each
 * huddle" — their words stay theirs.
 */
const SINGULAR_DEICTIC =
  /(?:^|\s)(?:tomorrow|today|tonight|yesterday|this\s+(?:morning|afternoon|evening|week|month|year|monday|tuesday|wednesday|thursday|friday|saturday|sunday)|next\s+(?:week|month|year|monday|tuesday|wednesday|thursday|friday|saturday|sunday))\b/i;
/** "the next X" names ONE upcoming instance — there is no next one after it. */
const THE_NEXT_ONE = /(?:^|\s)(?:at|on|in|by|before|after)?\s*the\s+next\s+/i;
const CALENDAR_POINT =
  /(?:^|\s)(?:on\s+)?(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s+\d{1,2}\b|\b\d{1,2}\s*(?:am|pm)\b|\b\d{4}-\d{2}-\d{2}\b/i;
const EXPLICIT_ONE_TIME = /(?:^|\s)(?:one\s+time|once|a\s+single\s+time|just\s+once)\b/i;

export function momentIsConfidentlyOneOff(moment: string): boolean {
  const m = moment.trim();
  if (m.length === 0) return false;
  return SINGULAR_DEICTIC.test(m) || THE_NEXT_ONE.test(m) || CALENDAR_POINT.test(m) || EXPLICIT_ONE_TIME.test(m);
}

export function deriveFirstApplicationMoment(trigger: string): FirstInstance {
  const core = stripTrailingStop(trigger.trim());
  if (core.length === 0) return { ok: false, reason: "not_recurring" };

  const clause = RECURRENCE_CLAUSE.exec(core);
  const derived = clause
    ? `the next time ${core.slice(clause[0].length)}`
    : RECURRENCE_DETERMINER.test(core)
      ? core.replace(RECURRENCE_DETERMINER, "the next")
      : bareRecurringInstance(core);

  if (derived === null) return { ok: false, reason: "not_recurring" };

  /*
    Cheap invariants over the RESULT rather than trust in the rules: a swap must never
    stutter a determiner or stack two "next"s. If it did, the trigger was shaped in a way
    this grammar does not actually support, and failing closed is the honest answer.
  */
  if (/\b(?:the\s+the|next\s+next|a\s+the|the\s+a)\b/i.test(derived)) {
    return { ok: false, reason: "not_recurring" };
  }
  /*
    PERSPECTIVE-NEUTRAL, like every stored moment. `momentClause` re-attaches the preposition
    and chooses "my" or "the" per section, so a folded "at the next X" renders "At my next X"
    in YOUR DECISION and "At the next X" in APPLY IT. Only the neutral "at/in/on" fold —
    "after the next handoff" and "during the next round" mean what they say and are kept.
  */
  const neutral = derived
    .replace(/^(?:at|in|on)\s+the\s+(?=next\b)/i, "")
    .replace(/^the\s+(?=next\s+time\b)/i, "");
  return { ok: true, value: /^[A-Z]/.test(core) ? upperFirst(neutral) : lowerFirst(neutral) };
}

export type ApplicationContract = {
  applicationMoment: string;
};

export const APPLICATION_FIELD_LIMIT = 140;
const APPLICATION_FIELD_MIN = 8;

export type ApplicationDefect = { field: keyof ApplicationContract; reason: "missing" | "too_long" | "generic" | "no_moment" | "unrelated_to_trigger" };

/**
 * ENUMERATED on purpose. BEFORE YOU FINISH may only verify something already established,
 * so it is rendered from a fixed matrix rather than written. The live R3 defect — a closing
 * question asking what the standard should contain — becomes unrepresentable, not refused.
 */
export const VERIFICATION_TARGETS = ["the_behaviour", "the_application_plan", "the_confirmation_step"] as const;
export const RESPONSE_MODES = ["name_the_moment", "state_what_you_will_say", "name_what_could_stop_you"] as const;
export type VerificationTarget = (typeof VERIFICATION_TARGETS)[number];
export type ResponseMode = (typeof RESPONSE_MODES)[number];
export type CompletionContract = { verificationTarget: VerificationTarget; responseMode: ResponseMode };

/** Also enumerated: a follow-up may not introduce a new construct or a new action. */
export const REVIEW_FOCUSES = ["what_you_said", "what_happened_next", "the_confirmation"] as const;
/*
  `the_other_person` was REMOVED in v11 (Slice 3.2P-R3.4-R1). Its whole rendering came from a
  model-authored confirmer; with completion server-owned there is nobody for the follow-up to
  address, and keeping the option would mean inventing one. A follow-up is a self-report or a
  conversation with the host.
*/
export const CONFIRMERS = ["self_report", "the_host"] as const;
export type ReviewFocus = (typeof REVIEW_FOCUSES)[number];
export type Confirmer = (typeof CONFIRMERS)[number];
export type FollowUpContract = { reviewFocus: ReviewFocus; confirmer: Confirmer };

const GENERIC_MOMENT = [
  /^\s*(?:soon|later|regularly|often|sometimes|as\s+needed|when\s+possible|in\s+future|going\s+forward)\.?\s*$/i,
  /^\s*(?:at|in)\s+(?:work|the\s+workplace|the\s+office)\.?\s*$/i,
];

/** Content words a moment is actually about — the event, not its determiners. */
function momentTokens(m: string): Set<string> {
  return new Set(
    momentCore(m)
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s]/gu, " ")
      .split(/\s+/)
      .filter((w) => w.length > 3 && !/^(?:next|each|every|your|their|before|after|during|while|when|first|last|this|that|with|from|into|over|then)$/.test(w)),
  );
}

/**
 * The first real application must be an INSTANCE of the required trigger, not a different
 * event. The live v5 proposal required the behaviour "at the end of each project or task",
 * rehearsed it "during a team meeting before a deadline" and applied it "at the next project
 * handoff" — three moments, no relationship enforced anywhere.
 *
 * HONEST LIMIT: this is a content-token test. It catches an unrelated event and cannot
 * judge whether two related-sounding moments are genuinely the same occasion. The scenario
 * can no longer drift at all (it is rendered FROM the trigger), so this is the one remaining
 * free moment, and a shared-token floor is the strongest deterministic check available
 * without a calendar model.
 */
/**
 * LEGACY — v1-v8 ONLY (Slice 3.2L-R10-A).
 *
 * This decided whether a MODEL-AUTHORED first moment belonged to the trigger, and the v8
 * live window died on it. It is not the v9 authority and is not called by the v9 generation
 * or review path: the first instance is derived from the trigger, so alignment holds by
 * construction. Kept so an accepted v1-v8 proposal can still be interpreted exactly as it
 * was accepted, and so its own tests keep documenting what that check did.
 */
export function applicationMatchesTrigger(applicationMoment: string, trigger: string): boolean {
  const a = momentTokens(applicationMoment);
  const t = momentTokens(trigger);
  if (a.size === 0 || t.size === 0) return true; // nothing to compare — do not invent a fault
  for (const w of a) if (t.has(w)) return true;
  return false;
}

export function validateApplicationContract(
  raw: unknown,
  /** When supplied, the moment must be an instance of this trigger. */
  trigger?: string,
): { ok: true; value: ApplicationContract } | { ok: false; defect: ApplicationDefect } {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    return { ok: false, defect: { field: "applicationMoment", reason: "missing" } };
  }
  const r = raw as Record<string, unknown>;
  const value: ApplicationContract = {
    applicationMoment: trimField(r.application_moment ?? r.applicationMoment),
  };
  for (const f of ["applicationMoment"] as const) {
    if (value[f].length < APPLICATION_FIELD_MIN) return { ok: false, defect: { field: f, reason: "missing" } };
    if (value[f].length > APPLICATION_FIELD_LIMIT) return { ok: false, defect: { field: f, reason: "too_long" } };
  }
  if (GENERIC_MOMENT.some((re) => re.test(value.applicationMoment))) {
    return { ok: false, defect: { field: "applicationMoment", reason: "generic" } };
  }
  // "Next Tuesday's handover" and "at the end of your next shift" both qualify; "soon" does not.
  if (!MOMENT_MARKER.test(value.applicationMoment) && !/\b(?:next|first|following|tomorrow|today)\b/i.test(value.applicationMoment)) {
    return { ok: false, defect: { field: "applicationMoment", reason: "no_moment" } };
  }
  if (trigger !== undefined && !applicationMatchesTrigger(value.applicationMoment, trigger)) {
    return { ok: false, defect: { field: "applicationMoment", reason: "unrelated_to_trigger" } };
  }

  return { ok: true, value };
}

export function isVerificationTarget(v: unknown): v is VerificationTarget {
  return typeof v === "string" && (VERIFICATION_TARGETS as readonly string[]).includes(v);
}
export function isResponseMode(v: unknown): v is ResponseMode {
  return typeof v === "string" && (RESPONSE_MODES as readonly string[]).includes(v);
}
export function isReviewFocus(v: unknown): v is ReviewFocus {
  return typeof v === "string" && (REVIEW_FOCUSES as readonly string[]).includes(v);
}
export function isConfirmer(v: unknown): v is Confirmer {
  return typeof v === "string" && (CONFIRMERS as readonly string[]).includes(v);
}

// ---------------------------------------------------------------------------
// Derived instructional renderers — one behavioural authority, six views
// ---------------------------------------------------------------------------

/** How the construct is named in participant text, once it exists. */
function constructPhrase(construct: OperationalConstruct | null): string {
  return construct ? `the ${construct.label}` : "";
}

/**
 * The observable action is written in the third person ("states each open item aloud"),
 * because THE STANDARD describes an actor doing it. YOUR DECISION is first person, so the
 * verb has to lose its agreement -s or the sentence reads "I will states each open item".
 *
 * Deliberately a small, conservative rule set over the verb forms a behaviour contract
 * realistically uses. An action already in base form has no trailing -s and passes through
 * untouched, so the common case where the model writes "state each item" is safe.
 */
const IRREGULAR_BASE: Record<string, string> = {
  has: "have", does: "do", goes: "go", says: "say", is: "be", asks: "ask",
};

/**
 * Acronyms that END IN S and would therefore look inflected to the rules below. Without
 * this, "SOS the duty lead" de-inflects to "SO" — the one case where a shouted token really
 * is ambiguous and no rule can tell. Kept deliberately short: it only needs the tokens whose
 * final S is part of the abbreviation.
 */
const S_FINAL_ACRONYMS = new Set([
  "sos", "pals", "acls", "bls", "ems", "gps", "sms", "cms", "lms", "hris", "ehs", "obs", "ops",
]);

const isShoutedToken = (w: string): boolean => w.length >= 2 && w === w.toUpperCase() && /\p{Lu}/u.test(w);

/**
 * INFLECTION PRECEDENCE (Slice 3.2L-R6.4).
 *
 * R6.3 preserved every all-caps head to protect "SBAR the handoff" from becoming "must sbar
 * the handoff". That was right about acronyms and wrong about verbs: it knowingly emitted
 * "doctors must STATES each item aloud", and a product should not ship prose it knows is
 * malformed. Changing STATES to state alters nothing the Host meant.
 *
 * So the rules run CASE-INSENSITIVELY FIRST, and the result decides:
 *
 *   the de-inflection CHANGED the token   → it was inflected  → use the base form
 *   the de-inflection was a NO-OP         → nothing to fix    → preserve the shout
 *
 * "STATES"/"SAYS"/"USES"/"CALLS"/"DELEGATES" all change, so all normalise. "SBAR" does not
 * change, so it survives. Only "SOS"-shaped tokens defeat that test, and they are listed
 * above — a small closed set rather than a guess about every capitalised word.
 */
export function baseForm(verb: string): string {
  const lower = verb.toLowerCase();
  if (isShoutedToken(verb) && S_FINAL_ACRONYMS.has(lower)) return verb;
  const reduced = reduceInflection(lower);
  if (isShoutedToken(verb) && reduced === lower) return verb;
  return reduced;
}

/** The deterministic de-inflection rules, on an already-lower-cased token. */
function reduceInflection(lower: string): string {
  if (IRREGULAR_BASE[lower]) return IRREGULAR_BASE[lower];
  if (/[^aeiou]ies$/.test(lower)) return `${lower.slice(0, -3)}y`;
  if (/(ch|sh|ss|x|z|o)es$/.test(lower)) return lower.slice(0, -2);
  if (/[^s]s$/.test(lower)) return lower.slice(0, -1);
  return lower;
}

export function renderDecisionSentence(b: BehaviorContract, a: ApplicationContract, locale?: JourneyLocale): string {
  /*
    THE LEARNER MAKES THE DECISION (Slice R4-R5C11).

    This rendered "The next time this happens, I will <action>." — THE STANDARD in the first
    person, written by BTY, under a heading that says YOUR DECISION. Nothing about it was the
    learner's and no decision was taken: the commitment was complete before they arrived, and
    the section immediately after asked them to produce it.

    NEXT_OCCURRENCE is kept, because the pointer is the part that was right — the decision is
    about the next real occurrence, and it needs no grammar of the Host's phrase to say so
    (Slice 3.2P-R3.7). What is removed is the answer.

    The learner's own `decision_response_text` remains the decision authority; this section now
    asks for it instead of supplying it.
  */
  return journeyCopy(locale).decision;
}

/**
 * THE NEXT OCCURRENCE, WITHOUT REWRITING THE HOST (Slice 3.2P-R3.7).
 *
 * v13 folded the Host's moment into a noun phrase — `"During morning huddles"` became
 * `"During the next morning huddles"`, a plural under a singular determiner, and W6 shipped it.
 * Measured across real answers the fold refuses `"During the weekly scheduling review"`
 * outright and every Korean moment, and mis-renders the one this pilot actually uses.
 *
 * So it stops transforming Host prose. The Host's occasion is stated verbatim two sections
 * above, in THE STANDARD and IN CONTEXT; what this section needs is a POINTER to the next one,
 * and a pointer needs no grammar. "The next time this happens" is correct for every shape a
 * Host can write, in any language, because it inspects none of them.
 */
const NEXT_OCCURRENCE = "The next time this happens";

export function renderApplicationSentence(
  b: BehaviorContract,
  a: ApplicationContract,
  construct: OperationalConstruct | null,
  locale?: JourneyLocale,
): string {
  const copy = journeyCopy(locale);
  const named = construct ? copy.constructClause(constructPhrase(construct)) : "";
  /*
    THE OCCASION, NOT THE INSTRUCTION (Slice R4-R5C11).

    This rendered "The next time this happens, <actor> must <action>. You will know it happened
    by this: <criterion>." — 56% of THE STANDARD as one contiguous run, plus the criterion for
    the third time. Against its own brief ("who does what, and when") it supplied no trigger,
    no timing and no occasion the learner did not already have; "the next time this happens" is
    a pointer, and the pointer was the only part that was not a repeat.

    So APPLY IT keeps the pointer, hands the attempt back to the learner, and states neither
    the behaviour nor the evidence. The construct clause stays: it names what the program is
    about without restating what to do.
  */
  return copy.application(named);
}

/**
 * BEFORE YOU FINISH — SUBORDINATE TO THE ONE MOMENT (Slice 3.2L-R10-A.2).
 *
 * `name_the_moment` used to render "When is the next time you …?", which asked the
 * participant to invent an occasion. That is the authority v9 removed from the model, and
 * leaving it open here kept one participant-facing side door to a second operational
 * moment — visible on the phone even while YOUR DECISION and APPLY IT had gone quiet
 * because the trigger no longer derived.
 *
 * The mode keeps its meaning — the answer is a plan — but the WHEN comes from the same
 * derived first instance as every other section. Returns null when that instance does not
 * exist, so the section goes quiet rather than asking about a "next time" BTY has already
 * decided it cannot name.
 */
export function renderCompletionQuestion(
  b: BehaviorContract,
  c: CompletionContract,
  locale?: JourneyLocale,
  hasActionDecision = false,
): string | null {
  const copy = journeyCopy(locale);
  /*
    TWO BOXES, TWO JOBS (Slice R4-R5C16B).

    FOUNDER-OBSERVED on a real learner mid-training. YOUR DECISION asked "다음에 이런 상황이
    생기면 무엇을 다르게 해보겠습니까?" and BEFORE YOU FINISH, four lines later, asked for the
    same commitment again — two free-text boxes, and the same sentence would have answered both
    truthfully. That is the defect R4-R5C12A closed from the other side: not copying the answer
    off the screen this time, but writing the same answer twice.

    So where the program ALREADY has a decision section, this one stops asking for a decision. It
    asks what makes the decision hard to keep — answerable only from the learner's own work, not
    from THE STANDARD, and not the same mental operation as choosing what to do.

    WHERE THERE IS NO DECISION SECTION nothing changes: this stays the program's one place to ask
    for a concrete commitment, exactly as before. And a Host who wrote their own completion
    question still outranks all of it — `resolveCompletionCheck` decides that before this renders
    (Slice 3.2R-R2.3), so their words are never replaced by BTY's.
  */
  if (hasActionDecision) return copy.completionBarrier;
  const target: Record<VerificationTarget, string> = copy.completionTarget;
  /*
    WHAT THOSE THREE TARGET CLAUSES SAY, and why — the wording now lives in `journeyLocaleCopy`.

    `the_behaviour` was `you ${action}` until R4-R5C11, so the closing question quoted THE
    STANDARD back at a learner who had just read it and the honest answer was to copy the
    sentence above. It names the SITUATION instead.

    `the_application_plan` avoids "put this into practice": that reads as an idiom and parses as
    a definite construct reference — "practice" is one of the nouns the dependency graph gates,
    so the phrase quietly claimed a construct the program had not defined (Slice 3.2O-R1).

    `the_confirmation_step` sits inside "What exactly will you say when …?", so it needs a
    CLAUSE, and the criterion is a sentence in an unknown shape — dropping it in raw produced
    "when The huddle note records …". It names the step that PRODUCES the evidence, and
    introduces no person to do it (Slice 3.2P-R3.4-R1).
  */
  if (c.responseMode === "name_the_moment") {
    /*
      Deliberately NOT a verbatim repeat of the standard — the participant has just read it
      twice. It asks what they will do at the moment that is already established.

      AND IT NAMES NO CONSTRUCT (Slice 3.2O-R1). This branch used to ask "what will you do to
      follow this standard". For a training whose behaviour IS a standard that reads
      correctly; for one about confirmation calls and a checklist it does not, because
      nothing in the program ever defined a "standard". BTY's own dependency graph then
      refused BTY's own sentence — `used_before_defined`, construct `standard` — on a real
      pilot, and the model was blamed for a line it never wrote.

      So the question points at the behaviour, which every program has by construction, and
      never at a noun the behaviour contract may not have established. The rule this restores
      is the same one the graph enforces on the model: do not refer definitely to a construct
      no section has defined.
    */
    return copy.completionNameTheMoment(copy.completionAsk[c.verificationTarget]);
  }
  return copy.completionMode[c.responseMode](target[c.verificationTarget]);
}

/**
 * WHY THIS MATTERS, DERIVED (Slice 3.2L-R9).
 *
 * THE DEFECT THIS CLOSES. Two live windows in a row promised an organisational result the
 * Host never established — v5 "ultimately affects project success and team collaboration",
 * v7 "ensures that everyone is clear on responsibilities … supports team collaboration and
 * improves overall workflow efficiency". Both were caught only by a phrase list, and the
 * second slipped it entirely using new words for the same claim.
 *
 * A stronger list would have bought one window. So the rationale stops being free prose and
 * joins the six instructional sections: it is RENDERED from authorities that already exist
 * and are already validated — the Host's own problem statement, the behaviour the program
 * introduces, and how that behaviour is confirmed. An unsupported causal outcome is not
 * something this function can emit, whatever the model writes.
 *
 * What it says, and nothing more: here is the problem you described; here is the one
 * visible thing this program asks people to do about it.
 */
export function renderRationaleSentence(
  problemStatement: string,
  b: BehaviorContract,
  construct: OperationalConstruct | null,
  locale?: JourneyLocale,
): string {
  const copy = journeyCopy(locale);
  const problem = stripTrailingStop(problemStatement.trim());
  /*
    CONSEQUENCE ONLY (Slice R4-R5C11). This closed on `${actor} ${action}` and then on the
    Host's completion criterion, so WHY THIS MATTERS restated THE STANDARD and the evidence
    before the participant had met either as its own section.

    MEASURED ON A REAL LEARNER, not inferred: across one published training the behaviour
    clause reached them SEVEN times and the criterion FOUR, and they described being shown the
    answer repeatedly and then asked to type it back. Six of those repetitions were written by
    these renderers, not by the model — the model's prose for this kind is discarded.

    So this section renders neither the behaviour nor the evidence. It states the Host's
    problem and says the program answers it, which is the one job the sequence gives it and
    the only claim these inputs support. `b` stays in the signature: the family shares it, and
    the ban on USING it here is asserted by the composition guard, not by the type.
  */
  const introduces = construct ? copy.introducesConstruct(construct.noun) : copy.introducesDefault;
  return copy.rationale(problem, introduces);
}

/**
 * WHAT HAPPENS NEXT — self-report, and now with no second person to ask (Slice 3.2P-R3.4-R1).
 *
 * R9's counterpart question ("Did you see or hear the receiving team member …?") was derived
 * ENTIRELY from `confirmedBy` and `confirmationAction`. With completion server-owned there is
 * no confirmer to address, and manufacturing one here would reintroduce exactly the invention
 * this version removed — one section quietly asking a person the rest of the program never
 * names. So `the_other_person` is gone from `CONFIRMERS`, and `isJointConfirmer` /
 * `renderCounterpartQuestion` went with it.
 *
 * THE EVIDENCE LADDER IS UNMOVED. The Host's criterion is stated as the completion evidence
 * and the answer is still described as a report. A sentence about a log, a form or a
 * supervisor is what COMPLETION looks like in this workplace; it is not this program
 * observing anything, and nothing here says it is.
 */
export function renderFollowUpSentence(b: BehaviorContract, f: FollowUpContract, followUpDays: number, locale?: JourneyLocale): string {
  /**
   * TENSE-SAFE, AND NO LONGER A SEVENTH COPY (Slice R4-R5C11).
   *
   * Two of the three focuses closed on "…when you were expected to <action>", which put the
   * whole behaviour clause into a sentence whose job is to say WHEN BTY will ask and WHAT KIND
   * of answer it is. The past tense was the part worth keeping; the instruction was not. Each
   * focus now points at the attempt the learner actually made.
   *
   * The Host's criterion is gone from here too. It belongs to THE STANDARD, which renders the
   * behaviour contract it is a field of, and to WHAT SUCCESS LOOKS LIKE, which is the Host's
   * own evidence section. A follow-up question is neither.
   */
  const copy = journeyCopy(locale);
  return copy
    .followUp(followUpDays, copy.followUpFocus[f.reviewFocus], copy.followUpBy[f.confirmer])
    .replace(/\s+/g, " ")
    .trim();
}
