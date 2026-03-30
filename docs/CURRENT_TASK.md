# CURRENT TASK — 2026-03-23

- [x] 2026-03-30 — **`POST .../qr/validate`** — **`createClient`** service role (`NEXT_PUBLIC_SUPABASE_URL` / **`SUPABASE_URL`** + **`SUPABASE_SERVICE_ROLE_KEY`**); missing creds → **500** **`server_config_error`** · **작업 완료**
- [x] 2026-03-30 — **My Page QR validate (client)** — RSC passes **`arenaActionLoopParam`/`aaloParam`**; **`MyPageLeadershipConsole`** **`fetch`** **`/qr/validate`** + sheet + **`load()`** + URL strip; server validate removed (Workers-safe) · **작업 완료**
- [x] 2026-03-30 — **`POST /api/arena/leadership-engine/qr/action-loop-token`** — mint **`aalo1.*`** token + URL; **`signArenaActionLoopToken`** (`lib/bty/leadership-engine/qr/arena-action-loop-token`); pending contract gate; **`route.test.ts`** · **작업 완료**
- [x] 2026-03-30 — **`MyPageLeadershipConsole`** — **`handleRequestQr`** early-return **`console.warn`** + deps **`[serverPack, locale]`** (already present); Vitest QR / deferred-load / no-**`session_id`** · **작업 완료**
- [x] 2026-03-30 — **`GET /api/bty/my-page/state`** — **`metrics`** omits raw **`AIR`** (`AIR: _airOmitted` → **`metricsPublic`**) · **작업 완료**
- [x] 2026-03-30 — **C5 mirror hotfix deploy** — Worker **`8c6a4c36-1bc7-43f4-8b4a-bad18948f3b5`** · **`BUILD_ID`** **`KTI5-X3HuP-QxWa74QaxL`** live match · unauth smoke only · **작업 완료**
- [x] 2026-03-30 — **C3 mirror repetition hotfix** — **`pickLeastRecentMirror`** excludes last served **`mirror:`** id when **≥2** pool rows; **`MIRROR_POOL_RECENT_DISTINCT_ORIGIN_COUNT` = 5** (was 3); **`scenario-type-router.mirror-pick.test.ts`** + mirror pool window test · **작업 완료**
- [x] 2026-03-30 — **C3 session/next + mirror pool hotfix** — pending `bty_action_contracts` gate **409** (`action_contract_pending`) + fire-and-forget **missed** expiry; **`syncMirrorPoolForUser`** filters **`mirror:`/`pswitch_`** before upsert; **`generateMirror`** returns **null** for ineligible origins; **`route.test.ts`** + **`mirror-scenario.service.test.ts`** · **작업 완료**
- [x] 2026-03-30 — **C5 release rollout probe** — lint + Vitest **2665** + build **PASS**; prod URL **200** + my-page **401**; wrangler latest deploy **2026-03-30T06:18Z** vs **`e8b848d`** parity **unverified**; E2E **fail** CI cred; authenticated Arena/My Page checks **deferred** · **작업 완료**
- [x] 2026-03-30 — **run/complete action contract for all scenarios** — `buildActionContractSpec` + `fetchCommittedActionFromRun` (ACTION_LOOP_COMMIT meta); `persistArenaRunActionContract` always when admin; non-elite default EN i18n + 48h; persist fail → log + 200 · Vitest route.test · **작업 완료**
- [x] 2026-03-30 — **MyPageLeadershipConsole hotfix (no client userId)** — removed **`sessionUserId`** mismatch/refetch guards; **`fetch`** `/api/bty/my-page/state` + 401 retry; **`bty_mypage_refetch_required`** sessionStorage; local signals hydrate on mount; Vitest **`MyPageLeadershipConsole.test.tsx`** · **작업 완료**
- [x] 2026-03-29 — **Tailwind content globs + ScreenShell fullWidth** — `tailwind.config.ts` adds `./src/features/**`, `./src/lib/**`, `./src/domain/**`; `ScreenShell` fullWidth drops `px-0`; `src/tailwind.config.test.ts` + `ScreenShell.test.tsx` assert; `pnpm build` ✓ · **작업 완료**
- [x] 2026-03-28 — **NBA explainability Phase 1** — `nba-explainability.ts` + narrative `rationaleKey`/`expandedKey`/`explanationDepth` · `nba_recommendation_log` migration · `toPublicNarrativeState` strips server-only fields · pending → `pending_action` · vitest **3242** ✓
- [x] 2026-03-28 — C3 **Leadership identity Phase 3 (advisory NBA)** — **`computeNextBestActionV2`** optional **`identityType`** · **`applyIdentityAdvisoryToNextBestAction`** (reason + at_threshold→foundry nudge only) · **`assembleAIRNarrativeState`** passes **`identityFull.type`** · vitest ✓
- [x] 2026-03-28 — C3 **Leadership identity Phase 2 (wire)** — `narrative_state.identitySignal` + completion **`narrativeState.identitySignal`** via **`assembleAIRNarrativeState`** · **`IdentityNarrativeBand`** (no air-band cycle) · **`isAirNarrativeState`** rejects `type` on wire · vitest ✓
- [x] 2026-03-28 — C3 **Leadership identity (Phase 1)** — `domain/arena/leadership-identity.ts` **`computeLeadershipIdentity`** + i18n keys only · **`toIdentitySignalPublic`** (strip `type` for API) · vitest **20** ✓
- [x] 2026-03-28 — **Progress system domain (execution-pattern)** — `domain/arena/execution-pattern.ts` + **`computeProgressState`** / **`computeNextBestActionV2`** · **`AIRNarrativeState.progressState`** (public only) · **`loadActionContracts30d`** + narrative assembly · **`isAirNarrativeState`** + my-page mocks · vitest ✓
- [x] 2026-03-28 — **My Page state API `narrative_state`** — `GET /api/bty/my-page/state` returns **`narrative_state`** (from `getMyPageIdentityState`); **`metrics.AIR` stripped**; **`route.test.ts`** asserts shape + no raw AIR keys · vitest ✓
- [x] 2026-03-28 — C2 **ISSUE 4 (mobile OAuth QR redirect)** — middleware `/`→`/en` preserves `?code`/`state` · `LoginClient` Google OAuth `redirectTo` + `next` · `sanitizeAuthCallbackNext` + `page.client` callback · `docs/AUTH_OAUTH_SUPABASE_REDIRECTS.md` · vitest **3066** ✓
- [x] 2026-03-28 — C2 **ISSUE 2·3·5 (TII + arena QR + My Page signals)** — `tii/route` **`team_integrity_index`** + 24h stale · `air-snapshot` **`onTeamAirWrite`** · QR **`action-loop-token`** + **`validate`** arena branch · `core-xp`/`my-page/state` **`userId`** · `signalStorage` **`arena_signals_${userId}`** · `MyPageArenaQrValidate` · vitest **3061** ✓
- [x] 2026-03-28 — C3 **Elite scenarioLoader v2 + §4 elite selection + actionLoop** — `domain/arena/scenarioLoader.ts` · `data/BTY_ELITE_SCENARIOS_v2_ENGINE_READY.json` · `arenaScenarioSelection` elite helpers · `actionLoop.ts` · vitest 17 · `npm run lint` ✓
- [x] 2026-03-28 — C3 **Coaching response layer + Dr. Chi assembly** — `domain/coaching-response` · `lib/bty/coaching-assembly` · `POST /api/arena/coaching-response` · vitest 9 · `npm run lint` ✓
- [x] 2026-03-28 — C3 **Pattern detection + coaching triggers** — `domain/pattern-detection` · routing `internal_coaching` + R-P01–R-P06 · `POST /api/arena/pattern-coaching` · vitest · `npm run lint` ✓
- [x] 2026-03-28 — C3 **Action Contract layer** — `domain/action-contract` + `bty_action_contracts` migration + `lib/bty/action-contract` (LE activation + parallel weekly/core XP) + vitest 10 · `npm run lint` ✓
- [x] 2026-03-28 — C3 **BTY AI Routing Engine v1** — `domain/routing` (`routeBtyAiV1`, R-A01–R-T01 priority, exposure, `lib/bty/routing/bty-routing-v1` hook) + `bty-routing-v1.test.ts` (11) · `npm run lint` ✓
- [x] 2026-03-27 — C5 **Arena final integration gate** — `npm run lint` + Vitest **2959** + `npm run build` **PASS** · PENDING-014·017·Level-first·tenure · 로컬 블로커 없음 · **작업 완료**
- [x] 2026-03-27 — C5 **Arena branch release gate** — `npm run lint` + Vitest **2954** + `npm run build` **PASS** · PENDING-014·017 전제 · **작업 완료**
- [ ] 2026-03-26 — C3 **Mirror pool production verify (OPEN)** — operator: run **`bty-app/scripts/sql/mirror-pool-production-guard-apply.sql`** on prod Supabase + deploy app; then mark **[x]** after ikendo1 replay passes (no `mirror:`/`pswitch_` origins, CHECK+trigger present, **no 500** from mirror sync).
- [x] 2026-03-27 — C3 **session/next build marker + mirror pool non-throw** — **`GET /api/arena/session/next`** sets **`x-arena-session-next-build: mirror-guard-v3`** on all responses; **`getMirrorScenarios`** outer **try/catch** + select errors → **`[]`** (tags **`mirror_pool_select_failed`** / **`mirror_pool_get_scenarios_failed`**); `route.contract.test.ts` asserts header · vitest ✓
- [x] 2026-03-27 — C3 **Mirror pool graceful skip (no 500)** — `syncMirrorPoolForUser`/`generateMirror`: forbidden-prefix short-circuit + **`mirror_pool_write_*`** JSON logs + Postgrest **`23514`** skip; `getMirrorScenarios` sync **try/catch**; `mirrorPoolOrigin` regex aligned with DB **`^(mirror:|pswitch_)`**; `mirror-scenario.origin-resolution.test.ts` · vitest ✓
- [x] 2026-03-26 — C3 **Mirror pool write hard-block** — `domain/arena/mirrorPoolOrigin` + `assertMirrorPoolOriginAllowedForWrite` on **`buildMirrorCopyBilingual`** (sync/`generateMirror` use skip + DB guard); DB trigger **`20260431220400`**; `mirrorPoolRowToScenario` title scrub; `mirrorPoolOrigin.test.ts` · vitest ✓
- [x] 2026-03-26 — C3 **Arena run/complete history fallback** — `syncArenaChoiceHistoryFromRun` no silent success without `CHOICE_CONFIRMED` (OTHER/free-response): synthetic `choice_id` `arena:run_complete:${runId}` + `appendPlayedScenarioId`; empty `scenario_id` → `MISSING_SCENARIO_FOR_ARENA_HISTORY`; `arenaChoiceConfirmedPersistence.server.test.ts` + complete route `sync` mock · vitest ✓
- [x] 2026-03-22 — C3 **Arena history persist (CHOICE_CONFIRMED + complete)** — `/api/arena/event` service-role choice_history+played upsert; `run/complete` `syncArenaChoiceHistoryFromRun`; `appendPlayedScenarioId` explicit `{ok,error}`; tests event+complete+append · `npm run lint` ✓
- [x] 2026-03-25 — C4 **Arena FINAL experience UI** — 모드별 첫 진입 문구·색(표준 emerald / 미러 violet / 시점 indigo); 모드 배지 스타일·헤더 직후 배치; 반복 배너 “New role or different perspective”; 역할 강조·KO “당신은 지금 … 역할로 행동”; `scenario-selector.issue-9` 테스트 null 가드; `npm run lint` ✓
- [x] 2026-03-25 — C4 **Arena experience contract UI** — 모드 배지·첫 진입 스트립·세션 내 동일 `scenarioId` 반복 배너·역할 문구 “acting as”/KO 정렬·반복 시 역할 카드 좌측 강조; `BtyArenaRunPageClient.test.tsx` · `npm run lint` ✓
- [x] 2026-03-25 — C4 **Arena top chrome + mirror body contract** — `ArenaLayoutShell` `--arena-hub-sticky-height`; run `ArenaHeader` `sticky` `top-[var(--arena-hub-sticky-height)]`·`z-10`; `ScreenShell` `pt-4`; `getPlayerFacingScenarioBody`+`stripMirrorInstructionalBodyForUi`로 `mirror:` 본문에서 역할 스트립과 중복되는 안내 제거; `engine.test.ts` · `npm run lint` ✓
- [x] 2026-03-25 — C3 **Q1/Q2 rotation·pool** — `fetchArenaRotationPlayCount` choice_history 보조 제거(aggregate 길이만); `selectNextScenario` replay·explicit 제거→소진 시 `no_scenario_available`만; `fallback`/`rotation-logging` 테스트 갱신 · `npm run lint` ✓
- [x] 2026-03-25 — C3 **ISSUE 11·12** — `lastPlayedScenarioId` 쿼리→`SelectNextScenarioOptions`·avoid 우선; 단일 후보 `console.warn`; 404 `NO_SCENARIO`/`pool_exhausted`+`message`; 클라 `poolReason`·`scenarioPoolExhausted` i18n; `npm run lint`+vitest ✓
- [x] 2026-03-25 — C3 **ISSUE 9·10 증거 테스트** — `scenario-selector.issue-9-merge`·`issue-9-avoid-repeat.behavior`·`scenario-type-router.mirror-merged-played`·`useArenaSession.session-next-fetch` (12) · `npm run lint` ✓
- [x] 2026-03-25 — C3 **ISSUE 9·10 Arena session/next** — `fetchMergedPlayedIdsForSelection` + 직전 시나리오 회피(`pickScenarioMetaFromPoolAvoidingImmediateRepeat`); mirror 슬롯 `mergedPlayedIds`; `useArenaSession` `fetch`로 404 빈 풀 vs `SCENARIO_FETCH_FAILED` 분리·`console.error`; i18n `scenarioFetchFailed`; `scenario-selector.fallback.test` Supabase mock `limit` 체인 · vitest fallback ✓
- [x] 2026-03-25 — C4 **ISSUE 6a–6b + PENDING-015 Arena mirror·헤더** — mirror `title`/`titleKo` 파싱·`mirrorRoleLabel`+`mirrorDescription`·`choiceGroupAriaMirror` `{role}`; 역할 섹션 `aria-labelledby`로 중복 제거; `runKindLineMirror` 제거; `ArenaHeader` `z-[10]`+sticky 래퍼·`ScreenShell` `pt-4`; `scenarioRoleById.test.ts` + `BtyArenaRunPageClient.test.tsx`; `npm run lint` ✓
- [x] 2026-03-25 — C4 **ISSUE 5 Arena 역할 스트립** — `scenarioRoleById.ts` + `getScenarioRoleForLocale` (catalog·`mirror:*`·`pswitch:*`); `BtyArenaRunPageClient`가 `codeName` 미노출·`{role}` i18n; `scenarioRoleById.test.ts` + `BtyArenaRunPageClient.test.tsx` 역할/폴백/KO·EN; `npm run lint` ✓
- [x] 2026-03-22 — C3 **파일럿 14일 조회 (pilotObservation)** — `lib/bty/pilot/pilotObservation.ts` (QR·choice×scenarios·AIR 스냅샷) + `pilotObservation.test.ts` 7 · `npm run lint` ✓
- [x] 2026-03-22 — C3 **Ko→En 폴백 (PENDING-011)** — `scenarioNumericStructure.test.ts`: `parseScenarioNumericStructure` 실호출 + Ko 로케일 `??` 계약 ①②③④ · vitest 12 · `npm run lint` ✓
- [x] 2026-03-22 — C3 **failure_reason 8000자 절단 (PENDING-010)** — `action-loop.test.ts`: `serializeFailureReason`+`slice(0,8000)` ①8001→8000 ②경계 ③한글 BMP · vitest 18 · `npm run lint` ✓
- [x] 2026-03-22 — C3 **Scenario content guidelines (PENDING-002)** — `docs/SCENARIO_CONTENT_GUIDELINES.md` (원칙·허용 수치·도메인 불변 7항·체크리스트·Zod 한계·샘플 점검) · 코드 변경 없음
- [x] 2026-03-22 — C3 **Leadership Signal Mapping v1** — `domain/arena/leadershipSignal.ts` (`mapToLeadershipSignal`, category strength weights, actionable rule) + `leadershipSignal.test.ts` (8) · `npm run lint` ✓
- [x] 2026-03-25 — C5 **Lab Arena org onboarding 재검증** — `npm run lint`+`next lint` **exit 0**(경고 다수) · Vitest **2811** 중 **8 FAIL** (`onboarding.test.tsx` · `usePathname` mock 누락) · build **PASS** · **NO-GO** — **보고 완료**
- [x] 2026-03-25 — C5 **Lab Arena org onboarding 최종 검증** — `tsc`+Vitest **2803**+`self-healing-ci.sh` **PASS** · `next lint` **FAIL**(툴링) · 온보딩 ①–⑤ **MISSING TEST** — **작업 완료**

