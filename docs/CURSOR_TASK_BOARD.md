# Cursor 태스크 보드 (공동) — 우선순위 자동결정

**단일 진실**: 이 표 + `docs/CURRENT_TASK.md` 1줄. First Task 완료 전 다음 Task 시작 불가(Start Trigger 잠금). **대기 작업**은 `docs/NEXT_PHASE_AUTO4.md`와 **docs/CURSOR_TASK_BOARD.md**(루트)와 동일한 기준으로 유지한다. **다음 프로젝트 추천**: `docs/NEXT_PROJECT_RECOMMENDED.md` (엘리트 3차).  
**우선순위 규칙**: 1) Auth/Redirect/Session 2) API Contract 3) Domain/Engine 4) UI 5) 문서.

---

## 이전 런: CI GATE PASSED ✅

- **C1 auto (2026-03-08 8차)**: C1이 lint/test/build 실행. **CI GATE PASSED.** 로딩/스켈레톤 1곳 보강 wrap·다음 First Task = 문서 점검 2~3건. (최신)

- **C2 Gatekeeper (2026-03-08)**: CURSOR_TASK_BOARD·.cursor/rules·BTY_RELEASE_GATE_CHECK 대조. § "로딩/스켈레톤 1곳 변경분 Gate" — **UI만 변경** → 해당 없음 **PASS**. Exit 체크 완료.

- **C1 auto (2026-03-08 7차)**: C1이 lint/test/build 실행. **CI GATE PASSED.** 단위 테스트 1개 추가 wrap·다음 First Task = 로딩/스켈레톤 1곳 보강. (최신)

- **C2 Gatekeeper (2026-03-08)**: CURSOR_TASK_BOARD·.cursor/rules·BTY_RELEASE_GATE_CHECK 대조. § "단위 테스트 1개 추가 변경분 Gate" — **테스트만 추가** → 해당 없음 **PASS**. Exit 체크 완료.

- **C1 auto (2026-03-08 6차)**: C1이 lint/test/build 실행. **CI GATE PASSED.** 문서 점검 2~3건 wrap·다음 First Task = 단위 테스트 1개 추가. (최신)

- **C2 Gatekeeper (2026-03-08)**: CURSOR_TASK_BOARD·.cursor/rules·BTY_RELEASE_GATE_CHECK 대조. § "접근성 1건 변경분 Gate" — **UI만 변경** → 해당 없음 **PASS**. Exit 체크 완료.

- **C1 auto (2026-03-08 5차)**: C1이 lint/test/build 실행. **CI GATE PASSED.** 접근성 1건 wrap·다음 First Task = 문서 점검 2~3건. (최신)

- **C1 auto (2026-03-08 4차)**: C1이 lint/test/build 실행. **CI GATE PASSED.** 로딩/스켈레톤 1곳 wrap·다음 First Task = 접근성 1건. (최신)

- **C1 auto (2026-03-08 3차)**: 문서 점검 2~3건 wrap·다음 = 로딩/스켈레톤 1곳.

- **C2 Gatekeeper (2026-03-08)**: CURSOR_TASK_BOARD·.cursor/rules·BTY_RELEASE_GATE_CHECK 대조. § "단위 테스트 1개 추가 변경분 Gate" — **테스트만 추가(비즈니스/XP 미변경)** → 해당 없음 **PASS**. Exit 체크 완료.

- **C1 auto (2026-03-08 2차)**: C1이 lint/test/build 실행. **CI GATE PASSED.** 단위 테스트 1개 추가 wrap·다음 First Task = 문서 점검 2~3건. (최신)

- **C1 auto (2026-03-08)**: C1이 lint/test/build 실행. **CI GATE PASSED.** [UI] Center 로딩/빈 상태 1곳 wrap·다음 First Task = 단위 테스트 1개 추가. (최신)

- **C5 (done) 2026-03-08**: C2 Exit 확인 후 `./scripts/orchestrate.sh` 실행. Lint ✓ Test 85/640 ✓ Build ✓. **WRAP·CI PASSED (done).** 작업 완료. 보드·CURRENT_TASK·BTY_RELEASE_GATE_CHECK 반영. (최신)

- **C2 Gatekeeper (2026-03-08)**: CURSOR_TASK_BOARD·.cursor/rules·BTY_RELEASE_GATE_CHECK 대조. § "로딩/스켈레톤 1곳 변경분 Gate" — **UI만 변경** → 해당 없음 **PASS**. Exit 체크 완료.

- **C5 Verify (2026-03-08)**: cd bty-app → ./scripts/ci-gate.sh. Lint ✓ Test 85 files / 640 tests ✓ Build ✓. Workers verify skip. **CI GATE PASSED.** 작업 완료. BTY_RELEASE_GATE_CHECK·CURSOR_TASK_BOARD·CURRENT_TASK 반영. (최신)

- **C5 Verify (2026-03-07)**: cd bty-app → lint → test → build → ./scripts/ci-gate.sh 통과. **CI GATE PASSED.** [UI] 엘리트 멘토 대화 신청 플로우 작업 완료·서류 반영.

- **[UI] 엘리트 멘토 대화 신청 플로우 (C4 aria 보강)**: **완료.** Elite·admin mentor-request section·aria-label·role region·에러 role=alert. npm run lint 통과. 보드·CURRENT_TASK 반영.

- **[C3] 엘리트 멘토 대화 신청 플로우 (도메인·API 검증)**: **완료.** GET/POST /api/me/mentor-request·GET/PATCH /api/arena/mentor-requests 검증+도메인 호출만 확인. mentorRequest 도메인·테스트 유지. 보드·CURRENT_TASK 반영.

- **C2 Gatekeeper (2026-03-06)**: [UI] 엘리트 멘토 대화 신청 플로우 규칙 검사. domain/API/UI 분리·render-only·API 값만 표시 준수. 결과 **PASS**. 보드·CURRENT_TASK 반영.

- **[VERIFY] Release Gate 체크리스트 1회 실행 (2026-03-06 4차)**: **완료.** bty-release-gate.mdc A~F 1회 점검. 결과 **PASS**. 필수 패치 0건. 권장: core-xp rank/isTop5Percent 도메인 이전. BTY_RELEASE_GATE_CHECK·보드·CURRENT_TASK 반영. (최신)
- **[DOMAIN] 단위 테스트 1개 추가 (미커버 1모듈, 비즈니스/XP 미변경)**: **완료.** drChiCharacter.test.ts 추가(5케이스). DR_CHI_PHILOSOPHY·DR_CHI_FEW_SHOT_EXAMPLES 검증. npm test 538 통과. 보드·CURRENT_TASK 반영 완료.
- **[AUTH] 로그인·세션 문서 1줄 점검 (BTY_RELEASE_GATE_CHECK 반영)**: [x] **완료.** BTY_RELEASE_GATE_CHECK § "[AUTH] 로그인·세션 (문서 1줄)" 추가. Supabase 쿠키·getUser()·쿠키 옵션·로그아웃 정리. 보드·CURRENT_TASK 반영 완료.
- **[VERIFY] Release Gate 체크리스트 1회 실행 (2026-03-06)**: **작업 완료.** bty-release-gate.mdc 기준 A~F 전 항목 1회 점검. 결과 **PASS**. 필수 패치 0건. BTY_RELEASE_GATE_CHECK·CURSOR_TASK_BOARD·CURRENT_TASK 반영 완료. (최신)
- **[UI] 엘리트 멘토 대화 신청 플로우 (2026-03-06)**: **완료.** GET/POST /api/me/mentor-request, GET/PATCH /api/arena/mentor-requests 연동. Elite 페이지 신청 폼·상태 표시·admin /admin/mentor-requests 큐·승인 UI render-only. ELITE_3RD_SPEC_AND_CHECKLIST §1 반영. 보드·CURRENT_TASK 반영 완료.
- **[VERIFY] 엘리트 3차 체크리스트 1회 실행 (2026-03-06)**: **작업 완료.** PHASE_4_ELITE_5_PERCENT_SPEC §10 3차(엘리트 배지 증정·멘토 대화 신청) 기준 검증. Elite 판정=Weekly XP만·API 도메인 호출만·UI render-only 확인. 결과 **PASS**. BTY_RELEASE_GATE_CHECK·CURSOR_TASK_BOARD·CURRENT_TASK 반영 완료. (최신)
- **[VERIFY] Dojo·Dear Me 2차 검증 체크리스트 1회 실행 (2026-03-06)**: **작업 완료.** DOJO_DEAR_ME_NEXT_CONTENT §1-4·§4-7 기준 Dojo 2차·Dear Me 검증. 결과 **PASS**. BTY_RELEASE_GATE_CHECK·CURSOR_TASK_BOARD·CURRENT_TASK 반영 완료. (최신)
- **[AUTH] 쿠키 Secure 시 로컬 HTTP 동작 정리·문서 1줄**: [x] Secure 쿠키는 HTTPS에서만 저장·전송; 로컬 http://에서는 미저장 → 로그인 유지 안 됨/루프처럼 보일 수 있음. BTY_RELEASE_GATE_CHECK § "Secure 쿠키와 로컬 HTTP" 1줄·CURRENT_TASK 반영 완료.
- **[API] leaderboard scope(role/office) 쿼리·응답 계약 점검**: [x] scope=role|office 쿼리·scope/scopeLabel/scopeUnavailable 응답 계약을 route JSDoc에 명시. parseLeaderboardScope·roleToScopeLabel 도메인 호출만. CURRENT_TASK 갱신 완료.
- **리더보드·도메인 작업 완료 및 관련 서류 갱신**: [x] [API] leaderboard status 엔드포인트 계약 점검(route JSDoc·도메인 호출만). [DOMAIN] weekly XP tie-break 규칙 보완(domain/rules/leaderboardTieBreak, lib 연동, domain/rules export). BTY_RELEASE_GATE_CHECK(leaderboard 패치 반영 완료), CURRENT_TASK·CURSOR_TASK_BOARD 갱신 완료.
- **C5 Verify (2026-03-06 재실행)**: 절차 1~5 (cd bty-app → lint → test → build → `../scripts/ci-gate.sh`) 통과. **CI GATE PASSED.** 관련 서류(BTY_RELEASE_GATE_CHECK, CURSOR_TASK_BOARD, CURRENT_TASK) 갱신 완료. (최신)
- **C5 Verify (2026-03-06)**: `./scripts/ci-gate.sh` 실행. Lint ✓ Test 59 files / 526 tests ✓ Build ✓. Workers verify skip. notify-done.sh 실행. **CI GATE PASSED.**
- **Wrap**: **문서 점검 2~3건** 런 완료. C2·C3·C4 해당 없음. C1 문서 점검·갱신. C5 lint/test/build·orchestrate 통과(58 files, 519 tests). **WRAP·CI PASSED (done).**
- **Wrap (직전)**: **단위 테스트 1개 추가** 런 완료. C2·C4 해당 없음. C3 mentor_fewshot_dropin.test.ts 등 미커버 1모듈 테스트 추가. C5 lint/test/build·orchestrate 통과. **WRAP·CI PASSED (done).**  
  **C2 Exit**: § 단위 테스트 1개 추가 변경분 Gate — 테스트만 추가(비즈니스/XP 미변경) → 해당 없음 **PASS**. Exit 체크 완료.
