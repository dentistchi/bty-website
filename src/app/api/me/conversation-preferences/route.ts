import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/bty/arena/supabaseServer";

export const runtime = "nodejs";

/** GET: 대화 기억 설정 (기본 false) */
export async function GET() {
  const supabase = await getSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });

  const { data, error } = await supabase
    .from("user_conversation_preferences")
    .select("remember_chat, remember_mentor, updated_at")
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({
    rememberChat: data?.remember_chat ?? false,
    rememberMentor: data?.remember_mentor ?? false,
    updatedAt: data?.updated_at ?? null,
  });
}

/** PATCH: 대화 기억 설정 변경 */
export async function PATCH(req: Request) {
  const supabase = await getSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });

  let body: { rememberChat?: boolean; rememberMentor?: boolean } = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { data: existing } = await supabase
    .from("user_conversation_preferences")
    .select("remember_chat, remember_mentor")
    .eq("user_id", user.id)
    .maybeSingle();

  const rememberChat = typeof body.rememberChat === "boolean" ? body.rememberChat : (existing?.remember_chat ?? false);
  const rememberMentor = typeof body.rememberMentor === "boolean" ? body.rememberMentor : (existing?.remember_mentor ?? false);

  const { error } = await supabase
    .from("user_conversation_preferences")
    .upsert(
      {
        user_id: user.id,
        remember_chat: rememberChat,
        remember_mentor: rememberMentor,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" }
    );

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
