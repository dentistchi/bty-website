/**
 * RETENTION-V1 RECORD SCHEMA + ASSEMBLER (Slice 3.2I-R5B1A.1-R2.31).
 *
 * WHY THIS MODULE EXISTS AT ALL.
 *
 * The 2026-09-11 full-retention 36-run was executed from an untracked temporary runner that later
 * disappeared. `writeRetentionRecord` — the durable-byte authority — was tracked, and
 * `retentionHarness.test.ts` proved retention BEHAVIOUR, but the record SHAPE was assembled inside
 * that test. So the only tracked description of a retention-v1 record lived in a test, and the code
 * that actually produced the evidence was gone. The audit called that READY; it was not.
 *
 * READY = tracked executable entry point + tracked evidence schema/assembler + tested durable path.
 * This module is the middle term. The test now verifies it instead of defining the shape itself.
 *
 * TWO RULES IT KEEPS.
 *
 * 1. It is NOT a second writer. Durable bytes still leave through `writeRetentionRecord`.
 * 2. Evidence is selected by SEMANTIC KIND, never by stream position. `events[0]` and `at(-1)` are
 *    how a stream contract silently breaks the first time an event is inserted.
 *
 * Pure assembly plus one injected write callback: no clock, no direct filesystem access.
 */

import type { GenObservation } from "./arenaScenarioGenerationService";
import type { RetentionIdentity } from "./evalArtifact";

/** UNCHANGED. Optional evidence is additive; a new optional field is not a new schema. */
export const RETENTION_SCHEMA_VERSION = "arena_experiment_retention_v1";

export type RetentionPresence<T> = { present: boolean; parsed: T | null };

export type RetentionStage = {
  stageName: string;
  stageStartedMonoMs?: number;
  stageFinishedMonoMs?: number;
  stageDurationMs?: number;
  timeout: boolean;
};

export type RetentionGate = { gate: string; level: number; codes: string[]; findings: unknown };

/**
 * STRICT means the retained evidence can reproduce the production review question.
 *
 * It is DERIVED, never claimed: a caller cannot pass `parityGrade: "strict"`. Measured cause — every
 * replay before R2.30 called the reviewer with `constructions: {}` while production sent the real
 * per-choice records, so the replay asked a weaker question and its verdict could not be attributed
 * to the production contract. An artifact that cannot show construction evidence is NON-STRICT, and
 * saying so is the entire point of the field.
 */
export type ParityGrade = "strict" | "non-strict";

export type RetentionRecord = {
  schemaVersion: typeof RETENTION_SCHEMA_VERSION;
  experimentId: string;
  fixtureId: string;
  architecture: string;
  runNumber: number;
  correctionEnabled: boolean;
  terminalOutcome: string | null;
  plan: RetentionPresence<unknown>;
  draft: RetentionPresence<unknown>;
  gates: RetentionGate[];
  reviewCalls: unknown[];
  stages: RetentionStage[];
  advisory: unknown | null;
  primaryCode: string | null;
  defectCodes: string[];
  totalMs: number | null;
  /** R2.30 — per-choice construction evidence, present only when the observer captured content. */
  constructions?: RetentionPresence<Record<string, unknown>>;
  /** Derived by `deriveParityGrade`. Never supplied by a caller. */
  parityGrade?: ParityGrade;
};

export type RetentionInit = RetentionIdentity & { correctionEnabled: boolean };

/** A run's identity exists BEFORE its first provider call. That ordering is the crash contract. */
export function createRetentionRecord(init: RetentionInit): RetentionRecord {
  return {
    schemaVersion: RETENTION_SCHEMA_VERSION,
    experimentId: init.experimentId,
    fixtureId: init.fixtureId,
    architecture: init.architecture,
    runNumber: init.runNumber,
    correctionEnabled: init.correctionEnabled,
    terminalOutcome: null,
    plan: { present: false, parsed: null },
    draft: { present: false, parsed: null },
    gates: [],
    reviewCalls: [],
    stages: [],
    advisory: null,
    primaryCode: null,
    defectCodes: [],
    totalMs: null,
  };
}

/**
 * Fold ONE observation into the record.
 *
 * Every branch tests a FIELD, not an index. A stage record is anything carrying stage timing; a gate
 * record is anything carrying gate + level. Insert a new event kind upstream and this keeps working.
 */
