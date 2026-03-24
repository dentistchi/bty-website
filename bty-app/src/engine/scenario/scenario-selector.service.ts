/**
 * Arena session start — pick next {@link Scenario} from catalog minus played ids,
 * filtered by locale, weighted toward least-seen `flag_type` (coverage gaps).
 *
 * Reads `user_scenario_history` (with backfill from `user_scenario_choice_history` when the
 * aggregate array was empty) + `scenarios` when Supabase is configured; otherwise falls back to
 * in-app {@link SCENARIOS} merged with DB metadata with `flag_type` inferred from coach notes.
 */

import type { Scenario } from "@/lib/bty/scenario/types";
import { SCENARIOS, getScenarioById } from "@/lib/bty/scenario/scenarios";
import { isUserArenaEjected } from "@/engine/integration/arena-center-ejection";
import { ensureMinimumScenarioCatalogRows } from "@/engine/scenario/scenario-catalog-sync.service";
import { isExcludedFromArenaProduction } from "@/engine/scenario/scenario-production-exclusions";
import { getDifficultyFloor } from "@/engine/scenario/scenario-difficulty-adjuster.service";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export type ScenarioLocalePreference = "en" | "ko";

export type ScenarioDifficultyTier = 1 | 2 | 3;

export type ScenarioMeta = {
  scenarioId: string;
  flag_type: string;
  /** DB: `en` | `ko` | `both`. Fallback inference uses `both` when Korean copy exists. */
  locale: "en" | "ko" | "both";
  /**
   * `public.scenarios.difficulty`: 1=easy, 2=mid, 3=hard.
   * Static fallback catalog uses **2** when not in DB.
   */
  difficulty: ScenarioDifficultyTier;
};

export class ScenarioSelectionError extends Error {
  readonly code: "no_scenario_available" | "scenario_payload_missing" | "user_ejected_from_arena";

  constructor(code: ScenarioSelectionError["code"], message: string) {
    super(message);
    this.name = "ScenarioSelectionError";
    this.code = code;
    Object.setPrototypeOf(this, ScenarioSelectionError.prototype);
  }
}

function inferFlagTypeFromScenario(s: Scenario): string {
  const first = s.coachNotes?.whatThisTrains?.[0];
  return typeof first === "string" && first.length > 0 ? first : "general";
}

function inferLocaleAvailFromScenario(s: Scenario): "en" | "ko" | "both" {
  if (s.titleKo && s.contextKo) return "both";
  return "en";
}

function metaMatchesLocale(meta: ScenarioMeta, pref: ScenarioLocalePreference): boolean {
  if (meta.locale === "both") return true;
  return meta.locale === pref;
}

function staticScenarioMatchesLocale(s: Scenario, pref: ScenarioLocalePreference): boolean {
  if (pref === "ko") return Boolean(s.titleKo && s.contextKo);
  return true;
}

function isSelectableMeta(meta: ScenarioMeta, pref: ScenarioLocalePreference): boolean {
  if (!metaMatchesLocale(meta, pref)) return false;
  const s = getScenarioById(meta.scenarioId);
  if (!s) return false;
  return staticScenarioMatchesLocale(s, pref);
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
  let failMissingPayload = 0;
  let failStaticLocale = 0;
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
    const s = getScenarioById(m.scenarioId);
    if (!s) {
      failMissingPayload++;
      continue;
    }
    if (!staticScenarioMatchesLocale(s, locale)) {
      failStaticLocale++;
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
      failMissingPayload,
      failStaticLocale,
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
 * Tie-break: uniform random among the minimum-coverage tier (avoids always picking the same id).
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
  const idx =
    tier.length <= 1 ? 0 : Math.floor(Math.random() * tier.length);
  return tier[idx]!;
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
    return raw.filter((x): x is string => typeof x === "string");
  }

  const { data: rows, error: chErr } = await admin
    .from("user_scenario_choice_history")
    .select("scenario_id")
    .eq("user_id", userId)
    .order("played_at", { ascending: true });

  if (chErr || !rows?.length) return [];
  return rows
    .map((r) => (r as { scenario_id?: string }).scenario_id)
    .filter((x): x is string => typeof x === "string");
}

