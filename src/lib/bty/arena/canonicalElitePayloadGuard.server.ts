/**
 * Server regression guard: canonical elite payloads must not contain known legacy bundled-copy markers.
 * Approved chain workspace for the three active ids does not use these strings; if they appear, something
 * reintroduced stale elite JSON or a hybrid path.
 *
 * Note: legitimate core_01 copy may contain "Medicaid" (eligibility verification) — not forbidden here.
 */

const LEGACY_SUBSTRINGS: readonly string[] = [
  "pre-dso",
  "34 patients",
  "float pool",
  "she's beloved by legacy staff",
  "informal lead over your written",
];

/**
 * @throws Error if serialized payload contains a legacy leak marker.
 */
export function assertCanonicalEliteNoLegacyLeak(s: { id: string }): void {
  const raw = JSON.stringify(s);
  const blob = raw.toLowerCase();
  for (const m of LEGACY_SUBSTRINGS) {
    if (blob.includes(m)) {
      throw new Error(`[elite] canonical_legacy_leak: forbidden marker "${m}" in scenario ${s.id}`);
    }
  }
  if (/\bdso\b/i.test(raw)) {
    throw new Error(`[elite] canonical_legacy_leak: forbidden marker "DSO" in scenario ${s.id}`);
  }
}
