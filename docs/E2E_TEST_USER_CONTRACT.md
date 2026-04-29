# E2E Test User Contract (Supabase)

**문서 성격:** C2 게이트 — E2E용 Supabase 계정 3개의 **필수 DB·Auth 상태**와 **검증 기준**을 고정한다.  
**코드 단일 근거:** 본문의 테이블·컬럼·API 필드명은 아래 구현에서 직접 확인했다.

| 근거 파일 / 위치 | 용도 |
|---|---|
| `src/engine/integration/e2e-test-fixtures.service.ts` | `seedFixtureUser`, Auth `createUser`, `arena_profiles` upsert 등 |
| `src/app/api/arena/core-xp/route.ts` | `requiresBeginnerPath` ← `arena_profiles.core_xp_total` |
| `src/domain/constants.ts` | `BEGINNER_CORE_XP_THRESHOLD` (= 200) |
| `src/middleware.ts` | 온보딩 게이트 ← `user_onboarding_progress.step_completed` |
| `src/app/[locale]/bty-arena/hooks/useArenaSession.ts` | 초보 경로 리다이렉트 ← `GET /api/arena/core-xp` 의 `requiresBeginnerPath` |
| `src/lib/bty/arena/arenaSessionNextCore.ts` | `GET /api/arena/session/next` · `GET /api/arena/n/session` 의 409/403 조건 |
| `src/lib/bty/arena/blockingArenaActionContract.ts` | `bty_action_contracts` 차단 행 정의 |
| `e2e/helpers/arena-step6-policy.ts` | Step 6 게이트(`beginner-path`, `session-router-non-ok`, `eliteSetup`) |
| `supabase/migrations/20260430260100_user_onboarding_progress.sql` | `user_onboarding_progress` 스키마 |
| `supabase/migrations/20260428110000_arena_status_ejection.sql` | `arena_profiles.arena_status` |
| `supabase/migrations/20260417000000_integrity_slip_log_arena_lockout.sql` | `arena_profiles.account_status` |
| `supabase/migrations/20260418000002_user_healing_phase.sql` | `user_healing_phase.phase` 허용값 |
| `scripts/e2e-seed-default-journey-profile.mjs` | 기본 Journey용 `bty_profiles` |

---

## 0. 구현 현황 vs 본 계약 (필독)

| 항목 | 코드/스크립트 **현재 동작** | 본 계약에서 **요구**하는 상태 |
|---|---|---|
| 로그인 이메일 | `seedFixtureUser` 기본값은 `e2e-fixture+bty@local.test` (`FIXTURE_USER_EMAIL`). Playwright는 `E2E_EMAIL` 환경변수 사용 (`e2e/auth.setup.ts`). | 본 문서의 **3개 이메일**을 각각의 Auth 사용자에 고정한다. |
| `arena_profiles.core_xp_total` | `seedFixtureUser()`의 `arena_profiles` upsert에 **`core_xp_total` 미포함** → 신규 행은 DB 기본값 **0**. | **`core_xp_total` ≥ `BEGINNER_CORE_XP_THRESHOLD` (200)**. 그렇지 않으면 `GET /api/arena/core-xp`가 `requiresBeginnerPath: true`를 반환하고, 클라이언트가 **`/bty-arena/beginner`**로 보내 Step 6·세션 라우터 전제가 깨진다. |
| 온보딩 컬럼명 | DB·미들웨어는 **`user_onboarding_progress.step_completed`** 만 사용한다. **`onboarding_step` 컬럼은 존재하지 않는다.** | 아래 표의 `step_completed` 값을 따른다. |

**조치:** 3계정 시드 스크립트(또는 `seedFixtureUser` 확장)는 반드시 `core_xp_total`을 **200 이상**으로 upsert한다. (기존 `seedFixtureUser`만 쓰는 환경은 본 계약과 불일치할 수 있음.)

---

## 1. 테스트 계정 3개 (고정 이메일)

