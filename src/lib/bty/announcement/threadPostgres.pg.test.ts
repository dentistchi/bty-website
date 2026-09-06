import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { Client, Pool } from "pg";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * TRACK CONVERSATION — PROOF AGAINST A REAL POSTGRESQL SERVER.
 *
 * ★ WHY THIS FILE EXISTS AND THE MODELLED SUITE IS NOT ENOUGH.
 *
 * `announcementThreadFake.testkit.ts` models the RULES faithfully enough to prove the service layer
 * scopes correctly. It cannot prove anything about PostgreSQL, because it is not PostgreSQL: it has
 * no MVCC, no snapshots, no commit ordering, and no constraint engine. The defect this slice was
 * sent back to repair — a message that commits AFTER a reader advanced a timestamp cursor being
 * permanently classified as read — is INVISIBLE to a model, by construction. Only two real
 * concurrent sessions can show it.
 *
 * ★ HOW IT IS RUN, AND WHY IT SKIPS RATHER THAN GUESSES.
 *
 * It runs only when `BTY_PG_TEST_URL` names a reachable server, so the ordinary suite is unaffected
 * on a machine with no database. That is a deliberate trade: a test that silently invents a result
 * is worse than one that says it did not run. The connection is never guessed at and never
 * defaulted to a real environment — there is no fallback URL in this file.
 *
 *     initdb -D /tmp/pg/data -U postgres --auth=trust
 *     pg_ctl -D /tmp/pg/data -o "-p 55433 -k /tmp/pg" start
 *     BTY_PG_TEST_URL="postgresql://postgres@/btythread?host=/tmp/pg&port=55433" npx vitest run \
 *       src/lib/bty/announcement/threadPostgres.pg.test.ts
 *
 * The schema is built from the REAL migration files, in order, so what is proven here is the SQL
 * that ships — not a transcription of it.
 */

const URL = process.env.BTY_PG_TEST_URL ?? "";
const MIGRATIONS = join(process.cwd(), "supabase/migrations");

/** The prerequisite Supabase objects the Track migrations reference. Nothing more. */
const BOOTSTRAP = `
do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated; end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role; end if;
end $$;
create schema if not exists auth;
create table if not exists auth.users (id uuid primary key default gen_random_uuid());
create table if not exists auth.identities (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  provider text not null,
  identity_data jsonb not null default '{}'::jsonb
);
create table if not exists public.bty_action_captures (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  preview_text text,
  source_url text
);

-- ★ THE SUPABASE CONDITION, REPRODUCED. A real Supabase project carries default
-- privileges that hand service_role EVERY table privilege the moment a table is
-- created. Without this line the harness would test a database that is strictly
-- more restrictive than production, and an ACL bug that only exists there could
-- never be seen here. Measured on the live database after 20260912 was applied.
alter default privileges in schema public grant all on tables to service_role;
`;

const ORDERED = [
  "20260902000000_bty_tracked_announcements_v1.sql",
  "20260906000000_bty_announcement_recipient_handled_v1.sql",
  "20260907000000_bty_announcement_service_url_v1.sql",
  "20260911000000_bty_bind_recipients_on_canonical_entry_v1.sql",
];

/**
 * ★ RECONCILE REPO HISTORY TO PRODUCTION TRUTH BEFORE APPLYING 20260912.
 *
 * Repo migration 20260907 declares `bty_track_announcement(..., p_recipient_oids text[],
 * p_service_url text default null)`. PRODUCTION carries the other order:
 * `(..., p_service_url text, p_recipient_oids text[])`. The migration history and the live database
 * have DIVERGED, and 20260912's fail-closed gate refuses to run against a shape that is not
 * production's -- correctly, because `create or replace` would otherwise add a second overload and
 * make every Track call ambiguous.
 *
 * So this file, which otherwise reproduces the repo's history faithfully, replaces that one function
 * with production's before continuing. Without this step the tests below would be proving behaviour
 * on a schema that does not exist anywhere. The signature itself is proven in
 * `trackSignatureLive.pg.test.ts`.
 */
const RECONCILE_TO_PRODUCTION = `
drop function if exists public.bty_track_announcement(uuid, uuid, text, text, text, text[], text);
create or replace function public.bty_track_announcement(
  p_owner_user_id uuid,
  p_source_capture_id uuid,
  p_host_framing text,
  p_tenant_id text,
  p_conversation_id text,
  p_service_url text,
  p_recipient_oids text[]
)
returns table (announcement_id uuid, resolved_count integer, already_existed boolean)
language plpgsql
security definer
set search_path = pg_catalog, public
as $fn$
begin
  return query select null::uuid, 0, false;
end;
$fn$;
revoke all on function public.bty_track_announcement(uuid, uuid, text, text, text, text, text[]) from public, anon, authenticated;
grant execute on function public.bty_track_announcement(uuid, uuid, text, text, text, text, text[]) to service_role;
`;

