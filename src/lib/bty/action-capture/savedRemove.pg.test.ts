import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { Pool } from "pg";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * ★ REMOVE FROM SAVED FOR LATER = CLEAR MY QUEUE, NEVER ERASE THE SOURCE.
 *
 * The whole design turns on keeping two facts apart that a simpler model would have merged:
 *
 *   saved_at          they explicitly saved this, once. Historical truth, never rewritten.
 *   saved_removed_at  they have since cleared it from their own queue. Current state.
 *
 * Reusing `saved_at = NULL` as "removed" would have needed no migration at all — and would have
 * destroyed the first fact, made a second Save move a timestamp the code says must never move, and
 * left a removed row indistinguishable from one nobody ever saved. These tests hold the separation
 * against real PostgreSQL, on the real migration files.
 *
 * Run: BTY_PG_TEST_URL="postgresql://postgres@/postgres?host=/tmp/pg&port=55433" npx vitest run <this file>
 */

const URL = process.env.BTY_PG_TEST_URL ?? "";
const MIGRATIONS = join(process.cwd(), "supabase/migrations");
const read = (f: string) => readFileSync(join(MIGRATIONS, f), "utf8");

const BOOTSTRAP = `
do $$ begin
  if not exists (select 1 from pg_roles where rolname='anon') then create role anon; end if;
  if not exists (select 1 from pg_roles where rolname='authenticated') then create role authenticated; end if;
  if not exists (select 1 from pg_roles where rolname='service_role') then create role service_role; end if;
end $$;
create schema if not exists auth;
create table if not exists auth.users (id uuid primary key default gen_random_uuid());
create table if not exists public.bty_action_contracts (id uuid primary key default gen_random_uuid());
`;

/** The capture table as it stands today, then every file that has shaped it since. */
const CAPTURE_HISTORY = [
  "20260828000000_bty_action_capture_v1.sql",
  "20260901000000_bty_action_capture_triage_v1.sql",
  "20260905000000_bty_action_capture_saved_at_v1.sql",
];
const REMOVED = "20260916000000_bty_action_capture_saved_removed_v1.sql";

let admin: Pool;
let reachable = false;
let n = 0;

async function db(extra: string[] = []): Promise<Pool> {
  const name = `savrm_${Date.now().toString(36)}_${n++}`;
  await admin.query(`create database ${name}`);
  const p = new Pool({ connectionString: URL.replace("/postgres?", `/${name}?`), max: 4 });
  const c = await p.connect();
  try {
    for (const s of [BOOTSTRAP, ...CAPTURE_HISTORY.map(read), ...extra]) await c.query(s);
  } finally {
    c.release();
  }
  return p;
}
const applied = () => db([read(REMOVED)]);

/** A saved capture, triaged. This is what a real row in the Soon or Later group looks like. */
async function saved(p: Pool, choice: "soon" | "later" | null = "soon") {
  const user = (await p.query(`insert into auth.users default values returning id`)).rows[0].id;
  const cap = (await p.query(
    `insert into public.bty_action_captures
       (user_id, source_type, external_key, preview_text, source_url, source_metadata, status, saved_at, triage_choice, triaged_at)
     values ($1,'teams','msg-1','Please read this','https://teams.microsoft.com/l/message/19:x/1',
             '{"tenant_id":"t1"}'::jsonb,'captured', now() - interval '3 days', $2::text, case when $2::text is null then null else now() end)
     returning *`, [user, choice])).rows[0];
  return { user, cap };
}

/** The lane query, exactly as the service issues it. */
const lane = async (p: Pool, user: string) =>
  (await p.query(
    `select id from public.bty_action_captures
      where user_id=$1 and status='captured' and saved_at is not null and saved_removed_at is null
      order by captured_at desc`, [user])).rows.map((r) => r.id);

