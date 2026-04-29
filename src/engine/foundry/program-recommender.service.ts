/**
 * Foundry program 추천 — `foundry_program_assign` 시 시그널(마지막 Arena 시나리오·힐링 phase·무결성 슬립)과
 * `program_catalog` 태그 교차, 상위 3건을 `foundry_recommendations`에 저장.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  FOUNDRY_PROGRAM_ASSIGN_EVENT,
  type FoundryProgramAssignPayload,
} from "@/engine/foundry/foundry-program-assign.types";
import { scenarioTokensFromScenarioId } from "@/domain/foundry/program-catalog-signals";
import { syncLearningPathFromRecommendations } from "@/engine/foundry/learning-path.service";
import { getCurrentPhase } from "@/engine/healing/healing-phase.service";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export { scenarioTokensFromScenarioId } from "@/domain/foundry/program-catalog-signals";

const CHOICE_CONFIRMED = "CHOICE_CONFIRMED" as const;

/** Prefer an injected client; otherwise service role (no `cookies()` — safe outside request scope). */
function resolveClient(supabase?: SupabaseClient): SupabaseClient {
  const client = supabase ?? getSupabaseAdmin();
  if (!client) {
    throw new Error(
      "[program-recommender] Pass supabase (e.g. getSupabaseServerClient from a route handler) or set SUPABASE_SERVICE_ROLE_KEY.",
    );
  }
  return client;
}

export type ProgramCatalogRow = {
  program_id: string;
  title: string;
  scenario_tags: string[];
  phase_tags: string[];
  flag_tags: string[];
};

export type ProgramRecommendation = {
  rank: number;
  program_id: string;
  title: string;
  match_score: number;
};

/** `integrity_slip_log.reason` → `program_catalog.flag_tags` 용 토큰. */
export function flagTagFromSlipReason(reason: string | null | undefined): string | null {
  if (!reason || typeof reason !== "string") return null;
  const r = reason.toLowerCase();
  if (r.includes("lockout")) return "lockout";
  if (r.includes("delta") || r.includes("negative")) return "air_delta_slip";
  return null;
}

function scoreRow(
  prog: ProgramCatalogRow,
  scenarioTokens: Set<string>,
  phase: string | null,
  flagTag: string | null,
): number {
  let s = 0;
  if (
    scenarioTokens.size > 0 &&
    prog.scenario_tags.some((t) => scenarioTokens.has(t))
  ) {
    s += 1;
  }
  if (phase && prog.phase_tags.includes(phase)) {
    s += 1;
  }
  if (flagTag && prog.flag_tags.includes(flagTag)) {
    s += 1;
  }
  return s;
}

async function loadSignals(
  client: SupabaseClient,
  userId: string,
): Promise<{
  scenarioTokens: Set<string>;
  phase: string | null;
  flagTag: string | null;
}> {
  const [{ data: ev }, { data: slip }, phase] = await Promise.all([
    client
      .from("arena_events")
      .select("scenario_id")
      .eq("user_id", userId)
      .eq("event_type", CHOICE_CONFIRMED)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    client
      .from("integrity_slip_log")
      .select("reason")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    getCurrentPhase(userId, client),
  ]);

  const scenarioId =
    ev && typeof (ev as { scenario_id?: string }).scenario_id === "string"
      ? (ev as { scenario_id: string }).scenario_id
      : null;
  const scenarioTokens = scenarioTokensFromScenarioId(scenarioId);
  const reason =
    slip && typeof (slip as { reason?: string }).reason === "string"
      ? (slip as { reason: string }).reason
      : null;
  const flagTag = flagTagFromSlipReason(reason);

  return { scenarioTokens, phase, flagTag };
}

/**
 * `foundry_program_assign` 처리 시 호출: 시그널을 읽고 상위 3개 프로그램을 저장한다.
 */
export async function refreshFoundryProgramRecommendations(
  userId: string,
  supabase?: SupabaseClient,
): Promise<ProgramRecommendation[]> {
  const client = resolveClient(supabase);

  const { data: catalog, error: catErr } = await client
    .from("program_catalog")
    .select("program_id, title, scenario_tags, phase_tags, flag_tags");

  if (catErr) throw new Error(catErr.message);
  const rows = (catalog ?? []) as ProgramCatalogRow[];
  if (rows.length === 0) return [];

  const signals = await loadSignals(client, userId);

  const scored = rows
    .map((p) => ({
      prog: p,
      score: scoreRow(p, signals.scenarioTokens, signals.phase, signals.flagTag),
    }))
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return a.prog.program_id.localeCompare(b.prog.program_id);
    });

  const top = scored.slice(0, 3);

  const { error: delErr } = await client.from("foundry_recommendations").delete().eq("user_id", userId);
  if (delErr) throw new Error(delErr.message);

  const now = new Date().toISOString();
  for (let i = 0; i < top.length; i++) {
    const { prog, score } = top[i]!;
    const { error: insErr } = await client.from("foundry_recommendations").insert({
      user_id: userId,
      rank: i + 1,
      program_id: prog.program_id,
      match_score: score,
      created_at: now,
    });
    if (insErr) throw new Error(insErr.message);
  }

  await syncLearningPathFromRecommendations(userId, client).catch(() => {
    /* non-fatal: recommendations already stored */
  });

  return top.map((t, i) => ({
    rank: i + 1,
    program_id: t.prog.program_id,
    title: t.prog.title,
    match_score: t.score,
  }));
}

