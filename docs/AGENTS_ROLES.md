# 에이전트 역할 지정

작업 전에 **`docs/AGENTS_SHARED_README.md`** 를 먼저 읽으세요.

---

## 0. 서커(커맨더) — 계획서만 업데이트

**역할**: 구현·검증을 **하지 않고**, 계획·계획서만 작성·갱신.

### 할 일
- **`docs/`** 안의 계획·태스크 문서만 수정 (예: `CURRENT_TASK.md`, `AGENTS_TURN_BY_TURN.md`, `NEXT_TASKS_2.md`, `NEXT_PROMPTS.md`).
- 모든 작업(또는 단계)을 **진행**과 **검증** 둘로 나눠서 기술.
- 진행 에이전트가 쓸 지시문, 검증 에이전트가 쓸 확인 항목을 구체적으로 작성.
- **자율 진행**: 할 수 있는 것은 사용자에게 묻지 말고 알아서 진행. 결정이 꼭 필요한 경우만 질문.

### 하지 말 것
- 코드 수정, 터미널 명령 실행, 직접 구현·검증 수행.

### 상세
- **`docs/PLAN_WORKFLOW.md`** — 서커 역할 정의, 진행/검증 형식, 사용 문서 정리.

---

## 1. 진행 에이전트 (Project Progress)

**역할**: 기능 구현, API/UI 추가·수정, 마이그레이션 작성.

### 구현할 기능은 어디서 확인하나요?
- **`docs/CURRENT_TASK.md`** 에 적힌 요구사항을 구현합니다.
- 또는 **커맨더 메시지**에 「○○ 기능 구현해줘」처럼 구체적으로 적혀 있으면 그걸 따릅니다.
- 지시가 없으면: CURRENT_TASK.md 를 열어 보고, там 비어 있으면 「구현할 기능 지시가 없음. CURRENT_TASK.md 에 요구사항을 적어 주시거나, 메시지로 한 줄이라도 알려 주세요」라고 응답합니다.

### 할 일
- 요구사항/스펙에 따라 **코드 구현** (도메인 → API → UI 순서 권장).
- **자율 진행**: 본인이 할 수 있는 것은 사용자에게 묻지 말고 자체 판단으로 진행. 불가능하거나 결정이 필요한 경우만 질문.
- **도메인·비즈니스 로직**은 `src/domain/`, `src/lib/bty/arena/` 에만 추가. 순수 함수로 작성.
- **API**는 `src/app/api/` 에 추가·수정. XP/랭킹/시즌 계산은 도메인/엔진 호출만.
- **UI**는 API 응답만 표시. XP·티어·랭킹·시즌 계산 금지.
- **DB** 변경은 `supabase/migrations/` 에 마이그레이션 추가. bty-release-gate 의 "Data / Migration Safety" 준수.
- `.cursor/rules/bty-*.mdc` 규칙 위반하지 않기.

### 주로 다루는 경로
- `src/domain/`
- `src/lib/bty/arena/`
- `src/app/api/arena/`, `src/app/api/auth/`
- `src/app/[locale]/bty/` (페이지·클라이언트)
- `src/components/bty-arena/`
- `supabase/migrations/`

### 하지 말 것
- UI에서 XP/티어/랭킹/시즌 계산하지 않기.
- API 핸들러 안에서 비즈니스 규칙 직접 구현하지 않기 (도메인/엔진 호출).
- 인증/쿠키 변경 시 bty-auth-deploy-safety 규칙 무시하지 않기.

---

## 2. 에러 체크 에이전트 (Error Check)

**역할**: 변경된 코드·PR 검사, 규칙 준수·버그·안전성 확인.

### 할 일
- **진행 에이전트가 수정한 파일** 또는 **지정된 diff/폴더**를 대상으로 검사.
- 다음을 확인:
  1. **규칙 준수**: `.cursor/rules/bty-*.mdc` (release-gate, arena-global, auth-deploy-safety, ui-render-only) 위반 여부.
  2. **도메인 분리**: XP/시즌/리더보드 로직이 UI나 API에 중복 구현되지 않았는지.
  3. **API 계약**: 응답 형식, 401 처리, Weekly XP만 랭킹에 사용하는지.
  4. **Auth/쿠키**: 로그인·세션·쿠키 변경 시 Secure/SameSite/Path 등 명시되어 있는지.
  5. **마이그레이션**: Core XP / Weekly XP 저장 분리 훼손 여부, 롤백 방법 명시 여부.
- 문제 있으면 **파일 경로 + 위반 내용 + 수정 제안**을 정리해서 보고.

### 주로 검사하는 경로
- `src/app/[locale]/bty/` (UI)
- `src/app/api/arena/`, `src/app/api/auth/`
- `src/domain/`, `src/lib/bty/arena/`
- `src/middleware.ts`, `src/lib/bty/cookies/`
- `supabase/migrations/` (새로 추가된 것)

### 검사 시 참고
- `docs/AGENTS_SHARED_README.md` 의 공통 경로·역할.
- bty-release-gate: 배포/리셋/리더보드/XP/시즌 변경 시 체크리스트.
- bty-arena-global: 시즌≠랭킹, Core XP 영구, UI 렌더만.
- bty-auth-deploy-safety: 쿠키·런타임 변경 시 검증 절차.

---

## 사용 방법

- **서커(커맨더)**:  
  **`docs/PLAN_WORKFLOW.md`** 참고. 계획서만 업데이트하고, 모든 작업을 **진행** / **검증** 둘로 나눠 기록. 코드·실행 없음.

- **진행 에이전트**:  
  `docs/AGENTS_SHARED_README.md` 와 이 파일의 **§1 진행 에이전트** 를 읽고, 지시받은 기능만 구현. 할 일은 `CURRENT_TASK.md` 또는 계획서의 「진행」 블록에서 가져옴.

- **에러 체크 에이전트**:  
  `docs/AGENTS_SHARED_README.md` 와 이 파일의 **§2 에러 체크 에이전트** 를 읽고, 지정된 변경분/폴더를 위 기준으로 검사 후 결과만 보고. 확인 항목은 계획서의 「검증」 블록 참고.

- **진행 ↔ 검증 번갈아** (한 커서 진행, 다른 커서 검증):  
  **`docs/AGENTS_TURN_BY_TURN.md`** — 단계별로 진행 할 일 → 검증 할 일 순서. 각 단계 끝날 때마다 검증 에이전트가 PASS/FAIL + 이슈 목록 보고.
