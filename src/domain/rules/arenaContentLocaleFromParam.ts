/**
 * Arena content locale from query/body param (display only).
 * Weekly rank / season unrelated.
 */

export type ArenaContentLocale = "en" | "ko";

/**
 * Normalizes a raw locale param to supported content locale.
 * Only "ko" (case-sensitive) → "ko"; otherwise "en".
 */
export function arenaContentLocaleFromParam(
  param: string | null | undefined,
): ArenaContentLocale {
  return param === "ko" ? "ko" : "en";
}
