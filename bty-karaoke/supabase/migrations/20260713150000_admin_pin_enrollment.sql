-- Copy-friendly (LF, no trailing spaces). Select all to copy.
-- btyNorebang — Admin device enrollment V1 (STEP 0.6, approved).
-- Additive + idempotent; safe to re-run; no data rewrite.
--
--   1. karaoke_rooms.admin_pin_hash / admin_pin_updated_at
--        admin_pin_hash holds a SELF-DESCRIBING encoded string
--        pbkdf2_sha256$<iterations>$<salt_b64url>$<hash_b64url>
--        so the KDF/iterations/salt can be upgraded without a schema change.
--   2. karaoke_admin_setup_tokens — a PURPOSE-ISOLATED one-time setup-nonce table
--        (NOT the DJ pairing table). No role/label; the table itself is the
--        discriminator, so a setup nonce can never be redeemed by a DJ endpoint.
--   3. redeem_admin_setup() — ONE transactional RPC: atomically consume the
--        nonce + set the room PIN hash + mint the role='admin' device. It
--        receives ONLY pre-hashed values (raw PIN and raw device token never
--        reach Postgres). Locked to service_role; search_path pinned.
--
-- Rate-limit state is ephemeral in Cloudflare KV (HMAC-pseudonymized), NOT here.

create extension if not exists pgcrypto;

-- 1. Durable Admin PIN on the room --------------------------------------------
alter table public.karaoke_rooms
  add column if not exists admin_pin_hash       text,
  add column if not exists admin_pin_updated_at timestamptz;

-- 2. Isolated one-time admin-setup nonce table --------------------------------
create table if not exists public.karaoke_admin_setup_tokens (
  id                 uuid primary key default gen_random_uuid(),
  room_id            uuid not null references public.karaoke_rooms(id) on delete cascade,
  token_hash         text not null unique,
  expires_at         timestamptz not null,
  created_at         timestamptz not null default now(),
  redeemed_at        timestamptz,
  redeemed_device_id uuid references public.karaoke_dj_devices(id) on delete set null
);

create index if not exists karaoke_admin_setup_tokens_room_idx
  on public.karaoke_admin_setup_tokens (room_id, expires_at);

-- RLS default-deny (only the server's service_role touches it).
alter table public.karaoke_admin_setup_tokens enable row level security;
revoke all on public.karaoke_admin_setup_tokens from anon, authenticated;

-- 3. Atomic redeem RPC --------------------------------------------------------
-- All three writes commit together (a function body is one transaction) or roll
-- back together. Returns the new device id, or NULL when the nonce is
-- missing / already used / expired (caller then returns the uniform failure).
create or replace function public.redeem_admin_setup(
  p_room_id           uuid,
  p_token_hash        text,
  p_pin_hash          text,
  p_device_label      text,
  p_device_token_hash text
) returns uuid
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_token_id  uuid;
  v_device_id uuid;
begin
  -- Conditionally consume the valid, unredeemed, unexpired setup nonce.
  update public.karaoke_admin_setup_tokens
     set redeemed_at = now()
   where room_id = p_room_id
     and token_hash = p_token_hash
     and redeemed_at is null
     and expires_at > now()
   returning id into v_token_id;

  if v_token_id is null then
    return null;
  end if;

  -- Persist the (already-hashed) Admin PIN on the room.
  update public.karaoke_rooms
     set admin_pin_hash = p_pin_hash,
         admin_pin_updated_at = now()
   where id = p_room_id;

  -- Mint the revocable role='admin' device (only its token HASH is stored).
  insert into public.karaoke_dj_devices (room_id, role, label, token_hash, status)
       values (p_room_id, 'admin', p_device_label, p_device_token_hash, 'active')
    returning id into v_device_id;

  update public.karaoke_admin_setup_tokens
     set redeemed_device_id = v_device_id
   where id = v_token_id;

  return v_device_id;
end;
$$;

-- Lock the RPC to the server's service_role only; the browser must never call it.
revoke all on function public.redeem_admin_setup(uuid, text, text, text, text)
  from public, anon, authenticated;
grant execute on function public.redeem_admin_setup(uuid, text, text, text, text)
  to service_role;
