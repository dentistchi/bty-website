import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const HISTORY_SHA256 = "4aa1bba0d68e7fdcfe300f49298f46dc93be5ea995ffd4ba14b1e55517084f60";
const MIGRATIONS_SHA256 = "2d0d9767c64f4fdf5c002f943f42f6febd425a48ec0a313cbd0414a8a4f5a8dd";
const sha256 = (bytes: Uint8Array | string) => createHash("sha256").update(bytes).digest("hex");
const fixture = (name: string, root: string) => join(root, "src/test-support/fixtures", name);

type Scope = { commit: string; url: string; files: string[]; diffSha256: string };
/** Pinned API evidence keeps a historical file-scope proof runnable in shallow/source-only checkouts. */
export function parseHistoricalScope(raw: string, commit: string): Scope {
  assert.equal(sha256(raw), HISTORY_SHA256, "Historical scope fixture bytes changed; re-verify GitHub provenance before changing its pin");
  const value = JSON.parse(raw) as { repository: string; snapshots: Scope[] };
  assert.equal(value.repository, "dentistchi/bty-website");
  const scope = value.snapshots.find(item => item.commit === commit);
  assert(scope, "Unknown historical commit: a new scope needs independent source evidence");
  assert(scope.files.length > 0, "Historical scope must not be empty");
  assert.equal(new Set(scope.files).size, scope.files.length);
  for (const file of scope.files) assert(!file.startsWith("/") && !file.split("/").includes(".."));
  assert.match(scope.commit, /^[a-f0-9]{40}$/);
  assert.match(scope.diffSha256, /^[a-f0-9]{64}$/);
  assert.equal(scope.url, `https://github.com/dentistchi/bty-website/commit/${scope.commit}`);
  return scope;
}

export function assertMatchingHistoricalFiles(recorded: readonly string[], local: readonly string[]): void {
  assert.deepEqual([...local].sort(), [...recorded].sort(), "Available local Git commit disagrees with pinned GitHub file-scope evidence");
}

export function historicalChangedFiles(commit: string, root = process.cwd()): string[] {
  const scope = parseHistoricalScope(readFileSync(fixture("historical-change-scopes.json", root), "utf8"), commit);
  let available = false;
  try {
    execFileSync("git", ["-C", root, "cat-file", "-e", `${commit}^{commit}`], { stdio: "ignore" });
    available = true;
  } catch { /* Missing Git/history is the supported source-only case, never an empty-list pass. */ }
  if (available) {
    const local = execFileSync("git", ["-C", root, "show", "--pretty=format:", "--name-only", commit], { encoding: "utf8" })
      .split("\n").map(line => line.trim()).filter(Boolean);
    assertMatchingHistoricalFiles(scope.files, local);
  }
  return [...scope.files];
}

type SourceEntry = { file: string; sha256: string };
const POST_SNAPSHOT_MIGRATIONS: SourceEntry[] = [
  {
    file: "20261110191609_bty_track_first_login_invites.sql",
    sha256: "eb43e07aba3c762f121818aca6ee6e6d0a9d8166b7ed84b71ac1eb5897370956",
  },
];

/** Observed source registration only: this does not approve SQL semantics or apply a migration. */
export function pinnedLaterSourceMigrations(
  root = process.cwd(),
  readSource: (absolutePath: string) => Uint8Array = absolutePath => readFileSync(absolutePath),
): string[] {
  const raw = readFileSync(fixture("later-migration-source-snapshot.json", root), "utf8");
  assert.equal(sha256(raw), MIGRATIONS_SHA256, "Migration source snapshot bytes changed; re-verify the named source before changing its pin");
  const value = JSON.parse(raw) as { snapshotCommit: string; entries: SourceEntry[] };
  assert.equal(value.snapshotCommit, "7578ec74665af60ae7fa0f9517e47e4c05b4d631");
  assert(value.entries.length > 0);
  const entries = [...value.entries, ...POST_SNAPSHOT_MIGRATIONS];
  assert.equal(new Set(entries.map(entry => entry.file)).size, entries.length);
  return entries.map(entry => {
    assert.match(entry.file, /^\d{14}_[a-z0-9_]+\.sql$/);
    assert.match(entry.sha256, /^[a-f0-9]{64}$/);
    assert.equal(sha256(readSource(join(root, "supabase/migrations", entry.file))), entry.sha256,
      `Pinned migration source changed: ${entry.file}`);
    return entry.file;
  });
}

/** Unknown additions survive this filter and still fail the calling guard's empty-list assertion. */
export function unpinnedMigrationSources(files: readonly string[]): string[] {
  const observed = new Set(pinnedLaterSourceMigrations());
  return files.filter(file => !observed.has(file));
}
