import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

/**
 * Disposable PostgreSQL proof for system-block recovery. This test never reads a
 * Supabase project: it creates its own cluster, applies the real migration files,
 * then removes the cluster in afterAll.
 */
const PG_BIN = ["/opt/homebrew/opt/postgresql@17/bin", "/opt/homebrew/opt/postgresql@16/bin", "/usr/local/bin", "/usr/bin"]
  .find((dir) => existsSync(join(dir, "initdb")) && existsSync(join(dir, "pg_ctl")));
const bin = (name: string) => join(PG_BIN ?? "", name);
const MIGRATIONS = join(process.cwd(), "supabase/migrations");
const CHAIN = [
  "20260805000000_foundry_practice_generation_attempts_v1.sql",
  "20260805010000_foundry_practice_generation_refusal_attribution_v1.sql",
  "20260805020000_foundry_practice_generation_attempt_calls_v1.sql",
  "20260805030000_foundry_practice_generation_input_revision_v1.sql",
  "20260805040000_foundry_practice_generation_retry_governance_v1.sql",
  "20260805050000_foundry_practice_generation_spend_containment_v1.sql",
  "20260806000000_foundry_practice_generation_contract_v1.sql",
  "20260924161342_practice_generation_reviewer_diagnostics_v1.sql",
  "20260925000000_practice_generation_system_block_recovery_v1.sql",
      "20260926000000_practice_generation_recoverable_blocks_v1.sql",
];
const PORT = "55444";
const DB = "recovery_exec";
const OWNER = "11111111-1111-1111-1111-111111111111";
const ADMIN = "22222222-2222-2222-2222-222222222222";
const OLD_SHA = "d2a18a081c45b0a084c202308d43da6d224615b3";
const CURRENT_SHA = "d3329f2f966dccfbd4749a823fc711bff9091734";
const ATTEMPTS = "public.foundry_practice_generation_attempts";
const DRAFTS = "public.foundry_arena_scenario_drafts";

let dataDir = "";
let sockDir = "";
let running = false;
let draftSeq = 0;
let attemptSeq = 0;

