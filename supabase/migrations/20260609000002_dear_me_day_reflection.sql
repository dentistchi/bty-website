-- DECISION6-C2-1: Day Reflection Set 스키마 (형태 C2, plan 848fd69).
-- dear_me_letters를 multi-shape로: free letter(body) + Train day_reflection(responses jsonb) one-table 공존.
-- 순서 중요: DELETE(키 공간 클린) → ADD responses → CHECK 확장 → unique → RLS UPDATE.
-- 🔴 1번 DELETE는 production 행 제거(Unit1 QA 테스트 2건, 삭제 승인됨) — unique 충돌원 사전 제거.
-- 비파괴 범위: 기존 9 center letter(day NULL) + 잔여 reflection은 responses NULL, day NULL → unique 무관(NULL DISTINCT).
-- idempotency: ADD COLUMN/CONSTRAINT/POLICY에 DROP IF EXISTS 가드(base migration 20260409000002의 drop-then-create 컨벤션 동형).

-- 1. Unit1 train QA 테스트 2건 삭제 (결정1 = A삭제; unique(4) 전 키 공간 클린).
--    둘 다 day=4 / type='reflection' / source='train' (QA 흔적). ID 명시 — 광범위 DELETE 아님.
delete from public.dear_me_letters
where id in (
  '89f11e72-171a-4b70-8bb3-97e1b16aa4d3',
  'd837f7aa-7a5c-43d5-87db-92035279809a'
);

-- 2. responses jsonb (additive nullable). free letter=NULL, day_reflection={title,questions[],finalReflection}.
alter table public.dear_me_letters
  add column if not exists responses jsonb;

-- 3. type CHECK 확장: ('letter','reflection') → +('day_reflection'). 기존 행 위반 0(조회3 = letter/reflection만).
alter table public.dear_me_letters
  drop constraint if exists dear_me_letters_type_check;
alter table public.dear_me_letters
  add constraint dear_me_letters_type_check
    check (type in ('letter', 'reflection', 'day_reflection'));

-- 4. unique(user_id, day, source) — Train Day당 1 Dear Me Reflection (upsert 키).
--    center letter는 day NULL → Postgres 기본 NULL DISTINCT라 다건 공존(안 걸림). NULLS NOT DISTINCT 쓰지 않음.
alter table public.dear_me_letters
  drop constraint if exists dear_me_letters_user_day_source_uniq;
alter table public.dear_me_letters
  add constraint dear_me_letters_user_day_source_uniq
    unique (user_id, day, source);

-- 5. RLS UPDATE 정책 (own-row). upsert ON CONFLICT DO UPDATE + 재편집(partial save)용.
--    현 RLS = SELECT/INSERT own만 → UPDATE 부재 시 upsert가 RLS에서 막힘. own-row UPDATE 신설.
drop policy if exists dear_me_letters_update_own on public.dear_me_letters;
create policy dear_me_letters_update_own on public.dear_me_letters
  for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
