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
| `test:e2e:install` | `playwright install chromium` |

**Comeback E2E** (`journey.spec.ts`, 태그 `@comeback-journey`): `E2E_COMEBACK_EMAIL` / `E2E_COMEBACK_PASSWORD`가 있을 때만 `setup-comeback`·`chromium-comeback`이 등록됩니다. 계정은 `bty_profiles.current_day = 8`(또는 `E2E_COMEBACK_JOURNEY_DAY`) 및 comeback eligible(진행·터치 3일+) 상태 권장.

GitHub Secrets: `E2E_COMEBACK_EMAIL`, `E2E_COMEBACK_PASSWORD` (선택, 없으면 comeback 스펙 스킵).

## 환경 변수

로컬 (`.env.local`은 커밋 금지 — 쉘에서 export 권장):

```bash
E2E_EMAIL=test@example.com
E2E_PASSWORD=…
BASE_URL=http://localhost:3000
```

CI (E2E 워크플로): Secrets **`BASE_URL`**(예: `http://127.0.0.1:3000`), **`E2E_EMAIL`**, **`E2E_PASSWORD`**, **`E2E_COMEBACK_EMAIL`**, **`E2E_COMEBACK_PASSWORD`** — 하나라도 없으면 워크플로가 fail-fast. 트리거는 기본 **`workflow_dispatch`** (Actions → E2E → Run workflow).

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
