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
// V2.2: repetition-depth propositions now carry a provenance-bounded repetition meaning (not just a
// "continuity" angle). Bumped so V2.2 settled rows / fingerprints are distinct from V2.1.
export const LIVING_RESPONSE_PROPOSITION_VERSION = "lrprop_v2";

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

/** V2.2 provenance-bounded repetition meaning. Recurrence ONLY — never avoidance/change/improvement. */
export type LivingResponseRepetitionMovement =
  | "repeated_inward_return"
  | "repeated_naming"
  | "repeated_relational_presence";

export type LivingResponseRepetitionMeaning = {
  movement: LivingResponseRepetitionMovement;
  /** Human recurrence vocabulary the provider may weave. Never codes/counts/dates/PII. */
  safeTokens: readonly string[];
  /** Meanings the provider must NOT add on top of recurrence (privacy/relational/improvement/…). */
  prohibitedExtensions: readonly string[];
  /** The exact machine codes that PROVE this recurrence — server-side only, never in the prompt. */
  provenanceCodes: readonly string[];
};

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
  /** V2.2: present ONLY at repetition depth. The deterministic, provenance-backed recurrence the
   *  sentence must express in relation to today's frame. Absent → no repetition may be claimed. */
  repetition?: LivingResponseRepetitionMeaning;
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

// ── V2.2 repetition-meaning derivation ─────────────────────────────────────────────────────────────
// A qualifying evidence code proves ONLY recurrence of a specific behavior. It is NEVER converted into
// avoidance, privacy, delay, change, improvement, or any user trait. Codes whose provenance is
// change-flavored (OTHERS_REEXPOSURE_* — validated as "changed") are deliberately NOT mapped here:
// expressing them safely would require contrast provenance, which STEP 1 must not add. Their packets
// therefore DOWNGRADE to commitment depth.

// Prohibited-extension claim ids (checked by the validator, hinted in the prompt). These are meanings
// recurrence alone cannot support.
const REPETITION_PROHIBITED_BASE = [
  "improvement", "growth", "values", "tendency", "avoidance", "fear", "delay", "withheld", "distance",
] as const;
const REPETITION_PROHIBITED_SELF = [...REPETITION_PROHIBITED_BASE, "another_person", "private", "spoken", "hearing", "conversation", "apology", "repair"];
const REPETITION_PROHIBITED_OTHERS = [...REPETITION_PROHIBITED_BASE, "private", "spoken", "hearing", "conversation", "apology", "repair"]; // another_person permitted (Others frame destination)

type RepetitionRule = {
  test: RegExp;
  relationship: LivingResponseRelationship;
  movement: LivingResponseRepetitionMovement;
  safeTokens: readonly string[];
  prohibitedExtensions: readonly string[];
};

// Priority order: the first qualifying code that maps (and matches the frame relationship) wins.
const REPETITION_RULES: readonly RepetitionRule[] = [
  { test: /^SELF_RETURN_/, relationship: "self", movement: "repeated_inward_return", safeTokens: ["again", "more than once", "returned", "return", "inward"], prohibitedExtensions: REPETITION_PROHIBITED_SELF },
  { test: /^SELF_KEEP_/, relationship: "self", movement: "repeated_naming", safeTokens: ["again", "more than once", "named", "naming", "kept"], prohibitedExtensions: REPETITION_PROHIBITED_SELF },
  { test: /^OTHERS_RELATIONAL_/, relationship: "others", movement: "repeated_relational_presence", safeTokens: ["again", "more than once", "carried", "alongside", "present"], prohibitedExtensions: REPETITION_PROHIBITED_OTHERS },
  // OTHERS_REEXPOSURE_* intentionally unmapped (change-flavored provenance) → commitment downgrade.
];

/** Derive the ONE provenance-bounded repetition meaning from qualifying codes, or null (→ downgrade). */
function deriveRepetitionMeaning(
  relationship: LivingResponseRelationship,
  historyCodes: readonly string[],
): LivingResponseRepetitionMeaning | null {
  for (const rule of REPETITION_RULES) {
    if (rule.relationship !== relationship) continue;
    const matched = historyCodes.filter((c) => rule.test.test(c));
    if (matched.length === 0) continue;
    return {
      movement: rule.movement,
      safeTokens: rule.safeTokens,
      prohibitedExtensions: rule.prohibitedExtensions,
      provenanceCodes: matched, // exact codes that PROVE this recurrence
    };
  }
  return null;
}

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
  // V2.1: contrast is never authorized. V2.2: repetition depth is honored ONLY when a provenance-backed
  // repetition meaning is derivable — otherwise DOWNGRADE to commitment (never claim unsupported history).
  const repetition = depth === "repetition" ? deriveRepetitionMeaning(frame.relationship, historyCodes) : null;
  const runtimeDepth: LivingResponseDepth = repetition ? "repetition" : "commitment";

  const allowedAngles: LivingResponseAngle[] =
    runtimeDepth === "repetition" ? [...meaning.commitmentAngles, "continuity"] : [...meaning.commitmentAngles];

  const propositionCode = repetition ? `${frame.pathId}.repetition.${repetition.movement}` : `${frame.pathId}.commitment`;
  const angle = allowedAngles[pickIndex(`${angleSeed}:${propositionCode}`, allowedAngles.length)];

  // At repetition depth the frame's prohibited claims are joined with the recurrence-specific ones so
  // the validator rejects any privacy/relational/improvement/change extension the provider might add.
  const prohibitedClaims = repetition
    ? [...new Set([...meaning.prohibitedClaims, ...repetition.prohibitedExtensions])]
    : meaning.prohibitedClaims;

  return {
    depth: runtimeDepth,
    propositionCode,
    subject: meaning.subject,
    movement: frame.movement,
    meaningTokens: meaning.meaningTokens,
    requiredAnchors: [frame.movement, frame.destination],
    prohibitedClaims,
    angle,
    provenanceCodes: repetition ? [...repetition.provenanceCodes] : [],
    ...(repetition ? { repetition } : {}),
  };
}
