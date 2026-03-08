/**
 * POST /api/dear-me/letter — Dear Me 편지 제출·답장 반환.
 * DEAR_ME_LETTER_API_1PAGE. body: { letterText: string, lang?: "ko"|"en", useLlm?: boolean }.
 * 200: { replyMessage: string }. 400: missing_text | text_too_long. 401: Unauthorized.
 * 답장: useLlm && OPENAI_API_KEY 있으면 LLM 1~3문장, 그 외 템플릿(격려 1~2문장).
 */
import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/bty/arena/supabaseServer";
import { fetchJson } from "@/lib/read-json";

export const runtime = "nodejs";

const MAX_LETTER_LENGTH = 2000;

/** Dr. Chi/Dear Me 톤: 자존감·비판 없음·따뜻한 격려. (DEAR_ME_LETTER_API_1PAGE §3 A) */
function getDearMeReplyTemplate(lang: "ko" | "en"): string {
  if (lang === "en") {
    return "Thank you for writing. Your feelings are valid, and it takes courage to put them into words. Be gentle with yourself today.";
  }
  return "편지 써줘서 고마워요. 지금 느끼는 것도 충분히 의미 있어요. 오늘은 조금만 더 자신에게 다정해져 보세요.";
}

function inferLang(text: string): "ko" | "en" {
  return /[\uac00-\ud7a3]/.test(text) ? "ko" : "en";
}

/** LLM 답장: Dear Me 전용 시스템 프롬프트 + 편지 본문. 1~3문장, 동일 톤. */
async function getDearMeReplyLlm(letterText: string, lang: "ko" | "en"): Promise<string | null> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;

  const systemPrompt =
    lang === "en"
      ? "You are Dr. Chi in 'Dear Me' mode. The user wrote a short letter to themselves. Reply in 1 to 3 short sentences only. Tone: warm, no blame, validate feelings, gentle encouragement. Do not give advice or solutions. Respond only in English."
      : "당신은 Dear Me 모드의 Dr. Chi입니다. 사용자가 나에게 쓰는 짧은 편지를 보냈습니다. 1~3문장으로만 답하세요. 톤: 따뜻하고, 비판 없이, 감정을 인정하고, 다정한 격려. 조언이나 해결책을 주지 마세요. 반드시 한국어로만 답하세요.";

  type OpenAIChatResp = { choices?: { message?: { content?: string } }[] };
  const r = await fetchJson<OpenAIChatResp>("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: letterText },
      ],
      max_tokens: 150,
    }),
  });

  if (!r.ok) return null;
  const text = r.json?.choices?.[0]?.message?.content?.trim();
  return text && text.length > 0 ? text : null;
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await getSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    let body: { letterText?: unknown; lang?: string; useLlm?: boolean };
    try {
      body = (await req.json()) as { letterText?: unknown; lang?: string; useLlm?: boolean };
    } catch {
      return NextResponse.json({ error: "missing_text" }, { status: 400 });
    }

    const letterText =
      typeof body.letterText === "string" ? body.letterText.trim() : "";
    if (letterText.length === 0) {
      return NextResponse.json({ error: "missing_text" }, { status: 400 });
    }
    if (letterText.length > MAX_LETTER_LENGTH) {
      return NextResponse.json({ error: "text_too_long" }, { status: 400 });
    }

    const lang =
      body.lang === "en" ? "en" : body.lang === "ko" ? "ko" : inferLang(letterText);

    const useLlm = body.useLlm === true;
    let replyMessage: string;

    if (useLlm) {
      const llmReply = await getDearMeReplyLlm(letterText, lang);
      replyMessage = llmReply ?? getDearMeReplyTemplate(lang);
    } else {
      replyMessage = getDearMeReplyTemplate(lang);
    }

    return NextResponse.json({ replyMessage });
  } catch (e) {
    console.error("[dear-me/letter]", e);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}
