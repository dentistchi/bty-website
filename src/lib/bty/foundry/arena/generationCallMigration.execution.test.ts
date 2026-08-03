import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

/**
 * REAL POSTGRESQL EXECUTION GATE — CHILD CALL TABLE (Slice 3.2I-R5B2-R5C-2A).
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
const CALLS = "20260805020000_foundry_practice_generation_attempt_calls_v1.sql";
const ATTRIBUTION = "20260805010000_foundry_practice_generation_refusal_attribution_v1.sql";

/** Short path: a unix socket directory over ~103 bytes is rejected by libpq. */
let dataDir = "";
let sockDir = "";
const PORT = "55439";
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
  dataDir = mkdtempSync(join(tmpdir(), "r5c2-pg-"));
  sockDir = mkdtempSync(join(tmpdir(), "r5c2-sock-"));
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

const DB = "r5c2_exec";
const DRAFT = "22222222-2222-2222-2222-222222222222";
const USER = "11111111-1111-1111-1111-111111111111";
const ATTEMPT = "33333333-3333-3333-3333-333333333333";

/** `supabase db push` runs each migration in ONE transaction — `-1` reproduces that faithfully. */
function applyMigration(file: string) {
  psql(["-1", "-f", join(MIGRATIONS, file)], DB);
}

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
       create table public.foundry_arena_scenario_drafts(id uuid primary key);
       insert into auth.users(id) values ('${USER}');
       insert into public.foundry_arena_scenario_drafts(id) values ('${DRAFT}');`,
    ],
    DB,
  );
}

/** A HISTORICAL parent: completed, NULL attribution, and legitimately zero children. */
function seedParent() {
  psql(
    [
      "-c",
      `insert into public.foundry_practice_generation_attempts
        (id, draft_id, draft_revision, owner_user_id, correlation_id, provider_timeout_ms, model,
         structured_output_mode, max_tokens, locale, lifecycle_state, finished_at, outcome)
       values ('${ATTEMPT}', '${DRAFT}', 1, '${USER}', gen_random_uuid(), 120000, 'gpt-4o-mini',
               'json_schema_strict', 16000, 'en', 'completed', now(), 'scenario_quality_rejected');`,
    ],
    DB,
  );
}

/** A pool of scratch parents, so a fixture never has to spend a sequence position it does not test. */
const POOL_SIZE = 40;
const poolId = (i: number) => `aaaaaaaa-0000-4000-8000-${String(i).padStart(12, "0")}`;
function seedAttemptPool() {
  const values = Array.from({ length: POOL_SIZE }, (_, i) =>
    `('${poolId(i)}', '${DRAFT}', 1, '${USER}', gen_random_uuid(), 120000, 'm', 'none', 1, 'en')`,
  ).join(",");
  psql(
    [
      "-c",
      `insert into public.foundry_practice_generation_attempts
        (id, draft_id, draft_revision, owner_user_id, correlation_id, provider_timeout_ms, model,
         structured_output_mode, max_tokens, locale)
       values ${values};`,
    ],
    DB,
  );
}

const CALLS_TABLE = "public.foundry_practice_generation_attempt_calls";
const BASE = `insert into ${CALLS_TABLE} (attempt_id, call_kind, global_sequence, kind_sequence, model, provider_timeout_ms, structured_output_mode`;
let seq = 0;
/**
 * Each fixture gets its OWN parent and starts at position 1.
 *
 * R5C-2B tightened the ceilings to the measured architecture (14 global, 2 generation calls), so a
 * shared, ever-increasing sequence would now fail on the CEILING rather than on the property under
 * test — and would have masked exactly the constraint this file exists to prove.
 */
const call = (cols: string, vals: string) => {
  const attempt = poolId(seq++);
  return `${BASE}${cols}) values ('${attempt}', 'generation', 1, 1, 'gpt-4o-mini', 120000, 'json_schema_strict'${vals});`;
};

describe.runIf(Boolean(PG_BIN))("[R5C-2A] all three migrations EXECUTE", () => {
  beforeAll(() => {
    freshDatabase();
  }, 60_000);

  it("apply in order, each in one transaction", () => {
    expect(() => applyMigration(PARENT)).not.toThrow();
    expect(() => applyMigration("20260805010000_foundry_practice_generation_refusal_attribution_v1.sql")).not.toThrow();
    expect(() => applyMigration(CALLS)).not.toThrow();
    seedParent();
  });

  it("the child migration is safe to re-run", () => {
    expect(() => applyMigration(CALLS)).not.toThrow();
  });

  it("no CHECK in the child table contains a subquery", () => {
    const defs = psql(
      ["-tAc", `select pg_get_constraintdef(oid) from pg_constraint where conrelid = '${CALLS_TABLE}'::regclass and contype = 'c';`],
      DB,
    );
    expect(defs.length).toBeGreaterThan(0);
    expect(defs.toLowerCase()).not.toMatch(/\bselect\b/);
  });

  it("a HISTORICAL parent remains valid with ZERO children — nothing was backfilled", () => {
    const n = psql(["-tAc", `select count(*) from ${CALLS_TABLE};`], DB).trim();
    expect(n).toBe("0");
    const parents = psql(["-tAc", `select count(*) from public.foundry_practice_generation_attempts;`], DB).trim();
    expect(parents).toBe("1");
  });

  it("RLS is on, no policy exists, and client roles hold no privilege", () => {
    expect(psql(["-tAc", `select relrowsecurity from pg_class where oid = '${CALLS_TABLE}'::regclass;`], DB).trim()).toBe("t");
    expect(psql(["-tAc", `select count(*) from pg_policies where tablename = 'foundry_practice_generation_attempt_calls';`], DB).trim()).toBe("0");
    for (const role of ["anon", "authenticated"]) {
      const has = psql(
        ["-tAc", `select coalesce(bool_or(has_table_privilege('${role}', '${CALLS_TABLE}', p)), false) from unnest(array['SELECT','INSERT','UPDATE','DELETE']) p;`],
        DB,
      ).trim();
      expect(has, `${role} must hold no privilege`).toBe("f");
    }
  });

  it("declares no column able to carry prose", () => {
    const cols = psql(
      ["-tAc", `select string_agg(column_name, ',' order by column_name) from information_schema.columns where table_name = 'foundry_practice_generation_attempt_calls';`],
      DB,
    ).trim().split(",");
    for (const forbidden of [
      "prompt", "system_prompt", "user_prompt", "setup_answers", "boundary_statement", "scenario",
      "scenario_draft", "choices", "reviewer_response", "reviewer_explanation", "response_content",
      "raw_body", "request_headers", "response_headers", "error_message", "stack", "api_key", "token", "cookie",
    ]) {
      expect(cols, `${forbidden} must not exist`).not.toContain(forbidden);
    }
    // No generic telemetry blob.
    const jsonCols = psql(
      ["-tAc", `select count(*) from information_schema.columns where table_name = 'foundry_practice_generation_attempt_calls' and data_type in ('json','jsonb');`],
      DB,
    ).trim();
    expect(jsonCols).toBe("0");
  });
});

describe.runIf(Boolean(PG_BIN))("[R5C-2A] the lifecycle is enforced by the database", () => {
  // Seeded HERE, not with the historical parent: the block above asserts the migration backfilled
  // nothing, and that assertion must keep counting exactly one parent and zero children.
  beforeAll(() => {
    seedAttemptPool();
  });

  const ok = (sql: string) => {
    try {
      psql(["-tAc", sql], DB);
      return true;
    } catch {
      return false;
    }
  };

  it("accepts a valid prepared row", () => {
    expect(ok(call("", ""))).toBe(true);
  });

  it("accepts a valid in_flight row", () => {
    expect(ok(call(", lifecycle_state, provider_invoked_at", ", 'in_flight', now()"))).toBe(true);
  });

  it("accepts a valid completed success", () => {
    expect(
      ok(
        call(
          ", lifecycle_state, provider_invoked_at, finished_at, duration_ms, outcome, response_digest_scope, response_byte_count, response_sha256",
          `, 'in_flight', now(), now(), 10, 'success', 'model_content_utf8', 42, '${"a".repeat(64)}'`,
        ).replace("'in_flight'", "'completed'"),
      ),
    ).toBe(true);
  });

  it.each([
    ["prepared with an invocation timestamp", ", lifecycle_state, provider_invoked_at", ", 'prepared', now()"],
    ["prepared with an outcome", ", lifecycle_state, outcome", ", 'prepared', 'success'"],
    ["in_flight without an invocation timestamp", ", lifecycle_state", ", 'in_flight'"],
    ["in_flight with a finish time", ", lifecycle_state, provider_invoked_at, finished_at", ", 'in_flight', now(), now()"],
    ["completed without an outcome", ", lifecycle_state, provider_invoked_at, finished_at", ", 'completed', now(), now()"],
    ["completed without a finish time", ", lifecycle_state, provider_invoked_at, outcome", ", 'completed', now(), 'success'"],
    ["completed without an invocation timestamp", ", lifecycle_state, finished_at, outcome", ", 'completed', now(), 'success'"],
  ])("rejects %s", (_label, cols, vals) => {
    expect(ok(call(cols, vals))).toBe(false);
  });

  it("rejects an unknown call kind and an unknown outcome", () => {
    expect(ok(call("", "").replace("'generation'", "'not_a_kind'"))).toBe(false);
    expect(
      ok(call(", lifecycle_state, provider_invoked_at, finished_at, outcome", ", 'completed', now(), now(), 'not_an_outcome'")),
    ).toBe(false);
  });

  it("rejects a HALF digest unit, and a malformed sha", () => {
    const full = ", lifecycle_state, provider_invoked_at, finished_at, outcome, response_digest_scope, response_byte_count, response_sha256";
    expect(ok(call(", lifecycle_state, provider_invoked_at, finished_at, outcome, response_sha256", `, 'completed', now(), now(), 'success', '${"a".repeat(64)}'`))).toBe(false);
    expect(ok(call(full, `, 'completed', now(), now(), 'success', 'model_content_utf8', 42, 'NOTHEX'`))).toBe(false);
  });

  it("rejects an out-of-range HTTP status and a negative token count", () => {
    const c = ", lifecycle_state, provider_invoked_at, finished_at, outcome, provider_http_status";
    expect(ok(call(c, ", 'completed', now(), now(), 'http_error', 999"))).toBe(false);
    expect(
      ok(call(", lifecycle_state, provider_invoked_at, finished_at, outcome, prompt_tokens", ", 'completed', now(), now(), 'success', -1")),
    ).toBe(false);
  });

  it("enforces BOTH sequence uniqueness constraints", () => {
    const a = poolId(POOL_SIZE - 1);
    const ins = (kind: string, g: number, k: number) =>
      `insert into ${CALLS_TABLE} (attempt_id, call_kind, global_sequence, kind_sequence, model, provider_timeout_ms, structured_output_mode)
       values ('${a}', '${kind}', ${g}, ${k}, 'm', 1, 'none');`;
    psql(["-tAc", ins("boundary_review", 3, 3)], DB);
    // same attempt + same global sequence
    expect(ok(ins("semantic_review", 3, 4))).toBe(false);
    // same attempt + same kind + same kind sequence
    expect(ok(ins("boundary_review", 4, 3))).toBe(false);
  });

  // ---- R5C-2B — the ceilings are the MEASURED architecture ------------------
  describe("[R5C-2B] the sequence ceilings match the measured call graph", () => {
    const a = poolId(POOL_SIZE - 2);
    const ins = (attempt: string, kind: string, g: number, k: number) =>
      `insert into ${CALLS_TABLE} (attempt_id, call_kind, global_sequence, kind_sequence, model, provider_timeout_ms, structured_output_mode)
       values ('${attempt}', '${kind}', ${g}, ${k}, 'm', 1, 'none');`;

    it("accepts global sequence 14 and rejects 15", () => {
      expect(ok(ins(a, "semantic_review", 14, 4))).toBe(true);
      // The measured maximum is fourteen. A fifteenth row would be read later as evidence that
      // fifteen calls were architecturally possible.
      expect(ok(ins(a, "semantic_review", 15, 3))).toBe(false);
    });

    it.each([
      ["generation", 2, 3, 20],
      ["boundary_review", 4, 5, 21],
      ["boundary_repair", 4, 5, 22],
      ["semantic_review", 4, 5, 23],
    ])("%s accepts kind sequence %i and rejects %i", (kind, okSeq, badSeq, slot) => {
      // Each kind gets its OWN parent, so a global-sequence collision cannot be mistaken for a
      // per-kind ceiling result.
      const p = poolId(slot as number);
      expect(ok(ins(p, kind as string, okSeq as number, okSeq as number))).toBe(true);
      expect(ok(ins(p, kind as string, 10, badSeq as number))).toBe(false);
    });

    it("a REJECTED insert does not disturb the next valid one", () => {
      const p = poolId(POOL_SIZE - 5);
      expect(ok(ins(p, "generation", 1, 3))).toBe(false); // over the generation ceiling
      expect(ok(ins(p, "generation", 1, 1))).toBe(true); // the position is still free
      expect(ok(ins(p, "boundary_review", 2, 1))).toBe(true);
    });

    it("uniqueness plus the 1..14 bound IS the row-count ceiling — no counting trigger exists", () => {
      const p = poolId(POOL_SIZE - 6);
      for (let g = 1; g <= 14; g++) {
        // Spread across kinds so each stays inside its own limit: 2 + 4 + 4 + 4 = 14.
        const kind = g <= 2 ? "generation" : g <= 6 ? "boundary_review" : g <= 10 ? "boundary_repair" : "semantic_review";
        const k = g <= 2 ? g : g <= 6 ? g - 2 : g <= 10 ? g - 6 : g - 10;
        expect(ok(ins(p, kind, g, k))).toBe(true);
      }
      const rows = psql(["-tAc", `select count(*) from ${CALLS_TABLE} where attempt_id = '${p}';`], DB).trim();
      expect(rows).toBe("14");
      // Every one of the fourteen global positions is taken, so no fifteenth row can exist.
      for (const kind of ["generation", "boundary_review", "boundary_repair", "semantic_review"]) {
        for (let g = 1; g <= 15; g++) expect(ok(ins(p, kind, g, 1))).toBe(false);
      }
      expect(psql(["-tAc", `select count(*) from pg_trigger t join pg_class c on c.oid = t.tgrelid
        where c.relname = 'foundry_practice_generation_attempt_calls' and not t.tgisinternal;`], DB).trim()).toBe("0");
    });

    it("the historical parents remain valid with ZERO children", () => {
      const orphaned = psql(["-tAc", `select count(*) from public.foundry_practice_generation_attempts p
        where not exists (select 1 from ${CALLS_TABLE} c where c.attempt_id = p.id);`], DB).trim();
      expect(Number(orphaned)).toBeGreaterThan(0);
      expect(psql(["-tAc", `select count(*) from ${CALLS_TABLE} where attempt_id = '${ATTEMPT}';`], DB).trim()).toBe("0");
    });
  });

  it("the authoritative invocation count comes from provider_invoked_at, not the row count", () => {
    const rows = psql(["-tAc", `select count(*) from ${CALLS_TABLE};`], DB).trim();
    const invoked = psql(["-tAc", `select count(*) from ${CALLS_TABLE} where provider_invoked_at is not null;`], DB).trim();
    expect(Number(rows)).toBeGreaterThan(Number(invoked));
  });

  it("an in_flight orphan is queryable", () => {
    const orphans = psql(["-tAc", `select count(*) from ${CALLS_TABLE} where lifecycle_state = 'in_flight';`], DB).trim();
    expect(Number(orphans)).toBeGreaterThan(0);
  });

  it("ON DELETE CASCADE keeps the existing draft chain working", () => {
    // Measured decision: nothing in product code deletes a parent attempt, and the only path is the
    // draft cascade the parent already declares. RESTRICT here would BREAK that chain.
    const scratch = "44444444-4444-4444-4444-444444444444";
    psql(["-c", `insert into public.foundry_arena_scenario_drafts(id) values ('${scratch}');
      insert into public.foundry_practice_generation_attempts (id, draft_id, draft_revision, owner_user_id, correlation_id, provider_timeout_ms, model, structured_output_mode, max_tokens, locale)
        values ('55555555-5555-5555-5555-555555555555', '${scratch}', 1, '${USER}', gen_random_uuid(), 120000, 'm', 'none', 1, 'en');
      insert into ${CALLS_TABLE} (attempt_id, call_kind, global_sequence, kind_sequence, model, provider_timeout_ms, structured_output_mode)
        values ('55555555-5555-5555-5555-555555555555', 'generation', 1, 1, 'm', 1, 'none');`], DB);
    expect(ok(`delete from public.foundry_arena_scenario_drafts where id = '${scratch}';`)).toBe(true);
    const left = psql(["-tAc", `select count(*) from ${CALLS_TABLE} where attempt_id = '55555555-5555-5555-5555-555555555555';`], DB).trim();
    expect(left).toBe("0");
  });
});
