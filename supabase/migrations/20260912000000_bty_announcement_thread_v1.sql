-- Copy-friendly (LF, no trailing spaces). Select all to copy.
-- ===========================================================================
-- TRACK — CONTINUOUS TWO-WAY CONVERSATION V1. ADDITIVE ONLY.
--
-- Two new tables, no new columns on any existing table, three new functions,
-- and TWO existing function bodies replaced:
--
--   bty_respond_to_announcement   signature, return shape and every existing
--                                 result string unchanged
--   bty_track_announcement        signature and return shape unchanged; the
--                                 Host is now excluded from their own audience
--
-- No existing column, constraint, grant, policy or ROW is altered or deleted.
-- No historical backfill: a thread that has no messages had no messages.
--
-- ---------------------------------------------------------------------------
-- ★ REVISION 2 — WHAT THE PRODUCTION AUDIT CHANGED, AND WHY.
--
-- R1 of this file used two timestamp columns (`host_last_read_at`,
-- `recipient_last_read_at`) as the unread authority. THAT IS UNSOUND, and the
-- race is not theoretical:
--
--     T1  begin           -- now() freezes at 10:00:00
--     T1  insert message M with created_at = 10:00:00, DOES NOT COMMIT
--     T2  begin           -- 10:00:05
--     T2  read thread     -- M is invisible; the reader never sees it
--     T2  set cursor = 10:00:05
--     T1  commit          -- M lands, still stamped 10:00:00
--     ==> M.created_at (10:00:00) < cursor (10:00:05), FOREVER.
--
-- The message is classified as already-read by a person who could not
-- physically have seen it, and no later action repairs it — the cursor only
-- moves forward. A person waiting on an answer is silently never answered.
-- `clock_timestamp()`, a sequence, or any other monotonic proxy fails the same
-- way, because the defect is commit order versus stamp order, not resolution.
--
-- So unread is now PER-MESSAGE READ RECEIPTS. A receipt can only be written for
-- a message the writer's snapshot could actually see, so an invisible message
-- gets no receipt and remains unread. Proven against real PostgreSQL 17 in
-- `src/lib/bty/announcement/threadPostgres.pg.test.ts`, which drives two
-- concurrent sessions through exactly the interleaving above.
--
-- The two timestamp columns are GONE from this file rather than added and then
-- dropped: production is verified through 20260911000000 and both columns are
-- ABSENT there, so there is nothing to migrate away from.
-- ---------------------------------------------------------------------------
--
-- ★ THE CONVERSATION UNIT IS THE RECIPIENT, NOT THE ANNOUNCEMENT.
--
-- A tracked announcement has MANY recipients. Measured in this schema: the
-- audience is a SET, keyed `unique (announcement_id, tenant_id, aad_object_id)`,
-- and every response, question, handled state and notification lease already
-- lives on the RECIPIENT row rather than the run. A thread hung off
-- `announcement_id` would therefore be a group chat that nobody asked for:
--
--     one announcement
--     ├── Recipient A → Thread A     A must never see B's or C's
--     ├── Recipient B → Thread B
--     └── Recipient C → Thread C
--
-- Person B asking "I don't understand the pay change" would become something
-- A and C could read, in a product whose entire existing privacy posture is
-- that a recipient is told the Host's framing and NOTHING about anyone else.
-- So `recipient_id` is the FK, it is NOT NULL, and there is no announcement
-- column on the message table at all — the isolation is structural, not a
-- filter a later query can forget.
--
-- ★ THE AUTHOR'S ROLE IS DERIVED HERE, NEVER SUPPLIED.
--
-- `author_role` is written by `bty_post_announcement_thread_message`, which
-- joins the recipient to its announcement and decides:
--
--     announcement.owner_user_id = actor   -> HOST
--     recipient.user_id          = actor   -> RECIPIENT
--     neither                              -> not_found, and nothing is written
--
-- A client cannot pass a role, and there is no code path on which one is read
-- from a request. The column exists so that "who said this" survives account
-- deletion, and so unread can be computed without re-joining.
--
-- ★ A PERSON IS NEVER BOTH PARTIES — ENFORCED AT TRACK CREATION (section 7).
--
-- R1 claimed a Host could legitimately be in their own audience and that "owner
-- wins". That produced an IMPOSSIBLE THREAD: the resolver would call them HOST,
-- while the first-response bridge hardcodes the first message as RECIPIENT — so
-- their own question would render as the other party's and count as unread
-- against themselves. Audited: self-selection was REACHABLE (the People Picker
-- value is client-submitted, `parsePickedRecipients` accepts any GUID, and
-- nothing excluded the owner), though production holds ZERO such rows.
--
-- It is now impossible at the source: `bty_track_announcement` drops the Host's
-- own Entra object ids from the audience, and a Host who picked only themselves
-- gets the existing `zero_recipients` refusal. Owner-first in the resolver is
-- retained ONLY as a defensive tie-break for rows that predate this rule; it is
-- no longer a claim that such a row is legitimate.
--
-- ★ PLATFORM ADMIN IS NOT A PARTY TO THESE CONVERSATIONS.
--
-- `bty_platform_admin_grants` is not consulted anywhere in this file. Admin
-- authority in this product grants capability inheritance, not surveillance,
-- and no existing product contract makes a private Host↔Recipient exchange
-- readable by a third person. Adding one silently, inside a conversation
-- feature, would be exactly the wrong place to decide it.
--
-- ROLLBACK:
--   -- restore the 20260902 body of bty_respond_to_announcement and the
--   -- 20260907 body of bty_track_announcement, then:
--   drop function if exists public.bty_mark_announcement_thread_read(uuid, uuid);
--   drop function if exists public.bty_post_announcement_thread_message(uuid, uuid, text, text);
--   drop function if exists public.bty_resolve_announcement_thread_role(uuid, uuid);
--   drop table if exists public.bty_announcement_thread_message_reads;
--   drop table if exists public.bty_announcement_thread_messages;
-- ===========================================================================


