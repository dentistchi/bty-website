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
   - ⚠️ features/growth seed 파이프(31파일)는 Growth-private 아님 = Arena+my-page+Center 공유 load-bearing infra. Arena POST /api/bty/arena/signals → saveArenaSignalWithSeed → buildReflectionSeed (PRODUCER, core flow). my-page MyPageLeadershipConsole → loadReflections (CONSUMER). "growth" namespace = misnomer. → 결정4 "seed 파이프 보존" = mandatory + broader. naive 삭제 시 Arena signal-save(무게중심) + my-page 콘솔 깨짐.
   - ⚠️ Arena→Growth reflection airlock(useArenaSession reviewReflection)은 DEAD(caller 0). STEP0-B3 "live airlock" = 오류 교정. B4 "airlock 재경로" = no-op(dead method delete).
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
- **B4** = remaining Growth (decisions locked 2026-06-08): d-move / b-stay / e-remove.
  성격 = "Growth UI 제거 + 공유 seed infra 보존". Arena core flow(seed producer) 미접촉. freeze 무관(STEP0 [7]).
  내부 순서(흡수/이사 먼저, 제거 마지막):
  - **B4b** (doc-only) — features/growth/{logic,api}에 shared-infra 모듈 헤더/README. Arena producer+my-page+Center consumer 명시. 코드/import 무변경.
  - **B4c+B4d-move** (이사) — Center에 reflection surface 신설: reflection/write/recovery UI + history view를 Center 라우트로 이전, import는 b-stay된 features/growth 파이프로 repoint.
  - **B4a** (제거) — alias 3(dojo/integrity/guidance) redirect + 허브 카드 제거(외부 진입점 0).
  - **B4e** (제거, LAST) — 빈 /growth 허브 + 이전 완료 sub-route + GrowthRouteLoadingShell/loading/sprint252 제거. 선행: B4e STEP0가 /growth 외부 진입점 0 증명, live ref면 sever-first.
  - **B4f** (cleanup) — dead reviewReflection airlock 삭제.

## Governance
- 각 B-block: STEP 0 (read-only inventory, ≥3 cross-check) → verdict → STEP 1 (mutation). One dispatch = one action.
- Verify gates: `tsc --noEmit` + vitest. Terminology lint ≤13.
- Runtime 검증 = deploy 후 staging URL only (localhost auth-gated 육안 불가).

## STEP0 correction log
- [2026-06-08 IA-B4-STEP0] Plan correction discovery (2건). (1) features/growth seed = Arena+my-page 공유 load-bearing infra(31파일), Growth-private 아님 — 보존 mandatory. (2) Arena airlock(reviewReflection) = DEAD(caller 0), STEP0-B3 "live" 오류 교정. B4 decisions: d-move(reflection family→Center) / b-stay(seed 제자리 문서화) / e-remove(hub 404). freeze 무관.
- [2026-06-08 IA-B3-STEP0] Plan correction discovery. 결정4 footprint 과소 판명 — reflection/recovery/Arena airlock(`useArenaSession.ts:199`)/features/growth seed 모듈이 lock에 누락. B3(journey only) / B4(remaining) 분리 확정. B3a 흡수 = near-noop(train이 journey day UX 이미 subsume). freeze 의존 0 확인(STEP0 [E]).
