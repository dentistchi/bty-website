import { NextResponse } from "next/server";
import { consentRequiredResponse, isConsentCurrent } from "@/lib/legal/activeConsent";
import { getSupabaseServerClient } from "@/lib/bty/arena/supabaseServer";

export const runtime = "nodejs";

/** GET: 대화 기억 설정 (기본 false) */
export async function GET() {
  const supabase = await getSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });
  if (!(await isConsentCurrent(supabase, user.id))) return consentRequiredResponse();

  const { data, error } = await supabase
    .from("user_conversation_preferences")
    .select("remember_chat, remember_mentor, personalize_today_from_reflections, updated_at")
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({
    rememberChat: data?.remember_chat ?? false,
    rememberMentor: data?.remember_mentor ?? false,
    // Slice 3.1B-3J consent: default OFF for all existing/new users.
    personalizeTodayFromReflections: data?.personalize_today_from_reflections ?? false,
    updatedAt: data?.updated_at ?? null,
  });
}

/** PATCH: 대화 기억 설정 변경 */
export async function PATCH(req: Request) {
  const supabase = await getSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });
  if (!(await isConsentCurrent(supabase, user.id))) return consentRequiredResponse();

  let body: { rememberChat?: boolean; rememberMentor?: boolean; personalizeTodayFromReflections?: boolean } = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { data: existing } = await supabase
    .from("user_conversation_preferences")
    .select("remember_chat, remember_mentor, personalize_today_from_reflections")
    .eq("user_id", user.id)
    .maybeSingle();

  // Partial-safe: any field absent from the body keeps its existing value, so a caller updating
  // one preference never resets the consent flag (or vice versa).
  const rememberChat = typeof body.rememberChat === "boolean" ? body.rememberChat : (existing?.remember_chat ?? false);
  const rememberMentor = typeof body.rememberMentor === "boolean" ? body.rememberMentor : (existing?.remember_mentor ?? false);
  const personalizeToday =
    typeof body.personalizeTodayFromReflections === "boolean"
      ? body.personalizeTodayFromReflections
      : (existing?.personalize_today_from_reflections ?? false);

  const { error } = await supabase
    .from("user_conversation_preferences")
    .upsert(
      {
        user_id: user.id,
        remember_chat: rememberChat,
        remember_mentor: rememberMentor,
        personalize_today_from_reflections: personalizeToday,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" }
    );

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
