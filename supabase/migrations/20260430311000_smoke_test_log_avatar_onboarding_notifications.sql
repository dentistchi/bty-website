-- Smoke test: avatar / onboarding / notifications subsystem flags.

alter table public.smoke_test_log
  add column if not exists avatar_ok boolean not null default false;

alter table public.smoke_test_log
  add column if not exists onboarding_ok boolean not null default false;

alter table public.smoke_test_log
  add column if not exists notifications_ok boolean not null default false;

comment on column public.smoke_test_log.avatar_ok is
  'getLatestSnapshot + getEquippedState + resolveCompositeAssets non-empty layers.';

comment on column public.smoke_test_log.onboarding_ok is
  'getOnboardingStep (step_completed via highestCompleted) + getActiveLearningPath path_name.';

comment on column public.smoke_test_log.notifications_ok is
  'getUnreadNotifications array + getResilienceScore 0..100.';
