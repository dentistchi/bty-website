// BUILD R2.5 — static pins on the abuse-containment migration.
//
// Two claims matter most here and both are NEGATIVE, which is what prose is worst at guaranteeing:
// (1) the BUILD R2 aggregation contract is preserved — blocked serves must NOT enter
// `visible_searches`, or every ratio in the evidence pack silently changes meaning mid-record;
// (2) the ceiling is enforced by an atomic statement, not a read-then-write. Comments are stripped
// before every assertion.

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const FILE = 'supabase/migrations/20260821120000_karaoke_youtube_search_abuse_containment_v1.sql';
const raw = readFileSync(join(process.cwd(), FILE), 'utf8');
const sql = raw.split('\n').map((l) => l.replace(/--.*$/, '')).join('\n');

const usage = sql.slice(sql.indexOf('create or replace function public.karaoke_youtube_search_usage'));
const reserve = sql.slice(
  sql.indexOf('create or replace function public.karaoke_reserve_youtube_search'),
  sql.indexOf('$$;', sql.indexOf('create or replace function public.karaoke_reserve_youtube_search')),
);

describe('R2.5 — comment stripping is real', () => {
  it('strips prose so a comment can never satisfy an assertion', () => {
    expect(raw).toMatch(/read-modify-write/);
    expect(sql).not.toMatch(/read-modify-write/);
  });
});

describe('R2.5 — A: additive, and destructive of nothing', () => {
  it('A1. preserves every existing row: no delete, truncate, or drop of a table', () => {
    expect(sql).not.toMatch(/\bdelete from\b/i);
    expect(sql).not.toMatch(/\btruncate\b/i);
    expect(sql).not.toMatch(/drop table/i);
    expect(sql).not.toMatch(/drop column/i);
  });

  it('A2. touches the disposition CHECK only, and only to WIDEN it', () => {
    const drops = sql.match(/drop constraint[^;]*;/gi) ?? [];
    expect(drops).toHaveLength(1);
    expect(drops[0]).toMatch(/karaoke_youtube_search_serves_hourly_disposition_check/);
    expect(sql).toMatch(/'UPSTREAM','CACHE_HIT','BREAKER_OPEN','GATED','RATE_LIMITED','BUDGET_GUARDED'/);
  });

  it('A3. leaves the BUILD R2 call table completely alone', () => {
    expect(sql).not.toMatch(/alter table public\.karaoke_youtube_search_calls/);
    expect(sql).not.toMatch(/drop trigger[^;]*karaoke_youtube_search_calls/);
  });

  it('A4. is idempotent', () => {
    expect(sql.match(/create table (?!if not exists)/gi)).toBeNull();
    expect(sql).toMatch(/drop constraint if exists/);
    expect(sql.match(/create function /gi)).toBeNull();
  });
});

