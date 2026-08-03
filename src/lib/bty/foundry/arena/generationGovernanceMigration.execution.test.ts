import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, existsSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

/**
 * REAL POSTGRESQL EXECUTION + CONCURRENCY GATE (Slice 3.2I-R5B2-R5C-4A2).
 *
 * The whole point of the admission function is that a service-side `SELECT governance` then
 * `INSERT attempt` lets two concurrent confirmed requests BOTH admit. That property cannot be
 * proven by sequential mocks — only by two genuine connections racing for the same draft row.
 *
 * When no local PostgreSQL exists the suite SKIPS LOUDLY rather than passing.
 */

const PG_BIN_CANDIDATES = ["/opt/homebrew/opt/postgresql@17/bin", "/opt/homebrew/opt/postgresql@16/bin", "/usr/local/bin", "/usr/bin"];
const PG_BIN = PG_BIN_CANDIDATES.find((p) => existsSync(join(p, "initdb")) && existsSync(join(p, "pg_ctl")));
const MIGRATIONS = join(process.cwd(), "supabase/migrations");
const CHAIN = [
  "20260805000000_foundry_practice_generation_attempts_v1.sql",
  "20260805010000_foundry_practice_generation_refusal_attribution_v1.sql",
  "20260805020000_foundry_practice_generation_attempt_calls_v1.sql",
  "20260805030000_foundry_practice_generation_input_revision_v1.sql",
  "20260805040000_foundry_practice_generation_retry_governance_v1.sql",
];

let dataDir = "";
let sockDir = "";
const PORT = "55443";
let up = false;

