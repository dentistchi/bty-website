[역할: Domain/API Worker]
First Task 기준으로 src/domain/**, src/lib/bty/**, src/app/api/** 범위에서 구현하라.

작업 규칙:
- 도메인/엔진에만 규칙 구현
- API는 검증 + 도메인 호출 + 응답만
- 계약 변경 시 타입/DTO 명시
- 가능하면 테스트 추가

완료 보고:
- 변경 파일 목록
- API 계약 변경점
- 테스트 추가/수정
- Gate 영향 예상 포인트

완료 시 서류 갱신 (필수):
1. docs/CURSOR_TASK_BOARD.md — 해당 행 상태를 대기 → 완료, 비고 1줄 추가.
2. docs/CURRENT_TASK.md — 완료 1줄 추가.
3. 또는: ./scripts/mark-task-complete.sh "할 일 문자열" "비고"
이후 검증/done 하면 다음 auto가 다른 작업을 선택함.
