/**
 * POST /api/chat — BTY 챗봇 API
 * CHATBOT_TRAINING_CHECKLIST, ROADMAP_NEXT_STEPS § 챗봇 훈련 시기 반영.
 * 메타 질문·안전 밸브·Foundry 추천 → 고정 응답, 그 외 buildChatMessagesForModel + OpenAI 호출.
 */
import { fetchJson } from "@/lib/read-json";
import { NextResponse } from "next/server";
import {
  buildChatMessagesForModel,
  normalizeMode,
  getFallbackMessage,
  isLowSelfEsteemSignal,
  isFoundryRecommendSignal,
  getSafetyValveMessage,
  getFoundryRecommendMessage,
  detectLang,
  filterBtyResponse,
  isMetaQuestion,
  getMetaReply,
  type ChatMode,
  type ChatResponseBody,
} from "@/lib/bty/chat";
import { recordActivityXp } from "@/lib/bty/arena/activityXp";
import { detectEmotionalEventFromText, recordEmotionalEventServer } from "@/lib/bty/emotional-stats";
import { getSupabaseServerClient } from "@/lib/bty/arena/supabaseServer";
import { recordQualityEventApp } from "@/lib/bty/quality";
import { checkRateLimit, getClientIdentifier } from "@/lib/rate-limit";
import { logApiError } from "@/lib/log-api-error";

export type { ChatMode } from "@/lib/bty/chat";

const RATE_LIMIT_PER_MINUTE = 60;

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
    const body = (await request.json()) as { messages?: { role: string; content: string }[]; mode?: unknown; lang?: string };
    const messages = Array.isArray(body.messages) ? body.messages : [];
    const userContent = messages.filter((m) => m.role === "user").pop()?.content;
    const lang = detectLang(body.lang, userContent ?? "");
    if (!userContent || typeof userContent !== "string") {
      return NextResponse.json({ error: "Message required" }, { status: 400 });
    }

    const mode = normalizeMode(body.mode, userContent) as ChatMode;

    // PROJECT_BACKLOG §9: 메타 질문 → 고정 답변 (토큰 절약·일관된 응답)
    if (isMetaQuestion(userContent)) {
      const message = getMetaReply(lang);
      return NextResponse.json({ message, mode } satisfies ChatResponseBody);
    }

    // Phase 1-1: 낮은 자존감 → Center 안전 밸브 (우선)
    if (isLowSelfEsteemSignal(userContent)) {
      const message = getSafetyValveMessage(lang);
      return NextResponse.json({ message, suggestCenter: true } satisfies Partial<ChatResponseBody>);
    }

    // Phase 1-2: 학습/연습 필요 → Foundry(멘토·역지사지) 링크 제안 — 전역
    if (isFoundryRecommendSignal(userContent)) {
      const message = getFoundryRecommendMessage(lang);
      return NextResponse.json({ message, suggestFoundry: true } satisfies Partial<ChatResponseBody>);
    }

    const messagesForModel = buildChatMessagesForModel(messages, mode, lang);
    const fallback = getFallbackMessage(mode, lang);

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
          messages: messagesForModel,
          max_tokens: 200, // CHATBOT_TRAINING_CHECKLIST §0 Foundry
        }),
      });
          if (r.ok) {
        const data = r.json;
        const rawText = data?.choices?.[0]?.message?.content?.trim();
        if (rawText) {
          const text = mode === "foundry" ? filterBtyResponse(rawText, lang) : rawText;
          const supabase = await getSupabaseServerClient();
          const { data: { user } } = await supabase.auth.getUser();
          if (user?.id) {
            recordActivityXp(supabase, user.id, "CHAT_MESSAGE").catch((err) =>
              console.warn("[chat] recordActivityXp failed", err)
            );
            const eventId = detectEmotionalEventFromText(text);
            if (eventId) {
              recordEmotionalEventServer(supabase, user.id, eventId, null).catch((err) =>
                console.warn("[chat] recordEmotionalEvent failed", err)
              );
            }
          }
          return NextResponse.json({ message: text, mode } satisfies ChatResponseBody);
        }
        recordQualityEventApp({ route: "chat", reason: "empty_response", mode, lang });
      } else {
        recordQualityEventApp({ route: "chat", reason: "fallback", mode, lang });
      }
    } else {
      recordQualityEventApp({ route: "chat", reason: "fallback", mode, lang });
    }

    const supabase = await getSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (user?.id) {
      recordActivityXp(supabase, user.id, "CHAT_MESSAGE").catch((err) =>
        console.warn("[chat] recordActivityXp failed", err)
      );
      const eventId = detectEmotionalEventFromText(fallback);
      if (eventId) {
        recordEmotionalEventServer(supabase, user.id, eventId, null).catch((err) =>
          console.warn("[chat] recordEmotionalEvent failed", err)
        );
      }
    }
    return NextResponse.json({
      message: fallback,
      mode,
      usedFallback: true,
    } satisfies ChatResponseBody);
  } catch (e) {
    logApiError("chat", 500, e);
    recordQualityEventApp({ route: "chat", reason: "error" });
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}