- **Cursor 2 Gatekeeper (2026-03-05)**: 변경분 규칙 준수 검사. **Release Gate FAIL** — 위반 1건: `leaderboard/route.ts` "not in top 100" 분기 내 랭크 계산 인라인 → `rankFromCountAbove` 도메인 호출로 이전 요구. 상세: `docs/BTY_RELEASE_GATE_CHECK.md` § "Cursor 2 Gatekeeper 검사 (변경분 규칙 준수 — 2026-03-05 최신)". **→ C3 반영 완료 (2026-03-06)**: leaderboard route가 totalCount 조회 후 `rankFromCountAbove(totalCount, countAbove)` 도메인 호출만 사용. npm test 526 통과.
- **Wrap (직전)**: **문서 점검 2~3건** 런 완료. C2·C3·C4 해당 없음. C1 문서 점검·갱신. C5 lint/test/build·orchestrate 통과. **WRAP·CI PASSED (done).**  
  **C2 Exit**: § 문서 점검 2~3건 변경분 Gate — 문서만 변경(코드 없음) → 해당 없음 **PASS**. Exit 체크 완료.
- **Wrap (직전)**: **로딩/스켈레톤 1곳** 런 완료. C2·C3 해당 없음. C4 AvatarSettingsClient 저장 중 CardSkeleton 적용. C5 lint/test/build·orchestrate 통과. **WRAP·CI PASSED (done).**
- **Wrap (직전)**: **단위 테스트 1개 추가** 런 완료. C2·C4 해당 없음. C3 mentorFewshotRouter.test.ts 1모듈(8케이스). C5 lint/test/build·orchestrate 통과. **WRAP·CI PASSED (done).**  
  **C2 Exit**: § 단위 테스트 1개 추가 변경분 Gate — 테스트만 추가(비즈니스/XP 미변경) → 해당 없음 **PASS**. Exit 체크 완료.
- **Wrap (직전)**: **문서 점검 2~3건** 런 완료. C2·C3·C4 해당 없음. C1 문서 점검·갱신. C5 lint/test/build·orchestrate 통과. **WRAP·CI PASSED (done).**
- **Wrap (직전)**: **단위 테스트 1개 추가** 런 완료. C2·C4 해당 없음. C3 systemMessages.test.ts 1모듈(5케이스). C5 lint/test/build·orchestrate 통과. **WRAP·CI PASSED (done).**
- **Wrap (직전)**: **로딩/스켈레톤 1곳** 런 완료. C2·C3 해당 없음. C4 1곳 적용. C5 통과.
- **Wrap (직전)**: **문서 점검 2~3건** 런 완료. C2·C3·C4 해당 없음. C1 문서 점검·갱신. C5 통과.
- **Wrap (직전)**: **문서 점검 2~3건** 런 완료. C2·C3·C4 해당 없음. C1 문서 점검·갱신. C5 통과.
- **Wrap (직전)**: **단위 테스트 1개 추가** 런 완료. C2·C4 해당 없음. C3 mentor_fewshot_router.test.ts 1모듈(8케이스). C5 통과.
- **Wrap (직전)**: **로딩/스켈레톤 1곳** 런 완료. C2·C3 해당 없음. C4 프로필 페이지 저장 중 CardSkeleton 적용. C5 통과.
- **Wrap (직전)**: **문서 점검 2~3건** 런 완료. C2·C3·C4 해당 없음. C1 문서 점검·갱신. C5 통과.
- **Wrap (직전)**: **단위 테스트 1개 추가** 런 완료. C2·C4 해당 없음. C3 buildChatMessages.test.ts 1모듈(9케이스). C5 통과.
- **Wrap (직전)**: **로딩/스켈레톤 1곳** 런 완료. C2·C3 해당 없음. C4 대시보드 Sub Name 저장 중 CardSkeleton 적용. C5 통과.
- **Wrap (직전)**: **문서 점검 2~3건** 런 완료. C2·C3·C4 해당 없음. C1 문서 점검·갱신. C5 통과.
- **Wrap (직전)**: **로딩/스켈레톤 1곳** 런 완료. C2·C3 해당 없음. C4 test-avatar 페이지 patching 시 CardSkeleton 적용. C5 통과.
- **Wrap (직전)**: **단위 테스트 1개 추가** 런 완료. C2·C4 해당 없음. C3 arena/engine.test.ts 1모듈(12케이스). C5 통과.
- **Wrap (직전)**: **문서 점검 2~3건** 런 완료. C2·C3·C4 해당 없음. C1 문서 점검·갱신. C5 통과.
- **Wrap (직전)**: **로딩/스켈레톤 1곳** 런 완료. C2·C3 해당 없음. C4 대시보드 Arena Membership CardSkeleton. C5 통과.
- **Wrap (직전)**: **단위 테스트 1개 추가** 런 완료. C2·C4 해당 없음. C3 coreStats.test.ts 1모듈. C5 통과.
- **Wrap (직전)**: **문서 점검 2~3건** 런 완료. C2·C3·C4 해당 없음. C1 문서 점검·갱신. C5 통과.
- **Wrap (직전)**: **로딩/스켈레톤 1곳** 런 완료. C2·C3 해당 없음. C4 healing/awakening CardSkeleton. C5 통과.
- **Wrap (직전)**: **단위 테스트 1개 추가** 런 완료. C2·C4 해당 없음. C3 beginnerScenarios.test.ts 1모듈. C5 통과.
- **Wrap (직전)**: **문서 점검 2~3건** 런 완료. C2·C3·C4 해당 없음. C1 문서 점검·갱신. C5 통과.
- **Wrap (직전)**: **로딩/스켈레톤 1곳** 런 완료. C2·C3 해당 없음. C4 멘토 페이지 CardSkeleton. C5 통과.
- **Wrap (직전)**: **단위 테스트 1개 추가** 런 완료. C2·C4 해당 없음. C3 scenario/engine.test.ts 1모듈. C5 통과.
- **Wrap (직전)**: **문서 점검 2~3건** 런 완료. C2·C3·C4 해당 없음. C1 문서 점검·갱신. C5 통과.
- **Wrap (직전)**: **로딩/스켈레톤 1곳** 런 완료. C2·C3 해당 없음. C4 integrity 페이지 1곳. C5 통과.
- **Wrap (직전)**: **단위 테스트 1개 추가** 런 완료. C2·C4 해당 없음. C3 beginnerTypes.test.ts 1모듈. C5 통과.
- **Wrap (직전)**: **문서 점검 2~3건** 런 완료. C2·C3·C4 해당 없음. C1 문서 점검·갱신. C5 통과.
- **Wrap (직전)**: **로딩/스켈레톤 1곳** 런 완료. C2·C3 해당 없음. C4 Elite 페이지 CardSkeleton. C5 통과.
- **Wrap (직전)**: **단위 테스트 1개 추가** 런 완료. C2·C4 해당 없음. C3 reflection-engine 1모듈. C5 통과.
- **Wrap (직전)**: **문서 점검 2~3건** 런 완료. C2·C3·C4 해당 없음. C1 문서·C5 통과.
- **Wrap (직전)**: **로딩/스켈레톤 1곳** 런 완료. C2·C3 해당 없음. C4 로그인 페이지 CardSkeleton. C5 통과.
- **Wrap (직전)**: **단위 테스트 1개 추가** 런 완료. C2·C4 해당 없음. C3 detectEvent 1모듈. C5 통과.
- **Wrap (직전)**: **문서 점검 2~3건** 런 완료. C2·C3·C4 해당 없음. C1 문서·C5 통과.
- **Wrap (직전)**: **로딩/스켈레톤 1곳** 런 완료. C2·C3 해당 없음. C4 비밀번호 찾기 CardSkeleton. C5 통과.
- **Wrap (직전)**: **단위 테스트 1개 추가** 런 완료. C2·C4 해당 없음. C3 emotional-stats/unlock 1모듈. C5 통과.
- **Wrap (직전)**: **문서 점검 2~3건** 런 완료. C2·C3·C4 해당 없음. C1 문서·C5 통과.
- **Wrap (직전)**: **로딩/스켈레톤 1곳** 런 완료. C2·C3 해당 없음. C4 멘토 페이지 스켈레톤 적용. C5 통과.
- **Wrap (직전)**: **단위 테스트 1개 추가** 런 완료. C2·C4 해당 없음 PASS. C3 antiExploit 등 1모듈 테스트 추가. C5 통과.
- **Wrap (직전)**: **문서 점검 2~3건** 런 완료. C2·C3·C4 해당 없음 PASS. C1 문서 점검·갱신. C5 lint/test/build·orchestrate 통과. **WRAP·CI PASSED (done).**
- **Wrap (직전)**: **로딩/스켈레톤 1곳** 런 완료. C2·C3 해당 없음 PASS. C4 1곳 스켈레톤/로딩 적용. C5 lint/test/build·orchestrate 통과. **WRAP·CI PASSED (done).**
- **Wrap (직전)**: **단위 테스트 1개 추가** 런 완료. C2·C4 해당 없음 PASS. C3 unlock 등 1모듈 테스트 추가. C5 lint/test/build·orchestrate 통과. **WRAP·CI PASSED (done).**
- **Wrap (직전)**: **문서 점검 2~3건** 런 완료. C2·C3·C4 해당 없음 PASS. C1 문서 점검·갱신. C5 lint/test/build·orchestrate 통과. **WRAP·CI PASSED (done).**
- **Wrap (직전)**: **core-xp·sub-name 도메인 이전** 런 완료. C2 Gate(도메인 이전 후) PASS. C3 rankFromCountAbove·weeklyRankFromCounts 도메인·route 호출만. C4 해당 없음. C5 lint/test/build·orchestrate 통과. **WRAP·CI PASSED (done).**
- **Wrap (직전)**: **로딩/스켈레톤 1곳** 런 완료. C2·C3 해당 없음 PASS. C4 1곳 스켈레톤/로딩 적용. C5 lint/test/build·orchestrate 통과. **WRAP·CI PASSED (done).**
- **Wrap (직전)**: **문서 점검 2~3건** 런 완료. C2·C3·C4 해당 없음 PASS. C1 문서 점검·갱신. C5 lint/test/build·orchestrate 통과. **WRAP·CI PASSED (done).**
- **Wrap (직전)**: **단위 테스트 1개 추가** 런 완료. C2·C4 해당 없음 PASS. C3 1모듈 테스트 추가. C5 lint/test/build·orchestrate 통과. **WRAP·CI PASSED (done).**
- **CI GATE PASSED ✅** (이전): lint/test/build 통과. C2 Exit ✓. (C3·C4 완료 시 C5 실행·wrap 반영.)
- **Wrap (상태 스냅샷)**: First Task = 감정 스탯 v3 유지. C2 Exit ✓ · C3 □ · C4 □ · C5 대기.
- **이전 wrap**: lint/test/build 통과 (tsc --noEmit, vitest 171, next build). C2 Exit 완료; C3·C4 진행 전 검증 완료. 상세: `CURRENT_TASK.md` § Integrator 검증.
- (이전) C2·C3·C4 Exit 후 orchestrate.sh 실행 완료. 미들웨어 /bty/login→/bty, CTA href=/${locale}/bty, C2 PASS.

---

## First Task (1개만) — 우선순위 자동 선정

**[UI] 엘리트 멘토 대화 신청 플로우** — **완료.** (2026-03-07 C5 Verify·C4 aria 보강·C3 검증 반영.)

**[UI] Center 로딩/빈 상태 1곳 보강** — **완료.** (2026-03-08 C1 auto 검증 통과·wrap 반영.)

**단위 테스트 1개 추가** — **완료.** (2026-03-08 C1 auto 2차 검증 통과·wrap.)

**문서 점검 2~3건** — **완료.** (2026-03-08 C1 auto 3차 검증 통과·wrap.)

**[UI] 로딩/스켈레톤 1곳 보강** — **완료.** (2026-03-08 C1 auto 4차 검증 통과·wrap.)

**[UI] 접근성 1건 (aria-label·포커스/스킵 1곳)** — **완료.** (2026-03-08 C1 auto 5차 검증 통과·wrap.)

**문서 점검 2~3건** — **완료.** (2026-03-08 C1 auto 6차 검증 통과·wrap.)

