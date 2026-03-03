# BTY 배포 전 체크 결과 (bty-release-gate)

**실행일**: 배포 전 체크.  
**규칙**: `.cursor/rules/bty-release-gate.mdc`  
**범위**: bty-app (Auth, Weekly Reset, Leaderboard, XP, API).

---

## 1) Assumptions

- **리더보드**: `weekly_xp` 테이블(league_id IS NULL) 한 종류만 사용하며, 정렬은 `xp_total desc`.
- **Weekly XP**: `weekly_xp` 테이블 및 `weekly_xp_ledger`(이벤트 로그)에 저장. 리셋 시 `weekly_xp.xp_total`만 변경(또는 시즌 종료 시 10% carryover).
- **Core XP**: `arena_profiles.core_xp_total` 및 `core_xp_ledger`에 저장. 리셋/시즌 전환에서 **수정하지 않음**.
- **UI**: API/engine에서 전달한 값만 렌더; XP/랭킹/시즌 규칙은 계산하지 않음(bty-ui-render-only).
- **이번 검사**: 최근 적용분(첫인상 디자인: 히어로·폰트·악센트·호버)은 **XP/시즌/리더보드/인증/쿠키를 건드리지 않음**. 따라서 A~F 전 항목을 현재 코드베이스 기준으로 점검.

---

## 2) Release Gate Results: **PASS**

배포 가능. 아래 Findings에서 권장 보완(리더보드 타이 브레이커) 1건만 있음.

---

## 3) Findings (A–F)

### A) Auth / Cookies / Session

| 항목 | 결과 |
|------|------|
| **Cookie 설정** | `authCookies.ts`: Path=`/`, Domain 미설정(host-only), **SameSite=Lax**, **Secure=true**, **HttpOnly=true**. `writeSupabaseAuthCookies`·`expireAuthCookiesHard` 동일 옵션. `middleware.ts` setAll에서도 path=`/`, sameSite=`lax`, secure=`true`, httpOnly=`true`. `route-client.ts`의 `setAuthCookie`·`cookieOptions` 동일. |
| **로그아웃 시 쿠키·세션** | `middleware.ts` `/bty/logout`: `Clear-Site-Data: "cookies"`, `expireAuthCookiesHard(req, res)` 호출. `expireAuthCookiesHard`는 AUTH_COOKIE_NAMES 5종을 Path `/` 및 `/api`에서 만료. 로그아웃 시 쿠키·세션 제거됨. |
| **Runtime 변경** | API·middleware 모두 Node. Edge/Worker 전환 없음. 전환 시 쿠키/세션 동작 영향·롤백 계획 문서화 필요. |

### B) Weekly Reset Safety

| 항목 | 결과 |
|------|------|
| **리셋 경계 소스** | 시즌(30일) 경계: `activeLeague.ts`의 `getCurrentWindow()` (EPOCH + PERIOD_MS). 새 리그 생성 전 `run_season_carryover()` 호출. `weekly_xp`는 (user_id, league_id) 단위; MVP에서는 league_id IS NULL 글로벌 풀만 사용. |
| **Core XP 비수정** | `run_season_carryover()` (20260227_season_carryover.sql): `weekly_xp`만 `UPDATE ... SET xp_total = floor(xp_total * 0.1) WHERE league_id IS NULL`. `arena_profiles.core_xp_total`·`core_xp_ledger`는 **절대 수정하지 않음**. |
| **멱등성** | Run 완료 시 `RUN_COMPLETED_APPLIED` 등 source_id 기반 1회 적용. 리셋 함수는 시즌 경계 시 1회 호출(새 리그 생성 시). 동일 시즌에 리그가 없을 때만 생성하므로, 리셋 로직이 두 번 돌아도 10% 적용이 중복 적용되는 구조는 아님(한 번만 호출되는 흐름). |
| **동시성** | XP 부여는 run/complete·activity 등 API에서 행 단위 SELECT 후 INSERT/UPDATE. 리셋 구간과 동시 발생 시 운영 측에서 리셋 job 순서·lock 정책 확인 권장. |

### C) Leaderboard Correctness

| 항목 | 결과 |
|------|------|
| **정렬** | `GET /api/arena/leaderboard`: `weekly_xp`에서 **league_id IS NULL**, **order by xp_total desc**, limit 100. **Weekly XP만** 사용. |
| **타이 브레이커** | 현재 **xp_total desc** 단일 정렬. 동점 시 순서 비결정적. **권장**: `updated_at asc`, `user_id asc` 등 2·3차 정렬 추가 후 스펙에 명시. |
| **시즌 필드** | 순위 계산에는 미사용. `season`은 응답에 표시용(league name, start_at, end_at)으로만 포함. |

### D) Data / Migration Safety

- 이번 체크에서 **새 마이그레이션 적용·변경 없음**.
- 기존 구조: `arena_profiles`(core_xp_total), `weekly_xp`, `core_xp_ledger`, `weekly_xp_ledger` 등으로 Core/Weekly 분리 유지. `20260302000000_arena_ledgers_memberships_snapshots.sql` 등에서 “reset must not touch core_xp_ledger” 명시.
- 마이그레이션 추가·변경 시: 경로·제약·롤백·Core/Weekly 분리 여부 재점검.

### E) API Contract Stability

- 이번 체크에서 **API 시그니처 변경 없음**.
- Leaderboard: `Cache-Control: no-store`로 캐싱 없음.
- UI는 leaderboard·core-xp·profile 등 API 응답만 사용; 랭킹/XP 규칙 중복 계산 없음.

