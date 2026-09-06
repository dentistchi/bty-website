-- Copy-friendly (LF, no trailing spaces). Select all to copy.
-- ===========================================================================
-- TODAY DISMISSAL V1 — "remove this from MY Today". ADDITIVE ONLY.
--
-- One new table. No existing table, column, constraint, grant, policy, function
-- or ROW is altered, replaced or deleted anywhere in this file.
-- ===========================================================================
--
-- ★ REMOVE FROM TODAY IS NOT DELETE, AND THE SCHEMA IS WHAT ENFORCES THAT.
--
-- This table records ONE fact: a person said "I don't need to see this on my
-- Today any more." It has no foreign key to anything it hides, no cascade, no
-- status a record could inherit, and no writer anywhere that touches the thing
-- being dismissed. Removing a Track from Today therefore cannot reach
-- `bty_tracked_announcements`, `bty_tracked_announcement_recipients`,
-- `bty_announcement_thread_messages`, `bty_announcement_thread_message_reads`,
-- `handled_at`, `bty_action_captures`, XP, or any training history — not because
-- the application declines to, but because this file names none of them.
--
-- ★ WHY A SEPARATE TABLE INSTEAD OF A `dismissed_at` COLUMN PER RECORD.
--
-- Dismissal is a property of a PERSON'S VIEW, not of the record. The clearest
-- case is a tracked announcement: it is one row, but the Host reads it on their
-- Today and each recipient reads their own card. A column on the announcement
-- could only ever hold one person's opinion, so the Host tidying their Today
-- would decide what a recipient sees. A per-person key keeps those separate, and
-- keeps ONE model for however many card kinds later become removable instead of
-- an ad-hoc boolean spreading across tables that each mean something different.
--
-- ---------------------------------------------------------------------------
-- ★ WHY RESURFACING IS A VERSION AND NOT A TIMESTAMP.
--
-- R1 of this file compared the card's latest activity TIMESTAMP against
-- `dismissed_at`. That is the SAME MVCC defect this schema already paid for
-- once in the thread unread cursor, and it fails identically:
--
--     T1  recipient writes a message, created_at = 10:00, DOES NOT COMMIT
--     T2  the Host's Today cannot see it, and they Remove the card at 10:01
--     T2  commit -> dismissed_at = 10:01
--     T1  commit -> the message lands, still stamped 10:00
--     ==> latest activity (10:00) <= dismissed (10:01), FOREVER.
--
-- The card is hidden permanently even though a real message arrived after the
-- tidy-up — which is precisely the harm "keep Today clean" must never cause.
-- The defect is commit order versus stamp order, so no clock fixes it.
--
-- So the AUTHORITY is a MONOTONIC COUNT of attention-worthy activity, recorded
-- at the instant of dismissal:
--
--     current_activity_version >  dismissed_activity_version  ->  VISIBLE
--     current_activity_version <= dismissed_activity_version  ->  hidden
--
-- A dismissing transaction can only ever count rows its own snapshot contains,
-- so it necessarily stores the PRE-COMMIT version. When the concurrent write
-- lands the count is strictly greater and the card comes back. The counts are
-- monotonic because thread messages are append-only (service_role holds no
-- UPDATE or DELETE on them) and first responses are write-once.
--
-- `dismissed_at` is KEPT, but only as audit and for showing a person when they
-- tidied. Nothing reads it to decide visibility.
-- ---------------------------------------------------------------------------
--
-- ROLLBACK:
--   drop table if exists public.bty_today_dismissals;
-- ===========================================================================

create table if not exists public.bty_today_dismissals (
  -- WHOSE TODAY. Always the caller's own canonical id, supplied by the server
  -- from the authenticated session and never by a request body. Cascades: a
  -- dismissal is a preference, and one belonging to a deleted account answers
  -- nothing.
  user_id uuid not null references auth.users (id) on delete cascade,

  -- WHAT KIND OF CARD. A closed vocabulary, deliberately: an open string would
  -- let a future surface invent a kind that nothing reads, and a dismissal
  -- nobody honours is a person told their tap worked when it did not.
  item_kind text not null,

  -- WHICH ONE. Deliberately NOT a foreign key. This table must never be able to
  -- reach the record it hides -- no cascade, no join, no lifecycle coupling --
  -- and an id that no longer resolves is simply a dismissal that hides nothing.
  item_id uuid not null,

  -- AUDIT ONLY. When this person tidied the card away. Deliberately NOT the
  -- visibility authority: see the revision note above for the race that makes a
  -- timestamp comparison unsound here.
  dismissed_at timestamptz not null default now(),

  -- ★ THE VISIBILITY AUTHORITY. The card's monotonic attention-activity count as
  -- the dismissing transaction could see it. Anything that commits afterwards
  -- raises the current count above this and the card returns.
  --
  -- NOT NULL with no default: a dismissal whose version was never measured
  -- would hide a card against an unknown baseline, and 0 would be a guess that
  -- silently resurfaces everything. The writer must supply a measured value.
  dismissed_activity_version bigint not null,

  constraint bty_today_dismissals_kind_check
    check (item_kind in ('track_recipient', 'track_host')),
  -- A count is never negative. A negative baseline would make every card
  -- permanently visible and quietly disable the feature rather than fail.
  constraint bty_today_dismissals_version_check
    check (dismissed_activity_version >= 0),

  -- ONE dismissal per person per card. Re-dismissing a resurfaced card moves
  -- the two mutable columns forward rather than accumulating rows.
  --
  -- ★ IT IS ALSO THE ONLY INDEX THIS TABLE NEEDS. The single read shape is
  -- "what has THIS person hidden, of this kind", which is a LEADING-COLUMN
  -- prefix of this key. A separate (user_id, item_kind) index was written in R1
  -- and removed here: it answered the same question with the same scan while
  -- adding a second structure to maintain on every write.
  constraint bty_today_dismissals_pk primary key (user_id, item_kind, item_id)
);