const THREAD_MIGRATION = "20260912000000_bty_announcement_thread_v1.sql";

let pool: Pool;
let reachable = false;

beforeAll(async () => {
  if (!URL) return;
  try {
    pool = new Pool({ connectionString: URL, max: 8 });
    const c = await pool.connect();
    await c.query(BOOTSTRAP);
    for (const f of ORDERED) await c.query(readFileSync(join(MIGRATIONS, f), "utf8"));
    await c.query(RECONCILE_TO_PRODUCTION);
    await c.query(readFileSync(join(MIGRATIONS, THREAD_MIGRATION), "utf8"));
    c.release();
    reachable = true;
  } catch (e) {
    // Reported, never swallowed: a skipped proof must say why it was skipped.
    console.error("[pg] unreachable, tests will skip:", (e as Error).message);
  }
}, 60_000);

afterAll(async () => {
  await pool?.end();
});

/** Skips the whole file when no server was named. `describe.runIf` keeps the reason visible. */
const pg = describe.runIf(!!URL);

type Scenario = { host: string; recipA: string; recipB: string; rowA: string; rowB: string; annId: string };

async function seed(): Promise<Scenario> {
  const q = async (s: string, v: unknown[] = []) => (await pool.query(s, v)).rows;
  const [{ id: host }] = await q("insert into auth.users default values returning id");
  const [{ id: recipA }] = await q("insert into auth.users default values returning id");
  const [{ id: recipB }] = await q("insert into auth.users default values returning id");
  const [{ id: cap }] = await q("insert into public.bty_action_captures (user_id) values ($1) returning id", [host]);
  const [{ id: annId }] = await q(
    `insert into public.bty_tracked_announcements
       (owner_user_id, source_capture_id, host_framing, resolved_count, tenant_id, conversation_id)
     values ($1,$2,'Please read the new intake steps.',2,'t1','c1') returning id`,
    [host, cap],
  );
  const [{ id: rowA }] = await q(
    `insert into public.bty_tracked_announcement_recipients
       (announcement_id, tenant_id, aad_object_id, user_id, bound_at)
     values ($1,'t1','11111111-1111-1111-1111-111111111111',$2, now()) returning id`,
    [annId, recipA],
  );
  const [{ id: rowB }] = await q(
    `insert into public.bty_tracked_announcement_recipients
       (announcement_id, tenant_id, aad_object_id, user_id, bound_at)
     values ($1,'t1','22222222-2222-2222-2222-222222222222',$2, now()) returning id`,
    [annId, recipB],
  );
  return { host, recipA, recipB, rowA, rowB, annId };
}

/** Unread, expressed exactly as the service layer expresses it. */
async function unreadFor(rowId: string, reader: string, viewer: "HOST" | "RECIPIENT"): Promise<number> {
  const other = viewer === "HOST" ? "RECIPIENT" : "HOST";
  const { rows } = await pool.query(
    `select count(*)::int as n
       from public.bty_announcement_thread_messages m
      where m.recipient_id = $1
        and m.author_role = $2
        and not exists (
          select 1 from public.bty_announcement_thread_message_reads r
           where r.message_id = m.id and r.reader_user_id = $3)`,
    [rowId, other, reader],
  );
  return rows[0].n;
}

const post = (rowId: string, actor: string, body: string, key: string | null = null) =>
  pool
    .query("select * from public.bty_post_announcement_thread_message($1,$2,$3,$4)", [rowId, actor, body, key])
    .then((r) => r.rows[0]);

const markRead = (rowId: string, actor: string) =>
  pool.query("select * from public.bty_mark_announcement_thread_read($1,$2)", [rowId, actor]).then((r) => r.rows[0]);

let S: Scenario;
beforeEach(async () => {
  if (reachable) S = await seed();
});

/* ═══════════════════ 1. THE UNREAD RACE — THE REASON THIS FILE EXISTS ═══════════════════ */

