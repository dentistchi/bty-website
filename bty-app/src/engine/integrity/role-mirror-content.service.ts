/**
 * Curated bilingual role-mirror templates (역지사지) keyed by `origin_flag_type`;
 * LRU pick per user with persistence in `role_mirror_history`.
 *
 * Pool v2 (24 entries): `EXPANDED_ROLE_MIRROR_POOL` in `role-mirror-pool-expander.service` — mentor buckets
 * `HERO_TRAP` / `INTEGRITY_SLIP` / `CLEAN` / `ROLE_MIRROR`.
 *
 * @see generateMirror — optional `originFlagType` uses this pool as copy source.
 */

import { EXPANDED_ROLE_MIRROR_POOL } from "@/engine/scenario/role-mirror-pool-expander.service";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import type { SupabaseClient } from "@supabase/supabase-js";

export type RoleMirrorPoolEntry = {
  id: string;
  title: string;
  titleKo: string;
  body: string;
  bodyKo: string;
  origin_flag_type: string;
  target_role: string;
  /** 1 = lighter, 3 = heavier mirror load. */
  difficulty: 1 | 2 | 3;
  pool_version: 2;
};

export type RoleMirrorScenario = RoleMirrorPoolEntry;

/** 24 bilingual templates (v2); sourced from {@link EXPANDED_ROLE_MIRROR_POOL}. */
export const ROLE_MIRROR_POOL: readonly RoleMirrorPoolEntry[] = EXPANDED_ROLE_MIRROR_POOL.map(
  (e) => ({
    id: e.id,
    title: e.titleEn,
    titleKo: e.titleKo,
    body: e.bodyEn,
    bodyKo: e.bodyKo,
    origin_flag_type: e.origin_flag_type,
    target_role: e.target_role,
    difficulty: e.difficulty,
    pool_version: 2 as const,
  }),
);

function normalizeFlag(f: string): string {
  return f.trim().toLowerCase();
}

function filterPool(originFlagType: string): RoleMirrorPoolEntry[] {
  const n = normalizeFlag(originFlagType);
  const exact = ROLE_MIRROR_POOL.filter((p) => normalizeFlag(p.origin_flag_type) === n);
  return exact.length > 0 ? [...exact] : [...ROLE_MIRROR_POOL];
}

async function lastSelectedAt(
  client: SupabaseClient,
  userId: string,
  poolEntryId: string,
): Promise<number | null> {
  const { data, error } = await client
    .from("role_mirror_history")
    .select("selected_at")
    .eq("user_id", userId)
    .eq("pool_entry_id", poolEntryId)
    .order("selected_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data) return null;
  const t = (data as { selected_at?: string }).selected_at;
  if (!t) return null;
  const ms = new Date(t).getTime();
  return Number.isNaN(ms) ? null : ms;
}

function pickLeastRecentlyUsed(
  candidates: readonly RoleMirrorPoolEntry[],
  scores: ReadonlyArray<{ last: number | null }>,
): RoleMirrorPoolEntry {
  const indexed = candidates.map((c, i) => ({ c, last: scores[i]!.last }));
  indexed.sort((a, b) => {
    if (a.last === null && b.last === null) return a.c.id.localeCompare(b.c.id);
    if (a.last === null) return -1;
    if (b.last === null) return 1;
    if (a.last !== b.last) return a.last - b.last;
    return a.c.id.localeCompare(b.c.id);
  });
  return indexed[0]!.c;
}

/**
 * Pick LRU template for `origin_flag_type` (fallback: full pool), persist selection.
 */
export async function getRoleMirrorScenario(
  userId: string,
  originFlagType: string,
  options?: { supabase?: SupabaseClient },
): Promise<RoleMirrorScenario> {
  const candidates = filterPool(originFlagType);
  const client = options?.supabase ?? getSupabaseAdmin();

  if (!client) {
    return [...candidates].sort((a, b) => a.id.localeCompare(b.id))[0]!;
  }

  const scores = await Promise.all(
    candidates.map((c) => lastSelectedAt(client, userId, c.id).then((last) => ({ last }))),
  );
  const best = pickLeastRecentlyUsed(candidates, scores);

  const { error } = await client.from("role_mirror_history").insert({
    user_id: userId,
    pool_entry_id: best.id,
    origin_flag_type: normalizeFlag(originFlagType),
    selected_at: new Date().toISOString(),
  });

  if (error) {
    throw new Error(`getRoleMirrorScenario: ${error.message}`);
  }

  return best;
}
