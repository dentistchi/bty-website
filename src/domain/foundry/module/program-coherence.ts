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
  const action = stripTrailingStop(c.observableAction.trim());
  const signal = stripTrailingStop(c.completionSignal.trim());
  return `${upperFirst(trigger)}, ${lowerFirst(actor)} ${lowerFirst(action)}. It is complete when ${lowerFirst(signal)}.`;
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
// Whole-program dependency graph
// ---------------------------------------------------------------------------

export type ProgramSection = { kind: JourneyElementKind; content: string };

export type DependencyDefect = {
  kind: JourneyElementKind;
  /** The construct head noun the section depended on. Never model prose. */
  construct: string;
  reason: "used_before_defined" | "defined_after_use";
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
): DependencyDefect | null {
  const ordered = [...sections].sort((a, b) => orderOf(a.kind) - orderOf(b.kind));
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

  /** Constructs an earlier section already told the participant to use. */
  const usedBy = new Map<string, JourneyElementKind>();

  for (const s of ordered) {
    if (s.kind === "observable_standard") continue;

    for (const stem of definiteConstructs(s.content)) {
      if (!defined.has(stem)) {
        // Used, but no section ever said what the behavior is.
        return { kind: s.kind, construct: stem, reason: "used_before_defined" };
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
          return { kind: s.kind, construct: stem, reason: "defined_after_use" };
        }
      }
    }
  }

  return null;
}
