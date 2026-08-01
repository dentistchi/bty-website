/**
 * STABILITY RUNTIME CONFIG (Slice 3.2I-R5B1A.1-R2.23D-R4).
 *
 * THE MEASURED DEFECT
 *
 * The R2.23D-R3 runner passed all 22 contract checks and both provider checks, then died at line
 * 227 on `EXPECT_MANIFEST: unbound variable`. R2.23D-R1 had replaced every `EXPECT_*` shell variable
 * with `check '<label>' '<path>' '<expected>'` lines; only `EXPECT_HEAD` survived, because the git
 * comparison needs it. R2.23D-R3 then wrote the orchestrator invocation as
 * `--manifest "$EXPECT_MANIFEST"`, copying a naming convention that no longer existed.
 *
 * A partial rename. It survived because the tests asserted that strings were PRESENT in the script,
 * and `--credential-boundary-check` exited before the EXECUTION block, so the line was never
 * executed under `set -u`.
 *
 * THE FIX
 *
 * The shell stops reconstructing the contract after the credential prompt. One sanitized JSON file
 * carries every verified non-secret value; a tracked parser validates it BEFORE the credential is
 * requested; and the orchestrator and collator each take a single `--config <path>`. There is one
 * canonical manifest field — `contractManifestSha256` — with no alias, no environment fallback and
 * no implicit default, so a name can no longer drift between layers without a type error.
 *
 * The config never contains a credential, an Authorization header, a provider response or any
 * production identifier.
 */

import { createHash } from "node:crypto";

export const RUNTIME_CONFIG_SCHEMA_VERSION = "practice-stability-runtime-config/1";

export type StabilityRuntimeConfig = {
  schemaVersion: string;
  /** `mock` proves wiring only. `live` is the only mode that can produce product evidence. */
  mode: "mock" | "live";
  runId: string;
  head: string;
  /**
   * THE canonical manifest field. One name, one field, one parser key, one orchestrator input, one
   * artifact field, one collator comparison — see the module header for why.
   */
  contractManifestSha256: string;
  corpusSha256: string;
  canaryCaseSha256: string;
  providerSchemaSha256: string;
  reviewSchemaSha256: string;
  samplingSha256: string;
  tokenBudgetSha256: string;
  artifactSchemaVersion: string;
  caseIds: string[];
  passIds: string[];
  caseDeadlineMs: number;
  artifactDir: string;
  expectedCases: number;
};

const HEX40 = /^[0-9a-f]{40}$/;
const HEX64 = /^[0-9a-f]{64}$/;

export type RuntimeConfigParse = { ok: true; value: StabilityRuntimeConfig } | { ok: false; errors: string[] };

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const strArray = (v: unknown): string[] | null =>
  Array.isArray(v) && v.length > 0 && v.every((x) => typeof x === "string" && x.trim().length > 0) ? (v as string[]) : null;

/**
 * Validate a runtime config. Fail-closed and total: a missing or malformed field is an error before
 * the credential prompt, never an unbound variable discovered after it.
 *
 * There is deliberately no defaulting. A value the runner failed to compute must surface as a
 * refusal, not be quietly replaced with something plausible.
 */
export function parseRuntimeConfig(raw: unknown): RuntimeConfigParse {
  const errors: string[] = [];
  if (!isObj(raw)) return { ok: false, errors: ["runtime_config_not_an_object"] };

  const str = (k: keyof StabilityRuntimeConfig, pattern?: RegExp) => {
    const v = raw[k];
    if (typeof v !== "string" || v.trim().length === 0) {
      errors.push(`runtime_config_missing:${String(k)}`);
      return "";
    }
    if (pattern && !pattern.test(v)) errors.push(`runtime_config_malformed:${String(k)}`);
    return v;
  };

  if (raw.schemaVersion !== RUNTIME_CONFIG_SCHEMA_VERSION) errors.push("runtime_config_schema_version_mismatch");
  if (raw.mode !== "mock" && raw.mode !== "live") errors.push("runtime_config_malformed:mode");

  const value: StabilityRuntimeConfig = {
    schemaVersion: RUNTIME_CONFIG_SCHEMA_VERSION,
    mode: raw.mode === "live" ? "live" : "mock",
    runId: str("runId"),
    head: str("head", HEX40),
    contractManifestSha256: str("contractManifestSha256", HEX64),
    corpusSha256: str("corpusSha256", HEX64),
    canaryCaseSha256: str("canaryCaseSha256", HEX64),
    providerSchemaSha256: str("providerSchemaSha256", HEX64),
    reviewSchemaSha256: str("reviewSchemaSha256", HEX64),
    samplingSha256: str("samplingSha256", HEX64),
    tokenBudgetSha256: str("tokenBudgetSha256", HEX64),
    artifactSchemaVersion: str("artifactSchemaVersion"),
    caseIds: strArray(raw.caseIds) ?? (errors.push("runtime_config_missing:caseIds"), []),
    passIds: strArray(raw.passIds) ?? (errors.push("runtime_config_missing:passIds"), []),
    caseDeadlineMs: typeof raw.caseDeadlineMs === "number" && raw.caseDeadlineMs > 0 ? raw.caseDeadlineMs : (errors.push("runtime_config_missing:caseDeadlineMs"), 0),
    artifactDir: str("artifactDir"),
    expectedCases: typeof raw.expectedCases === "number" && raw.expectedCases > 0 ? raw.expectedCases : (errors.push("runtime_config_missing:expectedCases"), 0),
  };

  if (value.caseIds.length && value.passIds.length && value.expectedCases !== value.caseIds.length * value.passIds.length) {
    errors.push("runtime_config_inconsistent:expectedCases");
  }
  // A secret in a config that is written to disk and read by children would be the one thing this
  // file must never carry. Refuse rather than sanitize.
  for (const forbidden of ["apiKey", "api_key", "authorization", "bearer", "llmApiKey", "openaiApiKey", "password", "serviceRoleKey"]) {
    if (Object.keys(raw).some((k) => k.toLowerCase() === forbidden.toLowerCase())) errors.push("runtime_config_contains_secret_field");
  }

  return errors.length ? { ok: false, errors: [...new Set(errors)] } : { ok: true, value };
}

/** Deterministic, key-sorted JSON so the frozen digest is stable across runtimes. */
export function canonicalRuntimeConfigJson(c: StabilityRuntimeConfig): string {
  return JSON.stringify(
    Object.fromEntries(Object.entries(c).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))),
  );
}

export const runtimeConfigDigest = (c: StabilityRuntimeConfig): string =>
  createHash("sha256").update(canonicalRuntimeConfigJson(c)).digest("hex");
