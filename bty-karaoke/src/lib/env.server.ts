// Server-only Karaoke env access. Single source of secrets is `.dev.vars`
// (Wrangler convention, git-ignored). Under `next dev`/`next build` we hydrate
// process.env from that file if the vars aren't already present. Under the
// Cloudflare runtime the vars arrive as bindings and the fs fallback is skipped.

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

let hydrated = false;

function hydrateFromDevVars(): void {
  if (hydrated) return;
  hydrated = true;
  if (process.env.KARAOKE_SUPABASE_URL && process.env.KARAOKE_SUPABASE_SERVICE_ROLE_KEY) return;
  try {
    const raw = readFileSync(resolve(process.cwd(), '.dev.vars'), 'utf8');
    for (const line of raw.split('\n')) {
      const t = line.trim();
      if (!t || t.startsWith('#')) continue;
      const i = t.indexOf('=');
      if (i === -1) continue;
      const k = t.slice(0, i).trim();
      const v = t.slice(i + 1).trim();
      if (!(k in process.env)) process.env[k] = v;
    }
  } catch {
    // No .dev.vars here (e.g. deployed runtime) — rely on platform bindings.
  }
}

export function karaokeEnv(): { url: string; key: string } {
  hydrateFromDevVars();
  const url = process.env.KARAOKE_SUPABASE_URL;
  const key = process.env.KARAOKE_SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      'Missing Karaoke Supabase env (KARAOKE_SUPABASE_URL / KARAOKE_SUPABASE_SERVICE_ROLE_KEY).',
    );
  }
  return { url, key };
}

/**
 * Read an optional env var, hydrating from .dev.vars first (dev) so keys like
 * YOUTUBE_API_KEY resolve under `next dev`, which does not read .dev.vars.
 * Returns undefined when unset/blank. Never logs the value.
 */
export function optionalEnv(name: string): string | undefined {
  hydrateFromDevVars();
  const v = process.env[name];
  return v && v.trim() ? v.trim() : undefined;
}
