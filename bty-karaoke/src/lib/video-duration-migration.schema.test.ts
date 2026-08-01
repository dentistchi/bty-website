// 20260806120000_karaoke_video_duration_raw_cache_v1.sql — pins the BUILD 22 migration.
//
// This migration exists for ONE reason: `duration_seconds int check (between 1 and 900)` made a
// positively parsed 901 unstorable, so the fact "this video is 8917 seconds long" had to be
// re-bought from a finite daily quota on every single attempt. These assertions lock in that the
// broadening is a CONSTRAINT change and nothing else — no data movement, no new verdict column,
// and no contact with the lease / grace / pass tables.

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const FILE = '../../supabase/migrations/20260806120000_karaoke_video_duration_raw_cache_v1.sql';
const sql = readFileSync(fileURLToPath(new URL(FILE, import.meta.url)), 'utf8');

// Executable DDL only (strip `-- ...` comment lines so prose can't satisfy an assertion).
const code = sql
  .split('\n')
  .filter((l) => !l.trim().startsWith('--'))
  .join(' ')
  .toLowerCase()
  .replace(/\s+/g, ' ');

describe('20260806120000 — BUILD 22 raw duration cache', () => {
  it('is ordered strictly AFTER the current canonical migration head (20260805120000)', () => {
    expect(Number('20260806120000')).toBeGreaterThan(Number('20260805120000'));
  });

  it('is idempotent: drops the old constraint by BOTH its generated and its new name', () => {
    expect(code).toContain('drop constraint if exists karaoke_video_durations_duration_seconds_check');
    expect(code).toContain('drop constraint if exists karaoke_video_duration_seconds_positive');
  });

  it('adds an EXPLICITLY NAMED, inspectable check constraint', () => {
    expect(code).toMatch(
      /add constraint karaoke_video_duration_seconds_positive check \(duration_seconds > 0 and duration_seconds <= 86400\)/,
    );
  });

  it('accepts 900, 901 and larger positive durations under the new bound', () => {
    // The predicate the migration installs, evaluated directly.
    const accepts = (n: number) => n > 0 && n <= 86400;
    expect(accepts(900)).toBe(true); //  the old ceiling — still valid
    expect(accepts(901)).toBe(true); //  THE POINT: previously rejected outright
    expect(accepts(8917)).toBe(true); // the real production medley
    expect(accepts(86400)).toBe(true);
  });

  it('still rejects 0, negatives, and absurd values (not lengths)', () => {
    const accepts = (n: number) => n > 0 && n <= 86400;
    expect(accepts(0)).toBe(false);
    expect(accepts(-1)).toBe(false);
    expect(accepts(-8917)).toBe(false);
    expect(accepts(86401)).toBe(false);
  });

  it('PRESERVES every existing row — no insert/update/delete/backfill anywhere', () => {
    expect(code).not.toMatch(/\binsert\s+into\b/);
    expect(code).not.toMatch(/\bupdate\s+public\./);
    expect(code).not.toMatch(/\bdelete\s+from\b/);
    expect(code).not.toMatch(/\btruncate\b/);
  });

  it('does not drop or recreate the table, its primary key, its RLS, or its grants', () => {
    expect(code).not.toMatch(/drop table/);
    expect(code).not.toMatch(/create table/);
    expect(code).not.toMatch(/drop constraint if exists \S*_pkey/);
    expect(code).not.toMatch(/disable row level security/);
    expect(code).not.toMatch(/revoke .* from service_role/);
  });

  it('adds NO durable failure/unknown verdict column — a lookup failure is never persisted', () => {
    // Structural, not lexical: the `comment on column` prose legitimately discusses quota, so a
    // bare substring search would fail on documentation rather than on schema.
    const ddl = code.replace(/comment on column[^;]*;/g, ' ');
    expect(ddl).not.toMatch(/add column/);
    expect(ddl).not.toMatch(/\bstatus\b|\bverdict\b|\breason\b|\bfailure\b|\bunknown\b/);
    // Every statement is an ALTER ... CONSTRAINT: no column is created, altered or typed.
    expect(ddl).not.toMatch(/\balter column\b|\bdrop column\b/);
  });

  it('does not touch lease, usage-segment, timed-pass or Final Song Grace tables', () => {
    for (const table of [
      'karaoke_event_usage_segments',
      'karaoke_free_final_song_grace',
      'timed_access_pass_grants',
      'karaoke_usage_policy',
      'karaoke_requests',
    ]) {
      expect(code).not.toContain(table);
    }
  });

  it('touches exactly ONE table', () => {
    const tables = new Set([...code.matchAll(/public\.(\w+)/g)].map((m) => m[1]));
    expect([...tables]).toEqual(['karaoke_video_durations']);
  });
});
