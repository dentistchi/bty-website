/**
 * Foundry learning paths: four tracks aligned to Arena mentor buckets / Dojo skill areas.
 * Path assignment uses {@link getBehaviorPatterns} `dominant_pattern` → flag_type; persisted in
 * `user_learning_paths`; progress from `user_program_progress`.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { getBehaviorPatterns } from "@/engine/integrity/behavior-pattern.service";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export type LearningPathName = "Integrity" | "Resilience" | "Leadership" | "Empathy";

/**
 * Ordered `program_id` lists from `program_catalog` (see `skill_area` migration — fp_01…fp_12).
 * Integrity / Leadership / Empathy: two programs each; Resilience: remaining communication·decision·resilience tracks.
 */
export const LEARNING_PATH_MAP: Record<LearningPathName, readonly string[]> = {
  Integrity: ["fp_04", "fp_10"],
  Leadership: ["fp_05", "fp_11"],
  Empathy: ["fp_06", "fp_12"],
  Resilience: ["fp_01", "fp_02", "fp_03", "fp_07", "fp_08", "fp_09"],
};

export type LearningPath = {
  path_name: LearningPathName;
  programs_ordered: string[];
  current_index: number;
  /** Mean completion % across programs in the path (missing progress = 0). */
  completion_pct: number;
};

/** One row for UI: catalog title + progress for checkmarks. */
export type LearningPathProgramUi = {
  program_id: string;
  title: string;
  completion_pct: number;
};

/**
 * {@link getActiveLearningPath} plus ordered program titles from `program_catalog` and per-program completion %.
 */
export async function getActiveLearningPathWithPrograms(
  userId: string,
  options?: { supabase?: SupabaseClient; syncIndex?: boolean },
): Promise<LearningPath & { programs: LearningPathProgramUi[] }> {
  const path = await getActiveLearningPath(userId, options);
  const client = resolveClient(options?.supabase);
  if (!client) {
    return {
      ...path,
      programs: path.programs_ordered.map((program_id) => ({
        program_id,
        title: program_id,
        completion_pct: 0,
      })),
    };
  }

  const progress = await fetchProgressForPrograms(client, userId, path.programs_ordered);

  const { data: catRows, error: catErr } = await client
    .from("program_catalog")
    .select("program_id, title")
    .in("program_id", path.programs_ordered);

  if (catErr) throw new Error(`getActiveLearningPathWithPrograms: ${catErr.message}`);

  const titleById = new Map<string, string>();
  for (const r of catRows ?? []) {
    const row = r as { program_id: string; title?: string | null };
    const t = typeof row.title === "string" ? row.title.trim() : "";
    titleById.set(row.program_id, t.length > 0 ? t : row.program_id);
  }

  const programs = path.programs_ordered.map((program_id) => ({
    program_id,
    title: titleById.get(program_id) ?? program_id,
    completion_pct: progress.get(program_id) ?? 0,
  }));

  return { ...path, programs };
}

function resolveClient(supabase?: SupabaseClient): SupabaseClient | null {
  return supabase ?? getSupabaseAdmin();
}

/** Map Arena `flag_type` (dominant pattern) → learning path name. */
export function dominantFlagTypeToLearningPath(flagType: string | null | undefined): LearningPathName {
  if (!flagType || typeof flagType !== "string") return "Resilience";
  const f = flagType.trim().toUpperCase();
  if (f === "INTEGRITY_SLIP" || f.includes("INTEGRITY")) return "Integrity";
  if (f === "HERO_TRAP" || f.includes("HERO_TRAP") || (f.includes("HERO") && f.includes("TRAP"))) {
    return "Leadership";
  }
  if (f === "ROLE_MIRROR" || f.includes("ROLE_MIRROR") || f.includes("MIRROR") || f.includes("EMPATH")) {
    return "Empathy";
  }
  if (f === "CLEAN" || f.includes("CLEAN") || f.includes("COMMUNICATION")) return "Resilience";
  return "Resilience";
}

async function fetchProgressForPrograms(
  client: SupabaseClient,
  userId: string,
  programIds: readonly string[],
): Promise<Map<string, number>> {
  if (programIds.length === 0) return new Map();
  const { data, error } = await client
    .from("user_program_progress")
    .select("program_id, completion_pct")
    .eq("user_id", userId)
    .in("program_id", [...programIds]);

  if (error) throw new Error(`fetchProgressForPrograms: ${error.message}`);
  const m = new Map<string, number>();
  for (const row of data ?? []) {
    const r = row as { program_id: string; completion_pct: number | string };
    const pct = Number(r.completion_pct);
    m.set(r.program_id, Number.isFinite(pct) ? Math.min(100, Math.max(0, pct)) : 0);
  }
  return m;
}

function meanCompletionPct(programs: readonly string[], progress: Map<string, number>): number {
  if (programs.length === 0) return 0;
  let sum = 0;
  for (const id of programs) {
    sum += progress.get(id) ?? 0;
  }
  return sum / programs.length;
}

/** First index with completion &lt; 100; if all complete, last index. */
export function computeCurrentIndexFromProgress(
  programs: readonly string[],
  progress: Map<string, number>,
): number {
  for (let i = 0; i < programs.length; i++) {
    const pct = progress.get(programs[i]!) ?? 0;
    if (pct < 100) return i;
  }
  return programs.length > 0 ? programs.length - 1 : 0;
}

function isLearningPathName(s: string | null | undefined): s is LearningPathName {
  return s === "Integrity" || s === "Resilience" || s === "Leadership" || s === "Empathy";
}

