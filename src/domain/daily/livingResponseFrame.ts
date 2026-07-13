/**
 * livingResponseFrame (domain) — V2.1 Commitment-Aware meaning derivation. Pure: no I/O, no
 * Date.now(), no side effects.
 *
 * TWO server-owned derivations, both from the canonical committed relationship (never client text):
 *   1. deriveCommitmentFrame(relationship) → the immutable-by-meaning TodayCommitmentFrame. The Today
 *      Path is 1:1 with the relationship (one static path per Self/Others/World), so the relationship
 *      value already persisted is a sufficient canonical id — NO new column, NO free text, NO PII.
 *   2. selectProposition(frame, depth, ...) → ONE authorized LivingResponseProposition + ONE selected
 *      expression angle. The provider then EXPRESSES this; it never chooses the underlying meaning.
 *
 * V2.1 scope: depth ∈ {commitment, repetition}. `contrast` exists in the type only as future-reserved;
 * no runtime path here returns it. Movements/forms/destinations are the smallest set the current EN+KO
 * Today Path copy actually supports (verified against BtyDailyAppShell COPY): naming/return (self),
 * carrying care into a relationship (others), building with stewardship (world).
 */
import type { LivingResponseRelationship } from "@/domain/daily/livingResponse";

export const COMMITMENT_FRAME_VERSION = "cf_v1";
export const LIVING_RESPONSE_PROPOSITION_VERSION = "lrprop_v1";

export type TodayCommitmentFrameVersion = "cf_v1";
export type TodayCommitmentPathId =
  | "self_return_honestly"
  | "others_carry_care"
  | "world_build_stewardship";
export type LivingResponseMovement =
  | "unspoken_to_named"
  | "private_to_relational"
  | "decision_to_action";
export type LivingResponseActionForm = "name" | "carry" | "build";
export type LivingResponseDestination = "self" | "another_person" | "shared_reality";

export type TodayCommitmentFrame = {
  frameVersion: TodayCommitmentFrameVersion;
  relationship: LivingResponseRelationship;
  pathId: TodayCommitmentPathId;
  movement: LivingResponseMovement;
  actionForm: LivingResponseActionForm;
  destination: LivingResponseDestination;
};

/** commitment | repetition are the only V2.1 runtime depths. contrast is future-reserved (never returned). */
export type LivingResponseDepth = "commitment" | "repetition" | "contrast";

export type LivingResponseAngle = "boundary" | "visibility" | "consequence" | "continuity";

export type LivingResponseProposition = {
  depth: LivingResponseDepth;
  propositionCode: string;
  subject: string;
  movement: LivingResponseMovement;
  /** Human grounding words the provider must anchor to. Never codes, never counts, never PII. */
  meaningTokens: readonly string[];
  /** movement + destination ids the validator requires the sentence to surface (≥1). */
  requiredAnchors: readonly string[];
  prohibitedClaims: readonly string[];
  angle: LivingResponseAngle;
  /** Machine evidence codes — server-side provenance only; NEVER placed in the prompt. */
  provenanceCodes: readonly string[];
};

/** relationship → the single static Today Path meaning. Exhaustive; unknown → null (fail closed). */
const FRAME_BY_RELATIONSHIP: Readonly<Record<LivingResponseRelationship, TodayCommitmentFrame>> = {
  self: {
    frameVersion: COMMITMENT_FRAME_VERSION,
    relationship: "self",
    pathId: "self_return_honestly",
    movement: "unspoken_to_named",
    actionForm: "name",
    destination: "self",
  },
  others: {
    frameVersion: COMMITMENT_FRAME_VERSION,
    relationship: "others",
    pathId: "others_carry_care",
    movement: "private_to_relational",
    actionForm: "carry",
    destination: "another_person",
  },
  world: {
    frameVersion: COMMITMENT_FRAME_VERSION,
    relationship: "world",
    pathId: "world_build_stewardship",
    movement: "decision_to_action",
    actionForm: "build",
    destination: "shared_reality",
  },
};

/**
 * Derive the server-owned Commitment Frame from the canonical committed relationship. Returns null
 * for an impossible/unknown relationship so admission can fail closed (never fabricates a meaning).
 */
export function deriveCommitmentFrame(relationship: string): TodayCommitmentFrame | null {
  return FRAME_BY_RELATIONSHIP[relationship as LivingResponseRelationship] ?? null;
}

