# NEXT_PHASE_AUTO4 — 대기 작업 단일 기준

**목적**: Auto 4(검증 + C2·C3·C4·C5 병렬 선정)와 **docs/CURSOR_TASK_BOARD.md**(루트 단일 진실)의 **대기 작업**을 같은 기준으로 유지한다.  
이 파일을 갱신할 때는 두 보드의 대기 행도 동일하게 맞춘다.  
**다음 프로젝트 추천**: `docs/NEXT_PROJECT_RECOMMENDED.md` — 엘리트 3차.

---

## 현재 대기 작업 (보드와 동일) — MODE FOUNDRY (SPRINT 45)

| 순서 | 할 일 (한 줄) | 보드 반영 |
|------|----------------|-----------|
| 1 | **[VERIFY] Release Gate A~F — Foundry 45차** — bty-release-gate.mdc A~F. Lint·Test·Build. | docs 보드 SPRINT 45 TASK 1 |
| 2 | **[DOCS] NEXT_PHASE·NEXT_BACKLOG 대기 갱신** — SPRINT 44 완료 반영. 대기 6건 갱신. | docs 보드 SPRINT 45 TASK 2 |
| 3 | **[DOCS] 문서 점검 121·122·123차** — NEXT_PHASE_AUTO4·NEXT_BACKLOG_AUTO4·보드·BTY_RELEASE_GATE_CHECK 2~3건 점검·갱신. | docs 보드 SPRINT 45 TASK 3 |
| 4 | **[UI] Center/Foundry 추가 접근성 1곳** — dear-me·assessment·center·dojo·integrity·mentor·elite 중 1곳 aria-label·aria-describedby. | docs 보드 SPRINT 45 TASK 4 |
| 5 | **[DOCS] 다음 배치 선정** — NEXT_BACKLOG_AUTO4·NEXT_PHASE_AUTO4 수동 갱신(필요 시). | docs 보드 SPRINT 45 TASK 5 |
| 6 | **[DOCS] Arena·Center·Foundry 대기 목록 동기화** — NEXT_PHASE·NEXT_BACKLOG·보드 대기 행 일치. | docs 보드 SPRINT 45 TASK 10 |

*SPRINT 45 생성. First Task = Release Gate 45차. 대기 6건 = 45차·대기 갱신·문서 121·122·123차·접근성·다음 배치·대기 동기화.*

---

## 다음 후보 (AUTO 시 2~3개 묶기용)

- [VERIFY] Release Gate 45차 *(이번 런 1번)*
- [DOCS] CURSOR_TASK_BOARD § 다음 작업 정리
- [DOMAIN] Center/Foundry 미커버 경계 테스트 1건
- [TEST] Center/Foundry route 테스트 1건

*Auth·XP·리더보드 등 위험 구간은 1개만 First Task로 둔다.*

---

## 갱신 규칙

- **작업 완료 시**: 해당 항목을 위 표에서 제거하고, 다음 후보 중 하나를 "현재 대기"로 올린다. **docs/CURSOR_TASK_BOARD.md**(루트 단일 진실)의 대기 행을 같은 내용으로 수정한다.
- **대기 작업 변경 시**: 이 파일의 "현재 대기 작업" 표를 먼저 수정한 뒤, 두 보드 표를 동일하게 갱신한다.

---

*최종 갱신: 2026-03-11 — splint 10. SPRINT 44 8/10 완료 → SPRINT 45 생성. 현재 대기 6건 = 보드와 동일. MODE FOUNDRY.*