**단위 테스트 1개 추가** — **완료.** (2026-03-08 C1 auto 7차 검증 통과·wrap.)

**[UI] 로딩/스켈레톤 1곳 보강** — **완료.** (2026-03-08 C1 auto 8차 검증 통과·wrap.)

**문서 점검 2~3건** — 백로그 + Release Gate 2~3건 점검·갱신. C2·C3·C4 해당 없음. C1 문서 수정.

- **근거**: NEXT_PHASE_AUTO4 §2 문서 점검 2~3건 선정.

**AUTO 규칙**: 기존 백로그 런이 연속 완료된 뒤에는 **구체 항목**을 First Task로 선정. "기존 백로그 (N차)"만 반복하지 않음.

**AUTO 시 2~3개 묶기 (진행량·에러 추적 균형)**  
- **원칙**: auto 입력 시 **연관된 일 2~3개**를 묶어 **한 First Task**로 선정한다. (진행 많이 하되, 에러 나면 원인 범위를 2~3개로 좁히기 위함.)  
- **연관 기준**: 같은 스펙/기능(예: 빈 상태 2곳 + 로딩 1곳), 같은 레이어(문서 2~3건, 테스트 2개), 또는 한 플로우(API 1개 + 그 API 쓰는 UI 1~2곳).  
- **예외**: Auth·XP·리더보드 정렬 등 위험 구간은 **1개만** First Task로 둔다.

**AUTO 실행 시 필수 (같은 명령 반복 방지)**  
- **1단계**: 직전(또는 현재) First Task 이름·C2~C5 디스패치 요약과 **이번에 출력할 First Task·디스패치가 동일한지** 확인.  
- **2단계**: 동일하면 → 같은 명령 반복 금지. **동일 패턴**(예: Elite 페이지에 ○○ 카드+플레이스홀더 연속)도 금지. **작업 유형을 바꿔** 다른 구체 항목(또는 2~3개 묶음)으로 First Task 전환 후 명령 작성.  
- **3단계**: 다르거나 첫 실행이면 → **2~3개 연관 항목 묶어** First Task·C1~C5 Exit·C2~C5 붙여넣기 명령 작성.

**잠금**: First Task 완료 전 다음 Task 시작 불가. C2~C5 Start Trigger = C1 Exit(또는 상위 Exit) 후에만 가능.

**간소화 (문서 점검·단일 역할·무코드 런)**  
- **문서 점검 2~3건**, **접근성 1건**(UI만), **단위 테스트 1모듈**(C3만) 등 **한 역할만 실제 작업**하거나 **코드 변경 없음**인 런은, C2·C3·C4를 **각 커서에 따로 돌리지 않아도 됨**.  
- **운영**: C1에서 목표 1줄 확정 후, **해당 역할 1개만** 실행(문서면 C1이 문서 수정, 테스트면 C3, UI면 C4). C2·C3·C4는 **"해당 없음 Exit"로 간주**하고, **C5만** 아래 검증 실행(터미널에서 `./scripts/orchestrate.sh`). 통과 시 **done** 입력 → wrap-ci passed·보드 갱신.  
- **C1이 검증 통과 확인 시**: 사용자 "done" 입력을 기다리지 않고 **바로 done 처리** 후 **이어서 auto 실행**(다음 First Task 선정, 보드·CURRENT_TASK 갱신, C2~C5 한 줄 명령 출력).

**C1이 "검증 통과"를 아는 경우 (둘 중 하나)**  
1. **C1이 이 세션에서 터미널 명령을 직접 실행한 경우** — 명령 완료 시 터미널 출력이 C1에게 전달됨. 출력에 `CI GATE PASSED`가 있으면 **같은 턴에서 곧바로 done+auto 수행**. (사용자가 "검증 돌려줘" 등으로 요청하면 C1이 `./scripts/orchestrate.sh` 실행 → 출력 확인 → done+auto.)  
2. **사용자가 알려준 경우** — 사용자가 "통과했어" / "CI GATE PASSED" / "검증 통과" 등으로 알려주면 **그 메시지를 검증 통과로 간주**하고 곧바로 done+auto 수행.

**못 본 이유 (참고)**  
- C1(에이전트)은 **자기가 실행한** 터미널 명령의 출력만 볼 수 있음. 사용자가 Cursor 터미널에서 직접 `./scripts/orchestrate.sh`를 돌리면, 그 출력은 C1에게 자동 전달되지 않음. 그래서 C1이 통과를 "못 봤을" 수 있음. → **해결**: 사용자가 "통과했어"라고 한 마디 하거나, 또는 검증을 **C1에게 시킴**("검증 돌려줘" → C1이 실행 후 출력 확인 → done+auto).

**C1 필수 동작**  
- 위 1번 또는 2번 조건이 만족되면 **같은 응답에서 반드시** done 처리(보드 Wrap·테이블·완료 이력·CURRENT_TASK) + auto 실행(다음 First Task 선정·보드 갱신·C2~C5 한 줄 명령 출력). "done 입력해 주세요" 등으로 넘기지 말 것.

- **효과**: 단계 수 감소, 진행 가속. Auth·XP·리더보드 등 위험 구간은 기존대로 C2 Gatekeeper 실행.

**C5 검증: 최소 요건 vs orchestrate.sh**  
- **필수(최소)**: `npm run lint && npm test && npm run build` — 이 3단계만 통과하면 C5 통과·done 처리 가능. **orchestrate.sh는 반드시 돌릴 필요 없음.**  
- **선택**: `./scripts/orchestrate.sh` — 위 3단계를 한 번에 실행 + (BASE·LOGIN_BODY 설정 시) Workers 로그인 검증 + 완료 시 로컬 알림(notify-done.sh). 동일 lint/test/build이므로 **한 번에 돌리고 싶을 때만** 사용.

---

## 현재 작업 (배치 단위 · C1~C5)

| 역할 | 상태 | 변경 범위 | Start Trigger | Exit Criteria |
|------|------|-----------|---------------|---------------|
| **C1 Commander** | [x] | `CURRENT_TASK.md`, `CURSOR_TASK_BOARD.md` | [x] (항상) | [x] 목표 1줄 확정: 문서 점검 2~3건 [x] 보드 갱신 완료 |
| **C2 Gatekeeper** | [x] | `.cursor/rules/`, `BTY_RELEASE_GATE_CHECK.md` | [x] C1 Exit | [x] § "문서 점검 2~3건 변경분 Gate" → **문서만 변경** 해당 없음 **PASS**. Exit 체크 완료. |
| **C3 Domain/API** | [ ] | — | [x] C1 Exit | [ ] 해당 없음 Exit (문서만). |
| **C4 UI** | [ ] | — | [x] C1 Exit | [ ] 해당 없음 Exit (문서만). |
| **C5 Integrator** | — | auto 시 C1이 검증 수행 | — | (C1이 lint/test/build 실행 후 wrap·다음 C2~C4 출력) |

**진행 정책**: C3/C4 병렬 가능. C5는 C2·C3·C4 Exit 후 실행.

**Auto 4 대기 작업**  
현재 대기 = **First Task: 문서 점검 2~3건 (백로그 + Release Gate)**. 검증은 auto 시 C1 수행.

| Owner | 할 일 | 상태 |
|-------|--------|------|
| C2 (Gatekeeper) | § "문서 점검 2~3건 변경분 Gate" 대조 → 문서만 변경 해당 없음 PASS. Exit 체크. | [x] 완료 |
| C3 (Domain/API) | 해당 없음 Exit (문서만). | [ ] 대기 |
| C4 (UI) | 해당 없음 Exit (문서만). | [ ] 대기 |

**C2~C4 one-line (복사용)**  
- **C2**: CURSOR_TASK_BOARD·.cursor/rules·BTY_RELEASE_GATE_CHECK 대조. § "문서 점검 2~3건 변경분 Gate" — **문서만 변경** → 해당 없음 **PASS**. Exit 체크.
- **C3**: C1 목표 = 문서 점검 2~3건 → **해당 없음 Exit.** (문서만.)
- **C4**: C1 목표 = 문서 점검 2~3건 → **해당 없음 Exit.** (문서만.)

