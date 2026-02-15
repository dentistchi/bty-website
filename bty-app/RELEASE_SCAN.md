# 레포 스캔 결과 (Workers 단일화)

## A. 모노레포 구조

| 항목 | 경로 | 존재 |
|------|------|------|
| 루트 package.json | `package.json` | ✅ |
| bty-app package.json | `bty-app/package.json` | ✅ |
| 루트 package-lock.json | `package-lock.json` | ✅ |
| bty-app package-lock.json | `bty-app/package-lock.json` | ✅ |
| yarn.lock | (전역) | ❌ |
| pnpm-lock.yaml | (전역) | ❌ |
| next.config.* | `bty-app/next.config.js` | ✅ (bty-app만) |
| open-next 관련 | `bty-app/open-next.config.ts` | ✅ |

## B. 배포 경로/도구 혼용 흔적

| 키워드 | 발견 위치 (bty-app 또는 루트 기준) |
|--------|-----------------------------------|
| next-on-pages / @cloudflare/next-on-pages / pages:build | 루트 `package.json` (pages:build), `bty-app/package-lock.json`, `bty-app/REPAIR_REPORT.md`, `bty-app/package 2.json`, 루트 `DEPLOY.md`, `CLOUDFLARE_BUILD_SETTINGS.md`, 여러 *2.md |
| @opennextjs/cloudflare / opennextjs-cloudflare / .open-next/worker.js / wrangler deploy | `bty-app/package.json`, `bty-app/wrangler.toml`, `.github/workflows/deploy-workers.yml` |
| .vercel/output/static / pages_build_output_dir | `CLOUDFLARE_BUILD_SETTINGS.md`, `DEPLOY.md`, bty-app 내 DEPLOY_CLOUDFLARE.md, TROUBLESHOOTING.md 등 문서 |
| Deploy to Cloudflare Pages / Deploy OpenNext | (워크플로는 이미 삭제됨) |

**워크플로:** `.github/workflows/deploy-workers.yml` 1개만 존재 → Workers 배포용.

## C. auth/supabase 관련

| 항목 | 위치 | 비고 |
|------|------|------|
| supabase (browser) | `bty-app/src/lib/supabase.ts` | NEXT_PUBLIC_* 빌드타임 사용 |
| login API | `bty-app/src/app/api/auth/login/route.ts` | NextResponse + createServerClient cookies |
| session API | `bty-app/src/app/api/auth/session/route.ts` | GET: getAuthUserFromRequest; POST: cookies() 사용 |
| middleware | `bty-app/src/middleware.ts` | /admin 보호, /admin/login·/auth 통과, CORS /api |

## 확정: 제거/이동/수정 후보

- **제거(삭제) 후보:**  
  루트 `package.json`의 `pages:build` 스크립트.  
  bty-app 내 Pages 중심 문서를 Workers로 전환하거나 상단에 “Workers 단일화됨” 안내.

- **이동(legacy) 후보:**  
  `bty-app/package 2.json`, `bty-app/package-lock 2.json`, `bty-app/package-lock 3.json`, `bty-app/package-lock 4.json`, `bty-app/* 2.md` 등 번호 붙은 백업 파일 → `docs/legacy/` 이동 또는 삭제(빌드/배포에 미사용).

- **수정(Workers 유지) 후보:**  
  `CLOUDFLARE_BUILD_SETTINGS.md`, `DEPLOY.md` → Workers 단일 배포로 문구 수정.  
  `bty-app/package.json` → 이미 OpenNext + wrangler deploy 구조.  
  `/api/debug` → 응답 형식 ok, runtimeEnv, buildInfo(선택) 통일.  
  `/api/auth/session` GET → ok, hasSession, userId(선택) 형식 점검.  
  로그인 쿠키 옵션(secure 등) workers.dev 기준 점검.
