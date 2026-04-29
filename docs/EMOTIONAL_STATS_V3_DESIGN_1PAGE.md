# 감정 스탯 v3 확장 — 설계 1페이지

**목적**: 이벤트 15종·stat_distribution·30일 가속 요약.  
**기준**: `src/lib/bty/emotional-stats/` (coreStats, formula, phase, detectEvent), NEXT_PROJECT_RECOMMENDED §2 C.

---

## 1. 이벤트 (현재 14종 → 15종 확장 후보)

| # | Event ID | quality_weight | 비고 |
|---|----------|----------------|------|
| 1 | OBSERVATION_FACTUAL | 1.0 | 사실 관찰 |
| 2 | FEELING_LABELED | 1.0 | 감정 이름 붙이기 |
| 3 | FALSE_TO_TRUE_CONVERSION | 1.5 | 가짜→진짜 감정 |
| 4 | NEED_IDENTIFIED | 1.2 | 필요 식별 |
| 5 | CLEAR_REQUEST | 1.3 | 명확한 요청 |
| 6 | BOUNDARY_ASSERTION | 1.6 | 경계 설정 |
| 7 | REGULATION_ATTEMPT | 1.2 | 조절 시도 |
| 8 | INTENSITY_REDUCTION | 1.5 | 강도 감소 |
| 9 | PATTERN_LINKED | 1.7 | 패턴 연결 |
| 10 | PAST_MEMORY_REFERENCED | 1.2 | 과거 기억 |
| 11 | O_F_N_R_COMPLETED | 2.0 | O-F-N-R 완료 |
| 12 | REPAIR_ATTEMPT | 1.8 | 회복 시도 |
| 13 | POST_CONFLICT_RETURN | 2.2 | 갈등 후 복귀 |
| 14 | SELF_REFRAMING | 1.4 | 자기 리프레임 |
| 15 | *(확장 후보)* | — | 예: EMPATHY_EXPRESSED ✅ 반영됨. 추가 후보: VALUES_CLARIFIED 등 — EMOTIONAL_STATS_V3_NEXT_STEP_1PAGE 참고. |

**소스**: `coreStats.ts` EVENT_IDS, EVENTS. `detectEvent.ts` EVENT_PATTERNS (KO/EN).

---

## 2. stat_distribution (이벤트 → 코어 스탯 가중치)

- **코어 스탯 6종**: EA(Emotional Awareness), RS(Regulation Stability), BS(Boundary Strength), TI(Trigger Insight), RC(Relational Clarity), RD(Resilience Depth).
- **규칙**: 각 이벤트당 `Partial<Record<CoreStatId, number>>`, 합 1.0. 세션 Q·novelty·consistency 반영 후 `computeSessionGains`에서 분배.
- **예**: FEELING_LABELED → EA 0.8, RS 0.2. O_F_N_R_COMPLETED → RC 0.7, BS 0.2, EA 0.1.
- **소스**: `coreStats.ts` STAT_DISTRIBUTION. `formula.ts` computeSessionGains.

---

## 3. 30일 가속 (phase_tuning)

| 구간 | acceleration_factor | phase_multiplier | consistency_cap |
|------|----------------------|------------------|------------------|
| Day 1–7 | 1.25 − day/100 (min 0.5) | 1.2 | 1.4 |
| Day 8–21 | 동일 | 1.0 | 1.3 |
| Day 22–30 | 동일 | 0.9 | 1.2 |
| Day 31+ | 1.0 | 0.85 | 1.4 |

- **소스**: `phase.ts` getAccelerationFactor, getPhaseMultiplier, getConsistencyCap. `formula.ts` computeStatDelta(userDay).

---

## 4. 검증·확장 체크리스트

- [x] 이벤트 15종: 15번째 이벤트 ID(EMPATHY_EXPRESSED)·EVENT_PATTERNS·STAT_DISTRIBUTION·CORE_STATS source_events 반영됨.
- [x] stat_distribution: 15건 정의·computeSessionGains 연동됨.
- [ ] 30일 가속: API·프로필에서 user_day 전달 여부 및 formula 연동 확인.
- **다음 단계**: `EMOTIONAL_STATS_V3_NEXT_STEP_1PAGE.md` 참고.

*참고: HEALING_COACHING_SPEC_V3.md, SYSTEM_UPGRADE_PLAN_EMOTIONAL_STATS.md, NEXT_PROJECT_RECOMMENDED.md §2 C.*
