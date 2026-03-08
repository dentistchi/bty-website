# 현재 작업 (진행 에이전트용)

**진행 에이전트**: 이 파일 또는 커맨더 메시지에 적힌 **기능(요구사항)** 을 구현하세요.  
지시가 없으면 이 파일의 내용을 확인하고, 아래 형식으로 적힌 항목을 도메인 → API → UI 순으로 진행하세요.

**오늘 4커서 병렬 작업 목록**: **`docs/CURSORS_PARALLEL_TASK_LIST.md`** — Cursor 1·2·3·4별 할 일·복사용 프롬프트·완료 시 문서 업데이트 규칙이 정리되어 있음. 커맨더가 해당 문서에서 프롬프트를 복사해 각 Cursor에 붙이면 병렬 진행 가능.

---

## 형식 예시

아래처럼 **한 줄이라도** 구체적으로 적어 주세요.

- 「대시보드에 ○○ 버튼 추가하고, 클릭 시 API /api/arena/… 호출」
- 「리더보드에 주간 리셋 일시 표시」
- 「Arena 시나리오 완료 시 △△ 알림 토스트」
- 「프로필에 ○○ 필드 추가, PATCH /api/arena/profile 에 반영」

---

## 이번에 구현할 기능

**C5 (done) 2026-03-08**: [x] **완료.** C2 Exit 확인 후 ./scripts/orchestrate.sh 실행. Lint ✓ Test 85/640 ✓ Build ✓. WRAP·CI PASSED (done). 보드·CURRENT_TASK·BTY_RELEASE_GATE_CHECK 갱신 완료.

**C5 Verify (2026-03-08)**: [x] **완료.** cd bty-app → ./scripts/ci-gate.sh. Lint ✓ Test 85/640 ✓ Build ✓. CI GATE PASSED. 작업 완료. BTY_RELEASE_GATE_CHECK·CURSOR_TASK_BOARD·CURRENT_TASK 반영.

**C1 (2026-03-08)**: [x] 다음 작업 선정 — [UI] 엘리트 멘토 대화 신청 플로우 완료 반영. First Task = 단위 테스트 1개 추가. 보드·NEXT_PHASE_AUTO4·CURRENT_TASK 갱신.

**[UI] 엘리트 멘토 대화 신청 플로우**: [x] **완료.** GET/POST /api/me/mentor-request, GET/PATCH /api/arena/mentor-requests 연동. Elite 전용 신청·목록(render-only). C4 aria(section·버튼·테이블 region·에러 role=alert) 보강. 보드·CURRENT_TASK 반영.

**C1 auto (2026-03-08 8차)**: [x] 검증 실행 → **CI GATE PASSED.** 로딩/스켈레톤 1곳 보강 wrap. 다음 First Task = 문서 점검 2~3건. 보드·NEXT_PHASE_AUTO4·CURRENT_TASK 갱신.

**First Task (현재 대기)**: **문서 점검 2~3건** — 백로그 + Release Gate 2~3건 점검·갱신. C2·C3·C4 해당 없음. C1 문서 수정. NEXT_PHASE_AUTO4·보드와 동일.

**C5 Verify (2026-03-07)**: [x] **완료.** cd bty-app → lint → test → build → ./scripts/ci-gate.sh 통과. CI GATE PASSED. [UI] 엘리트 멘토 대화 신청 플로우 작업 완료·보드·CURRENT_TASK·BTY_RELEASE_GATE_CHECK 반영.

**[C3] 엘리트 멘토 대화 신청 플로우 (도메인·API)**: [x] **완료.** GET/POST /api/me/mentor-request·GET/PATCH /api/arena/mentor-requests 검증+도메인 호출만. mentorRequest 도메인·테스트 유지. 보드·CURRENT_TASK 반영.

**[VERIFY] 엘리트 4차·다음 단계 체크리스트 1회 실행 후 서류 반영**: [x] **완료.** ELITE_4TH_AND_NEXT_STEPS_SPEC §3 1회 점검. 결과 PASS. §4·보드·CURRENT_TASK 반영.

**[UI] 접근성 1건 (aria-label·포커스 1곳)**: [x] **완료.** ConsolidationBlock 완료 버튼에 type="button", aria-label={t.completeBtn} 적용. npm run lint 통과. 보드·CURRENT_TASK 반영.

**[VERIFY] Release Gate 체크리스트 1회 실행 후 서류 반영 (재실행 5차)**: [x] **완료.** 2026-03-06 bty-release-gate.mdc A~F 1회 점검. 결과 PASS. 필수 패치 0건. BTY_RELEASE_GATE_CHECK 재실행 5차·보드·CURRENT_TASK 반영.

**[VERIFY] Release Gate 체크리스트 1회 실행 후 서류 반영 (재실행 4차)**: [x] **완료.** 2026-03-06 bty-release-gate.mdc A~F 1회 점검. 결과 PASS. 필수 패치 0건. BTY_RELEASE_GATE_CHECK 재실행 4차·보드·CURRENT_TASK 반영.

**[VERIFY] Release Gate 체크리스트 1회 실행 후 서류 반영 (2026-03-06 4차)**: [x] **완료.** bty-release-gate.mdc A~F 1회 점검. 결과 PASS. 필수 패치 0건. 권장: core-xp rank/isTop5Percent 도메인 이전. BTY_RELEASE_GATE_CHECK·보드·CURRENT_TASK 반영.

**[VERIFY] Release Gate 체크리스트 1회 실행 후 서류 반영**: [x] **완료.** 2026-03-06 bty-release-gate.mdc A~F 1회 점검. 결과 PASS. 필수 패치 0건. BTY_RELEASE_GATE_CHECK 재실행 3차·보드·CURRENT_TASK 반영.

**[VERIFY] Release Gate 체크리스트 1회 실행 후 서류 반영 (재실행 2차)**: [x] **완료.** 2026-03-06 bty-release-gate.mdc A~F 재점검. 결과 PASS. 필수 패치 0건. 권장: core-xp rank/isTop5Percent 도메인 이전. BTY_RELEASE_GATE_CHECK 재실행 2차 블록·보드·CURRENT_TASK 반영.

**[UI] 로딩/스켈레톤 1곳 보강**: [x] C4 auth/reset-password 페이지(`auth/reset-password/page.client.tsx`) — 비밀번호 변경 제출 중(loading)일 때 버튼 하단에 CardSkeleton(showLabel=false, lines=1) 적용. npm run lint 통과. **완료.**

**[AUTH] 로그인·세션 문서 1줄 점검 (BTY_RELEASE_GATE_CHECK 반영)**: [x] **완료.** BTY_RELEASE_GATE_CHECK § "[AUTH] 로그인·세션 (문서 1줄)" 추가. Supabase 쿠키·getUser()·Path/SameSite/Secure/HttpOnly·로그아웃 정리. 보드·CURRENT_TASK 반영 완료.

**[VERIFY] Release Gate 체크리스트 1회 실행**: [x] **작업 완료.** bty-release-gate.mdc 기준 A~F 전 항목 1회 점검. 결과 PASS. 필수 패치 0건. BTY_RELEASE_GATE_CHECK·CURSOR_TASK_BOARD·CURRENT_TASK 반영 완료.

**[DOCS] 엘리트 3차 스펙·검증 체크리스트 1페이지 정리**: [x] **완료.** `docs/ELITE_3RD_SPEC_AND_CHECKLIST.md` 생성. §10 기준 배지 증정·멘토 대화 신청 UI 스펙 요약·검증 6항목. 보드·CURRENT_TASK 반영.

**[UI] 엘리트 멘토 대화 신청 플로우**: [x] **완료.** GET/POST /api/me/mentor-request, GET/PATCH /api/arena/mentor-requests 연동. Elite 전용 신청 폼·내 신청 상태 표시·admin /admin/mentor-requests 큐·승인/거절 UI render-only. ELITE_3RD_SPEC_AND_CHECKLIST §1 반영. 보드·CURRENT_TASK 반영.

**[DOMAIN] 단위 테스트 1개 추가 (미커버 1모듈, 비즈니스/XP 미변경)**: [x] **완료.** `src/lib/bty/mentor/drChiCharacter.test.ts` 추가(5케이스). DR_CHI_PHILOSOPHY·DR_CHI_FEW_SHOT_EXAMPLES 검증. npm test 538 통과. 보드·CURRENT_TASK 반영.

**다음 프로젝트 (추천)**: **엘리트 3차** — `docs/NEXT_PROJECT_RECOMMENDED.md` 참고.  
**First Task (현재 대기)**: **문서 점검 2~3건** 또는 **로딩/스켈레톤 1곳** — NEXT_PHASE_AUTO4·보드 대기와 동일.

