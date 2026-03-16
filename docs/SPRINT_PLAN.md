# BTY SPRINT PLAN

이 문서는 현재 스프린트의 단일 진실(single source of truth)이다.
모든 Cursor는 이 문서만 보고 현재 할 일을 판단한다.

---

## 검증 정책 (현재 모드)

- **구현 전용.** 스프린트는 **Q3·Q4 기능 구현**만 진행. 최대한 빨리 구현에 집중.
- **검증은 배포 전 1회만.** Release Gate·문서 점검·접근성·엘리트 체크리스트·route 테스트는 **배포를 하기로 할 때** 1회 수행. 매 스프린트 반복하지 않음.
- **배포 시 수행:** `docs/MVP_DEPLOYMENT_READINESS.md` 1회 + `bty-release-gate.mdc` A~F + `docs/BTY_RELEASE_GATE_CHECK.md` 반영.

---

## SPRINT

- **Mode:** FOUNDRY (구현 전용)
- Sprint ID: SPRINT 190
- Status: active
- Objective: **Q3·Q4 로드맵 연속.** 각 Cursor 5건. LE·대시보드·Elite·Healing·접근성·테스트. 검증=배포 전 1회.

---

## GLOBAL RULES

- 모든 Cursor는 자기 섹션만 본다.
- 자기 섹션의 가장 위에 있는 `[ ]` 작업부터 처리한다.
- 완료하면 `[x]`로 바꾼다.
- 막히면 해당 작업 아래에 `BLOCKER:`를 쓴다.
- 자기 섹션에 `[ ]`가 없으면 멈춘다.
- 새 작업 생성은 C1만 한다.
- C7은 **배포 전** 검증 시에만 실행·기록.

**작업 정책:** 구현 = Q3·Q4 (docs/ROADMAP_Q3_Q4.md). 검증 = 배포 전 1회 (docs/WORK_POLICY.md).

**한 번에 구현:** 각 Cursor(C3·C4·C5·C6)는 자기 섹션에 적힌 **5개 작업**을 한 배치로 구현한다. 위에서부터 순서대로 진행해 한꺼번에 완료한 뒤 [x] 처리. REFRESH 시 C1이 전량 [x] 확인 후 다음 스프린트(189…) 작업을 ROADMAP_Q3_Q4·백로그 기준으로 채우고 Sprint ID 갱신.

---

## C1 — COMMANDER

Role:
- planning only
- implementation code 수정 금지

Allowed action:
- `REFRESH`: 계획 갱신. **전량 [x]이면** 다음 스프린트(42, 43, …) 작업을 이 파일에 추가한 뒤 로그 반영.
- **예외:** 남은 [ ]가 **모두 BLOCKER**(제품/UX·IA 등 외부 결정 대기)로만 막혀 있으면, 이번 스프린트는 **회전 완료**로 보고 다음 스프린트 생성. BLOCKER 항목은 다음 스프린트 해당 섹션 **맨 위 [ ]** 로 이관(해당 스프린트에서도 결정 나올 때까지 대기).

Exit:
- Objective가 최신 상태
- 각 Worker에 할 일 또는 empty 상태가 명확함
- C7 결과 반영됨

---

## C2 — GATEKEEPER

Role:
- release gate (배포 시 1회)
- auth safety
- render-only rule check

Allowed paths:
- `.cursor/rules/`
- `docs/BTY_RELEASE_GATE_CHECK.md`

**현재 모드:** 구현 전용. 배포 시 Gate 1회. 아래 5건 한 번에 처리. 189 회전 완료 후 190에서 배포 시 2건(맨 위) + 문서 점검 3건.

Tasks:
- [ ] 배포 시 1회: Gate 실행 전 BTY_RELEASE_GATE_CHECK § A~F·MVP_DEPLOYMENT_READINESS 최종 확인 (배포 결정 시만)
  - BLOCKER: 배포 결정 단계가 아니면 미실행. 189에서 이관.