-- ---------------------------------------------------------------------------
-- 1. THE MESSAGES.
--
-- LENGTH IS 1000, MEASURED AND NOT INVENTED. It is exactly what this product
-- already allows a person to type about an announcement: `host_framing` is
-- `between 1 and 1000`, `question_text` is `between 1 and 1000`, and the domain
-- constant `QUESTION_TEXT_MAX` is 1000. A reply is the same act of writing as
-- the question that started it, so it gets the same bound rather than a second
-- number somebody has to remember.
--
-- PLAIN TEXT. No HTML is rendered from this column anywhere; there are no
-- attachments, no reactions and no formatting in V1.
-- ---------------------------------------------------------------------------
create table if not exists public.bty_announcement_thread_messages (
  id uuid primary key default gen_random_uuid(),

  -- THE PRIVACY BOUNDARY, AS A FOREIGN KEY. One private two-party thread per
  -- selected person. Cascades with the recipient row, so a conversation cannot
  -- outlive the relationship it belongs to.
  recipient_id uuid not null
    references public.bty_tracked_announcement_recipients (id) on delete cascade,

  -- WHO ACTUALLY WROTE IT. A canonical BTY user id and never an email, a UPN, a
  -- display name or an Entra object id.
  --
  -- ★ NULLABLE, AND `ON DELETE SET NULL`, DELIBERATELY. R1 carried a comment
  -- saying cascade was "deliberately NOT used" over DDL that used cascade — a
  -- contradiction, resolved here in favour of the PRECEDENT this schema already
  -- set: `bty_tracked_announcement_recipients.user_id` is `on delete set null`
  -- for the same reason. Deleting an account must not silently rewrite a
  -- conversation the OTHER person is still part of, removing half a discussion
  -- they are relying on and leaving replies answering questions that no longer
  -- exist. The account link goes; the words, their order, and `author_role`
  -- stay. If the product later adopts an erasure contract, that is a deliberate
  -- migration with its own review — not a side effect of an FK clause.
  author_user_id uuid references auth.users (id) on delete set null,

  -- Derived inside the writer from the announcement's owner, never accepted
  -- from a caller. NOT NULL and never rewritten: it is the historical fact of
  -- which side spoke, and it must survive `author_user_id` becoming NULL —
  -- otherwise a deleted account would make its half of the thread unattributable
  -- and break the unread rule for the person still reading it.
  author_role text not null,

  body text not null,

  -- Optional double-submit guard. Supplied by the client purely as a NONCE: it
  -- names nothing, authorizes nothing, and is scoped under (recipient, author)
  -- below, so one person's key cannot collide with or address another's.
  client_message_id text,

  created_at timestamptz not null default now(),

  constraint bty_ann_thread_role_check
    check (author_role in ('HOST', 'RECIPIENT')),
  constraint bty_ann_thread_body_len_check
    check (char_length(btrim(body)) between 1 and 1000),
  constraint bty_ann_thread_client_key_len_check
    check (client_message_id is null or char_length(client_message_id) between 1 and 100)
);

-- IDEMPOTENCY, SCOPED TO ONE PERSON IN ONE THREAD. Partial, so the ordinary
-- path (no key supplied) costs nothing and is never constrained.
create unique index if not exists bty_ann_thread_client_key_unique
  on public.bty_announcement_thread_messages (recipient_id, author_user_id, client_message_id)
  where client_message_id is not null;

-- The only read shape there is: one thread, oldest first.
--
-- ★ (created_at, id), NOT created_at ALONE. Two messages can share a timestamp
-- — the same transaction stamps `now()` identically, and the first-response
-- bridge deliberately gives the disposition and its first message ONE instant.
-- `created_at` alone is therefore a PARTIAL order, and a partial order sorted
-- twice can come back in two different arrangements, so a conversation could
-- reorder itself between two reads. The id is the tie-break that makes it total.
create index if not exists bty_ann_thread_recipient_created_idx
  on public.bty_announcement_thread_messages (recipient_id, created_at, id);

