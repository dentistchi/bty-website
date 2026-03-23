/**
 * In-app TS catalog ({@link SCENARIOS}, {@link BEGINNER_SCENARIOS}) → `public.scenarios` upsert.
 * Composite key `(locale, id)` — `id` is the shared base id (`scenarioId`).
 * The four scenarios present in both lists are synced only as beginner rows (excluded from arena batch).
 */

import type { BeginnerScenario } from "@/lib/bty/scenario/beginnerTypes";
import { BEGINNER_SCENARIOS } from "@/lib/bty/scenario/beginnerScenarios";
import type { Scenario as ArenaScenario, ScenarioChoice } from "@/lib/bty/scenario/types";
import { SCENARIOS } from "@/lib/bty/scenario/scenarios";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export type CatalogScenarioRow = {
  id: string;
  locale: "en" | "ko";
  title: string;
  body: string;
  choices: Array<{ id: string; text: string; flag_type: string }>;
  flag_type: string;
  scenario_type: string;
  difficulty: 1 | 2 | 3;
  is_beginner: boolean;
};

export type SyncResult = {
  ok: boolean;
  inserted: number;
  updated: number;
  /** Rows already matching DB (no upsert sent). */
  skipped: number;
  errors: { baseId: string; locale?: string; message: string }[];
};

function inferArenaFlagType(s: ArenaScenario): string {
  const first = s.coachNotes?.whatThisTrains?.[0];
  return typeof first === "string" && first.length > 0 ? first : "general";
}

function inferArenaScenarioType(s: ArenaScenario): string {
  return inferArenaFlagType(s);
}

function inferArenaDifficulty(s: ArenaScenario): 1 | 2 | 3 {
  const choices = s.choices;
  if (choices.length === 0) return 2;
  const avg = choices.reduce((sum, c) => sum + c.difficulty, 0) / choices.length;
  if (avg < 1.05) return 1;
  if (avg <= 1.2) return 2;
  return 3;
}

function mapArenaChoice(
  c: ScenarioChoice,
  locale: "en" | "ko",
): { id: string; text: string; flag_type: string } {
  const text = locale === "ko" ? (c.labelKo ?? c.label) : c.label;
  return { id: c.choiceId, text, flag_type: c.intent };
}

function hasFullKorean(s: ArenaScenario): boolean {
  return Boolean(s.titleKo && s.contextKo);
}

/** Two rows (en + ko) when Korean copy exists; otherwise one `en` row. */
export function arenaScenarioToRows(
  s: ArenaScenario,
  isBeginner: boolean = false,
): CatalogScenarioRow[] {
  const flag_type = inferArenaFlagType(s);
  const scenario_type = inferArenaScenarioType(s);
  const difficulty = inferArenaDifficulty(s);
  const base = {
    id: s.scenarioId,
    flag_type,
    scenario_type,
    difficulty,
    is_beginner: isBeginner,
  };

  const enRow: CatalogScenarioRow = {
    ...base,
    locale: "en",
    title: s.title,
    body: s.context,
    choices: s.choices.map((c) => mapArenaChoice(c, "en")),
  };

  if (!hasFullKorean(s)) {
    return [enRow];
  }

  const koRow: CatalogScenarioRow = {
    ...base,
    locale: "ko",
    title: s.titleKo ?? s.title,
    body: s.contextKo ?? s.context,
    choices: s.choices.map((c) => mapArenaChoice(c, "ko")),
  };

  return [enRow, koRow];
}

