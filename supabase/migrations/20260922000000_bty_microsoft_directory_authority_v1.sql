-- Additive Microsoft directory authority. No BTY auth users are created or deleted.
create table if not exists public.bty_microsoft_directory_authority (
  tenant_id text not null,
  aad_object_id text not null,
  linked_user_id uuid references auth.users(id) on delete set null,
  account_enabled boolean not null,
  user_type text not null,
  job_title text,
  employee_type text,
  is_provider boolean not null default false,
  is_manager boolean not null default false,
  sync_status text not null check (sync_status in ('success','indeterminate')),
  last_seen_at timestamptz not null,
  synced_at timestamptz not null,
  updated_at timestamptz not null default now(),
  primary key (tenant_id, aad_object_id)
);
create index if not exists bty_microsoft_directory_authority_link_idx on public.bty_microsoft_directory_authority(linked_user_id);
create index if not exists bty_microsoft_directory_authority_author_idx on public.bty_microsoft_directory_authority(is_provider,is_manager) where sync_status='success' and account_enabled=true and lower(user_type)='member';
alter table public.bty_microsoft_directory_authority enable row level security;
revoke all on public.bty_microsoft_directory_authority from public, anon, authenticated;
