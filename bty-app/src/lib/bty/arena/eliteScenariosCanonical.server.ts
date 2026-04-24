/**
 * Arena canonical elite scenarios — **single server source**: chain workspace projection plus
 * first-class vertical-slice rows (e.g. {@link buildOwnRe02R1EliteScenario}).
 *
 * Runtime narrative never comes from `bty_elite_scenarios_v2.json` (that file is a build/sync artifact;
 * see `npm run sync:elite-from-chain`).
 */

import type { EscalationBranch, SecondChoice } from "@/domain/arena/scenarios/types";
import type { HiddenStatKey, Scenario, ScenarioChoice } from "@/lib/bty/scenario/types";
import { assertCanonicalEliteNoLegacyLeak } from "@/lib/bty/arena/canonicalElitePayloadGuard.server";
import {
  buildEliteScenarioFromChainWorkspace,
  CHAIN_WORKSPACE_ELITE_IDS,
  type ChainWorkspaceEliteId,
} from "@/lib/bty/arena/chainWorkspaceToEliteScenario.server";
import { buildOwnRe02R1EliteScenario } from "@/lib/bty/arena/ownRe02R1EliteScenario.server";
import { isEliteChainScenarioId } from "@/lib/bty/arena/postLoginEliteEntry";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

/** v2 Step 2 — primary options; ids must match `escalationBranches` keys for this scenario. */
export type ElitePrimaryChoiceRow = {
  id: string;
  label: string;
  subtext?: string;
  /** When set (OWN-RE / binding template), overrides `${scenarioId}:primary:*` ids. */
  dbChoiceId?: string;
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

function buildCanonicalEliteDataset(): EliteDataset {
  const chainScenarios: EliteScenario[] = CHAIN_WORKSPACE_ELITE_IDS.map((id) => {
    const s = buildEliteScenarioFromChainWorkspace(id as ChainWorkspaceEliteId);
    assertCanonicalEliteNoLegacyLeak(s);
    validateEliteScenario(s);
    return s;
  });
  const ownRe = buildOwnRe02R1EliteScenario() as EliteScenario;
  assertCanonicalEliteNoLegacyLeak(ownRe);
  validateEliteScenario(ownRe);
  const scenarios = [...chainScenarios, ownRe];
  return {
    dataset: "canonical_elite_v2_chain_plus_own_re_02_r1",
    total: scenarios.length,
    scenarios,
  };
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
 * Fail closed at module load: chain projection + validation + legacy-leak guard must pass.
 */
function assertChainEliteValidAtStartup(): void {
  try {
    loadEliteDataset();
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[arena] elite_canonical_load_failed", {
      phase: "module_init",
      reason: "canonical_elite_invalid",
      message: msg,
      legacyFallback: "blocked",
    });
    throw new Error(`[elite] canonical elite dataset failed: ${msg}`);
  }
}

assertChainEliteValidAtStartup();

/**
 * Cached elite dataset: chain-projected scenarios plus first-class slice rows (e.g. OWN-RE-02-R1).
 */
export function loadEliteDataset(): EliteDataset {
  if (cachedDataset) return cachedDataset;
  cachedDataset = buildCanonicalEliteDataset();
  return cachedDataset;
}

/**
 * Strict: allowed elite ids only — {@link buildEliteScenarioFromChainWorkspace}.
 * @throws Error if `id` is not one of {@link CHAIN_WORKSPACE_ELITE_IDS}
 */
