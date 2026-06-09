-- IA-B4c (형태2/2b): Reflection→Dear Me 흡수 기반 additive 컬럼.
-- dear_me_letters에 type(letter/reflection 구분) + seed_id(reflection seed 연결) 추가.
-- 비파괴: type default 'letter' → 기존 row 전부 'letter'(영향 0); seed_id nullable → 기존 row NULL.
-- RLS 무변경: 기존 own-row 정책(auth.uid() = user_id)은 컬럼 비의존 → 새 컬럼 자동 보호.
-- FK 없음(설계 결정 F3-b): seed_id = plain uuid (마이그레이션 단순성; 참조 무결성은 앱 레이어).

alter table public.dear_me_letters
  add column if not exists type text not null default 'letter'
    check (type in ('letter', 'reflection'));

alter table public.dear_me_letters
  add column if not exists seed_id uuid;