**[VERIFY] 엘리트 3차 체크리스트 1회 실행**: [x] **작업 완료.** PHASE_4_ELITE_5_PERCENT_SPEC §10 3차(엘리트 배지 증정·멘토 대화 신청) 기준 검증. Elite 판정=Weekly XP만·API 도메인 호출만·UI render-only 확인. 결과 PASS. BTY_RELEASE_GATE_CHECK·CURSOR_TASK_BOARD·CURRENT_TASK 반영 완료.

**[VERIFY] Dojo·Dear Me 2차 검증 체크리스트 1회 실행**: [x] **작업 완료.** DOJO_DEAR_ME_NEXT_CONTENT §1-4·§4-7 기준 Dojo 2차(50문항·연습 플로우·진입·1단계·도메인)·Dear Me(/dear-me→center) 검증. 결과 **PASS**. BTY_RELEASE_GATE_CHECK·CURSOR_TASK_BOARD·CURRENT_TASK 서류 반영 완료.

**NEXT_PHASE_AUTO4.md와 보드 같은 대기 작업 기준 갱신**: [x] **완료.** 보드 First Task = 단위 테스트 1개 추가를 기준으로 `docs/NEXT_PHASE_AUTO4.md` §3을 C2~C5 동일 내용으로 갱신. 보드 § "Auto 4 대기 작업"을 동일 기준(단위 테스트 1개 추가 런의 C2~C5)으로 수정. 서류 반영 완료.

**[AUTH] 쿠키 Secure 시 로컬 HTTP 동작 정리·문서 1줄**: [x] **완료.** Secure 쿠키는 HTTPS에서만 저장·전송; 로컬 http://에서는 미저장 → 로그인 유지 안 됨/루프처럼 보일 수 있음. 로컬 검증 시 HTTPS(또는 localhost HTTPS/터널) 사용 권장. `docs/BTY_RELEASE_GATE_CHECK.md` § "[AUTH] login redirect loop 점검" 내 "Secure 쿠키와 로컬 HTTP" 1줄 반영. CURRENT_TASK 반영 완료.

**[VERIFY] Release Gate 체크리스트 1회 실행**: [x] **작업 완료.** bty-release-gate.mdc 기준 A~F 전 항목 1회 점검. 결과 **PASS**. BTY_RELEASE_GATE_CHECK·CURSOR_TASK_BOARD·CURRENT_TASK 서류 반영 완료.

**[AUTH] admin 세션 타임아웃·재로그인 시 리다이렉트 점검**: [x] **완료.** 미들웨어·AdminLayout·admin 로그인 페이지·AdminHeader signOut 점검. 미들웨어 경유 시 bty 로그인으로 next 전달·복귀 정상. admin 로그인 페이지는 next 미사용으로 재로그인 후 항상 /bty 이동(개선 권장). AdminHeader는 next-auth signOut 사용, Supabase와 불일치 가능(권장: 쿠키 제거 통일). 상세·권장·검증: `docs/BTY_RELEASE_GATE_CHECK.md` § "[AUTH] admin 세션 타임아웃·재로그인 시 리다이렉트 점검". 서류 반영 완료.

**C5 Verify (2026-03-06, 절차 1~5)**: [x] **작업 완료.** cd bty-app → lint → test → build → `../scripts/ci-gate.sh` 통과. CI GATE PASSED. BTY_RELEASE_GATE_CHECK·CURSOR_TASK_BOARD·CURRENT_TASK 서류 갱신 완료.

**C2 Gatekeeper 규칙 검사 (서류 반영)**: [x] 아키텍처 규칙 검사 완료. 결과 **FAIL** — 위반 2건(core-xp/route.ts rank·isTop5Percent 인라인, leaderboard/route.ts myRank 인라인). BTY_RELEASE_GATE_CHECK.md § "C2 Gatekeeper 검사 (규칙 준수 — 2026-03-06)", CURSOR_TASK_BOARD C2·Gate Report, 본 CURRENT_TASK에 반영.

**[AUTH] login redirect loop 점검**: [x] **완료.** 미들웨어·로그인·next 정제·쿠키 설정 점검. 로직 상 루프 원인 없음. 잠재 이슈: 로컬 HTTP에서 Secure 쿠키 미저장 시 루프처럼 보일 수 있음; AuthGate vs BTY 로그인 API(토큰 vs 쿠키) 불일치 가능. 상세·검증 체크리스트: `docs/BTY_RELEASE_GATE_CHECK.md` § "[AUTH] login redirect loop 점검". 서류 반영 완료.

**leaderboard status 엔드포인트 계약 점검**: [x] GET /api/arena/leaderboard 요청(scope)·응답 계약 점검. "not in top 100" 분기에서 랭크 계산을 도메인 rankFromCountAbove(totalCount, countAbove) 호출만 사용하도록 수정. npm test 526 통과. 관련 서류: BTY_RELEASE_GATE_CHECK § Cursor 2 Gatekeeper·C2 Gatekeeper 검사 갱신(leaderboard 패치 반영 완료).

**[API] leaderboard scope(role/office) 쿼리·응답 계약 점검**: [x] 쿼리 scope=role|office(parseLeaderboardScope), 응답 scope·scopeLabel·scopeUnavailable 계약을 route 상단 JSDoc에 명시. scopeLabel=role 시 roleToScopeLabel, office 시 지점명. scopeUnavailable=role|office 요청 시 풀 비어 있을 때 true. 도메인 호출만 사용. **관련 서류 갱신 완료.**

**[DOMAIN] weekly XP tie-break 규칙 보완**: [x] 이미 완료됨. `src/domain/rules/leaderboardTieBreak.ts` — 규칙 단일 소스(LEADERBOARD_TIE_BREAK_ORDER, compareWeeklyXpTieBreak). lib/bty/arena/leaderboardTieBreak가 도메인 호출만 사용. domain/rules/index에 export. 테스트 7케이스. **관련 서류 갱신 완료.**

**C5 Verify (2026-03-06)**: [x] `./scripts/ci-gate.sh` 실행. Lint ✓ Test 59/526 ✓ Build ✓. notify-done.sh 실행. **CI GATE PASSED.**

**[UI] Dojo 연습 화면 빈 상태·로딩 문구 1곳 보강**: [x] C4 역지사지(integrity) 연습 화면 — 빈 대화 시 EmptyState(icon 💬, t.emptyHint) 적용. 전송 중(sending) 시 t.thinking 문구 + CardSkeleton, aria-live="polite". render-only·i18n 기존 키 사용. npm run lint 통과. **완료.**

**[UI] 리더보드 Near Me 뷰 로딩/빈 상태 문구 점검**: [x] C4 ArenaRankingSidebar(실시간 순위) — 로딩은 LeaderboardListSkeleton 유지. 에러 시 재시도 버튼 문구 t.retry(ko/en) 사용. 빈 목록 시 EmptyState 추가(icon 📊, t.empty: "아직 순위가 없어요. 시나리오를 완료하면 여기 나타나요." / "No rankings yet. Finish a scenario to appear here."). render-only·npm run lint 통과. **완료.**

**[UI] Arena leaderboard empty state 문구 점검**: [x] C4 리더보드 페이지 LB.noData(ko) 점검·수정 — "아직 주간 XP 기록이 없어요. Arena에서 첫 시나리오를 시작해 보세요."(서브타이틀·EN과 일치). notOnBoard/notOnBoardHint/scopeUnavailable 유지. render-only·npm run lint 통과. **완료.**

**로딩/스켈레톤 1곳 (admin/users)**: [x] C4 admin/users 목록 로딩에 LoadingFallback(withSkeleton) 적용(render-only). 이미 적용됨·npm run lint 통과. **Exit 체크 완료.**

**다른 PC 이어받기**: 이 컴퓨터 작업 종료. **First Task = 접근성 1건**. ResultBlock aria-label 적용(C4) 완료. **다른 PC에서** C1으로 `docs/C1_COMMANDER_HANDOFF.md` 참고 후, "검증 돌려줘" → C1이 검증 통과 시 done+auto 수행.

**이전 런 완료**: CI PASSED — **문서 점검 2~3건** 런 C5·WRAP 완료. (검증 → done+auto)

**First Task (우선순위 자동)**: **단위 테스트 1개 추가** — 미커버 1모듈 단위 테스트 추가. C2·C4 해당 없음. C3 구현·npm test·C5 검증 통과. *(직전=문서 점검과 다른 유형, 우선순위 3 Domain/테스트.)*

