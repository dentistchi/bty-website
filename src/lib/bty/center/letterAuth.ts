/**
 * Shared auth for letter API routes (Center + Dear Me).
 * Used by POST /api/center/letter and POST /api/dear-me/letter.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseServerClient } from "@/lib/bty/arena/supabaseServer";
import { isConsentCurrent } from "@/lib/legal/activeConsent";

export type LetterAuth = { supabase: SupabaseClient; userId: string };

/**
 * Returns authenticated user context for letter APIs, or null if unauthenticated.
 */
export async function getLetterAuth(): Promise<LetterAuth | null> {
  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.id) return null;
  return { supabase, userId: user.id };
}

/**
 * The letter APIs are private learner content — Dear Me letters, day reflections, Center keeps and
 * assessment submissions — so they are learner Class C and must require CURRENT consent
 * (Slice 3.2R-R9B.2).
 *
 * `getLetterAuth` is deliberately left untouched beside this: it is authentication only, exactly as
 * `requireUser` is, so nothing that is not a learner surface can be swept under the learner
 * agreement by editing one shared helper.
 *
 * `consentCurrent` is false for an unconsented learner AND for any state where consent could not be
 * established — the caller refuses on falsity, so the failure direction is closed.
 */
export async function getConsentedLetterAuth(): Promise<(LetterAuth & { consentCurrent: boolean }) | null> {
  const auth = await getLetterAuth();
  if (!auth) return null;
  return { ...auth, consentCurrent: await isConsentCurrent(auth.supabase, auth.userId) };
}
