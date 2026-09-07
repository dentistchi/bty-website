-- Copy-friendly (LF, no trailing spaces). Select all to copy.
-- ===========================================================================
-- IDENTITY / MIGRATION INTEGRITY RECONCILIATION V1.
--
-- Three production debts found during the Track / Today work. NO product
-- feature, NO data mutation, NO history rewriting. Every existing row survives
-- this file untouched: it contains no INSERT, no UPDATE, no DELETE and no
-- TRUNCATE against any table.
--
-- ★ IT DOES NOT EDIT HISTORY. `20260907000000` is already recorded as applied in
-- production and stays exactly as written -- historical migrations are
-- provenance, not a mutable description of the present. This file converges the
-- CURRENT shape forward instead.
--
-- ROLLBACK (all three sections, in reverse):
--   -- 3. privileges
--   grant delete on public.bty_tracked_announcements to service_role;
--   grant delete on public.bty_tracked_announcement_recipients to service_role;
--   -- 2. recipient binding constraint
--   alter table public.bty_tracked_announcement_recipients
--     drop constraint if exists bty_tracked_recip_bound_when_user_check;
--   alter table public.bty_tracked_announcement_recipients
--     add constraint bty_tracked_recip_bound_pair_check
--     check ((user_id is null) = (bound_at is null));
--   -- 1. nothing to roll back: it only removes overloads that must not exist.
-- ===========================================================================


-- ===========================================================================
-- 1. TRACK RPC -- CONVERGE ON EXACTLY ONE OVERLOAD.
--
-- ★ THE DIVERGENCE, MEASURED.
--
--   repo 20260902  created  (uuid, uuid, text, text, text, text[])
--   repo 20260907  drops that one, then creates
--                           (uuid, uuid, text, text, text, text[], text)
--                  -- p_service_url LAST, WITH a default
--   PRODUCTION carries      (uuid, uuid, text, text, text, text, text[])
--                  -- p_service_url SIXTH, NO default
--
-- Production was verified directly on 2026-09-06: PostgREST resolves exactly one
-- `bty_track_announcement`, its parameter set includes `p_service_url`, and the
-- six-argument call the repo's own history would produce is NOT resolvable --
-- which also proves the live `p_service_url` has no default, since a default
-- would have let the shorter call bind.
--
-- ★ WHY THIS MATTERS MORE THAN IT LOOKS. `create or replace function` matches on
-- the IDENTITY ARGUMENT LIST. A file declaring the wrong ORDER does not replace
-- anything -- it adds a SECOND overload. Both then accept the same NAMED
-- arguments PostgREST sends, so Track becomes ambiguous in production while
-- every local test stays green. `20260912` installed a fail-closed gate that
-- REFUSES that situation; this file is the deliberate reconciliation the gate
-- asks a person to perform.
--
-- ★ IT NEVER GUESSES. The canonical overload must already exist -- this file
-- does not define the function, `20260912` does, and re-declaring the body here
-- would create a second place for the contract to drift. Only the two shapes
-- this repository is KNOWN to have produced are removed, identified by argument
-- TYPES (which is exactly what `create or replace` matches on). Any other shape
-- aborts the migration rather than being dropped on a hunch: an unrecognised
-- overload is somebody else's work, and Track may be calling it.
--
-- ★ RE-ENTRANT. On production today it finds one canonical overload, no known
-- wrong shapes and nothing unexpected, so it does nothing and passes.
-- ===========================================================================
do $$
declare
  -- What production has, and what `20260912` creates.
  c_canonical constant text := 'uuid, uuid, text, text, text, text, text[]';
  -- Only shapes THIS repository is known to have produced. Nothing else.
  c_known_wrong constant text[] := array[
    'uuid, uuid, text, text, text, text[], text',  -- repo 20260907
    'uuid, uuid, text, text, text, text[]'         -- repo 20260902
  ];
  v_ident text;
  v_oid oid;
  v_canonical integer := 0;
  v_unknown text := '';
  v_dropped text := '';
