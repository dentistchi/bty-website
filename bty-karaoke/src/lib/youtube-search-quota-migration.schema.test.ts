// BUILD R2 — static pins on the search-quota telemetry migration and its instrumentation.
//
// The central claim is a NEGATIVE one: this system can only ever count real outbound
// `search.list` requests. A negative claim is exactly what prose is worst at guaranteeing, so
// comments are STRIPPED before every SQL assertion — otherwise the header, which discusses
// `videos.list` and cache hits at length, would satisfy the assertions meant to exclude them.
//
// Pure static read. The behavioural side (RLS denial, append-only rejection, duplicate call_id,
// Pacific-day and DST aggregation) is proven against real Postgres in the migration gate.

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const FILE = 'supabase/migrations/20260820120000_karaoke_youtube_search_quota_telemetry_v1.sql';
const raw = readFileSync(join(process.cwd(), FILE), 'utf8');

const sql = raw
  .split('\n')
  .map((line) => line.replace(/--.*$/, ''))
  .join('\n');

const src = (f: string) => readFileSync(join(process.cwd(), f), 'utf8');
const stripTs = (f: string) =>
  src(f)
    .split('\n')
    .map((l) => l.replace(/\/\/.*$/, ''))
    .join('\n')
    .replace(/\/\*[\s\S]*?\*\//g, '');

describe('R2 — comment stripping is real', () => {
  it('strips prose so a comment can never satisfy an assertion', () => {
    expect(raw).toMatch(/videos\.list/);      // discussed at length in the header…
    expect(sql).not.toMatch(/videos\.list/);  // …and absent from every executable statement
  });
});

describe('R2 — A: the migration is purely additive', () => {
  it('A1. alters no table, adds no column, adds no constraint to anything existing', () => {
    expect(sql).not.toMatch(/add column/i);
    expect(sql).not.toMatch(/add constraint/i);
    // The only `alter table` statements are `enable row level security` on the two NEW tables.
    const alters = sql.match(/alter table[^;]+;/gi) ?? [];
    expect(alters).toHaveLength(2);
    for (const a of alters) expect(a).toMatch(/enable row level security/i);
  });

  it('A2. backfills nothing and deletes nothing', () => {
    expect(sql).not.toMatch(/\bdelete from\b/i);
    expect(sql).not.toMatch(/\btruncate\b/i);
    expect(sql).not.toMatch(/\bupdate\s+public\./i);
  });

  it('A3. creates exactly the two new tables, and touches no pre-existing one', () => {
    const tables = sql.match(/create table if not exists public\.(\w+)/g) ?? [];
    expect(tables).toHaveLength(2);
    expect(sql).toMatch(/create table if not exists public\.karaoke_youtube_search_calls/);
    expect(sql).toMatch(/create table if not exists public\.karaoke_youtube_search_serves_hourly/);
    for (const t of ['karaoke_requests', 'karaoke_rooms', 'karaoke_events', 'karaoke_video_durations']) {
      expect(sql).not.toMatch(new RegExp(t));
    }
  });

  it('A4. is idempotent — every create is guarded or replaceable', () => {
    expect(sql.match(/create table (?!if not exists)/gi)).toBeNull();
    expect(sql.match(/create index (?!if not exists)/gi)).toBeNull();
    expect(sql.match(/create function /gi)).toBeNull(); // all are `create or replace function`
  });
});

describe('R2 — B: the call table is structurally search.list only', () => {
  const table = sql.slice(
    sql.indexOf('create table if not exists public.karaoke_youtube_search_calls'),
    sql.indexOf(');', sql.indexOf('create table if not exists public.karaoke_youtube_search_calls')),
  );

  it('B1. has NO endpoint column, so videos.list cannot be logged here at all', () => {
    expect(table).not.toMatch(/\bendpoint\b/);
  });

  it('B2. pins quota_units to exactly 1 — one row is one Search Queries unit', () => {
    expect(table).toMatch(/quota_units\s+smallint not null default 1 check \(quota_units = 1\)/);
  });

  it('B3. closes the outcome set', () => {
    expect(table).toMatch(/outcome\s+text not null check \(outcome in\s*\n?\s*\('OK','QUOTA_EXCEEDED','HTTP_4XX','HTTP_5XX','NETWORK_ERROR'\)\)/);
  });

  it('B4. makes call_id unique — the idempotency that stops a double count', () => {
    expect(table).toMatch(/call_id\s+text not null unique/);
  });

  it('B5. bounds upstream_reason and forbids a negative latency', () => {
    expect(table).toMatch(/char_length\(upstream_reason\) <= 64/);
    expect(table).toMatch(/latency_ms is null or latency_ms >= 0/);
  });

  it('B6. stores NO identifier of a person, venue, session, or query', () => {
    for (const forbidden of [
      'query', 'fingerprint', 'account', 'room_id', 'event_id', 'session',
      'guest', 'ip', 'device', 'email', 'user_id', 'surface',
    ]) {
      expect(table.toLowerCase()).not.toMatch(new RegExp(`\\b${forbidden}`));
    }
  });

  it('B7. carries both required indexes', () => {
    expect(sql).toMatch(/create index if not exists karaoke_yt_search_calls_time_idx[\s\S]*?\(requested_at desc\)/);
    expect(sql).toMatch(/create index if not exists karaoke_yt_search_calls_outcome_idx[\s\S]*?\(outcome, requested_at desc\)/);
  });
});

describe('R2 — C: security posture', () => {
  it('C1. enables RLS on both new tables', () => {
    expect(sql).toMatch(/alter table public\.karaoke_youtube_search_calls enable row level security/);
    expect(sql).toMatch(/alter table public\.karaoke_youtube_search_serves_hourly enable row level security/);
  });

  it('C2. revokes both tables from public, anon and authenticated', () => {
    expect(sql).toMatch(/revoke all on table public\.karaoke_youtube_search_calls from public, anon, authenticated/);
    expect(sql).toMatch(/revoke all on table public\.karaoke_youtube_search_serves_hourly from public, anon, authenticated/);
  });

  it('C3. grants the call table SELECT+INSERT only — never UPDATE or DELETE', () => {
    expect(sql).toMatch(/grant select, insert on table public\.karaoke_youtube_search_calls to service_role/);
    expect(sql).not.toMatch(/grant[^;]*delete[^;]*karaoke_youtube_search_calls/i);
  });

  it('C4. makes the call table append-only by trigger, covering UPDATE and DELETE', () => {
    expect(sql).toMatch(/before update or delete on public\.karaoke_youtube_search_calls/);
    expect(sql).toMatch(/is append-only; % is not permitted/);
  });

  it('C5. revokes every function from anon/authenticated and grants only service_role', () => {
    const fns = [
      'karaoke_record_youtube_search_serve',
      'karaoke_record_youtube_search_call',
      'karaoke_youtube_search_usage',
    ];
    for (const fn of fns) {
      expect(sql).toMatch(new RegExp(`revoke all on function public\\.${fn}[^;]*from public, anon, authenticated`));
      expect(sql).toMatch(new RegExp(`grant execute on function public\\.${fn}[^;]*to service_role`));
    }
  });

  it('C6. every security-definer function pins its search_path', () => {
    const definers = sql.match(/security definer/g) ?? [];
    const pinned = sql.match(/set search_path = public, pg_temp/g) ?? [];
    expect(definers.length).toBeGreaterThanOrEqual(3);
    expect(pinned.length).toBeGreaterThanOrEqual(definers.length);
  });
});

describe('R2 — D: the aggregation obeys Google’s reset, not ours', () => {
  it('D1. computes the quota day in America/Los_Angeles', () => {
    expect(sql).toMatch(/v_zone\s+text := 'America\/Los_Angeles'/);
  });

  it('D2. never buckets the quota day by UTC or Asia/Seoul', () => {
    expect(sql).not.toMatch(/Asia\/Seoul/);
    // UTC appears ONLY for the hour-bucket truncation, never for a day boundary.
    for (const m of sql.match(/date_trunc\('day'[^)]*\)/g) ?? []) expect(m).not.toMatch(/UTC/);
  });

  it('D3. reports the approved allocation as 1000 calls', () => {
    expect(sql).toMatch(/v_limit\s+integer := 1000/);
    expect(sql).toMatch(/'limit', v_limit/);
    expect(sql).toMatch(/'remaining', greatest\(v_limit - v_calls, 0\)/);
    expect(sql).toMatch(/'usage_pct', round\(\(v_calls::numeric \/ v_limit\) \* 100, 2\)/);
  });

  it('D4. derives usage from the CALL table only — never from the serve counters', () => {
    const usage = sql.slice(sql.indexOf('create or replace function public.karaoke_youtube_search_usage'));
    const callsAssignment = usage.slice(usage.indexOf('into v_calls'), usage.indexOf('into v_last'));
    expect(callsAssignment).toMatch(/from public\.karaoke_youtube_search_calls/);
    expect(callsAssignment).not.toMatch(/serves_hourly/);
  });

  it('D5. self-identifies as the Search Queries bucket', () => {
    expect(sql).toMatch(/'bucket', 'search_queries'/);
    expect(sql).toMatch(/'endpoint', 'search\.list'/);
  });
});

