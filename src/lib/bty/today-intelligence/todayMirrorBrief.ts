/**
 * BTY Today AI Mirror — prompt-facing Evidence Brief projection (service layer). V4.
 *
 * A GENERATION PROJECTION ONLY. V4 separates CONTROL METADATA from USER MEANING: the fact that a
 * relationship is derived / not explicitly chosen lives in `relationship_context` (control, never
 * spoken), while `confirmed_observation`/`permitted_meanings` carry only what BEHAVIOR is supported
 * — no "derived from records / not a stated choice" prose to echo. No DB, no tracking, no raw user
 * text, no hidden metrics, no internal table names. When there is no real before/after, `contrast`
 * is null. The deterministic contract remains authoritative; this only anchors the verbalizer.
 */
import type { Relationship } from "@/domain/daily/axisRelationship";
import type {
  MirrorLens,
  TodayMirrorAnalysis,
  TodayMirrorEvidencePacket,
} from "@/domain/daily/todayMirror.types";

export type RelationshipContext = {
  value: "SELF" | "OTHERS" | "WORLD" | null;
  source_type: "derived";
  explicit_choice: false;
  /** The only claim the response may make about the relationship. */
  allowed_user_claim: "behavioral_observation_only";
};

export type EvidenceBrief = {
  confirmed_observation: string;
  contrast: { before: string; after: string } | null;
  unfinished_edge: string | null;
  relationship_context: RelationshipContext;
  permitted_meanings: string[];
  forbidden_inferences: string[];
  existing_open_contract: boolean;
  safe_action_boundaries: string[];
};

const REL_UP: Record<Relationship, "SELF" | "OTHERS" | "WORLD"> = {
  Self: "SELF",
  Others: "OTHERS",
  World: "WORLD",
};

/** Guardrails passed to the model as directives (NOT meanings to express aloud). */
const BASE_FORBIDDEN = [
  "no motive or intent claims",
  "no identity labels",
  "no hidden metrics, scores, ranks, or counts",
  "never say the user 'chose' a relationship",
  "never explain to the user that anything was derived, recorded, analyzed, classified, or mapped",
];

/** Relationship-specific behavioral observation + concrete action boundaries. */
function relationshipCore(rel: "SELF" | "OTHERS" | "WORLD" | null): {
  observation: string;
  actions: string[];
} {
  switch (rel) {
    case "OTHERS":
      return {
        observation: "Recent activity contains more behavior connected to other people.",
        actions: ["ask one clear question", "name one unresolved point", "listen before explaining (only when safe)"],
      };
    case "SELF":
      return {
        observation: "Recent activity leaned toward how you treat yourself and what you promised yourself.",
        actions: ["return to one thing you set down for yourself"],
      };
    case "WORLD":
      return {
        observation: "Recent activity leaned toward work, responsibility, or something being made or tended.",
        actions: ["begin, finish, repair, organize, clarify, or decide ONE supported real task"],
      };
    default:
      return {
        observation: "Recent activity showed a consistent direction.",
        actions: ["make one supported next move clearer"],
      };
  }
}