/**
 * Collapse `(locale, id)` DB rows into one {@link ScenarioMeta} per `scenarioId` before {@link mergeDbCatalogWithStatic}'s Map.
 * - same `scenarioId` + en row only → `locale: 'en'`
 * - same `scenarioId` + ko row only → `locale: 'ko'`
 * - same `scenarioId` + en and ko → `locale: 'both'`
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
    });
  }
  return [...map.values()];
}

async function fetchScenarioCatalogFromDb(): Promise<ScenarioMeta[] | null> {
  const admin = getSupabaseAdmin();
  if (!admin) return null;

  await ensureMinimumScenarioCatalogRows();

  const { data, error } = await admin
    .from("scenarios")
    .select("id, flag_type, locale, difficulty, scenario_type");
  if (error || !data?.length) return null;

  const out: ScenarioMeta[] = [];
  for (const row of data as Array<{
    id?: string;
    flag_type?: string;
    locale?: string;
    difficulty?: number | null;
    scenario_type?: string | null;
  }>) {
    const scenarioId = row.id;
    const flag_type = row.flag_type;
    const locale = row.locale;
    const scenario_type = row.scenario_type;
    if (!scenarioId || !flag_type) continue;
    if (isExcludedFromArenaProduction(scenarioId, scenario_type)) continue;
    if (locale !== "en" && locale !== "ko" && locale !== "both") continue;
    const d = row.difficulty;
    const difficulty: ScenarioDifficultyTier =
      d === 1 || d === 2 || d === 3 ? d : 2;
    out.push({
      scenarioId,
      flag_type,
      locale: locale as ScenarioMeta["locale"],
      difficulty,
    });
  }
  return out.length ? out : null;
}

function buildFallbackCatalog(): ScenarioMeta[] {
  return SCENARIOS.map((s) => ({
    scenarioId: s.scenarioId,
    flag_type: inferFlagTypeFromScenario(s),
    locale: inferLocaleAvailFromScenario(s),
    difficulty: 2,
  }));
}

/** Union in-app catalog with DB rows so selection never depends on a thin DB slice missing static ids. */
function mergeDbCatalogWithStatic(db: ScenarioMeta[] | null): ScenarioMeta[] {
  const staticCatalog = buildFallbackCatalog();
  if (!db?.length) return staticCatalog;
  const normalized = dedupeScenarioMetasByLocaleUnion(db);
  const map = new Map<string, ScenarioMeta>();
  for (const m of staticCatalog) {
    map.set(m.scenarioId, m);
  }
  for (const m of normalized) {
    map.set(m.scenarioId, m);
  }
  return [...map.values()];
}

/** Scenarios the user can play in this locale (DB catalog or in-app fallback). Used for completion rate. */
export async function getSelectableScenarioMetasForLocale(
  locale: ScenarioLocalePreference,
): Promise<ScenarioMeta[]> {
  const catalog = mergeDbCatalogWithStatic(await fetchScenarioCatalogFromDb());
  return catalog.filter((m) => isSelectableMeta(m, locale));
}

/** Scenarios the user can play in this locale (DB catalog or in-app fallback). Used for completion rate. */
export async function countAvailableScenariosForLocale(
  locale: ScenarioLocalePreference,
): Promise<number> {
  const metas = await getSelectableScenarioMetasForLocale(locale);
  return metas.length;
}

export type SelectNextScenarioOptions = {
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
   * When true, {@link getNextScenarioForSession} skips mirror/perspective rotation and picks catalog only
   * (e.g. return to Arena after Foundry program completion), still honoring `preferFlagType` when set.
   */
  foundry_return?: boolean;
};

/**
 * Next scenario for an Arena session: exclude played ids, match `locale`, then fill `flag_type` coverage gaps.
 * When the candidate pool is empty (e.g. all scenarios played or tier/pref filter), runs
 * {@link checkAndRotateArchive} once and retries selection.
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

  const catalog = mergeDbCatalogWithStatic(await fetchScenarioCatalogFromDb());
  const flagLookupFromCatalog = new Map(catalog.map((m) => [m.scenarioId, m.flag_type] as const));

  for (let attempt = 0; attempt < 2; attempt++) {
    const played = await fetchPlayedScenarioIds(userId);
    const playedSet = new Set(played);

    const counts = playCountsByFlagType(played, (id) => flagLookupFromCatalog.get(id));

    logSelectNextScenarioPrefilterCounts(catalog, playedSet, locale, attempt);

    const candidates = catalog.filter(
      (m) => !playedSet.has(m.scenarioId) && isSelectableMeta(m, locale),
    );

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

    const meta = pickScenarioIdByFlagCoverage(pool, counts);

    const scenario = getScenarioById(meta.scenarioId);
    if (!scenario) {
      throw new ScenarioSelectionError(
        "scenario_payload_missing",
        `No scenario payload for id ${meta.scenarioId}`,
      );
    }

    return scenario;
  }

  throw new ScenarioSelectionError(
    "no_scenario_available",
    "No candidate scenarios after filters (pool empty).",
  );
}
