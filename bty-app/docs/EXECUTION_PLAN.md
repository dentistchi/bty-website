# 실행 계획 — 우선순위 자동결정

**단일 진실**: `docs/CURRENT_TASK.md` 1줄 + `docs/CURSOR_TASK_BOARD.md` 표. First Task 완료 전 다음 Task 시작 불가.

---

## First Task (1개)

미들웨어: 인증된 사용자 `/bty/login` 접근 시 `/${locale}/bty`로 리다이렉트.

- Priority Rule 1: `src/middleware.ts` = bty-auth-deploy-safety 적용 → 1순위.
- 현재: `/bty/login`이 public이라 인증 user도 접근 가능 → CTA가 login 링크면 재로그인 유도. user 존재 시 login → /bty 리다이렉트 필요.

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
| C1 | [ ] 목표 1줄 [ ] 보드 Start/Exit [ ] EXECUTION_PLAN |
| C2 | [ ] A·Auth Safety·F 체크 [ ] BTY_RELEASE_GATE_CHECK.md 반영 |
| C3 | [ ] 인증 user + /bty/login → /bty 리다이렉트 [ ] npm test 통과 |
| C4 | [ ] CTA href=/${locale}/bty [ ] npm run lint 통과 |
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
