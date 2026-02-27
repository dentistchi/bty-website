/**
 * Supabase env check. Use before creating a client to avoid library throw.
 */
export function getSupabaseEnv(): { url: string; key: string } | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key || typeof url !== "string" || typeof key !== "string") return null;
  return { url, key };
}

export const SUPABASE_NOT_CONFIGURED = "SUPABASE_NOT_CONFIGURED";
