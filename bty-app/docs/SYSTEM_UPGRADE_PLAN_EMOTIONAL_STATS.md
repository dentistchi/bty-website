# 시스템 업그레이드 계획 — Core Stats / Events / Advanced Stats

**목적**: 감정·상담 효과를 추적하는 **Core Stats**(EA, RS, BS, TI, RC, RD)와 **Events**(quality_weight), **Advanced Stats**(해금) 시스템을 도입한다.  
**원칙**: Arena XP·Weekly XP·리더보드와 **분리**된 내부 축적 구조. UI에는 **숫자 미노출**, 문구만 표시.

---

## 1. 스펙 요약 (JSON + 이미지)

### 1.1 Core Stats (6종)

| id | name | source_events |
|----|------|---------------|
| EA | Emotional Awareness | FEELING_LABELED, FALSE_TO_TRUE_CONVERSION |
| RS | Regulation Stability | REGULATION_ATTEMPT, INTENSITY_REDUCTION |
| BS | Boundary Strength | CLEAR_REQUEST, BOUNDARY_ASSERTION |
| TI | Trigger Insight | PATTERN_LINKED, PAST_MEMORY_REFERENCED |
| RC | Relational Clarity | O_F_N_R_COMPLETED |
| RD | Resilience Depth | REPAIR_ATTEMPT, POST_CONFLICT_RETURN |

### 1.2 Events & quality_weight

- FEELING_LABELED 1.0, FALSE_TO_TRUE_CONVERSION 1.5, REGULATION_ATTEMPT 1.2, INTENSITY_REDUCTION 1.5, CLEAR_REQUEST 1.3, BOUNDARY_ASSERTION 1.6, PATTERN_LINKED 1.7, PAST_MEMORY_REFERENCED 1.2, O_F_N_R_COMPLETED 2.0, REPAIR_ATTEMPT 1.8, POST_CONFLICT_RETURN 2.2.

### 1.3 Advanced Stats (해금 조건)

- Pattern Recognition Mastery: TI≥50, PATTERN_LINKED_count≥5  
- Secure Attachment Growth: BS≥40, RC≥40, CLEAR_REQUEST_success≥3  
- Emotional Leadership: RD≥60, O_F_N_R_COMPLETED_count≥10  
- Conflict Navigation Skill: REPAIR_ATTEMPT_count≥5, POST_CONFLICT_RETURN_count≥3  
- Compassion Depth: EA≥70, self_reframing_count≥5  
- Identity Stability: RS≥70, INTENSITY_REDUCTION_count≥3  

### 1.4 점수 계산 공식 (이미지)

- **Step 1 — 세션 품질 Q**: `Q = (∑ 이벤트 quality_weight) / 이벤트_최대_가능치`, 0~1 정규화.
- **Step 2 — 스탯 상승량 Δ**: `Δ = base_gain × Q × novelty × consistency`
  - base_gain = 0.8  
  - novelty = 1.0 ~ 0.2 (같은 패턴 반복 시 감소)  
  - consistency = 1.0 ~ 1.3 (7일 루틴 유지 시 증가)  
- **상한**: 1세션당 한 스탯 최대 상승 `max_per_session = 1.5`.

### 1.5 UI 규칙 (이미지 §5)

- **숫자 노출 금지.** 수치는 내부 DB에만 존재.
- **보여지는 방식**: 문구만. 예: "Boundary Strength 상승", "Regulation Stability 강화됨", "Secure Attachment Growth 잠금 해제됨".

### 1.6 악용 방지 (이미지 §6)

- `duplicate_pattern_penalty`: true — 동일 패턴 반복 시 패널티/감점.
- `rapid_session_penalty`: true — 짧은 시간 내 연속 세션 보상 감소.
- `emotion_spam_no_reward`: true — 감정 스팸은 보상 없음.
- `deep_trauma_not_bonus_scored`: true — 심각 트라우마 관련은 보너스 점수 없음.

### 1.7 운영 관점 (이미지 §7)

- 장기 사용자 데이터 기반 개인화, 리더십 Arena와 자연 연결 가능, **시즌과 분리된 Core 축적 구조 유지**, 상담 효과 게임화하되 왜곡 최소화.