**C2 Gatekeeper (Exit 완료)**: .cursor/rules·BTY_RELEASE_GATE_CHECK.md 대조 완료. **규칙 준수 검사 (아키텍처)**: src/domain·lib/bty·api·app·components 범위 검사. **결과: FAIL** — 위반 2건: core-xp/route.ts(91–92행 rank·isTop5Percent 인라인), leaderboard/route.ts(315행 myRank 인라인). 수정 지시·Required patches: BTY_RELEASE_GATE_CHECK.md § "C2 Gatekeeper 검사 (규칙 준수 — 2026-03-06)". 패치 적용 후 Gate 재검사 시 PASS 목표. **Cursor 2 Gatekeeper 검사**: Arena locale 변경분 **PASS**; 기존 위반 2건(core-xp·sub-name API 내 랭크/상위5% 계산) → Required patches § "Cursor 2 Gatekeeper 검사" 반영. **§2 챗봇 전역 플로팅 비노출 Gate** 이미 **PASS**(해당 없음) 반영. core-xp API 변경 Gate **PASS** (위반 0건, 권장 1건). **§1·§8·Arena 한국어 §4.1·감정 스탯 v3·Dojo 2차·Center §9 나머지·Arena 아바타·대시보드 코드네임 설명 변경분 Gate**: A·Auth·F 해당 시 **PASS** (해당 없음·위반 0건). **리더보드 팀/역할/지점 뷰 변경분 Gate**: A·Auth·F·C **PASS** (랭킹·Weekly XP만 사용·시즌 미반영, C3 구현 시 C 준수 필수). **감정 스탯 v3 확장 런**: § "감정 스탯 v3 변경분 Gate" 대조·**PASS** 반영·Exit 체크 완료. **챗봇 연결 끊김 런**: § "챗봇 연결 끊김 관련 변경분 Gate" 대조·Auth/세션/쿠키 미접촉 → **해당 없음 PASS** 반영·Exit 체크 완료. **§10 점검·갱신 런**: C1 선정 §10 점검·갱신 확인 → 점검·문서만 → **해당 없음 PASS** 반영·Exit 체크 완료. **엘리트 5% 1차(해금/배지) 런**: § "엘리트 5% 1차(해금/배지) 변경분 Gate" 대조·A·Auth·F·C **PASS** (랭킹=Weekly XP만·시즌 미반영)·Exit 체크 완료. **챗봇 훈련 후속(RAG·예시) 런**: § "챗봇 훈련 후속(RAG·예시) 변경분 Gate" 대조·Auth/세션/쿠키 미접촉 → **해당 없음 PASS** 반영·Exit 체크 완료. **엘리트 5% 2차(멘토 대화 신청) 런**: § "엘리트 5% 2차(멘토 대화 신청) 변경분 Gate" 대조·A·Auth·F·C **PASS** (멘토 신청 자격=Elite만·Elite=Weekly XP만·시즌 미반영)·Exit 체크 완료. **빈 상태 보강 런**: § "빈 상태 보강 변경분 Gate" 대조·**UI만 변경** → **해당 없음 PASS** 반영·Exit 체크 완료. **PHASE_4_CHECKLIST 런**: C1 선정 PHASE_4_CHECKLIST 항목 확인 → **선정 항목 없음** → C1 대기. § "PHASE_4_CHECKLIST 항목 Gate (C1 선정 대기)" 반영. **§2-1 코드별 스킨 검증 런**: § "§2-1 코드별 스킨 검증 변경분 Gate" 대조·**검증 위주·코드 변경 없음** → **해당 없음 PASS** 반영·수정 시 해당 변경분 Gate 반영·Exit 체크 완료. **§2-2 엘리트 5% 검증 런**: § "§2-2 엘리트 5% 검증 변경분 Gate" 대조·**검증만** → **해당 없음 PASS** 반영·수정 시 Elite=Weekly XP만·시즌 미반영·랭킹 규칙 Gate 반영·Exit 체크 완료. **엘리트 5% 3차 서클 모임 런**: § "엘리트 5% 3차 서클 모임 변경분 Gate" 대조·Elite=Weekly XP만·시즌 미반영·랭킹 규칙 유지 반영·A·Auth·F·C **PASS**·Exit 체크 완료. **빈 상태 보강 2곳째 런**: § "빈 상태 보강 2곳째 변경분 Gate" 대조·**UI만 변경** → **해당 없음 PASS** 반영·Exit 체크 완료. **리더보드 주간 리셋 일시 표시 런**: § "리더보드 주간 리셋 일시 표시 변경분 Gate" 대조·랭킹=Weekly XP만 유지·추가 필드(week_end 등) 표시용만 반영·A·Auth·F·C **PASS**·Exit 체크 완료. **Arena 시나리오 완료 토스트 런**: § "Arena 시나리오 완료 토스트 변경분 Gate" 대조·**XP/랭킹/리셋 로직 미접촉** → **해당 없음 PASS** 반영·Exit 체크 완료. **프로필 필드 추가 런**: § "프로필 필드 추가(프로필 API 변경분) Gate" 대조·Auth·XP/랭킹/리셋 미접촉 확인·A·Auth·F·C **PASS**·Exit 체크 완료. **대시보드 버튼 연동 런**: § "대시보드 버튼 연동 변경분 Gate" 대조·버튼 호출 API가 XP/랭킹/리셋 변경이면 해당 Gate·**단순 GET·라우트 이동이면 해당 없음 PASS**·Exit 체크 완료. **리더보드 타이 브레이커 런**: § "리더보드 타이 브레이커 변경분 Gate" 대조·**랭킹=Weekly XP만 사용·시즌 미반영** 확인·정렬 규칙만 추가이면 **C 준수**·Exit 체크 완료. **빈 상태 보강 3곳째 런**: § "빈 상태 보강 3곳째 변경분 Gate" 대조·**UI만 변경** → **해당 없음 PASS** 반영·Exit 체크 완료. **챗봇 재시도·에러 UI 런**: § "챗봇 재시도·에러 UI 변경분 Gate" 대조·**Auth/XP/랭킹 미접촉** → **해당 없음 PASS** 반영·Exit 체크 완료. **i18n 누락 키 보강 런**: § "i18n 누락 키 보강 변경분 Gate" 대조·**UI/문구만** → **해당 없음 PASS** 반영·Exit 체크 완료. **접근성 1건 런**: § "접근성 1건 변경분 Gate" 대조·**UI만 변경** → **해당 없음 PASS** 반영·Exit 체크 완료. **로딩/스켈레톤 1곳 런**: § "로딩/스켈레톤 1곳 변경분 Gate" 대조·**UI만 변경** → **해당 없음 PASS** 반영·Exit 체크 완료. **(이번 런)** C2 Exit 충족·C5 실행 가능. **단위 테스트 1개 추가 런**: § "단위 테스트 1개 추가 변경분 Gate" 대조·**테스트만 추가(비즈니스/XP 로직 미변경)** → **해당 없음 PASS** 반영·Exit 체크 완료. **(이번 런)** C2 Exit 충족·C5 실행 가능. **문서 점검 2~3건 런**: § "문서 점검 2~3건 변경분 Gate" 대조·**문서만 변경(코드 없음)** → **해당 없음 PASS** 반영·Exit 체크 완료. **(이번 런)** C2 Exit 충족·C5 실행 가능. **단위 테스트 2개 추가 런**: § "단위 테스트 2개 추가 변경분 Gate" 대조·**테스트만 추가(비즈니스/XP 로직 미변경)** → **해당 없음 PASS** 반영·Exit 체크 완료. **i18n 2건+접근성 1건 런**: § "i18n 2건+접근성 1건 변경분 Gate" 대조·**UI/문구만 변경** → **해당 없음 PASS** 반영·Exit 체크 완료. **로딩/스켈레톤 2곳 런**: § "로딩/스켈레톤 2곳 변경분 Gate" 대조·**UI만 변경** → **해당 없음 PASS** 반영·Exit 체크 완료.  
**C4 UI (Exit 완료)**: **bty-ui-render-only 점검 (C4 UI Worker)**: LeaderboardRow — XP toLocaleString 포맷만, locale prop, role=listitem·aria-label. ArenaRankingSidebar — 에러 시 재시도 버튼·aria-label·role=alert. 리더보드 페이지 — role=list, key=rank-codeName. UI 계산 로직 0건. 감정 스탯 v3 표시 UI 적용 완료. display API만 사용(render-only). 대시보드·bty·멘토 연동. npm run lint Exit 0. **Arena leaderboard empty state 문구 점검**: noData(ko) "주간 XP 기록" 명시·notOnBoard/scopeUnavailable 유지. render-only. npm run lint 통과. Exit 체크 완료. **로딩/스켈레톤 1곳 런**: 대시보드 Leadership Engine 카드 — leState/leAir/leTii/leCertified 모두 null일 때 CardSkeleton(showLabel=false, lines=3) 적용. npm run lint 통과. Exit 체크 완료. **로딩/스켈레톤 2곳 런**: auth/callback PageClient·AuthGate 2곳에 LoadingFallback withSkeleton 적용. npm run lint 통과. Exit 체크 완료. **접근성 1건 런**: [locale] 레이아웃에 스킵 링크(본문으로 건너뛰기/Skip to main content) 1곳 적용·main id 적용. npm run lint 통과. Exit 체크 완료. **로딩/스켈레톤 1곳 런**: admin/sql-migrations 목록 로딩에 LoadingFallback withSkeleton 적용. npm run lint 통과. Exit 체크 완료. **접근성 1건 런**: AuthGate 로그인/회원가입 제출 버튼에 aria-label 적용. npm run lint 통과. Exit 체크 완료. **접근성 1건 런**: admin/sql-migrations 복사 버튼에 aria-label 적용. npm run lint 통과. Exit 체크 완료. **로딩/스켈레톤 1곳 런**: admin/organizations 목록 로딩에 LoadingFallback withSkeleton 적용. npm run lint 통과. Exit 체크 완료. **로딩/스켈레톤 1곳 런**: admin/users 목록 로딩에 LoadingFallback withSkeleton 적용. npm run lint 통과. Exit 체크 완료. **리더보드 Near Me 뷰 로딩/빈 상태 문구 점검**: ArenaRankingSidebar — 로딩 스켈레톤 유지, 에러 시 t.retry, 빈 목록 시 EmptyState(t.empty) 추가. render-only. npm run lint 통과. Exit 체크 완료. **Dojo 연습 화면 빈 상태·로딩 문구 1곳 보강**: integrity(역지사지) — 빈 대화 EmptyState(t.emptyHint), 전송 중 t.thinking + CardSkeleton. render-only. npm run lint 통과. Exit 체크 완료. **홈/랜딩 페이지 레이아웃·형태 런**: LandingClient 레이아웃·비주얼·UX 개선(PROMPT_LANDING_PAGE_DESIGN 참고). 히어로 타이포·여백 강화, Arena 카드 시각적 강조(t.recommended·shadow·hover), 세 목적지 유지. npm run lint 통과. Exit 체크 완료.

**Center §9 나머지 런 완료**: C2·C3·C4 Exit 후 C5 실행 완료. lint/test/build 통과. WRAP·CI PASSED 반영.

**Center §9 나머지 런 (C3·C4 완료)**: C3 §9 순서 §5~§8 API·도메인 점검. `src/domain/center/paths.ts`(CENTER_CTA_PATH, CENTER_CHAT_OPEN_EVENT, getCenterCtaHref), paths.test.ts 3케이스. PageClient CTA·챗 열기 도메인 사용. npm test 183 통과. C4 §9 점검·render-only 보완: PageClient KO 뷰 ResilienceGraph에 locale={locale} 추가. npm run lint Exit 0.

**Dojo 2차 런 완료**: C1~C5 모두 Exit 완료. C2 Dojo 2차 Gate PASS(BTY_RELEASE_GATE_CHECK.md § Dojo 2차 변경분 Gate 반영, 조건 충족·Exit 체크 완료). C3 50문항·연습 플로우 스펙/API·도메인 반영, npm test 통과. **Dojo 2차 UI: 진입·연습 2~5단계 (render-only)** 완료 — integrity·Dr. Chi API 응답만 표시, npm run lint Exit 0. C5 lint/test/build 통과.

