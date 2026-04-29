-- Dojo 50문항: 문항 저장·조회 (DOJO_DEAR_ME_50_DB_AND_FLOWS_IMPLEMENT_1PAGE §1).
-- area = perspective_taking|communication|leadership|conflict|teamwork. scale_type = likert_5.
-- 선택지는 1~5 리커트 공통, 별도 테이블 없이 클라이언트/도메인 상수로 처리.

create table if not exists public.dojo_questions (
  id smallint primary key,
  area text not null,
  order_in_area smallint not null,
  text_ko text not null,
  text_en text not null,
  scale_type text not null default 'likert_5',
  constraint dojo_questions_area_fk check (area in (
    'perspective_taking', 'communication', 'leadership', 'conflict', 'teamwork'
  )),
  constraint dojo_questions_id_range check (id >= 1 and id <= 50),
  constraint dojo_questions_order_range check (order_in_area >= 1 and order_in_area <= 10)
);

create index if not exists dojo_questions_area_order_idx
  on public.dojo_questions(area, order_in_area);

alter table public.dojo_questions enable row level security;

drop policy if exists "dojo_questions_select_authenticated" on public.dojo_questions;
create policy "dojo_questions_select_authenticated" on public.dojo_questions
  for select to authenticated using (true);

drop policy if exists "dojo_questions_select_anon" on public.dojo_questions;
create policy "dojo_questions_select_anon" on public.dojo_questions
  for select to anon using (true);

comment on table public.dojo_questions is 'Dojo 50문항. 영역별 10문항. GET /api/dojo/questions로 조회.';

-- 시드: 50문항 플레이스홀더 (역지사지 1–10, 소통 11–20, 리더십 21–30, 갈등 31–40, 팀 41–50)
insert into public.dojo_questions (id, area, order_in_area, text_ko, text_en)
select n, area, (n - 1) % 10 + 1,
  '문항 ' || n,
  'Question ' || n
from (
  select generate_series(1, 10) as n, 'perspective_taking' as area
  union all select generate_series(11, 20), 'communication'
  union all select generate_series(21, 30), 'leadership'
  union all select generate_series(31, 40), 'conflict'
  union all select generate_series(41, 50), 'teamwork'
) t
on conflict (id) do nothing;
