import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, readFileSync, existsSync, readdirSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { RETENTION_SUBDIR, retentionPath, type RetentionIdentity } from "./evalArtifact";
import { parseRetentionRecord, deriveParityGrade, createRetentionRecord } from "./retentionRecord";
import { buildMatrix, runOne, startProviderFake, type RunnerConfig } from "../../../../../scripts/practice-full-retention";

/**
 * TRACKED FULL-RETENTION RUNNER ACCEPTANCE (R2.31).
 *
 * The point of these is READY, not coverage. The 2026-09-11 36-run passed a test suite and still
 * left nothing runnable behind, because the runner was untracked and the record shape lived in a
 * test. So these exercise the TRACKED runner's own exported entry points against a real provider
 * fake, and read every claim back off disk.
 */

let dir: string;
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "bty-fullret-"));
});
afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
  delete process.env.LLM_BASE_URL;
  delete process.env.LLM_API_KEY;
});

const config = (over: Partial<RunnerConfig> = {}): RunnerConfig => ({
  experimentId: "acceptance",
  fixtures: ["c01-missed-commitment"],
  architectures: ["legacy"],
  runs: 1,
  correction: "disabled",
  artifactDir: dir,
  providerFake: true,
  ...over,
});

const idOf = (over: Partial<RetentionIdentity> = {}): RetentionIdentity => ({
  experimentId: "acceptance",
  fixtureId: "c01-missed-commitment",
  architecture: "legacy",
  runNumber: 1,
  ...over,
});

const readFromDisk = (id: RetentionIdentity) =>
  JSON.parse(readFileSync(join(dir, RETENTION_SUBDIR, retentionPath(id)), "utf8")) as Record<string, unknown>;

const artifactFile = (id: RetentionIdentity) => join(dir, RETENTION_SUBDIR, retentionPath(id));

/** Minimal always-answering fake; the per-test handler decides what to say. */
async function fakeProvider(handler: (body: string) => string | null) {
  const fake = await startProviderFake(() => ({
    plan: "success",
    respond: (body: string) => handler(body) ?? "",
  }));
  process.env.LLM_BASE_URL = fake.url;
  process.env.LLM_API_KEY = "acceptance";
  return fake;
}

describe("matrix construction", () => {
  it("expands every configured cell exactly once", () => {
    const m = buildMatrix(config({ fixtures: ["a", "b"], architectures: ["legacy", "plan_render_v1"], runs: 9 }));
    expect(m).toHaveLength(2 * 2 * 9);
    expect(new Set(m.map((x) => `${x.fixtureId}|${x.architecture}|${x.runNumber}`)).size).toBe(m.length);
  });

  it("one configured identity is one durable artifact — no replacement samples", () => {
    const m = buildMatrix(config({ runs: 3 }));
    expect(m.map((x) => x.runNumber)).toEqual([1, 2, 3]);
  });
});

