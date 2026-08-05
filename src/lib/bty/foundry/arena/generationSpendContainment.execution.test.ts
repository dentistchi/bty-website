import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

/**
 * REAL POSTGRESQL GATE — SPEND CONTAINMENT (Slice 3.2I-R5B2-R5C-6A).
 *
 * Two protections here can only be proven against a real database with real concurrency: that a
 * re-delivered submission intent cannot buy a second generation, and that a reviewer that failed to
 * evaluate stops further spending without blaming the Host's setup.
 *
 * SKIPS LOUDLY when no local PostgreSQL exists.
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
  "20260805050000_foundry_practice_generation_spend_containment_v1.sql",
];

let dataDir = "";
let sockDir = "";
const PORT = "55447";
let up = false;
const bin = (n: string) => join(PG_BIN ?? "", n);
const sh = (c: string, a: string[]) => execFileSync(c, a, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
const psql = (a: string[], db = "postgres") =>
  sh(bin("psql"), ["-h", sockDir, "-p", PORT, "-U", "postgres", "-d", db, "-v", "ON_ERROR_STOP=1", "-q", ...a]);

beforeAll(() => {
  if (!PG_BIN) return;
  dataDir = mkdtempSync(join(tmpdir(), "r6a-pg-"));
  sockDir = mkdtempSync(join(tmpdir(), "r6a-sock-"));
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

const DB = "r6a_exec";
const OWNER = "11111111-1111-1111-1111-111111111111";
const OTHER = "99999999-9999-9999-9999-999999999999";
const SHA = "fd0c7fc6d2ec0cb7775c496788db8c7e97f9e3d3";
const NEW_SHA = "aaaabbbbccccddddeeeeffff00001111222233ff";
const A = "public.foundry_practice_generation_attempts";
const C = "public.foundry_practice_generation_attempt_calls";
const D = "public.foundry_arena_scenario_drafts";

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
function newDraft(epoch = 2, owner = OWNER) {
  const id = uid("aaaaaaaa");
  psql(["-tAc", `insert into ${D} (id, owner_user_id, revision, generation_input_revision) values ('${id}','${owner}',2,${epoch});`], DB);
  return id;
}
function completed(draft: string, o: { outcome: string; reason?: string | null; epoch?: number | null; locale?: string }) {
  const id = uid("bbbbbbbb");
  const e = o.epoch === undefined ? 2 : o.epoch;
  psql(["-tAc", `insert into ${A} (id, draft_id, draft_revision, generation_input_revision, owner_user_id, correlation_id,
    provider_timeout_ms, model, structured_output_mode, max_tokens, locale, lifecycle_state, finished_at, outcome, terminal_reason_code)
    values ('${id}','${draft}',2,${e === null ? "null" : e},'${OWNER}',gen_random_uuid(),120000,'m','none',1,'${o.locale ?? "en"}','completed',now(),'${o.outcome}',${o.reason ? `'${o.reason}'` : "null"});`], DB);
  return id;
}

const ARGS = (draft: string, intent: string, epoch = 2, locale = "en", confirm = false, owner = OWNER, sha = SHA) =>
  `'${draft}','${owner}',${epoch},'${locale}',${confirm},null,gen_random_uuid(),'${sha}',120000,'m','json_schema_strict',16000,'judgment',0,1,'${intent}'`;

function admit(draft: string, intent: string, over: Partial<{ epoch: number; locale: string; confirm: boolean; owner: string; sha: string }> = {}) {
  const row = q(`select admitted || '|' || state from public.start_foundry_practice_generation_attempt_governed_v1(${ARGS(draft, intent, over.epoch ?? 2, over.locale ?? "en", over.confirm ?? false, over.owner ?? OWNER, over.sha ?? SHA)});`);
  const [admitted, state] = row.split("|");
  return { admitted: admitted === "true" || admitted === "t", state };
}
function governance(draft: string, locale = "en", owner = OWNER) {
  const row = q(`select state || '|' || refusal_count || '|' || can_start_generation || '|' || review_setup_recommended
     from public.get_foundry_practice_generation_governance_v1('${draft}','${owner}','${locale}');`);
  const [state, count, canStart, reviewSetup] = row.split("|");
  const b = (v: string) => v === "true" || v === "t";
  return { state, count: Number(count), canStart: b(canStart), reviewSetup: b(reviewSetup) };
}
const attemptsFor = (d: string) => Number(q(`select count(*) from ${A} where draft_id='${d}';`));

describe.runIf(Boolean(PG_BIN))("[R5C-6A] the chain applies over the LIVE shape", () => {
  beforeAll(() => {
    psql(["-tAc", `drop database if exists ${DB};`]);
    psql(["-tAc", `create database ${DB};`]);
    psql(["-c", `do $$ begin
        if not exists (select 1 from pg_roles where rolname='anon') then create role anon nologin; end if;
        if not exists (select 1 from pg_roles where rolname='authenticated') then create role authenticated nologin; end if;
        if not exists (select 1 from pg_roles where rolname='service_role') then create role service_role nologin; end if;
      end $$;
      create schema if not exists auth;
      create table auth.users(id uuid primary key);
      create table public.foundry_events(id uuid primary key);
      create table ${D} (id uuid primary key, owner_user_id uuid, guided_answers jsonb, scenario_draft jsonb,
        revision integer not null default 0, updated_at timestamptz not null default now());
      insert into auth.users(id) values ('${OWNER}'),('${OTHER}');`], DB);
    for (const m of CHAIN.slice(0, 5)) psql(["-1", "-f", join(MIGRATIONS, m)], DB);
    // The FOUR live rows, including the two carrying the old contradictory mapping.
    const live = uid("11110000");
    psql(["-tAc", `insert into ${D} (id, owner_user_id, revision, generation_input_revision) values ('${live}','${OWNER}',2,2);`], DB);
    for (const r of [
      { o: "boundary_review_rejected", rc: null, e: null },
      { o: "scenario_quality_rejected", rc: null, e: null },
      { o: "boundary_review_rejected", rc: "semantic_reviewer_terminal_failure", e: 2 },
      { o: "boundary_review_rejected", rc: "semantic_reviewer_terminal_failure", e: 2 },
    ]) {
      completed(live, { outcome: r.o, reason: r.rc, epoch: r.e });
    }
    (globalThis as Record<string, unknown>).__LIVE_DRAFT__ = live;
  }, 60_000);

  it("the containment migration applies in one transaction over the contradictory rows", () => {
    // The two live rows violate the new rule; the constraint is NOT VALID precisely so they survive.
    expect(() => psql(["-1", "-f", join(MIGRATIONS, CHAIN[5])], DB)).not.toThrow();
  });

  it("is safe to re-run", () => {
    expect(() => psql(["-1", "-f", join(MIGRATIONS, CHAIN[5])], DB)).not.toThrow();
  });

  it("the four pre-existing rows are UNCHANGED and their intent stays NULL", () => {
    expect(q(`select count(*) from ${A};`)).toBe("4");
    expect(q(`select count(*) from ${A} where submission_intent_id is null;`)).toBe("4");
    expect(q(`select count(*) from ${A} where outcome='boundary_review_rejected' and terminal_reason_code='semantic_reviewer_terminal_failure';`)).toBe("2");
    expect(q(`select count(*) from ${C};`)).toBe("0");
  });

  /**
   * EXPAND/CONTRACT (Part 0B). At this point in the rollout the Worker still in service is the
   * 15-argument caller, so BOTH overloads must exist. Dropping the old one here would fail every
   * live admission with PGRST202 until the next deployment. The drop is proven in the CONTRACT
   * execution gate instead.
   */
  it("BOTH admission signatures exist during the expand window", () => {
    expect(q(`select count(*) from pg_proc where proname='start_foundry_practice_generation_attempt_governed_v1';`)).toBe("2");
    expect(q(`select count(*) from pg_proc where proname='start_foundry_practice_generation_attempt_governed_v1' and pronargs=15;`)).toBe("1");
    expect(q(`select count(*) from pg_proc where proname='start_foundry_practice_generation_attempt_governed_v1' and pronargs=16;`)).toBe("1");
  });

  it("both overloads keep the service-role-only posture", () => {
    for (const args of ["uuid, uuid, integer, text, boolean, uuid, uuid, text, integer, text, text, integer, text, integer, integer",
                        "uuid, uuid, integer, text, boolean, uuid, uuid, text, integer, text, text, integer, text, integer, integer, uuid"]) {
      const sig = `start_foundry_practice_generation_attempt_governed_v1(${args})`;
      for (const r of ["anon", "authenticated", "public"]) {
        expect(q(`select has_function_privilege('${r}','${sig}','EXECUTE');`)).toBe("f");
      }
      expect(q(`select has_function_privilege('service_role','${sig}','EXECUTE');`)).toBe("t");
    }
  });

  it("client roles cannot execute the system-block helper", () => {
    for (const r of ["anon", "authenticated", "public"]) {
      expect(q(`select has_function_privilege('${r}','foundry_practice_generation_is_system_block_v1(text, text)','EXECUTE');`)).toBe("f");
    }
    expect(q(`select has_function_privilege('service_role','foundry_practice_generation_is_system_block_v1(text, text)','EXECUTE');`)).toBe("t");
  });

  /**
   * The contradiction PROHIBITION belongs to the contract step. What the expand step must prove
   * is the opposite: the previously deployed Worker — which emits the old mapping and has no
   * `review_execution_failed` in its vocabulary — can still write. That is the whole reason the
   * NOT VALID constraint was moved out of this migration.
   */
  it("the previously deployed Worker's write is still accepted (no outage)", () => {
    const d = newDraft();
    const legacy = `insert into ${A} (id, draft_id, draft_revision, owner_user_id, correlation_id, provider_timeout_ms, model,
      structured_output_mode, max_tokens, locale, lifecycle_state, finished_at, outcome, terminal_reason_code)
      values (gen_random_uuid(),'${d}',2,'${OWNER}',gen_random_uuid(),120000,'m','none',1,'en','completed',now(),
              'boundary_review_rejected','semantic_reviewer_terminal_failure');`;
    expect(ok(legacy), "the old mapping must remain writable until the new Worker is live").toBe(true);
    // …and the new vocabulary is already accepted, so the next deployment needs no further DDL.
    expect(ok(legacy.replace("'boundary_review_rejected'", "'review_execution_failed'"))).toBe(true);
  });
});

