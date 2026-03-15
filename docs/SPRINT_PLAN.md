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
- Sprint ID: SPRINT 183
- Status: active
- Objective: **Q3·Q4 구현 가속.** 배포 시 Gate 1회(이관)·다음 백로그. 검증=배포 전 1회.

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

**한 번에 구현:** 각 Cursor(C3·C4·C5·C6)는 자기 섹션에 적힌 **3~5개 작업을 한 배치로** 구현한다. 위에서부터 순서대로 진행해 한꺼번에 완료한 뒤 [x] 처리.

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

**현재 모드:** 구현 전용. 배포 시 Gate 1회. 아래는 182에서 이관(맨 위 [ ]). 배포 결정 시에만 실행.

Tasks:
- [ ] 배포 시 1회: Gate 실행 전 BTY_RELEASE_GATE_CHECK § A~F·MVP_DEPLOYMENT_READINESS 최종 확인 (배포 결정 시만)
  - BLOCKER: 배포 결정 단계가 아니면 미실행. 182에서 이관.
- [ ] (선택) 배포 시 1회: self-healing-ci.sh 실행 후 결과를 BTY_RELEASE_GATE_CHECK·SPRINT_LOG에 기록
  - BLOCKER: 배포 결정 시에만. 182에서 이관.

Notes:
- 182 회전 완료. C2 항목 2건 이관. C3·C4·C5·C6 전부 [x]. 배포 시 1회만 실행.

Blockers:

---

## C3 — DOMAIN ENGINEER

Role:
- domain logic only

Allowed paths:
- `src/domain/`
- `src/lib/bty/arena/`

**한 번에 구현:** 아래 1~2개를 한 배치로 처리. 다음 백로그 또는 C1 채움.

Tasks:
- [ ] 다음 Q3·Q4 백로그: 도메인 보강 1건 (ROADMAP_Q3_Q4·NEXT_BACKLOG 확인 후 C1이 채우거나 비움)
- [ ] (선택) 비움 — C1이 다음 스프린트 작업 추가 시 채움

Notes:
- 182 완료: LE Stage·AIR·대시보드·콘텐츠 확장·domain index. 183 = 다음 백로그 대기 또는 C1 채움.

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

**한 번에 구현:** 아래 1~2개를 한 배치로 처리. 비즈니스 규칙은 domain/lib 호출만.

Tasks:
- [ ] 다음 Q3·Q4 백로그: API 보강 또는 신규 1건 (C1이 채우거나 비움)
- [ ] (선택) 비움 — C1이 다음 스프린트 작업 추가 시 채움

Notes:
- 182 완료: stage-summary·dashboard·Healing API·권한 점검·route 목록. 183 = 다음 백로그 대기 또는 C1 채움.

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

**한 번에 구현:** 아래 1~2개를 한 배치로 처리. 데이터는 API/props만 사용, 규칙 계산 없음.

Tasks:
- [ ] 다음 Q3·Q4 백로그: UI 보강 또는 신규 1건 (C1이 채우거나 비움)
- [ ] (선택) 비움 — C1이 다음 스프린트 작업 추가 시 채움

Notes:
- 182 완료: 대시보드 위젯·Elite 접근성·Healing 로딩·Center 접근성·i18n. 183 = 다음 백로그 대기 또는 C1 채움.

Blockers:

---

## C6 — TESTFIX ENGINEER

Role:
- tests for new code
- minimal lint/type/build fixes

Allowed paths:
- `src/**/*.test.ts`
- 테스트 통과를 위한 최소 수정 파일

**한 번에 구현:** 아래 1~2개를 한 배치로 처리. C3·C4 구현 후 해당 API/도메인 대상으로 추가.

Tasks:
- [ ] 다음 Q3·Q4 백로그: 신규/변경 API·도메인에 대한 route 또는 단위 테스트 1건 (C1이 채우거나 비움)
- [ ] (선택) 비움 — C1이 다음 스프린트 작업 추가 시 채움

Notes:
- 182 완료: stage-summary·dashboard·Healing route 테스트·도메인 단위·build. 183 = 다음 백로그 대기 또는 C1 채움.

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

Last run: 2026-03-14. GATE via ./scripts/self-healing-ci.sh. 구현 전용 전환 후에는 배포 시 1회만 실행.

Blockers:

---

## BLOCKERS

- (None. 구현 전용 모드.)


---

## HANDOFFS

From / To / Reason / File (필요 시 추가)

- C1 → C2·C3·C4·C5·C6 / Arena 피드백 선처리 / docs/BTY_ARENA_FEEDBACK_2026-03.md §1~§9 → SPRINT_PLAN § C2~C6 [Arena 피드백] 작업으로 할당 완료.

---

## 참조 문서

- docs/CURRENT_TASK.md
- docs/CURSOR_TASK_BOARD.md
- docs/BTY_RELEASE_GATE_CHECK.md
- docs/NEXT_PHASE_AUTO4.md, docs/NEXT_BACKLOG_AUTO4.md
- **docs/BTY_ARENA_FEEDBACK_2026-03.md** — Arena QA 피드백 9건 (아바타/옷, i18n, Past scenarios, 메뉴, 리더보드·시뮬레이션 에러, 로딩 한글 표시 등). 변경 사항 반영용.
- docs/ROADMAP_Q3_Q4.md — Q3·Q4 기능 스프린트 (LE, Elite, Healing, AIR, 대시보드)
- docs/MVP_DEPLOYMENT_READINESS.md — 배포 전 1회 체크리스트
- docs/WORK_POLICY.md — 일상=기능 작업, 검증=배포 시