/**
 * Reads `user_learning_paths`, merges {@link LEARNING_PATH_MAP}, aligns `current_index` with
 * `user_program_progress` (first program with completion &lt; 100), and persists the computed index when
 * `syncIndex` is true (default).
 */
export async function getActiveLearningPath(
  userId: string,
  options?: { supabase?: SupabaseClient; syncIndex?: boolean },
): Promise<LearningPath> {
  const client = resolveClient(options?.supabase);
  const fallback: LearningPath = {
    path_name: "Resilience",
    programs_ordered: [...LEARNING_PATH_MAP.Resilience],
    current_index: 0,
    completion_pct: 0,
  };

  if (!client) {
    return fallback;
  }

  const { data: row, error } = await client
    .from("user_learning_paths")
    .select("path_name, current_index")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) throw new Error(`getActiveLearningPath: ${error.message}`);

  const rawName = (row as { path_name?: string } | null)?.path_name;
  const resolvedName: LearningPathName = isLearningPathName(rawName) ? rawName : "Resilience";

  const programs = [...LEARNING_PATH_MAP[resolvedName]];
  const progress = await fetchProgressForPrograms(client, userId, programs);
  const completion_pct = meanCompletionPct(programs, progress);
  const computedIndex = computeCurrentIndexFromProgress(programs, progress);

  const syncIndex = options?.syncIndex !== false;
  if (syncIndex) {
    const { error: upErr } = await client.from("user_learning_paths").upsert(
      {
        user_id: userId,
        path_name: resolvedName,
        current_index: computedIndex,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" },
    );
    if (upErr) throw new Error(`getActiveLearningPath: ${upErr.message}`);
  }

  return {
    path_name: resolvedName,
    programs_ordered: programs,
    current_index: computedIndex,
    completion_pct,
  };
}

/**
 * Call from {@link getRecommendations} / refresh: set path from `dominant_pattern` when present;
 * if path changes, reset `current_index` to 0.
 * Uses service role for {@link getBehaviorPatterns} refresh when available (sync writes to `user_behavior_patterns`).
 */
export async function syncLearningPathFromRecommendations(
  userId: string,
  supabase?: SupabaseClient,
): Promise<void> {
  const client = resolveClient(supabase);
  if (!client) return;

  const admin = getSupabaseAdmin();
  const readClient = client;

  let patterns = await getBehaviorPatterns(userId, { refresh: false, supabase: readClient });
  let dom = patterns.find((p) => p.pattern_type === "dominant_pattern");
  if (!dom && admin) {
    patterns = await getBehaviorPatterns(userId, { refresh: true, supabase: admin });
    dom = patterns.find((p) => p.pattern_type === "dominant_pattern");
  }

  const flag =
    dom && typeof dom.supporting_data.flag_type === "string" ? dom.supporting_data.flag_type : null;
  if (!flag) return;

  const nextPath = dominantFlagTypeToLearningPath(flag);

  const { data: existing, error: exErr } = await client
    .from("user_learning_paths")
    .select("path_name")
    .eq("user_id", userId)
    .maybeSingle();

  if (exErr) throw new Error(`syncLearningPathFromRecommendations: ${exErr.message}`);

  const prev = (existing as { path_name?: string } | null)?.path_name;
  if (prev === nextPath) {
    const { error: touchErr } = await client.from("user_learning_paths").upsert(
      {
        user_id: userId,
        path_name: nextPath,
        current_index: (existing as { current_index?: number } | null)?.current_index ?? 0,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" },
    );
    if (touchErr) throw new Error(`syncLearningPathFromRecommendations: ${touchErr.message}`);
    return;
  }

  const { error: upErr } = await client.from("user_learning_paths").upsert(
    {
      user_id: userId,
      path_name: nextPath,
      current_index: 0,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" },
  );
  if (upErr) throw new Error(`syncLearningPathFromRecommendations: ${upErr.message}`);
}

/**
 * User or coach override for path; resets cursor to 0.
 */
export async function setLearningPath(
  userId: string,
  pathName: LearningPathName,
  options?: { supabase?: SupabaseClient },
): Promise<void> {
  const client = resolveClient(options?.supabase);
  if (!client) throw new Error("setLearningPath: Supabase client not available");

  const { error } = await client.from("user_learning_paths").upsert(
    {
      user_id: userId,
      path_name: pathName,
      current_index: 0,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" },
  );
  if (error) throw new Error(`setLearningPath: ${error.message}`);
}

/**
 * After {@link markProgramComplete}: if `programId` is the current slot on the active path, advance index.
 */
export async function advanceLearningPath(
  userId: string,
  completedProgramId: string,
  options?: { supabase?: SupabaseClient },
): Promise<void> {
  const client = resolveClient(options?.supabase);
  if (!client) return;

  const { data: row, error } = await client
    .from("user_learning_paths")
    .select("path_name, current_index")
    .eq("user_id", userId)
    .maybeSingle();

  if (error || !row) return;

  const path_name = (row as { path_name: string }).path_name as LearningPathName;
  if (!LEARNING_PATH_MAP[path_name]) return;

  const programs = [...LEARNING_PATH_MAP[path_name]];
  const idx = programs.indexOf(completedProgramId);
  if (idx === -1) return;

  const cur = Number((row as { current_index: number }).current_index);
  if (!Number.isFinite(cur) || idx !== cur) return;

  const next = Math.min(cur + 1, Math.max(0, programs.length - 1));

  const { error: upErr } = await client
    .from("user_learning_paths")
    .update({
      current_index: next,
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", userId);

  if (upErr) throw new Error(`advanceLearningPath: ${upErr.message}`);
}
