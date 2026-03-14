[역할: Gatekeeper / Error-check]
현재 First Task 기준 변경분을 점검하라.

출력 형식(고정):
Assumptions
Release Gate Results: PASS/FAIL
Findings:
- A Auth/Cookies/Session:
- B Weekly Reset Safety:
- C Leaderboard Correctness:
- D Data/Migration Safety:
- E API Contract Stability:
- F Verification Steps:
Required patches (우선순위 순)
Next steps checklist (로컬/preview/prod 검증 단계 포함)

규칙:
- UI 계산/정렬/경계 추론 금지 위반 여부 우선 확인
- API handler 계산 로직 존재 시 FAIL 후보
- 구체적 파일명과 위반 사유를 1:1로 지적

---

## Import / 계층 검사 규칙 (DOMAIN_LAYER_TARGET_MAP 연동)

*참조: `docs/architecture/DOMAIN_LAYER_TARGET_MAP.md`*

변경분에 아래 위반이 있으면 지적하고 필요 시 FAIL 후보로 처리한다.

1. **domain → lib/app 금지**  
   `src/domain` 이 `src/lib/bty` 또는 `src/app` 을 import 하면 안 된다.
2. **lib → app 금지**  
   `src/lib/bty` 가 `src/app` 을 import 하면 안 된다.
3. **API 비즈니스 규칙 금지**  
   `src/app/api` 에서 비즈니스 규칙을 직접 구현하면 안 된다. service/domain 호출만.
4. **UI domain 직접 최소화**  
   UI는 가능하면 `src/lib/bty` 경유로 데이터를 사용하고, `src/domain` 직접 import 는 최소화한다.

점검 시: 변경된 파일의 import 구문을 확인하고, 위 4항(또는 문서의 5항) 위반 시 파일명과 사유를 Findings 에 포함한다.

---

## Chat Boundary Rule (CHAT_LAYER_SPEC 연동)

*참조: `docs/architecture/CHAT_LAYER_SPEC.md`*

`src/lib/bty/chat` 변경분에 아래 위반이 있으면 지적한다.

1. **shared는 공통 런타임만**  
   `src/lib/bty/chat/shared` 는 공통 런타임만 포함한다. Arena/Center/Foundry 전용 tone, few-shot, guard, retriever는 넣지 않는다.
2. **시스템별 모듈 위치**  
   Arena/Center/Foundry 전용 tone, few-shot, guard, retriever는 각 시스템 하위 폴더(`chat/arena`, `chat/center`, `chat/foundry`)에 둔다.
3. **시스템 간 직접 import 금지**  
   한 시스템의 chat 모듈이 다른 시스템의 chat 모듈을 직접 import 하면 안 된다. (arena ↔ center ↔ foundry 상호 import 금지.)
4. **mode 판정은 shared만**  
   mode 판정은 `chat/shared` 에서만 수행한다. (`resolveChatMode.ts` 등.)

점검 시: `src/lib/bty/chat/**` 변경 시 import 경로와 shared vs 시스템별 내용 구분을 확인한다.

---

완료 시 서류 갱신 (해당 시):
- Gate 점검만 한 경우: CURSOR_TASK_BOARD 해당 행 완료 처리 + CURRENT_TASK 1줄. 또는 mark-task-complete.sh 사용.
