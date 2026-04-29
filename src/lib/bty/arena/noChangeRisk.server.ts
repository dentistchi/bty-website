import type { SupabaseClient } from "@supabase/supabase-js";

type ScenarioDecisionEventMeta = {
  userId?: string;
  incidentId?: string;
  scenarioId?: string;
  dbScenarioId?: string;
  axisGroup?: string;
  axisIndex?: number;
  primaryPatternFamily?: string;
  secondPatternFamily?: string;
  actionChoiceId?: string;
  actionDbChoiceId?: string;
  isActionCommitment?: boolean;
  timestamp?: string;
};

export type NoChangeRiskAccrualResult = {
  reExposureDueCandidate: boolean;
  interventionSensitivityCandidate: boolean;
  riskCount: number;
};

export function normalizeScenarioDecisionEventUser(
  input: unknown,
  authenticatedUserId: string,
): ScenarioDecisionEventMeta | null {
  if (input == null || typeof input !== "object" || Array.isArray(input)) return null;
  const event = input as Record<string, unknown>;
  return {
    ...(event as ScenarioDecisionEventMeta),
    userId: authenticatedUserId,
  };
}

function requiredString(value: unknown): string | null {
  return typeof value === "string" && value.trim() !== "" ? value.trim() : null;
}

export async function accrueNoChangeRisk(
  supabase: SupabaseClient,
  event: ScenarioDecisionEventMeta,
): Promise<NoChangeRiskAccrualResult> {
  const userId = requiredString(event.userId);
  const incidentId = requiredString(event.incidentId);
  const scenarioId = requiredString(event.scenarioId);
  const dbScenarioId = requiredString(event.dbScenarioId);
  const axisGroup = requiredString(event.axisGroup);
  const axisIndex = typeof event.axisIndex === "number" ? event.axisIndex : null;
  const patternFamily = requiredString(event.secondPatternFamily) ?? requiredString(event.primaryPatternFamily);
  const actionChoiceId = requiredString(event.actionChoiceId);
  const actionDbChoiceId = requiredString(event.actionDbChoiceId);

  if (!userId || !incidentId || !scenarioId || !dbScenarioId || !axisGroup || axisIndex == null) {
    throw new Error("invalid_no_change_risk_event");
  }
  if (!patternFamily || !actionChoiceId || !actionDbChoiceId) {
    throw new Error("invalid_no_change_risk_event");
  }

  const nowIso = new Date().toISOString();
  const { data: existingRow, error: existingErr } = await supabase
    .from("arena_no_change_risks")
    .select("id,risk_count")
    .eq("user_id", userId)
    .eq("incident_id", incidentId)
    .eq("axis_group", axisGroup)
    .eq("axis_index", axisIndex)
    .eq("pattern_family", patternFamily)
    .eq("action_choice_id", actionChoiceId)
    .eq("action_db_choice_id", actionDbChoiceId)
    .maybeSingle();

  if (existingErr) throw new Error(existingErr.message);

  let riskCount = 1;
  if (existingRow && typeof (existingRow as { id?: unknown }).id === "string") {
    const prev = Number((existingRow as { risk_count?: unknown }).risk_count ?? 0);
    riskCount = Number.isFinite(prev) ? prev + 1 : 1;
    const { error: updateErr } = await supabase
      .from("arena_no_change_risks")
      .update({
        risk_count: riskCount,
        scenario_id: scenarioId,
        db_scenario_id: dbScenarioId,
        updated_at: nowIso,
      })
      .eq("id", (existingRow as { id: string }).id);
    if (updateErr) throw new Error(updateErr.message);
  } else {
    const { error: insertErr } = await supabase.from("arena_no_change_risks").insert({
      user_id: userId,
      incident_id: incidentId,
      scenario_id: scenarioId,
      db_scenario_id: dbScenarioId,
      axis_group: axisGroup,
      axis_index: axisIndex,
      pattern_family: patternFamily,
      action_choice_id: actionChoiceId,
      action_db_choice_id: actionDbChoiceId,
      risk_count: 1,
      created_at: nowIso,
      updated_at: nowIso,
    });
    if (insertErr) throw new Error(insertErr.message);
  }

  const { data: axisRows, error: axisErr } = await supabase
    .from("arena_no_change_risks")
    .select("risk_count")
    .eq("user_id", userId)
    .eq("incident_id", incidentId)
    .eq("axis_group", axisGroup);
  if (axisErr) throw new Error(axisErr.message);

  const axisTotal = (axisRows ?? []).reduce((sum, row) => sum + Number((row as { risk_count?: unknown }).risk_count ?? 0), 0);
  const reExposureDueCandidate = axisTotal >= 2 || riskCount >= 2;

  return {
    reExposureDueCandidate,
    interventionSensitivityCandidate: reExposureDueCandidate,
    riskCount,
  };
}
