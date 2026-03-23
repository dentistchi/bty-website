/**
 * Arena session start — pick next {@link Scenario} from catalog minus played ids,
 * filtered by locale, weighted toward least-seen `flag_type` (coverage gaps).
 *
 * Reads `user_scenario_history` + `scenarios` when Supabase is configured; otherwise
 * falls back to in-app {@link SCENARIOS} with `flag_type` inferred from coach notes.
 */

import type { Scenario } from "@/lib/bty/scenario/types";
import { SCENARIOS, getScenarioById } from "@/lib/bty/scenario/scenarios";
import { isUserArenaEjected } from "@/engine/integration/arena-center-ejection";
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
 * Tie-break: lexicographic `scenario_id` (stable).
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
  tier.sort((a, b) => a.scenarioId.localeCompare(b.scenarioId));
  return tier[0]!;
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

  if (error || !data) return [];
  const raw = (data as { played_scenario_ids?: unknown }).played_scenario_ids;
  if (!Array.isArray(raw)) return [];
  return raw.filter((x): x is string => typeof x === "string");
}

async function fetchScenarioCatalogFromDb(): Promise<ScenarioMeta[] | null> {
  const admin = getSupabaseAdmin();
  if (!admin) return null;

  const { data, error } = await admin.from("scenarios").select("scenario_id, flag_type, locale, difficulty");
  if (error || !data?.length) return null;

  const out: ScenarioMeta[] = [];
  for (const row of data as Array<{
    scenario_id?: string;
    flag_type?: string;
    locale?: string;
    difficulty?: number | null;
  }>) {
    const scenarioId = row.scenario_id;
    const flag_type = row.flag_type;
    const locale = row.locale;
    if (!scenarioId || !flag_type) continue;
    if (locale !== "en" && locale !== "ko" && locale !== "both") continue;
    const d = row.difficulty;
    const difficulty: ScenarioDifficultyTier =
      d === 1 || d === 2 || d === 3 ? d : 2;
    out.push({ scenarioId, flag_type, locale, difficulty });
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

/** Scenarios the user can play in this locale (DB catalog or in-app fallback). Used for completion rate. */
export async function getSelectableScenarioMetasForLocale(
  locale: ScenarioLocalePreference,
): Promise<ScenarioMeta[]> {
  const catalog = (await fetchScenarioCatalogFromDb()) ?? buildFallbackCatalog();
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

  const catalog = (await fetchScenarioCatalogFromDb()) ?? buildFallbackCatalog();
  const flagLookupFromCatalog = new Map(catalog.map((m) => [m.scenarioId, m.flag_type] as const));

  for (let attempt = 0; attempt < 2; attempt++) {
    const played = await fetchPlayedScenarioIds(userId);
    const playedSet = new Set(played);

    const counts = playCountsByFlagType(played, (id) => flagLookupFromCatalog.get(id));

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
