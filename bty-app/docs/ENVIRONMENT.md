# Environment Variables (Single Source of Truth)

## Required
- NEXT_PUBLIC_SUPABASE_URL
- NEXT_PUBLIC_SUPABASE_ANON_KEY

## Optional
- SUPABASE_SERVICE_ROLE_KEY (서버 관리 작업 시에만)

## Where to set
- GitHub Secrets/Variables
- Cloudflare Workers env (prod/preview 분리 가능)

---

## Arena DB (MVP)
- 추가 env 없이도 가능(쿠키 세션 + anon key)
- 서버에서 관리자 집계/리그 운영 자동화를 하려면 추후 `SUPABASE_SERVICE_ROLE_KEY` 사용 고려
