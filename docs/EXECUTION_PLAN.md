# 실행 계획 — 우선순위 자동결정

**단일 진실**: `docs/CURRENT_TASK.md` 1줄 + `docs/CURSOR_TASK_BOARD.md` 표. First Task 완료 전 다음 Task 시작 불가.

**이전 런**: CI GATE PASSED ✅ (미들웨어·CTA href·lint/test/build 통과).

---

## First Task (1개) — 현재

§2 영어/한국어 진입 플로우 + 로딩 문구: 영어 진입도 "질문 먼저 → 답 → Center 메인". 전환 중 로딩/대기 문구 locale에 맞게(i18n center.loading).

- §9 순서: §3 완료 후 §2. UI·i18n(4순위).
- §2: Center 진입 경로 locale별 동일 "질문 먼저" 플로우, 로딩/대기 문구 i18n.

---

## Run Order

C1 → (C2 | C3) → C4(C3 Exit 후) → C5(C2·C3·C4 Exit 후).

---

## Start Trigger (잠금)

| 커서 | Start Trigger |
|------|---------------|
| C1 | [ ] (항상) |
| C2 | [ ] C1 Exit 모두 체크 |
| C3 | [ ] C1 Exit 모두 체크 |
| C4 | [ ] C1 Exit [ ] C3 Exit |
| C5 | [ ] C2 Exit [ ] C3 Exit [ ] C4 Exit |

---

## Exit Criteria (검증 가능한 조건만)

| 커서 | Exit Criteria |
|------|---------------|
| C1 | [ ] 목표 1줄(§2) [ ] 보드 Start/Exit [ ] EXECUTION_PLAN |
| C2 | [ ] §2 변경분 Gate 해당 시 체크 [ ] BTY_RELEASE_GATE_CHECK.md 반영 |
| C3 | [ ] 진입/라우트 변경 시 npm test 통과 |
| C4 | [ ] EN/KO 동일 "질문 먼저" 플로우 [ ] 로딩 문구 locale 분기 [ ] npm run lint 통과 |
| C5 | [ ] lint [ ] test [ ] build 통과 |

---

## Blockers & Escalation

| 커서 | 막히면 |
|------|--------|
| C1 | 제품/커맨더 |
| C2 | 커맨더 |
| C3 | C1/커맨더 |
| C4 | C3 |
| C5 | C3 또는 C4 |

---

## Final Gate

[ ] `./scripts/orchestrate.sh` 또는 `./scripts/ci-gate.sh` 실행 성공.
