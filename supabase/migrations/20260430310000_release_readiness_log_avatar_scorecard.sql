-- Release readiness: avatar subsystem + integrity scorecard gate flags.

alter table public.release_readiness_log
  add column if not exists avatar_ok boolean not null default false;

alter table public.release_readiness_log
  add column if not exists scorecard_ok boolean not null default false;

comment on column public.release_readiness_log.avatar_ok is
  'Avatar checks: snapshot layers, equipped vs OUTFIT_MANIFEST, outfit progress x12, animation stats.';

comment on column public.release_readiness_log.scorecard_ok is
  'getIntegrityScoreCard grade in A|B|C|D for test user.';
