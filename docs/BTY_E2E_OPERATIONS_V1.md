# BTY E2E 운영 체계 v1 (실전)

제품 철학을 코드로 고정하는 레이어입니다. 단순 “테스트 추가”가 아닌 **Arena / Journey / My Page IA 방어** 용도입니다.

## 운영 규칙 (필수)

- **Auth state must never be committed.** (`e2e/.gitignore` + 루트 ignore)
- **CI generates auth state dynamically** (`setup` 프로젝트 → `e2e/.auth/user.json`).
- **Local auth state is disposable** — 삭제 후 `e2e:auth`로 재생성.
- **Journey comeback tests require seeded state** (`is_comeback_eligible` 등); 없으면 조건부·annotation만.
- **Arena hub and play must remain separated** — 허브 요약(`arena-hub-summary`)은 플레이에 없어야 함.

## package.json

| Script | 설명 |
|--------|------|
| `e2e:auth` | `playwright test --project=setup` — `e2e/.auth/user.json` |
| `e2e:auth:comeback` | `setup-comeback` — `e2e/.auth/comeback-user.json` (`E2E_COMEBACK_*` 필수) |
| `test:e2e` | 로컬: 등록된 전 프로젝트 (`public` + `chromium` ± comeback) |
| `test:e2e:ci` | CI: `chromium` + `chromium-comeback`만 (`E2E_COMEBACK_*` 필수) |
| `e2e:verify-fixture-email` | CI: `E2E_EMAIL` === `expectedFixtureLoginEmail()` (`seedFixtureUser`와 동일 principal) |
| `e2e:seed-fixture-user` | `seedFixtureUser()` — `e2e:auth` 전에 CI에서 실행 (Arena Step 6 위생) |
| `test:e2e:install` | `playwright install chromium` |
| `test:e2e:bty-step6:isolated` | Step 6만 빠르게: `PW_STEP6_ISOLATED=1` → `setup`에만 의존 (DB에 다른 E2E가 동시에 Arena를 돌리지 않을 때만) |
| `test:e2e:bty` / `test:e2e:bty-step6` | 기본값에서 `bty-loop-step6`은 `bty-loop`·`chromium` 완료 후 실행(공유 픽스처 409 방지). `bty-step6` 단독 선택 시에도 Playwright가 의존 프로젝트를 함께 돌림. |

**Comeback E2E** (`journey.spec.ts`, 태그 `@comeback-journey`): `E2E_COMEBACK_EMAIL` / `E2E_COMEBACK_PASSWORD`가 있을 때만 `setup-comeback`·`chromium-comeback`이 등록됩니다. 계정은 `bty_profiles.current_day = 8`(또는 `E2E_COMEBACK_JOURNEY_DAY`) 및 comeback eligible(진행·터치 3일+) 상태 권장.

GitHub Secrets: `E2E_COMEBACK_EMAIL`, `E2E_COMEBACK_PASSWORD` (선택, 없으면 comeback 스펙 스킵).

## 환경 변수

로컬 (`.env.local`은 커밋 금지 — 쉘에서 export 권장):

```bash
E2E_EMAIL=test@example.com
E2E_PASSWORD=…
BASE_URL=http://localhost:3000
```

CI (`.github/workflows/e2e.yml`): Secrets **`BASE_URL`**, **`E2E_EMAIL`**, **`E2E_PASSWORD`**, **`E2E_COMEBACK_EMAIL`**, **`E2E_COMEBACK_PASSWORD`**, **`NEXT_PUBLIC_SUPABASE_URL`**, **`SUPABASE_SERVICE_ROLE_KEY`** (fixture seed 필수). 선택 **`E2E_FIXTURE_USER_ID`** — 설정 시 **`E2E_EMAIL`**은 `e2e-fixture+<uuid>@local.test` 형태(또는 기본 UUID일 때 `e2e-fixture+bty@local.test`)로 `seedFixtureUser`와 맞춰야 함. **`NEXT_PUBLIC_SUPABASE_ANON_KEY`** — 로컬호스트 `BASE_URL`일 때 dev 서버 기동에 필요.

## 로컬 플로우

```bash
cd bty-app
npm run test:e2e:install
export E2E_EMAIL=… E2E_PASSWORD=…
npm run test:e2e
# 또는 storage만 재생성
npm run e2e:auth
```

이미 dev 서버 실행 중: `PLAYWRIGHT_SKIP_SERVER=1`

## Playwright 구조

- **fullyParallel: false** · CI **workers: 2** · 로컬 reporter **html** / CI **line** · 실패 시 screenshot·video
- **setup** — `auth.setup.ts` → `user.json` (`/en/bty/login`, label 기반 입력)
- **setup-comeback** — `auth-comeback.setup.ts` → `comeback-user.json` (env 있을 때만)
- **public** — `*.public.spec.ts`, storage 없음
- **chromium** — 기본 스펙, `user.json` (`grepInvert: @comeback-journey`)
- **chromium-comeback** — `journey.spec.ts` 중 `@comeback-journey`만, `comeback-user.json`

전체 testid 표: **`docs/E2E_DATA_TESTIDS.md`**.

## 테스트 계층

| Layer | 내용 |
|-------|------|
| **1 — 기본** | Arena hub/play, Journey 기본 흐름, My Page 상태 |
| **2 — 상태 기반** | Comeback modal, 허브 continue 문구, leader readiness (시드·API 권장) |

Comeback 강화 예시 (API가 있을 때만):

```ts
// beforeEach — 예시, 엔드포인트는 프로젝트에 맞게 구현 후 사용
// await page.request.post("/api/test/seed-journey", { data: { is_comeback_eligible: true } });
```

## 실데이터 연결 후

1. Arena hub → 실 API  
2. Journey profile → 실 API  
3. My Page → 실 API  
4. 스펙 깨짐 시 **역할/랜드마크(aria, testid)** 우선 고정, 문구만 i18n 동기화.

## 관련 문서

- `docs/E2E_DATA_TESTIDS.md` — testid 맵  
- `docs/CURSOR_MASTER_PROMPT_DATA_TESTIDS.md` — Cursor용 testid 반영 프롬프트(전체·짧은 버전)  
- `docs/E2E_ARENA.md` — 스펙 파일 목록  
- `docs/ARENA_HUB_CTA_POLICY.md` — 허브 CTA  
- `docs/GROWTH_IA_ROUTE_MAP.md` — 라우트
