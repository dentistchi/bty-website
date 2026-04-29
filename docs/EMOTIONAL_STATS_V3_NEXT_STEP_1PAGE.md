# 감정 스탯 v3 확장 — 다음 단계 설계 1페이지

**갱신일**: 2026-03-09  
**목적**: 이벤트 15종·stat_distribution·30일 가속 **구현 완료** 반영 후, **다음 단계** 설계를 1페이지로 정리.  
**기준**: `EMOTIONAL_STATS_V3_DESIGN_1PAGE.md`, `src/lib/bty/emotional-stats/` (coreStats, detectEvent, formula, phase).

---

## 0. 현재 상태 (구현 완료)

| 항목 | 상태 | 비고 |
|------|------|------|
| **이벤트 15종** | ✅ 완료 | EVENT_IDS·EVENTS·EVENT_PATTERNS·CORE_STATS source_events·STAT_DISTRIBUTION에 EMPATHY_EXPRESSED(15번째) 반영. |
| **stat_distribution** | ✅ 완료 | coreStats.STAT_DISTRIBUTION 15건 정의. EMPATHY_EXPRESSED → EA 0.5, RC 0.5. |
| **30일 가속** | ✅ 완료 | phase.ts getAccelerationFactor·getPhaseMultiplier·getConsistencyCap. formula.computeStatDelta(userDay) 연동. |

**소스**: `coreStats.ts`, `detectEvent.ts`, `formula.ts`, `phase.ts`.

---

## 1. 다음 단계 후보

| 구분 | 다음 단계 설계 |
|------|----------------|
| **API·프로필 user_day** | record-event·display API 및 프로필에서 `user_day`(가입/첫 이벤트 기준 경과일) 전달 여부 확인. 미전달 시 30일 가속 미적용(acc=1, phase=1). |
| **16번째 이벤트 후보** | VALUES_CLARIFIED(가치 명확화), SELF_COMPASSION_MOMENT 등 — 스펙·detectEvent 패턴·STAT_DISTRIBUTION·CORE_STATS 확장 시 추가. |
| **고급 스탯 언락 UI** | ADVANCED_STATS 언락 조건 충족 시 표시(phrases·phase 연동). unlock.ts·display API 확장. |
| **표시(phrases·phase)** | 현재 display API phrases·phase 반영. 30일 구간별 메시지·고급 스탯 해금 문구 2차 설계. |

---

## 2. 체크리스트·참고

- [x] 이벤트 15종: 15번째 이벤트 ID·EVENT_PATTERNS·STAT_DISTRIBUTION·CORE_STATS 반영됨.
- [x] stat_distribution: 15건 정의·computeSessionGains 연동.
- [ ] 30일 가속: API·프로필에서 user_day 전달 여부 및 formula 연동 확인.
- [ ] (선택) 16번째 이벤트 후보 스펙·패턴·분포 정의.

*참고: EMOTIONAL_STATS_V3_DESIGN_1PAGE.md, HEALING_COACHING_SPEC_V3.md, NEXT_PROJECT_RECOMMENDED.md §2 C.*
