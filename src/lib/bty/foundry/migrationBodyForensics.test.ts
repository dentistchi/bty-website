import { describe, it, expect } from "vitest";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  parseBodyExport, attestedBodyDigests, verifyBodyExport, renderBodyInstallSql,
  BODY_EXPORT_CONTRACT_VERSION, BodyExportError, type ExportedFunction, type LiveBodyExport,
} from "./migrationBodyForensics";

/**
 * Slice 3.2I-R5B1A.1-R2.7 — the live body export may only be believed when the text it carries
 * hashes to a digest the r2.6 packet audit ALREADY attested independently. These tests pin that
 * trust boundary: no path exists by which unattested SQL reaches the forensic harness.
 */

const sha = (s: string) => createHash("sha256").update(Buffer.from(s, "utf8")).digest("hex");
const PACKET = "d5171bbd503388a1ec9ac34aa11e05026b800f79f607697e809e416b2f1705d8";
const BODY = "\ndeclare v int;\nbegin\n  return query select 'ok'::text;\nend\n";

function fn(over: Partial<ExportedFunction> = {}): ExportedFunction {
  const prosrc = over.prosrc ?? BODY;
  return {
    proname: "bty_foundry_submit_followup", identityArgs: "p_followup_id uuid, p_auth_user_id uuid, p_outcome text",
    result: "TABLE(result text, status text, outcome text)", language: "plpgsql", securityDefiner: true,
    proconfig: ["search_path=pg_catalog, public"], prosrc, prosrcSha256: sha(prosrc), ...over,
  };
}
function exp(over: Partial<LiveBodyExport> = {}): LiveBodyExport {
  return {
    exportKind: "foundry_function_body_export", exportContractVersion: BODY_EXPORT_CONTRACT_VERSION,
    boundPacketId: PACKET, serverVersionNum: 170006, functions: [fn()], ...over,
  };
}
const audit = (digest: string, over: Record<string, unknown> = {}) => ({
  packetId: PACKET, serverVersionNum: 170006,
  effects: [{ effectId: "function:public.bty_foundry_submit_followup(p_followup_id uuid, p_auth_user_id uuid, p_outcome text)", definitionDigest: digest }],
  ...over,
});

