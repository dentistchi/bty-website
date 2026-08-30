/**
 * One-way fingerprints for identity audit lines. Slice T1.
 *
 * The Teams path must be provable without ever writing a tenant id or an Entra `oid` into a log.
 * A fingerprint is SHA-256 truncated to 8 hex characters: enough to confirm that two observations
 * are the same identifier, useless for recovering it. Same technique the M1–M5 audits used to
 * compare identity across the purge without printing anything.
 *
 * Inputs are lower-cased first because Entra GUIDs are case-insensitive while string hashing is
 * not — an unnormalised fingerprint could show a "mismatch" between two spellings of one identity,
 * which is precisely the false alarm this is meant to rule out.
 */
export async function identifierFingerprint(value: string): Promise<string> {
  const v = (value ?? "").trim().toLowerCase();
  if (v === "") return "-";
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(v));
  return Array.from(new Uint8Array(buf))
    .slice(0, 4)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
