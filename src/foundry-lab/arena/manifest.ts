/**
 * BTY FOUNDRY LAB — Arena benchmark manifest (M0).
 *
 * The Foundry Lab is an EXTERNAL measurement layer. Nothing in the application imports it, and it
 * never changes how the Arena Training Builder behaves; it only feeds frozen cases to the existing
 * generator and records what came back.
 *
 * IMMUTABILITY. A case is identified by `case_id` and pinned by a SHA-256 of its canonical JSON in
 * the lock file. Editing a case's content without a new `benchmark_version` fails validation, so a
 * result can always be tied to exactly the input that produced it.
 */
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { programContext } from "@/domain/foundry/module/program-authorship";
import { builderApprovalErrors } from "@/domain/foundry/module/module-publish";
import type { BuilderAnswers } from "@/domain/foundry/module/module-builder";

export type BenchmarkCase = {
  case_id: string;
  category: string;
  locale: "en" | "ko";
  answers: BuilderAnswers;
};

export type BenchmarkManifest = {
  benchmark_id: string;
  benchmark_version: string;
  description: string;
  source_bounds: string;
  cases: BenchmarkCase[];
};

export type BenchmarkLock = {
  benchmark_id: string;
  benchmark_version: string;
  cases: Record<string, string>;
};

export const BENCHMARK_DIR = path.join(process.cwd(), "src/foundry-lab/arena/benchmark");
export const DEFAULT_MANIFEST = "arena-training-v1.json";
export const CASE_ID_RE = /^arena-training-\d{3}$/;

/** Stable JSON: object keys sorted recursively, so a hash never depends on key order. */
export function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, v]) => v !== undefined)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
    return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${canonicalJson(v)}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

export const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");

export function caseHash(c: BenchmarkCase): string {
  return sha256(canonicalJson(c));
}

/** One hash for the whole benchmark: version + every case hash, in case-id order. */
export function benchmarkHash(m: BenchmarkManifest): string {
  const cases = [...m.cases].sort((a, b) => (a.case_id < b.case_id ? -1 : 1)).map((c) => [c.case_id, caseHash(c)]);
  return sha256(canonicalJson({ id: m.benchmark_id, version: m.benchmark_version, cases }));
}

export function buildLock(m: BenchmarkManifest): BenchmarkLock {
  return {
    benchmark_id: m.benchmark_id,
    benchmark_version: m.benchmark_version,
    cases: Object.fromEntries(m.cases.map((c) => [c.case_id, caseHash(c)])),
  };
}

/**
 * Every problem with a manifest, or []. Checks the SHAPE, then that each case is something the
 * EXISTING builder would accept (`programContext` + `builderApprovalErrors` — the product's own
 * authorities, not a restatement), then the lock.
 */
export function validateManifest(m: unknown, lock?: BenchmarkLock): string[] {
  const errors: string[] = [];
  const man = m as Partial<BenchmarkManifest> | null;
  if (!man || typeof man !== "object") return ["manifest_not_object"];
  if (typeof man.benchmark_id !== "string" || !man.benchmark_id) errors.push("benchmark_id_missing");
  if (typeof man.benchmark_version !== "string" || !/^\d+\.\d+\.\d+$/.test(man.benchmark_version)) errors.push("benchmark_version_invalid");
  if (!Array.isArray(man.cases) || man.cases.length === 0) return [...errors, "cases_missing"];
  const seen = new Set<string>();
  for (const c of man.cases) {
    const id = (c as BenchmarkCase)?.case_id;
    if (typeof id !== "string" || !CASE_ID_RE.test(id)) { errors.push(`case_id_invalid:${String(id)}`); continue; }
    if (seen.has(id)) errors.push(`case_id_duplicate:${id}`);
    seen.add(id);
    if (c.locale !== "en" && c.locale !== "ko") errors.push(`locale_invalid:${id}`);
    if (typeof c.category !== "string" || !c.category) errors.push(`category_missing:${id}`);
    if (!c.answers || typeof c.answers !== "object") { errors.push(`answers_missing:${id}`); continue; }
    if (programContext(c.answers) === null) errors.push(`program_context_incomplete:${id}`);
    for (const e of builderApprovalErrors(c.answers)) errors.push(`builder_${e}:${id}`);
  }
  if (lock) {
    if (lock.benchmark_version !== man.benchmark_version) errors.push("lock_version_mismatch");
    const hashes = buildLock(man as BenchmarkManifest).cases;
    for (const [id, h] of Object.entries(hashes)) {
      if (!(id in lock.cases)) errors.push(`case_not_locked:${id}`);
      else if (lock.cases[id] !== h) errors.push(`case_changed_without_new_version:${id}`);
    }
    for (const id of Object.keys(lock.cases)) if (!(id in hashes)) errors.push(`locked_case_removed:${id}`);
  }
  return errors;
}

export function lockPathFor(manifestFile: string): string {
  return manifestFile.replace(/\.json$/, ".lock.json");
}

export function loadManifest(file = path.join(BENCHMARK_DIR, DEFAULT_MANIFEST)): { manifest: BenchmarkManifest; lock: BenchmarkLock; hash: string } {
  const manifest = JSON.parse(readFileSync(file, "utf8")) as BenchmarkManifest;
  const lock = JSON.parse(readFileSync(lockPathFor(file), "utf8")) as BenchmarkLock;
  const errors = validateManifest(manifest, lock);
  if (errors.length) throw new Error(`benchmark manifest invalid: ${errors.join(", ")}`);
  return { manifest, lock, hash: benchmarkHash(manifest) };
}
