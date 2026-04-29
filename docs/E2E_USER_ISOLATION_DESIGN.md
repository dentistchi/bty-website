# BTY Arena E2E — Shared User 충돌 해결 설계 (C2)

**문서 성격:** C2 게이트 — E2E 간 **완전한 user isolation**과 **구조적 충돌 제거**를 위한 아키텍처·운영 합의.  
**관련 근거:** `docs/E2E_TEST_USER_CONTRACT.md`, `docs/E2E_ARENA_STEP6_HYGIENE.md`, `playwright.config.ts`, `src/lib/bty/action-contract/actionContractLifecycle.server.ts`.

---

## A. 문제 정의

### A.1 증상

- **forced / policy / general(BTY 루프·허브 등)** 테스트가 **동일 Auth principal**로 Arena·액션 컨트랙트 경로를 밟으면서 서로의 DB 상태를 밟음.
- 대표 오류:
  - **`open_contract_exists_for_family` (409)** — 동일 `user_id`에 대해 **pattern family** 단위로 이미 열린 `bty_action_contracts`가 있을 때 신규 draft/ensure가 거절됨 (`actionContractLifecycle.server.ts`의 family gate).
  - **`insert_failed` (500)** — 제약·레이스·부분 실패 등으로 draft insert가 실패했을 때 상위 API가 500으로 매핑 (`src/app/api/action-contracts/route.ts` 등).

### A.2 근본 원인

| 원인 | 설명 |
| --- | --- |
| **공유 user_id** | 한 계정에 대해 **동시 또는 교차 순서**로 Arena 세션·컨트랙트가 쌓이면 family/세션 단위 불변식과 충돌. |
| **스케줄링만으로의 완화 한계** | `bty-loop-step6*`가 `bty-loop`/`chromium` **이후**에 돌도록 해도, **같은 storageState·같은 user**면 다른 job/재시도/수동 실행과 **교차 오염** 가능. |
| **cleanup 의존** | `cleanupStaleE2EActionContractsBeforeTest` 등은 **베스트 에포트**이며, 비밀 미설정·서버 플래그·타이밍에 따라 스킵되거나 **다른 테스트가 만든 행**과 경쟁할 수 있음. |

### A.3 “교차 오염”이 남는 이유

- Cleanup은 **특정 userId**를 정확히 타겟할 때 의미가 있음. **여러 스펙이 같은 userId**를 쓰면 “내 cleanup이 네 데이터를 지움 / 네 테스트가 내 가정을 깸”이 발생.
- Full run에서는 **worker·재시도·프로젝트 순서**가 바뀌면 재현이 어려운 **순서 의존 flaky**로 나타남.

---

## B. 목표

1. **E2E 테스트 간 완전한 user isolation** — policy Step 6, forced Step 6, 일반 BTY/Arena 스위트가 **서로 다른 `auth.users.id`**를 사용.
2. **cleanup 의존도 최소화** — 구조적으로 “한 계정 = 한 계열 스펙”이 되도록 하여, cleanup은 **내부 일관성 복구·디버그**용으로만 두기.
3. **안정적인 full E2E green** — 동일 Supabase 프로젝트에서 **병렬·풀 런** 시에도 409/500이 **스케줄링 부작용**이 아닌지 구분 가능한 수준으로 유지.

---

## C. 아키텍처 결정

### C.1 유저 분리 전략 (논리명 ↔ 구현)

아래 **논리 라벨**은 문서·CI 변수 설계용이며, **구현 단일 근거**는 `docs/E2E_TEST_USER_CONTRACT.md` §1 및 `e2e/helpers/three-contract-users.ts`이다.