**홈/랜딩 페이지 레이아웃·형태 변경 (이전 런)**: [x] C4 LandingClient 레이아웃·비주얼·UX 적용. C5 검증(orchestrate) 통과. **WRAP·CI PASSED.**

**로딩/스켈레톤 1곳 (이번 런)**: [x] C4 AvatarSettingsClient 저장 중(saving) CardSkeleton 적용. C5 검증(orchestrate) 통과. **WRAP·CI PASSED.** (done+auto 완료.)

**단위 테스트 1개 추가 (이번 런)**: [x] C3 미커버 1모듈 `src/lib/bty/quality.test.ts` 추가(8케이스). severityForReason·issueForReason·recordQualityEventApp. npm test 495 통과(54파일). **Exit 체크 완료.**

**단위 테스트 1개 추가 (이전 런)**: [x] C3 미커버 1모듈 `src/lib/bty/mentor/mentorFewshotRouter.test.ts` 추가(8케이스). npm test 487 통과. **Exit 체크 완료.**

**단위 테스트 1개 추가 (이전 런)**: [x] C3 미커버 1모듈 `src/lib/bty/systemMessages.test.ts` 추가(5케이스). npm test 479 통과. **Exit 체크 완료.**

**단위 테스트 1개 추가 (이전 런)**: [x] C3 미커버 1모듈 `src/lib/safeParse.test.ts` 추가(6케이스). npm test 424 통과. **Exit 체크 완료.**

**문서 점검 2~3건 (이번 런)**: [x] C1 문서 점검·갱신. C5 검증(orchestrate) 통과. **WRAP·CI PASSED.** (done+auto 완료.) *(이번 검증으로 wrap.)*

**core-xp·sub-name 도메인 이전 (이번 런)**: [x] C3 도메인 `rankFromCountAbove`·`weeklyRankFromCounts` 추가, core-xp·sub-name route 도메인 호출만. npm test 365 통과. C5 lint/test/build 대기.

**로딩/스켈레톤 2곳 적용 (이번 런)**: [x] **AvatarSettingsClient** (`profile/avatar/AvatarSettingsClient.tsx`) — 로딩 시 텍스트만 → `LoadingFallback`(icon + message + withSkeleton) + locale별 `getMessages(locale).loading.message` 사용. [x] **SecondAwakeningPageClient** (`healing/awakening/page.client.tsx`) — 로딩/!data 시 문단만 → `LoadingFallback`(icon + message + withSkeleton) + locale별 loading.message. [x] npm run lint(tsc --noEmit) 통과. **Exit 체크 완료.**

**C2 Gatekeeper Exit**: [x] .cursor/rules·BTY_RELEASE_GATE_CHECK.md 대조 완료. **문서 점검 2~3건 런**: § 문서 점검 2~3건 변경분 Gate — 문서만 변경(코드 없음) → 해당 없음 **PASS**·Exit 체크 완료·C5 실행 가능 표시 반영. **단위 테스트 1개 추가 런**: § 단위 테스트 1개 추가 변경분 Gate — 테스트만 추가(비즈니스/XP 로직 미변경) → 해당 없음 **PASS**·Exit 체크 완료·검증 가능 표시 반영. **접근성 1건 런**: § 접근성 1건 변경분 Gate — UI만 변경 → 해당 없음 **PASS**·Exit 체크 완료·C5 실행 가능 표시 반영. **로딩/스켈레톤 1곳 런**: § 로딩/스켈레톤 1곳 변경분 Gate — UI만 변경 → 해당 없음 **PASS**·Exit 체크 완료. **Cursor 2 Gatekeeper 검사**: Arena locale 변경분 **PASS**; 기존 위반 2건(core-xp·sub-name API 내 랭크/상위5% 계산) → Required patches § "Cursor 2 Gatekeeper 검사" 반영. core-xp API·§1·§8 Gate 반영. **Arena 한국어 §4.1 변경분 Gate** 대조 완료: Auth/XP/리더보드/마이그레이션 미접촉 → **PASS** (해당 없음). **Dojo 2차 변경분 Gate**: CURSOR_TASK_BOARD C2 체크리스트 대조, § Dojo 2차 변경분 Gate 섹션 추가·반영. 범위: DOJO_DEAR_ME_NEXT_CONTENT §1-4·§6·§4·§5, Auth/쿠키/경로 미접촉. Assumptions·Gate 결과 PASS·위반 없음·Findings(A·Auth·F 해당 시 PASS)·Required patches 없음·Next steps 기록. C2 Exit 조건 충족, Exit 체크 완료.

**접근성 1건 적용 (이번 런)**: [x] **ResultBlock** (`components/bty-arena/ResultBlock.tsx`) — Next 버튼에 `type="button"`, `aria-label={t.reflectionNext}` 적용. [x] npm run lint 통과. **Exit 체크 완료.**

**로딩/스켈레톤 1곳 (이번 런)**: [x] C4 대시보드 Leadership Engine 카드 — leState/leAir/leTii/leCertified 모두 null일 때 텍스트 "Loading…" 대신 `CardSkeleton`(showLabel=false, lines=3) 적용. npm run lint 통과. **Exit 체크 완료.**

**로딩/스켈레톤 1곳 (C4 추가)**: [x] C4 멘토 페이지(`mentor/page.client.tsx`) — `prefsLoaded` false일 때 본문 영역에 `LoadingFallback`(icon + message + withSkeleton, locale별 "불러오는 중…"/"Loading…") 적용. npm run lint 통과. **Exit 체크 완료.**

**로딩/스켈레톤 1곳 (C4 이번 런)**: [x] C4 비밀번호 찾기 페이지(`bty/(public)/forgot-password/page.tsx`) — 전송 중(loading)일 때 폼 하단에 `CardSkeleton`(showLabel=false, lines=1) 플레이스홀더 적용. npm run lint 통과. **Exit 체크 완료.**

**로딩/스켈레톤 1곳 (C4 이번 런)**: [x] C4 로그인 페이지(`bty/(public)/login/LoginClient.tsx`) — 제출 중(isLoading)일 때 폼 하단에 `CardSkeleton`(showLabel=false, lines=1) 플레이스홀더 적용. npm run lint 통과. **Exit 체크 완료.**

**로딩/스켈레톤 1곳 (C4 이번 런)**: [x] C4 Elite 페이지(`elite/page.client.tsx`) — 멘토 신청 제출 중(submitLoading)일 때 버튼 하단에 `CardSkeleton`(showLabel=false, lines=1) 플레이스홀더 적용. npm run lint 통과. **Exit 체크 완료.**

**로딩/스켈레톤 1곳 (C4 이번 런)**: [x] C4 역지사지(integrity) 페이지(`integrity/page.client.tsx`) — Dr. Chi 응답 대기 중(sending)일 때 기존 텍스트 말풍선을 `CardSkeleton`(showLabel=false, lines=1)로 교체. npm run lint 통과. **Exit 체크 완료.**

**로딩/스켈레톤 1곳 (C4 이번 런)**: [x] C4 멘토 페이지(`mentor/page.client.tsx`) — Dr. Chi 응답 대기 중(sending)일 때 기존 "생각하고 있어요…" 말풍선을 `CardSkeleton`(showLabel=false, lines=1)로 교체. npm run lint 통과. **Exit 체크 완료.**

**로딩/스켈레톤 1곳 (C4 이번 런)**: [x] C4 healing/awakening 페이지(`healing/awakening/page.client.tsx`) — Enter Next Phase 처리 중(submitting)일 때 버튼 하단에 `CardSkeleton`(showLabel=false, lines=1) 플레이스홀더 적용. npm run lint 통과. **Exit 체크 완료.**

**로딩/스켈레톤 1곳 (C4 이번 런)**: [x] C4 대시보드(`dashboard/page.client.tsx`) — Arena Membership 제출 중(membershipSubmitting)일 때 버튼 하단에 `CardSkeleton`(showLabel=false, lines=1) 플레이스홀더 적용. npm run lint 통과. **Exit 체크 완료.**

**로딩/스켈레톤 1곳 (C4 이번 런)**: [x] C4 test-avatar 페이지(`test-avatar/page.tsx`) — PATCH profile 요청 중(patching)일 때 저장 버튼 하단에 `CardSkeleton`(showLabel=false, lines=1) 플레이스홀더 적용. npm run lint 통과. **Exit 체크 완료.**

