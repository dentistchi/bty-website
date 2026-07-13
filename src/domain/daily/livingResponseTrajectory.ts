/**
 * livingResponseTrajectory (domain) — the Living Continuity layer. Pure: no I/O, no Date.now(), no
 * side effects.
 *
 * Where the V2.2 `repetition` meaning models *behavioral recurrence* (a single behavior seen again in
 * the evidence tables), TRAJECTORY models the SHAPE of the user's recent COMMITMENT SEQUENCE — the
 * relationship between today's confirmed relationship and the recent history of confirmed
 * relationships. It answers "is today a continuation / return / expansion / first step / re-entry /
 * long-held direction?" WITHOUT diagnosis, metrics, or identity claims.
 *
 * The ONLY input is the canonical, Today-internal commitment history (`today_relationship_commitments`
 * — one immutable row per BTY day, machine columns only: relationship + day_key). No counts are ever
 * surfaced; no other person, emotion, trait, or score is read. The classifier is deterministic:
 * identical history → identical trajectory, on every retry/reclaim.
 *
 * LAYERING (Commander-ratified): Evidence → Trajectory → Voice. Trajectory is the MEANING layer; it is
 * a CONSUMER of evidence (relationship history, and — at composition time in `selectProposition` — the
 * behavioral `repetition` signal), never an evidence destroyer. Adding future trajectory kinds must
 * extend this consume step; it must NOT introduce per-signal "trajectory supersedes X" rules.
 */
import type { LivingResponseRelationship } from "@/domain/daily/livingResponse";

export type LivingResponseTrajectoryKind =
  | "first_step" // no established practice yet (empty/shallow history) — a genuine beginning
  | "continuation" // carried straight forward from the most recent day(s), same relationship
  | "long_held_direction" // the same relationship sustained across an extended recent run
  | "return" // was on this relationship, moved to another, now back — still engaged
  | "re_entry" // returning to the daily practice after a lapse (a gap of no commitments)
  | "expansion"; // a NEW relationship added beyond an established other-pattern — broadening

/** "Informative" shapes carry a temporal/sequence meaning worth expressing; `first_step`/`continuation`
 *  are low-information (a beginning or a plain carry-forward) and defer to the existing behavior. */
const INFORMATIVE: ReadonlySet<LivingResponseTrajectoryKind> = new Set([
  "long_held_direction",
  "return",
  "re_entry",
  "expansion",
]);

export function isInformativeTrajectory(kind: LivingResponseTrajectoryKind): boolean {
  return INFORMATIVE.has(kind);
}

export type LivingResponseTrajectory = {
  kind: LivingResponseTrajectoryKind;
  /** Human temporal/sequence vocabulary the provider MAY weave. Never codes, counts, dates, or PII. */
  safeTokens: readonly string[];
  /** Meanings the trajectory shape does NOT support — the sentence must add none of these
   *  (judgment / diagnosis / identity / absolutes). Checked by the validator, hinted in the prompt. */
  prohibitedExtensions: readonly string[];
  /** Whether the sentence expresses a RECURRENCE (again/return) — true for continuation/return/
   *  re_entry/long_held; false for first_step/expansion (a beginning / a widening, never "again"). */
  recurrence: boolean;
};

/** A prior confirmed commitment — machine columns only. `dayKey` is the canonical "YYYY-MM-DD". */
export type CommitmentHistoryItem = {
  relationship: LivingResponseRelationship;
  dayKey: string;
};

// ── deterministic thresholds ─────────────────────────────────────────────────────────────────────
// A gap (in days) since the most recent prior commitment at/above which the practice counts as lapsed.
const RE_ENTRY_GAP_DAYS = 5;
// Prior consecutive same-relationship commitments at/above which the run is a "long-held direction"
// (this many prior + today). 3 prior + today = a 4-day sustained direction.
const LONG_HELD_MIN_PRIOR = 3;
// Established prior pattern depth needed to call a brand-new relationship an "expansion" (vs first_step).
const EXPANSION_MIN_HISTORY = 3;

// Non-judgmental extension guards. Recurrence shapes must never become avoidance/failure/absolutes;
// beginnings must never become mastery/superiority. Identity/character is already blocked globally.
const RECURRENCE_PROHIBITED = ["avoidance", "failure", "gave_up", "abandoned", "always", "never_left"] as const;
const REENTRY_PROHIBITED = ["avoidance", "failure", "gave_up", "abandoned", "disappeared", "lapse_blame"] as const;
const EXPANSION_PROHIBITED = ["mastery", "finished", "superiority", "always"] as const;
const FIRST_STEP_PROHIBITED = ["always", "recurrence", "mastery"] as const;