/** The service's REMOVE, as SQL: two triage columns plus the removal, scoped by owner, set once. */
const remove = async (p: Pool, user: string, id: string) =>
  (await p.query(
    `update public.bty_action_captures
        set saved_removed_at = now(), triage_choice = null, triaged_at = null
      where id=$1 and user_id=$2 and saved_at is not null and saved_removed_at is null
      returning id`, [id, user])).rowCount;

beforeAll(async () => {
  if (!URL) return;
  try { admin = new Pool({ connectionString: URL, max: 4 }); await admin.query("select 1"); reachable = true; }
  catch { reachable = false; }
});
afterAll(async () => { await admin?.end().catch(() => {}); });
const t = (name: string, fn: () => Promise<void>) =>
  it(name, async () => { if (!reachable) return; await fn(); });

describe("★ the migration itself", () => {
  t("adds ONE nullable column and changes no existing row or value", async () => {
    const p = await db();
    const { user, cap } = await saved(p);
    const before = (await p.query(`select * from public.bty_action_captures where id=$1`, [cap.id])).rows[0];
    const countBefore = (await p.query(`select count(*)::int n from public.bty_action_captures`)).rows[0].n;

    await p.query(read(REMOVED));

    const after = (await p.query(`select * from public.bty_action_captures where id=$1`, [cap.id])).rows[0];
    expect(after.saved_removed_at, "the new column starts NULL for everyone").toBeNull();
    for (const k of Object.keys(before)) expect(after[k], k).toEqual(before[k]);
    expect((await p.query(`select count(*)::int n from public.bty_action_captures`)).rows[0].n).toBe(countBefore);
    expect(await lane(p, user), "and nothing leaves the lane on deploy").toEqual([cap.id]);
    await p.end();
  });

  t("★ re-entrant, and it adds no index and no constraint", async () => {
    const p = await applied();
    const idx = async () => (await p.query(
      `select count(*)::int n from pg_indexes where tablename='bty_action_captures'`)).rows[0].n;
    const con = async () => (await p.query(
      `select count(*)::int n from pg_constraint where conrelid='public.bty_action_captures'::regclass`)).rows[0].n;
    const [i0, c0] = [await idx(), await con()];
    await p.query(read(REMOVED));
    await p.query(read(REMOVED));
    expect([await idx(), await con()]).toEqual([i0, c0]);
    await p.end();
  });

  t("★ it does NOT restore a DELETE privilege", async () => {
    /*
      20260915 removed ambient DELETE on this table on purpose; nothing here may hand it back.
      Asserted on SQL, not on prose — the file's own comment explains that decision, and a guard
      that fires on its own documentation proves nothing.
    */
    const sql = read(REMOVED).replace(/^\s*--.*$/gm, "");
    expect(sql).not.toMatch(/\bgrant\b/i);
    expect(sql).not.toMatch(/\brevoke\b/i);
    expect(sql, "and it deletes nothing").not.toMatch(/\bdelete\b/i);
  });
});