describe('R2.5 — B: the BUILD R2 aggregation contract is preserved', () => {
  it('B1. visible_searches still counts the SAME four dispositions — blocked serves are excluded', () => {
    expect(usage).toMatch(/v_visible := v_upstream \+ v_hit \+ v_breaker \+ v_gated;/);
    const line = usage.match(/v_visible := [^;]+;/)![0];
    expect(line).not.toMatch(/v_rated|v_budgeted/);
  });

  it('B2. every BUILD R2 field keeps its name and derivation', () => {
    for (const f of [
      "'calls', v_calls", "'limit', v_limit", "'remaining', greatest\\(v_limit - v_calls, 0\\)",
      "'visible_searches', v_visible", "'cache_hits', v_hit", "'upstream', v_upstream",
      "'breaker_open', v_breaker", "'gated', v_gated", "'last_successful_at', v_last",
      "'bucket', 'search_queries'", "'endpoint', 'search\\.list'",
    ]) {
      expect(usage).toMatch(new RegExp(f));
    }
  });

  it('B3. reports blocked serves separately, and the budget state alongside', () => {
    expect(usage).toMatch(/'blocked', jsonb_build_object\(\s*\n?\s*'rate_limited', v_rated,\s*\n?\s*'budget_guarded', v_budgeted/);
    expect(usage).toMatch(/'budget', jsonb_build_object/);
    expect(usage).toMatch(/'soft_ceiling', 850/);
  });

  it('B4. still derives quota usage from the CALL table alone', () => {
    const callsAssignment = usage.slice(usage.indexOf('into v_calls'), usage.indexOf('into v_last'));
    expect(callsAssignment).toMatch(/from public\.karaoke_youtube_search_calls/);
    expect(callsAssignment).not.toMatch(/serves_hourly|budget/);
  });

  it('B5. still uses the Pacific quota day', () => {
    expect(usage).toMatch(/v_zone\s+text := 'America\/Los_Angeles'/);
    expect(sql).not.toMatch(/Asia\/Seoul/);
  });
});

describe('R2.5 — C: the ceiling is atomic, not advisory', () => {
  it('C1. enforces the ceiling INSIDE the conflicting write, not by reading first', () => {
    expect(reserve).toMatch(/on conflict \(pacific_date\) do update/);
    expect(reserve).toMatch(/where b\.reserved < p_ceiling/);
    // A read-then-write shape (select … then update) is exactly what races under concurrency.
    expect(reserve).not.toMatch(/select\s+reserved[\s\S]*?into v_reserved[\s\S]*?update\s+public/);
  });

  it('C2. scopes the budget to the PACIFIC day, matching Google’s reset', () => {
    expect(reserve).toMatch(/v_date\s+date := \(now\(\) at time zone 'America\/Los_Angeles'\)::date/);
  });

  it('C3. the ceiling is a parameter with a 850 default, leaving a 150 hard reserve of 1000', () => {
    expect(sql).toMatch(/karaoke_reserve_youtube_search\(p_ceiling integer default 850\)/);
    expect(usage).toMatch(/'hard_reserve', v_limit - 850/);
  });

  it('C4. is service_role only, like every other function in this system', () => {
    expect(sql).toMatch(/revoke all on function public\.karaoke_reserve_youtube_search\(integer\) from public, anon, authenticated/);
    expect(sql).toMatch(/grant execute on function public\.karaoke_reserve_youtube_search\(integer\) to service_role/);
    expect(sql).toMatch(/revoke all on table public\.karaoke_youtube_search_budget from public, anon, authenticated/);
  });

  it('C5. the budget table stores a date and a count — no identifier of any kind', () => {
    const table = sql.slice(
      sql.indexOf('create table if not exists public.karaoke_youtube_search_budget'),
      sql.indexOf(');', sql.indexOf('create table if not exists public.karaoke_youtube_search_budget')),
    );
    for (const forbidden of ['ip', 'query', 'account', 'room', 'session', 'guest', 'device', 'user']) {
      expect(table.toLowerCase()).not.toMatch(new RegExp(`\\b${forbidden}`));
    }
  });
});

describe('R2.5 — D: containment never fakes Google’s refusal', () => {
  const lib = readFileSync(join(process.cwd(), 'src/lib/youtube.server.ts'), 'utf8')
    .split('\n').map((l) => l.replace(/\/\/.*$/, '')).join('\n');

  it('D1. the budget-guard return sets quotaExceeded FALSE and writes no breaker marker', () => {
    const block = lib.slice(lib.indexOf('const budget = await reserveSearchBudget'), lib.indexOf('const callId'));
    expect(block).toMatch(/degraded: true, quotaExceeded: false/);
    expect(block).not.toMatch(/QUOTA_MARKER_KEY/);
  });

  it('D2. the guard sits AFTER the cache and breaker checks, so hits are still served', () => {
    // Anchor on the CALL SITE, not the import at the top of the file.
    const guard = lib.indexOf('await reserveSearchBudget(');
    expect(guard).toBeGreaterThan(0);
    expect(lib.indexOf("safeServe('CACHE_HIT')")).toBeLessThan(guard);
    expect(lib.indexOf("safeServe('BREAKER_OPEN')")).toBeLessThan(guard);
    expect(guard).toBeLessThan(lib.indexOf('await fetchItemsFromApi'));
  });

  it('D3. the cache-only recommendation path is untouched by containment', () => {
    const cachedOnly = lib.slice(lib.indexOf('export async function searchYoutubeCachedOnly'));
    expect(cachedOnly).not.toMatch(/reserveSearchBudget|checkSearchRateLimit|safeServe/);
  });

  it('D4. videos.list modules take no part in containment', () => {
    for (const f of ['src/lib/youtube-duration.server.ts', 'src/lib/youtube-retention.server.ts']) {
      const s = readFileSync(join(process.cwd(), f), 'utf8');
      expect(s).not.toMatch(/youtube-search-guard|reserveSearchBudget|checkSearchRateLimit/);
    }
  });
});
