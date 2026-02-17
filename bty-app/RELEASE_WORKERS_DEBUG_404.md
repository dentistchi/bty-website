# workers.dev /api/debug 404 해결 — 체크리스트·가설·패치·검증

## 1) 지금 상태 결론 (3줄)

- **원인 후보:** 배포 시 `wrangler deploy`만 사용해 OpenNext가 요구하는 원격 캐시/설정이 적용되지 않았고, `WORKER_SELF_REFERENCE` 서비스 바인딩이 없어 라우팅이 기대대로 동작하지 않았을 가능성이 큼.
- **적용한 수정:** (1) `package.json` deploy 스크립트를 `opennextjs-cloudflare deploy`로 변경, (2) `wrangler.toml`에 `services` 블록(`WORKER_SELF_REFERENCE` → `bty-website`) 추가.
- **다음:** 아래 A~D 점검 후 푸시하고, workers.dev에서 검증 명령/URL로 재확인.

---

## A) Actions 성공 run ↔ 실제 배포 대상·workers.dev 일치 점검

**체크리스트 (Actions 성공 run 로그 기준)**

| # | 확인 항목 | 확인 방법 | 예시/기대값 |
|---|-----------|-----------|-------------|
| 1 | 빌드한 커밋 SHA | Run 상단 또는 "Run workflow" 옆 커밋 | main 최신 (예: 9507f62 이후) |
| 2 | working-directory | 로그 내 "Working directory" 또는 step 로그 | `bty-app` |
| 3 | deploy 단계 성공 | "Deploy (OpenNext build + wrangler deploy)" step 초록 | "Published bty-website (x.xx sec)" 또는 "Deployed bty-website" |
| 4 | Worker 이름 | deploy 로그에 나오는 이름 | `bty-website` (wrangler.toml의 `name`) |
| 5 | workers.dev URL | Cloudflare 대시보드 Workers → bty-website → "View" 또는 로그의 URL | `https://bty-website.<계정서브도메인>.workers.dev` |
| 6 | 접속 중인 URL이 위와 동일한지 | 브라우저/curl 기준 URL | Pages(*.pages.dev)가 아니라 **workers.dev** 인지 확인 |

**결론:** 접속 URL이 `https://bty-website.<subdomain>.workers.dev` 이고, Actions가 배포한 Worker 이름이 `bty-website`와 일치해야 함. Pages URL이면 404 가능.

---

## B) /api/debug 404 가능 원인 3~5개 (가설 → 확인 → 수정)

| # | 가설 | 확인 방법 | 수정 |
|---|------|-----------|------|
| 1 | **wrangler deploy만 사용** → OpenNext 원격 캐시/설정 미적용 | package.json의 deploy 스크립트 확인 | `wrangler deploy` → `opennextjs-cloudflare deploy` 로 변경 (아래 C 적용) |
| 2 | **WORKER_SELF_REFERENCE 없음** → Next 라우팅이 자기 자신을 fetch하지 못함 | wrangler.toml에 `[[services]]` binding 존재 여부 | `WORKER_SELF_REFERENCE` → `bty-website` 서비스 블록 추가 (아래 C 적용) |
| 3 | **잘못된 URL 접속** (Pages / 다른 Worker) | 접속 URL 호스트 확인 | 반드시 `*.workers.dev` 이고, Worker 이름이 `bty-website` 인 URL로 테스트 |
| 4 | **main/assets 경로 불일치** | wrangler.toml의 main, assets 값 | `main = ".open-next/worker.js"`, `directory = ".open-next/assets"` 유지 (이미 일치) |
| 5 | **debug 라우트 번들 누락/경로** | App Router 규칙: `src/app/api/debug/route.ts` → `/api/debug` | 파일 존재 및 GET export 확인 (아래 C에서 경로 점검) |

---

## C) 리포지토리 내 확인 위치 + 적용한 패치

### C-1. bty-app/wrangler.toml

**위치:** `bty-app/wrangler.toml`

**적용 패치:** OpenNext 권장 `services` 블록 추가.

```toml
# 기존 유지
name = "bty-website"
main = ".open-next/worker.js"
compatibility_date = "2025-02-11"
compatibility_flags = ["nodejs_compat"]

[assets]
directory = ".open-next/assets"
binding = "ASSETS"

# 추가: OpenNext — self-reference for Next.js routing
[[services]]
binding = "WORKER_SELF_REFERENCE"
service = "bty-website"
```

### C-2. bty-app/package.json (deploy / opennext:build)

**위치:** `bty-app/package.json` → `scripts.deploy`, `scripts.opennext:build`

**적용 패치:** deploy 시 `wrangler deploy` 대신 `opennextjs-cloudflare deploy` 사용.

```json
"opennext:build": "opennextjs-cloudflare build",
"deploy": "npm run prebuild && npm run opennext:build && opennextjs-cloudflare deploy"
```

### C-3. .github/workflows/deploy-workers.yml

**위치:** `.github/workflows/deploy-workers.yml`

**확인:**  
- `defaults.run.working-directory: bty-app`  
- steps: checkout → setup-node (Node 20, cache `bty-app/package-lock.json`) → `npm ci` → `npm run deploy`  
- env에 `NEXT_PUBLIC_*`, `SUPABASE_SERVICE_ROLE_KEY`, `CLOUDFLARE_*`  
**추가 변경 없음.** (이미 올바른 흐름.)

### C-4. bty-app/src/app/api/debug/route.ts (존재·App Router 규칙)

**위치:** `bty-app/src/app/api/debug/route.ts`

**확인:**  
- 파일 존재: `src/app/api/debug/route.ts` → Next App Router상 **GET /api/debug** 에 대응.  
- `export async function GET()` 만 있으면 됨. (현재 구현 유지.)

**추가 변경 없음.**

---

## D) 검증 명령·URL (복붙용)

**사전:** `BASE`를 실제 workers.dev URL로 바꿈. (예: `https://bty-website.<subdomain>.workers.dev`)

```bash
# BASE 설정 (본인 workers.dev URL로 교체)
BASE="https://bty-website.YOUR_SUBDOMAIN.workers.dev"

# 1) /api/debug 200 + hasSupabaseUrl/hasAnonKey/hasServiceRole
curl -s -o /dev/null -w "%{http_code}" "$BASE/api/debug" && echo " (expect 200)"
curl -s "$BASE/api/debug" | head -c 500

# 2) POST /api/auth/login (테스트 계정으로)
curl -s -X POST "$BASE/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"YOUR_EMAIL","password":"YOUR_PASSWORD"}' \
  -c /tmp/cookies.txt -b /tmp/cookies.txt -w "\nHTTP %{http_code}\n" -o /tmp/login.json
cat /tmp/login.json

# 3) GET /api/auth/session (쿠키 포함)
curl -s "$BASE/api/auth/session" -b /tmp/cookies.txt | head -c 400

# 4) 브라우저 수동 확인
echo "브라우저에서: $BASE/admin/login → 로그인 → /admin/debug 리다이렉트 확인"
```

**한 줄 요약:**  
`BASE`만 바꾼 뒤 위 블록 통째로 실행 → /api/debug 200, login 200+Set-Cookie, session 200+hasSession, /admin/login → /admin/debug 리다이렉트까지 확인.
