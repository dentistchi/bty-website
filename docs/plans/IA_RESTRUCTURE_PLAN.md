# IA_RESTRUCTURE_PLAN.md — btyARENA Information Architecture (MVP-active)

## Scope & freeze boundary
- IA / Center cleanup은 **MVP 중 허용**.
- Freeze 적용 = Arena 측정 · Stage 산출 엔진 · Phase 5 (choice trade-off restructuring) 뿐.
- 본 plan은 navigation/route topology + Center 구성만 건드림 — 측정/Stage 산출 무관.

## Weight center & sequence
- 무게중심 = **Arena** (`/bty-arena`).
- Canonical sequence: **train → Center (4 stages) → Awakening (3 acts)**.

## Decisions (locked) — 5
1. **28-day = `train` single.** `/growth/journey` (+ `day/[1–28]`) 폐기. mission/reflection UX는 train으로 흡수. (journey = 4 unused entries.)
2. **Center = 28-day 훈련홈 + 자기인식 거울.**
   - C = `TrainProgressCard` (28일) → 절대 주인공 · 1차 CTA.
   - A (`HealingPhaseTracker` 4단계, 측정무관 독립트랙) + B (Stage 뱃지 "Leadership Withdrawal", Arena Leadership Engine Stage **read-only 투영**) → 보조 **"Current State"** 단일 카드로 통합.
   - Stage 산출 엔진 = freeze. Badge = display-only projection.
3. **Awakening 게이트 = train 완주** (distinct day == 28). 기존 server-side eligibility (day30 + 10 sessions, `NOT_ELIGIBLE` 403)와 정합.
4. **Growth 해체 — STEP0 inventory로 footprint 교정 (2026-06-08).**
   당초 lock = "alias 3 + history → Center" (inventory 전 작성, 과소).
   실제 Growth footprint:
   - journey (+ day 1–28)
   - history
   - reflection / reflection/write
   - recovery
   - Arena→Growth reflection airlock (`useArenaSession.ts:199`, live)
   - features/growth/ seed 모듈 (~30 파일, logic+api)
   - alias 3 (dojo/integrity/guidance redirect)
   → 규모상 단일 블록 불가. B3(journey only) / B4(remaining)로 분리.
5. **무게중심 = Arena.** 제품 중심 = Arena (리더십 시뮬레이션, 측정 엔진).
   로그인 랜딩 = `/bty-arena` 유지. train/Center/Awakening = 보조 자기인식·훈련 라인.
   → 결정1~4는 전부 "Arena 중심 하의 보조 라인 정리"다.

## Deployment sequence (흡수/이사 먼저, 제거 마지막)
**원칙:** 보조 라인의 가치(mission/reflection UX, history)를 train/Center로 먼저 흡수·이사한 뒤에만 원본 라우트를 제거한다. **흡수/이사 = 제거의 선행 의존성.**

- **B1** = 결정2 (표시): Current State 카드 통합 + Stage badge read-only. **CLOSED** (inner 4e6a636e / deployed bdbe5512).
- **B2** = 결정3 (게이트): Awakening gate = train 완주(distinct day==28). **CLOSED** (inner 6f202281 / deployed bdbe5512).
- **B3** = journey retirement ONLY (S-PHASED). freeze 미접촉(STEP0 [E] 검증, 엔진 의존 0). 내부 순서 강제:
  - **B3a (흡수 verify)** — train이 journey day UX 이미 subsume 확인(near-noop). `train/day/*` vs `lib/bty/journey`. journey 고유 state(current_day, bounce-back)는 Comeback 먹이 용도.
  - **B3b (Comeback rework)** — 글로벌 Comeback(`components/Comeback.tsx`, `layout.tsx:32`) repoint:
    `onResumeJourney` `/growth/journey` → train(`/train/day/${n}`), 카피 "Resume Journey" → "Resume Training"(train 의미 이전). 전 페이지 영향. bounce-back API 처리 동반.
  - **B3c (제거)** — journey route/component/api/lib 제거 (B3a+B3b 후). journey routes, `components/bty/journey/*`, `components/journey/*`, `lib/bty/journey/*`, `api/journey/*`.
  - **B3 제외(B4로):** alias 3, history, reflection, reflection/write, recovery, Arena airlock, features/growth seed pipeline.
- **B4** = remaining Growth decomposition (신설, B3 후 별도 STEP0부터).
  alias 3 제거 + history→Center 이사 + reflection/recovery 처리 + Arena airlock(`useArenaSession:199`) 재경로 + features/growth seed 모듈 re-home (결정4 "seed 파이프 보존").
  ⚠️ Arena post-run flow 건드림 = Arena(무게중심) 영향. observation loop 중 신중. 별도 inventory 필수.

## Governance
- 각 B-block: STEP 0 (read-only inventory, ≥3 cross-check) → verdict → STEP 1 (mutation). One dispatch = one action.
- Verify gates: `tsc --noEmit` + vitest. Terminology lint ≤13.
- Runtime 검증 = deploy 후 staging URL only (localhost auth-gated 육안 불가).

## STEP0 correction log
- [2026-06-08 IA-B3-STEP0] Plan correction discovery. 결정4 footprint 과소 판명 — reflection/recovery/Arena airlock(`useArenaSession.ts:199`)/features/growth seed 모듈이 lock에 누락. B3(journey only) / B4(remaining) 분리 확정. B3a 흡수 = near-noop(train이 journey day UX 이미 subsume). freeze 의존 0 확인(STEP0 [E]).
