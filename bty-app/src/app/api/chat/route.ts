import { fetchJson } from "@/lib/read-json";
import { NextResponse } from "next/server";

/** 감정 안전 밸브: 낮은 자존감 신호 감지 시 Dear Me 유도 (mentor와 동일) */
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

const SAFETY_VALVE_MESSAGE_KO =
  "잠깐만요, 지금 많이 지쳐 보여요. 기술을 배우는 것보다 마음을 돌보는 게 먼저인 것 같네요. 우리 Dear Me로 가서 잠시 쉬고 올까요? 거기서 당신의 마음 상태를 체크해보고 오세요.";
const SAFETY_VALVE_MESSAGE_EN =
  "You seem really worn out right now. Taking care of your heart might come before anything else. How about resting for a moment in Dear Me? You can check in with how you're feeling there.";

function isLowSelfEsteemSignal(text: string): boolean {
  return LOW_SELF_ESTEEM_PATTERNS.some((pat) => pat.test(text));
}

/** Dojo 추천: 학습/연습 의도 감지 시 훈련장(멘토·역지사지) 유도 */
const DOJO_RECOMMEND_PATTERNS = [
  /배우고\s*싶/i,
  /어떻게\s*해야/i,
  /연습하고\s*싶/i,
  /도와\s*줘/i,
  /가이드|가르쳐|알려\s*줘/i,
  /how\s*to/i,
  /learn\s*(to|about|how)/i,
  /want\s*to\s*(learn|practice)/i,
  /need\s*to\s*learn/i,
  /help\s*me\s*(with|to)/i,
  /practice\s*(with|together)/i,
  /teach\s*me/i,
  /멘토|mentor/i,
  /역지사지|다른\s*사람\s*입장/i,
];

const DOJO_RECOMMEND_MESSAGE_KO =
  "연습이나 배움이 필요하시다면 훈련장(Dojo)이 좋아요. Dr. Chi 멘토와 대화하거나 역지사지 시뮬레이터로 갈등 상황을 돌려볼 수 있어요.";
const DOJO_RECOMMEND_MESSAGE_EN =
  "If you want to practice or learn, the Dojo is a good place. You can talk with Dr. Chi or try the integrity simulator to reframe conflict situations.";

function isDojoRecommendSignal(text: string): boolean {
  return DOJO_RECOMMEND_PATTERNS.some((pat) => pat.test(text));
}

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

    if (isLowSelfEsteemSignal(userContent)) {
      const message = lang === "ko" ? SAFETY_VALVE_MESSAGE_KO : SAFETY_VALVE_MESSAGE_EN;
      return NextResponse.json({ message, suggestDearMe: true });
    }

    if (mode === "today-me" && isDojoRecommendSignal(userContent)) {
      const message = lang === "ko" ? DOJO_RECOMMEND_MESSAGE_KO : DOJO_RECOMMEND_MESSAGE_EN;
      return NextResponse.json({ message, suggestDojo: true });
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
