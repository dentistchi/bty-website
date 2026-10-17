/**
 * AI PATIENT — matching a quote to the learner's own turn (pure, client-safe).
 *
 * Kept apart from feedback.ts so the coaching view, which the screen imports, never pulls a case file
 * (and its hidden concerns) into the browser bundle or its source map.
 */

import type { Turn } from "./sessionRules";

export const normalizeQuote = (s: string): string =>
  s
    .toLowerCase()
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[^a-z0-9'$%\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

/** The learner turn a quote came from, or -1. */
export function turnOfQuote(quote: string, turns: Turn[]): number {
  const q = normalizeQuote(quote);
  if (q.length < 3) return -1;
  return turns.findIndex((t) => t.role === "tc" && normalizeQuote(t.text).includes(q));
}
