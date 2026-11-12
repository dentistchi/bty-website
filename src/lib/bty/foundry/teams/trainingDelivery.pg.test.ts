import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { setTimeout } from "node:timers/promises";
import { Client } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const database = "bty_teams_training_claim_qa";
const port = "55473";
const databaseUrl = process.env.BTY_TEAMS_TRAINING_PG_TEST_URL;
const migration = "20261112173900_foundry_teams_training_delivery_claim.sql";
const claimSignature = "public.claim_foundry_teams_training_delivery(uuid,uuid,uuid,uuid,text,text,text)";
const joinSignature = "public.join_foundry_teams_training(uuid,uuid,uuid,uuid,text)";
const claimSql = "select public.claim_foundry_teams_training_delivery($1,$2,$3,$4,$5,$6,$7) as result";
const joinSql = "select public.join_foundry_teams_training($1,$2,$3,$4,$5) as result";

function requireDisposableUrl(value: string | undefined): string {
  if (!value) throw new Error("BTY_TEAMS_TRAINING_PG_TEST_URL is required");
  const url = new URL(value);
  if (!["postgres:", "postgresql:"].includes(url.protocol) || url.hostname !== "127.0.0.1"
    || url.port !== port || url.pathname !== `/${database}` || url.search || url.hash) {
    throw new Error("Expected the dedicated Teams training database on 127.0.0.1:55473");
  }
  return url.href;
}

it("refuses database targets other than the dedicated literal loopback database", () => {
  const target = `postgresql://postgres@127.0.0.1:${port}/${database}`;
  expect(requireDisposableUrl(target)).toBe(target);
  for (const url of [
    undefined, target.replace("127.0.0.1", "localhost"), target.replace("127.0.0.1", "db.example.com"),
    target.replace(port, "5432"), target.replace(database, "postgres"), `${target}?host=db.example.com`, `${target}#other`,
  ]) expect(() => requireDisposableUrl(url)).toThrow();
});

