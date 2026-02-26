import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/bty/arena/supabaseServer";

export const runtime = "nodejs";

/** GET: 마지막 세션 + 메시지 (channel=chat | mentor) */
export async function GET(req: NextRequest) {
  const supabase = await getSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });

  const channel = req.nextUrl.searchParams.get("channel");
  if (channel !== "chat" && channel !== "mentor") {
    return NextResponse.json({ error: "channel must be chat or mentor" }, { status: 400 });
  }

  const { data: session, error: sessionErr } = await supabase
    .from("conversation_sessions")
    .select("id, topic, created_at")
    .eq("user_id", user.id)
    .eq("channel", channel)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (sessionErr) return NextResponse.json({ error: sessionErr.message }, { status: 500 });
  if (!session) return NextResponse.json({ sessionId: null, messages: [], createdAt: null });

  const { data: messages, error: msgErr } = await supabase
    .from("conversation_messages")
    .select("role, content, created_at")
    .eq("session_id", session.id)
    .order("created_at", { ascending: true });

  if (msgErr) return NextResponse.json({ error: msgErr.message }, { status: 500 });

  return NextResponse.json({
    sessionId: session.id,
    topic: session.topic ?? undefined,
    messages: (messages ?? []).map((m) => ({
      role: m.role,
      content: m.content,
      createdAt: m.created_at,
    })),
    createdAt: session.created_at,
  });
}

/** POST: 세션 확보 + 메시지 1개 저장 (대화 기억하기 켜져 있을 때만 호출) */
export async function POST(req: Request) {
  const supabase = await getSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });

  let body: { channel?: string; sessionId?: string; topic?: string; role?: string; content?: string } = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const { channel, sessionId, topic, role, content } = body;
  if (channel !== "chat" && channel !== "mentor") {
    return NextResponse.json({ error: "channel must be chat or mentor" }, { status: 400 });
  }
  if (!sessionId || typeof sessionId !== "string" || !role || !content) {
    return NextResponse.json({ error: "sessionId, role, content required" }, { status: 400 });
  }
  if (role !== "user" && role !== "assistant") {
    return NextResponse.json({ error: "role must be user or assistant" }, { status: 400 });
  }

  const sessionPayload = {
    id: sessionId,
    user_id: user.id,
    channel,
    topic: channel === "mentor" && topic ? topic : null,
  };
  await supabase.from("conversation_sessions").upsert(sessionPayload, { onConflict: "id" });

  const { error: insertErr } = await supabase.from("conversation_messages").insert({
    session_id: sessionId,
    user_id: user.id,
    role,
    content: String(content).slice(0, 32_000),
  });

  if (insertErr) return NextResponse.json({ error: insertErr.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

/** DELETE: 내 대화 기록 전부 삭제 (세션+메시지 cascade) */
export async function DELETE(req: NextRequest) {
  const supabase = await getSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });

  const channel = req.nextUrl.searchParams.get("channel");
  const q = supabase.from("conversation_sessions").delete().eq("user_id", user.id);
  if (channel === "chat" || channel === "mentor") q.eq("channel", channel);

  const { error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
