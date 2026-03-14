/**
 * GET /api/dojo/questions — Dojo 50문항·선택지 조회.
 * DOJO_DEAR_ME_50_DB_AND_FLOWS_IMPLEMENT_1PAGE §1. 도메인 mapDojoQuestionRow만 사용.
 *
 * @contract
 * GET /api/dojo/questions
 *   200: DojoQuestionsGetResponse
 *   500: DojoQuestionsErrorResponse
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
  return NextResponse.json(body);
}
