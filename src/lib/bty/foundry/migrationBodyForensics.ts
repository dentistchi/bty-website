/**
 * Live FUNCTION BODY forensics — ingest + verification (Slice 3.2I-R5B1A.1-R2.7).
 *
 * PURE: no DB, no I/O. Given a trusted read-only body export and the ALREADY-ATTESTED r2.6 live
 * audit result, it decides whether each exported body may be believed.
 *
 * TRUST MODEL. The body export carries no packet of its own — deliberately, so that publishing it
 * does not invalidate the r2.6 audit packet that is the current authoritative evidence. Its trust
 * anchor is that packet instead: the r2.6 audit independently measured SHA-256(raw prosrc) for every
 * audited function under a verified runtime-query attestation. An exported body is accepted ONLY if
 * it hashes to that already-attested digest. So a tampered, truncated, re-indented or hand-edited
 * export cannot be laundered into the forensic harness — the digest simply will not match.
 *
 * This module never decides which body is CANONICAL. It only decides which body text is AUTHENTIC.
 */

import { createHash } from "node:crypto";

export class BodyExportError extends Error {}

export interface ExportedFunction {
  proname: string;
  identityArgs: string;
  result: string;
  language: string;
  securityDefiner: boolean;
  proconfig: string[] | null;
  prosrc: string;
  prosrcSha256: string;
}

export interface LiveBodyExport {
  exportKind: string;
  exportContractVersion: string;
  boundPacketId: string;
  serverVersionNum: number;
  functions: ExportedFunction[];
}

export const BODY_EXPORT_CONTRACT_VERSION = "r2.7";

const sha256 = (s: string) => createHash("sha256").update(Buffer.from(s, "utf8")).digest("hex");

/** The audited functions whose live body this slice needs, keyed by proname. */
export const AUDITED_FUNCTIONS = [
  "bty_foundry_set_shared_review",
  "bty_foundry_materialize_followup",
  "bty_foundry_submit_followup",
  "bty_foundry_get_my_followup",
] as const;

/** Parse a body export: raw JSON, a { body_export: … } wrapper, or the single-cell CSV export. */
export function parseBodyExport(raw: string): LiveBodyExport {
  const text = raw.trim();
  if (!text) throw new BodyExportError("empty input");
  if (text.startsWith("<")) throw new BodyExportError("input looks like an HTML/error page, not a JSON result");

  let payload = text;
  if (text[0] !== "{" && text[0] !== "[") {
    const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
    if (lines.length < 2) throw new BodyExportError("CSV export has no data row");
    const dataRows = lines.slice(1);
    if (dataRows.length !== 1) throw new BodyExportError(`CSV export has ${dataRows.length} data rows — expected exactly one JSON payload`);
    let cell = dataRows[0].trim();
    if (cell.startsWith('"') && cell.endsWith('"')) cell = cell.slice(1, -1).replace(/""/g, '"');
    payload = cell;
  }
  let obj: unknown;
  try {
    obj = JSON.parse(payload);
  } catch {
    throw new BodyExportError("malformed or truncated JSON payload");
  }
  if (obj && typeof obj === "object" && "body_export" in (obj as Record<string, unknown>)) {
    obj = (obj as Record<string, unknown>).body_export;
  }
  const e = obj as LiveBodyExport;
  if (!e || typeof e !== "object" || !Array.isArray(e.functions)) {
    throw new BodyExportError("parsed payload is not a function body export");
  }
  if (e.exportKind !== "foundry_function_body_export") throw new BodyExportError("not a foundry_function_body_export");
  if (e.exportContractVersion !== BODY_EXPORT_CONTRACT_VERSION) {
    throw new BodyExportError(`body export contract mismatch: export ${e.exportContractVersion} vs binary ${BODY_EXPORT_CONTRACT_VERSION}`);
  }
  if (typeof e.serverVersionNum !== "number") throw new BodyExportError("body export missing serverVersionNum");
  return e;
}

