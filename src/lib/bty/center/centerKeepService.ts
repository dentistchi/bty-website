/**
 * Center Daily Keep service — Center Promise Loop STEP 1A.
 *
 * A self-owned, user-authored ONE-LINE keep for today ("the line you carry").
 * Deliberately distinct from:
 *   - the Arena action contract (a training commitment, Arena-owned), and
 *   - the Dear Me letter flow (which generates a reply).
 * A keep is quiet: plain user text, NO reply, NO LLM.
 *
 * Storage reuses the existing Center-owned `dear_me_letters` table (NO new table,
 * NO migration): type='letter', source='center', day=null, reply=null, and the
 * marker `prompt='center_daily_keep'` — the ONLY field that distinguishes a keep
 * from a Dear Me free letter (also type='letter' / source='center' / day=null).
 * Every keep read MUST filter on this marker so the two never bleed together.
 *
 * Same-day handling: insert-only. `dear_me_letters` has no per-calendar-day unique
 * key (the existing unique(user_id, day, source) is a Train-Day key, and day is NULL
 * here), so a re-save appends a row; reads take the newest, so the room reflects the
 * latest line. No history UI is built in STEP 1A — extra rows stay invisible.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { validateLetterBody, type LetterLocale } from "@/domain/center/letter";

/** Marker written to dear_me_letters.prompt to isolate keeps from Dear Me letters. */
export const CENTER_KEEP_MARKER = "center_daily_keep";

/** A keep is one short line — capped well below the free-letter body limit. */
const MAX_KEEP_LENGTH = 280;

export type SaveCenterKeepInput = {
  userId: string;
  line: string;
  locale?: LetterLocale | string;
};

export type SaveCenterKeepResult =
  | { ok: true; keptId: string | null }
  | { ok: false; error: string };

/**
 * Persist one self-authored line for today. Plain insert into dear_me_letters
 * (marker prompt='center_daily_keep'); no reply, no LLM.
 */
export async function saveCenterKeep(
  supabase: SupabaseClient,
  input: SaveCenterKeepInput,
): Promise<SaveCenterKeepResult> {
  const line = typeof input.line === "string" ? input.line.trim() : "";

  const validation = validateLetterBody(line);
  if (!validation.ok) {
    return { ok: false, error: validation.error ?? "body_empty" };
  }
  if (line.length > MAX_KEEP_LENGTH) {
    return { ok: false, error: "text_too_long" };
  }

  const locale: LetterLocale = input.locale === "en" ? "en" : "ko";

  const { data: inserted, error } = await supabase
    .from("dear_me_letters")
    .insert({
      user_id: input.userId,
      locale,
      type: "letter",
      source: "center",
      day: null,
      body: line,
      reply: null,
      prompt: CENTER_KEEP_MARKER,
    })
    .select("id")
    .single();

  if (error) {
    console.error("[centerKeepService.saveCenterKeep] insert error:", error.message);
    return { ok: false, error: "save_failed" };
  }

  return { ok: true, keptId: inserted?.id ?? null };
}

export type TodayCenterKeep = { line: string | null; keptToday: boolean };

/**
 * Fetch the user's most recent Center keep and whether it was written "today" in
 * the caller-provided timezone. The tz is capture-only — resolved to a local
 * calendar date server-side (UTC fallback); no client day-key is trusted as source
 * of truth. Fail-soft: any error or absent keep returns { line: null, keptToday: false }.
 */
export async function getTodayCenterKeep(
  supabase: SupabaseClient,
  userId: string,
  tz?: string | null,
): Promise<TodayCenterKeep> {
  const { data, error } = await supabase
    .from("dear_me_letters")
    .select("body, created_at")
    .eq("user_id", userId)
    .eq("source", "center")
    .eq("type", "letter")
    .eq("prompt", CENTER_KEEP_MARKER)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data) {
    return { line: null, keptToday: false };
  }

  const line =
    typeof data.body === "string" && data.body.trim().length > 0 ? data.body : null;
  const keptToday = line != null && isSameLocalDay(data.created_at, tz);
  return { line, keptToday };
}

/** True when `iso` falls on the same local calendar date as now, in `tz` (UTC fallback). */
function isSameLocalDay(iso: string | null | undefined, tz?: string | null): boolean {
  if (!iso) return false;
  try {
    const created = new Date(iso);
    if (Number.isNaN(created.getTime())) return false;
    const fmt = (d: Date) =>
      new Intl.DateTimeFormat("en-CA", {
        timeZone: tz || "UTC",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).format(d);
    return fmt(created) === fmt(new Date());
  } catch {
    // Bad tz or Intl failure → safe default (writing surface, not "held").
    return false;
  }
}
