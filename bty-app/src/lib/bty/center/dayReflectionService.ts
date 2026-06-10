/**
 * Day Reflection service — DECISION6 C2 (Day Reflection Set).
 *
 * Train Day reflection = one Dear Me Reflection per (user, day, source='train'):
 * zero or more guided question answers + one integrated final reflection,
 * stored as `responses jsonb` on `dear_me_letters` (type='day_reflection').
 *
 * Distinct from submitLetter (letterService): that path is insert-only for free
 * letters (body + reply). This path UPSERTs a structured Q/A set keyed on the
 * (user_id, day, source) unique constraint (C2-1), enabling re-edit / partial save.
 * No LLM reply is generated for a reflection set.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { LetterLocale } from "@/domain/center/letter";

export type DayReflectionQA = { q: string; a: string };

export type DayReflectionResponses = {
  title: string;
  questions: DayReflectionQA[];
  finalReflection: string;
};

export type SubmitDayReflectionInput = {
  userId: string;
  day: number;
  locale?: LetterLocale | string;
  responses: DayReflectionResponses;
  /** Capture origin; default 'train' (the only C2 producer for now). */
  source?: "train" | "arena" | "center";
};

export type SubmitDayReflectionResult =
  | { ok: true; letterId: string | null }
  | { ok: false; error: string };

const MAX_REFLECTION_LENGTH = 5000;

function normalizeResponses(input: DayReflectionResponses): DayReflectionResponses {
  return {
    title: typeof input.title === "string" ? input.title : "",
    questions: Array.isArray(input.questions)
      ? input.questions.map((qa) => ({
          q: typeof qa?.q === "string" ? qa.q : "",
          a: typeof qa?.a === "string" ? qa.a.trim() : "",
        }))
      : [],
    finalReflection:
      typeof input.finalReflection === "string" ? input.finalReflection.trim() : "",
  };
}

/**
 * Submit (upsert) a Train Day reflection set. Partial saves are allowed — empty
 * question answers and/or empty finalReflection are accepted (re-edit later via
 * the same (user, day, source) row). At least one non-empty field is required.
 */
export async function submitDayReflection(
  supabase: SupabaseClient,
  input: SubmitDayReflectionInput,
): Promise<SubmitDayReflectionResult> {
  const day = Number(input.day);
  if (!Number.isFinite(day) || day < 1 || day > 28) {
    return { ok: false, error: "invalid_day" };
  }

  const responses = normalizeResponses(input.responses);
  const hasAnswer =
    responses.finalReflection.length > 0 || responses.questions.some((qa) => qa.a.length > 0);
  if (!hasAnswer) {
    return { ok: false, error: "empty_reflection" };
  }
  if (responses.finalReflection.length > MAX_REFLECTION_LENGTH) {
    return { ok: false, error: "text_too_long" };
  }

  const lang: LetterLocale = input.locale === "en" ? "en" : "ko";
  const source = input.source === "arena" || input.source === "center" ? input.source : "train";

  // body mirrors finalReflection (lightweight summary / History excerpt). reply
  // intentionally null — a reflection set is not letter-replied.
  const { data: upserted, error } = await supabase
    .from("dear_me_letters")
    .upsert(
      {
        user_id: input.userId,
        locale: lang,
        type: "day_reflection",
        source,
        day,
        responses,
        body: responses.finalReflection,
        reply: null,
      },
      { onConflict: "user_id,day,source" },
    )
    .select("id")
    .single();

  if (error) {
    console.error("[dayReflectionService.submitDayReflection] upsert error:", error.message);
    return { ok: false, error: "save_failed" };
  }

  return { ok: true, letterId: upserted?.id ?? null };
}
