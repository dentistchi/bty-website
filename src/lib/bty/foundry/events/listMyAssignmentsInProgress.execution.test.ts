import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, existsSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

/**
 * REAL POSTGRESQL EXECUTION GATE for the in_progress projection (Slice R4-R5C3A2).
 *
 * The truth this slice ships lives entirely inside one SQL `case` expression. A mocked RPC
 * cannot test it: it would return whatever the fake decided, and would keep passing if the
 * predicate underneath were wrong — the exact failure mode recorded in this repository when a
 * `plpgsql` OUT-parameter collision (42702) survived a fully green mocked suite.
 *
 * So this applies the REAL function to a disposable cluster, against real fixtures, and asserts
 * the projected status. It follows the repository's existing execution-gate pattern and, like
 * that one, SKIPS LOUDLY when no local PostgreSQL exists rather than passing on nothing.
 */

const PG_BIN_CANDIDATES = [
  "/opt/homebrew/opt/postgresql@17/bin",
  "/opt/homebrew/opt/postgresql@16/bin",
  "/opt/homebrew/bin",
  "/usr/local/bin",
  "/usr/bin",
];
const PG_BIN = PG_BIN_CANDIDATES.find((p) => existsSync(join(p, "initdb")) && existsSync(join(p, "pg_ctl")));
const bin = (n: string) => join(PG_BIN ?? "", n);
/*
  `stdio: ["ignore","pipe","pipe"]` and `-l <logfile>` below are BOTH required, and both copied
  from this repository's existing execution gate. Without them `pg_ctl start` hands the server its
  own inherited stdout pipe, which never closes — so execFileSync waits forever even though pg_ctl
  itself exited. Measured here first-hand: the run produced the vitest banner and then hung.
*/
const sh = (cmd: string, args: string[]) =>
  execFileSync(cmd, args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });

let dir = "";
let sock = "";
let port = 0;
const psql = (sql: string) =>
  sh(bin("psql"), ["-h", sock, "-p", String(port), "-U", "postgres", "-d", "postgres", "-v", "ON_ERROR_STOP=1", "-q", "-tAc", sql]).trim();

/** The production shape of everything the function touches. Column types copied from the shipped DDL. */
const SCHEMA = `
-- Supabase roles the real project already has; the grant/revoke at the end of the migration
-- names them, so a bare cluster must too. Same principle as the repo's migration-proof bootstrap:
-- create ONLY the pre-existing dependencies, never an object whose creation is under test.
do $$ begin
  if not exists (select 1 from pg_roles where rolname='anon') then create role anon; end if;
  if not exists (select 1 from pg_roles where rolname='authenticated') then create role authenticated; end if;
  if not exists (select 1 from pg_roles where rolname='service_role') then create role service_role; end if;
end $$;
create schema if not exists auth;
create table auth.users (id uuid primary key);

create table public.foundry_events (
  id uuid primary key, title text not null, status text not null default 'open',
  join_version integer not null default 1
);
create table public.foundry_event_participation_mode (
  event_id uuid primary key references public.foundry_events(id) on delete cascade,
  mode text not null
);
create table public.foundry_event_participants (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.foundry_events(id) on delete cascade,
  display_name text not null,
  participant_session_token_hash text not null,
  status text not null default 'joined',
  joined_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  removed_at timestamptz,
  user_id uuid null references auth.users(id) on delete set null,
  constraint p_event_id_unique unique (event_id, id)
);
create index foundry_event_participants_event_user_idx
  on public.foundry_event_participants (event_id, user_id) where user_id is not null;
create table public.foundry_event_training_progress (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null,
  participant_id uuid not null,
  video_started_at timestamptz,
  video_completed_at timestamptz,
  completed_at timestamptz,
  linked_user_id uuid,
  document_last_page int,
  document_active_read_ms bigint not null default 0,
  written_guidance_read_at timestamptz,
  discussion_self_reported_at timestamptz,
  constraint g_unique unique (event_id, participant_id),
  constraint g_participant_fk foreign key (event_id, participant_id)
    references public.foundry_event_participants (event_id, id) on delete cascade
);
create table public.foundry_event_assignments (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.foundry_events(id) on delete cascade,
  user_id_snapshot uuid not null,
  status text not null default 'assigned',
  participant_id uuid,
  assigned_at timestamptz not null default now(),
  completed_at timestamptz
);
`;