**완료 이력**:
- **C5 (done) 2026-03-08**: C2 Exit 확인 후 ./scripts/orchestrate.sh 실행. Lint ✓ Test 85/640 ✓ Build ✓. **WRAP·CI PASSED (done).** 보드·CURRENT_TASK·BTY_RELEASE_GATE_CHECK 갱신 완료.
- **[UI] 접근성 1건 (aria-label·포커스 1곳)**: ConsolidationBlock 완료 버튼에 type="button", aria-label={t.completeBtn} 적용. npm run lint 통과. **완료.**
- **[VERIFY] Release Gate 체크리스트 1회 실행 후 서류 반영 (2026-03-06 재실행 5차)**: A~F 1회 점검. 결과 **PASS**. 필수 패치 0건. BTY_RELEASE_GATE_CHECK·CURSOR_TASK_BOARD·CURRENT_TASK 반영. **완료.**
- **[VERIFY] Release Gate 체크리스트 1회 실행 후 서류 반영 (2026-03-06 재실행 4차)**: A~F 1회 점검. 결과 **PASS**. 필수 패치 0건. BTY_RELEASE_GATE_CHECK·CURSOR_TASK_BOARD·CURRENT_TASK 반영. **완료.**
- **[VERIFY] Release Gate 체크리스트 1회 실행 후 서류 반영 (2026-03-06 재실행 3차)**: A~F 1회 점검. 결과 **PASS**. 필수 패치 0건. BTY_RELEASE_GATE_CHECK·CURSOR_TASK_BOARD·CURRENT_TASK 반영. **완료.**
- **[VERIFY] Release Gate 체크리스트 1회 실행 후 서류 반영 (2026-03-06 재실행 2차)**: bty-release-gate.mdc A~F 재점검. 결과 **PASS**. 필수 패치 0건. 권장: core-xp rank/isTop5Percent 도메인 이전. BTY_RELEASE_GATE_CHECK·CURSOR_TASK_BOARD·CURRENT_TASK 반영. **완료.**
- **[UI] 로딩/스켈레톤 1곳 보강 (auth/reset-password) 런 완료**: C2·C3 해당 없음 PASS. C4 auth/reset-password 비밀번호 변경 제출 중(loading) CardSkeleton 적용. npm run lint 통과. **완료.**
- **[UI] Dojo 연습 화면 빈 상태·로딩 문구 1곳 보강 런 완료**: C2·C3 해당 없음 PASS. C4 integrity(역지사지) 연습 화면 — 빈 대화 EmptyState(t.emptyHint), 전송 중 t.thinking + CardSkeleton. render-only. npm run lint 통과. **완료.**
- **[UI] 리더보드 Near Me 뷰 로딩/빈 상태 문구 점검 런 완료**: C2·C3 해당 없음 PASS. C4 ArenaRankingSidebar 로딩(스켈레톤)·에러(재시도 버튼 문구)·빈 목록(EmptyState 문구) 점검·보강. render-only. npm run lint 통과. **완료.**
- **로딩/스켈레톤 1곳 (admin/users) 런 완료**: C2·C3 해당 없음 PASS. C4 admin/users 목록 로딩에 LoadingFallback(withSkeleton) 적용(render-only). npm run lint 통과. **Exit 체크 완료.**
- **문서 점검 2~3건 런 완료**: C2·C3·C4 해당 없음. C1 문서 점검·갱신. C5 lint/test/build·orchestrate 통과(58 files, 519 tests). **WRAP·CI PASSED (done).** First Task 완료.
- **단위 테스트 1개 추가 런 완료**: C2·C4 해당 없음. C3 mentor_fewshot_dropin.test.ts 등 미커버 1모듈 테스트 추가. C5 lint/test/build·orchestrate 통과. **WRAP·CI PASSED (done).** First Task 완료.
- **문서 점검 2~3건 런 완료**: C2·C3·C4 해당 없음. C1 문서 점검·갱신. C5 lint/test/build·orchestrate 통과. **WRAP·CI PASSED (done).** First Task 완료.
- **로딩/스켈레톤 1곳 런 완료**: C2·C3 해당 없음. C4 AvatarSettingsClient 저장 중 CardSkeleton 적용. C5 lint/test/build·orchestrate 통과. **WRAP·CI PASSED (done).** First Task 완료.
- **단위 테스트 1개 추가 런 완료**: C2·C4 해당 없음. C3 mentorFewshotRouter.test.ts 1모듈(8케이스). C5 lint/test/build·orchestrate 통과. **WRAP·CI PASSED (done).** First Task 완료.
- **단위 테스트 1개 추가 런 완료**: C2·C4 해당 없음. C3 systemMessages.test.ts 1모듈(5케이스). C5 lint/test/build·orchestrate 통과. **WRAP·CI PASSED (done).** First Task 완료.
- **로딩/스켈레톤 1곳 런 완료**: C2·C3 해당 없음. C4 1곳 적용. C5 lint/test/build·orchestrate 통과. **WRAP·CI PASSED (done).** First Task 완료.
- **문서 점검 2~3건 런 완료**: C2·C3·C4 해당 없음. C1 문서 점검·갱신. C5 lint/test/build·orchestrate 통과. **WRAP·CI PASSED (done).** First Task 완료.
- **단위 테스트 1개 추가 런 완료**: C2·C4 해당 없음. C3 mentor/mentor_fewshot_router.test.ts 1모듈(8케이스). C5 lint/test/build·orchestrate 통과. **WRAP·CI PASSED (done).** First Task 완료.
- **로딩/스켈레톤 1곳 런 완료**: C2·C3 해당 없음. C4 프로필 페이지 저장 중 CardSkeleton 적용. C5 lint/test/build·orchestrate 통과. **WRAP·CI PASSED (done).** First Task 완료.
- **문서 점검 2~3건 런 완료**: C2·C3·C4 해당 없음. C1 문서 점검·갱신. C5 lint/test/build·orchestrate 통과. **WRAP·CI PASSED (done).** First Task 완료.
- **단위 테스트 1개 추가 런 완료**: C2·C4 해당 없음. C3 chat/buildChatMessages.test.ts 1모듈(9케이스). C5 lint/test/build·orchestrate 통과. **WRAP·CI PASSED (done).** First Task 완료.
- **로딩/스켈레톤 1곳 런 완료**: C2·C3 해당 없음. C4 대시보드 Sub Name 저장 중 CardSkeleton 적용. C5 lint/test/build·orchestrate 통과. **WRAP·CI PASSED (done).** First Task 완료.
- **문서 점검 2~3건 런 완료**: C2·C3·C4 해당 없음. C1 문서 점검·갱신. C5 lint/test/build·orchestrate 통과. **WRAP·CI PASSED (done).** First Task 완료.
- **로딩/스켈레톤 1곳 런 완료**: C2·C3 해당 없음. C4 test-avatar 페이지 patching 시 CardSkeleton 적용. C5 lint/test/build·orchestrate 통과. **WRAP·CI PASSED (done).** First Task 완료.
- **단위 테스트 1개 추가 런 완료**: C2·C4 해당 없음 PASS. C3 arena/engine.test.ts 1모듈(12케이스). C5 lint/test/build·orchestrate 통과. **WRAP·CI PASSED (done).** First Task 완료.
- **문서 점검 2~3건 런 완료**: C2·C3·C4 해당 없음 PASS. C1 문서 점검·갱신. C5 lint/test/build·orchestrate 통과. **WRAP·CI PASSED (done).** First Task 완료.
- **로딩/스켈레톤 1곳 런 완료**: C2·C3 해당 없음 PASS. C4 대시보드 Arena Membership 제출 중 CardSkeleton 1곳 적용. C5 lint/test/build·orchestrate 통과. **WRAP·CI PASSED (done).** First Task 완료.
- **단위 테스트 1개 추가 런 완료**: C2·C4 해당 없음 PASS. C3 emotional-stats/coreStats.test.ts 1모듈(9케이스). C5 lint/test/build·orchestrate 통과. **WRAP·CI PASSED (done).** First Task 완료.
- **문서 점검 2~3건 런 완료**: C2·C3·C4 해당 없음 PASS. C1 문서 점검·갱신. C5 lint/test/build·orchestrate 통과. **WRAP·CI PASSED (done).** First Task 완료.
- **로딩/스켈레톤 1곳 런 완료**: C2·C3 해당 없음 PASS. C4 healing/awakening 페이지 처리 중 CardSkeleton 1곳 적용. C5 lint/test/build·orchestrate 통과. **WRAP·CI PASSED (done).** First Task 완료.
- **단위 테스트 1개 추가 런 완료**: C2·C4 해당 없음 PASS. C3 scenario/beginnerScenarios.test.ts 1모듈(5케이스). C5 lint/test/build·orchestrate 통과. **WRAP·CI PASSED (done).** First Task 완료.
- **문서 점검 2~3건 런 완료**: C2·C3·C4 해당 없음 PASS. C1 문서 점검·갱신. C5 lint/test/build·orchestrate 통과. **WRAP·CI PASSED (done).** First Task 완료.
- **로딩/스켈레톤 1곳 런 완료**: C2·C3 해당 없음 PASS. C4 멘토 페이지 전송 중 CardSkeleton 1곳 적용. C5 lint/test/build·orchestrate 통과. **WRAP·CI PASSED (done).** First Task 완료.
- **단위 테스트 1개 추가 런 완료**: C2·C4 해당 없음 PASS. C3 scenario/engine.test.ts 1모듈(7케이스). C5 lint/test/build·orchestrate 통과. **WRAP·CI PASSED (done).** First Task 완료.
- **문서 점검 2~3건 런 완료**: C2·C3·C4 해당 없음 PASS. C1 문서 점검·갱신. C5 lint/test/build·orchestrate 통과. **WRAP·CI PASSED (done).** First Task 완료.
- **로딩/스켈레톤 1곳 런 완료**: C2·C3 해당 없음 PASS. C4 integrity 페이지 1곳 적용. C5 lint/test/build·orchestrate 통과. **WRAP·CI PASSED (done).** First Task 완료.
- **단위 테스트 1개 추가 런 완료**: C2·C4 해당 없음 PASS. C3 scenario/beginnerTypes.test.ts 1모듈(9케이스). C5 lint/test/build·orchestrate 통과. **WRAP·CI PASSED (done).** First Task 완료.
- **문서 점검 2~3건 런 완료**: C2·C3·C4 해당 없음 PASS. C1 문서 점검·갱신. C5 lint/test/build·orchestrate 통과. **WRAP·CI PASSED (done).** First Task 완료.
- **로딩/스켈레톤 1곳 런 완료**: C2·C3 해당 없음 PASS. C4 Elite 페이지 멘토 신청 제출 중 CardSkeleton 적용. C5 lint/test/build·orchestrate 통과. **WRAP·CI PASSED (done).** First Task 완료.
- **단위 테스트 1개 추가 런 완료**: C2·C4 해당 없음 PASS. C3 arena/reflection-engine.test.ts 1모듈 추가. C5 lint/test/build·orchestrate 통과. **WRAP·CI PASSED (done).** First Task 완료.
- **문서 점검 2~3건 런 완료**: C2·C3·C4 해당 없음 PASS. C1 문서 점검·갱신. C5 lint/test/build·orchestrate 통과. **WRAP·CI PASSED (done).** First Task 완료.
- **로딩/스켈레톤 1곳 런 완료**: C2·C3 해당 없음 PASS. C4 로그인 페이지 제출 중 CardSkeleton 적용. C5 lint/test/build·orchestrate 통과. **WRAP·CI PASSED (done).** First Task 완료.
- **단위 테스트 1개 추가 런 완료**: C2·C4 해당 없음 PASS. C3 emotional-stats/detectEvent.test.ts 1모듈 추가. C5 lint/test/build·orchestrate 통과. **WRAP·CI PASSED (done).** First Task 완료.
- **문서 점검 2~3건 런 완료**: C2·C3·C4 해당 없음 PASS. C1 문서 점검·갱신. C5 lint/test/build·orchestrate 통과. **WRAP·CI PASSED (done).** First Task 완료.
- **로딩/스켈레톤 1곳 런 완료**: C2·C3 해당 없음 PASS. C4 비밀번호 찾기 페이지 전송 중 CardSkeleton 적용. C5 lint/test/build·orchestrate 통과. **WRAP·CI PASSED (done).** First Task 완료.
- **단위 테스트 1개 추가 런 완료**: C2·C4 해당 없음 PASS. C3 emotional-stats/unlock.test.ts 1모듈 추가. C5 lint/test/build·orchestrate 통과. **WRAP·CI PASSED (done).** First Task 완료.
- **문서 점검 2~3건 런 완료**: C2·C3·C4 해당 없음 PASS. C1 문서 점검·갱신. C5 lint/test/build·orchestrate 통과. **WRAP·CI PASSED (done).** First Task 완료.
- **로딩/스켈레톤 1곳 런 완료**: C2·C3 해당 없음 PASS. C4 멘토 페이지 prefsLoaded 전 LoadingFallback(withSkeleton) 적용. C5 lint/test/build·orchestrate 통과. **WRAP·CI PASSED (done).** First Task 완료.
- **단위 테스트 1개 추가 런 완료**: C2·C4 해당 없음 PASS. C3 antiExploit 등 1모듈 테스트 추가. C5 lint/test/build·orchestrate 통과. **WRAP·CI PASSED (done).** First Task 완료.
- **문서 점검 2~3건 런 완료**: C2·C3·C4 해당 없음 PASS. C1 문서 점검·갱신. C5 lint/test/build·orchestrate 통과. **WRAP·CI PASSED (done).** First Task 완료.
- **로딩/스켈레톤 1곳 런 완료**: C2·C3 해당 없음 PASS. C4 1곳 스켈레톤/로딩 적용. C5 lint/test/build·orchestrate 통과. **WRAP·CI PASSED (done).** First Task 완료.
- **단위 테스트 1개 추가 런 완료**: C2·C4 해당 없음 PASS. C3 unlock 등 1모듈 테스트 추가. C5 lint/test/build·orchestrate 통과. **WRAP·CI PASSED (done).** First Task 완료.
- **문서 점검 2~3건 런 완료**: C2·C3·C4 해당 없음 PASS. C1 문서 점검·갱신. C5 lint/test/build·orchestrate 통과. **WRAP·CI PASSED (done).** First Task 완료.
- **core-xp·sub-name 도메인 이전 런 완료**: C2 Gate(도메인 이전 후) PASS. C3 rankFromCountAbove·weeklyRankFromCounts 도메인·route 호출만. C4 해당 없음. C5 lint/test/build·orchestrate 통과. **WRAP·CI PASSED (done).** First Task 완료.
- **문서 점검 2~3건 런 완료**: C2·C3·C4 해당 없음 PASS. C1 문서 점검·갱신. C5 lint/test/build·orchestrate 통과. **WRAP·CI PASSED (done).** First Task 완료.
- **단위 테스트 1개 추가 런 완료**: C2·C4 해당 없음 PASS. C3 1모듈 테스트 추가. C5 lint/test/build·orchestrate 통과. **WRAP·CI PASSED (done).** First Task 완료.
- **홈/랜딩 페이지 레이아웃·형태 변경 런 완료**: C2·C3 해당 없음 PASS. C4 LandingClient 레이아웃·비주얼·UX 적용. C5 lint/test/build·orchestrate 통과. **WRAP·CI PASSED (done).** First Task 완료.
- **로딩/스켈레톤 1곳 런 완료**: C2·C3 해당 없음 PASS. C4 admin/organizations 목록 로딩에 LoadingFallback 적용. C5 lint/test/build·orchestrate 통과. **WRAP·CI PASSED (done).** First Task 완료.
- **접근성 1건 (aria-label 또는 포커스/스킵) 런 완료**: C2·C3 해당 없음 PASS. C4 1곳 적용. C5 lint/test/build·orchestrate 통과. **WRAP·CI PASSED (done).** First Task 완료.
- **문서 점검 2~3건 런 완료**: C2·C3·C4 해당 없음 PASS. C1 문서 점검·갱신. C5 lint/test/build·orchestrate 통과. **WRAP·CI PASSED (done).** First Task 완료.
- **단위 테스트 1개 추가 런 완료**: C2·C4 해당 없음 PASS. C3 program 등 1모듈 테스트 추가. C5 lint/test/build·orchestrate 통과. **WRAP·CI PASSED (done).** First Task 완료.
- **접근성 1건 (aria-label 또는 포커스/스킵) 런 완료**: C2·C3 해당 없음 PASS. C4 1곳 적용. C5 lint/test/build·orchestrate 통과. **WRAP·CI PASSED (done).** First Task 완료.
- **로딩/스켈레톤 1곳 런 완료**: C2·C3 해당 없음 PASS. C4 1곳 적용. C5 lint/test/build·orchestrate 통과. **WRAP·CI PASSED (done).** First Task 완료.
- **문서 점검 2~3건 런 완료**: C2·C3·C4 해당 없음 PASS. C1 문서 점검·갱신. C5 lint/test/build·orchestrate 통과. **WRAP·CI PASSED (done).** First Task 완료.
- **접근성 1건 (aria-label 또는 포커스/스킵) 런 완료**: C2·C3 해당 없음 PASS. C4 1곳 적용. C5 lint/test/build·orchestrate 통과. **WRAP·CI PASSED (done).** First Task 완료.
- **단위 테스트 1개 추가 런 완료**: C2·C4 해당 없음 PASS. C3 tenure 등 1모듈 테스트 추가. C5 lint/test/build·orchestrate 통과. **WRAP·CI PASSED (done).** First Task 완료.
- **로딩/스켈레톤 2곳 런 완료**: C2·C3 해당 없음 PASS. C4 해당 시 2곳 적용. C5 lint/test/build·orchestrate 통과. **WRAP·CI PASSED (done).** First Task 완료.
- **문서 점검 2~3건 런 완료**: C2·C3·C4 해당 없음 PASS. C1 BTY_RELEASE_GATE_CHECK §5·보드·CURRENT_TASK 점검. C5 lint/test/build·orchestrate 통과. **WRAP·CI PASSED (done).** First Task 완료.
- **단위 테스트 2개 추가 런 완료**: C2·C4 해당 없음 PASS. C3 해당 시 2모듈 테스트 추가. C5 lint/test/build·orchestrate 통과. **WRAP·CI PASSED (done).** First Task 완료.
- **접근성 1건 (ResultBlock Next) 런 완료**: C2·C3 해당 없음 PASS. C4 ResultBlock Next 버튼에 aria-label 적용. npm run lint 통과. **Exit 체크 완료.**
- **문서 점검 2~3건 런 완료**: C2·C3·C4 해당 없음 PASS. C1 문서 점검·갱신. C1 검증(orchestrate.sh) 통과. **WRAP·CI PASSED.** First Task 완료.
- **단위 테스트 1모듈 추가 (arena/domain) 런 완료**: C2·C4 해당 없음 PASS. C3 arena domain 테스트 추가(domain.test.ts)·npm test 297 통과. C1 검증(orchestrate.sh) 통과. **WRAP·CI PASSED.** First Task 완료.
- **접근성 1건 (ArenaHeader Pause) 런 완료**: C2·C3 해당 없음 PASS. C4 ArenaHeader Pause aria-label 적용. C1 검증(orchestrate.sh) 통과. **WRAP·CI PASSED.** First Task 완료.
- **문서 점검 2~3건 런 완료**: C2·C3·C4 해당 없음 PASS. C1 문서 점검·갱신. C1 검증(orchestrate.sh) 통과. **WRAP·CI PASSED.** First Task 완료.
- **단위 테스트 1모듈 추가 런 완료**: C2·C4 해당 없음 PASS. C3 미커버 1모듈 테스트 추가·npm test 통과. C1 검증(orchestrate.sh) 통과. **WRAP·CI PASSED.** First Task 완료.
- **접근성 1건 (aria-label 또는 포커스/스킵) 런 완료**: C2·C3 해당 없음 PASS. C4 ScenarioIntro aria-label 적용. 검증(사용자 확인) 통과. **WRAP·CI PASSED.** First Task 완료.
- **접근성 1건 (ArenaHeader Pause) 런 완료**: C2·C3 해당 없음 PASS. C4 ArenaHeader Pause 버튼에 aria-label 적용. npm run lint 통과. **Exit 체크 완료.**
- **접근성 1건 (ScenarioIntro) 런 (C4 Exit)**: C2·C3 해당 없음 PASS. C4 ScenarioIntro 시작 버튼에 aria-label 적용. npm run lint 통과. **Exit 체크 완료.**
- **문서 점검 2~3건 (백로그 1~2 + Release Gate/rules 1건) 런 완료**: C2·C3·C4 해당 없음 PASS. C1 문서 점검·갱신. 검증(터미널) 통과. **WRAP·CI PASSED.** First Task 완료. (C1이 검증 통과 확인 후 바로 done 처리)
- **단위 테스트 1모듈 추가 런 완료**: C2·C4 해당 없음 PASS. C3 stage.test.ts 등 미커버 1모듈 테스트 추가·npm test 통과. C5 lint/test/build·orchestrate 통과. **WRAP·CI PASSED (done).** First Task 완료.
- **단위 테스트 1개 추가 런 (C2 Exit·C5 실행 가능 표시)**: CURSOR_TASK_BOARD·.cursor/rules·BTY_RELEASE_GATE_CHECK 대조. § "단위 테스트 1개 추가 변경분 Gate" — 테스트만 추가(비즈니스/XP 로직 미변경) → 해당 없음 **PASS**. Exit 체크 완료. C5 실행 가능 표시 반영.
- **단위 테스트 1개 추가 런 (C2 Exit)**: CURSOR_TASK_BOARD·.cursor/rules·BTY_RELEASE_GATE_CHECK 대조. § "단위 테스트 1개 추가 변경분 Gate" — 테스트만 추가(비즈니스/XP 로직 미변경) → 해당 없음 **PASS**. Exit 체크 완료.
- **접근성 1건 (aria-label 또는 포커스/스킵) 런 완료**: C2·C3 해당 없음 PASS. C4 PrimaryActions aria-label 적용. C5 lint/test/build·orchestrate 통과. **WRAP·CI PASSED (done).** First Task 완료.
- **접근성 1건 (aria-label) 런 (C4 Exit)**: C2·C3 해당 없음 PASS. C4 PrimaryActions 버튼에 aria-label 적용. npm run lint 통과. **Exit 체크 완료.**
- **접근성 1건 런 (C2 Exit·C5 실행 가능 표시)**: CURSOR_TASK_BOARD·.cursor/rules·BTY_RELEASE_GATE_CHECK 대조. § "접근성 1건 변경분 Gate" — UI만 변경 → 해당 없음 **PASS**. Exit 체크 완료. C5 실행 가능 표시 반영.
- **접근성 1건 런 (C2 Exit)**: CURSOR_TASK_BOARD·.cursor/rules·BTY_RELEASE_GATE_CHECK 대조. § "접근성 1건 변경분 Gate" — UI만 변경 → 해당 없음 **PASS**. Exit 체크 완료.
- **접근성 1건 런 (C2 Exit)**: CURSOR_TASK_BOARD·.cursor/rules·BTY_RELEASE_GATE_CHECK 대조. § "접근성 1건 변경분 Gate" — UI만 변경 → 해당 없음 **PASS**. Exit 체크 완료.
- **문서 점검 2~3건 (백로그 1~2 + Release Gate/rules 1건) 런 완료**: C2·C3·C4 해당 없음 PASS. C1 문서 2~3건 점검·갱신. C5 lint/test/build·orchestrate 통과. **WRAP·CI PASSED (done).** First Task 완료.
- **로딩/스켈레톤 2곳 보강 런 완료**: C2·C3 해당 없음 PASS. C4 AvatarSettingsClient·SecondAwakeningPageClient 2곳 LoadingFallback 적용. C5 lint/test/build·orchestrate 통과. **WRAP·CI PASSED (done).** First Task 완료.
- **로딩/스켈레톤 2곳 보강 런 (C4 Exit)**: C4 `AvatarSettingsClient`·`healing/awakening/page.client.tsx` 2곳에 `LoadingFallback`(icon + message + withSkeleton) 적용. npm run lint 통과. **Exit 체크 완료.**
- **문서 점검 2~3건 런 (C2 Exit·C5 실행 가능 표시)**: CURSOR_TASK_BOARD·.cursor/rules·BTY_RELEASE_GATE_CHECK 대조. § "문서 점검 2~3건 변경분 Gate" — 문서만 변경(코드 없음) → 해당 없음 **PASS**. Exit 체크 완료. C5 실행 가능 표시 반영.
- **문서 점검 2~3건 런 (C2 Exit)**: CURSOR_TASK_BOARD·.cursor/rules·BTY_RELEASE_GATE_CHECK 대조. § "문서 점검 2~3건 변경분 Gate" — 문서만 변경(코드 없음) → 해당 없음 **PASS**. Exit 체크 완료.
- **문서 점검 2~3건 런 (C2 Exit)**: CURSOR_TASK_BOARD·.cursor/rules·BTY_RELEASE_GATE_CHECK 대조. § "문서 점검 2~3건 변경분 Gate" — 문서만 변경(코드 없음) → 해당 없음 **PASS**. Exit 체크 완료.
- **로딩/스켈레톤 2곳 런 (C2 Exit·C5 실행 가능 표시)**: CURSOR_TASK_BOARD·.cursor/rules·BTY_RELEASE_GATE_CHECK 대조. § "로딩/스켈레톤 2곳 변경분 Gate" — UI만 변경 → 해당 없음 **PASS**. Exit 체크 완료. C5 실행 가능 표시 반영.
- **로딩/스켈레톤 1곳 보강 런 완료**: C2·C3 해당 없음 PASS. C4 스켈레톤 또는 로딩 1곳 적용·npm run lint 통과. C5 lint/test/build·orchestrate 통과. **WRAP·CI PASSED (done).** First Task 완료.
- **접근성 1건 (aria-label 또는 포커스/스킵) 런 완료**: C2·C3 해당 없음 PASS. C4 접근성 1건 적용·npm run lint 통과. C5 lint/test/build·orchestrate 통과. **WRAP·CI PASSED (done).** First Task 완료.
- **단위 테스트 1개 추가 런 완료**: C2·C4 해당 없음 PASS. C3 미커버 1모듈 테스트 1개 추가·npm test 통과. C5 lint/test/build·orchestrate 통과. **WRAP·CI PASSED (done).** First Task 완료.
- **문서 점검 2~3건 (백로그 + Release Gate) 런 완료**: C2·C3·C4 해당 없음 PASS. C1 문서 2~3건 점검·갱신. C5 lint/test/build·orchestrate 통과. **WRAP·CI PASSED (done).** First Task 완료.
- **문서 점검 2~3건 런 (C2 Exit)**: CURSOR_TASK_BOARD·.cursor/rules·BTY_RELEASE_GATE_CHECK 대조. § "문서 점검 2~3건 변경분 Gate" — 문서만 변경 → 해당 없음 **PASS**. Exit 체크 완료.
- **로딩/스켈레톤 1곳 런 (C2 Exit)**: CURSOR_TASK_BOARD·.cursor/rules·BTY_RELEASE_GATE_CHECK 대조. § "로딩/스켈레톤 1곳 변경분 Gate" — UI만 변경 → 해당 없음 **PASS**. Exit 체크 완료. BTY_RELEASE_GATE_CHECK Findings·Required patches·Next steps 반영.
- **접근성 1건 (aria-label 또는 포커스/스킵) 런 완료**: C2·C3 해당 없음 PASS. C4 접근성 1건 적용·npm run lint 통과. C5 lint/test/build·orchestrate 통과. **WRAP·CI PASSED (done).** First Task 완료.
- **접근성 1건 런 (C2 Exit)**: CURSOR_TASK_BOARD·.cursor/rules·BTY_RELEASE_GATE_CHECK 대조. § "접근성 1건 변경분 Gate" — UI만 변경 → 해당 없음 **PASS**. Exit 체크 완료. BTY_RELEASE_GATE_CHECK Findings·Required patches·Next steps 반영.
- **단위 테스트 1개 추가 런 완료**: C2·C4 해당 없음 PASS. C3 미커버 1모듈 테스트 1개 추가·npm test 통과. C5 lint/test/build·orchestrate 통과. **WRAP·CI PASSED (done).** First Task 완료.
- **단위 테스트 1개 추가 런 (C2 Exit)**: CURSOR_TASK_BOARD·.cursor/rules·BTY_RELEASE_GATE_CHECK 대조. § "단위 테스트 1개 추가 변경분 Gate" — 테스트만 추가(비즈니스/XP 로직 미변경) → 해당 없음 **PASS**. Exit 체크 완료. BTY_RELEASE_GATE_CHECK 대조 기준·Findings·Required patches·Next steps 반영.
- **문서 점검 2~3건 런 (C2 Exit)**: CURSOR_TASK_BOARD·.cursor/rules·BTY_RELEASE_GATE_CHECK 대조. § "문서 점검 2~3건 변경분 Gate" — 문서만 변경 → 해당 없음 **PASS**. Exit 체크 완료. BTY_RELEASE_GATE_CHECK Findings·Required patches·Next steps 보강 반영.
- **Cursor 2 Gatekeeper 검사 (Arena locale + API 규칙)**: 변경분(Arena locale) **PASS**. 기존 위반 2건 — core-xp·sub-name route에서 랭크/상위5% 인라인 계산 → Required patches § BTY_RELEASE_GATE_CHECK.md "Cursor 2 Gatekeeper 검사" 반영. CURSOR_TASK_BOARD·BTY_RELEASE_GATE_CHECK 갱신.
- **로딩/스켈레톤 2곳 보강 런 완료**: C2·C3 해당 없음 PASS. C4 스켈레톤 또는 로딩 2곳 적용. C5 lint/test/build·orchestrate 통과. **WRAP·CI PASSED (done).** First Task 완료.
- **i18n 2건+접근성 1건 런 완료**: C2·C3 해당 없음 PASS. C4 i18n 2곳+접근성 1곳 반영. C5 lint/test/build·orchestrate 통과. **WRAP·CI PASSED (done).** First Task 완료.
- **단위 테스트 2개 추가 런 완료**: C2·C4 해당 없음 PASS. C3 vitest 단위 테스트 2개 추가·npm test 통과. C5 lint/test/build·orchestrate 통과. **WRAP·CI PASSED (done).** First Task 완료.
- **문서 점검 2~3건 (백로그 + Release Gate) 런 완료**: C2·C3·C4 해당 없음 PASS. C1 문서 2~3건 점검·갱신. C5 lint/test/build·orchestrate 통과. **WRAP·CI PASSED (done).** First Task 완료.
- **단위 테스트 1개 추가 런 완료**: C2·C4 해당 없음 PASS. C3 vitest 단위 테스트 1개 추가·npm test 통과. C5 lint/test/build·orchestrate 통과. **WRAP·CI PASSED (done).** First Task 완료.
- **로딩/스켈레톤 1곳 보강 런 완료**: C2·C3 해당 없음 PASS. C4 스켈레톤 또는 로딩 플레이스홀더 1곳 적용. C5 lint/test/build·orchestrate 통과. **WRAP·CI PASSED (done).** First Task 완료.
- **접근성 1건 (aria-label 또는 포커스) 런 완료**: C2·C3 해당 없음 PASS. C4 aria-label 또는 포커스/스킵 1개 적용. C5 lint/test/build·orchestrate 통과. **WRAP·CI PASSED (done).** First Task 완료.
- **i18n 누락 키 1개 보강 런 완료**: C2·C3 해당 없음 PASS. C4 누락 키 1개 ko/en 추가·컴포넌트 반영. C5 lint/test/build·orchestrate 통과. **WRAP·CI PASSED (done).** First Task 완료.
- **챗봇 재시도·에러 UI 보강 런 완료**: C2·C3 해당 없음 PASS. C4 Chatbot 재시도 버튼·에러 안내 문구. C5 lint/test/build·orchestrate 통과. **WRAP·CI PASSED (done).** First Task 완료.
- **빈 상태 보강 1곳 추가 (3곳째) 런 완료**: C2·C3 해당 없음 PASS. C4 미적용 1곳 empty state 일러/아이콘+문구. C5 lint/test/build·orchestrate 통과. **WRAP·CI PASSED (done).** First Task 완료.
- **리더보드 타이 브레이커 명시 및 구현 런 완료**: C2 Gate PASS(랭킹=Weekly XP만·시즌 미반영). C3 leaderboard 정렬 규칙(2·3차 컬럼) 반영. C4 API 순서만 사용. C5 lint/test/build·orchestrate 통과. **WRAP·CI PASSED (done).** First Task 완료.
- **대시보드 버튼 1개 + API/라우트 연동 런 완료**: C2 Gate PASS(단순 GET·라우트→해당 없음). C3 해당 없음(기존 API·라우트만). C4 대시보드 버튼 UI·클릭 시 API/라우트. C5 lint/test/build·orchestrate 통과. **WRAP·CI PASSED (done).** First Task 완료.
- **프로필 필드 1개 추가 (PATCH profile 반영) 런 완료**: C2 Gate PASS(Auth·XP/랭킹 미접촉). C3 PATCH profile에 필드 반영. C4 프로필 필드 표시·편집 UI. C5 lint/test/build·orchestrate 통과. **WRAP·CI PASSED (done).** First Task 완료.
- **Arena 시나리오 완료 시 알림 토스트 런 완료**: C2·C3 해당 없음 PASS. C4 시나리오 완료 시 토스트 노출. C5 lint/test/build·orchestrate 통과. **WRAP·CI PASSED (done).** First Task 완료.
- **리더보드 주간 리셋 일시 표시 런 완료**: C2 Gate PASS(랭킹=Weekly XP만·표시용 필드만). C3 주간 경계 도메인·API 반환. C4 리더보드 UI에 주간 리셋 일시 표시. C5 lint/test/build·orchestrate 통과. **WRAP·CI PASSED (done).** First Task 완료.
- **빈 상태 보강 1곳 추가 (2곳째) 런 완료**: C2·C3 해당 없음 PASS. C4 아직 미적용 1곳에 일러/아이콘+문구 적용. C5 lint/test/build·orchestrate 통과. **WRAP·CI PASSED (done).** First Task 완료.
- **엘리트 5% 3차 서클(Circle) 모임 1차 런 완료**: C2 Gate PASS(Elite=Weekly XP만·시즌 미반영). C3 해당 없음(플레이스홀더). C4 Elite 페이지 서클 모임 카드/안내. C5 lint/test/build·orchestrate 통과. **WRAP·CI PASSED (done).** First Task 완료.
- **Phase 4 체크리스트 §2-2 엘리트 5% 기능 검증 런 완료**: C2·C3 해당 없음 PASS. C4 상위 5% 조건 노출/동작 확인·문서 반영. C5 lint/test/build·orchestrate 통과. **WRAP·CI PASSED (done).** First Task 완료.
- **Phase 4 체크리스트 §2-1 코드별 스킨 노출 검증 런 완료**: C2·C3 해당 없음 PASS. C4 Code별 챗봇/멘토 스킨 확인·문서 반영. C5 lint/test/build·orchestrate 통과. **WRAP·CI PASSED (done).** First Task 완료.
- **Phase 4 체크리스트 — 다음 미완료 1건 런 완료**: C1 선정(해당 시)·C2·C3·C4 해당 시/해당 없음. C5 lint/test/build·orchestrate 통과. **WRAP·CI PASSED (done).** First Task 완료.
- **빈 상태 보강 1곳 추가 런 완료**: C2·C3 해당 없음 PASS. C4 빈 상태 일러/아이콘+문구 1곳 적용. C5 lint/test/build·orchestrate 통과. **WRAP·CI PASSED (done).** First Task 완료.
- **엘리트 5% 2차 (멘토 대화 신청) 런 완료**: C2 Gate PASS(랭킹=Weekly XP만·시즌 미반영). C3·C4 신청·승인 도메인·API·UI. C5 lint/test/build·orchestrate 통과. **WRAP·CI PASSED (done).** First Task 완료.
- **챗봇 훈련 후속 (RAG·예시 보강) 런 완료**: C2 Gate 해당 없음 PASS. C3·C4 RAG·예시·메타 답변·Chatbot/i18n 보강. C5 lint/test/build·orchestrate 통과. **WRAP·CI PASSED (done).** First Task 완료.
- **엘리트 5% 1차 구현 런 완료**: C2 Gate PASS(랭킹=Weekly XP만·시즌 미반영). C3·C4 해금/배지 도메인·API·UI. C5 lint/test/build·orchestrate 통과. **WRAP·CI PASSED (done).** First Task 완료.
- **PROJECT_BACKLOG §10 점검·갱신 런 완료**: C2·C3·C4 해당 없음/점검·문서만 반영. C5 lint/test/build·orchestrate 통과. **WRAP·CI PASSED (done).** First Task 완료.
- **챗봇 연결 끊김 재현·점검 런 완료**: C2 Gate 해당 없음 PASS. C3·C4 해당 시/해당 없음 반영. C5 lint/test/build·orchestrate 통과. **WRAP·CI PASSED (done).** First Task 완료.
- **감정 스탯 v3 확장 런 완료**: C2 Gate PASS(해당 없음). C3·C4 완료 이력 반영. C5 lint/test/build·orchestrate 통과. **WRAP·CI PASSED.** First Task 완료.
- **기존 백로그 런(8차) 완료**: C1~C5 Exit. C5 lint/test/build·orchestrate 통과. **WRAP·CI PASSED.** First Task 완료.
- **기존 백로그 런(7차) 완료**: C1~C5 Exit. C5 lint/test/build·orchestrate 통과. **WRAP·CI PASSED.** First Task 완료.
- **기존 백로그 런(6차) 완료**: C1~C5 Exit. C5 lint/test/build·orchestrate 통과. **WRAP·CI PASSED.** First Task 완료.
- **기존 백로그 런(5차) 완료**: C1~C5 Exit. C5 lint/test/build·orchestrate 통과. **WRAP·CI PASSED.** First Task 완료.
- **기존 백로그 런(4차) 완료**: C1~C5 Exit. C5 lint/test/build·orchestrate 통과. **WRAP·CI PASSED.** First Task 완료.
- **기존 백로그 런(3차) 완료**: C1~C5 Exit. C5 lint/test/build·orchestrate 통과. **WRAP·CI PASSED.** First Task 완료.
- **기존 백로그 런(2차) 완료**: C1~C5 Exit. C5 lint/test/build·orchestrate 통과. **WRAP·CI PASSED.** First Task 완료.
- **기존 백로그 런 완료**: C1 선정(또는 검증만)·C2·C3·C4 해당 시/해당 없음. C5 lint/test/build·orchestrate 통과. **WRAP·CI PASSED.** First Task 완료.
- **리더보드 팀/역할/지점 뷰 런 완료**: C2 Gate PASS(C 준수). C3 leaderboardScope·scope API/도메인. C4 팀/역할/지점 뷰 UI. C5 lint/test/build·orchestrate 통과. **WRAP·CI PASSED.** First Task 완료.
- **대시보드 코드네임 설명 런 완료**: C2 Gate PASS(해당 없음). C3 해당 없음. C4 코드네임 툴팁/팝오버. C5 lint/test/build·orchestrate 통과. **WRAP·CI PASSED.** First Task 완료.
- **Arena 아바타 런 완료**: C2 Arena 아바타 Gate PASS. C3·C4 AVATAR_LAYER_SPEC §6·§7 DB/API/도메인·AvatarComposite. C5 lint/test/build·orchestrate 통과. **WRAP·CI PASSED.** First Task 완료.
- **§2 챗봇 플로팅 /center 비노출 완료**: C2 해당 없음(이미 PASS). C3 해당 없음. C4 `center/page.tsx` Chatbot 제거. C5 lint/test/build·orchestrate 통과. **WRAP·CI PASSED.** First Task 완료.
- **Center §9 나머지 런 완료**: C2 Gate PASS. C3 paths.ts·paths.test.ts·npm test 183. C4 ResilienceGraph locale 보완·npm run lint. C5 lint/test/build 통과. WRAP·CI PASSED. First Task 완료.
- **Center §9 나머지 (C3·C4 완료)**: §9-1 API·도메인 완료 상태 표 추가. 도메인 paths.ts·paths.test.ts. PageClient getCenterCtaHref·CENTER_CHAT_OPEN_EVENT 사용. C4 ResilienceGraph locale={locale} 보완(KO step5·메인). npm test 183, npm run lint Exit 0.
- **Dojo 2차 확장 완료**: C2 Gate PASS. C3 50문항·연습 플로우 스펙/API·도메인 반영, npm test 통과. C4 진입·연습 플로우 2~5단계 UI(render-only), integrity·POST /api/mentor 응답만 표시, npm run lint Exit 0. C5 lint/test/build 통과. First Task 완료.
- **C4 감정 스탯 v3 표시 UI 완료**: display API만 사용(render-only), 대시보드·bty·멘토 연동. npm run lint Exit 0. Exit 체크 완료.
- **C3 coreStats v3 완료**: HEALING_COACHING_SPEC_V3·healing-coaching-spec-v3.json 기준 이벤트 14종·stat_distribution·30일 가속·phase_tuning formula·recordEmotionalEventServer 반영. 도메인만 비즈니스 규칙. phase.test.ts·formula.test.ts 추가. npm test 171 통과. Exit 체크 완료.
- **CI GATE PASSED ✅ (wrap)**: lint ✅ test ✅ build ✅. Gate 검증 완료.
- **CI GATE PASSED (wrap)**: lint ✅ test ✅ (171) build ✅. C2 Exit 완료. C3·C4 미완료 상태에서 Gate 검증 완료.
- **§7 50문항 정성 플로우**: AssessmentClient 한 문항씩 스텝·진행 표시·이전/다음·결과 보기. [locale]/assessment 페이지 locale 전달. lint/test/build 통과.
- **core-xp display 필드 + 대시보드 연동**: C3(core-xp route display 필드·codes.ts만 사용), C4(대시보드 display 필드만 사용). lint/test/build 통과.
- §5 CTA·재로그인, §6 챗으로 이어하기, §4 ResilienceGraph(일별 트렉 ✅), §3 콘텐츠 순서(5→안내→50 ✅). CI GATE PASSED ✅
- **core-xp API display 필드**: 도메인 `codes.computeCoreXpDisplay` 추가, route는 도메인만 호출. `codes.test.ts` 10케이스 추가. npm test 150 통과.
- **§1·§8 Center 톤·비주얼(아늑한 방) + locale=en 전부 영어**: i18n center/resilience 등 en 완비, hero 타이틀·컴포넌트 locale 전달. npm test 14파일 150통과. CENTER_PAGE_IMPROVEMENT_SPEC §1·§8 반영·완료 이력 갱신.
- **§1·§8 Center dear 테마·EN 한글 미노출 (이번 런)**: EN Center 전 구간 dear 테마(dear-* 클래스)·카피 i18n만 사용. EN 경로 한글 미노출 점검·Nav locale={locale}. render-only. npm run lint 통과. Exit 체크 완료.

