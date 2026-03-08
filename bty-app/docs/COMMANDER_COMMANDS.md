# 커맨더에게 내릴 명령어

상황별로 커맨더(또는 C1)가 실행할 지시문. 복사해 해당 Cursor에 붙여넣기.

---

## 1. 새로운 기능 시작할 때

**C1 Commander에 붙여넣기:**

```
[BTY PARALLEL EXECUTION MODE] 현재 CURSOR_TASK_BOARD.md·CURRENT_TASK.md 기준 First Task 확인. 목표 1줄을 CURRENT_TASK.md에 작성하고, 보드 C1~C5 Start/Exit 갱신. 완료 시 C2·C3·C4에 아래 C) 명령어 각각 전달해 병렬 시작하라.
```

---

## 2. Gate FAIL 났을 때

**C2 Gatekeeper에 붙여넣기:**

```
BTY_RELEASE_GATE_CHECK.md에 기록된 FAIL 항목·위반 목록 확인. 해당 변경 담당 Cursor(C3/C4)에게 패치 지시 1~3개(파일 경로·최소 diff) 전달. 패치 반영 후 동일 변경분으로 Gate 재검사 후 PASS/FAIL·BTY_RELEASE_GATE_CHECK.md 갱신.
```

---

## 3. C3 끝났을 때

**C5 Integrator에 붙여넣기 (C2·C4 Exit 이미 있으면):**

```
C2·C3·C4 Exit 모두 확인. 세 개 모두 [x]면: npm run lint && npm test && npm run build 실행. 성공 시 ./scripts/orchestrate.sh 실행. 결과를 CURRENT_TASK.md § Integrator 검증 + CURSOR_TASK_BOARD C5에 반영.
```

**C4가 아직이면:** C4에게 UI 명령 전달 후, C4 Exit 후 위 C5 명령 실행.

---

## 4. C4 끝났을 때

**C5 Integrator에 붙여넣기 (C2·C3 Exit 이미 있으면):**

```
C2·C3·C4 Exit 모두 확인. 세 개 모두 [x]면: npm run lint && npm test && npm run build 실행. 성공 시 ./scripts/orchestrate.sh 실행. 결과를 CURRENT_TASK.md § Integrator 검증 + CURSOR_TASK_BOARD C5에 반영.
```

**C3가 아직이면:** C3에게 Domain/API 명령 전달. C3 Exit 후 위 C5 명령 실행.

---

## 5. 린트 고쳤을 때

**C5 Integrator에 붙여넣기:**

```
C2·C3·C4 Exit 확인. 모두 [x]일 때만: npm run lint && npm test && npm run build 실행. 실패 시 실패 단계·로그 요약을 CURRENT_TASK.md에 기록하고 C3 또는 C4에 넘겨. 성공 시 ./scripts/orchestrate.sh 실행 후 CURRENT_TASK.md·CURSOR_TASK_BOARD C5 갱신.
```

---

## 6. 배포 직전

**C5 Integrator에 붙여넣기:**

```
배포 직전 최종 Gate. C2 Exit(규칙·BTY_RELEASE_GATE_CHECK 반영) 확인. npm run lint && npm test && npm run build 실행. 성공 시 ./scripts/orchestrate.sh 실행. (Workers 검증 필요 시 BASE·LOGIN_BODY 설정해 orchestrate.sh 실행.) 결과 PASS/FAIL·쿠키·401·leaderboard 요약을 CURRENT_TASK.md § Integrator 검증에 반영.
```

---

## [BTY PARALLEL EXECUTION MODE] — 현재 코드 상태 기준 계획

### A) First Task (1개)

**감정 스탯 v3 확장**

- coreStats v3 이벤트 14종·stat_distribution·30일 가속·phase_tuning을 formula·recordEmotionalEventServer에 반영.
- HEALING_COACHING_SPEC_V3·healing-coaching-spec-v3.json 기준.
- 근거: Auth(1) 없음 → API Contract(2)·Domain/Engine(3) 순.

---

### B) CURSOR TASK PLAN

**C1 Commander**

| Start Trigger | Exit Criteria |
|---------------|----------------|
| 항상 가능 | [ ] CURRENT_TASK.md 목표 1줄(감정 스탯 v3) 작성 [ ] CURSOR_TASK_BOARD.md C1~C5 Start/Exit 정의·갱신 |

**C2 Gatekeeper**

| Start Trigger | Exit Criteria |
|---------------|----------------|
| [ ] C1 Exit | [ ] .cursor/rules·bty-release-gate·bty-auth-deploy-safety 대조 [ ] 감정 스탯 v3 변경분 Gate A·Auth·F 검사 [ ] BTY_RELEASE_GATE_CHECK.md 업데이트 [ ] Exit 체크 |

**C3 Domain/API**

| Start Trigger | Exit Criteria |
|---------------|----------------|
| [ ] C1 Exit | [ ] v3 이벤트·formula·recordEmotionalEventServer 반영(도메인만 비즈니스 규칙) [ ] npm test 통과 [ ] Exit 체크 |

**C4 UI**

| Start Trigger | Exit Criteria |
|---------------|----------------|
| [ ] C1 Exit | [ ] 감정 스탯 v3 표시 UI render-only(API/도메인 값만) [ ] tsc --noEmit 통과 [ ] Exit 체크 |

**C5 Integrator**

| Start Trigger | Exit Criteria |
|---------------|----------------|
| [ ] C2 Exit [ ] C3 Exit [ ] C4 Exit | [ ] npm run lint 통과 [ ] npm test 통과 [ ] npm run build 통과 [ ] 성공 시 ./scripts/orchestrate.sh |

**병렬**: C2·C3·C4는 C1 Exit 후 동시 시작. C5는 C2·C3·C4 Exit 후 1회만 실행.

---

### C) 각 커서 실행 명령 (1줄)

| 커서 | 명령 |
|------|------|
| **C2** | CURSOR_TASK_BOARD C2 체크리스트대로 .cursor/rules·BTY_RELEASE_GATE_CHECK 대조. 감정 스탯 v3 변경분 Gate A·Auth·F 해당 시 PASS/FAIL 반영 후 Exit 체크. |
| **C3** | HEALING_COACHING_SPEC_V3·healing-coaching-spec-v3.json 기준 coreStats v3 이벤트 14종·stat_distribution·30일 가속·phase_tuning을 formula·recordEmotionalEventServer에 반영. 도메인만 비즈니스 규칙. npm test 통과 후 Exit 체크. |
| **C4** | 감정 스탯 v3 표시 UI. API/도메인에서 계산된 값만 표시(render-only). 챗/멘토·display 연동. tsc --noEmit 통과 후 Exit 체크. |
| **C5** | C2·C3·C4 Exit 확인 후 npm run lint && npm test && npm run build. 성공 시 ./scripts/orchestrate.sh 실행. |

---

**추가 규칙**

- C2·C3·C4는 C1 Exit 후 병렬로 시작.
- Lint 실패는 C4 작업 시작을 막지 않음. 전체 lint/test/build 검사는 C5에서만 수행.
- C5는 C2·C3·C4 Exit 모두 충족된 뒤 1회만 실행.
