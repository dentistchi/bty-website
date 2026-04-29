/**
 * Shared auth for letter API routes (Center + Dear Me).
 * Used by POST /api/center/letter and POST /api/dear-me/letter.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseServerClient } from "@/lib/bty/arena/supabaseServer";

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