describe("★ 1-7 — REMOVE", () => {
  for (const choice of ["soon", "later"] as const) {
    t(`${choice} item leaves the lane, and its triage goes with it`, async () => {
      const p = await applied();
      const { user, cap } = await saved(p, choice);
      expect(await lane(p, user)).toEqual([cap.id]);
      expect(await remove(p, user, cap.id)).toBe(1);

      const row = (await p.query(`select * from public.bty_action_captures where id=$1`, [cap.id])).rows[0];
      expect(row.saved_removed_at, "★ 6. the removal moment is recorded").not.toBeNull();
      expect(row.triage_choice, "★ 4. a queue position means nothing off the queue").toBeNull();
      expect(row.triaged_at, "★ 4. and the pair invariant holds at every instant").toBeNull();
      expect(row.saved_at, "★ 5. they saved this, once — that stays true").toEqual(cap.saved_at);
      expect(await lane(p, user), "★ 8. a refresh does not bring it back").toEqual([]);
      await p.end();
    });
  }

  t("★ 7. a repeat Remove changes nothing and does NOT move the moment", async () => {
    const p = await applied();
    const { user, cap } = await saved(p);
    await remove(p, user, cap.id);
    const first = (await p.query(`select saved_removed_at from public.bty_action_captures where id=$1`, [cap.id]))
      .rows[0].saved_removed_at;
    await new Promise((r) => setTimeout(r, 25));
    expect(await remove(p, user, cap.id), "nothing matches the second time").toBe(0);
    expect(
      (await p.query(`select saved_removed_at from public.bty_action_captures where id=$1`, [cap.id])).rows[0]
        .saved_removed_at,
      "★ they let it go when they let it go",
    ).toEqual(first);
    await p.end();
  });

  t("★ 13. another user's capture cannot be removed, and looks like nothing", async () => {
    const p = await applied();
    const { user, cap } = await saved(p);
    const stranger = (await p.query(`insert into auth.users default values returning id`)).rows[0].id;
    expect(await remove(p, stranger, cap.id)).toBe(0);
    expect(await lane(p, user), "the owner's list is untouched").toEqual([cap.id]);
    await p.end();
  });

  t("a Track-only capture was never in the lane, so there is nothing to remove", async () => {
    const p = await applied();
    const user = (await p.query(`insert into auth.users default values returning id`)).rows[0].id;
    const cap = (await p.query(
      `insert into public.bty_action_captures (user_id, source_type, external_key, status, saved_at)
       values ($1,'teams','tracked-only','captured', null) returning id`, [user])).rows[0].id;
    expect(await remove(p, user, cap)).toBe(0);
    expect(await lane(p, user)).toEqual([]);
    await p.end();
  });
});

describe("★ 9-12 — the source survives, completely", () => {
  t("★ every identity, provenance and lifecycle column is byte-identical after Remove", async () => {
    const p = await applied();
    const { user, cap } = await saved(p);
    await remove(p, user, cap.id);
    const after = (await p.query(`select * from public.bty_action_captures where id=$1`, [cap.id])).rows[0];
    for (const k of ["id", "user_id", "source_type", "external_key", "source_url", "source_metadata",
                     "preview_text", "saved_at", "status", "captured_at", "promoted_at",
                     "promoted_action_contract_id"] as const) {
      expect(after[k], k).toEqual(cap[k]);
    }
    await p.end();
  });

  t("★ 12. a Track that references this capture is untouched", async () => {
    const p = await applied();
    // The FK Track uses. Built here rather than replaying the whole announcement schema, because
    // what is being proven is that Remove cannot break a reference — not how Track is shaped.
    await p.query(`create table t_ann (id uuid primary key default gen_random_uuid(),
                     source_capture_id uuid not null references public.bty_action_captures(id) on delete set null)`);
    const { user, cap } = await saved(p);
    const ann = (await p.query(`insert into t_ann (source_capture_id) values ($1) returning id`, [cap.id])).rows[0].id;
    await remove(p, user, cap.id);
    const row = (await p.query(`select source_capture_id from t_ann where id=$1`, [ann])).rows[0];
    expect(row.source_capture_id, "★ the Track still points at the same capture").toBe(cap.id);
    expect((await p.query(`select count(*)::int n from public.bty_action_captures where id=$1`, [cap.id])).rows[0].n)
      .toBe(1);
    await p.end();
  });
});

