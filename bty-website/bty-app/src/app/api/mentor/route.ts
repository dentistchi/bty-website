import { NextResponse } from "next/server";

/**
 * Dr. Chi Mentor Mode — 5가지 주제로 깊이 있는 대화
 * 감정 안전 밸브: 낮은 자존감 신호 감지 시 Dear Me로 유도
 */

const DEAR_ME_URL = "https://dear-me.pages.dev";

const SAFETY_VALVE_MESSAGE =
  "잠깐만요, 지금 많이 지쳐 보여요. 기술을 배우는 것보다 마음을 돌보는 게 먼저인 것 같네요. 우리 Dear Me로 가서 잠시 쉬고 올까요? 거기서 당신의 마음 상태를 체크해보고 오세요.";

const LOW_SELF_ESTEEM_PATTERNS = [
  /못하겠어/i,
  /못하겠다/i,
  /자격\s*이?\s*없어/i,
  /자격\s*없다/i,
  /너무\s*힘들어/i,
  /너무\s*힘들다/i,
  /진짜\s*힘들어/i,
  /지쳐/i,
  /포기/i,
  /그만둘게/i,
  /그만둬/i,
  /안\s*돼/i,
  /못\s*해/i,
  /쓸모없/i,
  /가치\s*없/i,
  /의미\s*없/i,
];

const TOPICS = {
  clinical: "Clinical Skills (임상 기술)",
  patient: "Patient Management (환자 관리)",
  team: "Team Relations (팀 관계)",
  financial: "Financial Advice (재무 조언)",
  selflove: "Self-Love (자기 사랑)",
} as const;

function buildSystemPrompt(topic: keyof typeof TOPICS): string {
  const topicName = TOPICS[topic];
  return `You are Dr. Chi, a dentist and life mentor. You have a warm, wise presence. The user chose the topic: ${topicName}.

**Your teaching style:**
- Do NOT lecture one-way. Ask questions to draw insight from the user.
- Start with empathy: "요즘 환자 보면서 뭐가 제일 힘드니?", "어떤 부분이 가장 막막해 보여?"
- Guide through conversation, not through giving answers.
- Keep responses to 2-4 sentences. Be concise and warm.
- Use the same language as the user (Korean or English).

**Topics by choice:**
- Clinical Skills: patient care, procedures, clinical confidence
- Patient Management: difficult patients, communication, boundaries
- Team Relations: staff dynamics, conflict, leadership
- Financial Advice: practice finances, personal money, sustainability
- Self-Love: burnout prevention, self-care, worthiness

**CRITICAL - Emotional Safety Valve:**
If the user's message clearly suggests low self-esteem, exhaustion, or despair (e.g. "못하겠어", "자격 없어", "너무 힘들어"), you MUST immediately pause education and say ONLY this exact message, nothing else:
"${SAFETY_VALVE_MESSAGE}"

Do not add any other advice or continue the topic.`;
}

function isLowSelfEsteemSignal(text: string): boolean {
  return LOW_SELF_ESTEEM_PATTERNS.some((pat) => pat.test(text));
}

function toGeminiContents(
  messages: { role: string; content?: string }[],
  userContent: string
) {
  const filtered = messages
    .filter((m): m is { role: string; content: string } => Boolean(m.role && m.content))
    .slice(-14);
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
    const topic = Object.keys(TOPICS).includes(body.topic)
      ? (body.topic as keyof typeof TOPICS)
      : "clinical";
    const userContent =
      typeof body.message === "string"
        ? body.message
        : messages.filter((m: { role: string }) => m.role === "user").pop()?.content;

    if (!userContent || typeof userContent !== "string") {
      return NextResponse.json({ error: "Message required" }, { status: 400 });
    }

    // Emotional Safety Valve: detect before AI call
    if (isLowSelfEsteemSignal(userContent)) {
      return NextResponse.json({
        message: SAFETY_VALVE_MESSAGE,
        safety_valve: true,
        dear_me_url: DEAR_ME_URL,
      });
    }

    const apiKey = process.env.GEMINI_API_KEY ?? null;

    if (apiKey) {
      const systemPrompt = buildSystemPrompt(topic);
      const contents = toGeminiContents(messages, userContent);
      const payload = {
        systemInstruction: { parts: [{ text: systemPrompt }] },
        contents,
        generationConfig: { maxOutputTokens: 400, temperature: 0.8 },
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

        if (text) {
          const triggeredValve = isLowSelfEsteemSignal(text) || /Dear Me|dear-me|잠시 쉬고/i.test(text);
          return NextResponse.json({
            message: text,
            ...(triggeredValve && { safety_valve: true, dear_me_url: DEAR_ME_URL }),
          });
        }

        if (!res.ok || data.error) {
          console.error(`[mentor] Gemini ${model} error:`, res.status, JSON.stringify(data).slice(0, 400));
          if (data.error?.message?.includes("not found") || res.status === 404) continue;
          break;
        }
      }
    }

    const fallback =
      "요즘 어떤 부분이 가장 고민되나요? 구체적으로 말해주시면 같이 생각해볼게요.";
    return NextResponse.json({ message: fallback });
  } catch (e) {
    console.error("[mentor]", e);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}
