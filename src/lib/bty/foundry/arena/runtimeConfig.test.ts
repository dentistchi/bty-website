import { describe, it, expect } from "vitest";
import {
  RUNTIME_CONFIG_SCHEMA_VERSION,
  canonicalRuntimeConfigJson,
  parseRuntimeConfig,
  runtimeConfigDigest,
  type StabilityRuntimeConfig,
} from "./runtimeConfig";

const HEX40 = "426653f78ff8e3a3750cff30135c2d937047c331";
const H = (n: string) => n.repeat(64).slice(0, 64);

const valid = (): StabilityRuntimeConfig => ({
  schemaVersion: RUNTIME_CONFIG_SCHEMA_VERSION,
  mode: "mock",
  runId: "20260801T000000Z",
  head: HEX40,
  contractManifestSha256: H("a"),
  corpusSha256: H("b"),
  canaryCaseSha256: H("c"),
  providerSchemaSha256: H("d"),
  reviewSchemaSha256: H("e"),
  samplingSha256: H("f"),
  tokenBudgetSha256: H("0"),
  artifactSchemaVersion: "practice-generation-eval/3",
  caseIds: ["c01", "c09", "c18"],
  passIds: ["pass1", "pass2"],
  caseDeadlineMs: 510_000,
  artifactDir: "/tmp/x",
  expectedCases: 6,
});

const ok = (over: Record<string, unknown> = {}) => parseRuntimeConfig({ ...valid(), ...over });

describe("the runtime config is the single binding between the shell and the runtime", () => {
  it("accepts a complete, well-formed config", () => {
    const r = ok();
    expect(r.ok).toBe(true);
  });

  // THE R2.23D-R3 DEFECT, in the layer that replaced it. The shell used to carry each value in
  // its own variable and the orchestrator read each with its own flag; `EXPECT_MANIFEST` drifted
  // out of existence between the two and nothing noticed until an operator had entered a key.
  // Now a missing value is a REFUSAL, produced before the credential prompt.
  it("refuses a config that is missing the contract manifest, rather than defaulting one", () => {
    const { contractManifestSha256: _drop, ...rest } = valid();
    const r = parseRuntimeConfig(rest);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors).toContain("runtime_config_missing:contractManifestSha256");
  });

  it("has exactly one name for the contract manifest, with no alias accepted", () => {
    // A config using the retired shell-era name is INVALID, not silently adapted.
    const { contractManifestSha256: sha, ...rest } = valid();
    const r = parseRuntimeConfig({ ...rest, manifestSha256: sha, EXPECT_MANIFEST: sha });
    expect(r.ok).toBe(false);
  });

  it.each([
    ["head", "not-a-sha"],
    ["contractManifestSha256", "abc"],
    ["corpusSha256", "ABCDEF"],
  ])("refuses a malformed %s", (field, bad) => {
    const r = ok({ [field]: bad });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors).toContain(`runtime_config_malformed:${field}`);
  });

  it("refuses an unknown mode", () => {
    const r = ok({ mode: "dry-run" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors).toContain("runtime_config_malformed:mode");
  });

  it("refuses a schema version it does not implement", () => {
    const r = ok({ schemaVersion: "practice-stability-runtime-config/0" });
    expect(r.ok).toBe(false);
  });

  it("refuses a case count that disagrees with the case and pass lists", () => {
    const r = ok({ expectedCases: 5 });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors).toContain("runtime_config_inconsistent:expectedCases");
  });

  it("refuses empty case or pass lists instead of running zero cases", () => {
    expect(ok({ caseIds: [] }).ok).toBe(false);
    expect(ok({ passIds: [] }).ok).toBe(false);
  });

  it("refuses a non-object", () => {
    for (const bad of [null, "x", 3, []]) expect(parseRuntimeConfig(bad).ok).toBe(false);
  });
});

describe("the config never carries a credential", () => {
  // It is written to disk and read by child processes. A secret here would be the single worst
  // thing this file could hold, so it is REFUSED rather than stripped — stripping would let a
  // caller believe the field was honoured.
  it.each(["apiKey", "api_key", "authorization", "Bearer", "llmApiKey", "openaiApiKey", "password", "serviceRoleKey"])(
    "refuses a config containing %s",
    (field) => {
      const r = ok({ [field]: "sk-whatever" });
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.errors).toContain("runtime_config_contains_secret_field");
    },
  );

  it("declares no secret-shaped field in its own canonical form", () => {
    const json = canonicalRuntimeConfigJson(valid()).toLowerCase();
    // "token" alone is not a secret marker here — `tokenBudgetSha256` is a measured budget digest,
    // and banning the substring would have flagged it. Credential-shaped names only.
    for (const banned of ["apikey", "authorization", "bearer", "password", "secret", "accesstoken", "authtoken", "sk-"]) {
      expect(json).not.toContain(banned);
    }
  });
});

describe("the frozen digest is stable and total", () => {
  it("does not depend on key order", () => {
    const a = valid();
    const shuffled = Object.fromEntries(Object.entries(a).reverse()) as unknown as StabilityRuntimeConfig;
    expect(runtimeConfigDigest(shuffled)).toBe(runtimeConfigDigest(a));
  });

  it("changes when any bound value changes", () => {
    const base = runtimeConfigDigest(valid());
    expect(runtimeConfigDigest({ ...valid(), contractManifestSha256: H("9") })).not.toBe(base);
    expect(runtimeConfigDigest({ ...valid(), mode: "live" })).not.toBe(base);
    expect(runtimeConfigDigest({ ...valid(), head: HEX40.replace(/1$/, "2") })).not.toBe(base);
  });

  it("round-trips through the parser without changing the digest", () => {
    const parsed = parseRuntimeConfig(JSON.parse(canonicalRuntimeConfigJson(valid())));
    expect(parsed.ok).toBe(true);
    if (parsed.ok) expect(runtimeConfigDigest(parsed.value)).toBe(runtimeConfigDigest(valid()));
  });
});