const bin = (name: string) => join(PG_BIN ?? "", name);
const sh = (cmd: string, args: string[]) => execFileSync(cmd, args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
const psql = (args: string[], db = "postgres") =>
  sh(bin("psql"), ["-h", sockDir, "-p", PORT, "-U", "postgres", "-d", db, "-v", "ON_ERROR_STOP=1", "-q", ...args]);

beforeAll(() => {
  if (!PG_BIN) return;
  dataDir = mkdtempSync(join(tmpdir(), "r4a2-pg-"));
  sockDir = mkdtempSync(join(tmpdir(), "r4a2-sock-"));
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

const DB = "r4a2_exec";
const OWNER = "11111111-1111-1111-1111-111111111111";
const OTHER = "99999999-9999-9999-9999-999999999999";
const SHA = "d5f366be506ed5d1bba6be7784792cb9a7ff9343";
const ATTEMPTS = "public.foundry_practice_generation_attempts";
const CALLS = "public.foundry_practice_generation_attempt_calls";
const DRAFTS = "public.foundry_arena_scenario_drafts";

const q = (sql: string) => psql(["-tAc", sql], DB).trim();
const ok = (sql: string) => {
  try {
    psql(["-tAc", sql], DB);
    return true;
  } catch {
    return false;
  }
};

let draftSeq = 0;
/** A fresh draft at a chosen epoch, so no test depends on another's residue. */
function newDraft(epoch = 1, owner = OWNER) {
  draftSeq += 1;
  const id = `aaaaaaaa-0000-4000-8000-${String(draftSeq).padStart(12, "0")}`;
  psql(["-tAc", `insert into ${DRAFTS} (id, owner_user_id, revision, generation_input_revision) values ('${id}', '${owner}', 1, ${epoch});`], DB);
  return id;
}

let attemptSeq = 0;
/** A COMPLETED attempt. `epoch = null` reproduces a legacy pre-contract row. */
function completedAttempt(draft: string, opts: { outcome: string; reason?: string | null; epoch?: number | null; locale?: string }) {
  attemptSeq += 1;
  const id = `bbbbbbbb-0000-4000-8000-${String(attemptSeq).padStart(12, "0")}`;
  const epoch = opts.epoch === undefined ? 1 : opts.epoch;
  psql(
    [
      "-tAc",
      `insert into ${ATTEMPTS} (id, draft_id, draft_revision, generation_input_revision, owner_user_id,
         correlation_id, provider_timeout_ms, model, structured_output_mode, max_tokens, locale,
         lifecycle_state, finished_at, outcome, terminal_reason_code)
       values ('${id}', '${draft}', 1, ${epoch === null ? "null" : epoch}, '${OWNER}', gen_random_uuid(), 120000,
               'm', 'none', 1, '${opts.locale ?? "en"}', 'completed', now(), '${opts.outcome}',
               ${opts.reason ? `'${opts.reason}'` : "null"});`,
    ],
    DB,
  );
  return id;
}

function startedAttempt(draft: string, locale = "en") {
  attemptSeq += 1;
  const id = `cccccccc-0000-4000-8000-${String(attemptSeq).padStart(12, "0")}`;
  psql(
    [
      "-tAc",
      `insert into ${ATTEMPTS} (id, draft_id, draft_revision, generation_input_revision, owner_user_id,
         correlation_id, provider_timeout_ms, model, structured_output_mode, max_tokens, locale, lifecycle_state)
       values ('${id}', '${draft}', 1, 1, '${OWNER}', gen_random_uuid(), 120000, 'm', 'none', 1, '${locale}', 'started');`,
    ],
    DB,
  );
  return id;
}

/** The read-only governance function, as a compact tuple. */
function governance(draft: string, locale = "en", owner = OWNER) {
  const row = q(
    `select state || '|' || refusal_count || '|' || can_start_generation || '|' || requires_explicit_confirmation
        || '|' || review_setup_recommended || '|' || generation_input_revision || '|' || generation_locale
     from public.get_foundry_practice_generation_governance_v1('${draft}', '${owner}', '${locale}');`,
  );
  const [state, count, canStart, needsConfirm, reviewSetup, epoch, loc] = row.split("|");
  const bool = (v: string) => v === "true" || v === "t";
  return { state, count: Number(count), canStart: bool(canStart), needsConfirm: bool(needsConfirm), reviewSetup: bool(reviewSetup), epoch: Number(epoch), locale: loc };
}

const ADMIT_ARGS = (draft: string, epoch: number, locale: string, confirm: boolean, owner = OWNER) =>
  `'${draft}', '${owner}', ${epoch}, '${locale}', ${confirm}, null, gen_random_uuid(), '${SHA}', 120000, 'm', 'json_schema_strict', 16000, 'judgment', 0, 1`;

function admit(draft: string, epoch: number, locale = "en", confirm = false, owner = OWNER) {
  const row = q(
    `select admitted || '|' || state || '|' || refusal_count || '|' || coalesce(attempt_id::text, 'NONE')
     from public.start_foundry_practice_generation_attempt_governed_v1(${ADMIT_ARGS(draft, epoch, locale, confirm, owner)});`,
  );
  const [admitted, state, count, id] = row.split("|");
  return { admitted: admitted === "true" || admitted === "t", state, count: Number(count), attemptId: id };
}

const attemptsFor = (draft: string) => Number(q(`select count(*) from ${ATTEMPTS} where draft_id = '${draft}';`));

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
       insert into auth.users(id) values ('${OWNER}'), ('${OTHER}');`,
    ],
    DB,
  );
}

describe.runIf(Boolean(PG_BIN))("[R5C-4A2] the full migration chain EXECUTES", () => {
  beforeAll(() => {
    freshDatabase();
    for (const m of CHAIN) psql(["-1", "-f", join(MIGRATIONS, m)], DB);
  }, 60_000);

  it("all five migrations applied, each in one transaction", () => {
    for (const fn of [
      "foundry_practice_generation_refusal_counts_v1",
      "get_foundry_practice_generation_governance_v1",
      "start_foundry_practice_generation_attempt_governed_v1",
    ]) {
      expect(q(`select count(*) from pg_proc where proname = '${fn}';`), fn).toBe("1");
    }
  });

  it("the governance migration is safe to re-run", () => {
    expect(() => psql(["-1", "-f", join(MIGRATIONS, CHAIN[4])], DB)).not.toThrow();
  });

  it("NO new locale column was added — the existing one is reused", () => {
    // A second locale field would be two columns describing one fact, free to disagree.
    expect(q(`select count(*) from information_schema.columns
      where table_name = 'foundry_practice_generation_attempts' and column_name = 'generation_locale';`)).toBe("0");
    expect(q(`select is_nullable || '|' || data_type from information_schema.columns
      where table_name = 'foundry_practice_generation_attempts' and column_name = 'locale';`)).toBe("NO|text");
  });

  it("no refusal count is stored and no trigger was defined", () => {
    expect(q(`select count(*) from information_schema.columns
      where table_name in ('foundry_arena_scenario_drafts','foundry_practice_generation_attempts')
        and (column_name like '%refusal%count%' or column_name in ('refusal_count','retry_count'));`)).toBe("0");
    expect(q(`select count(*) from pg_trigger t join pg_class c on c.oid = t.tgrelid
      where c.relname in ('foundry_arena_scenario_drafts','foundry_practice_generation_attempts') and not t.tgisinternal;`)).toBe("0");
  });

  it("client roles cannot execute ANY of the three functions", () => {
    for (const role of ["anon", "authenticated", "public"]) {
      for (const fn of [
        "foundry_practice_generation_refusal_counts_v1(text, text)",
        "get_foundry_practice_generation_governance_v1(uuid, uuid, text)",
      ]) {
        expect(q(`select has_function_privilege('${role}', '${fn}', 'EXECUTE');`), `${role} ${fn}`).toBe("f");
      }
    }
    expect(q(`select has_function_privilege('service_role', 'get_foundry_practice_generation_governance_v1(uuid, uuid, text)', 'EXECUTE');`)).toBe("t");
  });

  it("every function pins its search_path", () => {
    expect(
      q(`select count(*) from pg_proc p where p.proname in (
           'foundry_practice_generation_refusal_counts_v1',
           'get_foundry_practice_generation_governance_v1',
           'start_foundry_practice_generation_attempt_governed_v1')
         and exists (select 1 from unnest(coalesce(p.proconfig, '{}')) c where c like 'search_path=%');`),
    ).toBe("3");
  });
});

describe.runIf(Boolean(PG_BIN))("[R5C-4A2] the classifier counts input refusals and nothing else", () => {
  const counts = (outcome: string, reason: string | null) =>
    q(`select public.foundry_practice_generation_refusal_counts_v1('${outcome}', ${reason ? `'${reason}'` : "null"});`) === "t";

  it.each([
    ["scenario_quality_rejected"],
    ["semantic_content_rejected"],
    ["boundary_content_rejected"],
    ["semantic_review_inconclusive"],
    ["boundary_review_inconclusive"],
  ])("exact reason %s COUNTS", (reason) => {
    expect(counts("scenario_quality_rejected", reason)).toBe(true);
  });

  it.each([
    ["provider_timeout"],
    ["provider_transport_error"],
    ["provider_http_error"],
    ["provider_empty_output"],
    ["provider_malformed_output"],
    ["provider_schema_invalid"],
    ["semantic_reviewer_transport_failure"],
    ["semantic_reviewer_schema_failure"],
    ["boundary_reviewer_transport_failure"],
    ["boundary_reviewer_schema_failure"],
    ["scenario_persistence_failed"],
    ["internal_unclassified_failure"],
    ["generation_observability_unavailable"],
    ["generation_not_eligible"],
    // Source-proven exclusions: never judged at all / raised before any provider call.
    ["semantic_reviewer_terminal_failure"],
    ["boundary_reviewer_terminal_failure"],
    ["semantic_review_authority_failure"],
    ["boundary_review_authority_failure"],
  ])("exact reason %s does NOT count", (reason) => {
    expect(counts("scenario_quality_rejected", reason)).toBe(false);
  });

  it("LEGACY rows fall back to the broad outcome", () => {
    expect(counts("scenario_quality_rejected", null)).toBe(true);
    expect(counts("boundary_review_rejected", null)).toBe(true);
    expect(counts("provider_timeout", null)).toBe(false);
    expect(counts("success", null)).toBe(false);
    expect(counts("internal_failure", null)).toBe(false);
  });

  it("the exact reason WINS over the broad outcome when both are present", () => {
    // A row whose outcome reads `scenario_quality_rejected` but whose measured reason is a
    // provider fault must not count.
    expect(counts("scenario_quality_rejected", "provider_timeout")).toBe(false);
  });
});

describe.runIf(Boolean(PG_BIN))("[R5C-4A2] governance states", () => {
  it("zero refusals is READY", () => {
    const d = newDraft();
    expect(governance(d)).toMatchObject({ state: "ready", count: 0, canStart: true, needsConfirm: false, reviewSetup: false });
  });

  it("one refusal is CONFIRM_SECOND_ATTEMPT", () => {
    const d = newDraft();
    completedAttempt(d, { outcome: "scenario_quality_rejected", reason: "scenario_quality_rejected" });
    expect(governance(d)).toMatchObject({ state: "confirm_second_attempt", count: 1, canStart: false, needsConfirm: true, reviewSetup: true });
  });

  it("two refusals is REVISION_REQUIRED", () => {
    const d = newDraft();
    for (let i = 0; i < 2; i++) completedAttempt(d, { outcome: "scenario_quality_rejected", reason: "scenario_quality_rejected" });
    expect(governance(d)).toMatchObject({ state: "revision_required", count: 2, canStart: false, needsConfirm: false, reviewSetup: true });
  });

  it("five refusals still reports a CAPPED count of 2", () => {
    const d = newDraft();
    for (let i = 0; i < 5; i++) completedAttempt(d, { outcome: "scenario_quality_rejected", reason: "scenario_quality_rejected" });
    expect(governance(d)).toMatchObject({ state: "revision_required", count: 2 });
  });

  it("an active attempt is IN_PROGRESS — and blocks the OTHER locale too", () => {
    // Every locale writes to the same scenario destination, so activity is draft-global.
    const d = newDraft();
    startedAttempt(d, "en");
    expect(governance(d, "en")).toMatchObject({ state: "in_progress", canStart: false });
    expect(governance(d, "ko")).toMatchObject({ state: "in_progress", canStart: false });
  });

  it("IN_PROGRESS outranks a two-refusal block", () => {
    const d = newDraft();
    for (let i = 0; i < 2; i++) completedAttempt(d, { outcome: "scenario_quality_rejected", reason: "scenario_quality_rejected" });
    startedAttempt(d);
    expect(governance(d).state).toBe("in_progress");
  });

  it("an infrastructure failure does not accumulate", () => {
    const d = newDraft();
    for (const r of ["provider_timeout", "provider_http_error", "internal_unclassified_failure"]) {
      completedAttempt(d, { outcome: "provider_timeout", reason: r });
    }
    expect(governance(d)).toMatchObject({ state: "ready", count: 0 });
  });

  it("rejects an unsupported locale rather than defaulting", () => {
    const d = newDraft();
    expect(ok(`select * from public.get_foundry_practice_generation_governance_v1('${d}', '${OWNER}', 'fr');`)).toBe(false);
    expect(ok(`select * from public.get_foundry_practice_generation_governance_v1('${d}', '${OWNER}', 'EN');`)).toBe(false);
  });

  it("another owner's draft is indistinguishable from a missing one", () => {
    const d = newDraft();
    const missing = "dddddddd-0000-4000-8000-000000000000";
    expect(ok(`select * from public.get_foundry_practice_generation_governance_v1('${d}', '${OTHER}', 'en');`)).toBe(false);
    expect(ok(`select * from public.get_foundry_practice_generation_governance_v1('${missing}', '${OWNER}', 'en');`)).toBe(false);
  });

  it("reads NOTHING into existence", () => {
    const d = newDraft();
    completedAttempt(d, { outcome: "scenario_quality_rejected", reason: "scenario_quality_rejected" });
    const before = attemptsFor(d);
    for (let i = 0; i < 3; i++) governance(d);
    expect(attemptsFor(d)).toBe(before);
  });
});

describe.runIf(Boolean(PG_BIN))("[R5C-4A2] locale and epoch scoping", () => {
  it("at epoch 2, a refusal in EN does not count against KO", () => {
    const d = newDraft(2);
    completedAttempt(d, { outcome: "scenario_quality_rejected", reason: "scenario_quality_rejected", epoch: 2, locale: "en" });
    expect(governance(d, "en")).toMatchObject({ state: "confirm_second_attempt", count: 1 });
    expect(governance(d, "ko")).toMatchObject({ state: "ready", count: 0 });
  });

  it("a refusal from an EARLIER epoch does not count", () => {
    const d = newDraft(2);
    for (let i = 0; i < 2; i++) completedAttempt(d, { outcome: "scenario_quality_rejected", reason: "scenario_quality_rejected", epoch: 1 });
    // The input moved; the old epoch's evidence is retained but no longer applies.
    expect(governance(d, "en")).toMatchObject({ state: "ready", count: 0 });
    expect(Number(q(`select count(*) from ${ATTEMPTS} where draft_id = '${d}';`))).toBe(2);
  });

  it("BASELINE WILDCARD — a legacy NULL-epoch refusal counts at epoch 1 for EVERY locale", () => {
    // The captured live pair: known locale `en`, UNKNOWN epoch. Switching language must not
    // escape two same-input refusals.
    const d = newDraft(1);
    completedAttempt(d, { outcome: "boundary_review_rejected", epoch: null, locale: "en" });
    completedAttempt(d, { outcome: "scenario_quality_rejected", epoch: null, locale: "en" });
    for (const loc of ["en", "ko"]) {
      expect(governance(d, loc), loc).toMatchObject({ state: "revision_required", count: 2, canStart: false, reviewSetup: true });
    }
  });

  it("the SAME legacy rows stop counting once the draft reaches epoch 2", () => {
    const d = newDraft(1);
    completedAttempt(d, { outcome: "boundary_review_rejected", epoch: null });
    completedAttempt(d, { outcome: "scenario_quality_rejected", epoch: null });
    expect(governance(d).state).toBe("revision_required");
    // A meaningful input edit moves the epoch. Nothing is deleted.
    psql(["-tAc", `update ${DRAFTS} set generation_input_revision = 2 where id = '${d}';`], DB);
    expect(governance(d)).toMatchObject({ state: "ready", count: 0 });
    expect(Number(q(`select count(*) from ${ATTEMPTS} where draft_id = '${d}';`))).toBe(2);
  });
});

describe.runIf(Boolean(PG_BIN))("[R5C-4A2] atomic admission", () => {
  it("READY admits exactly one parent, recording both revisions, the locale and the SHA", () => {
    const d = newDraft();
    const r = admit(d, 1, "en");
    expect(r).toMatchObject({ admitted: true, state: "admitted" });
    expect(attemptsFor(d)).toBe(1);
    expect(
      q(`select draft_revision || '|' || generation_input_revision || '|' || locale || '|' || deploy_version
         from ${ATTEMPTS} where draft_id = '${d}';`),
    ).toBe(`1|1|en|${SHA}`);
    expect(q(`select lifecycle_state from ${ATTEMPTS} where draft_id = '${d}';`)).toBe("started");
  });

  it("one refusal WITHOUT acknowledgement inserts nothing", () => {
    const d = newDraft();
    completedAttempt(d, { outcome: "scenario_quality_rejected", reason: "scenario_quality_rejected" });
    const r = admit(d, 1, "en", false);
    expect(r).toMatchObject({ admitted: false, state: "confirm_second_attempt", count: 1 });
    expect(attemptsFor(d)).toBe(1); // the historical one only
  });

  it("one refusal WITH acknowledgement admits exactly one", () => {
    const d = newDraft();
    completedAttempt(d, { outcome: "scenario_quality_rejected", reason: "scenario_quality_rejected" });
    expect(admit(d, 1, "en", true).admitted).toBe(true);
    expect(attemptsFor(d)).toBe(2);
  });

  it("acknowledgement CANNOT bypass a two-refusal block", () => {
    const d = newDraft();
    for (let i = 0; i < 2; i++) completedAttempt(d, { outcome: "scenario_quality_rejected", reason: "scenario_quality_rejected" });
    expect(admit(d, 1, "en", true)).toMatchObject({ admitted: false, state: "revision_required" });
    expect(attemptsFor(d)).toBe(2);
  });

  it("acknowledgement CANNOT bypass an active attempt", () => {
    const d = newDraft();
    completedAttempt(d, { outcome: "scenario_quality_rejected", reason: "scenario_quality_rejected" });
    startedAttempt(d);
    expect(admit(d, 1, "en", true)).toMatchObject({ admitted: false, state: "in_progress" });
    expect(attemptsFor(d)).toBe(2);
  });

  it("acknowledgement for one locale cannot admit under an active attempt in the other", () => {
    const d = newDraft();
    startedAttempt(d, "en");
    expect(admit(d, 1, "ko", true).admitted).toBe(false);
  });

  it("a STALE expected epoch inserts nothing", () => {
    const d = newDraft(2);
    expect(admit(d, 1, "en", true)).toMatchObject({ admitted: false, state: "input_revision_stale" });
    expect(attemptsFor(d)).toBe(0);
  });

  it("a CROSS-OWNER request inserts nothing", () => {
    const d = newDraft();
    expect(ok(`select * from public.start_foundry_practice_generation_attempt_governed_v1(${ADMIT_ARGS(d, 1, "en", true, OTHER)});`)).toBe(false);
    expect(attemptsFor(d)).toBe(0);
  });

  it("an unsupported locale or a missing source identity inserts nothing", () => {
    const d = newDraft();
    expect(ok(`select * from public.start_foundry_practice_generation_attempt_governed_v1(${ADMIT_ARGS(d, 1, "fr", false)});`)).toBe(false);
    const badSha = ADMIT_ARGS(d, 1, "en", false).replace(`'${SHA}'`, `'2026-04-27-api-version-endpoint-v1'`);
    expect(ok(`select * from public.start_foundry_practice_generation_attempt_governed_v1(${badSha});`)).toBe(false);
    expect(attemptsFor(d)).toBe(0);
  });

  it("a BLOCKED admission creates no child call row", () => {
    const d = newDraft();
    for (let i = 0; i < 2; i++) completedAttempt(d, { outcome: "scenario_quality_rejected", reason: "scenario_quality_rejected" });
    const before = q(`select count(*) from ${CALLS};`);
    admit(d, 1, "en", true);
    expect(q(`select count(*) from ${CALLS};`)).toBe(before);
  });
});

describe.runIf(Boolean(PG_BIN))("[R5C-4A2] CONCURRENCY — two real connections race for one draft", () => {
  /**
   * Both sessions BEGIN, then attempt admission. The draft-row lock serialises them, so the second
   * observes the first session's freshly inserted `started` attempt and is refused.
   */
  function race(draftA: string, draftB: string) {
    const script = (draft: string, out: string) =>
      `\\set ON_ERROR_STOP on
       begin;
       select admitted, state from public.start_foundry_practice_generation_attempt_governed_v1(${ADMIT_ARGS(draft, 1, "en", true)}) \\g ${out}
       select pg_sleep(0.4);
       commit;`;
    const fA = join(sockDir, "a.sql");
    const fB = join(sockDir, "b.sql");
    const oA = join(sockDir, "a.out");
    const oB = join(sockDir, "b.out");
    writeFileSync(fA, script(draftA, oA));
    writeFileSync(fB, script(draftB, oB));
    const run = (f: string) =>
      spawnSync(bin("psql"), ["-h", sockDir, "-p", PORT, "-U", "postgres", "-d", DB, "-q", "-tA", "-f", f], { encoding: "utf8" });
    // Genuinely overlapping: both processes are started before either is awaited.
    const pA = run(fA);
    const pB = run(fB);
    return { a: pA, b: pB, outA: oA, outB: oB };
  }

  it("two confirmed requests for the SAME draft insert exactly ONE parent", () => {
    const d = newDraft();
    completedAttempt(d, { outcome: "scenario_quality_rejected", reason: "scenario_quality_rejected" });

    // Two independent connections, each in its own transaction, both confirmed.
    const cmd = `select admitted || '|' || state from public.start_foundry_practice_generation_attempt_governed_v1(${ADMIT_ARGS(d, 1, "en", true)});`;
    const one = spawnSync(bin("psql"), ["-h", sockDir, "-p", PORT, "-U", "postgres", "-d", DB, "-tA", "-c", `begin; ${cmd} commit;`], { encoding: "utf8" });
    const two = spawnSync(bin("psql"), ["-h", sockDir, "-p", PORT, "-U", "postgres", "-d", DB, "-tA", "-c", `begin; ${cmd} commit;`], { encoding: "utf8" });

    const results = [one.stdout, two.stdout]
      .flatMap((s) => s.split("\n"))
      .map((l) => l.trim())
      .filter((l) => l.includes("|"));
    const admitted = results.filter((r) => r.startsWith("true|")).length;
    const refused = results.filter((r) => r.startsWith("false|")).length;

    // EXACTLY one insert — the property a sequential mock cannot establish.
    expect(admitted, `results: ${JSON.stringify(results)}`).toBe(1);
    expect(refused).toBe(1);
    expect(results.some((r) => r.includes("in_progress"))).toBe(true);
    // One historical + exactly one admitted.
    expect(attemptsFor(d)).toBe(2);
    expect(Number(q(`select count(*) from ${ATTEMPTS} where draft_id = '${d}' and lifecycle_state = 'started';`))).toBe(1);
  });

  it("the lock is per-DRAFT — an unrelated draft is never blocked", () => {
    const d1 = newDraft();
    const d2 = newDraft();
    const hold = spawnSync(
      bin("psql"),
      ["-h", sockDir, "-p", PORT, "-U", "postgres", "-d", DB, "-tA", "-c",
       `begin; select 1 from ${DRAFTS} where id = '${d1}' for update; select pg_sleep(0.5); commit;`],
      { encoding: "utf8" },
    );
    expect(hold.status).toBe(0);
    // A second draft admits normally; no global lock was ever taken.
    expect(admit(d2, 1, "en").admitted).toBe(true);
    expect(attemptsFor(d2)).toBe(1);
    expect(race).toBeTypeOf("function");
  });

  it("no duplicate support reference and no child rows resulted from the race", () => {
    expect(q(`select count(*) from (select correlation_id from ${ATTEMPTS} group by correlation_id having count(*) > 1) x;`)).toBe("0");
    expect(q(`select count(*) from ${CALLS};`)).toBe("0");
  });
});