comment on table public.bty_today_dismissals is
  'Per-user "remove from my Today" state. Hides a card from ONE person''s view and nothing else: no FK to the hidden record, no cascade into it, and no writer here touches announcements, recipients, thread messages, receipts, handled state, captures, XP or training history.';
comment on column public.bty_today_dismissals.item_id is
  'The card''s own id. NOT a foreign key, deliberately -- this table may never reach the record it hides, and a stale id simply hides nothing.';
comment on column public.bty_today_dismissals.dismissed_at is
  'AUDIT ONLY -- when this person tidied the card away. NOT the visibility authority: comparing activity timestamps against it loses a message that was uncommitted when the card was dismissed.';
comment on column public.bty_today_dismissals.dismissed_activity_version is
  'The visibility authority. The card''s monotonic attention-activity count as the dismissing transaction could see it; the card is hidden only while the current count has not exceeded it. A transaction cannot count rows outside its snapshot, so a concurrently-committing message always raises the count afterwards and resurfaces the card.';

-- ---------------------------------------------------------------------------
-- ACL.
--
-- ★ service_role IS IN THE REVOKE LIST. Supabase's default privileges grant it
-- ALL the instant a table is created, so a revoke naming only
-- anon/public/authenticated would leave UPDATE, DELETE, TRUNCATE, REFERENCES
-- and TRIGGER standing and any later grant would be additive on top of ALL.
-- Measured on this project's production database on 2026-09-06.
--
-- ★ UPDATE IS COLUMN-SCOPED, AND THAT IS THE POINT. Only the two mutable facts
-- can be written. `user_id`, `item_kind` and `item_id` are IMMUTABLE after
-- insert, so no bug in the service layer can RE-POINT an existing dismissal at
-- a different person or a different Track -- which is the one way this table
-- could ever hide somebody else's card. A table-wide UPDATE grant would leave
-- that reachable.
--
-- ★ NO DELETE, NO TRUNCATE. Nothing in the product un-dismisses; a resurfaced
-- card is handled by the version comparison, not by removing the row.
-- ---------------------------------------------------------------------------
revoke all on public.bty_today_dismissals from anon, public, authenticated, service_role;
alter table public.bty_today_dismissals enable row level security;
grant select, insert on public.bty_today_dismissals to service_role;
grant update (dismissed_at, dismissed_activity_version) on public.bty_today_dismissals to service_role;

-- ---------------------------------------------------------------------------
-- ★ WHERE CROSS-USER SECURITY ACTUALLY COMES FROM — stated accurately.
--
-- R1 claimed the primary key made writing another person's dismissal
-- "structurally impossible". That was overstated. `service_role` can INSERT any
-- `user_id` it likes; a composite key separates rows, it does not authorize
-- them. What actually holds the boundary:
--
--   ENFORCED BY THE SERVER   `POST /api/me/today/dismiss` derives the canonical
--                            user from the authenticated session. The request
--                            body carries a card kind and a card id and nothing
--                            else -- there is no user id to supply.
--   ENFORCED BY THE SERVER   before writing, it verifies the named card belongs
--                            to that user's own Today projection: a recipient
--                            row bound to them, or an announcement they own. A
--                            card that is not theirs is refused, and refused
--                            identically to one that does not exist.
--   ENFORCED BY THE SCHEMA   the key gives each person their own row, and the
--                            column-scoped UPDATE grant means an existing row
--                            can never be re-pointed at another person.
--   NOT CLAIMED              the schema alone does not authorize anything. A
--                            future writer that skipped the route could insert
--                            under any user id, which is exactly why the route
--                            is the boundary and is tested as such.
-- ---------------------------------------------------------------------------
