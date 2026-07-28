-- Copy-friendly (LF, no trailing spaces). Select all to copy.
-- btyNorebang — MY SONGS SERVER FOUNDATION V1 (BUILD 20A). The smallest
-- account-scoped saved-song library: a signed-in canonical account keeps YouTube
-- songs it can request again later without re-searching. Isolated bty-karaoke
-- Supabase project (ref zycwaqignioawtqynopj). Additive + idempotent; never
-- rewrites or regresses a prior migration.
--
-- Product decisions encoded here (see BUILD 20 preflight + 20A spec):
--   * Ownership is the CANONICAL ACCOUNT (karaoke_accounts.id), never a guest
--     session / device / Room / Event / request. There is no anonymous ownership
--     here and no second account system.
--   * Song identity is the YouTube video id. UNIQUE(account_id, video_id) makes a
--     save IDEMPOTENT at the DB — one person can hold a given song at most once,
--     while two different accounts hold it independently.
--   * title/artist/thumbnail are denormalized SNAPSHOTS (exactly like a
--     karaoke_requests row) — this table references no song catalog and creates no
--     FK to Events/requests. It touches nothing in the Queue/Event/entitlement
--     contracts.
--   * Access is the same default-deny posture as every karaoke table: RLS on,
--     anon/authenticated revoked, the server (service_role) is the only writer and
--     the authorization boundary (session -> account, resolved per request).
--
-- Rollback (do NOT run in normal operation):
--   drop table if exists public.karaoke_user_saved_songs;

create table if not exists public.karaoke_user_saved_songs (
  id                     uuid primary key default gen_random_uuid(),
  -- The canonical account that owns this saved song. Cascade so a deleted account
  -- takes its library with it.
  account_id             uuid not null
                           references public.karaoke_accounts(id) on delete cascade,
  -- The YouTube video id — the stable song identity. Strict 11-char canonical form
  -- enforced at the DB (the guest request path does not enforce this; My Songs does).
  video_id               text not null
                           check (video_id ~ '^[A-Za-z0-9_-]{11}$'),
  -- Denormalized snapshots captured at save time (mutable across YouTube, so stored).
  title_snapshot         text not null
                           check (char_length(title_snapshot) between 1 and 300),
  artist_snapshot        text
                           check (artist_snapshot is null
                                  or char_length(artist_snapshot) between 1 and 200),
  thumbnail_url_snapshot text
                           check (thumbnail_url_snapshot is null
                                  or char_length(thumbnail_url_snapshot) between 1 and 600),
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);

-- Idempotent save: a given song belongs to a given account at most once. This is
-- also the ON CONFLICT target the save service upserts against.
create unique index if not exists karaoke_user_saved_songs_account_video_idx
  on public.karaoke_user_saved_songs (account_id, video_id);

-- Deterministic, account-scoped list order: newest first, id as a stable tiebreak
-- so equal created_at timestamps never produce a nondeterministic order.
create index if not exists karaoke_user_saved_songs_account_order_idx
  on public.karaoke_user_saved_songs (account_id, created_at desc, id desc);

-- RLS: default-deny, exactly like every other karaoke table. service_role bypasses
-- RLS; anon / authenticated get NOTHING. No permissive account policy is added —
-- the server layer (session -> account) remains the only authorization boundary.
alter table public.karaoke_user_saved_songs enable row level security;
revoke all on public.karaoke_user_saved_songs from anon, authenticated;
