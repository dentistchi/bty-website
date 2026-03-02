/**
 * POST /api/center/letter — Center "나에게 쓰는 편지" 저장 + 답장 생성.
 * FOUNDRY_CENTER_NEXT_CONTENT §2-3. 인증 필수, 비공개 저장.
 */
import { fetchJson } from "@/lib/read-json";
import { NextResponse } from "next/server";
import { buildChatMessagesForModel, getFallbackMessage } from "@/lib/bty/chat";
import { getSupabaseServerClient } from "@/lib/bty/arena/supabaseServer";
import { logApiError } from "@/lib/log-api-error";

export async function POST(request: Request) {
  try {
    const supabase = await getSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = (await request.json()) as {
      body?: string;
      mood?: string;
      energy?: number;
      oneWord?: string;
      lang?: string;
    };
    const letterBody = typeof body.body === "string" ? body.body.trim() : "";
    if (!letterBody) {
      return NextResponse.json({ error: "Letter body required" }, { status: 400 });
    }
    const lang = body.lang === "en" ? "en" : "ko";
    const locale = lang;
    const mood = typeof body.mood === "string" ? body.mood.slice(0, 200) : null;
    const energy =
      typeof body.energy === "number" && body.energy >= 1 && body.energy <= 5 ? body.energy : null;
    const oneWord = typeof body.oneWord === "string" ? body.oneWord.slice(0, 100) : null;

    let reply: string = getFallbackMessage("center", lang);
    const apiKey = process.env.OPENAI_API_KEY;
    if (apiKey) {
      const messagesForModel = buildChatMessagesForModel(
        [{ role: "user", content: letterBody }],
        "center",
        lang
      );
      type OpenAIChatResp = { choices?: { message?: { content?: string } }[] };
      const r = await fetchJson<OpenAIChatResp>("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          messages: messagesForModel,
          max_tokens: 200,
        }),
      });
      if (r.ok) {
        const raw = r.json?.choices?.[0]?.message?.content?.trim();
        if (raw) reply = raw;
      }
    }

    const { error } = await supabase.from("center_letters").insert({
      user_id: user.id,
      locale,
      mood,
      energy,
      one_word: oneWord,
      body: letterBody,
      reply,
    });
    if (error) {
      console.error("[center/letter] insert failed", error);
      return NextResponse.json({ error: "Failed to save letter" }, { status: 500 });
    }

    return NextResponse.json({ saved: true, reply });
  } catch (e) {
    logApiError("center/letter", 500, e);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}
