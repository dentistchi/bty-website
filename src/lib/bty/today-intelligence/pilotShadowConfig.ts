/**
 * BTY Today AI Mirror — pilot shadow CONFIGURATION GATE (server-only, value-safe).
 *
 * The narrowest possible loader for the two controlled-pilot env vars. It reads them IN MEMORY,
 * validates shape/validity, and returns a value-safe result. It NEVER prints, logs, throws-with,
 * hashes, or fingerprints either value; a rejection reason is a fixed machine code only.
 *
 * Guarantees enforced here (so nothing downstream has to):
 *  - missing / invalid pilot id       → blocked (no reader may run)
 *  - missing / invalid pilot timezone → blocked; UTC is NEVER silently substituted for an
 *    invalid controlled pilot timezone (UTC remains a fallback only in generic product utilities)
 *  - E2E_ / SMOKE_ / cleanup / fixture identities are rejected, never used as a fallback
 *  - a resolver by email is intentionally absent
 *
 * Dependency-injectable (`env`) so tests never touch process.env or the real secret values.
 */

/** Value-safe outcome. On failure, `reason` is a fixed code — never the offending value. */
export type PilotShadowConfigResult =
  | { ok: true; config: { userId: string; timezone: string } }
  | {
      ok: false;
      reason:
        | "PILOT_ID_MISSING"
        | "PILOT_ID_INVALID"
        | "PILOT_TIMEZONE_MISSING"
        | "PILOT_TIMEZONE_INVALID";
    };

type EnvSource = Record<string, string | undefined>;

const PILOT_ID_ENV = "TODAY_MIRROR_PILOT_USER_ID";
const PILOT_TZ_ENV = "TODAY_MIRROR_PILOT_TIMEZONE";

/** Canonical UUID shape (any version). Validates the id's SHAPE without reporting it. */
const UUID_SHAPE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Fixture/test identity markers that must never be accepted as the controlled pilot. */
const FIXTURE_MARKER = /(^|[_\-.:])(e2e|smoke|cleanup|fixture|seed|test)([_\-.:]|$)/i;

/** Value-safe timezone validity via ECMA-402 (invalid IANA ids make Intl throw). */
export function isValidIanaTimezone(tz: string): boolean {
  if (typeof tz !== "string" || tz.trim() === "") return false;
  try {
    // Constructing the formatter throws RangeError on an unknown time zone id.
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

/**
 * Load + validate the controlled pilot configuration. Never throws. Reads only the two named
 * env vars from `env` (defaults to process.env) — there is no email lookup and no fixture fallback.
 */
export function loadPilotShadowConfig(env: EnvSource = process.env): PilotShadowConfigResult {
  const rawId = env[PILOT_ID_ENV];
  const rawTz = env[PILOT_TZ_ENV];

  // ── pilot identity ──
  if (rawId == null || rawId.trim() === "") return { ok: false, reason: "PILOT_ID_MISSING" };
  const id = rawId.trim();
  if (FIXTURE_MARKER.test(id) || !UUID_SHAPE.test(id)) return { ok: false, reason: "PILOT_ID_INVALID" };

  // ── pilot timezone (no silent UTC substitution) ──
  if (rawTz == null || rawTz.trim() === "") return { ok: false, reason: "PILOT_TIMEZONE_MISSING" };
  const tz = rawTz.trim();
  if (!isValidIanaTimezone(tz)) return { ok: false, reason: "PILOT_TIMEZONE_INVALID" };

  return { ok: true, config: { userId: id, timezone: tz } };
}