function briefForLens(
  lens: MirrorLens,
  rel: "SELF" | "OTHERS" | "WORLD" | null,
): Omit<EvidenceBrief, "relationship_context" | "existing_open_contract"> {
  switch (lens) {
    case "reexposure_change":
      return {
        confirmed_observation: "You returned to a situation you had faced before, and this time the choice or ending was different.",
        contrast: { before: "the earlier time, it went one way", after: "this time, it changed" },
        unfinished_edge: "the change is one instance, not yet a stable shift",
        permitted_meanings: ["the change is real for this instance", "a permanent pattern shift is not yet supported"],
        forbidden_inferences: [...BASE_FORBIDDEN, "do not claim permanent change"],
        safe_action_boundaries: ["name the exact difference", "repeat the changed behavior once to keep the new ending"],
      };
    case "return_after_miss":
      return {
        confirmed_observation: "You returned to something after missing or dropping it.",
        contrast: null,
        unfinished_edge: "the return happened, but there is no evidence yet that the pattern changed",
        permitted_meanings: ["returning is supported", "permanent change is not supported"],
        forbidden_inferences: [...BASE_FORBIDDEN, "do not imply the pattern is fixed"],
        safe_action_boundaries: ["begin sooner — perform the first bounded motion", "reduce the delay before returning, before explanation accumulates"],
      };
    case "completion_latency":
      return {
        confirmed_observation: "The interval from choosing the action to its verified completion was shorter than for your previous comparable action.",
        contrast: { before: "the earlier comparable action took longer from choice to completion", after: "this one closed faster" },
        unfinished_edge: "it happened once; it is not yet a habit",
        permitted_meanings: ["carrying a chosen action through to completion sooner is supported for this instance"],
        forbidden_inferences: [
          ...BASE_FORBIDDEN,
          "do NOT claim faster recognition/reaction/starting, awareness-to-action gap, discipline, motivation, or habit change — this is choice→verified-completion only",
          "do not frame this as productivity or workflow",
        ],
        safe_action_boundaries: ["carry one already-chosen action through to completion sooner today"],
      };
    case "open_contract_gravity":
      return {
        confirmed_observation: "A promise you made earlier is still open.",
        contrast: null,
        unfinished_edge: "the promise is unentered",
        permitted_meanings: ["today may be for entering it, not adding to it"],
        forbidden_inferences: [...BASE_FORBIDDEN, "do not restate or paraphrase the promise text", "do not add advice around it"],
        safe_action_boundaries: [],
      };
    case "repeated_pattern":
      return {
        confirmed_observation: "A familiar move appeared again at a similar moment.",
        contrast: null,
        unfinished_edge: "it recurred; the earliest moment is where it can be interrupted",
        permitted_meanings: ["the recurrence is supported", "the earliest moment is where change is possible"],
        forbidden_inferences: [...BASE_FORBIDDEN, "do not prescribe generic reflection"],
        safe_action_boundaries: ["identify the earliest moment it starts", "replace one observable behavior at that moment"],
      };
    case "relationship_concentration": {
      const core = relationshipCore(rel);
      return {
        confirmed_observation: core.observation,
        contrast: null,
        unfinished_edge: null,
        permitted_meanings: ["the recent lean the behavior shows is supported"],
        forbidden_inferences: [...BASE_FORBIDDEN, "do not default to 'reach out'"],
        safe_action_boundaries: core.actions,
      };
    }
    case "recovery_reentry":
      return {
        confirmed_observation: "You returned to something you had paused.",
        contrast: null,
        unfinished_edge: "the return is small; keeping it unbroken matters more than making it big",
        permitted_meanings: ["a small return is supported"],
        forbidden_inferences: [...BASE_FORBIDDEN, "behavioral return only — no recovery/re-entry/reintegration or psychological-state framing", "no performance language"],
        safe_action_boundaries: ["keep the return unbroken with one small continuation"],
      };
    case "insufficient_evidence":
    default:
      return {
        confirmed_observation: "There isn't enough movement yet to read today closely.",
        contrast: null,
        unfinished_edge: null,
        permitted_meanings: ["a quiet, honest observation only"],
        forbidden_inferences: [...BASE_FORBIDDEN, "do not manufacture meaning"],
        safe_action_boundaries: [],
      };
  }
}

/** Build the deterministic Evidence Brief for the prompt. Pure mapping; no I/O. */
export function buildEvidenceBrief(
  packet: TodayMirrorEvidencePacket,
  analysis: TodayMirrorAnalysis,
): EvidenceBrief {
  const rel = analysis.relationship ? REL_UP[analysis.relationship] : null;
  const core = briefForLens(analysis.selectedLens, rel);
  return {
    ...core,
    relationship_context: {
      value: rel,
      source_type: "derived",
      explicit_choice: false,
      allowed_user_claim: "behavioral_observation_only",
    },
    existing_open_contract: packet.openContract !== null,
    safe_action_boundaries: analysis.mustAvoidContractDuplication ? [] : core.safe_action_boundaries,
  };
}
