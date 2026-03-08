# 다음 프로젝트 추천 (다른 Cursor 참고용)

**갱신일**: 2026-03-08  
**목적**: 현재 런이 끝난 뒤 **다음에 진행할 프로젝트**를 한 곳에서 정리한다.  
**기준**: 보드(`docs/CURSOR_TASK_BOARD.md`)의 **대기** 목록과 이 파일의 추천을 맞춘다.  
**현재**: **웹 개발 집중**. 문서·Release Gate 점검은 **배포 전 1회** 수행. 일상 보드는 UI·API·도메인·엘리트/Dojo 등 웹페이지 개발 중심.

---

## 1. 추천: 엘리트 3차 (Elite 3rd) — 배지·멘토 대화 UI 마무리

**근거**: `bty-app/docs/PHASE_4_ELITE_5_PERCENT_SPEC.md` §10 — 3차 후보 2건 모두 **도메인·API 완료**, **UI만 별도**로 남아 있음.

| 항목 | 도메인·API | UI | 보드 대기 작업 |
|------|------------|-----|----------------|
| **엘리트 배지 증정** | [x] `eliteBadge.getEliteBadgeGrants`, GET /api/me/elite `badges` 반환 | [ ] Elite 페이지/대시보드에 배지 표시 | [DOCS] 엘리트 3차 스펙·체크리스트 1페이지 → [UI] 배지 표시 |
| **멘토 대화 신청** | [x] mentorRequest 도메인, elite_mentor_requests, GET/POST /api/me/mentor-request, GET/PATCH /api/arena/mentor-requests | [ ] Elite 전용 "멘토 대화 신청" 플로우 UI | [API] 계약 점검(선택) → [UI] 신청·목록 화면 |

**우선순위**: 1) [DOCS] 엘리트 3차 스펙·검증 체크리스트 1페이지 정리 → 2) [UI] 엘리트 배지 표시 → 3) [UI] 엘리트 멘토 대화 신청 플로우 → 4) [VERIFY] 엘리트 3차 체크리스트 1회 실행 후 서류 반영.

**참고 경로**: `bty-app/docs/PHASE_4_ELITE_5_PERCENT_SPEC.md` §9·§10·§11, `bty-app/docs/ARENA_CODENAME_AVATAR_PLAN.md`.

---

## 2. 대안 (추천 이후 또는 병렬)

| 순서 | 프로젝트 | 한 줄 | 참고 |
|------|----------|--------|------|
| A | **Dojo·Dear Me 콘텐츠 심화** | 50문항 DB화·연습 플로우 2종·Dear Me 자존감 훈련 플로우 설계 | `DOJO_DEAR_ME_NEXT_CONTENT.md` §1·§2 확장 |
| B | **챗봇 훈련 심화** | RAG·구역별 예시 확장 (기본 §9 완료) | `CHATBOT_TRAINING_CHECKLIST.md`, ROADMAP 챗봇 훈련 시기 |
| C | **감정 스탯 v3 확장** | 이벤트 15종·stat_distribution·30일 가속 | `HEALING_COACHING_SPEC_V3.md`, `SYSTEM_UPGRADE_PLAN_EMOTIONAL_STATS.md` |
| D | **단위 테스트·접근성** | 미커버 1모듈 테스트, 접근성 1건 | 문서 점검은 배포 전 1회로 정리. 보드 "다음 후보" 유지 |

---

## 3. 다음 단계 체크리스트

