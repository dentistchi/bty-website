/**
 * Arena canonical scenarios: bundled `src/data/bty_elite_scenarios_v2.json` (static import — always in deploy
 * bundle). Legacy `bty_elite_scenarios.json` (v1) is retained unchanged for diff/rollback.
 * Optional `ELITE_SCENARIOS_JSON_PATH` overrides for local/dev only; production should not rely on it.
 */

import type { EscalationBranch } from "@/domain/arena/scenarios/types";
import type { HiddenStatKey, Scenario, ScenarioChoice } from "@/lib/bty/scenario/types";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { existsSync, readFileSync } from "fs";

/** Bundled at build time — no `process.cwd()` or relative disk paths in the default path. */
import bundledEliteJson from "@/data/bty_elite_scenarios_v2.json";

/** v2 Step 2 — primary options; ids must match `escalationBranches` keys for this scenario. */
export type ElitePrimaryChoiceRow = {
  id: string;
  label: string;
  subtext?: string;
};

export type EliteScenario = {
  id: string;
  title: string;
  role: string;
  pressure: string;
  tradeoff: string;
  bty_tension_axis: string;
  action_contract: { description: string; time_window_hours: number };
  air_logic: { success: string; miss: string };
  forced_reset: { trigger: string; action: string };
  pattern_detection: string[];
  /** v2 Step 2 — rendered as-is (not axis-synthesized). */
  primaryChoices: ElitePrimaryChoiceRow[];
  /** Optional v2+ payload; ignored by legacy mappers until wired per scenario. */
  difficulty_level?: 1 | 2 | 3 | 4 | 5;
  escalationBranches?: Record<string, EscalationBranch>;
};

export type EliteDataset = {
  dataset: string;
  total: number;
  scenarios: EliteScenario[];
};

let cachedDataset: EliteDataset | null = null;

function parseEliteDataset(raw: unknown): EliteDataset {
  const parsed = raw as EliteDataset;
  if (!parsed?.scenarios || !Array.isArray(parsed.scenarios)) {
    throw new Error("[elite] invalid dataset: missing scenarios[]");
  }
  if (parsed.scenarios.length === 0) {
    throw new Error("[elite] invalid dataset: scenarios[] is empty");
  }
  for (const s of parsed.scenarios) {
    validateEliteScenario(s as EliteScenario);
  }
  return parsed;
}

/**
 * Ensures each scenario has `primaryChoices` and, when `escalationBranches` exists, keys match exactly (bidirectional).
 */
function validateEliteScenario(s: EliteScenario): void {
  const id = typeof s.id === "string" ? s.id : "?";
  if (!Array.isArray(s.primaryChoices) || s.primaryChoices.length === 0) {
    throw new Error(`[elite] ${id}: primaryChoices required (non-empty)`);
  }
  const eb = s.escalationBranches;
  if (eb != null && typeof eb === "object" && !Array.isArray(eb) && Object.keys(eb).length > 0) {
    const ebKeys = new Set(Object.keys(eb));
    const pIds = new Set(s.primaryChoices.map((p) => String(p.id).trim()));
    for (const k of ebKeys) {
      if (!pIds.has(k)) {
        throw new Error(`[elite] ${id}: escalationBranches key "${k}" missing from primaryChoices`);
      }
    }
    for (const p of s.primaryChoices) {
      const pid = String(p.id).trim();
      if (!ebKeys.has(pid)) {
        throw new Error(`[elite] ${id}: primaryChoices id "${pid}" missing from escalationBranches`);
      }
    }
  }
}

/**
 * Fail closed at module load when using the default bundled source (no env override).
 * Ensures production never starts with a broken or missing bundle.
 */
function assertBundledEliteValidAtStartup(): void {
  if (process.env.ELITE_SCENARIOS_JSON_PATH?.trim()) return;
  try {
    parseEliteDataset(bundledEliteJson);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[arena] elite_canonical_load_failed", {
      phase: "module_init",
      reason: "bundled_bty_elite_scenarios_v2_invalid",
      message: msg,
      legacyFallback: "blocked",
    });
    throw new Error(`[elite] canonical bundled dataset failed validation: ${msg}`);
  }
}

assertBundledEliteValidAtStartup();

/**
 * Load elite dataset: default is static bundled JSON. If `ELITE_SCENARIOS_JSON_PATH` is set, read that
 * file instead (dev/local override only — not required in production).
 */