| 계정 라벨 | 이메일 (대소문자 그대로) | 용도 |
|---|---|---|
| Default journey | `e2e_default@test.com` | `chromium` 프로젝트, `bty-loop`, `auth.setup` 기본 저장소(`e2e/.auth/user.json`). Journey Comeback 시드 대상 (`e2e-seed-default-journey-profile.mjs`는 `E2E_EMAIL`으로 Auth 조회). |
| Step 6 policy | `e2e_step6_policy@test.com` | `elite-action-contract.spec.ts` — **실제** `GET /api/arena/session/next` 응답에 의존. |
| Step 6 forced elite | `e2e_step6_forced@test.com` | `elite-action-contract.forced-elite.spec.ts` — 라우터 200 JSON에 `eliteSetup` 주입; 그 전제로 **실제** upstream이 200이어야 함. |

각 이메일은 **서로 다른** `auth.users.id` (UUID)를 가진다. UUID는 조직이 한 번 정해 **불변**으로 쓴다 (예: 스크립트에서 `createUser({ id, email, password, email_confirm: true })` 패턴 — `e2e-test-fixtures.service.ts`의 `ensureFixtureAuthUser`와 동일).

**비밀번호:** 각 계정은 별도 시크릿을 둘 수 있으나, 동일 비밀번호 허용. 저장 위치는 CI/로컬 환경변수 (예: `E2E_PASSWORD`, `E2E_STEP6_POLICY_PASSWORD`, `E2E_STEP6_FORCED_PASSWORD` — **이름은 구현 시 고정**).

---

## 2. 공통 필수 상태 (3계정 동일)

아래는 **UI 분기·Arena 세션 라우터**에 직접 영향을 주는 필드만 나열한다.

### 2.1 Supabase Auth (`auth.users`)

| 확인 항목 | 필드명 (Auth/DB) | 필수 값 |
|---|---|---|
| 이메일 확인 완료 | `email_confirmed_at` | **NULL 아님** (타임스탬프 존재). Admin API로는 `createUser` 시 `email_confirm: true` (`e2e-test-fixtures.service.ts`와 동일). |

**역할(role):** BTY 앱 E2E 경로에서 참조하는 **`public` 스키마의 일반 사용자 `role` 컬럼은 없다.** Supabase Auth의 `app_metadata` / `user_metadata` 기반 관리자 분기는 본 3계정 범위에서 **요구하지 않음** (명시적 값 없음 = 계약 대상 아님).

### 2.2 `public.user_onboarding_progress`

| 컬럼명 | 필수 값 | 근거 |
|---|---|---|
| `user_id` | 해당 계정의 `auth.users.id` | PK |
| `step_completed` | **5** | `middleware.ts`: `step_completed < 5` 이면 `/bty-arena` 등에서 `/onboarding`으로 리다이렉트. |
| `completed_at` | 유효한 `timestamptz` | 스키마 `not null`; 시드 시 ISO 문자열 |

**주의:** 온보딩 진행은 **`step_completed`만** 본다. **`onboarding_step`이라는 컬럼명은 사용하지 않는다.**

### 2.3 `public.arena_profiles`

| 컬럼명 | 필수 값 | 근거 |
|---|---|---|
| `user_id` | 해당 계정 UUID | PK |
| `core_xp_total` | **정수 ≥ 200** | `GET /api/arena/core-xp`: `requiresBeginnerPath: coreXpTotal < BEGINNER_CORE_XP_THRESHOLD` (`BEGINNER_CORE_XP_THRESHOLD = 200`). |
| `arena_status` | **`ACTIVE`** | 기본값 `ACTIVE`; `EJECTED` 시 시나리오 선택 실패·403 등 (`arenaSessionNextCore` / selector). |
| `account_status` | **`ACTIVE`** | `LOCKED` 시 잠금 정책 적용 가능 (마이그레이션 정의). |
| `lifetime_xp`, `weekly_xp`, `streak`, `league_id`, `updated_at` | `seedFixtureUser`와 동일 수준 허용 | 예: `lifetime_xp=0`, `weekly_xp=0`, `streak=0`, `league_id=null` + `updated_at` 갱신 |

**참고:** 앱의 초보 게이트는 **`core_xp_total`** 기준이며, **`lifetime_xp`만으로는** `requiresBeginnerPath`가 결정되지 않는다.

### 2.4 `public.weekly_xp`

글로벌 주간 풀 행 1개 (시드와 동일 패턴):