- **접근성 1건 (이번 런)**: OutfitCard 옷 선택 버튼에 aria-label 적용(Select outfit / Selected outfit + 라벨). npm run lint 통과. C4 Exit 체크 완료.
- **로딩/스켈레톤 1곳 (이번 런)**: EmotionalStatsPhrases 로딩 시 null 대신 CardSkeleton 표시. npm run lint 통과. C4 Exit 체크 완료.
- **접근성 1건 (이번 런)**: ArenaHeader Reset 버튼에 aria-label 적용. npm run lint 통과. C4 Exit 체크 완료.
- **로딩/스켈레톤 1곳 (이번 런)**: ResilienceGraph 로딩 시 그래프 영역 스켈레톤 플레이스홀더 적용. npm run lint 통과. C4 Exit 체크 완료.

**현재 상태**:
- **C2·C4**: 추가 작업 없음. 이미 반영·완료(CURRENT_TASK·CURSOR_TASK_BOARD·CURSORS_PARALLEL_TASK_LIST §8). 감정 스탯 v3 Gate 해당 없음 → PASS. 감정 스탯 v3 표시 UI display API만 사용(render-only), 대시보드·bty·멘토 연동, npm run lint Exit 0.
- §7·§1·§8 런 완료. Center 개선 스펙 §1~§8 반영 완료.
- **Arena 한국어 locale 분기**: 시나리오·안내·대답 ko 경로/포맷 반영. 도메인 `computeResult` locale 지원, submit API body.locale, LOCALE_SCENARIO_GUIDE_RESPONSE 갱신. npm test 150 통과. Exit 체크 완료.

