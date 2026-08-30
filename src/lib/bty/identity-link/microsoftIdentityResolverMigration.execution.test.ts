import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

/**
 * REAL POSTGRESQL EXECUTION GATE — Slice R1C-B-2R (Microsoft identity resolver).
 *
 * The resolver's whole value is that it matches the ONE claim path that works and none of the three
 * that silently return zero rows. That cannot be proven by reading SQL — it needs a fixture whose
 * `identity_data` has the exact nested shape measured in R1C-B-1a, and a real PostgreSQL to run it.
 *
 * Skips loudly when no local PostgreSQL exists.
 */

const PG_BIN_CANDIDATES = [
  "/opt/homebrew/opt/postgresql@17/bin",
  "/opt/homebrew/opt/postgresql@16/bin",
  "/usr/local/bin",
  "/usr/bin",
];
const PG_BIN = PG_BIN_CANDIDATES.find((p) => existsSync(join(p, "initdb")) && existsSync(join(p, "pg_ctl")));
const MIGRATIONS = join(process.cwd(), "supabase/migrations");
const MIGRATION = "20260829000000_bty_microsoft_identity_resolver_v1.sql";

let dataDir = "";
let sockDir = "";
const PORT = "55493";
let up = false;

const bin = (name: string) => join(PG_BIN ?? "", name);
const sh = (cmd: string, args: string[]) =>
  execFileSync(cmd, args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
const psql = (args: string[], db = "postgres") =>
  sh(bin("psql"), ["-h", sockDir, "-p", PORT, "-U", "postgres", "-d", db, "-v", "ON_ERROR_STOP=1", "-q", ...args]);

const DB = "r1cb2_exec";
const USER_A = "11111111-1111-1111-1111-111111111111";
const USER_B = "22222222-2222-2222-2222-222222222222";
const TID = "10110d5c-bd30-467e-9912-e44e67777647";
const OID_A = "aaaaaaaa-1111-2222-3333-444444444444";
const OID_B = "bbbbbbbb-1111-2222-3333-444444444444";
const SUB_A = "SUB-pairwise-value-not-equal-to-oid";

const scalar = (sql: string) => psql(["-tAc", sql], DB).trim();
/** SQL string literal escaping — so an injection-SHAPED input reaches the function as data. */
const lit = (v: string) => `'${v.replace(/'/g, "''")}'`;
const resolve = (tid: string, oid: string) =>
  scalar(`select status || '|' || coalesce(user_id::text,'-')
          from public.bty_resolve_user_from_microsoft_identity(${lit(tid)}, ${lit(oid)});`);

/**
 * Fixture built to the EXACT shape measured on a real linked account in R1C-B-1a:
 * `oid`/`tid` nested under `custom_claims`, `provider_id` = `sub`, `sub` != `oid`.
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
       create table auth.users (id uuid primary key);
       create table auth.identities (
         id uuid primary key default gen_random_uuid(),
         user_id uuid not null references auth.users(id) on delete cascade,
         provider text not null,
         provider_id text not null,
         identity_data jsonb not null,
         constraint identities_provider_id_provider_unique unique (provider_id, provider)
       );
       insert into auth.users(id) values ('${USER_A}'), ('${USER_B}');
       insert into auth.identities (user_id, provider, provider_id, identity_data) values
         ('${USER_A}','email','a@x.test','{"email":"a@x.test","sub":"a@x.test"}'::jsonb),
         ('${USER_A}','azure','${SUB_A}', jsonb_build_object(
            'sub','${SUB_A}','email','a@x.test','preferred_username','a@x.test',
            'iss','https://login.microsoftonline.com/${TID}/v2.0',
            'custom_claims', jsonb_build_object('oid','${OID_A}','tid','${TID}','idp','x','sid','y','email','a@x.test')));`,
    ],
    DB,
  );
}

beforeAll(() => {
  if (!PG_BIN) return;
  dataDir = mkdtempSync(join(tmpdir(), "r1cb2-pg-"));
  sockDir = mkdtempSync(join(tmpdir(), "r1cb2-sock-"));
  sh(bin("initdb"), ["-D", dataDir, "-U", "postgres", "--auth=trust"]);
  sh(bin("pg_ctl"), ["-D", dataDir, "-o", `-p ${PORT} -k ${sockDir}`, "-l", join(dataDir, "log"), "-w", "start"]);
  up = true;
  freshDatabase();
  psql(["-1", "-f", join(MIGRATIONS, MIGRATION)], DB);
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

describe.runIf(Boolean(PG_BIN))("[R1C-B-2R] Microsoft identity resolver", () => {
  it("the migration applies cleanly, and is safe to re-run", () => {
    expect(() => psql(["-1", "-f", join(MIGRATIONS, MIGRATION)], DB)).not.toThrow();
  });

  // ---- resolver ------------------------------------------------------------
  it("correct tid + correct oid → RESOLVED, exactly one user", () => {
    expect(resolve(TID, OID_A)).toBe(`RESOLVED|${USER_A}`);
  });

  it("wrong tid + correct oid → NOT_LINKED", () => {
    expect(resolve("99999999-9999-9999-9999-999999999999", OID_A)).toBe("NOT_LINKED|-");
  });

  it("correct tid + wrong oid → NOT_LINKED", () => {
    expect(resolve(TID, OID_B)).toBe("NOT_LINKED|-");
  });

  it("is case-insensitive on GUIDs (Entra casing must not decide identity)", () => {
    expect(resolve(TID.toUpperCase(), OID_A.toUpperCase())).toBe(`RESOLVED|${USER_A}`);
  });

  it.each([
    ["not-a-guid", OID_A],
    [TID, "not-a-guid"],
    ["", OID_A],
    [TID, "   "],
    ["' or 1=1 --", OID_A],
  ])("malformed input (%s, %s) → INVALID_INPUT, never a match", (tid, oid) => {
    expect(resolve(tid, oid)).toBe("INVALID_INPUT|-");
  });

  it("FAILS CLOSED on more than one match rather than choosing an owner", () => {
    // A second Entra app would yield a different `sub` (provider_id) for the same oid.
    psql([
      "-c",
      `insert into auth.identities (user_id, provider, provider_id, identity_data) values
        ('${USER_B}','azure','DIFFERENT-SUB-SECOND-APP', jsonb_build_object(
          'sub','DIFFERENT-SUB-SECOND-APP',
          'custom_claims', jsonb_build_object('oid','${OID_A}','tid','${TID}')));`,
    ], DB);
    expect(resolve(TID, OID_A)).toBe("AMBIGUOUS_IDENTITY|-");
    psql(["-c", `delete from auth.identities where provider_id='DIFFERENT-SUB-SECOND-APP';`], DB);
    expect(resolve(TID, OID_A)).toBe(`RESOLVED|${USER_A}`);
  });

  it("THE MEASURED TRAP: the three wrong paths find nothing on a genuinely linked account", () => {
    expect(scalar(`select count(*) from auth.identities
                   where provider='azure' and identity_data->>'oid' = '${OID_A}';`)).toBe("0");
    expect(scalar(`select count(*) from auth.identities
                   where provider='azure' and provider_id = '${OID_A}';`)).toBe("0");
    expect(scalar(`select count(*) from auth.identities
                   where provider='azure' and identity_data->>'sub' = '${OID_A}';`)).toBe("0");
    // and the correct path does find it
    expect(scalar(`select count(*) from auth.identities
                   where provider='azure' and identity_data->'custom_claims'->>'oid' = '${OID_A}';`)).toBe("1");
  });

  it("email can never resolve: the function takes no email and its body mentions none", () => {
    const src = scalar(`select prosrc from pg_proc where proname='bty_resolve_user_from_microsoft_identity';`);
    expect(src.toLowerCase()).not.toContain("email");
    const args = scalar(`select pg_get_function_arguments(oid) from pg_proc
                         where proname='bty_resolve_user_from_microsoft_identity';`);
    expect(args).toBe("p_tenant_id text, p_aad_object_id text");
  });

  it("returns ONLY status + user_id — no claims cross the boundary", () => {
    const ret = scalar(`select pg_get_function_result(oid) from pg_proc
                        where proname='bty_resolve_user_from_microsoft_identity';`);
    expect(ret.replace(/\s+/g, " ")).toBe("TABLE(status text, user_id uuid)");
  });

  it("is SECURITY DEFINER, executable by service_role only", () => {
    expect(scalar(`select prosecdef from pg_proc where proname='bty_resolve_user_from_microsoft_identity';`)).toBe("t");
    for (const role of ["anon", "authenticated", "public"]) {
      expect(
        scalar(`select has_function_privilege('${role}','public.bty_resolve_user_from_microsoft_identity(text,text)','execute');`),
        `${role} must NOT execute`,
      ).toBe("f");
    }
    expect(scalar(`select has_function_privilege('service_role','public.bty_resolve_user_from_microsoft_identity(text,text)','execute');`)).toBe("t");
  });
});
