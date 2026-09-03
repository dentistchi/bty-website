-- ===========================================================================
-- TRACK ROUTING COORDINATE — service_url. Slice A0.1.
-- ADDITIVE. One nullable column and one function signature widened by a
-- DEFAULTED parameter. No existing column, constraint, grant, policy or row is
-- altered or deleted, and NOTHING is backfilled.
--
-- ORDERING: 20260907, after 20260906. The ledger was reconciled through
-- 20260906000000; this is the next version and the only new one.
--
-- WHY THIS EXISTS. A Host can Track a message and manage each recipient, but a
-- recipient who has never opened BTY is never told anything was sent. Sending
-- them a Teams message needs a Bot Framework ROUTING URL, and BTY has never
-- kept one: `serviceUrl` arrives on the invoke and is discarded. This slice
-- captures it. It sends nothing.
--
-- WHY IT IS NULLABLE AND NEVER BACKFILLED. Every announcement tracked before
-- this migration was created without the coordinate ever being observed. NULL
-- says exactly that -- "never observed" -- and it is the truth. A default, a
-- guessed regional endpoint copied out of a sample, or a value borrowed from a
-- newer row would all be fabricated routing data pointing at a real network,
-- and the first proof of the mistake would be a message delivered to the wrong
-- place or to nobody. Historical rows stay NULL forever.
--
-- ===========================================================================
-- THE SIGNATURE CHANGE IS DELIBERATELY BACKWARD-COMPATIBLE.
--
-- `p_service_url` is added LAST and DEFAULTED, so a caller that passes the
-- original six arguments still resolves to this function and stores NULL. That
-- is what makes this migration safe to apply BEFORE the code that uses it is
-- deployed: the currently-deployed Track keeps working unchanged during the
-- window between apply and deploy. The reverse order -- a required parameter --
-- would take Track down for exactly that window.
--
-- The six-argument function is DROPPED rather than left beside this one.
-- Leaving both would create an overload pair distinguished only by an argument
-- PostgREST is free to omit, and "which function ran" would become a question
-- about request shape. One function, one behaviour.
--
-- ROLLBACK:
--   drop function if exists public.bty_track_announcement(uuid, uuid, text, text, text, text[], text);
--   -- then re-create the 6-argument body from 20260902000000, and:
--   alter table public.bty_tracked_announcements drop column if exists service_url;
-- ===========================================================================

alter table public.bty_tracked_announcements
  add column if not exists service_url text;

comment on column public.bty_tracked_announcements.service_url is
  'Trusted Bot Framework routing base URL, captured at Track time from the invoke that had already passed Bot Framework JWT verification. Never client-chosen, never defaulted, never backfilled. NULL means the coordinate was never observed for this announcement -- which is true of every row tracked before 2026-09-03 -- and NULL must be read as "we cannot route", never as "use the usual endpoint".';

-- ---------------------------------------------------------------------------
-- The six-argument form is retired. See the note above on why an overload pair
-- is worse than a replacement.
-- ---------------------------------------------------------------------------
drop function if exists public.bty_track_announcement(uuid, uuid, text, text, text, text[]);

create or replace function public.bty_track_announcement(
  p_owner_user_id uuid,
  p_source_capture_id uuid,
  p_host_framing text,
  p_tenant_id text,
  p_conversation_id text,
  p_recipient_oids text[],
  p_service_url text default null
)
returns table (announcement_id uuid, resolved_count integer, already_existed boolean)
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
#variable_conflict use_column
declare
  v_id uuid;
  v_tenant text := lower(btrim(coalesce(p_tenant_id, '')));
  v_oids text[];
  v_count integer;
  -- SEPARATE variables for the existing-run probe, deliberately.
  -- `SELECT ... INTO` assigns NULL to its targets when NO row matches, so reusing
  -- `v_count` there clobbered the audience size to NULL on the ordinary
  -- create path and the INSERT then failed its NOT NULL. Caught on a disposable
  -- PostgreSQL 17 stack before this file was ever applied anywhere real.
  v_existing_id uuid;
  v_existing_count integer;
  -- Empty string is not a routing URL. Normalising it to NULL here means the
  -- column has ONE spelling for "not observed" and a later "is not null" test
  -- cannot be fooled by ''.
  v_service_url text := nullif(btrim(coalesce(p_service_url, '')), '');
