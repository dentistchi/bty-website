/**
 * livingResponseGuardPhrases (domain) — the canonical, server-owned set of phrases a Living Response
 * must never restate: the pre-confirm CTA, the confirmed CTA, and the per-relationship benedictions,
 * in EN and KO. Pure.
 *
 * These MIRROR the shell's locked COPY (BtyDailyAppShell). A drift test asserts equality so the two
 * can never silently diverge — the server does NOT read the client component, and the visible copy is
 * unchanged. `isRestatement` rejects exact repeats AND near-restatements (case, apostrophes,
 * punctuation, whitespace, Unicode form, substring containment, and ending-only KO/EN variants).
 */

export type GuardLocale = "en" | "ko";
export type GuardRelationship = "self" | "others" | "world";

export const LIVING_RESPONSE_GUARD_PHRASES: Record<
  GuardLocale,
  { cta: string; ctaDone: string; benediction: Record<GuardRelationship | "fallback", string> }
> = {
  en: {
    cta: "I’ll live this relationship today",
    ctaDone: "I’m living this relationship today",
    benediction: {
      self: "You have entered the relationship with yourself today.",
      others: "You have entered the relationship with others today.",
      world: "You have entered the relationship with the world today.",
      fallback: "You have entered this relationship for today.",
    },
  },
  ko: {
    cta: "오늘 이 관계로 살아갑니다",
    ctaDone: "오늘 이 관계 안에 있습니다",
    benediction: {
      self: "오늘 당신은 나와의 관계 안으로 들어갔습니다.",
      others: "오늘 당신은 이웃과의 관계 안으로 들어갔습니다.",
      world: "오늘 당신은 세상과의 관계 안으로 들어갔습니다.",
      fallback: "오늘 당신은 이 관계 안에 머뭅니다.",
    },
  },
};

/** The phrases a Living Response for (locale, relationship) must not restate. */
export function guardPhrasesFor(locale: string | null, relationship: GuardRelationship): string[] {
  const loc: GuardLocale = locale === "ko" ? "ko" : "en";
  const g = LIVING_RESPONSE_GUARD_PHRASES[loc];
  // Both CTA states + this relationship's benediction + the fallback benediction. (All benedictions
  // for the locale are included so a line matching any of them is rejected.)
  return [g.cta, g.ctaDone, ...Object.values(g.benediction)];
}

/** Normalize away case, apostrophes/quotes, punctuation, whitespace, and Unicode form. */
export function normalizeGuard(s: string): string {
  return (s ?? "")
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[‘’′'`]/g, "")
    .replace(/[“”"]/g, "")
    .replace(/[.,!?;:…。．！？\-–—()[\]{}]/g, "")
    .replace(/\s+/g, "")
    .trim();
}

// Trailing endings whose change alone should NOT defeat the guard (KO 종결어미 + EN contraction tails).
const TRAILING = /(습니다|합니다|입니다|ㅂ니다|니다|어요|아요|에요|예요|해요|요|다)$/;
function coreOf(norm: string): string {
  return norm.replace(TRAILING, "");
}
function commonPrefixRatio(a: string, b: string): number {
  const n = Math.min(a.length, b.length);
  if (n === 0) return 0;
  let i = 0;
  while (i < n && a[i] === b[i]) i++;
  return i / n;
}

/**
 * True when `text` restates any guard phrase: exact (post-normalize), substring containment either
 * way, matching cores after trailing-ending strip, or a very high common-prefix ratio (ending-only
 * near-duplicate). Guards shorter than 6 normalized chars are compared by exact/substring only.
 */
export function isRestatement(text: string, guards: string[]): boolean {
  const c = normalizeGuard(text);
  if (c.length === 0) return false;
  const cCore = coreOf(c);
  for (const g of guards) {
    const ng = normalizeGuard(g);
    if (ng.length === 0) continue;
    if (c === ng) return true;
    if (ng.length >= 6 && (c.includes(ng) || ng.includes(c))) return true;
    if (ng.length >= 6) {
      if (cCore.length >= 4 && cCore === coreOf(ng)) return true;
      if (commonPrefixRatio(c, ng) >= 0.8 && Math.min(c.length, ng.length) >= 8) return true;
    }
  }
  return false;
}