export function isTodayCommitmentFrame(x: unknown): x is TodayCommitmentFrame {
  if (!x || typeof x !== "object") return false;
  const f = x as Partial<TodayCommitmentFrame>;
  return (
    f.frameVersion === COMMITMENT_FRAME_VERSION &&
    (f.relationship === "self" || f.relationship === "others" || f.relationship === "world") &&
    deriveCommitmentFrame(f.relationship) !== null &&
    // frame must be the canonical derivation for its relationship (no client-forged fields)
    FRAME_BY_RELATIONSHIP[f.relationship].pathId === f.pathId &&
    FRAME_BY_RELATIONSHIP[f.relationship].movement === f.movement &&
    FRAME_BY_RELATIONSHIP[f.relationship].actionForm === f.actionForm &&
    FRAME_BY_RELATIONSHIP[f.relationship].destination === f.destination
  );
}

/** Per-path authorized meaning (V2.1 commitment-depth core). Locale-independent in MEANING. */
type PathMeaning = {
  subject: string;
  meaningTokens: readonly string[];
  prohibitedClaims: readonly string[];
  /** Angles supported at commitment depth (repetition adds "continuity"). */
  commitmentAngles: readonly LivingResponseAngle[];
};

const MEANING_BY_PATH: Readonly<Record<TodayCommitmentPathId, PathMeaning>> = {
  self_return_honestly: {
    subject: "return",
    meaningTokens: ["inward", "named", "honesty", "form", "return"],
    prohibitedClaims: ["dishonesty", "avoidance", "emotion", "communication_with_others", "ownership", "change"],
    commitmentAngles: ["visibility", "boundary"],
  },
  others_carry_care: {
    subject: "care",
    meaningTokens: ["care", "received", "another person", "relational", "reaches"],
    prohibitedClaims: ["damaged_relationship", "neglect", "repair", "conversation", "apology", "other_reaction", "change"],
    commitmentAngles: ["visibility", "consequence"],
  },
  world_build_stewardship: {
    subject: "stewardship",
    meaningTokens: ["stewardship", "built", "responsibility", "form", "made"],
    prohibitedClaims: ["productivity", "achievement", "procrastination", "leadership_growth", "business_result", "completion", "change"],
    commitmentAngles: ["visibility", "boundary"],
  },
};

/** Deterministic FNV-1a index — stable per (day, relationship, propositionCode); no Math.random. */
function pickIndex(material: string, count: number): number {
  if (count <= 0) return 0;
  let h = 0x811c9dc5;
  for (let i = 0; i < material.length; i++) {
    h ^= material.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h % count;
}

/**
 * Select the ONE authorized proposition + ONE expression angle for this committed day.
 *
 * @param depth        commitment (frame only) or repetition (frame + qualifying history). contrast is
 *                     NOT accepted at runtime in V2.1 → coerced to commitment (fail safe).
 * @param historyCodes qualifying evidence codes (repetition provenance) — server-side only.
 * @param angleSeed    stable seed (e.g. `${dayKey}:${relationship}`) so the angle is deterministic and
 *                     identical on retry/reclaim; NOT provider temperature.
 */
export function selectProposition(
  frame: TodayCommitmentFrame,
  depth: LivingResponseDepth,
  historyCodes: readonly string[],
  angleSeed: string,
): LivingResponseProposition {
  const meaning = MEANING_BY_PATH[frame.pathId];
  // V2.1: contrast is never authorized; any non-repetition depth collapses to commitment.
  const runtimeDepth: LivingResponseDepth = depth === "repetition" ? "repetition" : "commitment";

  const allowedAngles: LivingResponseAngle[] =
    runtimeDepth === "repetition" ? [...meaning.commitmentAngles, "continuity"] : [...meaning.commitmentAngles];

  const propositionCode = `${frame.pathId}.${runtimeDepth}`;
  const angle = allowedAngles[pickIndex(`${angleSeed}:${propositionCode}`, allowedAngles.length)];

  return {
    depth: runtimeDepth,
    propositionCode,
    subject: meaning.subject,
    movement: frame.movement,
    meaningTokens: meaning.meaningTokens,
    requiredAnchors: [frame.movement, frame.destination],
    prohibitedClaims: meaning.prohibitedClaims,
    angle,
    provenanceCodes: runtimeDepth === "repetition" ? [...historyCodes] : [],
  };
}