begin
  -- Count the canonical overload FIRST. Dropping anything before knowing the
  -- keeper exists could leave Track with no function at all.
  select count(*) into v_canonical
    from pg_catalog.pg_proc p
    join pg_catalog.pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public'
     and p.proname = 'bty_track_announcement'
     and pg_catalog.array_to_string(
           array(select pg_catalog.format_type(t, null)
                   from pg_catalog.unnest(p.proargtypes) as t), ', ') = c_canonical;

  if v_canonical <> 1 then
    raise exception
      using errcode = 'P0001',
            message = 'bty_track_announcement: the canonical overload is not present -- refusing to reconcile',
            detail  = format('expected exactly ONE overload with identity arguments (%s); found %s', c_canonical, v_canonical),
            hint    = 'This file removes stray overloads; it does not define the function. Apply 20260912000000 first.';
  end if;

  -- Now inspect everything else. Known-wrong shapes go; anything unrecognised
  -- stops the migration with its identity named, so a person can look at it.
  for v_oid, v_ident in
    select p.oid,
           pg_catalog.array_to_string(
             array(select pg_catalog.format_type(t, null)
                     from pg_catalog.unnest(p.proargtypes) as t), ', ')
      from pg_catalog.pg_proc p
      join pg_catalog.pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public'
       and p.proname = 'bty_track_announcement'
     order by p.oid
  loop
    if v_ident = c_canonical then
      continue;
    elsif v_ident = any (c_known_wrong) then
      execute format('drop function public.bty_track_announcement(%s)', v_ident);
      v_dropped := v_dropped || chr(10) || '  (' || v_ident || ')';
    else
      v_unknown := v_unknown || chr(10) || '  (' || v_ident || ')';
    end if;
  end loop;

  if v_unknown <> '' then
    raise exception
      using errcode = 'P0001',
            message = 'bty_track_announcement: unrecognised overload -- refusing to drop it',
            detail  = format('canonical (%s) is present, but these are neither canonical nor a shape this repository produced:%s', c_canonical, v_unknown),
            hint    = 'Somebody created this deliberately, and Track may be calling it. Reconcile by hand.';
  end if;

  if v_dropped <> '' then
    raise notice 'bty_track_announcement: removed historical overload(s):%', v_dropped;
  end if;

  -- Belt and braces: whatever the path above, exactly one must remain.
  select count(*) into v_canonical
    from pg_catalog.pg_proc p
    join pg_catalog.pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname = 'bty_track_announcement';

  if v_canonical <> 1 then
    raise exception
      using errcode = 'P0001',
            message = 'bty_track_announcement: reconciliation did not end with exactly one overload',
            detail  = format('found %s', v_canonical);
  end if;
end $$;


-- ===========================================================================
-- 2. ACCOUNT DELETION -- A CONSTRAINT THAT MADE IT IMPOSSIBLE.
--
-- ★ THE CONTRADICTION, EXACTLY.
--
--   bty_tracked_announcement_recipients.user_id
--     references auth.users (id) ON DELETE SET NULL
--   bty_tracked_recip_bound_pair_check
--     check ((user_id is null) = (bound_at is null))
--
-- Deleting a bound person's account makes the FK set `user_id` to NULL. The FK
-- action cannot also clear `bound_at`, so the CHECK sees (NULL, <timestamp>) and
-- rejects it. The DELETE fails. `DELETE /api/admin/users` -> `auth.admin
-- .deleteUser` is a real, reachable path, so this is not theoretical: today an
-- account cannot be deleted once that person has been tracked and has entered
-- BTY. As of 2026-09-06 production holds 8 such bound recipients.
--
-- ★ WHAT `bound_at` ACTUALLY MEANS TODAY -- MEASURED, NOT ASSUMED.
--
-- It is read by NOTHING. Not one predicate in any migration, and not one line of
-- application code, reads `bound_at`. It is written in exactly one place (the
-- binder) and consulted nowhere. Every authority decision in the system asks
-- `user_id`: the binder's own never-re-point guard (`r.user_id is null`), the
-- partial index that finds unbound rows, the recipient response path
-- (`r.user_id = p_user_id`), and the thread role resolver.
--
-- So `user_id` is the CURRENT binding authority and `bound_at` is an
-- observability fact: WHEN this row was attached to an account. The old CHECK
-- was pairing the two as if either could be authority.
--
-- ★ THE CONTRACT CHOSEN: PRESERVE THE PERSON'S HISTORY, DROP THE ACCOUNT LINK.
--
-- Deleting an account makes the recipient row UNBOUND. The row survives, and so
-- do the announcement, the response, the question they asked, and the whole
-- conversation. This is the precedent the schema already set twice --
-- `recipients.user_id` and `thread_messages.author_user_id` are both
-- `on delete set null`, and `author_role` is NOT NULL precisely so a deleted
-- account cannot make half a discussion unattributable to the person still
-- reading it.
--
-- The alternative -- cascade the recipient row away -- would delete the thread
-- with it and remove one side of a two-party conversation from the OTHER
-- person's history. That is an erasure contract, and it deserves its own review
-- rather than arriving as a side effect of an FK clause.
--
-- ★ AND `bound_at` STAYS HISTORICAL. Nulling it would destroy the only record
-- that this row was ever attached to anyone, to satisfy a constraint that
-- nothing reads. The new invariant is the one-directional half that was always
-- the real point:
--
--     user_id is not null  ->  bound_at is not null      (a binding has a moment)
--     user_id is null      ->  bound_at may be either    (never bound / no longer bound)
--
-- The new constraint is strictly WEAKER than the old one, so no existing row can
-- violate it and validation cannot fail.
--
-- ★ REBINDING STILL WORKS, AND STILL CANNOT STEAL A ROW. An unbound row re-enters
-- the partial index `where user_id is null`, and the binder matches on
-- tenant_id + aad_object_id -- never email, UPN or display name -- while
-- refusing any row that is already bound. So if the same Microsoft identity
-- activates again it re-attaches to the SAME recipient row, keeping the same
-- thread, and `bound_at` moves to the new binding moment.
-- ===========================================================================
alter table public.bty_tracked_announcement_recipients
  drop constraint if exists bty_tracked_recip_bound_pair_check;