describe.runIf(Boolean(PG_BIN))("[R5C-6A] the system block stops spending without blaming the Host", () => {
  it.each([["semantic_reviewer_terminal_failure"], ["boundary_reviewer_terminal_failure"]])("%s → system_blocked", (rc) => {
    const d = newDraft();
    completed(d, { outcome: "review_execution_failed", reason: rc });
    const g = governance(d);
    expect(g.state).toBe("system_blocked");
    expect(g.canStart).toBe(false);
    // The Host's setup is not at fault, so reviewing it is NOT presented as the cure.
    expect(g.reviewSetup).toBe(false);
  });

  it("it is NOT counted as a setup refusal", () => {
    const d = newDraft();
    completed(d, { outcome: "review_execution_failed", reason: "semantic_reviewer_terminal_failure" });
    expect(governance(d).count).toBe(0);
    expect(q(`select public.foundry_practice_generation_refusal_counts_v1('review_execution_failed','semantic_reviewer_terminal_failure');`)).toBe("f");
  });

  it("neither a LOCALE switch nor a NEW EPOCH clears it", () => {
    const d = newDraft();
    completed(d, { outcome: "review_execution_failed", reason: "semantic_reviewer_terminal_failure", locale: "en" });
    expect(governance(d, "ko").state).toBe("system_blocked");
    psql(["-tAc", `update ${D} set generation_input_revision=3 where id='${d}';`], DB);
    expect(governance(d, "en").state).toBe("system_blocked");
    expect(governance(d, "ko").state).toBe("system_blocked");
  });

  it("acknowledgement CANNOT override it, and admits nothing", () => {
    const d = newDraft();
    completed(d, { outcome: "review_execution_failed", reason: "semantic_reviewer_terminal_failure" });
    const before = attemptsFor(d);
    expect(admit(d, uid("cccccccc"), { confirm: true })).toMatchObject({ admitted: false, state: "system_blocked" });
    expect(attemptsFor(d)).toBe(before);
  });

  it("a BRAND-NEW intent cannot bypass it — the containment holds against a fresh instruction", () => {
    const d = newDraft();
    completed(d, { outcome: "review_execution_failed", reason: "semantic_reviewer_terminal_failure" });
    for (const i of [1, 2, 3]) expect(admit(d, uid("dddddddd")).state, `attempt ${i}`).toBe("system_blocked");
    expect(attemptsFor(d)).toBe(1);
    expect(q(`select count(*) from ${C};`)).toBe("0");
  });

  it("a deployment with a DIFFERENT source does not clear it — the reviewer is still broken", () => {
    // Deliberate deviation from the brief's preferred commit-scoped reset: this migration ships a
    // new commit and does NOT repair the reviewer, so a commit-scoped block would clear itself on
    // the very deploy that introduces it.
    const d = newDraft();
    completed(d, { outcome: "review_execution_failed", reason: "semantic_reviewer_terminal_failure" });
    expect(admit(d, uid("eeeeeeee"), { sha: NEW_SHA })).toMatchObject({ admitted: false, state: "system_blocked" });
  });

  it("it does NOT fire for content refusals, inconclusive verdicts or transient faults", () => {
    for (const [outcome, reason] of [
      ["scenario_quality_rejected", "scenario_quality_rejected"],
      ["boundary_review_rejected", "boundary_content_rejected"],
      ["boundary_review_rejected", "boundary_review_inconclusive"],
      ["provider_timeout", "provider_timeout"],
      ["scenario_persistence_failed", "scenario_persistence_failed"],
      ["internal_failure", "internal_unclassified_failure"],
    ]) {
      expect(q(`select public.foundry_practice_generation_is_system_block_v1('${outcome}','${reason}');`), reason).toBe("f");
    }
  });

  it("IN_PROGRESS still outranks the system block", () => {
    const d = newDraft();
    completed(d, { outcome: "review_execution_failed", reason: "semantic_reviewer_terminal_failure" });
    psql(["-tAc", `insert into ${A} (id, draft_id, draft_revision, generation_input_revision, owner_user_id, correlation_id,
      provider_timeout_ms, model, structured_output_mode, max_tokens, locale, lifecycle_state)
      values ('${uid("ffffffff")}','${d}',2,2,'${OWNER}',gen_random_uuid(),120000,'m','none',1,'en','started');`], DB);
    expect(governance(d).state).toBe("in_progress");
  });

  it("THE LIVE FIXTURE — the captured draft's two rows produce system_blocked in BOTH locales", () => {
    const live = (globalThis as Record<string, unknown>).__LIVE_DRAFT__ as string;
    for (const loc of ["en", "ko"]) {
      const g = governance(live, loc);
      expect(g.state, loc).toBe("system_blocked");
      expect(g.canStart, loc).toBe(false);
    }
  });
});

