-- Allow an account without an organization to create an owner-scoped Program.
-- An absent organization still produces a durable Program ID for every new training.
begin;

alter table public.foundry_programs alter column organization_id drop not null;

create or replace function public.bty_foundry_resolve_or_create_program(
  p_actor_user_id uuid,
  p_title text,
  p_program_id uuid default null
)
returns table (program_id uuid)
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  v_memberships uuid[];
  v_org uuid;
  v_program public.foundry_programs%rowtype;
  v_title text;
begin
  v_memberships := array(
    select om.organization_id
    from public.bty_org_memberships om
    where om.user_id = p_actor_user_id and om.status = 'active' and om.is_primary
    limit 2
  );
  if cardinality(v_memberships) > 1 then
    raise exception 'organization_ambiguous' using errcode = 'P0001';
  end if;
  v_org := v_memberships[1];

  -- Preserve verified tenant binding for Microsoft providers and managers.
  if v_org is null then
    select b.organization_id into v_org
    from public.bty_microsoft_authority_snapshots s
    join public.bty_microsoft_tenant_org_bindings b on b.tenant_id = s.tenant_id
    where s.user_id = p_actor_user_id and s.sync_status = 'success'
      and (s.is_provider or s.is_manager) and b.status = 'active';
  end if;

  if p_program_id is not null then
    select fp.* into v_program from public.foundry_programs fp where fp.id = p_program_id;
    if not found then
      raise exception 'program_missing' using errcode = 'P0002';
    end if;

    if v_program.organization_id is null then
      if v_program.owner_user_id is distinct from p_actor_user_id
         or v_program.owner_user_id_snapshot is distinct from p_actor_user_id then
        raise exception 'program_missing' using errcode = 'P0002';
      end if;
    elsif v_program.organization_id is distinct from v_org then
      raise exception 'cross_organization' using errcode = 'P0001';
    end if;

    program_id := p_program_id;
    return next;
    return;
  end if;

  v_title := left(coalesce(nullif(btrim(p_title), ''), 'Untitled Program'), 120);
  insert into public.foundry_programs (organization_id, owner_user_id, owner_user_id_snapshot, title)
  values (v_org, p_actor_user_id, p_actor_user_id, v_title)
  returning id into program_id;
  return next;
end;
$$;

revoke execute on function public.bty_foundry_resolve_or_create_program(uuid, text, uuid) from public, anon, authenticated;
grant execute on function public.bty_foundry_resolve_or_create_program(uuid, text, uuid) to service_role;

commit;
