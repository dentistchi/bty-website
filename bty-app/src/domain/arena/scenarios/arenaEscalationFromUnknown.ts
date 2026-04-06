import type { EscalationBranch, SecondChoice } from "./types";

type EscalationParseCtx = { scenarioId: string; branchKey: string };

function secondChoiceFromUnknown(
  value: unknown,
  ctx: EscalationParseCtx,
  index: number,
): SecondChoice | null {
  if (value == null || typeof value !== "object" || Array.isArray(value)) return null;
  const o = value as Record<string, unknown>;
  const id = typeof o.id === "string" ? o.id.trim() : "";
  const label = typeof o.label === "string" ? o.label.trim() : "";
  const costRaw = o.cost;
  const cost = typeof costRaw === "string" ? costRaw.trim() : "";
  if (costRaw === undefined || cost === "") {
    console.error("[arenaScenario] escalation second_choice: cost required (absent or empty)", {
      scenarioId: ctx.scenarioId,
      branchKey: ctx.branchKey,
      secondChoiceIndex: index,
    });
    return null;
  }
  if (!id || !label) return null;
  const directionRaw = typeof o.direction === "string" ? o.direction.trim() : "";
  const direction = directionRaw === "entry" || directionRaw === "exit" ? directionRaw : null;
  if (!direction) return null;
  const pattern_family =
    typeof o.pattern_family === "string" && o.pattern_family.trim() !== ""
      ? o.pattern_family.trim()
      : undefined;
  return { id, label, cost, direction, ...(pattern_family !== undefined ? { pattern_family } : {}) };
}

function escalationBranchFromUnknown(value: unknown, ctx: EscalationParseCtx): EscalationBranch | null {
  if (value == null || typeof value !== "object" || Array.isArray(value)) return null;
  const o = value as Record<string, unknown>;
  const escalation_text =
    typeof o.escalation_text === "string" ? o.escalation_text.trim() : "";
  if (!escalation_text) return null;
  const pi = o.pressure_increase;
  if (typeof pi !== "number" || !Number.isFinite(pi) || pi < 0 || pi > 1) return null;
  if (!Array.isArray(o.second_choices)) return null;
  const second_choices: SecondChoice[] = [];
  for (let i = 0; i < o.second_choices.length; i++) {
    const item = o.second_choices[i];
    const sc = secondChoiceFromUnknown(item, ctx, i);
    if (sc === null) return null;
    second_choices.push(sc);
  }
  if (second_choices.length === 0) return null;
  return { escalation_text, pressure_increase: pi, second_choices };
}

/**
 * Parses `escalationBranches` object; keys are primary choice ids (must be in `allowedPrimaryIds` when set).
 */
export function arenaEscalationBranchesFromUnknown(
  raw: unknown,
  allowedPrimaryIds: readonly string[],
  scenarioId: string,
): Record<string, EscalationBranch> | null {
  if (raw == null || typeof raw !== "object" || Array.isArray(raw)) return null;
  const o = raw as Record<string, unknown>;
  const allowed = new Set(allowedPrimaryIds);
  const out: Record<string, EscalationBranch> = {};
  for (const key of Object.keys(o)) {
    const branch = escalationBranchFromUnknown(o[key], { scenarioId, branchKey: key });
    if (branch === null) return null;
    if (allowed.size > 0 && !allowed.has(key)) return null;
    out[key] = branch;
  }
  return out;
}