export function loadEliteDataset(): EliteDataset {
  if (cachedDataset) return cachedDataset;

  const override = process.env.ELITE_SCENARIOS_JSON_PATH?.trim();
  if (override) {
    if (!existsSync(override)) {
      console.error("[arena] elite_canonical_load_failed", {
        phase: "override",
        reason: "ELITE_SCENARIOS_JSON_PATH_file_missing",
        path: override,
        legacyFallback: "blocked",
      });
      throw new Error(`[elite] ELITE_SCENARIOS_JSON_PATH not found: ${override}`);
    }
    try {
      const raw = readFileSync(override, "utf8");
      cachedDataset = parseEliteDataset(JSON.parse(raw) as unknown);
      return cachedDataset;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error("[arena] elite_canonical_load_failed", {
        phase: "override",
        reason: "parse_or_read_failed",
        path: override,
        message: msg,
        legacyFallback: "blocked",
      });
      throw e;
    }
  }

  try {
    cachedDataset = parseEliteDataset(bundledEliteJson);
    return cachedDataset;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[arena] elite_canonical_load_failed", {
      phase: "bundled",
      reason: "parse_failed",
      message: msg,
      legacyFallback: "blocked",
    });
    throw e;
  }
}

export function getEliteScenarioById(id: string): EliteScenario | undefined {
  return loadEliteDataset().scenarios.find((s) => s.id === id);
}

function flagTypeFromElite(s: EliteScenario): string {
  const p = s.pattern_detection?.[0]?.trim();
  if (p && p.length > 0) return p.toUpperCase().replace(/[^A-Z0-9_]/gi, "_");
  return "BTY_ELITE";
}

/**
 * User-visible narrative only: role, pressure, tradeoff.
 * Does **not** include bty_tension_axis, action_contract, air_logic, forced_reset, pattern_detection (engine/internal).
 */
function buildEliteNarrativeBody(s: EliteScenario): string {
  return [s.role, s.pressure, s.tradeoff].filter((x) => typeof x === "string" && x.trim() !== "").join("\n\n");
}

function buildChoice(
  choiceId: "A" | "B" | "C" | "D",
  label: string,
  intent: string,
  index: number,
): ScenarioChoice {
  const xpBase = 35 + index * 8;
  return {
    choiceId,
    label,
    intent,
    xpBase,
    difficulty: 1.0,
    hiddenDelta: {
      integrity: 0,
      communication: 0,
      insight: 0,
      resilience: 0,
      gratitude: 0,
    },
    result:
      "Your choice is recorded. Continue building leadership habits in the next interaction.",
    microInsight: intent ? `Theme: ${intent}` : "Small choices compound into culture.",
    followUp: { enabled: false },
  };
}

function parsePrimaryChoiceId(raw: string): "A" | "B" | "C" | "D" {
  const id = String(raw).trim();
  if (id === "A" || id === "B" || id === "C" || id === "D") return id;
  throw new Error(`[elite] invalid primaryChoices id (expected A–D): ${raw}`);
}

/**
 * Step 2 choices from bundled `primaryChoices` only — same ids used for `escalationBranches[id]` on steps 3–4.
 */
function choicesFromPrimaryChoicesJson(rows: ElitePrimaryChoiceRow[]): ScenarioChoice[] {
  return rows.map((row, index) => {
    const choiceId = parsePrimaryChoiceId(row.id);
    const label = typeof row.label === "string" ? row.label.trim() : "";
    if (!label) throw new Error(`[elite] empty primaryChoices label for id ${row.id}`);
    const base = buildChoice(choiceId, label, `primary_${choiceId}`, index);
    const sub = typeof row.subtext === "string" ? row.subtext.trim() : "";
    return sub !== "" ? { ...base, choiceSubtext: sub } : base;
  });
}

function coachWhatForElite(s: EliteScenario): HiddenStatKey[] {
  const top = flagTypeFromElite(s).toLowerCase();
  if (top.includes("integrity")) return ["integrity"];
  if (top.includes("avoid") || top.includes("communication") || top.includes("empathy"))
    return ["communication"];
  if (top.includes("resilien")) return ["resilience"];
  if (top.includes("gratitude")) return ["gratitude"];
  return ["insight"];
}

function inferCoachKeys(s: EliteScenario): NonNullable<Scenario["coachNotes"]> {
  return {
    whatThisTrains: coachWhatForElite(s),
    whyItMatters:
      "Elite scenario — practice structural honesty under DSO operational pressure.",
  };
}

