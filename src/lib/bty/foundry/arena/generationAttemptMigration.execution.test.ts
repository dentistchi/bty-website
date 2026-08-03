import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

/**
 * REAL POSTGRESQL EXECUTION GATE (Slice 3.2I-R5B2-R5C-1R1).
 *
 * The R5C-1 migration passed a suite that only read it as TEXT, and then failed on the live
 * database with `cannot use subquery in check constraint` (SQLSTATE 0A000). A regex cannot know
 * what PostgreSQL will accept; only PostgreSQL can.
 *
 * This applies BOTH migrations to a disposable cluster, exactly as `supabase db push` does — one
 * transaction per migration — and then proves the constraints by inserting fixtures.
 *
 * When no local PostgreSQL exists the suite SKIPS LOUDLY rather than passing. A static-only pass
 * is what let the defect through in the first place.
 */

const PG_BIN_CANDIDATES = ["/opt/homebrew/opt/postgresql@17/bin", "/opt/homebrew/opt/postgresql@16/bin", "/usr/local/bin", "/usr/bin"];
const PG_BIN = PG_BIN_CANDIDATES.find((p) => existsSync(join(p, "initdb")) && existsSync(join(p, "pg_ctl")));
const MIGRATIONS = join(process.cwd(), "supabase/migrations");
const PARENT = "20260805000000_foundry_practice_generation_attempts_v1.sql";
const ATTRIBUTION = "20260805010000_foundry_practice_generation_refusal_attribution_v1.sql";

/** Short path: a unix socket directory over ~103 bytes is rejected by libpq. */
let dataDir = "";
let sockDir = "";
const PORT = "55437";
let up = false;

