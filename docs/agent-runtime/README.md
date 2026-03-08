# agent-runtime — 검증 / Auto 4 명령 시 동작

**위치**: `docs/agent-runtime/`  
**목적**: "검증", "auto 4" 명령 시 C1(Commander)이 항상 **C1~C5 프롬프트**를 응답에 붙여 넣어 보여 주도록 규칙 정리.

---

## 1. 명령어와 동작

| 명령어 | 스크립트 | 응답에 반드시 포함 |
|--------|----------|---------------------|
| **검증** | `./scripts/auto-agent-loop.sh` | CI Gate 결과 + **`docs/agent-runtime/AUTO4_PROMPTS.md` 전체 내용**(C1~C5 프롬프트)을 **답에 그대로 붙여 넣어** 표시. (파일 열어 보라고만 하지 말 것.) |
| **auto 4** | `./scripts/next-project-fill-board.sh` | 실행 후 **`docs/agent-runtime/AUTO4_PROMPTS.md`**를 읽어 **C1~C5 프롬프트를 답에 그대로** 붙여 넣어 표시. |

**규칙**: "검증" 또는 "auto 4"라고 입력하면, 에이전트는 위 파일을 읽고 **C1~C5 블록 전체를 응답 본문에 포함**해 준다.

---

## 2. C1~C5 역할 (한 줄)

| 역할 | 태그 | 담당 |
|------|------|------|
| **C1** | Commander / 문서 | [DOCS] 다음 배치 선정, 스펙·체크리스트 1페이지, 문서 점검 등. 완료 시 보드 해당 행 완료 + CURRENT_TASK 1줄 + 완료 문구. |
| **C2** | Gatekeeper / AUTH | [AUTH] 로그인·세션·쿠키 문서·점검. 보드 대기 없으면 "해당 없음 Exit." |
| **C3** | Domain/API | [API]·[DOMAIN] 엔드포인트·도메인·단위 테스트. 보드 대기 없으면 Exit. |
| **C4** | UI | [UI] 로딩/스켈레톤, 접근성, API 연동 UI. 보드 대기 없으면 Exit. |
| **C5** | VERIFY | [VERIFY] Release Gate·체크리스트 1회 실행 후 서류 반영. 보드 대기 없으면 Exit. |

---

## 3. 같은 작업 반복 방지

- **[DOCS] 다음 배치 선정**은 이미 **완료**된 적 있으면 `next-project-fill-board.sh`가 **폴백으로 다시 넣지 않음** (스크립트에서 `get_completed_descriptions`로 확인).
- 완료 시 반드시: (1) 보드 해당 행 **완료** + 비고 (2) `docs/CURRENT_TASK.md` 완료 1줄 (3) 「작업 완료. 보드·CURRENT_TASK 반영했습니다.» 로 마무리.
- **같은 C1 프롬프트가 계속 나올 때**: 해당 할 일이 이미 완료됐는지 보드에서 확인 → 대기로 남아 있으면 **완료**로 바꾸고 비고·CURRENT_TASK 1줄 추가. 그다음 **C2~C5**에 할당할 대기가 없으면 NEXT_BACKLOG_AUTO4에서 [AUTH]·[DOMAIN]/[API]·[UI]·[VERIFY] 1건씩 보드 **대기**로 넣은 뒤 `AUTO4_PROMPTS.md`를 **C1=첫 DOCS 대기, C2~C5=해당 태그 첫 대기**로 수동 갱신하거나 `next-project-fill-board.sh` 재실행.

---

## 4. 파일 설명

| 파일 | 설명 |
|------|------|
| **AUTO4_PROMPTS.md** | 매 실행 시 `next-project-fill-board.sh`가 보드 기준으로 생성. C1~C5 각각 "할 일" + "완료 시" 지시문. |
| **README.md** (본 문서) | 검증/auto 4 시 프롬프트 매번 표시 규칙·C2~C5 역할 요약. |

---

*참고: `docs/CURSOR_TASK_BOARD.md` 사용 방법 §5·§6, `scripts/next-project-fill-board.sh`, `scripts/auto-agent-loop.sh`*
