import { fetchJson } from "@/lib/read-json";
import { NextResponse } from "next/server";
import { DR_CHI_PHILOSOPHY, DR_CHI_FEW_SHOT_EXAMPLES } from "@/lib/bty/mentor/drChiCharacter";
import {
  buildMentorMessagesDual,
  inferLang,
  type ChatMessage,
} from "@/lib/bty/mentor/mentor_fewshot_dropin";
import { recordActivityXp } from "@/lib/bty/arena/activityXp";
import { getSupabaseServerClient } from "@/lib/bty/arena/supabaseServer";
import { detectEmotionalEventFromText, recordEmotionalEventServer } from "@/lib/bty/emotional-stats";
import { recordQualityEventApp } from "@/lib/bty/quality";
import { checkRateLimit, getClientIdentifier } from "@/lib/rate-limit";
import { logApiError } from "@/lib/log-api-error";

/**
 * Mentor (Dojo) — EN+KO dual few-shot bundles + weighted regex router.
 * Emotional safety valve: low self-esteem signals → Dear Me redirect.
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

const RATE_LIMIT_PER_MINUTE = 60;

function isLowSelfEsteemSignal(text: string): boolean {
  return LOW_SELF_ESTEEM_PATTERNS.some((pat) => pat.test(text));
}

/** 대화 이력만 OpenAI 형식으로 (role + content). */
function toHistoryMessages(
  messages: { role: string; content?: string }[],
  userContent: string
): { role: "user" | "assistant"; content: string }[] {
  const filtered = messages
    .filter((m): m is { role: string; content: string } => Boolean(m.role && m.content))
    .slice(-14);
  const hasLatest = filtered.some((m) => m.role === "user" && m.content === userContent);
  const list = hasLatest ? filtered : [...filtered, { role: "user", content: userContent }];
  return list.map((m) => ({
    role: m.role === "assistant" ? ("assistant" as const) : ("user" as const),
    content: m.content,
  }));
}

/** Drop-in: [system with Dr. Chi philosophy + bundle, Dr. Chi examples (up to 2), ...bundle examples] + conversation history. */
function buildOpenAIMessages(
  bodyMessages: { role: string; content?: string }[],
  userContent: string,
  lang: "en" | "ko"
): ChatMessage[] {
  const { messages: dropinMsgs } = buildMentorMessagesDual(userContent, {
    lang,
    useBundleSystem: true,
    includeDebugMeta: false,
  });
  const base = dropinMsgs.slice(0, -1) as ChatMessage[];
  if (base[0]?.role === "system" && typeof base[0].content === "string") {
    base[0] = {
      role: "system",
      content: DR_CHI_PHILOSOPHY + "\n\n" + base[0].content,
    };
  }
  const drChiTurns: ChatMessage[] = [];
  const cap = Math.min(2, DR_CHI_FEW_SHOT_EXAMPLES.length);
  for (let i = 0; i < cap; i++) {
    const ex = DR_CHI_FEW_SHOT_EXAMPLES[i];
    if (ex?.user && ex?.assistant) {
      drChiTurns.push({ role: "user", content: ex.user }, { role: "assistant", content: ex.assistant });
    }
  }
  const rest = base.slice(1);
  const history = toHistoryMessages(bodyMessages, userContent);
  return [...base.slice(0, 1), ...drChiTurns, ...rest, ...history.map((m) => ({ role: m.role, content: m.content } as ChatMessage))];
}

export async function POST(request: Request) {
  const id = getClientIdentifier(request);
  const rate = checkRateLimit(id, RATE_LIMIT_PER_MINUTE);
  if (!rate.allowed) {
    return NextResponse.json(
      { error: "Too many requests", retryAfterSeconds: rate.retryAfterSeconds },
      { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds) } }
    );
  }

  try {
    const body = await request.json();
    const messages = Array.isArray(body.messages) ? body.messages : [];
    const userContent =
      typeof body.message === "string"
        ? body.message
        : messages.filter((m: { role: string }) => m.role === "user").pop()?.content;
    const lang = body.lang === "ko" ? "ko" : body.lang === "en" ? "en" : inferLang(userContent);

    if (!userContent || typeof userContent !== "string") {
      return NextResponse.json({ error: "Message required" }, { status: 400 });
    }

    if (isLowSelfEsteemSignal(userContent)) {
      return NextResponse.json({
        message: SAFETY_VALVE_MESSAGE,
        safety_valve: true,
        dear_me_url: DEAR_ME_URL,
      });
    }

    const openaiKey = process.env.OPENAI_API_KEY;
    if (openaiKey) {
      const openaiMessages = buildOpenAIMessages(messages, userContent, lang);
      type OpenAIChatResp = { choices?: { message?: { content?: string } }[] };
      const r = await fetchJson<OpenAIChatResp>("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${openaiKey}`,
        },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          messages: openaiMessages,
          max_tokens: 400,
        }),
      });
      if (r.ok) {
        const text = r.json?.choices?.[0]?.message?.content?.trim();
        if (text) {
          const triggeredValve = isLowSelfEsteemSignal(text) || /Dear Me|dear-me|잠시 쉬고/i.test(text);
          const supabase = await getSupabaseServerClient();
          const { data: { user } } = await supabase.auth.getUser();
          if (user?.id) {
            recordActivityXp(supabase, user.id, "MENTOR_MESSAGE").catch((err) =>
              console.warn("[mentor] recordActivityXp failed", err)
            );
            const eventId = detectEmotionalEventFromText(text);
            if (eventId) {
              recordEmotionalEventServer(supabase, user.id, eventId, null).catch((err) =>
                console.warn("[mentor] recordEmotionalEvent failed", err)
              );
            }
          }
          return NextResponse.json({
            message: text,
            ...(triggeredValve && { safety_valve: true, dear_me_url: DEAR_ME_URL }),
          });
        }
        recordQualityEventApp({ route: "mentor", reason: "empty_response", lang });
      } else {
        recordQualityEventApp({ route: "mentor", reason: "fallback", lang });
      }
    } else {
      recordQualityEventApp({ route: "mentor", reason: "fallback", lang });
    }

    const fallback =
      "요즘 어떤 부분이 가장 고민되나요? 구체적으로 말해주시면 같이 생각해볼게요.";
    console.warn("[mentor] OpenAI unreachable — using fallback. Set OPENAI_API_KEY in .env.local");
    const supabase = await getSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (user?.id) {
      recordActivityXp(supabase, user.id, "MENTOR_MESSAGE").catch((err) =>
        console.warn("[mentor] recordActivityXp failed", err)
      );
      const eventId = detectEmotionalEventFromText(fallback);
      if (eventId) {
        recordEmotionalEventServer(supabase, user.id, eventId, null).catch((err) =>
          console.warn("[mentor] recordEmotionalEvent failed", err)
        );
      }
    }
    return NextResponse.json({ message: fallback, usedFallback: true });
  } catch (e) {
    logApiError("mentor", 500, e);
    recordQualityEventApp({ route: "mentor", reason: "error" });
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}
