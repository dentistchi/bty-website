/**
 * Native PostgreSQL regression. Set BTY_REMINDER_PG_TEST_URL to a fresh database named
 * bty_teams_reminders_test on a disposable loopback cluster, then run this file with node --test.
 * No Microsoft or Supabase network calls. The script refuses any other target.
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { Pool } from "pg";

const url = process.env.BTY_REMINDER_PG_TEST_URL;
const migration = (name) => readFile(new URL(`../../supabase/migrations/${name}`, import.meta.url), "utf8");
const reminderMigration = "20261110184838_bty_teams_delayed_reminders.sql";
const tenant = "00000000-0000-0000-0000-000000000001";
const guid = (n) => `00000000-0000-0000-0000-${String(n).padStart(12, "0")}`;
const host = { user: guid(100), oid: guid(200) };
const first = { user: guid(101), oid: guid(201) };
const second = { user: guid(102), oid: guid(202) };

const bootstrap = `
  create role anon;
  create role authenticated;
  create role service_role bypassrls;
  create schema auth;
  create table auth.users (id uuid primary key, banned_until timestamptz, deleted_at timestamptz);
  create table auth.identities (
    user_id uuid not null references auth.users(id) on delete cascade,
    provider text not null, identity_data jsonb not null
  );
  create table public.bty_action_contracts (id uuid primary key);
  create table public.bty_teams_tenant_routes (tenant_id text primary key, service_url text);
`;
const captureAndTrackingHistory = [
  "20260828000000_bty_action_capture_v1.sql",
  "20260829000000_bty_microsoft_identity_resolver_v1.sql",
  "20260902000000_bty_tracked_announcements_v1.sql",
  "20260905000000_bty_action_capture_saved_at_v1.sql",
  "20260906000000_bty_announcement_recipient_handled_v1.sql",
  "20260907000000_bty_announcement_service_url_v1.sql",
  "20260908000000_bty_teams_proactive_notification_v1.sql",
  "20260911000000_bty_bind_recipients_on_canonical_entry_v1.sql",
];
const productionTrackSignature = `
  drop function public.bty_track_announcement(uuid, uuid, text, text, text, text[], text);
  create function public.bty_track_announcement(
    p_owner_user_id uuid, p_source_capture_id uuid, p_host_framing text, p_tenant_id text,
    p_conversation_id text, p_service_url text, p_recipient_oids text[]
  ) returns table (announcement_id uuid, resolved_count integer, already_existed boolean)
  language plpgsql security definer set search_path = pg_catalog, public
  as $$ begin raise exception 'Track bootstrap stub must be replaced'; end; $$;
`;
const productionShapeMigrations = [
  "20260912000000_bty_announcement_thread_v1.sql",
  "20260913000000_bty_today_dismissal_v1.sql",
  "20260914000000_bty_identity_integrity_reconciliation_v1.sql",
  "20260915000000_bty_host_track_history_retention_v1.sql",
  "20260916000000_bty_action_capture_saved_removed_v1.sql",
  "20260927051100_announcement_tracking_modes_v1.sql",
  "20260928000000_bty_track_collaboration_authority_alignment_v1.sql",
];

test("delayed Teams reminders on a fresh native PostgreSQL cluster", { skip: !url }, async (t) => {
  const destination = new URL(url);
  assert.equal(destination.protocol, "postgresql:");
  assert.equal(destination.hostname, "127.0.0.1");
  assert.equal(destination.pathname, "/bty_teams_reminders_test");
  assert.equal(destination.search, "");
  assert(Number(destination.port) > 1024 && destination.port !== "5432", "Use a disposable nondefault port");

  const pool = new Pool({ connectionString: url, ssl: false, max: 6 });
  t.after(() => pool.end());
  const [{ fresh, version }] = (await pool.query(`
    select current_database() = 'bty_teams_reminders_test'
      and host(inet_server_addr()) = '127.0.0.1'
      and not exists (select 1 from pg_namespace where nspname not in ('pg_catalog','pg_toast','information_schema','public'))
      and not exists (select 1 from pg_class where relnamespace = 'public'::regnamespace)
      and not exists (select 1 from pg_roles where rolname in ('anon','authenticated','service_role'))
      as fresh, version()
  `)).rows;
  assert.equal(fresh, true, "Refusing a nonempty or mismatched test database");
  t.diagnostic(version);

  await pool.query(bootstrap);
  for (const file of captureAndTrackingHistory) await pool.query(await migration(file));
  // Mirror the deployed argument order before the real Thread migration replaces the stub.
  await pool.query(productionTrackSignature);
  for (const file of productionShapeMigrations) await pool.query(await migration(file));
  for (const person of [host, first, second]) {
    await pool.query("insert into auth.users (id) values ($1)", [person.user]);
    await pool.query(`
      insert into auth.identities (user_id, provider, identity_data)
      values ($1, 'azure', jsonb_build_object('custom_claims', jsonb_build_object('tid', $2::text, 'oid', $3::text)))
    `, [person.user, tenant, person.oid]);
  }

  const asRole = async (role, sql, values = []) => {
    const client = await pool.connect();
    try {
      await client.query(`set role ${role}`);
      return await client.query(sql, values);
    } finally {
      await client.query("reset role");
      client.release();
    }
  };
  const service = (...args) => asRole("service_role", ...args);
  const source = (key) => ({ provider: "teams", tenant_id: tenant, conversation_id: "fixture", message_id: key });
  const track = async (key, mode, people = [first]) => {
    const { rows } = await service(`
      select * from public.bty_track_announcement_v1($1,$2,$3,$4,$5,$6,null)
    `, [host.user, host.oid, source(key), "Synthetic announcement", people.map((person) => person.oid), mode]);
    return rows[0];
  };
  const save = async (key, actor = host.oid) => {
    const { rows } = await service(`
      insert into public.bty_action_captures
        (user_id, source_type, external_key, source_metadata, saved_at, teams_reminder_actor_oid)
      values ($1, 'teams_message', $2, $3, clock_timestamp(), $4)
      returning id, saved_at
    `, [host.user, `teams:${tenant}:fixture:${key}`, source(key), actor]);
    return rows[0];
  };
  const jobs = async (subject) => (await pool.query(`
    select * from bty_reminder_private.jobs where coalesce(capture_id, announcement_id) = $1
    order by created_at, id
  `, [subject])).rows;
  const forceDue = async (subject) => pool.query(`
    update bty_reminder_private.jobs set available_at = clock_timestamp() - interval '1 second'
    where coalesce(capture_id, announcement_id) = $1
  `, [subject]);
  const claim = async (limit = 25) => (await service("select * from public.bty_claim_due_teams_reminders($1)", [limit])).rows;
  const start = async (job) => (await service("select public.bty_start_teams_reminder($1,$2) as ok", [job.id, job.claim_token])).rows[0].ok;
  const finish = async (job, result) => (await service(`
    select public.bty_finish_teams_reminder($1,$2,$3) as ok
  `, [job.id, job.claim_token, result])).rows[0].ok;
  const evidence = (announcement, person, action, response = null) => service(`
    select * from public.bty_record_announcement_evidence($1,$2,$3,$4)
  `, [announcement, person.user, action, response]);

  await pool.query(`
    insert into public.bty_action_captures (user_id, source_type, external_key, source_metadata, saved_at)
    values ($1, 'teams_message', 'old-save', $2, clock_timestamp() - interval '3 days')
  `, [host.user, source("old-save")]);
  await track("old-track", "acknowledgment");
  const sql = await migration(reminderMigration);
  await pool.query(sql);
  await pool.query(sql);

  await t.test("no backfill, idempotent migration, and server-only RPC access", async () => {
    assert.equal((await pool.query("select count(*)::int n from bty_reminder_private.jobs")).rows[0].n, 0);
    for (const role of ["anon", "authenticated"]) {
      await assert.rejects(asRole(role, "select * from public.bty_claim_due_teams_reminders(1)"), { code: "42501" });
      await assert.rejects(asRole(role, "select public.bty_start_teams_reminder(null,null)"), { code: "42501" });
      await assert.rejects(asRole(role, "select public.bty_finish_teams_reminder(null,null,'sent')"), { code: "42501" });
    }
    await assert.rejects(service("select * from bty_reminder_private.jobs"), { code: "42501" });
    assert.deepEqual(await claim(), []);
  });

  await t.test("Save waits 24 hours and repeated, web and invalid-identity saves cannot enqueue duplicates", async () => {
    const saved = await save("save");
    await service("update public.bty_action_captures set saved_at = saved_at where id = $1", [saved.id]);
    assert.equal((await jobs(saved.id)).length, 1);
    assert.deepEqual(await jobs((await save("web-save", null)).id), []);
    assert.deepEqual(await jobs((await save("invalid-actor", first.oid)).id), []);
    const [job] = await jobs(saved.id);
    const delaySeconds = (job.available_at - job.created_at) / 1000;
    assert(delaySeconds >= 86400 && delaySeconds < 86401);
    assert.deepEqual(await claim(), []);
  });

  await t.test("Remove after claim and re-save preserve Save history and cancel only the old job", async () => {
    const saved = await save("resave");
    await forceDue(saved.id);
    const [old] = await claim();
    assert.equal(old.subject_id, saved.id);
    await service("update public.bty_action_captures set saved_removed_at = clock_timestamp() where id = $1", [saved.id]);
    assert.equal(await start(old), false);
    const { rows: [restored] } = await service(`
      update public.bty_action_captures set saved_removed_at = null, teams_reminder_actor_oid = $2 where id = $1
      returning saved_at
    `, [saved.id, host.oid]);
    assert.deepEqual(restored.saved_at, saved.saved_at);
    const [past, pending] = await jobs(saved.id);
    assert.equal(past.state, "skipped");
    assert.equal(pending.state, "pending");
    assert.notEqual(past.id, pending.id);
    assert.deepEqual(await claim(), []);
    await service("update public.bty_action_captures set status = 'promoted', promoted_at = now() where id = $1", [saved.id]);
    assert.deepEqual((await jobs(saved.id)).map((job) => job.state), ["skipped", "skipped"]);
  });

  await t.test("Track queues frozen recipients and one owner only after modern Track commits", async () => {
    const tracked = await track("track", "acknowledgment", [first, second, first, host]);
    assert.equal(tracked.resolved_count, 2);
    assert.equal((await track("track", "acknowledgment", [first])).already_existed, true);
    const batch = await jobs(tracked.announcement_id);
    assert.deepEqual(batch.map((job) => [job.kind, job.tenant_id, job.aad_object_id]).sort(), [
      ["track_owner", tenant, host.oid],
      ["track_recipient", tenant, first.oid],
      ["track_recipient", tenant, second.oid],
    ]);
    const { rows: [capture] } = await pool.query(`
      select source_capture_id from public.bty_tracked_announcements where id = $1
    `, [tracked.announcement_id]);
    assert.deepEqual(await jobs(capture.source_capture_id), []);

    await evidence(tracked.announcement_id, first, "acknowledge");
    await service("update public.bty_tracked_announcement_recipients set notified_at = now() where announcement_id = $1", [tracked.announcement_id]);
    const initial = (await service(`
      select notified_at from public.bty_tracked_announcement_recipients where announcement_id = $1 order by id
    `, [tracked.announcement_id])).rows;
    await forceDue(tracked.announcement_id);
    const due = await claim();
    assert.deepEqual(due.map((job) => job.aad_object_id).sort(), [host.oid, second.oid]);
    await evidence(tracked.announcement_id, second, "acknowledge");
    for (const job of due) {
      assert.equal(await start(job), false);
      assert.equal(await finish(job, "skipped"), true);
    }
    assert.deepEqual((await service(`
      select notified_at from public.bty_tracked_announcement_recipients where announcement_id = $1 order by id
    `, [tracked.announcement_id])).rows, initial);
  });

  await t.test("response mode ignores open/legacy evidence, while closed and changed identities are skipped", async () => {
    const open = await track("response", "response");
    await evidence(open.announcement_id, first, "open");
    await service(`
      update public.bty_tracked_announcement_recipients set responded_at = now(), response = 'ACKNOWLEDGED'
      where announcement_id = $1
    `, [open.announcement_id]);
    await forceDue(open.announcement_id);
    const due = await claim();
    assert.equal(due.length, 2);
    await service("update public.bty_tracked_announcements set status='closed', closed_at=now() where id=$1", [open.announcement_id]);
    for (const job of due) {
      assert.equal(await start(job), false);
      assert.equal(await finish(job, "skipped"), true);
    }
    const complete = await track("written-response", "response");
    await evidence(complete.announcement_id, first, "respond", "Synthetic written response");
    await forceDue(complete.announcement_id);
    assert.deepEqual(await claim(), []);
    const banned = await save("banned");
    await pool.query("update auth.users set banned_until = now() + interval '1 day' where id = $1", [host.user]);
    await forceDue(banned.id);
    assert.deepEqual(await claim(), []);
    assert.equal((await jobs(banned.id))[0].state, "skipped");
    await pool.query("update auth.users set banned_until = null where id = $1", [host.user]);
  });

  await t.test("parallel claims and send starts do not overlap, and marked or ambiguous sends are not reclaimed", async () => {
    const one = await save("concurrent-one");
    const two = await save("concurrent-two");
    for (const saved of [one, two]) await forceDue(saved.id);
    const due = (await Promise.all([claim(2), claim(2)])).flat();
    assert.equal(due.length, 2);
    assert.equal(new Set(due.map((job) => job.id)).size, 2);
    assert.deepEqual((await Promise.all([start(due[0]), start(due[0])])).sort(), [false, true]);
    assert.equal(await start(due[1]), true);
    assert.equal(await finish(due[0], "unknown"), true);
    await pool.query("update bty_reminder_private.jobs set lease_until = now() - interval '1 second' where id = $1", [due[1].id]);
    assert.deepEqual(await claim(), []);
    assert.equal(await finish(due[1], "sent"), false);
    for (const saved of [one, two]) assert.equal((await jobs(saved.id))[0].state, "unknown");

    const confirmed = await save("confirmed");
    await forceDue(confirmed.id);
    const [sent] = await claim();
    assert.equal(await start(sent), true);
    assert.equal(await finish(sent, "sent"), true);
    assert.equal(await finish(sent, "sent"), false);
    assert.deepEqual(await claim(), []);
  });

  await t.test("pre-send crashes are reclaimable and definite retries are bounded", async () => {
    const saved = await save("retry");
    await forceDue(saved.id);
    const [expired] = await claim();
    assert.equal(await finish(expired, "sent"), false);
    await pool.query("update bty_reminder_private.jobs set lease_until = now() - interval '1 second' where id = $1", [expired.id]);
    const [reclaimed] = await claim();
    assert.notEqual(reclaimed.claim_token, expired.claim_token);
    assert.equal(await start(expired), false);
    assert.equal(await start(reclaimed), true);
    assert.equal(await finish(reclaimed, "retry"), true);
    assert.deepEqual(await claim(), []);
    for (const attempt of [3, 4]) {
      await forceDue(saved.id);
      const [next] = await claim();
      assert.equal(await finish(next, "retry"), true);
      assert.equal((await jobs(saved.id))[0].attempts, attempt);
    }
    await forceDue(saved.id);
    assert.deepEqual(await claim(), []);
    assert.equal((await jobs(saved.id))[0].state, "failed");
  });

  await t.test("retained orphan Track history never delivers to a read-only recipient", async () => {
    const tracked = await track("orphan", "response");
    await forceDue(tracked.announcement_id);
    const due = await claim();
    assert.equal(due.length, 2);
    await pool.query("delete from auth.users where id = $1", [host.user]);
    const { rows: [retained] } = await pool.query(`
      select status, owner_user_id from public.bty_tracked_announcements where id = $1
    `, [tracked.announcement_id]);
    assert.deepEqual(retained, { status: "active", owner_user_id: null });
    for (const job of due) assert.equal(await start(job), false);
    const [remaining] = await jobs(tracked.announcement_id);
    await pool.query("update bty_reminder_private.jobs set lease_until = now() - interval '1 second' where id = $1", [remaining.id]);
    assert.deepEqual(await claim(), []);
    assert.equal((await jobs(tracked.announcement_id))[0].state, "skipped");
  });
});