---

## C2~C5 붙여넣을 1줄 명령어 (4개) — 단위 테스트 1개 추가 런

| 커서 | 1줄 명령어 |
|------|------------|
| **C2** | CURSOR_TASK_BOARD·.cursor/rules·BTY_RELEASE_GATE_CHECK 대조. § "단위 테스트 1개 추가 변경분 Gate" — 테스트만 추가(비즈니스/XP 미변경) → 해당 없음 PASS. Exit 체크. |
| **C3** | C1 목표 = 단위 테스트 1개 추가 → 미커버 1모듈 테스트 파일 추가. **npm test** 통과 후 Exit. |
| **C4** | C1 목표 = 단위 테스트 1개 추가 → **해당 없음 Exit.** npm run lint 통과. |
| **C5** | C2·C3·C4 Exit 확인 후 `./scripts/orchestrate.sh`. 성공 시 **done** 입력 → wrap-ci passed·보드 갱신. |

---

## C5 실행 커맨드 (1줄)

```bash
./scripts/orchestrate.sh
```

(`orchestrate.sh` 없으면 `./scripts/ci-gate.sh`.)

**사용자 표기**: 사용자가 **"done"** 이라고 쓰면 **wrap-ci passed**와 동일하게 이해·처리한다 (보드 갱신·Exit 체크·완료).