describe.runIf(Boolean(PG_BIN))("[R5C-6A] one instruction buys at most one generation", () => {
  it("a duplicate ACTIVE intent inserts nothing", () => {
    const d = newDraft();
    const intent = uid("12341234");
    expect(admit(d, intent).admitted).toBe(true);
    expect(attemptsFor(d)).toBe(1);
    expect(admit(d, intent)).toMatchObject({ admitted: false, state: "duplicate_existing_intent" });
    expect(attemptsFor(d)).toBe(1);
  });

  it("a duplicate COMPLETED intent inserts nothing", () => {
    const d = newDraft();
    const intent = uid("23452345");
    expect(admit(d, intent).admitted).toBe(true);
    psql(["-tAc", `update ${A} set lifecycle_state='completed', finished_at=now(), outcome='scenario_quality_rejected' where submission_intent_id='${intent}';`], DB);
    expect(admit(d, intent).state).toBe("duplicate_existing_intent");
    expect(attemptsFor(d)).toBe(1);
  });

  it("a DIFFERENT intent is still governed normally", () => {
    const d = newDraft();
    expect(admit(d, uid("34563456")).admitted).toBe(true);
    psql(["-tAc", `update ${A} set lifecycle_state='completed', finished_at=now(), outcome='scenario_quality_rejected', terminal_reason_code='scenario_quality_rejected' where draft_id='${d}';`], DB);
    // One counted refusal → the second instruction needs acknowledgement, not a free pass.
    expect(admit(d, uid("45674567")).state).toBe("confirm_second_attempt");
  });

  it("a MISSING intent is refused before anything is decided", () => {
    const d = newDraft();
    const noIntent = ARGS(d, "x").replace(",'x'", ",null");
    expect(ok(`select * from public.start_foundry_practice_generation_attempt_governed_v1(${noIntent});`)).toBe(false);
    expect(attemptsFor(d)).toBe(0);
  });

  it("a duplicate creates NO child call", () => {
    const d = newDraft();
    const intent = uid("56785678");
    admit(d, intent);
    const before = q(`select count(*) from ${C};`);
    admit(d, intent);
    expect(q(`select count(*) from ${C};`)).toBe(before);
  });

  it("intents are unique per OWNER, so two Hosts never collide", () => {
    const d1 = newDraft();
    const d2 = newDraft(2, OTHER);
    const shared = uid("67896789");
    expect(admit(d1, shared).admitted).toBe(true);
    expect(admit(d2, shared, { owner: OTHER }).admitted).toBe(true);
  });
});

