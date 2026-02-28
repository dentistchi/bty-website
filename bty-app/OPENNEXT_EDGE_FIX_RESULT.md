# OpenNext "edge runtime" 에러 제거 — 전수검색 및 패치 결과

## 1) Edge runtime 전수검색 결과 (근거)

### 1-1. `export const runtime` / `runtime = "edge"` / `experimental-edge`

| 검색 패턴 | 위치 | 비고 |
|-----------|------|------|
| `export const runtime` | **없음** | API 라우트에서 이미 전부 제거된 상태 |
| `runtime = 'edge'` / `"edge"` | **없음** | - |
| `experimental-edge` | **bty-app/src/middleware.ts:100** | `config.runtime: "experimental-edge"` (Next.js middleware용, API route와 무관) |

- **debug/route.ts** 의 `runtimeEnv:` 는 JSON 속성 이름일 뿐, 런타임 선언 아님.
- **supabase-admin-types.ts** 의 "runtime" 은 주석 문구.

### 1-2. route 파일 중복 (src/app vs app)

```text
find bty-app -path "*app/api/*/route.ts" -type f
```

- **소스:** `bty-app/src/app/api/**/route.ts` 만 존재 (12개).
- **빌드 산출물:** `bty-app/.next/types/app/api/.../route.ts` (Next 생성).
- **결론:** `src/app` 과 별도 `app` 경로로의 **중복 route 파일 없음**. 수정 대상은 `src/app/api/` 루트만 해당.

---

## 2) 적용한 패치 (파일별 변경 요약)

OpenNext가 "app/api/admin/organizations/route cannot use the edge runtime" 로 에러를 내는 경우, **기본/추론되는 edge를 막기 위해** 해당 라우트에 `runtime = "nodejs"` 를 명시함.

### 2-1. bty-app/src/app/api/admin/organizations/route.ts

- **추가:** `export const runtime = "nodejs";` (import 블록 다음, `dynamic` 앞)
- **이유:** 에러 메시지에서 직접 명시된 라우트. Node 런타임 고정으로 edge 분리 번들 요구 회피.

### 2-2. bty-app/src/app/api/admin/users/route.ts

- **추가:** `export const runtime = "nodejs";` (import 블록 다음)
- **이유:** 동일 admin API, `getSupabaseAdmin()` 등 Node 전제 로직. 동일 에러 재발 방지.

### 2-3. middleware.ts (experimental-edge)

- **변경 없음.** Next.js middleware는 `experimental-edge` 가 일반적이며, OpenNext 에러는 **app/api/.../route** 대상이므로 middleware 설정은 유지.

---

## 3) 로컬 재현 확인 (실행 순서)

아래는 **bty-app** 디렉터리에서 실행. (CI와 동일한 흐름.)

```bash
cd /Users/hanbit/Dev/btytrainingcenter/bty-app

# 1) 의존성 고정 (lockfile 기준)
npm ci

# 2) Next 빌드
npm run build

# 3) OpenNext 빌드 + wrangler 배포 (env 필요)
export NEXT_PUBLIC_SUPABASE_URL="https://xxx.supabase.co"
export NEXT_PUBLIC_SUPABASE_ANON_KEY="your-anon-key"
export NEXT_PUBLIC_SITE_URL="https://your-site.com"
npm run deploy
```

- `npm run deploy` 는 `prebuild` → `opennext:build` → `wrangler deploy` 순서.
- OpenNext 단계까지 에러 없이 끝나면 "edge runtime" 관련 실패는 해소된 것으로 보면 됨.
- `wrangler deploy` 는 `CLOUDFLARE_API_TOKEN` / `CLOUDFLARE_ACCOUNT_ID` 가 없으면 실패할 수 있음 (CI에서는 Secrets로 주입).

---

## 4) .github/workflows/deploy-workers.yml 확인

- **working-directory:** `bty-app` ✅  
- **steps:** checkout → setup-node (Node 20, cache `bty-app/package-lock.json`) → **npm ci** → **npm run deploy** ✅  
- **env:** `NEXT_PUBLIC_*`, `SUPABASE_SERVICE_ROLE_KEY`, `CLOUDFLARE_*` 를 GitHub Secrets 사용 ✅  

추가 변경 없음. 현재 워크플로만으로 CI 재현 가능.

---

## 5) CI 통과를 위한 최소 변경 커밋 제안

아래 두 파일만 포함한 커밋으로 푸시하면 됨.

```bash
cd /Users/hanbit/Dev/btytrainingcenter

git add bty-app/src/app/api/admin/organizations/route.ts \
        bty-app/src/app/api/admin/users/route.ts

git commit -m "fix(opennext): set runtime=nodejs for admin API routes to avoid edge runtime error"

git push origin main
```

**요약:**  
- Edge runtime 잔여는 **API 라우트에 없음** (검색 근거 명시).  
- **admin/organizations**, **admin/users** 에 `export const runtime = "nodejs"` 추가로 OpenNext가 해당 라우트를 edge로 분리하지 않도록 함.  
- 워크플로는 이미 `bty-app` 기준 `npm ci` → `npm run deploy` 로 올바르게 설정됨.
