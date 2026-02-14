import type { User } from "@supabase/supabase-js";
import { createServerSupabaseClient } from "@/lib/supabase-server";

/**
 * Get the current user from the request using Supabase Auth.
 * Expects Authorization: Bearer <access_token> (e.g. from session.access_token).
 */
export async function getAuthUserFromRequest(request: Request): Promise<User | null> {
  const auth = request.headers.get("authorization");
  const token = auth?.startsWith("Bearer ") ? auth.slice(7) : null;
  if (!token) return null;

  const supabase = createServerSupabaseClient();
  if (!supabase) return null;
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser(token);
  if (error || !user) return null;
  return user;
}