describe('R2 — E: the disposition set is closed and server-timed', () => {
  it('E1. allows exactly the four dispositions', () => {
    expect(sql).toMatch(/disposition in\s*\n?\s*\('UPSTREAM','CACHE_HIT','BREAKER_OPEN','GATED'\)/);
  });

  it('E2. computes the hour bucket server-side, so a caller cannot backdate a serve', () => {
    const fn = sql.slice(
      sql.indexOf('create or replace function public.karaoke_record_youtube_search_serve'),
      sql.indexOf('$$;', sql.indexOf('create or replace function public.karaoke_record_youtube_search_serve')),
    );
    expect(fn).toMatch(/v_hour timestamptz := date_trunc\('hour', \(now\(\) at time zone 'UTC'\)\) at time zone 'UTC'/);
    expect(fn).not.toMatch(/p_hour/); // no caller-supplied timestamp exists
  });

  it('E3. increments atomically rather than read-modify-write', () => {
    expect(sql).toMatch(/on conflict \(hour_utc, disposition\)\s*\n?\s*do update set serves = public\.karaoke_youtube_search_serves_hourly\.serves \+ 1/);
  });

  it('E4. the call RPC is write-idempotent on call_id', () => {
    expect(sql).toMatch(/on conflict \(call_id\) do nothing/);
  });
});