comment on table public.bty_announcement_thread_messages is
  'Track — the continuing Host <-> Recipient conversation. One PRIVATE thread per bty_tracked_announcement_recipients row, never per announcement: an announcement has many recipients and one of them must never read another''s. Application-append-only: service_role holds SELECT and INSERT only, and no function in this schema updates or deletes a message.';
comment on column public.bty_announcement_thread_messages.author_user_id is
  'The canonical author, or NULL once that account is deleted (ON DELETE SET NULL, matching the precedent on bty_tracked_announcement_recipients.user_id). The message itself survives, because the other party is still part of the conversation.';
comment on column public.bty_announcement_thread_messages.author_role is
  'HOST or RECIPIENT, DERIVED server-side from announcement ownership inside bty_post_announcement_thread_message. Never supplied by a client, never read from a request body, and never rewritten -- it must outlive author_user_id being nulled.';
comment on column public.bty_announcement_thread_messages.client_message_id is
  'Optional client nonce that makes a double-submit return the first message instead of writing a second. Scoped under (recipient_id, author_user_id), so it addresses nothing and names nobody.';

-- Client-deny, exactly like the two tables it hangs off.
revoke all on public.bty_announcement_thread_messages from anon, public, authenticated;
alter table public.bty_announcement_thread_messages enable row level security;

-- ---------------------------------------------------------------------------
-- ★ WHAT "APPEND-ONLY" ACTUALLY MEANS HERE — STATED ACCURATELY.
--
-- R1 claimed a message "cannot be removed — not by a bug, not by a future
-- service function, not by a direct call". That overstated what a grant can do.
-- A SECURITY DEFINER function owned by a superuser or by the table owner runs
-- with THAT role's privileges and is not constrained by what service_role was
-- granted, so this file cannot make a promise about code that does not exist
-- yet. What is actually true and checkable:
--
--   ENFORCED   the application role (service_role) holds SELECT and INSERT and
--              has NO UPDATE and NO DELETE on this table, so no application
--              query -- including a mistaken one -- can edit or remove a
--              message, and no PostgREST call can either.
--   ENFORCED   RLS is on and anon/authenticated are revoked, so no client
--              reaches the table directly at all.
--   ASSERTED   no function in this migration contains an UPDATE or DELETE
--              against this table (guard-tested against the file text).
--   DOCUMENTED lifecycle deletion is the ONLY way a row leaves: the recipient
--              row cascading (which also removes the response it belongs to).
--              Deleting an auth user does NOT delete messages; it nulls
--              author_user_id.
--   NOT CLAIMED a future migration, a superuser, or a definer function owned by
--              postgres can still write anything. Append-only is a property of
--              the code that exists, maintained by review -- not a lock.
-- ---------------------------------------------------------------------------
grant select, insert on public.bty_announcement_thread_messages to service_role;


-- ---------------------------------------------------------------------------
-- 2. PER-MESSAGE READ RECEIPTS — the unread authority.
--
-- ★ WHY A ROW PER MESSAGE INSTEAD OF A TIMESTAMP PER SIDE. See the revision
-- note in the header: a cursor compares a COMMIT-ORDERED event against a
-- STAMP-ORDERED value, and an insert that commits late but stamped early is
-- marked read by someone who never saw it. A receipt cannot be written for a
-- row the writer's snapshot does not contain, so the failure is structurally
-- unreachable rather than merely unlikely.
--
-- The cost is one row per message per reader, on a two-party thread. That is
-- the price of the answer being correct.
--
-- A RECEIPT IS A FACT, NOT A SETTING. There is no un-read: service_role holds
-- SELECT and INSERT here too. Rows leave only by cascade, with the message.
-- ---------------------------------------------------------------------------
create table if not exists public.bty_announcement_thread_message_reads (
  message_id uuid not null
    references public.bty_announcement_thread_messages (id) on delete cascade,

  -- The canonical user who read it. NOT NULL and cascading: a receipt exists to
  -- answer "has THIS person seen it", so one whose person is gone answers
  -- nothing and should not linger.
  reader_user_id uuid not null references auth.users (id) on delete cascade,

  read_at timestamptz not null default now(),

  -- ONE receipt per person per message. This is also the idempotency boundary:
  -- `on conflict do nothing` makes re-opening a thread free and re-entrant, and
  -- makes two concurrent readers safe.
  constraint bty_ann_thread_reads_pk primary key (message_id, reader_user_id)
);

-- "Which of these messages have I read" — the only read shape there is.
create index if not exists bty_ann_thread_reads_reader_idx
  on public.bty_announcement_thread_message_reads (reader_user_id, message_id);

comment on table public.bty_announcement_thread_message_reads is
  'Per-message read truth for Track conversations. Replaces a per-side timestamp cursor, which could mark a concurrently-inserted message as read by someone whose snapshot never contained it. Unread = opposite-party messages in this thread with no receipt for the current user.';

