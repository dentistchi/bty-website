# 에이전트 — 먼저 열 파일 & 단계 0~N 복사용 프롬프트

작업 시작 전 **아래 파일들을 먼저 열어 두세요.**  
그 다음, **단계 0(컨텍스트 읽기)** → **단계 1~N** 순서로 복사용 프롬프트를 붙여 넣어 사용하면 됩니다.

---

## 1. 먼저 열 파일 (필수)

| 순서 | 파일 경로 | 용도 |
|------|-----------|------|
| 1 | **`bty-app/docs/AGENTS_SHARED_README.md`** | 에이전트 공통 가이드·규칙·도메인·API·UI·Auth 경로 |
| 2 | **`bty-app/docs/AGENTS_ROLES.md`** | 서커 / 진행 에이전트 / 검증 에이전트 역할 정의 |
| 3 | **`docs/CURRENT_TASK.md`** | 현재 구현할 기능·한 줄 지시·백로그 참조 |
| 4 | **`bty-app/docs/PLAN_WORKFLOW.md`** | 서커 역할·계획서 형식(진행/검증 분리) |
| 5 | **`bty-app/docs/AGENTS_TURN_BY_TURN.md`** | 단계별 진행↔검증 번갈아 할 때 할 일·검증 프롬프트 |
| 6 | **`bty-app/docs/NEXT_PROMPTS.md`** | 다음 작업 복사용 프롬프트·한 줄 지시 |
| 7 | **`bty-app/docs/NEXT_TASKS_2.md`** | 2차 한 줄 지시·진행 방식 (선택) |

**규칙 파일(.cursor/rules/)** — 리포 루트 또는 bty-app 기준:

- `bty-release-gate.mdc` — 배포/리셋/리더보드·XP·시즌
- `bty-arena-global.mdc` — 시즌≠랭킹, Core XP 영구, UI 렌더만
- `bty-auth-deploy-safety.mdc` — 쿠키·세션·런타임
- `bty-ui-render-only.mdc` — UI는 API 값만 표시

---

## 2. 단계 0 — 컨텍스트 읽기 (복사용 프롬프트)

**아래 블록을 복사해 에이전트에게 붙여 넣으면, 컨텍스트 읽기만 시킵니다.**

```
다음 문서들을 읽고 이 대화의 컨텍스트로 삼아줘.

1. bty-app/docs/AGENTS_SHARED_README.md — 에이전트 공통 가이드, 규칙·도메인·API·Auth·UI 경로
2. bty-app/docs/AGENTS_ROLES.md — 내 역할(진행/검증/서커)과 할 일·하지 말 것
3. docs/CURRENT_TASK.md — 지금 구현할 기능·한 줄 지시

읽은 뒤 요약하지 말고, "컨텍스트 읽었어. 다음 지시 기다릴게." 처럼 짧게만 답해줘.
```

---

## 3. 단계 1 — 진행 에이전트에게 할 일 지시 (복사용)

**CURRENT_TASK.md에 적힌 기능을 구현하게 할 때:**

```
docs/CURRENT_TASK.md에 적힌 "이번에 구현할 기능"을 구현해줘.

- docs/AGENTS_SHARED_README.md와 docs/AGENTS_ROLES.md §1(진행 에이전트)를 지켜줘.
- 도메인 → API → UI 순서로 진행. UI에서는 XP/랭킹/시즌 계산 금지, API 값만 표시.
- 할 수 있는 것은 묻지 말고 자율 진행. 결정이 필요할 때만 질문해줘.
```

**특정 한 줄 지시만 줄 때 (예: NEXT_PROMPTS.md / CURRENT_TASK 표에서 복사):**

```
아래 지시만 구현해줘. docs/AGENTS_SHARED_README.md·AGENTS_ROLES.md §1 준수.

[여기에 CURRENT_TASK.md 또는 NEXT_PROMPTS.md의 한 줄 지시 붙여넣기]
```

---

## 4. 단계 2 — 검증 에이전트에게 검사 지시 (복사용)

**방금 진행한 변경분을 검증하게 할 때:**

```
방금 진행 에이전트가 수정한 파일(또는 아래 경로)을 검증해줘.

- docs/AGENTS_SHARED_README.md와 docs/AGENTS_ROLES.md §2(에러 체크 에이전트) 기준으로:
  1. 규칙 준수: .cursor/rules/bty-*.mdc 위반 여부
  2. 도메인 분리: XP/시즌/리더보드 로직이 UI·API에 중복 없는지
  3. API 계약: 응답 형식, 401, Weekly XP만 랭킹에 사용하는지
  4. Auth/쿠키: 변경 시 Secure/SameSite/Path 등 명시 여부
  5. 마이그레이션: Core XP / Weekly XP 분리 훼손·롤백 방법
- 결과를 PASS/FAIL + 발견 이슈 목록(파일 경로 + 위반 내용 + 수정 제안)으로 보고해줘.
```

