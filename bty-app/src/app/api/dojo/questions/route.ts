/**
 * GET /api/dojo/questions — Dojo 50문항·선택지 조회 (비인증).
 *
 * @contract
 * - **200:** `{ questions, choiceValues }` (Likert 1..5).
 * - **500:** `{ error: string }`.
 * - **캐시·버전:** `Cache-Control: public, max-age=120, stale-while-revalidate=86400`; **ETag 미제공** — 집합 변경 감지는 클라가 `questions.length`/id 범위로 휴리스틱.
 */

import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/bty/arena/supabaseServer";
import {
  mapDojoQuestionRow,
  DOJO_LIKERT_5_VALUES,
  type DojoQuestion,
} from "@/domain/dojo/questions";

export const runtime = "nodejs";

/** GET 200: questions + choiceValues (1..5). */
export type DojoQuestionsGetResponse = {
  questions: DojoQuestion[];
  choiceValues: number[];
};

/** GET 500: DB/select error. */
export type DojoQuestionsErrorResponse = {
  error: string;
};

/**
 * GET: Dojo 50문항·리커트 선택지 조회.
 * @returns 200 DojoQuestionsGetResponse | 500 DojoQuestionsErrorResponse
 */
export async function GET(): Promise<
  NextResponse<DojoQuestionsGetResponse | DojoQuestionsErrorResponse>
> {
  const supabase = await getSupabaseServerClient();
  const { data: rows, error } = await supabase
    .from("dojo_questions")
    .select("id, area, order_in_area, text_ko, text_en, scale_type")
    .order("id", { ascending: true });

  if (error) {
    return NextResponse.json(
      { error: error.message } satisfies DojoQuestionsErrorResponse,
      { status: 500 }
    );
  }

  const questions = (rows ?? []).map((r: Record<string, unknown>) =>
    mapDojoQuestionRow({
      id: r.id as number,
      area: r.area as string,
      order_in_area: r.order_in_area as number,
      text_ko: r.text_ko as string,
      text_en: r.text_en as string,
      scale_type: r.scale_type as string,
    })
  );

  const body: DojoQuestionsGetResponse = {
    questions,
    choiceValues: [...DOJO_LIKERT_5_VALUES],
  };
  const res = NextResponse.json(body);
  res.headers.set("Cache-Control", "public, max-age=120, stale-while-revalidate=86400");
  return res;
}