pg("★ 1 — a message that commits after a read must stay UNREAD", () => {
  it("the exact interleaving: uncommitted insert, reader marks read, insert commits", async () => {
    expect(reachable, "BTY_PG_TEST_URL must name a reachable server").toBe(true);

    // T1 — the recipient starts writing, and does not commit.
    const t1 = new Client({ connectionString: URL });
    await t1.connect();
    await t1.query("begin");
    // Its `now()` is frozen HERE, before the reader does anything at all.
    const { rows: t1rows } = await t1.query(
      `insert into public.bty_announcement_thread_messages (recipient_id, author_user_id, author_role, body)
       values ($1,$2,'RECIPIENT','the message that must not be lost') returning id, created_at`,
      [S.rowA, S.recipA],
    );
    const msgId = t1rows[0].id as string;
    const msgStamp = t1rows[0].created_at as Date;

    // T2 — the Host opens the thread. T1's row is invisible to this snapshot.
    const seen = await pool.query(
      "select count(*)::int as n from public.bty_announcement_thread_messages where recipient_id = $1",
      [S.rowA],
    );
    expect(seen.rows[0].n, "the reader's snapshot must NOT contain the uncommitted row").toBe(0);

    const cursorMoment = (await pool.query("select now() as t")).rows[0].t as Date;
    const marked = await markRead(S.rowA, S.host);
    expect(marked.role).toBe("HOST");
    expect(marked.marked, "nothing was visible, so nothing may be marked").toBe(0);

    // T1 — commits. The row lands, still stamped from before the reader looked.
    await t1.query("commit");
    await t1.end();

    // ★ THE CONTROL. The OLD timestamp-cursor model would have lost this message:
    // its created_at is strictly earlier than the cursor the reader would have stored.
    expect(
      msgStamp.getTime(),
      "precondition for the control: the message is stamped BEFORE the cursor moment",
    ).toBeLessThan(cursorMoment.getTime());

    // ★ THE PROOF. Under per-message receipts it is still unread, because no receipt
    // could be written for a row that was not in the writer's snapshot.
    const receipts = await pool.query(
      "select count(*)::int as n from public.bty_announcement_thread_message_reads where message_id = $1",
      [msgId],
    );
    expect(receipts.rows[0].n, "no receipt may exist for a message nobody could see").toBe(0);
    expect(await unreadFor(S.rowA, S.host, "HOST"), "the message MUST still be unread").toBe(1);
  }, 30_000);

  it("and a later read does pick it up — the message is not stranded, only deferred", async () => {
    await post(S.rowA, S.recipA, "hello");
    expect(await unreadFor(S.rowA, S.host, "HOST")).toBe(1);
    await markRead(S.rowA, S.host);
    expect(await unreadFor(S.rowA, S.host, "HOST")).toBe(0);
  });

  it("an author never creates unread for themselves, on either side", async () => {
    await post(S.rowA, S.recipA, "from the recipient");
    await post(S.rowA, S.host, "from the host");
    expect(await unreadFor(S.rowA, S.host, "HOST"), "host sees only the recipient's").toBe(1);
    expect(await unreadFor(S.rowA, S.recipA, "RECIPIENT"), "recipient sees only the host's").toBe(1);
  });

  it("reading marks ONLY the reader's own side", async () => {
    await post(S.rowA, S.recipA, "r1");
    await post(S.rowA, S.host, "h1");
    await markRead(S.rowA, S.host);
    expect(await unreadFor(S.rowA, S.host, "HOST")).toBe(0);
    expect(await unreadFor(S.rowA, S.recipA, "RECIPIENT"), "the host cannot read on the recipient's behalf").toBe(1);
  });

  it("marking read twice is idempotent — receipts are a primary key, not a counter", async () => {
    await post(S.rowA, S.recipA, "r1");
    expect((await markRead(S.rowA, S.host)).marked).toBe(1);
    expect((await markRead(S.rowA, S.host)).marked, "second pass writes nothing").toBe(0);
  });
});

/* ═══════════════════ 2-4. HANDLED / REOPEN / READ-IS-NOT-HANDLED ═══════════════════ */

