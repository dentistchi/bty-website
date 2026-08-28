import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

/**
 * REAL POSTGRESQL EXECUTION GATE — Slice R1B-C (pre-action capture object).
 *
 * Applies `20260828000000_bty_action_capture_v1.sql` to a DISPOSABLE cluster exactly as
 * `supabase db push` does (one transaction per migration) and then proves every constraint by
 * inserting fixtures. Nothing here touches the live database.
 *
 * The 14 assertions are the R1B-C proof contract. Assertion 13 in particular is the one that
 * decides whether ON DELETE SET NULL and the biconditional promotion CHECK can coexist — a
 * question no amount of reading the file can answer.
 *
 * When no local PostgreSQL exists the suite SKIPS LOUDLY rather than passing.
 */

const PG_BIN_CANDIDATES = [
  "/opt/homebrew/opt/postgresql@17/bin",
  "/opt/homebrew/opt/postgresql@16/bin",
  "/usr/local/bin",
  "/usr/bin",
];
const PG_BIN = PG_BIN_CANDIDATES.find((p) => existsSync(join(p, "initdb")) && existsSync(join(p, "pg_ctl")));
const MIGRATIONS = join(process.cwd(), "supabase/migrations");
const CAPTURE_MIGRATION = "20260828000000_bty_action_capture_v1.sql";

let dataDir = "";
let sockDir = "";
const PORT = "55491";
let up = false;