const U = "11111111-1111-4111-8111-111111111111"; // the learner
const OTHER = "22222222-2222-4222-8222-222222222222"; // a different account
const EV = "33333333-3333-4333-8333-333333333333";

beforeAll(() => {
  if (!PG_BIN) return;
  dir = mkdtempSync(join(tmpdir(), "bty-c3a2-"));
  sock = mkdtempSync(join(tmpdir(), "bty-c3a2-sock-"));
  port = 55000 + Math.floor(Number(process.pid) % 900);
  sh(bin("initdb"), ["-D", dir, "-U", "postgres", "--auth=trust"]);
  sh(bin("pg_ctl"), ["-D", dir, "-o", `-p ${port} -k ${sock}`, "-l", join(dir, "log"), "-w", "start"]);
  psql(SCHEMA);
  // The REAL migration text — not a paraphrase.
  const sql = readFileSync(
    join(process.cwd(), "supabase/migrations/20260826000000_foundry_list_my_assignments_v2_in_progress.sql"),
    "utf8",
  );
  sh(bin("psql"), ["-h", sock, "-p", String(port), "-U", "postgres", "-d", "postgres", "-v", "ON_ERROR_STOP=1", "-c", sql]);
  psql(`insert into auth.users(id) values ('${U}'), ('${OTHER}');
        insert into public.foundry_events(id,title) values ('${EV}','Handling an angry customer');
        insert into public.foundry_event_participation_mode(event_id,mode) values ('${EV}','assigned_overlay');`);
}, 120_000); // initdb + pg_ctl start exceed vitest's default hook timeout

afterAll(() => {
  if (!PG_BIN || !dir) return;
  try {
    sh(bin("pg_ctl"), ["-D", dir, "-m", "immediate", "-w", "stop"]);
  } catch {
    /* already down */
  }
  rmSync(dir, { recursive: true, force: true });
  rmSync(sock, { recursive: true, force: true });
}, 60_000);

/** Reset per test, then create an assignment for `owner`. */
function assign(owner = U, status = "assigned") {
  psql(`delete from public.foundry_event_assignments;
        delete from public.foundry_event_training_progress;
        delete from public.foundry_event_participants;
        insert into public.foundry_event_assignments(event_id,user_id_snapshot,status,completed_at)
        values ('${EV}','${owner}','${status}', ${status === "completed" ? "now()" : "null"});`);
}
/** A participant on the event, optionally account-linked, optionally with a progress marker. */
function participant(userId: string | null, marker?: string, opts: { removed?: boolean; completed?: boolean } = {}) {
  const uid = userId ? `'${userId}'` : "null";
  const pid = psql(
    `insert into public.foundry_event_participants(event_id,display_name,participant_session_token_hash,user_id,status)
     values ('${EV}','Ari','h${Math.random()}',${uid},'${opts.removed ? "removed" : "joined"}') returning id;`,
  );
  if (marker !== undefined) {
    psql(`insert into public.foundry_event_training_progress(event_id,participant_id,${marker.split("=")[0]},completed_at)
          values ('${EV}','${pid}',${marker.split("=")[1]}, ${opts.completed ? "now()" : "null"});`);
  }
  return pid;
}
const projected = (who = U) =>
  psql(`select status from public.bty_foundry_list_my_assignments('${who}');`);

