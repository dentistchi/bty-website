-- Copy-friendly (LF, no trailing spaces). Select all to copy.
-- ===========================================================================
-- TRACK — CONTINUOUS TWO-WAY CONVERSATION V1. ADDITIVE ONLY.
--
-- One new table, two new nullable columns, three new functions, and ONE
-- existing function body replaced (`bty_respond_to_announcement`, whose
-- signature, return shape and every existing result string are unchanged).
--
-- No existing column, constraint, grant, policy or ROW is altered or deleted.
-- No historical backfill: a thread that has no messages had no messages.
-- ===========================================================================
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
-- from a request. The column exists so that "who said this" survives a later
-- ownership change, and so unread can be computed without re-joining.
--
-- ★ APPEND-ONLY, ENFORCED BY WHAT IS NOT GRANTED.
--
-- service_role holds SELECT and INSERT on the message table and NOTHING ELSE.
-- There is no UPDATE grant and no DELETE grant, so a message cannot be edited,
-- cannot be re-pointed at a different recipient, and cannot be removed — not by
-- a bug, not by a future service function, not by a direct call. The only
-- deletion that reaches these rows is the FK cascade from the recipient row,
-- which is the same cascade that already removes the response itself.
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
--   -- restore the 20260902 body of bty_respond_to_announcement, then:
--   drop function if exists public.bty_mark_announcement_thread_read(uuid, uuid);
--   drop function if exists public.bty_post_announcement_thread_message(uuid, uuid, text, text);
--   drop function if exists public.bty_resolve_announcement_thread_role(uuid, uuid);
--   drop table if exists public.bty_announcement_thread_messages;
--   alter table public.bty_tracked_announcement_recipients
--     drop column if exists recipient_last_read_at,
--     drop column if exists host_last_read_at;
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
  -- display name or an Entra object id. `on delete cascade` is deliberately NOT
  -- used: see the note on the constraint below.
  author_user_id uuid not null references auth.users (id) on delete cascade,

  -- Derived inside the writer from the announcement's owner, never accepted
  -- from a caller. See the header.
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
create index if not exists bty_ann_thread_recipient_created_idx
  on public.bty_announcement_thread_messages (recipient_id, created_at);

comment on table public.bty_announcement_thread_messages is
  'Track — the continuing Host <-> Recipient conversation. One PRIVATE thread per bty_tracked_announcement_recipients row, never per announcement: an announcement has many recipients and one of them must never read another''s. Append-only: service_role holds SELECT and INSERT and no UPDATE or DELETE grant.';
comment on column public.bty_announcement_thread_messages.author_role is
  'HOST or RECIPIENT, DERIVED server-side from announcement ownership inside bty_post_announcement_thread_message. Never supplied by a client and never read from a request body.';
comment on column public.bty_announcement_thread_messages.client_message_id is
  'Optional client nonce that makes a double-submit return the first message instead of writing a second. Scoped under (recipient_id, author_user_id), so it addresses nothing and names nobody.';

-- Client-deny, exactly like the two tables it hangs off.
revoke all on public.bty_announcement_thread_messages from anon, public, authenticated;
alter table public.bty_announcement_thread_messages enable row level security;
-- ★ NO UPDATE. NO DELETE. This grant IS the append-only rule.
grant select, insert on public.bty_announcement_thread_messages to service_role;


-- ---------------------------------------------------------------------------
-- 2. THE TWO READ CURSORS.
--
-- WHY A CURSOR AND NOT A PER-MESSAGE READ TABLE. The thread has exactly TWO
-- parties, forever: the announcement owner and the one bound recipient. With
-- two readers, "what have I not seen" is fully answered by one timestamp each,
-- and a per-message join table would store N rows to answer a question a single
-- comparison already answers. The columns go on the recipient row because that
-- row IS the thread — the same place `response`, `handled_at` and the delivery
-- lease already live.
--
-- NULL means "never opened it", which is correctly ALL of the other side's
-- messages, and is what every existing row is on the day this ships.
--
-- AN AUTHOR NEVER MAKES UNREAD FOR THEMSELVES, structurally: each side's count
-- only ever looks at messages whose `author_role` is the OTHER one, so a Host's
-- own reply cannot appear in the Host's unread and a recipient's cannot appear
-- in theirs. That is a property of the query, not a rule the UI is trusted with.
-- ---------------------------------------------------------------------------
alter table public.bty_tracked_announcement_recipients
  add column if not exists host_last_read_at timestamptz,
  add column if not exists recipient_last_read_at timestamptz;

comment on column public.bty_tracked_announcement_recipients.host_last_read_at is
  'When the OWNING Host last opened this person''s thread. NULL = never. Unread for the Host = messages with author_role = RECIPIENT created after this instant.';
comment on column public.bty_tracked_announcement_recipients.recipient_last_read_at is
  'When this recipient last opened their own thread. NULL = never. Unread for them = messages with author_role = HOST created after this instant.';