- [ ] (선택) 배포 시 1회: self-healing-ci.sh 실행 후 결과를 BTY_RELEASE_GATE_CHECK·SPRINT_LOG에 기록
  - BLOCKER: 배포 결정 시에만. 189에서 이관.
- [x] render-only 체크리스트: app/[locale]·components 1곳 샘플 점검 후 BTY_RELEASE_GATE_CHECK 반영
- [x] auth/session 점검 포인트: 쿠키·401 요약 확인·보강
- [x] 리더보드·XP 안전 점검 포인트: Core/Weekly·시즌 미반영 요약 확인·보강

Notes:
- 189 전 항목 [x] 처리. 190 = C2 배포 시 2건 이관 + 문서 점검 3건.
- 190 문서 점검 3건: render-only 샘플(domain import 없음)·auth/session·리더보드·XP 요약 확인. 본 문서 반영.

Blockers:

---

## C3 — DOMAIN ENGINEER

Role:
- domain logic only

Allowed paths:
- `src/domain/`
- `src/lib/bty/arena/`

**한 번에 구현:** 아래 5건을 한 배치로 처리. ROADMAP_Q3_Q4 기준. domain/lib만.

Tasks:
- [x] [Q3] LE Stage: 진행도·행동 패턴 타입/상수 1건 검토·보강 (stages.ts·le-stage.ts)
- [x] [Q3] AIR·대시보드: AIR 밴드·대시보드 요약 타입 1건 검토·보강 (air.ts·dashboard.ts)
- [x] [Q3] 대시보드 추천: RecommendationSummary 소스별 우선순위 상수 확인·보강
- [x] [Q4] Healing/Awakening: phase·콘텐츠 연동용 상수/타입 1건 확인 (healing.ts)
- [x] [DOCS] domain index: arena/center/foundry export 1회 확인·미export 추가

Notes:
- 189 회전 완료. 190 = ROADMAP_Q3_Q4 구체 작업 5건. 도메인만, 부수효과 없음.
- 190 완료: LE·AIR·대시보드 기존 상수 검토 유지. dashboard RECOMMENDATION_SOURCE_ORDER 추가, healing HEALING_PHASE_I_LABEL 추가, domain index에 foundry export 추가. npm test 583 통과.

Blockers:

---

## C4 — API ENGINEER

Role:
- API routes
- middleware
- auth/session wiring

Allowed paths:
- `src/app/api/`
- `src/middleware.ts`

**한 번에 구현:** 아래 5건을 한 배치로 처리. 비즈니스 규칙은 domain/lib 호출만.

Tasks:
- [x] [Q3] LE Stage: GET /api/arena/leadership-engine/stage-summary 응답 스키마·필드 검증·보강
- [x] [Q3] 대시보드: GET /api/arena/dashboard/summary recommendation 필드·쿼리 검증
- [x] [Q3] Elite: PATCH /api/arena/mentor-requests/[id] 동작·문서 확인
- [x] [Q4] Healing/Awakening: GET /api/bty/healing·awakening 에러 응답·문서 확인
- [ ] [API] API 문서: ARENA_DOMAIN_SPEC 또는 route 목록 신규·변경 반영
  - BLOCKER: API 문서는 docs/spec/ 소관. C4 허용 경로는 src/app/api·middleware만. C1 또는 문서 담당이 docs 반영 시 해제.

Notes:
- 189 회전 완료. 190 = ROADMAP_Q3_Q4 구체 API 5건. 얇은 핸들러, domain/lib 호출만.
- stage-summary: JSDoc LEStageSummary 참조 추가, 테스트에 응답 키 7개 정합성 검사 추가.
- dashboard/summary: recommendation priority를 RECOMMENDATION_SOURCE_PRIORITY 사용, 쿼리 source 검증 테스트·응답 키 검사 추가.
- mentor-requests/[id]: @contract 타입 명시, 200 응답 키(ok,id,status,respondedAt) 테스트 고정.
- healing/awakening: 에러 응답 401/500 JSDoc 정리, awakening에 500 INTERNAL_ERROR 테스트 추가.

