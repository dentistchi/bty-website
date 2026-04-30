/**
 * Arena session start — pick next {@link Scenario} from catalog minus played ids,
 * filtered by locale, weighted toward least-seen `flag_type` (coverage gaps).
 *
 * Reads `user_scenario_history` (with backfill from `user_scenario_choice_history` when the
 * aggregate array was empty). Catalog metadata and scenario **body** come only from
 * canonical `src/data/scenario` registry ({@link loadArenaScenarioPayloadFromDb}).
 */

import type { Scenario } from "@/lib/bty/scenario/types";
import { getScenarioByDbId, getScenarioById, scenarioList } from "@/data/scenario";
import { loadArenaScenarioPayloadFromDb } from "@/lib/bty/arena/scenarioPayloadFromDb";
import { isUserArenaEjected } from "@/engine/integration/arena-center-ejection";
import { isExcludedFromArenaProduction } from "@/engine/scenario/scenario-production-exclusions";
import { getDifficultyFloor } from "@/engine/scenario/scenario-difficulty-adjuster.service";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

/**
 * Fresh Arena entry (empty play ∪ served DONE) defaults to the first canonical 27-core scenario folder id.
 * Optional env override is allowed only when the id exists in canonical `scenarioList`.
 */
function resolveFreshEntryScenarioId(): string {
  const raw = process.env.BTY_ARENA_VERTICAL_SLICE_ENTRY_SCENARIO_ID?.trim();
  if (raw && scenarioList.includes(raw as (typeof scenarioList)[number])) {
    return raw;
  }
  return scenarioList[0];
}

export type ScenarioLocalePreference = "en" | "ko";

export type ScenarioDifficultyTier = 1 | 2 | 3;

export type ScenarioMeta = {
  scenarioId: string;
  flag_type: string;
  /** DB: `en` | `ko` | `both`. Fallback inference uses `both` when Korean copy exists. */
  locale: "en" | "ko" | "both";
  /** Elite catalog uses tier 2 by default (1=easy, 2=mid, 3=hard). */
  difficulty: ScenarioDifficultyTier;
  /** `bty_elite` for elite JSON catalog; used for production exclusions. */
  scenario_type?: string;
};

export class ScenarioSelectionError extends Error {
  readonly code:
    | "no_scenario_available"
    | "scenario_payload_missing"
    | "user_ejected_from_arena"
    | "catalog_unavailable";

  constructor(code: ScenarioSelectionError["code"], message: string) {
    super(message);
    this.name = "ScenarioSelectionError";
    this.code = code;
    Object.setPrototypeOf(this, ScenarioSelectionError.prototype);
  }
}

function metaMatchesLocale(meta: ScenarioMeta, pref: ScenarioLocalePreference): boolean {
  if (meta.locale === "both") return true;
  return meta.locale === pref;
}

function isSelectableMeta(meta: ScenarioMeta, pref: ScenarioLocalePreference): boolean {
  return metaMatchesLocale(meta, pref);
}

/** Temporary instrumentation: which prefilter removes metas (remove after diagnosing empty-pool in prod). */
function logSelectNextScenarioPrefilterCounts(
  catalog: ScenarioMeta[],
  playedSet: Set<string>,
  locale: ScenarioLocalePreference,
  attempt: number,
): void {
  let blockedByPlayed = 0;
  let failMetaLocale = 0;
  let candidatesAfterPrefilter = 0;

  for (const m of catalog) {
    if (playedSet.has(m.scenarioId)) {
      blockedByPlayed++;
      continue;
    }
    if (!metaMatchesLocale(m, locale)) {
      failMetaLocale++;
      continue;
    }
    candidatesAfterPrefilter++;
  }

  console.warn(
    "[arena] selectNextScenario prefilter",
    JSON.stringify({
      attempt,
      locale,
      catalogSize: catalog.length,
      blockedByPlayed,
      failMetaLocale,
      candidatesAfterPrefilter,
    }),
  );
}

