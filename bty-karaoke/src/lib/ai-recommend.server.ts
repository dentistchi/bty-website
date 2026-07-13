// Optional AI recommendation provider — behind a boundary. It returns ONLY
// candidate title/artist SEARCH STRINGS (never video ids); those are resolved to
// real videos through the existing YouTube path. It must NEVER block the primary
// search, and any absence/failure/timeout falls back to deterministic
// recommendations. V1 ships with no provider configured.

import { optionalEnv } from './env.server';
import type { RecoSource } from '@/domain/recommendations';

/** Cap so a slow provider can't stall recommendation resolution. */
export const AI_RECO_TIMEOUT_MS = 2500;

/**
 * Returns AI-suggested candidate queries, or null to signal "use the
 * deterministic path". Enabled only when KARAOKE_AI_RECOMMEND is set AND a
 * provider is wired. Bounded by a timeout; any error resolves to null.
 */
export async function maybeAiRecommendationQueries(
  source: RecoSource,
): Promise<string[] | null> {
  if (!optionalEnv('KARAOKE_AI_RECOMMEND')) return null; // deterministic path (default)

  try {
    // A real provider call would go here, wrapped in a timeout, returning
    // title/artist strings only. Intentionally not wired in V1 (no provider),
    // so we fall through to deterministic recommendations.
    void source;
    return null;
  } catch {
    return null;
  }
}