revoke all on public.bty_announcement_thread_message_reads from anon, public, authenticated;
alter table public.bty_announcement_thread_message_reads enable row level security;
grant select, insert on public.bty_announcement_thread_message_reads to service_role;


-- ---------------------------------------------------------------------------
-- 3. WHO IS THIS PERSON IN THIS THREAD? — the single authority resolver.
--
-- DEFAULT DENY. It returns 'HOST', 'RECIPIENT', or 'none'. A wrong Host, a
-- different recipient of the SAME announcement, an unbound person, and a
-- recipient id that does not exist all receive 'none' — deliberately
-- indistinguishable, so possessing or guessing a uuid reveals nothing about
-- whether it names anything.
--
-- ★ OWNER-FIRST IS A DEFENSIVE TIE-BREAK, NOT A SUPPORTED STATE. Section 7 makes
-- a self-recipient impossible to create. This ordering exists so that a row
-- predating that rule (production holds none) resolves DETERMINISTICALLY to one
-- role instead of flipping between two, which is what would produce a thread
-- whose author labels contradict its reader labels.
-- ---------------------------------------------------------------------------
create or replace function public.bty_resolve_announcement_thread_role(
  p_recipient_id uuid,
  p_actor_user_id uuid
)
returns table (role text)
language plpgsql
stable
security definer
set search_path = pg_catalog, public
as $$
#variable_conflict use_column
declare
  v_owner uuid;
  v_recipient uuid;
begin
  if p_recipient_id is null or p_actor_user_id is null then
    return query select 'none'::text; return;
  end if;

  select a.owner_user_id, r.user_id
    into v_owner, v_recipient
    from public.bty_tracked_announcement_recipients r
    join public.bty_tracked_announcements a on a.id = r.announcement_id
   where r.id = p_recipient_id;

  if not found then
    return query select 'none'::text; return;
  end if;

  if v_owner = p_actor_user_id then
    return query select 'HOST'::text; return;
  end if;

  -- `is not distinct from` would make a NULL actor match an unbound row. The
  -- actor is never NULL here (guarded above) and the recipient may be, so plain
  -- equality is the correct and safer comparison: an unbound row matches nobody.
  if v_recipient = p_actor_user_id then
    return query select 'RECIPIENT'::text; return;
  end if;

  return query select 'none'::text;
end;
$$;

revoke all on function public.bty_resolve_announcement_thread_role(uuid, uuid) from public, anon, authenticated;
grant execute on function public.bty_resolve_announcement_thread_role(uuid, uuid) to service_role;

comment on function public.bty_resolve_announcement_thread_role(uuid, uuid) is
  'The ONE authority for a Track conversation. HOST | RECIPIENT | none, decided by joining the recipient to its announcement owner. A non-party is answered ''none'' identically to a missing row, so a thread cannot be probed for existence.';


-- ---------------------------------------------------------------------------
-- 4. POST ONE MESSAGE.
--
-- Authority, validation, idempotency, the insert AND the reopen are ONE
-- transaction. There is no arrangement in which a message is written by a caller
-- whose role was never established, and none in which a message lands while the
-- Host's attention state still says the item is settled.
--
-- ★ A NEW RECIPIENT MESSAGE REOPENS THE ITEM. READ IS NOT HANDLED.
--
-- If a Host marked somebody's question handled and that person then says
-- something else, the item needs attention again — so `handled_at` and
-- `handled_by_user_id` are cleared here, in the same transaction that appends
-- the message. Nothing else is touched: `response`, `responded_at`,
-- `question_text` and every existing message are left exactly as they are.
--
-- A HOST-authored message does NOT reopen the Host's own attention — that would
-- make answering someone put them back on your own list. Opening or reading a
-- thread never marks it handled either; the ONLY way an item becomes settled is
-- the explicit `bty_handle_announcement_recipient`, which is untouched.
-- ---------------------------------------------------------------------------
create or replace function public.bty_post_announcement_thread_message(
  p_recipient_id uuid,
  p_actor_user_id uuid,
  p_body text,
  p_client_message_id text
)
returns table (result text, message_id uuid, author_role text, created_at timestamptz, reopened boolean)
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
#variable_conflict use_column
declare
  v_role text;
  v_body text := btrim(coalesce(p_body, ''));
  v_key text := nullif(btrim(coalesce(p_client_message_id, '')), '');
  v_existing record;
  v_id uuid;
  v_now timestamptz;
  v_reopened boolean := false;