/** Count completed plays per `flag_type` from history (by scenario id → flag). */
export function playCountsByFlagType(
  playedScenarioIds: readonly string[],
  flagOf: (scenarioId: string) => string | undefined,
): Map<string, number> {
  const m = new Map<string, number>();
  for (const id of playedScenarioIds) {
    const f = flagOf(id);
    if (!f) continue;
    m.set(f, (m.get(f) ?? 0) + 1);
  }
  return m;
}

/**
 * Among candidates, prefer those whose `flag_type` was seen least often in history.
 * Tie-break: lexicographic `scenarioId` (deterministic). Fresh users have empty history so all
 * flag counts are 0 — random ties previously caused different first scenarios per login.
 */
export function pickScenarioIdByFlagCoverage(
  candidates: readonly ScenarioMeta[],
  counts: ReadonlyMap<string, number>,
): ScenarioMeta {
  if (candidates.length === 0) {
    throw new ScenarioSelectionError("no_scenario_available", "No candidate scenarios after filters.");
  }
  let min = Infinity;
  for (const c of candidates) {
    const n = counts.get(c.flag_type) ?? 0;
    if (n < min) min = n;
  }
  const tier = candidates.filter((c) => (counts.get(c.flag_type) ?? 0) === min);
  const sorted = [...tier].sort((a, b) => a.scenarioId.localeCompare(b.scenarioId));
  return sorted[0]!;
}

/** Played scenario ids for Arena routing (catalog + `mirror:` + `pswitch_`). */
export async function fetchPlayedScenarioIds(userId: string): Promise<string[]> {
  const admin = getSupabaseAdmin();
  if (!admin) return [];

  const { data, error } = await admin
    .from("user_scenario_history")
    .select("played_scenario_ids")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) return [];
  const raw = (data as { played_scenario_ids?: unknown } | null)?.played_scenario_ids;
  if (Array.isArray(raw) && raw.length > 0) {
    return raw
      .filter((x): x is string => typeof x === "string")
      .map((id) => getScenarioByDbId(id, "en")?.scenarioId ?? id);
  }

  const { data: rows, error: chErr } = await admin
    .from("user_scenario_choice_history")
    .select("scenario_id")
    .eq("user_id", userId)
    .order("played_at", { ascending: true });

  if (chErr || !rows?.length) return [];
  return rows
    .map((r) => (r as { scenario_id?: string }).scenario_id)
    .filter((x): x is string => typeof x === "string")
    .map((id) => getScenarioByDbId(id, "en")?.scenarioId ?? id);
}

const MIRROR_SCENARIO_ID_PREFIX = "mirror:" as const;

/**
 * Most recently played mirror `scenarioId` (`mirror:<pool_row_uuid>`), using **authoritative** sources:
 * - **`arena_events`** `CHOICE_CONFIRMED` (canonical 7-step Arena writes here via `POST /api/arena/event`; **not** `user_scenario_choice_history`).
 * - **`user_scenario_choice_history`** (legacy `/api/arena/session/choice` → `handleChoiceConfirmed`).
 *
 * When both exist, the row with the **newer** timestamp wins. Returns `null` if neither has a mirror play.
 */
