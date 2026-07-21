/**
 * Sanitize a Foundry Room `?return=` target (Slice 3.1B-3E.1, contract C).
 *
 * When a Required assignment opens the live Room from the installed app, it carries a
 * same-origin return target so the Room can show a "Back to Foundry" control. This must be
 * strict: only the app shell (`/{en|ko}/app…`) is a valid destination; anything external,
 * protocol-relative, or malformed returns null (no back control, never an open redirect).
 */
export function sanitizeRoomReturn(raw: string | null | undefined): string | null {
  if (raw == null) return null;
  let p: string;
  try {
    p = decodeURIComponent(String(raw)).trim();
  } catch {
    return null;
  }
  if (!p) return null;
  if (!p.startsWith("/")) return null; // must be same-origin relative
  if (p.includes("://") || p.includes("//") || p.includes("\\")) return null; // no host/protocol
  // ONLY the installed-app shell is an allowed return surface.
  if (!/^\/(en|ko)\/app(\?|\/|$)/.test(p)) return null;
  return p;
}
