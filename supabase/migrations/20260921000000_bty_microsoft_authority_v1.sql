-- Microsoft professional authority. Additive only: no historical rows are changed or deleted.
create table if not exists public.bty_microsoft_authority_snapshots (
  user_id uuid primary key references auth.users(id) on delete cascade,
  tenant_id text not null,
  aad_object_id text not null,
  job_title text,
  employee_type text,
  is_provider boolean not null default false,
  is_manager boolean not null default false,
  sync_status text not null check (sync_status in ('success', 'indeterminate')),
  synced_at timestamptz not null,
  updated_at timestamptz not null default now(),
  unique (tenant_id, aad_object_id)
);
create index if not exists bty_microsoft_authority_snapshots_author_idx
  on public.bty_microsoft_authority_snapshots (is_provider, is_manager) where sync_status = 'success';
alter table public.bty_microsoft_authority_snapshots enable row level security;
revoke all on public.bty_microsoft_authority_snapshots from public, anon, authenticated;

create table if not exists public.bty_microsoft_tenant_org_bindings (
  tenant_id text primary key,
  organization_id uuid not null references public.bty_organizations(id) on delete restrict,
  status text not null default 'active' check (status in ('active', 'inactive')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.bty_microsoft_tenant_org_bindings enable row level security;
revoke all on public.bty_microsoft_tenant_org_bindings from public, anon, authenticated;

create or replace function public.bty_foundry_resolve_or_create_program(
  p_actor_user_id uuid, p_title text, p_program_id uuid default null
) returns table (program_id uuid)
language plpgsql security definer set search_path = pg_catalog, public
as $$
declare v_org uuid; v_count int; v_prog_org uuid; v_new uuid; v_title text; v_tenant text;
begin
  select count(*) into v_count from public.bty_org_memberships om where om.user_id=p_actor_user_id and om.status='active' and om.is_primary=true;
  if v_count > 1 then raise exception 'organization_ambiguous' using errcode='P0001'; end if;
  select om.organization_id into v_org from public.bty_org_memberships om where om.user_id=p_actor_user_id and om.status='active' and om.is_primary=true limit 1;
  -- Only a successful Microsoft author snapshot may use the verified tenant binding.
  if v_org is null then
    select s.tenant_id into v_tenant from public.bty_microsoft_authority_snapshots s
      where s.user_id=p_actor_user_id and s.sync_status='success' and (s.is_provider or s.is_manager) limit 1;
    if v_tenant is not null then select b.organization_id into v_org from public.bty_microsoft_tenant_org_bindings b where b.tenant_id=v_tenant and b.status='active'; end if;
  end if;
  if p_program_id is not null then
    select fp.organization_id into v_prog_org from public.foundry_programs fp where fp.id=p_program_id;
    if not found then raise exception 'program_missing' using errcode='P0002'; end if;
    if v_org is null or v_prog_org is distinct from v_org then raise exception 'cross_organization' using errcode='P0001'; end if;
    program_id:=p_program_id; return next; return;
  end if;
  if v_org is null then raise exception 'organization_unresolved' using errcode='P0002'; end if;
  v_title:=btrim(coalesce(p_title,'')); if v_title='' then v_title:='Untitled Program'; end if; if char_length(v_title)>120 then v_title:=left(v_title,120); end if;
  insert into public.foundry_programs (organization_id, owner_user_id, owner_user_id_snapshot, title) values (v_org,p_actor_user_id,p_actor_user_id,v_title) returning id into v_new;
  program_id:=v_new; return next;
end; $$;
revoke execute on function public.bty_foundry_resolve_or_create_program(uuid,text,uuid) from public, anon, authenticated;
grant execute on function public.bty_foundry_resolve_or_create_program(uuid,text,uuid) to service_role;
