/**
 * Explicit native SQL execution for the four historical cleanup test files.
 * This is GitHub Actions-only and accepts one disposable loopback URL. No app
 * environment file, Supabase service, production credential or DROP is used.
 *
 * node scripts/qa/app-persistence-postgres.mjs --output-dir /absolute/empty-dir
 */
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import { createHash } from "node:crypto";
import { spawn } from "node:child_process";
import { once } from "node:events";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
export const TEST_DATABASE_URL = "postgresql://postgres:cleanup-disposable-only@127.0.0.1:55473/postgres?application_name=bty_cleanup_qa";
export const CASES = Object.freeze([
  { file: "src/lib/bty/action-capture/savedRemove.pg.test.ts", tests: 15, prefix: "savrm", databases: 14 },
  { file: "src/lib/bty/announcement/hostTrackRetention.pg.test.ts", tests: 26, prefix: "hret", databases: 26 },
  { file: "src/lib/bty/announcement/integrityReconciliation.pg.test.ts", tests: 23, prefix: "integ", databases: 23 },
  { file: "src/lib/bty/foundry/events/foundryHistoryDismissal.pg.test.ts", tests: 10, prefix: "fhd", databases: 9 },
]);
const DEFAULT_DATABASES = ["postgres", "template0", "template1"];

// This must run before even loading pg. Never accept another host, password,
// port, database, URL query, socket override or caller-provided connection option.
export function validateInvocation(env) {
  assert(env.GITHUB_ACTIONS === "true", "This profile requires GitHub Actions and its fresh PostgreSQL service");
  assert(env.BTY_PG_TEST_URL === TEST_DATABASE_URL, "Only the fixed disposable cleanup database URL is permitted");
}

function privateServiceAddress(host) {
  if (host === "127.0.0.1") return true;
  if (!/^(?:0|[1-9]\d{0,2})(?:\.(?:0|[1-9]\d{0,2})){3}$/.test(host)) return false;
  const parts = host.split(".").map(Number);
  if (parts.some(part => part > 255)) return false;
  return parts[0] === 10 || (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31)
    || (parts[0] === 192 && parts[1] === 168);
}

export function validateFreshCluster(snapshot) {
  assert(snapshot.server.database === "postgres" && snapshot.server.user === "postgres", "Wrong disposable database identity");
  assert(snapshot.server.port === 55473 && privateServiceAddress(snapshot.server.host), "Wrong disposable server address or port");
  assert(snapshot.server.versionNumber >= 170000 && snapshot.server.versionNumber < 180000, "This profile requires PostgreSQL17");
  assert.deepEqual([...snapshot.databases].sort(), DEFAULT_DATABASES, "Refusing an existing cluster or child databases");
  assert.deepEqual(snapshot.publicRelations, [], "Refusing a nonempty public schema");
  assert.deepEqual(snapshot.publicFunctions, [], "Refusing existing public functions");
  assert.deepEqual(snapshot.publicTypes, [], "Refusing existing public types");
  assert.deepEqual(snapshot.userSchemas, ["public"], "Refusing an application/auth schema");
  assert.deepEqual(snapshot.userRoles, ["postgres"], "Refusing an existing application role");
  assert.deepEqual(snapshot.extensions, ["plpgsql"], "Refusing a non-default extension");
}

export function validateWitnesses(databaseNames) {
  const counts = {};
  const known = new Set(DEFAULT_DATABASES);
  for (const item of CASES) {
    const pattern = new RegExp(`^${item.prefix}_[a-z0-9]+_[0-9]+$`);
    const names = databaseNames.filter(name => pattern.test(name));
    counts[item.prefix] = names.length;
    for (const name of names) known.add(name);
    assert.equal(names.length, item.databases, `Missing or extra actual SQL scenario databases: ${item.prefix}`);
  }
  assert.deepEqual(databaseNames.filter(name => !known.has(name)), [], "Unexpected database outside the fixed fixture prefixes");
  assert.deepEqual(databaseNames.filter(name => DEFAULT_DATABASES.includes(name)).sort(), DEFAULT_DATABASES);
  assert.equal(databaseNames.length, 75, "Expected three default databases and72 actual scenario databases");
  return counts;
}

export function validateVitestReport(report) {
  assert.equal(report.numTotalTests, 74);
  assert.equal(report.numPassedTests, 74);
  assert.equal(report.numFailedTests, 0);
  assert.equal(report.numPendingTests, 0);
  assert.equal(report.numTodoTests, 0);
  assert.equal(report.testResults.length, CASES.length);
  const byFile = new Map(report.testResults.map(result => [path.relative(ROOT, result.name).split(path.sep).join("/"), result]));
  for (const item of CASES) {
    const result = byFile.get(item.file);
    assert(result, `Missing exact test file: ${item.file}`);
    assert.equal(result.assertionResults.length, item.tests, `Wrong case count: ${item.file}`);
    for (const test of result.assertionResults) assert.equal(test.status, "passed", `Unexecuted or failed test: ${test.fullName}`);
  }
}

async function snapshotCluster(pool) {
  const { rows: [server] } = await pool.query(`select current_database() as database, current_user as user,
    host(inet_server_addr()) as host, inet_server_port() as port,
    current_setting('server_version_num')::integer as "versionNumber", version() as version`);
  const names = async sql => (await pool.query(sql)).rows.map(row => row.name);
  return {
    server,
    databases: await names("select datname as name from pg_database order by datname"),
    publicRelations: await names("select relname as name from pg_class where relnamespace='public'::regnamespace order by relname"),
    publicFunctions: await names("select proname as name from pg_proc where pronamespace='public'::regnamespace order by proname"),
    publicTypes: await names("select typname as name from pg_type where typnamespace='public'::regnamespace order by typname"),
    userSchemas: await names("select nspname as name from pg_namespace where nspname not in ('pg_catalog','pg_toast','information_schema') order by nspname"),
    userRoles: await names("select rolname as name from pg_roles where left(rolname,3) <> 'pg_' order by rolname"),
    extensions: await names("select extname as name from pg_extension order by extname"),
  };
}

