# 태스크 타입별 Cursor 셋업

**Feature / Fix·Polish / Explore·Plan** 세 개 창으로 나눌 때, 각 창에서 **어떤 파일을 열고**, **공동 파일(태스크 보드)을 어떻게 쓰는지** 정리한 문서.

---

## 1. 창별로 열어둘 파일

같은 프로젝트 폴더(`btytrainingcenter`)를 **3번** 연다 → Cursor 창 3개.

### Cursor 1: **Feature** (기능 개발)

**브랜치:** `feature/xxx` (작업 주제에 맞게, 예: `feature/leaderboard-season`)

**항상 열어둘 파일:**
- `docs/CURSOR_TASK_BOARD.md` — 공동 태스크 보드 (작업 가져갈 때·완료 시 여기 표 업데이트)
- 이번에 손댈 영역 1~2개:
  - 예: `bty-app/src/app/api/arena/leaderboard/route.ts`
  - 예: `bty-app/src/lib/bty/arena/activeLeague.ts`

**첫 메시지 예시:**  
“이 창은 **Feature**용이야. 지금 할 일: [보드에서 가져온 작업]. feature 브랜치에서만 수정해. 작업 끝나면 태스크 보드 상태를 **완료**로 바꿔줘.”

---

### Cursor 2: **Fix/Polish** (버그·다듬기·문서)

**브랜치:** `main` 또는 `fix/xxx`

**항상 열어둘 파일:**
- `docs/CURSOR_TASK_BOARD.md` — 공동 태스크 보드
- 이번에 손댈 파일 1~2개:
  - 예: 버그면 해당 페이지/API 파일
  - 예: 문서면 `docs/xxx.md`, README

**첫 메시지 예시:**  
“이 창은 **Fix/Polish**용이야. 지금 할 일: [보드에서 가져온 작업]. main(또는 fix 브랜치)에서 수정해. 작업 끝나면 태스크 보드 상태를 **완료**로 바꿔줘.”

---

### Cursor 3: **Explore/Plan** (조사·설계)

**브랜치:** `main` (보통 수정 없음) 또는 조사만

**항상 열어둘 파일:**
- `docs/CURSOR_TASK_BOARD.md` — 공동 태스크 보드
- `docs/MULTI_CURSOR_WORKFLOW.md` — 워크플로우 참고
- 조사할 영역 (필요할 때만):
  - 예: `bty-app/src/lib/bty/arena/` (폴더만 열어두고 Chat으로 질문)

**첫 메시지 예시:**  
“이 창은 **Explore/Plan**용이야. 코드 수정은 최소로 하고, 조사·설계·다음 작업 목록 정리해줘. 지금 할 일: [보드에서 가져온 작업]. 작업 끝나면 태스크 보드 상태를 **완료**로 바꿔줘.”

---

## 2. 공동 프로젝트 파일(태스크 보드) 쓰는 법

- **파일 하나**: `docs/CURSOR_TASK_BOARD.md`
- **역할**: 지금 누가 무슨 일을 하는지 적어두고, 서로 업데이트해서 겹치지 않게 함.

### 진행 순서

1. **작업 정하기**  
   - 할 일이 생기면 태스크 보드를 연다.
   - 표 맨 위에 새 행을 하나 추가한다:  
     `| Feature | Leaderboard 시즌 API 연동 | 진행 중 | |`

2. **Cursor에서 작업**  
   - 해당 타입 Cursor에서 그 행의 할 일을 그대로 지시한다.  
     “태스크 보드에 있는 **Leaderboard 시즌 API 연동** 이거 해줘.”

3. **완료 후**  
   - AI가 작업을 마치면:
     - 태스크 보드에서 그 행의 상태를 `완료`로 바꾸고,  
       필요하면 비고에 한 줄 요약(예: “GET /api/arena/league/active 연동 완료”)을 적게 한다.
     - **Mac 알림**은 프로젝트 규칙으로 자동 실행된다(아래 3절).

4. **다른 Cursor에서**  
   - `git pull` 한 뒤 `CURSOR_TASK_BOARD.md`를 다시 열어서 완료된 일·진행 중인 일을 확인한다.

---

## 3. 작업 완료 시 Mac 알림

이 프로젝트에는 **작업 완료 시 Mac 알림** 규칙이 들어 있다.  
모든 Cursor 창에서, AI가 사용자 요청을 끝냈을 때 자동으로 다음 알림이 뜨도록 되어 있다.

- **규칙 파일:** `.cursor/rules/complete-notify.mdc`
- **동작:** 응답 마지막에 `osascript`로 macOS 알림을 한 번 띄운다.

그래서 **창을 나눠도** Feature / Fix·Polish / Explore·Plan 어느 쪽이든, 작업이 끝나면 Mac에서 알람(알림)이 뜨도록 설정되어 있다.

---

## 4. 요약 체크리스트