### F) Verification Steps (실행용 체크리스트)

1. **Local**: 로그인 → XP 획득(런 완료 등) → 프로필·리더보드에서 반영 확인.
2. **Local**: (가능 시) 주간/시즌 경계·리셋 시뮬레이션(테스트용 시간 주입 또는 새 리그 생성) 후 weekly만 변경·core 유지 확인.
3. **Preview**: 로그인 후 새로고침·페이지 이동 시 세션 유지.
4. **Production**: 쿠키(Secure, SameSite) 동작, 리더보드 로드, 401 루프 없음 확인.

---

## 4) Required patches

- **없음.**
- **(선택)** 리더보드 동점 시 결정적 순서: `src/app/api/arena/leaderboard/route.ts`에서 `weekly_xp` 조회 시 2·3차 정렬 추가 후 스펙에 타이 브레이커 명시.

```ts
// 예시 (선택 적용)
.order("xp_total", { ascending: false })
.order("updated_at", { ascending: true })
.order("user_id", { ascending: true })
```

---

## 5) Next steps checklist

- [ ] 위 Verification Steps 1~4 실행.
- [ ] (선택) 리더보드 타이 브레이커 명시 및 구현.
- [ ] 배포 후 프로덕션에서 로그인·리더보드·쿠키 동작 스모크 테스트.

---

## Center 프로젝트 (CENTER_PAGE_IMPROVEMENT_SPEC §5·§9)

**범위**: Center 페이지 개선. Auth/경로에 직접 관여하는 변경은 **§5 CTA 통합 + 재로그인 버그**만 해당.  
**대조 기준**: `.cursor/rules/bty-release-gate.mdc`, `.cursor/rules/bty-auth-deploy-safety.mdc`, 본 문서.

### 1) Assumptions

- Center §5: CTA 1개로 통합, 클릭 시 **재로그인 요구하지 않음** (인증된 사용자는 `/bty` 또는 보호된 경로로 직행).
- 쿠키 **설정** 코드는 변경하지 않음. 미들웨어에서 **경로/리다이렉트**만 수정 (인증 시 `/bty/login` 대신 `/bty` 직행).
- B~E(Weekly Reset, Leaderboard, Migration, API 계약): Center 작업에서 **미접촉** → N/A.

### 2) Center Gate (A · Auth Safety · F) 결과: **FAIL**

- **A) Auth/Cookies**: 쿠키 설정 변경 없음. 미들웨어·auth 모듈에서 쿠키 설정 코드 미수정 → **PASS**.
- **Auth Safety**: 인증 user + `/bty/login` 접근 시 `/${locale}/bty` 리다이렉트 **미구현** → **FAIL**.
- **F) Verification Steps**: 문서화됨. 실행은 C3 적용 후 수행.

### 3) 위반 목록 (Center Gate)

| # | 구분 | 위반 내용 | 파일/위치 |
|---|------|-----------|-----------|
| 1 | Auth Safety | 인증된 사용자가 `/${locale}/bty/login` 요청 시 `/${locale}/bty`로 302 리다이렉트하는 로직이 없음. 현재 `isPublicPath`에 `/bty/login`이 포함되어 인증 여부 무관 로그인 페이지 노출 → 로그인 상태에서 Center CTA로 `/bty/login` 이동 시 재로그인 화면이 뜸. | `src/middleware.ts` — `isPublicPath` 통과 후, `getUser()` 성공 시 pathname이 `/${locale}/bty/login`이면 `/${locale}/bty`로 리다이렉트하는 분기 없음. |

### 4) Findings (Center 해당 항목만)

| 구분 | 결과 |
|------|------|
| **A** | 쿠키 설정 변경 없음. 기존 A 유지. **PASS.** |
| **Auth Safety** | CTA·재로그인: 미들웨어에 "인증 user + /bty/login → /bty 리다이렉트" **미적용**. **How to verify**: 로컬 로그인 → Center CTA 클릭 → `/bty` 직행·재로그인 없음. (C3 완료 후 확인.) |
| **B~E** | 해당 없음 (Center는 XP/시즌/리더보드/마이그레이션 미접촉). |
| **F** | 1) 로컬: 로그인 → Center CTA 클릭 → /bty 직행·재로그인 없음. 2) Preview: 로그인 유지. 3) Prod: 쿠키·401 없음. (C3 적용 후 실행.) |

### 5) Required patches (Center)

- **C3 적용 필요**: `src/middleware.ts`에서 인증된 user가 `/${locale}/bty/login` 요청 시 `/${locale}/bty`로 302 리다이렉트 추가. 쿠키 설정 변경 금지.
- 적용 후 본 섹션 재검사 → Center Gate **PASS** 전환 및 위반 목록 비우기.

### 6) Next steps (Center)

- [ ] C3 Domain/API: §5 미들웨어 인증 시 `/bty/login` → `/${locale}/bty` 리다이렉트 적용.
- [ ] C4 UI: CTA 1개 통합 (`/${locale}/bty`).
- [ ] C3 적용 후 Auth Safety Verification 실행 → C5 원클릭 검증.

---

*작성: bty-release-gate.mdc OUTPUT FORMAT 준수. Center: bty-auth-deploy-safety.mdc 반영. C2 체크리스트 대조 반영 (Center Gate A·Auth Safety·F 결과 및 위반 목록).*