export function getEliteScenarioById(id: string): EliteScenario {
  if (!isEliteChainScenarioId(id)) {
    throw new Error(`[elite] forbidden_scenario_id: ${id}`);
  }
  const ds = loadEliteDataset();
  const s = ds.scenarios.find((x) => x.id === id);
  if (!s) {
    throw new Error(`[elite] invariant: missing canonical scenario for ${id}`);
  }
  return s;
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
  dbChoiceId: string,
): ScenarioChoice {
  const xpBase = 35 + index * 8;
  return {
    choiceId,
    dbChoiceId,
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
    /** Elite v2 UI does not surface result/microInsight; keep empty so no generic adapter copy can leak into the runtime. */
    result: "",
    microInsight: "",
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
function choicesFromPrimaryChoicesJson(rows: ElitePrimaryChoiceRow[], eliteScenarioId: string): ScenarioChoice[] {
  const out: ScenarioChoice[] = [];
  for (let index = 0; index < rows.length; index += 1) {
    const row = rows[index]!;
    const choiceId = parsePrimaryChoiceId(row.id);
    const label = typeof row.label === "string" ? row.label.trim() : "";
    if (!label) throw new Error(`[elite] empty primaryChoices label for id ${row.id}`);
    const sub = typeof row.subtext === "string" ? row.subtext.trim() : "";
    const dbChoiceId =
      typeof row.dbChoiceId === "string" && row.dbChoiceId.trim() !== ""
        ? row.dbChoiceId.trim()
        : `${eliteScenarioId}:primary:${choiceId}`;
    const b = buildChoice(choiceId, label, `primary_${choiceId}`, index, dbChoiceId);
    if (sub === "") {
      out.push(b);
    } else {
      out.push({
        choiceId: b.choiceId,
        dbChoiceId: b.dbChoiceId,
        label: b.label,
        choiceSubtext: sub,
        intent: b.intent,
        xpBase: b.xpBase,
        difficulty: b.difficulty,
        hiddenDelta: {
          integrity: 0,
          communication: 0,
          insight: 0,
          resilience: 0,
          gratitude: 0,
        },
        result: "",
        microInsight: "",
        followUp: { enabled: false },
      });
    }
  }
  return out;
}

function cloneSecondChoice(sc: SecondChoice): SecondChoice {
  const o: SecondChoice = {
    id: sc.id,
    label: sc.label,
    cost: sc.cost,
    direction: sc.direction,
  };
  if (typeof sc.pattern_family === "string" && sc.pattern_family.trim() !== "") {
    o.pattern_family = sc.pattern_family.trim();
  }
  return o;
}

function cloneEscalationBranch(br: EscalationBranch, scenarioIdForDb?: string): EscalationBranch {
  const second_choices: SecondChoice[] = [];
  for (const sc of br.second_choices) {
    const c = cloneSecondChoice(sc);
    const secondDb =
      typeof sc.dbChoiceId === "string" && sc.dbChoiceId.trim() !== ""
        ? sc.dbChoiceId.trim()
        : scenarioIdForDb != null && scenarioIdForDb.trim() !== ""
          ? `${scenarioIdForDb}:second:${sc.id}`
          : undefined;
    second_choices.push(
      secondDb != null ? { ...c, dbChoiceId: secondDb } : c,
    );
  }
  const base: EscalationBranch = {
    escalation_text: br.escalation_text,
    pressure_increase: br.pressure_increase,
    second_choices,
  };
  const ad = br.action_decision;
  if (ad != null && Array.isArray(ad.choices) && ad.choices.length > 0) {
    base.action_decision = {
      prompt: ad.prompt,
      ...(typeof ad.promptKo === "string" && ad.promptKo.trim() !== "" ? { promptKo: ad.promptKo.trim() } : {}),
      choices: ad.choices.map((c) => ({
        id: c.id,
        label: c.label,
        ...(typeof c.commitment === "string" && c.commitment.trim() !== ""
          ? { commitment: c.commitment.trim() }
          : {}),
        ...(c.meaning != null && typeof c.meaning === "object" ? { meaning: c.meaning } : {}),
        dbChoiceId:
          typeof c.dbChoiceId === "string" && c.dbChoiceId.trim() !== ""
            ? c.dbChoiceId.trim()
            : scenarioIdForDb != null && scenarioIdForDb.trim() !== ""
              ? `${scenarioIdForDb}:action_decision:${c.id}`
              : c.dbChoiceId,
      })),
    };
  }
  return base;
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
    /** Scenario-specific only; avoids one generic DSO line for every elite row. */
    whyItMatters: typeof s.title === "string" && s.title.trim() !== "" ? s.title.trim() : "",
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
    const raw = rowEb as Record<string, EscalationBranch>;
    const eb: Record<string, EscalationBranch> = {};
    for (const key of Object.keys(raw)) {
      eb[key] = cloneEscalationBranch(raw[key]!, s.id);
    }
    escalationBranches = eb;
    difficulty_level = s.difficulty_level ?? DEFAULT_ELITE_SCENARIO_DIFFICULTY_LEVEL;
  }

  const baseScenario: Scenario = {
    scenarioId: s.id,
    dbScenarioId: s.id,
    title: s.title,
    context: body,
    choices: choicesFromPrimaryChoicesJson(s.primaryChoices, s.id),
    coachNotes: inferCoachKeys(s),
    elite_only: true,
    eliteSetup: {
      role: s.role,
      pressure: s.pressure,
      tradeoff: s.tradeoff,
    },
  };

  if (escalationBranches == null || difficulty_level == null) {
    return baseScenario;
  }

  return {
    scenarioId: baseScenario.scenarioId,
    dbScenarioId: baseScenario.dbScenarioId,
    title: baseScenario.title,
    context: baseScenario.context,
    choices: baseScenario.choices,
    coachNotes: baseScenario.coachNotes,
    elite_only: baseScenario.elite_only,
    eliteSetup: baseScenario.eliteSetup,
    escalationBranches,
    difficulty_level,
  };
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
  const id = s.id;
  const title = s.title;
  const flag_type = flagTypeFromElite(s);
  return [
    {
      locale: "en",
      id,
      title,
      body,
      choices,
      flag_type,
      scenario_type: "bty_elite",
      difficulty: 2,
      is_beginner: false,
      updated_at: now,
    },
    {
      locale: "ko",
      id,
      title,
      body,
      choices,
      flag_type,
      scenario_type: "bty_elite",
      difficulty: 2,
      is_beginner: false,
      updated_at: now,
    },
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
    for (const row of eliteToDbRows(s)) {
      rows.push(row);
    }
  }
  const { error } = await admin.from("scenarios").upsert(rows, { onConflict: "locale,id" });
  if (error) return { ok: false, insertedOrUpdated: 0, error: error.message };
  return { ok: true, insertedOrUpdated: rows.length };
}
