/**
 * Healing phase diagnostic gates — `PHASE_GATE_MAP` vs `center_diagnostics` rows.
 * Aligns with {@link phaseCompletionCriteriaMet} cumulative requirements per phase.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseServerClient } from "@/lib/bty/arena/supabaseServer";
import type { HealingJourneyPhaseId } from "@/domain/center/healingPhase";
import {
  HEALING_PHASE_ORDER,
  type HealingPhase,
} from "@/engine/healing/healing-phase.service";

/** Stored in `center_diagnostics.diagnostic_type` — must match insert sites. */
export type DiagnosticType =
  | "ASSESSMENT_SUBMISSION"
  | "DEAR_ME_LETTER"
  | "AWAKENING_ACT_1"
  | "AWAKENING_ACT_2"
  | "AWAKENING_ACT_3";

/**
 * Required diagnostics to **exit** each engine phase (cumulative checklist).
 * Mirrors {@link phaseCompletionCriteriaMet} in domain/center/healingPhase.
 */
export const PHASE_GATE_MAP: Record<HealingPhase, DiagnosticType[]> = {
  ACKNOWLEDGEMENT: ["ASSESSMENT_SUBMISSION"],
  REFLECTION: ["ASSESSMENT_SUBMISSION", "DEAR_ME_LETTER"],
  REINTEGRATION: [
    "ASSESSMENT_SUBMISSION",
    "DEAR_ME_LETTER",
    "AWAKENING_ACT_1",
  ],
  RENEWAL: [
    "ASSESSMENT_SUBMISSION",
    "DEAR_ME_LETTER",
    "AWAKENING_ACT_1",
    "AWAKENING_ACT_2",
    "AWAKENING_ACT_3",
  ],
};

const KO_PROMPTS: Record<DiagnosticType, string> = {
  ASSESSMENT_SUBMISSION: "리더십 평가(진단)를 제출하세요.",
  DEAR_ME_LETTER: "Dear Me 편지를 작성해 주세요.",
  AWAKENING_ACT_1: "어웨이크닝 액트 1(Reflection Chamber)을 완료하세요.",
  AWAKENING_ACT_2: "어웨이크닝 액트 2(Transition)를 완료하세요.",
  AWAKENING_ACT_3: "어웨이크닝 액트 3(Awakening)을 완료하세요.",
};

export type PhaseGateStatus = {
  phase: HealingPhase;
  required: number;
  completed: number;
  /** 0–1 */
  completion_pct: number;
  missing: DiagnosticType[];
};

/** Journey stepper ids 1–4 ↔ engine {@link HealingPhase} strings. */
export function healingJourneyPhaseIdToEnginePhase(
  id: HealingJourneyPhaseId,
): HealingPhase {
  const map: Record<HealingJourneyPhaseId, HealingPhase> = {
    1: "ACKNOWLEDGEMENT",
    2: "REFLECTION",
    3: "REINTEGRATION",
    4: "RENEWAL",
  };
  return map[id];
}

export function enginePhaseToHealingJourneyPhaseId(
  phase: HealingPhase,
): HealingJourneyPhaseId {
  const idx = HEALING_PHASE_ORDER.indexOf(phase);
  return (idx + 1) as HealingJourneyPhaseId;
}

/** Korean CTA / 리포트용 — 순서는 {@link PHASE_GATE_MAP}[phase]와 동일. */
export function getPhaseDiagnosticPrompts(phase: HealingPhase): string[] {
  return PHASE_GATE_MAP[phase].map((d) => KO_PROMPTS[d]);
}

/**
 * Reads `center_diagnostics` for `user_id` + `phase`, compares to {@link PHASE_GATE_MAP}.
 */
export async function getPhaseGateStatus(
  userId: string,
  phase: HealingPhase,
  supabase?: SupabaseClient,
): Promise<PhaseGateStatus> {
  const client = supabase ?? (await getSupabaseServerClient());
  const requiredList = PHASE_GATE_MAP[phase];
  const required = requiredList.length;

  const { data: rows, error } = await client
    .from("center_diagnostics")
    .select("diagnostic_type")
    .eq("user_id", userId)
    .eq("phase", phase);

  if (error) {
    throw new Error(error.message);
  }

  const done = new Set(
    (rows ?? []).map((r) => (r as { diagnostic_type: string }).diagnostic_type),
  );
  const missing = requiredList.filter((d) => !done.has(d));
  const completed = required - missing.length;
  const completion_pct = required === 0 ? 1 : completed / required;

  return {
    phase,
    required,
    completed,
    completion_pct,
    missing,
  };
}
