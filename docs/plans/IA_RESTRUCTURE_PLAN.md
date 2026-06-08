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
4. **Growth 해체.** alias 3 폐기 — Growth→Dojo (`/bty/dojo`), Growth→Integrity (`/bty/integrity`), Growth→Guidance (`/bty/mentor`). history → Center (seed 파이프 보존).
5. **무게중심 = Arena.** 제품 중심 = Arena (리더십 시뮬레이션, 측정 엔진).
   로그인 랜딩 = `/bty-arena` 유지. train/Center/Awakening = 보조 자기인식·훈련 라인.
   → 결정1~4는 전부 "Arena 중심 하의 보조 라인 정리"다.

## Deployment sequence (흡수/이사 먼저, 제거 마지막)
**원칙:** 보조 라인의 가치(mission/reflection UX, history)를 train/Center로 먼저 흡수·이사한 뒤에만 원본 라우트를 제거한다. **흡수/이사 = 제거의 선행 의존성.**

- **B1** = 결정2 (표시): Current State 카드 통합 + Stage badge read-only. ← START
- **B2** = 결정3 (게이트): Awakening gate = train 완주(distinct day==28), 기존 server eligibility 정합.
- **B3** = 결정1 + 4 (제거): ⚠️ HIGH RISK. 내부 순서 강제:
  - **B3a (흡수)** — journey의 mission/reflection UX → train 흡수.
  - **B3b (이사)** — Growth history → Center 이사 (seed 파이프 보존).
  - **B3c (제거/재작업)** — journey + Growth alias 제거.
    - Comeback `layout.tsx:32` 글로벌 컴포넌트 = journey 전용(`/api/journey/bounce-back` "Resume Journey").
    - journey 폐기 시 단순 제거 아님 → **제거/재작업 필수, 전 페이지 영향** (글로벌 컴포넌트가 사라진 라우트를 가리키게 됨).
  - **B3a · B3b는 B3c보다 반드시 선행.** (각 sub-step STEP 0가 범위 확정.)

## Governance
- 각 B-block: STEP 0 (read-only inventory, ≥3 cross-check) → verdict → STEP 1 (mutation). One dispatch = one action.
- Verify gates: `tsc --noEmit` + vitest. Terminology lint ≤13.
- Runtime 검증 = deploy 후 staging URL only (localhost auth-gated 육안 불가).
