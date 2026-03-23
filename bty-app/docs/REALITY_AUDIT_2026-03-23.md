# REALITY AUDIT — 2026-03-23

목적:
현재 BTY 시스템이 “문서 기준 상태” 대비 실제로 어디까지 구현되어 있는지,
그리고 무엇이 작동하지 않는지를 명확하게 드러내기 위함.

기준 문서:
- docs/BTY_MASTER_PLAN.md
- docs/spec/ARENA_LAB_XP_SPEC.md
- ARENA_LAB_XP_RECONCILIATION.md
- docs/SPRINT_PLAN.md

원칙:
- “했는지”가 아니라 “지금 화면/동작이 어떠한지”만 기록
- 추측은 반드시 Suspected cause에만 작성
- 감정 배제, 관찰 기반 기록


------------------------------------------------------------
## 1. ARENA (Execution)
------------------------------------------------------------

### Expected
- 다양한 시나리오 풀에서 상황이 회전되어 제공됨
- Choice → XP → Pattern → Memory → Mirror 흐름 존재
- Arena → Foundry → Arena 루프 활성화

### Actual
- 단일 기본 시나리오 반복 출력
- 시나리오 다양성 없음
- Memory / Mirror / Delayed Outcome 체감 없음

### Gap
- Scenario rotation 미작동
- Scenario pool 연결 또는 확장 미반영
- Behavior → Memory → Consequence 루프 단절

### Suspected cause
- scenarios 테이블 seed 부족 또는 fallback 데이터 고정
- E2E smoke scenario가 실제 flow를 덮고 있음
- scenario fetch 로직이 single fallback으로 고정됨


------------------------------------------------------------
## 2. DASHBOARD (Unified View)
------------------------------------------------------------

### Expected
- 절제된 정보 구조 (minimal, high-signal)
- Leadership Engine 핵심 지표만 노출 (AIR, TII 등)
- 모든 페이지 UI 일관성 유지

### Actual
- 정보 구조 정리되지 않음
- 단순화(simplification) 반영 안됨
- 페이지 간 UI 일관성 부족

### Gap
- 디자인 시스템 vs 실제 구현 불일치
- legacy UI 계속 사용 중

### Suspected cause
- 기존 dashboard 컴포넌트 경로 유지
- 새로운 UI가 merge되지 않거나 연결되지 않음
- feature flag 또는 route 분기 문제


------------------------------------------------------------
## 3. AVATAR SYSTEM
------------------------------------------------------------

### Expected
- 캐릭터 + outfit + accessory 레이어 정상 렌더
- snapshot 기반 즉시 로딩
- leaderboard / dashboard 동일하게 표시

### Actual
- 캐릭터 미표시 또는 깨짐
- 일부만 렌더되거나 fallback 상태

### Gap
- avatar_composite_snapshots → UI 연결 불안정
- asset layer 조합 실패

### Suspected cause
- avatar state vs snapshot 불일치
- asset path 또는 manifest 문제
- client/server boundary 문제 (Next.js import)


------------------------------------------------------------
## 4. CENTER / FOUNDRY
------------------------------------------------------------

### Expected
- Arena → Foundry → Arena 루프 활성화
- Center는 강제 진입 / 회복 흐름 존재
- Foundry 추천/프로그램 연결 작동

### Actual
- Foundry / Center 체감 흐름 약함
- 일부 기능은 존재하지만 실제 루프 연결 미약

### Gap
- Router (Arena → Foundry → Center) 불완전
- 강제 Reset UX 미구현

### Suspected cause
- router/service는 존재하지만 UI 연결 부족
- 조건 트리거 (AIR 등) 미연결


------------------------------------------------------------
## 5. XP / MODE (Arena vs Lab)
------------------------------------------------------------

### Expected
- Arena: Core + Weekly XP
- Lab: Core only + daily limit
- XP 공식: ARENA_LAB_XP_SPEC 기준 적용

### Actual
- 일부 XP는 정상 작동
- Lab 존재하지만 사용자 체감 낮음

### Gap
- Arena/Lab 모드 명확한 UX 분리 부족
- XP 구조가 UI에 명확히 드러나지 않음

### Suspected cause
- API/도메인은 구현 완료
- UI/flow에서 노출 부족


------------------------------------------------------------
## 6. SCENARIO ENGINE / CONTENT
------------------------------------------------------------

### Expected
- 다양한 scenario pool
- role-based / mirror scenario 존재
- delayed outcome 존재

### Actual
- 단일 시나리오 반복

### Gap
- 콘텐츠 레이어 거의 미작동 상태

### Suspected cause
- DB 콘텐츠 부족
- fetch/query 조건 문제
- smoke scenario fallback 과도 사용


------------------------------------------------------------
## 7. SYSTEM STATE SUMMARY
------------------------------------------------------------

### What is Working
- DB / Migration / Engine 구조 안정화
- XP 계산 로직 (Arena/Lab) 존재
- E2E pipeline 정상 통과

### What is NOT Working (User-visible)
- Arena 콘텐츠 다양성 없음
- Dashboard UI 목표 상태 미반영
- Avatar 렌더링 문제
- 전체 시스템이 “완성된 느낌” 없음

### Core Problem
“엔진은 존재하지만, 사용자 경험 레이어에 연결되지 않음”

→ 즉, 시스템은 만들어졌지만 **제품이 아니다**


------------------------------------------------------------
## 8. NEXT ACTION (DO NOT IMPLEMENT YET)
------------------------------------------------------------

1. Scenario source & rotation 문제 확정
2. Avatar snapshot → UI 연결 문제 확정
3. Dashboard UI 실제 사용 경로 확인
4. fallback / mock 데이터 제거 여부 판단

→ 이 4개가 해결되기 전까지 기능 추가 금지