describe.runIf(Boolean(PG_BIN))("[R5C-6A] CONCURRENCY — the same instruction delivered twice at once", () => {
  it("two real connections carrying ONE intent insert exactly ONE parent", () => {
    const d = newDraft();
    const intent = uid("78907890");
    const cmd = `select admitted || '|' || state from public.start_foundry_practice_generation_attempt_governed_v1(${ARGS(d, intent)});`;
    const run = () =>
      spawnSync(bin("psql"), ["-h", sockDir, "-p", PORT, "-U", "postgres", "-d", DB, "-tA", "-c", `begin; ${cmd} commit;`], { encoding: "utf8" });
    const one = run();
    const two = run();
    const results = [one.stdout, two.stdout].flatMap((s) => s.split("\n")).map((l) => l.trim()).filter((l) => l.includes("|"));

    expect(results.filter((r) => r.startsWith("true|")).length, `results: ${JSON.stringify(results)}`).toBe(1);
    expect(results.filter((r) => r.includes("duplicate_existing_intent")).length).toBe(1);
    // The property a sequential mock cannot establish: one instruction, one spend.
    expect(attemptsFor(d)).toBe(1);
    expect(q(`select count(*) from ${A} where submission_intent_id='${intent}';`)).toBe("1");
  });

  it("the unique index is the backstop, independent of the function's own check", () => {
    const d = newDraft();
    const intent = uid("89018901");
    admit(d, intent);
    const direct = `insert into ${A} (id, draft_id, draft_revision, owner_user_id, correlation_id, provider_timeout_ms,
      model, structured_output_mode, max_tokens, locale, submission_intent_id)
      values (gen_random_uuid(),'${d}',2,'${OWNER}',gen_random_uuid(),120000,'m','none',1,'en','${intent}');`;
    expect(ok(direct), "the database itself must refuse a second row for one intent").toBe(false);
  });
});
