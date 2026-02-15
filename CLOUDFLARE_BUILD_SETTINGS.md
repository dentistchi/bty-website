# Cloudflare Workers 배포 설정 (단일화)

**이 프로젝트는 Cloudflare Pages가 아닌 Cloudflare Workers (workers.dev) 단일 배포로 운영됩니다.**

## 배포 방식

- **빌드:** `@opennextjs/cloudflare` (OpenNext)
- **배포:** GitHub Actions → `wrangler deploy`
- **대상:** `bty-website` Worker (workers.dev)

## GitHub Actions

- 워크플로: `.github/workflows/deploy-workers.yml` (유일한 배포 워크플로)
- `main` push 시: bty-app에서 `opennextjs-cloudflare build` 후 `wrangler deploy`

## 환경 변수

### 빌드 타임 (GitHub Secrets → Actions env)

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- (선택) `NEXT_PUBLIC_SITE_URL`

### 런타임 (Cloudflare Workers 대시보드 → Variables)

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

## 로컬

- 빌드: `cd bty-app && npm run build`
- 배포: `cd bty-app && npm run deploy` (wrangler 로그인 필요)
