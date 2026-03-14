# Dojo·Dear Me 콘텐츠 다음 단계 설계 (50문항 DB화 등)

**갱신일**: 2026-03-09  
**목적**: 현재 상태 진단 → 50문항 DB화·제출 저장·Dear Me 편지 저장의 **구현 로드맵**을 1페이지로 정리.  
**기준**: `DOJO_DEAR_ME_50_DB_NEXT_STEP_1PAGE.md`, `DOJO_DEAR_ME_50_DB_AND_FLOWS_IMPLEMENT_1PAGE.md`, `DOJO_DEAR_ME_NEXT_CONTENT.md` §1-7.

---

## 0. 현재 상태 진단 — 두 개의 50문항 시스템

| 구분 | Assessment (자존감 진단) | Dojo (5영역 역량 진단) |
|------|--------------------------|------------------------|
| **5영역** | core_self_esteem, self_compassion, self_esteem_stability, growth_mindset, social_self_esteem | perspective_taking, communication, leadership, conflict, teamwork |
| **문항 저장** | **코드 하드코딩** `src/lib/assessment/questions.ts` + `questions.ko.json` (실제 한국어 문항 50개) | **DB** `dojo_questions` 테이블 (플레이스홀더 "문항 N" 50개) |
| **역채점** | 있음 (`reverse: true/false`) | 없음 |
| **점수 계산** | `src/lib/assessment/score.ts` — `scoreAnswers()` 차원별 0-100, `detectPattern()` 7패턴 | `src/domain/dojo/flow.ts` — `computeDojo50Result()` 영역별 0-100, summaryKey |
| **응답 저장** | **sessionStorage만** (DB 없음) | **DB 없음** (stateless API) |
| **API** | 없음 (클라이언트 전용) | GET `/api/dojo/questions`, POST `/api/dojo/submit` |
| **UI** | `/[locale]/assessment` — 한 문항씩 stepper | 없음 (API만 존재) |

### Dear Me / Center 편지

| 구분 | Dear Me | Center |
|------|---------|--------|
| **API** | POST `/api/dear-me/letter` | POST `/api/center/letter` |
| **저장** | **미저장** (stateless, LLM 응답만) | **DB 저장** `center_letters` (mood, energy, body, reply) |
| **테이블** | 없음 | `center_letters` (마이그레이션 완료) |

---

## 1. 설계 방향 결정

### 1-1. Assessment 50문항 — 코드 유지 (DB 이전 불필요)

| 판단 | 근거 |
|------|------|
| **코드 유지** | 자존감 진단 문항은 심리학 기반 고정 세트(Rosenberg 등). 잦은 변경 없음. 역채점(`reverse`)·차원(`dimension`) 정보가 코드에 타입 안전하게 있음. |
| **대신 응답 저장 추가** | 현재 sessionStorage만 → `assessment_submissions` 테이블로 결과 영속화. |

### 1-2. Dojo 50문항 — 실제 콘텐츠 투입 + 제출 저장

| 항목 | 방향 |
|------|------|
| **문항 텍스트** | `dojo_questions` 기존 플레이스홀더를 **실제 한국어·영어 문항**으로 UPDATE. 영역별 10문항 × 5영역. |
| **제출 저장** | `dojo_submissions` 테이블 신규. POST `/api/dojo/submit` 성공 시 INSERT. |
| **결과 조회** | GET `/api/dojo/submissions` (본인 이력 목록, 2차). |

### 1-3. Dear Me 편지 — 저장 연동

| 항목 | 방향 |
|------|------|
| **편지 저장** | `dear_me_letters` 테이블 신규 또는 `center_letters`에 `source` 컬럼 추가. 권장: **별도 테이블** (시스템 경계 분리 원칙). |
| **API** | POST `/api/dear-me/letter` 기존 응답 계약 유지 + INSERT 추가. |

---

## 2. 스키마·마이그레이션

### 2-1. `dojo_submissions` (신규)

```sql
create table if not exists public.dojo_submissions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  answers_json jsonb not null,        -- { "1": 3, "2": 5, ... "50": 4 }
  scores_json jsonb not null,         -- { "perspective_taking": 72, ... }
  summary_key text not null,          -- "high" | "mid" | "low"
  created_at timestamptz not null default now()
);

create index if not exists dojo_submissions_user_created_idx
  on public.dojo_submissions(user_id, created_at desc);

alter table public.dojo_submissions enable row level security;

create policy "dojo_submissions_select_own" on public.dojo_submissions
  for select to authenticated using (auth.uid() = user_id);
create policy "dojo_submissions_insert_own" on public.dojo_submissions
  for insert to authenticated with check (auth.uid() = user_id);
```

