import type { EvidenceLevel } from "@/domain/foundry/module/program-authorship";

/**
 * EVIDENCE RUNG COPY — the words, and only the words (Slice 3.2R-R1).
 *
 * The rungs themselves are decided server-side by `projectEvidence`. This module holds nothing
 * but display order and language, shared by the learner and Host surfaces so the two can never
 * describe the same rung differently.
 *
 * WHY THE ORDER IS RESTATED HERE RATHER THAN IMPORTED. `EVIDENCE_LADDER` lives in
 * `program-authorship.ts`, a 2,700-line pure-domain module; importing the VALUE would pull all
 * of it into the client bundle for the sake of a seven-item array. The type import above is
 * erased at build, and `evidenceLadderCopy.test.ts` asserts this array is byte-identical to the
 * canonical constant — so a rung added to the ladder fails a test here instead of silently
 * rendering in the wrong place, or not at all.
 *
 * TWO VOCABULARIES, ONE MEANING. The learner reads their own history; the Host reads someone
 * else's record and must not mistake a self-report for a confirmed fact. So APPLIED says
 * "Applied" to the person who applied it and "Self-reported applying" to the person reading
 * about them — the distinction the whole ladder exists to protect, carried into the copy.
 *
 * NO STATUS WORDS FOR UNESTABLISHED RUNGS. There is deliberately no "missing", "incomplete",
 * "failed" or "0/7" string in this file, because there is no such state: a rung that is not
 * established has simply not happened yet, and often never will for perfectly good reasons.
 */

export type EvidenceLocale = "en" | "ko";

/** Canonical render order. Asserted equal to `EVIDENCE_LADDER` in this module's test. */
export const EVIDENCE_DISPLAY_ORDER: readonly EvidenceLevel[] = [
  "exposed",
  "reflected",
  "decided",
  "practiced",
  "applied",
  "observed",
  "sustained",
] as const;

/**
 * The learner's own history, in their voice. "Learned" rather than "Exposed": the clinical word
 * is precise for an evidence ceiling and cold for a person reading about their own week.
 */
export const LEARNER_RUNG_LABEL: Record<EvidenceLocale, Record<EvidenceLevel, string>> = {
  en: {
    exposed: "Learned",
    reflected: "Reflected",
    decided: "Decided",
    practiced: "Practised",
    applied: "Applied",
    observed: "Observed",
    sustained: "Sustained",
  },
  ko: {
    exposed: "학습함",
    reflected: "성찰함",
    decided: "결정함",
    practiced: "연습함",
    applied: "적용함",
    observed: "관찰됨",
    sustained: "지속됨",
  },
};

/**
 * The Host reading someone else's record. Two labels differ from the learner set ON PURPOSE:
 *
 *   applied  — "Self-reported applying". The learner said they did it. Nobody saw it, nothing
 *              was measured, and a Host who reads a bare "Applied" will believe otherwise.
 *   observed — "Independently observed". Names the source, so it cannot be confused with the
 *              row directly above it.
 */
export const HOST_RUNG_LABEL: Record<EvidenceLocale, Record<EvidenceLevel, string>> = {
  en: {
    exposed: "Completed the material",
    reflected: "Reflected",
    decided: "Decided",
    practiced: "Practised",
    applied: "Self-reported applying",
    observed: "Independently observed",
    sustained: "Sustained over time",
  },
  ko: {
    exposed: "자료를 끝까지 봄",
    reflected: "성찰함",
    decided: "결정함",
    practiced: "연습함",
    applied: "본인이 적용했다고 보고함",
    observed: "제3자가 관찰함",
    sustained: "기간에 걸쳐 지속됨",
  },
};
