import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { execFileSync } from "node:child_process";
import { createHmac } from "node:crypto";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

/**
 * REAL POSTGREST TRANSPORT GATE — ADMISSION OVERLOAD RESOLUTION (Slice 3.2L Part 0C).
 *
 * THE INCIDENT THIS EXISTS TO PREVENT. Migration 20260805050000 added a 16-argument
 * admission function beside the legacy 15-argument one and was proven safe by checking
 * pg_proc and by calling the functions directly in psql. Both proofs passed. Live
 * practice-generation admission broke anyway: the new parameter carried
 * `default null`, so the 16-argument function ALSO answered to a 15-argument call, a
 * 15-key request matched BOTH, and PostgREST returned PGRST203 instead of choosing.
 *
 * Neither earlier proof could have caught it:
 *   - pg_proc shows presence, not dispatch;
 *   - PostgreSQL resolves POSITIONAL calls unambiguously, so psql never sees it.
 * PostgREST dispatches on the JSON argument-NAME set, which is what supabase-js sends.
 * So the gate has to speak the real transport. That is the whole point of this file.
 *
 * SKIPS LOUDLY when Docker is unavailable.
 */

const MIGRATIONS = join(process.cwd(), "supabase/migrations");
const CHAIN = [
  "20260805000000_foundry_practice_generation_attempts_v1.sql",
  "20260805010000_foundry_practice_generation_refusal_attribution_v1.sql",
  "20260805020000_foundry_practice_generation_attempt_calls_v1.sql",
  "20260805030000_foundry_practice_generation_input_revision_v1.sql",
  "20260805040000_foundry_practice_generation_retry_governance_v1.sql",
  "20260805050000_foundry_practice_generation_spend_containment_v1.sql",
];

const PG_IMAGE = "public.ecr.aws/supabase/postgres:17.6.1.155";
const PGRST_IMAGE = "public.ecr.aws/supabase/postgrest:v14.15";
const NET = "bty-transport-gate-net";
const DB_C = "bty-transport-gate-db";
const API_C = "bty-transport-gate-api";
const PORT = 3098;
const JWT_SECRET = "transport-gate-secret-at-least-32-characters-long";
const OWNER = "11111111-1111-1111-1111-111111111111";
const DRAFT = "22222222-2222-2222-2222-222222222222";
const SHA = "adb9c7cd146a063be844071f87f7f5babbd40b3e";
const FN = "start_foundry_practice_generation_attempt_governed_v1";