**특정 단계만 검증할 때 (AGENTS_TURN_BY_TURN.md 1-2 등):**

```
docs/AGENTS_TURN_BY_TURN.md 단계 1 검증(1-2) 프롬프트를 실행해줘. 적용된 "첫인상 히어로+여백"을 규칙 준수와 함께 점검하고, PASS/FAIL + 이슈 목록으로 보고해줘.
```

---

## 5. 단계 3 — 서커(커맨더)에게 계획서만 갱신 지시 (복사용)

```
docs/PLAN_WORKFLOW.md와 docs/AGENTS_ROLES.md §0(서커)에 따라 동작해줘.

- 계획서만 갱신해줘. 코드 수정·터미널 실행·직접 구현·검증은 하지 마세요.
- 수정 대상: docs/CURRENT_TASK.md, docs/AGENTS_TURN_BY_TURN.md, docs/NEXT_TASKS_2.md, docs/NEXT_PROMPTS.md 등 docs/ 내 계획·태스크 문서.
- 각 작업(또는 단계)을 "진행(할 일)" / "검증(확인할 일)" 둘로 나눠서 적어줘.
- 진행 에이전트가 쓸 지시문, 검증 에이전트가 쓸 확인 항목을 구체적으로 작성해줘.
```

---

## 6. 단계 N — 진행 ↔ 검증 번갈아 (한 커서 진행, 다른 커서 검증)

**진행 에이전트(Cursor 1)용:**

```
docs/AGENTS_TURN_BY_TURN.md의 [단계 K] 진행(K-1) 프롬프트를 실행해줘. 해당 단계의 "진행 할 일"만 구현해줘.
```

**검증 에이전트(Cursor 2)용:**

```
docs/AGENTS_TURN_BY_TURN.md의 [단계 K] 검증(K-2) 프롬프트를 실행해줘. 진행 에이전트가 끝낸 단계 K를 점검하고, PASS/FAIL + 발견 이슈 목록으로 보고해줘.
```

**예시 (단계 1만):**

- Cursor 1: `docs/AGENTS_TURN_BY_TURN.md 단계 1 진행 해줘.`
- Cursor 2: `docs/AGENTS_TURN_BY_TURN.md 단계 1 검증 해줘.`

---

## 7. 작업 마친 뒤 서류 갱신 (공통)

**매번 작업 완료하면 서류에 업데이트**한다. 다른 Cursor에서 작업을 마치면 아래를 **반드시 갱신**하세요. **결과(PASS/FAIL·위반 목록·Exit 등)는 공통 서류에 반영**하는 것을 원칙으로 한다.

**공통 서류 (결과 반영 필수)**  
- **`docs/BTY_RELEASE_GATE_CHECK.md`** — Gate 결과(PASS/FAIL)·위반 목록·Findings·Required patches·Next steps  
- **`docs/CURSOR_TASK_BOARD.md`** — 해당 역할 행 Exit [x], 결과 요약(예: Center Gate PASS·위반 0건)  
- **`docs/CURRENT_TASK.md`** — 완료한 항목 [x], "이번에 구현할 기능" 한 줄  

**작업별 추가 갱신**  
- **`docs/NEXT_PROMPTS.md`** / **`docs/NEXT_TASKS_2.md`** — 해당 행 [x]  
- **`docs/AGENTS_TURN_BY_TURN.md`** — 해당 단계 검증 결과(PASS/FAIL) 기록  
- RUNBOOK §6-4·§6-5, WHAT_NEXT.md, 백로그/체크리스트 등 해당 작업에 맞는 서류

---

## 요약 — 복사용 한 줄 안내

| 목적 | 복사할 문장 |
|------|-------------|
| **먼저 열 파일** | `bty-app/docs/` 에서 AGENTS_SHARED_README.md, AGENTS_ROLES.md, CURRENT_TASK.md, PLAN_WORKFLOW.md, AGENTS_TURN_BY_TURN.md, NEXT_PROMPTS.md 열어줘. |
| **단계 0** | 위 §2 "단계 0 — 컨텍스트 읽기" 블록 전체 복사 |
| **단계 1 진행** | 위 §3 "단계 1 — 진행 에이전트에게 할 일 지시" 블록 복사 (또는 CURRENT_TASK 한 줄만) |
| **단계 2 검증** | 위 §4 "단계 2 — 검증 에이전트에게 검사 지시" 블록 복사 |
| **단계 3 서커** | 위 §5 "단계 3 — 서커에게 계획서만 갱신" 블록 복사 |
| **단계 N 번갈아** | §6 예시처럼 "AGENTS_TURN_BY_TURN 단계 K 진행/검증 해줘" |
