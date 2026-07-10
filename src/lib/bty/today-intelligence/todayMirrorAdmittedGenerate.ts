/**
 * BTY Today AI Mirror — ADMITTED generation orchestration (provider hard gate).
 *
 * This is the ONLY sanctioned entry point for generating a Today Mirror from real evidence. It
 * enforces the generation-admission policy BEFORE any provider contact: when the evidence is
 * ineligible it returns a fail-quiet admission status and never constructs a client, builds provider
 * messages, or calls generateTodayMirror — so the provider call count for ineligible evidence is
 * exactly zero. Deterministic fallback copy (the diagnostic lens) stays separate from AI generation.
 *
 * generateTodayMirror remains the low-level voice generator (tested directly with mock clients). Any
 * real-data orchestration must go through THIS function, not generateTodayMirror directly.
 */
import { selectMirrorLens } from "@/domain/daily/todayMirrorLens";
import {
  admitTodayMirrorGeneration,
  type TodayMirrorGenerationAdmission,
} from "@/domain/daily/todayMirrorAdmission";
import {
  generateTodayMirror,
  type MirrorGenerateOptions,
  type MirrorGenerateResult,
} from "@/lib/bty/today-intelligence/todayMirrorGenerate";

export type AdmittedGenerateResult =
  | { admitted: true; generation: MirrorGenerateResult }
  | { admitted: false; admission: Extract<TodayMirrorGenerationAdmission, { eligible: false }> };

export type AdmittedGenerateOptions = MirrorGenerateOptions & {
  /** Set by the value-safe layer when a raw/prohibited field is detected → forces ineligible. */
  prohibitedFieldsPresent?: boolean;
};

/**
 * Admit-then-generate. Returns `{ admitted: false, admission }` without any provider contact when
 * the evidence does not qualify; otherwise delegates to the unchanged voice+validator generator.
 */
export async function admitAndGenerateTodayMirror(
  opts: AdmittedGenerateOptions,
): Promise<AdmittedGenerateResult> {
  const analysis = selectMirrorLens(opts.packet);
  const admission = admitTodayMirrorGeneration(opts.packet, analysis, {
    prohibitedFieldsPresent: opts.prohibitedFieldsPresent,
  });

  if (!admission.eligible) {
    // Hard gate: no client construction, no messages, no generateTodayMirror call.
    return { admitted: false, admission };
  }

  const { prohibitedFieldsPresent: _ignored, ...generateOpts } = opts;
  return { admitted: true, generation: await generateTodayMirror(generateOpts) };
}