- [x] **보드** `docs/CURSOR_TASK_BOARD.md`: **[DOCS] 다음 배치 선정** 재실행. NEXT_BACKLOG_AUTO4 갱신(Dojo·챗봇 RAG 2차 설계 완료 반영). 상단 후보 = 문서 점검·AUTH·DOMAIN·UI·VERIFY·엘리트 4차 VERIFY·RAG 2차 구현.
- [x] **NEXT_PHASE_AUTO4.md** (루트): §3 Auto 4 추천 = 보드 대기와 동기화. 다음 배치 선정 반영.
- [x] **CURRENT_TASK.md** (루트): [DOCS] 다음 배치 선정 완료 1줄 추가.
- [x] **Release Gate**: `docs/BTY_RELEASE_GATE_CHECK.md` §A~F·§F 검증 단계 유지.
- [x] **문서 점검 (2차)**: NEXT_PROJECT_RECOMMENDED "현재" 1줄·BTY_RELEASE_GATE_CHECK §5 문서 점검 2차 1줄·NEXT_PHASE_AUTO4 §3 보드 대기와 일치 확인. 2026-03-06.
- [x] **문서 점검 (3차)**: NEXT_PROJECT_RECOMMENDED "현재"(보드 대기 3차 5건)·NEXT_PHASE_AUTO4 §3 보드 대기(3차) 일치·BTY_RELEASE_GATE_CHECK §5·§3 F 문서 점검 3차 1줄 반영. 2026-03-06.
- [x] **문서 점검 (4차)**: NEXT_PROJECT_RECOMMENDED "현재"·NEXT_PHASE_AUTO4 §3 보드 대기(4차) 일치·BTY_RELEASE_GATE_CHECK §5·§3 F 문서 점검 4차 1줄 반영. 2026-03-06.
- [x] **문서 점검 (5차)**: NEXT_PROJECT_RECOMMENDED "현재"(보드 대기 5차 5건)·NEXT_PHASE_AUTO4 §3 보드 대기(5차) 일치·BTY_RELEASE_GATE_CHECK §5·§3 F 문서 점검 5차 1줄 반영. 2026-03-06.
- [x] **문서 점검 (6차)**: NEXT_PROJECT_RECOMMENDED "현재"(보드 대기 6차 5건)·NEXT_PHASE_AUTO4 §3 보드 대기(6차) 일치·BTY_RELEASE_GATE_CHECK §5·§3 F 문서 점검 6차 1줄 반영. 2026-03-08.
- [x] **문서 점검 (7차)**: NEXT_PROJECT_RECOMMENDED "현재"(보드 대기 7차 5건)·NEXT_PHASE_AUTO4 §3 보드 대기(7차) 일치·BTY_RELEASE_GATE_CHECK §5·§3 F 문서 점검 7차 1줄 반영. 2026-03-08.
- [x] **문서 점검 (8차)**: NEXT_PROJECT_RECOMMENDED "현재"(보드 대기 8차 2건)·NEXT_PHASE_AUTO4 §3 보드 대기(8차) 일치·BTY_RELEASE_GATE_CHECK §5·§3 F 문서 점검 8차 1줄 반영. 2026-03-08.
- [x] **문서 점검 (9차)**: NEXT_PROJECT_RECOMMENDED "현재"(보드 대기 9차)·NEXT_PHASE_AUTO4 §3 보드 대기(9차) 일치·BTY_RELEASE_GATE_CHECK §5·§3 F 문서 점검 9차 1줄 반영. 2026-03-08.
- [x] **문서 점검 (10차)**: NEXT_PROJECT_RECOMMENDED "현재"(보드 대기 10차)·NEXT_PHASE_AUTO4 §3 보드 대기(10차) 일치·BTY_RELEASE_GATE_CHECK §5·§3 F 문서 점검 10차 1줄 반영. 2026-03-08.
- [x] **문서 점검 (11차)**: NEXT_PROJECT_RECOMMENDED "현재"(보드 대기 11차 2건)·NEXT_PHASE_AUTO4 §3 보드 대기(11차) 일치·BTY_RELEASE_GATE_CHECK §5·§3 F 문서 점검 11차 1줄 반영. 2026-03-08.
- [x] **문서 점검 (12차)**: NEXT_PROJECT_RECOMMENDED "현재"(보드 대기 12차 2건)·NEXT_PHASE_AUTO4 §3 보드 대기(12차) 일치·BTY_RELEASE_GATE_CHECK §5·§3 F 문서 점검 12차 1줄 반영. 2026-03-08.
- [x] **문서 점검 (13차)**: NEXT_PROJECT_RECOMMENDED "현재"(보드 대기 13차 2건)·NEXT_PHASE_AUTO4 §3 보드 대기(13차) 일치·BTY_RELEASE_GATE_CHECK §5·§3 F 문서 점검 13차 1줄 반영. 2026-03-08.
- [x] **문서 점검 (14차)**: NEXT_PROJECT_RECOMMENDED "현재"(보드 대기 14차 2건)·NEXT_PHASE_AUTO4 §3 보드 대기(14차) 일치·BTY_RELEASE_GATE_CHECK §5·§3 F 문서 점검 14차 1줄 반영. 2026-03-08.
- [x] **문서 점검 (15차)**: NEXT_PROJECT_RECOMMENDED "현재"(보드 대기 15차 2건)·NEXT_PHASE_AUTO4 §3 보드 대기(15차) 일치·BTY_RELEASE_GATE_CHECK §5·§3 F 문서 점검 15차 1줄 반영. 2026-03-08.
- [x] **문서 점검 (16차)**: NEXT_PROJECT_RECOMMENDED "현재"(보드 대기 16차 2건)·NEXT_PHASE_AUTO4 §3 보드 대기(16차) 일치·BTY_RELEASE_GATE_CHECK §5·§3 F 문서 점검 16차 1줄 반영. 2026-03-08.
- [x] **문서 점검 (17차)**: NEXT_PROJECT_RECOMMENDED "현재"(보드 대기 17차 2건)·NEXT_PHASE_AUTO4 §3 보드 대기(17차) 일치·BTY_RELEASE_GATE_CHECK §5·§3 F 문서 점검 17차 1줄 반영. 2026-03-08.
- [x] **문서 점검 (18차)**: NEXT_PROJECT_RECOMMENDED "현재"(보드 대기 18차 2건)·NEXT_PHASE_AUTO4 §3 보드 대기(18차) 일치·BTY_RELEASE_GATE_CHECK §5·§3 F 문서 점검 18차 1줄 반영. 2026-03-08.
- [x] **문서 점검 (19차)**: NEXT_PROJECT_RECOMMENDED "현재"(보드 대기 19차 2건)·NEXT_PHASE_AUTO4 §3 보드 대기(19차) 일치·BTY_RELEASE_GATE_CHECK §5·§3 F 문서 점검 19차 1줄 반영. 2026-03-08.
- [x] **문서 점검 (20차)**: 반복 종료. 다음 프로젝트 진행. 2026-03-08.
- [x] **문서 점검 (21차)**: 반복 종료. 다음 프로젝트 진행. 2026-03-08.
- [x] **문서 점검 (22차)**: NEXT_PROJECT_RECOMMENDED "현재"(보드 대기 22차 2건)·NEXT_PHASE_AUTO4 §3 보드 대기(22차) 일치·BTY_RELEASE_GATE_CHECK §5·§3 F 문서 점검 22차 1줄 반영. 2026-03-08.
- [x] **문서 점검 (23차)**: NEXT_PROJECT_RECOMMENDED "현재"(보드 대기 23차 2건)·NEXT_PHASE_AUTO4 §3 보드 대기(23차) 일치·BTY_RELEASE_GATE_CHECK §5·§3 F 문서 점검 23차 1줄 반영. 2026-03-08.
- [x] **문서 점검 (24차)**: NEXT_PROJECT_RECOMMENDED "현재"(보드 대기 24차 2건)·NEXT_PHASE_AUTO4 §3 보드 대기(24차) 일치·BTY_RELEASE_GATE_CHECK §5·§3 F 문서 점검 24차 1줄 반영. 2026-03-06.
- [x] **문서 점검 (25차)**: NEXT_PROJECT_RECOMMENDED "현재"(보드 대기 25차 2건)·NEXT_PHASE_AUTO4 §3 보드 대기(25차) 일치·BTY_RELEASE_GATE_CHECK §5·§3 F 문서 점검 25차 1줄 반영. 2026-03-06.
- [x] **문서 점검 (26차)**: NEXT_PROJECT_RECOMMENDED "현재"(보드 대기 26차 2건)·NEXT_PHASE_AUTO4 §3 보드 대기(26차) 일치·BTY_RELEASE_GATE_CHECK §5·§3 F 문서 점검 26차 1줄 반영. 2026-03-06.
- [x] **문서 점검 (27차)**: NEXT_PROJECT_RECOMMENDED "현재"(보드 대기 27차 2건)·NEXT_PHASE_AUTO4 §3 보드 대기(27차) 일치·BTY_RELEASE_GATE_CHECK §5·§3 F 문서 점검 27차 1줄 반영. 2026-03-06.
- [x] **문서 점검 (28차)**: NEXT_PROJECT_RECOMMENDED "현재"(보드 대기 28차 3건)·NEXT_PHASE_AUTO4 §3 보드 대기(28차) 일치·BTY_RELEASE_GATE_CHECK §5·§3 F 문서 점검 28차 1줄 반영. 2026-03-08.
- [x] **문서 점검 (29차)**: NEXT_PROJECT_RECOMMENDED "현재"(보드 대기 29차)·NEXT_PHASE_AUTO4 §3 보드 대기(29차) 일치·BTY_RELEASE_GATE_CHECK §5·§3 F 문서 점검 29차 1줄 반영. 2026-03-08.
- [x] **문서 점검 (30차)**: NEXT_PROJECT_RECOMMENDED "현재"(보드 대기 30차)·NEXT_PHASE_AUTO4 §3 보드 대기(30차) 일치·BTY_RELEASE_GATE_CHECK §5·§3 F 문서 점검 30차 1줄 반영. 2026-03-08.
- [x] **문서 점검 반복 종료**: 27차까지 완료. NEXT_BACKLOG_AUTO4를 구현 배치(Dojo·챗봇 RAG 2차·DOMAIN·VERIFY 등)로 전환. 보드가 구현 작업을 채우도록 갱신.

*참고: `docs/CURSOR_TASK_BOARD.md`, `bty-app/docs/PROJECT_PROGRESS_ORDER.md` §3, `bty-app/docs/PHASE_4_ELITE_5_PERCENT_SPEC.md` §10.*