function beginnerPayload(b: BeginnerScenario, locale: "en" | "ko"): Record<string, unknown> {
  if (locale === "ko") {
    return {
      kind: "beginner_7step",
      title: b.titleKo ?? b.title,
      context: b.contextKo ?? b.context,
      emotionOptions: b.emotionOptionsKo ?? b.emotionOptions,
      hiddenRiskQuestion: b.hiddenRiskQuestionKo ?? b.hiddenRiskQuestion,
      riskOptions: b.riskOptionsKo ?? b.riskOptions,
      integrityTrigger: b.integrityTriggerKo ?? b.integrityTrigger,
      integrityOptions: b.integrityOptionsKo ?? b.integrityOptions,
      decisionOptions: b.decisionOptionsKo ?? b.decisionOptions,
      growth: b.growthKo ?? b.growth,
    };
  }
  return {
    kind: "beginner_7step",
    title: b.title,
    context: b.context,
    emotionOptions: b.emotionOptions,
    hiddenRiskQuestion: b.hiddenRiskQuestion,
    riskOptions: b.riskOptions,
    integrityTrigger: b.integrityTrigger,
    integrityOptions: b.integrityOptions,
    decisionOptions: b.decisionOptions,
    growth: b.growth,
  };
}

function beginnerChoices(
  b: BeginnerScenario,
  locale: "en" | "ko",
): Array<{ id: string; text: string; flag_type: string }> {
  const opts =
    locale === "ko" ? (b.decisionOptionsKo ?? b.decisionOptions) : b.decisionOptions;
  return opts.map((o) => ({ id: o.id, text: o.label, flag_type: "decision" }));
}

/** Two rows (en + ko) when Korean fields exist; otherwise one `en` row. */
export function beginnerScenarioToRows(b: BeginnerScenario): CatalogScenarioRow[] {
  const scenario_type = "beginner_7step";
  const difficulty = 1 as const;
  const flag_type = "beginner";
  const baseId = b.scenarioId;

  const en: CatalogScenarioRow = {
    id: baseId,
    locale: "en",
    title: b.title,
    body: JSON.stringify(beginnerPayload(b, "en")),
    choices: beginnerChoices(b, "en"),
    flag_type,
    scenario_type,
    difficulty,
    is_beginner: true,
  };

  if (!b.titleKo || !b.contextKo) {
    return [en];
  }

  const ko: CatalogScenarioRow = {
    id: baseId,
    locale: "ko",
    title: b.titleKo,
    body: JSON.stringify(beginnerPayload(b, "ko")),
    choices: beginnerChoices(b, "ko"),
    flag_type,
    scenario_type,
    difficulty,
    is_beginner: true,
  };

  return [en, ko];
}

function rowKey(r: Pick<CatalogScenarioRow, "locale" | "id">): string {
  return `${r.locale}:${r.id}`;
}

function stableStringifyPayload(r: CatalogScenarioRow): string {
  return JSON.stringify({
    id: r.id,
    locale: r.locale,
    title: r.title,
    body: r.body,
    choices: r.choices,
    flag_type: r.flag_type,
    scenario_type: r.scenario_type,
    difficulty: r.difficulty,
    is_beginner: r.is_beginner,
  });
}

type DbScenarioRow = {
  locale: string;
  id: string;
  title: string;
  body: string;
  choices: unknown;
  flag_type: string | null;
  scenario_type: string;
  difficulty: number | null;
  is_beginner: boolean | null;
};

function dbRowToComparable(r: DbScenarioRow): string {
  const choices = Array.isArray(r.choices) ? r.choices : [];
  const difficulty =
    r.difficulty === 1 || r.difficulty === 2 || r.difficulty === 3 ? r.difficulty : 2;
  const payload: CatalogScenarioRow = {
    id: r.id,
    locale: r.locale as "en" | "ko",
    title: r.title,
    body: r.body,
    choices: choices as CatalogScenarioRow["choices"],
    flag_type: r.flag_type ?? "",
    scenario_type: r.scenario_type ?? "",
    difficulty,
    is_beginner: Boolean(r.is_beginner),
  };
  return stableStringifyPayload(payload);
}

/**
 * Upsert all catalog-derived rows into `public.scenarios` (`onConflict: locale,id`).
 * - Arena: 45 definitions minus the 4 beginner-only ids → 41×2 bilingual rows.
 * - Beginner: 4×2 bilingual rows (`is_beginner: true`), same base ids as those four.
 */