do $$
begin
  if not exists (
    select 1 from pg_catalog.pg_constraint
     where conname = 'bty_tracked_recip_bound_when_user_check'
       and conrelid = 'public.bty_tracked_announcement_recipients'::regclass
  ) then
    alter table public.bty_tracked_announcement_recipients
      add constraint bty_tracked_recip_bound_when_user_check
      check (user_id is null or bound_at is not null);
  end if;
end $$;

comment on column public.bty_tracked_announcement_recipients.bound_at is
  'WHEN this row was attached to a BTY account. Observability, not authority -- nothing reads it to decide anything; `user_id` is the current binding. It is deliberately NOT cleared when an account is deleted, so the row still records that it was once bound. A non-null bound_at with a null user_id means "no longer bound", which is a different fact from "never bound".';

comment on column public.bty_tracked_announcement_recipients.user_id is
  'The CURRENT binding, and the only authority for it. NULL means not bound: either never activated, or the account was deleted (the FK is ON DELETE SET NULL, and the recipient row, the response and the conversation all survive that). Binding is by tenant_id + aad_object_id and an already-bound row is never re-pointed.';


-- ===========================================================================
-- 3. PRIVILEGES -- ORDINARY APPLICATION AUTHORITY CANNOT DELETE TRACK EVIDENCE.
--
-- ★ WHY THIS IS HERE AND NOT A SEPARATE CONCERN.
--
-- Today's "remove from my Today" hides a card by comparing the card's MONOTONIC
-- activity count against the count recorded at dismissal. Monotonic means it
-- only ever rises -- and it does, because thread messages are append-only and
-- first responses are write-once. But a count can also fall if the ROWS are
-- deleted, and a Track card whose activity count fell below an existing
-- `dismissed_activity_version` would be hidden from its owner permanently while
-- still existing.
--
-- ★ MEASURED: NO APPLICATION PATH DELETES ANY OF THIS. Across the whole
-- repository there is not one DELETE against `bty_tracked_announcements`,
-- `bty_tracked_announcement_recipients` or the thread tables -- the service
-- layer uses only `select`, `insert`, `update` and `rpc` on them. But
-- `20260902`'s revoke named only anon/public/authenticated, so Supabase's
-- default privileges left `service_role` holding ALL, and an explicit
-- `grant ... delete` was then layered on top. The capability was real and
-- nothing needed it.
--
-- ★ THIS IS NARROWING, NOT SEALING. The goal is not "nothing can ever delete" --
-- it is that ORDINARY application authority cannot silently break the
-- assumption Today relies on. Two paths are deliberately unaffected:
--
--   * FK cascades still work. Referential-integrity actions are performed by the
--     system on behalf of the constraint, not by the deleting role, so removing
--     an announcement still removes its recipients and their threads.
--   * SECURITY DEFINER functions still work. They execute as their owner, so
--     every existing RPC is untouched by this.
--
-- A deliberate lifecycle or admin deletion path, if the product ever wants one,
-- belongs in a named SECURITY DEFINER function with its own review -- not in a
-- table-wide grant that every line of service code inherits.
--
-- ★ service_role IS NAMED IN THE REVOKE. Omitting it is what left ALL standing
-- in the first place; a revoke that does not name it enforces nothing here.
-- TRUNCATE, REFERENCES and TRIGGER go with it and are not re-granted.
-- ===========================================================================
revoke all on public.bty_tracked_announcements from anon, public, authenticated, service_role;
revoke all on public.bty_tracked_announcement_recipients from anon, public, authenticated, service_role;

grant select, insert, update on public.bty_tracked_announcements to service_role;
grant select, insert, update on public.bty_tracked_announcement_recipients to service_role;

comment on table public.bty_tracked_announcements is
  'Slice A1 -- a Host''s tracked announcement. service_role holds select/insert/update and deliberately NOT delete: Today''s dismissal resurfacing assumes a card''s activity count never falls, and no application path has ever needed to delete one. Deletion remains available to FK cascades and to SECURITY DEFINER functions, which run as owner.';
