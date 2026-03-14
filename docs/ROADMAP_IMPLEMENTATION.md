# BTY 구현 로드맵 (Center / Arena / Foundry)

**목적:** 우리가 구현하고 싶은 내용을 **순서대로** 정리한 로드맵.  
"지금 어디까지 했고, 다음에 뭘 해야 하지?"에 이 문서로 답한다.

**진행률 확인:** `docs/PROGRESS_SNAPSHOT.md`  
**항목별 점수·체크:** `docs/PROGRESS_TRACKER.md`

---

## 큰 그림 (Phase)

| Phase | 목표 | Center | Arena | Foundry |
|-------|------|--------|-------|---------|
| **Phase 1 — MVP** | 플레이·선택·즉각 결과·미러·Foundry 추천 | C1~C5 | A1~A3, A5(선택) | F1~F5(최소 3개 콘텐츠) |
| **Phase 2** | Delayed Outcome, Memory, AIR | C6(선택) | A4, A6, A7 | F5 완비 |
| **Phase 3** | Perspective 재생, Reputation | C6 | A5, A8, A9 | F5·F6·F7 |
| **Phase 4** | 30 Core×POV, Action QR, 완성 | — | 콘텐츠 확장 | F6·F7 완비 |

---

## 1. Center 구현 순서

Center는 **진입·진도·대시보드**가 먼저여야 Arena/Foundry를 쓸 수 있다.

| 순서 | 항목 (PROGRESS_TRACKER 기준) | 내용 | Phase |
|------|-----------------------------|------|-------|
| 1 | C1 | 로그인/세션 또는 사용자 식별 | MVP |
| 2 | C2 | Arena 진입 (시나리오 목록 또는 다음 시나리오) | MVP |
| 3 | C5 | 대시보드 (Arena/Foundry 통합 뷰) | MVP |
| 4 | C3 | 나의 진도 (완료 시나리오 수, 간단 요약) | MVP |
| 5 | C4 | Foundry 진입 (추천/언락 프로그램 목록) | MVP |
| 6 | C6 | 팀 요약 (Team Index·밴드·마일스톤) | Phase 2+ |

**다음 할 일:** PROGRESS_TRACKER에서 Center 중 첫 번째 `[ ]` 항목이 "지금 할 Center 작업"이다.

---

## 2. Arena 구현 순서

Arena는 **시나리오 플레이 → 선택 → 결과·미러**가 먼저, 그 다음 행동 엔진·관점·리퍼테이션이다.

| 순서 | 항목 (PROGRESS_TRACKER 기준) | 내용 | Phase |
|------|-----------------------------|------|-------|
| 1 | A1 | Scenario Engine: 시나리오 로드, Trigger/Choice/Immediate Outcome 표시 | MVP |
| 2 | A2 | Behavior Engine: 선택 시 플래그 기록·저장 | MVP |
| 3 | A3 | Mirror Question 표시, Foundry 추천 연결 | MVP |
| 4 | A5 | Perspective Switch: 선택 후 Hidden Perspectives 노출 | MVP(선택) |
| 5 | A4 | Delayed Outcome Engine (슬라이딩 윈도우, 임계값, 지연 시나리오 주입) | Phase 2 |
| 6 | A6 | Memory Engine (결정·플래그 이력, 패턴 감지, "Last time you…") | Phase 2 |
| 7 | A7 | AIR 계산 및 표시 (또는 밴드/서사) | Phase 2 |
| 8 | A8 | Perspective Switch: 같은 base 다른 POV 재생 | Phase 3 |
| 9 | A9 | Reputation (Team Index, Certification, 마일스톤) | Phase 3 |

**다음 할 일:** PROGRESS_TRACKER에서 Arena 중 첫 번째 `[ ]` 항목이 "지금 할 Arena 작업"이다.

---

## 3. Foundry 구현 순서

Foundry는 **목록·추천·수강 상태**가 먼저, 그 다음 콘텐츠·동영상·애니메이션이다.

| 순서 | 항목 (PROGRESS_TRACKER 기준) | 내용 | Phase |
|------|-----------------------------|------|-------|
| 1 | F1 | 12개 프로그램 목록·메타데이터 API/저장 | MVP |
| 2 | F2 | Arena 완료 후 Foundry 추천(1~2개) 표시·연결 | MVP |
| 3 | F4 | Archetype/플래그 기반 자동 추천 로직 | MVP |
| 4 | F3 | 수강/완료 상태 저장 및 UI 표시 | MVP |
| 5 | F5 | 프로그램 콘텐츠 구조 (텍스트·이미지·섹션) — 12개 완비 | MVP(최소 3개) → Phase 2·3 |
| 6 | F6 | 동영상 제작 (12개 프로그램용) | Phase 3 |
| 7 | F7 | 애니메이션 제작 (핵심 개념·시나리오 보조) | Phase 3 |

**다음 할 일:** PROGRESS_TRACKER에서 Foundry 중 첫 번째 `[ ]` 항목이 "지금 할 Foundry 작업"이다.

---

## 4. 권장 작업 순서 (MVP 기준)

전체적으로 **진입 → 플레이 → 추천**이 이어지도록 하는 순서:

1. **Center C1** — 사용자 식별 (Arena/Foundry 이용 가능하게)
2. **Center C5** — 대시보드 (Arena/Foundry 진입점)
3. **Arena A1** — 시나리오 로드·Trigger/Choice/Immediate Outcome
4. **Arena A2** — 선택 시 플래그 기록
5. **Foundry F1** — 프로그램 목록·메타
6. **Arena A3** — Mirror + Foundry 추천 연결
7. **Foundry F2** — Arena 완료 후 추천 표시
8. **Center C2** — Arena 진입 (시나리오 목록/다음 시나리오)
9. **Center C3** — 나의 진도
10. **Center C4** — Foundry 진입
11. **Foundry F4, F3, F5** — 추천 로직, 수강/완료, 콘텐츠(최소 3개)

이 순서는 참고용이다. 이미 구현된 항목은 건너뛰고, PROGRESS_TRACKER에서 다음 `[ ]`를 선택하면 된다.

---

## 5. 진행률 ↔ 로드맵 연결

- **"진행률이 얼마야?"** → `PROGRESS_SNAPSHOT.md` (Center/Arena/Foundry/전체 %)
- **"다음에 뭘 해야 해?"** → 이 문서 §1~3 순서 + `PROGRESS_TRACKER.md`에서 첫 번째 `[ ]`
- **"우리 큰 그림이 뭐야?"** → 이 문서 §큰 그림(Phase) + `MVP_AND_COMPLETION_INDICATORS.md`

---

## 참조

- 진행률 한눈에: `docs/PROGRESS_SNAPSHOT.md`  
- 항목·점수·체크: `docs/PROGRESS_TRACKER.md`  
- Phase·완성률 정의: `docs/MVP_AND_COMPLETION_INDICATORS.md`  
- Arena 설계: `docs/arena/ARENA_SYSTEM_ARCHITECTURE_AND_IMPLEMENTATION.md`  
- Q3·Q4 기능: `docs/ROADMAP_Q3_Q4.md`