describe.runIf(Boolean(databaseUrl))("Teams training claim and admission on native PostgreSQL", () => {
  const clients: Client[] = [];
  const uuid = (group: number, id: number) =>
    `${group}0000000-0000-4000-8000-${String(id).padStart(12, "0")}`;
  const host = uuid(1, 1);
  const foreignHost = uuid(1, 2);
  const tenant = uuid(3, 1);
  const member = uuid(4, 1);
  let admin: Client;
  let owner: Client;
  let recipient: Client;
  let competitor: Client;

  async function connect(name: string) {
    const client = new Client({
      connectionString: requireDisposableUrl(databaseUrl),
      application_name: `teams-training-qa-${name}`,
      connectionTimeoutMillis: 5000,
      statement_timeout: 10000,
    });
    clients.push(client);
    await client.connect();
    const { rows } = await client.query("select current_database() as db, host(inet_server_addr()) as host, inet_server_port() as port");
    expect(rows[0]).toEqual({ db: database, host: "127.0.0.1", port: Number(port) });
    return client;
  }

  const readMigration = (name: string) => readFile(join(process.cwd(), "supabase", "migrations", name), "utf8");

  beforeAll(async () => {
    admin = await connect("admin");
    const { rows } = await admin.query(`
      select
        exists(select 1 from pg_catalog.pg_namespace where nspname = 'auth')
        or exists(select 1 from pg_catalog.pg_class where relnamespace = 'public'::regnamespace)
        or exists(select 1 from pg_catalog.pg_proc where pronamespace = 'public'::regnamespace)
        as occupied
    `);
    expect(rows[0].occupied, "The dedicated test database must start empty").toBe(false);
    await admin.query(`
      do $$ begin
        if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon; end if;
        if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated; end if;
        if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role bypassrls; end if;
      end $$;
      create schema auth;
      create table auth.users (id uuid primary key);
      create function auth.uid() returns uuid language sql as 'select null::uuid';
      create table public.bty_teams_conversation_refs (tenant_id text, service_url text);
      create table public.bty_tracked_announcements (tenant_id text, service_url text);
      alter default privileges in schema public grant all on tables to service_role;
    `);
    for (const name of [
      "20260714000000_foundry_event_rooms_v1.sql",
      "20260825000000_foundry_participant_account_edge_v1.sql",
      "20260925000000_teams_chat_native_training_v1.sql",
    ]) await admin.query(await readMigration(name));
    await admin.query("insert into auth.users values ($1), ($2)", [host, foreignHost]);
    await seedEvent(uuid(2, 1));
    await admin.query(`
      insert into public.foundry_teams_training_deliveries
        (id, event_id, owner_user_id_snapshot, tenant_id, aad_object_id, service_url, conversation_id, delivery_status)
      values
        ($1,$2,$3,$4,$5,'https://example.test','original','PENDING'),
        ($6,$2,$3,$4,$7,'https://example.test','original','UNDELIVERABLE')
    `, [uuid(5, 1), uuid(2, 1), host, tenant, uuid(4, 2), uuid(5, 2), uuid(4, 3)]);
    const sql = await readMigration(migration);
    await admin.query(sql);
    await admin.query(sql);

    owner = await connect("owner");
    recipient = await connect("recipient");
    competitor = await connect("competitor");
    for (const client of [owner, recipient, competitor]) await client.query("set role service_role");
  }, 30000);

  afterAll(async () => {
    await Promise.allSettled(clients.map((client) => client.end()));
  });

  async function seedEvent(event: string) {
    await admin.query("insert into public.foundry_events (id, owner_user_id, title) values ($1,$2,'Training')", [event, host]);
  }

  async function claim(client: Client, event: string, aadObjectId = member, ownerId = host) {
    const { rows } = await client.query(claimSql, [event, ownerId, tenant, aadObjectId, "Member", "https://example.test", "conv"]);
    return rows[0].result;
  }

  async function joinTraining(client: Client, event: string, label = "Member", userId: string | null = null) {
    const { rows } = await client.query(joinSql, [event, tenant, member, userId, label]);
    return rows[0].result;
  }

  async function waitForLock(name: string) {
    for (let attempt = 0; attempt < 80; attempt++) {
      const { rows } = await admin.query("select wait_event_type from pg_stat_activity where application_name = $1", [`teams-training-qa-${name}`]);
      if (rows[0]?.wait_event_type === "Lock") return;
      await setTimeout(25);
    }
    throw new Error(`Expected ${name} to wait for a database lock`);
  }

  it("restricts both RPCs to the service role and preserves legacy pending rows on migration replay", async () => {
    for (const signature of [claimSignature, joinSignature]) {
      const { rows } = await admin.query(`
        select has_function_privilege('anon', $1, 'execute') as anon,
          has_function_privilege('authenticated', $1, 'execute') as authenticated,
          has_function_privilege('service_role', $1, 'execute') as service_role
      `, [signature]);
      expect(rows[0]).toEqual({ anon: false, authenticated: false, service_role: true });
    }
    const event = uuid(2, 1);
    expect(await claim(owner, event, member, foreignHost)).toEqual({ state: "not_owner" });
    expect(await claim(owner, event, uuid(4, 2))).toEqual({ state: "pending" });
    const { rows } = await admin.query("select delivery_status, conversation_id from public.foundry_teams_training_deliveries where id = $1", [uuid(5, 1)]);
    expect(rows[0]).toEqual({ delivery_status: "PENDING", conversation_id: "original" });
  });

  it("reuses a known failed delivery ID once and reports a delivered row without reclaiming it", async () => {
    const event = uuid(2, 1);
    expect(await claim(owner, event, uuid(4, 3))).toEqual({ state: "claimed", deliveryId: uuid(5, 2) });
    await owner.query("update public.foundry_teams_training_deliveries set delivery_status = 'DELIVERED', delivered_at = now() where id = $1", [uuid(5, 2)]);
    expect(await claim(owner, event, uuid(4, 3))).toEqual({ state: "already_sent" });
  });

  it("restores the same participant after closure and keeps removed participants out", async () => {
    const event = uuid(2, 2);
    await seedEvent(event);
    const first = await joinTraining(recipient, event);
    expect(first).toMatchObject({ state: "joined", participant: { display_name: "Member", user_id: null } });
    await owner.query("update public.foundry_events set status = 'closed' where id = $1", [event]);
    expect(await joinTraining(recipient, event, "Changed", host)).toEqual(first);
    await owner.query("update public.foundry_event_participants set status = 'removed' where id = $1", [first.participant.id]);
    expect(await joinTraining(recipient, event)).toEqual({ state: "removed" });
  });

  it("serializes simultaneous claims on the same recipient so only one may send", async () => {
    const event = uuid(2, 3);
    await seedEvent(event);
    const pending: Promise<unknown>[] = [];
    await owner.query("begin");
    try {
      expect(await claim(owner, event)).toMatchObject({ state: "claimed" });
      const second = claim(competitor, event);
      pending.push(second);
      await waitForLock("competitor");
      await owner.query("commit");
      expect(await second).toEqual({ state: "pending" });
    } finally {
      await owner.query("rollback");
      await Promise.allSettled(pending);
    }
    const { rows } = await admin.query("select count(*)::int as count from public.foundry_teams_training_deliveries where event_id = $1", [event]);
    expect(rows[0].count).toBe(1);
  });

  it("orders a concurrent close ahead of new Teams admissions and delivery claims", async () => {
    const event = uuid(2, 4);
    await seedEvent(event);
    const pending: Promise<unknown>[] = [];
    await owner.query("begin");
    try {
      await owner.query("update public.foundry_events set status = 'closed' where id = $1", [event]);
      pending.push(joinTraining(recipient, event), claim(competitor, event));
      await Promise.all([waitForLock("recipient"), waitForLock("competitor")]);
      await owner.query("commit");
      await expect(Promise.all(pending)).resolves.toEqual([{ state: "event_closed" }, { state: "event_closed" }]);
    } finally {
      await owner.query("rollback");
      await Promise.allSettled(pending);
    }
    const { rows } = await admin.query(`
      select exists(select 1 from public.foundry_event_participants where event_id = $1)
        or exists(select 1 from public.foundry_teams_training_deliveries where event_id = $1) as written
    `, [event]);
    expect(rows[0].written).toBe(false);
  });
});