begin
  select r.role into v_role
    from public.bty_resolve_announcement_thread_role(p_recipient_id, p_actor_user_id) as r;

  if v_role is null or v_role = 'none' then
    return query select 'not_found'::text, null::uuid, null::text, null::timestamptz, false; return;
  end if;

  -- Nothing to say is not a message. Checked before the length bound so an
  -- all-whitespace body is 'empty_message' rather than a confusing size error.
  if char_length(v_body) < 1 then
    return query select 'empty_message'::text, null::uuid, null::text, null::timestamptz, false; return;
  end if;
  if char_length(v_body) > 1000 then
    return query select 'message_too_long'::text, null::uuid, null::text, null::timestamptz, false; return;
  end if;
  if v_key is not null and char_length(v_key) > 100 then
    return query select 'invalid_client_key'::text, null::uuid, null::text, null::timestamptz, false; return;
  end if;

  if v_key is not null then
    select m.id, m.author_role, m.created_at
      into v_existing
      from public.bty_announcement_thread_messages m
     where m.recipient_id = p_recipient_id
       and m.author_user_id = p_actor_user_id
       and m.client_message_id = v_key;
    if found then
      -- The same act, seen twice. The first message stands, untouched, and
      -- nothing is reopened: no NEW thing was said.
      return query select 'duplicate'::text, v_existing.id, v_existing.author_role, v_existing.created_at, false;
      return;
    end if;
  end if;

  insert into public.bty_announcement_thread_messages
    (recipient_id, author_user_id, author_role, body, client_message_id)
  values
    (p_recipient_id, p_actor_user_id, v_role, v_body, v_key)
  returning id, created_at into v_id, v_now;

  -- ★ THE REOPEN. Same transaction as the message it is caused by, so an item
  -- can never be settled while an unanswered message from that person exists.
  -- Guarded, so the ordinary case writes nothing at all.
  if v_role = 'RECIPIENT' then
    update public.bty_tracked_announcement_recipients
       set handled_at = null, handled_by_user_id = null
     where id = p_recipient_id
       and handled_at is not null;
    if found then
      v_reopened := true;
    end if;
  end if;

  return query select 'posted'::text, v_id, v_role, v_now, v_reopened;
exception
  when unique_violation then
    -- Two requests carrying the same nonce raced past the lookup. Exactly one
    -- row exists; return it, so the loser sees the same answer as the winner.
    select m.id, m.author_role, m.created_at
      into v_existing
      from public.bty_announcement_thread_messages m
     where m.recipient_id = p_recipient_id
       and m.author_user_id = p_actor_user_id
       and m.client_message_id = v_key;
    if found then
      return query select 'duplicate'::text, v_existing.id, v_existing.author_role, v_existing.created_at, false;
      return;
    end if;
    return query select 'failed'::text, null::uuid, null::text, null::timestamptz, false;
end;
$$;

revoke all on function public.bty_post_announcement_thread_message(uuid, uuid, text, text) from public, anon, authenticated;
grant execute on function public.bty_post_announcement_thread_message(uuid, uuid, text, text) to service_role;

comment on function public.bty_post_announcement_thread_message(uuid, uuid, text, text) is
  'Append one message to a Track conversation. The author''s role is DERIVED from announcement ownership inside this function and is never accepted from a caller; a non-party is refused with not_found. A RECIPIENT message clears handled_at/handled_by_user_id in the SAME transaction, so an item cannot stay settled while an unanswered message exists. Idempotent when a client nonce is supplied.';


-- ---------------------------------------------------------------------------
-- 5. MARK MY OWN SIDE READ — receipts for what I could actually see.
--
-- One function for both parties, because the side to move is not the caller's
-- to choose: it follows from the SAME role resolution the write path uses. A
-- Host can never mark a recipient's messages read on their behalf, and a
-- recipient can never mark the Host's, regardless of what any request says —
-- there is no parameter for it.
--
-- ★ ONLY WHAT THIS SNAPSHOT CONTAINS. The INSERT ... SELECT reads the messages
-- table in this transaction's own snapshot, so a concurrently-inserted,
-- not-yet-committed message is simply not in the result and receives no
-- receipt. When it commits it is still unread — which is the entire point of
-- replacing the timestamp cursor.
--
-- ★ IT DOES NOT HANDLE ANYTHING. Reading is not resolving. This function does
-- not touch `handled_at`, and the only thing that ever sets it is the explicit
-- `bty_handle_announcement_recipient`.
--
-- IDEMPOTENT by the primary key: re-opening a thread inserts nothing new, and
-- two concurrent readers cannot collide.
-- ---------------------------------------------------------------------------
create or replace function public.bty_mark_announcement_thread_read(
  p_recipient_id uuid,
  p_actor_user_id uuid
)
returns table (result text, role text, marked integer)
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
#variable_conflict use_column
declare
  v_role text;
  v_other text;
  v_n integer;
begin
  select r.role into v_role
    from public.bty_resolve_announcement_thread_role(p_recipient_id, p_actor_user_id) as r;

  if v_role is null or v_role = 'none' then
    return query select 'not_found'::text, null::text, 0; return;
  end if;

  -- The side to mark follows from the ROLE. There is no parameter for it, so
  -- neither party can ever mark the other's reading done.
  v_other := case when v_role = 'HOST' then 'RECIPIENT' else 'HOST' end;

  insert into public.bty_announcement_thread_message_reads (message_id, reader_user_id)
  select m.id, p_actor_user_id
    from public.bty_announcement_thread_messages m
   where m.recipient_id = p_recipient_id
     and m.author_role = v_other
  on conflict (message_id, reader_user_id) do nothing;

  get diagnostics v_n = row_count;
  return query select 'read'::text, v_role, v_n;
