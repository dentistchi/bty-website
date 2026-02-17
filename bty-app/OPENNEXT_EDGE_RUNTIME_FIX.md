# OpenNext edge runtime 제거 — 요약 및 검증

## 1) 현재 상태

로컬 기준 **모든 API route에서 `export const runtime = "edge"` 는 이미 제거된 상태**입니다.

대상 12개 파일:
- `src/app/api/admin/organizations/route.ts`
- `src/app/api/admin/users/route.ts`
- `src/app/api/auth/login/route.ts`
- `src/app/api/auth/register/route.ts`
- `src/app/api/auth/session/route.ts`
- `src/app/api/chat/route.ts`
- `src/app/api/debug/route.ts`
- `src/app/api/journey/bounce-back/route.ts`
- `src/app/api/journey/entries/route.ts`
- `src/app/api/journey/profile/route.ts`
- `src/app/api/mentor/route.ts`
- `src/app/api/safe-mirror/route.ts`

GitHub Actions에서 여전히 같은 에러가 나면, **이 변경이 포함된 커밋이 원격에 푸시되었는지** 확인하세요.

---

## 2) 로컬 체크 포인트 (`npm run deploy` 통과)

```bash
cd /Users/hanbit/Documents/web_development/btytrainingcenter/bty-app

# (선택) 아직 있다면 제거 확인 — 아무것도 안 나와야 함
grep -R 'export const runtime = "edge"' src/app/api || true

# 환경변수 설정 후 배포(실제 배포까지 수행)
export NEXT_PUBLIC_SUPABASE_URL="https://xxx.supabase.co"
export NEXT_PUBLIC_SUPABASE_ANON_KEY="your-anon-key"
export NEXT_PUBLIC_SITE_URL="https://your-site.com"
# CLOUDFLARE_API_TOKEN, CLOUDFLARE_ACCOUNT_ID 도 필요 시 설정
npm run deploy
```

`npm run deploy` 가 **OpenNext 빌드까지** 끝나면(에러 없이) 로컬 체크 통과입니다.  
`wrangler deploy` 는 토큰이 없으면 실패할 수 있으므로, “OpenNext 빌드 성공”만 확인해도 됩니다.

---

## 3) 패치 형태 (해당 라인 있을 때 제거용)

아래는 **해당 라인이 있을 때** 제거하는 diff 예시입니다.  
현재는 이미 제거되어 있어서 실제로 적용할 줄은 없습니다.

```diff
--- a/bty-app/src/app/api/admin/organizations/route.ts
+++ b/bty-app/src/app/api/admin/organizations/route.ts
@@ -1,6 +1,5 @@
 import { NextResponse } from "next/server";
 ...
 import { requireAdmin } from "@/lib/require-admin";
-
-export const runtime = "edge";
 
 export const dynamic = "force-dynamic";
```

(나머지 11개 파일도 동일: 파일 상단의 **한 줄**  
`export const runtime = "edge";`  
또는  
`export const runtime = "edge"`  
삭제.)

---

## 4) 푸시 후 검증 체크리스트

- [ ] **GitHub Actions** `.github/workflows/deploy-workers.yml` 성공(초록)
- [ ] **workers.dev** `GET /api/debug` → 200, body에 `hasSupabaseUrl`, `hasAnonKey`, `hasServiceRole` true
- [ ] **workers.dev** `POST /api/auth/login` (유효 계정) → 200, 응답 헤더에 `Set-Cookie`
- [ ] **workers.dev** `GET /api/auth/session` (로그인 후) → 200, body에 `hasSession: true`
- [ ] 브라우저에서 `/admin/login` 로그인 성공 후 → `/admin/debug` 로 리다이렉트

---

Workers 단일 배포 유지. Pages/next-on-pages 관련 스크립트·설정은 추가하지 않음.
