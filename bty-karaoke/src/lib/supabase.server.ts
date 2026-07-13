// Server-only Supabase client for the isolated Karaoke project. Uses the
// service-role key: it bypasses RLS, so this MUST never be imported into client
// components. The browser never talks to Supabase directly.

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { karaokeEnv } from './env.server';

let cached: SupabaseClient | null = null;

export function karaokeDb(): SupabaseClient {
  if (cached) return cached;
  const { url, key } = karaokeEnv();
  cached = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return cached;
}