| 논리명 | 역할 / 사용 범위 | 고정 이메일 (계약) | Playwright 프로젝트(현재) |
| --- | --- | --- | --- |
| **E2E_DEFAULT_USER** | 일반 BTY 리더십 루프, `chromium` 기본 스모크, `e2e/.auth/user.json` 레거시 동기화 소스 | `e2e_default@test.com` | `bty-loop`, `chromium` (storageState: `contract-e2e_default.json`) |
| **E2E_STEP6_POLICY_USER** | `elite-action-contract.spec.ts` — **실제** session router 응답·policy 게이트에 의존하는 Step 6 | `e2e_step6_policy@test.com` | `bty-loop-step6-policy` |
| **E2E_STEP6_FORCED_USER** | `elite-action-contract.forced-elite.spec.ts` — 라우터 200 전제 위에 `eliteSetup` 주입 | `e2e_step6_forced@test.com` | `bty-loop-step6-forced` |

**불변 UUID:** 각 계정은 `E2E_CONTRACT_USER_IDS`에 정의된 **고정 UUID**를 사용 (`e2e-three-contract-users.service.ts`와 동일). 임의 생성 금지.

**금지:** 위 세 계정 중 **하나의 이메일/UUID**로 policy·forced·general을 동시에 돌리는 구성(과거 공유 유저 모드).

### C.2 인증 및 상태 관리 구조

| 항목 | 결정 |
| --- | --- |
| **storageState 분리** | 계정별 파일: `e2e/.auth/contract-e2e_default.json`, `contract-e2e_step6_policy.json`, `contract-e2e_step6_forced.json`. **파일 간 쿠키 재사용 금지.** |
| **시드 후 로그인** | `e2e/auth-three-contract.setup.ts`가 계정별로 UI 로그인 후 위 경로에 저장; default는 레거시 `e2e/.auth/user.json`으로 복사(기존 스위트 호환). |
| **Playwright 실행 방식** | **프로젝트 단위**로 `testMatch` + `use.storageState`를 고정 (`playwright.config.ts`). Step 6 전용 프로젝트는 `workers: 1`로 **동일 계정 내 과도한 병렬** 억제. |
| **병렬·순서** | 저장소 기본값: `fullyParallel: false`, CI `workers: 2`. Step 6 프로젝트는 `bty-loop`·`chromium` 완료 후 실행(`dependencies`) — **동일 DB에서 default 유저 Arena와 Step 6 유저 경쟁을 줄이기 위한 2차 방어**. **1차 방어는 유저 분리.** `PW_STEP6_ISOLATED=1` 시 의존성 축소로 로컬 단독 실행 가능(전제: DB 단일 사용자 부하). |

### C.3 데이터 충돌 방지 전략

**Family / contract 단위 충돌 원인 (요약):**

- `bty_action_contracts`는 **user + pattern family** 등에 따라 “이미 열린 계약”이 있으면 신규 ensure가 **`open_contract_exists_for_family`**로 막힐 수 있음.
- **동일 user_id**에서 여러 스펙이 Arena·컨트랙트를 동시에 진행하면 409가 **환경 상태**로 발생 (`E2E_ARENA_STEP6_HYGIENE.md` 정합).

**cleanup 의존 vs user isolation:**

| 접근 | 장점 | 한계 |
| --- | --- | --- |
| **cleanup 위주** | 기존 단일 계정 유지 용이 | 순서·레이스·타 user 오삭제; 시크릿/플래그 누락 시 무력화 |
| **user isolation (선택)** | 구조적으로 충돌 제거; full run 안정성 | 계정·시드·시크릿·storageState 관리 부담 증가 |

**최종 선택:** **user isolation을 1차 해결책**으로 채택하고, **cleanup은 해당 userId에 한정된 사전 정리**로 유지 (`cleanupStaleE2EActionContractsBeforeTest` + 명시 `userId`).

### C.4 Supabase Auth 전략

| 항목 | 결정 |
| --- | --- |
| **계정 생성** | `SUPABASE_SERVICE_ROLE_KEY`로 Admin API **`createUser`** (또는 기존 사용자 확인 후 비밀번호 refresh) — `seedThreeContractUsers` in `e2e-three-contract-users.service.ts`. |
| **이메일 확인** | `email_confirm: true` 등으로 **로그인 가능 상태** 고정 (계약 §2.1). |
| **프로덕션 vs 테스트** | 프로덕션 사용자와 **동일 프로젝트를 쓰는 스테이징/CI**에서는 **전용 E2E 이메일 도메인/접두**로 구분; 로컬은 `@test.com` 고정 계정. **테스트 전용 시크릿**(`E2E_PASSWORD` 등)은 CI Secret에만 두고 앱 런타임과 혼동하지 않음. |
| **프로덕션 로그인 분리** | 앱의 일반 로그인 플로우는 변경하지 않음; E2E는 **환경변수로 주입된 테스트 계정**으로만 `auth-three-contract` setup 수행. |

