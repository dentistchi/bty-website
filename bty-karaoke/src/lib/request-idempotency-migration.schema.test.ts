// BUILD 18B — guest request idempotency migration schema pins. Asserts the SQL is
// additive (nullable key, partial index, no data mutation) and scoped to room+event+key.

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const sql = readFileSync(
  join(process.cwd(), 'supabase/migrations/20260729120000_karaoke_request_idempotency.sql'),
  'utf8',
);

describe('20260729120000_karaoke_request_idempotency.sql', () => {
  it('adds a NULLABLE idempotency_key (legacy rows stay valid)', () => {
    expect(sql).toMatch(/alter table public\.karaoke_requests\s+add column if not exists idempotency_key text;/);
    // never NOT NULL, never a default, never a backfill UPDATE.
    expect(sql).not.toMatch(/idempotency_key text not null/i);
    expect(sql).not.toMatch(/update public\.karaoke_requests/i);
  });

  it('partial unique index scoped to room + event-context + key, only when key present', () => {
    expect(sql).toMatch(/create unique index if not exists karaoke_requests_idem_unique_idx/);
    expect(sql).toMatch(/room_id, coalesce\(event_id, '00000000-0000-0000-0000-000000000000'::uuid\), idempotency_key/);
    expect(sql).toMatch(/where idempotency_key is not null/);
  });

  it('is purely additive — no DELETE/dedup/backfill/RPC/trigger, no other table touched', () => {
    expect(sql).not.toMatch(/\bdelete\b/i);
    expect(sql).not.toMatch(/create (or replace )?function/i);
    expect(sql).not.toMatch(/create trigger/i);
    // only karaoke_requests is altered/indexed
    expect(sql).not.toMatch(/alter table public\.(karaoke_rooms|karaoke_events|karaoke_sessions)/i);
  });

  it('documents a rollback', () => {
    expect(sql).toMatch(/drop index if exists public\.karaoke_requests_idem_unique_idx/);
    expect(sql).toMatch(/drop column if exists idempotency_key/);
  });
});
