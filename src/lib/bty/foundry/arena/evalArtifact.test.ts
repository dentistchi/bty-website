import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, readFileSync, readdirSync, rmSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { LATEST_POINTER, artifactPath, lineageIndex, sha256, writeImmutableArtifact, writeLatestPointer } from "./evalArtifact";

/**
 * IMMUTABLE ARTIFACT AUTHORITY (Slice 3.2I-R5B1A.1-R2.23).
 *
 * R2.20 measured the cost of not having one: every filtered run wrote the same filename, so each
 * canary destroyed the evidence of the one before it. Four artifacts are permanently gone. These
 * cases pin the authority that replaces the convention — identity in the name, fail-closed
 * collision, evidence written before assertions, and a lineage index that never invents history.
 */

const ID = {
  kind: "r2.23.stability",
  runId: "20260731T120000Z",
  head: "0bdd57508ab839c503635a8d01e7ecdcf1a0783d",
  manifestSha256: "a729286db175369a72782c04ec0cfe67e5c5d07f06934a6801837796b9c09d28",
  passId: "pass1",
};

let dir: string;
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "bty-artifact-test-"));
});
afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

describe("35/40. path identity", () => {
  it("35. the path carries run, HEAD and contract manifest, so it is unique per contract", () => {
    // Dots are the field separator, so they are stripped from each component — otherwise a dotted
    // kind would produce a filename the lineage index could not attribute.
    expect(artifactPath(ID)).toBe("practice-generation.r2-23-stability.20260731T120000Z.0bdd57508ab8.a729286db175.pass1.json");
    expect(artifactPath(ID).split(".")).toHaveLength(7);
  });

  it("35b. a different pass, run, HEAD or manifest is a DIFFERENT artifact", () => {
    const base = artifactPath(ID);
    expect(artifactPath({ ...ID, passId: "pass2" })).not.toBe(base);
    expect(artifactPath({ ...ID, runId: "other" })).not.toBe(base);
    expect(artifactPath({ ...ID, head: "1".repeat(40) })).not.toBe(base);
    expect(artifactPath({ ...ID, manifestSha256: "f".repeat(64) })).not.toBe(base);
  });

  it("40/41. the write returns the artifact digest, and the payload records HEAD and manifest", () => {
    const payload = JSON.stringify({ head: ID.head, manifestSha256: ID.manifestSha256, results: [] });
    const w = writeImmutableArtifact(dir, ID, payload);
    expect(w.sha256).toBe(sha256(payload));
    expect(w.sha256).toMatch(/^[0-9a-f]{64}$/);
    const back = JSON.parse(readFileSync(join(dir, w.path), "utf8"));
    expect(back.head).toBe(ID.head);
    expect(back.manifestSha256).toBe(ID.manifestSha256);
  });

  it("path components are sanitized — a hostile run id cannot escape the directory", () => {
    const p = artifactPath({ ...ID, runId: "../../etc/passwd", passId: "a b/c" });
    expect(p).not.toContain("/");
    expect(p).not.toContain("..");
  });
});

describe("36/37. collision fails closed", () => {
  it("36. a second write to the same identity THROWS — it does not append, truncate or rename", () => {
    const first = JSON.stringify({ pass: "first result" });
    writeImmutableArtifact(dir, ID, first);
    expect(() => writeImmutableArtifact(dir, ID, JSON.stringify({ pass: "second result" }))).toThrow(/ARTIFACT COLLISION/);
    // 37. The prior artifact is untouched — byte-for-byte the original.
    expect(readFileSync(join(dir, artifactPath(ID)), "utf8")).toBe(first);
    expect(readdirSync(dir).filter((f) => f.endsWith(".json"))).toHaveLength(1);
  });

  it("36b. it does not silently choose another path under the same run id", () => {
    writeImmutableArtifact(dir, ID, "{}");
    try {
      writeImmutableArtifact(dir, ID, '{"other":true}');
    } catch {
      /* expected */
    }
    expect(readdirSync(dir)).toEqual([artifactPath(ID)]);
  });

  it("37b. two passes of one run coexist — neither can destroy the other", () => {
    writeImmutableArtifact(dir, ID, '{"p":1}');
    writeImmutableArtifact(dir, { ...ID, passId: "pass2" }, '{"p":2}');
    expect(readdirSync(dir).filter((f) => f.endsWith(".json"))).toHaveLength(2);
  });
});

describe("38/39. the latest pointer is not the authority", () => {
  it("38. it is written only AFTER the immutable copy exists", () => {
    const payload = '{"run":1}';
    const w = writeImmutableArtifact(dir, ID, payload);
    expect(existsSync(join(dir, w.path))).toBe(true);
    writeLatestPointer(dir, payload);
    expect(readFileSync(join(dir, LATEST_POINTER), "utf8")).toBe(payload);
  });

  it("39. it is overwritable by design, and the immutable copies survive it", () => {
    writeImmutableArtifact(dir, ID, '{"run":1}');
    writeLatestPointer(dir, '{"run":1}');
    writeImmutableArtifact(dir, { ...ID, passId: "pass2" }, '{"run":2}');
    writeLatestPointer(dir, '{"run":2}');
    expect(readFileSync(join(dir, LATEST_POINTER), "utf8")).toBe('{"run":2}');
    // Both authoritative copies remain readable and unchanged.
    expect(readFileSync(join(dir, artifactPath(ID)), "utf8")).toBe('{"run":1}');
    expect(readFileSync(join(dir, artifactPath({ ...ID, passId: "pass2" })), "utf8")).toBe('{"run":2}');
  });

  it("39b. the pointer is excluded from the lineage index — it is a copy, not a record", () => {
    writeImmutableArtifact(dir, ID, "{}");
    writeLatestPointer(dir, "{}");
    expect(lineageIndex(dir).map((e) => e.file)).toEqual([artifactPath(ID)]);
  });
});

describe("lineage index reports what exists, and nothing else", () => {
  it("lists identity fields parsed from the filename", () => {
    writeImmutableArtifact(dir, ID, "{}");
    const [e] = lineageIndex(dir);
    expect(e).toMatchObject({ kind: "r2-23-stability", runId: "20260731T120000Z", head: "0bdd57508ab8", manifest: "a729286db175", passId: "pass1" });
  });

  it("an empty or missing directory yields an EMPTY index — never a claim about lost artifacts", () => {
    expect(lineageIndex(dir)).toEqual([]);
    expect(lineageIndex(join(dir, "does-not-exist"))).toEqual([]);
  });

  it("ignores files it cannot attribute rather than guessing at their identity", () => {
    writeLatestPointer(dir, "{}", "practice-generation.legacy-canary.json");
    expect(lineageIndex(dir)).toEqual([]);
  });
});
