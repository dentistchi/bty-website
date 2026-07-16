-- V7.1 Event-Scoped State Correction — stamp each request with its owning Event.
--
-- Before V7.1 a request was scoped only by room_id (+ a nullable session_id), so
-- every event-scoped read (LIVE stats, ended summary, Display counts) that started
-- from room_id swept the room's ENTIRE history across all past events. There is no
-- stored event↔session link, so the reliable, permanent scope is an explicit
-- event_id on the request itself.
--
-- Additive + nullable + idempotent:
--   - new requests are stamped with the room's canonical live Event id at insert;
--   - pre-V7.1 rows keep event_id = NULL and are simply never counted toward any
--     Event's stats (they are legitimate pre-event history — never deleted);
--   - ON DELETE SET NULL keeps history rows if an Event row is ever removed.
--
-- Rollback:
--   drop index if exists karaoke_requests_event_idx;
--   alter table public.karaoke_requests drop column if exists event_id;

alter table public.karaoke_requests
  add column if not exists event_id uuid
  references public.karaoke_events(id) on delete set null;

-- Event-scoped stat/queue reads filter by (event_id, status); this index serves them.
create index if not exists karaoke_requests_event_idx
  on public.karaoke_requests (event_id, status);