const run = (c: string, a: string[]) => execFileSync(c, a, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
const quiet = (c: string, a: string[]) => {
  try {
    return run(c, a);
  } catch {
    return "";
  }
};
const dockerAvailable = (() => {
  try {
    run("docker", ["info"]);
    return true;
  } catch {
    return false;
  }
})();

let tmp = "";
let up = false;
const psql = (sql: string) => run("docker", ["exec", DB_C, "psql", "-U", "supabase_admin", "-d", "postgres", "-v", "ON_ERROR_STOP=1", "-tAc", sql]).trim();
const psqlFile = (host: string, name: string) => {
  run("docker", ["cp", host, `${DB_C}:/tmp/${name}`]);
  return run("docker", ["exec", DB_C, "psql", "-U", "supabase_admin", "-d", "postgres", "-v", "ON_ERROR_STOP=1", "-q", "-f", `/tmp/${name}`]);
};

function jwt(role: string): string {
  const b64 = (o: unknown) => Buffer.from(JSON.stringify(o)).toString("base64url");
  const h = b64({ alg: "HS256", typ: "JWT" });
  const p = b64({ role, exp: Math.floor(Date.now() / 1000) + 7200 });
  return `${h}.${p}.${createHmac("sha256", JWT_SECRET).update(`${h}.${p}`).digest("base64url")}`;
}

/** One admission payload. Omitting the intent yields the LEGACY 15-key shape. */
function payload(withIntent: string | null | undefined, correlation: string) {
  const base: Record<string, unknown> = {
    p_draft_id: DRAFT,
    p_owner_user_id: OWNER,
    p_expected_generation_input_revision: 2,
    p_locale: "en",
    p_confirm_same_input_retry: false,
    p_source_event_id: null,
    p_correlation_id: correlation,
    p_deploy_version: SHA,
    p_provider_timeout_ms: 120000,
    p_model: "m",
    p_structured_output_mode: "json_schema_strict",
    p_max_tokens: 16000,
    p_boundary_mode: "judgment",
    p_boundary_constraint_count: 0,
    p_attempt_number: 1,
  };
  if (withIntent !== undefined) base.p_submission_intent_id = withIntent;
  return base;
}

type Rpc = { status: number; code: string | null };
async function rpc(body: Record<string, unknown>, role = "service_role"): Promise<Rpc> {
  const res = await fetch(`http://127.0.0.1:${PORT}/rpc/${FN}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${jwt(role)}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  let code: string | null = null;
  try {
    code = (JSON.parse(text) as { code?: string }).code ?? null;
  } catch {
    /* success bodies are arrays, not error objects */
  }
  return { status: res.status, code };
}

let uuidSeq = 0;
const nextUuid = () => `00000000-0000-4000-8000-${String(++uuidSeq).padStart(12, "0")}`;

beforeAll(async () => {
  if (!dockerAvailable) return;
  tmp = mkdtempSync(join(tmpdir(), "transport-gate-"));
  quiet("docker", ["rm", "-f", DB_C]);
  quiet("docker", ["rm", "-f", API_C]);
  quiet("docker", ["network", "rm", NET]);
  quiet("docker", ["network", "create", NET]);
  run("docker", ["run", "-d", "--name", DB_C, "--network", NET, "-e", "POSTGRES_PASSWORD=shadow", PG_IMAGE]);
  // Readiness needs care with this image. `pg_isready` goes green while the entrypoint's
  // TEMPORARY server is still running init scripts; that server is then shut down and the
  // real one starts. Probing in the gap yields either "auth.users does not exist" or
  // "the database system is shutting down". So: require the probe to succeed several times
  // CONSECUTIVELY — the restart breaks any streak — and probe for the object the fixture
  // actually needs rather than for a socket.
  const REQUIRED_STREAK = 5;
  let streak = 0;
  for (let i = 0; i < 180 && streak < REQUIRED_STREAK; i++) {
    const okNow =
      quiet("docker", ["exec", DB_C, "psql", "-U", "supabase_admin", "-d", "postgres", "-tAc", "select to_regclass('auth.users') is not null;"])
        .trim() === "t";
    streak = okNow ? streak + 1 : 0;
    if (streak < REQUIRED_STREAK) await new Promise((r) => setTimeout(r, 1000));
  }
  if (streak < REQUIRED_STREAK) throw new Error("shadow database never reached a stable ready state");

  const prereq = join(tmp, "prereq.sql");
  writeFileSync(
    prereq,
    `create table if not exists public.foundry_arena_scenario_drafts (id uuid primary key, owner_user_id uuid, revision integer, generation_input_revision integer);
     create table if not exists public.foundry_events (id uuid primary key, owner_user_id uuid);
     insert into auth.users (id, instance_id, aud, role, email)
       values ('${OWNER}','00000000-0000-0000-0000-000000000000','authenticated','authenticated','gate@example.invalid')
       on conflict do nothing;
     insert into public.foundry_arena_scenario_drafts (id, owner_user_id, revision, generation_input_revision)
       values ('${DRAFT}','${OWNER}',2,2) on conflict do nothing;
     grant usage on schema public to anon, authenticated, service_role;
     do $$ begin if not exists (select 1 from pg_roles where rolname='pgrst_auth') then
       create role pgrst_auth noinherit login password 'shadow'; end if; end $$;
     grant service_role to pgrst_auth; grant anon to pgrst_auth; grant authenticated to pgrst_auth;`,
  );
  psqlFile(prereq, "prereq.sql");
  for (const m of CHAIN) psqlFile(join(MIGRATIONS, m), m);

  run("docker", [
    "run", "-d", "--name", API_C, "--network", NET, "-p", `${PORT}:3000`,
    "-e", `PGRST_DB_URI=postgres://pgrst_auth:shadow@${DB_C}:5432/postgres`,
    "-e", "PGRST_DB_SCHEMAS=public",
    "-e", "PGRST_DB_ANON_ROLE=anon",
    "-e", `PGRST_JWT_SECRET=${JWT_SECRET}`,
    PGRST_IMAGE,
  ]);
  for (let i = 0; i < 60; i++) {
    try {
      await fetch(`http://127.0.0.1:${PORT}/`);
      break;
    } catch {
      await new Promise((r) => setTimeout(r, 1000));
    }
  }
  up = true;
}, 300_000);

afterAll(() => {
  if (!dockerAvailable) return;
  quiet("docker", ["rm", "-f", API_C]);
  quiet("docker", ["rm", "-f", DB_C]);
  quiet("docker", ["network", "rm", NET]);
  if (tmp) rmSync(tmp, { recursive: true, force: true });
}, 120_000);

