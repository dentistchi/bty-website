#!/usr/bin/env node
/**
 * Build-time env check. Fail fast if NEXT_PUBLIC_SUPABASE_* are missing.
 * Run before next build (e.g. prebuild).
 */
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!url || url.trim() === "") {
  console.error("[check-env] NEXT_PUBLIC_SUPABASE_URL is required at build time.");
  process.exit(1);
}
if (!anon || anon.trim() === "") {
  console.error("[check-env] NEXT_PUBLIC_SUPABASE_ANON_KEY is required at build time.");
  process.exit(1);
}
console.log("[check-env] NEXT_PUBLIC_SUPABASE_* present.");
