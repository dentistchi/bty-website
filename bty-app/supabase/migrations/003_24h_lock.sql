-- 24시간 잠금: 완료 후 24시간 대기해야 다음 날 열림
-- 기다림도 훈련입니다.

alter table bty_profiles add column if not exists last_completed_at timestamptz;
