# CURRENT TASK — 2026-03-23

## STATUS: STRUCTURE COMPLETE → BEHAVIOR ENGINE PHASE

BTY 시스템은 다음 단계로 전환됨:

> ❌ 구조 안정화 단계 종료  
> ✅ 행동 엔진 고도화 단계 진입

---

## 1. COMPLETED (THIS SPRINT)

### Arena
- canonical route 통합 (`/bty-arena`)
- session/next 기반 시나리오 흐름 정상화
- stale local state 문제 해결
- XP (Core / Weekly) 정상 반영
- [x] BTY Memory Engine scaffold — `20260430330000_bty_memory_engine.sql`, `src/engine/memory/*`, `recordChoiceConfirmedMemory` in `scenario-outcome-bridge`
- [x] Memory Recall Prompt — `consumePendingPatternThresholdRecall` in `session/next` → `recallPrompt` on API + Arena lobby UI (`BtyArenaRunPageClient`), `user_memory_recall_log` + trigger `processed`
- [x] Memory Engine live schema repair — `20260430340000_memory_engine_user_behavior_events_align.sql` (`played_at`, `payload`, defensive `source`, indexes); smoke script `bty-app/scripts/memory-engine-smoke.ts`
- [x] Memory recall log — `user_memory_recall_log.trigger_scenario_id` NOT NULL: insert sets `trigger_scenario_id` from session `scenarioId`; migration `20260430350000_user_memory_recall_log_trigger_scenario_id.sql`
- [x] Memory recall log — full row: `recalled_from_scenario_id` (enqueue + trigger payload), `pattern_key`, `recall_message`, `recall_type`, `related_event_ids: []`; `20260430360000_user_memory_recall_log_recall_columns.sql`

### Avatar
- legacy → manifest outfit 시스템 전환 완료
- avatarCharacter / outfit / accessory layer 정렬
- dashboard / profile / arena avatar 일관성 확보
- outfit 404 문제 해결

### UI System Alignment (CRITICAL)
- ScreenShell 전면 적용
- InfoCard 단일 카드 시스템 정렬
- ProgressCard → InfoCard 통합
- PrimaryButton / SecondaryButton 통일
- dashboard 3-card 구조 적용
- profile / avatar / lab 정렬 완료

---

## 2. CURRENT FOCUS

### 🎯 Behavior Engine Activation

현재 시스템은 "보여주는 구조"는 완성되었으나  
"행동을 변화시키는 엔진"은 아직 미완성 상태.

---

## 3. NEXT PRIORITIES (ORDERED)

### 1. Memory Engine (HIGH)
- user_scenario_choice_history 기반 패턴 추적
- “Last time you…” recall 시스템
- 반복 행동 탐지

### 2. Delayed Outcome Engine
- 선택 결과를 즉시 반영하지 않고 지연 적용
- narrative consequence 시스템

### 3. Perspective Switch (Role Mirroring)
- 리더 → 직원 시점 전환 시나리오
- empathy 강제 구조

### 4. Leadership Engine UI Exposure
- AIR / TII / LRI
- raw number → band / narrative 표현

### 5. Avatar Polish (FINAL)
- scale / padding / shadow 통일
- emotional presence 강화

---

## 4. NOT IN SCOPE (FOR NOW)

- UI redesign (이미 정렬 완료)
- routing 구조 변경
- XP 시스템 재설계
- Supabase 구조 변경

---

## 5. EXECUTION PRINCIPLE

- 새로운 기능 추가 ❌
- 기존 시스템 연결 및 강화 ⭕

---

## 6. SUCCESS CRITERIA

- 사용자가 “스토리가 반복된다” 느끼지 않음
- 선택 → 결과 → 회상 → 재학습 흐름 형성
- Arena → Foundry → Arena 루프 작동

---

## 7. ONE-LINE DIRECTION

> BTY는 이제 "UI 제품"이 아니라  
> **"행동을 바꾸는 엔진"을 완성하는 단계**다.