# BTY 로드맵 — Q3·Q4 (LE, Elite, Healing)

**목적:** Q3·Q4 기능·연동·문서 작업의 단일 기준.  
**정책:** 일상 작업은 **이 로드맵의 기능 스프린트**(UI·API·도메인)에 집중. Release Gate·문서 점검은 **배포 전 1회** 수행.

---

## 현재 위치

- **MVP (Q1·Q2):** Dojo, Integrity, Mentor, 시나리오 50개, 서비스·API 테스트 — **완료**로 간주.
- **Q3·Q4:** 아래 기능을 스프린트에 넣어 진행.

---

## Q3 — LE Stage / AIR API / 대시보드 / Elite 정리

| 구분 | 내용 | 산출물·작업 |
|------|------|-------------|
| **LE Stage** | Leadership Experience Stage — Arena 결과·행동 패턴 노출 | LE Stage API 또는 페이지, Arena 연동 |
| **AIR API 노출** | AIR(Action–Integrity–Responsibility) 점수/밴드 API | API route, (선택) 대시보드에서 소비 |
| **대시보드** | Arena/Foundry/Center 통합 뷰, 진도·추천 요약 | 대시보드 페이지, 위젯·링크 |
| **Elite 멘토 승인/거절** | 멘토가 Elite 신청 승인·거절 플로우 | 승인/거절 API·UI, Elite 3차 스펙 준수 |
| **Elite UI 정리** | Elite 관련 화면·접근성·일관성 정리 | UI 정리 작업 |

**Q3 백로그 (기능 스프린트 예시)**  
- [ ] LE Stage: API 또는 페이지 스펙·구현  
- [ ] AIR API: 노출 엔드포인트·권한·응답 형식  
- [ ] 대시보드: 라우트·레이아웃·Arena/Foundry/Center 진입점  
- [ ] Elite: 멘토 승인/거절 플로우 (API + UI)  
- [ ] Elite: UI 정리 (접근성·일관성)

---

## Q4 — Healing / Awakening / 로드맵 2페이지 / 다음 연도 백로그

| 구분 | 내용 | 산출물·작업 |
|------|------|-------------|
| **Healing** | Healing 경로·콘텐츠·플로우 | Healing 페이지·API·연동 |
| **Awakening** | Awakening 경로·콘텐츠·플로우 | Awakening 페이지·API·연동 |
| **로드맵 2페이지** | 공개용 또는 내부용 로드맵 2페이지 문서 | docs 또는 정적 페이지 |
| **다음 연도 백로그** | 다음 연도 우선순위·기능 목록 | 백로그 문서 (예: NEXT_YEAR_BACKLOG.md) |

**Q4 백로그 (기능 스프린트 예시)**  
- [ ] Healing: 스펙·라우트·UI·(선택) API  
- [ ] Awakening: 스펙·라우트·UI·(선택) API  
- [ ] 로드맵 2페이지: 초안 작성·갱신  
- [ ] 다음 연도 백로그: 초안 작성·우선순위 정리  

---

## 스프린트 운영 원칙 (Q3·Q4)

- **일상 스프린트:** 위 Q3·Q4 백로그에서 **기능 작업** 1건 이상 선택 (LE API, 대시보드, Elite 플로우, Healing 페이지 등).
- **Release Gate·문서 점검:** **배포를 할 때** 1회 수행. 매 스프린트마다 Gate + 문서 + 접근성 + 테스트 반복은 정책상 필수가 아님.
- **진행 시:** 이 문서의 해당 항목을 `[ ]` → `[x]`로 갱신하고, 필요 시 `SPRINT_PLAN.md`·`CURSOR_TASK_BOARD.md`에 “이번 스프린트 목표 = Q3/Q4 기능 N번” 형태로 기록.

---

## 참조

- MVP·배포 준비: `docs/MVP_DEPLOYMENT_READINESS.md`  
- 일상 vs 배포 시 검증: `docs/WORK_POLICY.md`  
- Release Gate 정책: `docs/BTY_RELEASE_GATE_CHECK.md` (배포 전 1회)  
- Arena 설계: `docs/arena/ARENA_SYSTEM_ARCHITECTURE_AND_IMPLEMENTATION.md`  
- Arena 마스터 플랜: `docs/plans/ARENA_MASTER_PLAN.md`

---

*Q3·Q4 진행 시 이 문서를 우선 갱신한다.*