describe.runIf(dockerAvailable)("[3.2L-0C] EXPAND — both admission overloads dispatch unambiguously over PostgREST", () => {
  it("the expanded schema really does carry two overloads", () => {
    expect(up).toBe(true);
    expect(psql(`select count(*) from pg_proc where proname='${FN}';`)).toBe("2");
    expect(psql(`select count(*) from pg_proc where proname='${FN}' and pronargs=15;`)).toBe("1");
    expect(psql(`select count(*) from pg_proc where proname='${FN}' and pronargs=16;`)).toBe("1");
  });

  it("the 16-argument overload declares NO trailing default", () => {
    // The default is the defect. pronargdefaults must be 0, or a 15-key request can
    // reach the 16-argument function and omit the submission intent entirely.
    expect(psql(`select pronargdefaults from pg_proc where proname='${FN}' and pronargs=16;`)).toBe("0");
    expect(psql(`select proargdefaults is null from pg_proc where proname='${FN}' and pronargs=16;`)).toBe("t");
    expect(psql(`select pg_get_function_arguments(oid) like '%p_submission_intent_id uuid' from pg_proc where proname='${FN}' and pronargs=16;`)).toBe("t");
  });

  it("a LEGACY 15-key request resolves — and is never ambiguous", async () => {
    const r = await rpc(payload(undefined, nextUuid()));
    expect(r.code, "PGRST203 means the overloads are ambiguous again — the live incident").not.toBe("PGRST203");
    expect(r.code).not.toBe("PGRST202");
    expect(r.status).toBe(200);
  });

  it("a NEW 16-key request resolves — and is never ambiguous", async () => {
    const r = await rpc(payload(nextUuid(), nextUuid()));
    expect(r.code).not.toBe("PGRST203");
    expect(r.code).not.toBe("PGRST202");
    expect(r.status).toBe(200);
  });

  it("neither the old nor the new Worker payload ever produces PGRST203", async () => {
    for (const body of [payload(undefined, nextUuid()), payload(nextUuid(), nextUuid())]) {
      const r = await rpc(body);
      expect(r.code).not.toBe("PGRST203");
    }
  });

  it("an explicitly NULL submission intent is refused before anything is inserted", async () => {
    const before = psql("select count(*) from public.foundry_practice_generation_attempts;");
    const r = await rpc(payload(null, nextUuid()));
    expect(r.status).toBe(400);
    expect(psql("select count(*) from public.foundry_practice_generation_attempts;")).toBe(before);
  });

  it("client roles cannot reach admission at all", async () => {
    expect((await rpc(payload(nextUuid(), nextUuid()), "anon")).status).toBe(401);
    expect((await rpc(payload(nextUuid(), nextUuid()), "authenticated")).status).toBe(403);
  });
});

describe.runIf(dockerAvailable)("[3.2L-0C] CONTRACT — one required 16-argument admission path remains", () => {
  it("applies inside one transaction and leaves exactly one function", () => {
    psqlFile(join(MIGRATIONS, "20260806000000_foundry_practice_generation_contract_v1.sql"), "contract.sql");
    expect(psql(`select count(*) from pg_proc where proname='${FN}';`)).toBe("1");
    expect(psql(`select pronargs from pg_proc where proname='${FN}';`)).toBe("16");
    expect(psql(`select pronargdefaults from pg_proc where proname='${FN}';`)).toBe("0");
  });

  it("preserves SECURITY DEFINER, search_path and the service-role-only grant", () => {
    expect(psql(`select prosecdef from pg_proc where proname='${FN}';`)).toBe("t");
    expect(psql(`select array_to_string(proconfig,',') from pg_proc where proname='${FN}';`)).toBe("search_path=public, pg_catalog");
    const sig = `${FN}(uuid, uuid, integer, text, boolean, uuid, uuid, text, integer, text, text, integer, text, integer, integer, uuid)`;
    expect(psql(`select has_function_privilege('service_role','${sig}','EXECUTE');`)).toBe("t");
    for (const r of ["anon", "authenticated", "public"]) {
      expect(psql(`select has_function_privilege('${r}','${sig}','EXECUTE');`)).toBe("f");
    }
  });

  it("a 15-key request no longer matches ANY function", async () => {
    const r = await rpc(payload(undefined, nextUuid()));
    expect(r.code).toBe("PGRST202");
    expect(r.status).toBe(404);
  });

  it("the deployed Worker's 16-key payload still resolves", async () => {
    const r = await rpc(payload(nextUuid(), nextUuid()));
    expect(r.status).toBe(200);
  });

  it("an explicitly NULL submission intent is still refused", async () => {
    expect((await rpc(payload(null, nextUuid()))).status).toBe(400);
  });

  it("is safe to re-run", () => {
    expect(() => psqlFile(join(MIGRATIONS, "20260806000000_foundry_practice_generation_contract_v1.sql"), "contract.sql")).not.toThrow();
    expect(psql(`select count(*) from pg_proc where proname='${FN}';`)).toBe("1");
  });

  it("future contradictions are refused while the honest outcome is accepted", () => {
    const write = (outcome: string) =>
      `insert into public.foundry_practice_generation_attempts
         (id,draft_id,draft_revision,generation_input_revision,owner_user_id,correlation_id,provider_timeout_ms,
          model,structured_output_mode,max_tokens,locale,lifecycle_state,finished_at,outcome,terminal_reason_code)
       values (gen_random_uuid(),'${DRAFT}',2,2,'${OWNER}',gen_random_uuid(),120000,'m','none',1,'en','completed',now(),
               '${outcome}','semantic_reviewer_terminal_failure');`;
    expect(() => psql(write("boundary_review_rejected"))).toThrow();
    expect(() => psql(write("review_execution_failed"))).not.toThrow();
  });

  it("the contradiction constraint stays NOT VALID so historical rows are never revalidated", () => {
    expect(psql("select convalidated from pg_constraint where conname='foundry_practice_gen_attempt_review_exec_chk';")).toBe("f");
  });
});