## STATUS: STRUCTURE COMPLETE → BEHAVIOR ENGINE PHASE

BTY 시스템은 다음 단계로 전환됨:

> ❌ 구조 안정화 단계 종료  
> ✅ 행동 엔진 고도화 단계 진입

---

## 1. COMPLETED (THIS SPRINT)

- [x] 2026-03-22 — C3 **interpretArenaDecision Q1·Q2** — `interpretArenaDecision.ts`: intent regex 미매칭 시 `unknown` + pattern/tendency/signal `null` (exploratory 고정 제거); impact 0·비측정 시 최상단 `Error` (`IMPACT_NON_ZERO_MESSAGE`); `decisionInterpretation.ts` re-export; `interpretArenaDecision.test.ts` 11케이스; lint ✓
- [x] 2026-03-22 — C3 **Decision interpretation layer** — `domain/arena/decisionInterpretation` (`interpretArenaDecision`, `primaryImpactAxis`); inputs category + numericStructure + choice intent; outputs decisionPattern / behavioralTendency / leadershipSignal; intent regex fix (`line`/`log` word boundaries); vitest + lint ✓
- [x] 2026-03-22 — C3 **Scenario numeric structure** — domain `scenarioNumericStructure` (time/resource/risk/measurable impact; parse + measurable guard); `Scenario.numericStructure` + per-id map `scenarioNumericStructureById`; DB `numeric_structure` jsonb + sync/loader; Zod + sample JSON; synthetic/mirror/perspective + tests (domain + map completeness + loader) ✓
- [x] 2026-03-22 — C3 **Scenario category explicit model** — `Scenario.category` + `BeginnerScenario.category`; removed `inferArenaScenarioType` (DB `scenario_type` = `inferArenaFlagType`); sync/loader/selector/meta + Zod JSON + migration `20260431120000_scenarios_category.sql`; mirror/perspective `synthetic_internal`; `npx tsc` + vitest (catalog-sync, selection-guards, loader, ScenarioCard, BtyArenaRunPageClient, selector fallback/empty) ✓
- [x] 2026-03-22 — C4 **PENDING-005/006/008/009 테스트 클로저** — `EmptyState`·`LoadingFallback`·`arenaRunScenarioLabels`·`scenarioNumericStructure` 보강; 프로덕션 미수정; vitest 2848 + `npm run lint` ✓
- [x] 2026-03-22 — C4 **Arena run category = `scenario.category`** — `arenaRunScenarioLabels`: `ScenarioCategory` 매핑 + `SCENARIO_CATEGORY_DEFAULT` 폴백, `scenarioId` 휴리스틱 제거; `BtyArenaRunPageClient`가 `s.scenario.category` 전달; `useArenaSession`/API 미변경; `npm run lint` ✓
- [x] 2026-03-22 — C4 **ArenaStepChoose + run page tests** — `ChoiceList` aria-label(`Choice A: A`)에 맞춤 쿼리 수정; `BtyArenaRunPageClient.test.tsx`: run-root·포털 accent·briefing 영역(step≥3 미렌더); vitest 전체 + `npm run lint` ✓
- [x] 2026-03-22 — C4 **`--arena-accent` run-root only** — `BtyArenaRunPageClient`: `data-arena-run-root` + `ARENA_RUN_ACCENT_HEX` inline; portaled `ArenaOtherModal` / `TierMilestoneModal` / `ArenaToast` take optional `arenaAccent`; `globals.css`에서 전역 `--arena-accent` 제거(주석 유지); 대시보드 `TierMilestoneModal`은 accent 미전달(폴백); `npm run lint` ✓
- [x] 2026-03-25 — C4 **Arena run scenario UI (4-zone decision surface)** — `BtyArenaRunPageClient` context/body/decision/feedback zones; `ArenaRunScenarioBody`, `arenaRunScenarioLabels`; `ChoiceList` + `ScenarioIntro` action-only; accent `#2E5BFF` on run root; `OutputPanel.omitPanelLabel`; hook/domain contracts unchanged; `npm run lint` ✓
- [x] 2026-03-25 — C5 **ArenaStepChoose immersive double-submit** — `ArenaStepChoose.test.tsx` (jsdom): `isSubmitting`로 선택·기타 버튼 비활성, 동일/교차 더블클릭 차단, `onConfirm` resolve 후 상태 복원; Vitest + 전체 스위트 ✓
- [x] 2026-03-24 — C3 **C2 RISK Q1–Q3** — `SCENARIO_SIMULATION` 타입에서 `air14d` 제거; `mapScenarioToActionPlan` 패밀리 전용 매핑·정규식 제거; `dueInDays` peer/system/location 2·reflection_reset 1·상한 3; leadership-engine vitest + `test:q237-smoke` + `npm run lint` ✓
- [x] 2026-03-24 — C3 **Scenario→Action Loop** — `scenario-action` 도메인 + `SCENARIO_SIMULATION` 이벤트 + `persistScenarioActionPlanToActionLoop` · vitest ✓
- [x] 2026-03-24 — C3 **mentor route.test 500 (CI OPENAI_API_KEY)** — `mockFetchJson` 기본 성공 응답 in `beforeEach` · mentor 19 + vitest 2781 ✓
- [x] 2026-03-24 — C3 **Ritual tests + TS6053 stub 주석** — `ritual/aggregator.test.ts`·`ritual/route.test.ts` (15) · `ensure-next-types-stub.mjs` App Router 전역 커버 설명 · `npm run lint` ✓
- [x] 2026-03-24 — C3 **Ritual Layer** — `leadership-engine/ritual/types`·`aggregator` (14d/30d·M 5/12·상태 파생); `GET .../leadership-engine/ritual` (self `qr_completions`만); 마이그레이션 없음
- [x] 2026-03-24 — C3 **QR validate route tests** — `qr/validate/route.test.ts` (순서·400·409·500·금지필드) 8케이스 vitest ✓
- [x] 2026-03-24 — C3 **QR validate API** — `POST /api/arena/leadership-engine/qr/validate` (`route.ts`): 당일 count·리플레이 조회 → `validateQrEvent` → `qr_completions` INSERT → `createActionsFromEventsWithRetry` — 도메인 미수정
- [x] 2026-03-24 — C3 **QR 검증 도메인** — `leadership-engine/qr/validator.ts`·`executor.ts` (계약 수치 120s·15m·일일 한도·리플레이); Action Loop `QR_*_VERIFIED` 이벤트 + `eventToActionType` 매핑; 마이그레이션 `20260431210000_qr_completions.sql`; `validator.test.ts` — vitest ✓
- [x] 2026-03-24 — C3 **TS6053 cold tsc + Action Loop tests** — `bty-app/scripts/ensure-next-types-stub.mjs` + `lint` runs `tsc --noEmit`; `src/domain/leadership-engine/action-loop/action-loop.test.ts` (band/slip/stagnation/idempotency/expiry/DLQ) — vitest ✓
- [x] Arena release gate automation — `bty-app/scripts/arena-release-gate.sh`, `npm run verify:arena-release-gate`, `.github/workflows/arena-release-gate.yml` — **작업 완료**
- [x] 2026-03-24 — C5 `self-healing-ci.sh` PASS (368 files / 2660 tests, build ✓) + docs sync — **작업 완료**
- [x] 2026-03-25 — Arena release **final signoff** recorded: `BASE_URL=https://bty-website.ywamer2022.workers.dev`, run `23525350606`, artifact `arena-release-gate-evidence` — **작업 완료**