async function sourceHashes() {
  const names = [...CASES.map(item => item.file), "vitest.config.ts", "package-lock.json", "scripts/qa/app-persistence-postgres.mjs"];
  for (const name of (await fs.readdir(path.join(ROOT, "supabase/migrations"))).sort()) {
    if (name.endsWith(".sql")) names.push(`supabase/migrations/${name}`);
  }
  const hashes = {};
  for (const name of names) hashes[name] = createHash("sha256").update(await fs.readFile(path.join(ROOT, name))).digest("hex");
  return hashes;
}

async function run() {
  validateInvocation(process.env);
  assert.equal(process.versions.node.split(".")[0], "20", "Run this profile with Node20");
  const args = process.argv.slice(2);
  assert(args.length === 2 && args[0] === "--output-dir" && path.isAbsolute(args[1]), "Supply --output-dir /absolute/empty-dir");
  const output = args[1];
  await fs.mkdir(output, { recursive: true });
  assert.equal((await fs.readdir(output)).length, 0, "Refusing to overwrite existing evidence");
  const write = (name, data) => fs.writeFile(path.join(output, name), JSON.stringify(data, null, 2) + "\n", { flag: "wx" });
  const log = message => fs.appendFile(path.join(output, "runner.log"), `${new Date().toISOString()} ${message}\n`);
  const result = { scope: "Four unchanged cleanup migration/SQL test files on a fresh disposable PostgreSQL17 service; not Supabase/PostgREST or a live app check",
    passed: false, tests: 0, scenarioDatabases: 0, node: process.version,
    workflowSha: /^[a-f0-9]{40}$/.test(process.env.GITHUB_SHA ?? "") ? process.env.GITHUB_SHA : null,
    retainedDatabases: "Synthetic child databases stay until this job's fresh service container is destroyed; this runner never issues DROP" };
  let pool;
  try {
    await log("Invocation guards passed; no application environment file is loaded");
    // Dependency loading and the first PG connection occur only after the gates.
    const require = createRequire(path.join(ROOT, "package.json"));
    const { Pool } = require("pg");
    pool = new Pool({ connectionString: TEST_DATABASE_URL, ssl: false, options: "", max: 1,
      connectionTimeoutMillis: 5000, statement_timeout: 10000 });
    const before = await snapshotCluster(pool);
    await write("preflight.json", before);
    validateFreshCluster(before);
    await log("Fresh cluster verified: only default databases/roles and empty public schema");
    await write("source-hashes.json", await sourceHashes());
    // CI checkout must not borrow app credentials; the child gets a fresh home.
    for (const name of [".env", ".env.local", ".env.test", ".env.test.local"]) {
      assert.equal(await fs.stat(path.join(ROOT, name)).then(() => true, () => false), false, "Refusing an application environment file");
    }
    const qaHome = path.join(output, "home");
    await fs.mkdir(qaHome, { mode: 0o700 });
    const stdout = await fs.open(path.join(output, "vitest.stdout.log"), "wx");
    const stderr = await fs.open(path.join(output, "vitest.stderr.log"), "wx");
    let code, signal;
    try {
      const child = spawn(process.execPath, [path.join(ROOT, "node_modules/vitest/vitest.mjs"), "run", ...CASES.map(item => item.file),
        "--pool=forks", "--maxWorkers=1", "--minWorkers=1", "--no-file-parallelism", "--retry=0", "--reporter=json",
        `--outputFile=${path.join(output, "vitest.json")}`], {
        cwd: ROOT, stdio: ["ignore", stdout.fd, stderr.fd], timeout: 300000,
        env: { PATH: path.dirname(process.execPath), HOME: qaHome, CI: "1", NODE_ENV: "test", TZ: "UTC", BTY_PG_TEST_URL: TEST_DATABASE_URL },
      });
      [code, signal] = await once(child, "close");
    } finally { await stdout.close(); await stderr.close(); }
    result.child = { code, signal };
    await log(`Exact four-file child finished: code=${code} signal=${signal}`);
    const databases = (await pool.query("select datname from pg_database order by datname")).rows.map(row => row.datname);
    await write("database-witnesses.json", { databases, expectedByPrefix: Object.fromEntries(CASES.map(item => [item.prefix, item.databases])) });
    assert.equal(code, 0, "Native cleanup tests failed; inspect actual Vitest JSON/stdout/stderr");
    assert.equal(signal, null, "Native cleanup tests did not finish normally");
    validateVitestReport(JSON.parse(await fs.readFile(path.join(output, "vitest.json"), "utf8")));
    result.databaseCounts = validateWitnesses(databases);
    result.tests = 74;
    result.scenarioDatabases = 72;
    result.passed = true;
    await log("Verified74 passed/0 skipped plus72 actual SQL scenario database witnesses");
  } catch (error) {
    result.error = String(error?.message ?? error);
    await log(`FAILED: ${result.error}`);
    process.exitCode = 1;
  } finally {
    if (pool) await pool.end();
    await write("result.json", result);
  }
  console.log(JSON.stringify({ passed: result.passed, tests: result.tests, scenarioDatabases: result.scenarioDatabases, output }));
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await run().catch(error => { console.error(String(error?.message ?? error)); process.exitCode = 1; });
}
