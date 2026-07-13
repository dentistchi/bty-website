// Pure guest-identity helpers. The guest name is a convenience label remembered
// on the device — NEVER authentication and never a new DB field. Scoped per room
// so different rooms on the same device don't share a name.

export const GUEST_NAME_MAX = 40;

/** localStorage key for the remembered guest name, scoped by room slug. */
export function guestNameKey(slug: string): string {
  return `bty-karaoke:${slug}:guest-name`;
}

/** Collapse whitespace, trim, cap length — apply before storing or sending. */
export function normalizeGuestName(raw: string | null | undefined): string {
  return (raw ?? '').replace(/\s+/g, ' ').trim().slice(0, GUEST_NAME_MAX);
}

/** A name is usable iff it normalizes to 1..MAX visible characters. */
export function isValidGuestName(raw: string | null | undefined): boolean {
  const n = normalizeGuestName(raw);
  return n.length >= 1 && n.length <= GUEST_NAME_MAX;
}
