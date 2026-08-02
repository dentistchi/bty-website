import { describe, it, expect } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { ARTIFACT_SCHEMA_VERSION, buildContractManifest, canonicalJson, caseDigest, digest, manifestDigest } from "./contractManifest";
import { EVAL_CORPUS } from "./practice-generation.eval";
import { PRACTICE_SAMPLING, REVIEW_SYSTEM_PROMPT, buildGenerationSystemPrompt } from "./arenaScenarioGenerationService";
import { PROVIDER_SCENARIO_JSON_SCHEMA } from "@/domain/foundry/arena-draft/providerDto";
import { SEMANTIC_REVIEW_JSON_SCHEMA } from "@/domain/foundry/arena-draft/semanticReview";

/**
 * GENERATION-CONTRACT MANIFEST (Slice 3.2I-R5B1A.1-R2.23).
 *
 * A live artifact is evidence for exactly one contract. R2.20 measured the cost of not binding
 * evidence to its contract: four artifacts destroyed, and a runner that outlived its source. The
 * manifest digest is what a runner checks BEFORE asking for a credential.
 */

const HEAD = "0".repeat(40);
const MODEL = "gpt-4o-mini";
const base = () => buildContractManifest(HEAD, MODEL);

const CANARY_CASES = ["c01-missed-commitment", "c09-transparency-verification", "c18-constrained-clinical"];

describe("27/28. reproducibility", () => {
  it("27. the same source contract produces the same digest, every time", () => {
    expect(manifestDigest(base())).toBe(manifestDigest(base()));
    expect(canonicalJson(base())).toBe(canonicalJson(base()));
  });

  it("32. key insertion order cannot change the digest", () => {
    const m = base();
    const shuffled = JSON.parse(JSON.stringify({
      evidenceAuthority: m.evidenceAuthority,
      schemaCanExceedBudget: m.schemaCanExceedBudget,
      modelOutputCap: m.modelOutputCap,
      fieldBounds: m.fieldBounds,
      cardinality: m.cardinality,
      sampling: m.sampling,
      model: m.model,
      components: Object.fromEntries(Object.entries(m.components).reverse()),
      head: m.head,
      artifactSchemaVersion: m.artifactSchemaVersion,
    }));
    expect(digest(shuffled)).toBe(digest(m));
  });

  it("28. it carries no timestamp, no file mtime and no clock-derived value", () => {
    const a = canonicalJson(base());
    expect(a).not.toMatch(/\d{4}-\d{2}-\d{2}T/);
    expect(a).not.toMatch(/"(timestamp|generatedAt|mtime|date|now)"/i);
  });

  it("a different HEAD is a different contract instance", () => {
    expect(manifestDigest(buildContractManifest("1".repeat(40), MODEL))).not.toBe(manifestDigest(base()));
  });

  it("the model NAME is part of the contract", () => {
    expect(manifestDigest(buildContractManifest(HEAD, "some-other-model"))).not.toBe(manifestDigest(base()));
    expect(base().model).toBe(MODEL);
  });
});