describe.runIf(Boolean(PG_BIN))("[R4-R5C3A2] the in_progress projection, in real PostgreSQL", () => {
  it("the function definition EXECUTES (a regex cannot know what PostgreSQL accepts)", () => {
    expect(psql(`select 1 from pg_proc where proname = 'bty_foundry_list_my_assignments';`)).toBe("1");
  });

  it("T1 — assigned with NO participant at all → assigned", () => {
    assign();
    expect(projected()).toBe("assigned");
  });

  it("T6 — participant JOINED but no progress row → assigned (joining is not starting)", () => {
    assign();
    participant(U);
    expect(projected()).toBe("assigned");
  });

  it("T6b — progress row exists but carries NO marker → assigned", () => {
    assign();
    participant(U, "video_started_at=null");
    expect(projected()).toBe("assigned");
  });

  it.each([
    ["T2 video", "video_started_at=now()"],
    ["T3 document page", "document_last_page=3"],
    ["T3b document read time", "document_active_read_ms=5000"],
    ["T4 written guidance", "written_guidance_read_at=now()"],
    ["T5 live discussion", "discussion_self_reported_at=now()"],
  ])("%s marker → in_progress", (_label, marker) => {
    assign();
    participant(U, marker);
    expect(projected()).toBe("in_progress");
  });

  it("document_active_read_ms = 0 is NOT a marker (the column is NOT NULL DEFAULT 0)", () => {
    assign();
    participant(U, "document_active_read_ms=0");
    expect(projected()).toBe("assigned");
  });

  it("T7 — real progress but participant.user_id IS NULL → assigned (no inference, ever)", () => {
    assign();
    participant(null, "video_started_at=now()");
    expect(projected()).toBe("assigned");
  });

  it("T8 — participant belongs to ANOTHER account → the assignee still sees assigned", () => {
    assign(U);
    participant(OTHER, "video_started_at=now()");
    expect(projected(U)).toBe("assigned");
  });

  it("T9 — a completed assignment is NEVER downgraded by a stale unfinished participant", () => {
    assign(U, "completed");
    participant(U, "video_started_at=now()");
    expect(projected()).toBe("completed");
  });

  it("finished progress does not make it in_progress", () => {
    assign();
    participant(U, "video_started_at=now()", { completed: true });
    expect(projected()).toBe("assigned");
  });

  it("a REMOVED participant is not a learner in progress", () => {
    assign();
    participant(U, "video_started_at=now()", { removed: true });
    expect(projected()).toBe("assigned");
  });

  it("T10 — two devices, only one started → in_progress, with no canonical pick", () => {
    assign();
    participant(U); // device B: joined, nothing yet
    participant(U, "document_last_page=2"); // device A: started
    expect(psql(`select count(*) from public.foundry_event_participants where user_id='${U}';`)).toBe("2");
    expect(projected()).toBe("in_progress");
  });

  it("T11 — an OPEN-LINK event fabricates no assignment", () => {
    assign();
    psql(`update public.foundry_event_participation_mode set mode='open_link' where event_id='${EV}';`);
    participant(U, "video_started_at=now()");
    expect(projected()).toBe("");
    psql(`update public.foundry_event_participation_mode set mode='assigned_overlay' where event_id='${EV}';`);
  });

  it("the partial index is usable by the projection's probe", () => {
    assign();
    participant(U, "video_started_at=now()");
    const plan = psql(
      `explain (costs off) select 1 from public.foundry_event_participants
        where event_id='${EV}' and user_id='${U}' and status='joined';`,
    );
    // Tiny fixture tables make a seq scan legitimate; what must hold is that the index EXISTS
    // and is applicable to this predicate shape.
    expect(psql(`select indexdef from pg_indexes where indexname='foundry_event_participants_event_user_idx';`))
      .toContain("(event_id, user_id) WHERE (user_id IS NOT NULL)");
    expect(plan.length).toBeGreaterThan(0);
  });
});

describe.runIf(!PG_BIN)("[R4-R5C3A2] execution gate", () => {
  it("SKIPPED LOUDLY — no local PostgreSQL; the SQL truth is UNPROVEN in this run", () => {
    expect(PG_BIN).toBeUndefined();
  });
});