**로딩/스켈레톤 1곳 (C4 이번 런)**: [x] C4 대시보드(`dashboard/page.client.tsx`) — Code Name·Sub Name 저장 중(subNameSaving)일 때 Save 버튼 하단에 `CardSkeleton`(showLabel=false, lines=1) 플레이스홀더 적용. npm run lint 통과. **Exit 체크 완료.**

**로딩/스켈레톤 1곳 (C4 이번 런)**: [x] C4 프로필 페이지(`profile/ProfileClient.tsx`) — 프로필 저장 중(saving)일 때 Save 버튼 하단에 `CardSkeleton`(showLabel=false, lines=1) 플레이스홀더 적용. npm run lint 통과. **Exit 체크 완료.**

**로딩/스켈레톤 1곳 (C4 이번 런)**: [x] C4 AvatarSettingsClient(`profile/avatar/AvatarSettingsClient.tsx`) — 아바타 설정 저장 중(saving)일 때 Save 버튼 하단에 `CardSkeleton`(showLabel=false, lines=1) 플레이스홀더 적용. npm run lint 통과. **Exit 체크 완료.**

**C2 Gatekeeper (2026-03-05)**: 규칙 준수 검사 완료. **Release Gate: FAIL.** E) API 위반 2건 — core-xp/route.ts·sub-name/route.ts handler 내 rank/isTop5Percent 계산 → 도메인 이전 요구. 상세·Required patches: `docs/BTY_RELEASE_GATE_CHECK.md` § "Cursor 2 Gatekeeper 검사 (변경분 규칙 준수 — 2026-03-05)".

**First Task (우선순위 자동)**: **단위 테스트 1개 추가** — 미커버 1모듈 단위 테스트 추가. C2·C4 해당 없음. C3 구현·npm test·C5 검증 통과. *(근거 1: Auth/API 범위 없음 → 우선순위 3. 근거 2: 테스트만 추가, 비즈니스/XP 미변경.)*

- **BTY_ARENA_SYSTEM_SPEC §4: 리더보드 scope=role|office 도메인/API**: [x] `src/lib/bty/arena/leaderboardScope.ts` 추가 — `parseLeaderboardScope`, `roleToScopeLabel`, `LEADERBOARD_EXPOSED_FIELDS`. API는 도메인 호출만 사용(scope 파라미터·scopeLabel). weekly_xp·nearMe 규칙 유지. [x] npm test 195통과 Exit 0.

**DoD**: [x] lint 통과 [x] test 통과 (150) [x] build 통과 [ ] (옵션) workers verify [ ] C5 실행 커맨드 실행.  
**First Task 체크**: [x] 이번 First Task에 Domain/API 변경 없음 → N/A(해당 없음) 명시. [x] (변경한 경우에만) npm test 통과 → 미변경 시 해당 없음, 기존 150통과 확인.

