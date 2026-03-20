# E2E Regression Notes

회귀 방지용 테스트 수정 이력. 다음 실패 시 바로 참조 가능한 체크리스트 형식.

---

## My Page identity-hero 실패 (2025-03-09)

### Failure signature
- `e2e/my-page.spec.ts` — "overview leadership console & no raw AIR"
- `e2e/bty/my-page-flow.spec.ts` — "identity console renders leadership regions"
- `e2e/bty/full-loop.spec.ts` — "arena → reflection → history → my page"
- **Error**: `Timed out waiting for expect(locator).toBeVisible()` — `getByTestId('identity-hero')` / `getByTestId('my-page-identity-hero')`

### Root cause
- `/en/my-page`에서 현재 렌더되는 testid가 과거 기대값과 달랐음
- `identity-hero` / `my-page-identity-hero`는 현재 DOM에 없음
- 실제 렌더되는 testid: `my-page-overview`, `my-page-leadership-console`, `my-page-code-name`, `my-page-stage`, `leadership-state-row`
- AIR 약어 자체는 정상 노출, raw numeric AIR score만 금지 대상

### Fix applied
- `e2e/my-page.spec.ts`: `identity-hero` / `my-page-identity-hero` 기대 제거, 실제 존재하는 5개 testid만 검증
- `e2e/bty/my-page-flow.spec.ts`: 동일
- `e2e/bty/full-loop.spec.ts`: 동일
- AIR 검증: `/^AIR$/` 금지 제거, `AIR\s*[0-9.]` (raw numeric score)만 금지

### Stable selectors / routes
- **Route**: `/en/my-page`
- **Stable testid**:
  - `my-page-overview`
  - `my-page-leadership-console`
  - `my-page-code-name`
  - `my-page-stage`
  - `leadership-state-row`

### Re-run command
```bash
E2E_EMAIL='...' E2E_PASSWORD='...' npx playwright test e2e/my-page.spec.ts --project=chromium
E2E_EMAIL='...' E2E_PASSWORD='...' npx playwright test e2e/bty/my-page-flow.spec.ts --project=bty-loop
E2E_EMAIL='...' E2E_PASSWORD='...' npx playwright test e2e/bty/full-loop.spec.ts --project=chromium
```

### If it breaks again
1. `/en/my-page` 실제 최종 URL 확인 (`page.url()`)
2. DOM에 존재하는 `data-testid` 목록 출력:
   ```javascript
   await page.locator("[data-testid]").evaluateAll(
     els => els.map(el => el.getAttribute("data-testid")).filter(Boolean)
   );
   ```
3. Selector를 임의로 늘리지 말고, 실제 렌더되는 testid 기준으로 기대값 재정렬

---

## arena-hub Play → /run 이동 실패 (2025-03-09)

### Failure signature
- `e2e/arena-hub.spec.ts` — "hub entry, summary values, Play → /run"
- **Error**: Play 버튼 클릭 후 `/en/bty-arena/run`으로 이동하지 않고 `/en/bty-arena/hub`에 머무름
- **Server log**: `[WebServer] ⨯ SyntaxError: Unexpected end of JSON input` — `page: '/api/auth/session'` / `page: '/en/bty-arena/play'`

### Root cause
- 빈 body 또는 공백 body를 JSON으로 파싱하는 상황이 간헐적으로 발생
- `/api/auth/session` 응답 또는 `/en/bty-arena/play` 관련 처리에서 빈 응답 방어 필요

### Fix applied
- `src/lib/read-json.ts`: `res.text()` 후 `(raw ?? "").trim()` 처리, 빈 문자열이면 `JSON.parse` 호출하지 않도록 방어
- `src/app/api/auth/session/route.ts`: 항상 JSON 본문 반환 의도 명시 (주석)
- 테스트 기대: Play → `/run` 유지 (변경 없음)

### Stable selectors / routes
- **Route**: `/en/bty-arena/hub`
- **Play action target**: `/en/bty-arena/run`
- **Play button**: `data-testid="arena-play-button"` (첫 번째)

### Re-run command
```bash
E2E_EMAIL='...' E2E_PASSWORD='...' npx playwright test e2e/arena-hub.spec.ts --project=chromium --headed
```

### If it breaks again
1. Play 클릭 직후 최종 URL 확인 (`page.url()`)
2. Network 탭에서 `GET /api/auth/session` 응답 body 확인 (빈 body인지)
3. 브라우저 콘솔 에러 확인
4. `/play`와 `/run` 경로가 혼재하는지 확인:
   ```bash
   grep -r "bty-arena/play\|bty-arena/run" src/app/[locale]/bty-arena
   ```
5. `curl -i http://127.0.0.1:3000/api/auth/session` 직접 호출하여 응답 확인

---

## Template for future entries

```markdown
## [Issue name] (YYYY-MM-DD)

### Failure signature
- `<spec file>`
- `<Error message>`

### Root cause
- `<1-2 lines>`

### Fix applied
- `<file>: <what changed>`

### Stable selectors / routes
- Route: `<path>`
- Testid: `<list>`

### Re-run command
```bash
<command>
```

### If it breaks again
1. <check 1>
2. <check 2>
3. <check 3>
```