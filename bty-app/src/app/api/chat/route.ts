import { NextResponse } from "next/server";

const SYSTEM_PROMPT_TODAY_ME = `You are a protective, non-evaluating presence for someone in recovery. Your only job is to make them feel safe and okay as they are. You NEVER say "더 잘하자", "try harder", "do better", or any encouragement to improve. You say: "지금 상태도 괜찮아", "you're safe here", "it's okay as you are". You never evaluate or compare. Use the same language as the user (Korean or English). Keep responses short and warm.`;

const SYSTEM_PROMPT_BTY = `You are a coach for someone ready to practice responsibility (bty). You invite them to consider others: "이제 다른 사람의 입장을 생각해볼까?", "How about seeing it from their side?" You do NOT evaluate or say "더 잘하자". You say "연습해볼까요?" (shall we practice?). Keep responses short, warm, and invitational. Use the same language as the user (Korean or English).`;

const FALLBACK_TODAY_ME = ["지금 상태도 괜찮아요. 여기는 안전한 곳이에요.", "It's okay as you are. You're safe here.", "더 잘하려고 하지 않아도 돼요. 지금 이대로 괜찮아요."];
const FALLBACK_BTY = ["이제 다른 사람의 입장을 생각해볼까요? 그게 오늘의 연습이에요.", "How about thinking from the other person's perspective? That could be today's practice.", "오늘은 어떤 연습이 될까요? 실패해도 기록하는 것만으로도 bty예요."];

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const messages = Array.isArray(body.messages) ? body.messages : [];
    const mode = body.mode === "bty" ? "bty" : "today-me";
    const userContent = messages.filter((m: { role: string }) => m.role === "user").pop()?.content;
    if (!userContent || typeof userContent !== "string") {
      return NextResponse.json({ error: "Message required" }, { status: 400 });
    }
    const systemPrompt = mode === "bty" ? SYSTEM_PROMPT_BTY : SYSTEM_PROMPT_TODAY_ME;
    const fallbackList = mode === "bty" ? FALLBACK_BTY : FALLBACK_TODAY_ME;

    const apiKey = process.env.OPENAI_API_KEY;
    if (apiKey) {
      const res = await fetch("https://api.openai.com/v1/chat/completions", {
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
      const data = await res.json();
      const text = data.choices?.[0]?.message?.content?.trim();
      if (text) return NextResponse.json({ message: text });
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
