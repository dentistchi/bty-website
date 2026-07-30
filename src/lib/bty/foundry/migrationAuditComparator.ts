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

import { createHash } from "node:crypto";

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
  auditSchemaVersion?: string;
  expectedManifestDigest?: string;
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
  auditSchemaVersion?: string;
  effects: LiveEffect[];
}

/** Thrown by ingest/handshake — the input is rejected BEFORE any comparison (Gates 7–8). */
export class AuditPacketError extends Error {}

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

export interface CompareTotals {
  effects: number;
  exact: number;
  conflict: number;
  missing: number;
  evidenceAbsent: number;
  manual: number;
}

export interface CompareReport {
  postgresMajorMatch: boolean;
  expectedMajor: number;
  liveMajor: number;
  totals: CompareTotals;
  effects: EffectResult[];
  migrations: (MigrationResult & { blockingEffectIds: string[] })[];
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
  const migrations = [...byMig.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([migration, effs]) => ({
      migration,
      ...verdictFor(effs),
      effects: effs,
      blockingEffectIds: effs.filter((e) => e.status !== "EXACT_MATCH").map((e) => e.effectId),
    }));
  const count = (s: EffectStatus) => effects.filter((e) => e.status === s).length;
  return {
    postgresMajorMatch: majorOf(expected.postgresServerVersionNum) === majorOf(live.serverVersionNum),
    expectedMajor: majorOf(expected.postgresServerVersionNum),
    liveMajor: majorOf(live.serverVersionNum),
    totals: {
      effects: effects.length, exact: count("EXACT_MATCH"), conflict: count("CONFLICT"),
      missing: count("MISSING_OBJECT"), evidenceAbsent: count("EVIDENCE_ABSENT"), manual: count("MANUAL"),
    },
    effects,
    migrations,
  };
}

// ---------------------------------------------------------------------------
// Packet integrity + ingest (Gates 7–8) — reject a mismatched/malformed input BEFORE comparison.
// ---------------------------------------------------------------------------

/** Stable digest of the manifest's effects — matches the generator's expectedManifestDigest. */
export function computeEffectsDigest(effects: ExpectedEffect[]): string {
  return createHash("sha256").update(JSON.stringify(effects)).digest("hex");
}

/** Throws if the checked-in manifest was hand-tampered (effects no longer match its digest). */
export function assertManifestIntegrity(expected: ExpectedManifest): void {
  if (!expected.expectedManifestDigest) throw new AuditPacketError("manifest missing expectedManifestDigest");
  const actual = computeEffectsDigest(expected.effects);
  if (actual !== expected.expectedManifestDigest) {
    throw new AuditPacketError(`manifest digest mismatch (hand-edited?): expected ${expected.expectedManifestDigest}, computed ${actual}`);
  }
}

/** The version/coverage handshake (Gate 7). Throws AuditPacketError on any mismatch. */
export function assertPacketHandshake(expected: ExpectedManifest, live: LiveAudit): void {
  if (!live || typeof live !== "object") throw new AuditPacketError("live audit is not an object");
  if (!Array.isArray(live.effects)) throw new AuditPacketError("live audit has no effects array (truncated?)");
  if (typeof live.serverVersionNum !== "number") throw new AuditPacketError("live audit missing serverVersionNum");
  if (!live.auditSchemaVersion) throw new AuditPacketError("live audit missing auditSchemaVersion");
  if (expected.auditSchemaVersion && live.auditSchemaVersion !== expected.auditSchemaVersion) {
    throw new AuditPacketError(`audit schema version mismatch: manifest ${expected.auditSchemaVersion} vs result ${live.auditSchemaVersion} — re-run the current audit query`);
  }
  const seen = new Set<string>();
  for (const e of live.effects) {
    if (!e.effectId) throw new AuditPacketError("live effect missing effectId");
    if (seen.has(e.effectId)) throw new AuditPacketError(`duplicate live effectId: ${e.effectId}`);
    seen.add(e.effectId);
  }
  const expectedIds = new Set(expected.effects.map((e) => e.effectId));
  const unknown = [...seen].filter((id) => !expectedIds.has(id));
  if (unknown.length) throw new AuditPacketError(`unknown live effectIds not in manifest (wrong query version?): ${unknown.slice(0, 3).join(", ")}`);
  // Gross truncation: far fewer rows than the manifest expects.
  if (live.effects.length < expected.effects.length / 2) {
    throw new AuditPacketError(`live audit looks truncated: ${live.effects.length} effects vs ${expected.effects.length} expected`);
  }
}

/** Parse a live audit result from the Supabase SQL Editor: raw JSON, a {audit:…} wrapper, or the
 * single-cell CSV export. Rejects HTML/error pages, multiple payload rows, and malformed JSON. */
export function parseLiveAudit(raw: string): LiveAudit {
  const text = raw.trim();
  if (!text) throw new AuditPacketError("empty input");
  if (text.startsWith("<")) throw new AuditPacketError("input looks like an HTML/error page, not a JSON result");

  let payload = text;
  if (text[0] !== "{" && text[0] !== "[") {
    // CSV path: a header line (contains "audit") then EXACTLY one data row holding the JSON cell.
    const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
    if (lines.length < 2) throw new AuditPacketError("CSV export has no data row");
    const dataRows = lines.slice(1);
    if (dataRows.length !== 1) throw new AuditPacketError(`CSV export has ${dataRows.length} data rows — expected exactly one JSON payload`);
    let cell = dataRows[0].trim();
    if (cell.startsWith('"') && cell.endsWith('"')) cell = cell.slice(1, -1).replace(/""/g, '"'); // unquote CSV
    payload = cell;
  }
  let obj: unknown;
  try {
    obj = JSON.parse(payload);
  } catch {
    throw new AuditPacketError("malformed or truncated JSON payload");
  }
  if (obj && typeof obj === "object" && "audit" in (obj as Record<string, unknown>) && !("effects" in (obj as Record<string, unknown>))) {
    obj = (obj as Record<string, unknown>).audit; // unwrap a { audit: {...} } column
  }
  if (!obj || typeof obj !== "object" || !Array.isArray((obj as LiveAudit).effects)) {
    throw new AuditPacketError("parsed payload is not a live audit result");
  }
  return obj as LiveAudit;
}