Blockers:

---

## C5 — UI ENGINEER

Role:
- render-only UI
- accessibility
- locale UI

Allowed paths:
- `src/app/[locale]/`
- `src/components/`

**한 번에 구현:** 아래 5건을 한 배치로 처리. 데이터는 API/props만, 규칙 계산 없음.

Tasks:
- [x] [Q3] 대시보드: LE Stage 또는 AIR 위젯 로딩/에러 UI 1곳 정리
- [x] [Q3] Elite: Elite 화면 접근성 1곳 (aria-label·role)
- [x] [Q4] Healing/Awakening: 로딩·빈 상태 표시 1곳
- [x] [UI] Center/Foundry: dear-me·assessment·dojo·integrity·mentor 접근성 1곳 (aria-label 등)
- [x] [UI] i18n: healing·dashboard·대시보드 블록 누락 키 1곳 확인·보강

Notes:
- 189 회전 완료. 190 = ROADMAP_Q3_Q4 구체 UI 5건. render-only.
- 190(1): LE Stage 위젯 로딩 시 role=region, aria-label, aria-busy, aria-live 추가. Lint ✓.
- 190(2): Elite 멘토 링크 ul에 role=list, aria-label(ko/en). Lint ✓.
- 190(3): Healing 인덱스 로딩 region+aria-busy, 빈 상태(phase 없음) 문구 추가. Lint ✓.
- 190(4): Integrity 시나리오 입력 영역 role=group, aria-label(ko/en). Lint ✓.
- 190(5): i18n healing 블록에 emptyPhase(ko/en) 추가, Healing 페이지에서 사용. Lint ✓.

Blockers:

---

## C6 — TESTFIX ENGINEER

Role:
- tests for new code
- minimal lint/type/build fixes

Allowed paths:
- `src/**/*.test.ts`
- 테스트 통과를 위한 최소 수정 파일

**한 번에 구현:** 아래 5건을 한 배치로 처리. C3·C4 구현 후 해당 API/도메인 대상으로 추가.

Tasks:
- [x] [Q3] stage-summary route 테스트: 401·200·응답 shape 보강
- [x] [Q3] dashboard/summary route 테스트: recommendation 필드 검증 보강
- [x] [Q4] Healing/Awakening route 테스트: 401·200·응답 검증
- [x] [TEST] C3 수정 도메인 단위 또는 edges 테스트 1건
- [x] [TEST] npm run build·npm test 통과 유지

Notes:
- 189 회전 완료. 190 = ROADMAP_Q3_Q4 구체 테스트 5건.
- 190 완료: stage-summary progressPercent·키 검증, dashboard/summary recommendation·source 쿼리, healing/awakening 200 키 검증, dashboard.edges.test.ts 추가, build·test 210파일 1610통과.

Blockers:

---

## C7 — INTEGRATOR

Role:
- integration verification (배포 전 1회)
- gate result recording

**현재 모드:** 구현 전용. 배포 결정 시에만 `GATE` 실행.

Command (배포 시만):
- `GATE` → `./scripts/self-healing-ci.sh`

Record results here (배포 전 1회 실행 후 채움):

| Field | Value |
|-------|--------|
| Lint | PASS |
| Test | PASS |
| Build | PASS |
| Overall | PASS |
| Owner if fail | — |

Last run: 2026-03-16. GATE via ./scripts/self-healing-ci.sh. Lint ✓ Test ✓ Build ✓. Overall PASS.

Blockers:

---

## BLOCKERS

- (None. 구현 전용 모드.)


---

## 다음 프로젝트 (SPRINT 189) — 188 전량 [x] 후 적용

