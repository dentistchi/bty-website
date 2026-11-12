import { readFileSync } from "node:fs";
import { join } from "node:path";
import { Pool, type PoolClient } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const connection = process.env.BTY_CONSENT_PG_TEST_URL;
const databaseName = `consent_authority_${process.pid}`;
const legacyUser = "10000000-0000-0000-0000-000000000001";
const rollbackUser = "10000000-0000-0000-0000-000000000002";
const version = "2026-05-v1";
const fingerprint = `bty_consent_document_v1:${"a".repeat(64)}`;
const migration = "supabase/migrations/20261112174011_employee_release_consent_authority.sql";
let root: Pool;
let db: Pool;
let databaseCreated = false;

const read = (file: string) => readFileSync(join(process.cwd(), file), "utf8");

async function withRole<T>(
  role: "authenticated" | "service_role",
  fn: (client: PoolClient) => Promise<T>,
  userId = legacyUser,
) {
  const client = await db.connect();
  try {
    await client.query("begin");
    await client.query(`set local role ${role}`);
    await client.query("select set_config('request.jwt.claim.sub', $1, true)", [userId]);
    const result = await fn(client);
    await client.query("commit");
    return result;
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}

async function accept(userId: string) {
  return withRole("service_role", async (client) => (
    await client.query(
      "select public.bty_accept_learner_consent($1, $2, 'en-US', $3, true, '192.0.2.7', 'test') as result",
      [userId, version, fingerprint],
    )
  ).rows[0].result);
}

beforeAll(async () => {
  if (!connection) return;
  const url = new URL(connection);
  if (!["localhost", "127.0.0.1"].includes(url.hostname)) throw new Error("Local PostgreSQL only");
  root = new Pool({ connectionString: url.toString() });
  await root.query(`create database ${databaseName}`);
  databaseCreated = true;
  url.pathname = `/${databaseName}`;
  db = new Pool({ connectionString: url.toString(), max: 12 });
  const profile = read("scripts/qa/reward-fence-prod-schema.sql").split("\n").find(
    (line) => line.startsWith("create table public.arena_profiles ("),
  );
  if (!profile) throw new Error("Production profile fixture not found");
  await db.query(`
    do $$ begin
      if not exists (select from pg_roles where rolname = 'anon') then create role anon; end if;
      if not exists (select from pg_roles where rolname = 'authenticated') then create role authenticated; end if;
      if not exists (select from pg_roles where rolname = 'service_role') then create role service_role bypassrls; end if;
    end $$;
    create schema auth;
    grant usage on schema auth to authenticated;
    create table auth.users (id uuid primary key default gen_random_uuid());
    create function auth.uid() returns uuid language sql stable as $$
      select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
    $$;
    ${profile}
    alter table public.arena_profiles add primary key (user_id);
    alter table public.arena_profiles add foreign key (user_id) references auth.users(id);
    alter table public.arena_profiles enable row level security;
    create policy profile_owner on public.arena_profiles to authenticated
      using (auth.uid() = user_id) with check (auth.uid() = user_id);
    grant select, insert, update on public.arena_profiles to authenticated;
  `);
  await db.query(read("supabase/migrations-hold/20260511000000_consent_tracking.sql"));
  await db.query(read("supabase/migrations/20260220_mvp_debug_reports.sql"));
  const diagnosticPolicies = read("supabase/migrations/20260315000002_function_search_path_and_rls_policies.sql");
  await db.query(diagnosticPolicies.slice(diagnosticPolicies.indexOf('DROP POLICY IF EXISTS "mvp_debug_update"')));
  await db.query(`
    grant all on public.arena_consent_log, public.mvp_debug_reports to anon, authenticated, service_role;
    insert into auth.users(id) values ('${legacyUser}'), ('${rollbackUser}');
    insert into public.arena_profiles(user_id, consent_version, consent_accepted_at)
      values ('${legacyUser}', '${version}', now());
    insert into public.arena_consent_log(user_id, consent_type, consent_version, consent_locale, action, notes)
      select '${legacyUser}', 'tos', '${version}', 'en-US', 'accepted', '{"legacy":true}'::jsonb
      from generate_series(1, 5);
    insert into public.mvp_debug_reports(title, route) values ('legacy', 'other');
  `);
  await db.query(read(migration));
  await db.query(read(migration));
}, 60_000);

afterAll(async () => {
  try {
    await db?.end();
    if (databaseCreated) await root.query(`drop database ${databaseName}`);
  } finally {
    await root?.end();
  }
}, 60_000);

describe.skipIf(!connection)("employee release consent authority in PostgreSQL", () => {
  it("keeps legacy history without treating it as verified consent or rate usage", async () => {
    const row = (await db.query("select consent_version, consent_verified_version from public.arena_profiles where user_id = $1", [legacyUser])).rows[0];
    expect(row).toEqual({ consent_version: version, consent_verified_version: null });
    const history = (await db.query("select notes, server_verified from public.arena_consent_log where user_id = $1", [legacyUser])).rows;
    expect(history).toHaveLength(5);
    expect(history.every((event) => event.notes.legacy && event.server_verified === false)).toBe(true);
    expect(await accept(legacyUser)).toEqual({ status: "accepted" });
    const receipt = (await db.query(
      "select consent_locale, notes, host(ip_address) as ip from public.arena_consent_log where user_id = $1 and server_verified",
      [legacyUser],
    )).rows[0];
    expect(receipt).toEqual({
      consent_locale: "en-US",
      notes: { sprint: "AL-LAUNCH-D3", placeholder: true, documentFingerprint: fingerprint },
      ip: "192.0.2.7",
    });
  });

  it("allows ordinary profile edits and reserves consent authority for the server role", async () => {
    const employee = (await db.query("insert into auth.users default values returning id")).rows[0].id;
    await withRole("authenticated", (client) => client.query(
      "insert into public.arena_profiles(user_id, display_name) values ($1, 'Ordinary profile')", [employee],
    ), employee);
    expect(await accept(employee)).toEqual({ status: "accepted" });
    await withRole("authenticated", (client) => client.query(
      "update public.arena_profiles set display_name = 'Visible name' where user_id = $1", [employee],
    ), employee);
    const row = (await db.query(
      "select display_name, consent_verified_version, consent_locale, lifetime_xp from public.arena_profiles where user_id = $1",
      [employee],
    )).rows[0];
    expect(row).toEqual({
      display_name: "Visible name", consent_verified_version: version, consent_locale: "en-US", lifetime_xp: 0,
    });
    expect((await db.query(`
      select has_function_privilege('authenticated',
        'public.bty_accept_learner_consent(uuid,text,text,text,boolean,inet,text)', 'EXECUTE') as rpc,
        has_table_privilege('authenticated', 'public.arena_consent_log', 'INSERT') as ledger
    `)).rows[0]).toEqual({ rpc: false, ledger: false });
    await expect(withRole("authenticated", (client) => client.query(
      "update public.arena_profiles set consent_verified_version = null where user_id = $1", [employee],
    ), employee)).rejects.toMatchObject({ code: "42501" });
  });

  it("rolls back the ledger when the profile write fails", async () => {
    await db.query(`alter table public.arena_profiles add constraint synthetic_profile_failure
      check (user_id <> '${rollbackUser}')`);
    await expect(accept(rollbackUser)).rejects.toMatchObject({ code: "23514" });
    expect((await db.query("select id from public.arena_consent_log where user_id = $1", [rollbackUser])).rowCount).toBe(0);
    await db.query("alter table public.arena_profiles drop constraint synthetic_profile_failure");
    expect(await accept(rollbackUser)).toEqual({ status: "accepted" });
  });

  it("accepts simultaneous distinct employees from one IP and caps concurrent writes per user", async () => {
    const users = (await db.query("insert into auth.users select gen_random_uuid() from generate_series(1, 6) returning id")).rows;
    const results = await Promise.all(users.map(({ id }) => accept(id)));
    expect(results).toEqual(Array.from({ length: 6 }, () => ({ status: "accepted" })));
    const sameUser = await Promise.all(Array.from({ length: 6 }, () => accept(users[0].id)));
    expect(sameUser.filter((result) => result.status === "accepted")).toHaveLength(4);
    const limited = sameUser.filter((result) => result.status === "rate_limited");
    expect(limited).toHaveLength(2);
    expect(limited.every((result) => result.retryAfterSeconds > 0 && result.retryAfterSeconds <= 900)).toBe(true);
  });

  it("allows Teams diagnostics for the server and keeps reports unavailable to general users", async () => {
    expect((await db.query(`
      select has_table_privilege('authenticated', 'public.mvp_debug_reports', 'SELECT') as can_read,
        has_table_privilege('authenticated', 'public.mvp_debug_reports', 'UPDATE') as can_update,
        has_table_privilege('anon', 'public.mvp_debug_reports', 'INSERT') as anon_write
    `)).rows[0]).toEqual({ can_read: false, can_update: false, anon_write: false });
    await withRole("service_role", async (client) => {
      await client.query("insert into public.mvp_debug_reports(title, route) values ('team boot', '/teams')");
      expect((await client.query("select route from public.mvp_debug_reports order by route")).rows)
        .toEqual([{ route: "/teams" }, { route: "other" }]);
    });
  });
});