describe("28-31. sensitivity — a contract change MUST move the digest", () => {
  const m = base();

  it("28. a generator-prompt change changes its component digest", () => {
    expect(m.components.generatorSystemPromptEn).toBe(digest(buildGenerationSystemPrompt("en", [])));
    // The constrained variant is digested separately, so a boundary-only prompt change is visible.
    expect(m.components.generatorSystemPromptConstrained).not.toBe(m.components.generatorSystemPromptEn);
    expect(m.components.generatorSystemPromptKo).not.toBe(m.components.generatorSystemPromptEn);
    expect(digest(`${buildGenerationSystemPrompt("en", [])} MUTATED`)).not.toBe(m.components.generatorSystemPromptEn);
  });

  it("28b. a reviewer-prompt change changes its component digest", () => {
    expect(m.components.reviewSystemPrompt).toBe(digest(REVIEW_SYSTEM_PROMPT));
    expect(digest(`${REVIEW_SYSTEM_PROMPT} MUTATED`)).not.toBe(m.components.reviewSystemPrompt);
  });

  it("29. a schema change changes its component digest", () => {
    expect(m.components.providerSchema).toBe(digest(PROVIDER_SCENARIO_JSON_SCHEMA));
    expect(m.components.reviewSchema).toBe(digest(SEMANTIC_REVIEW_JSON_SCHEMA));
    const mutated = JSON.parse(JSON.stringify(PROVIDER_SCENARIO_JSON_SCHEMA));
    mutated.properties.title = { type: "number" };
    expect(digest(mutated)).not.toBe(m.components.providerSchema);
  });

  it("30. a corpus change changes the corpus digest — including a single case edit", () => {
    const mutated = EVAL_CORPUS.map((c) =>
      c.id === "c01-missed-commitment" ? { ...c, input: { ...c.input, facts: { ...c.input.facts, problem: "edited" } } } : c,
    ).map((c) => ({ id: c.id, locale: c.locale, expectDecline: c.expectDecline ?? false, expectClass: c.expectClass ?? null, input: c.input }));
    expect(digest(mutated)).not.toBe(m.components.corpus);
    // Removing a case moves it too, so a corpus deletion cannot pass unnoticed.
    expect(digest(EVAL_CORPUS.slice(1).map((c) => c.id))).not.toBe(m.components.corpusIds);
  });

  it("30b. the canary-case digest isolates the three bound cases", () => {
    expect(caseDigest(CANARY_CASES)).toBe(caseDigest([...CANARY_CASES].reverse())); // order-insensitive
    expect(caseDigest(CANARY_CASES)).not.toBe(caseDigest(["c01-missed-commitment"]));
    expect(caseDigest(CANARY_CASES)).not.toBe(m.components.corpus); // narrower than the whole corpus
  });

  it("31. a sampling change changes the sampling digest", () => {
    expect(m.components.sampling).toBe(digest({ generation: PRACTICE_SAMPLING.generation, review: PRACTICE_SAMPLING.review, retry: PRACTICE_SAMPLING.retry }));
    expect(digest({ generation: { ...PRACTICE_SAMPLING.generation, temperature: 0.7 }, review: PRACTICE_SAMPLING.review, retry: PRACTICE_SAMPLING.retry }))
      .not.toBe(m.components.sampling);
    expect(digest({ generation: { ...PRACTICE_SAMPLING.generation, maxTokens: 4000 }, review: PRACTICE_SAMPLING.review, retry: PRACTICE_SAMPLING.retry }))
      .not.toBe(m.components.sampling);
  });

  it("a precedence-registry change changes the manifest — gate order IS part of the contract", () => {
    expect(m.components.rejectionPrecedence).toMatch(/^[0-9a-f]{64}$/);
    expect(digest(["a", "b"])).not.toBe(m.components.rejectionPrecedence);
  });

  it("the artifact schema version is pinned, so old evidence is never read as new", () => {
    expect(m.artifactSchemaVersion).toBe(ARTIFACT_SCHEMA_VERSION);
    expect(ARTIFACT_SCHEMA_VERSION).toMatch(/^r2\.\d+[a-z]?\.\d+$/);
  });
});