### Arena
- [x] 2026-03-25 — C3 **Arena scenario fallback** — `selectNextScenario`: primary → archive → replay (deterministic) → relaxed tier/pref → locale-union static match → explicit `SCENARIOS` row · Vitest `scenario-selector.fallback.test` + `empty-catalog.test` · `npm test` ✓
- [x] 2026-03-22 — C3 **Arena fallback observability + release evidence** — structured `[arena] arena_scenario_selection` JSON (`fallback_stage`, `outcome`, …) · `bty-app/docs/ARENA_RELEASE_EVIDENCE_TEMPLATE.md` · `RELEASE_LOG` entry · `BTY_RELEASE_GATE_CHECK` pointer
- [x] 2026-03-22 — C3 **Arena fallback operator docs** — `bty-app/docs/ARENA_FALLBACK_OPERATOR_OBSERVABILITY.md` (log queries, health summary, SHA correlation) · release evidence template §4–5 linkage (HTTP gate, `deployment_git_sha`, fallback-stage review)
- [x] 2026-03-22 — C3 **Arena scenario UI — no system/meta leakage** — `getPlayerFacingScenarioBody` + mirror copy/sanitize; UI uses narrative-only body + choices (`ScenarioCard`, `useArenaSession`); DB/static catalog unchanged
- [x] 2026-03-22 — C3 **Leaderboard avatar MVP mapping** — `getPrecomposedDressedCharacterUrl` trusts only `/avatars/default/characters/{id}.png`; invalid/missing key → `default.png`; `LeaderboardRow` uses layered `AvatarComposite` only when `avatarOverlayEnabled` (else `UserAvatar` / same composite path as Arena)
- [x] 2026-03-25 — C3 **Arena CI guard** — Vitest: `sessionNextContract` + `route.contract.test` + `scenario-selection-guards.ci` + `middleware-arena-redirect.test` + `arena-bootstrap-integrity.ci` · `npm run verify:arena-guards` · `BTY_RELEASE_GATE_CHECK` § Arena CI guard
- canonical route 통합 (`/bty-arena`)
- session/next 기반 시나리오 흐름 정상화
- [x] 2026-03-24 — Arena entry: `fetchSessionNextScenario` before any `loadState`; `GET session/next` `cache: 'no-store'`; failure path `clearState` + `resetAllLocal`; middleware + `run/page` 308 canonical `/bty-arena`
- stale local state 문제 해결
- XP (Core / Weekly) 정상 반영
- [x] BTY Memory Engine scaffold — `20260430330000_bty_memory_engine.sql`, `src/engine/memory/*`, `recordChoiceConfirmedMemory` in `scenario-outcome-bridge`
- [x] Memory Recall Prompt — `consumePendingPatternThresholdRecall` in `session/next` → `recallPrompt` on API + Arena lobby UI (`BtyArenaRunPageClient`), `user_memory_recall_log` + trigger `processed`
- [x] Memory Engine live schema repair — `20260430340000_memory_engine_user_behavior_events_align.sql` (`played_at`, `payload`, defensive `source`, indexes); smoke script `bty-app/scripts/memory-engine-smoke.ts`
- [x] Memory recall log — `user_memory_recall_log.trigger_scenario_id` NOT NULL: insert sets `trigger_scenario_id` from session `scenarioId`; migration `20260430350000_user_memory_recall_log_trigger_scenario_id.sql`
- [x] Memory recall log — full row: `recalled_from_scenario_id` (enqueue + trigger payload), `pattern_key`, `recall_message`, `recall_type`, `related_event_ids: []`; `20260430360000_user_memory_recall_log_recall_columns.sql`

### Avatar
- [x] 2026-03-25 — C3 **`avatarOverlayEnabled`** (`false`) + Foundry **`resolvedLayersVisibleWithOverlayFlag`** (`CompositeLayerViews` / customizer 미니프리뷰) — 아웃핏·악세 레이어 미렌더, 엔진/API/스키마 유지
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

## Memory Engine
- Live scaffold verified end-to-end
- Smoke result: PASS
- Current live capability:
  - event record
  - pattern aggregation
  - threshold trigger enqueue
  - recall prompt consume
- Next phase:
  - delayed outcome consumer
  - perspective switch consumer

  ## Memory Engine
- Phase 1 live loop verified
- Status: PASS
- Verified path:
  - event record
  - pattern aggregation
  - threshold trigger
  - recall prompt consume
- Next:
  - delayed outcome consumer
  - perspective switch consumer

  ## Memory Engine
- Phase 1 live backend loop: PASS
- Verified:
  - event insert
  - pattern aggregation
  - trigger enqueue
  - trigger consume
  - recall log write
  - processed status transition
- Remaining:
  - UI recall banner verification on a non-beginner account