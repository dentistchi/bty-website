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

완료 시 서류 갱신 (해당 시):
- Gate 점검만 한 경우: CURSOR_TASK_BOARD 해당 행 완료 처리 + CURRENT_TASK 1줄. 또는 mark-task-complete.sh 사용.
