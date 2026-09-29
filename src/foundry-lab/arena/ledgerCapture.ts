/**
 * BTY FOUNDRY LAB — in-memory ledger capture (M0).
 *
 * THE SEAM. `generateProgram` records every attempt and provider call through four recorder
 * functions (`startProgramAttempt`, `finalizeProgramAttempt`, `startProgramCall`,
 * `finalizeProgramCall`), each of which takes the Supabase client it writes with. Handing it this
 * object instead of a database client means:
 *
 *   * the generator runs completely unchanged — same prompts, same validation, same bounded retry;
 *   * nothing reaches a database;
 *   * the benchmark receives EXACTLY the rows the production ledger would have stored (outcome,
 *     refusal code/kind, validation stage, finish reason, token usage, durations), captured
 *     rather than re-derived.
 *
 * It implements only the chains those four functions use — `from().insert().select().maybeSingle()`
 * and `from().update().eq()` — and answers any other read with "nothing found", which is the
 * generator's own fail-open reading of an unreadable ledger.
 */
import { randomUUID } from "node:crypto";

export type CapturedRow = Record<string, unknown> & { id: string };

export class LedgerCapture {
  readonly tables = new Map<string, CapturedRow[]>();

  rows(table: string): CapturedRow[] {
    return this.tables.get(table) ?? [];
  }

  from(table: string) {
    const rows = this.tables.get(table) ?? [];
    this.tables.set(table, rows);
    const none = { data: null, error: null };
    const reader = {
      select: (_columns?: string) => reader,
      eq: (_k?: string, _v?: unknown) => reader,
      is: (_k?: string, _v?: unknown) => reader,
      in: (_k?: string, _v?: unknown) => reader,
      order: (_k?: string, _o?: unknown) => reader,
      limit: (_n?: number) => reader,
      maybeSingle: async () => none,
      single: async () => none,
      then: (resolve: (v: { data: unknown[]; error: null }) => unknown) => resolve({ data: [], error: null }),
    };
    return {
      insert: (row: Record<string, unknown>) => {
        const stored: CapturedRow = { ...row, id: randomUUID(), started_at: new Date().toISOString() };
        rows.push(stored);
        const result = { data: { id: stored.id }, error: null };
        const chain = {
          select: (_columns?: string) => chain,
          maybeSingle: async () => result,
          single: async () => result,
          then: (resolve: (v: typeof result) => unknown) => resolve(result),
        };
        return chain;
      },
      update: (patch: Record<string, unknown>) => {
        const filters: Array<[string, unknown]> = [];
        const apply = () => {
          for (const r of rows) if (filters.every(([k, v]) => r[k] === v)) Object.assign(r, patch);
          return { data: null, error: null };
        };
        const chain = {
          eq: (k: string, v: unknown) => {
            filters.push([k, v]);
            return chain;
          },
          is: (k: string, v: unknown) => {
            filters.push([k, v]);
            return chain;
          },
          then: (resolve: (v: { data: null; error: null }) => unknown) => resolve(apply()),
        };
        return chain;
      },
      select: (_columns?: string) => reader,
    };
  }
}