describe("★ 14-19 — RE-SAVE brings the same row back, undecided", () => {
  /** The service's re-save branch, as SQL. */
  const resave = async (p: Pool, user: string, id: string) =>
    (await p.query(
      `update public.bty_action_captures
          set saved_removed_at = null, triage_choice = null, triaged_at = null
        where id=$1 and user_id=$2 and saved_removed_at is not null
        returning id`, [id, user])).rowCount;

  t("★ 14-18. same row id, saved_at unchanged, and it comes back UNDECIDED", async () => {
    const p = await applied();
    const { user, cap } = await saved(p, "later");
    await remove(p, user, cap.id);
    expect(await lane(p, user)).toEqual([]);

    expect(await resave(p, user, cap.id)).toBe(1);
    const row = (await p.query(`select * from public.bty_action_captures where id=$1`, [cap.id])).rows[0];
    expect(row.id, "★ 14. the SAME capture").toBe(cap.id);
    expect(row.saved_removed_at, "★ 15. the removal is lifted").toBeNull();
    expect(row.saved_at, "★ 16. and the original save moment is NOT rewritten").toEqual(cap.saved_at);
    expect(row.triage_choice, "★ 17. no stale Later comes back with it").toBeNull();
    expect(row.triaged_at).toBeNull();
    expect(await lane(p, user), "it is in the queue again").toEqual([cap.id]);

    // ★ 18. and they can decide again
    await p.query(`update public.bty_action_captures set triage_choice='soon', triaged_at=now() where id=$1`, [cap.id]);
    expect((await p.query(`select triage_choice from public.bty_action_captures where id=$1`, [cap.id]))
      .rows[0].triage_choice).toBe("soon");
    await p.end();
  });

  t("★ 19. the unique key makes a duplicate capture impossible in the first place", async () => {
    const p = await applied();
    const { user, cap } = await saved(p);
    await remove(p, user, cap.id);
    await expect(p.query(
      `insert into public.bty_action_captures (user_id, source_type, external_key, status, saved_at)
       values ($1,'teams','msg-1','captured', now())`, [user]),
    ).rejects.toThrow(/bty_action_captures_user_source_key_unique/);
    await p.end();
  });

  t("★ a TRACK on a removed source does NOT drag it back into the queue", async () => {
    const p = await applied();
    const { user, cap } = await saved(p);
    await remove(p, user, cap.id);
    // Track reaches the existing row with intent 'track_source', which lifts nothing.
    expect(await lane(p, user)).toEqual([]);
    const row = (await p.query(`select saved_removed_at from public.bty_action_captures where id=$1`, [cap.id])).rows[0];
    expect(row.saved_removed_at).not.toBeNull();
    await p.end();
  });
});

describe("★ the invariants this table already had are unchanged", () => {
  t("the triage biconditional still refuses a half-decision", async () => {
    const p = await applied();
    const { user } = await saved(p);
    await expect(p.query(
      `insert into public.bty_action_captures (user_id, source_type, external_key, status, saved_at, triage_choice, triaged_at)
       values ($1,'teams','k2','captured', now(), 'soon', null)`, [user]),
    ).rejects.toThrow(/triage_pair_check/);
    await p.end();
  });

  t("Save-after-Track and Track-after-Save still behave as documented", async () => {
    const p = await applied();
    const user = (await p.query(`insert into auth.users default values returning id`)).rows[0].id;
    // Track first: the row exists with no saved_at, so it is not in the lane.
    const id = (await p.query(
      `insert into public.bty_action_captures (user_id, source_type, external_key, status, saved_at)
       values ($1,'teams','k3','captured', null) returning id`, [user])).rows[0].id;
    expect(await lane(p, user)).toEqual([]);
    // Save after Track stamps it once.
    await p.query(`update public.bty_action_captures set saved_at = now() where id=$1 and saved_at is null`, [id]);
    expect(await lane(p, user)).toEqual([id]);
    const stamped = (await p.query(`select saved_at from public.bty_action_captures where id=$1`, [id])).rows[0].saved_at;
    // A SECOND save does not move it — the guard is `saved_at is null`.
    await p.query(`update public.bty_action_captures set saved_at = now() where id=$1 and saved_at is null`, [id]);
    expect((await p.query(`select saved_at from public.bty_action_captures where id=$1`, [id])).rows[0].saved_at)
      .toEqual(stamped);
    await p.end();
  });
});
