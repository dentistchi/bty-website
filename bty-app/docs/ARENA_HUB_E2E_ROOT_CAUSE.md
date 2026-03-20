# arena-hub.spec.ts 실패 — Root cause 조사

## 현상

- **테스트**: Play 클릭 후 `/en/bty-arena/run`으로 이동 기대, 실제로는 `/en/bty-arena/hub`에 머무름.
- **서버 로그**:
  - `[WebServer] ⨯ SyntaxError: Unexpected end of JSON input` — `page: '/api/auth/session'`
  - 동일 에러 — `page: '/en/bty-arena/play'`

## 조사 결과

### 1. Play 버튼 → 이동 경로

- **구현**: `ArenaHubEntryCard.tsx`에서 Play는 `<Link href={play}>`, `play = \`/${locale}/bty-arena/run\``.
- **결론**: selector/경로는 맞음. Hub → **/run**으로만 연결됨. /play는 다른 플로우(미션 로비 `page.tsx`)에서만 사용.

### 2. `/api/auth/session` 응답

- **구현**: `src/app/api/auth/session/route.ts` GET은 모든 분기에서 `NextResponse.json(...)`만 반환 (200 + 본문 있음). 빈 body를 반환하는 경로 없음.
- **결론**: 우리 라우트 자체는 빈 응답을 내보내지 않음.

### 3. 세션을 소비하는 쪽 (JSON 파싱)

- **호출처**: `AuthContext`, `BtyAuthGuard`(2곳), `auth-client.fetchSession`, `admin/debug` — 전부 `fetchJson()` 사용.
- **fetchJson** (`src/lib/read-json.ts`): `res.text()` 후 `raw ? JSON.parse(raw) : undefined` + try/catch로 파싱 실패 시 `json = undefined`만 설정, **throw 없음**.
- **결론**: 우리 클라이언트 코드에서 `/api/auth/session` 응답을 `res.json()` 등으로 직접 파싱해 “Unexpected end of JSON input”을 낼 경로는 없음.

### 4. “Unexpected end of JSON input”이 나올 수 있는 곳

- **가능 1**: Next/Supabase 내부에서 응답을 파싱할 때 (예: RSC, prefetch, Supabase 클라이언트).
- **가능 2**: `page: '/api/auth/session'` / `page: '/en/bty-arena/play'`는 “그 요청/페이지 처리 중에 발생한 에러”를 가리키는 로그일 수 있음. 즉, 세션 API가 빈 body를 준 게 아니라, **다른 요청(/play 등) 처리 중**에 빈 payload를 JSON으로 파싱하다 에러가 났을 수 있음.
- **가능 3**: E2E/헤드리스 환경에서 쿠키·타이밍 이슈로 실제 응답이 비거나 깨져, 어딘가에서 그걸 JSON으로 파싱하는 경우.

### 5. Hub에 머무는 이유 (추정)

- Play 클릭 → /run으로 이동 시도.
- 그 과정에서 **세션 체크 또는 /run(또는 관련 RSC/prefetch) 처리 중** “Unexpected end of JSON input” 발생.
- 에러로 인해 네비게이션 중단 또는 에러 바운더리/리다이렉트로 인해 URL이 /run으로 바뀌지 않고 hub에 머무는 것으로 추정.

## 권장 다음 단계

1. **헤디드 + 네트워크 확인**
   - `npx playwright test e2e/arena-hub.spec.ts --project=chromium --headed`
   - Play 클릭 직후: 최종 URL, 브라우저 콘솔 에러, Network에서 `GET /api/auth/session` 응답 상태·본문(비어 있는지) 확인.
2. **세션 API 직접 호출**
   - `curl -i http://127.0.0.1:3000/api/auth/session` (E2E와 동일 호스트/쿠키 필요 시 `-b` 사용).
   - 200 + JSON 본문인지, 빈 body/비 JSON인지 확인.
3. **방어 코드 (선택)**
   - 세션 GET: 어떤 예외가 나도 200 + `{ ok: false, ... }` 형태의 JSON 반환 보장.
   - 클라이언트: 이미 `fetchJson`으로 빈/비정상 body 방어됨. 추가로 `read-json`에서 `raw.trim()` 비어 있으면 파싱 스킵하면 더 안전.

## 요약

- **원인**: “Unexpected end of JSON input”은 우리 앱의 세션 라우트/클라이언트 `fetchJson` 경로만 보면 재현 경로가 없음. Next/ Supabase 내부 또는 /play 관련 처리에서 빈/깨진 payload를 JSON으로 파싱할 때 발생하는 가능성이 큼.
- **테스트 실패**: 그 에러로 인해 Play 클릭 후 /run으로의 이동이 완료되지 않고 hub에 머무는 것으로 보임.
- **수정 우선순위**: (1) 세션 API가 어떤 상황에서도 빈 body를 내지 않도록 방어, (2) 위 1·2단계로 실제 응답/에러 위치 확인 후, 필요 시 Next/Supabase 쪽 또는 /play 관련 코드에서 빈 body 파싱 제거/방어.