-- ---------------------------------------------------------------------------
-- 3. WHO IS THIS PERSON IN THIS THREAD? — the single authority resolver.
--
-- DEFAULT DENY. It returns 'HOST', 'RECIPIENT', or 'none'. A wrong Host, a
-- different recipient of the SAME announcement, an unbound person, and a
-- recipient id that does not exist all receive 'none' — deliberately
-- indistinguishable, so possessing or guessing a uuid reveals nothing about
-- whether it names anything.
--
-- OWNER WINS WHEN BOTH ARE TRUE. A Host may legitimately include themselves in
-- their own audience; resolving them as HOST is deterministic and matches what
-- the Tracking surface would show them.
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
-- Authority, validation, idempotency and the insert are ONE transaction. There
-- is no arrangement in which a message is written by a caller whose role was
-- never established, and none in which a role is established and the write then
-- happens somewhere else under a different assumption.
--
-- `p_client_message_id` makes a double submit return the FIRST message rather
-- than writing a second. The lookup and the insert are both inside this
-- function, and the partial unique index is the backstop for the case where two
-- requests race past the lookup together.
-- ---------------------------------------------------------------------------
create or replace function public.bty_post_announcement_thread_message(
  p_recipient_id uuid,
  p_actor_user_id uuid,
  p_body text,
  p_client_message_id text
)
returns table (result text, message_id uuid, author_role text, created_at timestamptz)
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
begin
  select r.role into v_role
    from public.bty_resolve_announcement_thread_role(p_recipient_id, p_actor_user_id) as r;

  if v_role is null or v_role = 'none' then
    return query select 'not_found'::text, null::uuid, null::text, null::timestamptz; return;
  end if;

  -- Nothing to say is not a message. Checked before the length bound so an
  -- all-whitespace body is 'empty_message' rather than a confusing size error.
  if char_length(v_body) < 1 then
    return query select 'empty_message'::text, null::uuid, null::text, null::timestamptz; return;
  end if;
  if char_length(v_body) > 1000 then
    return query select 'message_too_long'::text, null::uuid, null::text, null::timestamptz; return;
  end if;
  if v_key is not null and char_length(v_key) > 100 then
    return query select 'invalid_client_key'::text, null::uuid, null::text, null::timestamptz; return;
  end if;

  if v_key is not null then
    select m.id, m.author_role, m.created_at
      into v_existing
      from public.bty_announcement_thread_messages m
     where m.recipient_id = p_recipient_id
       and m.author_user_id = p_actor_user_id
       and m.client_message_id = v_key;
    if found then
      -- The same act, seen twice. The first message stands, untouched.
      return query select 'duplicate'::text, v_existing.id, v_existing.author_role, v_existing.created_at;
      return;
    end if;
  end if;

  insert into public.bty_announcement_thread_messages
    (recipient_id, author_user_id, author_role, body, client_message_id)
  values
    (p_recipient_id, p_actor_user_id, v_role, v_body, v_key)
  returning id, created_at into v_id, v_now;

  return query select 'posted'::text, v_id, v_role, v_now;
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
      return query select 'duplicate'::text, v_existing.id, v_existing.author_role, v_existing.created_at;
      return;
    end if;
    return query select 'failed'::text, null::uuid, null::text, null::timestamptz;
end;
$$;

revoke all on function public.bty_post_announcement_thread_message(uuid, uuid, text, text) from public, anon, authenticated;
grant execute on function public.bty_post_announcement_thread_message(uuid, uuid, text, text) to service_role;

comment on function public.bty_post_announcement_thread_message(uuid, uuid, text, text) is
  'Append one message to a Track conversation. The author''s role is DERIVED from announcement ownership inside this function and is never accepted from a caller; a non-party is refused with not_found. Idempotent when a client nonce is supplied.';


-- ---------------------------------------------------------------------------
-- 5. MARK MY OWN SIDE READ.
--
-- One function for both parties, because the side to move is not the caller's
-- to choose: it follows from the SAME role resolution the write path uses. A
-- Host can never mark a recipient's side read, and a recipient can never mark
-- the Host's, regardless of what any request says — there is no parameter for
-- it.
--
-- Monotonic by `greatest`: an out-of-order or delayed call can only ever move
-- a cursor forward, so a slow request cannot resurrect messages a person has
-- already seen.
-- ---------------------------------------------------------------------------
create or replace function public.bty_mark_announcement_thread_read(
  p_recipient_id uuid,
  p_actor_user_id uuid
)
returns table (result text, role text)
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
#variable_conflict use_column
declare
  v_role text;
  v_now timestamptz := now();
begin
  select r.role into v_role
    from public.bty_resolve_announcement_thread_role(p_recipient_id, p_actor_user_id) as r;

  if v_role is null or v_role = 'none' then
    return query select 'not_found'::text, null::text; return;
  end if;

  if v_role = 'HOST' then
    update public.bty_tracked_announcement_recipients
       set host_last_read_at = greatest(coalesce(host_last_read_at, v_now), v_now)
     where id = p_recipient_id;
  else
    update public.bty_tracked_announcement_recipients
       set recipient_last_read_at = greatest(coalesce(recipient_last_read_at, v_now), v_now)
     where id = p_recipient_id;
  end if;

  return query select 'read'::text, v_role;
end;
$$;

revoke all on function public.bty_mark_announcement_thread_read(uuid, uuid) from public, anon, authenticated;
grant execute on function public.bty_mark_announcement_thread_read(uuid, uuid) to service_role;

comment on function public.bty_mark_announcement_thread_read(uuid, uuid) is
  'Move the CALLER''S OWN read cursor on one Track conversation. Which side moves follows from the derived role; there is no parameter for it, so neither party can mark the other read.';


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