- **C3 (Domain/API) Exit**: C1 선정 항목 확인 → CURSOR_TASK_BOARD "이번 런" 기준 **선정 항목 없음**(C1 Exit [ ], 목표 1줄 미확정). Domain/API 해당 여부 판단 불가 → **해당 없음 Exit**. (C1이 목표 1줄 확정 후 해당 항목에 Domain/API 있으면 별도 구현·npm test.)
- **C3 (단위 테스트 1개 추가 런) Exit**: 미커버 1모듈 — `src/lib/bty/mentor/mentor_fewshot_router.test.ts` 추가. detectBundleEN·buildMentorMessagesEN·debugRouteEN 8케이스. **npm test 51파일 474통과. Exit 체크 완료.**
- **C3 (단위 테스트 1개 추가 런, buildChatMessages) Exit**: 미커버 1모듈 — `src/lib/bty/chat/buildChatMessages.test.ts` 추가. normalizeMode·getFallbackMessage 9케이스. **npm test 50파일 466통과. Exit 체크 완료.**
- **C3 (단위 테스트 1개 추가 런, arena/engine) Exit**: 미커버 1모듈 — `src/lib/bty/arena/engine.test.ts` 추가. computeXp·pickSystemMessageId·evaluateChoice·evaluateFollowUp·INTEGRITY_BONUS_XP 12케이스. **npm test 49파일 457통과. Exit 체크 완료.**
- **C3 (단위 테스트 1개 추가 런, coreStats) Exit**: 미커버 1모듈 — `src/lib/bty/emotional-stats/coreStats.test.ts` 추가. EVENT_IDS·CORE_STAT_IDS·getQualityWeight·getSessionMaxPossibleWeight·EVENTS·STAT_DISTRIBUTION 9케이스. **npm test 48파일 445통과. Exit 체크 완료.**
- **C3 (단위 테스트 1개 추가 런, beginnerScenarios) Exit**: 미커버 1모듈 — `src/lib/bty/scenario/beginnerScenarios.test.ts` 추가. getBeginnerScenarioById·pickRandomBeginnerScenario 5케이스. **npm test 47파일 436통과. Exit 체크 완료.**
- **C3 (단위 테스트 1개 추가 런, scenario/engine) Exit**: 미커버 1모듈 — `src/lib/bty/scenario/engine.test.ts` 추가. getContextForUser(메타 문구 제거)·getScenarioById 7케이스. **npm test 46파일 431통과. Exit 체크 완료.**
- **C3 (단위 테스트 1개 추가 런, beginnerTypes) Exit**: 미커버 1모듈 — `src/lib/bty/scenario/beginnerTypes.test.ts` 추가. MATURITY_BANDS·BEGINNER_SCORING·computeBeginnerMaturityScore·getMaturityFeedback 9케이스. **npm test 44파일 418통과. Exit 체크 완료.**
- **C3 (단위 테스트 1개 추가 런, reflection-engine) Exit**: 미커버 1모듈 — `src/lib/bty/arena/reflection-engine.test.ts` 추가. detectPatterns(빈/무관 텍스트·defensive·blame·rushed·control·topTag·null) 8케이스. **npm test 43파일 409통과. Exit 체크 완료.**
- **C3 (단위 테스트 1개 추가 런, detectEvent) Exit**: 미커버 1모듈 — `src/lib/bty/emotional-stats/detectEvent.test.ts` 추가. detectEmotionalEventFromText(빈/비문자열·KO/EN 패턴·미매칭·우선순위) 9케이스. **npm test 42파일 401통과. Exit 체크 완료.**
- **C3 (단위 테스트 1개 추가 런, emotional-stats/unlock) Exit**: 미커버 1모듈 — `src/lib/bty/emotional-stats/unlock.test.ts` 추가. checkAdvancedUnlock(PRM·SAG·CNS·CD), getUnlockedAdvancedStats 7케이스. **npm test 41파일 392통과. Exit 체크 완료.**
- **C3 (단위 테스트 1개 추가 런, antiExploit) Exit**: 미커버 유틸 1모듈 — `src/lib/bty/emotional-stats/antiExploit.test.ts` 추가. shouldApplyReward(빈 세션·rapid penalty·duplicate pattern·통과), computeNovelty·computeConsistency 14케이스. **npm test 40파일 385통과. Exit 체크 완료.**
- **C3 (단위 테스트 1개 추가 런, unlock) Exit**: 미커버 도메인 1모듈 — `src/lib/bty/arena/unlock.test.ts` 추가. buildTenurePolicyConfig(기본값·new_joiner_rule days), getUnlockedContentWindow(staff S1/preview S2, leader l4Granted→L4, jobFunction doctor→S3·senior_doctor→L1) 6케이스. **npm test 39파일 371통과. Exit 체크 완료.**
- **C3 (core-xp·sub-name 랭크/상위5% 도메인 이전) Exit**: 도메인 `src/domain/rules/leaderboard.ts`에 `rankFromCountAbove`, `weeklyRankFromCounts` 추가. core-xp·sub-name route는 DB count 조회 후 도메인 호출만 사용. totalCount/rank/isTop5Percent 응답(core-xp) 및 403 판단(sub-name)에 도메인 결과만 반영. **npm test 38파일 365통과. Exit 체크 완료.**
- **C3 (§10 런) Exit**: C1 목표 = PROJECT_BACKLOG §10 점검·갱신. §10 미완료 1건이 목표 1줄로 확정되어 있지 않음. 점검·문서만 해당 → **해당 없음 Exit**.
- **PHASE_4 §10·PROJECT_BACKLOG §4·§5: 엘리트 배지 증정 1건**: [x] 도메인 `src/lib/bty/arena/eliteBadge.ts` — `getEliteBadgeGrants(isEliteWeekly)`, `EliteBadgeGrant`, `weekly_elite` 배지. API `GET /api/me/elite` 확장 — `{ isElite, badges }` 반환. 비즈니스 규칙 도메인만. eliteBadge.test.ts 3케이스. npm test 198 통과. **Exit 체크 완료.**
- **PHASE_4 §10 3차·PROJECT_BACKLOG §5: Elite 멘토 1:1 대화 신청·큐·승인**: [x] 도메인 `src/lib/bty/arena/mentorRequest.ts` — `canRequestMentorSession`, `validateMentorRequestPayload`, `canTransitionStatus`. 마이그레이션 `elite_mentor_requests` 테이블. API: GET/POST `/api/me/mentor-request` (내 신청 조회/생성), GET `/api/arena/mentor-requests` (admin 큐), PATCH `/api/arena/mentor-requests/[id]` (승인/거절). 비즈니스 규칙 도메인만. mentorRequest.test.ts·route.test.ts. npm test 222 통과. **Exit 체크 완료.**
- **C3 (빈 상태 보강 런) Exit**: 빈 상태 보강은 UI만 해당 → Domain/API 해당 없음. **해당 없음 Exit.**
- **C3 (빈 상태 보강 2곳째 런) Exit**: 빈 상태 보강은 UI만 해당 → Domain/API 해당 없음. **해당 없음 Exit.**
- **C3 (Phase 4 체크리스트 런) Exit**: §2-1 검증만 해당 → Domain/API 해당 없음. **해당 없음 Exit.** (선정 항목이 수정·구현 해당 시에는 해당 시 구현·npm test 통과 후 Exit.)
- **C3 (§2-2 엘리트 5% 검증 런) Exit**: §2-2 검증만 해당 → Domain/API 해당 없음. **해당 없음 Exit.** (수정 시 Elite 판정/API 점검·npm test 후 Exit.)
- **C3 (§7 서클 모임 1차 런) Exit**: PHASE_4_ELITE_5_PERCENT_SPEC §7 서클 모임은 아이디어 표 한 줄뿐, 일정/참여 API 상세 없음. 1차는 Elite 페이지 카드·플레이스홀더만 → **플레이스홀더만 해당. 해당 없음 Exit.** (일정/참여 API 해당 시 구현·도메인 호출만·npm test 후 Exit.)
- **C3 (Arena 시나리오 완료 시점 런) Exit**: Arena 시나리오 완료는 기존 submit/reflect API·run/complete 플로우 활용(bty-arena/page.tsx → POST /api/arena/reflect, POST /api/arena/run/complete). 도메인·랭킹 규칙 변경 없음. **해당 없음 Exit.** npm test 통과.
- **C3 (대시보드 버튼 런) Exit**: 대시보드 버튼은 신규 API 없음 → 기존 API·라우트만 활용. **해당 없음 Exit.** 기존 API 호출만 사용. npm test 통과.
- **C3 (빈 상태 보강 3곳째 런) Exit**: 빈 상태 보강은 UI만 해당 → Domain/API 해당 없음. **해당 없음 Exit.** npm test 통과.
- **C3 (챗봇 재시도·에러 UI 런) Exit**: 챗봇 재시도·에러 UI는 클라이언트(Chatbot)만 해당 → Domain/API 해당 없음. **해당 없음 Exit.** npm test 통과.
- **C3 (i18n 보강 런) Exit**: i18n 보강은 Domain/API 해당 없음. **해당 없음 Exit.** npm test 통과.
- **C3 (접근성 aria/포커스 런) Exit**: 접근성(aria/포커스)은 Domain/API 해당 없음. **해당 없음 Exit.** npm test 통과.
- **C3 (접근성 1건 런) Exit**: C1 목표 = 접근성 1건 → Domain/API 해당 없음. **해당 없음 Exit.** npm test 통과.
- **C3 (로딩/스켈레톤 보강 런) Exit**: 로딩/스켈레톤 보강은 Domain/API 해당 없음. **해당 없음 Exit.** npm test 통과.
- **C3 (단위 테스트 1개 추가 런) Exit**: `weeklyQuest.ts` 미커버 → `weeklyQuest.test.ts` 추가. getWeekStartUTC(월/일/수·일요일 엣지), 상수 검증. **npm test 242 통과 후 Exit.**
- **C3 (문서 점검 런) Exit**: 문서 점검은 Domain/API 해당 없음. **해당 없음 Exit.** npm test 통과.
- **C3 (문서 점검 2~3건 런) Exit**: C1 목표 = 문서 점검 2~3건 → Domain/API 해당 없음. **해당 없음 Exit.** npm test 통과.
- **C3 (단위 테스트 2개 추가 런) Exit**: 미커버 도메인 2모듈 — `domain/rules/xp.test.ts`(seasonalToCoreConversion), `domain/rules/leaderboard.test.ts`(rankByWeeklyXpOnly·eliteCutoffRank·isElite). **npm test 252 통과 후 Exit.**
- **C3 (단위 테스트 1모듈 추가 런) Exit**: 미커버 도메인 1모듈 — `src/domain/rules/season.test.ts` 추가. `isDateWithinSeason`, `carryoverWeeklyXp` 4케이스. **npm test 256 통과 후 Exit 체크 완료.**
- **C3 (단위 테스트 1모듈 추가 런) Exit**: 미커버 도메인 1모듈 — `src/domain/rules/level-tier.test.ts` 추가. `tierFromCoreXp`, `codeIndexFromTier`, `subTierGroupFromTier`, `resolveSubName`, `codeNameFromIndex`, `stageFromCoreXp` 8케이스. **npm test 264 통과 후 Exit 체크 완료.**
- **C3 (i18n·접근성 런) Exit**: i18n·접근성은 Domain/API 해당 없음. **해당 없음 Exit.** npm test 통과.
- **C3 (로딩/스켈레톤 런) Exit**: 로딩/스켈레톤은 Domain/API 해당 없음. **해당 없음 Exit.** npm test 통과.
- **C3 (로딩/스켈레톤 2곳 런) Exit**: C1 목표 = 로딩/스켈레톤 2곳 → Domain/API 해당 없음. **해당 없음 Exit.** npm test 통과.
- **C3 (단위 테스트 1모듈 추가 런) Exit**: 미커버 도메인 1모듈 — `src/domain/rules/stage.test.ts` 추가. `codeIndexFromTier`, `subTierGroupFromTier`, `stageNumberFromCoreXp`, `codeNameFromIndex`, `defaultSubName`, `resolveSubName`, `stageStateFromCoreXp` 11케이스. **npm test 32파일 275통과 후 Exit 체크 완료.**
- **C3 (문서 점검 2~3건 런) Exit**: C1 목표 = 문서 점검 2~3건 → Domain/API 해당 없음. **해당 없음 Exit.** npm test 통과 (32파일 275).
- **C3 (단위 테스트 1모듈 추가 런) Exit**: 미커버 도메인 1모듈 — `src/domain/constants.test.ts` 추가. CODE_NAMES·SUB_NAMES·XP/Tier·League·Leaderboard 상수 검증 14케이스. **npm test 33파일 289통과 후 Exit 체크 완료.**
- **C3 (단위 테스트 1모듈 추가 런) Exit**: 미커버 유틸 1모듈 — `src/lib/bty/arena/domain.test.ts` 추가. awardXp·calculateLevel·calculateTier·calculateLevelTierProgress·seasonReset·leaderboardSort 8케이스. **npm test 34파일 297통과 후 Exit 체크 완료.**
- **C4 (UI) Exit**: C1 선정 항목 확인 → 동일 기준 **선정 항목 없음**(목표 1줄 미확정). UI 해당 여부 판단 불가 → **해당 없음 Exit**. (lint 사전 확인: npm run lint Exit 0.)
- **C4 (문서 점검 2~3건 런) Exit**: C1 목표 = 문서 점검 2~3건 → UI 해당 없음. **해당 없음 Exit.** npm run lint 통과.
- **C4 (단위 테스트 1모듈 런) Exit**: C1 목표 = 단위 테스트 1모듈 → UI 해당 없음. **해당 없음 Exit.** npm run lint 통과.
- **C4 (엘리트 5% 1차 표시 UI render-only)**: [x] 대시보드 Elite 카드·`elite/page.client.tsx`·멘토 Elite 멘토 배지에 render-only 주석 추가. isElite는 GET /api/me/elite만 사용, XP/랭킹 계산 없음. [x] npm run lint Exit 0.