export async function fetchLastServedMirrorScenarioId(userId: string): Promise<string | null> {
  const admin = getSupabaseAdmin();
  if (!admin) return null;

  const { data: chRows } = await admin
    .from("user_scenario_choice_history")
    .select("scenario_id, played_at")
    .eq("user_id", userId)
    .order("played_at", { ascending: false })
    .limit(40);

  let latestCh: { scenario_id: string; t: number } | null = null;
  for (const r of chRows ?? []) {
    const sid = (r as { scenario_id?: string }).scenario_id;
    if (typeof sid !== "string" || !sid.startsWith(MIRROR_SCENARIO_ID_PREFIX)) continue;
    const playedAt = (r as { played_at?: string }).played_at;
    latestCh = { scenario_id: sid, t: new Date(playedAt ?? 0).getTime() };
    break;
  }

  const { data: evRows } = await admin
    .from("arena_events")
    .select("scenario_id, created_at")
    .eq("user_id", userId)
    .eq("event_type", "CHOICE_CONFIRMED")
    .order("created_at", { ascending: false })
    .limit(80);

  let latestEv: { scenario_id: string; t: number } | null = null;
  for (const r of evRows ?? []) {
    const sid = (r as { scenario_id?: string }).scenario_id;
    if (typeof sid !== "string" || !sid.startsWith(MIRROR_SCENARIO_ID_PREFIX)) continue;
    const createdAt = (r as { created_at?: string }).created_at;
    latestEv = { scenario_id: sid, t: new Date(createdAt ?? 0).getTime() };
    break;
  }

  if (!latestCh && !latestEv) return null;
  if (!latestCh) return latestEv!.scenario_id;
  if (!latestEv) return latestCh.scenario_id;
  return latestEv.t >= latestCh.t ? latestEv.scenario_id : latestCh.scenario_id;
}

/**
 * Collapse duplicate metas per `scenarioId` when multiple locale rows exist (elite catalog uses `both`).
 */
function dedupeScenarioMetasByLocaleUnion(rows: ScenarioMeta[]): ScenarioMeta[] {
  const map = new Map<string, ScenarioMeta>();
  for (const m of rows) {
    const prev = map.get(m.scenarioId);
    if (!prev) {
      map.set(m.scenarioId, m);
      continue;
    }
    const loc: ScenarioMeta["locale"] =
      prev.locale === "both" ||
      m.locale === "both" ||
      (prev.locale === "en" && m.locale === "ko") ||
      (prev.locale === "ko" && m.locale === "en")
        ? "both"
        : m.locale;
    map.set(m.scenarioId, {
      ...m,
      locale: loc,
      flag_type: m.flag_type || prev.flag_type,
      difficulty: m.difficulty,
      scenario_type: m.scenario_type ?? prev.scenario_type,
    });
  }
  return [...map.values()];
}

async function fetchScenarioCatalogFromDb(): Promise<ScenarioMeta[] | null> {
  try {
    const out: ScenarioMeta[] = [];
    for (const scenarioId of scenarioList) {
      const runtime = getScenarioById(scenarioId, "en");
      if (!runtime) continue;
      const flagType = `${runtime.incidentId}:${runtime.axisGroup}:${runtime.axisIndex}`;
      const row = {
        scenarioId,
        flag_type: flagType,
        locale: "both" as const,
        difficulty: 2 as const,
        scenario_type: "canonical_json",
      };
      if (isExcludedFromArenaProduction(row.scenarioId, row.scenario_type)) continue;
      out.push({
        scenarioId: row.scenarioId,
        flag_type: row.flag_type,
        locale: row.locale,
        difficulty: row.difficulty,
        scenario_type: row.scenario_type,
      });
    }
    if (!out.length) {
      console.error("[arena] catalog_empty: no canonical scenarios after exclusions");
      return null;
    }
    const deduped = dedupeScenarioMetasByLocaleUnion(out);
    if (!deduped.length) {
      console.error("[arena] catalog_empty: canonical allowlist produced no rows");
      return null;
    }
    return deduped;
  } catch (e) {
    console.error(
      "[arena] catalog_unavailable: canonical scenario registry",
      e instanceof Error ? e.message : e,
    );
    return null;
  }
}

/** Scenarios the user can play in this locale (elite catalog metadata). Used for completion rate. */
export async function getSelectableScenarioMetasForLocale(
  locale: ScenarioLocalePreference,
): Promise<ScenarioMeta[]> {
  const raw = await fetchScenarioCatalogFromDb();
  if (raw == null) {
    console.warn("[arena] getSelectableScenarioMetasForLocale: catalog unavailable (empty list)");
    return [];
  }
  const catalog = raw.filter((m) => !isExcludedFromArenaProduction(m.scenarioId, m.scenario_type));
  return catalog.filter((m) => isSelectableMeta(m, locale));
}