/**
 * Default tier when JSON omits `difficulty_level` — matches `DIFFICULTY_ESCALATION_INTENSITY[3]` in
 * `domain/arena/scenarios/difficultyEscalationIntensity.ts` (“Internal conflict, competing values”).
 */
const DEFAULT_ELITE_SCENARIO_DIFFICULTY_LEVEL = 3 as NonNullable<Scenario["difficulty_level"]>;

/**
 * Map elite JSON entry → lib {@link Scenario}.
 * Narrative copy in JSON is English-only today; `/ko` uses the same English body (single language) until optional `*_ko` fields exist in the dataset — avoids EN narrative + KO action_contract mixing in `context`.
 *
 * **Step 2:** `primaryChoices` from JSON (ids align with `escalationBranches` keys). No axis-synthesized labels.
 * **Escalation (Steps 3–4):** Only `escalationBranches` from the elite row is used. No generic/mock mission copy is merged in.
 */
export function eliteScenarioToScenario(s: EliteScenario, _locale: "en" | "ko"): Scenario {
  const body = buildEliteNarrativeBody(s);

  const rowEb = s.escalationBranches;
  const hasRowEscalation =
    rowEb != null &&
    typeof rowEb === "object" &&
    !Array.isArray(rowEb) &&
    Object.keys(rowEb as object).length > 0;

  let escalationBranches: Record<string, EscalationBranch> | undefined;
  let difficulty_level: NonNullable<Scenario["difficulty_level"]> | undefined;

  if (hasRowEscalation) {
    escalationBranches = rowEb as Record<string, EscalationBranch>;
    difficulty_level = s.difficulty_level ?? DEFAULT_ELITE_SCENARIO_DIFFICULTY_LEVEL;
  }

  const scenario: Scenario = {
    scenarioId: s.id,
    title: s.title,
    context: body,
    choices: choicesFromPrimaryChoicesJson(s.primaryChoices),
    coachNotes: inferCoachKeys(s),
    elite_only: true,
    eliteSetup: {
      role: s.role,
      pressure: s.pressure,
      tradeoff: s.tradeoff,
    },
    ...(escalationBranches != null &&
      difficulty_level != null && {
        escalationBranches,
        difficulty_level,
      }),
  };
  return scenario;
}

/** Catalog metadata for session/next (no DB read). */
export function getEliteScenarioCatalogMetas(): Array<{
  scenarioId: string;
  flag_type: string;
  locale: "both";
  difficulty: 1 | 2 | 3;
  scenario_type: string;
}> {
  const { scenarios } = loadEliteDataset();
  return scenarios.map((s) => ({
    scenarioId: s.id,
    flag_type: flagTypeFromElite(s),
    locale: "both",
    difficulty: 2,
    scenario_type: "bty_elite",
  }));
}

type DbRow = {
  locale: string;
  id: string;
  title: string;
  body: string;
  choices: Array<{ id: string; text: string; flag_type: string }>;
  flag_type: string;
  scenario_type: string;
  difficulty: number;
  is_beginner: boolean;
  updated_at: string;
};

function eliteToDbRows(s: EliteScenario): DbRow[] {
  const scenario = eliteScenarioToScenario(s, "en");
  const choices = scenario.choices.map((c) => ({
    id: c.choiceId,
    text: c.label,
    flag_type: c.intent,
  }));
  const body = scenario.context;
  const now = new Date().toISOString();
  const base = {
    id: s.id,
    title: s.title,
    body,
    choices,
    flag_type: flagTypeFromElite(s),
    scenario_type: "bty_elite",
    difficulty: 2,
    is_beginner: false,
    updated_at: now,
  };
  return [
    { locale: "en", ...base },
    { locale: "ko", ...base },
  ];
}

/**
 * Upsert all elite scenarios into `public.scenarios` (en + ko rows per id). Sole sync source for DB mirror.
 */
export async function upsertEliteCatalogToPublicScenarios(): Promise<{
  ok: boolean;
  insertedOrUpdated: number;
  error?: string;
}> {
  const admin = getSupabaseAdmin();
  if (!admin) {
    return { ok: false, insertedOrUpdated: 0, error: "SUPABASE_SERVICE_ROLE_KEY not set" };
  }
  const { scenarios } = loadEliteDataset();
  const rows: DbRow[] = [];
  for (const s of scenarios) {
    rows.push(...eliteToDbRows(s));
  }
  const { error } = await admin.from("scenarios").upsert(rows, { onConflict: "locale,id" });
  if (error) return { ok: false, insertedOrUpdated: 0, error: error.message };
  return { ok: true, insertedOrUpdated: rows.length };
}