/** The attested digests the r2.6 audit measured, keyed by proname. */
export function attestedBodyDigests(liveAuditResult: {
  packetId?: string;
  serverVersionNum?: number;
  effects?: Array<{ effectId: string; definitionDigest?: string | null }>;
}): { packetId: string; serverVersionNum: number; digests: Record<string, string> } {
  if (!liveAuditResult?.packetId) throw new BodyExportError("live audit result missing packetId");
  if (!Array.isArray(liveAuditResult.effects)) throw new BodyExportError("live audit result missing effects");
  const digests: Record<string, string> = {};
  for (const eff of liveAuditResult.effects) {
    const m = /^function:public\.([a-z0-9_]+)\(/.exec(eff.effectId);
    if (m && eff.definitionDigest) digests[m[1]] = eff.definitionDigest;
  }
  return { packetId: liveAuditResult.packetId, serverVersionNum: liveAuditResult.serverVersionNum ?? 0, digests };
}

export interface BodyVerification {
  proname: string;
  /** Digest recomputed from the exported text — never trusted from the export's own field. */
  computedSha256: string;
  attestedSha256: string | null;
  /** The export's self-reported digest; a mismatch means the export itself is internally inconsistent. */
  selfReportedSha256: string;
  authentic: boolean;
  reason: string;
}

/**
 * Verify each exported body against the r2.6-attested digests. A body is AUTHENTIC only when the
 * digest RECOMPUTED from its text equals the independently attested digest. The export's own
 * `prosrcSha256` is checked too, but never substituted for the attested value.
 */
export function verifyBodyExport(
  exported: LiveBodyExport,
  attested: { packetId: string; serverVersionNum: number; digests: Record<string, string> },
): { boundPacketOk: boolean; serverMajorOk: boolean; results: BodyVerification[]; allAuthentic: boolean } {
  const boundPacketOk = exported.boundPacketId === attested.packetId;
  const majorOf = (n: number) => Math.floor(n / 10000);
  const serverMajorOk = majorOf(exported.serverVersionNum) === majorOf(attested.serverVersionNum);

  const results: BodyVerification[] = exported.functions.map((f) => {
    const computed = sha256(f.prosrc);
    const att = attested.digests[f.proname] ?? null;
    let authentic = false;
    let reason: string;
    if (!boundPacketOk) {
      reason = "export is bound to a different packetId than the attested audit result";
    } else if (computed !== f.prosrcSha256) {
      reason = "export is internally inconsistent (text does not match its own prosrcSha256)";
    } else if (att === null) {
      reason = "no attested digest for this function in the audit result";
    } else if (computed !== att) {
      reason = `text does not hash to the attested digest (${computed.slice(0, 12)}… vs ${att.slice(0, 12)}…)`;
    } else {
      authentic = true;
      reason = "matches the r2.6-attested digest";
    }
    return { proname: f.proname, computedSha256: computed, attestedSha256: att, selfReportedSha256: f.prosrcSha256, authentic, reason };
  });

  return { boundPacketOk, serverMajorOk, results, allAuthentic: results.length > 0 && results.every((r) => r.authentic) };
}

/**
 * Render an authentic exported body as a `create or replace function` statement the disposable-
 * PostgreSQL forensic harness can install. Uses a dollar-quote tag that cannot occur in the body.
 * Refuses to render a body that was not verified — an unauthenticated body must never reach the
 * harness, or the harness would report behavior for text nobody attested.
 */
export function renderBodyInstallSql(f: ExportedFunction, verification: BodyVerification): string {
  if (!verification.authentic) {
    throw new BodyExportError(`refusing to render an unverified body for ${f.proname}: ${verification.reason}`);
  }
  let tag = "bodyfx";
  while (f.prosrc.includes(`$${tag}$`)) tag += "x";
  const cfg = (f.proconfig ?? []).map((c) => {
    const i = c.indexOf("=");
    return i < 0 ? `  set ${c}` : `  set ${c.slice(0, i)} = ${c.slice(i + 1)}`;
  }).join("\n");
  return [
    "-- GENERATED FORENSIC EVIDENCE — not migration authority. Do not apply to any database.",
    `-- Live body of public.${f.proname}(${f.identityArgs})`,
    `-- raw prosrc SHA-256: ${verification.computedSha256}`,
    `-- verified against the r2.6-attested audit digest: ${verification.attestedSha256}`,
    `create or replace function public.${f.proname}(${f.identityArgs})`,
    `returns ${f.result.startsWith("TABLE") ? f.result.replace(/^TABLE/, "table") : f.result}`,
    `language ${f.language}`,
    f.securityDefiner ? "security definer" : "security invoker",
    cfg,
    `as $${tag}$${f.prosrc}$${tag}$;`,
    "",
  ].filter((l) => l !== "").join("\n");
}