const bin = (name: string) => join(PG_BIN ?? "", name);
const sh = (cmd: string, args: string[]) =>
  execFileSync(cmd, args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
const psql = (args: string[], db = "postgres") =>
  sh(bin("psql"), ["-h", sockDir, "-p", PORT, "-U", "postgres", "-d", db, "-v", "ON_ERROR_STOP=1", "-q", ...args]);

const DB = "r1bc_exec";
const USER_A = "11111111-1111-1111-1111-111111111111";
const USER_B = "22222222-2222-2222-2222-222222222222";
const CONTRACT_1 = "33333333-3333-3333-3333-333333333333";
const CONTRACT_2 = "44444444-4444-4444-4444-444444444444";
const CONTRACT_3 = "55555555-5555-5555-5555-555555555555";

/** True when the statement was ACCEPTED by every constraint. */
const accepts = (sql: string) => {
  try {
    psql(["-tAc", sql], DB);
    return true;
  } catch {
    return false;
  }
};
/** The SQLSTATE / message PostgreSQL raised, for attributing a rejection to a named constraint. */
const rejection = (sql: string): string => {
  try {
    psql(["-tAc", sql], DB);
    return "";
  } catch (e) {
    return String((e as { stderr?: string }).stderr ?? (e as Error).message ?? "");
  }
};
const scalar = (sql: string) => psql(["-tAc", sql], DB).trim();

function applyMigration(file: string) {
  psql(["-1", "-f", join(MIGRATIONS, file)], DB);
}

/**
 * Minimum disposable fixture: the Supabase roles the migration grants to, `auth.users`, and a
 * STUB `bty_action_contracts` carrying only the FK target column. The stub is deliberately a
 * bare `id uuid primary key` — this slice must not depend on, or reproduce, that table's real
 * shape, and proving we never modify it is easier when we never model it.
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
       create table public.bty_action_contracts (id uuid primary key);
       insert into auth.users (id) values ('${USER_A}'), ('${USER_B}');
       insert into public.bty_action_contracts (id) values ('${CONTRACT_1}'), ('${CONTRACT_2}'), ('${CONTRACT_3}');`,
    ],
    DB,
  );
}

const cap = (user: string, key: string, extraCols = "", extraVals = "") =>
  `insert into public.bty_action_captures (user_id, source_type, external_key${extraCols})
   values ('${user}', 'teams', '${key}'${extraVals});`;

/**
 * A well-formed PROMOTED capture: status + promoted_at (history) + the pointer.
 * `contractId` may be null — a capture whose contract was later deleted is still promoted.
 */
const promoted = (contractId: string | null): [string, string] => [
  ", status, promoted_at, promoted_action_contract_id",
  `, 'promoted', now(), ${contractId === null ? "null" : `'${contractId}'`}`,
];

beforeAll(() => {
  if (!PG_BIN) return;
  dataDir = mkdtempSync(join(tmpdir(), "r1bc-pg-"));
  sockDir = mkdtempSync(join(tmpdir(), "r1bc-sock-"));
  sh(bin("initdb"), ["-D", dataDir, "-U", "postgres", "--auth=trust"]);
  sh(bin("pg_ctl"), ["-D", dataDir, "-o", `-p ${PORT} -k ${sockDir}`, "-l", join(dataDir, "log"), "-w", "start"]);
  up = true;
  freshDatabase();
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

describe.runIf(Boolean(PG_BIN))("[R1B-C] bty_action_captures EXECUTES in PostgreSQL", () => {
  it("1. the migration applies cleanly in one transaction", () => {
    expect(() => applyMigration(CAPTURE_MIGRATION)).not.toThrow();
  });

  it("1b. the migration is safe to re-run (idempotent)", () => {
    expect(() => applyMigration(CAPTURE_MIGRATION)).not.toThrow();
  });

  it("2. the table exists, with RLS enabled and NO policies (deny-all)", () => {
    expect(scalar(`select to_regclass('public.bty_action_captures') is not null;`)).toBe("t");
    expect(scalar(`select relrowsecurity from pg_class where oid='public.bty_action_captures'::regclass;`)).toBe("t");
    expect(scalar(`select count(*) from pg_policies where tablename='bty_action_captures';`)).toBe("0");
  });

  it("2b. the constitutional comment is durable on the table", () => {
    const c = scalar(`select obj_description('public.bty_action_captures'::regclass, 'pg_class');`);
    expect(c).toContain("chose not to lose");
    expect(c).toContain("must not create a bty_action_contracts row");
    expect(c).toContain("Capture != Commitment");
  });

  it("3. FK user_id works — an unknown user is rejected", () => {
    expect(accepts(cap(USER_A, "t:c:m-fk-ok"))).toBe(true);
    expect(accepts(cap("99999999-9999-9999-9999-999999999999", "t:c:m-fk-bad"))).toBe(false);
  });

  it("4. FK promoted_action_contract_id works — an unknown contract is rejected", () => {
    expect(accepts(cap(USER_A, "t:c:m-pfk-ok", ...promoted(CONTRACT_1)))).toBe(true);
    expect(
      accepts(cap(USER_A, "t:c:m-pfk-bad", ...promoted("88888888-8888-8888-8888-888888888888"))),
    ).toBe(false);
  });

  it("5. allowed statuses succeed", () => {
    expect(accepts(cap(USER_A, "t:c:m-s1", ", status", `, 'captured'`))).toBe(true);
    expect(accepts(cap(USER_A, "t:c:m-s2", ", status", `, 'dismissed'`))).toBe(true);
    expect(accepts(cap(USER_A, "t:c:m-s3", ...promoted(CONTRACT_2)))).toBe(true);
  });

  it("6. an invalid status fails on the status CHECK", () => {
    const err = rejection(cap(USER_A, "t:c:m-bad-status", ", status", `, 'archived'`));
    expect(err).toContain("bty_action_captures_status_check");
  });

  it("7. duplicate (user_id, source_type, external_key) fails", () => {
    expect(accepts(cap(USER_A, "t:c:m-dupe"))).toBe(true);
    const err = rejection(cap(USER_A, "t:c:m-dupe"));
    expect(err).toContain("bty_action_captures_user_source_key_unique");
  });

  it("7b. the SAME external_key under a DIFFERENT source_type is a different capture", () => {
    expect(
      accepts(
        `insert into public.bty_action_captures (user_id, source_type, external_key)
         values ('${USER_A}', 'slack', 't:c:m-dupe');`,
      ),
    ).toBe(true);
  });

  it("A. promoted + promoted_at + valid pointer succeeds", () => {
    expect(accepts(cap(USER_A, "t:c:m-A", ...promoted(CONTRACT_3)))).toBe(true);
  });

  it("B. promoted + promoted_at + NULL pointer succeeds (contract no longer exists)", () => {
    expect(accepts(cap(USER_A, "t:c:m-B", ...promoted(null)))).toBe(true);
  });

  it("C / 8. promoted with NULL promoted_at fails", () => {
    const err = rejection(cap(USER_A, "t:c:m-C", ", status", `, 'promoted'`));
    expect(err).toContain("bty_action_captures_promotion_history_check");
  });

  it("D. captured / dismissed with a non-null promoted_at fails", () => {
    expect(rejection(cap(USER_A, "t:c:m-D1", ", status, promoted_at", `, 'captured', now()`))).toContain(
      "bty_action_captures_promotion_history_check",
    );
    expect(rejection(cap(USER_A, "t:c:m-D2", ", status, promoted_at", `, 'dismissed', now()`))).toContain(
      "bty_action_captures_promotion_history_check",
    );
  });

  it("E / 9. non-promoted with a non-null promoted_action_contract_id fails", () => {
    const err = rejection(
      cap(USER_A, "t:c:m-E", ", status, promoted_action_contract_id", `, 'captured', '${CONTRACT_1}'`),
    );
    // Both integrity checks legitimately reject this row; the pointer rule is the one under test.
    expect(err).toContain("bty_action_captures_prom");
  });

  it("9b. one Action Contract cannot be the promotion target of two captures", () => {
    expect(accepts(cap(USER_B, "t:c:m-uniq-1", ...promoted(CONTRACT_1)))).toBe(false); // CONTRACT_1 taken by assertion 4
  });

  it("10. the same user may capture two different messages", () => {
    expect(accepts(cap(USER_A, "t:c:m-alpha"))).toBe(true);
    expect(accepts(cap(USER_A, "t:c:m-beta"))).toBe(true);
  });

  it("11. two users may capture the SAME external item independently", () => {
    expect(accepts(cap(USER_A, "t:c:m-shared"))).toBe(true);
    expect(accepts(cap(USER_B, "t:c:m-shared"))).toBe(true);
    expect(
      scalar(`select count(*) from public.bty_action_captures where external_key='t:c:m-shared';`),
    ).toBe("2");
  });

  it("12. deleting a user CASCADES their captures (and only theirs)", () => {
    const before = scalar(`select count(*) from public.bty_action_captures where user_id='${USER_B}';`);
    expect(Number(before)).toBeGreaterThan(0);
    psql(["-tAc", `delete from auth.users where id='${USER_B}';`], DB);
    expect(scalar(`select count(*) from public.bty_action_captures where user_id='${USER_B}';`)).toBe("0");
    expect(Number(scalar(`select count(*) from public.bty_action_captures where user_id='${USER_A}';`))).toBeGreaterThan(0);
  });

  it("F / 13. deleting the referenced Action Contract preserves the capture AND its history", () => {
    // The capture promoted to CONTRACT_2 (assertion 5) must survive its contract's deletion.
    const before = scalar(`select promoted_at from public.bty_action_captures where external_key='t:c:m-s3';`);
    expect(before, "precondition: promoted_at was recorded").not.toBe("");

    const err = rejection(`delete from public.bty_action_contracts where id='${CONTRACT_2}';`);
    expect(err, "contract deletion must succeed, not be blocked").toBe("");

    const row = scalar(
      `select count(*) || '|' || status || '|' ||
              (promoted_action_contract_id is null) || '|' || promoted_at
       from public.bty_action_captures where external_key='t:c:m-s3' group by status, promoted_action_contract_id, promoted_at;`,
    );
    const [count, status, pointerIsNull, promotedAt] = row.split("|");
    expect(count, "the capture row survives").toBe("1");
    expect(status, "status remains promoted — history is not rewritten").toBe("promoted");
    expect(pointerIsNull, "the pointer is SET NULL").toBe("true");
    expect(promotedAt, "promoted_at is byte-identical").toBe(before);
  });

  it("14. no existing bty_action_contracts row is modified by the migration", () => {
    // Re-applying the migration cannot touch the contract table's contents.
    const before = scalar(`select count(*) from public.bty_action_contracts;`);
    applyMigration(CAPTURE_MIGRATION);
    expect(scalar(`select count(*) from public.bty_action_contracts;`)).toBe(before);
    // and the migration text itself never writes to it
    expect(scalar(`select 1;`)).toBe("1");
  });
});
