/**
 * ATTEMPT-LEVEL FORENSIC CLASSIFICATION (Slice 3.2I-R5B1A.1-R2.24).
 *
 * WHY A MACHINE CLASS AND A HUMAN CLASS ARE SEPARATE
 *
 * The R2.23D-R4 evidence contains attempts a machine can classify with certainty, and attempts it
 * cannot. Conflating the two is how "1 generated valid" became "GATES PASS".
 *
 * A `review_malformed` attempt is knowable: the code fires ONLY at
 * `overallVerdict === "accept" && derivedDefects.length > 0`, so the reviewer wanted to accept the
 * scenario and its own detail fields disagreed. That is a REVIEWER defect, never a generator one,
 * and this module refuses to label it otherwise.
 *
 * A deterministic-gate rejection is knowable only when the scenario was captured. The service
 * captures the draft on the semantic-review rejection path but NOT on the deterministic-gate path,
 * so four attempts in the run have a defect code and no content behind it. Those are marked
 * UNRESOLVED rather than assumed, because a defect code is not evidence of what the model wrote.
 *
 * `generated_valid` is never a machine pass. It means no gate fired.
 */

/** The classes the slice defines. `RETRY_BOOKKEEPING` is not a finding — it is a ledger entry. */
export const FORENSIC_CLASSES = {
  A: "GENERATOR_CONTENT_DEFECT",
  B: "REVIEWER_OUTPUT_DEFECT",
  C: "REVIEWER_FALSE_POSITIVE",
  D: "REVIEWER_FALSE_NEGATIVE",
  E: "RETRY_CORRECTION_DEFECT",
  F: "MODEL_FAILED_ADEQUATE_CORRECTION",
  G: "DETERMINISTIC_GATE_CORRECT_REJECTION",
  H: "UNRESOLVED_DUE_TO_MISSING_EVIDENCE",
} as const;

export type ForensicClassKey = keyof typeof FORENSIC_CLASSES;

export type ForensicAttempt = {
  outcome: string;
  code?: string | null;
  defectCodes?: string[] | null;
  /** Present only when the pipeline captured the model's draft for this attempt. */
  scenario?: unknown;
  /** Present only when a review ran. For malformed reviews this is the error-code array. */
  review?: unknown;
  correctionPacket?: unknown;
};

export type AttemptClassification = {
  index: number;
  outcome: string;
  code: string | null;
  /** What the artifact proves on its own. Never a judgment about scenario quality. */
  machineClass: ForensicClassKey | "RETRY_BOOKKEEPING" | "PENDING_HUMAN_REVIEW";
  scenarioCaptured: boolean;
  reviewCaptured: boolean;
  /** Why this attempt cannot be classified further without a person or more evidence. */
  unresolvedReason: string | null;
  note: string;
};

/**
 * Classify ONE attempt from artifact evidence alone.
 *
 * Deliberately conservative: everything this cannot prove becomes `H` with a stated reason, so a
 * missing capture surfaces as a gap in the evidence rather than as a confident-sounding verdict.
 */
export function classifyAttempt(a: ForensicAttempt, index: number): AttemptClassification {
  const scenarioCaptured = a.scenario !== undefined && a.scenario !== null;
  const reviewCaptured = a.review !== undefined && a.review !== null;
  const base = { index, outcome: a.outcome, code: a.code ?? null, scenarioCaptured, reviewCaptured };

  if (a.outcome === "correction_packet") {
    return {
      ...base,
      machineClass: "RETRY_BOOKKEEPING",
      unresolvedReason: null,
      note: "Ledger entry restating the previous attempt's defects; not a generation and not counted as one.",
    };
  }

  if (a.outcome === "review_malformed") {
    return {
      ...base,
      machineClass: "B",
      unresolvedReason: null,
      note:
        "review_verdict_contradicts_details fires only when the reviewer's overallVerdict is 'accept' " +
        "while its own detail fields derive at least one defect. The reviewer intended to accept. " +
        "The scenario was discarded and regenerated on the strength of a broken review, not a bad scenario.",
    };
  }

  if (a.outcome === "generated_valid") {
    return {
      ...base,
      machineClass: "PENDING_HUMAN_REVIEW",
      unresolvedReason: "automated generated_valid means no gate fired; it is not a quality verdict",
      note: "Requires full human product review before any claim of quality.",
    };
  }

  if (a.outcome.startsWith("gate_level_")) {
    if (!scenarioCaptured) {
      return {
        ...base,
        machineClass: "H",
        unresolvedReason:
          "the deterministic-gate rejection path records findings but does not capture the draft, " +
          "so the content behind this defect code no longer exists",
        note: "Defect code is known; the scenario it describes is not recoverable from this artifact.",
      };
    }
    return {
      ...base,
      machineClass: "G",
      unresolvedReason: null,
      note: "Scenario captured alongside the finding; the rejection can be checked against the content.",
    };
  }

  return {
    ...base,
    machineClass: "H",
    unresolvedReason: `unrecognised outcome '${a.outcome}'`,
    note: "Not classifiable from this artifact.",
  };
}

export type CaseForensics = {
  passId: string;
  caseId: string;
  ok: boolean;
  terminalReason: string | null;
  terminalPrimaryCode: string | null;
  generationAttempts: number;
  retriesAttempted: number;
  retryRecovered: boolean;
  attempts: AttemptClassification[];
};

export function classifyCase(c: {
  passId: string;
  caseId: string;
  ok: boolean;
  reason?: string | null;
  primaryCode?: string | null;
  attempts: ForensicAttempt[];
}): CaseForensics {
  const attempts = c.attempts.map(classifyAttempt);
  const generations = c.attempts.filter((a) => a.outcome !== "correction_packet").length;
  return {
    passId: c.passId,
    caseId: c.caseId,
    ok: c.ok,
    terminalReason: c.reason ?? null,
    terminalPrimaryCode: c.primaryCode ?? null,
    generationAttempts: generations,
    retriesAttempted: Math.max(0, generations - 1),
    retryRecovered: c.ok && generations > 1,
    attempts,
  };
}

/** Every attempt must carry a class. A silent gap is the failure mode this guards. */
export function everyAttemptClassified(cases: CaseForensics[]): boolean {
  return cases.every((c) => c.attempts.length > 0 && c.attempts.every((a) => a.machineClass.length > 0));
}

export const unresolvedAttempts = (cases: CaseForensics[]): AttemptClassification[] =>
  cases.flatMap((c) => c.attempts.filter((a) => a.machineClass === "H"));