pg("★ 2-4 — reopen on a new recipient message; reading never handles", () => {
  const handled = async (rowId: string) =>
    (await pool.query("select handled_at, handled_by_user_id from public.bty_tracked_announcement_recipients where id=$1", [rowId]))
      .rows[0];

  const respond = (annId: string, user: string, r: string, q: string | null) =>
    pool.query("select * from public.bty_respond_to_announcement($1,$2,$3,$4)", [annId, user, r, q]).then((x) => x.rows[0]);

  it("★ the full arc: handled -> new recipient message -> reopened -> read -> STILL open -> handle -> closed", async () => {
    await respond(S.annId, S.recipA, "QUESTION", "does this apply to part-time staff?");

    // Host settles it explicitly.
    const h1 = await pool.query("select * from public.bty_handle_announcement_recipient($1,$2,true)", [S.rowA, S.host]);
    expect(h1.rows[0].result).toBe("handled");
    expect((await handled(S.rowA)).handled_at).not.toBeNull();

    // The recipient says something new. Same transaction as the message.
    const posted = await post(S.rowA, S.recipA, "one more thing");
    expect(posted.result).toBe("posted");
    expect(posted.reopened, "the post itself reports the reopen").toBe(true);

    const afterReopen = await handled(S.rowA);
    expect(afterReopen.handled_at, "★ REOPENED").toBeNull();
    expect(afterReopen.handled_by_user_id).toBeNull();

    // ★ READING IS NOT RESOLVING. The Host opens it; it still needs attention.
    await markRead(S.rowA, S.host);
    expect((await handled(S.rowA)).handled_at, "reading must NOT handle").toBeNull();

    // Only the explicit action closes it.
    const h2 = await pool.query("select * from public.bty_handle_announcement_recipient($1,$2,true)", [S.rowA, S.host]);
    expect(h2.rows[0].result).toBe("handled");
    expect((await handled(S.rowA)).handled_at).not.toBeNull();
  });

  it("★ a HOST message does NOT reopen the Host's own attention", async () => {
    await respond(S.annId, S.recipA, "QUESTION", "q");
    await pool.query("select * from public.bty_handle_announcement_recipient($1,$2,true)", [S.rowA, S.host]);
    const posted = await post(S.rowA, S.host, "here is your answer");
    expect(posted.reopened).toBe(false);
    expect((await handled(S.rowA)).handled_at, "answering someone must not re-list them").not.toBeNull();
  });

  it("the reopen does NOT erase what was said", async () => {
    await respond(S.annId, S.recipA, "QUESTION", "the original question");
    await pool.query("select * from public.bty_handle_announcement_recipient($1,$2,true)", [S.rowA, S.host]);
    await post(S.rowA, S.recipA, "a follow-up");
    const r = (
      await pool.query("select response, responded_at, question_text from public.bty_tracked_announcement_recipients where id=$1", [S.rowA])
    ).rows[0];
    expect(r.response).toBe("QUESTION");
    expect(r.responded_at).not.toBeNull();
    expect(r.question_text).toBe("the original question");
    const msgs = await pool.query("select body from public.bty_announcement_thread_messages where recipient_id=$1 order by created_at, id", [S.rowA]);
    expect(msgs.rows.map((m) => m.body)).toEqual(["the original question", "a follow-up"]);
  });

  it("a duplicate (same nonce) reopens nothing — no NEW thing was said", async () => {
    await respond(S.annId, S.recipA, "QUESTION", "q");
    await post(S.rowA, S.recipA, "follow up", "nonce-1");
    await pool.query("select * from public.bty_handle_announcement_recipient($1,$2,true)", [S.rowA, S.host]);
    const dup = await post(S.rowA, S.recipA, "follow up", "nonce-1");
    expect(dup.result).toBe("duplicate");
    expect(dup.reopened).toBe(false);
    expect((await handled(S.rowA)).handled_at).not.toBeNull();
  });

  it("★ 10 — the QUESTION bridge is atomic: disposition and first message share one instant", async () => {
    const r = await respond(S.annId, S.recipA, "QUESTION", "atomic?");
    expect(r.result).toBe("responded");
    const row = (await pool.query("select responded_at from public.bty_tracked_announcement_recipients where id=$1", [S.rowA])).rows[0];
    const msg = (await pool.query("select author_role, body, created_at from public.bty_announcement_thread_messages where recipient_id=$1", [S.rowA])).rows[0];
    expect(msg.author_role).toBe("RECIPIENT");
    expect(msg.body).toBe("atomic?");
    expect(new Date(msg.created_at).getTime()).toBe(new Date(row.responded_at).getTime());
  });

  it("GOT_IT and HELP_NEEDED write no message", async () => {
    await respond(S.annId, S.recipA, "ACKNOWLEDGED", null);
    await respond(S.annId, S.recipB, "HELP_NEEDED", null);
    const n = await pool.query("select count(*)::int as n from public.bty_announcement_thread_messages where recipient_id in ($1,$2)", [S.rowA, S.rowB]);
    expect(n.rows[0].n).toBe(0);
  });
});

/* ═══════════════════ 5-6. ISOLATION ═══════════════════ */

pg("★ 5-6 — no other recipient and no other Host can read or write", () => {
  it("another recipient of the SAME announcement is refused, and creates no receipt", async () => {
    await post(S.rowA, S.recipA, "A's private worry");
    expect((await post(S.rowB, S.recipA, "trying to reach into B")).result).toBe("not_found");
    // B may not mark A's thread read either.
    const m = await markRead(S.rowA, S.recipB);
    expect(m.result).toBe("not_found");
    const receipts = await pool.query(
      `select count(*)::int as n from public.bty_announcement_thread_message_reads r
         join public.bty_announcement_thread_messages m on m.id = r.message_id
        where r.reader_user_id = $1 and m.recipient_id in ($2,$3)`,
      [S.recipB, S.rowA, S.rowB],
    );
    expect(receipts.rows[0].n).toBe(0);
  });

  it("a different Host is refused identically to a missing row", async () => {
    const [{ id: otherHost }] = (await pool.query("insert into auth.users default values returning id")).rows;
    expect((await post(S.rowA, otherHost, "let me in")).result).toBe("not_found");
    expect((await markRead(S.rowA, otherHost)).result).toBe("not_found");
    const missing = await pool.query("select * from public.bty_resolve_announcement_thread_role($1,$2)", [
      "00000000-0000-0000-0000-000000000000",
      otherHost,
    ]);
    expect(missing.rows[0].role, "a refusal and a missing row say the same word").toBe("none");
  });

  it("an UNBOUND recipient row is a party to nothing", async () => {
    const [{ id: unbound }] = (
      await pool.query(
        `insert into public.bty_tracked_announcement_recipients (announcement_id, tenant_id, aad_object_id)
         values ($1,'t1','33333333-3333-3333-3333-333333333333') returning id`,
        [S.annId],
      )
    ).rows;
    expect((await post(unbound, S.recipA, "x")).result).toBe("not_found");
  });
});

