/**
 * Center letter service — DB interaction layer.
 * Calls domain validation, then Supabase. API routes delegate here (thin handler only).
 *
 * Two letter flows:
 *   1. Center letter (center_letters) — mood/energy/oneWord, uses buildChatMessagesForModel
 *   2. Dear Me letter (dear_me_letters) — simpler, Dear Me-specific prompt
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  validateLetterBody,
  type LetterLocale,
  type LetterWithReply,
} from "@/domain/center/letter";
import { fetchJson } from "@/lib/read-json";
import { getLlmEndpoint, isLlmAvailable } from "@/lib/llm";
import { buildChatMessagesForModel, getFallbackMessage } from "@/lib/bty/chat";

const MAX_LETTER_LENGTH = 2000;

function inferLang(text: string): LetterLocale {
  return /[\uac00-\ud7a3]/.test(text) ? "ko" : "en";
}

function getDearMeReplyTemplate(lang: LetterLocale): string {
  if (lang === "en") {
    return "Thank you for writing. Your feelings are valid, and it takes courage to put them into words. Be gentle with yourself today.";
  }
  return "편지 써줘서 고마워요. 지금 느끼는 것도 충분히 의미 있어요. 오늘은 조금만 더 자신에게 다정해져 보세요.";
}

async function getDearMeReplyLlm(letterText: string, lang: LetterLocale): Promise<string | null> {
  if (!isLlmAvailable()) return null;
  const llm = getLlmEndpoint();

  const systemPrompt =
    lang === "en"
      ? "You are Dr. Chi in 'Dear Me' mode. The user wrote a short letter to themselves. Reply in 1 to 3 short sentences only. Tone: warm, no blame, validate feelings, gentle encouragement. Do not give advice or solutions. Respond only in English."
      : "당신은 Dear Me 모드의 Dr. Chi입니다. 사용자가 나에게 쓰는 짧은 편지를 보냈습니다. 1~3문장으로만 답하세요. 톤: 따뜻하고, 비판 없이, 감정을 인정하고, 다정한 격려. 조언이나 해결책을 주지 마세요. 반드시 한국어로만 답하세요.";

  type OpenAIChatResp = { choices?: { message?: { content?: string } }[] };
  const r = await fetchJson<OpenAIChatResp>(llm.url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${llm.apiKey}`,
    },
    body: JSON.stringify({
      model: llm.model,
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

export type SubmitLetterInput = {
  userId: string;
  body: string;
  locale?: LetterLocale | string;
  useLlm?: boolean;
};

export type SubmitLetterResult =
  | { ok: true; letterId: string | null; reply: string }
  | { ok: false; error: string };

/**
 * Submit a Dear Me letter: validate → generate reply → INSERT.
 */
export async function submitLetter(
  supabase: SupabaseClient,
  input: SubmitLetterInput
): Promise<SubmitLetterResult> {
  const letterText = typeof input.body === "string" ? input.body.trim() : "";

  const validation = validateLetterBody(letterText);
  if (!validation.ok) {
    return { ok: false, error: validation.error ?? "body_empty" };
  }
  if (letterText.length > MAX_LETTER_LENGTH) {
    return { ok: false, error: "text_too_long" };
  }

  const lang: LetterLocale =
    input.locale === "en" ? "en" : input.locale === "ko" ? "ko" : inferLang(letterText);

  let reply: string;
  if (input.useLlm) {
    const llmReply = await getDearMeReplyLlm(letterText, lang);
    reply = llmReply ?? getDearMeReplyTemplate(lang);
  } else {
    reply = getDearMeReplyTemplate(lang);
  }

  const { data: inserted, error: insertError } = await supabase
    .from("dear_me_letters")
    .insert({
      user_id: input.userId,
      locale: lang,
      body: letterText,
      reply,
    })
    .select("id")
    .single();

  if (insertError) {
    console.error("[letterService.submitLetter] insert error:", insertError.message);
  }

  return { ok: true, letterId: inserted?.id ?? null, reply };
}

// ---------------------------------------------------------------------------
// Center letter (center_letters table) — used by /api/center/letter
// ---------------------------------------------------------------------------

export type SubmitCenterLetterInput = {
  userId: string;
  body: string;
  mood?: string | null;
  energy?: number | null;
  oneWord?: string | null;
  locale?: LetterLocale | string;
};

export type SubmitCenterLetterResult =
  | { ok: true; reply: string }
  | { ok: false; error: string };

async function getCenterReplyLlm(letterText: string, lang: LetterLocale): Promise<string | null> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;

  const messagesForModel = buildChatMessagesForModel(
    [{ role: "user", content: letterText }],
    "center",
    lang
  );

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

  if (!r.ok) return null;
  const text = r.json?.choices?.[0]?.message?.content?.trim();
  return text && text.length > 0 ? text : null;
}

/**
 * Submit a Center letter: validate → LLM reply (or fallback) → INSERT into center_letters.
 */
export async function submitCenterLetter(
  supabase: SupabaseClient,
  input: SubmitCenterLetterInput
): Promise<SubmitCenterLetterResult> {
  const letterText = typeof input.body === "string" ? input.body.trim() : "";

  const validation = validateLetterBody(letterText);
  if (!validation.ok) {
    return { ok: false, error: validation.error ?? "body_empty" };
  }

  const lang: LetterLocale = input.locale === "en" ? "en" : "ko";
  const mood = typeof input.mood === "string" ? input.mood.slice(0, 200) : null;
  const energy =
    typeof input.energy === "number" && input.energy >= 1 && input.energy <= 5
      ? input.energy
      : null;
  const oneWord = typeof input.oneWord === "string" ? input.oneWord.slice(0, 100) : null;

  let reply: string = getFallbackMessage("center", lang);
  const llmReply = await getCenterReplyLlm(letterText, lang);
  if (llmReply) reply = llmReply;

  const { error: insertError } = await supabase.from("center_letters").insert({
    user_id: input.userId,
    locale: lang,
    mood,
    energy,
    one_word: oneWord,
    body: letterText,
    reply,
  });

  if (insertError) {
    console.error("[letterService.submitCenterLetter] insert error:", insertError.message);
    return { ok: false, error: "Failed to save letter" };
  }

  return { ok: true, reply };
}

// ---------------------------------------------------------------------------
// Dear Me letter history (dear_me_letters table)
// ---------------------------------------------------------------------------

/**
 * Fetch letter history for a user, newest first.
 */
export async function getLetterHistory(
  supabase: SupabaseClient,
  userId: string,
  limit = 20
): Promise<{ ok: true; letters: LetterWithReply[] } | { ok: false; error: string }> {
  const { data, error } = await supabase
    .from("dear_me_letters")
    .select("id, locale, body, reply, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    return { ok: false, error: error.message };
  }

  const letters: LetterWithReply[] = (data ?? []).map(
    (r: { id: string; locale: string; body: string; reply: string | null; created_at: string }) => ({
      id: r.id,
      body: r.body,
      reply: r.reply,
      locale: (r.locale === "en" ? "en" : "ko") as LetterLocale,
      createdAt: r.created_at,
    })
  );

  return { ok: true, letters };
}
