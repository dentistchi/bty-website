/**
 * GET /api/assessment/submissions — Center Assessment 제출 이력 (진로 path = track 필드).
 * Response (200): { submissions: { id, scores, pattern, track, createdAt }[] }. track = 저장된 recommendedTrack.
 * Errors: 401 { error: "UNAUTHENTICATED" }; 500 { error: string }.
 */
import { NextResponse } from "next/server";
import { getLetterAuth, getAssessmentHistory } from "@/lib/bty/center";
import { logApiError } from "@/lib/log-api-error";

export const runtime = "nodejs";

/** GET 200: 제출 이력 목록 */
export type AssessmentSubmissionsGetResponse = {
  submissions: Array<{
    id: string;
    scores: Record<string, number>;
    pattern: string;
    track: string;
    createdAt: string;
  }>;
};

/** GET 401/500: 에러 본문 */
export type AssessmentSubmissionsErrorResponse = { error: string };

/**
 * GET: Assessment 제출 이력 (최신순).
 * @returns 200 AssessmentSubmissionsGetResponse | 401 | 500 AssessmentSubmissionsErrorResponse
 */
export async function GET(): Promise<
  NextResponse<AssessmentSubmissionsGetResponse | AssessmentSubmissionsErrorResponse>
> {
  try {
    const auth = await getLetterAuth();
    if (!auth) {
      return NextResponse.json(
        { error: "UNAUTHENTICATED" } satisfies AssessmentSubmissionsErrorResponse,
        { status: 401 }
      );
    }

    const result = await getAssessmentHistory(auth.supabase, auth.userId);

    if (!result.ok) {
      return NextResponse.json(
        { error: result.error } satisfies AssessmentSubmissionsErrorResponse,
        { status: 500 }
      );
    }

    const body: AssessmentSubmissionsGetResponse = { submissions: result.submissions };
    return NextResponse.json(body);
  } catch (e) {
    logApiError("assessment/submissions", 500, e);
    return NextResponse.json(
      { error: "Something went wrong" } satisfies AssessmentSubmissionsErrorResponse,
      { status: 500 }
    );
  }
}
