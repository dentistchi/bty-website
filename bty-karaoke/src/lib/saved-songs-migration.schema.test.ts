// 20260802120000_karaoke_user_saved_songs.sql — pins the migration DDL so the
// invariants that make My Songs safe cannot silently regress: additive+idempotent,
// account-owned with cascade delete, idempotent-save unique index, deterministic
// account-scoped list index, DB-level field checks, and default-deny RLS.

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const sql = readFileSync(
  fileURLToPath(new URL('../../supabase/migrations/20260802120000_karaoke_user_saved_songs.sql', import.meta.url)),
  'utf8',
);
// Executable DDL only (strip `-- ...` comment lines so prose can't satisfy an assertion).
const code = sql
  .split('\n')
  .filter((l) => !l.trim().startsWith('--'))
  .join(' ')
  .toLowerCase()
  .replace(/\s+/g, ' ');

describe('20260802120000_karaoke_user_saved_songs.sql', () => {
  it('is additive + idempotent (create table/index if not exists; no destructive drop)', () => {
    expect(code).toContain('create table if not exists public.karaoke_user_saved_songs');
    expect(code).toMatch(/create unique index if not exists/);
    expect(code).toMatch(/create index if not exists/);
    expect(code).not.toMatch(/drop table (?!if exists)/); // only the documented rollback comment
  });

  it('is owned by the canonical ACCOUNT with cascade delete (no guest/room/event ownership)', () => {
    expect(code).toContain('account_id uuid not null references public.karaoke_accounts(id) on delete cascade');
  });

  it('(34) makes save idempotent: UNIQUE(account_id, video_id)', () => {
    expect(code).toMatch(
      /create unique index if not exists \S+ on public\.karaoke_user_saved_songs \(account_id, video_id\)/,
    );
  });

  it('(35) has the deterministic account-scoped list index (account_id, created_at desc, id desc)', () => {
    expect(code).toMatch(
      /create index if not exists \S+ on public\.karaoke_user_saved_songs \(account_id, created_at desc, id desc\)/,
    );
  });

  it('(36) is default-deny: RLS enabled + anon/authenticated revoked, no permissive policy', () => {
    expect(code).toContain('alter table public.karaoke_user_saved_songs enable row level security');
    expect(code).toContain('revoke all on public.karaoke_user_saved_songs from anon, authenticated');
    expect(code).not.toMatch(/create policy/); // the server layer is the authorization boundary
  });

  it('enforces the field checks at the DB (videoId 11-char, title/artist/thumbnail bounds)', () => {
    expect(code).toContain("video_id text not null check (video_id ~ '^[a-za-z0-9_-]{11}$')");
    expect(code).toContain('char_length(title_snapshot) between 1 and 300');
    expect(code).toContain('char_length(artist_snapshot) between 1 and 200');
    expect(code).toContain('char_length(thumbnail_url_snapshot) between 1 and 600');
  });

  it('carries created_at + updated_at timestamps with now() defaults', () => {
    expect(code).toContain('created_at timestamptz not null default now()');
    expect(code).toContain('updated_at timestamptz not null default now()');
  });
});