const bin = (name: string) => join(PG_BIN ?? "", name);
const sh = (cmd: string, args: string[]) => execFileSync(cmd, args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
const psql = (args: string[], db = "postgres") =>
  sh(bin("psql"), ["-h", sockDir, "-p", PORT, "-U", "postgres", "-d", db, "-v", "ON_ERROR_STOP=1", "-q", ...args]);
/** True when the statement was ACCEPTED by every constraint. */
const accepts = (sql: string, db: string) => {
  try {
    psql(["-tAc", sql], db);
    return true;
  } catch {
    return false;
  }
};

beforeAll(() => {
  if (!PG_BIN) return;
  dataDir = mkdtempSync(join(tmpdir(), "r5c1-pg-"));
  sockDir = mkdtempSync(join(tmpdir(), "r5c1-sock-"));
  sh(bin("initdb"), ["-D", dataDir, "-U", "postgres", "--auth=trust"]);
  sh(bin("pg_ctl"), ["-D", dataDir, "-o", `-p ${PORT} -k ${sockDir}`, "-l", join(dataDir, "log"), "-w", "start"]);
  up = true;
}, 120_000);

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

const DB = "r5c1_exec";
const DRAFT = "22222222-2222-2222-2222-222222222222";
const USER = "11111111-1111-1111-1111-111111111111";

/** `supabase db push` runs each migration in ONE transaction — `-1` reproduces that faithfully. */
function applyMigration(file: string) {
  psql(["-1", "-f", join(MIGRATIONS, file)], DB);
}

function freshDatabase() {
  psql(["-tAc", `drop database if exists ${DB};`]);
  psql(["-tAc", `create database ${DB};`]);
  // The Supabase roles the migrations revoke from, plus the FK parents.
  psql(
    [
      "-c",
      `do $$ begin
         if not exists (select 1 from pg_roles where rolname='anon') then create role anon nologin; end if;
         if not exists (select 1 from pg_roles where rolname='authenticated') then create role authenticated nologin; end if;
         if not exists (select 1 from pg_roles where rolname='service_role') then create role service_role nologin; end if;
       end $$;
       create schema if not exists auth;
       create table auth.users(id uuid primary key);
       create table public.foundry_events(id uuid primary key);
       create table public.foundry_arena_scenario_drafts(id uuid primary key);
       insert into auth.users(id) values ('${USER}');
       insert into public.foundry_arena_scenario_drafts(id) values ('${DRAFT}');`,
    ],
    DB,
  );
}

const COLS =
  "draft_id, draft_revision, owner_user_id, correlation_id, provider_timeout_ms, model, structured_output_mode, max_tokens, locale, lifecycle_state, finished_at, outcome";
const VALS = `'${DRAFT}', 1, '${USER}', gen_random_uuid(), 120000, 'gpt-4o-mini', 'json_schema_strict', 16000, 'en', 'completed', now(), 'scenario_quality_rejected'`;
const insert = (extraCols: string, extraVals: string) =>
  `insert into public.foundry_practice_generation_attempts (${COLS}${extraCols}) values (${VALS}${extraVals});`;
const pair = (stage: string, reason: string) =>
  insert(", attribution_version, terminal_stage, terminal_reason_code", `, 1, '${stage}', '${reason}'`);

describe.runIf(Boolean(PG_BIN))("[R5C-1R1] the migrations EXECUTE in PostgreSQL", () => {
  beforeAll(() => {
    freshDatabase();
  }, 60_000);

  it("both migrations apply, each in one transaction", () => {
    expect(() => applyMigration(PARENT)).not.toThrow();
    // The R5C-1 form threw here: cannot use subquery in check constraint (0A000).
    expect(() => applyMigration(ATTRIBUTION)).not.toThrow();
  });

  it("the attribution migration is safe to re-run", () => {
    // Both partial-application states converge: `add column if not exists` plus catalog guards.
    expect(() => applyMigration(ATTRIBUTION)).not.toThrow();
  });

  it("no CHECK constraint in the live schema contains a subquery", () => {
    const defs = psql(
      ["-tAc", `select pg_get_constraintdef(oid) from pg_constraint where conrelid = 'public.foundry_practice_generation_attempts'::regclass and contype = 'c';`],
      DB,
    );
    expect(defs.length).toBeGreaterThan(0);
    expect(defs.toLowerCase()).not.toMatch(/\bselect\b/);
  });

  it("all seven attribution columns exist", () => {
    const cols = psql(
      [
        "-tAc",
        `select string_agg(column_name, ',' order by column_name) from information_schema.columns
         where table_name = 'foundry_practice_generation_attempts'
           and column_name in ('attribution_version','terminal_stage','terminal_reason_code','refusal_gate','primary_finding_code','finding_codes','finding_count');`,
      ],
      DB,
    ).trim();
    expect(cols.split(",").filter(Boolean)).toHaveLength(7);
  });

  it("RLS stays enabled and no permissive policy exists", () => {
    const rls = psql(["-tAc", `select relrowsecurity from pg_class where oid = 'public.foundry_practice_generation_attempts'::regclass;`], DB).trim();
    expect(rls).toBe("t");
    const policies = psql(["-tAc", `select count(*) from pg_policies where tablename = 'foundry_practice_generation_attempts';`], DB).trim();
    expect(policies).toBe("0");
  });

  it("client roles hold no privileges on the table", () => {
    for (const role of ["anon", "authenticated"]) {
      const has = psql(
        ["-tAc", `select coalesce(bool_or(has_table_privilege('${role}', 'public.foundry_practice_generation_attempts', p)), false) from unnest(array['SELECT','INSERT','UPDATE','DELETE']) p;`],
        DB,
      ).trim();
      expect(has, `${role} must hold no privilege`).toBe("f");
    }
  });
});

describe.runIf(Boolean(PG_BIN))("[R5C-1R1] the constraints behave", () => {
  it("a HISTORICAL row with NULL attribution remains valid — no backfill is needed", () => {
    expect(accepts(insert("", ""), DB)).toBe(true);
  });

  const CANONICAL: Array<[string, string]> = [
    ["observability_gate", "generation_observability_unavailable"],
    ["generation_eligibility", "generation_not_eligible"],
    ["generation_provider", "provider_timeout"],
    ["generation_provider", "provider_http_error"],
    ["generation_parse", "provider_malformed_output"],
    ["generation_schema", "provider_schema_invalid"],
    ["scenario_quality", "scenario_quality_rejected"],
    ["semantic_review", "semantic_content_rejected"],
    ["semantic_review", "semantic_reviewer_terminal_failure"],
    ["boundary_review", "boundary_content_rejected"],
    ["boundary_review", "boundary_review_authority_failure"],
    ["persistence", "scenario_persistence_failed"],
    ["internal", "internal_unclassified_failure"],
  ];
  it.each(CANONICAL)("accepts the canonical pair %s / %s", (stage, reason) => {
    expect(accepts(pair(stage, reason), DB)).toBe(true);
  });

  const IMPOSSIBLE: Array<[string, string]> = [
    // R5B's exact mis-attribution — now impossible in the database, not merely in the resolver.
    ["boundary_review", "semantic_reviewer_terminal_failure"],
    ["semantic_review", "boundary_content_rejected"],
    ["scenario_quality", "provider_timeout"],
    ["persistence", "scenario_quality_rejected"],
    ["boundary_review", "scenario_persistence_failed"],
    ["internal", "boundary_content_rejected"],
    ["generation_provider", "scenario_quality_rejected"],
    ["scenario_quality", "internal_unclassified_failure"],
  ];
  it.each(IMPOSSIBLE)("rejects the impossible pair %s / %s", (stage, reason) => {
    expect(accepts(pair(stage, reason), DB)).toBe(false);
  });

  const CODES: Array<[string, string, boolean]> = [
    ["NULL codes", ", finding_codes, finding_count) values (" + VALS + ", null, null", true],
  ];
  void CODES;

  const findings = (vals: string) => insert(", finding_codes, finding_count", vals);
  it.each([
    ["NULL array", ", null, null", true],
    ["empty array", ", array[]::text[], 0", true],
    ["one valid code", ", array['moral_asymmetry'], 1", true],
    ["eight valid codes", ", array['aa_b','bb_c','cc_d','dd_e','ee_f','ff_g','gg_h','hh_i'], 8", true],
    ["nine codes", ", array['a1_b','a2_b','a3_b','a4_b','a5_b','a6_b','a7_b','a8_b','a9_b'], 9", false],
    ["NULL element", ", array['ok_code', null], 2", false],
    ["uppercase", ", array['Bad_Code'], 1", false],
    ["prose", ", array['the reviewer said it was wrong'], 1", false],
    ["punctuation", ", array['bad-punct!'], 1", false],
    ["comma inside an element", ", array['ab_c,de_f'], 1", false],
    ["64-character identifier", ", array['a' || repeat('b',63)], 1", true],
    ["65-character identifier", ", array['a' || repeat('b',64)], 1", false],
    ["multidimensional array", ", array[array['aa_b','bb_c'],array['cc_d','dd_e']], 4", false],
    ["count that disagrees with the array", ", array['ab_c'], 3", false],
  ])("finding codes — %s", (_label, vals, expected) => {
    expect(accepts(findings(vals), DB)).toBe(expected);
  });

  it("rejects prose in the primary finding code", () => {
    expect(accepts(insert(", primary_finding_code", ", 'No real tradeoff at all'"), DB)).toBe(false);
    expect(accepts(insert(", primary_finding_code", ", 'moral_asymmetry'"), DB)).toBe(true);
  });

  it("a version-1 completed row must name both stage and reason", () => {
    expect(accepts(insert(", attribution_version", ", 1"), DB)).toBe(false);
  });
});

describe("[R5C-1R1] the execution gate is honest about its own availability", () => {
  it("states plainly when no local PostgreSQL is present", () => {
    // A skip is a stated absence of proof. A static-only pass is what let 0A000 reach the database.
    if (!PG_BIN) {
      console.warn("[R5C-1R1] SKIPPED — no local initdb/pg_ctl found; migration EXECUTION is unproven here.");
    }
    expect(PG_BIN === undefined || typeof PG_BIN === "string").toBe(true);
  });
});
