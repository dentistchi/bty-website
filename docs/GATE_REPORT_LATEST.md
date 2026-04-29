# BTY Release Gate Report (Gatekeeper / Error-check)

**일시**: 2026-03-03  
**범위**: 변경된 파일/PR diff 기준 규칙 준수 검사 (bty-release-gate, bty-auth-deploy-safety, bty-ui-render-only, AGENTS_SHARED_README).

---

## 1. Assumptions

- **검사 기준**: 최근 변경분(Arena 한국어 locale·reflect API·Beginner Arena·아바타 검증·타입 정리) 및 규칙이 적용되는 기존 경로(대시보드·리더보드·arena API·auth).
- **단일 소스**: XP/시즌/리더보드/아바타 비즈니스 규칙은 `src/domain/` 또는 `src/lib/bty/arena/` 에만 존재한다고 가정.
- **API**: Handlers는 도메인/엔진 호출 결과만 반환하며, XP/랭킹을 handler 내부에서 새로 계산하지 않는다고 가정.
- **UI**: Arena/리더보드/대시보드 UI는 API·도메인에서 받은 값만 표시(숫자·날짜 포맷만 허용)하며, 정렬/티어 유도/경계 추론이 없다고 가정.

---

## 2. Release Gate Results: **PASS**

현재 코드베이스 기준으로 위 규칙 위반 없음. 단, 아래 F) Verification Steps 및 Required patches에서 **UI 내 tierFromCoreXp/codeIndexFromTier 사용 여부**를 반드시 확인할 것.

---

## 3. Findings

### A) Auth / Cookies / Session

- **변경 없음.** 최근 변경분에 `middleware.ts`, `authCookies.ts`, auth 콜백 등 쿠키/세션 설정 변경 없음.
- **리더보드 API** (`src/app/api/arena/leaderboard/route.ts`): 응답 시 `tmp.cookies.getAll()` 로 쿠키를 복사해 설정함. 기존 동작 유지.
- **권장**: Auth/쿠키를 건드리는 PR이 생기면 bty-auth-deploy-safety 대로 Secure/SameSite/Path 근거, 런타임 영향·롤백, How to verify를 출력에 포함할 것.

### B) Weekly Reset Safety

- **변경 없음.** 리셋·weekly_xp·core_xp 저장 로직을 건드린 변경 없음.
- **가정**: 리셋 경계는 week_id 또는 week_start_date 등 기존 소스 오브 트루스 유지; 주간 리셋이 Core XP 저장/이력을 변경하지 않음; 리더보드 정렬은 Weekly XP만 사용.

### C) Leaderboard Correctness

- **확인**: `src/app/api/arena/leaderboard/route.ts`
  - 정렬: `weekly_xp` 테이블 `order("xp_total", { ascending: false })` — Weekly XP 기준만 사용.
  - 행별 codeName/subName/tier: `tierFromCoreXp`, `codeIndexFromTier`, `subTierGroupFromTier`, `resolveSubName`, `calculateTier` 등 **도메인(codes.ts, domain.ts) 호출**로 계산. Handler 내부에서 새로 만든 XP/랭킹 공식 없음.
  - 시즌 필드(`season`)는 응답에 포함되나 **정렬에는 사용되지 않음** (ranking은 weekly_xp만 사용).
- **UI**: `src/app/[locale]/bty/leaderboard/page.tsx` — API 응답(`leaderboard`, `nearMe`, `myRank` 등)만 사용, 클라이언트 정렬/랭킹 계산 없음. Loading/Empty/Error 처리 있음.

### D) Data / Migration Safety

- **변경 없음.** 이번 검사 범위에 마이그레이션 추가/변경 없음. (아바타 관련 마이그레이션은 이미 완료된 것으로 가정.)

### E) API Contract Stability

- **변경된 API**:
  - `POST /api/arena/reflect`: body에 `locale` 추가. 응답 형식 기존 유지; summary/next_action은 서버에서 locale에 따라 생성.
  - `GET/PATCH /api/arena/profile/avatar`: 타입을 `@/types/arena` 로 이전. 요청/응답 스키마 변경 없음.
- **UI**: 위 API에서 내려준 값만 사용; UI에서 XP/시즌/랭킹 규칙을 중복 계산하지 않음.

### F) Verification Steps

- **필수 확인**: UI(`.tsx`)에서 `tierFromCoreXp` 또는 `codeIndexFromTier`를 import해 **클라이언트에서 tier/codeIndex를 coreXp로부터 유도**하고 있으면 **규칙 위반**.
- **검사 결과**: `src/app/[locale]/bty/(protected)/dashboard/page.client.tsx` 상단 import 및 본문 검색 시, 현재 버전에서는 `tierFromCoreXp`/`codeIndexFromTier` import 없음. `CoreXpRes` 타입에 "Display-only from API (bty-ui-render-only: no derivation in UI)" 주석 있음.
- **다른 브랜치/이전 스냅샷**에서 대시보드가 `tierFromCoreXp(coreXp)` 또는 `codeIndexFromTier(tierFromCoreXp(coreXp))` 를 사용하고 있다면 그 부분은 **FAIL 후보**로 제거하고, codeName/stage/progressPct 등은 core-xp API에서 내려주는 값만 사용할 것.

---

## 4. Required patches (우선순위 순)

- **없음** (현재 코드 기준).
- **조건부 패치**: 다른 브랜치나 이전 커밋에서 `dashboard/page.client.tsx`(또는 기타 UI)가 `tierFromCoreXp`/`codeIndexFromTier`를 사용해 tier/codeIndex를 유도하고 있다면:
  - **파일**: 해당 `page.client.tsx`(또는 해당 컴포넌트).
  - **요구**: `tierFromCoreXp`, `codeIndexFromTier` import 및 그에 의한 tier/codeIndex 계산 제거. 대시보드용 code/stage/progress 등은 `GET /api/arena/core-xp` 응답 필드만 사용.

---

## 5. Next steps checklist (로컬 / preview / prod)

1. **로컬**
   - 로그인 → XP 적립 → 프로필·리더보드 확인.
   - `npm run test` (특히 arena/domain/leaderboard 관련).
   - (선택) `rg "tierFromCoreXp|codeIndexFromTier" --glob "*.tsx" src` 결과가 비어 있는지 확인.
2. **Preview**
   - 배포 프리뷰에서 로그인 유지·새로고침·리더보드 로드 확인.
3. **Production**
   - 배포 후 쿠키 동작·리더보드 로드·401 루프 없음 확인.

---

**문서 갱신**: CURRENT_TASK.md, CURSOR_TASK_BOARD.md 표는 이번 Gate 검사만 수행했으므로 기존 내용 유지. 규칙 위반 수정이 발생하면 해당 작업 행에 "Gate 검사 반영" 등 한 줄 요약 추가 권장.
