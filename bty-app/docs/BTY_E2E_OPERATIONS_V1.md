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
| `e2e:auth` | `playwright test --project=setup` — 로그인만, `user.json` 생성 |
| `test:e2e` | 전 프로젝트 (setup → chromium + public 병렬) |
| `test:e2e:ci` | CI용 reporter/workers |
| `test:e2e:install` | `playwright install chromium` |

## 환경 변수

로컬 (`.env.local`은 커밋 금지 — 쉘에서 export 권장):

```bash
E2E_EMAIL=test@example.com
E2E_PASSWORD=…
BASE_URL=http://localhost:3000
```

CI: GitHub Secrets `E2E_EMAIL`, `E2E_PASSWORD`. `BASE_URL`은 워크플로에서 `http://127.0.0.1:3000` 고정(dev 서버 기동).

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

- **setup** — `auth.setup.ts`: `/en/bty/login` → storage 저장 (BTY locale 경로).
- **public** — `*.public.spec.ts`, storage 없음 (비로그인 리다이렉트).
- **chromium** — setup 의존, `e2e/.auth/user.json` 사용.

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

- `docs/E2E_ARENA.md` — 스펙 파일 목록  
- `docs/ARENA_HUB_CTA_POLICY.md` — 허브 CTA  
- `docs/GROWTH_IA_ROUTE_MAP.md` — 라우트