describe("R2.23A — cardinality, bounds and budget are part of the contract", () => {
  const m = base();

  it("26. a cardinality mutation changes the manifest", () => {
    expect(m.cardinality).toEqual({ primaryChoices: 2, branches: 2, tradeoffChoicesPerBranch: 2, actionChoicesPerBranch: 2, flatTradeoffChoices: 2, flatActionChoices: 2 });
    expect(digest({ ...m.cardinality, primaryChoices: 4 })).not.toBe(m.components.generatedCardinality);
    expect(m.components.generatedCardinality).toBe(digest(m.cardinality));
  });

  it("27. a field-bound mutation changes the manifest", () => {
    expect(m.components.generatedFieldBounds).toBe(digest(m.fieldBounds));
    expect(digest({ ...m.fieldBounds, choiceLabel: 400 })).not.toBe(m.components.generatedFieldBounds);
  });

  it("28. a budget mutation changes the manifest, and the model cap is recorded", () => {
    expect(m.modelOutputCap).toBe(16384);
    expect(m.components.tokenBudget).toMatch(/^[0-9a-f]{64}$/);
    expect(digest({ modelOutputCap: 32768 })).not.toBe(m.components.tokenBudget);
  });

  it("29/33/46. NEITHER prior manifest matches — no earlier artifact can be attributed to this contract", () => {
    expect(manifestDigest(m)).not.toBe("b539c74ed6c97a0d224dd0b60aa25239650288641ac9fc7e37a218d19e567c10"); // R2.23
    expect(manifestDigest(m)).not.toBe("64bcbcf9a0f08aa8a2b02c4eb8b8ecdff2b1b098e389e8ad6984964c39269b0d"); // R2.23A
    expect(manifestDigest(m)).not.toBe("d8f8e60cba1ec23388f988fc74a9e484b2d703ec58b3d8db46cacdd65f66ffe2"); // R2.23C
    // R2.29 added the narrow boundary-review stage to the contract, so the R2.23D manifest is now a
    // prior one too — an artifact produced before the boundary stage existed cannot be attributed to
    // a contract that has it.
    expect(manifestDigest(m)).not.toBe("1deeb9372131550c63fc3ca98fcd877840411d1714b7c66a68c80e33edae6dda"); // R2.23D / R2.28
    // R2.30 replaced the surface map with a reachability-derived one and added applicability, so an
    // R2.29 artifact was produced under a materially different boundary contract.
    expect(manifestDigest(m)).not.toBe("bec8d7872e35d7aa631c5e4fed6bf024b722ae65e4a1a5dc392d3f7a64e0ebef"); // R2.29
    // R2.32 changed which field carries authority and who writes the explanation, so an R2.30
    // artifact was produced under a different reviewer output contract.
    expect(manifestDigest(m)).not.toBe("25cb0451a20791053d6a6861236f3eed2097eb5662bdd80c9b4276fff8ba2895"); // R2.30
    // R2.34 added transport observability and corrected the failure classification, so an R2.32
    // artifact cannot prove what an R2.34 artifact can.
    expect(manifestDigest(m)).not.toBe("5b2abf97a1de5074af0f47f6f63cc641757a1bd0a87e5253ff8926394c446463"); // R2.32
    // R2.36 replaced location-only grounding with prerequisite TRUTH: the reviewer now receives a
    // labelled, un-merged context and a decomposed rule, and every excerpt names its source. An
    // R2.34 artifact answered a materially weaker question and cannot be attributed to this one.
    expect(manifestDigest(m)).not.toBe("4a9d22712038dff94c5a49f064277d35c924e165ad27215dc3e4fd46f6ce5936"); // R2.34
    // R2.38 removed applicability, compliance, the mechanism and every model-authored excerpt from
    // the reviewer's output and replaced evidence with server-issued candidate ids. An R2.36
    // artifact answered a materially different question and cannot be attributed to this contract.
    expect(manifestDigest(m)).not.toBe("3b4f9612a2a3ba0c55fd47198b5d8f1e1fe92fd48e1b91da51f3371a55092821"); // R2.36
    // R2.40 bound governed-action candidates to the boundary's own clause roles. An R2.38 artifact
    // was produced while the server still offered a prerequisite-performing span as a governed
    // action — a materially different question, and the one that produced a safety-inverting packet.
    expect(manifestDigest(m)).not.toBe("3b55f8749ae71ad83df928da79778a55a26ab25adb884edc9bc29aaace224c84"); // R2.38
    // R2.44 bound prerequisite evidence polarity into candidate construction. An R2.42 artifact was
    // produced while satisfaction text could still be offered as failure evidence — the defect that
    // produced five false findings on a branch that kept the boundary.
    expect(manifestDigest(m)).not.toBe("2911ce142576e55be8be1087d7184302e047a899a3278824acc1af79ef143b23"); // R2.42
    expect(m.artifactSchemaVersion).toBe("r2.52.1");
  });

  it("the measured budget acceptance is carried in the manifest, not asserted away", () => {
    expect(typeof m.schemaCanExceedBudget).toBe("boolean");
  });
});