### C.5 최종 구조 (한 줄)

**“한 E2E 역할 = 한 Auth user = 한 storageState 파일 = 한 Playwright project slice”** + **시드 단일 진입(`global-setup` / `e2e:seed-three-contract-users`)**.

---

## D. 파일 구조 (제안)

| 경로 | 역할 |
| --- | --- |
| `bty-app/scripts/e2e-seed-three-contract-users.ts` | CI/로컬에서 3계정 시드 진입점 |
| `bty-app/e2e/global-setup.ts` | 풀 E2E 전 시드 호출 |
| `bty-app/e2e/auth-three-contract.setup.ts` | 계정별 UI 로그인 → `e2e/.auth/contract-*.json` |
| `bty-app/e2e/helpers/three-contract-users.ts` | 이메일·UUID·storageState 경로·비밀번호 해석 |
| `bty-app/e2e/helpers/cleanup-action-contracts.ts` | (선택) 특정 `userId` 사전 cleanup |
| `bty-app/e2e/.auth/` | gitignore 대상 — 생성된 `storageState` JSON |
| `bty-app/src/engine/integration/e2e-three-contract-users.service.ts` | Supabase Admin 시드·검증 로직 |
| `bty-app/supabase/` | 마이그레이션·스키마 (액션 컨트랙트·프로필 제약의 근거) |

---

## E. 환경변수

### E.1 필수 (3계정 시드 + 로그인)

| 변수 | 용도 |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` / `SUPABASE_URL` | Supabase 프로젝트 |
| `SUPABASE_SERVICE_ROLE_KEY` | Admin `createUser` / DB upsert |
| `E2E_PASSWORD` | **E2E_DEFAULT_USER** 비밀번호; CI에서 필수 권장 (`assertE2eContractCiPasswordOrThrow`) |
| `E2E_STEP6_POLICY_PASSWORD` | **E2E_STEP6_POLICY_USER** (미설정 시 `E2E_PASSWORD` 폴백) |
| `E2E_STEP6_FORCED_PASSWORD` | **E2E_STEP6_FORCED_USER** (미설정 시 `E2E_PASSWORD` 폴백) |

### E.2 앱 URL·서버 기동

| 변수 | 용도 |
| --- | --- |
| `BASE_URL` | Playwright `baseURL` (기본 `http://127.0.0.1:3000`) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | 로컬 dev 서버 기동 시 필요할 수 있음 |

### E.3 선택 — cleanup / 디버그

| 변수 | 용도 |
| --- | --- |
| `E2E_TEST_CLEANUP_SECRET` 또는 `CRON_SECRET` | `POST /api/test/cleanup-action-contracts` 인증 (서버와 동일 값) |
| `E2E_ACTION_CONTRACT_CLEANUP_USER_ID` | cleanup 대상 고정 (미설정 시 서버 기본 해석) |
| `E2E_ALLOW_TEST_CLEANUP` / `NODE_ENV` | 테스트 cleanup API 허용 조건 (`cleanup-action-contracts` 라우트 정책과 정합) |
| `PW_STEP6_ISOLATED` | `1`이면 Step 6 프로젝트가 `setup`만 의존 — 로컬 빠른 실행용 |
| `ARENA_PIPELINE_DEFAULT` | session 경로 선택 (`/api/arena/session/next` vs `/api/arena/n/session`) |

### E.4 키 구조 원칙

- **서비스 롤 키:** 시드 스크립트·CI만; 브라우저·일반 E2E 스펙에는 노출 금지.
- **테스트 계정 비밀번호:** CI Secrets; 저장소에 커밋 금지.
- **cleanup secret:** 앱 인스턴스와 Playwright **동일 값** — 불일치 시 cleanup 조용히 스킵되어 flaky 유발 가능.

