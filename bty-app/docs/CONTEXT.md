# BTY Website / BTY Arena — Context (Single Source of Truth)

이 문서는 "현재 리포지토리의 운영/배포/인증"에 대한 **단일 기준 문서**다.
새 작업/새 PR/새 대화는 반드시 이 문서를 기준으로 한다.

---

## 1) Hosting & Build (Cloudflare + OpenNext)

### Hosting
- Cloudflare **Workers** (Pages 아님)
- OpenNext 기반 배포

### GitHub Actions (실행 커맨드)
- Build:
  - `npx opennextjs-cloudflare build`
- Deploy:
  - `npx opennextjs-cloudflare deploy`

> 확인 근거: `.github/workflows/deploy-workers.yml`

### Output
- OpenNext output: `.open-next/`
- Next intermediate: `.next/`

---

## 2) App 구조 요약
- Next.js App Router (15.x)
- Locale prefix: `/[locale]/...`
- BTY Arena: `/[locale]/bty-arena`
- Scenarios: `src/lib/bty/scenario/scenarios.ts`

---

## 3) Supabase Auth — 운영 원칙(절대 깨지면 안 됨)
1) 쿠키 기반 세션이 서버까지 전달
2) sb-... auth-token + chunk(.0~.3) 다중 쿠키는 정상
3) Cloudflare/OpenNext에서 쿠키 옵션 불일치(도메인/경로/SameSite/Secure/HttpOnly) → 로그인 루프/401/500
4) 쿠키 set/clear는 로그인/로그아웃 API에서만, middleware는 최소 개입

### 쿠키 규격(프로덕션)
- Secure: true
- SameSite: Lax
- HttpOnly: true
- Domain: 배포 도메인
- Path: /

### Auth 라우트
- POST `/api/auth/login`
- GET `/api/auth/session` (진단)
- POST `/api/auth/logout` (chunk 포함 삭제)

---

## 4) Known Build Pain
- Next prerender + CSR hooks(useSearchParams 등) → Suspense wrapper 또는 `export const dynamic = "force-dynamic"`

---

## 6) Arena Persistence (DB) — 이벤트 소싱(단일 기준)

### 저장 정책(현재)
- Arena는 middleware로 로그인 강제됨 → 기본은 `auth.uid()` 기반 저장
- MVP는 "이벤트를 쌓고 집계" 방식으로 확장성 확보

### 테이블(권장 최소)
- `arena_runs` : 런 단위(시나리오 세션)
- `arena_events` : 선택/팔로업/완료 이벤트 로그
- `arena_profiles` : 유저 누적/주간/리그
- `arena_leagues` : 리그 정의(옵션)

### RLS 원칙
- `arena_*`는 기본적으로 "본인 데이터만" 읽기/쓰기
- 집계(리그/랭킹)는 view 또는 별도 함수로 확장
