-- DECISION6-TRAIN-CAPTURE-1 (Unit1): source-aware Dear Me capture 기반 additive 컬럼.
-- dear_me_letters에 source(train/arena/center 구분) + day(train Day 번호) + prompt(capture seed 문구) 추가.
-- 비파괴: source default 'center' → 기존 row 전부 'center'(영향 0); day,prompt nullable → 기존 row NULL.
-- RLS 무변경: 기존 own-row 정책(auth.uid() = user_id)은 컬럼 비의존 → 새 컬럼 자동 보호.
-- B4c(20260609000000 type/seed_id)와 동형 additive 패턴.

alter table public.dear_me_letters
  add column if not exists source text not null default 'center'
    check (source in ('train', 'arena', 'center'));

alter table public.dear_me_letters
  add column if not exists day int;

alter table public.dear_me_letters
  add column if not exists prompt text;
