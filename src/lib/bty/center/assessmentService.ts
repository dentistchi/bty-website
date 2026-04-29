/**
 * Center assessment service — DB interaction layer.
 * Calls domain validation + scoring, then Supabase. API routes delegate here.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  validateAssessmentAnswers,
  type AssessmentHistory,
} from "@/domain/center/assessment";
import {
  scoreAnswers,
  detectPattern,
  type Question,
  type Scores,
} from "@/lib/assessment/score";

const EXPECTED_COUNT = 50;

export type SubmitAssessmentInput = {
  userId: string;
  answers: Record<string | number, number>;
  questions: { id: number; dimension: string; text: string; reverse: boolean }[];
};

export type SubmitAssessmentResult =
  | { ok: true; submissionId: string | null; scores: Scores; pattern: string; track: string }
  | { ok: false; error: string; detail?: string };

/**
 * Submit assessment: normalise answers → validate → score → detect pattern → INSERT.
 */
export async function submitAssessment(
  supabase: SupabaseClient,
  input: SubmitAssessmentInput
): Promise<SubmitAssessmentResult> {
  const answersById: Record<number, number> = {};
  for (let q = 1; q <= EXPECTED_COUNT; q++) {
    const v = input.answers[String(q)] ?? input.answers[q];
    if (typeof v === "number" && v >= 1 && v <= 5) {
      answersById[q] = v;
    }
  }

  const validation = validateAssessmentAnswers(answersById, EXPECTED_COUNT);
  if (!validation.ok) {
    return { ok: false, error: validation.error ?? "answers_invalid" };
  }

  const mapped: Question[] = input.questions.map((q) => ({
    id: q.id,
    dimension: q.dimension as "core" | "compassion" | "stability" | "growth" | "social",
    text: q.text,
    reverse: q.reverse,
  }));

  let scores: Scores;
  try {
    scores = scoreAnswers(mapped, answersById);
  } catch (e) {
    return { ok: false, error: "scoring_failed", detail: String(e) };
  }

  const { pattern, track } = detectPattern(scores);

  const { data: inserted, error: insertError } = await supabase
    .from("assessment_submissions")
    .insert({
      user_id: input.userId,
      answers_json: answersById,
      scores_json: scores,
      pattern_key: pattern,
      recommended_track: track,
    })
    .select("id")
    .single();

  if (insertError) {
    console.error("[assessmentService.submitAssessment] insert error:", insertError.message);
  }

  return { ok: true, submissionId: inserted?.id ?? null, scores, pattern, track };
}

/**
 * Fetch assessment submission history for a user, newest first.
 */
export async function getAssessmentHistory(
  supabase: SupabaseClient,
  userId: string,
  limit = 20
): Promise<{ ok: true; submissions: AssessmentHistory[] } | { ok: false; error: string }> {
  const { data, error } = await supabase
    .from("assessment_submissions")
    .select("id, scores_json, pattern_key, recommended_track, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    return { ok: false, error: error.message };
  }

  const submissions: AssessmentHistory[] = (data ?? []).map(
    (r: { id: string; scores_json: Record<string, number>; pattern_key: string; recommended_track: string; created_at: string }) => ({
      id: r.id,
      scores: r.scores_json,
      pattern: r.pattern_key,
      track: r.recommended_track,
      createdAt: r.created_at,
    })
  );

  return { ok: true, submissions };
}
