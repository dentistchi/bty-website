/**
 * GET /api/dear-me/letters — 로그인 사용자의 Dear Me 편지 이력 조회.
 * Response (200): { letters: array }. Errors: 401 { error: "UNAUTHENTICATED" }; 500 { error: string }.
 */
import { NextResponse } from "next/server";
import { consentRequiredResponse } from "@/lib/legal/activeConsent";
import { getConsentedLetterAuth, getLetterHistory } from "@/lib/bty/center";

export const runtime = "nodejs";

export async function GET() {
  const auth = await getConsentedLetterAuth();
  if (!auth) {
    return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });
  }
  if (!auth.consentCurrent) return consentRequiredResponse();

  const result = await getLetterHistory(auth.supabase, auth.userId);

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 500 });
  }

  return NextResponse.json({ letters: result.letters });
}