end;
$$;

revoke all on function public.bty_mark_announcement_thread_read(uuid, uuid) from public, anon, authenticated;
grant execute on function public.bty_mark_announcement_thread_read(uuid, uuid) to service_role;

comment on function public.bty_mark_announcement_thread_read(uuid, uuid) is
  'Write read receipts for the OPPOSITE party''s messages in one Track conversation, for the calling user only. Which side is marked follows from the derived role; there is no parameter for it. Only messages visible in this transaction''s snapshot get a receipt, so a concurrently-committing message stays unread. Never touches handled_at -- reading is not resolving.';


-- ---------------------------------------------------------------------------
-- 6. THE FIRST-RESPONSE BRIDGE — one product action, one transaction.
--
-- ★ WHY THE FUNCTION BODY CHANGES INSTEAD OF THE ROUTE DOING TWO CALLS.
--
-- "I have a question, and here it is" is ONE thing a person did. Recording the
-- disposition through this RPC and then inserting the first message from the
-- service layer would make two outcomes reachable that are both lies:
--
--     response = QUESTION written, message insert fails
--         -> the Host sees a question with an empty conversation, and the
--            response is WRITE-ONCE, so the person can never resubmit it.
--     message written, response write fails
--         -> a message in a thread the funnel says was never answered.
--
-- Both are permanent, because neither half can be retried without the other.
-- So the insert lives HERE, after the update, inside the same function
-- transaction: either the person asked a question and it is in their thread, or
-- neither fact exists and they can ask again.
--
-- ★ WHAT IS UNCHANGED, DELIBERATELY AND COMPLETELY.
--
-- The signature, the return columns, and every result string ('invalid_response',
-- 'question_too_long', 'not_a_recipient', 'already_responded', 'responded'),
-- the write-once rule, the `for update` lock, the not-a-recipient masking, and
-- the rule that non-QUESTION text is discarded. `question_text` is still
-- written to the recipient row: the thread is the CONTINUATION layer, not a
-- replacement for the disposition, and the Host's funnel still reads the column
-- it always read.
--
-- ★ NO REOPEN IS NEEDED HERE, AND NONE IS WRITTEN. This branch only runs when
-- `response` was NULL, and the 20260906 CHECK
-- (`handled_at is null or response in ('QUESTION','HELP_NEEDED')`) makes
-- `handled_at` necessarily NULL in that state. Clearing it would be a write that
-- provably changes nothing.
--
-- ★ THE ROLE IS CONSISTENT WITH SECTION 3, BECAUSE OF SECTION 7. This writes
-- 'RECIPIENT' unconditionally, which is correct precisely because a person can
-- no longer be both parties: the Host is excluded from their own audience at
-- Track creation, so anyone reaching this branch resolves to RECIPIENT.
--
-- ★ HELP_NEEDED WRITES NO MESSAGE, ON PURPOSE. The recipient UI captures no
-- text for it — measured: `NeedsYourResponse` sends HELP_NEEDED straight from
-- the button with `questionText: null`, and the 20260902 CHECK forbids storing
-- text against any response but QUESTION. Manufacturing a first message ("I need
-- help applying this") would put words in a person's mouth that they never
-- typed, inside a conversation their manager reads.
--
-- ★ ACKNOWLEDGED WRITES NO MESSAGE EITHER. "Got it" is already the end of that
-- exchange; the existing semantics are untouched.
-- ---------------------------------------------------------------------------
create or replace function public.bty_respond_to_announcement(
  p_announcement_id uuid,
  p_user_id uuid,
  p_response text,
  p_question_text text
)
returns table (result text, response text, responded_at timestamptz)
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
#variable_conflict use_column
declare
  v_row record;
  v_q text := nullif(btrim(coalesce(p_question_text, '')), '');
  v_now timestamptz;
begin
  if p_response not in ('ACKNOWLEDGED', 'QUESTION', 'HELP_NEEDED') then
    return query select 'invalid_response'::text, null::text, null::timestamptz; return;
  end if;
  -- Text is only ever kept for the choice it belongs to.
  if p_response <> 'QUESTION' then
    v_q := null;
  elsif v_q is not null and char_length(v_q) > 1000 then
    return query select 'question_too_long'::text, null::text, null::timestamptz; return;
  end if;

  select r.id, r.response, r.responded_at
    into v_row
    from public.bty_tracked_announcement_recipients r
   where r.announcement_id = p_announcement_id
     and r.user_id = p_user_id
   for update;

  if not found then
    -- Not a recipient, or not bound yet. Deliberately indistinguishable from
    -- "no such announcement", so membership of someone else's audience cannot
    -- be probed.
    return query select 'not_a_recipient'::text, null::text, null::timestamptz; return;
  end if;

  if v_row.response is not null then
    return query select 'already_responded'::text, v_row.response, v_row.responded_at; return;
  end if;

  v_now := now();

  update public.bty_tracked_announcement_recipients
     set response = p_response, responded_at = v_now, question_text = v_q
   where id = v_row.id;

  -- ★ THE BRIDGE. The question a person just typed IS the first thing said in
  -- their conversation, and it becomes that in the same transaction as the
  -- disposition it belongs to. `author_role` is RECIPIENT because this function
  -- located the row BY the caller's own user id -- the same proof the update
  -- above rests on, not a second assumption.
  if p_response = 'QUESTION' and v_q is not null then
    insert into public.bty_announcement_thread_messages
      (recipient_id, author_user_id, author_role, body, created_at)
    values
      (v_row.id, p_user_id, 'RECIPIENT', v_q, v_now);
  end if;

  return query select 'responded'::text, p_response, v_now;
end;
$$;

revoke all on function public.bty_respond_to_announcement(uuid, uuid, text, text) from public, anon, authenticated;
grant execute on function public.bty_respond_to_announcement(uuid, uuid, text, text) to service_role;

comment on function public.bty_respond_to_announcement(uuid, uuid, text, text) is
  'Record one write-once response. When the response is QUESTION with text, the same transaction appends that text as the FIRST message of this recipient''s private conversation -- one product action cannot half-succeed. ACKNOWLEDGED and HELP_NEEDED write no message: the UI captures no text for them and none is invented.';


-- ---------------------------------------------------------------------------
-- 7. TRACK — THE HOST IS NOT IN THEIR OWN AUDIENCE.
--
-- ★ THE ONLY CHANGE IS ONE FILTER. The signature, the return shape, the
-- idempotency key, the dedupe, the GUID gate, the denominator assertion, the
-- `zero_recipients` refusal and the service_url rule are all exactly as
-- 20260907 left them.
--
-- WHY. A person cannot be both parties to a private two-party conversation. The
-- resolver would call them HOST while the first-response bridge writes their
-- own first message as RECIPIENT, so their own question would render as
-- somebody else's and count as unread against themselves. Rather than invent
-- dual-role semantics, the state is made unreachable.
--
-- MEASURED, and it WAS reachable: `value.data.recipients` is client-submitted
-- from the People Picker, `parsePickedRecipients` accepts any well-formed GUID,
-- and nothing anywhere excluded the owner. Production holds ZERO self-recipient
-- rows today, so nothing has to be repaired — only prevented.
--
-- ★ THE OWNER'S IDENTITY IS READ THE WAY THIS SCHEMA ALREADY READS IT.
-- `identity_data->'custom_claims'->>'oid'` on an `azure` identity — the same
-- path `bty_bind_announcement_recipients_for_user` uses. The oid is NOT at the
-- top level of identity_data and `provider_id` is the `sub`, never the oid; a
-- wrong path fails silently by matching nothing, which here would mean silently
-- not excluding the Host.
--
-- ★ ALL of the owner's oids are excluded, not one. The binder fails closed when
-- an account carries two Microsoft identities because it must CHOOSE which to
-- bind. Exclusion has no such problem — it removes the union — so a Host with
-- two identities is fully protected AND is never refused a legitimate Track.
--
-- ★ A HOST WHO PICKED ONLY THEMSELVES IS REFUSED, not silently given an empty
-- run: the filter leaves zero oids and the existing `zero_recipients` exception
-- fires, unchanged.
-- ---------------------------------------------------------------------------
-- ---------------------------------------------------------------------------
-- 7a. FAIL-CLOSED PRECONDITION — THE LIVE SIGNATURE MUST BE THE ONE WE REPLACE.
--
-- ★ WHY THIS EXISTS, AND WHAT IT CAUGHT.
--
-- `create or replace function` matches on the IDENTITY ARGUMENT LIST. If the
-- live function's parameter ORDER differs from the one written here by even one
-- position, PostgreSQL does not replace it -- it silently creates a SECOND
-- OVERLOAD. Both then accept the same NAMED arguments that PostgREST sends, so
-- the next Track resolves ambiguously and fails in production, having passed
-- every local test.
--
-- That is not hypothetical. Repo migration `20260907` declares
-- (..., p_recipient_oids text[], p_service_url text default null) while
-- PRODUCTION carries (..., p_service_url text, p_recipient_oids text[]).
-- The repository's migration history and the live database have DIVERGED, so a
-- test that builds its schema only from these files can never see it.
--
-- ★ IT REFUSES, IT DOES NOT REPAIR. No overload is dropped speculatively:
-- dropping the wrong one would delete the function Track is currently using.
-- The migration aborts and a person reconciles the divergence deliberately.
--
-- ★ IT IS RE-ENTRANT. After a successful apply the identity is unchanged, so a
-- second run of this file passes the same gate.
--
-- ★ IT COMPARES ARGUMENT TYPES, NOT `pg_get_function_identity_arguments`. That
-- function includes parameter NAMES, which are not part of what `create or
-- replace` matches on -- so a harmless rename would read as a signature change,
-- and the real thing being guarded (argument ORDER and TYPES) would be checked
-- only incidentally. `format_type` over `proargtypes` is exactly the identity.
-- ---------------------------------------------------------------------------
do $$
declare
  v_expected constant text := 'uuid, uuid, text, text, text, text, text[]';
  v_all integer;
  v_match integer;
  v_found text;
begin
  select count(*) into v_all
    from pg_catalog.pg_proc p
    join pg_catalog.pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public'
     and p.proname = 'bty_track_announcement';

  select count(*) into v_match
    from pg_catalog.pg_proc p
    join pg_catalog.pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public'
     and p.proname = 'bty_track_announcement'
     and pg_catalog.array_to_string(
           array(select pg_catalog.format_type(t, null)
                   from pg_catalog.unnest(p.proargtypes) as t), ', ') = v_expected;

  if v_all <> 1 or v_match <> 1 then
    select coalesce(
             string_agg('  (' || pg_catalog.array_to_string(
                            array(select pg_catalog.format_type(t, null)
                                    from pg_catalog.unnest(p.proargtypes) as t), ', ') || ')',
                        chr(10) order by p.oid),
             '  <none>')
      into v_found
      from pg_catalog.pg_proc p
      join pg_catalog.pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public'
       and p.proname = 'bty_track_announcement';

    raise exception
      using errcode = 'P0001',
            message = 'bty_track_announcement live signature mismatch -- refusing to create a second overload',
            detail  = format('expected exactly ONE overload with identity arguments (%s); found %s:%s%s',
                             v_expected, v_all, chr(10), v_found),
            hint    = 'Repo migration history and production have diverged. Reconcile the live function first; do NOT drop an overload blindly, Track is calling one of them.';
  end if;
end $$;


create or replace function public.bty_track_announcement(
  p_owner_user_id uuid,
  p_source_capture_id uuid,
  p_host_framing text,
  p_tenant_id text,
  p_conversation_id text,
  p_service_url text,
  p_recipient_oids text[]
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
  v_owner_oids text[];
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

  -- ★ THE HOST'S OWN ENTRA OBJECT IDS, read the way this schema already reads
  -- them: `identity_data->'custom_claims'->>'oid'` on an `azure` identity. The
  -- oid is NOT at the top level and `provider_id` is the `sub`, never the oid --
  -- a wrong path matches nothing, which here would mean silently NOT excluding
  -- the Host.
  --
  -- EVERY identity, not one. `bty_bind_announcement_recipients_for_user` fails
  -- closed on two Microsoft identities because it must CHOOSE which to bind.
  -- Exclusion has no such problem -- it removes the union -- so a Host with two
  -- identities is fully protected and is never refused a legitimate Track.
  select coalesce(
           array_agg(lower(btrim(i.identity_data->'custom_claims'->>'oid'))),
           array[]::text[]
         )
    into v_owner_oids
    from auth.identities i
   where i.user_id = p_owner_user_id
     and i.provider = 'azure'
     and i.identity_data->'custom_claims'->>'oid' is not null;

  -- Canonicalize and DEDUPE the selection. The picker can return the same person
  -- twice (a preselected value re-picked), and a duplicate would inflate the
  -- denominator against a set that cannot contain them twice.
  select array_agg(distinct lower(btrim(o)))
    into v_oids
    from unnest(coalesce(p_recipient_oids, array[]::text[])) as o
   where btrim(coalesce(o, '')) <> ''
     and lower(btrim(o)) ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
     -- ★ THE HOST IS NOT IN THEIR OWN AUDIENCE. A person cannot be both parties
     -- to a private two-party conversation: the resolver would call them HOST
     -- while the first-response bridge writes their own first message as
     -- RECIPIENT, so their own question would render as somebody else's and
     -- count as unread against themselves.
     and not (lower(btrim(o)) = any (v_owner_oids));

  v_count := coalesce(array_length(v_oids, 1), 0);
  if v_count < 1 then
    -- An announcement with no audience has no question to answer. A Host who
    -- selected only themselves lands here, which is the intended refusal.
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

revoke all on function public.bty_track_announcement(uuid, uuid, text, text, text, text, text[]) from public, anon, authenticated;
grant execute on function public.bty_track_announcement(uuid, uuid, text, text, text, text, text[]) to service_role;

comment on function public.bty_track_announcement(uuid, uuid, text, text, text, text, text[]) is
  'Create one tracked announcement and its frozen audience, atomically and idempotently by (owner, source). The Host''s own Entra object ids are excluded from the audience, so a person can never be both parties to a private two-party conversation; a Host who selected only themselves is refused with zero_recipients.';