/** Scenarios the user can play in this locale (elite catalog metadata). Used for completion rate. */
export async function countAvailableScenariosForLocale(
  locale: ScenarioLocalePreference,
): Promise<number> {
  const metas = await getSelectableScenarioMetasForLocale(locale);
  return metas.length;
}

export type SelectNextScenarioOptions = {
  /**
   * `arena_runs.scenario_id` values for this user (server-sourced). Unioned with history-based played ids
   * so the same catalog scenario is not served again while an active/incomplete run row exists.
   */
  servedArenaScenarioIds?: readonly string[];
  /**
   * When any unplayed candidates share this `flag_type` (e.g. `INTEGRITY_SLIP` recovery),
   * selection runs only within that subset; otherwise falls back to default coverage-gap pick.
   */
  preferFlagType?: string;
  /**
   * When set, only scenarios with this catalog difficulty (`public.scenarios.difficulty`) are considered first.
   * If none are unplayed, falls back to the full candidate pool (same as no tier filter).
   */
  forceDifficultyTier?: ScenarioDifficultyTier;
  /**
   * When true, biases catalog selection for return from Foundry; routing is always catalog-only.
   * Still honors `preferFlagType` when set.
   */
  foundry_return?: boolean;
  /** When provided, selector fills this object with debug info (staging/dev only). */
  _debugOut?: SelectorDebugOut;
};

/** Staging/dev only — selector introspection for diagnosing unexpected scenario choices. */
export type SelectorDebugOut = {
  selectedScenarioId?: string;
  reason?: string;
  playedCount?: number;
  servedCount?: number;
  skippedPlayedIds?: string[];
  candidatePoolSize?: number;
};

/**
 * Next scenario for an Arena session: exclude played ids, match `locale`, then fill `flag_type` coverage gaps.
 * When every allowlisted Elite scenario has been seen (played ∪ served DONE), **replays** the same Elite pool
 * instead of returning no candidates.
 * When the candidate pool is still empty (e.g. tier/pref filter), runs {@link checkAndRotateArchive} once and retries selection.
 */
