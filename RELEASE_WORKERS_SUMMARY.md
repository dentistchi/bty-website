# Cloudflare Workers 단일 배포 정리 — 변경 요약

## 변경된 파일과 이유

| 파일 | 변경 내용 | 이유 |
|------|-----------|------|
| **bty-app/package-lock.json** | 재생성 | lockfile이 package.json과 불일치(@cloudflare/next-on-pages, vercel 잔여) → `npm ci` Missing 오류 방지. `node_modules` 삭제 후 `npm install`로 재생성. |
| **bty-app/package.json** | `opennext:build` 스크립트 추가, `deploy`에 `prebuild` 포함 | OpenNext 빌드 단계 명확화, 배포 전 NEXT_PUBLIC_* 검사로 빌드 실패 조기 발생. |
| **bty-app/wrangler.toml** | 신규 생성 | Workers 단일 배포: `main = ".open-next/worker.js"`, `[assets] directory = ".open-next/assets"`, `compatibility_date`, `nodejs_compat`. |
| **.github/workflows/deploy-workers.yml** | 신규 생성 | CI: `working-directory: bty-app`, Node 20, `cache-dependency-path: bty-app/package-lock.json`, `npm ci` → `npm run deploy`. NEXT_PUBLIC_*, SUPABASE_SERVICE_ROLE_KEY, CLOUDFLARE_*를 GitHub Secrets로 주입. |
| **bty-app/src/app/api/debug/route.ts** | 응답 형식 정비 | `runtimeEnv: { hasSupabaseUrl, hasAnonKey, hasServiceRole }`, `nodeCompat`, 실제 값 노출 없음. 기존 admin/login 호환용 `hasUrl`/`hasAnon` 유지. |
| **bty-app/src/app/api/auth/login/route.ts** | GET 핸들러 추가 | POST만 허용 명시: GET 시 405 반환. |

## 사전 점검 결과

- **단일 빌드 대상**: bty-app. 루트 `package.json`은 `cd bty-app && npm ci && npm run build`만 보유.
- **Pages 스크립트**: bty-app에는 next-on-pages/pages:build 없음(이미 제거된 상태).
- **워크플로**: `.github/workflows`에 기존 파일 없음 → **deploy-workers.yml** 하나만 사용.

## 실행/검증 체크리스트

1. **GitHub Actions deploy-workers 성공**  
   - main 푸시 후 workflow 실행, `npm ci` 통과, `npm run deploy` 성공.

2. **workers.dev에서 /api/debug 200 + hasSupabaseUrl/hasAnonKey true**  
   - `GET https://<workers-dev-url>/api/debug` → `runtimeEnv.hasSupabaseUrl`, `runtimeEnv.hasAnonKey` true.

3. **POST /api/auth/login 200 + Set-Cookie**  
   - 유효한 email/password로 POST → 200, 응답 헤더에 `Set-Cookie` 포함.

4. **GET /api/auth/session 200 + hasSession true**  
   - 로그인 후 동일 도메인에서 GET → `hasSession: true`.

5. **/admin/login → /admin/debug 리다이렉트**  
   - 로그인 성공 시 `nextPath`(기본 `/admin/debug`)로 이동.

---

## 복붙용 Git 명령어

### 1) 로컬에서 lockfile/node_modules 정리 (이미 재생성했으면 한 번만)

```bash
cd /Users/hanbit/Documents/web_development/btytrainingcenter/bty-app
rm -rf node_modules
npm install
npm ci
```

(`npm ci`가 통과하면 lockfile 정상.)

### 2) 커밋 및 푸시

```bash
cd /Users/hanbit/Documents/web_development/btytrainingcenter

git add bty-app/package.json bty-app/package-lock.json bty-app/wrangler.toml \
  bty-app/src/app/api/debug/route.ts bty-app/src/app/api/auth/login/route.ts \
  .github/workflows/deploy-workers.yml \
  RELEASE_WORKERS_SUMMARY.md

git status

git commit -m "chore: Cloudflare Workers 단일 배포 정리 — lockfile, wrangler, CI, debug/login"

git push
```

(원하면 `RELEASE_WORKERS_SUMMARY.md`는 `git add`에서 제외해도 됨.)
