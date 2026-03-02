# 커맨더·커서 정리 — 누가 뭘 보고, 누구에게 명령 내리는지

**이 문서만 열어두고** 보면서, 어떤 서류를 보고 누구에게 무엇을 지시할지 참고하세요.

---

## 1. 역할 정리 (누가 누구인지)

| 누구 | 역할 | 하는 일 |
|------|------|---------|
| **당신 (커맨더)** | 지시·결정 | 서류 보고, 각 Cursor에게 **복사용 프롬프트**를 붙여 넣어서 명령함. |
| **Cursor 1** | 진행 에이전트 | 구현·코드 수정. "이거 구현해줘" 지시를 받으면 함. |
| **Cursor 2** | 검증 에이전트 (또는 병렬 작업) | 구현 검증 또는 배포 체크·체크리스트 작성 등. |
| **Cursor 3** | (선택) | 진행 또는 검증 보조. |
| **Cursor 4** | (현재) **Arena 코드네임·아바타** | **`docs/ARENA_CODENAME_AVATAR_PLAN.md`** 기준으로 작업. 리더보드 아바타 역전 버그 확인·수정, 코드네임 “코드별 1회” 규칙, 캐릭터 고정+옷 선택 시스템. **참고:** 이 영역은 Cursor 4가 담당하므로 다른 커서에 아바타/코드네임 지시하지 말 것. |

- **커맨더 = 당신.** 계획서를 수정하는 "서커 에이전트"는 선택 사항이고, **지금은 당신이 서류를 보고 두 Cursor에게 명령을 내리는 구조**로 보면 됩니다.

---

## 2. 각 Cursor에게 "이 파일만 보라"고 할 때 (한 줄씩 복사)

**Cursor 1 (진행용)** 에 처음 지시할 때:

```
docs/AGENTS_SHARED_README.md, docs/CURRENT_TASK.md 읽고, 아래 지시 따르면 돼.
```

**Cursor 2 (검증/병렬용)** 에 처음 지시할 때:

```
docs/AGENTS_SHARED_README.md, docs/NEXT_STEPS_RUNBOOK.md 읽고, 아래 지시 따르면 돼.
```

- 지시 내용(아래 §4)은 **NEXT_STEPS_RUNBOOK** 에서 복사해서 붙여 넣으면 됩니다.

---

## 3. 당신이 볼 서류 (순서대로, 복사해서 Cmd+P로 열기)

아래 **한 파일만** 메인으로 보면 됩니다. 나머지는 필요할 때만 참고.

| 순서 | 파일 | 언제 보나 |
|------|------|-----------|
| **1** | **`docs/COMMANDER_CURSORS_REF.md`** | **지금 문서.** 누가 누구인지, 뭘 보는지, 누구에게 뭘 하라고 하는지 요약. |
| **2** | **`docs/NEXT_STEPS_RUNBOOK.md`** | **명령 내릴 때마다.** 여기 있는 "복사용 프롬프트"를 그대로 복사해 Cursor 1 또는 2에 붙여 넣음. |
| 3 | `docs/CURRENT_TASK.md` | "이번에 구현할 기능"이 뭔지 확인·추가할 때. |
| 4 | `docs/PROJECT_BACKLOG.md` | 완료된 항목·다음 백로그 확인할 때. |
| 5 | `docs/PROJECT_PROGRESS_ORDER.md` | 다음 권장 작업(Dojo·Dear Me 2차 등) 확인할 때. |
| **6** | **`docs/ARENA_CODENAME_AVATAR_PLAN.md`** | **Cursor 4** 작업 범위: 리더보드 아바타·코드네임·캐릭터+옷 계획 확인할 때. |
| **7** | **`docs/WHAT_NEXT.md`** | **지금까지 마무리된 것 + 다음에 할 일** 한눈에 볼 때. |
| **8** | **`docs/ENGINE_ARCHITECTURE_DIRECTIVE_PLAN.md`** | **Leadership Distortion Engine** (Stage/AIR/TII/Certified/LRI) 단계별 계획·복사용 프롬프트. 여러 Cursor에 P0~P8 지시할 때 사용. **→ 아래를 해당 Cursor에 붙여 넣기 전에 `docs/AGENTS_SHARED_README.md`, `docs/ENGINE_ARCHITECTURE_DIRECTIVE_PLAN.md` 를 열어 두라고 안내한다.** |

