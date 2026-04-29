# 감정 스탯 v3 — 이벤트 15종·stat_distribution 구현 설계 1페이지

**갱신일**: 2026-03-06  
**근거**: `EMOTIONAL_STATS_V3_DESIGN_1PAGE.md`, `coreStats.ts`, `formula.ts`, `phase.ts`, `detectEvent.ts`.  
**목적**: 15번째 이벤트 추가·stat_distribution·30일 가속 연동 구현 시 개발용 단일 페이지. UI는 API/도메인 값만 렌더(render-only).

---

## 1. 이벤트 15종 구현

| 파일 | 변경 내용 |
|------|------------|
| **coreStats.ts** | `EVENT_IDS`에 15번째 ID 추가(예: `EMPATHY_EXPRESSED` 또는 스펙 확정 값). `EVENTS`에 `{ id, quality_weight }` 추가. `EVENT_QUALITY_WEIGHT` 자동 반영. |
| **coreStats.ts** | `STAT_DISTRIBUTION`에 15번째 이벤트 키 추가. 값: `Partial<Record<CoreStatId, number>>` 합 1.0(예: EA 0.5, RC 0.5). |
| **coreStats.ts** | `CORE_STATS` 중 해당 이벤트를 받는 stat의 `source_events` 배열에 15번째 ID 추가. |
| **detectEvent.ts** | `EVENT_PATTERNS`(KO/EN)에 15번째 이벤트 패턴 추가. `detectEvent()` 반환 타입이 `EventId`이면 자동 허용. |
| **기타** | `formula.ts`·`computeSessionGains`는 `STAT_DISTRIBUTION[eventId]` 참조만 하므로 신규 키 추가 시 동작. |

---

## 2. stat_distribution 규칙

- **형식**: `Record<EventId, Partial<Record<CoreStatId, number>>>`. 각 이벤트당 코어 스탯(EA, RS, BS, TI, RC, RD) 가중치 합 1.0 권장.
- **위치**: `coreStats.ts` `STAT_DISTRIBUTION`.
- **사용**: `formula.ts` `computeSessionGains`에서 세션 이벤트별로 `perEventGain * weight`를 코어 스탯에 가산. 신규 이벤트 추가 시 해당 엔트리만 추가하면 됨.

---

## 3. 30일 가속·phase 연동

| 항목 | 구현 요약 |
|------|------------|
| **도메인** | `phase.ts` `getAccelerationFactor(userDay)`, `getPhaseMultiplier(userDay)`, `getConsistencyCap(userDay)` 이미 구현됨. |
| **formula** | `computeStatDelta`, `computeSessionGains`에 `userDay?: number` 전달 시 가속·phase 적용됨. |
| **API** | `POST /api/emotional-stats/record-event` 또는 세션 완료 API에서 `user_day`(가입일·첫 활동일 기준 경과일) 계산 후 `computeSessionGains(..., userDay)` 호출. |
| **프로필** | 프로필·대시보드에서 `user_day` 전달 여부 확인. 없으면 `userDay` 생략 시 기존 동작(가속 없음). |

---

## 4. 구현 체크리스트

- [ ] 15번째 EventId 확정(EMPATHY_EXPRESSED 등). EVENT_IDS·EVENTS·EVENT_QUALITY_WEIGHT 추가.
- [ ] STAT_DISTRIBUTION에 15번째 이벤트 가중치(합 1.0) 추가.
- [ ] CORE_STATS source_events에 15번째 이벤트 반영.
- [ ] detectEvent.ts EVENT_PATTERNS(KO/EN) 추가. 기존 테스트(detectEvent.test.ts) 확장.
- [ ] record-event 또는 세션 API에서 user_day 계산·전달 및 computeSessionGains(userDay) 연동 확인.
- [ ] UI: 변경 없음. API/도메인 결과만 표시.

---

*참고: EMOTIONAL_STATS_V3_DESIGN_1PAGE.md, coreStats.ts, formula.ts, phase.ts, detectEvent.ts, NEXT_PROJECT_RECOMMENDED §2 C.*
