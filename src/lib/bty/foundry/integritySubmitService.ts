/**
 * Integrity(역지사지) 제출 서비스: validate → insert.
 * 도메인: @/domain/dojo/integrity (validateIntegrityResponse).
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  validateIntegrityResponse,
  type IntegritySubmitPayload,
} from "@/domain/dojo/integrity";

export type IntegritySubmitSuccess = {
  ok: true;
  submissionId: string | null;
};

export type IntegritySubmitError = {
  ok: false;
  error: string;
};

export type IntegritySubmitResult = IntegritySubmitSuccess | IntegritySubmitError;

export type SubmitIntegrityOptions = {
  scenarioId?: string | null;
};

/**
 * Validate payload (text/choiceId, length), insert into integrity_submissions.
 * Returns submissionId or validation/insert error.
 */
export async function submitIntegrity(
  supabase: SupabaseClient,
  userId: string,
  payload: IntegritySubmitPayload,
  options: SubmitIntegrityOptions = {},
): Promise<IntegritySubmitResult> {
  const validation = validateIntegrityResponse(payload.text, payload.choiceId);
  if (!validation.ok) {
    return { ok: false, error: validation.error ?? "validation_failed" };
  }

  const { data: inserted, error: insertError } = await supabase
    .from("integrity_submissions")
    .insert({
      user_id: userId,
      scenario_id: options.scenarioId ?? null,
      text_response: payload.text?.trim() ?? null,
      choice_id: payload.choiceId ?? null,
    })
    .select("id")
    .single();

  if (insertError) {
    console.error("[integritySubmitService] insert error:", insertError.message);
  }

  return {
    ok: true,
    submissionId: inserted?.id ?? null,
  };
}