/* ═══════════════════ 7. SELF-RECIPIENT ═══════════════════ */

pg("★ 7 — a Host can never be in their own audience", () => {
  const OWNER_OID = "aaaaaaaa-0000-0000-0000-00000000aaaa";
  const OTHER_OID = "bbbbbbbb-0000-0000-0000-00000000bbbb";

  async function hostWithIdentity(oid: string): Promise<{ user: string; cap: string }> {
    const [{ id: user }] = (await pool.query("insert into auth.users default values returning id")).rows;
    await pool.query(
      `insert into auth.identities (user_id, provider, identity_data)
       values ($1,'azure', jsonb_build_object('custom_claims', jsonb_build_object('tid','t1','oid',$2::text)))`,
      [user, oid],
    );
    const [{ id: cap }] = (await pool.query("insert into public.bty_action_captures (user_id) values ($1) returning id", [user])).rows;
    return { user, cap };
  }

  /*
    NAMED arguments, deliberately — that is how PostgREST resolves this call, and a positional call
    would silently encode a parameter ORDER that this slice just proved the repo had wrong.
  */
  const track = (owner: string, cap: string, oids: string[]) =>
    pool.query(
      `select * from public.bty_track_announcement(
         p_owner_user_id := $1,
         p_source_capture_id := $2,
         p_host_framing := 'framing',
         p_tenant_id := 't1',
         p_conversation_id := 'c1',
         p_service_url := null,
         p_recipient_oids := $3)`,
      [owner, cap, oids],
    );

  it("★ the Host's own oid is dropped from a mixed selection", async () => {
    const { user, cap } = await hostWithIdentity(OWNER_OID);
    const res = await track(user, cap, [OWNER_OID, OTHER_OID]);
    expect(res.rows[0].resolved_count, "only the OTHER person is in the audience").toBe(1);
    const oids = await pool.query(
      "select aad_object_id from public.bty_tracked_announcement_recipients where announcement_id=$1",
      [res.rows[0].announcement_id],
    );
    expect(oids.rows.map((r) => r.aad_object_id)).toEqual([OTHER_OID]);
  });

  it("★ a Host who selected ONLY themselves is REFUSED — fail closed, not an empty run", async () => {
    const { user, cap } = await hostWithIdentity(OWNER_OID);
    await expect(track(user, cap, [OWNER_OID])).rejects.toThrow(/zero_recipients/);
    const n = await pool.query("select count(*)::int as n from public.bty_tracked_announcements where owner_user_id=$1", [user]);
    expect(n.rows[0].n, "nothing was created").toBe(0);
  });

  it("★ a Host with TWO Microsoft identities has BOTH excluded and is still able to Track", async () => {
    const SECOND = "cccccccc-0000-0000-0000-00000000cccc";
    const { user, cap } = await hostWithIdentity(OWNER_OID);
    await pool.query(
      `insert into auth.identities (user_id, provider, identity_data)
       values ($1,'azure', jsonb_build_object('custom_claims', jsonb_build_object('tid','t1','oid',$2::text)))`,
      [user, SECOND],
    );
    const res = await track(user, cap, [OWNER_OID, SECOND, OTHER_OID]);
    expect(res.rows[0].resolved_count).toBe(1);
  });

  it("a Host with NO Microsoft identity is unaffected — nothing is excluded", async () => {
    const [{ id: user }] = (await pool.query("insert into auth.users default values returning id")).rows;
    const [{ id: cap }] = (await pool.query("insert into public.bty_action_captures (user_id) values ($1) returning id", [user])).rows;
    const res = await track(user, cap, [OWNER_OID, OTHER_OID]);
    expect(res.rows[0].resolved_count).toBe(2);
  });

  it("the ordinary path still dedupes, still refuses a bad GUID, and still returns an existing run", async () => {
    const { user, cap } = await hostWithIdentity(OWNER_OID);
    const first = await track(user, cap, [OTHER_OID, OTHER_OID.toUpperCase(), "not-a-guid"]);
    expect(first.rows[0].resolved_count).toBe(1);
    const again = await track(user, cap, [OTHER_OID]);
    expect(again.rows[0].already_existed).toBe(true);
    expect(again.rows[0].announcement_id).toBe(first.rows[0].announcement_id);
  });
});

