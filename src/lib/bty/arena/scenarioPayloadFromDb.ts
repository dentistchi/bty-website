/**
 * Arena runtime scenario payload from canonical `src/data/scenario` registry only.
 * `reader` is accepted for API compatibility and ignored for payload resolution.
 */

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { EscalationBranch, SecondChoice } from "@/domain/arena/scenarios/types";
import type { Scenario } from "@/lib/bty/scenario/types";
import { getScenarioById } from "@/data/scenario";

type RawEscalationBranch = EscalationBranch & {
  stage_2_escalation?: Record<string, { outcome?: string; risk?: string }>;
};

/**
 * Deep-clones escalation branches and inlines `stage_2_escalation` X/Y lines into
 * `second_choices[].protects` / `risks` for Arena tradeoff cards (then drops `stage_2_escalation`).
 */
function mergeStage2EscalationIntoSecondChoices(
  raw: Record<string, RawEscalationBranch> | undefined,
): Scenario["escalationBranches"] {
  if (!raw || typeof raw !== "object") return undefined;
  const cloned = JSON.parse(JSON.stringify(raw)) as Record<string, RawEscalationBranch>;
  for (const key of Object.keys(cloned)) {
    const br = cloned[key];
    const s2 = br.stage_2_escalation;
    const nextSecond: SecondChoice[] | undefined = Array.isArray(br.second_choices)
      ? br.second_choices.map((sc) => {
          const row = s2?.[String(sc.id)];
          const outcome = row?.outcome;
          const risk = row?.risk;
          return {
            ...sc,
            protects: typeof outcome === "string" && outcome.trim() !== "" ? outcome.trim() : undefined,
            risks: typeof risk === "string" && risk.trim() !== "" ? risk.trim() : undefined,
          };
        })
      : br.second_choices;
    const { stage_2_escalation: _drop, ...rest } = br;
    cloned[key] = { ...rest, second_choices: nextSecond ?? br.second_choices };
  }
  return cloned as Scenario["escalationBranches"];
}

/** Prefer service role; else anon — RLS allows select on `public.scenarios` for non-Arena readers. */
export function getSupabaseScenarioReader(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  if (!url) return null;
  const key = serviceKey || anonKey;
  if (!key) return null;
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

/** Legacy JSON-in-`body` beginner flow — must not be served to Arena runtime. */
export function isLegacyScenarioDbBody(body: string): boolean {
  const t = body.trim();
  if (!t.startsWith("{")) return false;
  return (
    t.includes("beginner_7step") ||
    t.includes('"emotionOptions"') ||
    t.includes('"hiddenRiskQuestion"') ||
    t.includes('"integrityTrigger"') ||
    t.includes('"decisionOptions"')
  );
}

/** Reject mapped payloads that still contain legacy markers (defense in depth). */
export function rejectLegacyScenarioPayload(s: Scenario): boolean {
  const blob = JSON.stringify(s).toLowerCase();
  const markers = [
    "beginner_7step",
    "emotionoptions",
    "hiddenriskquestion",
    "integritytrigger",
    "decisionoptions",
  ];
  return markers.some((m) => blob.includes(m));
}

export async function loadArenaScenarioPayloadFromDb(
  _reader: SupabaseClient | null,
  scenarioId: string,
  locale: "en" | "ko",
): Promise<Scenario | null> {
  void _reader;
  const runtime = getScenarioById(scenarioId, locale);
  if (!runtime) {
    return null;
  }

  const content = runtime.content;
  const scenario: Scenario = {
    scenarioId,
    dbScenarioId: runtime.dbScenarioId,
    source: "json",
    title: content.title,
    context: content.pressure,
    choices: content.choices.map((c) => ({
      choiceId: c.id,
      dbChoiceId: typeof c.dbChoiceId === "string" ? c.dbChoiceId : undefined,
      label: c.label,
      intent: typeof c.intent === "string" ? c.intent : "unknown",
      xpBase: typeof c.xpBase === "number" ? c.xpBase : 0,
      difficulty: typeof c.difficulty === "number" ? c.difficulty : 1,
      hiddenDelta: c.hiddenDelta ?? {},
      result: typeof c.result === "string" ? c.result : "",
      microInsight: typeof c.microInsight === "string" ? c.microInsight : "",
      followUp:
        c.followUp != null &&
        typeof c.followUp === "object" &&
        typeof (c.followUp as { enabled?: unknown }).enabled === "boolean"
          ? (c.followUp as {
              enabled: boolean;
              prompt?: string;
              promptKo?: string;
              options?: string[];
              optionsKo?: string[];
            })
          : undefined,
    })),
    elite_only: true,
    eliteSetup: {
      role: content.role,
      pressure: content.pressure,
      tradeoff: content.tradeoff,
    },
    escalationBranches: mergeStage2EscalationIntoSecondChoices(
      content.escalationBranches as Record<string, RawEscalationBranch> | undefined,
    ),
    difficulty_level:
      content.difficulty_level === 1 ||
      content.difficulty_level === 2 ||
      content.difficulty_level === 3 ||
      content.difficulty_level === 4 ||
      content.difficulty_level === 5
        ? content.difficulty_level
        : undefined,
  };
  if (rejectLegacyScenarioPayload(scenario)) {
    console.error("[arena] legacy_scenario_payload_blocked", {
      scenarioId,
      legacyFallback: "blocked",
      reason: "markers_in_mapped_scenario",
    });
    return null;
  }
  return scenario;
}