begin
  if p_owner_user_id is null or p_source_capture_id is null then
    raise exception 'missing_identity' using errcode = 'P0001';
  end if;
  if char_length(btrim(coalesce(p_host_framing, ''))) not between 1 and 1000 then
    raise exception 'invalid_framing' using errcode = 'P0001';
  end if;
  if v_tenant = '' or btrim(coalesce(p_conversation_id, '')) = '' then
    raise exception 'missing_source_context' using errcode = 'P0001';
  end if;

  -- A stored routing URL must be an absolute https origin. The caller already
  -- validates this; the rule is repeated here because this function is the
  -- only writer, and a guard that lives only in the caller is a guard that a
  -- second caller will not have. NOT a hard refusal: routing metadata must
  -- never be able to stop a Host from tracking. Unusable input becomes NULL.
  if v_service_url is not null and v_service_url !~* '^https://[a-z0-9.-]+(:[0-9]+)?(/|$)' then
    v_service_url := null;
  end if;

  -- Canonicalize and DEDUPE the selection. The picker can return the same person
  -- twice (a preselected value re-picked), and a duplicate would inflate the
  -- denominator against a set that cannot contain them twice.
  select array_agg(distinct lower(btrim(o)))
    into v_oids
    from unnest(coalesce(p_recipient_oids, array[]::text[])) as o
   where btrim(coalesce(o, '')) <> ''
     and lower(btrim(o)) ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';

  v_count := coalesce(array_length(v_oids, 1), 0);
  if v_count < 1 then
    -- An announcement with no audience has no question to answer.
    raise exception 'zero_recipients' using errcode = 'P0001';
  end if;

  -- Already tracked by this Host for this source → return it, create nothing.
  --
  -- ★ AND DO NOT REWRITE ITS service_url. A retry, a double tap and a slow
  -- client all arrive here, and none of them is evidence that the routing
  -- coordinate CHANGED -- only that the same Track happened again. Overwriting
  -- would let the newest request silently re-point an announcement that may
  -- already have been notified against the old coordinate. An existing run is
  -- returned exactly as it stands; a historical NULL therefore stays NULL, and
  -- moving one is a deliberate future decision with its own evidence, not a
  -- side effect of pressing Track twice.
  select a.id, a.resolved_count into v_existing_id, v_existing_count
    from public.bty_tracked_announcements a
   where a.owner_user_id = p_owner_user_id
     and a.source_capture_id = p_source_capture_id;
  if v_existing_id is not null then
    return query select v_existing_id, v_existing_count, true;
    return;
  end if;

  insert into public.bty_tracked_announcements
    (owner_user_id, source_capture_id, host_framing, audience_source,
     resolved_count, status, tenant_id, conversation_id, service_url)
  values
    (p_owner_user_id, p_source_capture_id, btrim(p_host_framing), 'teams_people_picker',
     v_count, 'active', v_tenant, btrim(p_conversation_id), v_service_url)
  returning id into v_id;

  insert into public.bty_tracked_announcement_recipients
    (announcement_id, tenant_id, aad_object_id)
  select v_id, v_tenant, o from unnest(v_oids) as o;

  -- The denominator is the row count that actually committed, never the input
  -- length. They agree here; asserting it means they cannot silently diverge.
  select count(*) into v_count
    from public.bty_tracked_announcement_recipients r
   where r.announcement_id = v_id;
  update public.bty_tracked_announcements set resolved_count = v_count where id = v_id;

  return query select v_id, v_count, false;
end;
$$;

revoke all on function public.bty_track_announcement(uuid, uuid, text, text, text, text[], text) from public, anon, authenticated;
grant execute on function public.bty_track_announcement(uuid, uuid, text, text, text, text[], text) to service_role;

comment on function public.bty_track_announcement(uuid, uuid, text, text, text, text[], text) is
  'Create a tracked announcement and its recipient rows in one transaction, or return the existing run for this owner and source capture. p_service_url is optional trusted Bot Framework routing data stored ONLY on creation: an existing run is never re-pointed by a repeat Track.';