export async function selectNextScenario(
  userId: string,
  locale: ScenarioLocalePreference,
  options?: SelectNextScenarioOptions,
): Promise<Scenario> {
  if (await isUserArenaEjected(userId)) {
    throw new ScenarioSelectionError(
      "user_ejected_from_arena",
      "Arena access suspended until Center requirements are met.",
    );
  }

  const rawCatalog = await fetchScenarioCatalogFromDb();
  if (rawCatalog == null || rawCatalog.length === 0) {
    console.error(
      "[arena] catalog_unavailable: canonical scenarios missing or empty",
    );
    throw new ScenarioSelectionError(
      "catalog_unavailable",
      "Arena scenario catalog is unavailable or empty.",
    );
  }
  const catalog = rawCatalog.filter((m) =>
    !isExcludedFromArenaProduction(m.scenarioId, m.scenario_type),
  );
  if (catalog.length === 0) {
    console.error("[arena] catalog_empty: all rows excluded for Arena production");
    throw new ScenarioSelectionError(
      "catalog_unavailable",
      "Arena scenario catalog has no eligible rows after exclusions.",
    );
  }

  const flagLookupFromCatalog = new Map(catalog.map((m) => [m.scenarioId, m.flag_type] as const));

  for (let attempt = 0; attempt < 2; attempt++) {
    const played = await fetchPlayedScenarioIds(userId);
    const served = (options?.servedArenaScenarioIds ?? []).map(
      (id) => getScenarioByDbId(id, "en")?.scenarioId ?? id,
    );
    const playedSet = new Set<string>([...played, ...served]);
    if (options?._debugOut) {
      options._debugOut.playedCount = played.length;
      options._debugOut.servedCount = served.length;
      options._debugOut.skippedPlayedIds = [...playedSet];
    }

    const counts = playCountsByFlagType(played, (id) => flagLookupFromCatalog.get(id));

    logSelectNextScenarioPrefilterCounts(catalog, playedSet, locale, attempt);

    const eligibleForLocale = catalog.filter((m) => isSelectableMeta(m, locale));
    /** Prefer unseen (not in history ∪ served DONE ids); once exhausted, replay the same canonical pool. */
    let candidates = eligibleForLocale.filter((m) => !playedSet.has(m.scenarioId));
    if (candidates.length === 0 && eligibleForLocale.length > 0) {
      console.info("[arena] canonical_catalog_replay", {
        reason: "canonical_allowlist_exhausted",
        poolSize: eligibleForLocale.length,
      });
      candidates = eligibleForLocale;
    }

    const difficultyFloor = await getDifficultyFloor(userId);
    const atOrAboveFloor = candidates.filter((m) => m.difficulty >= difficultyFloor);
    const basePool = atOrAboveFloor.length > 0 ? atOrAboveFloor : candidates;

    let pool = basePool;
    const tier = options?.forceDifficultyTier;
    if (tier === 1 || tier === 2 || tier === 3) {
      const tierOnly = candidates.filter((m) => m.difficulty === tier);
      if (tierOnly.length > 0) pool = tierOnly;
    }

    const pref = options?.preferFlagType?.trim();
    if (pref) {
      const biased = pool.filter((m) => m.flag_type === pref);
      if (biased.length > 0) pool = biased;
    }

    if (pool.length === 0 && attempt === 0) {
      const { checkAndRotateArchive } = await import("@/engine/scenario/scenario-archive.service");
      await checkAndRotateArchive(userId, locale);
      continue;
    }

    if (pool.length === 0) {
      console.warn(
        "[arena] selectNextScenario pool empty (postfilters)",
        JSON.stringify({
          attempt,
          locale,
          candidatesLen: candidates.length,
          poolLen: pool.length,
          difficultyFloor,
          forceDifficultyTier: options?.forceDifficultyTier ?? null,
          preferFlagType: options?.preferFlagType ?? null,
        }),
      );
      throw new ScenarioSelectionError(
        "no_scenario_available",
        "No candidate scenarios after filters (pool empty).",
      );
    }

    /** First Arena session with no history: always canonical entry (not a random catalog row). */
    const isFreshCatalogEntry =
      playedSet.size === 0 &&
      !options?.preferFlagType?.trim() &&
      options?.forceDifficultyTier == null &&
      !options?.foundry_return;

    if (options?._debugOut) {
      options._debugOut.candidatePoolSize = pool.length;
    }

    if (isFreshCatalogEntry) {
      const entryId = resolveFreshEntryScenarioId();
      const pinned = pool.find((m) => m.scenarioId === entryId);
      if (!pinned) {
        throw new ScenarioSelectionError(
          "catalog_unavailable",
          `Fresh entry requires ${entryId} in catalog.`,
        );
      }
      const scenario = await loadArenaScenarioPayloadFromDb(null, pinned.scenarioId, locale);
      if (!scenario) {
        throw new ScenarioSelectionError(
          "scenario_payload_missing",
          `Fresh entry payload missing for ${entryId}.`,
        );
      }
      if (options?._debugOut) {
        options._debugOut.selectedScenarioId = pinned.scenarioId;
        options._debugOut.reason = "fresh_entry_pinned";
      }
      return scenario;
    }

    const meta = pickScenarioIdByFlagCoverage(pool, counts);
    if (options?._debugOut) {
      options._debugOut.selectedScenarioId = meta.scenarioId;
      options._debugOut.reason = "coverage_gap";
    }

    const scenario = await loadArenaScenarioPayloadFromDb(null, meta.scenarioId, locale);
    if (!scenario) {
      console.error("[arena] scenario_payload_missing", {
        scenarioId: meta.scenarioId,
        locale,
        legacyFallback: "blocked",
      });
      throw new ScenarioSelectionError(
        "scenario_payload_missing",
        `No scenario payload in public.scenarios for id ${meta.scenarioId}`,
      );
    }

    return scenario;
  }

  throw new ScenarioSelectionError(
    "no_scenario_available",
    "No candidate scenarios after filters (pool empty).",
  );
}