| 컬럼명 | 필수 값 |
|---|---|
| `user_id` | 해당 계정 UUID |
| `league_id` | **NULL** (`core-xp` 라우트가 `.is("league_id", null)` 로 조회) |
| `xp_total` | **0** (또는 테스트가 기대하는 비음수 정수) |
| `created_at`, `updated_at` | 유효한 `timestamptz` |

시작 전 다른 `weekly_xp` 행과 충돌이 없도록, 시드에서 해당 `user_id` 기존 행 삭제 후 insert (`seedFixtureUser`와 동일).

### 2.5 `public.user_healing_phase`

| 컬럼명 | 필수 값 | 근거 |
|---|---|---|
| `user_id` | 해당 계정 UUID | PK |
| `phase` | **`ACKNOWLEDGEMENT`** | CHECK: `ACKNOWLEDGEMENT` \| `REFLECTION` \| `REINTEGRATION` \| `RENEWAL` |
| `started_at` | 유효한 `timestamptz` | |
| `completed_at` | **NULL** | `seedFixtureUser`와 동일 |

### 2.6 `public.user_difficulty_profile`

| 컬럼명 | 필수 값 |
|---|---|
| `user_id` | 해당 계정 UUID |
| `difficulty_floor` | **1** |
| `updated_at` | 유효한 `timestamptz` |

### 2.7 `public.user_avatar_state` · `public.user_equipped_assets`

| 테이블 | 필수 상태 |
|---|---|
| `user_avatar_state` | `seedFixtureUser`와 동일: `current_tier`, `unlocked_assets`, `equipped_asset_ids` 등 앱이 기대하는 최소 행 존재 |
| `user_equipped_assets` | 해당 `user_id` **0행** (시드에서 delete) |

### 2.8 `avatar_composite_snapshots` (서비스 롤 시드)

`seedFixtureUser`는 `ensureSmokeAvatarSnapshot`으로 **비어 있지 않은** 스냅샷을 보장한다. 3계정 시드에서도 동일하게 **해당 `user_id`에 대해** 스냅샷이 존재해야 한다 (`e2e-test-fixtures.service.ts` 주석: `resolveE2ETestUserId` 관련).

### 2.9 Arena 세션 차단: `public.bty_action_contracts`

테스트 시작 직전, 해당 `user_id`에 대해 **아래 조건에 걸리는 행이 없어야** `GET /api/arena/session/next`가 200 시나리오 선택으로 진행된다 (`blockingArenaActionContract.ts`).

| 차단 조건 | `status` 및 기타 |
|---|---|
| 제출/에스컬레이션 오픈 | `status` ∈ **`submitted`**, **`escalated`** |
| 미래 마감 pending | `status` = **`pending`** AND `deadline_at` **>** now |
| 승인 후 검증 대기 | `status` = **`approved`** AND `validation_approved_at` **NOT NULL** AND `verified_at` **NULL** AND `deadline_at` **>** now |

E2E는 `POST /api/test/cleanup-action-contracts`로 해당 사용자 계약 행을 삭제할 수 있다 (헤더 `Authorization: Bearer <E2E_TEST_CLEANUP_SECRET|CRON_SECRET>`, body에 `{ "userId": "<uuid>" }` 선택).

---

## 3. 계정별 추가 조건

### 3.1 `e2e_default@test.com`

| 영역 | 필드명 | 필수 값 | 근거 |
|---|---|---|---|
| Foundry Journey / Comeback | `public.bty_profiles.user_id` | Auth UUID와 일치 | |
| | `bty_profiles.updated_at` | **현재 시각에 가깝게** (ISO) | `scripts/e2e-seed-default-journey-profile.mjs`: Comeback 모달 방지 (`GET /api/journey/profile` 의 `is_comeback_eligible` 규칙 — 터치 3일 미만) |
| | `bty_profiles.current_day` | 1–28 정수 | 스크립트가 기존값 유지 또는 기본 1 |
| | `bty_profiles.season` | ≥ 1 정수 | 동상 |
| | `bty_profiles.started_at` | 유효한 `timestamptz` | 동상 |
| | `bty_profiles.last_completed_at` | NULL 또는 문자열 | 동상 |
| | `bty_profiles.bounce_back_count` | 숫자 | 동상 |