**Arena 한국어 locale 분기 (이번 런)**: [x] 시나리오·안내·대답 locale 분기(API·도메인). `ScenarioSubmitPayload.locale` optional 추가, `computeResult(payload)`가 locale=ko 시 resultKo/microInsightKo/followUp.*Ko 반환. ko 콘텐츠 경로/포맷 `docs/LOCALE_SCENARIO_GUIDE_RESPONSE.md`에 반영. getContextForUser 주석 보강(contextKo는 그대로 사용). [x] npm test 14파일 150통과. Exit 체크 완료.

- **Arena 한국어: locale=ko 시 한국어만 표시 (이번 런)**: [x] i18n `arenaRun` 추가(ko/en). Arena 페이지·컴포넌트가 `getMessages(locale).arenaRun`만 사용하도록 수정(render-only, locale 전달). ArenaHeader, ScenarioIntro, PrimaryActions, ChoiceList, OutputPanel, ReflectionBlock, ResultBlock, ConsolidationBlock, CompleteBlock에서 인라인 한/영 분기 제거 → i18n 키 사용. [x] tsc --noEmit 통과. **Exit 체크**: 완료.

*(커맨더가 여기에 요구사항을 적거나, 채팅으로 "CURRENT_TASK.md 참고해서 구현해줘" + 기능 설명을 보냅니다.)*

**우선 진행 (Center 페이지)**  
- **`docs/CENTER_PAGE_IMPROVEMENT_SPEC.md`** §9 순서대로: CTA 통합·재로그인 버그 → 챗으로 이어하기 → 5문항 순서 → EN/KO 플로우·로딩 → 회복 탄력성 그래프 → 50문항 정성 → 아늑한 방 톤.  
- 전체 분류·다음 리스트: **`docs/COMMANDER_BACKLOG_AND_NEXT.md`**.  
- 백로그 §10: **`docs/PROJECT_BACKLOG.md`** §10.

**이번 지시 (택일 진행)**  
- **옵션 A — 감정 스탯 v3 확장**: `docs/HEALING_COACHING_SPEC_V3.md`·`docs/specs/healing-coaching-spec-v3.json` 기준으로 coreStats에 v3 이벤트 14종·stat_distribution·헬퍼 추가 후, 30일 가속·phase_tuning을 formula와 recordEmotionalEventServer에 반영.  
- **옵션 B — Dojo 2차 확장 (WHAT_NEXT §2-2)**: `docs/DOJO_DEAR_ME_NEXT_CONTENT.md` §1-4·§6·§4·§5 기준으로 50문항 목차·연습 플로우 2~5단계 스펙 정리 및 추가 구현. PROJECT_BACKLOG §7은 [x]; 2차 확장은 위 스펙으로 진행.

*진행 에이전트는 위 A/B 중 지시된 쪽을 우선 진행. 지시가 없으면 CURRENT_TASK 또는 WHAT_NEXT §2-2 표의 복사용 프롬프트를 참고.*

**§2 챗봇 플로팅 /center 비노출 완료**: COMMANDER_BACKLOG §2. `src/app/[locale]/center/page.tsx`에서 Chatbot import 및 `<Chatbot />` 제거. /center 플로팅 챗 미노출. bty는 layout에서만 Chatbot. lint Exit 0. **C5·WRAP**: 사용자 터미널 verify 완료 → wrap-ci PASSED 반영.

**이전 완료**: 챗봇 훈련 (PROJECT_BACKLOG §9) — ✅ 완료

- **BTY_ARENA_SYSTEM_SPEC §4: 리더보드 팀(역할/지점) 뷰 전환**: 리더보드 페이지에 Overall | Role | Office 탭 UI 있음. scope 쿼리로 API 호출, scopeLabel·scopeUnavailable·행 데이터는 API 응답만 표시(render-only). 주석 보강. [x] npm run lint Exit 0.

- **COMMANDER_BACKLOG §5: 대시보드 코드네임 툴팁**: Code Name 표시 영역 마우스 오버 시 단계·수준 설명 팝오버. BTY_ARENA_SYSTEM_SPEC §1·§5, ARENA_CODENAME_AVATAR_PLAN §2 규칙 요약. aria-describedby·id 연동. [x] npm run lint Exit 0.

- **AVATAR_LAYER_SPEC §6·§7: AvatarComposite 레이어 합성·옷 입힌 캐릭터 UI (render-only)**: AvatarComposite 주석에 render-only 명시(API/도메인 URL만 표시). 대시보드: core.currentOutfit.accessoryIds → getAccessoryImageUrl(도메인) → avatarAccessoryUrls로 두 곳 AvatarComposite에 전달. OutfitCard render-only 주석. [x] npm run lint Exit 0.

- **COMMANDER_BACKLOG §2: 전역 플로팅 챗봇 /center 비노출**: Center 페이지에서 Chatbot 마운트 제거. `src/app/[locale]/center/page.tsx`에서 `<Chatbot />` 및 import 제거. /center 접속 시 플로팅 챗 패널 미노출. 챗은 Foundry(bty) 레이아웃에서만 노출. [x] npm run lint Exit 0. COMMANDER_BACKLOG_AND_NEXT §2·CURRENT_TASK 반영.

- **CENTER_PAGE_IMPROVEMENT_SPEC §9 점검 (Center 페이지·컴포넌트 완료 상태 + render-only 보완)**: §9 순서(§5→§6→§3→§2→§4→§7→§1·§8) 기준 점검 완료. **§5** 단일 CTA `t.ctaToFoundry`, `href=/${locale}/bty` 적용. **§6** 챗으로 이어하기 `open-chatbot` dispatch. **§3** 5문항 → 안내+50문항 링크 → 50문항 카드 → SafeMirror → SmallWins → ResilienceGraph → EmotionalBridge. **§2** EN/KO 질문 먼저·로딩 i18n. **§4** ResilienceGraph GET /api/center/resilience만 사용(render-only). **§7** Assessment 한 문항씩. **§1·§8** dear 톤·영어 일관. **보완**: PageClient KO 뷰(step5·메인)에서 `ResilienceGraph`에 `locale={locale}` 누락 수정(§8 일관). [x] npm run lint Exit 0. **서류**: CURRENT_TASK·CURSOR_TASK_BOARD 반영.

- **Dojo 2차 UI: 진입·연습 플로우 2~5단계 (render-only)**: 역지사지(integrity) 페이지에서 Dr. Chi 피드백을 **API 응답만** 표시. `POST /api/mentor` 호출(message, messages, lang, topic: "patient"), 응답 `message` 필드만 표시. 하드코딩 `t.reply` 제거. i18n `integrity.apiError`(네트워크 오류), `integrity.replyFallback`(API 빈 응답 시). 단계: guide(2) → scenario(3·4) → done(5) 유지. [x] npm run lint Exit 0. **서류**: CURRENT_TASK·CURSOR_TASK_BOARD 반영. **완료.** Next steps: 로컬 `/bty/integrity` 접속 후 안내→시나리오 입력→전송 시 Dr. Chi 답변이 `/api/mentor` 응답으로만 나오는지 확인. (선택) topic: "patient" 또는 Dojo 전용 엔드포인트 확장.

- **감정 스탯 v3 표시 UI (render-only)**: 적용 완료. display API만 사용(render-only). 대시보드·bty·멘토 연동. [x] npm run lint Exit 0. **서류**: CURRENT_TASK·CURSOR_TASK_BOARD 반영 완료.

- **§2 EN/KO 진입 플로우·로딩 문구 (CENTER_PAGE_IMPROVEMENT_SPEC)**: 영어도 한국어와 동일하게 "질문 먼저(intro+Start) → 답 → Center 메인". 전환 중 로딩은 locale별: center/page.tsx Suspense·AuthGate에 t.loading, [locale]/loading.tsx는 LocaleAwareRouteLoading. [x] npm run lint Exit 0.

- **§3 Center 본문 블록 순서 (CENTER_PAGE_IMPROVEMENT_SPEC)**: 5문항(자존감 알아보기) 맨 위 → "더 자세한 테스트를 원하시면 클릭하세요" + 50문항 링크 → 50문항 링크 카드. PageClient 4곳(EN step5, EN 메인, KO step5, KO 메인) 이미 동일 순서. render-only. [x] npm run lint Exit 0.

