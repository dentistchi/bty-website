# PROJECT MEMORY

이 문서는 BTY 프로젝트의 **장기 기억 저장소**다.

## 목적

1. 반복 버그를 기록한다.
2. 실패한 작업과 원인을 기록한다.
3. 구조 변경 후 후속 작업을 기록한다.
4. C1이 다음 작업을 더 정확히 선택하도록 돕는다.

---

## PROJECT MEMORY SYSTEM

작업 라운드가 끝나면 **docs/agent-runtime/PROJECT_MEMORY.md** 를 확인한다.

### 규칙

1. **완료된 작업**은 memory entry를 남긴다.
2. **실패한 작업**도 반드시 memory entry를 남긴다.
3. **ROOT CAUSE** 를 한 줄로 남긴다.
4. **FOLLOW-UP** 이 있으면 다음 backlog 후보로 연결한다.
5. 이미 **같은 ROOT CAUSE** 로 실패한 작업이 있으면 우선 경고한다.
6. **다음 작업 선택 시** PROJECT_MEMORY를 참고해서 반복 실패를 피한다.

---

## C1이 기억해야 하는 대표 항목

BTY 프로젝트 기준으로 아래 유형을 기억하면 좋다.

### A. 반복 버그

- leaderboard tie-break 계속 깨짐
- mentor request status shape mismatch
- UI가 XP를 다시 계산하려고 함

### B. 구조 변경

- docs/ 단일 진실로 마이그레이션 완료
- src/domain/rules → src/domain/arena/* 점진 이동 시작
- chat system boundary 분리 시작

### C. 후속 작업

- API 먼저 끝났고 UI가 아직 남음
- UI는 끝났고 integration polish가 남음
- build는 통과했지만 docs sync 미완료

### D. 금지 패턴

- domain에서 lib/bty import 금지
- UI에서 business logic 금지
- bty-app/docs 에 운영 문서 재생성 금지

---

## 추천하는 MEMORY 분류 태그

기억을 더 잘 쓰려면 NOTES에 아래 태그를 붙인다.

- `[BUG]`
- `[ARCH]`
- `[DOCS]`
- `[IMPORT]`
- `[BOUNDARY]`
- `[FOLLOW-UP]`
- `[RELEASE]`

**예**

```text
## NOTES
- [BOUNDARY] Arena 작업 중 Center domain 수정 금지
- [FOLLOW-UP] mentor admin review flow 필요
- [ARCH] domain purity 규칙 위반 사례 재발 방지
```

C1이 **다음 작업을 고를 때** 출력 형식에 아래 한 줄을 추가한다.

```text
MEMORY NOTE:
- 이전 라운드에서 mentor request status shape mismatch가 있었으므로 API 계약 확인 우선
```

---

## SELF HEAL과 연결

PROJECT MEMORY는 **SELF HEAL**과 같이 쓰면 더 강하다.

**흐름 예**

1. build 실패
2. SELF HEAL이 수정 작업 생성
3. 수정 후 **PROJECT_MEMORY**에 ROOT CAUSE 기록

**예시 (실패·수정 후 memory entry)**

```text
## RESULT
FAIL

## ROOT CAUSE
src/domain 에서 src/lib/bty import 발생

## FOLLOW-UP
- import boundary lint rule 추가
- 유사 import 재검색
```

---

## FEATURE PIPELINE과 연결

PROJECT MEMORY는 **feature 단위**로도 연결된다.

**예**

- **FEATURE:** Mentor System  
- 그 아래 task memory가 쌓이면 C1은 다음처럼 판단할 수 있다.
  - mentor request API 완료
  - mentor request UI 완료
  - integration 이슈 있었음
  - follow-up: admin review flow

즉 **기능 전체 맥락**이 MEMORY LOG에 남는다.

---

## MEMORY ENTRY FORMAT

```text
## DATE
YYYY-MM-DD

## ROUND
ROUND 번호

## MODE
ARENA / CENTER / FOUNDRY / PLATFORM

## FEATURE
기능 그룹 이름

## TASK
작업 이름

## RESULT
DONE / FAIL / PARTIAL

## ROOT CAUSE
실패 또는 수정 원인의 핵심 한 줄

## FILES
- 관련 파일
- 관련 파일

## FOLLOW-UP
- 다음에 이어서 해야 할 작업
- 후속 수정 필요 항목

## NOTES
- 장기적으로 기억해야 할 점
```

---

## MEMORY LOG

### DATE
2026-03-08

### ROUND
31

### MODE
ARENA

### FEATURE
Mentor System

### TASK
[UI] 엘리트 멘토 대화 신청 플로우

### RESULT
DONE

### ROOT CAUSE
UI는 render-only로 유지하고 mentor request 계약은 API/service에서 확정해야 함

### FILES
- src/app/[locale]/bty-arena/...
- src/components/bty-arena/...
- src/app/api/me/mentor-request/...

### FOLLOW-UP
- mentor request admin review flow
- mentor request status badge polish

### NOTES
- mentor request는 Elite 전용 조건을 UI에서 재판단하지 말고 API 응답 기준으로 표시
