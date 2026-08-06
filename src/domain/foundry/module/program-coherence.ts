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
 * GREEDY modifiers on purpose. "the handoff record template" contains TWO artifact nouns;
 * a lazy match stops at "record", finds it grounded (the Host wrote "Handoff record") and
 * never examines "template" — the ungrounded one. Measured: that made the R2 live miss
 * pass. Greedy matching reaches the HEAD noun, which is the artifact being claimed.
 */
const DEFINITE_ARTIFACT = new RegExp(
  `\\b(?:the|our|your|its|their|this|that|these|those|existing|available|current|ready-made|pre-made)\\s+((?:[\\w'-]+\\s+){0,3}(${ARTIFACT_ALT}))\\b`,
  "gi",
);

/** "access to the necessary tools and templates" — an availability claim. */
const ACCESS_ARTIFACT = new RegExp(
  `\\baccess\\s+to\\s+(?:the\\s+|any\\s+)?(?:necessary\\s+|required\\s+|appropriate\\s+|relevant\\s+)?((?:[\\w'-]+\\s+){0,3}(${ARTIFACT_ALT}))\\b`,
  "gi",
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
export type BehaviorContract = {
  actor: string;
  trigger: string;
  observableAction: string;
  completionSignal: string;
};

/**
 * Bounded so the RENDERED sentence cannot exceed the 700-character element ceiling:
 * four fields at 160 plus the connective text is ~665. Without this the standard could
 * validate as a contract and then overflow as content.
 */
export const CONTRACT_FIELD_LIMIT = 160;
const CONTRACT_FIELD_MIN = 3;

export type ContractField = keyof BehaviorContract;

export const CONTRACT_FIELDS: readonly ContractField[] = ["actor", "trigger", "observableAction", "completionSignal"];

/** Which field failed, so a refusal is diagnosable without echoing model prose. */
export type ContractDefect = { field: ContractField; reason: "missing" | "too_long" | "meta_only" | "not_a_role" | "no_moment" | "no_confirmation" };

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
export function validateBehaviorContract(raw: unknown): { ok: true; value: BehaviorContract } | { ok: false; defect: ContractDefect } {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    return { ok: false, defect: { field: "actor", reason: "missing" } };
  }
  const r = raw as Record<string, unknown>;
  const value: BehaviorContract = {
    actor: trimField(r.actor),
    trigger: trimField(r.trigger),
    observableAction: trimField(r.observable_action ?? r.observableAction),
    completionSignal: trimField(r.completion_signal ?? r.completionSignal),
  };

  for (const f of CONTRACT_FIELDS) {
    if (value[f].length < CONTRACT_FIELD_MIN) return { ok: false, defect: { field: f, reason: "missing" } };
    if (value[f].length > CONTRACT_FIELD_LIMIT) return { ok: false, defect: { field: f, reason: "too_long" } };
  }

  // The actor is a person or role. "The standard" performing itself is the passive
  // construction the live defect used.
  if (ARTIFACT_OR_CONSTRUCT_HEAD.test(value.actor)) return { ok: false, defect: { field: "actor", reason: "not_a_role" } };

  // The trigger places it in time.
  if (!MOMENT_MARKER.test(value.trigger)) return { ok: false, defect: { field: "trigger", reason: "no_moment" } };

  // The action is a behavior, not the construct's own life cycle, and not a bare
  // instruction to follow something unspecified.
  if (CONSTRUCT_LIFECYCLE_CLAIM(value.observableAction) || BARE_CONSTRUCT_USE.test(value.observableAction)) {
    return { ok: false, defect: { field: "observableAction", reason: "meta_only" } };
  }

  // The completion signal is something a second person could witness — and is not itself
  // just "the standard now exists".
  if (CONSTRUCT_LIFECYCLE_CLAIM(value.completionSignal)) {
    return { ok: false, defect: { field: "completionSignal", reason: "meta_only" } };
  }
  if (!CONFIRMATION_MARKER.test(value.completionSignal)) {
    return { ok: false, defect: { field: "completionSignal", reason: "no_confirmation" } };
  }

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

/** The action as it appears after a modal. Only the head verb is de-inflected. */
export function baseActionPhrase(action: string): string {
  const t = stripTrailingStop(action.trim());
  if (t.length === 0) return t;
  const [head, ...rest] = t.split(/\s+/);
  return [baseForm(head), ...rest].join(" ");
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

/** A moment that already begins with its own time preposition needs nothing added. */
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

/**
 * The same semantic moment, rendered for the perspective that section speaks in.
 * "next shift change" becomes "At my next shift change" in a first-person commitment and
 * "At the next shift change" in an instruction — never "I will … at your next shift change".
 */
export function momentClause(moment: string, possessive: "my" | "the"): string {
  const core = momentCore(moment);
  if (core.length === 0) return "";
  if (LEADING_TIME_WORD.test(core)) return upperFirst(core);
  return `At ${possessive} ${lowerFirst(core)}`;
}

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
export function renderStandardSentence(c: BehaviorContract): string {
  const trigger = stripTrailingStop(c.trigger.trim());
  const actor = stripTrailingStop(c.actor.trim());
  const action = baseActionPhrase(c.observableAction);
  const signal = stripTrailingStop(c.completionSignal.trim());
  return `${upperFirst(trigger)}, ${lowerFirst(actor)} must ${action}. It is complete when ${lowerFirst(signal)}.`;
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
export type ScenarioContract = {
  pressureOrConstraint: string;
  contextDetail: string;
};

export const SCENARIO_FIELD_LIMIT = 120;
const SCENARIO_FIELD_MIN = 8;

export type ScenarioField = keyof ScenarioContract;

export type ScenarioDefect = {
  field: ScenarioField;
  reason: "missing" | "too_long" | "generic" | "restates_action" | "no_pressure";
};

/**
 * Something that competes with doing it properly. This is a FLOOR on the pressure field's
 * own content — it is deliberately NOT the relevance authority, which is now structural.
 * A scenario cannot become relevant by matching this list, and cannot become irrelevant by
 * missing it: relevance comes from the derivation.
 */
const CONSTRAINT_MARKER =
  /\b(?:no\s+time|not\s+enough\s+time|short\s+of\s+time|running\s+late|late|rush\w*|hurry|busy|queue|waiting|already|interrupt\w*|pressure|push\w*\s+back|pushback|resist\w*|disagree\w*|argu\w*|refus\w*|tired|exhaust\w*|end\s+of\s+(?:the\s+)?(?:shift|day)|understaffed|short-staffed|missing|unavailable|absent|urgent|deadline|competing|conflict\w*|distract\w*|noisy|noise|nobody|no\s+one|someone\s+else|another\s+(?:person|task|request)|only\s+\w+\s+minutes|still\s+\w+ing|has\s+not\s+arrived|hasn't\s+arrived|left\s+(?:early|for\s+the\s+day)|awkward|uncomfortable|senior|manager\s+is|being\s+watched|first\s+time|unclear|unsure)\b|바쁘|늦|압박|서둘/i;

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
 * Validate the two fields the model must supply for a scenario. Relevance is NOT decided
 * here — it is guaranteed by construction, because the displayed scenario is rendered from
 * the behavior contract. What is decided here is whether the moment is actually hard, and
 * actually somewhere.
 */
export function validateScenarioContract(
  raw: unknown,
  behavior: BehaviorContract,
): { ok: true; value: ScenarioContract } | { ok: false; defect: ScenarioDefect } {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    return { ok: false, defect: { field: "pressureOrConstraint", reason: "missing" } };
  }
  const r = raw as Record<string, unknown>;
  const value: ScenarioContract = {
    pressureOrConstraint: trimField(r.pressure_or_constraint ?? r.pressureOrConstraint),
    contextDetail: trimField(r.context_detail ?? r.contextDetail),
  };

  for (const f of ["pressureOrConstraint", "contextDetail"] as const) {
    if (value[f].length < SCENARIO_FIELD_MIN) return { ok: false, defect: { field: f, reason: "missing" } };
    if (value[f].length > SCENARIO_FIELD_LIMIT) return { ok: false, defect: { field: f, reason: "too_long" } };
  }

  if (GENERIC_PRESSURE.some((re) => re.test(value.pressureOrConstraint))) {
    return { ok: false, defect: { field: "pressureOrConstraint", reason: "generic" } };
  }
  if (GENERIC_CONTEXT.some((re) => re.test(value.contextDetail))) {
    return { ok: false, defect: { field: "contextDetail", reason: "generic" } };
  }
  // A pressure that restates the required action describes no obstacle to it.
  if (saysTheSameThing(value.pressureOrConstraint, behavior.observableAction)) {
    return { ok: false, defect: { field: "pressureOrConstraint", reason: "restates_action" } };
  }
  if (!CONSTRAINT_MARKER.test(value.pressureOrConstraint)) {
    return { ok: false, defect: { field: "pressureOrConstraint", reason: "no_pressure" } };
  }

  return { ok: true, value };
}

/**
 * THE participant-facing scenario, DERIVED — so it cannot describe a different behavior
 * than the one the program defined. Same actor, same trigger, same required action, same
 * completion signal; the model contributes only the difficulty and the setting.
 */
export function renderScenarioSentence(b: BehaviorContract, s: ScenarioContract): string {
  const trigger = stripTrailingStop(b.trigger.trim());
  const actor = stripTrailingStop(b.actor.trim());
  const action = baseActionPhrase(b.observableAction);
  const signal = stripTrailingStop(b.completionSignal.trim());
  const pressure = stripTrailingStop(s.pressureOrConstraint.trim());
  const context = stripTrailingStop(s.contextDetail.trim());
  // A colon carries the pressure, so no verb has to agree with the actor OR the pressure.
  void trigger;
  return (
    `In ${lowerFirst(context)}: ${lowerFirst(pressure)}. ` +
    `Even then, ${lowerFirst(actor)} must ${action}. ` +
    `It is complete when ${lowerFirst(signal)}.`
  );
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
    ? [standard?.content ?? "", standardContract.actor, standardContract.trigger, standardContract.observableAction, standardContract.completionSignal].join(" ")
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

const CONSTRUCT_PHRASE = new RegExp(`\\b((?:[\\w'-]+\\s+){0,3}(${CONSTRUCT_ALT}))\\b`, "i");

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
    const m = CONSTRUCT_PHRASE.exec(source);
    if (!m) continue;
    const label = normalizeLabel(m[1]);
    if (label.length === 0) continue;
    const noun = nounStem(m[2]);

    // A verified upload naming this kind of thing is the strongest authority available.
    const verified = verifiedArtifacts.some((a) => a.toLowerCase().includes(noun));
    if (verified) return { label, noun, authorityMode: "verified_resource" };

    // The Host framed it as something to create → a proposal, and only a proposal.
    const before = source.slice(0, m.index + m[0].length);
    if (CREATION_FRAME.test(before) && !EXISTENCE_ADJECTIVE.test(m[0])) {
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
export type ApplicationContract = {
  applicationMoment: string;
  evidenceOrConfirmation: string;
};

export const APPLICATION_FIELD_LIMIT = 140;
const APPLICATION_FIELD_MIN = 8;

export type ApplicationDefect = { field: keyof ApplicationContract; reason: "missing" | "too_long" | "generic" | "no_moment" };

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
export const CONFIRMERS = ["self_report", "the_other_person", "the_host"] as const;
export type ReviewFocus = (typeof REVIEW_FOCUSES)[number];
export type Confirmer = (typeof CONFIRMERS)[number];
export type FollowUpContract = { reviewFocus: ReviewFocus; confirmer: Confirmer };

const GENERIC_MOMENT = [
  /^\s*(?:soon|later|regularly|often|sometimes|as\s+needed|when\s+possible|in\s+future|going\s+forward)\.?\s*$/i,
  /^\s*(?:at|in)\s+(?:work|the\s+workplace|the\s+office)\.?\s*$/i,
];

export function validateApplicationContract(
  raw: unknown,
): { ok: true; value: ApplicationContract } | { ok: false; defect: ApplicationDefect } {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    return { ok: false, defect: { field: "applicationMoment", reason: "missing" } };
  }
  const r = raw as Record<string, unknown>;
  const value: ApplicationContract = {
    applicationMoment: trimField(r.application_moment ?? r.applicationMoment),
    evidenceOrConfirmation: trimField(r.evidence_or_confirmation ?? r.evidenceOrConfirmation),
  };
  for (const f of ["applicationMoment", "evidenceOrConfirmation"] as const) {
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

export function renderDecisionSentence(b: BehaviorContract, a: ApplicationContract): string {
  const action = baseActionPhrase(b.observableAction);
  const moment = stripTrailingStop(a.applicationMoment.trim());
  return `${momentClause(moment, "my")}, I will ${action}.`;
}

export function renderApplicationSentence(
  b: BehaviorContract,
  a: ApplicationContract,
  construct: OperationalConstruct | null,
): string {
  const actor = stripTrailingStop(b.actor.trim());
  const action = baseActionPhrase(b.observableAction);
  const moment = stripTrailingStop(a.applicationMoment.trim());
  const evidence = stripTrailingStop(a.evidenceOrConfirmation.trim());
  const named = construct ? ` This is ${constructPhrase(construct)} in practice.` : "";
  return `${momentClause(moment, "the")}, ${lowerFirst(actor)} must ${action}.${named} You will know it happened when ${lowerFirst(evidence)}.`;
}

export function renderCompletionQuestion(b: BehaviorContract, c: CompletionContract): string {
  const action = baseActionPhrase(b.observableAction);
  const signal = lowerFirst(stripTrailingStop(b.completionSignal.trim()));
  const target: Record<VerificationTarget, string> = {
    the_behaviour: `you ${action}`,
    the_application_plan: `you put this into practice`,
    the_confirmation_step: `${signal}`,
  };
  const mode: Record<ResponseMode, (t: string) => string> = {
    name_the_moment: (t) => `When is the next time ${t}?`,
    state_what_you_will_say: (t) => `What exactly will you say when ${t}?`,
    name_what_could_stop_you: (t) => `What could stop you when ${t}?`,
  };
  return mode[c.responseMode](target[c.verificationTarget]);
}

export function renderFollowUpSentence(b: BehaviorContract, f: FollowUpContract, followUpDays: number): string {
  const action = baseActionPhrase(b.observableAction);
  const signal = lowerFirst(stripTrailingStop(b.completionSignal.trim()));
  /**
   * TENSE-SAFE. "what you actually said when you say it blunt" mixed a retrospective
   * question with a present-tense action. "when you were expected to …" keeps the whole
   * sentence in the past and works with any base action, colloquial ones included.
   */
  const focus: Record<ReviewFocus, string> = {
    what_you_said: `what you actually said when you were expected to ${action}`,
    what_happened_next: `what happened after you were expected to ${action}`,
    the_confirmation: `whether ${signal}`,
  };
  /** Never claims more than the workflow can show — the evidence ceiling in one clause. */
  const by: Record<Confirmer, string> = {
    self_report: "That is your own account of it, not an observation.",
    the_other_person: "The person on the other side of it will be asked the same question.",
    the_host: "Your host will read it with you.",
  };
  return `In ${followUpDays} days you will be asked ${focus[f.reviewFocus]}. ${by[f.confirmer]}`;
}
