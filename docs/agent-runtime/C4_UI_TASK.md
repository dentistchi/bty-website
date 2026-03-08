[역할: UI Worker / Render-only]
First Task 기준으로 UI 구현을 수행하라.

작업 규칙:
- 받은 값만 표시
- Loading / Empty / Error 상태 포함
- 숫자/날짜 포맷 외 계산 금지
- tier/league/xp/leaderboard 정렬 유도 금지

완료 보고:
- 사용 API 필드
- UI 계산 로직 0 확인

완료 시 서류 갱신 (필수):
1. docs/CURSOR_TASK_BOARD.md — 해당 행 상태를 대기 → 완료, 비고 1줄 추가.
2. docs/CURRENT_TASK.md — 완료 1줄 추가.
3. 또는: ./scripts/mark-task-complete.sh "할 일 문자열" "비고"
이후 검증/done 하면 다음 auto가 다른 작업을 선택함.
