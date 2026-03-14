/**
 * Dojo 50문항 제출 서비스: validate → compute → insert.
 * 도메인: @/domain/dojo/flow (validateDojo50Submit, computeDojo50Result).
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  validateDojo50Submit,
  computeDojo50Result,
  type Dojo50Answers,
  type Dojo50AreaId,
} from "@/domain/dojo/flow";

export type Dojo50SubmitSuccess = {
  ok: true;
  submissionId: string | null;
  scores: Record<Dojo50AreaId, number>;
  summaryKey: string;
};

export type Dojo50SubmitError = {
  ok: false;
  error: string;
};

export type Dojo50SubmitResult = Dojo50SubmitSuccess | Dojo50SubmitError;

/** Single row from GET /api/dojo/submissions (dojo_submissions select). */
export type DojoSubmissionRow = {
  id: string;
  scores_json: Record<string, number> | null;
  summary_key: string;
  created_at: string;
};

/** Success response for GET /api/dojo/submissions. */
export type DojoSubmissionsResponse = {
  submissions: DojoSubmissionRow[];
};

/** Error response for GET /api/dojo/submissions (401/500). */
export type DojoSubmissionsErrorResponse = {
  error: string;
};

/**
 * Validate answers, compute area scores/summaryKey, insert into dojo_submissions.
 * Returns result with submissionId (null if insert failed), or validation error.
 */
export async function submitDojo50(
  supabase: SupabaseClient,
  userId: string,
  answers: Dojo50Answers,
): Promise<Dojo50SubmitResult> {
  const validation = validateDojo50Submit(answers);
  if (!validation.ok) {
    return { ok: false, error: validation.error ?? "validation_failed" };
  }

  const result = computeDojo50Result(answers);

  const { data: inserted, error: insertError } = await supabase
    .from("dojo_submissions")
    .insert({
      user_id: userId,
      answers_json: answers,
      scores_json: result.scores,
      summary_key: result.summaryKey,
    })
    .select("id")
    .single();

  if (insertError) {
    console.error("[dojoSubmitService] insert error:", insertError.message);
  }

  return {
    ok: true,
    submissionId: inserted?.id ?? null,
    scores: result.scores,
    summaryKey: result.summaryKey,
  };
}