- **§4 ResilienceGraph 일별/기간별 트렉 (도메인·API·UI)**: **데이터 소스**: GET /api/center/resilience만 사용. `{ entries: ResilienceDayEntry[] }` (date, level, source) 계약. **제거**: getSelfEsteemHistory()·localStorage 병합 전부 제거. UI에서 level/날짜 계산·추가 병합 없음. **타입**: ResilienceGraphApiResponse, ResilienceDayEntry·ResilienceDailyLevel은 API 라우트·도메인만. **도메인**: `src/domain/center/resilience.ts` — energyToLevel, aggregateLetterRowsToDailyEntries(periodDays). **API**: route는 도메인만 호출, `?period=7|30` (1–365). **UI**: 로딩 시 t.subtitle, 빈 배열 동일 문구, 데이터 시 t.dailyTrajectorySubtitle. fetch 취소 처리. **검증**: [x] npm run lint Exit 0 [x] npm test 13파일 140통과. [x] 로컬 Center 접속 시 회복 탄력성 그래프 일별 트렉 표시 확인. **공동 문서**: CURSOR_TASK_BOARD·CURRENT_TASK 반영 완료.

- **Center CTA 통일 + CENTER_PAGE_IMPROVEMENT_SPEC (render-only)**: Center/Foundry CTA 링크를 \`/${locale}/bty\`로 통일 (PageClient 푸터, Nav, Chatbot, integrity, mentor, auth/callback). §5 단일 CTA·§6 챗으로 이어하기·§3 5문항 순서·§2 로딩 i18n·§1·§8 톤/영어 일관 반영. **검증**: [x] CTA href=\`/${locale}/bty\` [x] npm run lint 통과 (Exit 0). §4 별도 완료.

- **§1·§8 Center 톤·비주얼(아늑한 방) + locale=en 전부 영어**: [x] i18n center tagline/entryIntro/heroTitleMain·Accent (ko: 아늑한 방·치유, en: cozy room to rest and heal). EN 헤더에 hero 타이틀. resilience.dailyTrajectorySubtitle·selfEsteem·safeMirror·smallWins en 완비. 컴포넌트 locale 전달·fallback 영어. **이번 First Task(§1·§8)**: [x] Domain/API 변경 없음 → 해당 없음 (N/A). [x] (변경한 경우에만) npm test 통과 → Domain/API 미변경이므로 해당 없음. 기존 스위트 실행 시 14파일 150통과 확인. **Exit**: CENTER_PAGE_IMPROVEMENT_SPEC §1·§8 반영·완료 이력 갱신.
- **§1·§8 Center dear 테마·카피 적용 + EN 경로 한글 미노출 (이번 런)**: [x] EN Center 경로 전 구간 **dear** 테마 적용(ThemeBody theme="dear", text-dear-*·border-dear-sage 등). KO와 동일 톤(아늑한 방). EN 경로 문구는 `t`(getMessages(lang).center)만 사용·한글 미노출. Nav entry 화면 `locale={locale}` 사용. SelfEsteemTest/SafeMirror/SmallWinsStack/ResilienceGraph/EmotionalBridge에 theme="dear"·locale 전달. render-only. [x] npm run lint 통과. **Exit 체크**: 완료.

- **Cursor 4 UI Worker (bty-ui-render-only)**: [x] 대시보드가 core-xp display 필드만 사용(API 확장 반영). UI에서 tier/코드 계산 없음. [x] **리더보드·사이드바 render-only 보강**: LeaderboardRow — API 값만 표시, XP는 toLocaleString 포맷만(계산 없음), locale prop·list/listitem·aria-label. ArenaRankingSidebar — 에러 시 재시도 버튼·aria-label·role=alert. 리더보드 페이지 — rows key=`rank-codeName`(타이 구분), role=list. **UI 계산 로직 0건** 확인.

- **할 일**: `docs/ROADMAP_NEXT_STEPS.md` § 챗봇 훈련 시기, `docs/CHATBOT_TRAINING_CHECKLIST.md` 참고해서 시스템 프롬프트 보강(역할·말투·금지), 구역별(bty / today-me) 예시 대화, 메타 질문 답변 가이드. 필요 시 RAG. `src/app/api/chat/route.ts`, `src/components/Chatbot.tsx` 수정. CHATBOT_TRAINING_CHECKLIST §3 [ ] 항목 정리·반영.
- **반영 요약**: `src/lib/bty/chat/buildChatMessages.ts`(NVC·치유 스펙, 메타/인사/BTY·Dear Me 소개, few-shot), `chatGuards.ts`(isMetaQuestion, getMetaReply), `route.ts`(메타 질문 시 고정 답변), `Chatbot.tsx`(소개·공간 안내 i18n), `i18n.ts`(chat.introDojo/introDearMe/spaceHintDojo/spaceHintDearMe). §3 항목 전부 [x].
- **구현 테스트 검증**: ✅ **PASS** — Cursor 2에서 Lint 통과, Vitest 10/10 통과. next/headers·supabaseServer 목 추가로 테스트 환경 이슈 해결. 상세는 `docs/NEXT_STEPS_RUNBOOK.md` § "챗봇 구현 테스트 결과".

**다음 예정 (챗봇 훈련 이후)**  
- **시스템 업그레이드 (감정 스탯)**: `docs/SYSTEM_UPGRADE_PLAN_EMOTIONAL_STATS.md` — Core Stats·Events·Advanced Stats 해금, Q/Δ 공식, UI 문구만·악용 방지.  
  - **Phase A1–F1**: ✅ **도메인 → DB → API → UI 순 반영 완료** (coreStats/formula/unlock/antiExploit, 마이그레이션, record-event/display API, 챗/멘토 연동, UI phrases).  
  - **이후**: v3 스펙(이벤트 15종·stat_distribution·30일 가속·rapid_session_penalty 등)은 `docs/HEALING_COACHING_SPEC_V3.md`·`docs/specs/healing-coaching-spec-v3.json` 기준으로 확장 가능. 검증은 Cursor 2에 "감정 스탯 API·UI 검증해줘" 등으로 지시.

**현재 단계**: Phase 4 (코드별 테마·엘리트 5%). 상세 목록은 **`docs/PHASE_4_CHECKLIST.md`** 참고.  
**백로그**: **`docs/PROJECT_BACKLOG.md`**.

- **시나리오 노출 확인**: **`docs/SCENARIO_UNLOCK_VERIFICATION.md`** — 가입·레벨에 따른 시나리오 노출 검증 시, 문서의 체크박스를 **순서대로** 확인하면 됩니다.

**한 줄 지시 (복사용)** — 상세·전체 프롬프트: **`docs/NEXT_PROMPTS.md`**. 작업 반영 시 해당 문서에서 `[x]` 로 체크.  
**진행 방식**: NEXT_PROMPTS.md 상단 「다음 작업 진행 방식」 참고 — [ ] 항목 선택 → 프롬프트 복사 → 에이전트 지시 → 완료 시 [x] 반영.

| 상태 | 지시 |
|------|------|
| [x] | **챗봇 훈련 (PROJECT_BACKLOG §9)**: ROADMAP § 챗봇 훈련 시기·CHATBOT_TRAINING_CHECKLIST 참고 — 시스템 프롬프트 보강, 구역별 예시, 메타 질문 가이드, Chatbot 소개·공간 안내 i18n. |
| [x] | **Phase 4 (4-1~4-4)** 완료. 스펙·코드 스킨·엘리트 기획·멘토 배지·해금 콘텐츠. `docs/PHASE_4_CHECKLIST.md` 참고. |
| [x] | **대시보드 Arena Level 숨기기**: "PROJECT_BACKLOG §2: Arena Level 카드 플래그로 MVP 후 숨기기 구현해줘." |
| [x] | **Partner 시나리오**: "PROJECT_BACKLOG §3: Partner일 때 S1~L4 시나리오 노출되도록 점검·수정해줘." |
| [x] | **엘리트 정책**: "PROJECT_BACKLOG §4: 주간 vs 시즌 5% 정책·특혜 1페이지 정리해줘." |
| [x] | **엘리트 특혜 선정**: "PROJECT_BACKLOG §5: 엘리트 특혜 후보 중 1~2차 구현 항목 선정·한 줄 스펙해줘." |
| [x] | **시나리오 검증**: "SCENARIO_UNLOCK_VERIFICATION.md 체크리스트 순서대로 검증해줘." |
| [x] | **Arena UI (B)**: "ARENA_UI_REDESIGN_BRIEF C → B 적용해줘." — B(대시보드 카드·상단 문구) 적용 완료. |
| [x] | **Arena UI (C)**: "ARENA_UI_REDESIGN_BRIEF 프롬프트 C 적용해줘." — 색·테마(변수·그라데이션) 적용 완료. |
| [x] | **Arena UI (D)**: "ARENA_UI_REDESIGN_BRIEF 프롬프트 D 적용해줘." (문구·톤만) |
| [x] | **Arena UI (E)**: "ARENA_UI_REDESIGN_BRIEF 프롬프트 E 적용해줘." (네비·레이아웃, 헤더 포근함) |
| [x] | **Arena UI (A)**: "ARENA_UI_REDESIGN_BRIEF 프롬프트 A 적용해줘." (전체 감성·테마·타이포·카드 변수 통일) |
| [x] | **Leadership Engine P8 최종 검증**: ENGINE_ARCHITECTURE_DIRECTIVE_PLAN §8 — SPEC 일치·bty-arena-global·bty-release-gate·bty-ui-render-only 점검. **통과**. |
| [x] | **인증 user + /bty/login → /bty 302 리다이렉트**: `src/middleware.ts`에서 인증된 사용자가 `/${locale}/bty/login` 요청 시 `/${locale}/bty`로 302 리다이렉트. 쿠키 설정 변경 없음. npm test 132 통과. |
| [x] | **Center §4 회복 탄력성 일별/기간별 트렉**: CENTER_PAGE_IMPROVEMENT_SPEC §4 기준. 도메인 `src/domain/center/resilience.ts`(energyToLevel, aggregateLetterRowsToDailyEntries) 추가, API는 도메인만 호출·쿼리 `period` 지원. 쿠키/리다이렉트 변경 없음. npm test 140 통과. |
| [x] | **coreStats v3 (HEALING_COACHING_SPEC_V3·healing-coaching-spec-v3.json)**: 이벤트 14종·stat_distribution·30일 가속·phase_tuning을 formula·recordEmotionalEventServer에 반영. SELF_REFRAMING CD→RD(core). phase.test.ts·formula.test.ts 추가. 도메인만 비즈니스 규칙. npm test 171 통과. |
| [x] | **DOJO_DEAR_ME_NEXT_CONTENT §7**: 50문항 목차·연습 플로우 2~5단계 스펙 정리(§1-4·§6·§4·§5). 도메인 `src/domain/dojo/flow.ts`(canEnterDojo, validateDojo50Submit, computeDojo50Result, validateIntegritySubmit) 추가. 도메인만 비즈니스 규칙. flow.test.ts 9케이스. npm test 180 통과. |
| [x] | **CENTER_PAGE_IMPROVEMENT_SPEC §9 순서 §5~§8 Center API·도메인 점검**: §9-1 완료 상태 표 추가. 도메인 `src/domain/center/paths.ts`(CENTER_CTA_PATH, CENTER_CHAT_OPEN_EVENT, getCenterCtaHref) 추가, PageClient에서 사용. 도메인만 비즈니스 규칙. paths.test.ts 3케이스. npm test 183 통과. |
| [x] | **§9 점검 완료 (C3·C4)**: §9-1 표 상태·비고 갱신. C4 PageClient ResilienceGraph locale={locale} 보완(KO step5·메인). npm run lint Exit 0. CURSOR_TASK_BOARD·CURSORS_PARALLEL_TASK_LIST §8 완료 로그 반영. |
| [x] | **AVATAR_LAYER_SPEC §6·§7**: 아바타 레이어·옷 DB/API/도메인. avatarAssets·스키마·리더보드 응답 확장. 도메인 profileToAvatarCompositeKeys, 리더보드 행에 avatar 키. RPC avatar_accessory_ids. npm test 186 통과. |

- 위 한 줄 지시를 복사해 붙여 넣거나, NEXT_TASKS_2.md §4 표에서 [ ] 항목을 복사해 지시하면 됩니다.

---

**한 줄 지시 (2차)** — 상세·전체 프롬프트: **`docs/NEXT_TASKS_2.md`**. 작업 반영 시 해당 문서에서 `[x]` 로 체크.  
**진행 방식**: NEXT_TASKS_2.md 상단 「다음 작업 진행 방식」 참고 — [ ] 항목 선택 → 프롬프트 복사 → 에이전트 지시 → 완료 시 [x] 반영.  
**진행 ↔ 검증 번갈아**: 한 커서는 진행, 다른 커서는 검증으로 단계별 진행할 때는 **`docs/AGENTS_TURN_BY_TURN.md`** 참고 (단계 1 진행 → 1 검증 → 2 진행 → 2 검증 → …).

| 상태 | 지시 |
|------|------|
| [x] | **Dojo·Dear Me 콘텐츠 기획**: "NEXT_TASKS_2 §1-1: Dojo/Dear Me 1차 콘텐츠 스펙 문서 작성해줘." |
| [x] | **배포 전 체크**: "NEXT_TASKS_2 §1-2: bty-release-gate 규칙에 맞게 배포 전 체크 실행해줘." |
| [x] | **진행 순서 문서 업데이트**: "NEXT_TASKS_2 §1-3: PROJECT_PROGRESS_ORDER·로드맵 Phase 4 완료 반영해줘." |
| [x] | **엘리트 2차 기능**: "NEXT_TASKS_2 §1-4: 챔피언십 또는 특별 프로젝트 1종 구현해줘." |
| [x] | **언어 선택 시나리오·안내·대답 통일**: "NEXT_TASKS_2 §1-5: 한국어 선택 시 한국어 시나리오·안내·대답, 영어 선택 시 영어로 나오게 해줘." |
| [x] | **통합 테스트**: "NEXT_TASKS_2 §2-1: 로그인→XP→리더보드·프로필 통합 시나리오 테스트해줘." |
| [x] | **접근성 점검**: "NEXT_TASKS_2 §3-1: 대시보드·멘토·Arena·리더보드 접근성·키보드 포커스 점검해줘." |
| [x] | **첫인상 디자인**: "NEXT_TASKS_2 §3-3: DESIGN_FIRST_IMPRESSION_BRIEF 참고해서 히어로·폰트·악센트·호버 적용해줘." |
| [x] | **성능 점검 (선택)**: "NEXT_TASKS_2 §3-4: 메인 경로 번들·로딩 점검해줘." |

**Dojo·Dear Me 2차 (진행)**  
| [x] | **Dear Me 1차 플로우 진입 화면**: `docs/DOJO_DEAR_ME_NEXT_CONTENT.md` §2-2 단계 1 — 소개 1~2문장 + "시작하기" 버튼, 클릭 시 본문 노출. (i18n `entryIntro`/`startCta`, PageClient 진입 분기.) |

**Integrator 검증 (공통 서류 반영)**  
- **규칙**: lint/test/build 실행 결과는 이 블록 + `docs/CURSOR_TASK_BOARD.md` C5·Gate Report에 반영한다.
- **Verify**: 사용자가 C5 터미널에서 직접 `npm run lint && npm test -- --run && npm run build` 및 `./scripts/orchestrate.sh` 실행. 통과 시 "wrap-ci passed" 또는 **"done"** 으로 표시.
- **"wrap ci passed" / "done" 의미**: 위 둘 다 통과한 상태. **"done"이라고 쓰면 wrap-ci passed와 동일하게 이해한다.** 이때 보드·문서 갱신·Exit 체크 후, 사용자가 **auto** 사용 시 다음 First Task 작성.
- **auto 실행 시 필수**: **2~3개 연관 항목**을 묶어 First Task로 선정. 같은 스펙/레이어/플로우끼리 묶고, Auth·XP·리더보드 등 위험 구간은 1개만. **같은 명령 반복** 금지. 상세: `docs/CURSOR_TASK_BOARD.md` § "AUTO 시 2~3개 묶기", § "AUTO 실행 시 필수 (같은 명령 반복 방지)".  
- **최신 (wrap)**: **CI PASSED** — Lint [x] Test [x] Build [x]. **빈 상태 보강 1곳 추가** 런 C5·WRAP 완료. Gate 검증 완료.
- **스크립트**: `scripts/verify-workers-dev.sh` — exit 0/1 자동 판정, placeholder 검증, HTTP 코드·본문 검증. `scripts/ci-gate.sh` — lint→test→build→(선택)verify-workers-dev→notify-done. 사용: `./scripts/ci-gate.sh` 또는 `BASE=... LOGIN_BODY='...' ./scripts/ci-gate.sh`

**Gatekeeper 검사 (2026-03-03)**  
- **규칙 준수**: bty-release-gate, bty-auth-deploy-safety, bty-ui-render-only 기준으로 변경분·관련 경로 검사. **Release Gate Results: PASS.**  
- **상세**: `docs/GATE_REPORT_LATEST.md` — Auth/리셋/리더보드/API/검증 단계 정리. UI에서 tierFromCoreXp/codeIndexFromTier 사용 시 FAIL로 처리하도록 명시.
