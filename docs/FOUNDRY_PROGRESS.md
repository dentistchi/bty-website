# Foundry 진행률 요약

> **갱신**: 2026-03-10. 로드맵·Feature·스프린트 기준 정리. 단일 참조: `docs/plans/FOUNDRY_ROADMAP.md`, `docs/spec/FOUNDRY_DOMAIN_SPEC.md`.

---

## 기준 문서

- **로드맵**: [docs/plans/FOUNDRY_ROADMAP.md](plans/FOUNDRY_ROADMAP.md) — 2026 Q1~Q4 연도별 마일스톤, Feature 7단계
- **스펙**: [docs/spec/FOUNDRY_DOMAIN_SPEC.md](spec/FOUNDRY_DOMAIN_SPEC.md) — Dojo·Integrity·Mentor·Scenario·LE·Elite·Healing
- **보드**: [docs/CURSOR_TASK_BOARD.md](CURSOR_TASK_BOARD.md) — SPRINT 20~39 FOUNDRY (현재 39차 진행 중)

---

## 1. 연도별 마일스톤 기준 (Q1~Q4)

| 시기 | 목표 | 상태 | 비고 |
|------|------|------|------|
| **2026 Q1** | Dojo·Integrity·Mentor·시나리오 50개 MVP | **완료** | Dojo 제출/이력, Integrity 연습, Mentor 대화, SCENARIOS_LIST·API 구현 완료 |
| **2026 Q2** | 서비스 계층·API 테스트·스펙 동기화 | **완료** | dojoSubmitService·Integrity 서비스·dojo/submissions·mentor route 테스트·스펙 교차 참조 반영 |
| **2026 Q3** | LE·Elite 연동 강화 | **일부** | LE Stage/AIR API 노출·대시보드, Elite 멘토 신청 목록·승인/거절 API·UI — 일부 구현·테스트/문서 보강 진행 |
| **2026 Q4** | Healing·로드맵 갱신·다음 연도 백로그 | **미착수** | Awakening phase·로드맵 2페이지·Feature 후보 정리 미시작 |

**쿼터 가중 동일 시**: (100 + 100 + 약 35 + 0) / 4 = **약 59%**

---

## 2. Feature 7단계 기준

| # | Feature | 상태 | 비고 |
|---|---------|------|------|
| 1 | Dojo (50문항 진단·제출·이력) | **완료** | flow·questions·submit/submissions API·UI·테스트 |
| 2 | Integrity (역지사지) | **완료** | 서비스·POST submit·경계 테스트 |
| 3 | Mentor (Dr. Chi) | **완료** | 대화·이력 UI·mentor-request API·JSDoc |
| 4 | Scenario Engine (50개) | **목록 완료** | SCENARIOS_LIST·50개 시나리오 파일; 엔진 연동은 추가 작업 |
| 5 | Leadership Engine | **일부** | 도메인(stages·AIR·TII·LRI·forced-reset)·일부 테스트; API 노출·대시보드 보강 여지 |
| 6 | Elite | **일부** | 멘토 신청 API·UI 있음; 배지·특별 시나리오·승인/거절 플로우 보강 |
| 7 | Healing / Awakening | **미착수** | phase 전환·페이지 미구현 |

**Feature 가중 동일 시**: 3.5 / 7 ≈ **50%** (완료 3.5개 상당, 일부 2개, 미착수 1개)

---

## 3. 스프린트 완료 현황 (FOUNDRY)

- **SPRINT 20~38**: 전량 완료 (각 10 tasks)
- **SPRINT 39**: 진행 중 — 미완 2건 (Release Gate 39차, 엘리트 3차 체크리스트), 나머지 8건 완료

스프린트만 보면 **38.9 / 39** 스프린트 완료에 가깝지만, 매 스프린트마다 DOCS/VERIFY·접근성·테스트 1건 등 반복 태스크 비중이 있어 “전체 Foundry 기능의 완성도”를 스프린트 개수로만 환산하는 것은 적절하지 않음. 위 로드맵·Feature 기준이 더 적합함.

---

## 4. 종합 완성도 (정리)

- **로드맵(Q1~Q4) 기준**: **약 55~60%**  
  - Q1·Q2 달성, Q3 일부, Q4 미착수
- **Feature 7개 기준**: **약 50~55%**  
  - Dojo·Integrity·Mentor·시나리오 목록 완료, LE·Elite 일부, Healing 미착수
- **현재 남은 핵심**:  
  - Q3: LE Stage/AIR API 노출·Foundry 대시보드, Elite 멘토 승인/거절 API·UI 정리  
  - Q4: Healing/Awakening phase, 로드맵 2페이지, 다음 연도 백로그

**한 줄 요약**: 지금까지 Foundry 진행률은 **대략 55~60%** 수준으로 보는 것이 타당하다. (로드맵·Feature 기준 혼합 시 **약 55%** 전후.)

---

## 5. 참고 — 구현 확인된 Foundry 관련 API/코드

- `src/app/api/dojo/submit`, `dojo/submissions`, `dojo/integrity/submit` — 구현·테스트 있음
- `src/app/api/me/mentor-request` — 구현·테스트 있음
- `src/app/api/arena/mentor-requests`, `mentor-requests/[id]` — Elite 멘토 요청·승인/거절 관련
- Dojo·Integrity·Mentor UI·도메인(dojo/flow·integrity·questions, leadership-engine) — 스펙 대로 존재