describe("PRE-PROVIDER DURABILITY — ordering, not eventual existence", () => {
  it("the run identity is durable on disk BEFORE the provider is entered", async () => {
    const id = idOf();
    const observedAtProviderEntry: Array<{ exists: boolean; terminalOutcome: unknown; mtimeMs: number }> = [];

    const fake = await fakeProvider((body) => {
      // Read the artifact FROM DISK at the exact moment the provider is first entered.
      if (observedAtProviderEntry.length === 0) {
        const f = artifactFile(id);
        const exists = existsSync(f);
        observedAtProviderEntry.push({
          exists,
          terminalOutcome: exists ? (JSON.parse(readFileSync(f, "utf8")) as { terminalOutcome: unknown }).terminalOutcome : "ABSENT",
          mtimeMs: exists ? statSync(f).mtimeMs : -1,
        });
      }
      void body;
      // Destroy the exchange immediately: the REAL transport-failure path runs, with no long wait.
      return "";
    });

    try {
      await runOne(config(), id);
    } finally {
      await fake.close();
    }

    // PRE_PROVIDER_ARTIFACT_EXISTS / READ_OK / TERMINAL_OUTCOME
    expect(observedAtProviderEntry).toHaveLength(1);
    expect(observedAtProviderEntry[0].exists).toBe(true);
    expect(observedAtProviderEntry[0].terminalOutcome).toBeNull();
    expect(observedAtProviderEntry[0].mtimeMs).toBeGreaterThan(0);

    // …and the terminal record still exists afterwards, carrying an outcome.
    const final = readFromDisk(id);
    expect(final.terminalOutcome).not.toBeNull();
  }, 30_000);

  it("a provider failure is an OUTCOME, not a missing artifact", async () => {
    const id = idOf({ runNumber: 2 });
    const fake = await fakeProvider(() => "");
    try {
      await runOne(config(), id);
    } finally {
      await fake.close();
    }
    const rec = readFromDisk(id);
    expect(rec.terminalOutcome).toBeTruthy();
    expect(rec.schemaVersion).toBe("arena_experiment_retention_v1");
  }, 30_000);
});

describe("parityGrade is derived from evidence, never claimed", () => {
  it("construction-aware evidence grades STRICT", () => {
    const r = createRetentionRecord({ ...idOf(), correctionEnabled: false });
    r.constructions = { present: true, parsed: { p1: { legitimateValue: "v" } } };
    expect(deriveParityGrade(r)).toBe("strict");
  });

  it("absent construction grades NON-STRICT", () => {
    const r = createRetentionRecord({ ...idOf(), correctionEnabled: false });
    expect(deriveParityGrade(r)).toBe("non-strict");
  });

  it("an EMPTY construction map is not 'no constructions' — it is NON-STRICT", () => {
    const r = createRetentionRecord({ ...idOf(), correctionEnabled: false });
    r.constructions = { present: true, parsed: {} };
    expect(deriveParityGrade(r)).toBe("non-strict");
  });

  it("a caller cannot claim STRICT: the parsed grade is recomputed from evidence", () => {
    const parsed = parseRetentionRecord({
      schemaVersion: "arena_experiment_retention_v1",
      experimentId: "x",
      fixtureId: "c01-missed-commitment",
      architecture: "legacy",
      runNumber: 1,
      parityGrade: "strict",
    });
    expect(parsed.ok).toBe(true);
    if (parsed.ok) expect(parsed.value.parityGrade).toBe("non-strict");
  });
});

describe("HISTORICAL COMPATIBILITY — the 2026-09-11 evidence still parses", () => {
  const historical = ".eval-artifacts/retention-v1";

  it("every historical retention record parses through the tracked reader", () => {
    if (!existsSync(historical)) return; // evidence directory is untracked; skip where absent
    const files = readdirSync(historical).filter((f) => f.endsWith(".json"));
    expect(files.length).toBeGreaterThan(0);

    const failures: string[] = [];
    let strict = 0;
    let nonStrict = 0;
    for (const f of files) {
      const parsed = parseRetentionRecord(JSON.parse(readFileSync(join(historical, f), "utf8")));
      if (!parsed.ok) failures.push(`${f}: ${parsed.errors.join(",")}`);
      else if (parsed.value.parityGrade === "strict") strict++;
      else nonStrict++;
    }
    expect(failures).toEqual([]);
    // They predate construction retention, so every one of them is honestly NON-STRICT.
    expect(strict).toBe(0);
    expect(nonStrict).toBe(files.length);
  });

  it("schemaVersion is unchanged, so no historical file needed rewriting", () => {
    if (!existsSync(historical)) return;
    const f = readdirSync(historical).filter((x) => x.endsWith(".json"))[0];
    if (!f) return;
    const raw = JSON.parse(readFileSync(join(historical, f), "utf8")) as { schemaVersion: string };
    expect(raw.schemaVersion).toBe("arena_experiment_retention_v1");
  });
});
