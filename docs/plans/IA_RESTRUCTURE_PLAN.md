> ⚠️ SUPERSEDED — D1/D4 WRONG-TREE / NOT EXECUTABLE (2026-06-12, B3-REBASE / OUTER-RECOVERY)
> canonical tree = btytrainingcenter-INNER (inner-main). 본 D1/D4 는 non-canonical/decoy 트리
> (bty-website/bty-app, bty/journey/page.tsx 보유) 형상 기준 — production inner-main 미반영.
> 실측(STEP0-R, read-only):
>  - growth/journey PAGE: inner-main 부재. journey = API-only(api/journey/bounce-back),
>    유일 caller = Comeback.tsx:20. "4 entries" = 0.
>  - growth HUB page: 부재. dismantle 대상 없음.
>  - features/growth: 공유 LOAD-BEARING infra(Center+My Page+identity+letterService 의존).
>    반드시 SURVIVE. 삭제 금지.
>  - redirect alias: integrity→/bty 1개뿐.
>  - reflection board → Center: 완료(Center가 getLatestReflectionSeed import, :511 호출). no-op.
>  - Comeback: 전역 re-engagement modal(time-based, layout.tsx:32). journey 잔재 아님. PARKED, KEEP.
> production code removal 미실행. canonical reality = inner-main docs/IA_CANONICAL_REALITY.md.
> D1/D4 를 기재대로 실행하지 말 것.

# IA_RESTRUCTURE_PLAN.md — btyARENA Information Architecture (MVP-active)

## Scope & freeze boundary
- IA / Center cleanup은 **MVP 중 허용**.
- Freeze 적용 = Arena 측정 · Stage 산출 엔진 · Phase 5 (choice trade-off restructuring) 뿐.
- 본 plan은 navigation/route topology + Center 구성만 건드림 — 측정/Stage 산출 무관.

## Weight center & sequence
- 무게중심 = **Arena** (`/bty-arena`).
- Canonical sequence: **train → Center (4 stages) → Awakening (3 acts)**.

## Decisions (locked) — 6
1. **28-day = `train` single.** `/growth/journey` (+ `day/[1–28]`) 폐기. mission/reflection UX는 train으로 흡수. (journey = 4 unused entries.)
2. **Center = 28-day 훈련홈 + 자기인식 거울.**
   - C = `TrainProgressCard` (28일) → 절대 주인공 · 1차 CTA.
   - A (`HealingPhaseTracker` 4단계, 측정무관 독립트랙) + B (Stage 뱃지 "Leadership Withdrawal", Arena Leadership Engine Stage **read-only 투영**) → 보조 **"Current State"** 단일 카드로 통합.
   - Stage 산출 엔진 = freeze. Badge = display-only projection.
   - Center 최종형 (IA-B4 종착): **Day Hero(train) + Current State + Dear Me** 2축. Dear Me = Write + History(canonical 기록). History = free letter(body) + Train day_reflection(Q/A set) shape 분기 통합 표시. Reflection 카드·Energy Log surface 별도 신설 안 함. 작성=흐름 안, 회고=Center.
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
6. **Dear Me = Canonical Self-Reflection Layer (방향 lock + 형태 C2 확정, 2026-06-09).**
   **Dear Me is the canonical self-reflection layer.**
   **All self-reflection artifacts eventually converge into Dear Me.**
   **Dear Me is one experience, not necessarily one database shape.**
   Future entries originate from **Train · Arena · Center**, source-aware. Candidate metadata: `source` / `day` / `prompt` / `seed_id` / `responses`.

   **형태 확정 = C2 Day Reflection Set (모델 B, 28일 전체).** (A형 본문하단 단일 composer = Unit1 deployed ffe9777e, 과도기 → C2로 진화.)
   🔴 **UX lock: Each Train Day has one Dear Me Reflection. It may contain zero or more guided questions, but it always ends with one integrated reflection.**
   (각 Train Day = 1 Dear Me Reflection. 안내 질문 0개 이상, 항상 통합 성찰 1개로 마무리.)

   **도출 모델** (UX에서 도출 — 거꾸로 아님): `dear_me_letters` + `responses jsonb` + `type='day_reflection'` + `source='train'`. responses = `{ title, questions:[{q,a}...], finalReflection }`. 저장 = `upsert(user_id, day, source)`. free letter(body shape) 공존 = **one table, multi-shape**. engine reader(slip-recovery/recommender `.eq type='letter'`)가 day_reflection 자동 제외(오염 0).
   **Tier 1/2/3 폐기** — `questions.length` 0~N으로 통일(분류 불필요).

   **엔진/콘텐츠 분리:** 엔진(스키마+폼 TrainDayReflectionSet+write upsert+History shape 분기 — 코드, 28일 지원, Day 수 무관) + 콘텐츠(Day별 질문 세트, 점진 authoring, 5 Day 파일럿 검증 → 28일).

   파생 작업 (각자 별도 inventory/design — 결정6 Lane): Dear Me 통합 화면(Calendar/Search) · AI Summary · Pattern Review · Unified History · legacy reflection migration. Unit2 28-day content rewrite("종이와 펜"→Dear Me) = C2 질문 세트 authoring으로 흡수.

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
- **B4** = remaining Growth (REVISED 2026-06-08, d-move 폐기): Reflection **Dear Me 흡수**(형태2/2b) + Recovery **disposition** + Growth 제거. 무게중심-safe(ABSORB-STEP0: seed producer→bty_reflection_seeds / consumer my-page→localStorage, 흡수 대상 bty_reflection_entries는 history UI만 read — Arena/my-page 미접촉). freeze 무관.
  ⚠️ d-move(reflection family를 Center 별도 surface로 이사) = 폐기. Center에 Dear Me+Reflection 2 글쓰기 surface = 분산 역행. Reflection = Dear Me의 한 양상.
  내부 순서(흡수/이사 먼저, 제거 마지막):
  - **B4b** (doc-only) — features/growth = shared seed infra 명시. CLOSED (53580ab9).
  - **B4c** (Reflection 흡수, 형태2/2b 과도기): dear_me_letters에 type(+seed_id) additive 컬럼(비파괴, 기존 letter 안전; DB=SQL Editor+migration repair, db push 금지). 신규 reflective write → Dear Me typed entry(seed-prompted, getLatestReflectionSeed 연결). 기존 bty_reflection_entries → read-only history(데이터 이동 없음). legacy 마이그레이션 = 결정6 완성 후 별도.
  - **B4d** (Recovery disposition): gate 로직(checkRecoveryTrigger + recovery types) 보존 — my-page 의존 공유 infra. standalone RecoveryEntryScreen UI + /growth/recovery 라우트만 제거. 흡수 아님.
  - **B4a** (제거) — alias 3 redirect + 허브 카드(외부 진입점 0).
  - **B4e** (제거, LAST) — 빈 /growth 허브 + 이전 완료 sub-route. 선행: /growth 외부 진입점 0 증명, live ref면 sever-first.
  - **B4f** (cleanup) — dead reviewReflection airlock.