- [ ] Cursor 3개 창을 같은 프로젝트 폴더로 연다.
- [ ] 창마다 역할을 정한다: Feature / Fix·Polish / Explore·Plan.
- [ ] 각 창에 `docs/CURSOR_TASK_BOARD.md`를 열어둔다.
- [ ] 할 일이 있으면 태스크 보드 표에 한 줄씩 추가하고, 해당 Cursor에서 그 할 일을 지시한다.
- [ ] 작업이 끝나면 태스크 보드 상태를 `완료`로 바꾸고, 다른 창은 `git pull` 후 보드를 새로고침한다.
- [ ] 완료 시 Mac 알림은 규칙으로 자동 실행된다.

---

## 5. Rule / Subagent / Skill과 함께 쓰기

세 Cursor 창은 **같은 프로젝트 폴더**를 열기 때문에 `.cursor/rules/`, `.cursor/agents/`, `.cursor/skills/`를 **공유**합니다. 따라서 **세 창 모두에서 동일한 rule·subagent·skill이 적용**됩니다. 창별로 “언제 무엇을 쓰면 좋은지”만 정해두면 됩니다.

### 5-1. 같이 잘 작동할까?

**예.**  
- **Rules**: 항상 적용되는 것(bty-arena-global, bty-release-gate)은 세 창 공통. 파일 경로 기반 rule(domain, UI, migration)은 **해당 파일을 연/수정하는 창**에서만 활성화됩니다.  
- **Subagents**: 채팅에서 에이전트 이름을 지정해 호출하면, 그 창에서만 실행됩니다. 창마다 역할(Feature / Fix / Explore)에 맞는 에이전트를 부르면 됩니다.  
- **Skills**: “이 스킬로 해줘”라고 하거나, 질문이 스킬 설명과 맞을 때 사용됩니다. 창별로 **어떤 질문을 할지**만 나누면 스킬이 겹치지 않고 잘 쓰입니다.

즉, **세 창이 서로 다른 파일·다른 질문을 담당**하므로 rule/agent/skill이 충돌하지 않고, 오히려 창별 역할에 맞게 나눠 쓰기 좋습니다.

### 5-2. 창별로 추천하는 사용법

| 창 | 이 창에서 하기 좋은 것 | 쓰기 좋은 Rule / Agent / Skill |
|----|------------------------|--------------------------------|
| **Feature** (코드 작성) | API·엔진·UI 구현, 마이그레이션 추가 | **자동**: bty-arena-global, bty-release-gate, bty-domain-pure-only(domain 파일), bty-ui-render-only(arena UI), bty-arena-data(migration). **호출**: `bty-engine-implementer`, `bty-arena-data-engineer`, `bty-arena-ui` (작업 영역에 맞게). |
| **Fix/Polish** (에러 교정) | 버그 수정, 린트/타입 수정, 문서 보강, auth/미들웨어 수정 | **자동**: 위와 동일. **호출**: `bty-arena-rules`(규칙 위반 검사), `bty-auth-deploy-safety`(auth/쿠키/미들웨어 변경 시). **스킬**: diff 요약 붙여넣고 “규칙 위반 검사해줘” → **bty-arena-change-review**. |
| **Explore/Plan** (계획·구상) | 스펙 정리, API 설계, 기능 영향 분석, 마이그레이션 검토(코드 수정 없이) | **호출**: `bty-domain-architect`(도메인 규칙 정의/변경). **스킬**: `<<< 기능 요청 내용 >>>` 붙여서 “영향 분석해줘” → **feature-request-impact-analysis**; UI 요구사항 붙여서 “API 계약 설계해줘” → **api-contract-from-ui**; 마이그레이션 SQL 붙여서 “안전성 검토해줘” → **evaluate-migration-safety**. 리팩터만 할 때 → **refactor-code-constraints**. |

### 5-3. 가장 잘 쓰는 법 (요약)

1. **Feature 창**: 할 일 지시할 때 “이 영역만 수정해”를 한 줄 넣고, 필요하면 “bty-engine-implementer로 구현해줘”처럼 **에이전트 이름**을 명시한다.  
2. **Fix/Polish 창**: 수정 전/후로 변경분을 복사해 “<<< diff >>> 규칙 위반 검사해줘”라고 하면 **bty-arena-change-review** 스킬이 잘 맞는다. auth/쿠키/미들웨어 건드리면 “bty-auth-deploy-safety 기준으로 검토해줘”라고 부른다.  
3. **Explore/Plan 창**: 코드 수정은 최소로 하고, “기능 요청 영향 분석”, “API 계약 설계”, “마이그레이션 안전성 평가”처럼 **스킬 이름을 붙여서 요청**하면 해당 스킬이 적용되기 쉽다.

이렇게 쓰면 **코드 작성 / 에러 교정 / 계획·구상** 세 창이 같은 rule·agent·skill을 공유하면서도, 창마다 다른 용도로 잘 나뉘어 동작합니다.