/* ═══════════════════ 8-9. LIFECYCLE AND APPEND-ONLY ═══════════════════ */

pg("★ 8-9 — the delete contract, and what the grants actually enforce", () => {
  it("★ 8 — deleting the author's ACCOUNT keeps the message and nulls the author", async () => {
    /*
      The FK is isolated deliberately. Neither party of a live thread can be used to test it:
      deleting the HOST cascades the announcement (owner_user_id ON DELETE CASCADE) and takes the
      whole conversation with it, and deleting a bound RECIPIENT is blocked outright by a
      pre-existing constraint conflict (next test). So the message is authored by a third account
      that owns nothing else, which is exactly the FK behaviour under test and nothing more.
    */
    const [{ id: author }] = (await pool.query("insert into auth.users default values returning id")).rows;
    await pool.query(
      `insert into public.bty_announcement_thread_messages (recipient_id, author_user_id, author_role, body)
       values ($1,$2,'HOST','words that outlive the account')`,
      [S.rowA, author],
    );

    await pool.query("delete from auth.users where id = $1", [author]);

    const m = (
      await pool.query(
        "select author_user_id, author_role, body from public.bty_announcement_thread_messages where recipient_id=$1",
        [S.rowA],
      )
    ).rows[0];
    expect(m, "the message survives — the other party is still in this conversation").toBeTruthy();
    expect(m.author_user_id, "★ SET NULL, not CASCADE").toBeNull();
    expect(m.author_role, "the historical role outlives the account link").toBe("HOST");
    expect(m.body).toBe("words that outlive the account");
  });

  it("and a read receipt DOES go when its reader's account does — it answers a question about a person", async () => {
    const [{ id: reader }] = (await pool.query("insert into auth.users default values returning id")).rows;
    const [{ id: mid }] = (
      await pool.query(
        `insert into public.bty_announcement_thread_messages (recipient_id, author_user_id, author_role, body)
         values ($1,$2,'RECIPIENT','x') returning id`,
        [S.rowA, S.recipA],
      )
    ).rows;
    await pool.query(
      "insert into public.bty_announcement_thread_message_reads (message_id, reader_user_id) values ($1,$2)",
      [mid, reader],
    );
    await pool.query("delete from auth.users where id = $1", [reader]);
    const n = await pool.query(
      "select count(*)::int as n from public.bty_announcement_thread_message_reads where message_id = $1",
      [mid],
    );
    expect(n.rows[0].n, "a receipt whose person is gone answers nothing").toBe(0);
    const msg = await pool.query("select count(*)::int as n from public.bty_announcement_thread_messages where id=$1", [mid]);
    expect(msg.rows[0].n, "the message itself is untouched").toBe(1);
  });

  it("★ 8 — FINDING: deleting a BOUND RECIPIENT's account is already impossible, before threads exist", async () => {
    /*
      ★ A PRE-EXISTING DEFECT IN 20260902, SURFACED BY THIS HARNESS AND NOT CAUSED BY THIS SLICE.

      `bty_tracked_announcement_recipients` declares BOTH:

          user_id uuid references auth.users (id) on delete set null
          check ((user_id is null) = (bound_at is null))

      They contradict each other. The FK action nulls `user_id` and leaves `bound_at` set, which is
      exactly the state the CHECK forbids — so deleting the account raises
      `bty_tracked_recip_bound_pair_check` and the delete FAILS.

      It fires in production today, with zero thread rows, and this slice neither causes nor worsens
      it: the assertion below is written against ONLY 20260902 objects. It is reported rather than
      repaired here, because altering a live constraint is its own change with its own review.

      It does mean one honest limitation: the `on delete set null` contract chosen for
      `author_user_id` is currently unreachable for a recipient-authored message, because the delete
      cannot get that far. The message table itself is correct and carries no such pair-check — the
      test above proves SET NULL works there.
    */
    await pool.query(
      `insert into public.bty_announcement_thread_messages (recipient_id, author_user_id, author_role, body)
       values ($1,$2,'RECIPIENT','irrelevant to the failure')`,
      [S.rowA, S.recipA],
    );
    await expect(pool.query("delete from auth.users where id = $1", [S.recipA])).rejects.toThrow(
      /bty_tracked_recip_bound_pair_check/,
    );
  });

  it("deleting the RECIPIENT ROW cascades the conversation away with the response it belongs to", async () => {
    await post(S.rowA, S.recipA, "x");
    await markRead(S.rowA, S.host);
    const before = await pool.query(
      `select count(*)::int as n from public.bty_announcement_thread_message_reads r
         join public.bty_announcement_thread_messages m on m.id = r.message_id
        where m.recipient_id = $1`,
      [S.rowA],
    );
    expect(before.rows[0].n, "a receipt exists to begin with").toBe(1);

    await pool.query("delete from public.bty_tracked_announcement_recipients where id=$1", [S.rowA]);

    const m = await pool.query(
      "select count(*)::int as n from public.bty_announcement_thread_messages where recipient_id=$1",
      [S.rowA],
    );
    expect(m.rows[0].n).toBe(0);
    const orphaned = await pool.query(
      `select count(*)::int as n from public.bty_announcement_thread_message_reads r
        where not exists (select 1 from public.bty_announcement_thread_messages m where m.id = r.message_id)`,
    );
    expect(orphaned.rows[0].n, "receipts cascade with their message — none is left orphaned").toBe(0);
  });

  it("★ 9 — service_role holds EXACTLY SELECT and INSERT on both tables — every other privilege is gone", async () => {
    /*
      ★ WHY THIS IS ASKED OF THE DATABASE AND NOT OF THE FILE.

      Reading `grant select, insert ... to service_role` out of the SQL proves nothing about the
      ACL that results. Supabase's default privileges grant service_role ALL on a table the instant
      it is created, so a revoke that names only anon/public/authenticated leaves UPDATE, DELETE,
      TRUNCATE, REFERENCES and TRIGGER standing and the grant below is merely additive on top of
      ALL. That is exactly what happened in production. `has_table_privilege` is the only thing that
      can tell the difference.
    */
    for (const t of ["bty_announcement_thread_messages", "bty_announcement_thread_message_reads"]) {
      const { rows } = await pool.query(
        `select
           has_table_privilege('service_role', $1, 'SELECT')     as sel,
           has_table_privilege('service_role', $1, 'INSERT')     as ins,
           has_table_privilege('service_role', $1, 'UPDATE')     as upd,
           has_table_privilege('service_role', $1, 'DELETE')     as del,
           has_table_privilege('service_role', $1, 'TRUNCATE')   as trunc,
           has_table_privilege('service_role', $1, 'REFERENCES') as refs,
           has_table_privilege('service_role', $1, 'TRIGGER')    as trig`,
        [`public.${t}`],
      );
      expect(rows[0], t).toEqual({
        sel: true,
        ins: true,
        upd: false,
        del: false,
        trunc: false,
        refs: false,
        trig: false,
      });
    }
  });

  it("★ THE NEGATIVE PROOF — a revoke that omits service_role leaves ALL of it standing", async () => {
    /*
      The defect class, demonstrated on a scratch table under the SAME default privileges. This is
      what the migration used to do, and why the file now names service_role in its revoke.
    */
    await pool.query("create table if not exists public.acl_probe (id int)");
    try {
      // The OLD pattern, verbatim.
      await pool.query("revoke all on public.acl_probe from anon, public, authenticated");
      await pool.query("grant select, insert on public.acl_probe to service_role");
      const before = await pool.query(
        `select has_table_privilege('service_role','public.acl_probe','UPDATE') as upd,
                has_table_privilege('service_role','public.acl_probe','DELETE') as del`,
      );
      expect(before.rows[0], "★ the old pattern enforced NOTHING").toEqual({ upd: true, del: true });

      // The NEW pattern — service_role reset first.
      await pool.query("revoke all on public.acl_probe from anon, public, authenticated, service_role");
      await pool.query("grant select, insert on public.acl_probe to service_role");
      const after = await pool.query(
        `select has_table_privilege('service_role','public.acl_probe','SELECT') as sel,
                has_table_privilege('service_role','public.acl_probe','INSERT') as ins,
                has_table_privilege('service_role','public.acl_probe','UPDATE') as upd,
                has_table_privilege('service_role','public.acl_probe','DELETE') as del`,
      );
      expect(after.rows[0]).toEqual({ sel: true, ins: true, upd: false, del: false });
    } finally {
      await pool.query("drop table if exists public.acl_probe");
    }
  });

  it("★ 9 — service_role is ACTUALLY BLOCKED, as the real role, on both tables", async () => {
    // Not a privilege lookup: the real refusal, from the real role, under the same default
    // privileges Supabase applies. A catalogue that says "no UPDATE" and a database that accepts
    // one would disagree here and nowhere else.
    await post(S.rowA, S.recipA, "immutable");
    const c = new Client({ connectionString: URL });
    await c.connect();
    await c.query("set role service_role");
    await expect(c.query("update public.bty_announcement_thread_messages set body = 'tampered'")).rejects.toThrow(
      /permission denied/i,
    );
    await expect(c.query("delete from public.bty_announcement_thread_messages")).rejects.toThrow(/permission denied/i);
    // And it cannot re-point a message at another recipient.
    await expect(
      c.query("update public.bty_announcement_thread_messages set recipient_id = $1", [S.rowB]),
    ).rejects.toThrow(/permission denied/i);
    // Receipts are equally immutable — there is no un-read.
    await markRead(S.rowA, S.host);
    await expect(c.query("delete from public.bty_announcement_thread_message_reads")).rejects.toThrow(
      /permission denied/i,
    );
    await expect(
      c.query("update public.bty_announcement_thread_message_reads set read_at = now()"),
    ).rejects.toThrow(/permission denied/i);
    await c.query("reset role");
    await c.end();
    const body = (
      await pool.query("select body from public.bty_announcement_thread_messages where recipient_id=$1", [S.rowA])
    ).rows[0].body;
    expect(body).toBe("immutable");
  });

  it("anon and authenticated reach neither table at all", async () => {
    for (const role of ["anon", "authenticated"]) {
      for (const t of ["bty_announcement_thread_messages", "bty_announcement_thread_message_reads"]) {
        const { rows } = await pool.query(
          `select bool_or(has_table_privilege($1, $2, priv)) as any_priv
             from unnest(array['SELECT','INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER']) as priv`,
          [role, `public.${t}`],
        );
        expect(rows[0].any_priv, `${role} on ${t}`).toBe(false);
      }
    }
  });
});

