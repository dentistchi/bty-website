// BUILD 26U-R2 — the rollout migration, pinned as a contract.

import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const DIR = fileURLToPath(new URL('../../supabase/migrations/', import.meta.url));
const NAME = '20260823120000_karaoke_premium_room_rollout_v1.sql';
const raw = readFileSync(`${DIR}${NAME}`, 'utf8');
const sql = raw.replace(/^\s*--.*$/gm, '');

describe('ordering, additivity and copy-friendliness', () => {
  it('sorts immediately after the R1 entitlement migration', () => {
    // BUILD 26U-R4A added a later migration (dual_allowlist), so "last" is no longer the
    // invariant — ADJACENCY to R1 is, because this file drops and recreates R1's function.
    const all = readdirSync(DIR).filter((f) => f.endsWith('.sql')).sort();
    const i = all.indexOf(NAME);
    expect(i).toBeGreaterThan(0);
    expect(all[i - 1]).toBe('20260822120000_karaoke_premium_room_session_entitlement_v1.sql');
  });

  it('carries the copy-friendly header and has no trailing whitespace', () => {
    expect(raw.startsWith('-- Copy-friendly (LF, no trailing spaces). Select all to copy.')).toBe(true);
    expect(raw).not.toMatch(/[ \t]+\n/);
    expect(raw.endsWith('\n')).toBe(true);
    expect(raw).not.toContain('\r');
  });

  it('adds its column idempotently and drops no data', () => {
    expect(sql).toContain('add column if not exists premium_room_mode');
    expect(sql).not.toMatch(/\bdrop\s+table\b/i);
    expect(sql).not.toMatch(/\bdrop\s+column\b/i);
    expect(sql).not.toMatch(/\bdelete\s+from\b/i);
    expect(sql).not.toMatch(/\btruncate\b/i);
  });

  it('the ONLY drop is the R1 function it immediately recreates with one more parameter', () => {
    const drops = sql.match(/^\s*drop\s+\S+/gim) ?? [];
    expect(drops.length).toBe(1);
    expect(sql).toContain(
      'drop function if exists public.karaoke_start_premium_room_session(uuid, text, text, text, text);',
    );
    // …and the 6-argument replacement is created in the same file, so no window exists where
    // the function is absent.
    const dropAt = sql.indexOf('drop function if exists public.karaoke_start_premium_room_session');
    const createAt = sql.indexOf('create or replace function public.karaoke_start_premium_room_session');
    expect(createAt).toBeGreaterThan(dropAt);
  });

  it('creates the telemetry table idempotently', () => {
    expect(sql).toContain('create table if not exists public.karaoke_release_clients_hourly');
    expect(sql).toContain('primary key (hour_utc, bucket)');
  });
});

describe('the deploy-safe default', () => {
  it('the column defaults to legacy_free — applying this migration changes nothing', () => {
    expect(sql).toContain("add column if not exists premium_room_mode text not null default 'legacy_free'");
  });

  it('the CHECK admits exactly the three modes', () => {
    expect(sql).toContain("check (premium_room_mode in ('legacy_free', 'dual', 'premium_all'))");
  });

  it('the mode read is STABLE and falls back to legacy_free, never to a paid state', () => {
    expect(sql).toContain('returns text language sql stable');
    // Two independent fallbacks: an unrecognised value, and a missing row.
    expect(sql).toContain("then premium_room_mode else 'legacy_free' end");
    expect(sql).toContain("'legacy_free');");
    expect(sql).not.toContain("default 'premium_all'");
    expect(sql).not.toContain("default 'dual'");
  });
});

describe('privilege posture matches every prior migration', () => {
  it('revokes from the browser roles and grants only service_role', () => {
    const flat = sql.replace(/\s+/g, ' ');
    for (const f of [
      'karaoke_premium_room_mode()',
      'karaoke_record_release_client(text)',
      'karaoke_start_premium_room_session(uuid, text, text, text, text, text)',
    ]) {
      expect(flat, `${f} revoked`).toContain(`revoke all on function public.${f} from public, anon, authenticated;`);
      expect(flat, `${f} granted`).toContain(`grant execute on function public.${f} to service_role;`);
    }
    expect(flat).toContain('revoke all on table public.karaoke_release_clients_hourly from public, anon, authenticated;');
    expect(sql).toContain('alter table public.karaoke_release_clients_hourly enable row level security;');
  });

  it('pins search_path on every function', () => {
    const bodies = sql.match(/create or replace function[\s\S]*?\$\$/g) ?? [];
    expect(bodies.length).toBe(3);
    for (const b of bodies) expect(b).toContain('set search_path = public, pg_temp');
  });
});

describe('the legacy contract cannot become a paid one', () => {
  it('an absent contract resolves to premium (the three-valued-logic hole is closed)', () => {
    expect(sql).toContain("v_legacy boolean := (coalesce(p_contract, 'premium') = 'legacy');");
  });

  it('the parameter defaults to premium, so an omitted argument is gated', () => {
    expect(sql).toContain("p_contract     text default 'premium'");
  });

  it('the legacy branch performs exactly one grant write — the truthful expiry sweep', () => {
    const guardAt = sql.indexOf('if not v_legacy then');
    const beforeGuard = sql.slice(sql.indexOf('create or replace function public.karaoke_start_premium_room_session'), guardAt);
    // The sweep is the only grant mutation reachable on both contracts, and it only records a
    // lapse that already happened.
    expect(beforeGuard).toContain("set status = 'EXPIRED', expired_at = v_now");
    expect(beforeGuard).not.toContain("set status = 'ACTIVE'");
    expect(beforeGuard).not.toContain('insert into public.timed_access_pass_grants');
  });

  it('the write order from R1 is preserved — refuse, then create, then activate', () => {
    expect(sql.indexOf("'premium_room_required'")).toBeLessThan(sql.indexOf('insert into public.karaoke_events'));
    expect(sql.indexOf("set status = 'ACTIVE'")).toBeGreaterThan(sql.indexOf('insert into public.karaoke_events'));
    expect(sql).toContain("raise exception 'premium_room_activation_conflict'");
  });

  it('the account lock is still taken before the room lock', () => {
    const acct = sql.indexOf('pg_advisory_xact_lock(public.karaoke_account_lock_key(v_account))');
    const room = sql.indexOf('pg_advisory_xact_lock(hashtext(p_room_id::text))');
    expect(acct).toBeGreaterThan(-1);
    expect(room).toBeGreaterThan(acct);
  });
});

describe('what the rollout migration must not touch', () => {
  it('no commerce contract data', () => {
    for (const t of ['karaoke_product_catalog', 'karaoke_apple_purchases', 'is_active',
                     'fulfil_apple_purchase', 'issue_timed_access_pass']) {
      expect(sql, `must not touch ${t}`).not.toContain(t);
    }
  });

  it('no playback path, no media duration', () => {
    for (const t of ['karaoke_begin_song', 'karaoke_video_durations', 'karaoke_requests',
                     'youtube', 'lease_seconds', 'free_limit_seconds']) {
      expect(sql.toLowerCase(), `must not touch ${t}`).not.toContain(t.toLowerCase());
    }
  });

  it('the telemetry stores no identifier of any kind', () => {
    const table = sql.slice(sql.indexOf('create table if not exists public.karaoke_release_clients_hourly'),
                            sql.indexOf('alter table public.karaoke_release_clients_hourly'));
    for (const t of ['account', 'room', 'event', 'session', 'token', 'ip', 'device', 'user_agent',
                     'fingerprint', 'slug']) {
      expect(table.toLowerCase(), `telemetry must not store ${t}`).not.toContain(t);
    }
  });
});
