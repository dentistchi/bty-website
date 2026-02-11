import { NextResponse } from "next/server";
import { getOptionalRequestContext } from "@cloudflare/next-on-pages";

/**
 * Safe Mirror (안전한 거울) — AI 상담
 * 페르소나: 상담가이자 사용자 내면의 따뜻한 자아. 감정 이름 붙이기·검증·재해석만. 해결책/훈계/상투적 위로 금지.
 * Gemini API 사용. GEMINI_API_KEY 환경변수 필요.
 * Cloudflare Pages: Settings > Variables and Secrets 에서 GEMINI_API_KEY 추가.
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

function toGeminiContents(
  messages: { role: string; content?: string }[],
  userContent: string
) {
  const filtered = messages
    .filter((m): m is { role: string; content: string } => Boolean(m.role && m.content))
    .slice(-12);
  const hasLatest = filtered.some((m) => m.role === "user" && m.content === userContent);
  const list = hasLatest ? filtered : [...filtered, { role: "user", content: userContent }];

  return list.map((m) => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [{ text: m.content }],
  }));
}

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

    // Cloudflare: nodejs_compat_populate_process_env로 process.env에 주입되거나, getRequestContext().env 사용
    const ctx = getOptionalRequestContext();
    const env = ctx?.env as Record<string, string | undefined> | undefined;
    const apiKey =
      process.env.GEMINI_API_KEY ??
      (typeof env?.GEMINI_API_KEY === "string" ? env.GEMINI_API_KEY : null);

    if (!apiKey) {
      console.error("[safe-mirror] GEMINI_API_KEY not found. process.env:", !!process.env.GEMINI_API_KEY, "ctx?.env:", !!ctx?.env);
    }

    if (apiKey) {
      const contents = toGeminiContents(messages, userContent);
      const payload = {
        systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
        contents,
        generationConfig: { maxOutputTokens: 320, temperature: 0.8 },
      };
      const models = ["gemini-2.0-flash", "gemini-1.5-flash"] as const;

      for (const model of models) {
        const res = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "x-goog-api-key": apiKey,
            },
            body: JSON.stringify(payload),
          }
        );
        const data = await res.json();
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();

        if (text) return NextResponse.json({ message: text });

        if (!res.ok || data.error) {
          console.error(`[safe-mirror] Gemini ${model} error:`, res.status, JSON.stringify(data).slice(0, 400));
          if (data.error?.message?.includes("not found") || res.status === 404) continue;
          break;
        }
      }
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