### 2-2. `assessment_submissions` (신규)

```sql
create table if not exists public.assessment_submissions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  answers_json jsonb not null,        -- { "q01": 4, "q02": 2, ... }
  scores_json jsonb not null,         -- { "core_self_esteem": 68, ... }
  pattern_key text,                   -- "perfectionism" | "approval_seeking" | ...
  recommended_track text,             -- "core" | "compassion" | ...
  created_at timestamptz not null default now()
);

create index if not exists assessment_submissions_user_created_idx
  on public.assessment_submissions(user_id, created_at desc);

alter table public.assessment_submissions enable row level security;

create policy "assessment_submissions_select_own" on public.assessment_submissions
  for select to authenticated using (auth.uid() = user_id);
create policy "assessment_submissions_insert_own" on public.assessment_submissions
  for insert to authenticated with check (auth.uid() = user_id);
```

### 2-3. `dear_me_letters` (신규)

```sql
create table if not exists public.dear_me_letters (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  locale text not null default 'ko' check (locale in ('ko', 'en')),
  body text not null,
  reply text,
  created_at timestamptz not null default now()
);

create index if not exists dear_me_letters_user_created_idx
  on public.dear_me_letters(user_id, created_at desc);

alter table public.dear_me_letters enable row level security;

create policy "dear_me_letters_select_own" on public.dear_me_letters
  for select to authenticated using (auth.uid() = user_id);
create policy "dear_me_letters_insert_own" on public.dear_me_letters
  for insert to authenticated with check (auth.uid() = user_id);
```

### 2-4. `dojo_questions` 실제 콘텐츠 UPDATE (마이그레이션)

기존 플레이스홀더 "문항 N"을 실제 한국어·영어 문항으로 UPDATE하는 별도 마이그레이션 파일.  
콘텐츠 예시 (역지사지 영역):

| id | text_ko | text_en |
|----|---------|---------|
| 1 | 상대방의 입장에서 상황을 바라보려 노력한다 | I try to see the situation from the other person's perspective |
| 2 | 다른 사람의 감정을 이해하려 한다 | I try to understand other people's feelings |
| ... | ... | ... |

**실제 50문항 콘텐츠는 별도 콘텐츠 작업**으로 확정 후 마이그레이션에 반영.

---

## 3. API·도메인 연동

### 3-1. POST `/api/dojo/submit` 확장

| 단계 | 현재 | 변경 |
|------|------|------|
| 1. 검증 | `validateDojo50Submit(answers)` ✅ | 유지 |
| 2. 결과 | `computeDojo50Result(answers)` ✅ | 유지 |
| 3. **저장** | 없음 | `dojo_submissions` INSERT (answers_json, scores_json, summary_key) |
| 4. 응답 | `{ scores, summaryKey, mentorComment }` | 유지 (+ `submissionId` 추가) |

### 3-2. Assessment 결과 저장 (신규 또는 기존 API 확장)

| 옵션 | 설명 |
|------|------|
| **A. 기존 `/api/dojo/submit` 분기** | body에 `type: "assessment"` 추가. 비추천 (시스템 경계 혼재). |
| **B. POST `/api/assessment/submit` (신규)** | 권장. Assessment용 별도 엔드포인트. `scoreAnswers()` + `detectPattern()` 호출 → `assessment_submissions` INSERT. |

권장: **옵션 B** — Assessment는 Center 영역이므로 별도 API.

### 3-3. Dear Me 편지 저장 연동

POST `/api/dear-me/letter` 기존 응답 유지:
1. 기존: body → LLM/template reply 생성 → 응답
2. **추가**: 인증 사용자일 때 `dear_me_letters` INSERT (body, reply, locale)

### 3-4. 조회 API (2차)

| 엔드포인트 | 용도 |
|------------|------|
| GET `/api/dojo/submissions` | 본인 Dojo 제출 이력 (최근 N건) |
| GET `/api/assessment/submissions` | 본인 Assessment 제출 이력 |
| GET `/api/dear-me/letters` | 본인 편지 이력 |

---

## 4. 도메인 규칙 (변경 없음)

