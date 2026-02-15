# Cloudflare Workers 배포 — bty-app (workers.dev)

**bty-app**은 **Cloudflare Workers (workers.dev)** 단일 배포입니다. Pages 배포는 사용하지 않습니다.

## 배포 흐름

1. `main`에 push → GitHub Actions `deploy-workers.yml` 실행
2. bty-app에서 `opennextjs-cloudflare build` (NEXT_PUBLIC_*는 Secrets에서 주입)
3. `wrangler deploy`로 Workers에 배포
4. 배포 URL: `https://bty-website.<account>.workers.dev` (또는 연결된 커스텀 도메인)

## 필수 설정

- **GitHub Secrets:** `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`
- **Cloudflare Workers → bty-website → Settings → Variables:** 위 Supabase 변수 + `SUPABASE_SERVICE_ROLE_KEY`

## 로컬

- 개발: `cd bty-app && npm run dev`
- 배포 테스트: `cd bty-app && npm run deploy`