---

## F. 실행 순서 (step-by-step)

1. **환경 파일** — `bty-app/.env.local` 등에 `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `E2E_PASSWORD`(및 필요 시 policy/forced 전용) 설정.
2. **Supabase** — 마이그레이션 적용된 프로젝트인지 확인.
3. **시드** — `npm run e2e:seed-three-contract-users`(또는 `global-setup`이 호출하는 동일 진입)로 3계정 Auth + 필수 DB 행 생성/검증.
4. **앱 기동** — 로컬: `npm run dev` (또는 CI에서 preview URL을 `BASE_URL`로).
5. **storageState 생성** — `npx playwright test e2e/auth-three-contract.setup.ts --project=setup` (또는 풀 스위트가 `setup` 프로젝트를 먼저 실행).
6. **테스트 실행** — `npx playwright test` (프로젝트 분리는 `playwright.config.ts`에 의해 자동).
7. **(선택) Step 6만 빠르게** — DB가 한 유저만 쓰는 것이 확실할 때 `PW_STEP6_ISOLATED=1` + 해당 npm 스크립트.
8. **실패 시** — `E2E_TEST_USER_CONTRACT` 위반(특히 `core_xp_total`, 온보딩) 여부 확인 → 시드 재실행 → 동일 이메일/UUID와 `storageState` 불일치 여부 확인.

---

## G. 리스크 및 체크리스트

### G.1 병렬 실행 충돌

| 리스크 | 대응 |
| --- | --- |
| CI `workers: 2` + 동일 DB | 유저 분리로 **교차 user_id** 오염 방지; Step 6 프로젝트 `workers: 1` |
| 여러 CI job이 동일 Supabase | 별도 브랜치 preview가 동일 프로젝트를 쓰면 여전히 충돌 가능 → **스테이징 프로젝트 분리** 또는 **시간대 분리** 검토 |

### G.2 Cleanup race condition

| 리스크 | 대응 |
| --- | --- |
| 테스트 A cleanup이 B의 행 삭제 | cleanup 호출 시 **항상 명시 `userId`** (해당 스펙의 contract user id) |
| cleanup 스킵 | secret 미설정 시 경고만 — **시드+isolation으로 통과**하도록 설계 |

### G.3 Auth 세션 충돌

| 리스크 | 대응 |
| --- | --- |
| 잘못된 `storageState` 혼입 | 파일명·`test.use({ storageState })`를 프로젝트별로 고정; 수동 덮어쓰기 금지 |
| 시드 UUID와 로그인 불일치 | `E2E_CONTRACT_USER_IDS` 단일 근원; Auth 대시보드로 이메일↔id 확인 |

### G.4 Flaky 테스트 가능성

| 리스크 | 대응 |
| --- | --- |
| 네트워크·타임아웃 | 기존 retry 정책 유지; Step 6 헬퍼의 쿠키/라우터 사전 조건 명시적 assert |
| 409/500이 제품 버그인지 환경인지 | 동일 커밋에서 **isolated Step 6**만 green이면 스케줄링/픽스처 이슈 우선 의심 (`E2E_ARENA_STEP6_HYGIENE.md`) |

### G.5 완료 기준 (C2)

- [ ] policy / forced / general이 **서로 다른 고정 UUID**를 사용한다.
- [ ] `playwright.config.ts`에서 **프로젝트별 storageState**가 교차하지 않는다.
- [ ] 풀 E2E에서 **동일 user에 대한 cleanup에만** 의존하지 않는다(명시 userId 또는 불필요).
- [ ] CI에 **E2E 비밀번호·service role·cleanup secret**이 문서와 일치하게 설정된다.

---

**인증/XP/리더보드 영향:** 본 설계는 **테스트 전용 계정·시드·Playwright 구성**에 국한되며, 프로덕션 XP/주간 리셋/리더보드 **비즈니스 규칙을 변경하지 않는다**. 시드가 `arena_profiles` 등을 건드리나 **E2E 전용 사용자**에 한정된다.
