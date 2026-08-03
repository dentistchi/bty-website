import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

/**
 * REAL POSTGRESQL EXECUTION GATE — GENERATION-INPUT REVISION (Slice 3.2I-R5B2-R5C-4A1).
 *
 * A migration that adds a NOT NULL column to a populated table is exactly the kind that reads fine
 * and behaves badly. The two questions a regex cannot answer are asked here against a real
 * cluster: do EXISTING draft rows come out at baseline 1 WITHOUT their business fields being
 * touched, and do the two historical attempts stay NULL rather than being quietly backfilled?
 *
 * When no local PostgreSQL exists the suite SKIPS LOUDLY rather than passing.
 */

const PG_BIN_CANDIDATES = ["/opt/homebrew/opt/postgresql@17/bin", "/opt/homebrew/opt/postgresql@16/bin", "/usr/local/bin", "/usr/bin"];
const PG_BIN = PG_BIN_CANDIDATES.find((p) => existsSync(join(p, "initdb")) && existsSync(join(p, "pg_ctl")));
const MIGRATIONS = join(process.cwd(), "supabase/migrations");
const M_PARENT = "20260805000000_foundry_practice_generation_attempts_v1.sql";
const M_ATTRIBUTION = "20260805010000_foundry_practice_generation_refusal_attribution_v1.sql";
const M_CALLS = "20260805020000_foundry_practice_generation_attempt_calls_v1.sql";
const M_INPUT_REV = "20260805030000_foundry_practice_generation_input_revision_v1.sql";

let dataDir = "";
let sockDir = "";
const PORT = "55441";
let up = false;