---

## 2. 아키텍처 원칙

- **Arena XP·리더보드와 분리**: 이 시스템의 수치는 리더보드·Weekly XP·Core XP(기존)에 **사용하지 않음**. 시즌과 분리된 별도 축적.
- **도메인 순수 함수**: Q·Δ·novelty·consistency·해금 판정은 `src/domain/` 또는 `src/lib/bty/emotional-stats/` 에서 **순수 함수**로만 구현. DB/API는 호출만.
- **UI는 결과만**: 숫자 없이 "스탯명 상승", "Advanced 해금" 문구만 표시. 계산 로직은 UI에 두지 않음.

---

## 3. 구현 계획 (단계별)

### Phase A: 도메인·상수

- **경로**: `src/lib/bty/emotional-stats/` (또는 `src/domain/emotionalStats/`).
- **파일**:
  - `coreStats.ts`: core_stats, events, advanced_stats 상수 및 source_events 매핑.
  - `formula.ts`: `computeSessionQualityQ(eventsInSession)`, `computeStatDelta(Q, novelty, consistency)`, `clampDelta(delta, maxPerSession)`.
  - `unlock.ts`: `checkAdvancedUnlock(advancedStatId, userCoreValues, eventCounts)` — 해금 여부 판정(순수 함수).
- **입력**: 세션 내 발생 이벤트 ID 목록 → Q 계산. Q + novelty + consistency → Δ. 해당 core_stat에 Δ 가산(기존 값 + Δ, DB는 API에서).

### Phase B: 악용 방지 (도메인/서비스)

- **경로**: `src/lib/bty/emotional-stats/antiExploit.ts`.
- **로직**: `shouldApplyReward(sessionContext)`: duplicate_pattern_penalty, rapid_session_penalty, emotion_spam_no_reward, deep_trauma_not_bonus_scored 판단 후 true/false. (세션 컨텍스트: 최근 이벤트 패턴, 세션 간격, 메시지 내용 요약 등 — MVP에서는 간단 규칙만.)
- **novelty**: 같은 이벤트 타입 연속 N회 이상이면 novelty 감소 (도메인 규칙으로 정의).
- **consistency**: 7일 연속 참여 시 consistency 상한 1.3 (저장은 API/DB에서 "마지막 활동일" 등으로 계산).

### Phase C: DB 스키마

- **테이블 (제안)**:
  - `user_emotional_stats`: user_id, stat_id (EA/RS/BS/TI/RC/RD), value (numeric), updated_at. (UNIQUE(user_id, stat_id).)
  - `emotional_events`: user_id, event_id, session_id(optional), quality_weight, created_at. (이벤트 로그.)
  - `emotional_sessions`: session_id, user_id, started_at, ended_at(optional). (세션 단위 Q 계산용.)
  - `user_advanced_unlocks`: user_id, advanced_stat_name, unlocked_at. (해금 기록.)
- **RLS**: user_id = auth.uid() 만 접근. Arena/weekly_xp 테이블과 조인하지 않음.

### Phase D: API

- **POST /api/emotional-stats/record-event**: body: { event_id, session_id? }. 인증 필수. antiExploit 통과 시에만 emotional_events insert, 해당 세션 Q 재계산 → 영향 받는 core_stat에 Δ 반영 (formula 호출). 응답에는 숫자 없이 `{ ok: true, message_key?: "stat_increased" }` 등만.
- **GET /api/emotional-stats/display**: 인증 필수. 응답: `{ phrases: string[] }` — 예: ["Boundary Strength 상승", "Secure Attachment Growth 잠금 해제됨"]. 내부에서 core_stats 값·advanced 해금 여부를 읽어서 **문구만** 생성해 반환. (숫자·스탯 값 자체는 반환하지 않음.)

### Phase E: 이벤트 발생 지점

