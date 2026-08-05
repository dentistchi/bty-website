import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

/**
 * REAL POSTGRESQL GATE — CONTRACT STEP (Slice 3.2L Part 0B).
 *
 * The expand/deploy/contract rollout ends here. The expand gate
 * (generationSpendContainment.execution.test.ts) proves that BOTH admission overloads
 * coexist so the previously deployed 15-argument Worker keeps working. This gate proves
 * the opposite end: once a 16-argument caller is live, the old overload is retired and
 * future rows can no longer record a reviewer-terminal failure under a refusal umbrella.
 *
 * The overload ambiguity is the reason the drop is not optional. The 16-argument function
 * declares `p_submission_intent_id uuid default null`, so it also answers to 15 arguments.
 * While both exist, a 15-argument request matches both and PostgREST returns PGRST203
 * rather than choosing. That was measured live, not predicted. Dropping the old overload
 * leaves exactly one admission path and ends the ambiguity permanently.
 *
 * SKIPS LOUDLY when no local PostgreSQL exists.
 */

const PG_BIN_CANDIDATES = ["/opt/homebrew/opt/postgresql@17/bin", "/opt/homebrew/opt/postgresql@16/bin", "/usr/local/bin", "/usr/bin"];
const PG_BIN = PG_BIN_CANDIDATES.find((p) => existsSync(join(p, "initdb")) && existsSync(join(p, "pg_ctl")));
const MIGRATIONS = join(process.cwd(), "supabase/migrations");
const EXPAND_CHAIN = [
  "20260805000000_foundry_practice_generation_attempts_v1.sql",
  "20260805010000_foundry_practice_generation_refusal_attribution_v1.sql",
  "20260805020000_foundry_practice_generation_attempt_calls_v1.sql",
  "20260805030000_foundry_practice_generation_input_revision_v1.sql",
  "20260805040000_foundry_practice_generation_retry_governance_v1.sql",
  "20260805050000_foundry_practice_generation_spend_containment_v1.sql",
];
const CONTRACT = "20260806000000_foundry_practice_generation_contract_v1.sql";

