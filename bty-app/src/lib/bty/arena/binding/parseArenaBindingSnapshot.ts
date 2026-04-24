import { parseArenaSessionRouterSnapshotFromJson } from "@/lib/bty/arena/arenaSessionRouterClient";
import type {
  ArenaBindingPatternSlice,
  ArenaBindingReExposureSlice,
  ArenaBindingRuntimeSnapshot,
  ArenaBindingScenarioSlice,
  ArenaBindingTriggerSlice,
} from "@/lib/bty/arena/arenaRuntimeSnapshot.types";

function isRecord(v: unknown): v is Record<string, unknown> {
  return v != null && typeof v === "object";
}

function scenarioSliceFrom(body: Record<string, unknown>): ArenaBindingScenarioSlice | null {
  const s = body.scenario;
  if (!isRecord(s) || s.source !== "json") return null;
  return {
    source: "json",
    json_scenario_id: typeof s.json_scenario_id === "string" ? s.json_scenario_id : null,
    db_scenario_id: typeof s.db_scenario_id === "string" ? s.db_scenario_id : null,
    title: typeof s.title === "string" ? s.title : null,
  };
}

function triggerFrom(body: Record<string, unknown>): ArenaBindingTriggerSlice | null | undefined {
  if (!("trigger" in body) || body.trigger == null) return undefined;
  const t = body.trigger;
  if (!isRecord(t)) return null;
  const type = typeof t.type === "string" ? t.type : "";
  const axis = typeof t.axis === "string" ? t.axis : "";
  if (!type || !axis) return null;
  return { type, axis };
}

function patternFrom(body: Record<string, unknown>): ArenaBindingPatternSlice | null | undefined {
  if (!("pattern" in body) || body.pattern == null) return undefined;
  const p = body.pattern;
  if (!isRecord(p)) return null;
  const axis = typeof p.axis === "string" ? p.axis : "";
  const pattern_family = typeof p.pattern_family === "string" ? p.pattern_family : "";
  const dir = p.direction === "entry" || p.direction === "exit" ? p.direction : null;
  if (!axis || !pattern_family || !dir) return null;
  return { axis, pattern_family, direction: dir };
}

function reExposureFrom(body: Record<string, unknown>): ArenaBindingReExposureSlice | null | undefined {
  if (!("re_exposure" in body) || body.re_exposure == null) return undefined;
  const r = body.re_exposure;
  if (!isRecord(r)) return null;
  const due = r.due === true;
  const scenario_id = typeof r.scenario_id === "string" ? r.scenario_id : null;
  return { due, scenario_id };
}

/** Merge session-router snapshot parse with binding-layer fields from POST `/api/arena/choice` JSON. */
export function parseArenaBindingRuntimeSnapshotFromJson(
  body: Record<string, unknown>,
): ArenaBindingRuntimeSnapshot | null {
  const base = parseArenaSessionRouterSnapshotFromJson(body);
  if (!base) return null;

  const run_id = typeof body.run_id === "string" ? body.run_id : body.run_id === null ? null : undefined;

  const scenario = scenarioSliceFrom(body);
  const trigger = triggerFrom(body);
  const pattern = patternFrom(body);
  const re_exposure = reExposureFrom(body);

  return {
    ...base,
    ...(run_id !== undefined ? { run_id } : {}),
    ...(scenario != null ? { scenario } : {}),
    ...(trigger !== undefined ? { trigger } : {}),
    ...(pattern !== undefined ? { pattern } : {}),
    ...(re_exposure !== undefined ? { re_exposure } : {}),
  };
}
