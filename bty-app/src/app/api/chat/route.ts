import { fetchJson } from "@/lib/read-json";
import { NextResponse } from "next/server";

const SYSTEM_PROMPT_TODAY_ME_EN = `You are a protective, non-evaluating presence for someone in recovery. Your only job is to make them feel safe and okay as they are. You NEVER say "try harder", "do better", or any encouragement to improve. You say: "you're safe here", "it's okay as you are". You never evaluate or compare. Respond in English only. Keep responses short and warm.`;

const SYSTEM_PROMPT_TODAY_ME_KO = `당신은 회복 중인 사람을 위한 보호적, 비평가적 존재입니다. 오직 그들이 안전하고 그대로 괜찮다고 느끼게 하는 것이 당신의 역할입니다. "더 잘하자", "노력해" 같은 격려나 개선 유도는 절대 하지 마세요. "지금 상태도 괜찮아", "여기는 안전한 곳이에요"라고 말하세요. 평가나 비교는 하지 마세요. 한국어로만 응답하세요. 짧고 따뜻하게 응답하세요.`;

const SYSTEM_PROMPT_BTY_EN = `You are a coach for someone ready to practice responsibility (bty). You invite them to consider others: "How about seeing it from their side?" You do NOT evaluate or say "try harder". You say "Shall we practice?" Keep responses short, warm, and invitational. Respond in English only.`;

const SYSTEM_PROMPT_BTY_KO = `당신은 책임 연습(bty)을 준비한 사람의 코치입니다. "이제 다른 사람의 입장을 생각해볼까?"라고 초대하세요. "더 잘하자"라고 평가하지 마세요. "연습해볼까요?"라고 말하세요. 짧고 따뜻하게, 초대하듯 응답하세요. 한국어로만 응답하세요.`;

const FALLBACK_TODAY_ME = ["지금 상태도 괜찮아요. 여기는 안전한 곳이에요.", "It's okay as you are. You're safe here.", "더 잘하려고 하지 않아도 돼요. 지금 이대로 괜찮아요."];
const FALLBACK_BTY = ["이제 다른 사람의 입장을 생각해볼까요? 그게 오늘의 연습이에요.", "How about thinking from the other person's perspective? That could be today's practice.", "오늘은 어떤 연습이 될까요? 실패해도 기록하는 것만으로도 bty예요."];

function getSystemPrompt(mode: string, lang: string): string {
  const isBty = mode === "bty";
  const isKo = lang === "ko";
  if (isBty) return isKo ? SYSTEM_PROMPT_BTY_KO : SYSTEM_PROMPT_BTY_EN;
  return isKo ? SYSTEM_PROMPT_TODAY_ME_KO : SYSTEM_PROMPT_TODAY_ME_EN;
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const messages = Array.isArray(body.messages) ? body.messages : [];
    const mode = body.mode === "bty" ? "bty" : "today-me";
    const lang = body.lang === "ko" ? "ko" : "en";
    const userContent = messages.filter((m: { role: string }) => m.role === "user").pop()?.content;
    if (!userContent || typeof userContent !== "string") {
      return NextResponse.json({ error: "Message required" }, { status: 400 });
    }
    const systemPrompt = getSystemPrompt(mode, lang);
    const fallbackList = mode === "bty" ? FALLBACK_BTY : FALLBACK_TODAY_ME;

    const apiKey = process.env.OPENAI_API_KEY;
    if (apiKey) {
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
            ...messages.slice(-10).map((m: { role: string; content: string }) => ({
              role: m.role,
              content: m.content,
            })),
          ],
          max_tokens: 300,
        }),
      });
      if (r.ok) {
        const data = r.json;
        const text = data.choices?.[0]?.message?.content?.trim();
        if (text) return NextResponse.json({ message: text });
      }
    }

    const reply = fallbackList[Math.floor(Math.random() * fallbackList.length)];
    return NextResponse.json({ message: reply });
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { error: "Something went wrong" },
      { status: 500 }
    );
  }
}