## Governance
- 각 B-block: STEP 0 (read-only inventory, ≥3 cross-check) → verdict → STEP 1 (mutation). One dispatch = one action.
- Verify gates: `tsc --noEmit` + vitest. Terminology lint ≤13.
- Runtime 검증 = deploy 후 staging URL only (localhost auth-gated 육안 불가).

## STEP0 correction log
- [2026-06-09 DECISION6-C2 형태 확정] Dear Me 형태 A→C2 재정의. Unit1(A형 본문하단 composer, deployed ffe9777e)에서 실사용 발견: reflection이 prompt 컨텍스트 없이 body만 History 노출(질문≠답 분리). C2-STEP0/UX 설계로 형태 확정 = Day Reflection Set(모델 B, 28일 전체). UX lock: "각 Train Day = 1 Dear Me Reflection, 질문 0~N + 통합 성찰 1." 도출 모델 = dear_me_letters + responses jsonb + type='day_reflection' + upsert(user,day,source); free letter와 one-table multi-shape(engine reader type='letter' 필터로 오염 0). Tier 1/2/3 폐기(questions.length 통일). 엔진(코드, 28일)/콘텐츠(질문세트, 점진) 분리. Unit2 카피 = C2 흡수. [backlog] Train Day panel UX(모바일 토글 active 피드백/scrollIntoView + completion summary empty-state); two-endpoint split(/api/dear-me/letter canonical vs /api/bty/center/dear-me legacy = 후속 결정6 lane); HealingPhaseTracker full-mode dead code prune; orphan i18n(B4e-2b ~93키).
- [2026-06-08 IA-B4cd-ABSORB-STEP0] (1) 흡수 무게중심-safe: seed producer(Arena)→bty_reflection_seeds, consumer(my-page)→localStorage, 흡수 대상(bty_reflection_entries)은 history UI만 read — Arena/my-page 미접촉. (2) Recovery = re-entry gate/state(my-page 공유), journal 아님 → disposition(gate 보존, UI만 제거). (3) dear_me_letters = letter 전용 스키마(type/seed_id 없음) → additive 확장 필요 = 결정6 기반. (4) d-move 폐기, Reflection→Dear Me 흡수(형태2/2b). [backlog] reflection dual-store 단절: write→DB(bty_reflection_entries) vs my-page read→localStorage(bty-reflections), pre-existing, 흡수 무관, IA 후 reconcile.
- [2026-06-08 IA-B4-STEP0] Plan correction discovery (2건). (1) features/growth seed = Arena+my-page 공유 load-bearing infra(31파일), Growth-private 아님 — 보존 mandatory. (2) Arena airlock(reviewReflection) = DEAD(caller 0), STEP0-B3 "live" 오류 교정. B4 decisions: d-move(reflection family→Center) / b-stay(seed 제자리 문서화) / e-remove(hub 404). freeze 무관.
- [2026-06-08 IA-B3-STEP0] Plan correction discovery. 결정4 footprint 과소 판명 — reflection/recovery/Arena airlock(`useArenaSession.ts:199`)/features/growth seed 모듈이 lock에 누락. B3(journey only) / B4(remaining) 분리 확정. B3a 흡수 = near-noop(train이 journey day UX 이미 subsume). freeze 의존 0 확인(STEP0 [E]).