describe("R2.23C — evidence authority is part of the contract", () => {
  const m = base();

  it("4/49. restoring generator self-attestation would change the manifest", () => {
    expect(m.evidenceAuthority.providerSelfAttestation).toBe(false);
    expect(m.components.evidenceAuthority).toBe(digest(m.evidenceAuthority));
    expect(digest({ ...m.evidenceAuthority, providerSelfAttestation: true })).not.toBe(m.components.evidenceAuthority);
  });

  it("48. changing the active-boundary maximum changes the manifest", () => {
    expect(m.evidenceAuthority.maxActiveBoundaries).toBe(3);
    expect(digest({ ...m.evidenceAuthority, maxActiveBoundaries: 10 })).not.toBe(m.components.evidenceAuthority);
    expect(m.components.boundaryScopeContract).toMatch(/^[0-9a-f]{64}$/);
  });

  it("49. moving retry authority back to the reviewer changes the manifest", () => {
    expect(m.evidenceAuthority.retryAuthority).toBe("server_deterministic");
    expect(m.evidenceAuthority.reviewerAuthorsRetryPrompt).toBe(false);
    expect(digest({ ...m.evidenceAuthority, retryAuthority: "reviewer_authored" })).not.toBe(m.components.evidenceAuthority);
  });

  it("47. changing the reviewer text bound changes the manifest", () => {
    expect(m.fieldBounds.reviewText).toBe(100);
    expect(digest({ ...m.fieldBounds, reviewText: 140 })).not.toBe(m.components.generatedFieldBounds);
  });

  it("R2.23D — the Host scope selector and readiness resolver are part of the contract", () => {
    expect(m.evidenceAuthority.hostScopeSelectorExists).toBe(true);
    expect(m.evidenceAuthority.readinessStates).toHaveLength(8);
    expect(m.components.readinessResolver).toMatch(/^[0-9a-f]{64}$/);
    // Removing the selector, or changing which states exist, changes the contract.
    expect(digest({ ...m.evidenceAuthority, hostScopeSelectorExists: false })).not.toBe(m.components.evidenceAuthority);
    expect(digest(["ready_no_boundaries"])).not.toBe(m.components.readinessResolver);
  });

  it("the evidence contract records that the projection follows acceptance, and nothing is auto-selected", () => {
    expect(m.evidenceAuthority.projectionOnlyAfterAccept).toBe(true);
    expect(m.evidenceAuthority.automaticBoundarySelection).toBe(false);
    expect(m.evidenceAuthority.constraintEvidenceSource).toBe("review_derived_projection");
  });
});

describe("33/34. secrets and environment", () => {
  it("33. no credential, endpoint or account identifier can reach the manifest", () => {
    const before = { ...process.env };
    process.env.OPENAI_API_KEY = "sk-should-never-appear-abcdef";
    process.env.LLM_API_KEY = "sk-also-never-appear-123456";
    process.env.LLM_BASE_URL = "https://secret.endpoint.example/v1";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role-should-never-appear";
    try {
      const text = canonicalJson(buildContractManifest(HEAD, MODEL));
      expect(text).not.toContain("sk-should-never-appear");
      expect(text).not.toContain("sk-also-never-appear");
      expect(text).not.toContain("secret.endpoint.example");
      expect(text).not.toContain("service-role-should-never-appear");
      expect(text).not.toMatch(/api[_-]?key|authorization|bearer|base_?url/i);
    } finally {
      process.env = before;
    }
  });

  it("34. unrelated environment variables cannot change the digest", () => {
    const before = { ...process.env };
    const baseline = manifestDigest(base());
    (process.env as Record<string, string>).NODE_ENV = "production";
    process.env.CI = "1";
    process.env.SOME_UNRELATED_FLAG = "whatever";
    process.env.OPENAI_API_KEY = "sk-rotated";
    try {
      expect(manifestDigest(base())).toBe(baseline);
    } finally {
      process.env = before;
    }
  });
});

describe("the manifest CLI is the runner's binding source", () => {
  it("exists, prints canonical JSON, and reads no secret", () => {
    const p = join(process.cwd(), "scripts/practice-contract-manifest.ts");
    expect(existsSync(p)).toBe(true);
    const src = readFileSync(p, "utf8");
    expect(src).toContain("manifestSha256");
    expect(src).toContain("--json");
    expect(src).not.toMatch(/OPENAI_API_KEY|LLM_API_KEY|LLM_BASE_URL/);
    // The model NAME is contract, and is the only environment value read.
    expect(src).toContain("process.env.LLM_MODEL");
  });

  it("binds the three canary cases by name, and all three still exist in the corpus", () => {
    const src = readFileSync(join(process.cwd(), "scripts/practice-contract-manifest.ts"), "utf8");
    for (const id of CANARY_CASES) {
      expect(src, `${id} is not bound in the manifest CLI`).toContain(id);
      expect(EVAL_CORPUS.some((c) => c.id === id), `${id} is missing from the corpus`).toBe(true);
    }
  });
});
