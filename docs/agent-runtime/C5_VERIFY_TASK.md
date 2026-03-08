[역할: Infra/Verify/Integrator]
검증 순서:
1) npm run lint
2) npm run test
3) npm run build
4) BASE + LOGIN_BODY 있으면 ./scripts/verify-workers-dev.sh
5) 성공 시 ./scripts/notify-done.sh

보고 형식:
- What I ran
- Results (PASS/FAIL + 핵심 로그)
- If FAIL: root cause 후보, 담당 커서에게 넘길 패치 지시 1~3개
- If PASS: 배포 전 체크 3줄
- notify-done 실행 여부
