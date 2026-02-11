import { NextResponse } from "next/server";

/**
 * Safe Mirror (안전한 거울) — AI 상담
 * 페르소나: 상담가이자 사용자 내면의 따뜻한 자아. 감정 이름 붙이기·검증·재해석만. 해결책/훈계/상투적 위로 금지.
 */

const SYSTEM_PROMPT = `You are a counselor and the user's warmest inner self (Inner Self). You respond as if you are the part of them that already understands and accepts.

**You must NOT:**
- Give solutions, advice, or "what you should do."
- Lecture, preach, or say things like "힘내세요" / "Cheer up" / "You can do it."
- Use clichéd comfort or empty reassurance.

**You must:**
- Name the user's emotions (e.g. "지금 느끼는 건 슬픔이에요." / "That sounds like sadness.").
- Validate that the feeling makes sense (e.g. "그런 상황에서 그렇게 느끼는 건 당연해요." / "It makes sense to feel that way in that situation.").
- Gently reframe when helpful (e.g. "그 상황에서 화가 났던 건, 너를 지키고 싶어서였어." / "Being angry in that situation was you wanting to protect yourself.").

Keep responses to 2–4 short sentences. Use the same language as the user (Korean or English). Write as if you are writing a short reply on the same letter—warm, intimate, and non-evaluating.`;

const FALLBACK_KO =
  "그런 마음이 드는 건 당연해요. 그건 당신이 부족해서가 아니라, 그 상황을 소중히 여기기 때문이에요.";
const FALLBACK_EN =
  "It makes sense to feel that way. It's not that you're lacking—it's that you care about what happened.";

export const runtime = "edge";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const messages = Array.isArray(body.messages) ? body.messages : [];
    const userContent =
      typeof body.message === "string"
        ? body.message
        : messages.filter((m: { role: string }) => m.role === "user").pop()?.content;

    if (!userContent || typeof userContent !== "string") {
      return NextResponse.json({ error: "Message required" }, { status: 400 });
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (apiKey) {
      const chatMessages = [
        { role: "system" as const, content: SYSTEM_PROMPT },
        ...messages
          .filter((m: { role: string; content?: string }) => m.role && m.content)
          .slice(-12)
          .map((m: { role: string; content: string }) => ({ role: m.role, content: m.content })),
      ];
      if (
        !chatMessages.some((m) => m.role === "user" && m.content === userContent)
      ) {
        chatMessages.push({ role: "user" as const, content: userContent });
      }

      const res = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          messages: chatMessages,
          max_tokens: 320,
        }),
      });

      const data = await res.json();
      const text = data.choices?.[0]?.message?.content?.trim();
      if (text) return NextResponse.json({ message: text });
    }

    const isKo = /[가-힣]/.test(userContent);
    return NextResponse.json({
      message: isKo ? FALLBACK_KO : FALLBACK_EN,
    });
  } catch (e) {
    console.error("[safe-mirror]", e);
    return NextResponse.json(
      { error: "Something went wrong" },
      { status: 500 }
    );
  }
}