export function applyObservation(record: RetentionRecord, o: GenObservation): RetentionRecord {
  if (o.stageName !== undefined && o.stageDurationMs !== undefined) {
    record.stages.push({
      stageName: o.stageName,
      stageStartedMonoMs: o.stageStartedMonoMs,
      stageFinishedMonoMs: o.stageFinishedMonoMs,
      stageDurationMs: o.stageDurationMs,
      timeout: o.timeout ?? false,
    });
  }
  if (o.gate !== undefined && o.level !== undefined) {
    record.gates.push({ gate: o.gate, level: o.level, codes: o.defectCodes ?? [], findings: o.findings ?? null });
    if (o.scenario) record.draft = { present: true, parsed: o.scenario };
  }
  // The Plan is a different artifact from the Render it produces, so it is matched by its own kind.
  if (o.outcome === "plan_valid" && o.scenario) record.plan = { present: true, parsed: o.scenario };
  else if (o.scenario && !record.draft.present) record.draft = { present: true, parsed: o.scenario };

  if (o.review !== undefined) record.reviewCalls.push(o.review);
  // R2.30 — construction rides the same observation as the scenario it describes.
  if (o.constructions !== undefined) record.constructions = { present: true, parsed: o.constructions };
  if (o.code !== undefined && record.primaryCode === null) record.primaryCode = o.code;
  if (o.defectCodes !== undefined && record.defectCodes.length === 0) record.defectCodes = o.defectCodes;
  return record;
}

/**
 * STRICT requires evidence, not intent.
 *
 * `captureContent=false` hides construction by design, so a run made that way is NON-STRICT however
 * well it otherwise went — and an empty map is not "no constructions", it is "we never captured
 * them". Both collapse to the same honest answer.
 */
export function deriveParityGrade(record: RetentionRecord): ParityGrade {
  const c = record.constructions;
  if (!c?.present || !c.parsed) return "non-strict";
  return Object.keys(c.parsed).length > 0 ? "strict" : "non-strict";
}

export function finalizeRetentionRecord(
  record: RetentionRecord,
  terminal: { terminalOutcome: string | null; totalMs?: number | null; advisory?: unknown | null },
): RetentionRecord {
  record.terminalOutcome = terminal.terminalOutcome;
  if (terminal.totalMs !== undefined) record.totalMs = terminal.totalMs;
  if (terminal.advisory !== undefined) record.advisory = terminal.advisory;
  record.parityGrade = deriveParityGrade(record);
  return record;
}

/**
 * Read a retention record produced by ANY version of this schema.
 *
 * Historical 2026-09-11 records carry no `constructions` and no `parityGrade`. They must keep
 * parsing unchanged — rewriting historical evidence to fit a newer reader would destroy the very
 * thing it is evidence of — so absence is filled in as NON-STRICT rather than rejected.
 */
export function parseRetentionRecord(raw: unknown): { ok: true; value: RetentionRecord } | { ok: false; errors: string[] } {
  if (typeof raw !== "object" || raw === null) return { ok: false, errors: ["retention_not_an_object"] };
  const r = raw as Record<string, unknown>;
  const errors: string[] = [];
  if (r.schemaVersion !== RETENTION_SCHEMA_VERSION) errors.push("retention_schema_version_mismatch");
  for (const f of ["experimentId", "fixtureId", "architecture"]) {
    if (typeof r[f] !== "string") errors.push(`retention_${f}_invalid`);
  }
  if (typeof r.runNumber !== "number") errors.push("retention_run_number_invalid");
  if (errors.length) return { ok: false, errors };

  const presence = <T>(v: unknown): RetentionPresence<T> => {
    const p = (v ?? {}) as Record<string, unknown>;
    return { present: p.present === true, parsed: (p.parsed ?? null) as T | null };
  };
  const arr = <T>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : []);

  const value: RetentionRecord = {
    schemaVersion: RETENTION_SCHEMA_VERSION,
    experimentId: r.experimentId as string,
    fixtureId: r.fixtureId as string,
    architecture: r.architecture as string,
    runNumber: r.runNumber as number,
    correctionEnabled: r.correctionEnabled === true,
    terminalOutcome: typeof r.terminalOutcome === "string" ? r.terminalOutcome : null,
    plan: presence(r.plan),
    draft: presence(r.draft),
    gates: arr<RetentionGate>(r.gates),
    reviewCalls: arr<unknown>(r.reviewCalls),
    stages: arr<RetentionStage>(r.stages),
    advisory: r.advisory ?? null,
    primaryCode: typeof r.primaryCode === "string" ? r.primaryCode : null,
    defectCodes: arr<string>(r.defectCodes),
    totalMs: typeof r.totalMs === "number" ? r.totalMs : null,
    ...(r.constructions !== undefined ? { constructions: presence<Record<string, unknown>>(r.constructions) } : {}),
  };
  value.parityGrade = deriveParityGrade(value);
  return { ok: true, value };
}

/**
 * The collector the runner installs as its observer.
 *
 * `flush` is injected rather than imported so this module never touches the filesystem, and so the
 * runner keeps using the one existing write authority. It flushes after EVERY evidence-bearing
 * event: a process killed mid-run must still leave what had already been observed.
 */
export function createRetentionCollector(init: RetentionInit, flush: (record: RetentionRecord) => void) {
  const record = createRetentionRecord(init);
  flush(record); // identity is durable BEFORE the first provider call
  return {
    record,
    observe(o: GenObservation): void {
      applyObservation(record, o);
      flush(record);
    },
    finalize(terminal: { terminalOutcome: string | null; totalMs?: number | null; advisory?: unknown | null }): RetentionRecord {
      finalizeRetentionRecord(record, terminal);
      flush(record);
      return record;
    },
  };
}