let dataDir = "";
let sockDir = "";
const PORT = "55449";
let up = false;
const bin = (n: string) => join(PG_BIN ?? "", n);
const sh = (c: string, a: string[]) => execFileSync(c, a, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
const psql = (a: string[], db = "postgres") =>
  sh(bin("psql"), ["-h", sockDir, "-p", PORT, "-U", "postgres", "-d", db, "-v", "ON_ERROR_STOP=1", "-q", ...a]);

const DB = "contract_exec";
const OWNER = "11111111-1111-1111-1111-111111111111";
const A = "public.foundry_practice_generation_attempts";
const D = "public.foundry_arena_scenario_drafts";
const FN = "start_foundry_practice_generation_attempt_governed_v1";

const q = (sql: string) => psql(["-tAc", sql], DB).trim();
const ok = (sql: string) => {
  try {
    psql(["-tAc", sql], DB);
    return true;
  } catch {
    return false;
  }
};

let seq = 0;
const uid = (p: string) => `${p}-0000-4000-8000-${String(++seq).padStart(12, "0")}`;
function newDraft() {
  const id = uid("aaaaaaaa");
  psql(["-tAc", `insert into ${D} (id, owner_user_id, revision, generation_input_revision) values ('${id}','${OWNER}',2,2);`], DB);
  return id;
}
/** A completed attempt written the way the PREVIOUS Worker wrote it. */
function legacyWrite(draft: string, outcome: string, reason: string) {
  return `insert into ${A} (id, draft_id, draft_revision, generation_input_revision, owner_user_id, correlation_id,
    provider_timeout_ms, model, structured_output_mode, max_tokens, locale, lifecycle_state, finished_at, outcome, terminal_reason_code)
    values ('${uid("bbbbbbbb")}','${draft}',2,2,'${OWNER}',gen_random_uuid(),120000,'m','none',1,'en','completed',now(),'${outcome}','${reason}');`;
}

const countFn = (nargs: number) =>
  q(`select count(*) from pg_proc where proname='${FN}' and pronargs=${nargs};`);

beforeAll(() => {
  if (!PG_BIN) return;
  dataDir = mkdtempSync(join(tmpdir(), "contract-pg-"));
  sockDir = mkdtempSync(join(tmpdir(), "contract-sock-"));
  sh(bin("initdb"), ["-D", dataDir, "-U", "postgres", "--auth=trust"]);
  sh(bin("pg_ctl"), ["-D", dataDir, "-o", `-p ${PORT} -k ${sockDir}`, "-l", join(dataDir, "log"), "-w", "start"]);
  up = true;
  psql(["-tAc", `create database ${DB};`]);
  psql(["-tAc", "create schema if not exists auth;"], DB);
  psql(["-tAc", "create table if not exists auth.users (id uuid primary key);"], DB);
  psql(["-tAc", `insert into auth.users (id) values ('${OWNER}') on conflict do nothing;`], DB);
  psql(["-tAc", "create table if not exists public.foundry_arena_scenario_drafts (id uuid primary key, owner_user_id uuid, revision integer, generation_input_revision integer);"], DB);
  psql(["-tAc", "create table if not exists public.foundry_events (id uuid primary key, owner_user_id uuid);"], DB);
  for (const r of ["anon", "authenticated", "service_role"]) {
    psql(["-tAc", `do $$ begin if not exists (select 1 from pg_roles where rolname='${r}') then create role ${r} nologin; end if; end $$;`], DB);
  }
  for (const m of EXPAND_CHAIN) psql(["-1", "-f", join(MIGRATIONS, m)], DB);
}, 180_000);

afterAll(() => {
  if (!up) return;
  try {
    sh(bin("pg_ctl"), ["-D", dataDir, "-m", "immediate", "-w", "stop"]);
  } catch {
    /* best effort */
  }
  rmSync(dataDir, { recursive: true, force: true });
  rmSync(sockDir, { recursive: true, force: true });
}, 60_000);

describe.runIf(Boolean(PG_BIN))("[3.2L-0B] the contract step retires the legacy admission path", () => {
  it("BEFORE contract: both overloads exist and the legacy write is accepted", () => {
    expect(countFn(15)).toBe("1");
    expect(countFn(16)).toBe("1");
    const d = newDraft();
    expect(ok(legacyWrite(d, "boundary_review_rejected", "semantic_reviewer_terminal_failure"))).toBe(true);
  });

  it("the contract migration applies over rows that carry the old mapping", () => {
    // The historical evidence is present BEFORE the constraint is added — a VALID
    // constraint would fail here; NOT VALID is what lets the evidence survive.
    const before = q(`select count(*) from ${A} where outcome='boundary_review_rejected' and terminal_reason_code='semantic_reviewer_terminal_failure';`);
    expect(Number(before)).toBeGreaterThan(0);
    expect(() => psql(["-1", "-f", join(MIGRATIONS, CONTRACT)], DB)).not.toThrow();
    expect(q(`select count(*) from ${A} where outcome='boundary_review_rejected' and terminal_reason_code='semantic_reviewer_terminal_failure';`)).toBe(before);
  });

  it("is safe to re-run", () => {
    expect(() => psql(["-1", "-f", join(MIGRATIONS, CONTRACT)], DB)).not.toThrow();
  });

  it("AFTER contract: the 15-argument overload is gone and only the 16-argument one remains", () => {
    expect(countFn(15)).toBe("0");
    expect(countFn(16)).toBe("1");
    expect(q(`select count(*) from pg_proc where proname='${FN}';`)).toBe("1");
  });

  it("the surviving overload keeps the service-role-only posture", () => {
    const sig = `${FN}(uuid, uuid, integer, text, boolean, uuid, uuid, text, integer, text, text, integer, text, integer, integer, uuid)`;
    for (const r of ["anon", "authenticated", "public"]) {
      expect(q(`select has_function_privilege('${r}','${sig}','EXECUTE');`)).toBe("f");
    }
    expect(q(`select has_function_privilege('service_role','${sig}','EXECUTE');`)).toBe("t");
  });

  it("the contradiction constraint exists and stays NOT VALID", () => {
    expect(q(`select count(*) from pg_constraint where conname='foundry_practice_gen_attempt_review_exec_chk';`)).toBe("1");
    // NOT VALID is the whole reason the historical rows survive — assert it explicitly.
    expect(q(`select convalidated::text from pg_constraint where conname='foundry_practice_gen_attempt_review_exec_chk';`)).toBe("false");
  });

  it("FUTURE rows cannot repeat the contradiction, and the honest outcome is accepted", () => {
    const d = newDraft();
    expect(ok(legacyWrite(d, "boundary_review_rejected", "semantic_reviewer_terminal_failure")),
      "a semantic terminal failure must not carry a boundary umbrella").toBe(false);
    expect(ok(legacyWrite(d, "review_execution_failed", "semantic_reviewer_terminal_failure"))).toBe(true);
    expect(ok(legacyWrite(d, "review_execution_failed", "boundary_reviewer_terminal_failure"))).toBe(true);
  });

  it("historical rows written before the constraint remain untouched", () => {
    expect(Number(q(`select count(*) from ${A} where outcome='boundary_review_rejected' and terminal_reason_code='semantic_reviewer_terminal_failure';`))).toBeGreaterThan(0);
  });

  it("the migration mutates no historical row", () => {
    const sql = require("node:fs").readFileSync(join(MIGRATIONS, CONTRACT), "utf8") as string;
    const executable = sql.split("\n").filter((l) => !l.trim().startsWith("--")).join("\n");
    expect(executable).not.toMatch(/\bupdate\s+public\./i);
    expect(executable).not.toMatch(/\bdelete\s+from\s+public\./i);
  });
});
