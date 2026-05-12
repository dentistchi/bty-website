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

### LLM endpoint (서버 전용 — 선택)
- `LLM_BASE_URL` — 설정 시 OpenAI 기본 URL 대신 사용. 예: `http://100.109.32.24:11434/v1` (로컬 Ollama)
- `LLM_MODEL` — 사용할 모델명. 미설정 시 `gpt-4o-mini`. 예: `gemma3:27b`
- `LLM_API_KEY` — 미설정 시 `OPENAI_API_KEY`로 폴백. Ollama는 임의 값(예: `ollama`)
- `OPENAI_API_KEY` — `LLM_BASE_URL` 미설정 시 필수. Cloudflare Workers staging/prod에 secret으로 주입.

---

## 3) Where to set (권장 운영)

### GitHub Actions
- Repository Secrets / Variables로 주입
- Cloudflare deploy step에서 Workers 환경변수로 전달되도록 설정(프로젝트 구성에 따름)

### Cloudflare Workers
- Worker 환경변수(Production/Preview 분리 가능)
- 값 변경 시: "새 배포 이후에만" 반영되는지(캐시/미스매치) 확인

### Cloudflare Workers (staging/prod) 챗봇 활성화
- `OPENAI_API_KEY`를 wrangler secret으로 주입:
  ```bash
  cd bty-app
  npx wrangler secret put OPENAI_API_KEY --config wrangler.toml
  ```
- `LLM_BASE_URL`은 staging/prod에 설정하지 않음 (로컬 Ollama는 Cloudflare에서 도달 불가).

---

## 4) Debug checklist

- `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` 미주입:
  - `npm run build` 또는 check-env 단계에서 실패 가능
- 로그인 관련 이슈:
  - 먼저 `/api/auth/session`에서 request cookie 유무 / status / body 확인
  - 상세: `docs/CONTEXT.md` §3 Supabase Auth 및 §4 작업 규칙