로그인 후: **`/en/bty/login` → 리다이렉트 후 `/en/bty-arena` 도달 가능** (`auth.setup.ts` 성공 조건).

### 3.2 `e2e_step6_policy@test.com` · `e2e_step6_forced@test.com`

| 영역 | 요구 |
|---|---|
| 공통 DB 상태 | §2 공통 표와 **동일** (계정별 `user_id`만 다름). |
| Policy 전용 | **실제** 라우터가 elite 시나리오를 줄 수 있는 카탈로그/히스토리 상태가 필요. 라우터가 비엘리트만 주면 스펙은 `test.skip` 처리 (`elite-action-contract.spec.ts`). |
| Forced 전용 | 브라우저에서 세션 GET이 **200**일 때만 인터셉트가 `eliteSetup`을 머지한다 (`arena-step6-forced-elite.ts` 주석). **409/403이면 그대로 실패**로 전파. |

두 계정은 **서로 다른 `user_id`**로 두어 **동시에** `bty_action_contracts`·`arena_runs`가 섞이지 않게 한다 (`playwright.config.ts`: 공유 유저 병렬 시 409 `open_contract_exists_for_family` 위험).

---

## 4. 필드명 빠른 참조 (앱·DB)

| 의미 | 잘못된 표기 (사용 금지) | 실제 필드명·출처 |
|---|---|---|
| 온보딩 완료 | `onboarding_step` | **`user_onboarding_progress.step_completed`** (0–5) |
| 초보 경로 회피 | (추정 lifetime만) | **`arena_profiles.core_xp_total`** + API **`requiresBeginnerPath`** (`GET /api/arena/core-xp`) |
| 이메일 인증 | `email_confirmed` (boolean 컬럼으로 착각) | Auth **`email_confirmed_at` NOT NULL** |
| 주간 XP 행 | | **`weekly_xp`** 테이블, **`league_id IS NULL`** 행이 `core-xp`의 주간 합계에 사용됨 |

---

## 5. 초기화 절차 (권장 순서)

| 단계 | 작업 | 비고 |
|---:|---|---|
| 1 | **기존 동일 이메일 Auth 사용자 삭제** | Supabase Dashboard 또는 Admin API `deleteUser`. FK `ON DELETE CASCADE`로 대부분 `public` 자식 행 정리. |
| 2 | **잔여 행 수동 삭제** | CASCADE 누락 테이블이 있으면 해당 `user_id`로 delete. |
| 3 | **Auth 재생성** | `auth.admin.createUser({ id: <고정UUID>, email, password, email_confirm: true })` |
| 4 | **public upsert/insert** | §2·§3 표대로. 반드시 **`core_xp_total` ≥ 200** 포함. |
| 5 | **계약 행 제거** | `bty_action_contracts` 해당 `user_id` 전부 delete (또는 E2E cleanup API). |
| 6 | **스냅샷·시나리오** | `seedFixtureUser` 수준의 시나리오/아바타 스냅샷 보장 로직 재사용 또는 복제. |

**실행 위치 제안**

| 환경 | 실행 |
|---|---|
| 로컬 | `bty-app` 루트에서 `NEXT_PUBLIC_SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` 로드 후, **신규** `scripts/e2e-seed-three-contract-users.ts` (구현 과제) 또는 대시보드 + SQL. |
| CI | E2E job **직전** step으로 동일 스크립트 실행; 그 다음 계정별 `E2E_EMAIL`/`E2E_PASSWORD`로 `e2e:auth` 또는 계정별 storageState 생성 (구현 과제). |

현재 저장소에 있는 단일 유저 시드: `npm run e2e:seed-fixture-user` → **`e2e_default@test.com` 등 본 계약 이메일과 자동 일치하지 않음.**

---

## 6. 검증 기준

### 6.1 API (로그인 세션 쿠키로 호출)

