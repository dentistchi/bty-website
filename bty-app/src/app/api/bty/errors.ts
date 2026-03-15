/**
 * GET /api/bty/healing, GET /api/bty/awakening — 공통 에러 응답 형식.
 * 401은 route-client unauthenticated(); 그 외 4xx/5xx는 이 형식 사용.
 */
import { NextResponse } from "next/server";

/** 에러 응답 본문 (401: error "UNAUTHENTICATED"; 500: error 코드 + optional detail). */
export type BtyApiErrorResponse = { error: string; detail?: string };

export function btyErrorResponse(
  status: number,
  error: string,
  detail?: string
): NextResponse<BtyApiErrorResponse> {
  const body: BtyApiErrorResponse = detail != null ? { error, detail } : { error };
  return NextResponse.json(body, { status });
}