/* ═══════════════════ ORDERING AND BOUNDS ═══════════════════ */

pg("★ E — ordering is total, and the bounds are the database's", () => {
  it("messages sharing one timestamp still have a deterministic order", async () => {
    // The bridge deliberately gives the disposition and its first message ONE instant; a second
    // message written in the same statement-time would tie. (created_at, id) breaks it.
    await pool.query(
      `insert into public.bty_announcement_thread_messages (recipient_id, author_user_id, author_role, body, created_at)
       select $1, $2, 'RECIPIENT', b, '2026-09-12T00:00:00Z'
         from unnest(array['a','b','c','d','e']) as b`,
      [S.rowA, S.recipA],
    );
    const one = await pool.query("select body from public.bty_announcement_thread_messages where recipient_id=$1 order by created_at, id", [S.rowA]);
    const two = await pool.query("select body from public.bty_announcement_thread_messages where recipient_id=$1 order by created_at, id", [S.rowA]);
    expect(one.rows.map((r) => r.body)).toEqual(two.rows.map((r) => r.body));
    expect(new Set(one.rows.map((r) => r.body)).size).toBe(5);
  });

  it("empty, whitespace and 1001 characters are refused by the function", async () => {
    expect((await post(S.rowA, S.recipA, "")).result).toBe("empty_message");
    expect((await post(S.rowA, S.recipA, "   ")).result).toBe("empty_message");
    expect((await post(S.rowA, S.recipA, "x".repeat(1001))).result).toBe("message_too_long");
    expect((await post(S.rowA, S.recipA, "x".repeat(1000))).result).toBe("posted");
  });

  it("the CHECK constraint refuses an oversize body even if a function ever stopped checking", async () => {
    await expect(
      pool.query(
        `insert into public.bty_announcement_thread_messages (recipient_id, author_user_id, author_role, body)
         values ($1,$2,'HOST',$3)`,
        [S.rowA, S.host, "x".repeat(1001)],
      ),
    ).rejects.toThrow(/bty_ann_thread_body_len_check/);
  });

  it("the CHECK constraint refuses an invented role", async () => {
    await expect(
      pool.query(
        `insert into public.bty_announcement_thread_messages (recipient_id, author_user_id, author_role, body)
         values ($1,$2,'ADMIN','x')`,
        [S.rowA, S.host],
      ),
    ).rejects.toThrow(/bty_ann_thread_role_check/);
  });

  it("★ the nonce is unique per (recipient, author) and cannot collide across people", async () => {
    expect((await post(S.rowA, S.recipA, "mine", "same")).result).toBe("posted");
    expect((await post(S.rowA, S.recipA, "mine", "same")).result).toBe("duplicate");
    expect((await post(S.rowA, S.host, "host's", "same")).result).toBe("posted");
    expect((await post(S.rowB, S.recipB, "B's", "same")).result).toBe("posted");
    const n = await pool.query(
      "select count(*)::int as n from public.bty_announcement_thread_messages where recipient_id in ($1,$2)",
      [S.rowA, S.rowB],
    );
    expect(n.rows[0].n).toBe(3);
  });

  it("★ two concurrent sends of the SAME nonce produce exactly ONE message", async () => {
    const both = await Promise.allSettled([
      post(S.rowA, S.recipA, "double tap", "race-key"),
      post(S.rowA, S.recipA, "double tap", "race-key"),
    ]);
    expect(both.every((r) => r.status === "fulfilled")).toBe(true);
    const n = await pool.query("select count(*)::int as n from public.bty_announcement_thread_messages where recipient_id=$1", [S.rowA]);
    expect(n.rows[0].n, "the unique index is the backstop when both pass the lookup").toBe(1);
  });
});
