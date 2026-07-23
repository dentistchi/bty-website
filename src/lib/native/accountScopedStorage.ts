/**
 * Account-scoped client storage reset (Slice 3.1B-3N-5B.1). Called on a SUCCESSFUL auth callback
 * (i.e. after the new session is established) so a previous account's drafts / progress / cached
 * personal state cannot flash or persist after an account switch. A cancelled switch never reaches
 * the callback, so the previous account's data is preserved (no destructive pre-clear).
 *
 * SAFETY: the freshly-written Supabase session (`sb-*` auth token) and device-wide preferences are
 * PRESERVED — only account-scoped BTY app keys are removed. Never throws into the caller.
 */

/** Account-scoped BTY app key prefixes (drafts, arena progress, reflections, onboarding, etc.). */
const ACCOUNT_SCOPED_PREFIXES = [
  "btyArena",
  "bty_",
  "bty-arena",
  "assessment.",
  "dojo.",
  "reflection",
  "mission",
  "signal",
];

/** Preserve the live Supabase session + anything clearly device-wide (not account-specific). */
function preserve(key: string): boolean {
  const k = key.toLowerCase();
  return (
    key.startsWith("sb-") ||
    k.startsWith("supabase") ||
    k.includes("theme") ||
    k.includes("consent") ||
    k.includes("reduce-motion") ||
    k.includes("haptic")
  );
}

function clearStore(store: Storage): void {
  const keys: string[] = [];
  for (let i = 0; i < store.length; i++) {
    const k = store.key(i);
    if (k) keys.push(k);
  }
  for (const k of keys) {
    if (preserve(k)) continue;
    if (ACCOUNT_SCOPED_PREFIXES.some((p) => k.startsWith(p))) {
      try {
        store.removeItem(k);
      } catch {
        /* ignore a single key removal failure */
      }
    }
  }
}

export function clearAccountScopedStorage(): void {
  if (typeof window === "undefined") return;
  try {
    clearStore(window.localStorage);
  } catch {
    /* storage unavailable */
  }
  try {
    clearStore(window.sessionStorage);
  } catch {
    /* storage unavailable */
  }
}
