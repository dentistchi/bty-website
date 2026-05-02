/**
 * POST /api/assessment/submit — Center 자존감 진단 50문항 제출·점수·패턴·진로(path) 저장.
 * Response 200: { submissionId, scores, pattern, recommendedTrack } — recommendedTrack = Center 추천 트랙 키(e.g. default, compassion_path, growth_path).
 * Errors: 401 { error: "UNAUTHENTICATED" 등 }, 400 { error }, 500 { error, detail? }. See AssessmentSubmitErrorResponse.
 */
import { NextResponse } from "next/server";
import { getLetterAuth, submitAssessment } from "@/lib/bty/center";
import { logApiError } from "@/lib/log-api-error";
import questionsKo from "@/content/assessment/questions.ko.json";
import questionsEn from "@/content/assessment/questions.en.json";

export const runtime = "nodejs";

type AssessmentQuestionJson = { id: number; dimension: string; text: string; reverse: boolean };

/** POST 200: 제출 결과 (submissionId는 insert 실패 시 null) */
export type AssessmentSubmitPostResponse = {
  submissionId: string | null;
  scores: Record<string, number>;
  pattern: string;
  recommendedTrack: string;
};

/** POST 400/401/500: 에러 본문 */
export type AssessmentSubmitErrorResponse = {
  error: string;
  detail?: string;
};

/**
 * POST: Assessment 50문항 제출 → 검증·채점·패턴·저장.
 * @returns 200 AssessmentSubmitPostResponse | 400 | 401 | 500 AssessmentSubmitErrorResponse
 */
export async function POST(request: Request): Promise<
  NextResponse<AssessmentSubmitPostResponse | AssessmentSubmitErrorResponse>
> {
  try {
    const auth = await getLetterAuth();
    if (!auth) {
      return NextResponse.json(
        { error: "UNAUTHENTICATED" } satisfies AssessmentSubmitErrorResponse,
        { status: 401 }
      );
    }

    let body: { answers?: Record<string, number>; locale?: string };
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: "invalid_body" } satisfies AssessmentSubmitErrorResponse,
        { status: 400 }
      );
    }

    const lang = body.locale === "ko" ? "ko" : "en";
    const questions = (lang === "ko" ? questionsKo : questionsEn) as AssessmentQuestionJson[];

    const result = await submitAssessment(auth.supabase, {
      userId: auth.userId,
      answers: body.answers ?? {},
      questions,
    });

    if (!result.ok) {
      return NextResponse.json(
        {
          error: result.error,
          ...(result.detail ? { detail: result.detail } : {}),
        } satisfies AssessmentSubmitErrorResponse,
        { status: 400 }
      );
    }

    const postBody: AssessmentSubmitPostResponse = {
      submissionId: result.submissionId,
      scores: result.scores,
      pattern: result.pattern,
      recommendedTrack: result.track,
    };
    return NextResponse.json(postBody);
  } catch (e) {
    logApiError("assessment/submit", 500, e);
    return NextResponse.json(
      { error: "Something went wrong" } satisfies AssessmentSubmitErrorResponse,
      { status: 500 }
    );
  }
}
