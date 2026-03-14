# BTY SPRINT PLAN

이 문서는 현재 스프린트의 단일 진실(single source of truth)이다.
모든 Cursor는 이 문서만 보고 현재 할 일을 판단한다.

---

## SPRINT

- **Mode:** FOUNDRY
- Sprint ID: SPRINT 161
- Status: active
- Objective: Release Gate 161차, 문서 점검 469·470·471차, Center/Foundry 접근성 1곳, 미커버·route 테스트, 엘리트 3차 체크리스트. (일상은 docs/ROADMAP_Q3_Q4.md Q3·Q4 기능 스프린트.)

---

## GLOBAL RULES

- 모든 Cursor는 자기 섹션만 본다.
- 자기 섹션의 가장 위에 있는 `[ ]` 작업부터 처리한다.
- 완료하면 `[x]`로 바꾼다.
- 막히면 해당 작업 아래에 `BLOCKER:`를 쓴다.
- 자기 섹션에 `[ ]`가 없으면 멈춘다.
- 새 작업 생성은 C1만 한다.
- C7은 검증 결과를 이 파일에 직접 기록한다.

**작업 정책 (docs/WORK_POLICY.md):**  
일상 = UI·API·도메인·**Q3·Q4 기능 스프린트** (docs/ROADMAP_Q3_Q4.md).  
배포 시 = docs/MVP_DEPLOYMENT_READINESS.md 1회 + Gate·문서 반영.  
매 스프린트 Gate+문서+접근성+테스트 반복은 정책상 필수 아님.

---

## C1 — COMMANDER

Role:
- planning only
- implementation code 수정 금지

Allowed action:
- `REFRESH`: 계획 갱신. **전량 [x]이면** 다음 스프린트(42, 43, …) 작업을 이 파일에 추가한 뒤 로그 반영.

Exit:
- Objective가 최신 상태
- 각 Worker에 할 일 또는 empty 상태가 명확함
- C7 결과 반영됨

---

## C2 — GATEKEEPER

Role:
- release gate
- auth safety
- render-only rule check

Allowed paths:
- `.cursor/rules/`
- `docs/BTY_RELEASE_GATE_CHECK.md`

Tasks:
- [x] 이번 배치(161) 접근성·테스트 변경이 render-only 원칙을 깨지 않는지 확인
- [x] Release Gate 161차 관련 변경이 auth/리셋/리더보드에 영향 없는지 확인
- [x] 필요 시 `docs/BTY_RELEASE_GATE_CHECK.md` 업데이트

Notes:
- 161차 render-only: app/components·app/[locale]에 domain·XP/랭크 import·정렬 없음. 접근성·route 테스트 표시·API만. PASS.
- 161차 scope: 문서·접근성·route테스트·검증·엘리트. auth/리셋/리더보드 무변경. PASS.

Blockers:

---

## C3 — DOMAIN ENGINEER

Role:
- domain logic only

Allowed paths:
- `src/domain/`
- `src/lib/bty/arena/`

Tasks:
- [ ] [DOMAIN] Center/Foundry 미커버 경계 테스트 1건 (선택)  
  미커버 1곳 `*.edges.test.ts` 또는 `*.test.ts`. npm test 통과.

Notes:

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

Tasks:
- None this sprint. (접근성 1곳 작업은 C5 담당.)

Notes:
- CONTINUE 2026-03-12: No [ ] tasks; C4 idle this sprint.
- CONTINUE 2026-03-13: No [ ] tasks; C4 idle. Stopped.
- CONTINUE: No [ ] tasks in C4; idle. Stopped.
- CONTINUE (SPRINT 99): No [ ] tasks; C4 idle. Stopped.
- CONTINUE: No [ ] tasks; C4 idle. Stopped.
- CONTINUE: No [ ] tasks; C4 idle. Stopped.
- CONTINUE: No [ ] tasks in C4 (SPRINT 102); stopped.
- CONTINUE: No [ ] tasks; C4 idle. Stopped.
- CONTINUE: No [ ] tasks; C4 idle. Stopped.

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

Tasks:
- [x] [VERIFY] Release Gate A~F — Foundry 161차  
  bty-release-gate.mdc A~F. Lint·Test·Build. BTY_RELEASE_GATE_CHECK·보드·CURRENT_TASK 반영.
- [x] [VERIFY] 엘리트 3차 체크리스트 1회  
  ELITE_3RD_SPEC_AND_CHECKLIST.md 검증 6항목. Elite=Weekly XP만·시즌 미반영. 보드·CURRENT_TASK·§3 반영.
- [x] [UI] Center/Foundry 추가 접근성 1곳  
  dear-me·assessment·center·dojo·integrity·mentor·elite 중 미적용 1곳에 aria-label 또는 aria-describedby. render-only. npm run lint 통과. file: `src/app/[locale]/` 또는 `src/components/`.

Notes:
- Release Gate 161차: self-healing-ci.sh Lint·Test·Build 통과. BTY_RELEASE_GATE_CHECK 반영.
- 엘리트 3차 161차: 6항목 1회 실행. Elite=Weekly XP만·시즌 미반영. **RESULT: PASS.** §3 반영.
- 접근성 161차: dashboard/page.client.tsx — Dojo "역지사지 연습 →" Link에 aria-label (ko/en). Lint ✓.

Blockers:

---

## C6 — TESTFIX ENGINEER

Role:
- tests
- small lint/type/build fixes
- minimal regression fixes

Allowed paths:
- `src/**/*.test.ts`
- 테스트 통과를 위한 최소 수정 파일

Tasks:
- [x] [TEST] Center/Foundry route 테스트 1건 (선택)  
  POST/GET route 401·200 등. npm test 통과. file: `src/app/api/**/*.route.test.ts` 등.

Notes:
- emotional-stats/record-event: POST rejects when recordEmotionalEventServer throws. 1 test 추가, 6 tests pass.

Blockers:

---

## C7 — INTEGRATOR

Role:
- integration verification
- gate result recording

Command:
- `GATE`

Run:
```bash
./scripts/self-healing-ci.sh
```

Record results here (C7이 실행 후 채움):

| Field | Value |
|-------|--------|
| Lint | PASS |
| Test | PASS |
| Build | PASS |
| Overall | PASS |
| Owner if fail | — |

Last run: 2026-03-13 (self-healing-ci.sh, GATE, 66th run). Lint ✓ Test ✓ Build ✓. Overall PASS.

Blockers:
- self-healing-ci.sh fails when .next missing → Owner C6 (non-blocking when .next exists).

---

## BLOCKERS

None


---

## HANDOFFS

From / To / Reason / File (필요 시 추가)

---

## 참조 문서

- docs/CURRENT_TASK.md
- docs/CURSOR_TASK_BOARD.md
- docs/BTY_RELEASE_GATE_CHECK.md
- docs/NEXT_PHASE_AUTO4.md, docs/NEXT_BACKLOG_AUTO4.md
- docs/ROADMAP_Q3_Q4.md — Q3·Q4 기능 스프린트 (LE, Elite, Healing, AIR, 대시보드)
- docs/MVP_DEPLOYMENT_READINESS.md — 배포 전 1회 체크리스트
- docs/WORK_POLICY.md — 일상=기능 작업, 검증=배포 시
=기능 작업, 검증=배포 시
