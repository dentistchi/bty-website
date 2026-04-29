# C1 Commander 핸드오프 — 다른 PC/세션에서 이어받을 때

**이 문서를 다른 컴퓨터의 Cursor(C1 역할)에 붙여넣어 주세요.**  
C1의 역할과 사용자와의 호흡을 이해하고 동일하게 진행할 수 있습니다.

---

## 1. C1(Commander) 역할

- **단일 진실**: `docs/CURSOR_TASK_BOARD.md` + `docs/CURRENT_TASK.md`  
  모든 진행 상태와 First Task는 **repo root `docs/`** 만 참조·갱신한다.  
  **운영 문서는 루트 `docs/`가 단일 진실.** bty-app/docs/는 앱 내부 기술 문서 전용.
- **First Task**: 한 번에 **1개만**. 우선순위 규칙에 따라 C1이 선정한다.  
  우선순위: 1) Auth/Redirect/Session 2) API Contract 3) Domain/Engine 4) UI 5) 문서.
- **C2~C5 디스패치**: 보드의 "C2~C5 one-line (복사용)"을 그대로 복사해 각 Cursor에 전달한다.  
  문서 전용·단일 역할 런(문서 점검, 접근성 1건, 단위 테스트 1모듈 등)은 C2·C3·C4는 "해당 없음 Exit"로 간주하고, 실제 작업하는 역할 1개 + C5 검증만 진행해도 된다.

---

## 2. 사용자 입력과 C1 반응

| 사용자 입력 | C1이 할 일 |
|-------------|------------|
| **검증** / **검증 돌려줘** | 터미널에서 `./scripts/orchestrate.sh` 실행. 출력에 `CI GATE PASSED`가 있으면 **같은 턴에서** done 처리 + auto 실행(다음 First Task 선정, 보드·CURRENT_TASK 갱신, C2~C5 한 줄 명령 출력). |
| **통과했어** / **검증 통과** / **CI GATE PASSED** | 사용자가 직접 검증을 돌렸을 때. **검증 통과로 간주**하고, **같은 턴에서** done 처리 + auto 실행. |
| **done** | 현재 First Task를 완료로 간주. done 처리만 수행(Wrap·테이블·완료 이력·CURRENT_TASK 갱신). **auto는 하지 않음.** |
| **done만** / **done 까지** | **done만** 수행. 다음 First Task 선정(auto) 하지 않음. (다른 PC로 이어받을 때 등) |
| **auto** | 현재 First Task는 이미 완료된 상태로 간주. **다음 First Task** 선정 + 보드·CURRENT_TASK 갱신 + C2~C5 한 줄 명령 출력. |

---

## 3. done 처리 시 갱신 위치 (done만 할 때)

- **CURSOR_TASK_BOARD.md**  
  - "Wrap": `**CI PASSED** — **[First Task 이름]** 런 검증 통과·WRAP 완료. (최신)`  
  - "완료 이력" 상단에 해당 런 한 줄 추가.  
  - C1~C5 테이블은 **다음 First Task로 바꾸지 않음** (done만이면 유지).
- **CURRENT_TASK.md**  
  - "이전 런 완료": 방금 완료한 First Task 이름 + "런 검증 통과·WRAP 완료"  
  - "First Task" 줄은 **그대로 두거나** "(현재 완료, 다음 auto 시 갱신)" 등으로 표기.

---

## 4. done + auto (검증 통과 시 기본)

사용자가 "검증 돌려줘"라고 했고, C1이 `./scripts/orchestrate.sh`를 실행해 **CI GATE PASSED**를 확인한 경우:

1. **done**: Wrap·완료 이력·CURRENT_TASK "이전 런 완료" 갱신.
2. **auto**: 직전 First Task와 **다른 유형**으로 다음 First Task 선정(동일 패턴 반복 금지). 2~3개 연관 항목 묶기.  
3. 보드의 First Task 문단·C1~C5 테이블·"C2~C5 one-line (복사용)"을 **새 First Task 기준**으로 갱신.
4. 응답 말미에 **새 C2~C5 한 줄 명령(복사용)** 을 그대로 출력.

---

## 5. 이어받기 시 확인할 것

- **CURSOR_TASK_BOARD.md** 최상단 Wrap·"First Task" 문단: 지금 진행할 작업 1개 확인.
- **CURRENT_TASK.md** "이전 런 완료"·"First Task (우선순위 자동)": 이전에 무엇이 끝났고, 현재 First Task가 무엇인지 확인.
- "다른 PC 이어받기" 메모가 있으면: 그 안내대로 진행(예: "검증 돌려줘" 후 done+auto).

---

## 6. 검증 명령

- **필수 게이트**: `npm run lint && npm test && npm run build`  
- **권장 한 번에 실행**: `./scripts/orchestrate.sh` (위 3단계 + 알림).  
- C1이 이 터미널 명령을 **직접 실행**해야 출력을 보고 "CI GATE PASSED" 시 done+auto를 자동 수행할 수 있다. 사용자가 다른 터미널에서만 돌리면 C1은 결과를 못 보므로, 사용자가 "통과했어"라고 알려주면 그때 done+auto 수행.

---

## 7. 요약 (다른 Cursor에 붙여넣기용)

```
너는 C1 Commander다. 단일 진실은 docs/CURSOR_TASK_BOARD.md + docs/CURRENT_TASK.md (repo root docs/만 사용. bty-app/docs/는 앱 내부 기술 문서 전용).
- "검증" / "검증 돌려줘" → ./scripts/orchestrate.sh 실행. CI GATE PASSED면 같은 턴에 done + auto (다음 First Task 선정, 보드·CURRENT_TASK 갱신, C2~C5 한 줄 명령 출력).
- "통과했어" → 검증 통과로 간주, 같은 턴에 done + auto.
- "done" → done만 (Wrap·완료 이력·CURRENT_TASK 갱신). auto 하지 않음.
- "done만" / "done 까지" → done만. auto 하지 않음.
- "auto" → 다음 First Task 선정 + 보드 갱신 + C2~C5 명령 출력.
First Task는 1개만. 우선순위: Auth > API > Domain > UI > 문서. 직전과 다른 유형으로 선정. 2~3개 연관 묶기. 자세한 규칙은 CURSOR_TASK_BOARD.md 참고.
```
