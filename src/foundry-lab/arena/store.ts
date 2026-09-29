/**
 * BTY FOUNDRY LAB — durable run state (M0).
 *
 * WHY FILES, NOT SQLITE. The harness must survive being killed at any instant and resume without
 * a service, a schema or a new dependency. The simplest representation with that property:
 *
 *   runs/<run-id>/manifest.json            immutable run identity (written once)
 *   runs/<run-id>/cases/<case>/gen-NN.json ONE file per finished candidate — the AUTHORITY
 *   runs/<run-id>/events.jsonl             append-only log (starts, resumes, slot attempts)
 *   runs/<run-id>/state.json               derived index, rebuilt from the files above
 *
 * Every JSON file is written to a temp name and renamed, which is atomic on one filesystem, so a
 * crash leaves either the old file or the new one — never half of one. A slot counts as done only
 * when its gen file exists; a slot that was started and never finished is simply run again (its
 * attempt count, read from the event log, goes up). `state.json` can be deleted at any time.
 *
 * Location: `.foundry/` at the repository root (git-ignored), or `FOUNDRY_HOME` when set.
 */
import { appendFileSync, existsSync, mkdirSync, readdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import path from "node:path";
import { redact } from "./provider";

export function foundryHome(): string {
  return process.env.FOUNDRY_HOME?.trim() || path.join(process.cwd(), ".foundry");
}

export const runDir = (runId: string) => path.join(foundryHome(), "runs", runId);
export const genFile = (runId: string, caseId: string, index: number) =>
  path.join(runDir(runId), "cases", caseId, `gen-${String(index).padStart(2, "0")}.json`);

export function writeJsonAtomic(file: string, value: unknown): void {
  mkdirSync(path.dirname(file), { recursive: true });
  const tmp = `${file}.tmp-${process.pid}-${Date.now()}`;
  writeFileSync(tmp, `${JSON.stringify(redact(value), null, 2)}\n`);
  renameSync(tmp, file);
}

export function readJson<T>(file: string): T | null {
  try {
    return JSON.parse(readFileSync(file, "utf8")) as T;
  } catch {
    return null;
  }
}

export type RunEventType =
  | "run_started"
  | "run_resumed"
  | "slot_started"
  | "slot_completed"
  | "slot_error"
  | "run_completed"
  /** A step that needed a person to copy, paste or answer something. The runner never emits it. */
  | "human_input";

export type RunEvent = { at: string; type: RunEventType; case_id?: string; generation_index?: number; detail?: string };

export function appendEvent(runId: string, e: Omit<RunEvent, "at">): void {
  mkdirSync(runDir(runId), { recursive: true });
  appendFileSync(path.join(runDir(runId), "events.jsonl"), `${JSON.stringify(redact({ at: new Date().toISOString(), ...e }))}\n`);
}

/** Tolerates a torn final line (a crash mid-append): unparseable lines are skipped, never fatal. */
export function readEvents(runId: string): RunEvent[] {
  const f = path.join(runDir(runId), "events.jsonl");
  if (!existsSync(f)) return [];
  return readFileSync(f, "utf8")
    .split("\n")
    .filter(Boolean)
    .flatMap((l) => {
      try {
        return [JSON.parse(l) as RunEvent];
      } catch {
        return [];
      }
    });
}

export type Slot = { case_id: string; generation_index: number };

/** Every slot of a run, in execution order (case order, then generation). */
export function allSlots(caseIds: readonly string[], generations: number): Slot[] {
  return caseIds.flatMap((case_id) => Array.from({ length: generations }, (_, i) => ({ case_id, generation_index: i + 1 })));
}

export function slotDone(runId: string, s: Slot): boolean {
  return existsSync(genFile(runId, s.case_id, s.generation_index));
}

/** How many times a slot has been started, from the event log — survives any interruption. */
export function slotStarts(events: readonly RunEvent[], s: Slot): number {
  return events.filter((e) => e.type === "slot_started" && e.case_id === s.case_id && e.generation_index === s.generation_index).length;
}

export function listGenFiles(runId: string): string[] {
  const root = path.join(runDir(runId), "cases");
  if (!existsSync(root)) return [];
  return readdirSync(root)
    .sort()
    .flatMap((c) =>
      readdirSync(path.join(root, c))
        .filter((f) => /^gen-\d+\.json$/.test(f))
        .sort()
        .map((f) => path.join(root, c, f)),
    );
}

export function listRuns(): string[] {
  const root = path.join(foundryHome(), "runs");
  return existsSync(root) ? readdirSync(root).sort() : [];
}