| 계정 | 요청 | 성공 조건 |
|---|---|---|
| 공통 | `GET /api/arena/core-xp` | HTTP **200**, JSON **`requiresBeginnerPath` === false** |
| 공통 | `GET /api/arena/session/next` 또는 `GET /api/arena/n/session` | HTTP **200**, body **`ok: true`**, **`scenario.scenarioId`** 존재; Step 6 elite 테스트는 추가로 **`scenario.eliteSetup`** 존재 필요(정책 스펙은 스킵 가능, forced 스펙은 인터셉트 전제로 200 필수). |
| 공통 | 위 세션 API들 | HTTP **409** 아님 (`action_contract_pending` 등 차단 시 실패). |

### 6.2 브라우저 (로그인 후)

| 계정 | 기대 화면/URL | 실패 조건 (명시적) |
|---|---|---|
| `e2e_default@test.com` | `/en/bty/login` 제출 후 **`/en/bty-arena`** 로딩, 로그인 URL 잔존 아님 | `pathname`에 `/bty/login` 남음; 쿠키 0개 (`auth.setup.ts`). |
| `e2e_default@test.com` | (Journey 테스트 시) **Comeback 모달이 테스트 가정과 충돌하지 않음** | `bty_profiles.updated_at`이 오래되어 `is_comeback_eligible === true`가 되는 경우 — 시드 미실행. |
| `e2e_step6_policy@test.com` | `prepareFreshArenaSessionElite` 후 **`gate.proceed === true`** 이거나, 스펙이 허용하는 skip 이유만 | `gate.reason === "beginner-path"`; `gate.reason === "session-router-non-ok"` (409/403 등). |
| `e2e_step6_forced@test.com` | 위와 동일 + forced 스위트는 **`gate.proceed === false` 허용 안 함** (`expect(gate.proceed).toBe(true)`) | `beginner-path` 또는 비200 세션 응답. |

### 6.3 실패 판정 요약

| # | 조건 |
|---:|---|
| F1 | `user_onboarding_progress.step_completed` **< 5** → 미들웨어가 `/onboarding`으로 보냄. |
| F2 | `arena_profiles.core_xp_total` **< 200** → `requiresBeginnerPath: true` → **`/bty-arena/beginner`**. |
| F3 | `arena_profiles.arena_status` **≠ `ACTIVE`** 또는 `account_status` **≠ `ACTIVE`** → Arena 403/선택 실패 가능. |
| F4 | `bty_action_contracts`에 §2.9 차단 행 존재 → 세션 **409** `action_contract_pending`. |
| F5 | `E2E_EMAIL`(또는 해당 storageState)이 시드한 **`user_id`와 불일치** → DB는 A인데 로그인은 B. |
| F6 | Step 6 forced 스위트에서 `gate.proceed === false` → **즉시 실패** (스킵 아님). |

---

## 7. 한 페이지 요약 표 (3계정)

| 항목 | e2e_default@test.com | e2e_step6_policy@test.com | e2e_step6_forced@test.com |
|---|---|---|---|
| `auth.users.email_confirmed_at` | NOT NULL | NOT NULL | NOT NULL |
| 앱 RBAC `role` | 없음 (계약 미적용) | 동일 | 동일 |
| `user_onboarding_progress.step_completed` | 5 | 5 | 5 |
| `arena_profiles.core_xp_total` | ≥ 200 | ≥ 200 | ≥ 200 |
| `arena_profiles.arena_status` | ACTIVE | ACTIVE | ACTIVE |
| `arena_profiles.account_status` | ACTIVE | ACTIVE | ACTIVE |
| `bty_action_contracts` 차단 행 | 없음 | 없음 | 없음 |
| 추가 | `bty_profiles` Comeback 시드 (§3.1) | 없음 | 없음 |
| Playwright 프로젝트 (목표) | `setup`, `bty-loop`, `chromium` | `bty-loop-step6` (policy) | `bty-loop-step6` (forced) 또는 별도 프로젝트 |

---

**인증/XP/리더보드 영향:** 본 문서는 **테스트 전용 계정의 데이터 모형**만 정의한다. 프로덕션 랭킹 규칙을 변경하지 않으며, `weekly_xp.xp_total`은 시드 기본 **0**으로 둔다. Core XP 표시값은 `arena_profiles.core_xp_total`에 의존하므로 시드 시 **200 이상**은 UI·초보 분기에 직접 영향한다 (테스트용 의도된 값).
