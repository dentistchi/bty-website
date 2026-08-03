/**
 * PROVIDER-CALL SEQUENCE OWNERSHIP (Slice 3.2I-R5B2-R5C-2).
 *
 * R5C measured that one product submission can execute up to fourteen external model calls across
 * four sites. To reconstruct what happened, each call needs its real position — both globally and
 * within its own kind — and those positions must be allocated by the request that owns them.
 *
 * The allocator is IN-MEMORY on purpose. A `select count(*) then insert` would be a read-modify-
 * write with no transaction around it, and would hand out duplicate positions the moment anything
 * overlapped. Source measurement proved the orchestration is strictly sequential — no `Promise.all`,
 * `race` or `allSettled` anywhere on the four call paths — so one counter per submission is exact,
 * and the database's unique constraints reject corruption rather than trusting this.
 *
 * Pure: no I/O, no clock, no randomness.
 */

export const CALL_KINDS = ["generation", "boundary_review", "boundary_repair", "semantic_review"] as const;
export type CallKind = (typeof CALL_KINDS)[number];

/**
 * The measured ceiling per submission: 2 generation + 4 boundary review + 4 boundary repair +
 * 4 semantic review. Recorded so a future loop-limit change shows up as a failing test rather than
 * as a silently longer sequence.
 */
export const MAX_CALLS_PER_KIND: Record<CallKind, number> = {
  generation: 2,
  boundary_review: 4,
  boundary_repair: 4,
  semantic_review: 4,
};
export const MAX_CALLS_PER_SUBMISSION = Object.values(MAX_CALLS_PER_KIND).reduce((a, b) => a + b, 0);

export type CallPosition = { callKind: CallKind; globalSequence: number; kindSequence: number };

/** Raised when an allocation would exceed a measured ceiling. Carries no content. */
export class CallSequenceLimitError extends Error {
  constructor(
    readonly kind: CallKind,
    readonly limit: number,
    readonly scope: "kind" | "submission",
  ) {
    super(`call sequence limit: ${scope} ${kind} > ${limit}`);
    this.name = "CallSequenceLimitError";
  }
}

export type CallSequenceAllocator = {
  /**
   * Allocate the next position for one kind. Monotonic and never reused.
   *
   * THROWS past a measured ceiling. A silent extra position would be worse than a failure: it
   * would record a provider call the architecture says cannot happen, and the number would then be
   * treated as evidence. A failed allocation leaves the allocator untouched, so the next legitimate
   * call still receives the correct position.
   */
  next(kind: CallKind): CallPosition;
  /** How many positions have been handed out. NOT a count of provider invocations. */
  allocated(): number;
  /** How many positions have been handed out for one kind. */
  allocatedForKind(kind: CallKind): number;
};

/**
 * One allocator per parent attempt. Positions start at 1, because 0 would be indistinguishable
 * from "unset" in a database column.
 */
export function createCallSequenceAllocator(): CallSequenceAllocator {
  let global = 0;
  const perKind = new Map<CallKind, number>();
  return {
    next(kind) {
      const usedForKind = perKind.get(kind) ?? 0;
      // Checked BEFORE any mutation, so a rejected allocation cannot corrupt the sequence.
      if (usedForKind + 1 > MAX_CALLS_PER_KIND[kind]) {
        throw new CallSequenceLimitError(kind, MAX_CALLS_PER_KIND[kind], "kind");
      }
      if (global + 1 > MAX_CALLS_PER_SUBMISSION) {
        throw new CallSequenceLimitError(kind, MAX_CALLS_PER_SUBMISSION, "submission");
      }
      const kindSequence = usedForKind + 1;
      perKind.set(kind, kindSequence);
      global += 1;
      return { callKind: kind, globalSequence: global, kindSequence };
    },
    allocated: () => global,
    allocatedForKind: (kind) => perKind.get(kind) ?? 0,
  };
}

/** Terminal outcomes of ONE provider call — about the call, never about the content it carried. */
export const CALL_OUTCOMES = [
  "success",
  "timeout",
  "transport_error",
  "http_error",
  "empty_output",
  "malformed_output",
  "schema_invalid",
  "internal_failure",
] as const;
export type CallOutcome = (typeof CALL_OUTCOMES)[number];

/**
 * The declared digest boundary. Naming it in the row means two digests are only ever compared when
 * they were produced the same way; an undeclared boundary would silently change meaning the first
 * time extraction moved.
 */
export const RESPONSE_DIGEST_SCOPE = "model_content_utf8" as const;

/**
 * Byte length of the exact UTF-8 encoding — not `String.length`, which counts UTF-16 code units and
 * under-reports every non-ASCII character. Korean scenario content would be wrong by a factor of
 * three.
 */
export function utf8ByteLength(s: string): number {
  return new TextEncoder().encode(s).length;
}