const MEANING: Record<LivingResponseTrajectoryKind, Omit<LivingResponseTrajectory, "kind">> = {
  first_step: {
    safeTokens: ["first", "begins", "beginning", "new", "starts"],
    prohibitedExtensions: FIRST_STEP_PROHIBITED,
    recurrence: false,
  },
  continuation: {
    safeTokens: ["again", "still", "continues", "carried forward", "once more"],
    prohibitedExtensions: RECURRENCE_PROHIBITED,
    recurrence: true,
  },
  long_held_direction: {
    safeTokens: ["kept", "returned to", "again and again", "over these days", "held"],
    prohibitedExtensions: RECURRENCE_PROHIBITED,
    recurrence: true,
  },
  return: {
    safeTokens: ["back", "return", "returning", "again"],
    prohibitedExtensions: RECURRENCE_PROHIBITED,
    recurrence: true,
  },
  re_entry: {
    safeTokens: ["again", "back", "beginning again", "after a pause", "picking up"],
    prohibitedExtensions: REENTRY_PROHIBITED,
    recurrence: true,
  },
  expansion: {
    safeTokens: ["beyond", "wider", "reaching further", "opens", "new ground"],
    prohibitedExtensions: EXPANSION_PROHIBITED,
    recurrence: false,
  },
};

/** Parse "YYYY-MM-DD" to a UTC millisecond value (pure; Date.UTC is not Date.now). null if malformed. */
function dayKeyToUtcMs(k: string): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(k);
  if (!m) return null;
  const ms = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return Number.isNaN(ms) ? null : ms;
}

/** Whole-day gap between two day keys (absolute). null if either is malformed. */
function dayGap(a: string, b: string): number | null {
  const ma = dayKeyToUtcMs(a);
  const mb = dayKeyToUtcMs(b);
  if (ma === null || mb === null) return null;
  return Math.round(Math.abs(ma - mb) / 86_400_000);
}

/**
 * Classify the trajectory of today's committed `relationship` against the recent commitment history.
 *
 * @param relationship today's confirmed relationship (the frame).
 * @param todayDayKey  today's canonical BTY day key ("YYYY-MM-DD").
 * @param history      prior confirmed commitments (any order; today is filtered out defensively).
 *                     Machine-only; never carries text/PII.
 * @returns the deterministic {@link LivingResponseTrajectory}. Always classifiable (a shape always
 *          exists); callers decide whether to EXPRESS it (see {@link isInformativeTrajectory}).
 */
export function classifyTrajectory(
  relationship: LivingResponseRelationship,
  todayDayKey: string,
  history: readonly CommitmentHistoryItem[],
): LivingResponseTrajectory {
  const make = (kind: LivingResponseTrajectoryKind): LivingResponseTrajectory => ({ kind, ...MEANING[kind] });

  // Defensive: drop today (and any future key), keep well-formed prior keys, sort most-recent-first.
  const prior = history
    .filter((h) => h.dayKey < todayDayKey && dayKeyToUtcMs(h.dayKey) !== null)
    .slice()
    .sort((a, b) => (a.dayKey < b.dayKey ? 1 : a.dayKey > b.dayKey ? -1 : 0));

  if (prior.length === 0) return make("first_step");

  const prev = prior[0];
  const gapPrev = dayGap(todayDayKey, prev.dayKey);

  // A real lapse in the daily practice → re-entry (whatever the relationship). Checked first because a
  // long absence dominates: coming back after time away IS re-entry even to the same relationship.
  if (gapPrev !== null && gapPrev >= RE_ENTRY_GAP_DAYS) return make("re_entry");

  const everR = prior.some((h) => h.relationship === relationship);

  if (prev.relationship === relationship) {
    // Contiguous leading run of the same relationship (the sustained direction).
    let streak = 0;
    for (const h of prior) {
      if (h.relationship === relationship) streak++;
      else break;
    }
    return make(streak >= LONG_HELD_MIN_PRIOR ? "long_held_direction" : "continuation");
  }

  // prev is a DIFFERENT relationship (engaged recently — the lapse case was handled above).
  if (everR) return make("return"); // was here before, detoured, now back
  // Never chosen before: a genuine broadening only if there is an established prior pattern to widen from.
  return make(prior.length >= EXPANSION_MIN_HISTORY ? "expansion" : "first_step");
}