const sh = (command: string, args: string[]) => execFileSync(command, args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
const psql = (args: string[], db = DB) => sh(bin("psql"), ["-h", sockDir, "-p", PORT, "-U", "postgres", "-d", db, "-v", "ON_ERROR_STOP=1", "-q", ...args]);
const q = (sql: string) => psql(["-tAc", sql]).trim();
const errorText = (sql: string) => {
  try {
    q(sql);
    return "";
  } catch (error) {
    return error instanceof Error ? `${error.message}\n${String((error as { stderr?: unknown }).stderr ?? "")}` : String(error);
  }
};

beforeAll(() => {
  if (!PG_BIN) return;
  dataDir = mkdtempSync(join(tmpdir(), "practice-recovery-pg-"));
  sockDir = mkdtempSync(join(tmpdir(), "practice-recovery-sock-"));
  sh(bin("initdb"), ["-D", dataDir, "-U", "postgres", "--auth=trust"]);
  sh(bin("pg_ctl"), ["-D", dataDir, "-o", `-p ${PORT} -k ${sockDir}`, "-l", join(dataDir, "log"), "-w", "start"]);
  running = true;
  psql(["-c", `create database ${DB};`], "postgres");
  psql(["-c", `
    create extension if not exists pgcrypto;
    do $$ begin
      if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
      if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
      if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role nologin; end if;
    end $$;
    create schema auth;
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
    insert into auth.users(id) values ('${OWNER}'), ('${ADMIN}');
  `]);
  for (const migration of CHAIN) psql(["-1", "-f", join(MIGRATIONS, migration)]);
}, 120_000);

afterAll(() => {
  if (!running) return;
  try { sh(bin("pg_ctl"), ["-D", dataDir, "-m", "immediate", "-w", "stop"]); } catch { /* best effort cleanup */ }
  rmSync(dataDir, { recursive: true, force: true });
  rmSync(sockDir, { recursive: true, force: true });
}, 60_000);

function draft() {
  draftSeq += 1;
  const id = `aaaaaaaa-0000-4000-8000-${String(draftSeq).padStart(12, "0")}`;
  q(`insert into ${DRAFTS} (id, owner_user_id, revision, generation_input_revision) values ('${id}', '${OWNER}', 1, 1);`);
  return id;
}

function completed(draftId: string, opts: { system?: boolean; deploy?: string | null; refusal?: boolean } = {}) {
  attemptSeq += 1;
  const id = `bbbbbbbb-0000-4000-8000-${String(attemptSeq).padStart(12, "0")}`;
  const outcome = opts.system ? "review_execution_failed" : "scenario_quality_rejected";
  const deploy = opts.deploy === undefined ? OLD_SHA : opts.deploy;
  q(`insert into ${ATTEMPTS} (
      id, draft_id, draft_revision, generation_input_revision, owner_user_id, correlation_id,
      deploy_version, provider_timeout_ms, model, structured_output_mode, max_tokens, locale,
      lifecycle_state, finished_at, outcome, terminal_reason_code
    ) values (
      '${id}', '${draftId}', 1, 1, '${OWNER}', gen_random_uuid(), ${deploy === null ? "null" : `'${deploy}'`},
      120000, 'model', 'none', 1, 'en', 'completed', now(), '${outcome}',
      ${opts.refusal ? "'scenario_quality_rejected'" : "null"}
    );`);
  return id;
}

function governance(draftId: string) {
  const [state, canStart] = q(`select state || '|' || can_start_generation from public.get_foundry_practice_generation_governance_v1('${draftId}', '${OWNER}', 'en');`).split("|");
  return { state, canStart: canStart === "t" || canStart === "true" };
}

function admission(draftId: string) {
  return q(`select admitted || '|' || state from public.start_foundry_practice_generation_attempt_governed_v1(
    '${draftId}', '${OWNER}', 1, 'en', false, null, gen_random_uuid(), '${CURRENT_SHA}',
    120000, 'model', 'json_schema_strict', 1, 'judgment', 0, 1, gen_random_uuid()
  );`);
}

function recover(draftId: string, attemptId: string, current = CURRENT_SHA) {
  return q(`select recovery_id || '|' || recovered_attempt_id || '|' || recovered_draft_id || '|' || recovered_at || '|' || already_recovered
    from public.recover_foundry_practice_generation_system_block_v1(
      '${draftId}', '${attemptId}', '${ADMIN}', 'boundary_repair_group_expansion_fixed', '${current}', '${current}', null
    );`);
}

describe.runIf(Boolean(PG_BIN))("Practice recovery V1 executes and behaves in disposable PostgreSQL", () => {
  it("applies the complete prerequisite chain and recovery migration", () => {
    expect(q("select to_regclass('public.foundry_practice_generation_system_block_recoveries') is not null;")).toBe("t");
    expect(q("select count(*) from pg_proc where proname = 'recover_foundry_practice_generation_system_block_v1';")).toBe("1");
  });

  it("A-C: a recovered system block becomes ready and the admission function admits", () => {
    const d = draft();
    const a = completed(d, { system: true });
    expect(governance(d)).toEqual({ state: "system_blocked", canStart: false });
    expect(recover(d, a).split("|").at(-1)).toBe("false");
    expect(governance(d)).toEqual({ state: "ready", canStart: true });
    expect(admission(d)).toBe("true|admitted");
  });

  it("D-E: a later system block still blocks, and recovering A cannot clear B", () => {
    const d = draft();
    const a = completed(d, { system: true });
    recover(d, a);
    const b = completed(d, { system: true });
    expect(governance(d)).toEqual({ state: "system_blocked", canStart: false });
    expect(recover(d, a).split("|").at(-1)).toBe("true");
    expect(governance(d)).toEqual({ state: "system_blocked", canStart: false });
    expect(q(`select count(*) from public.foundry_practice_generation_system_block_recoveries where blocked_attempt_id = '${b}';`)).toBe("0");
  });

  it("F: refusal-limited drafts remain revision_required", () => {
    const d = draft();
    completed(d, { refusal: true });
    completed(d, { refusal: true });
    expect(governance(d)).toEqual({ state: "revision_required", canStart: false });
  });

  it("G: duplicate recovery preserves the first recovery id and timestamp", () => {
    const d = draft();
    const a = completed(d, { system: true });
    const first = recover(d, a).split("|");
    const duplicate = recover(d, a).split("|");
    expect(duplicate[0]).toBe(first[0]);
    expect(duplicate[3]).toBe(first[3]);
    expect(duplicate[4]).toBe("true");
  });

  it("H-J: rejects non-system, same-SHA, missing and malformed source identities", () => {
    const nonSystemDraft = draft();
    const nonSystem = completed(nonSystemDraft);
    expect(errorText(`select * from public.recover_foundry_practice_generation_system_block_v1('${nonSystemDraft}', '${nonSystem}', '${ADMIN}', 'x', '${CURRENT_SHA}', '${CURRENT_SHA}', null);`)).toContain("attempt_not_system_block");

    const sameDraft = draft();
    const same = completed(sameDraft, { system: true, deploy: CURRENT_SHA });
    expect(errorText(`select * from public.recover_foundry_practice_generation_system_block_v1('${sameDraft}', '${same}', '${ADMIN}', 'x', '${CURRENT_SHA}', '${CURRENT_SHA}', null);`)).toContain("source_identity_unchanged");

    const missingDraft = draft();
    const missing = completed(missingDraft, { system: true, deploy: null });
    expect(errorText(`select * from public.recover_foundry_practice_generation_system_block_v1('${missingDraft}', '${missing}', '${ADMIN}', 'x', '${CURRENT_SHA}', '${CURRENT_SHA}', null);`)).toContain("blocked_attempt_source_identity_unavailable");

    const malformedDraft = draft();
    const malformed = completed(malformedDraft, { system: true, deploy: "not-a-sha" });
    expect(errorText(`select * from public.recover_foundry_practice_generation_system_block_v1('${malformedDraft}', '${malformed}', '${ADMIN}', 'x', '${CURRENT_SHA}', '${CURRENT_SHA}', null);`)).toContain("blocked_attempt_source_identity_unavailable");
  });

  it("K: recovery audit references prevent deleting either the attempt or draft", () => {
    const d = draft();
    const a = completed(d, { system: true });
    recover(d, a);
    expect(errorText(`delete from ${ATTEMPTS} where id = '${a}';`)).toContain("violates foreign key constraint");
    expect(errorText(`delete from ${DRAFTS} where id = '${d}';`)).toContain("violates foreign key constraint");
  });
});
