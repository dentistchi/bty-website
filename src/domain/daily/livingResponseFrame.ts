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
import type { LivingResponseTrajectory } from "@/domain/daily/livingResponseTrajectory";
import { isInformativeTrajectory } from "@/domain/daily/livingResponseTrajectory";

export const COMMITMENT_FRAME_VERSION = "cf_v1";
// V2.2: repetition-depth propositions now carry a provenance-bounded repetition meaning (not just a
// "continuity" angle). V2.3: adds the Living Continuity `trajectory` (commitment-sequence shape).
// Bumped so V2.3 settled rows / fingerprints are distinct from V2.2.
export const LIVING_RESPONSE_PROPOSITION_VERSION = "lrprop_v3";

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
  /** V2.3 Living Continuity: present ONLY when an INFORMATIVE commitment-sequence shape exists
   *  (return / re_entry / expansion / long_held_direction) — the MEANING layer the sentence expresses
   *  in relation to today's frame. When present, `repetition` is absent because the trajectory has
   *  CONSUMED it (the behavioral evidence's provenance is preserved in `provenanceCodes`, not
   *  discarded) — so the Voice carries exactly one continuity claim. Absent → no trajectory claimed. */
  trajectory?: LivingResponseTrajectory;
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
 * @param trajectory   V2.3 Living Continuity shape from the commitment sequence — the MEANING layer.
 *                     When INFORMATIVE (return/re_entry/expansion/long_held_direction) it is the
 *                     expressed continuity meaning and CONSUMES the behavioral `repetition` evidence
 *                     (its provenance/guards fold in; it is never discarded). first_step/continuation
 *                     are neutral, so the behavioral repetition itself remains the expressed grounding.
 */
export function selectProposition(
  frame: TodayCommitmentFrame,
  depth: LivingResponseDepth,
  historyCodes: readonly string[],
  angleSeed: string,
  trajectory?: LivingResponseTrajectory | null,
): LivingResponseProposition {
  const meaning = MEANING_BY_PATH[frame.pathId];

  // ── LAYERING (Commander-ratified): Evidence → Trajectory → Voice ─────────────────────────────────
  // Repetition is EVIDENCE; trajectory is MEANING. Trajectory CONSUMES repetition — it never destroys
  // it. So repetition is always DETECTED here (the Evidence step), then either (a) consumed by an
  // informative commitment-sequence trajectory — its provenance/guards fold into the meaning while the
  // Voice expresses the trajectory — or (b) when the trajectory is neutral (first_step/continuation),
  // the behavioral repetition IS the expressed grounding (V2.2 preserved). Exactly one continuity claim
  // reaches the Voice; the consumed evidence is never discarded (its codes stay in provenanceCodes).
  // Future trajectories extend this same consume step — never a per-signal "trajectory supersedes X".

  // EVIDENCE — V2.2: repetition is honored ONLY when a provenance-backed meaning is derivable at
  // repetition depth (else there is simply no behavioral recurrence to consume or express).
  const repetitionEvidence = depth === "repetition" ? deriveRepetitionMeaning(frame.relationship, historyCodes) : null;

  // MEANING — an informative trajectory is the interpretation the Voice speaks; it consumes the
  // evidence. A neutral trajectory lets the evidence itself be expressed.
  const informativeTrajectory = trajectory && isInformativeTrajectory(trajectory.kind) ? trajectory : null;
  const consumedRepetition = informativeTrajectory ? repetitionEvidence : null; // folded in, not spoken
  const expressedRepetition = informativeTrajectory ? null : repetitionEvidence; // spoken when no meaning above it

  const runtimeDepth: LivingResponseDepth = expressedRepetition ? "repetition" : "commitment";

  const allowedAngles: LivingResponseAngle[] =
    expressedRepetition || informativeTrajectory ? [...meaning.commitmentAngles, "continuity"] : [...meaning.commitmentAngles];

  const propositionCode = informativeTrajectory
    ? `${frame.pathId}.trajectory.${informativeTrajectory.kind}`
    : expressedRepetition
      ? `${frame.pathId}.repetition.${expressedRepetition.movement}`
      : `${frame.pathId}.commitment`;
  const angle = allowedAngles[pickIndex(`${angleSeed}:${propositionCode}`, allowedAngles.length)];

  // Prohibited claims = frame limits + the EXPRESSED meaning's extensions + any CONSUMED evidence's
  // extensions (consuming repetition inherits its guards too), so the validator rejects any
  // judgment/diagnosis/absolute the provider might add on top of the shape.
  const continuityProhibited = informativeTrajectory
    ? [...informativeTrajectory.prohibitedExtensions, ...(consumedRepetition?.prohibitedExtensions ?? [])]
    : expressedRepetition
      ? expressedRepetition.prohibitedExtensions
      : [];
  const prohibitedClaims = continuityProhibited.length
    ? [...new Set([...meaning.prohibitedClaims, ...continuityProhibited])]
    : meaning.prohibitedClaims;

  // Provenance preserves EVERY consumed/expressed evidence code — proof the layer consumed, not
  // destroyed (and it keeps the evidence trail intact even when the Voice speaks only the trajectory).
  const provenanceCodes = [
    ...(expressedRepetition?.provenanceCodes ?? []),
    ...(consumedRepetition?.provenanceCodes ?? []),
  ];

  return {
    depth: runtimeDepth,
    propositionCode,
    subject: meaning.subject,
    movement: frame.movement,
    meaningTokens: meaning.meaningTokens,
    requiredAnchors: [frame.movement, frame.destination],
    prohibitedClaims,
    angle,
    provenanceCodes,
    ...(expressedRepetition ? { repetition: expressedRepetition } : {}),
    ...(informativeTrajectory ? { trajectory: informativeTrajectory } : {}),
  };
}