| 파일 | 역할 | 변경 |
|------|------|------|
| `src/domain/dojo/flow.ts` | canEnterDojo, validateDojo50Submit, computeDojo50Result, validateIntegritySubmit | 없음 (순수 함수 유지) |
| `src/domain/dojo/questions.ts` | DojoQuestion 타입, mapDojoQuestionRow | 없음 |
| `src/lib/assessment/score.ts` | scoreAnswers, detectPattern | 없음 |
| `src/lib/assessment/questions.ts` | QUESTIONS (50문항 하드코딩) | 없음 (코드 유지) |
| `src/domain/center/resilience.ts` | energyToLevel, aggregateLetterRowsToDailyEntries | 없음 |

---

## 5. 구현 로드맵 (우선순위순)

| 순서 | 작업 | 레이어 | 영향 범위 | 선행 |
|------|------|--------|-----------|------|
| **1** | `dojo_submissions` 마이그레이션·RLS | DB | Dojo | 없음 |
| **2** | POST `/api/dojo/submit` 저장 연동 | API | Dojo | 1 |
| **3** | `dojo_questions` 실제 문항 콘텐츠 50건 확정·UPDATE 마이그레이션 | DB/콘텐츠 | Dojo | 없음 (병렬 가능) |
| **4** | `assessment_submissions` 마이그레이션·RLS | DB | Center | 없음 |
| **5** | POST `/api/assessment/submit` 신규 + 저장 연동 | API | Center | 4 |
| **6** | Assessment UI에서 submit API 호출 (sessionStorage → API) | UI | Center | 5 |
| **7** | `dear_me_letters` 마이그레이션·RLS | DB | Center | 없음 |
| **8** | POST `/api/dear-me/letter` 저장 연동 | API | Center | 7 |
| **9** | Dojo 50문항 UI (문항 stepper + 결과 화면) | UI | Dojo | 2, 3 |
| **10** | 조회 API (GET submissions/letters) + 이력 UI | API/UI | 공통 | 2, 5, 8 |

### 1차 목표 (DB화 핵심)

순서 **1, 2, 4, 5, 7, 8** — 3개 테이블 생성 + 3개 API 저장 연동.  
코드 변경 최소: 마이그레이션 3개 + API handler 수정/추가 3개.

### 2차 목표 (UI·콘텐츠)

순서 **3, 6, 9, 10** — 실제 문항 콘텐츠·UI 연동·이력 조회.

---

## 6. 엣지 케이스·안전

| 항목 | 대응 |
|------|------|
| **중복 제출** | dojo_submissions에 unique 제약 없음 (여러 번 제출 가능). 필요 시 user_id + created_at 24시간 내 중복 방지 검토. |
| **비인증 사용자** | Assessment는 sessionStorage로 유지 (비인증도 가능). API 저장은 인증 시에만. |
| **RLS** | 3개 테이블 모두 `auth.uid() = user_id` SELECT/INSERT만. UPDATE/DELETE 불필요 (이력 불변). |
| **XP 연동** | Dojo 제출 시 XP는 현재 스펙 없음. `DOJO_DEAR_ME_XP_SPEC.md` 기준 MENTOR_MESSAGE 5XP만 기존. 50문항 완료 XP는 별도 결정. |

---

## 7. 체크리스트

- [x] `dojo_submissions` 마이그레이션 작성 (2026-03-09)
- [x] POST `/api/dojo/submit` 저장 연동 — 기존 응답 유지 + submissionId (2026-03-09)
- [x] `assessment_submissions` 마이그레이션 작성 (2026-03-09)
- [x] POST `/api/assessment/submit` 신규 엔드포인트 — scoreAnswers·detectPattern + INSERT (2026-03-09)
- [x] Assessment UI → API 호출로 전환 (sessionStorage fallback 유지) (2026-03-09)
- [x] `dear_me_letters` 마이그레이션 작성 (2026-03-09)
- [x] POST `/api/dear-me/letter` 저장 연동 — 기존 응답 유지 + letterId (2026-03-09)
- [x] `dojo_questions` 실제 문항 콘텐츠 50건 확정·UPDATE (2026-03-09)
- [x] Dojo 50문항 UI (문항 stepper + 결과 화면) (2026-03-09)
- [x] 조회 API 3개 (GET dojo/submissions, assessment/submissions, dear-me/letters) (2026-03-09)

---

*참고: `DOJO_DEAR_ME_50_DB_NEXT_STEP_1PAGE.md`, `DOJO_DEAR_ME_50_DB_AND_FLOWS_IMPLEMENT_1PAGE.md`, `src/domain/dojo/flow.ts`, `src/lib/assessment/score.ts`.*