/**
 * `foundry_program_assign` 페이로드 수신 시 편의 래퍼 (타입은 라우터와 동일).
 */
export async function onFoundryProgramAssignEvent(
  payload: FoundryProgramAssignPayload,
  supabase?: SupabaseClient,
): Promise<ProgramRecommendation[]> {
  if (payload.type !== FOUNDRY_PROGRAM_ASSIGN_EVENT) {
    return [];
  }
  return refreshFoundryProgramRecommendations(payload.userId, supabase);
}

/**
 * 저장된 추천 3건(없으면 빈 배열).
 */
export async function getRecommendations(
  userId: string,
  supabase?: SupabaseClient,
): Promise<ProgramRecommendation[]> {
  const client = resolveClient(supabase);

  const { data: recs, error } = await client
    .from("foundry_recommendations")
    .select("rank, match_score, program_id")
    .eq("user_id", userId)
    .order("rank", { ascending: true });

  if (error) throw new Error(error.message);

  await syncLearningPathFromRecommendations(userId, client).catch(() => {
    /* non-fatal */
  });

  if (!recs?.length) return [];

  const ids = [...new Set(recs.map((r) => (r as { program_id: string }).program_id))];
  const { data: titles, error: tErr } = await client
    .from("program_catalog")
    .select("program_id, title")
    .in("program_id", ids);

  if (tErr) throw new Error(tErr.message);
  const titleById = new Map(
    (titles ?? []).map((row) => {
      const t = row as { program_id: string; title: string };
      return [t.program_id, t.title] as const;
    }),
  );

  return recs.map((row) => {
    const r = row as { rank: number; match_score: number; program_id: string };
    return {
      rank: r.rank,
      program_id: r.program_id,
      title: titleById.get(r.program_id) ?? r.program_id,
      match_score: r.match_score,
    };
  });
}

/** API/UI: catalog rows + matched tags + phase label for cards. */
export type FoundryRecommendationCardDto = {
  rank: number;
  program_id: string;
  title: string;
  match_score: number;
  scenario_tags: string[];
  phase_tags: string[];
  matched_tags: string[];
  phase_label: string | null;
};

function matchedTagsForDisplay(
  prog: ProgramCatalogRow,
  scenarioTokens: Set<string>,
  phase: string | null,
  flagTag: string | null,
): string[] {
  const out: string[] = [];
  for (const t of prog.scenario_tags) {
    if (scenarioTokens.has(t)) out.push(t);
  }
  if (phase && prog.phase_tags.includes(phase)) out.push(phase);
  if (flagTag && prog.flag_tags.includes(flagTag)) out.push(flagTag);
  return [...new Set(out)];
}

function phaseLabelForDisplay(prog: ProgramCatalogRow, phase: string | null): string | null {
  if (phase && prog.phase_tags.includes(phase)) return phase;
  return prog.phase_tags[0] ?? null;
}

/**
 * Top-3 recommendations with tag highlights and phase label (same signals as scoring).
 */
export async function getRecommendationsForUi(
  userId: string,
  supabase?: SupabaseClient,
): Promise<FoundryRecommendationCardDto[]> {
  const base = await getRecommendations(userId, supabase);
  if (base.length === 0) return [];
  const client = resolveClient(supabase);
  const signals = await loadSignals(client, userId);
  const ids = base.map((b) => b.program_id);
  const { data: cats, error } = await client
    .from("program_catalog")
    .select("program_id, title, scenario_tags, phase_tags, flag_tags")
    .in("program_id", ids);
  if (error) throw new Error(error.message);
  const catById = new Map((cats as ProgramCatalogRow[]).map((c) => [c.program_id, c]));
  return base.map((row) => {
    const cat = catById.get(row.program_id);
    if (!cat) {
      return {
        rank: row.rank,
        program_id: row.program_id,
        title: row.title,
        match_score: row.match_score,
        scenario_tags: [],
        phase_tags: [],
        matched_tags: [],
        phase_label: null,
      };
    }
    return {
      rank: row.rank,
      program_id: row.program_id,
      title: cat.title,
      match_score: row.match_score,
      scenario_tags: cat.scenario_tags,
      phase_tags: cat.phase_tags,
      matched_tags: matchedTagsForDisplay(cat, signals.scenarioTokens, signals.phase, signals.flagTag),
      phase_label: phaseLabelForDisplay(cat, signals.phase),
    };
  });
}
