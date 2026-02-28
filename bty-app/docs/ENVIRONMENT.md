# Environment Variables (Single Source of Truth)

이 문서는 BTY Website/BTY Arena가 기대하는 환경변수의 **단일 목록**이다.

---

## 1) Required (Build & Runtime)

### Public (브라우저로 노출됨)
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

> `scripts/check-env.mjs`가 위 2개 존재 여부를 검사하는 구조라면, CI/배포에서 반드시 주입되어야 한다.

---

## 2) Optional (권장/기능별)

### Supabase (서버 전용 — 사용 시에만)
- `SUPABASE_SERVICE_ROLE_KEY`
  - 서버에서 "관리 권한"이 필요한 작업이 있을 때만 사용
  - 일반 로그인/세션용으로는 사용하지 않는 것을 기본으로 유지

---

## 3) Where to set (권장 운영)

### GitHub Actions
- Repository Secrets / Variables로 주입
- Cloudflare deploy step에서 Workers 환경변수로 전달되도록 설정(프로젝트 구성에 따름)

### Cloudflare Workers
- Worker 환경변수(Production/Preview 분리 가능)
- 값 변경 시: "새 배포 이후에만" 반영되는지(캐시/미스매치) 확인

---

## 4) Debug checklist

- `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` 미주입:
  - `npm run build` 또는 check-env 단계에서 실패 가능
- 로그인 관련 이슈:
  - 먼저 `/api/auth/session`에서 request cookie 유무 / status / body 확인