export async function syncCatalogToDB(): Promise<SyncResult> {
  const errors: SyncResult["errors"] = [];
  let inserted = 0;
  let updated = 0;
  let skippedUnchanged = 0;

  const beginnerIds = new Set(BEGINNER_SCENARIOS.map((b) => b.scenarioId));
  const arenaSource = SCENARIOS.filter((s) => !beginnerIds.has(s.scenarioId));

  const rows: CatalogScenarioRow[] = [];
  for (const s of arenaSource) {
    rows.push(...arenaScenarioToRows(s));
  }
  for (const b of BEGINNER_SCENARIOS) {
    rows.push(...beginnerScenarioToRows(b));
  }

  const admin = getSupabaseAdmin();
  if (!admin) {
    return {
      ok: false,
      inserted: 0,
      updated: 0,
      skipped: 0,
      errors: [
        {
          baseId: "(env)",
          message: "SUPABASE_SERVICE_ROLE_KEY not set — cannot sync scenarios",
        },
      ],
    };
  }

  const ids = [...new Set(rows.map((r) => r.id))];

  const { data: existingRows, error: fetchError } = await admin
    .from("scenarios")
    .select("locale,id,title,body,choices,flag_type,scenario_type,difficulty,is_beginner")
    .in("id", ids);

  if (fetchError) {
    return {
      ok: false,
      inserted: 0,
      updated: 0,
      skipped: 0,
      errors: [{ baseId: "(database)", message: fetchError.message }],
    };
  }

  const existingMap = new Map<string, string>();
  for (const ex of (existingRows ?? []) as DbScenarioRow[]) {
    existingMap.set(rowKey(ex as CatalogScenarioRow), dbRowToComparable(ex as DbScenarioRow));
  }

  const toWrite: CatalogScenarioRow[] = [];
  for (const r of rows) {
    const k = rowKey(r);
    const next = stableStringifyPayload(r);
    const prev = existingMap.get(k);
    if (prev === next) {
      skippedUnchanged += 1;
      continue;
    }
    if (prev !== undefined) {
      updated += 1;
    } else {
      inserted += 1;
    }
    toWrite.push(r);
    existingMap.set(k, next);
  }

  if (toWrite.length === 0) {
    return {
      ok: errors.length === 0,
      inserted,
      updated,
      skipped: skippedUnchanged,
      errors,
    };
  }

  const upsertPayload = toWrite.map((r) => ({
    locale: r.locale,
    id: r.id,
    title: r.title,
    body: r.body,
    choices: r.choices,
    flag_type: r.flag_type,
    scenario_type: r.scenario_type,
    difficulty: r.difficulty,
    is_beginner: r.is_beginner,
    updated_at: new Date().toISOString(),
  }));

  const { error: upsertError } = await admin.from("scenarios").upsert(upsertPayload, {
    onConflict: "locale,id",
  });

  if (upsertError) {
    errors.push({ baseId: "(database)", message: upsertError.message });
    return {
      ok: false,
      inserted: 0,
      updated: 0,
      skipped: skippedUnchanged,
      errors,
    };
  }

  return {
    ok: errors.length === 0,
    inserted,
    updated,
    skipped: skippedUnchanged,
    errors,
  };
}

/** Full EN+KO sync yields well above this; below it we upsert the in-app catalog. */
export const MIN_SCENARIO_CATALOG_ROW_COUNT = 50;

/**
 * When `public.scenarios` has fewer than {@link MIN_SCENARIO_CATALOG_ROW_COUNT} rows, runs {@link syncCatalogToDB}.
 * No-op without admin client or if count query fails.
 */
export async function ensureMinimumScenarioCatalogRows(
  minRows: number = MIN_SCENARIO_CATALOG_ROW_COUNT,
): Promise<void> {
  const admin = getSupabaseAdmin();
  if (!admin) return;

  const { count, error } = await admin.from("scenarios").select("*", { count: "exact", head: true });

  if (error) {
    console.warn("[scenario-catalog-sync] ensureMinimumScenarioCatalogRows count failed:", error.message);
    return;
  }

  const n = count ?? 0;
  if (n >= minRows) return;

  const result = await syncCatalogToDB();
  if (!result.ok) {
    console.warn("[scenario-catalog-sync] ensureMinimumScenarioCatalogRows sync failed:", result.errors);
  }
}