- **챗/멘토 응답에서 이벤트 판별**: `/api/chat`, `/api/mentor` 응답 생성 후, LLM 응답 또는 규칙 기반으로 FEELING_LABELED, O_F_N_R_COMPLETED 등 **이벤트 ID 판별**. 판별되면 `POST /api/emotional-stats/record-event` 내부 호출 또는 동일 요청 내에서 record 로직 호출.
- **이벤트 판별 방식**: MVP는 규칙(키워드·패턴) 또는 LLM 출력에 `event_id` 필드 포함. 상세는 별도 스펙.

### Phase F: UI

- **Dear Me / Dojo / 챗 영역**: GET /api/emotional-stats/display 호출 후 `phrases` 배열만 렌더. "오늘의 성장" 한 줄 문구, 또는 해금 시 "Secure Attachment Growth 잠금 해제됨" 토스트 등. **숫자·progress bar 값 미노출.**

---

## 4. 파일·경로 요약

| 단계 | 경로 | 비고 |
|------|------|------|
| 도메인 상수 | `src/lib/bty/emotional-stats/coreStats.ts` | core_stats, events, advanced_stats JSON → TS 상수 |
| 도메인 공식 | `src/lib/bty/emotional-stats/formula.ts` | Q, Δ, clamp |
| 도메인 해금 | `src/lib/bty/emotional-stats/unlock.ts` | checkAdvancedUnlock |
| 악용 방지 | `src/lib/bty/emotional-stats/antiExploit.ts` | shouldApplyReward, novelty/consistency 규칙 |
| 마이그레이션 | `supabase/migrations/YYYYMMDD_emotional_stats.sql` | user_emotional_stats, emotional_events, emotional_sessions, user_advanced_unlocks |
| API 기록 | `src/app/api/emotional-stats/record-event/route.ts` | POST, 내부에서 도메인+DB |
| API 표시 | `src/app/api/emotional-stats/display/route.ts` | GET, 문구만 반환 |
| 챗/멘토 연동 | `src/app/api/chat/route.ts`, `src/app/api/mentor/route.ts` | 응답 후 이벤트 판별 → record 호출 |
| UI | Dear Me/Dojo 레이아웃 또는 전용 컴포넌트 | display 호출 후 phrases 표시 |

---

## 5. BTY 규칙 준수

- **bty-release-gate / bty-arena-global**: 리더보드·Weekly XP·Core XP(기존)에는 이 시스템 **미사용**. 시즌과 분리된 Core 축적만 사용.
- **bty-ui-render-only**: UI는 **문구만** 표시. 스탯 값·랭킹·해금 조건 계산은 API/도메인에서만 수행.
- **도메인 순수**: formula, unlock, antiExploit는 DB/HTTP 의존 없이 테스트 가능한 순수 함수 유지.

---

## 6. 구현 순서 체크리스트

- [x] **A1** coreStats.ts — 상수 정의
- [x] **A2** formula.ts — Q, Δ, clamp
- [x] **A3** unlock.ts — 해금 판정
- [x] **B1** antiExploit.ts — 패널티/보상 여부
- [x] **C1** 마이그레이션 — 4개 테이블 + RLS
- [x] **D1** POST record-event API
- [x] **D2** GET display API (문구만)
- [x] **E1** 챗/멘토에서 이벤트 판별·record 호출 (간단 규칙 또는 스펙 확정 후)
- [x] **F1** UI — phrases 표시

**구현 완료 기록**: Phase A1~F1을 **도메인 → DB → API → UI** 순서로 반영 완료. (도메인·마이그레이션·record-event/display API·챗/멘토 연동·UI phrases 표시까지 적용된 상태.)

---

*이 문서는 업그레이드 범위와 계획만 정의. 구현 시 CURRENT_TASK에 "SYSTEM_UPGRADE_PLAN_EMOTIONAL_STATS Phase A1" 등으로 한 단계씩 지시.*

**계획 구체화 스펙 (치유 코칭 v3)**: 이벤트 15종·stat_distribution·30일 가속·rapid_session_penalty·Second Awakening 등 상세는 **`docs/specs/healing-coaching-spec-v3.json`** 및 **`docs/HEALING_COACHING_SPEC_V3.md`** 참고. 도메인/API 구현 시 해당 스펙을 단일 소스로 사용할 것.