**목표:** REFRESH 시 C1이 ROADMAP_Q3_Q4·NEXT_BACKLOG 기준으로 C3·C4·C5·C6 각 5건 채우고 Sprint ID를 189로 갱신. (188 = 로드맵 2페이지·다음 연도 백로그·대시보드·Elite·도메인/API/UI/테스트.)

**REFRESH:** 187 전량 [x] (C2 BLOCKER 제외). 188 전환 완료. C3·C4·C5·C6 각 5건 [ ] 적용됨.

---

## HANDOFFS

From / To / Reason / File (필요 시 추가)

- C1 → C2·C3·C4·C5·C6 / Arena 피드백 선처리 / docs/BTY_ARENA_FEEDBACK_2026-03.md §1~§9 → SPRINT_PLAN § C2~C6 [Arena 피드백] 작업으로 할당 완료.
- C1 → C3·C4·C5·C6 / 구현 가속 3~5건 한 배치 / SPRINT 184. 각 Worker 3~5건 채움. 옷 에셋(SVG)·Today's growth·Elite 승인거절·Fantasy 옷·도메인/API/UI/테스트 병렬 진행.
- C1 → C3·C4·C5·C6 / 캐릭터·옷·악세사리 새 파일/서류 연동 / SPRINT 185. 각 Worker **5건** 고정. avatar-assets.json·AVATAR_ALIGNMENT_AND_OUTFIT_SPEC·public/avatars 기준. 완료 후 § 다음 프로젝트(SPRINT 186) 적용.
- C1 REFRESH: 185 상태 — C3·C4·C6 [x]. C7 Lint·Test·Build PASS. C5 5건 [ ] 진행 필요. C5 완료 시 186 전환.
- C1 REFRESH: (갱신) 동일. C5 [1]~[5] 미완료. 186 전환 대기.
- C1 REFRESH: 185 유지. C5 5건 [ ] → 완료 시 186 적용.
- C1 REFRESH: 185 완료. C5 5건 [x]. 186 전환 — Today's growth·Elite·Dental RPG·대시보드 5건씩 적용.
- C1 REFRESH: 186 — C3·C5·C6 [x]. C4 3건 [ ] (Healing/Awakening, todayGrowth, API 문서). C4 완료 시 186 회전 완료.
- C1 REFRESH: 186 전량 [x]. 회전 완료. 다음 = SPRINT 187 (C1이 작업 채움).
- C1 REFRESH: 187 생성. ROADMAP_Q3_Q4 기준 C3·C4·C5·C6 각 5건 [ ] 채움. Sprint ID 187 갱신. 매 REFRESH 시 동일 절차(전량 [x] 확인 → 다음 스프린트 작업 채움 → Sprint ID 갱신).
- C1 REFRESH: 187 — C3·C5·C6 [x]. C4 2건 [ ] (대시보드 API 정리, API 문서 갱신). C4 완료 시 188 전환.
- C1 REFRESH: 187 전량 [x]. 188 전환 완료. C3·C4·C5·C6 각 5건 [ ] 채움. Sprint ID 188. 다음 = 189.

---

## 참조 문서

- docs/CURRENT_TASK.md
- docs/CURSOR_TASK_BOARD.md
- docs/BTY_RELEASE_GATE_CHECK.md
- **docs/spec/AVATAR_ALIGNMENT_AND_OUTFIT_SPEC.md** — 캐릭터·옷·악세사리 정렬·URL·bodyType 설계 (SPRINT 185 기준)
- **bty-app/public/avatars/README.md**, **avatar-assets.json** — 에셋 경로·매니페스트
- docs/BTY_ARENA_FEEDBACK_2026-03.md — Arena QA 피드백 9건
- docs/ROADMAP_Q3_Q4.md — Q3·Q4 기능 스프린트 (LE, Elite, Healing, AIR, 대시보드)
- docs/MVP_DEPLOYMENT_READINESS.md — 배포 전 1회 체크리스트
- docs/WORK_POLICY.md — 일상=기능 작업, 검증=배포 시
