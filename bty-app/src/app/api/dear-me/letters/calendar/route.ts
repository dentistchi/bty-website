/**
 * GET /api/dear-me/letters/calendar — lightweight letter dates for the calendar view.
 * Response (200): { entries: [{ id, date, hasReply }] } (body excluded).
 * Errors: 401 { error: "UNAUTHENTICATED" }; 500 { error: string }.
 */
import { NextResponse } from "next/server";
import { getLetterAuth, getLetterCalendar } from "@/lib/bty/center";

export const runtime = "nodejs";

export async function GET() {
  const auth = await getLetterAuth();
  if (!auth) {
    return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });
  }

  const result = await getLetterCalendar(auth.supabase, auth.userId);

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 500 });
  }

  return NextResponse.json({ entries: result.entries });
}
