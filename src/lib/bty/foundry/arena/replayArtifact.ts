/**
 * IMMUTABLE REPLAY EVIDENCE (Slice 3.2I-R5B1A.1-R2.25).
 *
 * Same durability contract as the stability case artifact: identity in the filename, fail-closed on
 * collision, atomic temp → fsync → rename, digest verified by reading the file back from disk.
 *
 * Separate from `caseArtifact` because a replay artifact is a REVIEWER measurement, not a generation
 * measurement. Keeping the namespaces apart means a replay result can never be collated as stability
 * evidence, and `mode` in the name keeps a mock proof out of a live measurement.
 */

import { createHash } from "node:crypto";
import { closeSync, existsSync, fsyncSync, mkdirSync, openSync, readFileSync, readdirSync, renameSync, unlinkSync, writeSync } from "node:fs";
import { join } from "node:path";

export const REPLAY_ARTIFACT_KIND = "reviewreplay";

export type ReplayArtifactId = {
  mode: "mock" | "live";
  replayRunId: string;
  sourcePassId: string;
  sourceCaseId: string;
  sourceAttemptIndex: number;
  reviewSubjectSha256: string;
};

const shortHex = (s: string) => s.replace(/[^0-9a-f]/gi, "").slice(0, 12) || "unknown";
const safe = (s: string) => s.replace(/[^A-Za-z0-9_-]/g, "-");

/** `practice-review.reviewreplay.<mode>.<replayRunId>.<pass>.<case>.a<idx>.<subject12>.json` */
export function replayArtifactPath(id: ReplayArtifactId): string {
  return [
    "practice-review",
    REPLAY_ARTIFACT_KIND,
    id.mode,
    safe(id.replayRunId),
    safe(id.sourcePassId),
    safe(id.sourceCaseId),
    `a${id.sourceAttemptIndex}`,
    shortHex(id.reviewSubjectSha256),
    "json",
  ].join(".");
}

export const sha256 = (s: string): string => createHash("sha256").update(s).digest("hex");

export class ReplayWriteError extends Error {
  readonly code = "infrastructure_artifact_write_failure";
}

export function writeReplayArtifact(dir: string, id: ReplayArtifactId, payload: string): { path: string; sha256: string; bytes: number } {
  mkdirSync(dir, { recursive: true });
  const name = replayArtifactPath(id);
  const finalPath = join(dir, name);
  if (existsSync(finalPath)) {
    throw new ReplayWriteError(`ARTIFACT COLLISION · refusing to overwrite ${name} — a replay result already exists for this subject`);
  }
  const tmpPath = join(dir, `.${name}.${process.pid}.tmp`);
  let fd: number | null = null;
  try {
    fd = openSync(tmpPath, "wx");
    writeSync(fd, payload);
    fsyncSync(fd);
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
      /* a leftover temp file is never mistaken for evidence */
    }
    if (e instanceof ReplayWriteError) throw e;
    throw new ReplayWriteError(`replay artifact write failed for ${name}: ${e instanceof Error ? e.name : "unknown"}`);
  }
  const readBack = readFileSync(finalPath, "utf8");
  const digest = sha256(readBack);
  if (readBack !== payload) throw new ReplayWriteError(`replay artifact verification failed for ${name}`);
  return { path: name, sha256: digest, bytes: Buffer.byteLength(readBack, "utf8") };
}

export type ReplayArtifactEntry = { file: string; mode: "mock" | "live"; replayRunId: string; sourcePassId: string; sourceCaseId: string };

export function listReplayArtifacts(dir: string, replayRunId?: string, mode?: "mock" | "live"): ReplayArtifactEntry[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => f.startsWith(`practice-review.${REPLAY_ARTIFACT_KIND}.`) && f.endsWith(".json"))
    .map((file) => {
      const p = file.split(".");
      if (p.length !== 9) return null;
      if (p[2] !== "mock" && p[2] !== "live") return null;
      return { file, mode: p[2] as "mock" | "live", replayRunId: p[3], sourcePassId: p[4], sourceCaseId: p[5] };
    })
    .filter((e): e is ReplayArtifactEntry => e !== null && (replayRunId === undefined || e.replayRunId === replayRunId) && (mode === undefined || e.mode === mode))
    .sort((a, b) => (a.file < b.file ? -1 : 1));
}
