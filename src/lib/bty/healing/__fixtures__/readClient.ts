import type { SupabaseClient } from "@supabase/supabase-js";

/** In-memory read transport for the real Healing and eligibility services. No app env or I/O. */
export function healingReadClient(options: {
  acts?: { act_id: number }[];
  trainDays?: number[];
  milestone?: { second_awakening_completed_at: string | null; starter_unlock_granted?: "PRM" | "SAG" | null } | null;
  starter?: "PRM" | "SAG";
  milestoneError?: { message: string };
  actsError?: { message: string };
  trainError?: { message: string };
  statsError?: { message: string };
  eventsError?: { message: string };
} = {}) {
  const reads: { table: string; columns: string; userId?: unknown }[] = [];
  const from = (table: string) => {
    const read = { table, columns: "", userId: undefined as unknown };
    const resolve = () => {
      reads.push({ ...read });
      switch (table) {
        case "user_healing_awakening_acts": return { data: options.acts ?? [], error: options.actsError ?? null };
        case "emotional_sessions": return { data: null, count: 0, error: null };
        case "user_healing_milestones": return { data: options.milestone ?? null, error: options.milestoneError ?? null };
        case "user_advanced_unlocks": return { data: options.starter ? { advanced_stat_name: options.starter } : null, error: null };
        case "train_day_completions": return { data: (options.trainDays ?? []).map(day => ({ day })), error: options.trainError ?? null };
        case "user_emotional_stats": return { data: [], error: options.statsError ?? null };
        case "emotional_events": return { data: [], error: options.eventsError ?? null };
        default: throw new Error(`Unexpected test read: ${table}`);
      }
    };
    const query = {
      select(columns: string) { read.columns = columns; return query; },
      eq(column: string, value: unknown) { if (column === "user_id") read.userId = value; return query; },
      order() { return query; }, limit() { return query; },
      maybeSingle: async () => resolve(),
      then(onFulfilled: (value: ReturnType<typeof resolve>) => unknown, onRejected?: (error: unknown) => unknown) {
        return Promise.resolve().then(resolve).then(onFulfilled, onRejected);
      },
    };
    return query;
  };
  return { client: { from } as unknown as SupabaseClient, reads };
}