- **매번 명령 내릴 때:** **NEXT_STEPS_RUNBOOK** 열고 → 해당 프롬프트 복사 → 대상 Cursor에 붙여 넣기.
- **ENGINE_ARCHITECTURE_DIRECTIVE_PLAN.md** 의 복사용 프롬프트(P0~P8)를 Cursor에 붙여 넣을 때는, **먼저** 해당 Cursor에 `docs/AGENTS_SHARED_README.md` 와 `docs/ENGINE_ARCHITECTURE_DIRECTIVE_PLAN.md` 를 열어 두라고 안내한 뒤 붙여 넣기.

---

## 4. 서류에서 무엇을 보고, 누구에게 어떤 명령을 내리면 되는지

| 당신이 보는 서류 | 그 안에서 보는 내용 | 누구에게 | 어떤 명령 (예시) |
|------------------|---------------------|----------|-------------------|
| **NEXT_STEPS_RUNBOOK** §6 | "옵션 A — Dojo·Dear Me 2차" 블록 | **Cursor 1** | 블록 통째로 복사해 붙여 넣기. → "Dojo·Dear Me 2차 구현해줘." |
| **NEXT_STEPS_RUNBOOK** §6 | "역할 1 — 검증 (진행이 끝난 뒤)" 블록 | **Cursor 2** | 블록 통째로 복사해 붙여 넣기. → "방금 구현 끝났어. 검증해줘." |
| **NEXT_STEPS_RUNBOOK** §6 | "역할 2 — 지금 바로 (병렬 작업)" 배포 전 체크 | **Cursor 2** | 해당 프롬프트 복사해 붙여 넣기. → "배포 전 체크해줘." |
| **NEXT_STEPS_RUNBOOK** §2 | 단계 1 진행 / 단계 1 검증 | **Cursor 1** / **Cursor 2** | 단계 1 진행 → Cursor 1에, 단계 1 검증 → Cursor 2에 복사. |
| **CURRENT_TASK** | "이번에 구현할 기능" 칸 | (지시할 때 참고) | 여기 적힌 걸 Cursor 1에게 "이거 구현해줘" 하고 지시. |
| **PROJECT_BACKLOG** | §1~§6 상태 | (참고만) | 다음에 뭘 시킬지 정할 때 참고. |

- **정리:**  
  - **구현 시키고 싶으면** → NEXT_STEPS_RUNBOOK에서 **진행용 프롬프트** 찾아서 **Cursor 1**에 붙여 넣기.  
  - **검증·체크 시키고 싶으면** → NEXT_STEPS_RUNBOOK에서 **검증/병렬용 프롬프트** 찾아서 **Cursor 2**에 붙여 넣기.

---

## 5. 한 줄 요약

- **당신이 볼 서류:** 이 문서(**COMMANDER_CURSORS_REF**) + **NEXT_STEPS_RUNBOOK** (명령할 때마다).
- **Cursor 1:** `AGENTS_SHARED_README` + `CURRENT_TASK` 보라고 한 뒤, RUNBOOK에 있는 **진행용** 프롬프트로 지시. (작업 끝나면 서류 갱신은 **AGENTS_SHARED_README**에 적혀 있음 — 다른 Cursor도 상태를 알 수 있도록.)
- **Cursor 2:** `AGENTS_SHARED_README` + `NEXT_STEPS_RUNBOOK` 보라고 한 뒤, RUNBOOK에 있는 **검증/병렬** 프롬프트로 지시. (검증·체크 끝나면 서류 갱신 — RUNBOOK §6-4·§6-5, 체크리스트 등.)
- **누구에게 명령할지:** 구현 → Cursor 1, 검증·배포 체크·체크리스트 → Cursor 2.
- **현재 상태:** Cursor 4 = **Arena 코드네임·아바타** (`docs/ARENA_CODENAME_AVATAR_PLAN.md`). 리더보드 아바타 역전(Inferno/Spark) 확인·수정, 코드네임 코드별 1회 규칙, 캐릭터 고정+옷 선택 단계 진행. 상세·다음 과정은 **`docs/NEXT_STEPS_RUNBOOK.md`** §6 "다음 과정" 및 **`docs/ARENA_CODENAME_AVATAR_PLAN.md`** 참고.
