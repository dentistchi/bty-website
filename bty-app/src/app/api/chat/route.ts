import { fetchJson } from "@/lib/read-json";
import { NextResponse } from "next/server";
import {
  buildChatMessagesForModel,
  normalizeMode,
  getFallbackMessage,
  isLowSelfEsteemSignal,
  isDojoRecommendSignal,
  getSafetyValveMessage,
  getDojoRecommendMessage,
  detectLang,
  filterBtyResponse,
  type ChatMode,
  type ChatResponseBody,
} from "@/lib/bty/chat";
import { recordActivityXp } from "@/lib/bty/arena/activityXp";
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

    if (isLowSelfEsteemSignal(userContent)) {
      const message = getSafetyValveMessage(lang);
      return NextResponse.json({ message, suggestDearMe: true } satisfies Partial<ChatResponseBody>);
    }

    if (mode === "dearme" && isDojoRecommendSignal(userContent)) {
      const message = getDojoRecommendMessage(lang);
      return NextResponse.json({ message, suggestDojo: true } satisfies Partial<ChatResponseBody>);
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
          max_tokens: 200,
        }),
      });
      if (r.ok) {
        const data = r.json;
        const rawText = data?.choices?.[0]?.message?.content?.trim();
        if (rawText) {
          const text = mode === "dojo" ? filterBtyResponse(rawText, lang) : rawText;
          const supabase = await getSupabaseServerClient();
          const { data: { user } } = await supabase.auth.getUser();
          if (user?.id) {
            recordActivityXp(supabase, user.id, "CHAT_MESSAGE").catch((err) =>
              console.warn("[chat] recordActivityXp failed", err)
            );
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
