// Pure, deterministic Room-slug derivation for first-room onboarding.
//
// The Host supplies only a display name; the canonical `/r/{slug}/admin` slug is
// generated server-side. This module holds the PURE part — turning a display name
// into a URL-safe base — so it is trivially testable and can never reach the
// database or the network. The unique random suffix (the part that guarantees
// global uniqueness and collision-safety) is supplied by the caller from a CSPRNG;
// the slug is `${base}-${suffix}`.
//
// Slug requirements this satisfies:
//   - URL-safe: only lowercase [a-z0-9] and single hyphens survive.
//   - Not derived from private account data: the base comes ONLY from the public
//     display name the Host typed — never from email, provider subject, or ids.
//   - Stable: a pure function of its inputs; the caller persists the result once.
//   - Non-ASCII-safe: a Korean/emoji-only name normalizes away to the neutral
//     'norebang' base, so the slug never leaks raw characters and never renders
//     empty. Uniqueness then rests entirely on the random suffix.

/** The URL-safe base for a Room slug, from the Host's display name. Never empty. */
export function slugBaseFromName(name: string): string {
  const base = (name ?? '')
    .normalize('NFKD')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-') // any run of non [a-z0-9] → one hyphen
    .replace(/-{2,}/g, '-') //       collapse repeats
    .replace(/^-+|-+$/g, '') //      trim leading/trailing hyphens
    .slice(0, 24) //                bound the readable prefix
    .replace(/-+$/g, ''); //        re-trim if the slice cut mid-hyphen
  return base || 'norebang';
}

/** Compose the full Room slug: `${base-from-name}-${random-suffix}`. */
export function buildRoomSlug(name: string, suffix: string): string {
  return `${slugBaseFromName(name)}-${suffix}`;
}