**옵션 (workers 검증)**:
`BASE="https://..." LOGIN_BODY='{"email":"...","password":"..."}' ./scripts/orchestrate.sh`

---

## C2 체크리스트 (Center)

| 구분 | 체크 |
|------|------|
| A | 쿠키 설정 변경 없음. 미들웨어 리다이렉트만. |
| Auth Safety | 인증 user + /bty/login → /bty 리다이렉트. How to verify: 로컬 로그인 → Center CTA → /bty 직행. |
| F | 로컬: 로그인→CTA→/bty. Preview: 세션 유지. Prod: 401 없음. |

---

## C2 Gatekeeper 체크리스트 (Center 프로젝트)

Center 변경분은 **§5 CTA·재로그인**만 Auth/경로를 건드리므로 아래만 점검. (B~E: XP/시즌/리더보드/마이그레이션 미접촉 → N/A.)

| 구분 | 체크 항목 | 질문/포인트 |
|------|-----------|-------------|
| **A** | Auth/Cookies/Session | 쿠키 설정 변경 여부? (없으면 기존 BTY_RELEASE_GATE_CHECK 결과 유지.) CTA/미들웨어에서 쿠키 읽기만 하고 설정은 기존 auth 모듈 그대로? |
| **Auth Safety** | CTA·재로그인 경로 | CTA 클릭 시 `/bty/login`이 아닌 `/bty`(또는 보호된 경로)로 직행하는가? 미들웨어에서 인증된 사용자 리다이렉트만 수정했는가? |
| **F** | Verification Steps | 1) 로컬: 로그인 → Center CTA 클릭 → /bty 이동·재로그인 없음. 2) Preview: 로그인 유지. 3) Prod: 쿠키·401 루프 없음. |

**C2 실행**: 위 표 대조 후 `docs/BTY_RELEASE_GATE_CHECK.md`에 "Center 프로젝트" Gate 결과(PASS/FAIL + 위반 목록) 반영.

---

## Gate Report (Center)

- Release Gate: CTA/재로그인 시 A) Auth/Cookies, F) Verification Steps. B~E 생략 가능.
- Auth Safety: "How to verify: 로컬 Center CTA 클릭 → /bty 이동·재로그인 없음" 1줄.

---

## 작업 후 문서 갱신 체크리스트

- [x] 이번 First Task에 Domain/API 변경 없음 → N/A 또는 "해당 없음" 명시 (§1·§8: UI/i18n만 해당)
- [x] (변경한 경우에만) npm test 통과 (§1·§8: Domain/API 미변경 → 해당 없음, 기존 150통과 확인)
- [x] `docs/CURRENT_TASK.md` — 이번 작업 상태/완료 1줄 (C2 Exit·core-xp Gate 반영)
- [x] `docs/CURSOR_TASK_BOARD.md` — 위 표 [ ] → [x] (C2 Gatekeeper Exit [x])
- **검증 결과 반영**: lint/test/build 실행 후 결과는 반드시 `CURRENT_TASK.md` § Integrator 검증 블록 + 이 보드 C5·Gate Report에 반영한다.
- [ ] `docs/CENTER_PAGE_IMPROVEMENT_SPEC.md` — § 완료 이력 (Center 항목 완료 시)
- [ ] `docs/PROJECT_BACKLOG.md` §10 — Center [x] (전체 완료 시)
- [x] `docs/BTY_RELEASE_GATE_CHECK.md` — Gate 결과·위반·권장 패치 반영 (core-xp API 확장 Gate § 추가)

---

## C5 실행 커맨드 (1줄)

```bash
./scripts/orchestrate.sh
```

**옵션 (workers 검증 시)**:

```bash
BASE="https://bty-website.YOUR_SUBDOMAIN.workers.dev" LOGIN_BODY='{"email":"YOUR_EMAIL","password":"YOUR_PASSWORD"}' ./scripts/orchestrate.sh
```
