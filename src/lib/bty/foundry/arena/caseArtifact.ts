/**
 * PER-CASE IMMUTABLE EVIDENCE (Slice 3.2I-R5B1A.1-R2.23D-R3).
 *
 * THE MEASURED DEFECT
 *
 * The R2.23D-R2 run passed every contract check and both provider checks, then died at 5.01 s in
 * each pass — Vitest's default `testTimeout`. The evaluation harness wrote its artifact only AFTER
 * the loop over every case, so a mid-loop kill left nothing behind and the collator found zero.
 *
 * Whatever the provider actually did in those seconds is now unknowable, because no evidence was
 * reserved before the work began. That is the failure this module exists to prevent: evidence is
 * per CASE, written the moment that case reaches a terminal result, and a claim that it was written
 * is only printed after the file exists and its digest verifies.
 *
 * Durability: content is written to a unique temporary file in the same directory, fsync'd, then
 * atomically renamed onto the final path. A rename within one filesystem is atomic, so a reader
 * never observes a half-written artifact, and a crash mid-write leaves the temporary file rather
 * than a corrupt authoritative one.
 */

import { createHash } from "node:crypto";
import { closeSync, existsSync, fsyncSync, mkdirSync, openSync, readFileSync, readdirSync, renameSync, unlinkSync, writeSync } from "node:fs";
import { join } from "node:path";

export const CASE_ARTIFACT_KIND = "stability";

export type CaseArtifactIdentity = {
  /**
   * R2.23D-R4 — `mock` proves runtime wiring only and can NEVER be read as product evidence. It is
   * in the path AND in the payload, so neither a filename nor a file body alone can be mistaken.
   */
  mode: "mock" | "live";
  runId: string;
  passId: string;
  caseId: string;
  /** Full source HEAD; the path carries its short form. */
  head: string;
  /** Full contract-manifest digest; the path carries its short form. */
  manifestSha256: string;
};

const shortHex = (s: string) => s.replace(/[^0-9a-f]/gi, "").slice(0, 12) || "unknown";
/** Dots separate fields, so they are stripped from every component. */
const safe = (s: string) => s.replace(/[^A-Za-z0-9_-]/g, "-");

/**
 * `practice-generation.stability.<runId>.<passId>.<caseId>.<head12>.<manifest12>.json`
 *
 * Every authority field is in the name, so a case can be attributed without opening it and two runs
 * of different contracts can never collide.
 */
export function caseArtifactPath(id: CaseArtifactIdentity): string {
  return [
    "practice-generation",
    CASE_ARTIFACT_KIND,
    id.mode,
    safe(id.runId),
    safe(id.passId),
    safe(id.caseId),
    shortHex(id.head),
    shortHex(id.manifestSha256),
    "json",
  ].join(".");
}

export const sha256 = (s: string): string => createHash("sha256").update(s).digest("hex");

export type CaseWriteResult = { path: string; sha256: string; bytes: number };

export class ArtifactWriteError extends Error {
  readonly code = "infrastructure_artifact_write_failure";
}

/**
 * Write one case artifact durably and verifiably.
 *
 * Fails CLOSED on collision — it never appends, truncates, renames around it or picks another path.
 * The digest is recomputed by READING THE FILE BACK, so the returned value attests to what is on
 * disk rather than to what was in memory.
 */
export function writeCaseArtifact(dir: string, id: CaseArtifactIdentity, payload: string): CaseWriteResult {
  mkdirSync(dir, { recursive: true });
  const name = caseArtifactPath(id);
  const finalPath = join(dir, name);
  if (existsSync(finalPath)) {
    throw new ArtifactWriteError(`ARTIFACT COLLISION · refusing to overwrite ${name} — a result already exists for this case and contract`);
  }

  // Unique temp name in the SAME directory, so the rename stays within one filesystem.
  const tmpPath = join(dir, `.${name}.${process.pid}.tmp`);
  let fd: number | null = null;
  try {
    fd = openSync(tmpPath, "wx");
    writeSync(fd, payload);
    fsyncSync(fd); // durable before the rename makes it authoritative
    closeSync(fd);
    fd = null;
    renameSync(tmpPath, finalPath);
  } catch (e) {
    if (fd !== null) {
      try {
        closeSync(fd);
      } catch {
        /* already closed */
      }
    }
    try {
      if (existsSync(tmpPath)) unlinkSync(tmpPath);
    } catch {
      /* best effort — a leftover temp file is never mistaken for evidence */
    }
    if (e instanceof ArtifactWriteError) throw e;
    throw new ArtifactWriteError(`artifact write failed for ${name}: ${e instanceof Error ? e.name : "unknown"}`);
  }

  // Verify from DISK. A claim about evidence is only true of what a reader will actually find.
  const readBack = readFileSync(finalPath, "utf8");
  const digest = sha256(readBack);
  if (readBack !== payload || digest !== sha256(payload)) {
    throw new ArtifactWriteError(`artifact verification failed for ${name}: on-disk content differs from what was written`);
  }
  return { path: name, sha256: digest, bytes: Buffer.byteLength(readBack, "utf8") };
}

export type CaseArtifactEntry = {
  file: string;
  mode: "mock" | "live";
  runId: string;
  passId: string;
  caseId: string;
  head: string;
  manifest: string;
};

/** List the case artifacts actually present. Reports what EXISTS; never infers a missing one. */
export function listCaseArtifacts(dir: string, runId?: string, mode?: "mock" | "live"): CaseArtifactEntry[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => f.startsWith(`practice-generation.${CASE_ARTIFACT_KIND}.`) && f.endsWith(".json"))
    .map((file) => {
      const p = file.split(".");
      // practice-generation . stability . mode . runId . passId . caseId . head12 . manifest12 . json
      if (p.length !== 9) return null;
      if (p[2] !== "mock" && p[2] !== "live") return null;
      return { file, mode: p[2], runId: p[3], passId: p[4], caseId: p[5], head: p[6], manifest: p[7] };
    })
    .filter((e): e is CaseArtifactEntry => e !== null && (runId === undefined || e.runId === runId) && (mode === undefined || e.mode === mode))
    .sort((a, b) => (a.file < b.file ? -1 : 1));
}
