import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  RETENTION_SUBDIR,
  retentionPath,
  retentionRecords,
  writeRetentionRecord,
  writeImmutableArtifact,
  type RetentionIdentity,
} from "./evalArtifact";

let dir: string;
beforeEach(() => { dir = mkdtempSync(join(tmpdir(), "bty-retention-")); });
afterEach(() => rmSync(dir, { recursive: true, force: true }));

const ID: RetentionIdentity = { experimentId: "exp1", fixtureId: "c01-missed-commitment", architecture: "plan_render_v1", runNumber: 3 };

describe("one durable record per run, rewritten as evidence arrives", () => {
  it("writes a record before the run has an outcome", () => {
    const w = writeRetentionRecord(dir, ID, JSON.stringify({ terminalOutcome: null, plan: null, draft: null }));
    expect(retentionRecords(dir)).toHaveLength(1);
    expect(w.path.startsWith(RETENTION_SUBDIR)).toBe(true);
  });

  /*
    ★ THE IMMUTABLE ARTIFACT REFUSES TO BE OVERWRITTEN. THE RETENTION RECORD MUST ACCEPT IT.
    A run gains evidence stage by stage; if the record could only be written once, a timeout would
    again leave nothing — the exact defect this module exists to remove.
  */
  it("replaces itself as stages complete, and keeps ONE identity", () => {
    writeRetentionRecord(dir, ID, JSON.stringify({ stages: ["plan"] }));
    writeRetentionRecord(dir, ID, JSON.stringify({ stages: ["plan", "render"] }));
    const files = retentionRecords(dir);
    expect(files).toHaveLength(1);
    const body = JSON.parse(readFileSync(join(dir, RETENTION_SUBDIR, files[0]!), "utf8"));
    expect(body.stages).toEqual(["plan", "render"]);
  });

  it("leaves no temp file behind, so a reader never sees a half-written record", () => {
    writeRetentionRecord(dir, ID, JSON.stringify({ a: 1 }));
    expect(readdirSync(join(dir, RETENTION_SUBDIR)).filter((f) => f.endsWith(".tmp"))).toHaveLength(0);
  });

  /* An interrupted update leaves the PREVIOUS complete record readable, never a truncated one. */
  it("an orphaned temp file cannot corrupt the last good record", () => {
    writeRetentionRecord(dir, ID, JSON.stringify({ complete: true }));
    const full = join(dir, RETENTION_SUBDIR, retentionPath(ID));
    writeFileSync(`${full}.tmp`, '{"truncated":');            // simulate a kill mid-write
    const body = JSON.parse(readFileSync(full, "utf8"));
    expect(body).toEqual({ complete: true });
    expect(retentionRecords(dir)).toHaveLength(1);            // the .tmp is not a record
  });

  it("gives different runs different identities", () => {
    writeRetentionRecord(dir, ID, "{}");
    writeRetentionRecord(dir, { ...ID, runNumber: 4 }, "{}");
    writeRetentionRecord(dir, { ...ID, architecture: "legacy" }, "{}");
    expect(retentionRecords(dir)).toHaveLength(3);
  });
});

describe("retention is invisible to the boundary-replay parity sweep", () => {
  /*
    The sweep is `readdirSync(".eval-artifacts")` filtered to names starting
    `practice-review.boundaryreplay.` and ending `.json`. Both defences are asserted here so a
    future rename cannot quietly pull retention records into that measurement.
  */
  const sweep = (root: string) => {
    try {
      return readdirSync(root).filter((f) => f.startsWith("practice-review.boundaryreplay.") && f.endsWith(".json"));
    } catch { return []; }
  };

  it("adds nothing to the swept set", () => {
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, "practice-review.boundaryreplay.live.X.json"), "{}");
    const before = sweep(dir).length;
    writeRetentionRecord(dir, ID, JSON.stringify({ big: "evidence" }));
    writeRetentionRecord(dir, { ...ID, runNumber: 9 }, "{}");
    expect(sweep(dir)).toHaveLength(before);
  });

  it("is excluded by the subdirectory AND by the filename prefix, independently", () => {
    writeRetentionRecord(dir, ID, "{}");
    // 1. not at the sweep root at all
    expect(readdirSync(dir).filter((f) => f.endsWith(".json"))).toHaveLength(0);
    // 2. and even if it were, the name could not match
    expect(retentionPath(ID).startsWith("practice-review.boundaryreplay.")).toBe(false);
  });
});

describe("the immutable artifact authority is untouched", () => {
  it("still fails closed on collision", () => {
    const id = { kind: "r2.23.stability", runId: "r1", head: "abc123", manifestSha256: "def456", passId: "p1" };
    writeImmutableArtifact(dir, id, "{}");
    expect(() => writeImmutableArtifact(dir, id, "{}")).toThrow(/ARTIFACT COLLISION/);
  });

  it("contains no credential material in a retention record", () => {
    writeRetentionRecord(dir, ID, JSON.stringify({ stages: [{ stageName: "plan", stageDurationMs: 12 }] }));
    const body = readFileSync(join(dir, RETENTION_SUBDIR, retentionPath(ID)), "utf8");
    for (const secret of ["Authorization", "api_key", "apiKey", "sk-", "Bearer", "SUPABASE_SERVICE_ROLE"]) {
      expect(body).not.toContain(secret);
    }
  });
});
