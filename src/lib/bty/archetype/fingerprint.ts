/** Archetype Determinism Lock v1 — fingerprint builder. */

export const FINGERPRINT_VERSION = 1 as const;
const AXIS_PRECISION = 2; // floor(x * 100) / 100

export type AxisVector = {
  ownership: number;
  time: number;
  authority: number;
  truth: number;
  repair: number;
  conflict: number;
  integrity: number;
  visibility: number;
  accountability: number;
  courage: number;
  control: number;
  identity: number;
};

export type FingerprintInput = {
  axisVector: AxisVector;
  patternFamilies: string[];
  scenariosCompleted: number;
  contractsCompleted: number;
};

const SCALE = 10 ** AXIS_PRECISION;

function truncate(x: number): number {
  const clamped = Math.max(0, Math.min(1, x));
  return Math.floor(clamped * SCALE) / SCALE;
}

async function sha256hex(s: string): Promise<string> {
  const buf = new TextEncoder().encode(s);
  const hashBuf = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(hashBuf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Produces a deterministic hash from the fingerprint input.
 * Same input (after normalization) → same inputHash, every time.
 *
 * Normalization guarantees:
 *   1. Float truncation: Math.floor(x*100)/100
 *   2. JSON axis keys sorted alphabetically
 *   3. Pattern families: dedup + sort + lowercase
 *   4. Version stamped in canonical form
 */
export async function buildArchetypeFingerprint(input: FingerprintInput): Promise<{
  inputHash: string;
  canonicalForm: string;
  version: typeof FINGERPRINT_VERSION;
}> {
  const axisKeys = (Object.keys(input.axisVector) as (keyof AxisVector)[]).sort();
  const normalizedAxis: Record<string, number> = {};
  for (const k of axisKeys) {
    normalizedAxis[k] = truncate(input.axisVector[k]);
  }

  const patterns = [...new Set(input.patternFamilies.map((p) => p.toLowerCase()))].sort();

  const canonical = {
    axis: normalizedAxis,
    patterns,
    s: input.scenariosCompleted,
    c: input.contractsCompleted,
    v: FINGERPRINT_VERSION,
  };

  const canonicalForm = JSON.stringify(canonical);
  const inputHash = await sha256hex(canonicalForm);

  return { inputHash, canonicalForm, version: FINGERPRINT_VERSION };
}