describe('R2 — F: instrumentation lives in exactly one place', () => {
  it('F1. only youtube.server.ts records an outbound search call', () => {
    expect(stripTs('src/lib/youtube.server.ts')).toMatch(/recordOutboundSearchCall/);
    // The duration + retention modules use videos.list — a DIFFERENT quota bucket. If either ever
    // imported this sink, videos.list units would silently pollute the Search Queries count.
    for (const f of ['src/lib/youtube-duration.server.ts', 'src/lib/youtube-retention.server.ts']) {
      expect(stripTs(f)).not.toMatch(/youtube-search-telemetry/);
      expect(stripTs(f)).not.toMatch(/recordOutboundSearchCall|recordSearchServe/);
    }
  });

  it('F2. the cache-only recommendation path records nothing', () => {
    const s = stripTs('src/lib/youtube.server.ts');
    const cachedOnly = s.slice(s.indexOf('export async function searchYoutubeCachedOnly'));
    expect(cachedOnly).not.toMatch(/recordSearchServe|recordOutboundSearchCall|safeServe/);
  });

  it('F3. the outbound row is written only where fetchItemsFromApi is invoked', () => {
    const s = stripTs('src/lib/youtube.server.ts');
    // One call site for the fetch, one recorder helper, and the recorder is used twice
    // (success + failure) — never anywhere a request was not issued.
    expect((s.match(/await fetchItemsFromApi\(/g) ?? [])).toHaveLength(1);
    expect((s.match(/recordUpstreamCall\(/g) ?? []).length).toBe(3); // 1 declaration + 2 call sites
  });
});