const bin = (name: string) => join(PG_BIN ?? "", name);
const sh = (cmd: string, args: string[]) => execFileSync(cmd, args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
const psql = (args: string[], db = "postgres") =>
  sh(bin("psql"), ["-h", sockDir, "-p", PORT, "-U", "postgres", "-d", db, "-v", "ON_ERROR_STOP=1", "-q", ...args]);

beforeAll(() => {
  if (!PG_BIN) return;
  dataDir = mkdtempSync(join(tmpdir(), "r4a1-pg-"));
  sockDir = mkdtempSync(join(tmpdir(), "r4a1-sock-"));
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

const DB = "r4a1_exec";
const DRAFT = "22222222-2222-2222-2222-222222222222";
const USER = "11111111-1111-1111-1111-111111111111";
const ATTEMPT_A = "33333333-3333-3333-3333-333333333333";
const ATTEMPT_B = "44444444-4444-4444-4444-444444444444";
const DRAFTS = "public.foundry_arena_scenario_drafts";
const ATTEMPTS = "public.foundry_practice_generation_attempts";
const CALLS = "public.foundry_practice_generation_attempt_calls";

const applyMigration = (file: string) => psql(["-1", "-f", join(MIGRATIONS, file)], DB);
const q = (sql: string) => psql(["-tAc", sql], DB).trim();
const ok = (sql: string) => {
  try {
    psql(["-tAc", sql], DB);
    return true;
  } catch {
    return false;
  }
};

/**
 * A draft table shaped like production's, populated BEFORE the migration — the only way to prove
 * what existing rows read afterwards.
 */
function freshDatabase() {
  psql(["-tAc", `drop database if exists ${DB};`]);
  psql(["-tAc", `create database ${DB};`]);
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
       create table ${DRAFTS} (
         id uuid primary key,
         owner_user_id uuid,
         guided_answers jsonb,
         scenario_draft jsonb,
         revision integer not null default 0,
         updated_at timestamptz not null default now()
       );
       insert into auth.users(id) values ('${USER}');
       insert into ${DRAFTS} (id, owner_user_id, guided_answers, scenario_draft, revision, updated_at)
         values ('${DRAFT}', '${USER}', '{"practiceBoundary":{"mode":"judgment","confirmed":true,"constraints":[]}}'::jsonb,
                 null, 1, timestamptz '2026-08-02 19:37:51.801-07');`,
    ],
    DB,
  );
}

/** The TWO historical attempts, recorded before this contract existed. */
function seedHistoricalAttempts() {
  for (const [id, outcome] of [
    [ATTEMPT_A, "boundary_review_rejected"],
    [ATTEMPT_B, "scenario_quality_rejected"],
  ]) {
    psql(
      [
        "-c",
        `insert into ${ATTEMPTS}
          (id, draft_id, draft_revision, owner_user_id, correlation_id, provider_timeout_ms, model,
           structured_output_mode, max_tokens, locale, lifecycle_state, finished_at, outcome)
         values ('${id}', '${DRAFT}', 1, '${USER}', gen_random_uuid(), 120000, 'gpt-4o-mini',
                 'json_schema_strict', 16000, 'en', 'completed', now(), '${outcome}');`,
      ],
      DB,
    );
  }
}

describe.runIf(Boolean(PG_BIN))("[R5C-4A1] all four migrations EXECUTE in order", () => {
  beforeAll(() => {
    freshDatabase();
    applyMigration(M_PARENT);
    applyMigration(M_ATTRIBUTION);
    applyMigration(M_CALLS);
    seedHistoricalAttempts();
  }, 60_000);

  it("the pre-migration state matches the captured live fixture", () => {
    expect(q(`select count(*) from ${ATTEMPTS};`)).toBe("2");
    expect(q(`select count(*) from ${CALLS};`)).toBe("0");
    expect(q(`select revision from ${DRAFTS} where id = '${DRAFT}';`)).toBe("1");
  });

  it("the input-revision migration applies in ONE transaction", () => {
    expect(() => applyMigration(M_INPUT_REV)).not.toThrow();
  });

  it("is safe to re-run — every step is idempotent", () => {
    expect(() => applyMigration(M_INPUT_REV)).not.toThrow();
    // Re-running must not duplicate a constraint or reset a value.
    expect(q(`select count(*) from pg_constraint where conname = 'foundry_arena_draft_gen_input_rev_chk';`)).toBe("1");
    expect(q(`select count(*) from pg_constraint where conname = 'foundry_practice_gen_attempt_input_rev_chk';`)).toBe("1");
  });
});

describe.runIf(Boolean(PG_BIN))("[R5C-4A1] existing rows are given a baseline WITHOUT being rewritten", () => {
  it("the existing draft reads baseline 1", () => {
    expect(q(`select generation_input_revision from ${DRAFTS} where id = '${DRAFT}';`)).toBe("1");
  });

  it("its business fields and updated_at are UNTOUCHED", () => {
    // The whole safety claim of a constant-default NOT NULL column: no table rewrite, so no
    // business column moves and `updated_at` does not shift.
    expect(q(`select updated_at from ${DRAFTS} where id = '${DRAFT}';`)).toContain("2026-08-02 19:37:51.801");
    expect(q(`select revision from ${DRAFTS} where id = '${DRAFT}';`)).toBe("1");
    expect(q(`select guided_answers->'practiceBoundary'->>'mode' from ${DRAFTS} where id = '${DRAFT}';`)).toBe("judgment");
    expect(q(`select coalesce(scenario_draft::text, 'NULL') from ${DRAFTS} where id = '${DRAFT}';`)).toBe("NULL");
  });

  it("BOTH historical attempts remain NULL — nothing was backfilled", () => {
    // A fabricated epoch is indistinguishable from a measured one once written, which is exactly
    // why the column is nullable rather than defaulted on this table.
    expect(q(`select count(*) from ${ATTEMPTS} where generation_input_revision is null;`)).toBe("2");
    expect(q(`select count(*) from ${ATTEMPTS};`)).toBe("2");
  });

  it("no attempt row was updated and no child row was created", () => {
    expect(q(`select count(*) from ${ATTEMPTS} where outcome is null;`)).toBe("0");
    expect(q(`select count(*) from ${CALLS};`)).toBe("0");
    // Their original outcomes survive verbatim.
    expect(q(`select string_agg(outcome, ',' order by outcome) from ${ATTEMPTS};`)).toBe(
      "boundary_review_rejected,scenario_quality_rejected",
    );
  });
});

describe.runIf(Boolean(PG_BIN))("[R5C-4A1] the column contracts are enforced by the database", () => {
  it("a draft cannot store a value below 1", () => {
    expect(ok(`update ${DRAFTS} set generation_input_revision = 0 where id = '${DRAFT}';`)).toBe(false);
    expect(ok(`update ${DRAFTS} set generation_input_revision = -1 where id = '${DRAFT}';`)).toBe(false);
    // Still 1 after both rejections.
    expect(q(`select generation_input_revision from ${DRAFTS} where id = '${DRAFT}';`)).toBe("1");
  });

  it("a draft cannot store NULL", () => {
    expect(ok(`update ${DRAFTS} set generation_input_revision = null where id = '${DRAFT}';`)).toBe(false);
  });

  it("a draft accepts a later epoch", () => {
    expect(ok(`update ${DRAFTS} set generation_input_revision = 2 where id = '${DRAFT}';`)).toBe(true);
    expect(q(`select generation_input_revision from ${DRAFTS} where id = '${DRAFT}';`)).toBe("2");
    psql(["-tAc", `update ${DRAFTS} set generation_input_revision = 1 where id = '${DRAFT}';`], DB);
  });

  it("an attempt MAY be NULL (historical) and MAY be >= 1 (new)", () => {
    const scratch = "55555555-5555-5555-5555-555555555555";
    const ins = (gir: string) =>
      `insert into ${ATTEMPTS} (id, draft_id, draft_revision, owner_user_id, correlation_id, provider_timeout_ms,
        model, structured_output_mode, max_tokens, locale, generation_input_revision)
       values ('${scratch}', '${DRAFT}', 1, '${USER}', gen_random_uuid(), 120000, 'm', 'none', 1, 'en', ${gir});`;
    expect(ok(ins("null"))).toBe(true);
    psql(["-tAc", `delete from ${ATTEMPTS} where id = '${scratch}';`], DB);
    expect(ok(ins("3"))).toBe(true);
    psql(["-tAc", `delete from ${ATTEMPTS} where id = '${scratch}';`], DB);
  });

  it("an attempt cannot store an invalid non-NULL value", () => {
    const scratch = "66666666-6666-6666-6666-666666666666";
    const ins = (gir: string) =>
      `insert into ${ATTEMPTS} (id, draft_id, draft_revision, owner_user_id, correlation_id, provider_timeout_ms,
        model, structured_output_mode, max_tokens, locale, generation_input_revision)
       values ('${scratch}', '${DRAFT}', 1, '${USER}', gen_random_uuid(), 120000, 'm', 'none', 1, 'en', ${gir});`;
    expect(ok(ins("0"))).toBe(false);
    expect(ok(ins("-2"))).toBe(false);
  });

  it("the same-epoch lookup index exists for the governance slice", () => {
    expect(q(`select count(*) from pg_indexes where indexname = 'foundry_practice_gen_attempt_input_rev_idx';`)).toBe("1");
  });
});

describe.runIf(Boolean(PG_BIN))("[R5C-4A1] RLS and grants are untouched", () => {
  it("both tables keep row level security enabled", () => {
    expect(q(`select relrowsecurity from pg_class where oid = '${ATTEMPTS}'::regclass;`)).toBe("t");
    expect(q(`select relrowsecurity from pg_class where oid = '${CALLS}'::regclass;`)).toBe("t");
  });

  it("client roles still hold no privilege on the attempt tables", () => {
    for (const role of ["anon", "authenticated"]) {
      for (const table of [ATTEMPTS, CALLS]) {
        const has = q(
          `select coalesce(bool_or(has_table_privilege('${role}', '${table}', p)), false) from unnest(array['SELECT','INSERT','UPDATE','DELETE']) p;`,
        );
        expect(has, `${role} must hold no privilege on ${table}`).toBe("f");
      }
    }
  });

  it("the migration defines no trigger", () => {
    // Governance is derived by query, never maintained by a trigger writing a second source of truth.
    for (const table of [DRAFTS, ATTEMPTS]) {
      expect(
        q(`select count(*) from pg_trigger t join pg_class c on c.oid = t.tgrelid
           where c.oid = '${table}'::regclass and not t.tgisinternal;`),
      ).toBe("0");
    }
  });

  it("no refusal-COUNT column was added — the count stays derived", () => {
    // Scoped to a stored COUNT, not to the word "refusal": `refusal_gate` is R5C-1 attribution and
    // legitimately exists. A stored counter would be a second source of truth able to disagree
    // with the attempt rows themselves; the governance slice derives it atomically instead.
    const counters = q(
      `select coalesce(string_agg(table_name || '.' || column_name, ','), '') from information_schema.columns
       where table_name in ('foundry_arena_scenario_drafts','foundry_practice_generation_attempts')
         and (column_name like '%refusal%count%' or column_name like '%count%refusal%'
              or column_name in ('refusal_count','retry_count','attempt_count'));`,
    );
    expect(counters).toBe("");
    // The pre-existing attribution column is untouched and still present.
    expect(
      q(`select count(*) from information_schema.columns
         where table_name = 'foundry_practice_generation_attempts' and column_name = 'refusal_gate';`),
    ).toBe("1");
  });
});
