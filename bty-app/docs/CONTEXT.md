# BTY Website / BTY Arena — Context (Single Source of Truth)

이 문서는 "현재 리포지토리의 운영/배포/인증"에 대한 **단일 기준 문서**다.
새 작업/새 PR/새 대화는 반드시 이 문서를 기준으로 한다.

---

## 1) Hosting & Build (Cloudflare + OpenNext)

### Hosting
- Cloudflare **Workers** (Pages 아님)
- OpenNext 기반 배포

### GitHub Actions (실행 커맨드)
- **배포 트리거:** `main` 브랜치에 **push**하면 자동으로 빌드 후 Cloudflare Workers에 배포된다. (로컬에서 `npm run deploy` 할 필요 없음.)
- Build:
  - `npx opennextjs-cloudflare build`
- Deploy:
  - `npx opennextjs-cloudflare deploy`

**필요한 GitHub Secrets (Settings → Secrets and variables → Actions):**
- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ACCOUNT_ID`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

> 확인 근거: `.github/workflows/deploy-workers.yml`

### Output
- OpenNext output: `.open-next/`
- Next intermediate: `.next/`

---

## 2) App 구조 요약

- Next.js App Router
- Locale prefix 사용: `/[locale]/...`
- BTY Arena UI: `/[locale]/bty-arena`
- 시나리오 데이터: `src/lib/bty/scenario/scenarios.ts` (TS 상수)

---

## 3) Supabase Auth — 운영 원칙(절대 깨지면 안 됨)

### 핵심 원칙
1) **쿠키 기반 세션**이 서버까지 전달되어야 한다.
2) **쿠키 이름(sb-... auth-token 및 chunk .0 .1 .2 .3)** 은 환경에 따라 여러 개로 쪼개질 수 있다(=정상).
3) Cloudflare/OpenNext 환경에서 **쿠키 옵션(도메인/경로/SameSite/Secure/HttpOnly)** 은 "덮어쓰기/불일치"가 생기면 즉시 로그인 루프/401/500으로 이어진다.
4) 따라서 쿠키 삭제/세팅은 **한 곳에서만** 수행하고(로그인/로그아웃 API), middleware는 "필요 최소"로만 만진다.

### 쿠키 규격 (프로덕션 기준)
- Secure: `true`
- SameSite: `Lax`
- HttpOnly: `true` (세션 쿠키는 JS 접근 금지)
- Domain: 배포 도메인(프로덕션: `bty-website.ywamer2022.workers.dev`)
- Path: **기본 `/` 권장**
  - (주의) `/api`로만 설정하면 페이지 요청에서 쿠키가 안 보일 수 있어 혼선이 생김.
  - 로그아웃 시에는 과거에 설정된 Path/Domain 변형까지 모두 지우도록 "복수 경로 삭제"가 필요할 수 있음.

### Auth 라우트 (기준)
- `POST /api/auth/login`
  - 이메일/비번 로그인 수행
  - 성공 시 Supabase 세션을 쿠키로 세팅
- `GET /api/auth/session`
  - 진단/상태 확인용(운영/디버그)
- `POST /api/auth/logout`
  - auth 쿠키(및 chunk 쿠키) 삭제
  - 필요 시 `Clear-Site-Data: "cookies"` 사용 가능

> 로그인 문제 재발 시: 먼저 `/api/auth/session` 응답 헤더/바디로 "쿠키가 서버에 오는지/세션을 읽는지"부터 판정한다.

---

## 4) 개발 시 금지 패턴 / 주의 패턴

### (중요) Prerender / useSearchParams
- `useSearchParams()` 사용 페이지는 빌드에서 "Suspense boundary" 요구로 터질 수 있다.
- 원칙:
  - 페이지(서버 컴포넌트)에서 searchParams를 받거나,
  - 클라이언트 훅은 클라이언트 컴포넌트로 분리하고, 페이지에서 `<Suspense>`로 감싼다.
  - 혹은 `export const dynamic = "force-dynamic"`로 정적 프리렌더를 회피.

### (중요) 내부 네비게이션
- `<a href="/...">` 대신 `next/link` 사용 (eslint 빌드 실패 방지)

---

## 5) 작업 규칙(팀/AI 협업용)

새 기능/수정 PR을 열기 전, 아래 3가지를 확인:
1) `npx tsc --noEmit` 통과
2) `npm run build` 통과(환경변수 세팅된 상태에서)
3) `/api/auth/session` 기준으로 로그인 쿠키/세션 판정 로직 유지
