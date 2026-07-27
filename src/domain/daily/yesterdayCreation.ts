/**
 * "Trainings created yesterday" — canonical counting (Slice 3.2C-B3A.2B-R1).
 *
 * A Program is counted as a "training created" ONLY when its FIRST published Run
 * (the earliest foundry_events row for that program_id, owned by the user) was
 * created inside the local-day window. This is derived from Run lineage — never a
 * foundry_programs.created_at (a root may be minted before the training is
 * published) and never a new creation marker.
 *
 * Semantics guaranteed here (pure):
 *   - Program with NO published Run → 0
 *   - Program whose first Run is in-window → 1
 *   - a later V2/V3 Run for the same Program → +0 (only the first Run matters)
 *   - two Programs each first-published in-window → 2
 *   - an idempotent publish retry (no new Run row) → +0
 *   - Program identity is the UUID; title is irrelevant
 */

export type ProgramRun = { programId: string; createdAtMs: number };

export function countFirstPublishedRunsInWindow(
  runs: ProgramRun[],
  startMs: number,
  endMs: number,
): number {
  const firstByProgram = new Map<string, number>();
  for (const r of runs) {
    if (!r.programId || !Number.isFinite(r.createdAtMs)) continue;
    const cur = firstByProgram.get(r.programId);
    if (cur === undefined || r.createdAtMs < cur) firstByProgram.set(r.programId, r.createdAtMs);
  }
  let n = 0;
  for (const first of firstByProgram.values()) {
    if (first >= startMs && first < endMs) n += 1;
  }
  return n;
}