describe("body export ingest", () => {
  it("accepts raw JSON and a { body_export: … } wrapper", () => {
    expect(parseBodyExport(JSON.stringify(exp())).functions.length).toBe(1);
    expect(parseBodyExport(JSON.stringify({ body_export: exp() })).boundPacketId).toBe(PACKET);
  });
  it("accepts the single-cell CSV export", () => {
    const csv = 'body_export\n"' + JSON.stringify(exp()).replace(/"/g, '""') + '"';
    expect(parseBodyExport(csv).functions.length).toBe(1);
  });
  it("preserves an exact multi-line body through ingest (no normalization)", () => {
    const gnarly = "\n  line one\t\n\n  -- comment with $$ and 'quotes'\nend\n";
    const parsed = parseBodyExport(JSON.stringify(exp({ functions: [fn({ prosrc: gnarly })] })));
    expect(parsed.functions[0].prosrc).toBe(gnarly);
  });
  it("rejects an HTML page, malformed JSON, empty input, and multi-row CSV", () => {
    expect(() => parseBodyExport("<html>err</html>")).toThrow(/HTML/);
    expect(() => parseBodyExport('{"functions":[{')).toThrow(/malformed|truncated/);
    expect(() => parseBodyExport("  ")).toThrow(/empty/);
    expect(() => parseBodyExport('body_export\n"{}"\n"{}"')).toThrow(/data rows/);
  });
  it("rejects a foreign export kind or contract version", () => {
    expect(() => parseBodyExport(JSON.stringify(exp({ exportKind: "something_else" })))).toThrow(/foundry_function_body_export/);
    expect(() => parseBodyExport(JSON.stringify(exp({ exportContractVersion: "r0.1" })))).toThrow(/contract mismatch/);
  });
});

describe("attested digest extraction", () => {
  it("keys the audit's function digests by proname", () => {
    const a = attestedBodyDigests(audit("abc"));
    expect(a.digests.bty_foundry_submit_followup).toBe("abc");
    expect(a.packetId).toBe(PACKET);
  });
  it("rejects an audit result with no packetId or no effects", () => {
    expect(() => attestedBodyDigests({ effects: [] })).toThrow(/packetId/);
    expect(() => attestedBodyDigests({ packetId: PACKET })).toThrow(/effects/);
  });
});

describe("body authenticity — anchored to the r2.6 attestation", () => {
  it("a body that hashes to the attested digest is AUTHENTIC", () => {
    const r = verifyBodyExport(exp(), attestedBodyDigests(audit(sha(BODY))));
    expect(r.allAuthentic).toBe(true);
    expect(r.results[0].reason).toMatch(/attested digest/);
  });

  it("a TAMPERED body is rejected even when its self-reported digest agrees", () => {
    // The attacker edits the text AND recomputes prosrcSha256 — internally consistent, but it can
    // no longer hash to what the independently attested audit measured.
    const evil = BODY.replace("return query select 'ok'::text;", "return query select 'ok'::text; -- backdoor");
    const r = verifyBodyExport(exp({ functions: [fn({ prosrc: evil })] }), attestedBodyDigests(audit(sha(BODY))));
    expect(r.allAuthentic).toBe(false);
    expect(r.results[0].reason).toMatch(/does not hash to the attested digest/);
  });

  it("an internally inconsistent export (text vs its own digest) is rejected", () => {
    const r = verifyBodyExport(exp({ functions: [fn({ prosrcSha256: "0".repeat(64) })] }), attestedBodyDigests(audit(sha(BODY))));
    expect(r.results[0].authentic).toBe(false);
    expect(r.results[0].reason).toMatch(/internally inconsistent/);
  });

  it("even a single changed whitespace character is rejected (raw prosrc, no normalization)", () => {
    const r = verifyBodyExport(exp({ functions: [fn({ prosrc: BODY.replace("begin", "begin ") })] }), attestedBodyDigests(audit(sha(BODY))));
    expect(r.results[0].authentic).toBe(false);
  });

  it("an export bound to a different packet is rejected wholesale", () => {
    const r = verifyBodyExport(exp({ boundPacketId: "9".repeat(64) }), attestedBodyDigests(audit(sha(BODY))));
    expect(r.boundPacketOk).toBe(false);
    expect(r.allAuthentic).toBe(false);
    expect(r.results[0].reason).toMatch(/different packetId/);
  });

  it("a function with no attested digest cannot be authenticated", () => {
    const r = verifyBodyExport(exp(), attestedBodyDigests(audit(sha(BODY), { effects: [] })));
    expect(r.results[0].authentic).toBe(false);
    expect(r.results[0].reason).toMatch(/no attested digest/);
  });

  it("a cross-PostgreSQL-major export is flagged", () => {
    const r = verifyBodyExport(exp({ serverVersionNum: 160014 }), attestedBodyDigests(audit(sha(BODY))));
    expect(r.serverMajorOk).toBe(false);
  });
});

describe("forensic fixture rendering", () => {
  const ok = () => verifyBodyExport(exp(), attestedBodyDigests(audit(sha(BODY)))).results[0];

  it("renders an installable, clearly-labelled forensic statement", () => {
    const sql = renderBodyInstallSql(fn(), ok());
    expect(sql).toContain("GENERATED FORENSIC EVIDENCE — not migration authority");
    expect(sql).toContain("create or replace function public.bty_foundry_submit_followup(");
    expect(sql).toContain("security definer");
    expect(sql).toContain("set search_path = pg_catalog, public");
    expect(sql).toContain("returns table(result text, status text, outcome text)");
    expect(sql).toContain(sha(BODY));
  });

  it("round-trips the body byte-for-byte inside the dollar quote", () => {
    const sql = renderBodyInstallSql(fn(), ok());
    const m = /as \$(bodyfx x*)\$([\s\S]*)\$\1\$;/.exec(sql.replace(/\$(bodyfx x*)\$/g, (s) => s));
    expect(sql).toContain(`$bodyfx$${BODY}$bodyfx$;`);
    expect(m === null || m[2] === BODY).toBe(true);
  });

  it("escalates the dollar-quote tag when the body already contains it", () => {
    const nasty = "\nbegin return query select '$bodyfx$'::text; end\n";
    const f = fn({ prosrc: nasty });
    const v = verifyBodyExport(exp({ functions: [f] }), attestedBodyDigests(audit(sha(nasty)))).results[0];
    const sql = renderBodyInstallSql(f, v);
    expect(sql).toContain("$bodyfxx$");
    expect(sql).toContain(`$bodyfxx$${nasty}$bodyfxx$;`);
  });

  it("REFUSES to render an unverified body (unattested SQL can never reach the harness)", () => {
    const bad = verifyBodyExport(exp({ functions: [fn({ prosrc: "malicious" })] }), attestedBodyDigests(audit(sha(BODY)))).results[0];
    expect(() => renderBodyInstallSql(fn({ prosrc: "malicious" }), bad)).toThrow(/refusing to render an unverified body/);
  });
});

describe("the checked-in export query is read-only and bound to the r2.6 packet", () => {
  const sql = readFileSync(join(process.cwd(), "docs/audit/forensics/foundry_function_body_export_readonly.sql"), "utf8");
  const manifest = JSON.parse(readFileSync(join(process.cwd(), "docs/audit/foundry_migration_expected_catalog.json"), "utf8"));
  // Executable text only — the prose header legitimately discusses apply/alter/repair.
  const executable = sql.replace(/--[^\n]*/g, "").replace(/\/\*[\s\S]*?\*\//g, "");

  it("is exactly one statement", () => {
    expect((executable.match(/;/g) ?? []).length).toBe(1);
  });
  it("binds the CURRENT committed packetId, so a stale export cannot be ingested", () => {
    expect(sql).toContain(`'boundPacketId', '${manifest.packetId}'`);
  });
  it("reads only pg_catalog — never an application table, and writes nothing", () => {
    expect(executable).toContain("from pg_proc p");
    expect(executable).not.toMatch(/\bfrom\s+public\./);
    expect(executable).not.toMatch(/\b(insert|update|delete|drop|alter|create|grant|revoke|truncate)\s/i);
  });
  it("exports the audited function set only", () => {
    for (const p of ["bty_foundry_set_shared_review", "bty_foundry_materialize_followup", "bty_foundry_submit_followup", "bty_foundry_get_my_followup"]) {
      expect(sql).toContain(`'${p}'`);
    }
  });
});
