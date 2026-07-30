/**
 * Offline comparator for the Foundry migration provenance audit (Slice 3.2I-R5B1A.1-R2.2).
 *
 * PURE: given the checked-in EXPECTED catalog manifest (built by replaying the historical
 * migrations on disposable Postgres) and a LIVE read-only audit result (exported from the Supabase
 * SQL Editor via the SAME canonical query), it reports an effect-by-effect comparison and a
 * per-migration verdict CANDIDATE. It NEVER executes SQL, repair, or apply, and never claims a
 * verdict from object-name existence alone — every material effect must match.
 *
 * Verdict candidates emitted: only A / D / E. B and C require provenance + product-necessity
 * reasoning a catalog diff cannot supply, so they are never emitted here.
 */

export type EffectComparisonMode = "structured" | "structured+digest" | "structured+body_digest" | string;

export interface ExpectedEffect {
  effectId: string;
  objectType: string;
  objectIdentity: string;
  properties: unknown;
  definitionDigest: string | null;
  comparisonMode: EffectComparisonMode;
  autoComparable: boolean;
  manualReason: string | null;
  migrationVersion: string;
  finalAuthorityMigration: string;
}

export interface ExpectedManifest {
  postgresServerVersionNum: number;
  effects: ExpectedEffect[];
}

export interface LiveEffect {
  effectId: string;
  properties?: unknown;
  definitionDigest?: string | null;
  /** When the live audit could not gather evidence for this effect (vs. the object simply not existing). */
  evidenceStatus?: "MISSING" | "PRESENT";
}

export interface LiveAudit {
  serverVersionNum: number;
  effects: LiveEffect[];
}

export type EffectStatus =
  | "EXACT_MATCH"
  | "CONFLICT"
  | "MISSING_OBJECT" // object absent live (schema not applied) → D signal
  | "EVIDENCE_ABSENT" // audit could not report this effect → E signal
  | "MANUAL"; // needs manual exact review (e.g. cross-PG-major digest)

export interface EffectResult {
  effectId: string;
  finalAuthorityMigration: string;
  status: EffectStatus;
  detail: string;
}

export type MigrationVerdict = "A" | "D" | "E";

export interface MigrationResult {
  migration: string;
  verdict: MigrationVerdict;
  repairEligible: boolean;
  effects: EffectResult[];
}

export interface CompareReport {
  postgresMajorMatch: boolean;
  expectedMajor: number;
  liveMajor: number;
  effects: EffectResult[];
  migrations: MigrationResult[];
}

const majorOf = (n: number): number => Math.floor(n / 10000);

function stableStringify(v: unknown): string {
  if (v === null || typeof v !== "object") return JSON.stringify(v);
  if (Array.isArray(v)) return `[${v.map(stableStringify).join(",")}]`;
  const keys = Object.keys(v as Record<string, unknown>).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${stableStringify((v as Record<string, unknown>)[k])}`).join(",")}}`;
}
const deepEqual = (a: unknown, b: unknown): boolean => stableStringify(a) === stableStringify(b);

/** Compare one expected effect against the live audit. `expectedPgNum` gates cross-major digests. */
function compareEffect(exp: ExpectedEffect, live: LiveAudit, expectedPgNum: number): EffectResult {
  const base = { effectId: exp.effectId, finalAuthorityMigration: exp.finalAuthorityMigration };
  const liveEff = live.effects.find((e) => e.effectId === exp.effectId);

  if (!liveEff) {
    return { ...base, status: "MISSING_OBJECT", detail: "object not present in live audit (schema effect absent)" };
  }
  if (liveEff.evidenceStatus === "MISSING") {
    return { ...base, status: "EVIDENCE_ABSENT", detail: "live audit reported no evidence for this effect" };
  }
  if (exp.autoComparable === false || /manual/i.test(exp.comparisonMode) || exp.manualReason) {
    return { ...base, status: "MANUAL", detail: exp.manualReason ?? "manual review required" };
  }

  // Structured properties must always match — a structural difference is a real conflict regardless
  // of PostgreSQL version.
  if (!deepEqual(exp.properties, liveEff.properties)) {
    return { ...base, status: "CONFLICT", detail: "structured properties differ" };
  }

  if (/digest/.test(exp.comparisonMode)) {
    if (majorOf(live.serverVersionNum) !== majorOf(expectedPgNum)) {
      return { ...base, status: "MANUAL", detail: "digest not comparable across PostgreSQL major versions — manual exact review required" };
    }
    if ((exp.definitionDigest ?? null) !== (liveEff.definitionDigest ?? null)) {
      return { ...base, status: "CONFLICT", detail: "definition/body digest differs" };
    }
    return { ...base, status: "EXACT_MATCH", detail: "structured properties + digest match" };
  }
  return { ...base, status: "EXACT_MATCH", detail: "structured properties match" };
}

function verdictFor(effects: EffectResult[]): { verdict: MigrationVerdict; repairEligible: boolean } {
  if (effects.length === 0) return { verdict: "E", repairEligible: false };
  const all = (s: EffectStatus) => effects.every((e) => e.status === s);
  const any = (s: EffectStatus) => effects.some((e) => e.status === s);
  if (all("EXACT_MATCH")) return { verdict: "A", repairEligible: true };
  const hasConflict = any("CONFLICT");
  const hasMissingObject = any("MISSING_OBJECT");
  const hasEvidenceGap = any("EVIDENCE_ABSENT") || any("MANUAL");
  // A definite conflict or a missing schema object (with other evidence present) → PARTIAL/CONFLICTING.
  if (hasConflict || hasMissingObject) return { verdict: "D", repairEligible: false };
  // Otherwise the only thing standing between us and A is unresolved evidence/manual review → E.
  if (hasEvidenceGap) return { verdict: "E", repairEligible: false };
  return { verdict: "D", repairEligible: false };
}

export function compareMigrationAudit(expected: ExpectedManifest, live: LiveAudit): CompareReport {
  const effects = expected.effects.map((e) => compareEffect(e, live, expected.postgresServerVersionNum));
  const byMig = new Map<string, EffectResult[]>();
  for (const r of effects) {
    const list = byMig.get(r.finalAuthorityMigration) ?? [];
    list.push(r);
    byMig.set(r.finalAuthorityMigration, list);
  }
  const migrations: MigrationResult[] = [...byMig.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([migration, effs]) => ({ migration, ...verdictFor(effs), effects: effs }));
  return {
    postgresMajorMatch: majorOf(expected.postgresServerVersionNum) === majorOf(live.serverVersionNum),
    expectedMajor: majorOf(expected.postgresServerVersionNum),
    liveMajor: majorOf(live.serverVersionNum),
    effects,
    migrations,
  };
}
