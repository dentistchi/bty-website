**[2026-06-27] D4 Today's Promise Slice — SHIPPED & eye-check PASS (dashboard → ritual).** Home을 대시보드에서 ritual-first로 전환. inner-main **c5ef370a**(2 파일: today client + i18n; **api/migration/engine 0** — git diff --stat 증명). 6-tier opening order(Volume0 §8): **Hero** greeting + "Today has one promise." → **Companion**(avatar + Dr.Chi voice, XP 제거) → **Today's Choice**(pending 실값 + gold Begin CTA) → **Behavior Status ○ Waiting**(open promise만 렌더, **✓ 안 그림**) → **Growth**(today-xp/Core XP/Stage — 실값 유지하되 secondary로 demote) → **AIR**(band+중립 magnitude). greeting = browser session `user_metadata.full_name` 런타임 조건부 — **LIVE 측정: full_name 클라이언트 미도달 → "Good morning."(이름 생략)**. 가짜 이름/하드코딩/email 노출 0(런타임 분기로 이름은 실값 있을 때만). 약속 = **○ only**(pending 실값); **✓ completion NOT drawn**(client-unreachable: pending route는 `verified_at IS NULL`만 반환, 완료는 server service `getLatestCompletedActionContract` 전용·/api/arena 미노출). 배포 Version `eeb3c7cb`. GATE: tsc 0 · terminology net-0(vs 7b5e86d5) · explicit-path add · inner-main only. FORBIDDEN 준수: 새 DB/endpoint/engine 0 · fake ✓ 0 · action-contract→daily-promise stretch 0 · BRM/Vol0 0 · QR/AIR/auth/iOS 0.
CARRY-FORWARD:
· **D5 약속 시스템 = ✓ 완료 토글 (net-new).** 필요: 새 endpoint(today's completion 노출) **또는** 새 일일-약속 개념(action-contract와 별개의 daily single promise). 측정: pending route는 미완료만(verified_at NULL) 반환, 완료 reader는 server-only(getLatestCompletedActionContract) → ✓는 현 client endpoint로 불가. Emotional 트랙과 연결.
· **Personalization gap:** `full_name`이 browser session(`supabase.auth.getUser` user_metadata)에 **클라이언트 미도달**(httpOnly 쿠키 추정) — greeting 이름은 별도 source 필요(OAuth name scope / profile endpoint / server-pass). 원하면 별 wiring.
· (D3에서 이월) BRM/Vol0 draft(authority NONE) · Emotional Design 세션 · v2 Growth Engine(100T×6-Code) · F2 iOS · Manager Tools(QR FAB) · D-T BIOS · streak engine · terminology 14→13.

**[2026-06-27] D3 Today Home — SHIPPED & eye-check PASS (premium dark native "BTY Daily").** 단일 inner-main 커밋 체인으로 `today/` 홈 표면 완성 → staging 배포 → 로그인 eye-check 통과(dark 카드 텍스트 가독성 전수 포함). 체인: palette baseline `b961a404`(--bty-* 6-color) → Slice1 정적 stub `75186ea4` → image home `176804e7`(5-tab BottomNav Home/Arena/Foundry/Center/Profile + Core XP/today-xp/오늘의상황(pending)/AIR band live) → navy polish + ko/en `593207b6`(ScreenShell `surface="navy"` opt-in prop — 전역 default 불변 21화면; 흰 카드) → free wins `7e97f1a5`(avatar live(AvatarComposite) + stage progress(`leadership-engine/stage-summary.progressPercent` 서버값 렌더, UI XP-계산 0) + AIR 중립 magnitude) → premium dark `7b5e86d5`(avatar base-only fix[`outfitUrl` 제거 — full-body 옷이 64px 원 crop 깨뜨림; dashboard/ArenaHeader canonical 일치] · `--bty-panel #11294A` 신토큰 + `InfoCard tone="panel"` · today 20 색 site 전수 반전[navy-on-navy invisible 0] · BottomNav 5 inline-SVG glyph[lucide 0, active=gold icon+white] · copy "오늘 마주할 선택"/"What choice will you face"). 배포 Version `ad903f0d`(이전 df4c9883/34d9e4c5/a6ecdd10). **실값(live):** Core XP · today-xp · 오늘의상황(action-contracts/pending) · AIR band(leadership-engine/air, score_hidden 준수) · Stage progress · avatar. **스텁(◐):** streak(client localStorage) · Level/archetype(곧 공개; archetype DEAD by design) · tier체계(v2 트랙). **GATE** 매 슬라이스: tsc 0 · terminology net-0(vs 직전 HEAD) · explicit-path add · inner-main only push. **KNOWN DEBT:** `lint:terminology` baseline=**14**(13 아님 — 측정정정; 스크립트 threshold 無, gate=net-increase-vs-HEAD; pre-existing "try again" debris → 별 task 14→13). **F1** = benign logged-out probe("Auth session missing!" = `/api/auth/session` 200 ok:false 정상응답, auth break 아님; OAuth 정상) resolved. 새 API 0 · auth/QR/iOS/migration 0 · 전역 ScreenShell default 0.
CARRY-FORWARD:
· **BRM / BTY Constitution Vol0 = 대화-저술 DRAFT, authority NONE until ratified.** ⚠️ 기존 `BTY_PRODUCT_CONSTITUTION`(BIOS LOCKED) · Experience Canon(GAP@HOLD)과 계층 충돌 **미측정** — §F "no parallel constitution-class" 대조 필요. 별 canon 세션 ratification 선결.
· **Emotional/Liveness 비전(별 트랙):** Companion blink/breathing/eye · "오늘의 약속"(Dr.Chi "오늘 하나만" → ○ 미시작 / ✓ 지킴) · QR=FAB(행동, Arena 밖) · nav 순서 재배치 Home·Arena·Center·Foundry·Profile(Foundry=훈련, 매일 아님) · Depth 점진 해금(Core XP→Code→Companion→Guild→Mentor→Legend). = BTY Design Language 세션(STEP 0: Liveness 자산·애니 인프라·Companion 데이터부터).
· **v2 Growth Engine**(100T×6-Code 서버 엔진) · F2 iOS(Capacitor 셸) · Manager Tools(QR 생성) · D-T BIOS tracking · streak 엔진 · terminology 14→13.

**[2026-06-27] VRS-native palette swap EXECUTED — image brand 6-color via --bty-* vars (no class/component sweep).** inner-main `b961a404` (pushed origin/inner-main c7620809..b961a404): `src/app/globals.css` block#2 `:root` token VALUE edit — navy #1e2a38→**#0B1F3A** (138 ref sites re-tinted via one var), gold #b08d57→**#C9A66B**, stable→**#16A34A**, warning→**#F59E0B**, risk→**#DC2626**, +new **--bty-action #2563EB**. All BTY/Arena surfaces route through `var(--bty-*)` (~325 refs) → value edit, not migration. KEEP `--bty-brand-steel #405a74` / `--bty-soft-bronze #8b6b4a` (navy-axis support, not 6-color semantic; touching = surface redesign, deferred). Dark/`body[data-theme]` scopes do NOT redefine `--bty-*` → inheritance holds, no scope edits (measured in PHASE 0, not assumed). Removed tracked duplicate `'tailwind.config 2.ts'` (no importers). Gates: tsc 0 / terminology 0 (8 pre-existing "try again" warns, within ≤13 baseline). Outer `BTY_TAILWIND_THEME_TOKENS.md §4` synced both blocks (spec=impl). CARRY-FORWARD: (1) `--bty-action` is **var-only** — Tailwind `bty.action` class NOT wired (zero consumers; deferred to first use); (2) steel-harmonization vs deeper new navy = optional polish post eye-check; (3) NOT deployed — eye-check pending (OAuth-only, no localhost). Measure-before-mutate verdict: prior "greenfield/risky-sweep/stubs" assumptions all FALSE; real = 6 var-value edits.

**[2026-06-27] Dispatch A — Human_View scaffold materialized (FIRST MUTATION of discovery+placement arc).** docs/Human_View/{Canon,Incubator} greenfield (commit 04c7d11, pushed origin/main e202d20..04c7d11). Incubator README locks pre-canon rule (no authority, Boundary Review required; Founder Root — theology/testimony/covenant — explicitly out-of-repo). Experience Canon body HARD HOLD — authority-grade source unestablished: not on disk (5-modality MODE A), not in this conversation (full re-scan), not on any branch (wip ruled out); Dispatch B blocked until verbatim source pasted OR conscious AI-authoring decision (invention labeled as such, not "reconstruction"). Meta-rule placement PENDING — ADR-fit MEASURED (ADR-006 free; decisions/README scopes ADR to why-records and routes eternal/governance law → Constitution/Implementation-Rules, so "no reconstructed doc is authority before ratification" ≠ pure ADR-as-why; placement decision = separate dispatch). base/5형제/ADR/BTY_CANON.md/covenant untouched.

**2026-06-26 — D3-1 INLINE CARD COPY CLOSED (ActionContractHub completed-state overclaim 제거).** ActionContractHub Overview 인라인 completed 카드: legacy system-first "Execution recorded. / Next scenario unlocked." → "Completed Promise / This promise has been confirmed."(KO "완료된 약속 / 이 약속은 확인되었습니다"). 측정 근거: 이 카드는 next-scenario/progression 상태에 **접근 없음** — `display_state ∈ {verified_completed, completed}`로만 분기. "Next scenario unlocked."는 카드가 알 수 없는 unlock을 단언한 **overclaim**; 새 카피는 completed-state only, progression 주장 없음(progression 소유 = session/next, 이 카드 아님). Consumers: `actionContract.completedTitle/completedBody` = ActionContractHub 단독(PostCompletionSheet=actor* 키, Center=별도 namespace) → clean single-surface fix. inner-main c7620809, live Version 882250dc. Live-grep(현재 chunk 7618-2667bb139c641dd1.js): 신규 literal 1, 구 literal 0.

**2026-06-26 — D3-1 carry-forward / hygiene (record — fixed 주장 금지).** D3-1b: 별개 키 `actionContract.arenaPostContractNextScenarioTitle`(i18n.ts:5091) = 여전히 system-first "Execution recorded. Continue to the next scenario." — 다른(desktop snapshot) 표면, render 상태 미측정 → 자체 read-only trace + 렌더 시 fix 필요. D3-2: 28 train은 contract/QR 미생성, action contract = Arena run path 전용 생성; IA 결정 보류(Arena 진입 owner + train→Arena 라우팅 vs train→contract bridge). Hygiene(low): i18n.ts:1377 JSDoc 주석이 옛 카피("Execution recorded / Next scenario unlocked")를 설명 — 실제 값과 stale, prod minify에서 strip되어 무해하나 reader 오해 소지 → 주석 정리 후보.

**2026-06-26 — D2 CORE EMOTIONAL LOOP CLOSED (action contract → QR witness → progression → actor return).** Arena action contract → 실생활 행동 → QR witness confirmation(self-witness hard-block: 같은 account 실패; 다른 account witness confirm 성공) → progression unlock → actor return completion sheet(FINAL form: title "You completed one real action today." + "TODAY'S PROMISE" + 완료 행동 텍스트 + reflection prompt "How did it feel to actually do it?" + display-only input + CTA "Continue Tomorrow"; body paragraph 제거됨). Witness success copy live "Confirmed. This action is now part of today's growth." Reflection input = display-only(미저장), localStorage dismissal key = contract id only(no PII), witness mode는 actor sheet 미발화. Witness half + actor half 완성. inner-main 0152c948(witness+actor set) + 6d919eaf(body-delete), live = bty-arena-staging Version 08fb3e64. Live-grep 검증: 삭제 body literal 0, 유지 title/witness-success 1.

**2026-06-26 — D2 carry-forward (미해결 — fixed 주장 금지).** D3-1: ActionContractHub Overview 인라인 completed 카드가 여전히 legacy system-first "Execution recorded. / Next scenario unlocked." 렌더 — 1회성 actor sheet와 다른 **상시 Overview status 표면** → 별도 product slice + status-tone copy 필요(후보 "완료된 약속 / Completed Promise"). 측정: `actionContract.completedTitle/completedBody`는 D2 이후 ActionContractHub 단독 소비(PostCompletionSheet=actor* 키로 분리, Center=별도 namespace) → 교정 시 타 표면 충돌 없음. D3-2: 28 train은 contract/QR 미생성 — action contract는 Arena run path로만 생성. IA 결정 보류: Arena를 action-contract 진입 owner로 유지(train→Arena 라우팅) vs train-to-contract bridge 추가.

**2026-06-26 — 표준 항목(닫지 않음).** docs/video/ untracked(별도 hygiene 결정). outer `docs/BTY_RELEASE_GATE_CHECK.md` = D2 gate 기록(이 ledger commit에 포함).

**2026-06-25 — MVE D1 CLOSE (assessment result observational copy).** Assessment 결과 화면을 track 추천(Stability First 라벨)에서 관찰형 카피로 교체. dojo/result(dead surface)에 단 D1 placeholder는 git restore로 되돌림 — Reality 측정으로 Dojo=assessment 중복·dojo/result 미도달 확인됨. 진짜 경로 = assessment/result(살아있는 경로). 시스템 층(scores/radar/Change-from-previous) 무손상. staging Version 81b5501c, 3-check(카피 표시·점수 무손상·Day1 도달) 통과. ResultClient.tsx commit(inner-main 3a58bdb9), inner-main push. Carry-forward: pattern.reasons/detectPattern computed-but-unrendered (Observed-but-unauthoritative, 정리 패스 대상); Dojo 코드 전체 삭제 보류.

**2026-06-25 · ☑ Architecture Freeze Rule — Product-Driven phase declared**

**2026-06-25 — Architecture Phase CLOSED.** Implementation Rules §0: Architecture Freeze Rule(고정 OS 목록, Think→ADR→Code→Evidence, Product-Driven 성공 기준). Project State에 phase 선언. Onboarding/Constitution/cursorrules/CLAUDE 동기화. **새 Canon 금지·기본=코드만.** 다음 주제=Verified Learning Engine UX(문서 아님).

**2026-06-25 · ☑ BTY doc OS — Last Resort Principle locked**

**2026-06-25 — 문서 아키텍처 동결 + 운영 원칙 확정.** "새 문서는 마지막 수단" — Constitution/Boot/기존 ADR로 설명 가능하면 코드만. ADR=새 Why만, State/Roadmap=가변, Ledger=History vs ADR=Knowledge. 설계는 코드 위에서 끝; 증거는 실행 앱. 다음 주인공=Learning Engine(문서 아님).

**2026-06-25 · ☑ BTY AI OS v1.2 — ADR layer + 60-second Self Test gate**

**2026-06-25 — Decision Records(ADR) 계층 추가.** `docs/decisions/` — ADR-001~005(Core XP Root, Event Engine/200-benign, Verified Learning contract, SECURITY DEFINER revoke, Evidence vs Verification). 읽기 순서: …Implementation Rules → **ADR** → Code. Onboarding Part D: 60초 설명 테스트(QR/XP/Avatar/Learning/Scenario 금지). ADR = append-only, Ledger와 분리.

**2026-06-25 · ☑ BTY AI OS v1.1 — read order + Roadmap split + Self Test LOCK**

**2026-06-25 — AI OS 구조 확정.** 읽기 순서: Onboarding → **Constitution**(믿을 것) → **Boot**(생각법) → Project State → **Product Roadmap**(신규 분리) → Implementation Rules. Constitution·Boot = **LOCKED BIOS**(스프린트별 수정 금지). 가변 문서 = Project State + Roadmap만. Onboarding에 Self Test(8개 오해 ❌) + 3문장 canonical answer + "AI 교육이 아니라 BTY 파괴 방지" 목적 명시.

**2026-06-25 · ☑ BTY AI Onboarding System — BOOT + Constitution + Project State + Implementation Rules + Onboarding index**

**2026-06-25 — AI BIOS established.** Five permanent docs: `docs/BTY_AI_BOOT.md`(철학·사고), `docs/BTY_PRODUCT_CONSTITUTION.md`(영구 법), `docs/BTY_PROJECT_STATE.md`(현재 위치), `docs/BTY_IMPLEMENTATION_RULES.md`(안전 구현), `docs/BTY_AI_ONBOARDING.md`(읽기 순서). 설계 단계 종료·제품 우선순위(Learning Engine→TODAY→Event UI→Avatar→TII) 반영. `CLAUDE.md`·`.cursorrules` 진입점 연결.

---

**2026-06-24 · ☑ Gate ③-pre — Slice 2b RPC applied + PUBLIC-EXECUTE security incident CLOSED (commit + ledger)**

**2026-06-24 — Slice 2b RPC applied + PUBLIC-EXECUTE security incident CLOSED.** Gate ②: `20260624000100`(`bty_event_scan_award`) production(`mveycersmqfiuddslnrj`)에 apply+verify(signature exact, security definer, owner postgres). Gate ②-HOTFIX: apply 직후 runtime ACL 실측에서 PUBLIC EXECUTE 기본 부여 발견 — `security definer`+RLS-bypass fn이 anon key로 `POST /rest/v1/rpc/bty_event_scan_award` 직접 호출 가능 → route gate(requireApprovedMembership·event-live·`p_xp=event.xp_value`) 전부 우회 → 임의 user 무한 Core XP inflation(우리가 unique로 막은 구멍의 우회문). `20260624000200`로 `revoke execute … from public, anon, authenticated` apply+verify(anon=false ∧ authenticated=false ∧ service_role=true; proacl `{postgres=X, service_role=X}`). exploit 닫힘, route service-role 경로 무손상.

**2026-06-24 — DURABLE RULE(canon).** `SECURITY DEFINER` + owner postgres + RLS-bypass function은 Postgres가 PUBLIC EXECUTE를 **기본 부여**한다. "GRANT 안 함" ≠ "service-role only". service-role-only는 **REVOKE EXECUTE FROM public, anon, authenticated**로만 성립. 향후 모든 Reality-award definer fn = revoke 필수. 교훈: runtime ACL 실측이 보안 추론 위 권위("verify-then-no-op", catalog가 권위) — 이번에 commit-message/추론(=service-role only 가정)이 stale, runtime이 진실이었다.

**상태:** migration `20260624000100`+`20260624000200` 둘 다 live+verified. 코드(scan route·RPC file·reproject·vitest 5/5) inner `00149be5` pushed; `000200` inner `639cf85a` pushed. **un-deployed** — 다음 = generate+scan staging deploy → E2E(별도 deploy GO). slice-1 테이블/unique = 기존 live(2a). org/TII·Action QR·UI 무변경.

---

**2026-06-24 · ☑ Gate ① — Reality Event Engine Slice 2b — co-track commit + ledger (Root Rule / SDK-contract canon)**

**2026-06-24 — Reality Event Engine Slice 2b CLOSED (구현·자체검증, commit 단계).** `POST /api/bty/events/scan` + RPC `bty_event_scan_award`(migration `20260624000100`, file-only·apply-pending) + `reprojectCoreDerivedFields` + vitest 5/5. Flow: requireUser → requireApprovedMembership → verifyEventQrToken(btyev1) → SELECT bty_events → cancelled(409)/valid_until(410 DB재읽기) → INSERT participation(service-role) → 23505→200 already_scanned / fresh→RPC-atomic core add → 200. Hard constraints 전수 통과(Action QR 무수정·bty_events schema 무수정·org/TII 0·UI 0·member-only·non-approved XP 0·one-user-per-event). isLeaderTrack drop(생성 전용). security definer + service-role only, no GRANT(self-grant 구멍 차단).

**2026-06-24 — Award 형태(2b).** RPC-atomic increment of `core_xp_total`(insert+core add 단일 tx; award 실패=insert 롤백). derived reprojection = post-tx best-effort, self-healing(transient 실패가 XP 손실 아님). `applyDirectCoreXp` increment-half = RPC 이주, recompute-half만 미러.

**2026-06-24 — Core XP 권위 + Reality Engine SDK 계약(canon).** Core XP의 권위 = RPC tx가 반환한 `new_core_xp`. 모든 파생 계산은 그 값을 입력으로만 사용. 재조회·재계산 금지. 공통 계약: `award() → returns new_core_xp → reproject(new_core_xp)`. Action·Event·Learning·Mission·Volunteer = 동일 인터페이스. award=Core 확정(RPC-atomic), reproject=확정값 투영(계산 아님).

**2026-06-24 — Reality Engine 책임 경계(canon).** Reality Engine은 성장을 계산하지 않는다. 검증하고 Core XP를 제출한다. 성장 계산은 Core XP 이후에만 일어난다.

**2026-06-24 — Root Rule(canon, slice 위).** Verified Reality → `applyDirectCoreXp()` 등가(=RPC-atomic) → Core XP → {Avatar·Identity·TII·Leaderboard·Season·Weekly·Code·Level} = 전부 파생 View. Core XP = Root, 나머지 = derived. D1 = Direct Core XP 확정(철학: 현실이 Arena를 키운다). `activity_xp_event_id` NULL 잔존(미래 연결 가능, shared schema 무수정).

**2026-06-24 — slice-1 runtime catalog 실측(stale 교정).** commit `3135f300` 메시지 "not yet applied" = known-stale. runtime 실측: `bty_event_participation_unique` UNIQUE `(event_id,user_id)` + pkey **live**. slice-1 테이블/제약 = applied. unique = Reality Engine 무결성 핵심 장치(no-cap direct-Core의 dup-inflation 차단점).

---

**2026-06-24 · ☑ BUILD 6 — Reality Event Engine Slice 2a — Event creation route — COMMITTED+PUSHED, no deploy**

Reality Event Engine Slice 2a committed: Event creation route (**`POST /api/bty/events`**) — **leader-track gate** + **approved-member gate** + **`bty_events` insert (service-role after gates)** + **Event QR token signing (`btyev1` family)**. Auth/gate order: `requireUser` (401) → `requireApprovedMembership` (403 `MEMBERSHIP_REQUIRED`) → `isLeaderTrack` (403 `LEADER_TRACK_REQUIRED`) → input validation (400) → service-role insert → sign token. Validation: `title`/`event_type` non-empty, `xp_value` int 10–100 (mirrors DB check), `valid_until` parseable+future. Response `{ event, token, qrUrl }`.
- **3 new files:** `src/lib/bty/event-qr/event-qr-token.ts` (sign+verify, `btyev1`), `src/lib/bty/event-qr/isLeaderTrack.ts` (reusable leader-track read, fails closed, service-role), `src/app/api/bty/events/route.ts`.
- **Event token = separate `event-qr-token.ts` (`btyev1` prefix); Action QR (`aalo1`) UNTOUCHED;** crypto ~30 lines **intentionally duplicated**, shared-primitive extraction **deferred** (Commander-accepted trade-off to avoid modifying the Action file).
- **Scope: create only** — NO scan route / NO participation insert / NO XP / NO `activity_xp_events` write / NO UI / NO org-TII / NO schema migration / NO deploy. `verifyEventQrToken` defined but unconsumed this slice.
- **`qrUrl` is a forward-reference** (`/{locale}/bty/events/scan?ev=…`) — the scan endpoint is **Slice 2b, not built**.
- **Gates:** tsc **0** / terminology **13 / baseline 13 / +0** (no new-file violations).
- **Commit (inner):** inner-main **3135f300 → `e2f1f796`** (3 files). **Push:** `origin inner-main:inner-main` FF **`3135f300..e2f1f796`** (no force, remote==local).
- **Slice 1 tables** (`bty_events`/`bty_event_participation`) **already applied to production** (`mveycersmqfiuddslnrj`); this route writes to `bty_events` but the **route is unshipped (no deploy)**.

---

**2026-06-24 · ☑ BUILD 5 — Event QR Slice 1 migration FILE committed+pushed — SCHEMA NOT APPLIED**

Event QR Slice 1 migration file committed (`20260624000000_bty_events_slice1.sql`): **`bty_events`** + **`bty_event_participation`**, `xp_value` **10–100 DB check**, `status` **active/cancelled** check, **unique(event_id, user_id)**, `xp_awarded` snapshot, `activity_xp_event_id` **FK→activity_xp_events** (on delete set null), **RLS** (events `select using(true)` / participation `select own`; **write = service-role** via route gate).
- **Inner commit:** inner-main **9dc320cf → `3135f300`** (1 file). **Push:** `git push origin inner-main:inner-main` FF **`9dc320cf..3135f300`** (no force, remote==local).
- **⚠️ SCHEMA NOT APPLIED yet** — file only; **apply = separate Commander-GO dispatch** (production-effective: single shared Supabase backs all workers; snapshot before/after + rollback path required).
- **Slice 1 scope:** NO org/TII (deferred → later nullable ALTER ADD once org model measured), **NO routes yet** (later slices).
- **Event QR = second official QR family** — validate invariant **expanded** (separate Event validate route, NOT Action `/qr/validate` overload); awards **core XP / avatar only**, **no band progression** / `consecutive_verified_completions` linkage.
- **Apply path (NOT run):** `cd bty-app && npm run db:push` (or Dashboard SQL Editor). **Deploy:** none.

---

**2026-06-24 · ☑ BUILD 4 — PHASE II ring shrink (collision fix) — COMMITTED+PUSHED, no deploy**

PHASE II ring **shrunk 56→40px** (+ `text-xs`→`text-[10px]`) to resolve the collision with the "Today's growth" label on the `/bty` hub. `PhaseIIRing.tsx` only.
- **Change:** inline `style` `width/height: 56`→`40`; className text size `text-xs`→`text-[10px]`. All other props unchanged (`RING_COLOR`, `borderColor`, `opacity: 0.9`, rounded-full/border-2/uppercase/tracking, `title`/`aria-label="Phase II"`, the "Phase II" text, doc comment).
- **Signal preserved:** the ring is an intentional **Second Awakening** signal (`HEALING_COACHING_SPEC_V3 §9`) — **shrunk, NOT removed**; still rendered under `{phase === "II" && <PhaseIIRing />}`. Parent `gap-2` in `EmotionalStatsPhrases.tsx` **unchanged**.
- **Pre-existing defect:** `PhaseIIRing.tsx` (`fa0b86d6`, 2026-04-29) and `EmotionalStatsPhrases.tsx` (`a746c07a`, 2026-05-01) both predate the Slice A chain — collision was **not** deploy-introduced.
- **Untouched:** `EmotionalStatsPhrases`, `PendingActionList`, My Page, Comeback, IA.
- **Pixel-fit pending visual:** 40 vs 36/44, and whether `text-[10px]` fits "PHASE II" cleanly inside the 40px ring, verified visually post-deploy (first estimate).
- **Gates:** tsc **0** / `lint:terminology` **13 / baseline 13 / +0**. 1 file, 2 lines.
- **Commit (inner):** inner-main **f9a63046 → 9dc320cf** (1 file). **Push:** `git push origin inner-main:inner-main` FF **`f9a63046..9dc320cf`** (no force, remote==local).
- **Deploy:** NOT performed — staging still **`82e22c34`** (BUILD 1+2+3 live). Ring shrink goes live on the next deploy go.

---

**2026-06-24 · ☑ BUILD 3 — pending list home-actionable filter — COMMITTED+PUSHED, no deploy**

The `/bty` home Pending list now displays **actionable items only**. Frontend display-only filter; `PendingActionList.tsx` only.
- **Predicate:** `status !== "missed" AND new Date(deadline_at).getTime() >= Date.now()` — on top of the endpoint's existing `verified_at IS NULL`. **`rejected` INCLUDED** (only `missed` excluded by status); excludes recorded-missed + past-deadline (the fix for the 13 stale "Expires in expired" cards). Filter placed right after the loading guard; `count`/EmptyState/map all derive from the filtered `actionable` array (empty-after-filter → existing EmptyState).
- **Display-only — zombies remain:** expired/missed contracts are **NOT swept** — they stay in `bty_action_contracts` with their server-side status (no sweep, no status mutation, no cron). They are merely hidden from the home list. **DB lifecycle cleanup of stale past-deadline rows = separate future track.**
- **Deadline copy:** existing `{expiresIn} {formatDeadline}` ("Expires in {time}") kept — only future-deadline rows render now, so it reads correctly; the standalone "Expired" copy is **moot** (no expired row reaches render) and was NOT added. `formatDeadline` helper left as-is (defensive). Timezone-safe: ISO `deadline_at` → epoch-ms vs `Date.now()` (both UTC).
- **Untouched:** endpoint, My Page, `ActionContractHub`, `AwaitingQrList`, DB, PHASE II ring.
- **Gates:** tsc **0** / `lint:terminology` **13 / baseline 13 / +0**. 1 file, +12/−2.
- **Commit (inner):** inner-main **9bdb35a1 → f9a63046** (1 file). **Push:** `git push origin inner-main:inner-main` FF **`9bdb35a1..f9a63046`** (no force, remote==local).
- **Deploy:** NOT performed — staging still **`6a5bb4ef`** (BUILD 1+2). Filter goes live on the next deploy go.

---

**2026-06-24 · ☑ BUILD 2 — pending action list on /bty hub (first visible UI slice) — COMMITTED+PUSHED, no deploy**

First visible UI slice of the action-centric home — a Pending Action list mounted on the `/bty` hub, consuming the BUILD 1 endpoint.
- **Component:** NEW `src/components/bty/PendingActionList.tsx` — self-fetching client component (mirrors `EmotionalStatsPhrases` pattern: `useEffect` + `useParams` locale, loading/error/empty). Consumes **`GET /api/arena/action-contracts/pending`** (endpoint `a9431f97`). Renders per contract: `action_text`, status badge, `expiresIn`+`formatDeadline`. Cards **display-only** this slice (no chevron/onClick/Link — detail/continue nav = later slice).
- **Badge mapping (frontend-only, no `display_state`):** 3 badges — **QR needed** (`verification_type ∈ {qr,hybrid,qr_peer,qr_system,qr_location}`, regardless of status) · **Awaiting verification** (non-QR + status ∈ {submitted,approved,escalated}) · **In progress** (everything else, incl. draft/committed/pending/rejected/missed). "재노출 예정" (REEXPOSURE_DUE) + expired/redo badge **deferred** — no data source on this endpoint / later track.
- **Mount:** `bty/(protected)/page.client.tsx` — **addition** of `<PendingActionList />` in a `mt-10` div ABOVE `<EmotionalStatsPhrases />`; existing hub content untouched. My Page contract surfaces (`AwaitingQrList`/`ActionContractHub`) untouched — duplication = later IA track.
- **i18n:** 6 keys ×3 blocks in `actionContract` namespace (`pendingListTitle`=KO "내가 해야 할 행동"/EN "My actions to complete", `pendingEmptyMessage`, `pendingErrorMessage`, `badgeQrRequired/AwaitingVerification/InProgress`). Token convention: card chrome `--arena-*` vars; status accents raw-Tailwind (amber/blue/emerald) per `ActionContractHub` precedent. No new token system.
- **Gates:** tsc **0** / `lint:terminology` **13 / baseline 13 / +0**. 3 files, +176 (1 new + 2 edits), 0 unrelated files.
- **Commit (inner):** inner-main **a9431f97 → 9bdb35a1** (incl. BUILD 2b refinement: simplified badge mapping, title copy). **Push:** `git push origin inner-main:inner-main` FF **`a9431f97..9bdb35a1`** (no force, remote==local).
- **Deploy:** NOT performed — staging still **`b84fab2a`** (Phase 1.1+2A). BUILD 1 endpoint + this UI both unshipped; next deploy bundles both.

---

**2026-06-24 · ☑ BUILD 1 — pending action contracts endpoint — COMMITTED+PUSHED, no deploy**

First mutation after an extended read-only IA / action-loop / aggregation-shape measurement sequence. New read-only endpoint as the foundational data layer for an action-centric "Today" home (slice A).
- **Endpoint:** `GET /api/arena/action-contracts/pending` — user-wide, **side-effect-free** (pure `select`; no status transition, no session/next call, no expired→missed write). Filter `user_id = caller AND verified_at IS NULL`. **User-scoped** Supabase client (requireUser) — NO service-role (RLS + explicit user_id both apply).
- **Shape:** `{ contracts: [...] }`, 7-field minimum each — `id, status, action_text (alias of contract_description), deadline_at, verification_type, session_id, created_at`. Exposes canonical `verification_type` (NOT the `verification_mode` 'hybrid' channel). `session_id` IS the run id (no separate `run_id` column). Order: `deadline_at ASC, created_at DESC`.
- **Measure-first:** confirmed action col = `contract_description`; `session_id`=arena run id; `requireUser` user-scoped pattern (mirrors `by-session` sibling); `verified_at IS NULL` broader than `BLOCKING_STATUSES` (pending/submitted/rejected/escalated). **A user-wide pending list was confirmed ABSENT prior to this** (prior sources were per-session lookups or POST-create).
- **Gates:** tsc **0** / `lint:terminology` **13 / baseline 13 / +0**. Single new file, 65 insertions, 0 existing files modified.
- **Commit (inner):** inner-main **00e9bad1 → a9431f97** (1 new file). **Push:** `git push origin inner-main:inner-main` FF **`00e9bad1..a9431f97`** (no force, remote==local).
- **Deploy:** NOT performed — staging still at **`b84fab2a`** (Phase 1.1 + 2A). Endpoint goes live on the next deploy go.

---

**2026-06-24 · ☑ Phase 2A header glyph (4-slot) — CLOSED, COMMITTED+PUSHED, no deploy**

Phase 2A CLOSED: transparent-navy BTY knot glyph added to the 4 header wordmark slots; text wordmark preserved (NOT replaced).
- **4 slots (decorative glyph + preserved text):** `ArenaLayoutShell.tsx` · `CenterLayoutShell.tsx` · `my-page/layout.tsx` · `LandingClient.tsx` (Landing TOPBAR wordmark, NOT hero). Each: Link gains `inline-flex items-center gap-1.5`; first child `<img src="/brand/bty-knot-transparent-navy.svg" alt="" aria-hidden="true" width={20} height={20} className="h-5 w-5 shrink-0" />` (navy knot glyph) before the byte-identical `<span fontWeight:400>bty</span>ARENA`. Light/cream header bg → navy glyph contrasts; decorative aria-hidden, text remains the accessible name.
- **Untouched:** footer, landing hero (h1/copy), metadataBase, favicon/icon/OG/twitter, auth/cookie/middleware, no BrandWordmark component. Asset NOT regenerated (staged Phase 1).
- **Verify:** classifier recovered (after a transient outage that held the gate) → tsc **0** / `lint:terminology` **13 / baseline 13 / +0**. Diff = 4 files, +8/−3, text preserved.
- **Commit (inner):** inner-main **79e001ab → 00e9bad1** ("Phase 2A logo icon surface close", 4 files). **Push:** `git push origin inner-main:inner-main` FF **`79e001ab..00e9bad1`** (no force; remote == local).
- **Deploy:** NOT performed (별개 go). Phase 2A header glyphs bundle with Phase 1.1 login transparent-gold on the next deploy.
- **Note:** `CURSOR_TASK_BOARD.md` filename intentionally UNCHANGED (rename = separate governance track).

---

**2026-06-23 · ☑ Phase 1.1 login glyph polish (transparent-gold) — COMMITTED+PUSHED, no deploy**

E1 decision (b): login card knot swapped gold-on-navy → floating transparent-gold. Single `<img src>` mutation; metadataBase deferred (E2 (b), custom-domain decision).
- **Swap:** `src/components/auth/login-card.tsx` ONE line — `src="/brand/bty-knot-gold.svg"` → `src="/brand/bty-knot-transparent-gold.svg"` (already-staged Phase 1 asset, verified transparent: `rect fill="none"`, 0× `#0B1F3A`, 3× gold `#C9A66B`). width/height(56) / class(`rounded-2xl`) / alt / aria-hidden UNCHANGED — knot now floats on the slate-950 card, no navy tile. No asset regenerated.
- **Untouched (scope lock):** metadataBase, layout.tsx, favicon/icon/apple-icon/OG/twitter assets, header/footer/landing, auth/cookie/middleware, OAuth button/form. Diff-verified empty across those paths.
- **Verify:** tsc 0 / `lint:terminology` 13 (+0; asset-path swap, no user-facing text) / diff = single line (blob `96aef59e → 3252848b`).
- **Commit (inner):** inner-main **50257189 → 79e001ab** (1 file, 1 line). **Push:** `git push origin inner-main:inner-main` FF **`50257189..79e001ab`** (no force).
- **Deploy:** 미수행 (별개 go). Floating-knot glyph live only post-deploy. NOTE: Phase 1 WAS deployed earlier (Version **`ef50077a`**, 2026-06-24) → current LIVE still shows the gold-on-navy tile glyph; Phase 1.1 transparent-gold supersedes on next deploy.
- **E2:** metadataBase remains unset by decision — OG/twitter image meta emit `http://localhost:3000/…` base live (confirmed at ef50077a); deferred to custom-domain decision, NOT fixed here.

---

**2026-06-23 · ☑ Phase 1 BTY knot brand assets (inner web) — COMMITTED+PUSHED, no deploy**

BTY brand integration Phase 1: knot favicon/icon/OG + login glyph wired into inner-main. Scope = brand assets + metadata + ONE login glyph; NO header/footer/landing (Phase 2), NO auth/cookie/middleware.
- **Assets (exact bytes, no re-rasterize):** source `/Users/hanbit/Dev/_bty_phase1_assets/` (12 files, all sizes + SHA-256 verified vs spec). `public/favicon.ico` replaced (multi-res 16=white hi-contrast / 32-48=gold, 15086B). Next 15 app-convention: `src/app/icon.png`(←icon-512, 17297B) · `apple-icon.png`(←180, 5646B) · `opengraph-image.png`(40998B) · `twitter-image.png`(40998B). Login glyph source `public/brand/bty-knot-gold.svg`(4043B); 4 variant SVG (mono-black/white, transparent-gold/navy) staged in `public/brand/` for Phase 2 — NOT wired.
- **Login glyph (only code change):** `src/components/auth/login-card.tsx` +9 lines — gold knot `<img>` above the locale headline (additive; decorative `alt="" aria-hidden`; slate-950 dark card; OAuth button/form/auth logic untouched). `src/app/layout.tsx` UNCHANGED — app-convention auto-wires icon/apple-icon/OG/twitter; title/description preserved, no `icons:` field needed (no duplication).
- **Verify:** tsc 0 / `lint:terminology` 13 (baseline "try again" set, +0 new) / `npm run build` PASS — route table emits static `/icon.png` · `/apple-icon.png` · `/opengraph-image.png` · `/twitter-image.png` + `.next` `.meta` descriptors (= convention wired). eslint = `ignoreDuringBuilds:true` by design (next.config.js:6-7; env Node 24 vs `.nvmrc` 20 → known ajv crash, pre-existing, gate lint = `tsc --noEmit`).
- **Commit (inner):** inner-main **61e1d40e → 50257189** (11 files, +79; 9 add + favicon binary + login-card mod). **Push (code):** `git push origin inner-main:inner-main` = FF **`61e1d40e..50257189`** (no force). Remote ls-remote == 50257189.
- **Deploy:** 미수행 (별개 go: `cd bty-app && rm -rf .open-next && npm run deploy`). Favicon/OG/login glyph go live only post-deploy.
- **HOLD:** `metadataBase` unset (pre-existing — wasn't set before either). OG/twitter wire fine but absolute-URL base resolves at deploy origin; recommend setting canonical public origin in a follow-up (unlisted domain decision — not invented here). Observation (not a deviation): Gold master includes a navy tile, so the login glyph renders as a rounded navy badge with gold knot per dispatch instruction; if a tile-less mark is wanted later, swap the Phase-2 TransparentGold variant.

---

**2026-06-22 · ◐ B-w3 wrapper plugin fix + native OAuth E2E — INIT HALF PASS / RETURN LEG HOLD (Supabase Site-URL fallback)**

BTY Native App B-w3 (wrapper-only; inner UNTOUCHED 61e1d40e; deploy 06af1777 live). Corrects the B-w2 inventory error that ASSUMED `@capacitor/browser` lived in the shell — live runtime disproved it (`Plugins.Browser=undefined`), B-w3 fixed it wrapper-side.
- **Wrapper fix:** `~/Dev/bty-native-app` `npm install @capacitor/app@8.1.0 @capacitor/browser@8.0.3` + `npx cap sync ios`(2 plugins linked) + rebuild. Live LLDB proof on running shell: `Plugins.App=object` + `Plugins.Browser=object` (were undefined; PluginKeys += Browser,App), `isNative()=true`, UA carries `BTYNative`.
- **Inner code verdict:** B-w2 native-aware OAuth branch confirmed **CORRECT and live** — captured `Browser.open` data.url = `…redirect_to=btyarena://auth/callback?next=%2Fprotected`; client PKCE init minted `sb-mveycersmqfiuddslnrj-auth-token-code-verifier` cookie in WebView; system browser (SFSafariViewController) opened. `/api/auth/initiate` correctly **ABSENT** (init is client-side by design).
- **Init half: PASS** — system browser (NOT embedded WebView: ✕+accounts.google.com chrome) → Google consent "continue to mveycersmqfiuddslnrj.supabase.co" → verifier cookie present → correct `redirect_to`. E2E driven via LLDB `evaluateJavaScript` (sim GUI tap synth blocked); Google login completed by Commander.
- **Return leg: HOLD** — after Commander Google login, system browser landed on **https Site URL** (bty-arena-staging.ywamer2022.workers.dev landing), NOT `btyarena://` → Supabase fell back to Site URL → `appUrlOpen` never fired → `/api/auth/callback` **never hit worker** (wrangler tail confirmed) → no httpOnly session → app WebView stayed `/en/bty/login` unauth.
- **Open diagnosis:** allow-list NOW shows `btyarena://auth/callback**` (wildcard) present; uncertain whether present at B-w3 run time. **Next step = ONE return-leg re-verification.** If Site-URL fallback persists with wildcard confirmed present → root cause = SFSafariViewController custom-scheme return limit → swap `@capacitor/browser` → ASWebAuthenticationSession-based plugin (handles callback scheme natively).
- Fact note (Commander-record, no editorializing): B-w1 ran one read-only `git status` inside bty-app/ though its scope said no-git-in-inner; mutation 0.

---

**2026-06-22 · ☑ B-w2 native-aware OAuth branch — inner code COMMITTED+PUSHED, runtime HELD (no deploy)**

BTY Native App B-w2: inner-main에 Capacitor-shell OAuth 분기 배선. `isNative()` 가드 하에서만 native 동작, **웹 경로 byte-unchanged**(`skipBrowserRedirect: isNative()` = web에서 false 리터럴과 동일, `Browser.open` 미호출, bridge=null).
- 신규 2 + 가드편집 2: `src/lib/native/isNative.ts`(runtime `window.Capacitor.isNativePlatform()` ‖ `BTYNative` UA fallback — 둘 다 B-w1 라이브 확증; `@capacitor/*` 의존 0, global `Window.Capacitor` 타입만) · `src/components/native/CapacitorAuthBridge.tsx`(native-only `appUrlOpen` → `btyarena://auth/callback?code&next` → `/api/auth/callback` 서버 교환+httpOnly 쿠키; web=null, 리스너 0) · `src/components/auth/login-card.tsx`(native redirectTo=`btyarena://auth/callback`, `skipBrowserRedirect:isNative()`, 시스템 브라우저 `Browser.open(data.url)`; 클라 init 유지로 PKCE verifier 쿠키 WebView 발급) · `src/app/[locale]/layout.tsx`(bridge 1회 마운트). **`/api/auth/callback` 무변경**(서버 교환 경로 = spike 입증 server-cookie 결과와 일치). Decision-3: native landing `next` 기본 `/protected`.
- 정적검증: tsc 0 / lint:terminology 13(베이스라인, 편집·신규 파일 신규 위반 0) / `npm run build`(web) PASS.
- Commit(inner): inner-main **e0cb6e04 → 61e1d40e**(4 files, +108/−3). Push(code): `git push origin inner-main:inner-main` = FF **`dafa1f9f..61e1d40e`**(no force). **★부수효과:** 이 FF가 origin/inner-main을 dafa1f9f에서 전진시키며, 직전까지 push-HELD였던 **e0cb6e04**(C2 day-page deploy commit, 체인 조상)도 함께 origin/inner-main에 publish됨 — 내 커밋과 분리 불가. 신규 origin tip = 61e1d40e.
- 런타임: **미배포**(deploy = 별개 go: `cd bty-app && rm -rf .open-next && npm run deploy`). **Decision-1**(Supabase Auth redirect allow-list에 `btyarena://auth/callback` 추가) 미적용 시 native OAuth 런타임 = **EXPECTED-FAIL**(코드 정합성과 분리; 웹 OAuth 무영향).
- 사실 기록(Commander 판단용, 의미부여 없음): B-w1에서 bty-app/ 내 read-only `git status` 1회 실행 — 스코프 "no git in inner" 문언 brush, mutation 0.

---

**2026-06-16 · ☑ #7a CLOSED — XP clipping 280px 미재현 (governance only, 0 mutation)**

#7a(Ranking Sidebar XP clipping)는 STEP 0b computed-overflow 실측 결과 현 코드에서 재현 실패. 추가 mutation 불필요. git 무흔적(코드 0) → 재진입 방지 위해 본 판정만 기록.

- 실측(STEP 0b): 280px 고정 sidebar mount(BtyArenaRunPageClient.tsx:1367 / ArenaResolveClient.tsx:241)에서 XP stats 가용폭 124px vs intrinsic ~100px(7자리) → weekly XP 자릿수로 overflow 불가. clip 임계 ~9자리(불가능).
- 실제 truncate = codeName/nameLine ellipsis (LeaderboardRow.tsx:125, by design) — XP 아님.
- epistemic 경계: "버그 없음" 아님 = "현 버전 재현 실패". 과거 수정 완료 추정, 추가 작업 불요.
- scope 판정: sidebar-scoped 선호 / 풀 리더보드(maxWidth:860) 무관 / XP 의미·계산 무접촉.
- status: #7a CLOSED (vacuous). 향후 동명 트랙 재진입 시 본 엔트리 참조 — 이미 닫힘.

---

**2026-06-16 · ☑ IA-B1 decision-2 재정합 — phantom 어휘 폐기 (governance only, 0 mutation)**

이번 트랙 STEP 0 ledger 실측 결과, IA-B1 decision-2(Center Current State display)는 이미 구현·배포·종결됨을 재확인. 본 엔트리는 신규 mutation/작업 아님. 코드 0, deploy 0. 이번 트랙의 유일 산출물 = decision-2 locked 언어에 잔존하던 phantom 어휘 폐기 (Commander D1/D2).
- 기존 종결 재확인: 6-08 Current State 그룹핑 COMMITTED (inner-main 01b0dd79 + outer); 6-11 Train CTA primary filled DEPLOYED (staging 7a68136d, 3-way PASS); 6-12 line 292 "B1-Decision2-Vacuous = 이미 구현, 0 mutation" 종결.
- D1 phantom 어휘 폐기: "4-stage progression UI" / "Stage badge" 어휘 폐기. Center에 시각 progression stepper 부재 — StageContextCard=Leadership Stage1–4 1줄텍스트; HealingPhaseTracker 4-step stepper는 compact로 Center 미렌더; badge grep referent 0.
- D1 정정 언어: Current State 정렬 = 신규 stepper 이동 아님. 이미 존재하는 카드 (CenterPageClient.tsx:564-574) 내 2 resident(StageContextCard + HealingPhaseTracker-compact)의 Opt-A 공유 카드 chrome 그룹핑 — 이는 6-08 01b0dd79로 이미 실현됨. 컴포넌트 흡수✗ stepper복원✗ badge신설✗ compact해제✗.
- D2 CTA 어휘 확정: Center primary recovery action = /[locale]/train/day/N (TrainProgressCard, 현위치 유지, reorder 0). /bty Foundry door = B1 primary CTA 아님. getCenterCtaHref(/bty)=PageClient 전용, Center 미소비.
- SUPERSEDE: line 417 "Stage badge" 어휘는 본 엔트리로 superseded. ※ 과거 엔트리(line 417 등) 원문은 편집하지 않음 — reverse-chrono prepend supersede only, history rewrite ✗.
- status: IA-B1 트랙 CLOSED (vacuous re-discovery + 어휘 정정). 신규 mutation 트랙 없음. outer commit SHA = **<this outer>** (push 전 미백필, line 28 convention 준수).

---

**2026-06-16 · ★ BTY_COMPANION_ONTOLOGY_v1 v1.0 LOCKED (Dr. Chi ontology 골격 — outer-root docs/ governance peer)**

`BTY_COMPANION_ONTOLOGY_v1.md`를 DRAFT-1 → **v1.0 LOCKED** 승격, outer-root `docs/`에 commit (axis-canon governance peer, inner 부재 = 정상 peer 토폴로지). §1~§5 골격 결정 수록:
- **§1 Identity** = 단일 Companion = **Dr. Chi** (세 얼굴 = Foundry full / Arena 과묵 / Center 회복; ontology 단일·runtime 모듈 격리·교차 import 금지). Surface naming: Foundry만 "Dr. Chi" 노출, Arena·Center 무명(RESERVED 명명충돌 회피).
- **§2 Mode** = 3-mode Arena/Center/Foundry (실측 확인; `resolveChatMode` = aspirational spec, grep miss). 교차 import 엄금.
- **§3 Role×Mode** = Arena **Observer**(비춘다) / Center **Safety Floor Companion**(곁에 있다) / Foundry **Mentor**(질문한다) — 비중첩 3 동사, 강도 사다리 아님.
- **§5 Three Faces** (CLOSED) = 어휘뿐 아니라 **아키텍처 종류가 다름**: Companion **State-Driven**(AIR-band) / Observer **Position-Driven**(patternShift band) / Mentor **Persona-Driven**(substrate 없음, 존재론 우선). intervention level 직접 비교 금지.
- **§4 Intervention** = **RESERVED** (다음 트랙, 별도 문서; §5가 입력).
- 승격 scope = 헤더/상태 라벨만 (line1 title + 상태블록 + 구분 line + 권위 상태 line244). §1~§5/실측/부채 본문 변경 0. line5 "phantom" = 용어 정의(권위진술 아님), 유지.
- 실측 근거 = STEP A/A-2 (READ-ONLY) 표 수록; Commit 필드 placeholder `<this outer>`. inner-main / bty-app mirror 미접촉 (governance canon = outer-root docs/ ONLY).

---

**2026-06-16 · ☑ BTY_AVATAR_PLATFORM_ARCHITECTURE_v1 RELOCATED to root docs/ (governance/architecture canon peer — NOT a re-lock)**

`BTY_AVATAR_PLATFORM_ARCHITECTURE_v1.md`를 outer-root `docs/`로 이동 — axis-canon governance peer topology에 정렬(outer-root-only, 6개 axis governance docs와 동일: BTY_AXIS_CANON / v1_1_ADDENDUM / v1_2_ARCHETYPE_BASELINE / CHARACTER_AXIS_GOVERNANCE_LOCK / PATTERN_FAMILY_AXISVECTOR_COVERAGE_LOCK / AXIS_CANON_BODY_CLOSE). co-track 단일 inode라 outer `git mv`가 물리 파일을 bty-app/ 밖으로 빼냄 → inner-main에서도 제거. **content 무변경 / lock 유지(LOCKED v1.0) / `<this outer>` placeholder verbatim / blob `9f9f917d` 보존 = re-lock 아님.** docs-only / no deploy.
- inner commit SHA = **b5d67ff3** (inner-main, single deletion `docs/BTY_AVATAR_PLATFORM_ARCHITECTURE_v1.md`; `6d1bf5fa..b5d67ff3` FF push, force 0). 이제 inner-main / bty-app subtree에서 부재.
- outer commit SHA = **<this outer>** (rename `bty-app/docs/… → docs/…` + 본 ledger; blob 동일 9f9f917d, R rename detection).
- end-state: avatar canon = outer-root `docs/BTY_AVATAR_PLATFORM_ARCHITECTURE_v1.md` 단일 위치(axis peer 동형). CLAUDE.md "architecture→root docs/" 규약과도 정렬 — 직전 arbitration NOTE 해소.

---

**2026-06-16 · ★ BTY Avatar Platform Architecture v1 LOCKED — 6-class taxonomy / Layer 0–3 stack (post-launch architecture track)**

BTY Avatar Platform Architecture를 `bty-app/docs/BTY_AVATAR_PLATFORM_ARCHITECTURE_v1.md`로 신규 작성·LOCK(v1.0, Commander-approved). 6-class character taxonomy(USER_AVATAR · COMPANION · AXIS_AVATAR · NPC · TODAY_ME · RECOVERY_COMPANION), Layer 0–3 stack(LOCK-0 = Leadership/Routing engine가 Avatar 계층 위 · "avatar가 엔진 삼키기" 방지 불변), Axis Canon deferral(§5 — RESERVED 7종 rules.ts archetype 충돌 회피), Today Me = Self Reflection Mirror(사용자 분신 아님). docs-only / app·runtime·Rive·assets·Supabase·UI 무변경 / no deploy.
- inner commit SHA = **6d1bf5fa** (inner-main, `docs: lock BTY Avatar Platform Architecture v1.0`, staged set = 단일 docs 파일; `b017fdfb..6d1bf5fa` FF push, force 0)
- outer commit SHA = **<this outer>** (mirror+ledger; bty-app/docs/... co-track 동일 inode 13544138 → inner와 byte-identical blob, outer는 add+본 ledger만)
- status = FINAL DRAFT(rev.3) → **LOCKED v1.0**; Commit 필드는 `<this outer>` placeholder 유지(pre-push backfill 안 함, convention).
- NOTE: 배치=bty-app/docs(sibling AVATAR_LAYER_SPEC.md·MY_PAGE_IDENTITY_CONSOLE_V1.md와 동일 위치, Commander 명시 경로). CLAUDE.md "architecture→root docs/" 규약과 괴리 → arbitration 대상으로 보고.

---

**2026-06-16 · ☑ HYGIENE — local video assets gitignored (inner+outer mirror, no deploy)**

inner working tree에 untracked로 쌓여있던 launch media `assets/`(~200MB, 98MB `0528.MOV` 포함, build 미참조·next.config 무참조)를 `.gitignore`에 append-only로 등록. `**/.DS_Store`는 기존 line 23 `.DS_Store`(전 depth 커버)와 중복이라 **제외**, `assets/` 단일 라인만 추가.
- inner commit SHA = **b017fdfb** (inner-main, `chore: ignore local video assets`, staged set = .gitignore 단일)
- outer commit SHA = **<this outer>** (mirror+ledger; bty-app/.gitignore는 co-track 동일 inode라 file-level no-op, add만)
- scope = hygiene-only / ignored `assets/` / **no docs/video decision** (docs/video/*.md는 NOT ignored 보존, Commander 미결) / no cleanup(.DS_Store·worktree·media 삭제 0) / **no deploy**(git push만, CF 무관)
- #1 FORGE(54c5e7de base 69d2a01c pre-#1) 무영향 — 본 커밋은 .gitignore-only, shippable code 0.

**2026-06-15 · ★ FONT_VENDOR_A DEPLOY CLOSED (PATH B / font-only cherry-pick) — Version 54c5e7de live, ETIMEDOUT 근원 입증 제거**

FONT_VENDOR_A self-host를 **font-only**로 prod 배포 완료. #1 FORGE(getMyPageIdentityState be41e00e / 2b572a71)는 **의도적 미선적**(Commander DECISION B).
- **배포 산출**: deploy **Version ID `54c5e7de-e378-48c9-897f-5d0b1dab12b8`** (bty-arena-staging, 직전 87209a26 대체). 3-way freshness 일치: versions tail=54c5e7de · provenance=cherry-pick **bc22464d**(font commit **e952ec40** → live base **69d2a01c**, 8 font-only) · LIVE CSS가 로컬 `/_next/static/media/*-s.p.woff2` 참조(gstatic/googleapis 0), 벤더 woff2 HTTP 200·19356B(noto-serif-400 byte 일치).
- **GATE 2 diff proof**: `69d2a01c..bc22464d` = 정확히 8 font 파일. getMyPageIdentityState 부재 · 2b572a71 ancestry FALSE · migration 0 · Center Letters/LRI/reminder/actionDraft 0.
- **GATE 5 strong-proof (가설 입증)**: root-free DNS-block harness(self-test 가로채기 확인: gstatic/googleapis→ENOTFOUND, npm passthrough) 하에 **standalone `next build` 성공**(✓ Compiled 8.5s, 295/295 static pages, 폰트 CDN 차단에도 빌드 완료) → 빌드 외부 fetch 의존 **제거 입증**. 번들 grep: 벤더 폰트 6/6 emit·app font-manifest 로컬 media, CDN 참조 0(잔존 2건은 `next/dist/compiled/@next/font/dist/google/` 프레임워크 lib 死코드 — 모든 Next 앱 동봉, 미호출, GATE5 차단빌드로 입증).
- **격리**: ephemeral inner worktree @69d2a01c + cherry-pick e952ec40, `--skipNextBuild` 불가(standalone 미생성)로 full opennext build 산출 → block-built .next 패키징. cherry-pick **bc22464d 미push**(teardown으로 GC). main/inner-main/outer 무변경(inner e952ec40 / outer bd0d598 / origin/inner-main e952ec40).
- NOTE: GATE4 `--skipNextBuild` 실패는 직접 `next build`가 opennext standalone output 미생성 탓(ENOENT pages-manifest) — full opennext build로 우회. build script `NODE_OPTIONS` inline이 내부 next build의 --require clobber → strong-proof는 별도 standalone next build로 수행(정답).

**2026-06-15 · ⚠ #1 FORGE getMyPageIdentityState — canon inner-main 커밋, font-only 배포에서 의도적 미선적 (DEFERRED, not a bug)**

#1 FORGE Identity-slot 렌더(getMyPageIdentityState **be41e00e** / inner commit **2b572a71**)는 canonical inner-main(e952ec40)에 정식 커밋되어 있으나, 본 font-only 배포(54c5e7de, base 69d2a01c)에서 **고의 제외**. 현재 live(54c5e7de)는 base 69d2a01c의 getMyPageIdentityState=**ac98e00f**(pre-#1) 유지 — #1은 **아직 prod 미반영**. **차후 inner-main(e952ec40 이상) 배포 시 #1이 자동 선적됨 → 그 배포 전에 product sign-off 필수.** 의도적 deferral이며 결함 아님. (이전 "live 이미 be41e00e" 가정은 정정됨: 87209a26이 69d2a01c clean-worktree 빌드였기 때문.)

---

**2026-06-15 · ★ FONT_VENDOR_A — next/font/google → next/font/local 自가호스트 (Cloudflare 빌드 ETIMEDOUT 영구 제거)**

Cloudflare/OpenNext `next build`의 빌드 타임 외부 폰트 fetch(`fonts.gstatic.com`) 제거 — `next/font/google` 2개 import를 `next/font/local` + 벤더 woff2로 교체.
- **대상 2 import**: `src/app/layout.tsx`(Noto Serif KR, `--font-serif-kr`, 400/500/600) · `src/components/bty/ArenaLayoutShell.tsx`(Noto Sans KR, `--font-arena-heading`, 600/700/800). **둘 다 변수명·weight·`display:"swap"` 보존**.
- **에셋**: `bty-app/src/app/fonts/` 6 woff2 신규(latin subset only, 한글 subset 제외 — STEP 0 parity 고정). 출처 = **fontsource unpack**(npm @fontsource/noto-serif-kr+noto-sans-kr, /private/tmp 언팩, bty-app/package.json 무변경, Google CDN 미접촉).
- **fallback 복제**: serif `adjustFontFallback:"Times New Roman"`+`["Georgia","Batang","serif"]` / sans `adjustFontFallback:"Arial"`+system-ui stack(globals §4 B·tailwind sans 대응).
- **무변경 입증**: `.variable` 주입 2곳(body/bty-arena-area div) · `font-serif` consumer 9곳 · tailwind.config.ts:147 · globals.css:202 전부 미수정. STEP 0 divergence 0(3rd import 0 / .gitignore fonts 미제외 / 빌드캐시 248 hashed woff2는 매핑 모호로 미사용).
- **Done gate**: `grep next/font/google` 0 · `tsc --noEmit` exit 0 · `lint:terminology` 13(=baseline, 신규 0, 전부 미변경 i18n.ts). **build/deploy = 별도 Commander go(본 dispatch 범위 밖)**.
- **Refs**: inner **e952ec40**→origin/inner-main FF(`2b572a71..e952ec40`, 경로-스코프 8파일, 기존 dirty 미번들). outer mirror+ledger = 본 항목.

---

**2026-06-15 · ★ INNER_OUTER_SYNC_REPAIR — #1 getMyPageIdentityState topology 역전 해소 (forward commit, 신규변경 0)**

#1 getMyPageIdentityState topology 역전 해소 — outer `b58f747` led, inner lagged; forward commit으로 inner HEAD가 `be41e00e`를 따라잡음. 신규 변경 0, deploy 0, live 이미 `be41e00e`.
- **STEP 0 3자 정합 확인**(outer commit / inner dirty / live 동일 blob): outer `b58f747`:file = outer HEAD `fc31881`:file = working-tree = `be41e00e` (byte-identical, 단일 inode 13026585 co-track). inner HEAD `69d2a01c`:file = `ac98e00f` = outer pre-#1 parent `b3479b8`:file (pre-change baseline 일치). dual-version 0.
- **provenance**: `b58f747` = outer-native commit("fix(my-page): Identity slot renders Code…"), origin/main에 이미 push됨. inner→outer leak-integrate 경로 **아님**; `--all --grep`로 inner 측 #1 commit 0 확인 → 정상 co-track 역방향(outer led / inner lagged dirty)이었음.
- **repair**: inner add 경로-스코프 1파일(`src/lib/bty/identity/getMyPageIdentityState.ts`, add -A 금지, untracked `assets/`·`docs/video/` 제외) → inner commit `2b572a71`(blob `be41e00e`) → `git push origin inner-main` FF(`69d2a01c..2b572a71`, force 0, origin/main 미접촉). **deploy 안 함**(live 이미 `be41e00e`, commit은 inner HEAD 위치만 이동).
- outer ledger = 본 항목.

---

**2026-06-15 · ★ LRI/Certified leader-track approve — DEPLOYED 87209a26 (clean worktree 69d2a01c)**

#4 INTEGRITY_EVIDENCE 후속 mutation 트랙. 선행 측정(존재≠reachable≠live)으로 HTTP gap 1건만 확정 → 최소 표면 mutation.
- **M1** `POST /api/admin/leadership-engine/approve-leader-track` (신규 route) — `requireAdminEmail` gate, body `{userId}`, `approveLeaderTrack` 위임(canApproveLeaderTrack 내부 certified gate 상속, 발명 0), reason→status(409/403/500) 매핑.
- **M2** leadership-metrics admin page approve 버튼 — `readiness_flag && !is_leader_track` 분기 노출, 성공 시 `load("air")` 재조회(기존 membership-approve 패턴).
- **seam-A** approverId = operating admin id(auth.user.id) → admin∧certified 이중 게이트. **self≠other 가드 없음(코드상 self-approve 미차단)** — 검증서 ee9d2075 self-promote **성공 확인**(정책 노출, 향후 가드 추가/유지 = product 판정).
- **seam-B'** admin leadership-metrics GET 응답에 `readiness_flag`+`is_leader_track` 노출 — **admin-only(raw LRI 아님)**, `leadership_engine_state` batch.
- **무수정**: approveLeaderTrack/canApproveLeaderTrack/computeLRI/certifiedStatus(입기만) · GET certified(arena live) · 전용 GET admin/lri(불신설) · LRI formula · Certified rule · IntegrityScoreCard mount · player surface · admin tab.
- **player-leak 검증(이중)**: static-structural 0(2필드·route·UI 전부 admin-gated, player/arena grep 0) **+ LIVE 0**(center/arena/my-page screenshot 육안 — live 확인, static으로 축소 안 함).
- **메모리 정정 3건**: (1) GET admin/lri = gap 아님(leadership-metrics 집계로 admin-served) (2) GET certified = gap 아님(arena/leadership-engine/certified live+reachable) (3) admin tab = **8 not 4**(AdminNav 실측).
- **3-track combined deploy** 87209a26: #7a(cdf028ff ancestor, LeaderboardRow XP clipping fix)+FORGE live, #1(getMyPageIdentityState **uncommitted** → INNER_OUTER_SYNC_REPAIR 후속). 3-way verdict PASS(HEAD 69d2a01c + Version 87209a26 + live visual, 독립 일치).
- **Static**: tsc 0 / lint:terminology 13(+0) / 50 targeted tests pass. **Push**: inner f47d4039→69d2a01c FF(cdf028ff #7a + 69d2a01c, force 0, #1 제외) → origin/inner-main. outer ledger = 본 항목.

**2026-06-15 · 12_AXIS_CANON_BODY CLOSED — 저작 대상 부재 확정 (AXIS_CANON_BODY_CLOSE.md)**

12-Axis 본문 트랙 = CLOSED. **발견(FLAG)**: §3 Per-Axis 본문 12/12 = v1.0(344f8a3)에 이미 resident·잠김, 빈 슬롯 0 → 신규 저작 대상 부재. 3자 정합 측정(락§1 ↔ 코드 axisVector ↔ Commander 12축): **집합 완전 일치**, 순서 2-transposition({accountability↔visibility}, {control↔courage}) = 락§1/§3 pattern-grouped vs 코드/Commander fingerprint, 둘 다 valid(v1.0 §0 명시 "doc convention ≠ fingerprint order"), 위반 아님. canonical-5 EXACTLY 5 ⊆ trigger-10, metric-2=courage/identity.
- close 봉인: `docs/AXIS_CANON_BODY_CLOSE.md` (41L, BTY_AXIS_CANON 종속, 락 무수정).
- **잔여 이관**: 축 관계(거울쌍/mirror pairs) = canon 미명기(v1.0/v1.1 부재) → **MIRROR_PAIR_CANON 신규 트랙**으로 이관(본 트랙에서 닫지 않음, 저작 시 net-new).
- 코드/canon 변경 0 · 의미 저작 0. Commit: 54c886a (doc 단독, +41; outer origin/main b71858e..54c886a pushed).

**2026-06-15 · ★ AVATAR_MAPPING_TRACK CLOSED — #3 residency + #6 scenario CLOSED (SCENARIO_AND_RESIDENCY_INTENT.md)**

#3 Code-name residency (상속 close — #1/#3/#5 에서 상속, 독립 측정 부재 명시): 6 surface(Profile/Dashboard/Leaderboard/Arena/Guide/My-Page) 전부 FORGE(Code) resolve, Archetype residency 0. #6 Scenario narrative (81 JSON, 27 cores × base/en/ko): UPHELD — archetype refs 0, Code refs 0, 모든 "you are X" = behavior-observation/NPC 대사/scene narration(고정정체성 분류 0), ko/en 대칭.
- fact 고정 + 종료 봉인: `docs/SCENARIO_AND_RESIDENCY_INTENT.md` (49L, time-scoped). identity 용어 주석: scenario 제목 "identity"(core_09/18/27)=서사 주제 ≠ Code construct, 다른 층위.
- **★ AVATAR_MAPPING_TRACK = CLOSED.** Identity≠State 4-layer 입증: L1 Identity=Code(#1 b58f747) · L2 State=Pattern Signatures(#2 a70ba21) · L3 Evidence=AIR/LRI/Leader(#4 285886a) · L4 Narrative=Observation(#6) + Surface/Copy(#5 fe34d01). 코드·문서·카피·서사 전 층위 유지 입증.
- 코드/scenario/surface/runtime 변경 0 · 락/canon 무수정. Commit: 2c18f6f (doc 단독, +49; outer origin/main 13a4978..2c18f6f pushed).

**2026-06-15 · #5 Copy↔data 계열 정합 측정 CLOSED + PROFILE_SURFACE_ALIGNMENT_INTENT.md 고정**

#5 카피↔렌더 데이터 계열 정합 측정 (read-only, ko/en, 6 surface: Profile·Dashboard·My-Page·Leaderboard·Arena Lobby·Guide). 결과 = **위반 A/B/C/D 전부 N**. Identity 라벨("Leadership Identity"/"리더십 아이덴티티")→FORGE(Code) wire 정합(#1 무회귀); State 카피=관찰형(Confidence/Watch/Shift, "리더십 패턴 형성·누적" 과정형); archetype/"유형"/"leadership type" 고정정체성 카피 0; ko/en parity(characterLocked "Code 진화"/"Code evolution" 등) 유지.
- fact 고정: `docs/PROFILE_SURFACE_ALIGNMENT_INTENT.md` (34L, time-scoped, BTY_AVATAR_IDENTITY_LOCK 종속) — Profile Surface Alignment UPHELD · Identity=Code maintained · Identity≠State maintained · ko/en parity · 위반 0.
- **WATCH (non-blocking)**: profileIdentitySubline en "Your identity" vs ko "표시되는 이름" — 둘 다 데이터=FORGE, semantic mismatch 0, mutation 불요; 후속 카피 개선 후보(en→name/Code 정렬)로만 기록.
- 코드/카피/surface/runtime 변경 0 · 락/canon 무수정. Commit: fe34d01 (doc 단독, +34; outer origin/main 2e1bafd..fe34d01 pushed).

**2026-06-15 · #4 Evidence(AIR/LRI/Leader) surface 측정 CLOSED + INTEGRITY_EVIDENCE_INTENT.md 고정**

#3 Evidence surface 측정 + #4 mount trace (read-only). live Evidence surfaces = **락§2 UPHELD** (AIR=band-only / LRI raw=admin-gated requireAdminEmail / Leader=role-assignment status), 위반 A/B/C/D 전부 N. **IntegrityScoreCardWidget = MOUNT 0**(player route reverse-unreachable 증명 — 유일 importer WeeklyReportCard 가 orphan in-degree 0; dynamic/lazy/barrel 0), **LeadershipEngineWidget = MOUNT 0**(importer 0). 두 위젯 = compute/exists only, player surface 0.
- fact 고정 + 조건부 가드: `docs/INTEGRITY_EVIDENCE_INTENT.md` (49L, time-scoped, BTY_AVATAR_IDENTITY_LOCK §2 종속). **조건부 가드**: IntegrityScoreCard 표시(grade letter A–D + composite delta ±N.N)는 graded-score 형태로 §2 "구축 단정" 경계 근접 → 미래 player mount 시 §2 band화/disclosure-scope 가드 선결, grade+delta 그대로 노출 금지.
- 3층 경계 분리 유지(Identity=Code / State=Pattern Sig / Evidence=AIR·LRI·Leader). 현재 dead = 의도된 비노출(영구 금지 아님). 코드/surface/runtime 변경 0 · 락/canon 무수정. Commit: 285886a (doc 단독, +49; outer origin/main f0bf7ee..285886a pushed).

**2026-06-15 · #2 Archetype/State surface 측정 CLOSED + ARCHETYPE_SURFACE_INTENT.md 고정**

#2 read-only inventory 결과 = **위반 0 · gap 1**. State surface(PATTERN SIGNATURES / Leader)는 위반 A/B/C 전부 clean(관찰·상태·준비도 어조, Code-정체성 미주입, 단일 소스). Archetype rollup(7 STILLWATER) = **live surface 0** (resolveArchetypeForUser 계산+naming-lock persist 만, 렌더 0; /api/bty/archetype DEAD=의도). FLAG-A = Code stage(1/7, coreXp) ≠ Leadership stage(1–4, AIR/TII) 의도된 분리, source 분리 확인.
- fact 고정: `docs/ARCHETYPE_SURFACE_INTENT.md` (43L, time-scoped, BTY_AVATAR_IDENTITY_LOCK 종속) — Pattern Signatures=Canonical State Surface · Archetype Rollup=Compute/Persist Only · Dead Transport=Intended · Identity≠State 3층(Code/Pattern Signatures/AIR·LRI) · Non-goal("Archetype Rollup is NOT a missing feature; absence intentional").
- 신설 판정(측정 결론): pattern-level 의도 → PATTERN SIGNATURES 충분, #2 surface 신설 불요; archetype-rollup 표시 의도면 net-new(위반-B 가드 선결). 측정은 gap 만 확정, 의도 미결정.
- 코드/surface/runtime 변경 0 · 락/canon 무수정. Commit: a70ba21 (doc 단독, +43; outer origin/main 4eb1363..a70ba21 pushed).

**2026-06-15 · #1 F10 override reconciliation — My-Page Identity 슬롯 = Code (FORGE), not Archetype**

My-Page "Leadership Identity" 슬롯이 Archetype 계열(override `archetypeName` / fallback `QUIETFLAME`)을 렌더하던 live 위반을 해소. BTY_AVATAR_IDENTITY_LOCK §1 (Identity Anchor=Code) 시행. mutation = `getMyPageIdentityState.ts` 단독(Opt A, computeLeadershipState 본체·DEFAULT_CODE_NAME 상수 무수정).
- **Identity 슬롯 = Code (FORGE-series), single source = `arena_profiles.code_index`** (/api/arena/core-xp 와 동일 진실원; `code_index ?? codeIndexFromTier(tierFromCoreXp(coreXp))` → `CODE_NAMES[clamp]`). Profile==Dashboard==My-Page 교차정합 확인.
- E1 override 분기 제거 · E2 Code 산출+prop 전달 · E3 prop 항상 set → `QUIETFLAME` DEFAULT 도달 불가.
- **Archetype(State) 보존**: `resolveArchetypeForUser` 호출 유지(계산+naming-lock persistence) — Archetype 표시 surface 는 #2/#4 후행.
- **RISK-R1a**: `DEFAULT_CODE_NAME="QUIETFLAME"` 상수 잔존(computeLeadershipState.ts:7) — unreachable·non-live, 후행 정리 backlog.
- **FLAG-A**: Code stage(1/7) ≠ Leadership stage(3/4) = 의도된 분리(별개 축), 위반 아님.
- R1 report: 두 개의 7 분리 ENFORCED(live 위반 0). R2 report: STAT substrate UNTOUCHED(surfacing-only). 정적 게이트 PASS(tsc 0 / terminology 13·신규0 / vitest 8/8).
- 3-way PASS: deploy Version `146dccd7-e6c9-4cab-93e1-dffc275590dd`(staging bty-arena-staging) · git HEAD `b58f747` · live "FORGE" @ /my-page.
- Commit: b58f747 (단독 파일, +17/−8; outer origin/main d2a648f..b58f747 pushed)

**2026-06-15 · BTY_AVATAR_IDENTITY_LOCK.md materialized (governance lock, Identity≠State)**

Avatar/Archetype 거버넌스 락을 outer docs/에 고정(create-only, semantic lock only — 코드/데이터/배포 mutation 아님). RISK-1 트랙 결정분; baseline outer 0096f8c (BTY_AXIS_CANON v1.2 ARCHETYPE BASELINE 상속).
- 경로: docs/BTY_AVATAR_IDENTITY_LOCK.md (+63); 구조 §0 Provenance / §1 LOCK(3문장)+Commander Meaning(verbatim 8줄, blockquote) / §2 Evidence Layer=AIR·LRI(role-assignment only) / §3 Effects on prior risks / §4 OPEN / §5 Time-scoped honesty
- LOCK 3: Identity Anchor=Code(avatar=Code progression) · State Layer=Archetype(non-identity, axis-derived, recompute) · Identity≠State
- §3: persistence NOT PROVEN → load-bearing 해제(Archetype=State, pin 불요); OBS-1(10/12, ownership·time 미커버) → avatar 무관화, 잔존은 archetype surface만 상속
- §4 OPEN(→#3 Avatar Mapping Track): F10 override reconciliation(현재 archetypeName→codeNameOverride→computeLeadershipState Code-name slot, getMyPageIdentityState.ts:89-95) · dashboard surface · code-name display residency · AIR/LRI presentation 위치 · Profile Surface alignment · Future Narrative/Scenario Copy alignment
- STEP 0 4/4 PASS(HEAD=0096f8c, 파일 부재, F10 byte 일치, target-isolation); VERIFY 4/4 PASS(단독 파일, HEAD 한 칸 전진, 구조 일치, verbatim 마지막 줄 1 hit); 3-way freshness 일치
- #3 미개시(이 락은 #3 선행물); 의미 본문 Commander verbatim, 재해석 0
- Commit: d0ec17c (단일 파일, +63; outer origin/main 0096f8c..d0ec17c pushed)

**2026-06-14 · BTY_AXIS_CANON.md v1.0 materialized (12 axis meaning canon)**

Layer 1 12축(AxisVector)의 의미 Canon을 outer docs/에 고정(transcription-only, Commander-approved body verbatim). 이미 잠긴 substrate를 설명할 뿐 생성하지 않음 — 코드/데이터/배포 mutation 아님, outer docs/ 전용 단일 파일.
- 경로: docs/BTY_AXIS_CANON.md (+285); 구조 §0 Provenance / §1 Substrate Declaration / §2 Honesty Block(§2.1–§2.4) / §3 Per-Axis Canon(12축) / §4 Parking(§4-P1)
- 축 구성: pattern-derived 10 + metric-derived 2(courage ← emotionalRegulation, identity ← TII) = 12; 8 strong + 2 weak(visibility·control) + 2 none(pattern)
- canonical-5 ⊆ trigger-10 (action-contract 영속 자격 부분집합; 영속 ≠ fingerprint firing); 현재 구현 ≠ 영구 정의, Canon > 구현
- Inherits: BTY_CHARACTER_AXIS_GOVERNANCE_LOCK.md §3.4 · BTY_PATTERN_FAMILY_AXISVECTOR_COVERAGE_LOCK.md
- STEP 0-b 실측 = α (Coverage Lock §D = pattern-10-then-metric-2 그룹핑, 세 문서 순서 정합, §4-P2 불요); Gate 1-7 PASS (G3 expected 17 정정 = §2.x 4 + 축 12 + §4-P1 1), byte-identical
- Canon commit: 344f8a3 (단일 파일, +285)
- Commit: <this outer> (push 전 placeholder, 미backfill)

**2026-06-14 · BTY_PATTERN_FAMILY_AXISVECTOR_COVERAGE_LOCK.md v1.0 materialized (DOC-ONLY)**

pattern_family → normalizePatternFamilyId → AxisVector(12) 커버리지를 outer docs/에 고정(transcription-only, Commander-approved body verbatim). 코드/데이터/fingerprint mutation 아님 — outer docs/ 전용 단일 파일.
- 111 distinct = 69 claimed + 42 unclaimed (Group A 26 keep-unclaimed / Group B 12 keep-unclaimed / Group C 4 retire-canonical-only); 전부 doc-only
- NEW CLAIM = 0 · NEW ALIAS = 0 · CODE IMPACT = 0 · FINGERPRINT IMPACT = 0 (pattern-family.ts·PATTERN_FAMILY_ALIAS·buildFingerprintInput·scenario data 무접촉); retire ≠ 런타임 삭제/데이터 마이그레이션/코드 제거
- 근거: STEP 0C/0D read-only 인벤토리(HEAD cdf028ff); §C verdict = Commander Phase 2; STEP 0D는 신규 축 미발견 — 기존 69-claimed 경계 유지 확인
- Governance parent: BTY_CHARACTER_AXIS_GOVERNANCE_LOCK.md v1.0 (b6c72bd)
- Gate 1-9 PASS; byte-identical(cmp exit 0); 단일 파일 materialize
- Commit: <this outer> (push 전 placeholder, 미backfill)

**2026-06-14 · BTY_CHARACTER_AXIS_GOVERNANCE_LOCK.md v1.0 materialized (Avatar ≠ Axis ≠ Axis Actor lock)**

Character/Axis 아키텍처 3-레이어 분리 거버넌스를 outer docs/에 고정(transcription-only, Commander-approved body verbatim). 코드/배포 mutation 아님 — outer docs/ 전용 단일 파일.
- Locks: LOCK-1/2/3 + LOCK-D-FIELD 고정; AxisVector(12) = Layer 1 substrate; live path = pattern_family → normalizePatternFamilyId → AxisVector; legacy `axis` non-canonical(삭제/부활 out of scope)
- 근거: STEP 0 / 0B / 0C read-only 인벤토리(HEAD cdf028ff); 69 CLAIMED / 42 UNCLAIMED, 5-vs-10 canonical split, courage/identity 비-pattern 파생
- Downstream(미락, 순서만): coverage table → unclaimed-42 decision → Canon body(Commander authorship)
- Gate 1-8 PASS; byte-identical(cmp exit 0); 단일 파일 materialize
- Commit: <this outer> (push 전 placeholder, 미backfill)

**2026-06-14 · RANKING-#7a Live-ranking XP 클리핑 fix (LeaderboardRow.tsx)**

live-ranking 사이드바 우측 XP 그룹 미표시 버그 해소. 긴 이름이 행을 카드 overflow:hidden 밖으로 밀어 XP 은닉 → flexbox-truncation 4링크 폐쇄(외곽 행/좌측 그룹 minWidth:0, 이름 라인 ellipsis, XP flexShrink:0). UI-render-only.
- Deploy: Worker bty-arena-staging Version 1dada5f6, 3-way PASS, Incognito 육안 XP 복구 확인
- Verify: tsc 0 / lint:terminology 13(+0) / XP·순위·시즌 로직 무접촉
- Commit: inner-main cdf028ff(단일 파일), push HOLD
- 교훈: flex:1 inert 기각 / 외곽 행 minWidth:0 실제 필요(관찰이 추론 정정)

**2026-06-13 · BTY Canon Sync Rule v1.0 LOCK (docs/BTY_CANON_SYNC_RULE.md 생성)**

KO Canon(BTY_CANON.md) ↔ EN Edition(BTY_CANON.en.md) edition-sync 거버넌스를 독립 문서로 고정. EN 헤더·ledger에 흩어져 있던 "KO 우선" 규칙을 트리거·상태·해소순서·개정규칙까지 명문화. 코드/배포 mutation 아님 — outer docs/ 전용. 본 엔트리는 문서 Amendment Rule("explicit ledger entry" 요구) 충족분.
- 경로: docs/BTY_CANON_SYNC_RULE.md (6 섹션: Scope/Authority/Sync Trigger/Sync States/Resolution Order/Amendment Rule)
- 직교 명시: edition-sync(KO↔EN)만 관할, repository-sync(outer↔inner)는 HK8_OUTER_INNER_SYNC_POLICY_CLOSURE.md 유지 — 혼동 차단
- 상태 모델: SYNCED / STALE(=sync debt, not authority conflict) / DIVERGED(→KO interpretation governs→EN 정정→SYNCED); Only KO may declare EN stale
- actor: Commander initiates review / Claude Code executes approved mutations
- 경계: "may define canon synchronization, may not redefine canon authority" — 권위 재정의 금지 자기제약

**2026-06-13 · BTY Canon English Edition LOCK (docs/BTY_CANON.en.md 생성)**

KO Canon(BTY_CANON.md, 140ce35)의 영어판을 Canonical Edition으로 저작·고정. 번역이 아니라 영어권 독자가 동일 무게로 읽도록 재저작 — Q1~Q5 섹션별 Lock(Commander 문장 단위 판정). KO = Canonical Authority, EN = Canonical Edition; 충돌 시 KO 우선(헤더 명시). 코드/배포 mutation 아님 — outer docs/ 전용.
- 경로: docs/BTY_CANON.en.md (KO와 동일 베이스 + .en locale suffix)
- 권위: EN 헤더에 "Korean edition governs on divergence" 박음 → dual-canon 방지, EN stale = sync debt only
- 핵심 발명 문장: "The more power they hold, the smaller they make themselves." (KO "권력이 커질수록 자신이 작아지는 사람" — 능동태로 약함 오독 차단, power=weight 철학은 "Power is weight, not privilege."로 흡수)
- 용어 LOCK 정합: change in choice ≠ behavior change / confirmed(Q3) vs verified(QR) vs measure(AIR) 영역 분리
- 후속(별도 트랙): KO 수정 시 EN sync 규칙 / MASTER_PLAN·ENGINE_BRIEF 포인터 reconcile

**2026-06-13 · BTY Canon v1.1 LOCK (docs/BTY_CANON.md 생성)**

조직 정체성 정본(Identity Layer)을 단일 문서로 고정. Source Map 4묶음(Constitution·코어밸류·Behavioral Spec v1·측정지표들 + Integrity Engine/Architecture PDF) 출처 검증 후, 5 Question 구조로 KO 단일 정본 저작. 코드/배포 mutation 아님 — outer docs/ 전용.
- 경로: docs/BTY_CANON.md (영구 주소, 버전은 파일 내부 헤더 관리)
- 권위 모델: Option A (Identity Apex + Authority Map) — 5개 기존 권위문서와 계층 분리, supersede 아닌 좌표 선언
- 충돌 해소(lock): 루프=7-Step / Integrity=실행-under-pressure 主 / Definition·Ideal 계층분리 / "Better Than Yourself" 폐기
- 후속(별도 트랙): MASTER_PLAN·ENGINE_BRIEF 포인터 (이번 범위 밖)

**2026-06-13 · 28-Day 레슨/허브 표시 레이어 + nav 크래시 수정 (live 29cf5f27 / 95a74134 / fd5d789d / ae43c973 / bace9183)**

베타 테스터 피드백("레슨이 한눈에 안 들어옴" + "Awakening 미완료 에러")에서 출발한 28-day 훈련 표시 레이어 5-increment 묶음. 레슨 섹션 헤더 위계(C1 간격 + C2 SVG 아이콘), /train/28days 허브 카피 i18n화(C-EXT), 그리고 "Awakening 에러" 신고의 실제 원인 격리·수정(#8b nav 크래시 + 패딩). 전부 표시 레이어/네비게이션, 엔진·데이터·스키마 무접촉. C1/C2는 직전 세션 라이브였으나 ledger 미정정분으로 본 엔트리에 함께 기록.

- **C1 — 섹션 헤더 간격** (inner 3b22e6e9 → live 29cf5f27): day/[day]/page.client.tsx에서 raw 본문을 라벨 경계로 파싱(parseLessonSections), 헤더 div marginTop/Bottom(24/8). 7개 섹션 라벨(아침 의식/핵심 실천/왜 효과/예상 저항/돌파 전략/저녁 성찰/작은 승리).
- **C2 — 섹션 헤더 아이콘** (inner 95d89178 → live 95a74134): SectionIcon 인라인 SVG 7종(currentColor, 16px, viewBox 0 0 24 24), label switch. 외부 아이콘 라이브러리 없음.
- **C-EXT — 허브 카피 i18n** (inner 0046b9c3 → live fd5d789d): /train/28days 스텁의 하드코딩 한글-반말 3카피 → 기존 t.title + journeyStart* 키 재사용(EN 분기 + 해요체). EN 로케일 한글 누출 + 톤 불일치 해소. 신규 키 0.
- **#8b — nav 크래시(#310)** (inner 320161ec → live ae43c973): "Day 1 시작하기" href를 /train/28days/day/1 → /train/day/1 직행화. 원 신고("Awakening 미완료 에러")는 재분류 — 실제는 2-hop redirect 전이 중 React #310(hook-tree 불일치). awakening/progress-null 무관. /train/day/1 직접 진입 정상 cross-check로 확정. redirect 스텁 inbound 0 무해 잔존.
- **pad — 좌측 정렬** (inner f47d4039 → live bace9183): /train/28days main에 p-6 추가(형제 train/start 패턴 일치). 콘텐츠 좌우 여백 확보.
- **gate**: 전 increment tsc --noEmit 0 / lint:terminology 13 불변.
- **push**: inner-main → origin/inner-main (== f47d4039), origin main 비접촉.
- **deploy**: 각 rm -rf .open-next && cf:build → 3-way freshness(Version active 100% / HEAD / 28days chunk byte-identity). staging Version-line: … → fd5d789d → ae43c973 → bace9183 누적.
- **outer mirror**: bty-app/ 미러 비스테이징, 본 ledger = outer docs-only.
- **outer ledger commit**: <this outer>.

**결산: 28-day 표시 레이어 5종 라이브, #8(awakening 에러 신고) RESOLVED — 카피(C-EXT) + nav 크래시(#8b) 분해·해소. C1/C2 ledger 정정 동시 완료.**

**2026-06-13 · A1b — Arena action form 모바일 visibilitychange 언마운트 cause-layer fix (live 7891c17e)**

STAB-A1(effect-layer, sessionStorage 복원)의 cause-layer 후속. cause = syncSessionGate가 focus/visibility/storage resync 시 `setPendingActionContract(null)`을 무가드 실행 → 부모(`ArenaResolveClient.tsx`) 조건부 언마운트 → 모바일 앱전환(visibilitychange)마다 폼 소실. fix = 폼 dirty(non-empty draft) 동안 게이트 **전체** early-return → 폼 유지; sessionStorage는 단독 회복 경로의 백스톱으로 강등.

- **메커니즘**: draft 헬퍼를 `actionDraft.ts` 공유 모듈로 verbatim 추출(behavior drift 0, 단일 소비자) + `hasNonEmptyActionDraft`(필드 content 검사 — draft useEffect가 빈 폼도 키를 쓰므로 "키 존재 ≠ dirty" 함정 회피). 가드 = `useArenaSession.ts` syncSessionGate 최상단 `if (pendingActionContract && hasNonEmptyActionDraft(id)) return;` (null화만 skip 시 nonce++/refetch가 contract를 재churn → 게이트 전체 early-return). 3파일(actionDraft.ts 신규 + form 헬퍼 이전 + hook import/가드).
- **tradeoff #4 (수용)**: cross-tab QR 완료(storage 이벤트)가 타 탭 입력 중 skip — 제출/clear 후 다음 게이트에서 resync. 신규 파일 헤더 + 가드 주석 + commit message 3곳 명시.
- **gate**: tsc --noEmit exit 0 / lint:terminology 13 (baseline, A1b 신규 0; clean build 전·후 불변).
- **push**: inner-main only, `origin/inner-main` == `647ee8b8` (origin main 비접촉).
- **deploy**: DEPLOYED @ Version `7891c17e-fa22-4382-be40-f5ef6bda4040` (2026-06-13T11:28Z, active 100%; 이전 live `cfc79c43` → `7891c17e`). 3-way 확정: (a) cf:deploy UUID == versions list tail 최신 == deployments active 100%. (b) git HEAD `647ee8b8`. (c) live chunk `1220-fead90ed93006988.js` (HTTP 200, 107,452 B, SHA256 `b930cbb2ab1848c5c47ee7a5b039f3e759a6e6940a5f050fc5fe62918d81dd68`) = 로컬 .open-next 빌드와 byte-identical, `bty-arena-action-draft:` 리터럴 count=1. clean build(rm -rf .open-next → cf:build, deploy-only 아님 — stale 번들 footgun 회피). (BTY_DEPLOY_VERSION stale 2026-04-27이라 cf:deploy UUID가 정본.)
- **outer mirror**: ledger-only. inner `47140f41` → `647ee8b8` 전진으로 bty-app/ 미러 drift 13건 = 영구 non-canonical 수용(inode 12580789 공유 footgun 원칙대로 outer는 비접촉, stash@{0} NEVER POP 불변). 본 항목 = outer ledger `<this outer>`.

**2026-06-12 · STAB-A1 — Validate-action 폼소실 fix (merge-landed, deploy-pending)**

탭 전환 시 Validate action 폼(Who/What/Result) 입력 소실. root = useState-only draft + syncSessionGate의 visibility resync가 contract를 null화 → 부모 조건부 언마운트. fix = sessionStorage draft 미러링(`ArenaActionValidationForm.tsx`, +46/-3). STEP 0b로 C2/C3 전제(동일 unresolved → 동일 contractId) 확정: `ensureActionContractWithAdmin` lookup-first 멱등(user_id+session_id, status 무관), resync 409가 동일 pending 행 반환 → 동일 sessionStorage key 복원.

- **merge**: `fix/form-persist` → `inner-main` --no-ff @ `47140f41cc42e3eb9d1c21c2c6858250e684518d` (부모 `7234abdc` + `eb85302`)
- **gate**: tsc --noEmit exit 0 / lint:terminology 13 (baseline, A1 신규 0)
- **push**: inner-main only, `origin/inner-main` == `47140f41`
- **deploy**: DEPLOYED @ Version `cfc79c43-7cc3-4a14-b6e1-be4080ab1d40` (2026-06-13T05:25Z, active 100%). 3-way 확정: (a) cf:deploy UUID 신규 == versions list tail 최신. (b) git HEAD `47140f41`. (c) live chunk `1220-8394ad095ee3977b.js` (HTTP 200, 107,187 B, SHA256 `04a4d9e625d43c46facca521f2f36bb517cf06a78007205e86b3102eaec37edb`) = 로컬 .open-next 빌드와 `cmp` IDENTICAL, `bty-arena-action-draft:` 리터럴 count=1. worker.js mtime ≥ commit epoch (UTC/PDT 정합: deploy 05:25Z == local 22:25 PDT ≈ worker.js mtime). (BTY_DEPLOY_VERSION stale 2026-04-27이라 cf:deploy UUID가 정본.)
- **outer mirror**: ledger-only 확정 (메모리 #15 정합 — bty-app/ 미러 = 영구 non-canonical noise, canonical = inner `47140f41`). ⚠️ FOOTGUN: inner와 outer가 동일 물리파일 공유(inode 12580789, 양 repo 추적). outer의 stash pop/apply/checkout = inner working tree 직격 오염(2026-06-12 PHASE 1 near-miss 원인). stash@{0}(inner@47140f41 미러분, A1 포함)는 **NEVER POP/APPLY/DROP — 영구 보존**. mirror drift는 동기화하지 않고 non-canonical로 수용. inner working tree를 47140f41에서 벗어나게 하는 outer mutation 금지.
- **A1b dirty 가드**: cause-layer 후속 티켓 분리 (syncSessionGate 입력 중 무가드 null화 자체는 불변; eb85302는 effect-layer 회복 보정)
- **canonical 정정**: outer mutation authority = M5(`/Users/hanbit/Dev/btytrainingcenter`)로 통일. MacBook Air / `btytrainingcenter-OUTER`는 더 이상 outer mutation authority 아님.

**2026-06-12 · QR-only Witness Hotfix — secure-link UI 제거 + QR 증인 안내 (live d358b520)**

inner-main 7234abd → live Version d358b520 (3-way PASS + i18n 청크 byte-identical). pure 7234abd 빌드(A1-free).
- **UI-only**: ActionContractHub/MyPageLeadershipConsole에서 secure-link 버튼·state(`secureLinkUrl`)·handler(`handleRequestSecureLink`) 제거 — route(`/api/arena/action-contract/secure-link`)·shared token 모듈(`signArenaActionLoopToken`) **무접촉**. ActionLoopQrPanel에 `qrWitnessNotice`(ko/en, `whitespace-pre-line` 3문장) 추가. `btnQr` "Complete by QR"→"Show QR for verification". dead i18n(`btnLink`/`completeByQrLink`, 사용처 0) prune.
- **DB·백엔드 무변경**: `verification_mode`('hybrid' 유지; mode CHECK는 'qr','link','hybrid' 허용)·`verification_type`('action_completed' 분류)·migration·mint/validate 경로 전부 무접촉.
- **진단(root cause)**: 이용자 "Can't Complete" = **시스템 정상, UX 안내 갭**. 라이브 실측: validation_approved_at 채워짐 + run owner==contract owner(ee9d2075) + deadline 미래 + mint 토큰 payload 정합 + 해당 유저 과거 QR 완료 7회 verified=true → 파이프라인 end-to-end 정상. 막힘 실체 = QR이 "본인 완료 화면"으로 오독되나 실제론 **증인 스캔 검증**(Actor≠Approver, self-completion 미지원). validate는 URL-open(스캔) 구동, le_verification_log 실패 row 0.
- **A1 lane 분리 격리**: form-persist(syncSessionGate focus/visibility resync 폼소실 복원, sessionStorage 미러)는 `fix/form-persist @ eb85302`로 격리됐고, 본 QR-hotfix 배포는 A1-free 빌드였음. 이후 inner-main 머지 완료(`47140f41`, --no-ff) — closure는 최상단 STAB-A1 entry 참조.
- **held C2-2/C2-3 무접촉**: reflection 기능(TrainDayReflectionSet/day-reflection/reflection-questions)은 a42956b부터 이미 live, 본 hotfix 무영향(diff 0).
- **3-way**: a) Version `d358b520` (wrangler tail) / b) HEAD `7234abd` (provenance) / c) live chunk `7618-0d7e4fa62a784aa6.js`에서 secure-link 리터럴 4종(btnLink/completeByQrLink/"Complete by secure link"/"보안 링크로 완료") **0건** + positive "Show QR for verification" 1건; i18n 청크 disk==live byte-identical. cf:deploy=upload-only(cf:build 미재실행, worktree clean drift-guard). **GATE**: tsc exit 0 / lint:terminology 13(baseline, 신규 0). inner-main `7234abd`(pushed) + outer ledger `<this outer>`.

**2026-06-12 · Action Contract Reminder v1 — D5 트리거 와이어링 완료 (가동)**

in-app reminder 파이프라인 5면 전부 닫힘. 리마인더 hourly 실가동 시작.
채널 = **in-app only** (user_notifications + NotificationBell). 앱 다운로드/전화번호 불요 — 접속 유저 대상. SMS/PWA/네이티브 push는 미착수 별도 트랙.

- 소스: inner-main 5111fa5 (route singular src/app/api/cron/action-contract-reminder, status=pending only, claim-then-notify at-most-once).
- 배포: prod worker Version 6c01a10e (GET 405 + 401 가드 검증; route 실립 확정).
- DB: migration 20260612000000 last_reminder_sent_at — 라이브 ALTER(Commander SQL Editor) + schema_migrations repair insert 완료.
- 트리거: OUTER main c5b13763, .github/workflows/action-contract-reminder-cron.yml — active (gh id 295012016), hourly "0 * * * *" + workflow_dispatch. escalation 템플릿 복제(URL path singular만 교체, schedule/secret/가드 byte-parity).
- **잔여 미검증 1건:** CRON_SECRET 정합 = 첫 정각 스케줄 자연 실행에서 확정 예정. 200=정합(T-6h 매칭자 실발송), 401=repo Secret 불일치(Actions 로그 식별). repo Secrets DEPLOY_URL/CRON_SECRET = escalation 공용(설정 개연 높음, 미설정 시 exit 1 안전실패).

**v1 종료. 채널 확장(SMS phone 캡처+TCPA / PWA / 네이티브 push 스토어 심사)은 AIR 효과 확인 후 별도 워크스트림 판단.**

**2026-06-12 · Action Contract Reminder v1 (inner 5111fa5)**

T-6h pending nudge 커밋. canonical 소스 = inner-main @ 5111fa5.
outer bty-app/ source mirror = **N/A** (inner-main canonical, outer bty-app/ divergent 카피 — 자동전파 메커니즘 부재 확인). outer 산출물 = 본 ledger only.

- **status = pending only** (submitted 회수 — D1 scope drift 정정; submitted actor는 approver 대기라 "complete" nudge 부적합).
- **claim-then-notify (at-most-once)** — 중복 알림 방지 우선. 알림 실패 시 silent-drop 가능(의도), v2 reminder_attempts/log로 at-least-once 보완 예정.
- route 경로 **singular**: src/app/api/cron/action-contract-reminder. (plural 디스패치 라벨 드리프트 있었으나 아티팩트 singular = authority.)
- notification type = action_contract_reminder. user_notifications body 컬럼 부재 → title_ko/en 단독 운반.
- migration 20260612000000_bty_action_contracts_last_reminder_sent_at: 라이브 ALTER = Commander SQL Editor 직접 실행 + schema_migrations repair insert 완료. db push 미사용.
- 게이트: npm run lint (tsc --noEmit) exit 0 / lint:terminology 13 (≤13 baseline, 변경분 0).
- 4파일: migration(NEW) / cron route singular(NEW) / notification-router.service(mod) / NotificationBell(mod, tsc-forced exhaustive Record).

**미해결 — D5 트리거 와이어링:** .github/workflows reminder 워크플로 부재 → route 배포돼도 스케줄러 미호출 = 영구 미발화. STEP 2 별도: OUTER .github/workflows 확인 → reminder 워크플로 신설(singular URL, hourly 0 * * * *, CRON_SECRET 헤더 = escalation-cron.yml 템플릿).

**[2026-06-12] C2-3-Done-Vacuous — Train Day Reflection History branching 이미 구현·배포, code 0 mutation.** read-only reality inventory(STEP0/0b)로 C2-3 충족 확정. History branching=완료(center/letters/LettersClient.tsx: type union :18 day_reflection, 분기 :186 isReflection, render :222/:236-253; backing domain/center/letter.ts + dayReflectionService.ts). 4 pending confirmations 전부 코드 해소: Q label+answer(:236-243 map qa.q+qa.a) / Final emphasis(:245-253 divider+heading+font-medium, finalReflection||body) / 빈답변 filter(:188 qa.a.trim().length>0) / title(:222-224 responses?.title). stub 없음, bilingual 완비. ⚠️ 메모리 drift 정정 3건: (1) 렌더 위치 page.client L331→실제 L391(TrainDayReflectionSet, import :7, 단일 train page). (2) deploy-held=거짓 — C2-2/C2-3 이미 배포(HEAD 6a2ce4e==origin/inner-main 당시, held 없음). (3) branching 위치=Center letters History(center/letters/LettersClient.tsx), 메모리 미특정. 교훈(B1 동형): 결론 DONE 맞으나 메모리 좌표 부정확, 코드가 진실. 산출: inner-main 4831a62 IA_CANONICAL_REALITY.md C2-3 섹션 append(drift 정정 durable). GATE: docs-only, tsc N/A, src CLEAN. BACKLOG: TrainDayCapture.tsx orphan prune(5축 검증 ref 0, render swap L391) — 별도 source mutation / legacy type:'reflection' DB rows 무해(History 양쪽 처리, 정리 불요).

**[2026-06-12] B1-Decision2-Vacuous — IA Decision 2(Center display) 이미 구현, code 0 mutation.** read-only inventory(STEP0/0b/0c)로 Decision 2 충족 확정. Unified Current State card(CenterPageClient.tsx:566–573)가 두 half live-compose: Stage half=StageContextCard(inline 정의 :41, live stage 데이터 useState:454+fetch:490, stageName 실표시+stage-3 nudge, forced-reset gating:524 구동=load-bearing, stub 아님) + Healing half=HealingPhaseTracker(embedded compact :573, 4-stage, IA-CENTER-FINAL). Train primary CTA=충족(B1-2=(b) 시각1순위 해석: first-position :558 + 유일 filled CTA bg-dear-sage; assessment/letters=outline chip 하위 weight, 단 전부 존치=load-bearing surface 보호). ⚠️ 근거 정정: B1-1 초기 "Arena Stage=phantom→DROP" 근거 오류(결론만 맞음). 실제 stage 존재(StageContextCard), STEP0 "NONE"=wrong-name grep miss(inline 정의라 git ls-files grep 놓침). 정확판정="이미 구현되어 신규작업 불요"(NOT 부재). B3 growth/journey(실제 부재)와 구별 — 교훈: 이름추정 단일 grep NONE≠부재. DO NOT TOUCH 준수: src 무변경, load-bearing surfaces(assessment/letters/reflection) 보호. 산출: inner-main 6a2ce4e IA_CANONICAL_REALITY.md B1/D2 섹션 append(근거정정 durable 기록). GATE: docs-only, tsc N/A, src CLEAN. BACKLOG: explicit Train hero / Current State double-shell de-nest(:567 outer + :45 inner 동일 shell 중첩) — optional polish, IA 요구 아님, parked.

**[2026-06-12] B3-IA-Phantom-Cleanup — removal lane → doc-correction rebase. D1/D4 phantom 판정·supersede, production code 0 mutation.** STEP0-R read-only inventory가 IA_RESTRUCTURE_PLAN D1/D4를 wrong-tree(decoy bty-website/bty-app, bty/journey/page.tsx)로 확정: canonical inner-main에 growth/journey PAGE 부재(journey=API-only api/journey/bounce-back, 유일 caller Comeback.tsx:20, "4 entries"=0), growth HUB page 부재. D4 "growth 삭제"는 DESTRUCTIVE — features/growth=공유 LOAD-BEARING infra(Center+My Page+identity+letterService 의존, buildReflectionSeed.ts:1 자체 경고), 불가침 확정. redirect alias 실재 1개(integrity→/bty)뿐. reflection board→Center 이미 완료(getLatestReflectionSeed import @ CenterPageClient.tsx:13, 호출 :511)=no-op. Comeback=전역 re-engagement modal(time-based, layout.tsx:32, 전 route), journey 잔재 아님 → PARKED, KEEP. DO NOT TOUCH 준수: src 무변경, __LOCAL_DO_NOT_EDIT 무접촉, Comeback/features/growth/api 무제거. 산출: inner-main GROWTH stale banner + 신규 docs/IA_CANONICAL_REALITY.md (inner 1f11b81), outer IA_RESTRUCTURE_PLAN supersede banner + GROWTH-dup stale banner(divergence 해소, outer fa685762). GATE: docs-only, tsc N/A, src CLEAN 입증. inner 1f11b81(inner-main only) + outer fa685762(origin main). 양 브랜치 synced(pushed).

**[2026-06-12] OUTER-RECOVERY — editable outer checkout 확보. B1/B2/ledger flow 차단 해소.** B3 종료 후 발견: 이 머신 유일 outer checkout이 __LOCAL_DO_NOT_EDIT(frozen, human-label; git상 clean+origin/main 0/0 synced)라 outer mutation·ledger prepend·co-track mirror 전면 차단. 진단(read-only STEP0): 4-tree 실측 — DO_NOT_EDIT(main 91cb18d, frozen) / INNER(inner-main) / bty-website-clean(main 806d099, 784 behind·0 ahead·dirty 54 files) / remote healthy(SSH). 복구: (1) bty-website-clean 35→54 files dirty WIP(admin/quality/NextAuth/bty-bot/teams-bot/journey)=머신 최고 at-risk 자산 → wip/clean-rescue-20260612 @ bdd2ced9 local 보존(push 금지, https auth 미검증), 누락 0. (2) fresh clone git@github.com:dentistchi/bty-website.git → /Users/hanbit/Dev/btytrainingcenter-OUTER, main @ 91cb18d, HEAD==origin/main hard-assert, dirty 0, ledger docs present. 검증: outer mutation flow 실사용 복구(B3 carry-forward fa685762 commit+push origin main 성공). PUSH 경계 LOCK: OUTER→origin main 정규 / INNER→inner-main only(~100 ahead, main push 금지 footgun) / clean wip→push park / DO_NOT_EDIT·decoy→영구 forbidden. BACKLOG: [a] Comeback+api/journey/bounce-back micro-decision(KEEP/route-gate/remove) [b] bty-website-clean WIP bdd2ced9 remote push(https auth 확인+대상 branch 확정 선결, 단일본 SPOF) [c] committer identity=hanbit@local(3 commit, as-is 권고, force-push rewrite 회피) [d] DO_NOT_EDIT 1 behind origin/main(의도된 frozen, refresh 선택) [e] IA_RESTRUCTURE_PLAN inner-main 부재(decoy import 안 함, IA_CANONICAL_REALITY.md로 canonical 기록).

**[2026-06-11] B2-IA-Decision3 — Second Awakening locked-view surface 정렬 (28일 훈련 안내).** ★ gate LOGIC는 별건으로 이미 구현·배포완료 — `6f20228`(결정3 REPLACE: 자격 = `train_day_completions` distinct day == 28 via `getTrainDistinctCompletedDayCount`; legacy 30day/10session = `REQUIRED_DAY`/`REQUIRED_MIN_SESSIONS` 제거). **본 커밋 = SURFACE만 정렬(logic·eligibility·API·DB 무변경).** FIX: awakening/page.client.tsx locked block(:167-182, `!data.eligible` 분기) — (1) copy: 28일 훈련 완주 요건 명시(L1) + Commander 원안 L2(`매일의 기록이 충분히 쌓이면, 다음 문이 자연스럽게 열립니다`) / (2) CTA href: `basePath`(Foundry) → `/${locale}/train/28days` / label+aria: "Foundry로" → "28일 훈련으로 가기" / (3) className: outline → filled(`bg-foundry-purple text-white hover:bg-foundry-purple-dark`, completed view :143-144 idiom 재사용, 신규 토큰 0). DO NOT TOUCH 준수: completed CTA(`href={basePath}` :141) · footer(:264) · error view · `secondAwakening.ts`/AIR gate 무변경. inline bilingual ternary(양 locale). GATE: tsc exit 0 · terminology 13 baseline(신규 0, ★copy 변경). inner inner-main `a42956b` + outer main mirror `<this outer>` (bty-app 미러 byte-동일). DEPLOYED — staging Version `c46d294b` (2026-06-11), 3-way PASS: (a) Version `c46d294b` / (b) build source `a42956b` / (c) byte-identity — live awakening chunk `page-97ffd27993b17123.js` sha `6e670d84` == 로컬빌드 IDENTICAL; CTA literals(28일 훈련으로 가기/Go to the 28-day training ×2) + `train/28days` href live, locked-view 'To Foundry' 제거 2→1 확인. inner+outer origin synced (pushed). 육안: locked view = non-eligible(<28 distinct day) 계정 한정 렌더(제약) — 3-way 코드증명으로 갈음.

**[2026-06-11] HEADER-Mobile — 헤더 trailing(EN/KO 토글 + Logout) 모바일 stack (HubTopNav arena branch).** STEP0 진단: HubTopNav 단일 flex-wrap row(:157)에 nav pills + trailing(LangSwitch+LogoutButton)가 동거 → 모바일에서 토글↔logout crowding(absolute 아님, flex reflow). FIX: arena branch trailing span(:180) className만 — `basis-full sm:basis-auto`(모바일 단독 줄 / sm: 인라인 복원, 핵심) + `justify-end` + `border-l-0 sm:border-l` + `pl-0 sm:pl-3` + `ml-0 sm:ml-1` + `mt-2 sm:mt-0`. dear branch(:239 byte-identical span, LangSwitch-only) 미접촉 — logout 없어 대상 외. 적용 범위: my-page/layout · CenterLayoutShell · ArenaLayoutShell (arena theme + trailing 3곳). `{trailing}` 본문/JSX 구조 UNCHANGED, className-only. GATE: tsc exit 0 · terminology baseline(신규 0, 문구 0). inner inner-main `d468ee5` + outer main mirror `<this outer>` (bty-app 미러 byte-동일). DEPLOYED — staging Version `7955da83` (2026-06-11), 3-way PASS: (a) Version `7955da83` / (b) build source `d468ee5` / (c) byte-identity — live shared chunk `7612-a169358b02bcb10e.js` sha `915fd972` + css `952c44920d829c43.css` == 로컬빌드 IDENTICAL; `sm:basis-auto{` 등 9개 utility 규칙 live-confirmed (basis-full mobile stack 실작동 전제 충족). inner+outer origin synced (pushed). 시각검증(~375px) 권장.

**[2026-06-11] B1-IA-Decision2 — Center Train CTA: underline link → primary filled button.** CenterPageClient.tsx TrainProgressCard :263 primary CTA "Day N 하러 가기" 단일 `<a>` className 치환 — 기존 dear-sage 토큰 기반 solid button(`bg-dear-sage text-white hover:bg-dear-sage-soft`) + focus-visible ring + `px-4 py-2.5` hit area, underline 제거. href/문구/onClick/logic UNCHANGED (display-only, frontend-design 신규 색 0). assessment CTA(:228 byte-identical className 함정) + secondary "전체 보기"(:269) 미접촉 → primary 위계 대비 확보. Scope LOCK 준수: NO fetch/state/schema/extract/prune. GATE: tsc exit 0. inner inner-main `21e75ed`(content) + outer main mirror `<this outer>` (bty-app 미러 byte-동일). DEPLOYED — staging Version `7a68136d` (2026-06-11), 3-way PASS: (a) Version `7a68136d` / (b) build source `21e75ed` / (c) byte-identity — live center chunk `page-2d93134a5effe3eb.js` sha `1e92b63d` == 로컬빌드 IDENTICAL + button literal `bg-dear-sage px-4 py-2.5` live 존재. inner+outer origin synced (pushed). assessment CTA(:228) underline 의도 보존.

**[2026-06-10] PHASE1-REFLECTION-SET — Day 2,3,5,6,7 reflection sets inserted (append-only).** reflection-questions.json: 기존 6키(1/4/12/24/25/28) byte-identical 보존, 신규 5키 말미 추가. Layer separation 검증(reflection=의미 / lesson=행동, corePractice 복제 0). Template v1 준수, RESERVED("own side"→Day24-28, "Honor/28-Day Journey"→Day28) 회피. GATE: tsc exit 0 · lint:terminology 13(baseline, 신규 위반 0). inner inner-main + outer main co-track. Deploy 완료(2026-06-11, staging Version `312359e9`, 3-way PASS — 아래 DEPLOYED entry). Backlog: next@15.5.7 advisory + 33 vuln(Infra Mode 분리).

## 2026-06-11 — [PHASE1-REFLECTION-SET] DEPLOYED — Day 2,3,5,6,7 reflection sets (콘텐츠 파일럿, append-only) — staging Version `312359e9` + 3-way PASS (byte-identity verified)
- **[DEPLOYED]** Phase-1 5키(Day 2,3,5,6,7) `reflection-questions.json` 추가분 staging 배포 완료. asset-only(코드 0) — 단일 consumer `train/day/[day]` static import 자동 인식, 스키마/API/route/LettersClient 무변경. 기존 6키(1/4/12/24/25/28) byte-identical 보존. (본 entry가 상단 banner `Deploy 미실행(별도 HALT)` 상태를 supersede; banner는 flip 처리.)
- **Push:** origin/inner-main `5614e3b9`(이미 푸시됨, HEAD==origin/inner-main) · origin/main `<this outer>`(본 ledger 커밋, 푸시 대기). **Deploy:** `rm -rf .open-next` → prebuild(check-env 0) → cf:build(0, 293/293 static pages) → cf:deploy → Worker **bty-arena-staging** Version **`312359e9-5c70-4d35-b5b5-6064e7e30eaa`** (production-effective; 단일 공유 백엔드).
- **3-way freshness PASS:** (a) active Version `312359e9` (cf:deploy 캡처) / (b) inner HEAD `5614e3b9` / (c) **live literal — byte-identity VERIFIED:** train/day chunk `page-a1803eeb0c2d86de.js` live-fetch(HTTP 200, 190,591 B) content-hash `b4c5d74e80748fd2c3781fc0b1c85ebeaa1fa43d` = `5614e3b9` 로컬빌드와 `cmp` IDENTICAL. 내부 Day5 `Begin the Day with Kindness`/`다정함으로 하루 시작하기` · Day6 `Close the Day with Care`/`하루를 다정함으로 닫기` · Day7 `Notice What's Begun to Shift`/`달라지기 시작한 것을 알아차리기` 전부 존재(en+ko).
- **커밋셋:** inner-main `5614e3b9`(content) / outer main `9ce6447`(mirror) + `<this outer>`(this DEPLOYED entry). 양 트리 reflection-questions.json sha `478a0f53` parity.
- **가드:** /api/version 미사용(stale wrangler vars `2026-04-27`) → cf:deploy UUID `312359e9`로 deploy 식별. env bake: dev-var clean(localhost/100.x/Tailscale 0). gate tsc 0 / terminology 13(전부 'try again' baseline, 신규 0) / build 0.

## 2026-06-10 — [LANE-A-1] DEPLOYED — QA Day preview gate (admin-only, fail-closed) — staging Version `caece1df` + 3-way PASS (runtime (c) verified)
- **[DEPLOYED]** A-1 admin-only QA preview(`?preview=1` + `BTY_ADMIN_EMAILS` allowlist → 잠긴 Day redirect만 skip, server RSC `train/day/[day]/page.tsx`) staging 배포 완료. **A-2/A-3 22-Day authoring gate-free QA 언락.** (본 entry가 하위 A-1 `미deploy·미push` 항목 상태를 supersede; 하위는 history로 보존.)
- **Push:** origin/inner-main `62468eba..debd1ada` (inner-main only, origin/main 미접촉) · origin/main `8ea3b31..172171d` (outer ledger). **Deploy:** `rm -rf .open-next` → prebuild(check-env 0) → cf:build(0) → cf:deploy(0, "Uploaded 1 file" = server bundle만, 클라 청크 무변경=server-only 변경 정합) → Worker **bty-arena-staging** Version **`caece1df-5d63-4d55-8970-0325585f9215`** (production-effective; 단일 공유 백엔드).
- **3-way freshness PASS:** (a) active Version `caece1df` (cf:deploy "Current Version ID" + deployments list 최신 100%) / (b) inner HEAD `debd1ada` / (c) **RUNTIME admin-preview 2-side VERIFIED:** admin(ywamer2022)+`?preview=1` on **locked Day 16** → **RENDERED**; admin **without** `?preview=1` → **REDIRECT** `/train/28days`. build-source: `handler.mjs`에 `BTY_ADMIN_EMAILS` + 유일 `preview` 분기 + `28days` redirect 존재. fail-closed 6-case 코드 입증.
- **QA verify 방법(ee9d2075):** completions 임시 삭제(day≥15)로 locked Day 16 생성 → 검증 → 스냅샷 복원(day 1-27 + completed_at 보존, Day28 미완료 유지 → Awakening 미트리거). **DB state clean 복원.**
- **A-1 커밋셋:** inner-main `debd1ada` / outer main `172171d`(this DEPLOYED entry는 outer `<this outer>`).
- **가드:** /api/version 미사용 → cf:deploy UUID. env bake check: dev-var 전부 주석 → 번들 미오염. admin allowlist: BTY_ADMIN_EMAILS 1 entry(ywamer2022 present) → preview 사용가능. gate tsc 0 / terminology 13.
- ⚠️ **carried backlog(LOW):** DRY divergence — 인라인 allowlist 정규화 vs rbac.ts `getAdminEmails`(byte-identical). 향후 export로 reconcile(rbac.ts touch authorization 필요).

## 2026-06-10 — [LANE-A-1] QA Day preview gate (admin-only, fail-closed) — COMMITTED · 미deploy·미push
- **[CLOSED]** 22-Day 콘텐츠 authoring(A-2/A-3) 시 잠긴 Day를 unlock-gate 없이 열기 위한 admin preview. `train/day/[day]/page.tsx`(서버 RSC 게이트)에 `?preview=1` + admin-email allowlist(`BTY_ADMIN_EMAILS`, **non-empty 필수**) → 잠긴 Day의 **redirect만 skip**. `train_day_completions` 무변경(read-only `.select`만), 렌더 콘텐츠 동일(day-keyed/gate-independent). searchParams prop 추가 + user.email 소문자 비교.
- 🔴 **fail-closed 6-case 입증:** admin+?preview=1+locked→렌더(의도) / non-admin+?preview=1→**REDIRECT**(critical) / no-param→REDIRECT / empty-allowlist→**REDIRECT**(critical, open-to-all 차단) / unauth→layout 로그인 리다이렉트 / 완료상태 mutation 0. 서버사이드 게이트라 브라우저서 우회 불가.
- **Infra Mode 무관:** middleware/lib-auth/rbac/authz 무접촉. **substitution:** `getAdminEmails()`가 rbac.ts에서 미export(module-private) + "no rbac edit" 제약 → page.tsx 내 동일 allowlist read 인라인(env `BTY_ADMIN_EMAILS`, 동일 split/trim/lowercase/filter). rbac.ts 무변경.
- gate tsc 0 / lint:terminology 13(+0). Inner-main `debd1ada`(1 file) + outer main 미러. **미배포·미push**(A lane mid).
- ⚠️ **BACKLOG(신규, LOW):** DRY divergence — 인라인 allowlist 정규화가 rbac.ts `getAdminEmails`와 중복(현재 byte-identical). 향후 `getAdminEmails` export로 reconcile(= rbac.ts 터치 authorization 필요).
- [visual] admin/non-admin 양쪽 ?preview=1 동작(admin=잠긴 Day 열림, non-admin=리다이렉트) = A 배포 후 Commander staging 확인. **목적: A-2/A-3 22-Day authoring gate-free QA 언락.**

## 2026-06-10 — [LANE-B-2] DEPLOYED — History day-anchor deep-link (B-2-1 consumer + B-2-2 producer) — staging Version `bdcb3154` + 3-way PASS
- **[DEPLOYED]** B-2 lane(B-2-1 consumer: `LettersClient` `?day=N` → day_reflection(item.day===N) 검색·날짜 pre-select·expand·scroll / B-2-2 producer: Train review-link href `+?day=${day}`) staging 배포 완료. **end-to-end day-anchor deep-link LIVE.** (본 entry가 하위 B-2-1/B-2-2 `미deploy·미push` 항목 상태를 supersede; 하위는 history로 보존.)
- **Push:** origin/inner-main `be63f934..62468eba` (inner-main only, origin/main 미접촉) · origin/main `ecb8157..b4bbe82` (outer ledger). **Deploy:** `rm -rf .open-next` → prebuild(check-env 0) → cf:build(0) → cf:deploy(0) → Worker **bty-arena-staging** Version **`bdcb3154-8491-454a-a127-c9033d50dd2c`** (production-effective; 단일 공유 백엔드, 별도 prod worker 부재).
- **3-way freshness PASS:** (a) active Version `bdcb3154` (cf:deploy "Current Version ID" + "Deployed triggers") / (b) inner HEAD `62468eba` / (c) live literal — train/day chunk `page-fe4d433fe9ccef53.js`(HTTP 200) 내 B-2-2 `center/letters?day=` 존재 + center/letters chunk `page-db972f7568be9a4f.js`(HTTP 200) 내 B-2-1 `letter-` id prefix 존재. content-hash fe4d433f/db972f75 = 62468eba 로컬빌드 → 라이브 서빙 일치.
- **B-2 최종 커밋셋:** B-2-1 consumer `1d4f9402`/`8f2a386` · B-2-2 producer `62468eba`/`b4bbe82`.
- **가드:** /api/version 미사용(하드코딩 stale) → cf:deploy UUID 사용. env bake check: .env.local/.env dev-var 전부 주석 → 번들 미오염. gate tsc 0 / terminology 13 baseline(B-2 파일 0).
- ⚠️ **carried backlog:** History deep-link ↔ `getLetterHistory limit=20` — 타겟이 최근 20편지보다 오래되면 graceful no-op(앵커 안 됨). LOW(현재) → 트리거 시 MED. 향후 pagination/day-targeted fetch.
- **[PENDING] 시각검증(모바일, Commander ee9d2075, auth-gated/OAuth-only):** Train→리뷰링크 `?day=N` 탭→History 해당 Day reflection 캘린더 선택+expand+scroll. **기존 day_reflection row 필요**(앵커 확인하려면 해당 Day 성찰 저장 데이터 존재). 코드 라이브는 chunk literal로 실증, 화면 렌더는 Commander 폰 확인 대기.

## 2026-06-10 — [LANE-B-2-2] Train review-link day-anchor (producer) — CLOSES B-2 — COMMITTED · 미deploy·미push(B-2 deploy dispatch 대기)
- **[CLOSED]** Train "지난 reflection 복습" 링크가 History를 해당 Day로 deep-link하도록 producer 절반 완료. `train/day/[day]/page.client.tsx` review-link href `/${locale}/center/letters` → `/${locale}/center/letters?day=${day}` (`day`=clampDay 라우트 파라미터 :138, 항상 유효 1~28 → href well-formed). :250 주석 갱신("Day-anchor jump = backlog" → deep-link 설명). 2줄(href+주석)만 변경.
- **end-to-end deep-link 완성:** producer `?day=N` ↔ consumer(B-2-1) `useSearchParams`→day_reflection(item.day===N) 검색→날짜 pre-select+expand+scroll. day_reflection 없으면 graceful no-op(정상 리스트).
- freeze: B-1 코드(① order 클래스 / ② completion 생성 effect / ③a 토글 active / ③b scroll effect) 같은 파일이나 **무접촉** · 링크 가시 텍스트 무변경 · LettersClient/API/route/service/schema/dead-component 무접촉. gate tsc 0 / lint:terminology 13(+0). Inner-main `62468eba`(1 file) + outer main 미러. **미배포·미push**.
- **B-2 lane 커밋셋(로컬, 미push):** B-2-1 consumer `1d4f9402`/`8f2a386` · B-2-2 producer `62468eba`/`<this outer>`. push+deploy = 별도 B-2 deploy dispatch.
- ⚠️ **carried backlog:** History deep-link ↔ `getLetterHistory limit=20` — 타겟이 최근 20편지보다 오래되면 no-op(앵커 안 됨). LOW(현재) → 트리거 시 MED. 향후 pagination/day-targeted fetch.
- [visual] (Commander ee9d2075, auth-gated) **PENDING:** Train→리뷰링크 탭→History가 해당 Day reflection으로 캘린더 선택+expand+scroll.

## 2026-06-10 — [LANE-B-2-1] History day-anchor deep-link (consumer) — COMMITTED · 미deploy·미push
- **[CLOSED]** Train "지난 reflection 복습" 링크가 날짜-무차별 캘린더 리스트로만 가던 문제의 consumer 절반. `center/letters/LettersClient.tsx`에 `useSearchParams` `?day=N` 추가 → letters 로드 후 `day_reflection`(item.day===N) 타겟 검색 → 날짜 pre-select(`setSelectedDate(dayKey(target.createdAt))`, (나)-2) + expand(`setExpandedId`) + scroll. 스크롤 = ③b 이디엄(reduced-motion + `block:"start"`), **mobile 가드 없음 → desktop+mobile 모두**((나)-1). row에 `id={letter-${id}}` 단일 attr 추가(유일한 마크업 변경).
- 🔴 async ordering(MED 리스크) 종결: **결정적 2-effect** — deep-link effect [loading,letters,dayParam]가 타겟 확정+`pendingScrollIdRef` 큐잉, scroll effect [visible]가 `visible.some(id)` + `getElementById` **이중 가드**로 row가 실제 DOM에 존재하는 렌더에서만 1회 스크롤(미존재 시 무해 리턴·재시도). **fire-once** `didDeepLinkRef`(dayParam별) → 재fetch/재렌더 스크롤 안 함, 유저 조작 미충돌. `?day` 없으면 기존 동작 완전 동일.
- freeze: producer href(B-2-2) 미변경 · page.tsx/API/route/service/schema/dead-component 무접촉 · 가시 카피 0 churn. gate tsc 0 / lint:terminology 13(+0) / route 15/15 + service 10/10(데이터 경로 item.day 무결). Inner-main `1d4f9402`(1 file) + outer main 미러. **미배포·미push**(B-2-2 producer 후 B-2 deploy에서 배치 push).
- ⚠️ **BACKLOG(신규):** History deep-link ↔ `getLetterHistory` `limit=20` — deep-link 타겟이 최근 20편지보다 오래되면 `letters` 미포함 → graceful no-op(앵커 안 됨, 정상 리스트). B-2 미파손, >20-entry 유저에게 feature-incomplete. **LOW**(현재 Day2 초과 유저 부재) → 트리거 시 **MED**. 향후 pagination 또는 day-targeted fetch.
- [visual] ?day=N 앵커(캘린더 선택+expand+scroll) 육안 = B-2 staging deploy 후 Commander(auth-gated). 다음 B-2-2(Train producer href `+?day=${day}`).

## 2026-06-10 — [LANE-B-1] DEPLOYED — Train Day 패널 UX 4종(②①③a③b) — staging Version `7bacfda6` + 3-way PASS
- **[DEPLOYED]** B-1 lane(② 온디맨드 완료요약 · ① 모바일 우선 stack order · ③a center 토글 active 피드백 · ③b 모바일 토글 scrollIntoView) staging 배포 완료. 4 sub-item 모두 단일 `train/day/[day]/page.client.tsx` 수정 — 스키마/API/route/LettersClient/dead-component 무변경. (본 entry가 하위 4개 `미deploy·미push` 항목 상태를 supersede; 하위는 history로 보존.)
- **Push:** origin/inner-main `39067723..be63f934` (inner-main only, origin/main 미접촉) · origin/main `68b0ac8..56de3a1` (outer ledger). **Deploy:** `rm -rf .open-next` → prebuild(check-env 0) → cf:build(0) → cf:deploy(0) → Worker **bty-arena-staging** Version **`7bacfda6-234f-4237-b107-93f2e3527614`** (production-effective; 단일 공유 백엔드, 별도 prod worker 부재).
- **3-way freshness PASS:** (a) active Version `7bacfda6` (cf:deploy "Current Version ID" + deployments list 최신 100%) / (b) inner HEAD `be63f934` / (c) live literal — train/day chunk `page-9377c3c0eae23335.js`(HTTP 200) 내 ① `md:order-1` · ② `아직 완료 요약이 없습니다` · ③b `max-width: 767px` 전부 존재. content-hash 9377c3c0 = be63f934 로컬빌드 → 라이브 서빙 일치.
- **B-1 최종 커밋셋:** ② `32528cbf`/`18ded9e`(+ledger move `df32ea8`) · ① `9c65bd0b`/`89224ac` · ③a `b89e424c`/`1e17620` · ③b `be63f934`/`56de3a1`. (하위 ③b entry의 `<this outer>` 플레이스홀더 = `56de3a1`, 본 entry에서 확정.)
- **가드:** /api/version 미사용(하드코딩 2026-04-27 stale) → cf:deploy UUID 사용. env bake check: .env.local/.env dev-var 전부 주석(LLM_BASE_URL/localhost/Tailscale/DEV_BYPASS) → 번들 미오염. gate tsc 0 / terminology 13 baseline.
- **[PENDING] 시각검증(모바일, Commander ee9d2075, auth-gated/OAuth-only):** ① 모바일 stack(레슨→Coach/Completion→메타) · ③a center 토글 active swap · ③b 토글 시 패널 scroll · ② Completion 탭 오픈 시 요약 생성. 코드 라이브는 chunk literal로 실증, 화면 렌더는 Commander 폰 확인 대기.

## 2026-06-10 — [LANE-B-1-③b] Train Day 모바일 토글 scrollIntoView — CLOSES B-1 — COMMITTED · 미deploy·미push(B-1 deploy dispatch 대기)
- **[CLOSED]** 모바일에서 center 토글이 state만 바꾸고 실제 Coach/Completion 패널은 fold 아래 잔존하던 문제. RIGHT `<aside>`에 단일 `panelAsideRef` + `useEffect`(showCompletionSummary 키) 추가: center 버튼·우측 pill 모두 같은 SoT라 1개 effect가 양쪽 커버. `didMountRef` 초기 마운트 skip → 페이지 로드 auto-scroll 0. `window.matchMedia("(max-width: 767px)")` 게이트 → 데스크톱 md+ auto-scroll 0. `scrollIntoView({behavior, block:"start"})`, reduced-motion(repo 패턴 `matchMedia prefers-reduced-motion`) 존중→ reduce 시 "auto".
- 🔴 breakpoint parity: Tailwind `md`=**768px**(tailwind.config.ts screens override 부재=default) → guard **767px**=md−1, 단일컬럼 스택 경계 정확 일치. freeze: 라벨/카피 무변경 · DOM 블록이동 0 · scrollIntoView만 추가 · ②(on-demand 생성)/①(order 클래스)/③a(active 피드백) 무변경 · API/route/schema/LettersClient/dead-component 무접촉. gate tsc 0 / lint:terminology 13(+0) / parity PASS. Inner-main `be63f934`(1 file) + outer main 미러. **미배포·미push**.
- [caveat] (1) Completion 무캐시 오픈 시 ② async 생성 → 빈상태로 즉시 스크롤 후 요약 도착하며 height 증가(block:"start"라 aside top 유지, 오스크롤 아님). (2) StrictMode dev 이중 invoke = **dev 전용**, 배포 빌드 무영향. prev-value 가드 = future-hardening **backlog**.
- **B-1 lane 커밋셋(로컬, 미push):** ② `32528cbf`/`18ded9e`(+ledger move `df32ea8`) · ① `9c65bd0b`/`89224ac` · ③a `b89e424c`/`1e17620` · ③b `be63f934`/`<this outer>`. **B-1 전 항목 시각검증 = B-1 staging deploy 후 Commander 모바일(auth-gated, OAuth-only).** push+deploy = 별도 B-1 deploy dispatch.

## 2026-06-10 — [LANE-B-1-③a] Train Day center 토글 active 피드백 (pill 미러) — COMMITTED · 미deploy(B-1 end held)
- **[CLOSED]** 모바일 사용자가 center 버튼 탭 시 버튼 자체 확인 피드백 약함 문제. 우측 aside pill의 active 패턴을 center 버튼 행에 미러: `train/day/[day]/page.client.tsx` center "코치 대화"/"완료 요약" 버튼에 `aria-pressed` + bg/color swap 추가 (동일 `showCompletionSummary` SoT). 코치 버튼 active(black/white) when `showCompletionSummary===false`, 완료요약 버튼 active when `===true` — 우측 pill과 **polarity parity 확인**(코치 `!showCompletionSummary`, 완료 `showCompletionSummary`). center 버튼 고유 padding/borderRadius 유지(pill 모양 미강제).
- 🔴 freeze: 라벨 무변경("코치 대화"/"완료 요약"/EN, "선택됨" 류 미추가) · "오늘 완료로 표시" 액션버튼은 토글 아님→active swap 제외(정상) · onClick/state 무변경 · 우측 pill 무접촉 · scrollIntoView 미도입(③b 예약) · API/route/schema/LettersClient/dead-component 무접촉. gate tsc 0 / lint:terminology 13(+0, 카피 0) / parity gate PASS. Inner-main `b89e424c`(1 file) + outer main 미러. **미배포·미push**(deploy held for B-1 end). outer stale backlog 미스테이지.
- [visual] center 버튼 active swap 모바일 육안 = B-1 staging deploy 후 Commander(auth-gated). ②(on-demand 생성)·①(order 스택) 동작 불변. 다음 B-1 ③b(scrollIntoView).

## 2026-06-10 — [LANE-B-1-①] Train Day 모바일 top-stack reorder (CSS order) — COMMITTED · 미deploy(B-1 end held)
- **[CLOSED]** 모바일 단일컬럼에서 LEFT 메타+28일 그리드가 레슨을 아래로 밀던 문제. DOM/소스 순서 보존, 반응형 Tailwind `order` 유틸만으로 모바일 스택 재정렬: `train/day/[day]/page.client.tsx` 루트 grid 3자식에 LEFT aside `order-3 md:order-1` / CENTER main `order-1 md:order-2` / RIGHT aside `order-2 md:order-3`. 모바일(grid-cols-1): 레슨 → Coach/Completion → 리뷰/그리드/메타. 데스크톱 md+: md:order=소스순서 → `[360px_1fr_420px]` 트랙 불변(LEFT 360/CENTER 1fr/RIGHT 420), 시각 무변경.
- 🔴 freeze: DOM 블록 이동 0 · 링크/href/state/completion-gen(②)/탭 로직 무변경 · scrollIntoView 미도입(③b 예약) · API/route/schema/LettersClient/dead-component 무접촉. 각 자식 기존 className 부재 → 순수 additive. gate tsc 0 / lint:terminology 13(+0, 카피 0) / completion-pack route 6/6(② orthogonal). Inner-main `9c65bd0b`(1 file) + outer main 미러. **미배포·미push**(deploy held for B-1 end). outer stale backlog 미스테이지.
- [visual] 모바일 스택 + 데스크톱 트랙 육안검증 = B-1 staging deploy 후 Commander(auth-gated, OAuth-only). 다음 B-1 ③a(토글 active 피드백).

## 2026-06-10 — [LANE-B-1-②] Train Day Completion Summary 온디맨드 생성 — COMMITTED · 미deploy(B-1 end held)
- **[CLOSED]** Train Day 패널 완료요약 빈 상태(empty-state) 후속. Completion 탭 열림 시 요약 없으면 기존 결정적 completion-pack 경로(`/api/train/completion-pack` GET → `buildCompletionPackFromLesson`)로 **온디맨드 1회 생성**. `train/day/[day]/page.client.tsx`에 `summaryRequestedRef`(day별 요청 기록) + `useEffect`(showCompletionSummary 열림) 추가. 가드 3종: 패널 닫힘 skip / 요약 존재 skip(기존 동작 보존) / 해당 day 이미 요청 skip(in-flight·재요청 방지). `onClickComplete`도 ref 선기록 → Complete 버튼·effect 이중발화 방지. 빈 상태 카피 중립화(ko "아직 완료 요약이 없습니다."/en "No completion summary yet.", 금지어 0).
- 🔴 freeze: 서버 뮤테이션 0 · API/route/schema/LettersClient/dead-component 무변경 · 모바일 레이아웃 불변. gate tsc 0 / lint:terminology 13(+0, scoped 금지어 0) / completion-pack route 6/6. Inner-main `32528cbf`(1 file) + outer main 미러. **미배포·미push**(deploy held for B-1 end). outer stale backlog 미스테이지.
- [backlog] `completionSummary`가 TrainShell에서 day-scope 아님 → Day N→M 이동 시 이전 요약 잔존(본 패치 이전부터, 스코프 외) = day-scope refresh **LOW** post-MVP. 다음 B-1 ①(모바일 top-stack reorder).

## 2026-06-10 — [DECISION6-C2-4] 5 Day reflection 질문 세트 (Day 1/12/24/25/28) — 콘텐츠 파일럿 — COMMITTED · DEPLOYED `e0b95a45`
- **[CLOSED]** reflection-questions.json += Day 1/12/24/25/28 (title/questions/finalPrompt ko/en). Day4 불변. 커버리지 6/28(나머지 22 open-only, 점진). BTY voice(Dr. Chi 검토): 자기비난 금지/의미 탐색/다음 한 걸음/Q=재료 Final=통합. Day1↔Day28 수미상관(나에게 건네는 말). 흐름 알아차림(1)→이해(12)→준비(24)→습관(25)→통합(28).
- asset-only(코드 0), 폼 static import 자동 인식. gate JSON valid/tsc0/vitest76 신규0/term13. Authority @ plan 848fd69. Inner `39067723`. **Deploy staging Version `e0b95a45` (2026-06-10T15:18Z).** 3-way: versions tail=e0b95a45 / build source=39067723 / live literal PASS(train/day chunk Day12 "실망시키고 싶지 않" + Day28 "걸어온 나" + Day24 "편이 되어주고 싶나요"). e2e: Day 1/12/24/25/28 질문 렌더 + 저장(Commander 육안).
- [backlog] reflection-questions.json 나머지 22 Day 점진 authoring.

## 2026-06-10 — [DECISION6-C2-5] Day Reflection 폼 prefill (재편집 데이터 손실 버그 fix) — COMMITTED · DEPLOYED `e4dfd8ca`
- **[CLOSED]** 버그: 재편집 빈 폼 → 일부 입력+Save → 통째 upsert가 기존 답 덮어씀(손실). 근본=prefill 부재. fix: GET ?day=N + getDayReflection(maybeSingle user/day/train/day_reflection, RLS SELECT own) + 폼 useEffect prefill(q 문자열 매칭 answerMap[q], unmatched saved q drop, 로딩 disabled 깜빡임 방지, deps [open,day]). POST/submitDayReflection 통째 upsert **미변경**(prefill로 전 답 폼 존재 → Q2만 수정해도 Q1/Q3 보존, merge 불필요). 복습 링크 사이드바→/center/letters fold.
- freeze(completion/markTodayComplete/측정/healing 미접촉, GET=read-only). gate tsc0/vitest76 신규0/term13. Authority @ plan 848fd69. Inner `00ab3a4d`. **Deploy staging Version `e4dfd8ca` (2026-06-10T13:18Z).** 3-way: versions tail=e4dfd8ca / build source=00ab3a4d / live literal PASS(train/day chunk "이전 기록을 불러오는 중" prefill loading + "지난 reflection 복습" link + "day-reflection?day=" GET path). e2e: Q1A/Q2B/Q3C→Q2만 수정→Q1A/Q2'/Q3C 보존(Commander 육안).
- [backlog] 🔴 28일 재수강 충돌(unique(user,day,source) → 재수강 시 옛 답 prefill, 회차 키 미설계, LOW post-MVP), Day-anchor 점프, History 개별 수정/삭제[B], 질문별 개별저장[C] prefill후 재판단, getDayReflection/GET·POST route 테스트, TrainDayCapture.tsx prune.

## 2026-06-09 — [DECISION6-C2-3] History shape 분기 (day_reflection Q/A 카드) — C2 엔진 3/4 — COMMITTED · DEPLOYED `b967d7bd`
- **[CLOSED]** getLetterHistory select += type/day/responses(calendar 미접촉, 자동 dot). domain pure DayReflectionResponses + LetterWithReply optional 확장(비파괴), dayReflectionService 로컬타입→domain import+re-export. LettersClient day_reflection → "Day N 성찰"+title+Q/A(빈답 스킵)+Final 강조, reply 뱃지 숨김. letter 미변경. title=locale baked(C2-2 저장형태).
- display-only freeze, engine reader(type='letter') 자동 제외 불변. gate tsc0/vitest210 신규0/term13. Authority @ plan 848fd69. Inner `a7d1269b`.
- **Deploy = C2-2(3f292dd9)+C2-3(a7d1269b) 묶음, staging Version `b967d7bd` (2026-06-10T05:21Z).** 3-way: versions tail=b967d7bd / build source=a7d1269b / live literal PASS(center/letters chunk "오늘의 성찰" + train/day chunk Day4 질문 "가장 힘든 순간"+finalPrompt "마음에 품고"). Day4 e2e(폼 입력→Save→History→재편집 upsert) = Commander 육안(auth-gated). [backlog] day-reflection route 테스트, TrainDayCapture.tsx prune. 다음 C2-4(reflection-questions.json Day4→28 콘텐츠 점진).

## 2026-06-09 — [DECISION6-C2-2] TrainDayReflectionSet 폼 + day_reflection upsert + Day4 pilot — C2 엔진 2/4 — COMMITTED · 미deploy(HALT)
- **[CLOSED]** universal 폼(질문0~N + 통합1, partial, 질문0=open-only A형 흡수), page.client L331 TrainDayCapture 대체. submitDayReflection upsert ON CONFLICT(user,day,source) — C2-1 unique/RLS 활용, submitLetter clean 분리. reflection-questions.json Day4 pilot ko/en. 기록≠완료(completion 독립 POST), renderer raw 유지(슬롯만 교체).
- Gate: tsc 0 / vitest 76 신규0 / terminology 13. Authority @ plan 848fd69. Inner `3f292dd9`. 🔴 Deploy 보류(C2-3 History 묶음). [backlog] day-reflection route 테스트, TrainDayCapture.tsx prune. 다음 C2-3(History shape 분기 — getLetterHistory select += type/day/responses, LettersClient day_reflection Q/A 카드).

## 2026-06-09 — [DECISION6-C2-1] Day Reflection 스키마 — responses jsonb + type day_reflection + unique + RLS UPDATE — C2 엔진 1/4 — COMMITTED · 미deploy(HALT)
- **[CLOSED]** migration 20260609000002: Unit1 QA train 2건 삭제(id 명시, 비가역) + responses jsonb(additive) + type CHECK 확장(day_reflection) + unique(user_id,day,source) + RLS UPDATE own. production 검증 a-f PASS: train 0, 잔여 center reflection(080edaee) day NULL unique-safe, 9 center letter 무손상. one-table multi-shape(free letter body / day_reflection responses).
- **[unique 전략]** 결정1=A(Unit1 train 2건 삭제, QA), 결정2=unique+upsert+RLS UPDATE 신설. center day NULL = NULL DISTINCT라 unique 무관.
- Gate: SQL Editor 적용 + repair 동기(20260609000002 local+remote applied). Authority @ plan 848fd69. Inner `56b6adaf`. Deploy 미실행(C2 엔진 묶음). 다음 C2-2(폼 TrainDayReflectionSet, Day4 질문세트로 검증).

## 2026-06-09 — [DECISION6-TRAIN-CAPTURE-Unit1] Train Day Dear Me capture + source/day/prompt 메타 (형태 A) — 결정6 첫 구현 — COMMITTED · 미deploy(HALT)
- **[CLOSED]** migration 20260609000001 dear_me_letters += source(default 'center' check train|arena|center) + day(int null) + prompt(text null). production 적용: 기존 9 letter source='center' 무손상, repair 동기(local+remote applied). write 경로 submitLetter/api += source/day/prompt(default 비파괴). TrainDayCapture.tsx(가벼운 신규 컴포넌트) Train Day `<article>` 아래, POST /api/dear-me/letter {type:'reflection',source:'train',day,prompt:''}. DearMeComposer 재사용 안 함(무거움/wrong endpoint).
- 🔴 **기록≠완료 LOCK**: capture가 markTodayComplete/completion 게이트/completions 미접촉, 자체 Save+POST 독립, 실패가 completion 무관. renderer 미변경(raw 유지, additive). freeze(측정/healing/train 진행) 미접촉.
- **[형태 A 선택]** C(inline per-section)는 raw→sections renderer un-flatten 필요 → 나중 renderer refactor lane. A=본문 아래, renderer 무변경, 모바일 자연.
- **[backlog]** two-endpoint split: /api/dear-me/letter(canonical, Train 사용) vs /api/bty/center/dear-me(legacy center) — endpoint 통일 = 후속 결정6 lane. prompt 자동주입(현재 빈 문자열) = 후속.
- gate: tsc 0 / terminology 13 / vitest 36 신규0(type/seed 비파괴 포함). Authority @ 결정6. Inner `f65d2c61`. SQL=SQL Editor 직접(db push 금지). Deploy 미실행. 다음 Unit2(5 Day 콘텐츠 카피 rewrite) 또는 deploy.

## 2026-06-09 — [IA-CENTER-FINAL] Center 2축 마감 — Healing 접힘(F1b) + Energy log 제거 + Invalid Date fix — COMMITTED · 미deploy(HALT)
- (B4 deploy `d5501a5e` 육안서 B1 병합 미완 발견 → 마감.) **F1**: `HealingPhaseTracker` compact prop(default false, non-breaking) — Current State 활성 phase 1줄 + `[Open Healing]`/bty/healing. full stepper/per-phase CTA 제거(Center embedded만, 타 consumer 0). **phase 계산 미접촉**(fetch activePhase read, advance=/bty/healing).
- **F2**: Energy log(`ResilienceCard`) surface 제거 — API(`/api/center/resilience`)+`ResilienceGraph`(landing×4) 유지, energy 데이터 결합 0(Dear Me composer는 energy 미사용). **F3**: Invalid Date — `DearMeCard`/`LetterItem` `created_at`→`createdAt`(API=createdAt, LettersClient 정상). dead `/dear-me` link 소멸(compact가 case2 bypass).
- **Center 최종형 달성**: Current State(Stage badge + Healing 접힘 + Open Healing) → Dear Me{Write,History} → Assessment. **freeze 0**(전부 display-layer).
- [backlog] HealingPhaseTracker full-mode 코드 unreferenced 잔존(non-breaking, 나중 prune). orphan i18n(B4e-2b ~93키) 여전 backlog(harmless, 분리).
- gate: tsc 0 / terminology 13 / vitest 3412(신규실패 0, baseline 7).
- commit: inner-main `01b0dd79`(CenterPageClient + HealingPhaseTracker) + outer main(이 커밋: 미러 + ledger). inner push `c01ebb43..01b0dd79`. **Deploy 미실행(별도 인가)**. 다음 deploy(display 변경).
- Authority plan 결정2 보강.

## 2026-06-09 — [IA-B4e-2] /growth atomic teardown — 비가역 33 delete + barrel prune + q237 sever · ✅ IA-B4 본체 제거 완료(i18n B4e-2b 잔여) — COMMITTED · 미deploy(HALT)
- 33 삭제: hub+alias3+reflection(+write)+history+recovery 라우트10/Screen10/helper7/API6. **/growth dir 소멸.** barrel `index.ts` prune split 1:1(REMOVE 제거/PRESERVE 유지, dangling 0). q237 `../growth/page` import+it sever(URL-grep 놓침→tsc 발견, observation>inference, wireframe/my-page 유지).
- 🔴 **PRESERVE intact**: features/growth 잔존 = README/`getLatestReflectionSeed`/gate3(`checkRecoveryTrigger`/`recoveryCompoundSignal`/`recoveryTypes`)/seed(`buildReflectionSeed`)/`reflectionStorage`/`computeGrowthHistory`/types/index. api/bty/growth=`seeds/latest`만. my-page/Arena/Dear Me 미접촉.
- ⚠️ **[B4e-2b 잔여]** i18n orphan sweep(48키/144line) defer — harmless(tsc 0, 소비파일 삭제됨). 제거 경계: `growthCard*`/`Nav*`/`Hub*`/`BackToGrowth`/`RouteLoading`/`Reflection*` 제거, **`growthReflectionFocus{Trust,Clarity,Regulation,Alignment}` 보존**(my-page mergeLeadershipReflection, type 1695-1698/ko 3518-3521/en 5333-5336). 가역, deploy 전 처리 예정.
- **[B4 종합]** B4b(`53580ab9`) seed infra doc, B4c 흡수(`552fef8c`/`853083b2`/`c3d281d2`), B4d(`d1eb3c8b`) recovery gate PRESERVE, B4a(B4e fold), B4e-1(`7a7b09f6`) sever+B4f, B4e-2(this) atomic delete. **Growth 해체 완료.**
- gate: tsc 0 / terminology 13 / vitest 3412(신규실패 0, baseline 7, q237 stub −1).
- commit: inner-main `c01ebb43`(33 D + barrel + q237) + outer main(이 커밋: 미러 + ledger). inner push `7a7b09f6..c01ebb43`. **Deploy 미실행(B4e-2b 후 B4 묶음)**. 다음 B4e-2b(i18n) → B4 deploy.
- Authority `docs/plans/IA_RESTRUCTURE_PLAN.md` @ d8585dd7.

## 2026-06-09 — [IA-B4e-1] /growth sever — deletion-enabler만(가역) + B4f airlock fold — COMMITTED · 미deploy(HALT)
- airlock(B4f): `useArenaSession` reviewReflection 제거(dead 0 callers) + unused router import. sprint252 smoke 삭제(GrowthPage import). e2e sever: recovery-flow.spec 삭제, guards.spec `/growth/reflection/write` 테스트만 제거(arena guard 유지) — Unit B(chromium-comeback) 무관, bty-loop project.
- ⚠️ **[범위 교정 — tsc-ordering]** barrel prune + i18n sweep을 B4e-1→B4e-2 이동: REMOVE UI(growth recovery/reflection/history)가 barrel(`@/features/growth/logic`) 경유 import + hub가 `growthCard*` i18n 소비 → 아직 존재하는 파일이 소비하므로 "먼저 sever" 불가, 삭제와 atomic. tsc 0 gate가 강제 드러냄(observation>inference). my-page `mergeLeadershipReflection`이 `growthReflectionFocus{Trust,Clarity,Regulation,Alignment}` 사용 → B4e-2 sweep서 PRESERVE.
- **ZERO-REF: /growth 외부-live ref 0**(REMOVE 내부 hub card/cross-link/API + Unit B journey e2e만 잔류) → B4e-2 비가역 삭제 안전 게이트 충족. PRESERVE(gate3/seed/my-page/Dear Me/seeds-latest) 미접촉.
- [relocate 판단] sprint252의 bty-arena policy 단언(`bty-arena/page.tsx`에 growth/journey·JourneyBoard 미참조 검증) = growth-independent. journey 이미 제거라 redundant 또는 bty-arena smoke로 relocate — Commander 판단(미실행).
- gate: tsc 0 / terminology 13 / vitest 3413(신규실패 0, baseline 7, sprint252 3 의도 감소).
- commit: inner-main `7a7b09f6`(M2: useArenaSession, guards.spec + D2: sprint252, recovery-flow.spec) + outer main(이 커밋: 미러 + ledger). inner push `d1eb3c8b..7a7b09f6`. **Deploy 미실행(B4 묶음)**. 다음 B4e-2(atomic delete + barrel prune + i18n sweep, 비가역).
- Authority `docs/plans/IA_RESTRUCTURE_PLAN.md` @ d8585dd7.

## 2026-06-09 — [IA-B4d] recovery gate PRESERVE lock (삭제 0, Approach B/b2 마커) — COMMITTED · 미deploy(HALT)
- gate 3파일(`checkRecoveryTrigger`/`recoveryCompoundSignal`/`recoveryTypes`, `features/growth/logic`) 상단 PRESERVE 마커. gate=pure(signals+reflections), my-page(`getMyPageIdentityState`) live 소비, recovery UI/write 독립 → growth UI 제거 생존. b-stay 보존.
- **[B4e 제거 대상 fold]** recovery UI/write: `/growth/recovery` route + `RecoveryEntryScreen` + `saveRecoveryEntry` + `/api/bty/growth/recovery` + orphan helpers(`buildRecoveryPrompt`/`buildRecoveryEntry`/`recoveryStorage`). cross-link(reflection:58/history:52 `onOpenRecovery`)은 B4e에서 reflection/history와 atomic 제거 → sever 불필요. `bty_recovery_entries` = dead table 예정(no drop).
- **[B4e PRESERVE]** gate 3파일 + my-page recovery awareness path.
- gate: tsc 0 / terminology 13 / vitest 신규실패 0(baseline 7). 삭제 0, recovery UI/route/write 미접촉(B4e atomic).
- commit: inner-main `d1eb3c8b`(3 gate 파일 주석) + outer main(이 커밋: 미러 + ledger). inner push `c3d281d2..d1eb3c8b`. **Deploy 미실행(B4 묶음)**. 다음 B4a(alias 3 + hub 카드).
- Authority `docs/plans/IA_RESTRUCTURE_PLAN.md` @ d8585dd7.

## 2026-06-09 — [IA-B4c-3] Dear Me Write seed wire (dismissable) — 흡수(B4c) UI 완료 · ✅ B4c 전체 완료 — COMMITTED · 미deploy(HALT)
- composer seed wire: `getLatestReflectionSeed` → dismissable prompt(`seed && !promptDismissed ? reflection : letter`). 자유 letter 항상 가능(강제 아님, 설문지화 방지). 진입점 "Write" 하나, CTA/메뉴 0. reflection = entry 속성이지 surface 아님. U1-a 표시 미변경(show-all 이미 작동). **Center = Current State + Dear Me{Write,History} 2축 달성.** freeze/Arena producer 미접촉.
- gate: tsc 0 / terminology 13 / vitest 신규실패 0(baseline 7), `dear-me/letter` route.test 21/21(POST shape 커버). [optional backlog] composer dismissable RTL 컴포넌트 테스트 부재 — 데이터 계약은 route.test 커버, UI 인터랙션 미커버.
- **[B4c 종합]** B4c-1 스키마+필터(`552fef8c`), B4c-2 write plumbing(`853083b2`), B4c-3 seed wire(`c3d281d2`). 형태2/2b 흡수 완료.
- ⚠️ **[형태2/2b trade-off — 결정6 legacy lane]** 흡수 = 구조화 reflection(`bty_reflection_entries`: seed_id/scenario_id/focus/prompt/cue/answer_1-3/commitment) → 단일 body(`dear_me_letters` type='reflection') 평탄화. identity/my-page reflection 패널(`fetchIdentityRows`, LIVE)은 신규 reflection 못 받음(old 구조화만 유지). 결정6에서 구조 복원/reconcile.
- commit: inner-main `c3d281d2`(CenterPageClient.tsx) + outer main(이 커밋: 미러 + ledger). inner push `853083b2..c3d281d2`. **Deploy 미실행(B4 묶음)**. 다음 B4d(recovery disposition: gate 보존, standalone UI/route 제거).
- Authority `docs/plans/IA_RESTRUCTURE_PLAN.md` @ d8585dd7.

## 2026-06-09 — [IA-B4c-2] reflection write plumbing (type/seedId, capable-but-unwired) — COMMITTED · 미deploy(HALT)
- `letterService` submitLetter: `SubmitLetterInput` += type?/seedId?; INSERT `type ?? 'letter'` / `seed_id ?? null`(기존 letter write 비파괴). `api/dear-me/letter` type/seedId 수용(미지정 시 letter default).
- `DearMeComposerModal`: seed 처리 능력(seed ? reflection : letter) 유지하되 **CenterPageClient 진입점 없음 → 항상 letter 모드(capable-but-unwired)**. AMEND로 reflection CTA/card/prompt 제거.
- **reflection = entry 속성(type/seed_id), UI surface 아님.** 사용자는 "Write"만(결정6 + Center 2축: Current State + Dear Me{Write,History}). reflection 진입점 0.
- B4c-1 필터 발효 시점(reflection row 생성 경로 도입 — schema→API→service 준비 완료, reader letter-scoped 보호됨). freeze/healing/bounce-back/lib-utils 미접촉.
- gate: tsc 0 / terminology 13 / vitest 신규실패 0(baseline 7), dear-me/letter route 21/21(+2 reflection 케이스).
- commit: inner-main `853083b2`(4 files) + outer main(이 커밋: 미러 + ledger). inner push `552fef8c..853083b2`. **Deploy 미실행(B4c-3 묶음)**. 다음 B4c-3(Center 2축: /center/letters show-all type-aware + Dear Me Write가 seed를 entry 속성으로 자연 wire).
- Authority `docs/plans/IA_RESTRUCTURE_PLAN.md` @ d8585dd7.

## 2026-06-09 — [IA-B4c-1] Dear Me 흡수 기반: type/seed_id additive 스키마 + reader letter-only 필터 (형태2/2b) — COMMITTED · 미deploy(HALT)
- migration `20260609000000` dear_me_letters에 `type`(default 'letter' NOT NULL, check letter|reflection) + `seed_id`(uuid nullable, no FK). production 적용 확인: 컬럼 2개 + 기존 8 letter 전부 type='letter' 무손상, repair 동기(local+remote applied).
- companion 필터: `slip-recovery` verifyReflectionLetterDone + `dear-me-recommender` fetchLetterStats(count/last) `.eq type='letter'` — reflection false-positive/inflate 차단. 로직 불변(현재 reflection row 0 → dormant-correct).
- **불변식**: reader 보호 먼저, reflection write는 B4c-2. freeze(Stage/AIR/TII)·healing·bounce-back·lib-utils 미접촉.
- gate: tsc 0 / terminology 13 / vitest 신규실패 0(baseline 7), recovery-loop integration 3/3.
- commit: inner-main `552fef8c`(SQL new + 2 engine service) + outer main(이 커밋: 미러 + ledger). inner push `53580ab9..552fef8c`. SQL = SQL Editor 직접 실행(db push 금지). **Deploy 미실행(B4c-2/3 묶음)**. 다음 B4c-2(reflection write → Dear Me typed entry).
- Authority `docs/plans/IA_RESTRUCTURE_PLAN.md` @ d8585dd7.

## 2026-06-08 — [IA-B4b] features/growth = shared reflection-seed infra 명시 (b-stay, doc-only) — COMMITTED · 미deploy(HALT)
- 흡수/이사-first 체인 시작. README 신설: PRODUCER Arena(`arena/signals/route.ts:32` → `lib/bty/identity/saveArenaSignalWithSeed.ts:49` → `buildReflectionSeed`), CONSUMER my-page(`MyPageLeadershipConsole.tsx:84` / `mergeLeadershipReflection.ts:19`), CONSUMER Center(post-B4). `buildReflectionSeed.ts:22` 정의, 상단 1줄 포인터 주석. naive 삭제 금지 경고.
- b-stay = seed 코드/import 무변경. "growth" misnomer 안정화. doc-only.
- [메모] seed 파이프가 `features/growth` + `lib/bty/identity` 양쪽 — 미래 re-home 시 양쪽 고려(b-stay라 IA-B4 범위 밖).
- gate: tsc 0 / terminology 13 / vitest 신규실패 0(baseline 7).
- commit: inner-main `53580ab9`(README new + buildReflectionSeed.ts 1줄) + outer main(이 커밋: 미러 + ledger). inner push `7eb80d1c..53580ab9`. **미deploy**. 다음 B4c+B4d-move(Center reflection surface 이사).
- Authority `docs/plans/IA_RESTRUCTURE_PLAN.md` @ 8b14d13c.

## 2026-06-08 — [IA-B3c R1 Unit A] orphaned journey-content.ts 삭제 — COMMITTED · 미deploy(HALT)
- `src/lib/journey-content.ts`(DayContent/JOURNEY_DAYS) 삭제. consumer 0(MissionCard 삭제로 orphan; `trainContent.getDayContent`는 substring false-match로 확인). journey 데이터 완전 소거(코드+i18n+data).
- dangling 0, tsc source 0, vitest 신규실패 0(baseline 7), terminology 13. git add 명시 path(blanket `-A` 금지 — STEP1b recovery 교훈).
- commit: inner-main `7eb80d1c`(D 1파일) + outer main(이 커밋: 미러 + ledger). inner push `aa19f88f..7eb80d1c`. Authority @ 32f9d6fd. **미deploy(B3 묶음)**.
- **[Unit B OPEN — 별도 lane]** comeback-E2E 서브시스템 decommission: `e2e/journey.spec.ts` + `e2e/auth-comeback.setup.ts` + `scripts/e2e-seed-default-journey-profile.mjs` + `playwright.config.ts`(chromium-comeback/setup-comeback projects, comebackAuthFile) + `package.json`(e2e:seed-default-journey, e2e:auth:comeback, test:e2e:ci `--project=chromium-comeback`) + `.github/workflows/e2e.yml`(L131/136-138). CI/release surface — 자체 STEP0(CI 매핑) 필요. 현재 dormant(E2E_COMEBACK_EMAIL 게이트, unset이면 skip) → B1~B3c deploy 무영향. 시점 미정(B4 전후 또는 독립).
- [backlog 유지] flag#2 q235/q4 stale JSDoc·파일명(cosmetic, 파일명 rename=import 영향 주의).
- [다음] B1~B3c 묶음 deploy → 육안 → B4 STEP0.

## 2026-06-08 — [IA-B3c-1b] journey 정의 삭제 (비가역, S-PHASED) — COMMITTED · 미deploy(HALT) — ✅ IA-B3 전체 완료
- 삭제 17파일: routes(2)/bty.journey(6)/components.journey(3, dead MissionCard 포함)/lib.bty.journey(2)/api.journey.profile+entries(route+test 4). 보존: `api/journey/bounce-back`(Comeback b-keep), `bty_profiles` 컬럼(schema 무변경), `lib/utils`.
- journey i18n 키 12줄 sweep(growthNav/CardJourney* + Line), sprint252 dangling 단언 prune. **ZERO-REF dangling 0**(외부 live 0 위 삭제).
- gate: tsc 0(source; `.next/types` stale는 deploy 빌드가 regenerate)/terminology 13/vitest 신규실패 0(baseline 7), test −28=삭제된 journey route-test(신규fail 아님), 보존 테스트(me/elite·center/letter·resilience·sprint252) 6/6 green.
- commit: inner-main `aa19f88f`(17 D + 2 M) + outer main(이 커밋: 미러 삭제+수정 + ledger). inner push `abab5421..aa19f88f`. STEP1a sever(`abab5421`)와 분리 단독 commit. **미deploy(B3 묶음)**.
- Authority `docs/plans/IA_RESTRUCTURE_PLAN.md` @ 32f9d6fd.
- **[IA-B3 종합]** B3a=no-op(train이 journey day UX subsume), B3b=Comeback repoint journey→train(`5d8e49d1`), B3c=sever(`abab5421`)+delete(`aa19f88f`). Deploy 미실행 — B1~B3c 묶음 staging 대기.
- [backlog 추가] flag#2: q235/q4 테스트 stale JSDoc 헤더+파일명("journey") — cosmetic, IA 후 rename/comment cleanup(파일명 rename = import 경로 영향 주의).
- [다음] B1~B3c 묶음 deploy → 육안(journey 404 정상화/Comeback→train/Center·Awakening 회귀 0) → B4(remaining Growth) STEP0.

## 2026-06-08 — [IA-B3c-1a] journey 외부 live 참조 4건 sever (가역, 삭제 전 단계, S-PHASED) — COMMITTED · 미deploy(HALT)
- `growth/page.tsx` journey 카드 제거(integrity/guidance/history 보존). `sprint252` smoke `/growth/journey` present 단언 제거(i18n-keys/dojo/root-policy 보존). `q235` mixed journey/profile만 제거(me/elite 보존). `q4` mixed journey/entries만 제거(center/letter+resilience 보존).
- 정의 파일 미삭제(STEP1b). **ZERO-REF: 외부 live journey 참조 0 확인** → STEP1b 삭제 안전 전제 확보. bounce-back/bty_profiles 컬럼/lib-utils/freeze 미접촉.
- gate: tsc 0 / terminology 13(신규 0) / vitest 신규실패 0(baseline 7), severed 보존분 6/6 green(vitest 3443→3442 = sprint252 ko-journey-present 1블록 의도 제거).
- commit: inner-main `abab5421`(4 files) + outer main(이 커밋: 미러 + ledger). inner push `5d8e49d1..abab5421`. **미deploy(B3 묶음)**. 다음 B3c-1b(journey 정의 파일 삭제 — 비가역).
- Authority `docs/plans/IA_RESTRUCTURE_PLAN.md` @ 32f9d6fd.
- [STEP1b 의존 메모] orphan i18n `growthCardJourneyTitle/Desc`·`growthNavJourneyTitle` 잔존 — `sprint252` i18n-keys 블록이 아직 `growthNavJourneyTitle`/`growthCardJourneyDesc` non-empty 단언 중. STEP1b서 키 sweep + 해당 단언 prune 동시에(분리 시 smoke 깨짐).

## 2026-06-08 — [IA-B3b] 글로벌 Comeback resume target journey→train (b-keep-clean, S-PHASED) — COMMITTED · 미deploy(HALT)
- `onResumeJourney` `/growth/journey` → `/train/day/${todayUnlockedDay}`, fallback `/train`. fetch `/api/train/progress`는 modal 표시 후 click handler 내만(mount fetch 0, 글로벌 폭증 회피).
- localStorage 3일 감지(lib/utils)·`recordBounceBack` POST·`bounce_back_count` 유지(b-keep). 카피 `comebackResumeJourneyCta` "여정 이어가기/Resume Journey" → "훈련 이어가기/Resume Training". `comebackTitle/Body` generic(회복 루프/recovery path) 불변. freeze/lib-utils/bounce-back route/schema 미접촉.
- gate: tsc 0 / terminology 13(신규 0) / vitest 신규실패 0(baseline 7 awakening·healing mock-chain) / journey·comeback regression smoke 4/4 PASS.
- commit: inner-main `5d8e49d1`(2 files: Comeback.tsx, i18n.ts) + outer main(이 커밋: 미러 + ledger). inner push `6f202281..5d8e49d1`. **미deploy(B3c까지 묶음)**. 다음 B3c(journey route/component/api/lib 제거 + dead MissionCard 정리).
- Authority `docs/plans/IA_RESTRUCTURE_PLAN.md` @ 32f9d6fd.
- [backlog 추가] Dear Me card `/center` "Invalid Date" 표시(letter 날짜 파싱 추정). IA-B3 scope 밖, IA 후 독립 fix.
- [관찰 메모] `bounce_back_count`: B3c 후 write-only(live display 0, orphaned JourneyBoard만 표시했음). keep 결정(retention 분석용). display 부활은 B4 Center 검토.

## 2026-06-08 — [IA-B2 결정3] Awakening 자격 = train 28 distinct 완주 (REPLACE/S-WIDE) — COMMITTED · 미deploy(HALT)
- `getSecondAwakening` eligible를 emotional_sessions(30일/10세션) → `train_day_completions` distinct day==28로 교체. `completedDays.length`(max 아님 — [1,2,28]=3 테스트로 증명).
- 신규 read-only accessor `getTrainDistinctCompletedDayCount`(lib/bty/healing, user RLS own-row policy 20260315000001 근거 → user client로 자기 행 읽기 정상). display·gate single truth. userDay/sessionCount 호환 유지(display-only), 5 소비처 non-breaking. `REQUIRED_DAY/MIN_SESSIONS` 제거(zero-ref). 403 NOT_ELIGIBLE contract 보존(UI 응답 불변). grandfather 부재 확정(STEP0b, G1 무동작). freeze(엔진/healing progression/train startDateISO temp hack) 미접촉.
- gate: tsc 0 / terminology 13(신규 0) / vitest 신규실패 0(기존 baseline 7-fail awakening·healing mock-chain 대조 — 본 변경과 무관, upstream 격리; 내 touched test 12 pass).
- commit: inner-main `6f202281`(5 files: 소스 2 + 신규 accessor 1 + 테스트 2) + outer main(이 커밋: 동일 미러 + ledger). inner push `4e6a636e..6f202281`. **미deploy(B1+B2 묶음 HALT)**. outer stale backlog(B2 무관) 미스테이지.
- Authority `docs/plans/IA_RESTRUCTURE_PLAN.md` @ bf558d85. 다음: B3(journey+Growth 제거, 흡수/이사 선행) 또는 B1+B2 staging deploy.
- [정정] B1 ledger의 "stale backlog 7개" → **8개** (PHILOSOPHY_LOCK_V1.md 누락, grep filter가 가림). substance 불변, 정수만 정정.
- [backlog 신규] (1) `domain/healing.ts:192 isSecondAwakeningEligible` = 옛 30/10 parallel def, dormant(index.test.ts만 소비) — wire 전 제거/통일. (2) `bty/awakening` GET trigger display `{day:30, requires_min_sessions:10}` train-28 대비 stale — 의미 동기화.

## 2026-06-08 — [IA-B1 결정2] Center A+B → Current State 보조카드 통합 (display-only) — COMMITTED · 미deploy(HALT)
- CenterPageClient.tsx `StageContextCard`+`HealingPhaseTracker` → 단일 "Current State" shell. `HealingPhaseTracker embedded?:boolean`(default false, non-breaking, 유일 사용처=Center). TrainProgressCard(hero/1차CTA, 현재 link-styled) 위계 유지. **fetch 미병합**(STEP0 cross-system 거부 채택 — Stage=Arena `/api/arena/leadership-engine/state`, healing=Center `/api/bty/healing/phase-tracker` 별도 유지). Stage=read-only 투영 확정(freeze intact).
- i18n `currentStateTitle` KO 현재 상태 / EN Current State.
- verify: tsc 0 / terminology 13(신규 0, 금지어 0) / vitest 신규실패 0(기존 baseline 7-fail awakening·healing route 대조로 닫힘 — 본 변경과 무관, 심볼 격리 확인).
- freeze 미접촉: leadership-engine route/service·domain, /api/train/progress, /api/bty/healing/phase-tracker 0 byte.
- commit: inner-main `4e6a636e`(3 files) + outer main(이 커밋: 같은 3 미러 + ledger). inner push `4b1553af..4e6a636e`. **미deploy(HALT)**. outer stale backlog 7개+untracked 3개 미스테이지(기존 drift, 본 closure 무관).
- Authority `docs/plans/IA_RESTRUCTURE_PLAN.md` @ bf558d85. 다음 B2(Awakening gate=train 완주, distinct day==28 · 기존 server eligibility 정합).

## 2026-06-08 — [A. Awakening 카피 중립화] 임계 수치 노출 제거 — DEPLOYED Version 872ed80f + 3교차 PASS
- 게이트 임계(30일/10세션)·진행수치(userDay/sessionCount)를 모든 UI 표면에서 제거, 게이트 존재만 알림. **카피만 — 게이트 로직 미접촉(② 보류), REQUIRED_DAY/MIN_SESSIONS 불변 = freeze-safe.**
- (1) healing/awakening/page.client.tsx: 해금조건 중립화 + 진행수치 블록 삭제 + 제목 "30일" 제거. (2) i18n awakeningActsTriggerLine ko/en 중립화 + AwakeningActsTrack 치환·미사용 상수 정리. Center intro(2918) 숫자 없음 → 미접촉.
- verify: tsc 0 / terminology 13(+0, 금지어 0) / 편집표면 30·10·userDay·sessionCount·{day}·{sessions} 노출 0.
- commit: inner-main `4b1553af`(3 files +6/-16) + outer main(이 커밋). **미push·미deploy**. outer stale backlog 미스테이지.
- **freeze 사이클 종료**: A-1/B-1/D1/D2/Awakening 가드+중립화 처리 완료. **D1=CLOSED**(low-traffic). freeze후 트랙(미착수): ①Awakening 게이트 재설계(나) ②IA 4겹 정리 ③Growth 허브 위치 ④온보딩 ⑤2b splitter ⑥Phase 5(reword, HALT 2건).

## 2026-06-08 — [Awakening 가드 + D2 KO 접기] eligibility 버튼 가드 + 접기 임계 locale-aware — DEPLOYED Version 1c843f24 + 3교차 PASS
- (1) Awakening "저장 실패" 오해 = NOT_ELIGIBLE 403(day30+10세션 게이트)이 generic 토스트로 표출. Cycle1: GET /api/bty/awakening에 `eligible:boolean` 노출(getSecondAwakening 위임=POST 게이트 동일 소스, 수치 비노출). Cycle2: AwakeningActsTrack 비자격 버튼 가드(`eligible===false`, undefined=기존 동작) + 중립 안내, 403 사전 차단(500/네트워크 토스트 보존, i18n 미접촉).
- (2) D2 KO 접기 미표시 = 단일 800 임계 × 한글 밀도. train page.client 임계 `ko 450/en 800` locale-aware + cut 하한 `*0.25`(EN 200 불변/KO 113). KO >450 24일 토글 회복, 최단 4일만 숨김. EN 회귀 0.
- render-only 준수, 측정/XP/순서 무변경. verify: tsc 0 / terminology 13(+0, 금지어 0) / KO Day4=572>450 보임.
- commit: inner-main `344ffc70` + outer main `358cd65`(미러+ledger). push synced 0/0(inner `..344ffc70`/outer `..358cd65`). **Deploy** Worker bty-arena-staging Version `1c843f24` (rm .open-next+npm run deploy, exit 0). 3교차 PASS(active==1c843f24 / HEAD 344ffc70 / live literal train `"ko"===y?450`·healing "아직 이 단계에…"·eligible). **육안 미수행(auth+OAuth)** — 청크 리터럴 실증, 화면 렌더 Commander 로그인 필요. outer stale backlog 10개 미스테이지. ※"KO Day5=748"은 EN 길이 혼동(실 KO=420) 정정.

## 2026-06-08 — [A-1+B-1+D1+D2] 시나리오 텍스트 정리 + 루트404 EN + journey 리스트 + train 가독성 — DEPLOYED Version 2c60409b (정정: 직전 "COMMITTED/HALT" 표기 stale — 실제 배포 완료)
- A-1 무해 텍스트 6건 중 **4건 적용**(frozen 불변): core_22 citation 잔재 제거 / core_11 AD 라벨 마침표 16건 정규화 / core_01 "own해야 할"→"책임져야 할" / core_03 미번역 "two-part " 제거. **2건 HALT**(후보 제시): core_13-EN 과단축, core_03-EN "two-part reset" — Commander 결정 대기.
- B-1: not-found.tsx 루트 404 EN화(metadata/h1/본문/Log in/Dashboard, "홈 (KO)" 셀렉터 유지). D1: JourneyDayStep 다줄 body→ul/li(1줄→p 폴백). D2: train raw 가독성(문단여백/800자 details 접기/✅완료·🔒잠김/eyebrow·h1) presentation-only, raw 유지.
- B-2 폐기: BtyAuthGuard.tsx(orphan, 미마운트) 편집 git checkout 되돌림.
- verify: tsc 0 / terminology 13(+0, 금지어 0) / scenario json 5 valid / frozen diff 0.
- commit: inner-main `7228bf15`(8 files +101/-33) + outer main(이 커밋: 같은 8 미러 + ledger). **미push·미deploy** — 빌드타임 정적 import라 deploy 전 staging 미반영; D1/D2 auth-gated 육안은 배포+OAuth 필요. outer 무관 backlog 10개 미스테이지(WIP 차단). push/deploy=Commander 승인 후 별 dispatch.

## 2026-06-03 — SESSION STATUS — 오늘 4 lane 전부 closed
- 활성 작업 없음 — G-DC-19 / G-DC-21 / G-DC-22 / G-DC-23 전부 DEPLOYED + closed.
- 다음: 금요일 2026-06-05 파일럿 20명 등록.

## 2026-06-03 — [G-DC-23] full_name 멤버십 폼 + admin 표시 — DEPLOYED + 3-way PASS
- 본명(full_name, admin 식별용) end-to-end 추가 — display_name(공개 닉네임)과 별개. 멤버십 폼에 필수 이름칸(max 120, 신규 순수헬퍼 `validateFullName`).
- POST membership-request: `arena_membership_requests`(이력) + `arena_profiles`(권위, `ensure_arena_profile` RPC→UPDATE) 둘 다 저장, 검증 실패 422.
- admin 3화면(리더십지표 AIR/Stage/MWD·멤버십·멘토신청): 공용 `fetchFullNameMap`(arena_profiles IN 조회)로 full_name 표시, 미설정 시 email/uuid 폴백(이름이면 font-mono 제거).
- migration `20260603000000_arena_full_name.sql`(arena_profiles.full_name + arena_membership_requests.full_name, ADD COLUMN IF NOT EXISTS). `repair --status applied` → list local+remote synced(db push 없음).
- verify: tsc clean / vitest 3445(=baseline; mentor mock +`.in()`, 폼 success/5xx 테스트 +이름 입력).
- deploy: `rm -rf .open-next` + cf:build + cf:deploy → Worker `5deb597c-c53a-4dee-85b3-23bd6346684b`. 3-way PASS(active==5deb597c / inner a021e846 + outer 03959b5 / admin API 401=route-load healthy, not 500).
- 잔여: 컬럼 firing 런타임 실증(authed 신청→admin 이름) = Commander live-verify; route.test happy-path 200 미커버(기존 갭).

## 2026-06-03 — [G-DC-22] 코드 뱃지 7종 + 아웃핏 잠금 — DEPLOYED + 3-way PASS
- 코드 뱃지(forge/pulse/frame/ascend/nova/architect/codeless) CODE IDENTITY(64px)·dashboard IDENTITY(56px) 카드 표시 — 신규 `codeBadgeSrcByName`(codeName→`/badge/<name>.png`, null→미표시).
- 옛 `badge_*_icon.png` 5개 제거, `public/badge/` 소문자 정규명 통일(2회 HALT: pulse/nova 부재 → `Ascend.png`/`cordless.png` 오타 → Commander 7개 재공급).
- 아웃핏 전면 잠금(`OUTFIT_SELECTION_OPEN=false`, 저장 경로 미호출) + "곧 제공 / Coming soon" 인라인.
- verify: tsc clean / vitest 3445. deploy: Worker `1bc056f3-c49f-4d4d-b8d6-4bc7f2c64bdb`. 3-way PASS(inner ab88a43d + outer fcbf524 / 뱃지 7종 200 incl ascend·codeless / 옛 자산 404).

## 2026-06-03 — [G-DC-21] 비밀번호 재설정 UI 제거 — DEPLOYED
- Account SECURITY 카드(reset-email UI) 제거 — Google OAuth 전용, 사이트 비번 없음. `send-reset-email/route.ts`는 dead code 잔존(후속 cleanup).
- inner `4251e6b1`(오늘 배포 worker 1bc056f3/5deb597c의 git-ancestor → 라이브). Commander 보고: SECURITY 카드 부재.

## 2026-06-03 — [G-DC-19] 리더보드 display_name + weekly tier 숨김 + 코드당 개명 게이트 — DEPLOYED
- 리더보드 이름줄 `CODE-displayName`; weekly tier(Bronze/Silver/Gold) 숨김(계산 유지). display_name 코드당 1회 게이트(migration `20260602223038` — arena_profiles.display_name_changed_at_code_index); sub-name 개명 UI 닫음(`SUBNAME_RENAME_ENABLED=false`).
- inner `99129251`(오늘 배포 worker의 git-ancestor → 라이브). Commander 보고: display name 변경 검증, 3-way PASS.

## 2026-06-02 — [Bug 3] avatar no-selection guard (unselected→initials, not scrubs) — DEPLOYED + smoke 4/4
- 4 files (inner `f4f371c9`): `resolveDisplayAvatarUrl`에 Lane 7 미선택 guard 추가(sibling `resolveDisplayAvatarLayers` 패턴 미러) — char/outfit/theme 모두 null → `return null`(이니셜). core-xp/route.ts:208 `avatarUrl` outfit fallback을 `hasAvatarSelection`로 게이트(DB-row `?? null` 변수, 미선택=null). edges:112 `not.toBeNull`→`toBeNull`(테스트명 일치); +5 resolveDisplayAvatarUrl no-selection case.
- 봉쇄: 미선택 row-exists 유저가 레벨 기본 옷(scrubs) 대신 이니셜. Bug 2(fresh empty equip) 동반 해소(같은 fail-safe 경로).
- verify: tsc 0 / terminology 13(+0) / vitest no-selection 10·edges 15·core-xp 13·leaderboard 9 green.
- deploy: `rm -rf .open-next && npm run deploy` → Worker `3f9a1f02-24e5-4737-9ebc-d68f87672a7a` (deployments active 100% 21:36:33Z = stdout; worker.js mtime 21:36:12Z fresh; prior b2a4abc8). 3-way PASS.
- smoke 4/4 (Commander 브라우저): 미선택 row→이니셜 / 선택 유저→옷 그대로 / fresh !row→이니셜 / 3-surface 일관. observed.

## 2026-06-02 — [SECURITY] REVOKE anon EXECUTE on 6 SECURITY DEFINER funcs — advisor WARN — APPLIED to prod
- Migration `bty-app/supabase/migrations/20260602000002_revoke_anon_execute_definer_funcs.sql` 적용 완료 (6 × `DO $$` to_regprocedure 가드 + GRANT-then-REVOKE).
- 봉쇄: DEFINER 함수가 caller RLS 우회 → anon EXECUTE(직접+PUBLIC)면 미인증자가 XP 조작/profile/season RPC 직접 호출 = 권한상승.
- caller 분류(코드 검증, 전부 auth-gated): authenticated 4 (`increment_arena_xp`/`increment_weekly_xp`/`ensure_arena_profile`/`consume_lab_attempt`) + service_role 2 (`run_season_carryover`/`get_leaderboard_profiles`).
- fix: 4개 → GRANT TO authenticated,service_role 후 REVOKE FROM anon,PUBLIC; 2개 → GRANT TO service_role 후 REVOKE FROM anon,authenticated,PUBLIC.
- **★ GRANT-then-REVOKE**: 관측상 접근이 PUBLIC 경유 → bare REVOKE FROM PUBLIC이 authenticated/service_role까지 끊을 위험 → 명시 GRANT 선행으로 ACL 구조 무관 안전. grant-only, XP 로직/불변식 무변경.
- verify: db push `Finished`(0 error) / migration list 동기화 / ACL-after = pg_proc proacl 재쿼리 Commander 전달(anon 6개 제거 / authenticated 4 유지 / service_role 2 단독).
- PENDING: 코어루프 smoke(RLS smoke와 합침) — authenticated XP 정상이면 REVOKE+RLS 둘 다 무영향. NOTE: leaderboard security_definer_view = Commander가 이미 drop(view_count=0).

## 2026-06-02 — [SECURITY] RLS enable — advisor `rls_disabled_in_public` ERROR 16 tables — APPLIED to prod
- Migration `bty-app/supabase/migrations/20260602000000_rls_enable_advisor_error_16_tables.sql` 적용 완료 (16 × `ALTER TABLE IF EXISTS … ENABLE ROW LEVEL SECURITY`, policy 0 = RLS-only default-deny).
- 분류(코드 검증): ACTIVE 3 (`bty_action_contract_escalations`/`_validator_evaluations`/`scenario_pool_health_snapshots`, 전부 service_role → RLS bypass → 앱 무영향) + ORPHAN 13 (코드 0-ref; `qr_tokens` 포함).
- **장부 정비**(db push가 migration-history divergence로 차단됨): remote-only signup 3건(`20260525000000/001/002`, `migrations-reverted/`에 park) → `repair --status reverted`; out-of-band 적용된 QR v1 5건(`20260527010000~010400`)+le_pulse(`20260531000000`) → **관측 게이트 통과 후**(Commander 대시보드 A=10컬럼∧B=4제약∧C=0; le_pulse_log 테이블 `inspect db table-stats`로 4 rows 관측) `repair --status applied` → `db push`로 `20260602000000` 1건만 적용.
- **★ out-of-band 드리프트**: advisor 16개 중 14개가 repo 마이그레이션에 생성 이력 없음 = 히스토리 밖 생성. 이번에 양방향 divergence 정비.
- **★ `qr_tokens` = 실데이터 1 row + seq scan** 있는 실 테이블이 RLS-off였음(앱 코드 0-ref인데 토큰 노출) → 봉쇄.
- verify: db push `Finished`(에러 0) / `migration list` 20260602000000 local+remote 동기화 / advisor-after 동치 = `pg_class.relrowsecurity` 쿼리 Commander 전달(기대 16×true).
- PENDING: 코어루프 smoke(ACTIVE 3 무영향 실증) 보류 — 다음 코어루프 시 섞어 확인. NEXT: `security_definer_view`(arena_profiles_leaderboard_public) + WARN(anon increment_xp) 별도.

## 2026-06-02 — [HOTFIX] Center 28-day assessment gate + public result locale CTA (Bug 1 + 1b) — DEPLOYED
- Bug 1: Center "28일 프로그램 ready/Day 1" 카드가 50문항 assessment 완료와 무관하게 모든 로그인 유저에게 노출(`/api/train/progress` hasSession = auth-presence only, no assessment gate; CenterPageClient가 assessment submissions를 이미 fetch하나 TrainProgressCard에 미전달). FIX: TrainProgressCard에 `hasAssessment` prop(`submissions.length>0`, 기 fetch 신호 재사용·신규 fetch 0) — submission 없으면 28-day 카드 대신 "먼저 50문항 진단 완료" + `/${locale}/assessment` 링크 카드. fail-safe: submissions=[] 기본 → prompt(false-ready 불가).
- Bug 1b: (public)/assessment/result CTA `href="/en/train/start"` 하드코딩 → 한국어 유저도 /en/ 진입. FIX: `` `/${lang}/train/start` ``. 교정(directive `/${locale}` 오류 정정): (public) 그룹엔 locale route param 부재 → 변수는 `lang`(client state); 타깃은 `[locale]/train/start` 존재 → locale-prefix 유지(bare `/train/start`는 404). localized ResultClient.tsx:390(`/${loc}/train/day/1`)는 이미 옳음 → 무수정.
- layer: UI render-only 준수(기 fetch 신호로 표현 분기, 비즈룰 계산 0, 신규 fetch 0).
- verify HARD(Claude): tsc 0 / terminology 13(신규 bilingual 문자열 +0) / inner commit `9825a1aa`(inner-main, 2 files +34/-2) / 배포 active `b2a4abc8`(deployments list 최신 100%, created 2026-06-02T16:35:08Z) / **3-way PASS**: active b2a4abc8 ↔ inner HEAD 9825a1aa ↔ worker.js mtime 16:34:46Z(now 16:36, ~75s window) / 배포 매니페스트 = center+result 2 청크(정확히 수정 2파일) / **라이브 워커 grep**(둘 다 http 200): result `/en/train/start`=0 + `concat(lang,"/train/start")` present, center 게이트 문자열 present.
- verify PENDING(executor attest): 런타임 브라우저 4항목 — (1)신규 무submission→50Q카드 (2)기존 submission→28-day 카드 그대로 (3)KO public result→/ko/train/start 클릭 (4)9단계 회귀. 코드는 라이브 검증됨, 인증/localStorage 세션 브라우저 관측만 미실시(Claude headless auth 불가). diff가 Center + (public) result 한정 → arena 9-step flow 코드 무접촉 → 회귀 위험 inspection상 ~0.
- 미push: inner 9825a1aa 로컬 commit(배포는 working-tree 빌드라 prod 라이브와 무관); origin push 미요청 → 보류(follow-up).
- Bug 2(fresh-user avatar 빈 equip) = backlog 유지, 무수정(intent fork: gate-required 확정은 Bug 1 한정).

## 2026-06-01 — [PLAN] Supabase Key Modernization (HIGH, post-launch)
TRANSITION PLAN v1.1 — execution-pending (NOT complete). execution=Commander 직접, Claude Code 0-mutation.
- Trigger: .env.local full-cat 사고로 prod secret transcript 노출분 중 회전 보류 2개(SUPABASE_SERVICE_ROLE_KEY + NEXT_PUBLIC_SUPABASE_ANON_KEY) = legacy JWT-signed 독립 회전 불가 → 현재도 prod valid = 살아있는 노출.
- 경로: legacy JWT anon/service_role → 신형 sb_publishable_*/sb_secret_* 병행 전환 후 legacy disable.
- 호환성 PASS: supabase-js 2.95.3 / ssr 0.5.2, 코드 시그니처 변경 0, 값 교체만. 수동 Authorization/apikey 주입처 0(H/I) → 신형 키 Bearer 제약 무영향.
- 키 이름: 유지(값만 교체) 확정 → Claude Code 0-mutation.
- 주입 surface=4: (1) local bty-app/.env.local (2) Worker runtime secret SERVICE_ROLE (3) CF Dashboard build env NEXT_PUBLIC_ANON(번들 인라인) (4) GitHub repo secrets(e2e.yml, arena-release-gate.yml). J 스윕(커밋 legacy JWT 값) 종결 → surface 5 부재 확정.
- [S1 closed] 키 신규 발급 불필요 — publishable=default, secret target=bty_supabase_service_prod_202606(노출이력 0, 신규 prod 키) 확정. 단 secret 키 service_role_rotated_2026_05_01 존재(정체 미상, repo 배선 0, Dashboard last-used 미표시) → 미배선 단정 금지, 판정 S7로 이연(트래픽 한 바퀴서 5월 키 잔존 호출 0 확인). S8 disable 대상은 legacy anon/service_role 한정 → 5월 키 미지가 S8 안전성에 무영향.
- [S2 skipped] 로컬 리허설 불가(OAuth prod 리다이렉트) → prod 직행 채택. 안전망=S3 후 prod admin-read 사후검증 + 롤백 anchor 확보. (a)login·(c)RLS 전체검증 S6 이연.
- [S3 EXECUTED] runtime SUPABASE_SERVICE_ROLE_KEY → 신형 sb_secret(bty_supabase_service_prod_202606) 교체 @Version b10d3980(Source=Secret Change, 2026-06-01T15:14:33Z, active 100%; 직전=4d656747=롤백 target; deployments list 자가검증). admin-read 고리: admin organizations UI 페이지 정상 렌더 + rows=2(Washington Group/btyDENTAL-Washington) 관측(executor 보고, HTTP status raw 미수령—페이지 렌더로 대체 판정) → 올바른 키가 올바른 이름에 주입 확정. 잔여: S4 build-inline ANON + S5 재배포 미수행 → publishable/login 경로 아직 legacy 병행 유효.
- [S4 corrected+done] build-inline source = 로컬 .env.local (NOT CF 대시보드 — prod deploy=로컬빌드 `npm run deploy`=opennextjs build/deploy, `wrangler.toml main=.open-next/worker.js`, CF Git-build 아님; STEP-0 recon G "CF 대시보드" 가정 오류 교정). 확인: .env.local ANON=sb_publishable present-grep(이번 턴 재확인) → S4 effectively done, 대시보드 단계 삭제. (SERVICE_ROLE은 S3 runtime 경로 소관, 본 줄 무관.) footgun: 별도 .env가 구 legacy anon 보유하나 .env.local이 Next 우선순위로 마스킹 → 다음 빌드 정상 publishable 인라인; .env.local 삭제시에만 위험 → housekeeping(S7). 잔여 실질작업 = S5 로컬 빌드+배포(publishable을 prod 번들에 실제 거는 단계).
- [S5 EXECUTED+verified] 로컬 빌드+배포 → publishable ANON prod 번들 인라인 live. active 100% = fd9aa5dd(deployments list 검증, 2026-06-02T03:01:08Z deployment; versions-list 추측 아님). 3-way: active fd9aa5dd ↔ inner HEAD 2770600b ↔ worker.js mtime 03:00:51Z빌드→03:01:05Z업로드→03:01:08Z deploy 정합, 신선도 PASS. → login/anon prod 신형 publishable 발효.
- [S6 reported·미검증] executor 브라우저 관측으로 (a)login/(b)admin/(c)RLS 3검증 PASS 보고 — 관측 아티팩트 미전달, 검증수준=executor self-report(Claude Code 미검증). 아티팩트 수령 시 승격.
- [anomaly] S3 이후 미상 Secret Change 3건(deployments list 확정): 67c275ee@2026-06-01T19:03:46Z, 8da7124e@19:03:48Z, b936f458@23:01:43Z (b10d3980@15:14=S3 설명됨). secret 이름 인벤토리 불변(3개) → 신규 키 아님·기존 값 재-put 추정; 정체·사유 미보고 → S7 residual서 규명.
- [S6.5 키검증 PASS·gate red 무관] arena-release-gate.yml 트리거: step0 seedFixtureUser 성공 = 신형 sb_secret service-role 쓰기 PASS + step1 login HTTP 200+Set-Cookie 코드단언 = 신형 publishable PASS. gate full-green은 step2 GET /api/arena/session/next 410 arena_session_next_deprecated(Pipeline N run/start·run/step 이관; stale smoke script, 키 무관)로 BLOCKED → ARENA_RELEASE_GATE_AUTHENTICATED artifact 미생성. 키-검증 목적 충족, 410=회귀 아님 → S7/S8 비차단.
- [S6.5 (A) 근거 확정] gate 실행 전 GitHub repo secret SUPABASE_SERVICE_ROLE_KEY(+ANON) 신형 회전 완료(executor 확인) → step0 seed가 탄 service-role 키 = 신형 sb_secret 확정(legacy 아님), 위 "신형 sb_secret PASS" 근거 보강. surface #4(CI) 신형 전환 완료 → S8 disable이 CI 비파괴. GitHub secret write-only이므로 S7 Dashboard legacy service_role last-used(gate시각보다 과거여야)로 교차확인 예정.
- [S7 재정의] Dashboard per-key last-used UI 부재 확인 → 원안(last-used 관찰로 residual=0 입증) 실행 불가 → disable-as-reversible-test로 전환: legacy disable 후 breakage 관찰, 깨지면 re-enable(Supabase legacy 키 disable은 재활성 가역). residual=0을 *관찰*이 아니라 *무breakage*로 경험적 입증.
- [S7+S8 통합 절차] (1) legacy anon+service_role disable → (2) watch window 동안 prod 핵심경로(login/세션갱신/admin-read/RLS) + CI(arena-release-gate 재트리거) breakage 관찰 → (3) 무breakage=residual 0=S8 종착, breakage=즉시 re-enable+원인추적. 미상 secret 3건(67c275ee/8da7124e/b936f458)도 이 test로 간접 배제(legacy 재주입이었다면 disable 시 해당 경로 깨짐). ⚠️한계: disable-test는 watch 중 *실제 실행된* 경로만 커버 → 저빈도 legacy 의존(주간 cron 등) 슬립 가능 → 3건은 Dashboard last-updated 매칭으로 직접 확인 병행 권장.
- [미상 3건 규명] 67c275ee·8da7124e@2026-06-01 19:03 + b936f458@23:01 = executor 본인 키 회전으로 규명(Dashboard 대조), legacy 키 재주입 아님 배제 확인. → S8 disable이 이 3건 경로 비파괴. (정체 상세=executor attest, Claude Code 미검증; 안전결론=legacy 무재주입.)
- [관측경로 확정] residual 입증 = disable-test(능동 watch) 단일경로 — last-used UI 부재 + 3건 legacy 배제로 사전 last-used 관찰 불필요. 절차: legacy anon+service_role disable → login/admin-read/RLS/CI(arena-release-gate) 즉시 능동 실행 → 무breakage=residual 0=S8 종착, breakage=즉시 re-enable+원인추적.
- [S8 DONE·LANE CLOSED 2026-06-02] legacy anon+service_role disable 완료(Dashboard, executor attest) → transcript 노출 키 무효화 완결(lane 트리거 사고 종결). disable-test: (a)login(publishable)·(b)admin-read(service-role)·(c)RLS 3경로 브라우저 관측 무breakage(executor attest) → residual=0 경험적 입증. re-enable 롤백 가능 유지.
- [종결 증거 provenance] HARD-verified(Claude Code): 4 surface 신형 전환 — S3 secret@b10d3980(deployments-list) / S5 publishable@fd9aa5dd(3-way+mtime) / S6.5 seed+login(코드단언, A 근거) / S6(a) CI(코드단언). executor attest(Claude 미검증): S6(b)(c) 브라우저, S8 disable+무breakage, 미상 3건 legacy 무재주입. 종결 = [기검증 surface 신형] + [attest disable 무breakage] 결합.
- [lane-out housekeeping·키레인 밖 backlog] (1) bty-app/.env fallback ANON 구 legacy 잔존(untracked·.env.local이 마스킹, 미래 빌드 안전상 publishable 정렬 권장) (2) .env.local 중복키 E2E_PASSWORD/E2E_TEST_CLEANUP_SECRET (3) arena-release-gate.sh step2 + .claude release-safety.md "Release Gate Contract"가 deprecated /api/arena/session/next 참조 → Pipeline N(run/start+run/step) 갱신 필요.
- [S6(a) login 증거 승격] 직전 "executor 브라우저 관측·미검증" → "CI 코드단언(arena-release-gate.sh step1: 200+Set-Cookie)"로 승격. (b)admin·(c)RLS는 여전히 executor 보고(미검증).
- [stale backlog·키레인 밖] arena-release-gate.sh step2 + auto-loaded release-safety.md "Release Gate Contract"가 둘 다 deprecated /api/arena/session/next 참조 → Pipeline N(run/start+run/step)로 갱신 필요. 별도 코드/문서 작업.
- 단계: S1 발급 → S2 로컬 리허설 → S3 runtime secret put → S4 CF build env 교체 → S5 풀 재빌드+재배포(3-way + worker.js mtime 신선도 gate) → S6 런타임 3검증(login/admin/RLS) → S6.5 CI secret 회전 + arena-release-gate green → S7 last-used clear 관찰(트래픽+CI 한 바퀴, residual=0) → S8 legacy disable(종착, re-enable 롤백 가능).
- 비가역 지점: S8 전까지 없음.

## LRI/Certified admin surface — LANE CLOSED (2026-06-01)
- end-to-end 라이브 증명 완결(deploy adb4b06a): QR 완료 -> My Page pulse 프롬프트(ActionContractHub 인근) -> 제출 -> le_pulse_log row -> computePulse14d(pulseMean) -> buildCertified/LRIInputs(shared activationDerived14d) -> admin route -> AirTable LRI 0.95/Certified 렌더. dedup(서버 absence, 제출 run anti-join 제외 DB 확인) + strict(.limit 1, 1완료=1프롬프트) 작동.
- 빌드 경로: step1 le_pulse_log migration / step2 pulse.ts / step3 POST+ArenaPulsePrompt / step4 input-assembly(seam1 verified-MWD/14, seam2 reset current-pending-honored, seam3 single-normalize) / step5 admin route(Promise.all, route-owned pending union) / step6 AirTable 컬럼.
- pulse capture: 3회 surface miss(actionTerminalCompletion edge / NEXT_SCENARIO_READY / 실제=My Page) 후 Strategy B(server-signal /api/arena/pulse/pending, surface-agnostic) 채택. arena 2 mount revert. 교훈=capture-point recon은 common runtime completion surface 추적 필수, green static != feature fires.
- security rotation(R-now): OPENAI_API_KEY(구키 revoke) + ARENA_ACTION_LOOP_QR_SECRET(rotate) 완료. CRON_SECRET=prod 미바인딩 미회전.
- D-0 정직(§8): pulse 없는 fresh leader -> LRI pending/"—", Certified 미달. backfill/fake 0.

## BACKLOG (post-launch)
- [HIGH security] Supabase API Key Modernization: legacy service_role/anon(transcript 노출분) 무효화 미완. sb_publishable/sb_secret 전환 -> client 호환 -> env 전환 -> deploy -> legacy disable.
- My Page PostCompletionSheet 외 secondary resolve 경로 pulse coverage(현 ActionContractHub 인근 마운트가 dominant, secondary는 옵션).
- SELF_REPORT_AUTO_APPROVE=true 잔존(wrangler.toml:23) vs submit-validation 주석(canonical auto-approve 제거) = vestigial/의도외 prod-on 의심, 별 확인.
- forced-reset audit table(resetComplianceMet 90d-letter 복원, §4).
- A getLRI + recomputeAndPersistLRI(caller 0) + leadership_readiness_index(빈+cron 부재) 제거 검토.
- buildCertified/LRIInputs + pending route I/O wrapper 단위테스트(현 런타임만).

## LRI/Certified — Strategy B refine: strict + 위치 (B-refine, 2026-06-01)
- strict: pending route .limit(5)->.limit(1). most-recent-1만 평가(과거 미평가 DONE 소급 안 함) -> 1완료=1프롬프트, 연속 프롬프트 제거. computePendingPulseRun/test 무변(일반형 1-element 동작).
- 위치: ArenaPulsePrompt 마운트 standalone(@543) -> ActionContractHub 직후(@498) 이동. 조건 pendingPulseRunId && !pulseDismissed 독립 형제(hub 삼항 밖, 무중첩). 16+/16- pure move.
- walk-through 확정(deploy e45bd6c8): pulse 렌더+제출 200+le_pulse_log row+dedup 정상(제출 run anti-join 제외 DB 확인)+admin LRI 0.95 산출 = end-to-end 라이브. #4 "안 사라짐"=(나) 이전 미평가 run 회수(정상)였고 strict로 정리.
- verify GREEN: tsc 0, pending-pulse 5/5, ArenaPulsePrompt 6/6, MyPageConsole 14/14, terminology=13. Next: 재deploy + strict/위치 실측.

## LRI/Certified — Strategy B arena mount revert (B-3, 2026-06-01)
- ArenaResolveClient + ArenaEntryClient pulse 마운트 제거(각 import 2 + state 1 + mount 1 = 6 순수 제거, 28 del/0 ins). Strategy B 일원화(My Page console 단일 capture) -> arena 2 mount = dead wiring 정리. 양 파일 pre-pulse 상태 복원, 로직 변경 0(ArenaResolve+Entry test 22/22 무회귀).
- arenaFetch 양쪽 pulse-only(ARC:135/AEC:210 단일)라 import 제거 안전. ArenaPulsePrompt 컴포넌트/barrel 무변(My Page console이 사용).
- verify GREEN: tsc 0, ArenaPulsePrompt 6/6, ArenaResolve+Entry 22/22, terminology=13. Strategy B 코드 완결(B-1 endpoint + B-2 console mount + B-3 revert). Next: 재deploy + 런타임 증명.

## LRI/Certified — Strategy B console mount (B-2, 2026-06-01)
- MyPageLeadershipConsole(확정 완료 종단, my-page?arena_contract=resolve): /api/arena/pulse/pending fetch(mount) -> pendingPulseRunId && !pulseDismissed 조건부 ArenaPulsePrompt 마운트. onSubmit -> POST/api/arena/pulse{session_id:pendingPulseRunId}(same-origin 쿠키) + pulseDismissed(세션 즉시 숨김), onSkip -> dismiss. (a) hide-on-both. dedup = 서버 absence(다음 /pending 제외), 클라 가드/null-runId edge 없음.
- test-fix(엄격 scope): "401 retry fails -> loadError" brittle mockResolvedValueOnce 2-entry queue -> URL-aware mockImplementation(형제 line~120 패턴 미러). 신규 /pending = 3번째 fetch라 2-entry queue exhaust -> undefined.then crash 노출. 프로덕션 정상(fetch는 항상 Promise), test-mock brittleness만. state 401 유지(loadError assertion 보존), 나머지 benign 200. 타 테스트/프로덕션 무변.
- ArenaPulsePrompt 무변(6/6). verify GREEN: tsc 0, ArenaPulsePrompt 6/6, MyPageLeadershipConsole 14/14, terminology=13. Next: B-3 arena 2 mount revert.

## LRI/Certified — Strategy B pending-pulse endpoint (B-1, 2026-06-01)
- GET /api/arena/pulse/pending: user-session client(weekly-stats 미러), arena_runs status=DONE(completed_at desc limit 5) ∖ le_pulse_log.session_id -> computePendingPulseRun -> { pendingPulseRunId }. surface-agnostic capture(Strategy B): 서버 absence = dedup, client guard/null-runId edge 소멸.
- pure computePendingPulseRun(doneRunsDesc, pulsedRunIds) = DESC 첫 미평가(recent-5 윈도우), pending-pulse.test.ts 5 cases.
- 배경: pulse capture surface 3회 miss(actionTerminalCompletion edge / NEXT_SCENARIO_READY ArenaEntryClient / 실제 종단=My Page). mount-on-screen 추상화 폐기 -> server-signal. capture-point-common-path 교훈.
- verify GREEN: tsc 0, vitest 5/5, terminology=13. route I/O 미테스트 -> step7 런타임. Next: B-2 console mount + B-3 arena revert.

## LRI/Certified — step 3b-fix pulse capture coverage (2026-06-01)
- ROOT CAUSE: step3b가 pulse를 actionTerminalCompletion(ArenaResolveClient 409-edge sub-path)에만 마운트 -> normal completion(NEXT_SCENARIO_READY -> ArenaEntryClient "Execution recorded")이 우회 -> 대부분 유저 pulse 미수집 -> LRI 영구 pending. runtime 실측이 포착. capture-point recon gap(single render-site는 맞았으나 common completion 종단 미추적).
- FIX: ArenaEntryClient NEXT_SCENARIO_READY 카드에 ArenaPulsePrompt 마운트 추가(common completion 종단). s.runId = 방금 완료 run(Continue 클릭 전, Q4 attribution 정확). runId-keyed guard(pulsedRunId===s.runId) once-per-run + dual-mount dedup(ArenaResolveClient 마운트 유지). 컴포넌트/POST/route/도메인/assembler/admin UI 전부 재사용(무변), 14줄 wiring만.
- verify GREEN: tsc 0, vitest 6/6(ArenaPulsePrompt 무변 무회귀), terminology=13.
- 잔존: My Page PostCompletionSheet(secondary resolve 경로) pulse 미마운트 = follow-on 백로그. SELF_REPORT_AUTO_APPROVE=true 잔존(의도와 어긋남 의심) = 별 확인.
- DEFERRED step7-재: 재deploy + normal completion서 pulse 렌더 + 제출 200 + le_pulse_log row 실측.

## LRI/Certified — step 6 admin UI 컬럼 CLOSED (모든 build step done, 2026-05-31)
- AirTable(page.tsx:273) +2 컬럼 끝 append(Last activity 다음): LRI(헤더 glStageLriLabel 재사용, 값 lriPending||null?"—":toFixed(2)) + Certified(헤더 colCertified 신규, 배지 colCertifiedYes/No + reasonsMissing raw codes title tooltip).
- i18n leadershipMetricsAdmin ns 신규 3키 x3블록(colCertified/Yes/No). LRI 헤더 = M-4 glStageLriLabel 재사용(reinvent 0). badge = 기존 클래스 차용(emerald high / neutral STAGE_COLORS[1], 신규 스타일 0). reason = raw code(매핑키 0).
- 22+/0- pure-additive(기존 키/셀 무변). collision(glStageCertifiedLabel KO/EN 동일) = glMwdWindow locale-specific anchor로 해소. UserAirRow = route import(step5 확장형, drift 0).
- LRI 값 admin-only(requireAdminEmail), end-user 비공개 유지(spec §7B). verify GREEN: tsc 0, terminology=13.
- 모든 build step(1-6) CLOSED. Next: step 7 redeploy + 3-way verify (deferred RLS-own insert 첫 런타임 증명 + P-A->LRI 전체 경로 브라우저 실측).

## LRI/Certified — step 5 admin route 확장 CLOSED (2026-05-31)
- admin/leadership-metrics/route.ts: per-user 루프 -> Promise.all(byUser.entries().map async). UserAirRow +4(certified/certifiedReasonsMissing/lri/lriPending). const asOf=new Date() 루프 전 1회 공유(20명 동일 instant, 14d 윈도우 clock-skew 0).
- 합류 (a) two-wrappers: buildCertifiedInputs->certifiedStatus(cert.current/reasons_missing) + buildLRIInputs->(pending? null : computeLRI(inputs).lri). pending 분기 route-owned, getLRI(B) 미경유(step4 lock). domain-direct 양쪽 대칭.
- cohort=compute-for-all(§5 literal join the loop; leader framing=의미지 행필터 아님). is_leader_track 필터 미도입(role 컬럼 부재 + 무해 admin surface).
- 기존 in-memory 계산(selected/completed/missed/air lifetime/integritySlips/lastActivity) byte-identical(diff -w 입증, 56-=re-indent only). 정렬 air desc = Promise.all 후.
- KNOWN-LIMITATION(§6): 행 키 = bty_action_contracts -> LE activations 있으나 contract 없는 leader 미표시. 행 소스 변경 = 별 lane.
- verify GREEN: tsc 0, vitest 241/241(27파일 무회귀), terminology=13. route per-user assembly = I/O 미테스트(선례 0, heavy mock 회피) -> step7 런타임 실측. Next: step 6 UI 컬럼.

## LRI/Certified — step 4b buildLRIInputs CLOSED (step 4 done, 2026-05-31)
- lri-inputs.server.ts: pure computeLRIInputs(activations, pulseRows, now) -> LRIInputsResult + thin I/O buildLRIInputs. 2 fetch(loadActivationRecordsForUser + le_pulse_log inline select, reader 선례 0).
- DRY (ii): activationDerived14d(activations, now) -> { air14d, mwd14d, noIntegritySlipIn14d } = Certified/LRI 단일 소스(certified-inputs.server.ts에서 추출·export). seam-1 MWD rule + AIR 14d 윈도우 두 지표 간 drift 불가. 4a 7 test 무회귀 = 추출 behavior-identical.
- seam 3: personalResponsibilityPulse = pulseMean(raw 1..5), computeLRI 단일 정규화(mean(2,4)->3 not 0.5, single 5->5 not 1 검증).
- pending(design §3): hasPulse=false -> { pending: true }, 2항 붕괴 없음. union = { pending:true } | { pending:false; inputs }. 분기 소유 = step5 route(r.pending ? null : computeLRI(r.inputs)); getLRI(B) 미경유(GetLRIInputs union 아님 + computeLRI 무조건 호출).
- circular import 0(lri-inputs -> certified-inputs 단방향). verify GREEN: tsc 0, vitest 11/11(4a 7 무회귀 + 4b 4), terminology=13.
- buildLRIInputs I/O = 미테스트 -> step7 런타임. step 4(4-shared+4a+4b) CLOSED. Next: step 5 route 확장.

## LRI/Certified — step 4a buildCertifiedInputs CLOSED (2026-05-31)
- certified-inputs.server.ts: pure computeCertifiedInputs(activations, resetState, now) + thin I/O buildCertifiedInputs(supabase, userId, now). pure/IO split (forced-reset precedent). 2 fetch(loadActivationRecordsForUser + getLeadershipEngineState), MWD는 동일 activations 파생(별 fetch 0).
- Seam 1 MWD: count(micro_win && verified && completed_at in 14d)/14, anchored completed_at(AIR chosen_at와 의도적 상이). 미검증/reset-type/윈도우밖/null-completed 제외.
- Seam 2 resetComplianceMet: current-pending-honored(§4 amendment) — triggered==null->true / now<=resetDueAt(+48h)->true / overdue|dueNull->false. 90d-letter underivable(erase-on-clear, audit table backlog).
- air14d/noIntegritySlip = computeAIR(14d) passthrough. certifiedStatus가 mwd14d>=threshold raw 비교(normalizeMWD는 LRI 경로 전용).
- computeCertifiedInputs.test.ts 7 cases(mock 0, forced-reset 패턴). verify GREEN: tsc 0, vitest 7/7, terminology=13.
- buildCertifiedInputs I/O = 미테스트 -> step7 런타임. Next: 4b buildLRIInputs.

## LRI/Certified — pulse contract pulseNorm->pulseMean (seam 3, 2026-05-31)
- computePulse14d 반환 { pulseNorm } -> { pulseMean } (raw 1..5 mean, 0 when empty). normalizePersonalPulse import 제거 — 정규화는 computeLRI 단일 소유(lri.ts:71), double-normalize 방지(buildLRIInputs가 pulseMean을 raw personalResponsibilityPulse로 전달).
- pulse.test.ts 9 케이스 raw 기대값 전환. pulseNorm 소비처 0(self-contained).
- verify GREEN: tsc 0, vitest 9/9, terminology=13. Next: 4a buildCertifiedInputs.

## LRI/Certified — step 3b ArenaActionCompleted pulse wiring CLOSED (2026-05-31)
- ArenaPulsePrompt.tsx (render-only, placement B): 1-5 + Low/High anchor + t.submit 재사용 + skip, submitted->arenaPulseThanks. i18n arenaRun ns 5키 x3블록(type/KO/EN) 동기. ArenaPulsePrompt.test.tsx 6 cases.
- ArenaResolveClient 종단(:130) 마운트 + page-owned arenaFetch fire-and-forget(void, no await) + session_id: s.runId ?? null. POST 소유=page(레이어 규칙: 공유 컴포넌트 ArenaActionCompleted 무손).
- pulse guard = runId-keyed (NOT boolean): clearPendingContractAndReload(useArenaSession.ts:2071) = soft reset(setActionTerminalCompletion(false)+retryArenaSession, no remount/nav) -> ResolveClient가 시나리오 전반 persist -> boolean이면 2nd+ 시나리오 프롬프트 억제됨. submitted = (s.runId != null && pulsedRunId === s.runId) -> run 변경 시 재출현, once-per-run.
- verify GREEN: tsc 0, vitest 6/6, terminology=13 무회귀(pulse hit 0).
- DEFERRED step7: 첫 RLS-own LE insert 런타임 통과 = post-deploy 브라우저 실측. quick/beginner/session-shell = action-loop 부재 out-of-scope(LRI pending 정직).
- step 3 (3a+3b) CLOSED. Next: step 4 buildCertifiedInputs + buildLRIInputs.

## LRI/Certified — step 3a POST /api/arena/pulse CLOSED (2026-05-31)
- POST /api/arena/pulse: getSupabaseServerClient + auth.getUser (user-session client, RLS insert_own). idiom-a inline guard(typeof number + Number.isInteger + 1..5) -> INVALID_PULSE_VALUE 400. session_id string|null coercion. insert { user_id, pulse_value, session_id } -> 500 error.message / {ok:true} 200. No Zod(단일 bounded smallint, DB CHECK backstop). No synthetic default/auto-fill(DESIGN 2/8).
- route.test.ts 11 cases(401/INVALID_JSON/INVALID_PULSE_VALUE missing+[0,6,3.5,"3"]/200 insert-shape/session_id passthrough/non-string->null/500). verify GREEN: vitest 11/11, tsc 0, terminology=13 무회귀.
- DEFERRED: LE 테이블 첫 RLS-own user-insert 런타임 통과 확인 = step 7 post-deploy 브라우저/curl 실측(tsc green != RLS 통과).
- Next: step 3b ArenaActionCompleted UI wiring (skippable prompt + POST 1회).

## LRI/Certified — step 2 pulse.ts domain CLOSED (2026-05-31)
- computePulse14d(records, asOf) -> { pulseNorm, hasPulse }. 14d rolling mean(pulse_value) -> normalizePersonalPulse(lri.ts:55, 재사용·신규정의 없음). empty/all-out/future -> { 0, false } = LRI pending 신호(2항 붕괴 금지, DESIGN 2/8).
- PulseRecord = minimal { pulse_value, created_at } (ActivationRecord 7필드 재사용 기각). barrel export * from "./pulse" (domain/index.ts).
- verify GREEN: vitest 9/9, tsc exit 0, terminology=13 무회귀(pulse hit 0). inner pair commit.
- errata(lane-close batch): DESIGN_V1 2의 normalizePersonalPulse citation :37 -> :55 (:37은 LRIInputs 필드, 함수는 :55).

## LRI/Certified — step 1 le_pulse_log migration recorded (2026-05-31)
- le_pulse_log applied in prod (empty). 구조(cols / FK on delete cascade / RLS-own / CHECK 1..5 / user_created_idx)는 Commander의 READ-ONLY DB 쿼리(information_schema / pg_constraint / pg_class)로 live 대조 검증됨 — executor는 live DB 직접 관측 안 함. repo<->DB drift 해소용 documenting migration commit (create-if-not-exists + drop-policy-if-exists guard = 재적용 시 no-op).
- File: bty-app/supabase/migrations/20260531000000_le_pulse_log.sql. 적용 재실행 불요. Next: step 2 pulse.ts domain.

## LRI/Certified admin surface — DESIGN LOCKED (2026-05-31)
- Commander LOCK 수령. P-A pulse(세션 종단 1-5 self-rating, 14d rolling -> pulse_norm) + le_pulse_log 단일 migration 승인.
- canonical getLRI = B(spec-formula). A 격리. LRI pending-until-real-pulse, no fake/2-term.
- 설계 단일기준: docs/LRI_CERTIFIED_ADMIN_SURFACE_DESIGN_V1.md. migration application gated.

## M-6 users admin i18n 현지화 + cascade-정확 삭제경고 — CLOSED (2026-05-31) · **admin i18n sweep 완료**

- 문제: /admin/users가 getMessages(adminUsers) 스캐폴딩 보유하나 mainRegionAria 단일 키만 사용 → 35개 렌더 KO(에러/검증 메시지·confirm/alert·폼 라벨·테이블 헤더·참고사항) + ko-KR 날짜 1곳. /en에서도 한글. 파괴적 동작(삭제 confirm, 비번변경 alert) 카피 포함.
- 변경(2파일, +123/-36): i18n.ts adminUsers ns +29키(type/ko/en 3앵커). page.tsx 35개 bare-KO → t.*. deleteConfirm는 {email} placeholder + `.replace("{email}", email)`(confirm 문자열). date locale 조건부. fetchUsers는 컴포넌트 함수(useCallback 아님)라 t closure OK.
- **deleteConfirm cascade 강화**: 최초 "no cascade" 진단은 **오진**(좁은 same-line uppercase grep로 FK 1건만 검출). 재조사(case-insensitive) 결과 auth.users FK ~94건 중 대다수 `on delete cascade`(arena_ledgers/integrity_submissions/user_program_progress 등), 소수 `set null`(verifier_id·leader_approver_id 등 audit 컬럼). 즉 deleteUser → DB cascade로 관련 데이터 삭제 확정. 카피 "계정과 관련 데이터가 모두 삭제되며 되돌릴 수 없습니다 / account and all related data will be removed and this cannot be undone"로 강화(grounded: cascade FK + hard auth.admin.deleteUser). **단, 검증은 마이그레이션 grep 기반 — 라이브 확정은 pg_constraint.confdeltype 조회 권장(후속 ALTER DROP CONSTRAINT 미반영 가능).**
- gate: tsc 0(ko/en parity) / terminology 13→13(무회귀). UI render-only.
- inner-main: 104f2944
- **admin i18n sweep 종료**: arena-membership(M-2)·leadership-metrics+glossary/Stage legend(M-3/M-4)·quality(M-5)·users(M-6) 4페이지 전부 현지화. sql-migrations·debug는 로컬 ko/en dict로 기존 현지화 완료, organizations·login·index·mentor-requests는 이미 getMessages. 잔여 admin 현지화 gap 없음.
- 별건 잔존(미적용): #2 requireAdminEmail fail-open · #3 getIsEliteTop5 500-cap+tie-break · #4 mentor-requests route.ts scope=all stale doc · certified revoke=스케줄 재평가 재계산 · next-lint(ajv) 환경 크래시·deprecated · AdminHeader.tsx dead(importer 0).

---
## M-5 quality admin i18n 현지화 — CLOSED (2026-05-31)

- 문제: /admin/quality가 getMessages(adminQuality) 스캐폴딩 보유하나 mainRegionAria 단일 키만 사용 → subtitle·refresh·loading·DB상태·요약/시그니처/breakdown 헤더 등 18개 렌더 문자열 하드코딩 KO + ko-KR 날짜 1곳. /en에서도 한글·KO 날짜. (리터럴 grep가 inline JSX로 쪼개진 "30일 이벤트:<strong>" 등 4건 + standalone "새로고침" 누락 → full-read로 보강, 최종 17 신규키.)
- 변경(2파일, +67/-16): i18n.ts adminQuality ns +17키(type/ko/en 3앵커). page.tsx 18개 bare-KO 렌더 → t.*. breakdown route/role/intent는 full-phrase 키(어순 회피, suffix-concat 안 함). dbOk/dbDown=Connected/Disconnected. line122 날짜 locale 조건부(en-US/ko-KR). load useCallback deps에 t 추가. SeverityBadge High/Med/Low는 EN 유지(용어충돌 없음).
- gate: tsc 0(ko/en parity 강제) / terminology 13→13(무회귀). UI render-only.
- inner-main: d1b01fa1
- 후속(미적용) admin i18n 잔여 1페이지: users(~33+ko-KR date 1) — 마지막.

---
## M-4 leadership-metrics glossary 현지화 + Stage 탭 legend 신규 — CLOSED (2026-05-31)

- 문제: M-3에서 defer한 glossary 6줄(air/tii/mwd 탭)이 KO-only(TODO 주석). 또 Stage 탭은 legend 부재 → Certified/Leader Track/Forced Reset 컬럼 설명 없음.
- 변경(2파일, +59/-7): i18n.ts leadershipMetricsAdmin ns +16키(type/ko/en 3앵커). glossary 6줄 coarse 현지화(gl*: <strong>토큰은 JSX 리터럴 유지, body만 키화; KO label "완료 기준"만 glDoneCriteriaLabel; line 241 "Team Shift Pulse"→"TSP" 확장 안 함). Stage 탭 신규 legend 3항목(glStage{Certified,Lri,Reset}{Label,Body}) — 코드 기준 검증 copy: certified.ts 4-gate+분기/주간 재평가+revoke부재+Elite와 별개, lri.ts 50/30/20(TII 60/25/15와 구분), forced-reset.ts 2-of-4 트리거+48h. page.tsx TODO(i18n) 제거 + Stage legend 블록(air legend 패턴 복제). 
- gate: tsc 0 / terminology 13→13(무회귀; 신규 EN legend prose lock 미저촉). UI render-only.
- inner-main: 19a63c61
- 후속(미적용) admin i18n 잔여 2페이지: quality(~14+ko-KR date 1), users(~33+ko-KR date 1).
- 참고: certified.ts:6 "Certified ≠ Arena Elite" + revoke는 스케줄 재평가 재계산(별도 transition 없음) — legend에 반영.

---
## M-3 leadership-metrics admin i18n 현지화 + AIR-band 용어충돌 해소 — CLOSED (2026-05-31)

- 문제: /admin/leadership-metrics가 getMessages 미사용·전부 bare KO(~35 문자열) + ko-KR 날짜 5곳 하드코딩 → /en에서도 한글·KO 날짜. 구조상 메인+4 서브컴포넌트(AirTable/StageView/MWDTable/TIITable)가 data prop만 받아 main의 t 도달 불가. 추가로 airBadgeLabel "Certified" 배지가 air≥0.8만으로 4-gate certified.ts와 괴리(용어충돌).
- 변경(2파일, +164/-46): i18n.ts에 leadershipMetricsAdmin ns 신규 29키(type/ko/en 3앵커, +94). page.tsx는 (B)per-component useParams로 메인+4서브 각각 locale/t 도출. 날짜 5곳 dateLoc(locale) 헬퍼로 로케일화. {n}일→{n}{daysSuffix}(일/d). load 콜백 t:Tab 파라미터를 tabKey로 개명(i18n t 섀도 회피). **AIR 배지 Certified/Active/At Risk → High/Mid/Low(ko=en 중립)로 개명하여 용어충돌 코드에서 제거.** glossary 6줄은 TODO(i18n) 주석 달고 KO 유지(defer).
- gate: tsc 0 / terminology 13→13(무회귀). UI render-only.
- inner-main: 3128e71d
- 후속(미적용) admin i18n 잔여 2페이지: quality(~14+ko-KR date 1), users(~33+ko-KR date 1). + leadership-metrics glossary 6줄(TODO).
- 별건 잔존: certified revoke(박탈) 메커니즘 부재(stateless recompute) — M-2 기록 참조.

---
## M-2 arena-membership admin i18n 현지화 — CLOSED (2026-05-31)

- 문제: /admin/arena-membership 페이지가 getMessages(adminArenaMembership) 스캐폴딩 보유하나 mainRegionAria 단일 키만 사용 → h1·설명·테이블 헤더(직군/입사일/리더시작일/요청일/동작)·빈 상태·승인 버튼 등 10개 렌더 문자열이 하드코딩 KO. /en에서도 한글 노출(부분 현지화 gap). 주의: 리터럴 카운트 audit가 sql-migrations(로컬 ko/en dict=현지화 완료)를 오탐, 이 페이지군을 과소평가 → EN-branch 유무로 재감사 후 확정.
- 변경(2파일): i18n.ts adminArenaMembership ns에 11키 추가(type+ko+en 3앵커, Messages 타입이 parity 강제) + page.tsx 10개 bare-KO 렌더를 t.<key>로 교체. line-103 dev 주석 KO는 비렌더라 유지.
- gate: tsc 0 / terminology 13→13(무회귀; pending·tenure 문자열 lock 미저촉). UI render-only.
- inner-main: 16697f77
- 후속(미적용) admin i18n 잔여 3페이지: quality(~14+ko-KR date 1), users(~33+date 1), leadership-metrics(~35 bare+ko-KR date 5·4 서브컴포넌트 threading 필요).
- 별건 발견(미적용): LRI=0.50·AIR_14d+0.30·MWD+0.20·pulse([lri.ts](../bty-app/src/domain/leadership-engine/lri.ts), TII 60/25/15·readiness_score 50/20/30와 구분). certified.ts 4-gate(AIR_14d≥0.80·MWD·reset-compliance·no-slip)지만 **revoke(박탈) 메커니즘 부재**(stateless recompute) + leadership-metrics page.tsx:24 "Certified" 배지가 air≥0.8만으로 certified.ts와 괴리(오라벨).

---
## M-1 AdminNav 멘토 신청 큐 링크 추가 — CLOSED (2026-05-31)

- 문제: 멘토 승인 큐(/admin/mentor-requests) 페이지·API·PATCH 전부 정상이나, 마운트되는 AdminNav의 NAV_ITEMS에 항목 없음. 링크 보유 컴포넌트 AdminHeader.tsx는 importer 0(dead) → 큐가 URL 직접입력 외 도달 불가(승인 절반 미발견).
- 변경(AdminNav.tsx 1줄): NAV_ITEMS에 `{ key: "mentor-requests", label: "멘토 신청" }` 추가(arena-membership 뒤). href는 `/${locale}/admin/${key}` 순수 매핑 → 기존 page.tsx로 해소. active 하이라이트 세그먼트 충돌 없음.
- gate: tsc 0 / terminology 13→13(무회귀, stash 증명) / next-lint 환경 크래시(ajv, 변경무관·repo-wide). UI render-only.
- inner-main: 883332d9
- 잔여(미적용, 동일 recon에서 도출): #2 requireAdminEmail fail-open(authz.ts+admin/layout.tsx, env 미설정 시 노출) · #3 getIsEliteTop5 500-cap denominator+tie-break 부재 · #4 route.ts scope=all stale doc comment.

---
## L-5 TrainProgressCard 진척 카운터 제거 — CLOSED (2026-05-31)

- 문제: 진행중 카피 "(N/28 done)"/"(N/28 완료)" 카운터가 날짜("4월 28일")로 오독 → "4/1 시작?" 계산 모순. 진척기반·L-4 calendar 제거 맥락과 충돌.
- 변경(CenterPageClient.tsx 2 토큰): 진행중 분기 ko/en 카피에서 카운터 토큰만 제거(앞 공백 포함). "오늘은 Day N, 준비됐나요?"/"Today is Day N. Ready?"는 유지(Commander 확인). lcd 변수는 L307/308/312 사용 → 유지.
- 미시작/완주 카피 무관(카운터 없음). 링크/다른 카드/props 무변경.
- gate: tsc 0 / lint 0 / vitest 3398/0/6. UI-only. inner-main: 7b8a7bd7
- 누적: STEP1(카드)+L-1(최상단)+L-3A(unlock 완료체인)+L-SG(server guard+라우트통합)+L-4a(라벨날짜)+L-4c(본문날짜)+L-5(카운터). Commander 스크린샷 증상 전부 해소.

---
## L-4c train 본문 절대날짜 제거 — CLOSED (2026-05-30)

- 문제: day 본문 prose에 PDF 달력 절대날짜+요일("February 9, 2026 (Monday)") 박힘. L-4a 라벨 제거 후에도 본문에 잔존(Day4 화면 "February 10, 2026 (Tuesday)" 노출). 진척기반 모델과 모순.
- residency 확정: 사용자 가시 날짜 = 정본 content/train-28days.en-base.json raw line[1] 1벌뿐. completion-pack(sections 4키만, 날짜 0) + trainContent/CoachChatPane(sections만+orphan) 둘 다 날짜 미출력 → 정본 1벌로 100% 커버.
- 변경(정본 1파일): 28days × raw.en/raw.ko 날짜 line strip(en28+ko28=56). python 멱등 스크립트, day count 28 보존, JSON valid. diff 56/56(escape \n 단일줄 in-place, surgical). sourceDate/title/sections 무변경.
- gate: V0 JSON무결(날짜 잔존 0) + tsc 0 / lint 0 / vitest 3398/0/6. inner-main: fd040210
- 잔여(별 cleanup lane, post-launch, residency 진단됨): content/train-28days.json(completion-pack 소스, date 필드 ISO·미출력), data/train-28days.en-base.json(trainContent·orphan 소비), content/train-28days.en.json(orphan dead), CoachChatPane.tsx/TrainSidebar.tsx/TrainDayClient.tsx(orphan dead code), dead 날짜엔진(getDayLockState/getUnlockedDayCount-eligibility 의존).

---
## L-4a train day 절대날짜 라벨 제거 — CLOSED (2026-05-30)

- 문제: day 콘텐츠에 PDF 달력 스냅샷(2026-02-07~03-05) 절대날짜 하드코딩. 진척기반(option A)에서 unlock은 달력 분리했으나 표시 날짜는 고정 → 오늘 진입자가 "2026-02-07" 봄(드리프트).
- 변경(page.client.tsx 2줄 삭제): L219 sourceDate 라벨 div + L153 dead 변수 lessonDate 제거. main 최상단이 곧장 h1 Day N. 절대날짜 라벨 소멸.
- gate: tsc 0 / lint 0 / vitest 3398/0/6. UI-only(표시 삭제), 데이터/모듈 미삭제. inner-main: c8d14a0c
- 잔여(L-4c cleanup lane, post-launch, residency 진단 선행 필수): 본문 prose 날짜("2026년 02월 08일 (Sunday)" 28일×ko/en JSON 마이그레이션), ruleNote(dead-via-orphan, TrainSidebar:86), TrainSidebar.tsx(orphan), TrainDayClient.tsx(28days/day redirect후 미사용), 콘텐츠 JSON 4벌 중복 정본화, dead 날짜엔진(getDayLockState 진짜dead/getUnlockedDayCount는 eligibility 의존-구분필요).

---
## L-SG train server guard + 라우트 정본 통합 — CLOSED (2026-05-30)

- 문제: day 라우트 2개 병존(/train/day=정본 real content, /train/28days/day=빈 스텁 <div>Day:N</div>), server 게이팅 0 → URL 직타로 잠긴 day/스텁 접근 가능.
- 결정(경로2): 정본=/train/day/[day]. legacy /train/28days/day → 정본 redirect. 잠긴 day 진입 → /{locale}/train/28days 보드 redirect.
- 변경 3파일: (1) day/[day]/page.tsx server 승격 — getUser→admin completions 조회→getUnlockedDayFromCompletions(L-3A 헬퍼 재사용)→day>todayUnlockedDay면 보드 redirect, 통과시 client 본체. (2) 28days/day/page.tsx redirect-only(TrainDayClient import 제거). (3) page.client.tsx:225 카피 드리프트 정정(구 morning-gate "Locked until 5am"→완료체인 "Complete the previous day…").
- guard 헬퍼 단일(getUnlockedDayFromCompletions): Center 카드·client 게이트·server guard 동일 진척 모델. client 본체/useTrain provider(layout TrainShell) 무변경. fail-open(user/admin 미구성시 스킵, progress route 관용 동일).
- gate: tsc 0(Promise<params> Next15 정합) / lint 0 / vitest 3398/0/6. guard·redirect=server component, vitest 미도달 → 배포후 브라우저 실측이 런타임 권위. inner-main: 976030bd
- 범위 밖/격리: TrainDayClient.tsx 미사용 잔존(별 정리 lane), page.client.tsx 파일 전체 i18n 미적용(영문 inline, 한글 누수=기존상태), morning-gate/startDateISO/residency(post-launch), strict fail-close guard.

---
## L-3A train unlock 영구 과잉잠금 해소 — CLOSED (2026-05-30)

- 증상: progress route todayUnlockedDay=1 하드코딩 → Day1 완료해도 Day2 영구 잠금(과잉). 정답 엔진(getDayLockState)은 dead code였음.
- 결정: 옵션 A(completion-chain). N = clamp(lastCompletedDay+1, 1, 28). morning-gate/calendar/per-user 시작일 전부 회피(post-launch).
- 변경 3파일: trainProgress.ts getUnlockedDayFromCompletions 헬퍼(domain, clampDay 재사용) + progress/route.ts 하드코딩 제거·배선 + route.test.ts 기대값(day1→2). scalar 계약 보존 → 클라/TrainShell/CenterPageClient/사이드바 무변경.
- api-handler thin 복구(하드코딩=1이 위반이었음). startDateISO·SELECT·getDayLockState 미터치.
- gate: tsc 0 / lint 0 / vitest 3398/0/6 (progress test 7/7). inner-main: d91c511a
- 범위 밖(별 lane/격리): server-side 진입 guard(URL 직타 차단, page.tsx server 승격 필요 — 다음 lane), morning-gate(익일05:00, TZ·CF Worker UTC 위험), per-user 시작일 residency, getDayLockState 배선, 28days/day 라우트 이원화.

---
## #3 Center 진행 동선 — TrainProgressCard — CLOSED (2026-05-30)

- canonical 28일 계통 = **train** (4-signal 만장일치: assessment CTA→/train/start, hub push→/train/28days, 오늘자 2커밋 active, journey/growth 4/29 동결 dead 의심).
- 해석 = **진척기반(A)**: N = clamp(lastCompletedDay+1, 1, 28). todayUnlockedDay(하드코딩=1) 미사용.
- CenterPageClient.tsx 단일 파일: trainProgress state + /api/train/progress fetch(Promise.all append) + TrainProgressCard(정상 분기, isForcedReset 제외, hasSession 가드).
- CTA: /${locale}/train/day/${N} 직행 + /train/28days 보조. i18n inline 삼항(i18n.ts 미터치). 토큰 dear-charcoal 정합.
- gate: tsc 0 / lint 0 / vitest 3398/0/6(회귀 0). UI-only, release-gate 비대상.
- (후속 L-1) TrainProgressCard를 정상 분기 최상단(header 직후)으로 이동 — 발견성. gate green(tsc/lint/vitest 3398/0/6, 회귀 0, net 0). inner 20aba618. deploy는 L-3 unlock 게이팅과 묶어 1회 배포 보류(현 live cb48d307 = 카드 최하단).
- inner-main: 830f7220
- 범위 밖(격리): 달력기반 N, unlock 엔진 배선(getUnlockedDayCount 미연결), per-user 시작일 residency, journey/growth post-launch quarantine, per-day 완료 모먼트.

---
## mark-complete 루프 end-to-end LIVE-VERIFIED — CLOSED (2026-05-31)
- 3 lane이 엮여 mark-complete 무반응 버그 최종 해결, logged-in 실측 통과.
- 체인: (1) train completion 루프 배선(UI→/completions, progress read,
  매핑 직접) (2) train_day_completions 테이블 실존 확인(STEP2b, migration 불요)
  (3) assessment 50문항 게이트 수정(race+canSubmit+4xx — train 진입 선행조건)
  (4) train auth chunked-cookie 수정(SSR client — logged-in hasSession).
- LIVE 실측(staging c691da24, logged-in): /api/train/progress
  {ok:true, hasSession:true, lastCompletedDay:1, completedDays:[1]}.
  mark-complete 클릭→completions 200→DB 저장→progress SELECT 반영.
  "Train progress not ready" 해소, 완료 표시 전환 확인.
- 닫힌 deferred: 이전 train/A1 lane의 logged-in SSR + 이 lane의 NOT-CLAUDE-VERIFIED
  (RELEASE_GATE_CHECK [TRAIN-AUTH] logged-in 항목) 전부 live-verified.
- 라이브 worker: c691da24 (mark-complete + assessment + auth-fix 3 lane).
- 잔여(별개 lane): #3 Center 진행 동선 UI(assessment 후 매번 안 거치고 진행 중
  28일로 직접 — completion 데이터 이제 실DB 조회 가능하니 구현 가능).
- carry-forward: auth-server.ts 수동 파서 chunk 버그(train만 우회) / admin/quality
  localhost fallback / /api/version stale / CoachChatPane non-contiguous /
  logged-out /en 한글 fallback shell(EN T3 계열).

---

## train auth chunked-cookie 수정 (SSR client 전환) — CLOSED (2026-05-30)
- 증상: logged-in인데 train day 페이지 "Train progress not ready"
  (/api/train/progress 200 hasSession:false). mark-complete 도달 불가.
- 근본원인(AD 진단): train만 getAuthUserFromRequest 수동 쿠키 파서 사용
  (find includes("-auth-token=")) → Supabase chunked 쿠키
  sb-<ref>-auth-token.0/.1 미인식 → token null → logged-out 분기.
  앱 전역(assessment/arena 46라우트)은 SSR client(@supabase/ssr,
  cookieStore.getAll())로 chunk 자동 재조립 → 정상. train만 비대칭.
  read(progress)+write(completions) 둘 다 같은 파서 게이트 → train 기능
  전체 logged-in 무력. STEP9 live verify는 logged-out만 봐서 미검출.
- 수정(A: SSR client 표준 수렴): train 2라우트를 getSupabaseServerClient()
  .auth.getUser()로 (token 미전달 → 어댑터가 chunk 재조립). progress GET()
  (request 불필요), completions POST(request) 유지(body). SELECT/upsert/응답
  /503·500·401 분기 전부 보존 — auth 메커니즘만 교체.
- test: progress 7 + completions 9, SSR client mock으로 재작성.
- 검증: tsc 0 / lint 0 / vitest 3398/0/6.
- carry-forward: auth-server.ts getAccessTokenFromCookieHeader 수동 파서의
  chunk 미지원 버그는 미수정(train만 국소 전환). 다른 소비처가 같은 버그
  겪으면 광역 수정(전역 SSR client 통일) 검토.
- 배포: 코드 inner 880dbf4e. deploy 별도(다음). logged-in 실측이 핵심 검증.
- inner 880dbf4e / outer <이 커밋>.

---

## assessment 50문항 게이트 (race + 미완제출 + 4xx 노출) — CLOSED (2026-05-30)
- 증상: 50문항 자존감 진단 제출이 "answers_count_mismatch: expected 50, got 31"
  400으로 거부 → "No result found / Go to assessment" fallback. 28일 train은
  이 진단 통과 후 진입하는 게이트라, 진단 실패 시 train day(mark-complete)까지
  도달 불가. (train mark-complete 코드는 assessment와 독립 — 별개 게이트 문제.)
- 근본원인(L2-0 진단):
  · race(B): AssessmentClient 옵션 onClick auto-advance setTimeout(280ms) +
    bottom Next + goPrev 세 nav 경로가 advance 가드 없음 → 빠른/중복 클릭 시
    setCurrentIndex 다중 큐잉 → 문항 skip → 미답 → answeredCount<50.
    회귀 아님(a746c07a부터 잠재, 타이밍 의존). 데이터 정상(en/ko 둘 다 50).
  · 미완제출(A): canSubmit(answeredCount===total) 계산되나 미사용(dead code).
    submit 버튼 disabled={!canGoNext}로 현재 문항만 확인 → 미완 payload 서버 도달.
  · silent(C): res.ok 실패해도 무조건 result push → 무효 데이터 client 오결과.
- 수정(코드 1파일 AssessmentClient.tsx, 서버 strict-50 보존):
  · B: 세 nav 경로 단일 autoAdvanceTimeoutRef 공유·상호 clear + unmount cleanup
    → pending advance 최대 1개, skip 구조적 불가.
  · A: 버튼 disabled isLast 분기(!canSubmit) + handler answeredCount!==total
    가드(서버 호출 전) + N/total 미완 안내.
  · C: 4xx(validation 거부)는 push 차단 + submitError alert(mismatch 친화 안내).
    5xx/network는 의도된 오프라인 client 채점 fallback 보존(result/ResultClient
    client-side scoring) — push 유지.
- test: AssessmentClient.test.tsx 신규 5케이스(완주/race/미완/4xx/5xx-fallback).
  race 가드(B)와 5xx fallback 보존(C)이 회귀 lock.
- 검증: tsc 0 / lint 0 / vitest 3398/0/6 (3393 +5 신규).
- 효과: 정상 사용자 50문항 완주→제출 / 빠른클릭 skip 불가 / 미완 submit 차단+안내
  / 4xx 노출 / 5xx fallback 보존.
- 배포: 코드 inner 8bfe4588. deploy 별도(다음).
- carry-forward: (이전) train_day_completions CREATE TABLE drift / CoachChatPane
  non-contiguous semantic. (신규 없음 — 이 lane은 단일 파일 클로즈.)
- inner 8bfe4588 / outer <이 커밋>.

---

## 28일 train day-completion 루프 수정 — CLOSED (2026-05-30)
- 증상: /train/day/[day]에서 "Mark today as complete" 눌러도 무반응,
  완료 피드백/완료표시 없음. "Completion summary: No summary yet" 유지.
- 근본원인(3고리 끊김, STEP0+0b 진단):
  (c) UI가 stub /api/train/complete(단수, write 없음) 호출. canonical write
      /api/train/completions(복수)는 orphan(caller 0).
  (f) /api/train/progress read가 completedDays=[] 하드코딩, auth 없음.
  (e) revalidate는 정상이나 read가 []만 줘서 isCompleted 영원히 false.
- 테이블: train_day_completions가 실 DB에 이미 존재(STEP2b 직접 조회 —
  컬럼 user_id/day(1-28 CHECK)/completed_at, PK(user_id,day), RLS own-row
  전부 코드 가정과 일치, row_count=1). 마이그레이션 불필요. repo CREATE TABLE
  부재는 drift(arena_level_records 패턴) — carry-forward.
- 수정(코드만, migration 0):
  · 5-1: UI 2곳(TrainShell:82, TrainSidebar:42) URL /complete→/completions.
  · 5-2: 단수 stub route+test 삭제, 단수 day-validation edge(비숫자/상한29)를
         completions test로 흡수(+2, 8→10케이스).
  · 6-1: progress route auth(getAuthUserFromRequest) + admin SELECT
         (.eq user_id, RLS우회 client 보안필터) + completedDays 실배열
         + lastCompletedDay=max. logged-out=hasSession:false(401 아님, B:i).
         unlock(todayUnlockedDay=1) 보존(C:P, 범위 밖).
  · 6-1b: progress test 7케이스 재작성(1,2,3 / non-contiguous 1,3 / no rows
          / logged-out / DB error / admin null / shape). non-contiguous 배열 lock.
  · 6-2: TrainShell 매핑 completedDays 직접 사용([1..N] 재생성 제거).
         lastCompletedDay/todayUnlockedDay 파생 보존(CoachChatPane:63 등 소비처).
- 검증: tsc 0 / lint 0 / vitest 3393/0/6 (3400 −8 단수 +2 보강 −8 progress구 +7 신규).
- 효과: mark-complete→/completions upsert→/progress SELECT→실배열→매핑 직접
  →isCompleted 정확→revalidate→화면 반영. non-contiguous gap-fill 버그도 해소.
- carry-forward:
  · train_day_completions CREATE TABLE 마이그레이션 부재(실 DB엔 존재) —
    repo drift 정합. forward-only doc migration 또는 ledger 기록(STEP1a draft
    준비됨). arena_level_records 패턴. 런타임 blocker 아님.
  · CoachChatPane:63 lastCompletedDay>=day로 summary 가용 판단 — non-contiguous
    semantic 별개(이번 범위 밖). 검토 후속.
- 배포: 코드 inner c24bc4b4. deploy는 STEP 8(cf:deploy) 별도. 발표 수요일.
- inner c24bc4b4 / outer <이 커밋>.

---

## B Deploy — train EN body + A1 LIVE — CLOSED (날짜 2026-05-30)
- 배포: cf:deploy (deploy-only, STEP1-gated 번들 그대로, 재빌드 없음).
  Worker 5d0624d9 → 8b698d79-689d-4f94-945c-26b8d5a66a40 (active 100%).
  rollback anchor: 5d0624d9.
- 내용: train EN body(8584bca3) + A1 root <html lang>(576f43b3), 4파일.
  migration 없음 (worker-only deploy). binding drift 없음.
- 3-way verify: (1) active version 8b698d79 (deployments+versions list 일치)
  (2) git HEAD inner 576f43b3/outer 243a214 (3) 런타임 SSR 실측.
- A1 LIVE-VERIFIED: /ko→lang=ko, /en→lang=en, protected logged-out 307→
  locale-correct login(en), 양방향 cross-check. logged-in /en/train 화면
  EN 확인(스크린샷) → A1 deferred(logged-in SSR lang) CLOSED.
- train EN body LIVE: logged-in /en/train/day/1 본문 EN 확인(스크린샷,
  "Start Noticing Self-Criticism" 등). curl은 auth-gate라 inconclusive였으나
  logged-in 화면으로 직접 확인.
- auth smoke: logged-out redirect+next= 보존 불변, 회귀 없음.
- carry-forward:
  · src/app/api/admin/quality/[[...path]]/route.ts:6 — NEXT_PUBLIC_BTY_AI_URL
    || "http://localhost:4000" source fallback. admin-only RBAC, fa0b86d6부터
    live, train+A1 delta 무관. prod 실호출 여부 확인 후 hardening/제거 검토.
  · /api/version이 배포 시 BTY_DEPLOY_VERSION/BUILD_TIME(2026-04-27 static)
    안 bump → single live-state signal 신뢰 불가 invariant 재확인. SSR 거동이
    진짜 런타임 증거. 배포 버전 echo하도록 개선 검토(post).
- 발표 수요일 연기 → D-freeze 압박 해제.

---

## A1 root <html lang> SSR locale — CLOSED (D-4 · 2026-05-29)
- 증상: root layout이 SSR HTML에 lang="ko" 하드코딩. /en도 hydration 전까지
  lang="ko" → SEO/크롤러/스크린리더 pre-hydration KO 오인. SetLocale client
  useEffect(hydration 후 patch)만 보정 → SSR 미해결.
- 근본원인: root layout.tsx:23이 [locale] segment 밖이라 locale 미인지.
  middleware getLocale은 response header에만 (Server Component 못 읽음).
- 수정(Option A-full): middleware가 getLocale(pathname) 결과를 forward REQUEST
  header `x-locale`로 주입 (NextResponse.next({request:{headers:requestHeaders}})),
  L97 locale 단일 재사용, content-serving 6 exit 전부. root layout async →
  (await headers()).get('x-locale') ?? 'ko' → <html lang={locale}>.
- 범위: #2 resLogin / #6 res = createServerClient cookie writer 응답 라인,
  ADDITIVE header-forward ONLY (cookie/setAll/session/redirect/matcher 불변).
  release-gate-touching.
- 검증: tsc 0 / lint(tsc) 0 / vitest 3400/0/6. SSR raw curl /ko→ko,
  /en·protected /en/*→en (logged-out 307→locale-correct login, lang 양방향
  cross-check). auth smoke: logged-out redirect+next= 보존 불변.
  logged-in SSR lang = #2 resLogin 동일 메커니즘으로 structurally-inferred
  (로컬 OAuth가 prod redirect라 직접관측 불가, browser-confirm B-lane defer).
  cookie persistence = setAll 미접촉, diff 보장.
- out-of-scope 관측: lint:eslint ajv defaultMeta 에러 pre-existing
  (next lint deprecation path), A1 무관.
- inner 576f43b3 / outer (this ledger commit).

---

## EN T3 — 28-day train body wired to bilingual EN/KO source (locale pick) — CLOSED (D-4 · 2026-05-29)

**Active head (D-4 / 2026-05-29):** inner `8584bca3` (parent `702a9e3d`) · outer (this ledger commit, parent `1bdd5d5`). **Cloudflare Version:** last known `5d0624d9-701e-401b-84cd-4842295395cb` UNCHANGED — **deploy deferred (B)**; no deploy executed for this lane, so this change ships with the next deploy. **Working tree:** clean after commit (both repos).

**EN T3 (train body)**: [x] **완료 (코드, 배포 보류).** Symptom: EN launch but `/[locale]/train/day/[day]` lesson body rendered entirely in Korean (buttons/labels were EN via i18n; only the lesson body leaked KO). **Root cause:** `page.client.tsx:8` imported flat `@/content/train-28days.en.json` (filename-only EN; payload all-KO, md5-identical to the KO base `train-28days.json`), and `:148` looked it up locale-agnostically (`raw: string`, no `{en,ko}`, no locale branch). A v2 bilingual source existed (`content/train-28days.en-base.json`, `{meta, days{title/sections/raw: {en,ko}}}`) but was an orphan — the resolver `getDayContent` (reads the `data/` copy) had zero consumers. Cursor had populated 28-day EN translations into `content/train-28days.en-base.json` (en field), ko preserved — verified 28/28 genuine EN. **Fix (2 files, +211/-206):** (1) `content/train-28days.en-base.json` — 28-day EN translations (Cursor-authored, in-place; ko preserved). (2) `page.client.tsx` — import `@/content/train-28days.en-base.json`; add `LocStr`/`BiDay` types + `pick(x)=x[locale]??x.en??x.ko`; resolve title/raw/sections by locale; `date`←`sourceDate`. Now `/en` renders English, `/ko` renders Korean (new locale branch for lesson body). **Claude-verified:** `tsc` 0, `npm run lint` 0, vitest 3400/0/6 (no regression). inner `8584bca3`.

**Cleanup:** removed orphan duplicate `src/data/train-28days. bilingual.json` (untracked, literal-space filename, byte-identical EN to `content/en-base.json`; never imported).

**Deploy decision (B):** not deployed standalone. `702a9e3d..8584bca3` = this train commit only; ships with next deploy bundle. `.env.local` dev-vars already all-commented (no pre-deploy edit needed). worker `5d0624d9` unchanged.

**Closure 판정:** EN T3 train-body CLOSE (code green, deploy deferred).

**Carry-forward (updated):**
- **★ Deploy** EN train body with next bundle — `.env.local` dev-vars already commented; standard cf:build→wrangler→3-way verify.
- Orphan/legacy cleanup [post-launch, after import verification]: `data/train-28days.en-base.json` + `getDayContent`/`trainContent.ts` dead path + `content/train-28days.en.json` + possible KO base cleanup if no active import remains.
- EN T3 나머지: score.ts domain KO (domain-purity), root layout `lang="ko"` SSR default, not-found.tsx KO, train/28days hub KO, auth callback:168, app/page.client.tsx /app nav KO.
- (carry from prior) Manager QR issuance, Owner realtime ✓, arena_level_records repo-migration realignment, verified-history/analytics.

---

## QR Verification Session 안2-B (multi-QR list, dormant-by-data) + #1 (scanner banner, active) — CLOSED (D-4 · 2026-05-29)

**Active head (D-4 / 2026-05-29):** inner `702a9e3d` (parent `4cd22ca4`) · outer `b3479b8` (parent `32298aa`) + this ledger commit. **Cloudflare Version:** `5d0624d9-701e-401b-84cd-4842295395cb` (active 100%, deployments-list cross-verified). **Working tree:** clean (both repos).

**안2-B + #1**: [x] **완료.** Shipped: plural `fetchAwaitingVerificationContractsForMyPage` (status in [approved,submitted] + validation_approved + verified_at null, no limit) + state-route field `awaiting_verification_contracts[]` (type + identity payload Promise.all + route assembly) + `AwaitingQrList` component (per-item action_text/deadline/source + personal|manager tier label + per-item Show QR) + `handleRequestQrForContract(contractId)` (mints by contract, reuses the hoisted shared `ActionLoopQrPanel`, last-click-wins) + logged-out scanner confirmation banner. 8 files +313/-3, additive (singular Hub + 안2-A surface untouched). **Claude-verified:** `tsc` 0, vitest 3400/0/6 (+5 plural-fetch regression). inner `702a9e3d` / outer `b3479b8` / Cloudflare `5d0624d9`.

**#1 scanner banner = ACTIVE (Commander 실증):** logged-out re-scan of a deep-link → "This action is already verified" banner (was a blank page = witness gap). ✓verified / already / failed (action_validation_required / run_actor_token_mismatch / contract_not_pending) all supported.

**안2-B multi-list = DORMANT BY DATA (not a defect):** singular and plural fetches draw from the **same** awaiting set (identical filters), and the system holds **≤1 unverified contract at a time** — the `blocked_by_open_contract` invariant (status ∈ pending/submitted/rejected/escalated is blocking → middleware gates new Arena runs) prevents concurrent personal contracts, and **no `manager_only` producer exists** (all 4 creation sites hardcode `verification_tier="mvp_open"`; `manager_only` appears only in the AwaitingQrList consumer). With 1 awaiting contract = the Hub's `open_action_contract`, the dedup (`c.id !== open_action_contract?.id`) empties the list → `AwaitingQrList` returns null. Code correct + forward-ready; the data condition (2+ concurrent unverified) is structurally unreachable today. Regression 0.

**Launch decision:** the single-contract path (안2-A Hub + single QR + 안1 re-exposure + P1 loop) suffices for launch. The 안2-B list auto-activates once manager issuance exists.

**Closure 판정:** 안2-B CLOSE (dormant-by-data, forward-ready) + #1 CLOSE (active).

**Carry-forward (updated):**
- **★ Manager QR issuance** (`manager_only` `verification_tier` producer side) = the trigger that activates the 안2-B multi-list. Currently all 4 creation sites stamp `mvp_open`. Post-launch.
- **★ Owner realtime ✓** (owner My Page auto-refresh on scan) — post-launch.
- verified-history list / analytics / `arena_level_records` repo-migration realignment / EN T3 (28일 train body KO first).

---

## arena_level_records drift — RESOLVED DB-side (column-name mismatch, no repo commit) (D-4 · 2026-05-29)

**Active head (D-4 / 2026-05-29):** no code commit (DB-only hotfix); worker `44751b0b-6ad7-4ddf-aff2-2102d94c8385` unchanged (already expected the code column names). Commander SQL hotfix applied out-of-band. **Working tree:** clean (both repos); the staged STEP-1 migration file was discarded.

**arena_level_records drift**: [x] **완료 (DB-side).** Symptom: `qr/validate` level record update failed at runtime ("column does not exist") → `consecutive_verified_completions` never incremented = **band progression silently stalled** (verify / run-done / XP / AIR all succeeded). **Root cause:** the live table diverged from the CREATE TABLE migration (`20260431240000`) — the real column was **`last_evaluated_at` (DB)** vs **`last_evaluation_at` (code-expected)**; a column-NAME mismatch, not a simple absence. Further divergence noted: PK `id` (DB) vs `user_id` (migration), `integer` vs `smallint`, default `'L'` vs `'mid'` — the table was created **outside the migration path**. **Fix (Commander SQL hotfix, no redeploy):** (1) ADD COLUMN `last_band_change_at` (genuinely absent); (2) a combined `ADD COLUMN IF NOT EXISTS` attempt **created** `last_evaluation_at` as a NEW column → duplicate (`last_evaluated_at` + `last_evaluation_at` coexisting); (3) diagnosed as a name mismatch — confirmed `last_evaluated_at` all-NULL → `DROP COLUMN last_evaluated_at`; (4) table column names now match the code; verified via `information_schema`. **Verified GREEN (Commander tail 9:08:45):** `qr/validate` → `awaitingVerification:true` → `arena_run_done_after_contract_verify`; "level record update failed" gone.

**Closure 판정:** level_records drift RESOLVED DB-side (runtime green). Repo-migration realignment deferred (separate, post-launch).

**Lesson (recorded):** prescribing "add the missing column" **without `information_schema` ground-truth** nearly worsened a column-NAME mismatch into a **duplicate column** — `ADD COLUMN IF NOT EXISTS` does not match a differently-named existing column, it creates a new one. **Verify the real schema, then mutate.** (The earlier STEP-0 diagnosis inferred absence from the runtime error alone; the live-schema query was the missing step.)

**Carry-forward (updated):**
- **★ arena_level_records repo-migration realignment** [post-launch] — the live DB differs from the CREATE TABLE migration (column names / PK / types / defaults). A separate alignment migration must reconcile the repo to the actual DB state. **Do NOT edit the original CREATE TABLE (`20260431240000`)** — forward alignment migration only. The discarded STEP-1 file (single-column, didn't reflect this divergence) is not a usable base.
- **★ 안2-B (multi-QR session surface)** [Commander launch target] + **★ #1 scan-confirmation UI** (bundle).
- EN T3 (28일 train body KO, score.ts, root layout lang, not-found, train/28days, auth callback:168).

---

## QR Verification Session 안2-A (surface) + 안2-A2 (placement) — CLOSED (single-QR normalized) (D-4 · 2026-05-29)

**Active head (D-4 / 2026-05-29):** 안2-A inner `ec360b6c` / outer `559fb9e`; 안2-A2 inner `4cd22ca4` / outer `8c4ee32` + this ledger commit. **Cloudflare Version:** `44751b0b-6ad7-4ddf-aff2-2102d94c8385` (active 100%, deployments-list cross-verified). **Working tree:** clean (both repos).

**안2-A (surface bug)**: [x] **완료.** `openActionContractForMyPage` awaiting query + expiry sub-branch: `.eq("status","approved")` → `.in("status",["approved","submitted"])`. Canonical submit-validation leaves the contract at `status=submitted` + `validation_approved_at` set + `verified_at` null, but the awaiting query matched `approved` only → the submitted contract was invisible → an older verified contract surfaced via the terminal query as **"Execution recorded / Next scenario unlocked"** (stale) + the 안1 button was unreachable (inert). Gate preserved (`validation_approved_at` not null, `verified_at` null); terminal query untouched; `toDisplayState` unchanged. Regression test (3 cases: submitted surfaces over stale terminal / approved+verified still terminal / awaiting query-build assertion). **Claude-verified:** `tsc` 0, vitest 3395/0/6 (+3). inner `ec360b6c` / outer `559fb9e`.

**안2-A2 (placement bug)**: [x] **완료.** `ActionLoopQrPanel` rendered 3 sections below the button (under `PostCompletionSheet`) → on mobile it appeared off-fold → "QR 안 나옴" perception **though mint returned 200** (tail-confirmed). Hoisted the panel directly under `ActionContractHub` + `useEffect` `scrollIntoView` on `qrPanelOpen` open (optional-chained `?.scrollIntoView?.()` for jsdom/absent-method safety). Sibling order (PatternSignature/secure-link/PostCompletionSheet) preserved; mint/validate/panel logic + state wiring unchanged. **Claude-verified:** `tsc` 0, vitest 3395/0/6. inner `4cd22ca4` / outer `8c4ee32`.

**Probe GREEN (Commander):** awaiting card "AWAITING VERIFICATION" + "Complete by QR" button shows (안2-A) → click → QR appears directly under the button + auto-scrolls into view (안2-A2); stale "Execution recorded" gone.

**Closure 판정:** 안2-A + 안2-A2 CLOSE (single-QR flow normalized).

**Re-evaluation / corrections:**
- **`action_completed` red-herring resolved:** `verification_type="action_completed"` is the **canonical QR-eligible** type for ~all arena contracts (paired `verification_mode="hybrid"`). The button gate reads `verification_mode` (hard-set "hybrid") → passes — **not** a type mismatch. Hiding QR for `action_completed` would have broken the entire QR flow (wrong direction, avoided).
- **안1 re-evaluated as inert-until-안2-A:** the 안1 awaiting-card QR button (`6ea159e7`, deployed `8416ba48`) was unreachable on its own because the awaiting query dropped `submitted` contracts; 안2-A is what surfaces the card and makes 안1 effective. 안1-alone deploy had no runtime effect.

**Carry-forward (updated):**
- **★ 안2-B (multi-QR session surface)** [Commander launch target] — My Page list of multiple unverified QRs + personal/manager split (`verification_tier`: mvp_open/manager_only) + per-item action_text/deadline/source + per-item QR. New plural fetch + state-route field + list component.
- **★ #1 scan-confirmation UI** — logged-out scanner my-page landing needs a validate-result block (✓verified / already / failed). Same console/lifecycle as 안2-B → bundle recommended.
- **★ `arena_level_records.last_band_change_at` column drift** — `qr/validate` level update fails at runtime (verify/run-done succeed). Migration-first.
- EN T3 (28일 train body KO, score.ts domain KO, root layout lang, not-found, train/28days, auth callback:168).

---

## QR Re-exposure 안1 + P1 Full-Loop — CLOSED (post-approve re-exposure + external-scan closure) (D-4 · 2026-05-29)

**Active head (D-4 / 2026-05-29):** inner `6ea159e7` (안1 STEP 1 atomic 1-file, parent `c11ee4b8`, pushed origin/inner-main) · outer `53062f8` (mirror, parent `5436efe`, pushed origin/main) + this ledger commit. **Cloudflare Version:** `8416ba48-5256-454a-bd36-a0875cc9e603` (active deployment, Claude-read via `wrangler deployments list`; supersedes Scanner `fc03cbb5`). **Working tree:** clean (both repos).

**QR Re-exposure 안1**: [x] **완료.** ActionContractHub `action_awaiting_verification` card gained a QR re-exposure button (gated `verification_type ∈ {qr, hybrid}`, reuses existing `onRequestQr` → `handleRequestQr` → mint `approvedAwaiting` branch → `ActionLoopQrPanel` re-opens). Fixes the post-approve dead-end: the QR was ephemeral `useState` (lost on navigation) and the awaiting card had no re-exposure entry point. On-demand re-mint (token stateless, contract row is source); no URL persistence; reused existing i18n `btnQr`; additive 1-file. **Claude-verified:** `tsc` 0, vitest 3392/0 failed. **Commander-observed:** "Complete by QR" button now renders on the awaiting card (absent pre-deploy). inner `6ea159e7` / outer `53062f8` / Cloudflare `8416ba48`.

**P1 Full-Loop closure**: [x] **완료.** Action→QR→External-Scan→Verification→Progression proven end-to-end at runtime. **Claude-verified (wrangler tail capture):**
- **Scan A (5:25:34 / 5:29:38, logged-in):** `POST qr/validate` → `[qr/validate] contract status before transition { awaitingVerification: true }` → `arena_run_done_after_contract_verify` (verified_at write path).
- **Scan B (5:37:30, LOGGED-OUT, deep-link):** `GET /my-page?arena_action_loop=commit&aalo=… → Ok` while at the same instant plain `/my-page`, `/center`, `/bty-arena`, `/bty/foundry`, `/bty/leaderboard`, `/my-page/{progress,team,leader,account}` all → `…/bty/login?next=…`. **Only the 3-condition deep-link bypassed** = logged-out middleware isolation definitively proven. `POST qr/validate` reached; contract `19b508d0` status `approved` / `awaitingVerification: false` → re-write skipped = double-verify-prevention gate working.
- Combined: full progression chain + logged-out bypass runtime-proven.

**Closure 판정:** 안1 CLOSE + P1 CLOSE (동시).

**Carry-forward:**
- **★ Scan-confirmation UI absent [NEW, launch UX]:** a logged-out scanner landing on `/my-page` gets no verification-result feedback (the page is empty — logged-out my-page data is correctly blank). Witness-experience gap; needs a scan success / already-verified / failure result screen.
- **★ `arena_level_records.last_band_change_at` column absent [NEW, migration drift]:** `qr/validate` level update failed — tail (5:25/5:29/5:37) logs `column arena_level_records.last_band_change_at does not exist` (Claude-verified). verify + run-done succeeded; level/band update partially failed. Migration-first invariant.
- 안2 multi-QR (concurrent unverified contracts) — post-launch.
- EN T3 backlog (28일 train body KO, score.ts domain KO, root layout lang, not-found, train/28days, auth callback:168).

---

## Scanner Public Access Fix — CLOSED (middleware exception · A) (D-4 · 2026-05-29)

**Active head (D-4 / 2026-05-29):** inner `c11ee4b8` (STEP 3 atomic 2-file, parent `2bf81b5e`, pushed origin/inner-main) · outer `d0844f9` (mirror, parent `5fd52b0`, pushed origin/main) + this ledger commit. **Cloudflare Version:** `fc03cbb5-a87b-492b-a4d0-cd11a5459c07` (Commander-provided; no Claude deploy access). **Working tree:** clean (both repos).

**Scanner Public Access Fix (middleware)**: [x] **완료.** Restores mvp_open principle 5 (scanner identification: anyone / optional auth). Narrow middleware exception — a logged-out scanner reaching `/{locale}/my-page?arena_action_loop=commit&aalo=<token>` deep-link is allowed through ONLY when all 3 conditions hold simultaneously (path == `/{locale}/my-page` AND `arena_action_loop=commit` AND `aalo` present). `isPublicPath`/auth/consent/matcher untouched; subpath + any missing-condition case still hits the 307 login wall. **Claude-verified:** `middleware.ts` +9/-0 + new `middleware.aalo-public-scan.test.ts` (6 assertions); `tsc --noEmit` exit 0; vitest 3392 passed / 0 failed / 6 skipped (+1 test file); targeted middleware unit 6/6. **Commander-verified (no Claude DB/deploy access) — Probe P2 (release safety) RUNTIME GREEN:** logged-out general my-page → 307 login wall held (tail). Bypass correctness corroborated by unit 6/6 + provenance URL-format match (mint `action-loop-token/route.ts:172`) + secret `ARENA_ACTION_LOOP_QR_SECRET` present + mint Ok (tail 4:45:16) + `validation_approved_at` SET (tail 4:45:11). inner `c11ee4b8` / outer `d0844f9` / Cloudflare `fc03cbb5`.

**Closure 판정:** middleware exception lane CLOSE (A).

**Carry-forward (separate lanes):**
- **P1 full-loop end-to-end** (`qr/validate` → `verified_at`) belongs to the validate-route domain — split out, not part of the middleware exception lane.
- **★ QR Verification Session gap = launch blocker (new lane):** after `approve_action_contract` the contract maps to `action_awaiting_verification` (`toDisplayState` `approved`→awaiting), which `ActionContractHub` renders as a button-less card — no Request/Show-QR action — and the QR panel is ephemeral client state (`qrPanelOpen`/`qrUrl` reset on mount) → **no re-exposure path** once approved. Multi-QR (re-issue) also unsupported.

---

## Client QR Render Fix — CLOSED (UI invariant) (D-5 · 2026-05-28)

**Active head (D-5 / 2026-05-28):** inner `5a0174b4` (STEP 3 atomic 6-file, pushed origin/inner-main) · outer `f767e04` (mirror, pushed origin/main) + this ledger commit. **Cloudflare Version:** `9df62778-5afa-4777-8a2a-2b1e30b8a194`. **Working tree:** clean (both repos).

**Client QR Render Fix (UI-side)**: [x] **완료.** External-witness QR now renders instead of self-navigating the actor's browser to the commit deep-link. One shared `<ActionLoopQrPanel>` (props `url`/`onDismiss`/`locale`) consumed by both Arena resolve and My Page = UI system invariant. 1A new component / 1B `useArenaSession` self-nav (`window.location.assign`) removed → state exposure / 1C `ArenaResolveClient` wiring / 1D MyPage DRY refactor. With L5+L6 C5 server invariant, Spec v2 §3.5 realized at both layers. Probes 1+2+3 GREEN (Cloudflare `9df62778`). Tests 3386/0/6 (+8); `tsc` clean. inner `5a0174b4` / outer `f767e04`. **Open:** (i) qr-debug-value URL-hide micro NEXT; (ii) manual self-vector → L4. **Next:** URL-hide micro → L4 STEP 0 (tier-aware `qr/validate` self-scan hardening + `verification_confidence` write).

---

## L5+L6 QR Issuance Alignment — CLOSED (server invariant) (D-5 · 2026-05-28)

**Active head (D-5 / 2026-05-28):** inner `f214cdcc` (L5+L6 STEP 3, pushed origin/inner-main) · outer `c6b1c4a` (mirror, pushed origin/main) + this ledger commit. **Cloudflare Version:** `d6ab7835-275d-4b81-a927-577e5e38615d`. **Working tree:** clean (both repos).

**L5+L6 (server-side)**: [x] **완료.** QR scan = sole progression gate. C1 canonical auto-approve removed (legacy OR retained, `canLegacyAutoApprove`, `TODO[L8-cleanup]`); C4 Layer 2 advisory X-2 (escalate/reject → `submitted` progression class, escalations audit kept per Q2, confidence server-side per spec §5); C5 binding surface collapsed to shared `snapshotForBlockedContract` (system invariant across GET+POST). Tests 3378/0/6; `tsc` clean. inner `f214cdcc` / outer `c6b1c4a` / Cloudflare `d6ab7835`.

**L0–L9 layer checklist (updated):**
- [x] L0 spec lock — v2 (§3.5 progression model) @ `d07a47ba`
- [x] L1 DB migration (5 files, 2026-05-27, inner `d9443b84`)
- [x] L2 contract creation (canonical stamp — L2+L6 bundle, inner `7e3cd8cb`)
- [ ] L3 token payload extension (tier metadata)
- [ ] L4 validate route tier-aware + self-scan hole + `verification_confidence` write ★ critical
- [x] L5 Layer 2 advisory (X-2) — this lane (inner `f214cdcc`)
- [x] L6 canonical auto-approve removal — this lane (legacy OR retained; inner `f214cdcc`)
- [ ] L7 AD2 non_event_confirmed path
- [ ] L8 legacy contract disposition + legacy OR removal
- [ ] L9 UI tier-aware messaging

**★ Open item (forward fix, NO rollback):** client `startPendingContractQrFlow` (`useArenaSession.ts:2122`) self-navigates the actor to the commit deep-link → `MyPageLeadershipConsole.tsx:225-237` auto-commits via `qr/validate` → `verified_at` set with no QR rendered (Probe 1 / contract `87d92b73`). Server L5+L6 is correct; this is a pre-existing client path exposed by removing auto-approve. `qr/validate` self-scan-hole closure deferred to L4.

**Next:** Client QR Render Fix STEP 0 (render QR for external scan) → STEP 1-3 → L4 (server self-scan hardening + `verification_confidence`).

---

## QR Verification Architecture v1 — L0 / L1 CLOSED (D-6 · 2026-05-27)

**Active head (D-6 / 2026-05-27):** inner `d9443b84` (L1 close, pushed origin/inner-main) · outer `b21c47f0` (mirror, pushed origin/main) + this ledger commit. **Working tree:** clean (both repos).

**L1 DB Migration**: [x] **완료.** 5 migrations applied to production + verified + pushed (inner `d9443b84` / outer `b21c47f0`). 133 `bty_action_contracts` stamped `legacy_self_attest`; 51 `le_verification_log` rows FK VALIDATED + enforcing. STEP 2 (9 tests) + §3.4 FK VALIDATE ALL PASS. `verification_type` CHECK expanded 8 → 11 values. Schema ready for L2.

**L0–L9 layer checklist (QR Verification Architecture v1):**
- [x] L0 spec lock (`QR_VERIFICATION_ARCHITECTURE_V1.md`, Locked v1, 2026-05-27)
- [x] L1 DB migration (5 files incl. correction patch, ALL PASS, 2026-05-27, inner `d9443b84`)
- [ ] L2 contract creation rewrite (4 WRITE sites)
- [ ] L3 token payload extension
- [ ] L4 validate route tier-aware enforcement ★ critical
- [ ] L5 Layer 2 verification_type-aware
- [ ] L6 STAB-01 4-AND gate removal
- [ ] L7 AD2 non_event_confirmed path
- [ ] L8 legacy contract disposition (8 hotfix + 41 pattern_family)
- [ ] L9 UI tier-aware messaging

**Deferred (separate dispatches):** Plan §5.1 footnote correction · migration-file LF header housekeeping · L2 entry (after Commander review).

---

## Current Status (D-7 evening — Lane 3+5+6+7 CLOSED, deploy verified LIVE — 2026-05-26; launch D-0 = 2026-06-02)

**Active head (D-7 / 2026-05-26):** inner `90e5c13a` (pushed, ahead 0) · outer `3f92e66` → this verification ledger commit (ahead 0 → 1, accompanies next push cycle) · **worker live `20f15258-a2e6-465e-8b39-450eaf47f6fe`** (was `47dca7a4`) · **Baseline:** 3372/0/6 · **tsc:** PASS · **Push:** DONE (D-7 emergency, full 25-commit aggregate) · **Deploy:** DONE (D-7) · **Next:** D-6 (2026-05-27) regression sweep buffer.
**Working tree:** clean (both repos).

**Lane 7 QR-gate regression — FULLY CLOSED + LIVE:** Layer 1 (verification_type `qr`→`self_attest`, inner `90e5c13a`) + Layer 2 (`ACTION_ESCALATED` full wiring, inner `ba89565a`) deployed on worker `20f15258`. **Claude-verified:** 3-way deploy + push. **Commander-reported (no Claude DB/browser access):** fresh contract `ea20f335` auto-approved as `self_attest` (~41s, no escalate); SQL hotfix resolved `fe71287c` (14:29:05) + `b76b1da3` (15:38:47). **Runtime-model correction:** live worker is staging-configured → 4-AND auto-approve fires (no separate prod worker; the earlier "production never auto-approves" framing is superseded).

**Post-launch backlog (new, from D-7 incident):**
1. **Duplicate escalation idempotency** — `b76b1da3` reportedly produced 2 escalation rows (one timestamped ~5s before contract.submitted_at). Investigate duplicate-invocation in the submit-validation escalation insert (route.ts:511-537). Severity low (Layer 2 covers the user-facing deadlock regardless of row count); schema-integrity concern. [Commander-reported, not Claude-verified.]
2. **`/api/version` BTY_DEPLOY_VERSION auto-bump** — build-time inline env var, currently stale (`2026-04-27...`), does not move with deploy → never use as a deploy signal. Not a D-0 blocker.
3. **Stale IN_PROGRESS arena_runs cleanup** — dangling runs reportedly observed (`core_05_resignation_signal`, `core_25_forced_repair_conversation`, `core_07_repair_conversation`), current_step=0 / meta=null; extends the STAB-05 backlog item. [Commander-reported.]
4. **Universal QR consumption-side completion** — Lane 7 Layer 1 deferred direction (A2 revert). Re-introduction requires producer+consumer+gate three-way verification; scope: qr token mint + validate route + escalated recovery + OAuth first-contract path.
5. **Escalation creation idempotency guard** [Commander-reported] — extends #1 with a second confirmed case: duplicate escalation rows in both `b76b1da3` (hanbitchi, D-7) and `9df071f9` (ywamer2022, 5/24); in both, escalation #1 opened seconds BEFORE `contract.submitted_at` (structurally impossible in normal flow), then escalation #2 post-submit. Points to caller-side duplicate invocation at submit-validation/route.ts:511-537. Severity low (Layer 2 covers the user-facing deadlock); schema-integrity concern.
6. **Orphan escalation pattern investigation** [Commander-reported] — three contracts with `status='escalated'` but zero `bty_action_contract_escalations` child rows: `e4632681` (STAB-08 smoke seed, 5/22), `1ba8b194` (ikendo1, 5/22), `c52628f0` (hanbitchi, 5/23) — all pre-deploy regression-era. A known parent-child mismatch issue; the D-6 sweep quantifies the scope (3 cases).
7. **Supabase SQL Editor hotfix discipline** [Commander-reported] — during the D-6 cleanup, a bulk `UPDATE … WHERE id IN (…)` inside a BEGIN/COMMIT block silently failed (verify SELECT showed pre-update state; constraint/trigger dumps showed no obstruction); single-row UPDATEs in separate query blocks succeeded for all 6 rows. Future hotfix dispatches: prefer row-by-row single-statement UPDATE + verify SELECT between rows over bulk transactions in the SQL Editor. (Observed by Commander running the SQL, not Claude — no DB access.)

**Commander-side remaining (off-repo):** Lawyer Input #2 cover note + send handbook v2 (strike "Drafting notes" first); optional KO mirror.
**Open governance items (existing):** LRI/Certified admin lane; STAB-07 P0 deferred levers; B2 `ACTION_ESCALATED` additional consumer audits if more surfaces found post-launch.

_Lines below are preserved from the STAB-07-P0 / Phase 0C v2 era — no updated test-baseline or P0 inventory was supplied for D-4, so they are left as historical context rather than fabricated._

**Closed:** STAB-01-P1, STAB-02-P1, STAB-03-A-P1, STAB-04-P0 (PARTIALLY CERTIFIED — governance success), STAB-05-P0[ABCD] (INVENTORY CERTIFIED — no code touched), STAB-06-P0D (OUTER MIRROR RECONCILED), STAB-06-FIX-03 (self-attest completion UX certified), STAB-08 Scope C (escalated revise UI surfaced), **STAB-07-P0 (universal QR Lane 1 SHIPPED — verification_type self_attest→qr on all 3 creation paths; LIVE branch; pending launch-eve gate)**
**Active P0:** STAB-08 (Scope C closed; Scope A/B backlog — post-launch)
**P0 count:** 1
**Baseline:** 3314 / 0 / 6 @ inner `35013b74` (code `baf5f210`) / outer `25f0af02` (code `ee0edb18`) / staging Version `6528ecf2-f0e0-4a8c-8996-f2b58bcd4b45`
**Remotes:** origin/inner-main (inner-main local `35013b74`, manual-push-only) · origin/main = Phase 0C v2 closure (this entry + `ee0edb18`/`25f0af02`, pushed Stage 7); Phase 0B restore `9e53574` already published
**Working tree:** clean (Phase 0C v2 closure)
**Canonical operational anchor:** `a27781f5-e709-4660-bd07-1d11a72d60d7` = canonical rollback-safe stabilization anchor (UNCHANGED; rollback via wrangler version restore)
**D-9 posture:** launch-survivable; universal QR live on staging (smoke verified: qr→escalated→Scope C revise UI); pending launch-eve verification gate (Phase 0C v2 Stage 8 spec)

## Active Backlog (priority-ranked, Commander directive 2026-05-21)

**HIGH priority (D-9 → launch) — NEXT TRACK:**
- **dashboard dual-surface branching** (next track after STAB-05 closure per Commander directive)
  - Core question (locked): "Do user-facing surfaces read the same canonical runtime truth?"
  - Linked findings from STAB-05: multiple status surfaces (arena_runs.status / arena_runs.completion_state / arena_pending_outcomes.status), arena_events progression surface, dashboard/action contract surface observed during STAB-04 R1.3 with parallel `ACTION_AWAITING_VERIFICATION` and `EXECUTION_RECORDED` rendering

**HIGH priority (D-9 → launch) — DEFERRED:**
- stale IN_PROGRESS arena runs (STAB-05 inventory completed; root cause not selected; mechanism inspection deferred)

**MEDIUM priority (pre-launch decision):**
- Supabase NANO tier capacity review for 20-user pilot

**Post-launch hardening:**
- STAB-04 R2 DB constraint round-trip execution (when staging DB provisioned)
- STAB-04 R3 combined disaster scenario rehearsal
- STAB-05 β phase (code inspection authorization) — deferred until post-launch unless dashboard dual-surface investigation reveals blocking dependency
- Layer2 escalation fix (external_witness/hybrid path)
- arena_runs.total_xp dead column
- Lab path 0 rows investigation
- BTY_DEPLOY_VERSION auto-bump
- weekly-reset cron activation (per MUT-21B F3-α)
- eslint ajv schema (pre-existing latent)
- 12-axis review (separate track)
- VRS-1 UI redesign (post-launch only)
- pg_constraint deep dive for FK target + CHECK clauses (STAB-05 deferred)
- user_scenario_choice_history table inventory (STAB-05 deferred)
- bty_arena_signals table inventory (STAB-05 deferred)
- wrangler 4.85.0 → 4.94.0 upgrade (D-4 addition)
- LEGAL_FOLLOWUP_001 — cross-border data transfer review (Korean workforce / OpenAI US-based processor) (D-4 addition; see `LEGAL_FOLLOWUPS.md`)
- pending-v1 historical staging rows preservation (D-4 addition)
- Future consent revision: re-acceptance flow + version enforcement policy (D-4 addition)

## Operating Doctrine (D-9 → D-Day)

- No new features. No new branching. No new verification modes.
- Allowed: wedge removal, UX seam removal, observability, rollback rehearsal, deterministic success reinforcement.
- Cultural baseline: inventory-first, minimum-surface, baseline-preserving, rollback-aware.
- **STAB-04 doctrine:** rollback boundaries preserve semantic runtime continuity → incident response foundation.
- **STAB-05 doctrine:** runtime completion topology is composite (table-local + user-lineage-local + event-surface distributed); single root cause not required as output.
- **Canonical anchor lock:** `a27781f5` is the operational reference for "known-good rollback-safe state" until a new stabilization anchor is explicitly declared.
- **Context entropy management:** memory updates deferred when ledger archive is sufficient.

---

# CURRENT TASK — 2026-03-23

**[D-4 Lane 3 — one clean public entry door (executed early)]**: [x] **완료.** Lane 3 D-1 implementation pulled forward to D-4 (2026-05-26); push + deploy HELD pre-Commander release. **Closed:** `AuthGate.tsx` email/pw form → inline "Continue with Google" CTA (ko "Google로 계속하기") → `/[locale]/bty/login?next=/[locale]/bty` · `login-card.tsx` (real path `src/components/auth/`) provider feature flag `NEXT_PUBLIC_BTY_AUTH_PROVIDERS` (default `google`; Microsoft + Phone OTP retained, hidden) · `AuthGate.cta.test.tsx` new (5 tests) + `login-card.oauth-prompt.test.tsx` +1 env-driven scenario · `LAUNCH_OPERATIONS.md` aidencool0929 (`e9eded1c`) provenance row. **Commander-locked:** inline CTA (not auto-redirect) · `next` default `/${locale}/bty` · `/api/auth/login` kept for `/admin/login` · Google-only public launch (flag-expandable) · MS/Phone gated not deleted. **Commit chain:** inner `8822e4e9`→`fee5d29d` (+4 files, +199/−117) · outer `7124183`→`8179606` (+5 files, +200/−117) · this outer ledger commit. **Baseline:** 3358/0/6 → 3364/0/6 (+6); tsc clean. **Push:** HELD (inner ahead 19 · outer ahead 20 → 21 this commit) · **Deploy:** HELD (worker `47dca7a4`). Outer-only ledger (no inner commit this closure). Claude Code disclosed 4 deviations (path drift `auth/`, per-render provider flag, ko CTA copy, C3-authored closure per memory #25). **Next:** D-3 (2026-05-27) — regression sweep + Lane 6 parallel.

**[D-4 afternoon launch-ops hardening]**: [x] **완료.** D-4 (2026-05-26) afternoon launch-ops lanes closed; push + deploy HELD. **Closed:** launch model corrected to organic OAuth + admin-approve (NOT 20-user pre-planned invite; memory #16) · auth surface 3-layer defense (AuthGate UI flag `NEXT_PUBLIC_BTY_ALLOW_SELF_REGISTER` + `/api/auth/register` 410 guard `BTY_ALLOW_SELF_REGISTER` + Supabase email confirmation ON) · `BTY_ADMIN_EMAILS` verified (repo `authz.ts`+`wrangler.toml` `[vars]` since `fa0b86d6` + runtime Dashboard) · locale protocol EN-default (Commander shares `/ko/*` for KO) · `LAUNCH_OPERATIONS.md` create + provenance upgrade · `LEGAL_FOLLOWUPS.md` date drift fix (D-4=2026-05-26). **Diagnostics** (DB-side per Commander Dashboard/query, not Claude-witnessed): 16 `auth.users`, 3 approved (all Commander variants), 0 external; hanbitchi `tier=27` = cumulative DONE-runs counter; LLM = OpenAI-only; 7+ schema drifts corrected (memory #22). **Outer chain:** `884a261` (auth co-track) → `d86fcd7` (LAUNCH_OPS create) → `59e6a7e` (provenance) → this commit. **Inner:** `8822e4e9` (AuthGate + register guard). **Push:** HELD (outer ahead 19) · **Deploy:** HELD (worker `47dca7a4`). Outer-only ledger; no inner commit this afternoon. **Next:** D-3 (2026-05-27) — regression sweep + Lane 6 (handbook, Commander lane) parallel.

**[D-4 morning launch-prep closure]**: [x] **완료.** D-4 (2026-05-26) launch-prep lanes closed; push + deploy HELD. **Closed:** Lane 5 EN consent (active-truth vendor disclosure — Cloudflare/Supabase/OpenAI; Anthropic excluded per Phase 1 Provider Verify) · Lane 5 KO consent (legal-equivalent; Commander-locked 4 edits: 진료실 팀 / PHI+identifiable / 전송 / 동의합니다) · CONSENT_VERSION `2026-05-pending-v1` → `2026-05-v1` · #26 PatternSignaturePanel contrast (1.04:1→14.5:1 AA) · #23 LocaleLayoutHeader `isAdminArea` LangSwitch dedup · Phase 5 smoke-step2d (`51a162ff`) DELETE (cascade 0; pure auth artifact; preserve cohort hanbitchi `52e543cc` / chihanbit7 `9587a44e` / ywamer2022 `ee9d2075` verified) · `LEGAL_FOLLOWUPS.md` init (cross-border transfer flag). **Diagnostics:** chihanbit7 = `likely_real_user` (PRESERVE; 5 IN_PROGRESS = intentional inspection); Provider Verify = BTY runtime OpenAI-only (Anthropic 0 paths, Gemini keyless, self-hosted inactive); arena_runs schema validated (7 drift catches → memory #22). **Heads:** Phase 2 inner `7afd272a` / outer `a6790c53` → Phase 2.5 inner `82c7d59f` / outer `c57f8ca7` (committed 2026-05-25 ~22:00 PDT). **Worker:** `47dca7a4` (D-5 closure deploy; unchanged). **Push:** HELD · **Deploy:** HELD. Outer-only ledger (no inner commit). Memory edits #6/#16/#19/#22. **Next:** D-3 (2026-05-27) — regression sweep + Lane 6 parallel.

**STAB-08 Scope C**: [x] **완료.** Escalated-contract revise UI surfaced on Arena Resolve (2026-05-22). ArenaResolveClient now renders ArenaActionValidationForm (+ escalation notice) for status="escalated" (runtime ACTION_SUBMITTED, qr_allowed=false) instead of the dead-end PendingGate; reuses the form verbatim, keyed on server-emitted action_contract.status. Server already allowed escalated resubmit (submit-validation:189-200) — Scope C is pure UI surfacing. Single file (L54/L170/L177-184). Inner `3e63a5da` (inner-main, local), outer co-track `c9ce8c2`, closure ledger this commit. Worker Version `5a544379` (supersedes `844990c0`). Baseline 3307→3310/0/6 (+3 tests), tsc clean. Smoke: seed e4632681 → escalated; DB-verified escalated→submitted→pending after browser resubmit; revise notice + form confirmed; Layer 1 revise (R1/R2/R4 — expected) → re-edit → Layer 2 → "sent for review" → pending (re-editable). CORRECTION: "stuck" was a UI misread, not runtime failure. Scope A/B + cleanup-endpoint hardening remain post-launch backlog. Canonical anchor `a27781f5` unchanged. STAB-07-P0 redispatch unblocked.

**STAB-07-P0 ROLLBACK**: Lane 1 (universal QR, inner `7ca96ae7` + outer `c6159ab`) **REVERTED 2026-05-22.** Staging smoke surfaced a blocking gap: when Layer 2 escalates a submission, the contract becomes `status="escalated"` but `ArenaResolveClient` renders no revise form for it (form only on `ACTION_REQUIRED`; escalated→`ACTION_SUBMITTED`→gate with `qr_allowed=false`) → user permanently stuck (escalated blocks per T2; expire cron unscheduled per T1). Reverted: inner `f71c0616` (→origin/inner-main), outer `bae3322` (also deleted the inventory sheet). Worker redeployed `844990c0-5be3-4235-9a02-e6acb541d99f` (staging auto-approve restored). lint PASS, vitest 3307/0/6. STAB-07-P0 RE-OPENED; STAB-08 expanded (Scope C: escalated revise UI) → launch-blocking for the re-attempt. NOTE: the escalate→no-revise-UI gap is latent in production too (prod self_attest already routes through Layer 2). C3 inventory miss logged (server resubmit allowance verified, client render exposure was not).

**STAB-06-FIX-03**: [x] **완료.** Self-attest completion UX certified (2026-05-21). Restored honest self-attest completion flow: completion is shown explicitly, stale QR gates suppressed, progression resumes only through a user-visible Next Scenario CTA. Track A (inner `ae76092b`): U4 verified_at/validation_approved_at wire propagation (BlockingArenaContractRow + select lists + ArenaPendingContractPayload + parsePendingContract) + U5 qr_allowed terminal-state gating (gatesForBlockedContract row-arg, qrAllowedForContract helper) + U6 action-loop-token 409 enrichment (contract_state discriminator + verified_at). Track B (inner `4ae97ea8`): U1 submit-validation contract_state (terminal|awaiting_qr) + U2 hook-owned actionTerminalCompletion + redirect-OUT effect gating + U3 new ArenaActionCompleted component + 3 i18n keys en/ko (arenaActionCompletedTitle/Lead/NextCta) + U7 FIX-02 auto-retry removed, hook-exported clearPendingContractAndReload as user-CTA trigger (single source of truth = hook). BTY principle restored: "I acted → recognized → I choose to continue". Smoke: 3-scenario hanbitchi browser run PASS (all contract_state:"terminal", completion screen rendered, no blank QR window, explicit Next CTA). Baseline 3303 → 3307/0/6 (+4 ArenaActionCompleted tests), tsc clean. Staging Version `4bf3ba18-89e5-4e6a-b34c-934ba963943f`. Inner `4ae97ea8` on `ae76092b`, pushed to origin/inner-main; outer closure commit (this commit, see git log on main). STAB-06 surfaced verification-mode architecture gap (contracts hardcoded self_attest + auto-approve true) → promoted to STAB-07-P0.

**STAB-07-P0**: ACTIVE (NEW P0, 2026-05-21). Verification Mode Integrity — Hardcoded Subset Bridge. Surfaced by STAB-06-FIX-03 closure smoke; pre-audit VERDICT: ABSENT. Three contract-creation paths hardcode verification_type:"self_attest" + details.self_report_auto_approve:true unconditionally (ensureActionContract.ts:280 run-completion, eliteBindingActionCommitment.server.ts:201 Elite AD1-commit, action-contracts/route.ts:64 json_dev_runtime). No solo/relational classification in scenario metadata; no DB CHECK on verification_type (text NOT NULL only). Commander direction: (1) classify canonical scenarios solo/self_attest vs relational/QR-witness; (2) temporary hardcoded scenario-ID classification at the 3 paths (minimal patch); (3) defer schema/metadata work to post-launch STAB-07 phases. Awaiting Commander scenario classification sheet.

**STAB-03-A-P1**: [x] **완료.** Snapshot column-mapping correction landed (2026-05-21). `BlockingArenaContractRow` + SELECT clauses gain `verification_type`; `arenaRuntimeSnapshot.server.ts:61` + `arenaSessionNextCore.ts:66` source from `row.verification_type` (was `row.verification_mode`). Per STAB-03-P0 inventory verdict (iii) — UI display bug, not routing; DB write paths already correct since 2026-05-19 `c727284a`. D2 preserved (arena gate path only; `openActionContractForMyPage.ts` parallel surface UNTOUCHED). D3 preserved (no new state/UI/schema/migration/verification_type values). Baseline 3303 → 3303/0/6 (±0), tsc clean. Staging deploy Version `a27781f5-e709-4660-bd07-1d11a72d60d7`. Inner `c3f933c6`, outer leak-integration `2c53cf7`. VG-5 PASS (Commander hanbitchi rehearsal): label="self_attest" + contract `a44af95c` approved + `core_xp_ledger` id=8 source_type='ARENA' + refresh→200. STAB-01-P1 + STAB-02-P1 + STAB-03-A-P1 all working in single user cycle. D4: refresh-bypass reclassified as expected progression behavior; STAB-03-B deferred.

**STAB-02-P1**: [x] **완료.** core_xp_ledger ARENA insert landed (2026-05-21). reflectionRewards.server.ts L134+: caller-side `supabase.from("core_xp_ledger").insert({user_id, delta_xp: arenaCoreXp, source_type: "ARENA", source_id: run.run_id})` after applyDirectCoreXp; applyDirectCoreXp untouched (D2). Migration `20260521000000_core_xp_ledger_uniq_user_source.sql` — partial unique index on (user_id, source_type, source_id) WHERE source_id IS NOT NULL. Baseline 3299 → 3303/0/6, tsc clean. Staging deploy Version `8ed84aaa-3577-4587-8ebb-458cc416e63d`. Inner `b4a0f4ea`, outer leak-integration `babf028`. VG-2 (migration apply) + VG-6 (smoke) deferred to Commander; origin push held pending both.

**STAB-01-P1**: [x] **완료.** Self-report auto-approve 4-AND gate landed (2026-05-20). submit-validation route: 2-AND → 4-AND (adds `env.SELF_REPORT_AUTO_APPROVE='true'` + `env.BTY_ENV='staging'` terms). wrangler.toml `[vars]` +1 line; staging-only scope enforced by file-level `name="bty-arena-staging"` + code-level BTY_ENV AND-term (D5 option α). D3/D4 preserved. Baseline 3296 → 3299/0/6, tsc clean. Staging deploy Version `84ba771b-fb74-458e-ba54-7f2b94043245`. Inner `72a38bf2`, outer leak-integration `0b12c9b`. VG-5 demo-lifecycle smoke classifier-deferred (Commander interactive); VG-6 production leak DEFERRED (prod worker config external). Push to origin pending Commander VG-5 confirmation.

## Current governance mode

**Procedure-enforced semantic mutation validation.**

All semantic subtraction / deprecation proposals must pass residency validation before mutation authority is granted.

Reference: [`docs/RESIDENCY_VALIDATION_PROCEDURE.md`](RESIDENCY_VALIDATION_PROCEDURE.md)

## Deferred Queue

Commander-confirmed order. Item 1 closed 2026-05-17; items 2–6 are forward-planning lanes.

1. ~~result_origin closure authoring~~ — **CLOSED 2026-05-17** (STEP 0 / 0.5 / 1; spec [`docs/RESULT_ORIGIN_CLOSURE_SPEC.md`](RESULT_ORIGIN_CLOSURE_SPEC.md), outer `8512f52`).
2. ~~reinforcement + AIR semantics~~ — **CLOSED 2026-05-17** (lane #2 complete; spec §5 / §7 / §8 / §9)
   - ~~reinforcement delay policy~~ — **RESOLVED 2026-05-17** (`RESULT_ORIGIN_CLOSURE_SPEC.md` §9 NORMATIVE — bounded reinforcement, legitimate)
   - ~~AIR footprint intent vs defect~~ — **RESOLVED 2026-05-17** (`RESULT_ORIGIN_CLOSURE_SPEC.md` §5 NORMATIVE — semantic over-collapse)
   - ~~insufficient_signal escalation semantics~~ — **RESOLVED 2026-05-17** (`RESULT_ORIGIN_CLOSURE_SPEC.md` §7 NORMATIVE — (a) partially legitimate / indiscriminate / gated, (b) latent governance hazard)
   - ~~loop containment ↔ integrity-metrics boundary~~ — **RESOLVED 2026-05-17** (`RESULT_ORIGIN_CLOSURE_SPEC.md` §8 NORMATIVE — functionally decoupled; governance-isolation guarantee)
3. ~~runtime label terminology~~ — **CLOSED 2026-05-17** (STEP 0 / 0.1 / 1; spec [`docs/RUNTIME_LABEL_TERMINOLOGY_SPEC.md`](RUNTIME_LABEL_TERMINOLOGY_SPEC.md), outer `b43edfd`).
4. 12-Axis drift surfaces
   — **CLOSED 2026-05-17 — substance complete; addressed by the prior CLOSED [`docs/12_AXIS_ARCHITECTURE_REVIEW.md`](12_AXIS_ARCHITECTURE_REVIEW.md) (Verdict phase, 2026-05-16).** queue #4 STEP 0 confirmed the four drift surfaces (WS-1/2/4/5) are all measured and Verdict-deferred there; currency check passed — no surface file drifted since the review baseline `44c9d6f`. FINGERPRINT_VERSION freeze intact; the 24-row ↔ 10-family gap remains WS-1-intended (no reinterpretation authorized); no deferred surface activated. **Carry-forward residue:** the WS-1 24-row relabel (`bty-app/docs/BTY_12_CORE_AXIS.md`) is runtime-neutral representational hygiene, Verdict-sanctioned, intentionally deferred — an inner-involved residue, topology-dependent on #6 (inner push topology); not actioned here.
5. line 148 numeric reconciliation (depends on #3 — **now unblocked**, #3 CLOSED 2026-05-17)
   — **RETIRED 2026-05-17 — signal-only / uncorroborated / no target surface found.** Introduced in `76099e0` forward-planning ledger transcription; never code/doc-corroborated. queue #5 STEP 0 confirmed "line 148" resolves to no file — no numeric reconciliation surface exists in repo state. Retired without a mutation target; **not** resolved by inference. (Original item text above preserved verbatim.)
6. inner push topology (Platform/Infra Mode)
   — **CLOSED 2026-05-17 — disposition (a) policy doc-only closure.** queue #6 STEP 0 measured the topology: inner content is already published to the shared remote via the outer `bty-app/` co-track on `origin/main` (full blob parity — 0 same-path mismatches); the `inner-main` ref is intentionally manual-push-only (upstream unset — estimate); the `origin/inner-main` lag (`a916c66f`, 15 behind inner HEAD `7ff03ced`) is content-safe. Policy articulated as [`docs/DUAL_REPO_TOPOLOGY_RISK.md`](DUAL_REPO_TOPOLOGY_RISK.md) §8 (NORMATIVE, 7 clauses). No inner push / upstream / remote mutation performed. **⚠️ Deferred Queue now fully complete — #1–#6 all CLOSED/RETIRED.** Carry-forward beyond the queue: **§5.3 representation-collapse remediation — CLOSED 2026-05-17** (outer `0b82187` / inner `71f01839`); **WS-1 24-row relabel residue — CLOSED + PUBLISHED 2026-05-17** (outer `53b8d0f` / inner `9f8942a0`); **§7.4 dormant-(b)-ingress governance handling — CLOSED + PUBLISHED 2026-05-17** (carry-forward 3/3 complete; B-1b route containment + §7.6 record, outer `f202782` / inner `35cba550`).

---

- [x] 2026-05-24 — **PUSH AUTHORITY MODEL — LOCKED (완료)**: Push Authority Model authored and verbatim locked, governance record `docs/PUSH_AUTHORITY_MODEL_D9.md`. Defines RO commit class, fixture seed/clean classification, D-9 → D-0 time anchors, and per-anchor authority gates. Current 5-ahead state remains HOLD under the locked D-9 freeze model.

- [x] 2026-05-24 — **Q-GEN STEP 0 — CONSTITUTIONAL CLOSURE (완료)**: 5-cycle corroborated forensic lane formally closed with mutation 0 (code/schema/ledger). Lever α/β/γ remains HOLD. Constitutional record: `docs/Q-GEN_STEP_0_CLOSURE.md`. No implementation authority follows without a separately opened lane.

- [x] 2026-05-18 — **Stabilization + multi-user verification sprint = CLOSED — 5/30 MVP no blockers.** Pre-launch stabilization and verification pass. **Completed (5):** (1) migration reconciliation — `db push` workflow settled, **15 applied / 17 hold** baseline; (2) cron `DEPLOY_URL` fix; (3) D-12 compression test PASS — Forced Reset activation confirmed live, TII output matched the code prediction to 4 decimal places; (4) `weekly_xp` lost-write hotfix — the 4 XP write paths converted to an atomic increment RPC (closes the read-modify-write lost-write window), deployed Version `60865c9d`, origin push complete, baseline inner `16ce6b81` / outer `2d4f92e`; (5) multi-user verification closed — RLS `anon` blocking empirically demonstrated, concurrency closed at the code level, recall banner verdict reached. **Recall banner verdict:** mechanism = **PASS** (`recallPrompt` generation proven live, banner JSX correct); live render **inactive** — Arena is the intended canonical Elite-only vertical slice, so no non-elite scenario passes the `!eliteSetup` gate → not a bug, not a launch blocker; non-elite wiring is a post-launch track. **Post-launch debt (post-launch label — distinct from launch-safe):** non-elite loader fragility · migration cleanup 5 (scenarios · Memory Engine · `action_contracts` · escalations RLS · SSO DDL) · localhost URL baked-in · Core XP RMW · cross-user RLS empirical demonstration · recall lost-prompt pattern. **MVP status:** 5/30 launch blocker = none; remaining (a) operating-doc sync (= this entry) · (b) 20 account creation + core-loop smoke · (c) launch prep + production smoke. **Commit:** this ledger commit — outer single commit; the symlink blob is unchanged, so no inner commit. **Next:** 20-account creation + core-loop smoke.

- [x] 2026-05-17 — **Stage 2 UI sequence lane — STEP 0 corroboration CLOSED + lane split PUBLISHED.** Standalone entry realizing the UI Authority Clarification Lane's forward `Next:` note. Deferred Queue #1–#6 + closed Stage 2 series (2026-05-14) untouched. STEP 0 = read-only corroboration (mutation 0); baseline 6/6 matched, ABORT 0, fabrication 0. **Lane split into 2 sub-lanes**: (1) **UI-surface sub-lane — OPEN**, immediately dispatchable, prerequisite = [`docs/BTY_ARENA_UI_AUTHORITY_CONTRACT.md`](BTY_ARENA_UI_AUTHORITY_CONTRACT.md) v1 (frozen); scope = render work against the frozen contract §3+§5.1; allowed paths `src/components/bty-arena/**`, `globals.css`, `tailwind.config.ts`, surface JSX (runtime spine excluded). (2) **runtime-semantics sub-lane — BLOCKED**; scope = FD-6 Resolve navigation effect + binding-layer authority; prerequisites = (a) Binding Layer Spec v3 NORMATIVE promotion or replacement source-of-truth, (b) §5.1 frozen-invariant amendment authority — both separate Commander decisions. **STEP 0 classification**: FD-6 Action Gate = **MIXED** (render + runtime-state-driven navigation; consumption not authoring; `ArenaResolveClient.tsx:40,44-50,55-68`); Binding Layer Spec v3 = **DRAFT_SIGNAL** (file exists, blob `879da028`, no NORMATIVE marker, unchanged since `fa0b86d` — not a dispatch premise; binding-validation runtime code exists independently); ArenaBlockedSurface precedence = **FROZEN_INVARIANT** (contract §3+§5.1; `useArenaSession.ts:1054-1067` + `arenaBindingReducer.ts:54-60`). **Commit**: this ledger commit (ledger-only, code 0). **Next**: UI-surface sub-lane dispatchable; runtime-semantics sub-lane blocked pending 2 governance decisions.

- [x] 2026-05-17 — **UI Authority Clarification Lane: contract v1 created + PUBLISHED.** New lane — not carry-forward; the queue 3/3 closure is untouched. STEP 0 / 0.1 / 1 / 2 complete. R7 6-site behavioral classification: **class A = 0, class F = 0** (B×3 bounded optimistic UI #1/#2/#4 — C×3 render-only/non-contacting #3/#5/#6). Entry-shell precedence invariant (server `ACTION_*`/`FORCED_RESET_PENDING`/`REEXPOSURE_DUE`/`NEXT_SCENARIO_READY` override client binding/optimistic snapshots) frozen as measured existing behavior. **Deliverable**: [`docs/BTY_ARENA_UI_AUTHORITY_CONTRACT.md`](BTY_ARENA_UI_AUTHORITY_CONTRACT.md) v1 (6 sections), outer `80e7eb2` — **prerequisite for the next UI / mockup / design-token work**. Code mutation 0; `tsc` clean; vitest 1 pre-existing unrelated red maintained. **Two unresolved branches deferred (recorded, not closed)**: (1) Foundry self-authorization gap (contract §3 — NOT IMPLEMENTED) → separate runtime lane; (2) Identity Signal Authority Review (contract §6 — R7 #6 client trait persisted via `/api/bty/arena/signals` without recomputation) → separate review lane. **Commit**: outer `80e7eb2` (contract) + this ledger commit. **Next**: Stage 2 UI sequence under the contract.

- [x] 2026-05-17 — **§7.4 dormant-(b)-ingress governance handling = CLOSED + PUBLISHED — carry-forward lane 3/3, FINAL.** Commander disposition **C = A + B-1b** (same-lane immediate closure) for the sole remaining carry-forward lane. **B-1b** (route-level containment): `transition/route.ts` gains an explicit reject branch — `context === "air_below_threshold"` → deterministic `403 CONTEXT_DORMANT_INGRESS_CLOSED`. `air_below_threshold` is **deliberately retained** in `VALID_CONTEXTS` and the domain `StageTransitionContext` union (allowlist NOT pruned — B-1a rejected; domain↔route asymmetry explicit); `getNextStage` and `air.ts` constants **untouched** → escalation runtime-numeric impact **0**, no AIR comparison site added. **A**: `RESULT_ORIGIN_CLOSURE_SPEC.md` §7.6 containment record appended. Not a §7.4 governance-triggering mutation — it closes the ingress, does not activate it. **B-2** (AIR comparison gate) **out of scope** — separate governance review required, lane uninitiated. **Verification**: §7.4-scoped verification green — `transition/route.test.ts` 6/6 (incl. new reject case), `stages.test.ts` 11/11, `state-service.test.ts` 15/15, `tsc --noEmit` clean. **Baseline language**: Full fresh-tree baseline is not green. Clean tree `71f01839` reproduces 1 unrelated pre-existing red in `re-exposure/validate` caused by `reinforcementLoopSchedule.server` mock missing `reinforcementCapReached` export. This predates the §7.4 B-1b mutation and is deferred to a separate baseline-maintenance lane. §7.4 scoped verification is green. **Commit**: outer `f202782` (route co-track + spec §7.6) / inner `35cba550` (route co-track pair) + this ledger commit. **⚠️ Carry-forward queue 3/3 CLOSED + PUBLISHED** — §5.3, WS-1 24-row relabel, §7.4 all closed; no open carry-forward lane remains. inner baseline `35cba550`, upstream unset (manual-push-only, §8) — not pushed. **Next**: baseline-maintenance lane for the `reinforcementLoopSchedule.server` mock (Commander-designated).

- [x] 2026-05-17 — **§5.3 representation-collapse remediation = CLOSED + LEDGERED (carry-forward lane 2).** `RESULT_ORIGIN_CLOSURE_SPEC.md` §5.3 — `le_activation_log` gained a `result_origin` column (Remediation A): additive migration `20260517000000_le_activation_log_result_origin.sql` (nullable, CHECK `computed|insufficient_signal`, partial fallback index), **insert-time origin preservation** in `reflectionRewards.server.ts`, **no UPDATE backfill** (pre-§5.3 rows keep NULL). `computeAIR` unchanged; AIR/escalation numeric impact 0; no carve-out; FINGERPRINT_VERSION + §7.4 `air_below_threshold` ingress untouched. Tests 40/40 green; `tsc --noEmit` clean. **Commit**: outer `0b82187` / inner `71f01839` + this ledger commit. **Session state**: WS-1 24-row relabel = CLOSED + PUBLISHED (outer `53b8d0f` / inner `9f8942a0`); §5.3 = CLOSED + ledgered, **publish pending** until this micro-dispatch outer push completes (outer baseline after publish = this ledger commit); §7.4 dormant-(b)-ingress governance handling = sole remaining carry-forward lane. inner baseline `71f01839`, upstream unset (manual-push-only) — not pushed. **Next**: §7.4 governance lane.

- [x] 2026-05-17 — **Queue #3 (runtime label terminology) = CLOSED.** Runtime label terminology judged and articulated as the new normative spec [`docs/RUNTIME_LABEL_TERMINOLOGY_SPEC.md`](RUNTIME_LABEL_TERMINOLOGY_SPEC.md). **STEP 0 (Layer A)** — server `ArenaRuntimeStateId` (9 labels, all per-request derived; `runtime_state` not a DB column) + client `RuntimeFlowState` (6 labels, in-memory FSM); 4 identical-string labels across the two unshared types; "state" naming drift on the type/field surface. **STEP 0.1 (Layer B)** — code routing vocabulary (`route` union `mirror|perspective_switch|catalog`, `catalog` live, "Elite v2 chain allowlist" vs "canonical allowlist" wording variance, `useLegacyRunStepApi`/`isCanonicalJsonRuntimeScenario`); the four dispatch signal-paths (`own_re02_r1` etc.) are code-absent → signal-only; cross-layer "runtime" overload (moderate). **STEP 1** — §1–§8 NORMATIVE: every candidate (Layer A naming drift, §4 four-label overload, §5 Layer B wording variance + "legacy" drift, §7 cross-layer "runtime" overload) classified **doc-articulation sufficient**; **rename NOT required** — no code identifier changed; signal-only vocabulary recorded as code-uncorroborated (not promoted, not discarded). Terminology closed; §8 records one conditional escape for a future rename lane only if concrete confusion is later demonstrated. doc-only — runtime/schema/test change 0, code-identifier change 0. **Commit**: outer `b43edfd` (spec) + this ledger commit. **Next**: Deferred Queue #4 — 12-Axis drift surfaces (#5 line 148 numeric reconciliation is now unblocked — its #3 dependency is closed).

- [x] 2026-05-17 — **Lane #2 (reinforcement + AIR semantics) / reinforcement delay policy = CLOSED — ⚠️ lane #2 fully complete.** Reinforcement cadence legitimacy judged and articulated as `RESULT_ORIGIN_CLOSURE_SPEC.md` §9 (NORMATIVE). **STEP 0** (read-only corroboration, commit 0) — cadence topology: delay is band-driven (`no_change` 3d / `unstable` 5d), the iteration number is cosmetic-only (no timing effect), cap = 3 per chain, retry is pull-based (`getDueOutcomes`, not cron). **STEP 1** — §9 NORMATIVE judgment: **bounded reinforcement, legitimate**, resolved in three layers — (per-chain) structurally bounded (cap = 3, ≥3d/≥5d spacing, 5 prevention guards, advances only on a validation `POST`); (aggregate) the bound is user-initiated, not system-coercive (parallel chains require user-initiated source runs); (abandonment) zero new rows / zero iteration increment / zero escalation on non-response. Classification: bounded reinforcement CORROBORATED; coercive recurrence / unbounded retry REBUTTED; diminishing cadence CONTRADICTED. §9.1–§9.5 appended; §1–§8 untouched; §9 cites §8.3/§8.5, not redefined. doc-only — runtime/schema/test change 0. **Commit**: outer `b1bb130` (spec §9) + this ledger commit. **⚠️ lane #2 (reinforcement + AIR semantics) is now fully CLOSED** — all four sub-items resolved (§5 AIR footprint, §7 escalation, §8 containment boundary, §9 cadence). **Publication held** — push not performed this STEP; outer is `ahead=2` of `origin/main` pending Commander review. **Next**: Deferred Queue #3 — runtime label terminology.

- [x] 2026-05-17 — **Lane #2 (reinforcement + AIR semantics) / loop containment ↔ integrity-metrics boundary = CLOSED.** Canonicalizes the functional decoupling measured in lane #2 STEP 0 PHASE 5 as `RESULT_ORIGIN_CLOSURE_SPEC.md` §8 (NORMATIVE). No separate corroboration STEP — PHASE 5 measurement reused under an escape-hatch check: commits since the PHASE 5 baseline (`1235124..HEAD`) touched **zero** non-`.md` files, so the corroboration remains authoritative. **§8 judgment**: the reinforcement loop containment subsystem and the integrity-metric subsystem (AIR / forced-reset) are **functionally decoupled** — 0 shared mutable state (disjoint persistence: `arena_pending_outcomes.validation_payload.reinforcement_loop` vs `le_activation_log`); the cap does not gate the `le_activation_log` AIR footprint emit; shared points are only a common trigger (re-exposure validate `POST`) and a shared read of `payload.validation_result`. **§8.3 governance-isolation guarantee**: a reinforcement-containment mutation does not implicitly change AIR/forced-reset/escalation semantics → a containment track may proceed without reopening §5/§7, subject to the §8.4 boundary self-check (no touch to the `le_activation_log` emit path; no new shared mutable state). §8.1–§8.5 appended; §1–§7 untouched; §8 cites §5/§7, not redefined. doc-only — runtime/schema/test change 0. **Commit**: outer `f8d5097` (spec §8) + this ledger commit. **Next**: lane #2 has one remaining sub-item — *reinforcement delay policy* (Deferred Queue #2).

- [x] 2026-05-17 — **Lane #2 (reinforcement + AIR semantics) / insufficient_signal escalation semantics = CLOSED.** Escalation legitimacy judged and articulated as `RESULT_ORIGIN_CLOSURE_SPEC.md` §7 (NORMATIVE). **STEP 0 / 0.1** (read-only corroboration, commit 0) — Stage-3 entry trigger (request-supplied `repeat_2_without_corrective_activation` context via `POST /transition`), forced-reset 4-input aggregation (`stage3SelectedCountIn14d` hardcoded `0` → effective 2-of-3), fallback participation, escalation-local attribution survivability (zero fields carry `result_origin` anywhere in the escalation path), and the second Stage-4 ingress `getNextStage(STAGE_3,"air_below_threshold")` via `POST /transition` — measured **dormant** (no in-repo caller; the `0.50` `AIR_THRESHOLD_STAGE_ESCALATION` constant has no runtime comparison site). **STEP 1** — §7 NORMATIVE judgment: **(a)** active ingress (`evaluateForcedReset`, 2-of-3, `0.80`) = partially legitimate / structurally indiscriminate / aggregation-gated — over-broad, not a catastrophic punitive defect, never single-trigger; **(b)** dormant ingress (`air_below_threshold`, single-signal, `0.50`) = **latent governance hazard** — not a defect today, but a complete latent path; activating it changes escalation authority semantics → governance review REQUIRED before activation. §7.1–§7.6 appended; §1–§6 untouched; §7 cites §4/§5, not redefined. doc-only — runtime/schema/test change 0. **Commit**: outer `3e6dc6f` (spec §7) + this ledger commit. **Next**: lane #2 remaining sub-items (reinforcement delay policy, loop-containment ↔ integrity-metrics boundary).

- [x] 2026-05-17 — **Lane #2 (reinforcement + AIR semantics) / STEP 1 — AIR footprint intent/defect judgment = CLOSED.** Closes the `RESULT_ORIGIN_CLOSURE_SPEC.md` §5 `[OPEN]` with a NORMATIVE judgment. **STEP 0** (read-only corroboration, commit 0) — 4-trigger upstream attribution + reinforcement/AIR 1-hop adjacency + AIR drag propagation chain; findings: the four `insufficient_signal` triggers have heterogeneous attribution (`after_second_choice_missing` user-action / `no_prior_run` runtime-sequencing / `prior_second_choice_missing` pipeline-data / `elite_axis_missing` registry-mixed), `result_origin` is lost at hop 1 (`le_activation_log` insert — no `result_origin` column), forced-reset is 2-of-4 contributory (never sole, Stage-3 gated), loop-cap ↔ AIR are decoupled. **STEP 1** — §5 NORMATIVE judgment: the AIR drag is **"semantic over-collapse"** — partially legitimate (behavioral absence) / partially over-broad (system absence); **not a catastrophic punitive defect**. §5.1–§5.6 added (judgment, trigger heterogeneity, representation collapse, legitimacy boundary, behavioral-vs-system-absence term, future-mutation-track record-only). §1–§4 untouched; §4 invariant cited not redefined. doc-only — runtime/schema/test change 0. **Commit**: outer `78587c6` (spec) + this ledger commit. **Next**: lane #2 remaining sub-items (reinforcement delay policy, insufficient_signal escalation semantics, loop-containment ↔ integrity-metrics boundary); §5.3 representation-collapse remediation is a separate runtime/schema track.

- [x] 2026-05-17 — **Track 1-C / result_origin closure authoring (STEP 0 / 0.5 / 1) = CLOSED.** `result_origin` (`computed` | `insufficient_signal`) XP/verified closure semantics fixed as a normative spec. **STEP lineage**: **STEP 0** — re-baselined corroboration; measured the result_origin code path (5 set-sites across 2 files — `reexposureValidation.server.ts:250/283/316/361` + `route.ts:189`), re-confirmed no prior spec exists (MISSING, not CONTRADICT); read-only, commit 0. **STEP 0.5** — AIR footprint semantic classification; VERDICT: the unconditional `le_activation_log` `micro_win` activation emitted for `insufficient_signal` is **grade D (conditional)** — for LE Stage-3 users it is a contributory (2-of-4, never sole) input to forced-reset escalation, and it dilutes AIR/LRI/TII downward; the sign is anti-reward (AIR drag), **not a reward leak**; read-only, commit 0. **STEP 1** — [`docs/RESULT_ORIGIN_CLOSURE_SPEC.md`](RESULT_ORIGIN_CLOSURE_SPEC.md) authored (normative). Closure invariant fixed: `insufficient_signal ⟹ coreXp=0 ∧ weeklyXp=0 ∧ verified=false`; total XP zero is the distinguishing invariant; `verified=false` is necessary-not-sufficient (computed `no_change` is also `verified=false`); single enforcement point `reflectionRewards.server.ts:185-186`; doc-only. **Commit**: outer `8512f52` (UNPUBLISHED — `origin/main` at `39b545f`). **Carried [OPEN — separate track]**: (a) AIR footprint intent-vs-defect determination (spec §5) — routed to the *reinforcement + AIR semantics* deferred lane (queue #2); (b) `PatternSignatureEvent.result_origin` optional-field absent-as-`computed` legality (spec §6). **Next**: publication (separate track); deferred queue above.

- [x] 2026-05-17 — **Track 1-C / STEP 4 — Reinforcement Loop Iteration Cap = CLOSED (committed); outer UNPUBLISHED. Retroactively ledgered (sanctioned commit, Commander-approved) — doc-only ledger reconciliation, no STEP 4 code re-review.** The reinforcement re-exposure loop previously rescheduled `unstable`/`no_change` follow-ups indefinitely — only a `changed` band ended the loop. **Change**: `REINFORCEMENT_LOOP_ITERATION_CAP=3` (`bty-app/src/lib/bty/arena/reinforcementLoopSchedule.server.ts:19`) + `reinforcementCapReached()` predicate (`:63`); at the cap iteration `unstable`/`no_change` ends the loop (`loop_reason "loop_ended_iteration_cap"`, no follow-up scheduled, `next_runtime_state` terminal `NEXT_SCENARIO_READY` instead of `REEXPOSURE_DUE`). 4 files (`reinforcementLoopSchedule.server.ts` + re-exposure `validate/route.ts` + their two test files), **SQL/migration 0, config 0**. **`result_origin` surface NON-CONTACT** — the STEP 4 diff touches no `result_origin` / `insufficient_signal` / `verified` / XP line (verified by STEP 0 corroboration REPORT R4). Tests 14/14 green on fresh tree (R7). **Commit**: outer `5e9362e` / inner `7ff03ced` (logically identical co-track pair; outer commit message self-declares the mirror of inner `7ff03ced`). **⚠️ outer `5e9362e` is UNPUBLISHED** — `origin/main` is still at `39b545f`; the outer repo is `ahead=1`. Publication is a **separate track**, not decided by this ledger-backfill step. **Provenance note**: STEP 4 was committed without a living-ledger entry at commit time; this entry is the retroactive backfill. **Next**: publication decision for `5e9362e` (separate track).

- [x] 2026-05-17 — **Track 1-C / STEP 3 — Validation Semantics Documentation Alignment = CLOSED + PUBLISHED. Retroactively ledgered (sanctioned commit, Commander-approved) — doc-only ledger reconciliation.** Doc-only alignment of re-exposure validation semantics: forced-reset linkage correction, derived-label framing, v1 supersede note. **Doc-only — code/test/sql/config 0** (corroborated via `git show --stat`): outer `39b545f` touched 3 `.md` files (`BTY JSON ↔ Supabase Binding Layer Spec v3.md`, `BTY_ARENA_SEMANTIC_LOCKING_TABLE_v1.1.md`, `BTY_ARENA_SEMANTIC_LOCKING_TABLE_v1.md`); inner `03322ca1` touched 1 `.md` file (`BTY JSON ↔ Supabase Binding Layer Spec v3.md` — the co-tracked subset; the two `SEMANTIC_LOCKING_TABLE` docs are outer-root-only). **Commit**: outer `39b545f` (PUBLISHED — `origin/main` is at `39b545f`) / inner `03322ca1` (local mirror, `inner-main` upstream unset). **Provenance note**: STEP 3 was committed without a living-ledger entry at commit time; this entry is the retroactive backfill.

- [x] 2026-05-16 — **Track 1-C / STEP 2 — Fallback Insufficient-Signal Metadata (Route B) = CLOSED + PUBLISHED.** Runtime Evolution Session governance mutation — separates operational `unstable` (a measured pattern-shift band) from input-absent fallback collapse, which previously both produced the same `unstable`. **Change**: `validation_payload.result_origin` JSONB metadata (`computed` | `insufficient_signal`) tags every re-exposure validation result; the four fallback collapse sites in `bty-app/src/lib/bty/arena/reexposureValidation.server.ts` are tagged `insufficient_signal` (discarded `elite_axis_missing` preserved as `insufficient_signal_reason`). `insufficient_signal` is excluded from analytics confidence/repeat evidence (`patternSignatureAggregation` holds the aggregate) and from verified XP (`reflectionRewards` → `verified:false`, XP 0). Band values (`changed`/`unstable`/`no_change`) unchanged; `PatternShiftBand` remains 3 values; **DB migration 0** (additive JSONB key, no CHECK change). 11-file co-track commit (6 source + 5 test). **Baseline**: outer `998ba8d4` (= `origin/main`) / inner `65902fac` (local-only, `inner-main` upstream unset). **Publication corroboration**: the formal POST-PUSH REPORT for the STEP 2 outer push was missing from the C3 tracking path; `origin/main = 998ba8d4` is corroborated by Commander direct measurement (`git rev-parse origin/main`) — recorded so publication provenance is not re-doubted next session. **Deferred**: reinforcement delay policy change, UI surfacing of `result_origin`. **Next**: Track 1-C / STEP 3 — re-exposure evolution (or Commander-designated track); STEP 3 not started in this step. **[SUPERSEDED 2026-05-17 — ledger backfill]**: the "STEP 3 not started" clause reflects the 2026-05-16 STEP 2 closure moment only and did not anticipate later progress; STEP 3 (`39b545f` / `03322ca1`) and STEP 4 (`5e9362e` / `7ff03ced`) were subsequently committed and are recorded retroactively in the Track 1-C / STEP 3 and STEP 4 entries above this one.

- [x] 2026-05-16 — **HK10–HK17 namespace CLOSED** — NON-CANONICAL DEBRIS, carry-forward 금지. see [`docs/closures/HK_NONCANONICAL_DEBRIS_CLOSURE.md`](closures/HK_NONCANONICAL_DEBRIS_CLOSURE.md)

- [x] 2026-05-14 — **Stage 2 Foundry CLOSED — VERIFICATION-ONLY (Plan A); v1.1.1 §5.4 compliant (lifecycle-external + analysis-flavored hub + no in-scenario interaction); FORCED_RESET secondary block enforced via Center step three-layer inheritance (URL+UI+test); 3 deferred backlog items recorded per Commander Plan A condition (VISUAL_BEHAVIOR_SPEC §1.3 content-design gap + Foundry/Growth route coexistence + v1.1.1 §9 D2 explicit UX notice).** Closure doc [`docs/closures/STAGE2_FOUNDRY_CLOSURE.md`](closures/STAGE2_FOUNDRY_CLOSURE.md) (new). **Inner refs unchanged**: HEAD `a1800737` (Center 2D); no inner commit this sub-phase. **Phase 1 inventory** (≥3-signal cross-check, Center-style discipline) mapped `/[locale]/bty/(protected)/foundry/` route (302 lines = 8 tracked files) + `src/components/foundry/` (2269 lines / 6 components: DojoAssessmentShell, EliteSpecWidget, LearningPathWidget, MentorChatShell, ProgramProgressShell, ProgramRecommenderWidget) + domain/lib/engine/api foundry dirs. All Foundry route files TRACKED + CLEAN; not in 30-entry sync-debt set; not in untracked-import problem set. **v1.1.1 §5.4 + §2 + §8 PASS evidence**: live `/bty/foundry` renders back-link + header (tLand.foundryTitle/Desc) + `<ProgramRecommenderWidget>` (pattern-driven via `foundry_recommendations` Supabase broadcast + scenario tokens) + 3 feature cards (Dr. Chi Mentor `/bty/mentor` / Dashboard `/bty/dashboard` / Elite `/bty/elite`) + Leaderboard nav. Sub-routes `/bty/foundry/dojo-micro` (DojoAssessmentShell) and `/bty/foundry/program/[programId]` (LearningPathWidget consumer). Grep across foundry route files: **0 hits** for runtime-state names (PRIMARY_CHOICE/TRADEOFF/ACTION_DECISION/REEXPOSURE/FORCED_RESET/playUiSegment); few "arena" matches are CSS variable names `--arena-accent`/`--arena-text`/`--arena-bg`/`--arena-text-soft` used for theming consistency (not runtime-state). `useArenaSession` hook NOT imported anywhere in foundry/ tree → lifecycle-external confirmed. v1.1.1 §2: no row maps to Foundry (correct per Stage 1 §3.4 "lifecycle-external"). §8-1/3/4/5/6/8 n/a (no runtime/LOCKED states); §8-2 PASS (no Play/Resolve rendering); §8-7 **ENFORCED via three-layer Center-step inheritance**: URL-level [2C-1 `d0d763c7` `bty-app/src/middleware.ts:351-372` source-scope matches `/[locale]/bty/foundry/*` → 307 to `/[locale]/center` on `userHasForcedResetPending`, BEFORE contract block per HARD LOCKED > LOCKED precedence] + UI-level [2C-2 `0f160e54` `HubTopNav.tsx` gates Foundry pill inside `forcedResetActive ? null : (<>...</>)` both arena + dear theme branches] + test-pinned [2D `a1800737` `middleware.forced-reset-redirect.test.ts` test #3 `/en/bty/foundry/insights` → 307 `/en/center` with `x-forced-reset=redirect` header]. **Classification: VERIFICATION-ONLY** — mirrors Play step 3 pattern (Resolve 2D-1 absorbed §8-2 → Play step 3 verification-only; Center step absorbed §8-7 → Foundry step 5 verification-only). Legitimate closure class, NOT a skipped step. **Plan A chosen** over Plan B.1 (VISUAL_BEHAVIOR_SPEC §1.3 reconciliation; older non-locking design doc, no §8 urgency, `bty-app/docs/` path would require inner commit) and Plan C (build VISUAL_BEHAVIOR_SPEC §1.3 prescribed elements as on-page content — v1.1.1 doesn't require, greenfield scope unjustified). **3 deferred backlog items (closure §6) per Commander Plan A condition**: (1) **VISUAL_BEHAVIOR_SPEC §1.3 ↔ live-code content-design gap** — older design doc prescribes Pattern Summary header + Decision Replay flow visual + Stats Direction (↑Integrity/→Resilience/↓Communication) + Trend Graph 14d + Insights Card Stack (What you did well/Opportunity/Suggestion) + always-active chatbot; live `/bty/foundry` is 3-card feature-hub instead; some §1.3 analysis elements may live on `/bty/dashboard` or `/growth/history`. Doc explicitly NOT in v1.1.1 locking authority chain (per v1.1.1 §0 Changelog `BTY_ARENA_VISUAL_BEHAVIOR_SPEC.md` listed as 참조, not authority source). **Content-design backlog, NOT §8 gap**. Future Plan B.1 (spec reconciliation, inner commit needed) or Plan C (build §1.3 elements, greenfield) — neither required by v1.1.1; (2) **Foundry vs Growth route coexistence documentation gap** — live has BOTH `/[locale]/bty/foundry` (3-card hub) AND `/[locale]/growth` (5-card hub: Dojo/Integrity/Guidance/Journey/History at `src/app/[locale]/growth/page.tsx`). Mirrors Center route-lineage pattern (older `BTY_CURSOR_MASTER_PROMPT.md` + `BTY_MASTER_BUILD_V1.md` use "Growth" + `/growth/*` routes; v1.1.1 + VISUAL_BEHAVIOR_SPEC use "Foundry"). Both tracked + clean + lifecycle-external — documentation-shaped not entanglement. Future v1.1.2 outer-doc route-lineage note (parallel to v1.1.1 §5.5.1 Center pattern) could formalize when convenient; (3) **v1.1.1 §9 D2 Foundry FORCED_RESET access-block UI representation** — infra enforcement landed (2C-1 + 2C-2 + 2D test); explicit user-facing notice "you were redirected because Foundry is blocked during integrity reset" NOT built; user IS protected (HARD LOCKED), just no explanatory toast/notice; non-§8-blocker UX polish; previously deferred by Center closure §6.2, re-confirmed deferred here. **4-check gate PASS upfront**: (a) outer fetch + rev-list `0 0` vs `origin/main` at `c4b395d`; (b) **EXACTLY 30 sync-debt entries** measured by `git status --short \| wc -l`; **identical set to Center 2E §8.1** (18 prior HK + Lobby + Resolve + 3 from 2C-1 + 4 from 2C-2 + 5 from 2D = 30); 0 anomalies (every entry traces to known origin); (c) HK6 `getMyPageIdentityState.ts` untouched by Foundry 2E (prior leak only); (d) explicit-path staging — 3 doc files only. **Outer sync-debt unchanged at 30 entries** (Foundry step 5 adds 0 — outer-doc-only Plan A; no inner commits) per HK8 closure clause 4 — pending post-Stage-2 leak-integration sprint per [INNER_PUSH_POLICY §5](INNER_PUSH_POLICY.md). **Stage 2 LOCKED order: step 5/6 complete** (Lobby ✓ → Resolve ✓ → Play ✓ → Center ✓ → **Foundry ✓** → Hub). **Tests**: 17/3255/6 — exact baseline preserved (no new tests in Foundry step; §8-7 tests landed in 2D and inherited here). **Cross-step inheritance pattern**: Resolve 2D-1 → Play step 3 verification-only; Center 2C-1+2C-2+2D → Foundry step 5 verification-only. **Hub step 6 cannot inherit this pattern** — it must resolve §8-Open #1 (NEXT_SCENARIO_READY rendered in Play at `BtyArenaRunPageClient.tsx:1067-1167`, ownership requires resolving D1 Lobby↔Hub merge decision). Unpushed pending Commander review. **다음**: Commander review → push approval → Stage 2 step 6 = **Hub** (final Stage 2 step; inherits §8-Open #1 from Play closure §5.1).

- [x] 2026-05-14 — **Stage 2 Center CLOSED — v1.1.1 §5.5 correction + FORCED_RESET enforcement (middleware redirect + nav suppression + 30 tests); §8-Open #2 RESOLVED; Mode A (recovery hub) confirmed compliant with v1.1.1 §5.5.1 (zero Mode A code changes).** Closure doc [`docs/closures/STAGE2_CENTER_CLOSURE.md`](closures/STAGE2_CENTER_CLOSURE.md) (new). **Sub-phase chain**: 2A (Phase 1 inventory + blocker-class finding) → 2A→β Commander reframe (spec-vs-spec inconsistency, Option β: correct v1.1, keep shipped product) → 2B `540aaa7` outer (v1.1 → v1.1.1; §5.5 split into §5.5.1 default recovery surface + §5.5.2 FORCED_RESET override sub-mode; 4-doc consensus citation: `BTY_ARENA_VISUAL_BEHAVIOR_SPEC.md` Screens 9-13 + `BTY_CURSOR_MASTER_PROMPT.md` Recovery layer + `BTY_MASTER_BUILD_V1.md` §6 + `LEADERSHIP_ENGINE_SPEC.md` §5; route lineage note re `/dear-me → /center` consolidation; FD-1~6/§2/§8 prohibition semantics/§11 unchanged; filename unchanged per `ba1d375` lesson) → 2C-1 `d0d763c7` inner Platform/Infra Mode (`bty-app/src/middleware.ts` adds 307-redirect clause BEFORE existing contract block at L351; source scope `/[locale]/bty-arena/*` + `/[locale]/bty/foundry/*` per v1.1.1 §5.4 secondary block; target `/[locale]/center`; HARD LOCKED > LOCKED precedence over blocking-contract; helper `userHasForcedResetPending(supabase, userId)` co-located in `state-service.ts`; 4 unit tests; auth/deploy impact = none — read + redirect, same cookie reassertion as contract block, edge-runtime compatible) → 2C-2 `0f160e54` inner UI Mode (shared `useForcedResetActive` hook at `bty-app/src/components/bty/navigation/useForcedResetActive.ts` with 60s TTL cache + in-flight promise singleton dedup; loading/error default NOT-suppressed for UX safety; `Nav.tsx` defensive, `HubTopNav.tsx` both arena + dear theme branches gated, `BottomNav.tsx` grid-cols-3 → grid-cols-1; what stays during FORCED_RESET = Center link/pill/tab + `trailing` slot (LangSwitch + LogoutButton — language flip + security exempt); what's hidden = Arena/Foundry pills + sub-pills (Dashboard/Leaderboard/MyPage/MyAccount) + divider + Arena/MyPage tabs; suppression = not-render per v1.1.1 §5.5.2 "자발 navigation 금지") → 2D `a1800737` inner (30 tests across 5 new files: `middleware.forced-reset-redirect.test.ts` 8 cases incl. precedence + Foundry secondary block + Center self-no-loop + auth bypass; `useForcedResetActive.test.ts` 8 cases incl. cache dedup + in-flight singleton; `Nav.test.tsx` 4, `HubTopNav.test.tsx` 5 both themes, `BottomNav.test.tsx` 5 incl. a11y; all 30 pass on first run, **0 prod bugs surfaced**) → 2E (this closure). **Blocker-class finding + resolution**: Phase 1 surfaced what looked like spec-vs-product contradiction (Center shipped as recovery hub, v1.1 §5.5 framed it as system-interrupt-only); Commander 2026-05-14 reframed as spec-vs-spec inconsistency (v1.1 §5.5 is the outlier; 4 other LOCKED docs define recovery surface). Option β chosen over α (gut Center) and γ (hybrid route split): correct v1.1 to v1.1.1, keep shipped product, harden sub-mode only. **§8-Open #2 RESOLVED** (inherited from Play closure §5.2 Center step ownership): gap (a) URL-level via 2C-1 middleware redirect; gap (b) UI-level via 2C-2 nav suppression hook; test-guarded by 2D 30-test suite. **Mode A status**: confirmed compliant with corrected v1.1.1 §5.5.1 — zero Mode A code changes shipped across 2A → 2E (Plan B's "no code change" prediction held). All inner code (2C-1/2C-2/2D) confined to FORCED_RESET sub-mode hardening: middleware enforcement + nav suppression + their tests. **Tests**: 17/3255/6 — baseline 17 failures preserved across all 4 inner commits (same 7 files: arena/n/session, arena/session/next, bty/healing, bty/q241, bty/q3, MyPageLeadershipConsole, delayed-outcome-e2e); +34 new tests passing (4 helper from 2C-1 + 30 from 2D); 0 prod bugs surfaced by tests. **4-check gate PASS upfront with measurement-over-estimate discipline** (new in 2E per 2D report's inconsistent estimate): (a) outer `0 0` vs `origin/main` at `540aaa7`; (b) **EXACTLY 30 sync-debt entries** measured by `git status --short \| wc -l`; full classification = 18 prior (Play closure §7.1: HK6 1 + HK7 3 + HK8/HK9 1 + Lobby 2 + Resolve 2B 3 + 2C 5 + 2D-1 3) + 3 from 2C-1 (middleware + helper + helper test) + 4 from 2C-2 (hook + 3 nav components) + 5 from 2D (5 new test files); 18+3+4+5=30 matches; 0 anomalies (every entry traces to known origin); (c) HK6 `getMyPageIdentityState.ts` untouched by 2E (prior leak only); (d) explicit-path staging — 3 doc files only. **Outer sync-debt now 30 entries** per HK8 closure clause 4 — pending post-Stage-2 leak-integration sprint per [INNER_PUSH_POLICY §5](INNER_PUSH_POLICY.md). **Stage 2 LOCKED order: step 4/6 complete** (Lobby ✓ → Resolve ✓ → Play ✓ → **Center ✓** → Foundry → Hub). **Deferred backlog (Center-originated, 5 items in closure §6)**: (1) `BtyArenaRunPageClient.tsx:1031-1065` gate-page removal — intentionally retained for coexistence safety (Resolve 2B pattern), unreachable in practice after 2C-1, removal is post-deploy verification follow-up; (2) v1.1.1 §9 D2 Foundry block UI representation — infra enforcement landed (2C-1 redirect + 2C-2 nav suppression), explicit UX notice "you were redirected because Foundry is blocked" not built, non-§8-blocker; (3) v1.1.1 §9 D5 48h timer — **CLOSED**, `ForcedResetUX.tsx` countdown at L181-189 already ships; (4) v1.1.1 §6.3 "reset 사유 명시 (어떤 pattern_family / 어떤 axis)" — content gap, ForcedResetUX shows generic 3-item checklist (stabilize/boundary/accountability), not §8-2 structural; (5) JSON-engine ACTION_REQUIRED relocation — inherited from Resolve 2D-2 backlog (independent of Center). §8-Open #1 (NEXT_SCENARIO_READY rendered in Play → Hub step ownership) untouched by Center step — remains Stage 2 step 6 (Hub) responsibility. Unpushed pending Commander review. **다음**: Commander review → push approval → Stage 2 step 5 = **Foundry** (analysis surface, lifecycle-external per v1.1.1 §5.4; FORCED_RESET secondary block already enforced via 2C-1 middleware + 2C-2 nav suppression).

- [x] 2026-05-14 — **Stage 2 Center sub-phase 2B — v1.1 → v1.1.1 §5.5/§8-5/§6 scope correction (Commander Option β; outer doc commit only, no inner code).** Edit to [`docs/BTY_ARENA_SEMANTIC_LOCKING_TABLE_v1.1.md`](BTY_ARENA_SEMANTIC_LOCKING_TABLE_v1.1.md) (in-document version marker v1.1 → v1.1.1; **filename intentionally unchanged** per Stage 0 `ba1d375` filename-stability lesson — renaming would break every cross-doc reference). **Trigger**: Phase 1 STEP 0 inventory found Center = fully-built recovery hub at `/center` (CenterPageClient.tsx 386 lines + ForcedResetUX.tsx 281 lines + HealingPhaseTracker.tsx + DearMe i18n strings) with Mode A (default recovery dashboard: Dear-Me letter card, Resilience log, Self-esteem Assessment, Healing Phase Tracker, Stage Context Card; calm/warm tone "쉼터/safe space/healing room") + Mode B (forced-reset sub-mode rendering ForcedResetUX with 48h countdown + 3-item checklist + return-request flow when `stage.currentStage === 4 || forcedResetTriggeredAt != null`). v1.1 §5.5 framed Center entirely as "system interrupt surface (FD-5) / safe room 아님 / system friction" — direct conflict with the shipped 2-mode product. Phase 1 STEP 2 4-doc cross-check confirmed the v1.1 §5.5 outlier framing: `BTY_ARENA_VISUAL_BEHAVIOR_SPEC.md` §1.4 + §1.5 Screens 9-13 (Center Entry / Safe Mirror / Small Wins Capture / Self-esteem Check / Center Mini Recovery) + §3 tone (Calm, Warm pastels), `BTY_CURSOR_MASTER_PROMPT.md` (Recovery layer "structured reset, not failure"; tone calm/observational/non-judgmental), `BTY_MASTER_BUILD_V1.md` §6 Screen Roles ("Recovery — Pressure reset, short re-entry fields, return to Growth / Arena"), `LEADERSHIP_ENGINE_SPEC.md` §5 (Stage4 deterministic forced reset = sub-mode within stage machine, not all of Center). Commander Option β decision (2026-05-14): correct v1.1 §5.5/§8-5 to scope to FORCED_RESET sub-mode; preserve default recovery surface as v1.1.1-compliant; harden Mode B FD-5 enforcement in subsequent sub-phases. **Correction applied — 5 sections edited**: (1) **§5.5 split**: §5.5.1 default recovery surface (Safe Mirror, Small Wins, Self-esteem Check, Tiny Recovery Curve, Healing Phase Tracker, Dear Me letters; voluntary navigation; calm/warm tone allowed; 4-doc consensus cited) + §5.5.2 FORCED_RESET override sub-mode (server-gate trigger via Stage4; full redirect FD-5; HARD LOCKED §8-7; compliance task surface with reset reason + activation weight 2.0 + 48h lockout + completion verification; default mode UI hidden during sub-mode). (2) **§5.5.1 Route lineage note** (Commander addition per 2A review): older specs (CURSOR_MASTER_PROMPT.md, MASTER_BUILD_V1.md) routed Recovery at `/[locale]/growth/recovery`, but live product consolidated Recovery + Dear-Me at `/[locale]/center` via `bty-app/src/middleware.ts:133-146` 301 alias — **`/center` is canonical recovery route, `/growth/recovery` references are historical**. Documented so future readers don't hit the same path confusion. (3) **§6 reframed**: top-level scope clarifier "§6 전체는 §5.5의 FORCED_RESET sub-mode에 적용. Default recovery mode는 §6 prohibition 대상이 아님"; §6.2 header "Center 내 UI 금지 사항" → "FORCED_RESET sub-mode 내 UI 금지 사항"; §6.3 header symmetric reframe; §6.2 added explicit "default recovery surface UI 가려져야 함" bullet for sub-mode; §6.3 cites `LEADERSHIP_ENGINE_SPEC.md` §4/§5 for activation weight + completion verification source. (4) **§8-5 rewritten**: "FORCED_RESET sub-mode 활성 시 Center를 menu/dashboard/safe-room 톤으로 표현 — sub-mode는 system friction. (Default recovery mode에는 §5.5.1에 따라 menu/dashboard pattern + calm·warm 톤 허용 — 이는 v1.1.1 violation 아님.)". (5) **§0 Changelog v1.1 → v1.1.1 (2026-05-14) sub-section** added: change ledger row + "FD-1~FD-6 frozen decisions, §2 row mappings, §8 prohibition list semantics (1/2/3/4/6/7/8 동일; 5만 scope 정확화), §11 Stage 2 LOCKED order — 변경 없음" statement. (6) Title (line 1) `v1.1` → `v1.1.1`; **filename unchanged** per ba1d375 lesson + added "Filename note" preamble. (7) §12 Memory block: new v1.1.1 entry alongside the existing v1.1 entry. (8) Footer Status: `v1.1 frozen` → `v1.1.1 frozen`. **Unchanged sections (per 2A confirmation, re-verified)**: FD-1 through FD-6, §1 Core Principle, §2 row 8 (FORCED_RESET_PENDING → Center, HARD LOCKED), §3 FD-5 ("Center hard interrupt, full redirect, modal 아님" — applies to sub-mode), §4 Lock 등급, §7 Re-exposure, §8-1/2/3/4/6/7/8 prohibition semantics, §9 deferred items, §10 Stage 1 entry, §11 Stage 2 LOCKED order. **4-check gate PASS upfront**: (a) outer fetch + rev-list `0 0` vs `origin/main` at `c9e8dfa` (Commander pushed Play closure between turns), (b) **18 sync-debt entries** IDENTICAL set to Play closure §7.1 (7 prior HK6/HK7/HK8/HK9/Lobby + 11 Resolve-added 2B/2C/2D-1); 0 anomalies, (c) HK6 `getMyPageIdentityState.ts` untouched by 2B (prior leak only), (d) explicit-path staging — 3 doc files only. **Outer sync-debt unchanged at 18 entries** (no inner commit this sub-phase) per HK8 closure clause 4 — pending post-Stage-2 leak-integration sprint per [INNER_PUSH_POLICY §5](INNER_PUSH_POLICY.md). **Stage 2 LOCKED order: step 4/6 IN PROGRESS** (Lobby ✓ → Resolve ✓ → Play ✓ → **Center 2A→2B done, 2C/2D/2E pending** → Foundry → Hub). **다음**: Commander review → push approval → **2C (Mode B FD-5 hardening): middleware redirect for FORCED_RESET_PENDING (add clause to `bty-app/src/middleware.ts:351-368` neighborhood; needs `userHasForcedResetPending(supabase, userId)` helper — Stage4 forced_reset_triggered_at NOT NULL check); HARD LOCKED nav suppression in `Nav.tsx` (L34-54) + `HubTopNav.tsx` (L149, L200) + `BottomNav.tsx` (L32) via shared `useForcedResetActive()` hook or `CenterLayoutShell` context; `ForcedResetUX.tsx` local Arena-only disable cleanup (replaced by global suppression). Platform/Infra Mode dispatch required for the middleware part. Addresses §8-Open #2 inherited from Play closure (FORCED_RESET_PENDING currently renders as Play gate-page with manual `<Link>` — Play closure backlogged ownership to Center step).** → 2D (test middleware redirect + nav suppression; expect inner test count to stay at 17/3221+/6 baseline + small +N for new tests) → 2E (Center closure doc summarizing all 5 sub-phases + 2 §8-Open items + sync-debt growth from 2C/2D).

- [x] 2026-05-14 — **Stage 2 Play close — VERIFICATION-ONLY (Plan A); Play surface already v1.1 §8-compliant for its home rows post-2D-1; 2 §8-Open invariant tensions backlogged with NAMED OWNERSHIP per Commander condition.** Closure doc [`docs/closures/STAGE2_PLAY_CLOSURE.md`](closures/STAGE2_PLAY_CLOSURE.md) (new). **Inner refs unchanged**: HEAD `b92bd0d9` (2D-1); no inner commit this sub-phase. **Phase 1 read-only inventory** mapped `BtyArenaRunPageClient.tsx` (1440 lines post-2D-1) to 15 return paths; only **#7 (L985-1010)** + **#15 (L1244-1439)** render Play-domain content the surface owns per v1.1 §2. **v1.1 §2 home rows VERIFIED compliant**: row 1 `PRIMARY_CHOICE_ACTIVE` → `<ChoiceList variant="elite">` via `s.playUiSegment === "primary_choice"` (L1367-1374, with `<EliteArenaStep2Context>` L1360-1365 + primary-pick hint L1366) ✓; row 2 `TRADEOFF_ACTIVE` → `<EliteArenaPostChoiceBlock>` (L1394-1409) with tradeoff phase instruction ✓; row 3 `ACTION_DECISION_ACTIVE` → `<EliteActionDecisionStep>` (L1378-1387) with `<ArenaBindingError>` fallback (L1388-1392) ✓; row 7 `REEXPOSURE_DUE` → `<ArenaReexposurePanel>` mounted inside Play `<ScreenShell>` (testid `arena-play-snapshot-reexposure`) — two-layer model preserved (server-triggered via `effectiveArenaSnapshot.runtime_state === "REEXPOSURE_DUE"`, client-rendered as Play mode flag) ✓. **§8 PASS evidence**: §8-1 (all gate reads route through `gateSnapshot = s.effectiveArenaSnapshot ?? s.arenaServerSnapshot`; `arenaActionBlocking` derived in `useArenaSession.ts:1070-1073`; no client `runtime_state` writes in BtyArenaRunPageClient); §8-2 production-path (Resolve render branch removed by 2D-1 at `b92bd0d9` + navigation useEffect handoff at `s.arenaActionBlocking` false→true; JSON-engine inline ACTION_REQUIRED at L643-844 is already counted as the deferred 2D-2 Resolve backlog item per [Resolve closure §3.2 + §6](closures/STAGE2_RESOLVE_CLOSURE.md), NOT re-scoped to Play); §8-6 FD-4 (REEXPOSURE_DUE rendered as Play mode flag via ArenaReexposurePanel, not separate surface/overlay/modal). **D4 (re-exposure header phrasing) CLOSED**: already shipped in `src/lib/i18n.ts` — KO `:2928-2940` ("재노출 라운드" + "이전 선택과 연결된 지연 결과가 도착했습니다…" + "시나리오로 들어가기" CTA), EN `:4594-4604` ("Re-exposure round" + "A delayed outcome linked to an earlier choice is ready…" + "Enter scenario" CTA); §7.2 abstract context (no spoiler of prior choice) + §7.3 no "retry"/"skip" framing — verified compliant by Phase 1 inspection (D-N item resolved during prior work, not re-shipped here). **§8-Open backlog (2 tensions, NAMED OWNERSHIP per Commander condition on Plan A)**: (1) **NEXT_SCENARIO_READY rendered in Play** at `BtyArenaRunPageClient.tsx:1067-1167` (3 sub-branches: re-exposure-inside-next-ready / blocked / ready-CTA `arena-next-scenario-continue`); v1.1 §2 row 9 lists Surface = Lobby or Hub; test-pinned by snapshot-gates P5 E (4 tests at `BtyArenaRunPageClient.snapshot-gates.test.tsx`). **OWNERSHIP: Stage 2 step 6 (Hub)** — Lobby refactor `7e4b33ca` did route separation but did NOT resolve v1.1 §9 D1 ("Lobby ↔ Hub 통합 여부") for NEXT_SCENARIO_READY surface ownership; Hub step must decide whether NEXT_SCENARIO_READY moves to Hub or Lobby, migrate the rendering accordingly, update P5 E tests, then remove L1067-1167. (2) **FORCED_RESET_PENDING rendered as Play gate-page with manual `<Link href={/center}>`** at `BtyArenaRunPageClient.tsx:1031-1065` (testid `arena-forced-reset-go-center` at L1056); v1.1 FD-5 requires full redirect (Center hard interrupt) not a Play-surface gate with click-to-Center CTA; test-pinned by snapshot-gates P5 B. **OWNERSHIP: Stage 2 step 4 (Center)** — middleware at `bty-app/src/middleware.ts:351-368` already redirects for `userHasBlockingArenaActionContract` but NOT FORCED_RESET_PENDING (different runtime state); Center step adds the FD-5 enforcement (middleware redirect for FORCED_RESET_PENDING + Center route ownership), updates P5 B test, then removes L1031-1065. Both tensions are **pre-existing** (predate Stage 2), neither introduced by Resolve or Play; surfaced under named ownership so they don't become silent debt across remaining Stage 2 steps. **Plan A chosen** (verification + closure) over Plan B (D4 polish — already shipped + §7-compliant per Phase 1 review) and Plan C (NEXT_SCENARIO_READY/FORCED_RESET fixes — D1-blocked / Center-scope; both would commit to architectures not yet designed). **4-check gate PASS upfront**: (a) outer fetch + rev-list `0 0` vs `origin/main` at `4406ced` (Commander pushed 2E Resolve closure between turns), (b) **18 sync-debt entries** — IDENTICAL SET to Resolve 2E closure §8.1 (7 prior HK6/HK7/HK8/HK9/Lobby + 11 Resolve-added 2B 3 outer-view + 2C 5 + 2D-1 3); 0 anomalies, (c) HK6 `getMyPageIdentityState.ts` untouched by Play step 3 (prior leak only), (d) explicit-path staging — 3 doc files only. **Outer sync-debt unchanged at 18 entries** (no inner commit this sub-phase — Plan A = outer-doc-only) per HK8 closure clause 4 — pending post-Stage-2 leak-integration sprint per [INNER_PUSH_POLICY §5](INNER_PUSH_POLICY.md). **Stage 2 LOCKED order: step 3/6 complete** (Lobby ✓ → Resolve ✓ → **Play ✓** → Center → Foundry → Hub). **Verification-only as legitimate closure class**: not a skipped step — 2D-1's production Resolve removal + existing Play-domain code/copy absorbed what would have been Play step 3 refactor work; inventing inner work to "earn" a commit would have pushed into D1-blocked (Hub) or pre-committed Center architecture territory, both correctly rejected per "don't invent scope" dispatch instruction. Unpushed pending Commander review. **다음**: Commander review → push approval → Stage 2 step 4 = **Center** (inherits §8-Open #2 — FD-5 full-redirect enforcement for FORCED_RESET_PENDING).

- [x] 2026-05-14 — **Stage 2 Resolve close — v1.1 §8-2 PRODUCTION-path RESOLVED via route separation (BtyArenaRunPageClient renders zero production Resolve states; ArenaResolveClient owns /play/resolve); JSON-engine relocation DEFERRED per Commander Option B.** Closure doc [`docs/closures/STAGE2_RESOLVE_CLOSURE.md`](closures/STAGE2_RESOLVE_CLOSURE.md) (new). **Inner commit chain** `7e4b33ca` (Lobby) → `9dc9076c` (2B) → `d51bfb4c` (2C) → `b92bd0d9` (2D-1); explicit `inner-main` ff-sync verified at 2D-1 (`main == inner-main == b92bd0d9`) per 2D-1 lesson (never implicit). **Sub-phase chain**: **2A** read-only inventory mapped L988-1066 production Resolve block + L618+ JSON-engine ACTION_REQUIRED block + ITEM 2 EmptyState edge case + orphan `ArenaResolveScreen.tsx`. **2B `9dc9076c`** added `play/resolve/ArenaResolveClient.tsx` + `page.tsx` + `layout.tsx` (production Resolve path), added 7 `jsonFlow`-family SavedArenaState schema slots to `useArenaSession.ts` (writes deferred to 2D), BtyArenaRunPageClient untouched — both paths coexist. **2C `d51bfb4c`** authored test guardrail BEFORE 2D surgery: migrated `snapshot-gates.test.tsx` P5 A (3 tests) + P5 D (1 test) to render `ArenaResolveClient` directly with `arena-resolve-main-pending-contract` testid, FLIPPED `arena-guards.spec.ts` `/play/resolve` from deprecated-redirect to non-deprecated-Resolve-surface, +14 NEW tests across `ArenaResolveClient.test.tsx` (9) + `ArenaResolveClient.empty-state-edge-case.test.tsx` (3, pins ITEM 2) + `play/resolve/page.test.tsx` (2 route mount tests); 0 prod code changes. **2D-1 `b92bd0d9`** removed `BtyArenaRunPageClient.tsx:987-1066` (production Resolve render branch + 3-way fallback including the ITEM 2 EmptyState), added `import { useRouter } from "next/navigation"` + `resolveNavigationFiredRef` one-shot guard + transition useEffect that calls `router.push('/${localeNorm}/bty-arena/play/resolve')` on `s.arenaActionBlocking` false→true (and resets the guard on true→false for fresh re-entries); re-pointed `action-decision-503.integration.test.tsx` end-state to `expect(mockRouterPush).toHaveBeenCalledWith("/en/bty-arena/play/resolve")` with hoisted spy + legacy testids asserted null; added next/navigation mock to `json-reexposure.test.tsx` as infra-only fix (no assertion changes; JSON-engine path stays deferred to 2D-2 per dispatch); explicit `inner-main` fast-forward + `git rev-parse` verification (`main == inner-main == b92bd0d9`). **2D-2 DEFERRED (Option B)**: at STEP 1 the dispatch's premise ("2B's jsonFlow fields persist across navigation already") was VERIFIED FACTUALLY INACCURATE (0 saveState writes, 0 loadState reads, 0 hook exposure — all JSON-engine state remains `React.useState` in BtyArenaRunPageClient.tsx:85-104). Option A "relocate intact + state lift" requires lifting ~10 state vars + handlers into useArenaSession.ts (2400-line state machine) — risk peak > 2D-1's surgery, payoff (§8 closure for dev-only path) insufficient under deadline. Commander Option B = defer relocation; document the leak; absorb 2D-2 into 2E closure doc. **§8-2 status**: PRODUCTION path **RESOLVED** (user-facing surface boundary enforced via route separation); JSON-engine path explicitly OUT OF §8 USER-FACING SCOPE (non-production, `jsonCatalogDevMode`-gated dev tool, zero real-user exposure) — OPEN as documented backlog item, not blocking user-facing compliance. **ITEM 2 EmptyState edge case**: the null-snapshot EmptyState fallback at L1042-1050 (`arena-play-action-block-no-contract-payload` testid) is gone — Commander-approved intentional behavior change. ArenaResolveClient now redirects to /play in that case (logically impossible hook state previously rendered as EmptyState; redirect is v1.1 §4.3 transition table correct). Pinned by `ArenaResolveClient.empty-state-edge-case.test.tsx` so future code archaeology cannot mistake the removal for an accidental drop. **Tests**: **17/3221/6** at 2D-1 close (exact baseline; same 7 failing files as before Stage 2: arena/n/session 4, arena/session/next 5, bty/healing 4, bty-healing smoke 1, bty-healing-awakening Q3 1, MyPageLeadershipConsole 1, delayed-outcome-e2e 1). +14 NEW tests; 6 migrated/re-pointed; 0 new failures introduced by Resolve sub-phase chain. **4-check gate PASS upfront for 2E**: (a) outer 0/0 vs `origin/main` at `108a280`, (b) 18 sync-debt entries enumerated and classified — 7 prior at outer 108a280 (HK6 1 + HK7 3 + HK8/HK9 1 + Lobby 2) + 11 Resolve-added (2B 4 + 2C 5 + 2D-1 3); 0 anomalies, (c) HK6 `getMyPageIdentityState.ts` untouched by 2E (prior leak only), (d) explicit-path staging — 3 doc files only (this closure + CURSOR_TASK_BOARD row + CURRENT_TASK row). **Outer sync-debt set now 18 entries** per HK8 closure clause 4 — pending post-Stage-2 leak-integration sprint per [INNER_PUSH_POLICY §5](INNER_PUSH_POLICY.md). **Stage 2 LOCKED order: step 2/6 complete** (Lobby ✓ → **Resolve ✓** → Play → Center → Foundry → Hub). **Deferred backlog (Resolve-originated, in [closure §6](closures/STAGE2_RESOLVE_CLOSURE.md))**: (1) 2D-2 JSON-engine ACTION_REQUIRED relocation + useArenaSession state lift, (2) orphan `ArenaResolveScreen.tsx` cleanup (§8-4-violating, never rendered post-2B), (3) `AWAITING_VERIFICATION` vs `ACTION_AWAITING_VERIFICATION` naming → v1.2, (4) v1.1 §9 D3 micro-feedback range / D6 approver scan flow (non-§8-blockers, confirmed at Resolve code-time, still deferred), (5) borderline JSON-engine framing ("Action commitment recorded" feedback-style copy) — flagged for future framing-cleanup pass. Unpushed pending Commander review. **다음**: Commander review → push approval → Stage 2 step 3 = **Play**.

- [x] 2026-05-14 — **Stage 2 Lobby refactor complete — v1.1 §8-2 violation resolved (route separation; in-scenario player no longer mounts inside Lobby surface).** Inner commit `7e4b33ca` "refactor(arena): separate Lobby entry from Play surface (v1.1 §8-2 compliance)" pushed to `origin/inner-main` (now at `7e4b33ca`, was `6f8f4dec`). **Refactor (2 files, +9/-13)**: (1) `ArenaEntryClient.tsx` removed `useState<"select"|"full">` mode toggle + removed `BtyArenaRunPageClient` import + added `useRouter` — `handleFullArena` now `router.push(\`/${locale}/bty-arena/play\`)` while preserving `localStorage.removeItem("btyArenaState:v1")` for fresh-step-2 entry; entry-card UI + `--arena-*` design tokens unchanged. (2) `play/page.tsx` replaced redirect with server-component mount of `<BtyArenaRunPageClient pipelineDefault="new" />` per v1.1 §5.2. **Pre-flight (Phase 1)**: 0 tests required updating (verified: no tests reference `ArenaEntryClient`, no tests assert `BtyArenaRunPageClient` inside `ArenaEntryClient`; `mode='full'` in `route.test.ts` was unrelated API field; q237 stub-routes test `/wireframe`/`/growth`/`/my-page` not `/bty-arena`/`/play`). **5-gate PASS upfront** (working tree clean inner-side, tests 17/3207/6 = baseline preserved, HK6 untouched, inner-branch-only push, outer `origin/main` HEAD `79ad264` recorded). **frontend-design SKILL.md path divergence noted**: dispatch cited Anthropic-sandbox path `/mnt/skills/...` (absent locally); used local copy at `~/.claude/plugins/marketplaces/claude-plugins-official/plugins/frontend-design/skills/frontend-design/SKILL.md` (verified same content). Design tokens sourced from `bty-app/docs/BTY_ARENA_DESIGN_TOKENS.md` — preserved verbatim, no new tokens introduced. **Outer sync-debt set now 7 entries (5 HK8 + 2 Lobby refactor)** per HK8 closure clause 4 + Option 1 acceptance — pending post-Stage-2 leak-integration sprint per [INNER_PUSH_POLICY §5](INNER_PUSH_POLICY.md). Gate (b) is now **parametric** (known sync-debt set, not hardcoded count). **Out of scope (preserved as-is)**: `lobby/page.tsx` (redirect alias, dead — flagged for later cleanup), `lobby/layout.tsx` (dead full-screen shell), `BtyArenaRunPageClient.tsx` internals, `hub/`, `wip-v2`, AL-2-D-P1 freeze paths. **다음**: Stage 2 step 2 = Resolve (highest §8 prohibition violation risk per v1.1 §11 — FD-6 Action Gate + LOCKED state + §8-3/4/8 prohibitions).

- [x] 2026-05-14 — **Inner History Rewrite Sprint Stage B complete — 207MB openwebui tar removed from inner history via `git filter-repo` + secrets-safety .gitignore integrated to outer (parity with inner).** [`docs/closures/INNER_HISTORY_REWRITE_2026-05-14.md`](closures/INNER_HISTORY_REWRITE_2026-05-14.md) (new). **Context**: inner-main first push (Stage A creation) rejected by GitHub's 100MB limit — `openwebui-backup-20260426.tar.gz` (217,539,189 bytes) at inner root commit blocked all 72 commits. **Stage A**: filesystem backup at `/Users/hanbit/Dev/bty-app-PRE-REWRITE-BACKUP-2026-05-14` (4.4GB, HEAD verified match) + git safety branch `backup/inner-main-pre-rewrite-2026-05-14` (later rewritten to new hashes). **Stage B Part 2**: `git filter-repo --path openwebui-backup-20260426.tar.gz --invert-paths --force` (Commander manual; auto-mode classifier blocked first attempt — same pattern as [[discipline_classifier_shared_staging_block]]). **Stage B Part 3 verification (16 checks PASS)**: tar gone from all history (0 blobs ≥100MB; ≥10MB also empty), 72 commits preserved, all subjects identical except 3 inline-hash-references rewritten by filter-repo `--replace-refs`, .git 1.3GB → 329MB, **tests 17 fail/3207 pass/6 skip = EXACTLY baseline (no regression)**. **Old→new mapping**: inner-main `2626f9a7` → `6f8f4dec` (full 400-entry commit-map at `bty-app/.git/filter-repo/commit-map`); 3 al-launch-* tags re-pointed; 11 origin/* migrated to local branches. **Boundary doc cascade policy**: pre-rewrite inner-hash citations across outer docs (INNER_PUSH_POLICY, Stage 1 mapping, HK8/HK9/HK7 closures, MEMORY.md) are HISTORICAL-ONLY — not mass-updated. **.gitignore integration (Option 2)**: outer view of `bty-app/.gitignore` after rewrite showed +6 lines (env-coverage from inner `2626f9a7`→`6f8f4dec`); per security-motivated parity decision, integrated to outer in same commit (boundary doc + .gitignore + 2 board updates = 4 files staged). The 5 HK8 leaks remain unstaged per separate-sprint discipline. **Anomalies recorded but not blocking**: prior filter-repo run on 2026-05-01 (`.git/filter-repo/` mtime), ref-map main old hash `3957a68a` ≠ Stage A's measured `2626f9a7` (likely Commander momentarily moved main during manual execution; final state aligned). **Recovery path**: filesystem backup at `/Users/hanbit/Dev/bty-app-PRE-REWRITE-BACKUP-2026-05-14` (DO NOT delete until Stage C confirmed). **Mutation outer this commit**: 4 files (boundary doc new + .gitignore integration + 2 board updates); 5 HK8 leaks preserved per HK8 closure clause 4 (untouched, unstaged). **다음**: Commander review → push approval → Stage C (inner-main re-push to origin, now possible without 207MB blocker) → eventual leak-integration sprint for 5 HK8 leaks.

- [x] 2026-05-14 — **Inner Push Policy Sprint complete — HK8 Option D operationalized as Scope 1-B (disciplined coexistence, `inner-main` branch).** [`docs/INNER_PUSH_POLICY.md`](INNER_PUSH_POLICY.md) (new) + [`docs/INNER_PUSH_POLICY_PREFLIGHT_INVENTORY.md`](INNER_PUSH_POLICY_PREFLIGHT_INVENTORY.md) (new) committed in single outer commit. **Recognition clause**: inner and origin/main are independent codebases sharing one GitHub remote — no merge-base at any depth (verified), 71 inner-only commits (all `+` on `git cherry`, 0 cherry-equivalent), 530 origin-only commits, disjoint file trees (5 leak paths have 0 commits in origin/main). HK8 Option D, now operationalized. **Targeting**: inner pushes ONLY to `inner-main`; forbidden from `origin/main`. **Push gate**: 5-check extending HK8 4-check ((a) inner clean / (b) no NEW vitest failures vs baseline / (c) HK6 file no re-touch / (d) explicit-branch staging / (e) outer origin/main HEAD recorded). **Leak integration pattern**: outer fetches inner-main → cherry-pick → outer 4-check → push origin/main. Actual 5-leak integration is a SEPARATE sprint (prereq: inner-main exists + inner has pushed). **Stash probe (Part 1)**: 82-file stash @ `stash@{0}` parent `aa5cd07` — **NOT C7/E3/F2/G5** (0 codename matches), confirmed **AL-1.9 sprint family WIP** (markers: AL-1.9-E-P5-A, AL-1.9-E-P1, AL-1.9-D-R4). bty-arena/page.tsx stash change SUPERSEDED by inner commit `66af5946`; BtyArenaRunPageClient.tsx + useArenaSession.ts hunks are REVERTED-WORK backups (elite ESCALATION UI from `fb9d700b`, reverted by `a92e531f`). **Stage 2 Lobby blocking: NO** — stash held during Stage 2 Lobby is safe; orthogonal scope. Disposition recommendation: commit-and-name to `wip/stash-2026-05-12-al19-era-snapshot` safety branch then drop active stash (Commander decision deferred). **C7/E3/F2/G5 file scope: UNKNOWN** (consistent across probes — not in branches, not in stash). **4-check gate PASS upfront**: (a) origin/main 0/0, (b) 5 HK8 leaks + 4 new doc entries only, (c) HK6 file untouched, (d) explicit-path staging. **Out-of-scope (deferred)**: true history normalization 1-A (post-deadline backlog), 5-leak integration execution (separate sprint), C7/E3/F2/G5 mapping (WIP-triage probe), inner-main branch creation (inner-side execution step), origin/main 530-commit timeline investigation (awareness only), stash disposition (Commander decides). Mutation = 4 outer docs (2 new + 2 board updates); bty-app/ untouched; AL-2-D-P1 freeze + 5 HK8 leaks preserved. Unpushed pending Commander review. **다음**: Commander review → push approval → optional follow-up sprints (stash triage / inner-main creation / 5-leak integration).

- [x] 2026-05-14 — **Stage 1 Figma Frame Mapping doc authored — Stage 0 gate satisfied for BTY Arena Cursor pipeline.** [`docs/BTY_ARENA_STAGE1_FRAME_MAPPING_REPORT.md`](BTY_ARENA_STAGE1_FRAME_MAPPING_REPORT.md) per v1.1 (`db97c55`, supersedes `ba1d375` placeholder + `6fc83bf` v1). 7-row master table (6 Claude design surfaces + `ios-frame.jsx` wrapper) using v1.1 Trigger/Render 2-column authority model (C-A5+C-A9). Per-surface detail blocks (Lobby/Play/Resolve/Foundry/Center/Hub-candidate); Stage 2 LOCKED order **Lobby → Resolve → Play → Center → Foundry → Hub** per v1.1 §11 (C-A4); A1-A9 ambiguity register with resolution sources; Stage 2 entry checklist (§8 lint rules + `ios-frame.jsx` HARD LOCKED constraint + AL-2-D-P1 freeze + HK8 5-leak preservation). **D1 KEPT DEFERRED** per Commander Q-A — Hub identity resolves at Stage 2 Lobby code-time per v1.1 §9-D1. **A2 HK6 isolation verified** — `getMyPageIdentityState.ts` has 0 FORCED_RESET/Center references; no Stage 1 surface impact. **4-check gate PASS upfront**: (a) `origin/main` 0/0 ahead/behind, (b) `git status` = 5 HK8 leaks + 3 new docs only, (c) HK6 file untouched (leak preserved), (d) explicit-path staging. Mutation = 3 outer docs (1 new + 2 board updates); bty-app/ untouched; `src/data/scenario/` + `src/lib/bty/runtime/` + `wrangler.toml` untouched (AL-2-D-P1 freeze). Unpushed pending Commander review per Q-C. **다음**: Commander review → push approval → Stage 2 Cursor dispatch (Lobby first).

- [x] 2026-05-10 — **AL-2-D-P1 Reproducibility Reconciliation Step A family STRUCTURALLY COMPLETE — BTY reproducibility governance first forensic sprint.** Inner=`50317b8 → f0b4b70` (Step A.3 commit `fix(archetype): restore tracked fingerprint dependency closure`, +1282/-0 across 13 files), outer chain `ce8390b → this commit`, worker `e9e179ed-38a7-40ae-8f97-13cfb09191b7` (untouched). **AL-2-D-P1 V=1 freeze invariants 5/5 PRESERVED** (FINGERPRINT_VERSION=1 / alias 59 / Lock 7 raw passthrough / Lock 4 active = QUIETFLAME 1 / R3.5.2 closure). **4 step outcomes**: A.1 archetype/ inventory (16 = 3 tracked + 13 untracked, broken import graph at HEAD `50317b8` — tracked `buildFingerprintInput.ts` + `tensionAxisToAxisVector.ts`가 untracked `./fingerprint` 등에 의존) · A.2 `getMyPageIdentityState.ts` M qualification → **UNRELATED_WIP** (`arena_profiles.core_xp_total` → `arena_memberships.core_xp` DB schema migration consumer 변경, AL-1.9-C `2026-05-06` 정정의 역방향 — production reachability YES via `/api/bty/my-page/state`) → HK6 candidate · A.3 archetype/ tracked commit `f0b4b70` (13 files: earnedNaming/fingerprint/index/lockService/rules/selector/transition + 6 tests, vitest 61/61 in-place PASS) · A.4 fresh worktree verification via `git worktree add --detach f0b4b70 bty-app-fresh-a4` 7/7 signals PASS (FI-1 HEAD = f0b4b70 / FI-2 clean / FI-3 M not carried / FI-4 untracked 0 / FI-5 modified 0 / archetype tsc 0 / archetype vitest 61/61). **Core distinction confirmed**: Semantic freeze ≠ Repository reproducibility freeze (이전 conflate된 두 개념 분리 정의 establish). AL-2-D-P1는 semantic freeze였으나 repository reproducibility freeze는 archetype/ scope에서만 부분 회복. **Phantom dependency threat class identified**: tracked authority + untracked target = reproducibility threat. Variant 1 (inner-tracked authority + inner-untracked target) closed for archetype/, OPEN for `@/lib/llm` (letterService.ts + layer2Semantic.ts consumers → HK7). Variant 2 (outer-untracked target + inner-tracked source) identified at closure (outer가 `buildFingerprintInput.test.ts` + `tensionAxisToAxisVector.ts`를 ??로 보지만 inner는 tracked → HK8). **Errata (2)**: ERRATUM_A4_G5 (dispatch authoring package manager inventory failure — pnpm 명시 vs npm 환경 실제; C3 spirit-preserving substitution `npm ci --no-audit --no-fund` ACCEPTED, frozen-lockfile spirit 보존) · ERRATUM_A_CL_PATH (closure dispatch outer path inventory failure — root path 명시 vs `docs/CURSOR_TASK_BOARD.md` 실제 canonical; C3 HALT pre-mutation + substitution ACCEPTED; newly-minted `discipline_dispatch_environment_inventory` self-validation 사례). **Backlog additions (4)**: HK6 schema migration consumer reflection · HK7 `@/lib/llm` phantom dependency closure · HK8 outer-to-inner repo sync (phantom variant 2 governance discipline 부재) · HK9 orphan inventory docs cleanup. **Inner working tree preserved**: M `src/lib/bty/identity/getMyPageIdentityState.ts` 보존 (Commander Q2 final; HK6 처리 시점까지 유지). **Outer pre-existing dirty state**: 7 entries (5 bty-app/ stale view + 2 orphan docs `AL-1.9-D-r3-inventory.md` + `AL-2-C5-24h-observe-inventory.md`) preserved untouched per G-CL-16. Worker e9e179ed: untouched (not interrogated, deploy 0). Tests 66/66 carry-forward + archetype 61/61 PASS (in-place + fresh worktree 양쪽). Deploy 0 / inner src/ mutation 0 (commit f0b4b70은 tracked status migration only, content 변경 0) / runtime impact 0.

- [x] 2026-05-10 — **AL-2-E sprint family CLEAN CLOSE — Phase 1 / Step 2 / Phase 2 모두 종결 (Ψ-1 sequence 완료, 17 docs / 5 commits).** Inner=`50317b8`, Outer chain=`d896de7 (Phase 1) → f9515d7 (Step 2 spec) → d513c6e (Step 2 ops) → aff7628 (Phase 2 audit + reconciliation) → this commit (operating docs)`, Worker=`e9e179ed-38a7-40ae-8f97-13cfb09191b7` (unchanged). **AL-2-D-P1 freeze invariants 5/5 PRESERVED across AL-2-E** (FINGERPRINT_VERSION = 1 / alias 59 / Lock 7 raw passthrough / Lock 4 active = QUIETFLAME 1 / R3.5.2 closure). **Critical findings (4 substantive)**: F-P2-1 `core_01` architectural OUTLIER (8 action_decision keys vs 4 standard, drift density #1=26, production signals 0) → R1 dormant elite experimental architecture · F-P2-2 i1/i3 vocabulary drift 35/135 cells (25.9%, runtime-neutral via Lock 7; i2/i4/i5 = 100% INTACT, behavioral pressure geometry preserved; VIOLATION 0) · F-P2-3 F1 phantom × 3 baseline users overlap (`patient-complaint-revised-estimate` 20 rows / 3 baseline users incl QUIETFLAME 38ce28d2; 29-day window pre-AL-2; 10-day silent gap = engine version migration boundary) → R3 HK4-F1 merged forensic sub-sprint · F-P2-4 propagation + title-body pressure DRIFT 0 (closing layer integrity 100%). **Commander reconciliation R1-R6 결정 + new principles P1-P4** documented in [docs/AL-2-E-PHASE2-RECONCILIATION-APPENDIX.md](AL-2-E-PHASE2-RECONCILIATION-APPENDIX.md): R1 core_01 dormant elite (보존, 승격 금지) / R2 26 standard action_decision FORBIDDEN 유지 (예외 없음) / R3 HK4-F1 merged forensic-only / R4 HK5 axis layer 우선 (HK2 후순위) / R5 HIGH 3 진행 + MEDIUM/LOW defer / R6 production-weighted priority formula `(production_exposure × 0.5) + (semantic_risk × 0.3) + (drift_density × 0.2)`. **New principles**: P1 dormant_experimental vs production_qualified 분리 / P2 similarity ≠ canonical equivalence / P3 production-weighted priority / P4 forensic-only sub-sprint pattern. **17/17 Hard Guards PASS** (P2-1~P2-5 + base 1-12 across 3 commits). **Pending sub-sprints (priority-ordered per R4)**: 🔼 Priority 1 HK4-F1 merged forensic sprint (R3 승인, forensic-only — lineage reconstruction + semantic authority trace + engine generation mapping) / 🔼 Priority 2 HK5 axis layer cleanup sprint (R5 HIGH 3 — Ownership prefix / Time prefix / Reputation→Visibility, alias recommendation only, runtime rewrite 금지) / Priority 3 HK2 pattern_family layer sprint (HK4-F1 + HK5 완료 후). **Mutation roadmap (R6 formula)**: Phase 3 mutation phase entry = priority_score 산정 + Commander 승인. **BTY architecture maturity**: Stage 1-4 COMPLETE (scenario / pattern / runtime / freeze discipline) / Stage 5 IN PROGRESS (semantic governance) / Stage 6 ENTERING (longitudinal identity continuity via HK4-F1). **AL-2 sprint family STRUCTURALLY COMPLETE** (AL-2-A / B / C / D-P0 / D-P1 / E 모두 CLEAN CLOSE). Tests 66/66 PASS (carry-forward, no run). Deploy 0 / src/ mutation 0 / runtime impact 0.

- [x] 2026-05-10 — **AL-2-E Ψ-1 Step 2 CLEAN CLOSE — Lock 5 spec 보강 완료 (9 categories classified, Phase 2 entry condition MET).** Outer `d896de7 → f9515d7 (Lock 5 spec + guidelines append) → this commit (operating docs)`, inner `50317b8` (unchanged), worker `e9e179ed-38a7-40ae-8f97-13cfb09191b7` (unchanged). **Lock 5 spec**: [docs/LOCK_5_SEMANTIC_BOUNDARY_SPEC.md](LOCK_5_SEMANTIC_BOUNDARY_SPEC.md) (NEW; citation source: Commander decision — semantic anchor `lock5_semantic_boundary`). **4-tier classification**: 3 FORBIDDEN (action_decision text / `dbChoiceId` / `next_map`) · 5 RISKY (primary choice / escalation / second-choice / `bty_tension_axis` phrasing / propagation) · 1 CONDITIONAL (title-body: pressure shift → RISKY, else SAFE) · SAFE (cross-cutting edit class: typo/grammar/locale/clarity). **5-invariants pre-mutation check**: `FINGERPRINT_VERSION=1` / alias 59 / Lock 7 raw passthrough / Lock 4 active = QUIETFLAME 1 / R3.5.2 closure. **Guidelines update**: [SCENARIO_CONTENT_GUIDELINES.md](SCENARIO_CONTENT_GUIDELINES.md) 4-tier 요약표 + 5-invariants + spec link append-only (sha256 verification: original 86 lines unchanged; +49 lines appended; 0 deletions). **9 [DEFERRED_NO_CITATION] categories from Phase 1 Area 4**: 모두 resolved per Commander decision. **AL-2-D-P1 freeze invariants ALL PRESERVED** (5/5: FINGERPRINT_VERSION = 1 / alias dictionary 59 / Lock 7 raw passthrough / Lock 4 QUIETFLAME 1 / R3.5.2 closure). **Phase 2 entry condition MET** — Step 3 Phase 2 audit (Path 1 27-scenario deep audit) dispatch awaitable. **Backlog**: AL-2-E Phase 2 🔼 우선순위 격상 (entry condition met); AL-2-HK HK4 + F1 phantom 합병 처리 후순위 유지. Tests 66/66 PASS (carry-forward, no run). Deploy 0 / src/ mutation 0 / runtime impact 0. **다음**: Step 3 Phase 2 audit dispatch (Commander 영역).

- [x] 2026-05-10 — **AL-2-E R3 Phase 1 CLEAN CLOSE — snapshot lock acquired (Ψ-1 sequence Step 1 of 3).** Outer `4f19421 → ba7eade (10 docs commit) → this commit (operating docs)`, inner `50317b8` (unchanged), worker `e9e179ed-38a7-40ae-8f97-13cfb09191b7` (unchanged). **Phase 1 deliverable**: 10 docs (5 Area 0 authority/distribution + 4 Audit Areas + 1 reconciliation appendix [docs/AL-2-E-R3-PHASE1-RECONCILIATION-APPENDIX.md](AL-2-E-R3-PHASE1-RECONCILIATION-APPENDIX.md)). **Critical findings (4)**: F1 phantom signal `patient-complaint-revised-estimate` (20 DB / 0 JSON) → AL-2-HK HK4 forensic 합병 / F2 axis system-wide drift Reputation + 14 non-canonical (runtime impact 0) → Phase 2 + Step 2 / F3 elite cohort 0 production signals (Path 2 95-row 0 hit) → Phase 2 path scope = Path 1 only / F4 Lock 5 9 categories [DEFERRED_NO_CITATION] → Step 2 Commander session. **Markers**: 2 [SEMANTIC_DRIFT_DETECTED] · 9 [PHASE_2_DEFERRED] · 9 [DEFERRED_NO_CITATION] · 2 `<C5 inventory에서 확인>`. **17/17 Hard Guards PASS** (base 13 + E1-E4). **AL-2-D-P1 freeze invariants ALL preserved**: FINGERPRINT_VERSION = 1 / alias dictionary 59 entries / Lock 7 raw passthrough / Lock 4 active baseline = QUIETFLAME 1 / R3.5.2 closure. **Pending**: Step 2 Lock 5 spec 보강 (Commander session, Hanbit 입력 필요 — 9 [DEFERRED_NO_CITATION] 영역 분류). **Pending**: Step 3 Phase 2 audit (Path 1 27 scenarios deep audit, Step 2 완료 후). **Backlog updated**: AL-2-HK HK4 + F1 phantom forensic 합병 권고. Tests 66/66 PASS (carry-forward, no run). Deploy 0 / src/ mutation 0 / runtime impact 0.

- [x] 2026-05-10 — **AL-2-D-P1 CLEAN CLOSE — no-bump V=1 freeze lock (Path P4, Guard 11 PASS).** Outer `3b1eb39 → 0b0db1d (audit 7 + appendix) → this commit (operating docs)`, inner `50317b8` (unchanged), worker `e9e179ed-38a7-40ae-8f97-13cfb09191b7` (unchanged). **24h observe** (window 2026-05-09T04:17:18Z → 2026-05-10T04:17:18Z): scenario α confirmed — T1/T2/T3/T4 ALL UNFIRED. Reconciliation appendix [docs/AL-2-D-P1-R3-RECONCILIATION-APPENDIX.md](AL-2-D-P1-R3-RECONCILIATION-APPENDIX.md) (8 sections). **Markers**: 14/14 [REQUIRES_P0_RECONCILIATION] resolved; 16/26 `<C5 inventory에서 확인>` resolved + 10 deferred → AL-2-HK. **Lock 4 baseline 정정**: active = QUIETFLAME 1 (38ce28d2); STILLWATER (85bd8f1f) historical, superseded 2026-05-02 (pre-AL-2-A by 6d). **Locked invariants**: FINGERPRINT_VERSION = 1 (Lock 6 carry-forward), R3.5.2 closure preserved, alias dictionary 59 entries 활성화 유지, Lock 7 raw passthrough preserved. **이전 'AL-2 sprint family clean closed' (2026-05-09) entry의 'Deferred outer-scope items remain' 종료** — outer-scope items (audit 7 docs + reconciliation appendix + operating docs 2개) 모두 commit. AL-1.9-D-r3-inventory.md은 별도 sprint scope (Guard 9). **AL-2 sprint family final state**: AL-2-A CLOSED / AL-2-B CLOSED / AL-2-C CLEAN CLOSE / AL-2-D-P0 CLEAN CLOSE / AL-2-D-P1 CLEAN CLOSE. **Backlog (registered, no dispatch per Guard 8)**: AL-2-HK (HK1 compat map deletion · HK2 37 LOW row 정책 · HK3 3 dead enum arms · HK4 5 baseline UUID 정밀 식별 · HK5 axis 자유 텍스트 정책) + AL-2-E (scope TBD). Tests 66/66 PASS (carry-forward, no run). Deploy 0 / src/ mutation 0 / runtime impact 0. **다음**: Commander 검증 + Anthropic memory 갱신 (post C5 paste-back).

- [x] 2026-05-09 — **AL-2 sprint family clean closed.** AL-2-A → AL-2-B (P0/P1/P2/P3) → AL-2-C (R3 + mutation) → AL-2-D-P0 cumulative closure. Inner=`50317b8`, outer=`3b1eb39`, worker=`e9e179ed-38a7-40ae-8f97-13cfb09191b7` (bty-arena-staging, no redeploy from C5). Coverage 14.3% → ~83% inventory; 59-entry alias dictionary; 10/12 axes pen()-wired (courage/identity → AL-2-D); activePatterns Set normalized (R3.5.2 closure). Closure snapshot: [docs/AL-2_SPRINT_CLOSURE.md](AL-2_SPRINT_CLOSURE.md). Deferred outer-scope items remain: CURRENT_TASK, CURSOR_TASK_BOARD, AL-1.9-D-r3-inventory.

- [x] 2026-05-08 — **AL-2-A CLOSED — Vocabulary Audit & Semantic Governance Bootstrap.** Sprint goal (decision infrastructure 구축) 완료. **Reframe**: "vocabulary mismatch fix sprint" 아닌 **"normalization inexistence discovery sprint"** — T5 finding 으로 root issue 가 "vocabulary mismatch" 가 아닌 **semantic authority 부재** 임을 입증. **Deliverables**: 4 file 신설 (`docs/AL-2-A-vocabulary-inventory.csv` 110 row · `docs/AL-2-A-mapping-decision-template.csv` 110 row · `docs/AL-2-A-vocabulary-lineage.md` · `docs/AL-2-A-runtime-path-trace.md`) + T5 verify (`patternFamilyCompatibilityMap` = dead artifact, 0 imports, normalization wiring 0). **Code mutation 0** / **Spec edit 0**. Mapping decision deferred to BTY Semantic Council session. **AL-2-B candidate registered** (post-Council normalization wiring + patternRequires recalculation). **AL-2-A 종료 조건 충족**: 4 file 신설 + verify report + operating docs update + code mutation 0 + sprint goal full coverage.

- [x] 2026-05-08 — **AL-1.9-D NO-FIX CLOSE — R3 inventory only, AL-2 escalate.** Implied scope ("archetype mapping cutoff 검토") = vocabulary unification 영역 = spec § 0 L17 "구조 변경 금지" 위반 → no-fix close. R3 4 phase evidence carry-over to AL-2 entry context. Production state (5 rows / 3 users / 4 non-canonical pattern_family / 5 users axis 0.484~0.544) + STILLWATER cutoff 5/5 fail (penalty 0) + spec drift § 5.1 L261 cite. Closure doc [`docs/AL-1.9-D-r3-inventory.md`](AL-1.9-D-r3-inventory.md). Code mutation 0. **AL-2 entry candidate registered** — vocabulary unification scope (axis 구조 재설계 + patternRequires 재정의 + spec wording 정정 + compatibility map 정리). **완료**.

- [x] 2026-05-07 — **AL-1.9-E-P1.1-A staging deploy LIVE — worker `964c3911-3610-4bc7-ab2d-b4fe8eda7881`.** `npm run deploy` (prebuild + cf:build + cf:deploy) staging=production single-env 진행. Bundle 26727.28 KiB / gzip 4089.34 KiB / startup 32ms / upload 13.35sec. URL `https://bty-arena-staging.ywamer2022.workers.dev`. **Pre-deploy state**: inner HEAD `aa5cd07` + working tree D-sub2/D-sub3 (단일 dirty-tree pattern), 13/13 tests green (helper 5/5 + 3 wiring 8/8). **`.env.local` cleanup skipped** per (a-modified) decision — middleware NODE_ENV guard `process.env.NODE_ENV !== "production"` 가 BYPASS_AUTH branch 를 production build 시 tree-shake (SWC dead-code elimination), prior 4 deploy empirical evidence (1ca9f98b/bb1479c6/c79c4432/5aebbe79 동일 패턴 success). **4-signal verify ✅**: (1) version ID `964c3911` 2026-05-07T12:56:20Z wrangler versions list 확인, (2) worker live HTTP 200 `/api/version` valid JSON, (3) bundle grep `handler.mjs` 4× `servedArenaScenarioIds` + 5 chunks D-sub2 wiring shipped, (4) DB baseline Q3 ywamer played_scenario_ids = memory L484 exact match (5aebbe79 baseline 보존, P5-A.2 cold-start archive intact, redeploy 무회귀). **Signal 5 (runtime trace) deferred**: Q1+Q2 0 post-deploy user activity (fresh deploy, organic trigger 대기), 24h 내 자연 user activity 시 organic verify. P1.1-A는 coverage 확장 (main mechanism 이미 verified `5aebbe79`), 즉시성 medium-low → deploy gate 아님. **Incidental — Q2 SQL schema drift**: R3 inventory section 8 의 Q2 draft `arena_events.payload->>'scenario_id'` 사용했지만 actual schema 는 `scenario_id` 직접 column → single-signal violation, `feedback_execution_claim_observable_artifact.md` invariant data layer 강화 case. **잔여 housekeeping**: memory `project_elite_chain_flow_status.md` worker version sequence 갱신 + inner repo D-sub2/D-sub3 commit + closure doc inner column hash drift 정정 + wrangler.toml stale 갱신 (모두 별 cycle, deploy 영향 없음). **AL-1.9-E sprint family closure status maintained + P1.1-A coverage 확장 lock**.

- [x] 2026-05-06 — **AL-1.9-E-P1.1-A / D-sub3 (test + closure axis) complete — sprint closure.** D-sub2 의 caller wiring contract 를 자동 검증하는 3 integration test 추가 + AL-1.9-E-P1.1-A 전체 closure doc 작성. **Test bundle**: `src/engine/integration/post-session-router.served-suppression.test.ts` (2 cases) + `foundry-arena-return.served-suppression.test.ts` (3 cases, admin null Case C 포함) + `recovery-loop-router.served-suppression.test.ts` (3 cases, scenario_retry 한정). 8 cases all PASS. Mock pattern: `vi.mock` module-level (helper + selector + admin + caller dependencies), `expect.objectContaining({ servedArenaScenarioIds: [...] })` assertion. Test scope: wiring contract만 (D-sub2 wiring), 전체 caller behavior NOT covered. **Closure doc**: [`docs/AL-1.9-E-P1.1-A-closure.md`](AL-1.9-E-P1.1-A-closure.md) — commit chain table (3 sub-sprint × 2 commit + cross-ref P1.3 closure + 1 hash backfill follow-up) + verify gate evidence + defer items cross-link (`recovery-loop scenario_retry` resolved via `824a494`) + out-of-scope re-confirm + next entry candidates. tsc baseline 14 unchanged, D-sub1/D-sub2 baseline tests re-run green. ⚠️ **Test 0 safety gap → resolved**. Test inner commit: `b91d893`. Closure outer commit: `6a458b0`. **AL-1.9-E-P1.1-A 전체 sprint COMPLETE**.

- [x] 2026-05-06 — **AL-1.9-E-P1.1-A / D-sub2 (suppression coverage axis) complete — 3 router caller wiring.** D-sub1 의 `fetchRecentServedScenarioIds` helper 를 3 router caller 에 wiring. (1) `src/engine/integration/post-session-router.ts:84` (`routePostSession`) — `client` 항상 non-null fallback, 직접 helper 호출. (2) `src/engine/integration/foundry-arena-return.ts:156` (`handleFoundryCompletion`) — `admin` nullable, 기존 L153 conditional pattern (`programRow = admin ? ... : null`) 정합 `admin ? await helper() : []`. (3) `src/engine/integration/recovery-loop-router.ts:145` (`handleSlipRecovery`, `scenario_retry` case 한정) — `admin` nullable, 기존 L159 dojo_assessment conditional pattern 정합. Net: 3 import + 3 helper call + 3 option field 추가 (+9 insertions). Verify gate 4/4: helper unit 5/5 · arenaSessionNextCore regression 5/5 · tsc baseline 14 pre-existing 0 new · sanity grep (1 API handler + 2 service-layer caller, all pass-through, signature 무변경). Spot-check Mutation 3 brace preservation: case-close `}` (L160) + 후속 `case "dojo_assessment"` (L161) untouched 확인. Out of scope per P1.3 inventory: `quickModeService.ts:39` (router-bypass), `scenario_retry` rename, schema 변경. ⚠️ **자동 test 0 safety gap** — caller integration test 부재. D-sub3 에서 minimal integration test bundle / 별 D-sub2.5 분리 / manual smoke only 중 결정 대기. Inner commit: `91ba61a`. **다음**: D-sub3 (closure doc 통합 + test gap decision). **D-sub2 완료**

- [x] 2026-05-06 — **AL-1.9-E-P1.1-A / D-sub1 (refactor axis) complete — fetchRecentServedScenarioIds helper extraction.** Inline served-suppression query를 `arenaSessionNextCore.ts:103-109` 에서 reusable helper 로 추출 (per AL-1.9-E-P1.3 closure: fix scope 2-axis split, refactor axis 단독 진행). 3 mutations: 1 helper file + 1 caller refactor (+2/-6 lines, import +1 + 7→1 line query block) + 1 unit test (5 cases). 5/5 helper test PASS · arenaSessionNextCore 5 regression test (query shape `in[DONE,IN_PROGRESS,ABANDONED]` + `gte 24h`) preserved · tsc baseline unchanged (14 pre-existing errors in 5 unrelated files, 0 new). Behavior preservation 직접 증거: 기존 query-shape regression test가 helper 추출 후에도 unchanged PASS. 0-risk refactor 확인. Inner commit: `aea73d2`. **다음**: D-sub2 (suppression coverage axis — post-session-router / foundry-arena-return / recovery-loop-router 3 caller 에 `servedArenaScenarioIds: await fetchRecentServedScenarioIds(supabase, userId)` wiring) → D-sub3 (closure doc 통합). **D-sub1 완료**

- [x] 2026-05-06 — **AL-1.9-C RESOLVED — My-page Stage display fix.** AL-1.8-G label fix 후 spot-check (ddshanbit my-page 직접 확인)로 발견: Dashboard Stage Identity = FRAME (Stage 3) vs My-page IdentityHero = STAGE 1: FORGE (default). Root cause: `getMyPageIdentityState.ts:54`이 마이그레이션에 존재하지 않는 `arena_memberships` table 을 query → `maybeSingle()` silent error → 모든 사용자 `coreXp = 0`. Fix: `arena_profiles.core_xp_total` (canonical, dashboard + applyCoreXp/leaderboardService/reflectionRewards 공유). 1 file, ~3 lines, logic 0. Vitest 3159/3165 PASS. STILLWATER 표시는 별 layer (Gap 2, archetype cutoff). **완료**

- [audit] 2026-05-05 — **AL-1.9-A — Signature pipeline 운영 미작동 root cause reframe.** Inventory + Hanbit SQL 검증으로 AL-1.5 OFFICIAL CLOSURE 시점 가설 정정. Pipeline 자체는 정상 작동 (ddshanbit G6 검증 입증). 단일 caller (`patternSignatureUpsert` ← re-exposure validate POST), 4 silent skip conditions. **Dominant root cause = Arena run completion rate** (ywamer 23.9% / hanbitdds 3.4% / ddshanbit 22.7%). complete_verified=0 → AD2 threshold 미도달 → signature 0 (기계적). Pre-AL17 meta 누락은 minor (forward-only 자연 회복). **Forward-only 정책 lock** (backfill 미수행). 다음 sprint AL-1.9-B (가칭): Arena UX completion 분석 — step 0 abort + step 5 abort 패턴 + AD2 threshold 명확성. 메타 학습: Hanbit SQL 1회로 1차 가설 정정 = 메모리 #12 single signal 금지 적용. Fix dispatch 미진행이 정답. **audit 완료**

- [x] 2026-05-05 — **Staging deploy LIVE — Worker `bb1479c6-c247-42ff-99a6-1817298108e1`.** 이번 세션 i18n 작업 전체 (27 ko.json corpus + quick textarea bg fix + i18n.ts try-again→revise) staging=production 단일 환경에 배포. `npm run deploy` (prebuild + cf:build + cf:deploy). Total upload 26.7 MiB / 38 files / 22초. Worker startup 44ms. URL: https://bty-arena-staging.ywamer2022.workers.dev. TS lint 사전 에러는 test 파일 한정으로 production build 영향 없음 확인. **완료**

- [x] 2026-05-05 — **i18n surface coverage Option A (a)+(c) 완료 + 전체 점검 상태 맵 작성.** (a) UI strings sweep — `src/**/*.ts(x)` 703개 한글 포함 파일 스캔, 한글-안 영어 잔존 hybrid 0건 + terminology lint 0 violations로 이미 clean 확인. (c) `i18n.ts:5191` "try again" violation 정리 — `VALIDATOR_ARCHITECTURE_V1.md` Revise lock에 따라 EN: "Validation failed. Please revise and resubmit." / KO 병행 수정 "확인에 실패했습니다. 수정 후 다시 제출해 주세요." (parity). terminology lint 최종 **0 violations**. **남은 미점검 surface**: `bty-website/` (마케팅/챗봇 10 파일, macOS sync duplicate 5개 포함) — 별도 sprint로 분리. **완료**

- [x] 2026-05-05 — **Corpus expansion 완료 — GAP 6 + SHELL 1, 27/27 scenario authored.** Triage: 27 cores 진단 결과 1 SHELL (core_11) + 6 GAP (core_10/13/14/15/16/17 — empty `action_decision.context` only) + 20 PROPER. 처리 순서: (1) GAP 6 — 24 contexts 작성 (light layer fill, BTY 톤 — operational reality + 결정 압박, 사용자 6건 미세 조정 반영: core_10/B 익숙함→기록 / core_13/D 최소한 다시 적기 / core_14/C 신호 erasure framing / core_15/D 같은 환자 두 기준 / core_16/C 자율성+신뢰 같은 문서 / core_17/C 침묵vs신호). (2) SHELL 1 (core_11) — 4 branch × 6 layer = 24 PD-level 작성. Axis lock: A=Passive Acceptance vs Standard Erosion (normalization) / B=Truth-naming vs Definition Burden (standard-bearer cost) / C=Emotional Detachment vs Witness Withdrawal (protective distance) / D=Adaptive Alignment vs Standard Internalization (silent transformation). 사용자 톤 조정: AD1 time window "이번 주" → "다음 두 번의 근무 안에" (DSO operational rhythm) + interpretation_clash perception drift tone 추가 + B AD1 "한 명" 유지 (coalition tone 회피) + D escalation "여긴 원래 그래" forced_reset.trigger와 intentional resonance. **검증**: JSON 27/27 valid, 4 branch unique signals × 7 files all PASS, terminology lint 신규 위반 0, hybrid grep 0. core_07 (relational pressure) + core_11 (observer erosion) = BTY canonical exemplar 두 축 확보. 향후 AI scenario generation reference로 사용 가능. **완료**

- [x] 2026-05-05 — **§ A canonical scenario authoring 완료 — core_07_repair_conversation 4 branch × 6 layer = 24 단위 PD-level 작성.** Discovery에서 scope 재정의: placeholder는 4 escalation_text가 아니라 4 branch 전체가 generic shell로 복제된 상태. **Axis lock** (실제 primary choice의 pattern_family 정합): A=Comfort vs Structural Repair / B=Truth-naming vs Defensive Entrenchment / C=Continuity vs Pattern Repetition / D=Authority Presence vs Power Vacuum. **6-layer × 4 branch**: escalation_text / second_choices(X·Y) / stage_2_escalation / action_decision(context·prompt·AD1·AD2 + 신규 AD2.cost field). Branch A 사용자 검수 후 lock(#7 점검 / #13 전면적 / #21 이력 + AD2 refinement 옵션 a+b 혼합), B/C/D 일괄 적용 (D escalation polish 반영: "한쪽 입장에 더 가까이 가 있다" → "어느 한쪽의 부담을 더 적게 남기는 방향으로 기울어 있다"). **검증**: 4 escalation/tension/prompt/AD1 전부 unique, placeholder stub 0건, JSON valid, terminology lint 신규 위반 0, hybrid grep 0. KO_SCENARIO_BACKLOG.md § A → CLOSED. core_07은 향후 BTY canonical scenario exemplar / writer onboarding sample / AI scenario generation reference로 사용 가능. **완료**

- [x] 2026-05-05 — **§ B sentence-level rewrite 완료 — 27 hybrid + 7 identity_clash = 34건 일괄 재작성.** 사용자 검토에서 3건 톤 조정 적용: #7 check-in→**점검** (therapy 톤 회피, operational coaching 유지) / #13 full 비난→**전면적인 비난** (shame spiral 문맥 반영) / #21 결정 trail→**결정 이력** (audit traceability). 12 파일 직접 Edit. 추가로 발견된 `identity_clash` 필드 7건 (core_09 / core_17) 직접 수정. **sweep 스크립트 v2.1 보강**: walker가 array-of-string 처리하도록 수정 + PROSE_FIELDS allow-list에 `identity_clash` 추가 → 동일 패턴 재발 방지. JSON validity 27/27 PASS, English+Korean hybrid grep 0건, terminology lint 신규 위반 0, dry-run idempotent (0 mutations). KO_SCENARIO_BACKLOG.md § B → CLOSED 표시, § A (4 placeholder, core_07_repair_conversation) 만 미해결로 남음. **완료**

- [x] 2026-05-05 — **i18n v2 glossary sweep 완료.** KO_TERMINOLOGY.md v2 추가 (Group A 한글 loanword 자동 / B 직책 case 정규화 lowercase→Capitalized / C 단독 직책 한글 변환 / D 27 신규 개념어 — trigger=트리거 / E 11 결정 항목 — filling 영어 keep). Sweep 스크립트 v2: KEEP_ENGLISH **case-insensitive 매칭 + canonical 정규화** (lead assistant→Lead Assistant 등). 20 파일 / 178 mutations 적용, JSON validity 27/27 PASS. Sweep 부산물 정리 — `비공개하게→비공개로` 4건 (core_05/06/09/12) + `책임 있는하/하게→책임이 있고/책임 있게` 2건 (core_03/09). 별도 backlog 문서 생성: `docs/i18n/KO_SCENARIO_BACKLOG.md` — § A placeholder 4건 (core_07_repair_conversation 시나리오 미완) + § B Eng+KR 하이브리드 27건 (문장 단위 재작성 필요, glossary 비대상). terminology lint 신규 위반 0. **완료**

- [x] 2026-05-05 — **UX/i18n/Spec triage 일괄 처리 (3 tasks).** **(1) Quick Decision textarea 가독성 fix**: `quick/page.client.tsx:199` — `bg-[var(--arena-surface,#1a1a2e)]` 어두운 fallback이 light 테마(`--arena-text=#2D2A36`)와 동색 충돌 → `bg-white` + placeholder `/40`로 교체. **(2) 한글 시나리오 직역체 sweep**: 글로서리 `docs/i18n/KO_TERMINOLOGY.md` (5 anchor 결정 — office=오피스, gap=공백, ownership=책임, integrity=원칙, AIR=실행 일관성 비율) + 톤 가이드 `docs/i18n/BTY_TONE_GUIDE_KO.md` (Arena/Center/Foundry 분리) 신규 생성. `bty-app/scripts/i18n-sweep-ko-scenarios.mjs` 작성: 인라인 조사 보정(받침 매칭 으로/로, 을/를 등) — 글로벌 조사 패스의 "할 것인가→할 것인이" 함정 회피. 27개 ko.json 중 22 파일 / 423 치환 적용. JSON validity 27/27 PASS, terminology lint 통과(기존 1건 제외). **(3) Quick Decision Mode RFC**: `docs/QUICK_DECISION_MODE_SPEC.md` 신규 — 분산된 근거(Visual Behavior Spec § 2.1·§ 10 + Product Direction + onboarding copy)를 단일 canonical spec으로 통합. 핵심 invariant 명문화: weight=0.5, abandonment 3건/7일, daily XP cap=1200 공유, complete_verified·QR·Pattern Engine·Reflection·Stage transition은 Quick에서 절대 발생 ❌. **완료**

- [x] 2026-05-05 — **AL-1.8-C RESOLVED — Drop dead top-level reinforcement columns.** Hanbit staging DB 직접 검증 (26/0/0/22/3) 로 dead column 확정 → Option B 적용. Migration `20260505100000_drop_arena_pending_outcomes_dead_reinforcement_columns.sql` (DROP INDEX + 2 DROP COLUMN). Code: `reinforcementLoopSchedule.server.ts` + `route.ts` 의 top-level fallback 제거. Tests: fallback assertion → JSONB nested rewrite + mock cleanup 3건. Vitest 3159/3165 PASS, 회귀 0. **Schema philosophy lock**: JSONB validation_payload = single source of truth. AL-1.8 series 완전 종료. **완료**

- [x] 2026-05-05 — **AL-1.8-G RESOLVED — Identity facet labels 명료화.** Inventory로 triple identity facets 의도성 확정 (Stage codeName + Sub-name + Archetype codeName). Single source 통일 거부 (spec 3건 확인). Option A 적용: 5 files, label/i18n only, logic 0. (1) i18n.ts: `leadershipIdentityEyebrow` → `leadershipArchetypeEyebrow` rename + "LEADERSHIP ARCHETYPE"/"리더십 아키타입" + new `leadershipArchetypeSubtext`. (2) PremiumMyPageIdentityScreen.tsx: IdentityHero `identitySubtext` prop. (3) dashboard/page.client.tsx: "Identity" → "Stage Identity"/"단계 정체성" + subtext. 이전 가설 (`useArenaEntryResolution`이 codename source) 정정 — navigation-only. Vitest 19/19 PASS, 회귀 0. **완료**

- [x] 2026-05-05 — **AL-1.8-F COMPLETE — 9 test fails 일괄 해결 (3 sub-sprint).** Self-check + base 사실 검증으로 sprint 진입 보고 정정 (1 fail → 9 fails 실제). **F.1** Healing API mock (3 files, `maybeSingle` 추가, 6 fails). **F.2** Arena UI ESCALATION ack (2 files, primary → ESCALATION → ack → FORCED_TRADEOFF, 2 fails). **F.3** MyPage URL-based mockImplementation (1 file, `useArenaEntryResolution` + `core-xp` 추가 fetch 처리, 1 fail). 6 test files, ~47 lines, production code 0, 회귀 0. Vitest **3159 passed | 0 failed**. 3 commits 분리 권장. **신규 backlog**: AL-1.8-G (Identity codename 불일치 — NOVA vs QUIETFLAME 같은 계정 두 화면). **완료**

- [x] 2026-05-04 — **AL-1.8-E full LIVE — Secure link auto-commit visibility banner (5-state machine).** `33e8283` 1 commit, 3 files (+235 lines): MyPageLeadershipConsole validationStatus state + HTTP status 분기 (401/422/!ok/success) + inline banner JSX + i18n 5 keys + 5 tests. Worker `1ca9f98b-8482-4b56-b910-3246ef035897`. Verification 4/4 PASS: V1 success banner ✅, V1.5 SQL `status=submitted submitted_at=21:21:25` ✅, V2 invalid token → unauthenticated banner ✅, V3 3-signal crosscheck ✅. Inventory에서 handler 인프라 이미 구현됐고 visibility만 결손 발견 → "feature 추가" 가정 정정. **잔여 backlog**: AL-1.8-F WIP test mock interference + AL-1.8-C dead column. **완료**

- [x] 2026-05-04 — **AL-1.8-E partial LIVE — My Page UI contrast + layout reorder + overflow fix.** 4 commits 모두 live: `5c3fbf1` (secure link + dismiss) → `6ce36e1` (JSX reorder) → `d9e6fff` (PatternSignaturePanel 전체 contrast) → `834d582` (Identity Hero/StateCards `min-w-0` + `break-words` + grid breakpoint sm→md). Final worker `55fd3759-e021-4064-acbf-f40306991a9c` (deploy chain: `600e919a` → `73a88260` → `c89d6eab` → `55fd3759`). **잔여**: AL-1.8-E full (secure link `?arena_action_loop=commit` flow token validation + UI feedback). **신규 backlog**: AL-1.8-F WIP test mock interference. **완료(partial)**

- [x] 2026-05-04 — **AL-1.8-D LIVE — Reinforcement choice_type filter expansion.** `1c91674` on top of `885ded1`/`cf240c4`. Worker `d56e6cb7`. 1줄 fix (`delayed-outcome-trigger.service.ts:663`) → reinforcement loop iter2+ follow-up이 `REEXPOSURE_DUE` 셸로 자동 발화. Test: 10/10 + 1/1 + 55/55. Live: iter3 truth_naming row UI 셸 진입 + SQL detect. RELEASE_LOG 2026-05-04 AL-1.8-D entry. **다음: AL-1.8-E (QR display) 또는 AL-1.8-C (dead column cleanup). 완료**

- [x] 2026-05-04 — **AL-1.7 + AL-1.8-A LIVE — G1~G7 staging 검증 완료.** AL-1.7 hold 해제 후 staging 검증 → AL-1.8-A G6 RC2 wiring fix → 이중 사용자/시나리오 검증 통과. Worker `27a8f394` (AL-1.7만, 11:55 PT) → `256e2184` (AL-1.7+AL-1.8-A, 14:13 PT). HEAD `885ded1` on `cf240c4`. 마이그레이션 `20260410120000_arena_pending_outcomes_reinforcement_loop.sql` 직접 적용. AL-1.8-D/E/C 후속 backlog 등록. RELEASE_LOG.md 2026-05-04 entry 참조. **완료**

- [x] 2026-05-03 — **[P0] AL-1.8 7-step Elite Chain UI 조립 완료** — `page.tsx` → `ArenaEntryClient`(모드 선택 랜딩) 연결. `BtyArenaRunPageClient.tsx`에 `legacy_escalation` 렌더러 추가. 전체 INCIDENT-* 시나리오 데이터(escalationBranches.A/B/C/D: escalation_text+second_choices+action_decision) 검증 완료. Pipeline L(legacy)에서 `eliteSetup`+`escalationBranches` 정상 로딩 확인. 미커밋 파일 목록: `ArenaEntryClient.tsx`, `quick/page.tsx`, `quick/page.client.tsx`, `quickModeService.ts`, `api/arena/quick/` 3개 라우트. **UI 조립 완료 — commit + E2E 플레이 테스트 필요**

- [x] 2026-05-03 — **AL-1.7 Phase 1 C3 구현 완료 — Pipeline N BINDING_V1_SECOND 메타 결함 수정** — 3파일 수정: (1) `choice/route.ts`: `tradeoffDirection`/`tradeoffPatternFamily` 캡처 + event meta 주입 + undefined warn; (2) `reexposureValidation.server.ts` line 64: `.eq("SECOND_CHOICE_CONFIRMED")` → `.in(["SECOND_CHOICE_CONFIRMED", "BINDING_V1_SECOND"])`; (3) `patternSignatureUpsert.server.ts`: silent early return 직전 warn log 추가. 타입 오류 0, 회귀 0. Spec `docs/specs/ARCHETYPE_DETERMINISM_LOCK_V1.md` §10 AL17-0 확장 기재 완료. **완료**

- [x] 2026-05-02 — **AL-1.5 OFFICIAL CLOSURE — HALTED, cutover deferred to AL-1.7** — Soak T+5h HALT. 근본 원인: `user_pattern_signatures` 테이블 전체 공백 (total_rows: 0, 12명 모든 사용자). Pipeline N signature 생성 단계 운영 미작동 → axis baseline 0.50 고착 → 모든 archetype cutoff 충족 불가 → `SelectorInvariantError` + graceful degrade. 12 silent assumptions 전량 발견 (cutover 전). AL-1.5.1 hotfix (selector fallback 제거 + current_state filter) + AL-1.5.2 hotfix (lockService step D try/catch) 배포 완료 (Worker `e0a5fea7`). 사용자 UX 영향 0. Spec §10 AL15-CLOSURE 기록 + §10 AL17-0 신설 (signature system investigation, Critical). 다음: AL-1.7 Phase 1 (signature pipeline 코드 추적). **완료**

- [x] 2026-05-02 — **AL-1.5 M1+M2 게이트 PASS — staging migration apply + Worker deploy** — M1: bty_archetype_naming_locks 테이블 사전 존재(archetype_class CHECK + unique_active_lock_per_user EXCLUDE btree 포함), Fix A로 gist EXCLUDE 추가, Fix C로 anon/authenticated REVOKE 적용, proacl={postgres+service_role only} 확인. M2: `npm run build && npm run cf:build && npm run cf:deploy` → Worker version `3f2befe3-c5fa-4787-ab1d-7f61350057ce`. Soak T+0 시작 2026-05-02. PF-3 발견(Supabase auto-grant anon+authenticated) → migration 01 파일에 명시적 REVOKE 추가 완료. **작업 완료**

- [x] 2026-05-02 — **AL-1.5 PF-2 Fix 완료 — Option B (REVOKE+GRANT+service role client)** — `supabase/migrations/20260505000001_bty_create_archetype_lock_rpc.sql`에 `revoke execute … from public` + `grant execute … to service_role` 추가 (§9 Forbidden 정합). `lockService.ts`에 `getSupabaseAdmin()` import 추가; step E에서 `adminClient = getSupabaseAdmin()` null 체크 후 `adminClient.rpc("bty_create_archetype_lock", ...)` 호출 — user client는 SELECT 전용 유지(RLS 보존). T-1(RPC→admin), T-2(SELECT→user), T-3(null→DB_ERROR) 3개 unit test 신규 파일 `lockService.serviceRole.test.ts`. 통합 테스트 `integration.test.ts`에 `vi.mock("@/lib/supabase-admin")` + `makeMockSupabase` 내부 admin client mock 업데이트. 전체 66/66 PASS, spec-drift-check 7/7 PASS. **작업 완료**

- [x] 2026-05-02 — **AL-1.5 Soak Automation Scripts 완료** — `scripts/staging-soak-hour1-check.mjs` (H1-1 API probe + H1-2 DB probe 1h window + H1-4 contract sampling 5×1min + PII scan + manual H1-3 wrangler tail 안내 + MANUAL_REQUIRED/FAIL/CRITICAL_FAIL verdict) + `scripts/staging-soak-cutover-check.mjs` (2.1 24h DB counts + 2.2 archetype distribution + 2.3 contract sampling 10×3min + PATTERN_FORMING rate 신호 + 2.4 snapshot size check + PII 24h + manual retry rate 안내 + PASS/WARN/FAIL/CRITICAL_FAIL verdict). 두 스크립트 모두: read-only guard (insert/update/upsert/delete → throw), DRY_RUN=true mock data, STAGING_TEST_FORBIDDEN_WRITE=true guard self-test, VERDICT_LINE CI-grep 형식. `node --check` + dry run + guard test **3모드 PASS**. **작업 완료**

- [x] 2026-05-02 — **AL-1.5 Stage 4.A + 4.B 완료 — Archetype Determinism Lock v1 CI 게이트** — Stage 4.A: `src/__tests__/archetype/integration.test.ts` (15 IT 테스트 — PATTERN_FORMING 전환, 히스테리시스, IT3-B EXIT 위반 RPC 없음, 결정론 100회, race condition cached_match, DB 격리, §7.1 응답 계약). Stage 4.B: `scripts/archetype-spec-drift-check.mjs` (V1~V7 불변량: ENTRY/EXIT 임계값, STILLWATER 조건, A0 게이트 배치, Method Y 범위 차단) + `.github/workflows/archetype-isolation.yml` (L1 격리 + L2 스펙 드리프트 + L3 테스트). 전체 archetype 테스트 **63/63 PASS**. Stage 4.C는 AL-1.7 보류. **작업 완료**

- [x] 2026-05-01 — **Working-tree 일괄 배포 (Cursor)** — `RUN_COMPLETE_CONTRACT_QUEUED` sentinel 분리 / `QUICK_MODE_COMPLETE` ActivityType 추가 / scenario-stats 중복 키 제거 / 테스트 3개 수정 포함. Worker Version **`c5eb8bdb-7c1f-4048-ab1a-a16abfa4157b`**. ⚠️ 미커밋 — 외부 레포 commit 권장. **작업 완료**

- [x] 2026-05-01 — **`SUPABASE_SERVICE_ROLE_KEY` wrangler secret 빈값 → QR validate `server_config_error` 500 수정** — `wrangler secret list`로 키 존재 확인 후 `/api/debug` → `hasServiceRole: false` 확인. `.env.local` JWT 값으로 `wrangler secret put SUPABASE_SERVICE_ROLE_KEY` 재설정. 재확인: `hasServiceRole: true`, validate route `contract_not_found`(409, Supabase 연결 정상). Issue A `server_config_error` 완전 해소. 코드 변경 없음; Worker Version **`7be041a7-5acd-46ad-ac56-e93d1b249fc6`**(기존 빌드 유지). **작업 완료**

- [x] 2026-04-30 — **허브 네비 단일 row(Center|Arena|…)+ Quick textarea 글자색+자가진단 280ms 자동 다음+Healing 액트 UX+i18n+멘토 데이터셋 규칙 + staging 배포** — Git `35127e3`. Worker version `e972d34e-d8c5-4984-a990-0e66ec54c443`. **작업 완료**

- [x] 2026-04-30 — **LLM `gemma4:31b` 기본 + `getLlmExtraOptions()` + chat/mentor `temperature`/`top_p` + 빌드 IPv4(`package.json`)** — Git `907662b`, `ab02980` 푸시. 에이전트 환경에서 OpenNext 빌드까지 성공, Wrangler는 Cloudflare 인증 타임아웃으로 배포 미완 — 로컬에서 `npm run deploy` 실행 필요. **코드 완료**

- [x] 2026-04-30 — **Arena Quick Decision(Phase 2b/2c): API `/api/arena/quick/*` + `ArenaEntryClient` + `/bty-arena/quick` UI + `user_pattern_history` migration + `QUICK_MODE_COMPLETE` XP + staging 배포** — Full Arena는 `BtyArenaRunPageClient`/`pipelineDefault="new"` 그대로. Git `a49acf9`. staging Worker version `7b07ff85-5179-4fab-a584-bbb969619819`. **작업 완료**

- [x] 2026-04-30 — **Healing Phase 3/4 CTA 경로 수정(`/bty/healing`) + dear-me public-path 방어 + staging 재배포** — `HealingPhaseTracker`의 3~4단계 CTA를 `/${locale}/bty/healing/awakening`에서 `/${locale}/bty/healing`으로 변경해 30일/세션 게이트가 있는 Second Awakening 의식 페이지로 강제 진입되던 문제를 해소. 이제 사용자 동선은 Healing 허브의 `AwakeningActsTrack`에서 `Record Next Act`를 통해 `POST /api/bty/healing/progress { actId: 1 }`를 바로 수행. 추가로 `middleware.ts` `isPublicPath`에 `/${locale}/dear-me`를 명시해 인증/리디렉트 간섭을 방지. 배포 완료: `bty-arena-staging` Worker version `f4320d0b-3023-471c-bad6-faf07ef731a8`. **작업 완료**

- [x] 2026-04-30 — **Foundry 허브 확장(복귀 배너/전체 카탈로그/Dr. Chi 인라인 채팅/상단 Arena 링크) + dear-me 308 리디렉트 제거 + staging 배포** — `foundry/page.client.tsx`에 PROGRAM_COMPLETED 이벤트 기반 Arena 복귀 배너(`Arena로 돌아가기`, `나중에`), `program_catalog` 실DB 조회 기반 전체 프로그램 접이식 카탈로그(`/bty/foundry/program/[id]` 연결), `/api/chat`(mode:`foundry`) 직접 호출 인라인 Dr. Chi 채팅과 `전체 대화 보기` 링크(`/bty/mentor`), 우상단 고정 `Arena →` 링크를 추가. `middleware.ts`에서 `/[locale]/dear-me`를 `/[locale]/center`로 보내던 308 리디렉션 제거로 `Write a letter` 즉시 복귀 버그를 해소. 배포 완료: `bty-arena-staging` Worker version `0e422ef6-1f5f-45c6-9c24-462abb357e17`. **작업 완료**

- [x] 2026-04-30 — **Assessment/DearMe/LLM/Train UX 후속 패치 + staging 배포** — `ResultClient` 제출 이력 타입을 API 응답 camelCase(`createdAt`, `pattern`, `track`, `scores`)로 정합화해 Invalid Date를 제거, `DearMeClient` 성공 제출 시 `DEAR_ME_SUBMITTED_EVENT`를 dispatch해 HealingPhaseTracker 단계 갱신 지연을 해결, `src/lib/llm.ts`(`getLlmEndpoint`, `isLlmAvailable`)를 추가해 chat/mentor/letterService/layer2Semantic 4개 OpenAI 호출 경로를 로컬 Gemma4 오버라이드 지원으로 통일, 28일 프로그램 day 페이지의 코치 채팅을 실 API(`/api/chat`) 기반 컴포넌트로 교체, `TrainShell` 완료 요약을 `/api/train/completion-pack` 실 API 호출로 전환. 배포 완료: `bty-arena-staging` Worker version `9642e8b0-b5c3-413f-b69c-2d21f55a1ca6`. **작업 완료**

- [x] 2026-04-30 — **Center 후속 UX 보강(진단 기록 필드 매핑/상세결과 링크, Healing CTA 링크, 에너지 기록 요약, 28일 프로그램 Center 복귀 링크) + staging 배포** — `CenterPageClient`에서 assessment 응답 필드를 camelCase(`pattern/track/createdAt`)로 정합화하고 `상세 결과 보기` 링크를 추가, `HealingPhaseTracker` 활성 단계별 CTA(`/assessment`, `/dear-me`, `/bty/healing/awakening`)를 연결, 에너지 카드에 7일 평균/트렌드/30일 총 기록을 노출, `train/day/[day]/page.client.tsx` 사이드바에 `← Center` 링크를 추가. 배포 완료: `bty-arena-staging` Worker version `92be1e4f-dc96-4c6d-a30f-5b3cbeb1efda`. **작업 완료**

- [x] 2026-04-30 — **Center 허브 UI 전환(Forced Reset/Normal 모드 분기) + staging 배포** — `src/app/[locale]/center/page.tsx`가 `CenterPageClient`를 사용하도록 교체되고, 새 `src/app/[locale]/center/CenterPageClient.tsx`에서 Stage 4(또는 `forcedResetTriggeredAt`)는 `ForcedResetUX` 전용 화면으로 Arena 이동을 차단, Stage 1~3은 Stage 컨텍스트/Healing tracker/Dear Me/Resilience/Assessment 카드 허브를 렌더링. 배포 완료: `bty-arena-staging` Worker version `3750ced8-6f08-424b-83d9-8a99f76dc5d1`. **작업 완료**

- [x] 2026-04-27 — **`NEXT_SCENARIO_READY + next_allowed` Continue 루프(`run/complete` 반복) 차단** — 원인: `useArenaSession.continueNextScenario()`가 이미 `NEXT_SCENARIO_READY`인 스냅샷에서도 `POST /api/arena/run/complete`를 선호해 같은 완료 호출이 반복될 수 있었음. 수정: `effectiveSnapshot.runtime_state==="NEXT_SCENARIO_READY"` + `gates.next_allowed===true`면 `run/complete`를 스킵하고 세션 라우터 fetch로 바로 전환(로컬 run/state 정리 유지). 검증: `BtyArenaRunPageClient.snapshot-gates.test.tsx` PASS, `npm run build && npm run cf:build && npm run cf:deploy` PASS. **staging Worker version `d75f668f-448f-4508-9c50-02e82cfce1a1`**. **작업 완료**

- [x] 2026-04-27 — **`NEXT_SCENARIO_READY` + `gates.next_allowed`일 때 Play paused 제거** — 원인: `NEXT_SCENARIO_READY`면 `snapshotAllowsArenaScenarioPlaySurface`가 false라 `canRenderScenarioProgressionUi`가 false인데, `midRunEliteNextReady`(elite + runId + phase DONE/ACTION_DECISION)이면 Next 셸을 스킵하고 메인 플레이로 fall-through → 실제로는 `!canRender` 분기에서 `arenaPlaySurfaceBlockedTitle`(Play paused)만 표시. 수정: `nextUnlocked || !midRunEliteNextReady`일 때 항상 `arena-play-snapshot-next-scenario-ready` + Continue 렌더. 테스트 `snapshot-gates` 2케이스 추가. **staging 배포** `npm run build && npm run cf:build && npm run cf:deploy` Worker version `7a0437f9-d719-4dd3-87b8-f0ac87146aa2`. **작업 완료**

- [x] 2026-04-27 — **Arena canonical 3-step UX(Primary / Tradeoff / Action Decision) 단계 구분 강화** — `BtyArenaRunPageClient`에 단계별 상단 안내 문구(testid: `arena-flow-phase-instruction-*`); `EliteForcedTradeoffStep`에서 cost 강조 블록 + `stage_2_escalation` 병합 `protects`/`risks`(`scenarioPayloadFromDb`); `EliteActionDecisionStep`에서 AD1/AD2 배지·특성 리스트; `ACTION_REQUIRED` 시 확인 문구(`arena-observable-action-confirmation`)를 `ArenaPendingContractGate` 및 계약 페이로드 없는 `ArenaBlockedSurface`에도 표시. 테스트: `scenarioPayloadFromDb`, `eliteArenaPostChoiceResolve`, `EliteForcedTradeoffStep`, `EliteActionDecisionStep`, `BtyArenaRunPageClient.action-decision-503` 보강. **작업 완료**

- [x] 2026-04-27 — **core_07 AD1 QR 후 `ACTION_SUBMITTED` 영구 블록 루프 제거** — 원인: `fetchBlockingArenaContractForSession`은 `null`인데 `fetchBlockingContractRowByContractId`로 조회한 행이 이미 `submitted`일 때 `buildArenaBindingSnapshotResponse`가 `snapshotForBlockedContract`를 호출해 `ACTION_SUBMITTED` + `next_allowed=false`를 반환; UI는 `NEXT_SCENARIO_READY`에서도 `submitted`를 차단으로 취급. 수정: binding 스냅샷에서 `pending`만 `ACTION_REQUIRED` 블록, `submitted|escalated`는 `snapshotForNextScenarioReady()` + `bindingExtras`; `qr/validate` pending→submitted 성공 시 `runtime_state=NEXT_SCENARIO_READY`, `gates.next_allowed=true`; `BtyArenaRunPageClient`의 `hasBlockingContractForNext`에서 `submitted|escalated` 제외, NEXT_SCENARIO_READY 빈 셸에 Continue(`arena-next-scenario-continue`) + i18n. 검증: `buildArenaBindingSnapshotResponse.action-contract-loop`, `qr/validate/route`, `snapshot-gates`, `n/session`, `blockingArenaActionContract`, `canonical-reward-loop` vitest PASS. **staging 배포 완료** — `npm run build && npm run cf:build && npm run cf:deploy`; Worker **Current Version ID** `ee8d9461-9fa7-4851-afab-30a001a003f6`; `GET /api/version` → `version=2026-04-27-api-version-endpoint-v1`, `buildTime=2026-04-27T18:21:00Z`. **작업 완료**

- [x] 2026-04-27 — **core_07 tradeoff `second_choices` cost + shape 검증 + 관련 코어 보강** — staging `TRADEOFF_ACTIVE`에서 `Invalid second-choice cost` 제거: `core_07_repair_conversation` `en.json`/`ko.json`의 A/B/C/D `escalationBranches.*.second_choices` X/Y에 시나리오 의미 기반 `cost` 추가(EN 예시 문구·KO 동역). `core-scenarios.shape.test.ts`에 모든 core에 대해 `second_choices[].cost` non-empty string 검증 추가. 동일 규칙 충족을 위해 기존 누락분 보강: `core_10` ko, `core_13`~`16` en/ko. `public/data/scenario` 미러 동기화. `npm test -- core-scenarios.shape.test.ts public-core-scenarios.action-decision.test.ts` **82/82 PASS**; `npm run build && npm run cf:build && npm run cf:deploy` 완료, Worker version `de1ca1cc-2717-4e82-8709-da568ede7088`. **작업 완료**

- [x] 2026-04-27 — **stale re-exposure shell 제거(no_change pending만 REEXPOSURE) + 복구 UI + soft reset + 최신 IN_PROGRESS resume** — `runArenaSessionNextCore`가 memory trigger 소비만으로 `REEXPOSURE_DUE`를 올리던 결합을 제거하고 `fetchFirstDueNoChangeReexposureMeta`로 **due `no_change_reexposure` pending row + 유효 `pendingOutcomeId`**일 때만 re-exposure 게이트 및 `delayedOutcomePending` true. `arenaSessionRouterClient`는 pending id 없으면 reexposure pack/빈 REEXPOSURE session_shell을 분류하지 않음(`snapshotQualifiesAsReexposureGate`, `reexposureSnapshotFromSessionPack`). `BtyArenaRunPageClient`는 due 표면이지만 pending id 없을 때 `ArenaReexposurePanel` 대신 stale recovery(`arena-reexposure-stale-recovery`, i18n `arenaReexposureStaleRecoveryMessage`) + delayed-outcomes refetch + `recoverStaleReexposureShell`. `useArenaSession`: `retryArenaSession({ force })`, `recoverStaleReexposureShell`, elite resume 시 `/api/arena/runs`로 **최신 IN_PROGRESS run만** 허용. `POST /api/dev/reset-arena-state`에 `{ mode: "soft_current", clearPendingContracts?, clearNoChangeRisks? }` 추가(최신 run 유지·나머지 ABANDONED, orphan pending no_change 삭제). 검증: `session/next`, `n/session`, `delayed-outcome-e2e`, `arenaSessionRouterClient.reexposure-gate`, `reset-arena-state`, `snapshot-gates` vitest PASS. **staging 배포 완료** — `npm run build && npm run cf:build && npm run cf:deploy`; Worker version `aac300cb-4b0b-447a-b6cb-779c9a7fca98`; `GET /api/version` 응답 `version=2026-04-27-api-version-endpoint-v1`, `buildTime=2026-04-27T18:21:00Z`. **작업 완료**

- [x] 2026-04-27 — **re-exposure validate canonical scenario 동치 허용 + AD1 contract ensure canonical 확장** — `/api/arena/re-exposure/validate`의 `run_scenario_mismatch` 비교를 json/db canonical normalize로 보강해 `expected core_*` vs `actual INCIDENT-*`를 동일 시나리오로 통과 처리(무관 id는 기존 403 유지, debug fields 유지). 또한 `ensureEliteBindingActionCommitmentContract`를 canonical `INCIDENT-*` AD1에도 동작하도록 확장(더 이상 elite-chain id 전용 아님): canonical DB 시나리오 허용, action label 기반 contract description fallback, pattern_family 미정 시 fail 대신 `unknown_pattern_family`로 저장하여 ensure 실패율 완화. `choice/route`는 AD1 action label을 ensure 호출에 전달. 검증: `re-exposure/validate route + choice route + eliteBindingActionCommitment` 테스트 PASS, staging 배포 버전 `07e10170-986f-40bc-9bae-112d5d1117e3`. **작업 완료**
- [x] 2026-04-27 — **Re-exposure panel `missing_pending_outcome_id` 오탐 수정(delayed-outcomes raw shape fallback)** — `ArenaReexposurePanel`이 delayed-outcomes 응답에서 `pendingOutcomeId`만 읽던 경로를 보강해 raw DB shape(`id`, `pending_outcome_id`)도 pending id로 허용하고, 시나리오 ID도 `body(JSON)` → `validation_payload.scenario_id` → `scenarioId/scenario_id` 순으로 robust 추출하도록 개선. delayed-outcomes 응답 콘솔 로그(`[BTY REEXPOSURE] delayed outcomes`)와 최종 해석 로그(`[BTY REEXPOSURE] panel resolved context`)를 추가해 staging에서 전달 누락을 즉시 추적 가능하게 함. 또한 fetch 진행 중 disabled reason은 `loading`이 우선되도록 수정(loading stuck vs context missing 구분). 검증: `ArenaReexposurePanel.test.tsx`(raw shape enabled + loading reason 추가) + `BtyArenaRunPageClient.reexposure-chain.integration.test.tsx` PASS, staging 재배포 버전 `8acc251c-8cb1-4cfe-9d23-3f6485c7cc1d`. **작업 완료**
- [x] 2026-04-27 — **canonical AD1 contract ensure 실패(503) 재발 보강: DB conflict 복구 + 실패 상세 노출** — staging 실스키마 확인 결과 `bty_action_contracts`에 `user_id+pattern_family` open unique 인덱스가 존재해 AD1 insert가 23505로 실패할 수 있음을 확인. `ensureEliteBindingActionCommitmentContract`를 보강해 insert 충돌 시 `user+session`뿐 아니라 `user+action_id`, `user+pattern_family(open statuses)`까지 조회해 기존 contract를 재사용하도록 변경(성공 시 `ACTION_REQUIRED` 유지). 또한 insert 실패 시 DB `code/message/hint/details`와 축약 insert payload를 로그/응답 detail로 노출하도록 추가. `/api/arena/choice` 503 응답도 `detail` 포함. 검증: `eliteBindingActionCommitment.server.test.ts`(canonical 성공/23505 복구/실패 detail) + `choice/route.test.ts` PASS, staging 재배포 버전 `f93bdd55-d32e-4b11-acfb-8f48273c114c`. **작업 완료**
- [x] 2026-04-27 — **re-exposure validate schema drift 재발 차단(`reinforcement_seeded_from_pending_id` top-level 제거)** — `arena_pending_outcomes`에 존재하지 않는 `reinforcement_seeded_from_pending_id` top-level 컬럼 참조를 제거하고, reinforcement follow-up dedupe/trace 값을 `validation_payload.reinforcement_seeded_from_pending_id`로 통일. `insertReinforcementDelayedOutcome`는 dup 탐색 시 pending rows의 `validation_payload`를 검사하도록 변경하고 insert payload도 JSON 내부 저장만 수행(테이블 컬럼 추가 없음). 검증: `reinforcementLoopSchedule.server.test.ts`(JSON 내부 저장 검증 추가) + `re-exposure/validate/route.test.ts` PASS, staging 재배포 버전 `242d7ec8-ce8e-4f24-8cac-35faa61f3709`. **작업 완료**
- [x] 2026-04-27 — **normal next vs re-exposure entry intent 분리(core_02 진입 시 re-exposure 가로채기 차단)** — `useArenaSession`에 `playContext`(`normal` | `next_scenario` | `re_exposure`)를 추가하고, `continueNextScenario`는 `next_scenario`, `beginReexposurePlay`는 `re_exposure`로 명시. `BtyArenaRunPageClient` re-exposure shell 우선 조건을 `playContext` 기반으로 조정해 normal next(`next_scenario`)에서는 `NEXT_SCENARIO_READY + re_exposure.due` 또는 stale `REEXPOSURE_DUE`가 있어도 즉시 패널로 가로채지 않도록 수정(시나리오 로드 후 play UI 유지). 테스트 보강: snapshot-gates에 next intent에서 re-exposure 비가로채기 2케이스 추가. 검증: `snapshot-gates + reexposure-chain` PASS, staging 배포 버전 `354a2ef1-1e9c-4e8d-b1ea-0b06a9ad38d7`. **작업 완료**
- [x] 2026-04-27 — **staging 상태 꼬임 복구용 안전장치 3종 반영(ACTION_REQUIRED invariant + re-exposure mismatch debug + dev reset endpoint)** — `/api/arena/choice`에서 AD1 contract ensure 실패 시 더 이상 `ACTION_REQUIRED`를 반환하지 않고 `runtime_state="ERROR"` + `qr_allowed=false`로 fail-closed 처리. 또한 snapshot invariant를 추가해 `ACTION_REQUIRED => action_contract.exists===true && id!=null`을 강제(위반 시 `action_required_contract_invariant_failed`로 `ERROR` 강등). `/api/arena/re-exposure/validate` `403 run_scenario_mismatch`에 `expectedScenarioId/actualRunScenarioId/pendingOutcomeId/priorRunId/reexposureRunId/scenarioIdFromPayload` 디버그 필드 추가. staging/dev 전용 `POST /api/dev/reset-arena-state` 신설(현재 유저 기준 `IN_PROGRESS` run 종료, pending contract 정리, pending no_change_reexposure 정리, no_change_risks 정리). 검증: `choice/route.test.ts` + `re-exposure/validate/route.test.ts` + `dev/reset-arena-state/route.test.ts` PASS, staging 배포 버전 `eb8d6692-b127-45f0-9bc1-1a0b0e104544`. **작업 완료**
- [x] 2026-04-27 — **re-exposure validate 500(`reinforcement_loop` missing column) 제거** — `/api/arena/re-exposure/validate`가 `arena_pending_outcomes.reinforcement_loop` 컬럼을 직접 select/update하던 의존을 제거하고, loop 메타를 `validation_payload.reinforcement_loop` JSON으로만 저장하도록 전환. follow-up insert(`insertReinforcementDelayedOutcome`)도 별도 컬럼 대신 `validation_payload` 내부에 loop 메타를 기록하도록 변경해 schema drift 없이 동작. 검증: `re-exposure/validate route` + `reinforcementLoopSchedule.server` 테스트 PASS, staging 재배포 버전 `788e1e38-4ab1-4331-a2fc-df93257937dd`. **작업 완료**
- [x] 2026-04-27 — **`/api/arena/re-exposure/[scenarioId]` canonical core 허용 전환(legacy elite-only guard 제거)** — `reexposure_elite_chain_only` 차단을 제거하고, canonical `core_*` 시나리오를 `loadArenaScenarioPayloadFromDb(getScenarioById 기반)`로 직접 로드해 `GET /api/arena/re-exposure/core_01_training_system_exposure`를 허용. unsupported id는 `404 reexposure_scenario_not_found`로 fail-closed. 신규 테스트 `src/app/api/arena/re-exposure/[scenarioId]/route.test.ts` 추가(1) canonical core 200 + `source=json` + `dbScenarioId=INCIDENT-01-OWN-01`, (2) unsupported 404, (3) legacy elite id payload 존재 시 200. 검증: route test + reexposure chain integration PASS, staging 재배포 버전 `9af36fae-4a6b-41ce-89b9-04146214bd2b`. **작업 완료**
- [x] 2026-04-26 — **Canonical JSON runtime에서 legacy `/api/arena/run/step` 호출 완전 차단** — `useArenaSession`에 canonical 판별 가드(`source==="json"` 또는 `scenarioId core_*` 또는 `dbScenarioId INCIDENT-*`)를 추가해 primary/tradeoff 경로의 `run/step` POST를 스킵하고 `POST /api/arena/choice` 스냅샷만으로 `TRADEOFF_ACTIVE`/`ACTION_DECISION_ACTIVE` 전이를 유지. `scenarioPayloadFromDb`에 `source:"json"`을 명시해 런타임 판별을 고정. 회귀: `BtyArenaRunPageClient.action-decision-503.integration.test.tsx`에서 canonical 시나리오 동안 `/api/arena/choice`는 호출되고 `/api/arena/run/step`은 0회임을 검증. build + cf:build + cf:deploy 완료, staging 버전 `ff58c495-f4d4-45c1-a34a-6d8ad80b9d91`. **작업 완료**
- [x] 2026-04-27 — **Re-exposure Enter 버튼 fallback 활성화(패널 disabled 원인 노출 포함)** — `ArenaReexposurePanel`이 delayed-outcomes에서 `no_change_reexposure`를 우선 선택하고 `pendingOutcomeId/scenarioId`를 `onEnterScenario`로 전달하도록 보강. `useArenaSession.beginReexposurePlay`는 snapshot 값이 비어도 panel override(`pendingOutcomeId`, `scenarioId`)를 fallback으로 사용(A: snapshot, B: delayed selection, C: visible error). 패널에 `data-testid="reexposure-disabled-reason"` 추가(`loading`, `missing_pending_outcome_id`, `no_outcome_selected`). 관련 테스트 PASS 후 staging 배포 버전 `2591758f-57b4-48aa-9a15-9e6951e07d70`. **작업 완료**
- [x] 2026-04-27 — **RLS 차단 대응: re-exposure pending bridge service-role 강제 전환** — AD2 no-change fallback seed가 `user_scenario_choice_history` RLS에 막히던 문제를 `/api/arena/choice`에서 service role client(`getSupabaseAdmin`)로 해결. fallback history seed + `arena_pending_outcomes` insert/reuse를 service-role 경로로만 실행하고, 미설정 시 `500 service_role_missing_for_reexposure_pending_outcome` 반환. 관련 route test(서비스 롤 누락 포함) + re-exposure integration PASS, staging 재배포 버전 `8779a0a9-82ae-457d-bea6-abe4e3bede3b`. **작업 완료**
- [x] 2026-04-27 — **AD2 threshold → no-change re-exposure pending row 생성 fail-closed 보강** — `/api/arena/choice` `ensureNoChangeReexposurePendingOutcome`에 호출 로그 추가, history lookup/seed/pending insert 실패 시 상세 에러를 반환하고 `REEXPOSURE_DUE` 승격 전에 `500 no_change_reexposure_pending_outcome_create_failed`로 중단하도록 수정. 생성 row를 `choice_type=no_change_reexposure`, `status=pending`, `scheduled_for=now`, `outcome_title=Re-exposure round`, `validation_payload`(incident/scenario/db/axis/pattern/source=no_change_risk)로 정규화. `re_exposure.scenario_id`는 playable `json_scenario_id`로 고정. 검증: `choice route + reexposure chain` 테스트 PASS, staging 배포 버전 `dd0ed656-6eeb-4204-9b4b-cd2ffe6d34d4`. **작업 완료**
- [x] 2026-04-27 — **staging 최신 코드 검증용 `/api/version` endpoint 추가 및 배포** — `src/app/api/version/route.ts` 추가, 응답 `{ app, env, version, buildTime, worker }` 반환. `wrangler.toml` vars에 `BTY_ENV`, `BTY_WORKER_NAME`, `BTY_DEPLOY_VERSION`, `BTY_BUILD_TIME`, `BTY_APP_VERSION` 추가. 배포 후 `curl /api/version`로 응답 확인 완료(버전 태그 `2026-04-27-api-version-endpoint-v1`). staging 버전 `faea9772-fbd9-49af-a8f5-9239ffcc62b3`. **작업 완료**
- [x] 2026-04-27 — **REEXPOSURE_DUE pending outcome persistence/query mismatch 수정 + staging 배포** — `/api/arena/choice` AD2 threshold 경로에서 `user_scenario_choice_history` 조회가 비어도 fallback history row를 seed하여 `arena_pending_outcomes` 생성/재사용이 항상 가능하도록 보강. `re_exposure.scenario_id`를 `db_scenario_id`가 아닌 playable `json_scenario_id`로 고정해 `/api/arena/re-exposure/[scenarioId]`와 정합화. `beginReexposurePlay`는 `no_pending_reexposure_for_scenario`를 visible toast로 처리. 검증: 관련 테스트 20 PASS + staging deploy 버전 `54b542fc-6924-4445-bd62-d53ae80b76a4`. **작업 완료**
- [x] 2026-04-27 — **re-exposure enter wiring 패치 staging 배포 완료** — `npm run build && npm run cf:build && npm run cf:deploy` 성공. Worker `bty-arena-staging` 버전 `5cf1c626-286f-4fcc-8617-5c280464334a` 반영, `REEXPOSURE_DUE` 진입 버튼 wiring/우선순위 패치 포함. **작업 완료**
- [x] 2026-04-27 — **REEXPOSURE_DUE Enter scenario wiring 복구 + Play paused 우선순위 충돌 수정** — `ArenaReexposurePanel` 버튼 클릭에 `preventDefault/stopPropagation`을 적용하고, `useArenaSession.beginReexposurePlay`에 `[BTY REEXPOSURE] enter` 진입 로그 및 `pending_outcome_id` 누락 시 visible toast 가드를 추가해 silent no-op을 차단. 또한 `BtyArenaRunPageClient`에서 `NEXT_SCENARIO_READY + re_exposure.due=true` 조합을 `Play paused`가 아니라 re-exposure panel로 우선 렌더하도록 보정. 회귀: `ArenaReexposurePanel.test.tsx`, `BtyArenaRunPageClient.snapshot-gates.test.tsx`, `BtyArenaRunPageClient.reexposure-chain.integration.test.tsx` PASS. **작업 완료**
- [x] 2026-04-26 — **second choice/action decision dbChoiceId를 base.structure 매핑 우선으로 고정** — `useArenaSession`에서 tradeoff/action payload의 `db_choice_id`를 `getScenarioById(...).base.structure.tradeoff/action_decision`로 우선 해석하도록 보강(선택 second id 상태 저장 포함). `POST /api/arena/choice` canonical 분기에서도 `content.escalationBranches`의 `dbChoiceId`를 base 매핑으로 overlay해 검증 일관성을 확보하고, `second_choice_binding_mismatch`/`action_decision_binding_mismatch` 응답에 `expectedDbChoiceId`/`receivedDbChoiceId`/choice 식별자를 추가. 회귀: `choice/route.test.ts` canonical overlay 케이스 + mismatch debug 필드, `BtyArenaRunPageClient.action-decision-503.integration.test.tsx`에서 tradeoff payload가 base mapping(`db-tradeoff-x-base`)을 보내는지 검증. **작업 완료**
- [x] 2026-04-26 — **tradeoff/action payload에 primary/second 컨텍스트 필수 전송 + 서버 strict guard 추가** — staging 실오류(`primaryChoiceId=null`) 재현 기준으로 `useArenaSession.submitSecondChoice()`가 `primary_choice_id`/`parent_choice_id`를, `submitActionDecision()`이 `primary_choice_id`/`parent_choice_id`/`second_choice_id`를 함께 전송하도록 수정. 서버 `/api/arena/choice`는 tradeoff phase에서 primary 컨텍스트가 비어 있으면 즉시 `400 missing_primary_choice_id_for_tradeoff`를 반환하고, tradeoff 성공 시 `arena_runs.meta`에 `primary_choice_id`/`second_choice_id`를 저장해 action decision 컨텍스트를 고정. 검증: `route.test.ts`에 missing-primary 400 케이스 추가, integration test에서 tradeoff/action payload 컨텍스트 필드 포함 확인. staging 재배포 완료, 버전 `24062779-0218-49d4-a972-189a73752f88`. **작업 완료**
- [x] 2026-04-26 — **AD2 500 방지 + next scenario core_01 반복 방지(Incident next 체인 복구)** — `/api/arena/choice` action decision 분기에 필수 컨텍스트 가드를 추가(`missing_primary_choice_id_for_action_decision`, `missing_second_choice_id_for_action_decision`, `action_decision_binding_missing`, `action_decision_binding_mismatch`)하고, AD2 no-change risk accrual 예외를 `400 action_decision_no_change_risk_invalid`로 명시 처리해 500을 제거. 또한 `scenario-selector`에서 played/served scenario id를 DB id(`INCIDENT-*`) → canonical json id(`core_*`)로 정규화해 `NEXT_SCENARIO_READY` 이후 선택이 항상 fresh entry(core_01)로 리셋되지 않도록 수정(정상 시 core_02+ 체인 진행). 검증: `choice/route.test.ts` 15 PASS, build + cf:build + cf:deploy 완료, staging 버전 `22398cbd-98da-4c8b-b8cd-1ec5296f7bfc`. **작업 완료**
- [x] 2026-04-26 — **QR 완료 후 원본 브라우저 자동 동기화(refetch UX) 보강** — `MyPageLeadershipConsole`/`useArenaSession`에 `focus` + `visibilitychange(visible)` + cross-tab storage pulse(`bty-action-contract-updated`) 기반 자동 refetch를 추가하고, 1.5s throttle로 과호출을 억제. QR validate 성공 시 `dispatchBtyActionContractUpdated()`를 발행해 다른 탭도 즉시 session/action-contract 상태를 재조회하도록 연결. 회귀: `MyPageLeadershipConsole.test.tsx`에 throttled focus/visible/storage refetch 케이스 추가, 기존 `pending-only ACTION_REQUIRED` 테스트군 유지 PASS. **작업 완료**
- [x] 2026-04-26 — **submitted 오해석 방지 + ACTION_REQUIRED 수동 갱신 CTA 보강** — `runArenaSessionNextCore`에 non-pending blocking row 방어(상태가 `pending`일 때만 409 `action_contract_pending`)를 추가하고 `submitted` 행은 경고 로그 후 차단 무시하도록 보강. `useArenaSession`/`MyPageLeadershipConsole`에 `[BTY SYNC] visibility/focus refetch`·`session refetch complete` 로그 추가. `ArenaPendingContractGate`에 `Refresh status` 버튼(`arena-pending-contract-refresh-status`)을 추가해 수동 재조회 경로를 명시. 검증: `n/session` + snapshot gate + my-page + blocking tests **36 PASS**. **작업 완료**
- [x] 2026-04-26 — **QR validate 무전이(false success) 차단 + pending→submitted 전이 검증 로그 보강** — DB 실조회 결과(`8147ae9c-8440-4ee8-aabe-001f33aa41b5`)가 여전히 `pending`임을 확인하고, `qr/validate`에서 `contractId` 없는 토큰을 더 이상 성공 처리하지 않도록 `422 missing_contract_id` hard-fail 추가. 또한 `pending` 전이 시 update 결과를 `select(...).maybeSingle()`로 검증하여 `finalStatus=submitted`가 아닐 경우 `contract_update_failed`로 실패 처리하고, 전/후 상태 로그(`[qr/validate] contract status before transition`, `pending->submitted transition complete`)를 추가. 관련 테스트 40 PASS. **작업 완료**
- [x] 2026-04-26 — **staging 재배포 (QR transition hardening 포함)** — `npm run build && npm run cf:build && npm run cf:deploy` 실행 완료. Worker `bty-arena-staging` 최신 배포 버전 `787daa30-9e4d-4a76-a1e1-7be3c99fdd83` 반영. **작업 완료**
- [x] 2026-04-26 — **422 `action_decision_scenario_binding_unresolved` (OWN-RE 진입) 완화 + staging entry canonical 복귀** — 원인 확인: staging `BTY_ARENA_VERTICAL_SLICE_ENTRY_SCENARIO_ID=OWN-RE-02-R1`로 fresh entry가 vertical slice를 타고, `/api/arena/choice` AD2 경로의 `getScenarioByDbId`(27-core canonical registry)와 불일치해 422 발생. 수정: `wrangler.toml` entry를 `core_01_training_system`으로 복귀하고, `/api/arena/choice`는 canonical db id(`INCIDENT-*`) unresolved만 422 hard-fail 유지, non-canonical(OWN-RE/core_*) unresolved는 risk accrual skip(경고 로그)로 차단. 검증: `choice/event route tests` PASS + staging 재배포(`f4abc7a5-6d95-4846-8ad6-54a3f6247c51`). **작업 완료**
- [x] 2026-04-26 — **`/bty-arena/lab` legacy surface 차단(redirect)** — 원인 확정: staging 테스트 화면이 `/en/bty-arena`가 아니라 `/en/bty-arena/lab` 경로(RSC `lab->__PAGE__`)를 타고 있었고, 이 경로가 canonical runtime entry 규칙과 분리되어 혼선을 유발. `src/app/[locale]/bty-arena/lab/page.tsx`를 서버 redirect 페이지로 전환해 항상 `/${locale}/bty-arena`로 이동하도록 수정. staging 재배포 완료(`485ffe83-87c3-4235-a1af-e831051f4762`). **작업 완료**
- [x] 2026-04-26 — **json scenario id ↔ db scenario id 분리 강제 복구(core_* 혼입 차단)** — 원인: elite runtime 변환에서 `dbScenarioId`가 `scenarioId`(`core_*`)로 채워져 `/api/arena/choice` payload/response의 `db_scenario_id`까지 오염. 수정: `eliteScenarioToScenario`에 canonical base 바인딩 해석(코어 번호 기반) 추가로 `dbScenarioId`를 base `dbScenarioId`로 설정하고 primary/tradeoff `dbChoiceId`도 base mapping 우선 적용. `useArenaSession.createRun`은 `scenario.dbScenarioId`를 우선 사용해 run row와 choice payload를 정렬. `/api/arena/choice`는 canonical json(`core_*`)에 `db_scenario_id=core_*`가 들어오면 즉시 `422 db_scenario_id_must_be_canonical_base_db_scenario_id` hard-fail. 검증: 신규 테스트(`eliteScenariosCanonical.binding.test.ts`) + `choice route test` PASS, build PASS, staging 배포(`cb29b569-57b7-4a4b-9c12-8e5ad379ec9c`). **작업 완료**
- [x] 2026-04-26 — **stale legacy run(`scenario_id=core_*`) 호환 마이그레이션 + 409 디버그 필드 추가** — staging 실DB 확인 결과 `arena_runs.scenario_id=core_01_training_system`인 IN_PROGRESS row 다수 존재(legacy run 잔존)로 `POST /api/arena/choice`에서 payload canonical db id(`INCIDENT-*`)와 충돌해 `409 db_scenario_mismatch` 발생. 수정: `choice route`에서 run row가 `core_*`이고 요청 `db_scenario_id`가 canonical(`INCIDENT-*`)이면 허용 후 run row를 즉시 canonical db id로 업데이트(compat migration). 비호환 mismatch는 409 유지하되 `currentRunScenarioId/requestedDbScenarioId/expectedDbScenarioId/jsonScenarioId` 디버그 필드 반환. 클라이언트 저장 state는 `canonical-db-id-v2` schema version을 추가해 버전 불일치 시 local state 자동 폐기. 검증: `choice route + canonical binding tests` PASS, build/deploy PASS, staging 버전 `f2526bb0-ad2e-4cc5-920a-2b0fbfc749f2`. **작업 완료**
- [x] 2026-04-26 — **`binding_only_elite_chain_scenarios` guard canonical 허용 확장** — 원인: `POST /api/arena/choice`가 `isEliteChainScenarioId(db_scenario_id)` 전제라 canonical 조합(`json=core_*`, `db=INCIDENT-*`)을 400으로 차단. 수정: guard 기준을 `json_scenario_id` elite 여부 + canonical `getScenarioByDbId(db_scenario_id)` 해석 가능성으로 분기하고, canonical 경로도 binding scenario lib로 매핑해 동일 route 처리. 기존 차단 유지: unsupported non-canonical 시 400, `db_scenario_id=core_*`는 422 유지. 검증: `choice route tests` PASS, build/deploy PASS, staging 버전 `acc6d01b-4cb0-43b2-bc79-51f6bbea306b`. **작업 완료**
- [x] 2026-04-26 — **Arena runtime content source canonical registry 강제 전환(legacy elite 우회)** — 원인 확정: binding id는 canonical이어도 content loader가 `eliteScenarioToScenario` 경로를 사용해 title/content가 legacy(`Write Them Up or Name the System`)로 노출. 수정: `scenarioPayloadFromDb`를 `src/data/scenario` `getScenarioById` 기반으로 교체(Scenario payload를 canonical content로 재구성), `scenario-selector` catalog source를 elite dataset에서 canonical `scenarioList`로 전환, fresh entry env를 실제 canonical id(`core_01_training_system_exposure`)로 변경. 결과: Arena entry/choice title source가 canonical localized content로 통일. 검증: `scenarioPayloadFromDb.test + choice route test` PASS, build/deploy PASS, staging 버전 `201442e1-5e61-46a0-856f-b0295a0763ab`. **작업 완료**
- [x] 2026-04-26 — **Scenario index 구조 정리 (`src/data/scenario/index.ts`)** — incident별 상수 배열(`INCIDENT_01~03`) + 최종 `scenarioList` 합성 구조로 재정렬하고 깨진 spread/괄호 문법 오류 복구. `ScenarioId` 타입을 `scenarioList`에서 추론해 `getScenarioPath`/`getBasePath` 인자를 `ScenarioId`로 제한(오타 방지). **작업 완료**
- [x] 2026-04-26 — **session blocking contract 기준 정리 (pending-only ACTION_REQUIRED)** — `fetchBlockingArenaContractForSession`를 `pending + deadline_at > now`만 block으로 취급하도록 단순화해 `submitted/escalated/approved-awaiting`이 `action_contract_pending(409)`로 다시 잡히지 않게 수정. 추가로 `qr/validate`는 pending commit 시 `submitted` 전이를 반환(`ACTION_SUBMITTED`)하도록 유지. 신규 테스트 `blockingArenaActionContract.test.ts` 포함 관련 20 tests PASS, staging 재배포(`6f4c361c-862a-4dd9-b076-38e2b19e3716`). **작업 완료**
- [x] 2026-04-26 — **QR commit status 전이 복구 (`qr/validate`)** — `/my-page?arena_action_loop=commit&aalo=...` 진입 시 `pending` 계약을 더 이상 409로 거부하지 않고 `submitted`로 전이(`runtime_state=ACTION_SUBMITTED`)하도록 보강. `contractId` 조회에서 `session_id` 강결합을 제거하고 run 해석 fallback(`run_id`/`session_id`/token session)을 적용. 기존 `submitted|approved + validation_approved_at` 경로는 verification finalize 유지. 관련 QR flow 테스트 30 PASS, staging 재배포(`5ce533c5-404e-430b-acd7-42848a9a2e5e`). **작업 완료**
- [x] 2026-04-26 — **QR stale-value 강제 갱신 + 디버그 표시 추가** — `MyPageLeadershipConsole`에서 QR 클릭 직전 `setQrUrl(null)`로 이전 값을 비우고, 응답 후 `qrUrl`로 재설정하며 `QRCodeSVG key={qrUrl}`로 remount를 강제. QR 패널에 `<pre data-testid="qr-debug-value">{qrUrl}</pre>`를 추가해 실제 encode 값을 즉시 확인 가능하게 함. rerender 회귀 테스트(1st→2nd token URL 변경 반영) 추가 후 staging 재배포(`bc558d72-222e-4e85-9e1a-92b45574114d`). **작업 완료**
- [x] 2026-04-26 — **QR 렌더링 URL source 고정 (`MyPageLeadershipConsole`)** — QR panel이 token만 받아 `window.location.origin` 기반으로 URL을 재조합하던 경로를 제거하고, `/api/arena/leadership-engine/qr/action-loop-token` 응답의 `qrUrl`(fallback `url`)을 우선 그대로 QR value로 사용하도록 수정. `qrcode.react` mock 기반 테스트로 `bty-website` fallback 미사용을 고정. 검증 23 PASS + staging 재배포(`55daa2d8-cf70-47ca-9ded-031524298501`). **작업 완료**
- [x] 2026-04-26 — **QR token route `contractId` 해석 완화 (missing_session_id 해소)** — `/api/arena/leadership-engine/qr/action-loop-token`에서 `contractId` 요청 시 `contract_not_found(404)`/`contract_user_mismatch(403)`/`contract_not_pending(409)`를 분리하고, run 해석을 `session_id → run_id → payload.runId` 순서로 fallback 하도록 보강. `session_id` 누락(contractId-only)도 QR token 발급 가능. 응답 확장: `ok`, `contractId`, `runId`, `qrUrl`, `expiresAt`(+기존 `token`,`url` 유지). 테스트 22 PASS + staging 재배포(`a9f1aa49-6f53-4b57-8344-aabeb0742c6f`). **작업 완료**
- [x] 2026-04-26 — **Legacy pending-contract CTA 실제 렌더 경로 고정 (My Page `ActionContractHub`)** — `Complete by QR/secure link` 실제 렌더 컴포넌트에서 클릭 이벤트 전파를 차단(`preventDefault`/`stopPropagation`)하고, QR 요청을 `session_id` 의존에서 `contractId` 우선(가능 시 `runId` 병행)으로 전환해 `/api/arena/leadership-engine/qr/action-loop-token` 호출을 강제. 관련 회귀(`MyPageLeadershipConsole.test.tsx`, `action-loop-token/route.test.ts`, `snapshot-gates.test.tsx`) PASS. **작업 완료**
- [x] 2026-04-26 — **Legacy CTA fix 반영 staging 재배포 완료** — `npm run build && npm run cf:build && npm run cf:deploy` 실행 완료, staging URL `https://bty-arena-staging.ywamer2022.workers.dev`, Worker version `f30546dd-a590-46ab-9c24-c3d13652b477` 배포 확인. **작업 완료**
- [x] 2026-04-26 — **Complete by QR 브라우저 wiring 방어 보강 + 재배포(v a63a9d9e...)** — `ArenaPendingContractGate` QR 버튼 클릭에서 `preventDefault/stopPropagation`을 적용해 상위 submit/클릭 전파로 인한 session retry 경로 유입을 차단하고, `startPendingContractQrFlow`에 `[BTY QR]` 디버그 로그(`contractId`,`runId`)를 추가. 요청 검증(test/build/cf:build/cf:deploy) 재실행 후 staging 재배포 완료. **작업 완료**
- [x] 2026-04-26 — **ACTION_REQUIRED QR CTA 분리(Trigger vs Execution) + 재배포** — `Complete by QR`를 session retry와 분리하여 `qr_allowed=true`일 때만 기존 `action_contract.id` 기반 QR 실행 토큰 흐름(`/api/arena/leadership-engine/qr/action-loop-token`)을 시작하도록 보강. 토큰 route는 `contractId`-only 조회를 지원하도록 확장하고, 지정 검증(`route.test.ts`, `snapshot-gates.test.tsx`) + `build` + `cf:build` + `cf:deploy` 재실행 완료. Staging version: `2fef5d15-754f-4fed-8be2-edcec4e2b4b9`. **작업 완료**
- [x] 2026-04-26 — **ACTION_REQUIRED “Complete by QR” 경로 정합화** — Arena pending contract gate에 QR CTA를 추가하고(`arena-pending-contract-complete-by-qr`), 클릭 시 `retryArenaSession`(session 409 재조회) 대신 `startPendingContractQrFlow`를 통해 `/api/arena/leadership-engine/qr/action-loop-token`을 직접 호출하도록 연결. 요청 payload는 `contractId`(+가능 시 `runId`)를 포함하며, 토큰 응답 `url`로 즉시 이동해 QR flow를 시작. 서버 route도 `contractId`-only lookup을 허용해 runId 미확정 상황에서도 QR 토큰 발급 가능하도록 보강. 관련 테스트: snapshot gate QR 클릭 핸들러 분기 + action-loop-token route(contractId-only) PASS. **작업 완료**
- [x] 2026-04-26 — **Cloudflare Workers staging 배포 완료 (`@opennextjs/cloudflare`)** — `wrangler.toml`을 staging worker(`bty-arena-staging`)로 조정하고 `cf:build/cf:preview/cf:deploy` 스크립트를 추가한 뒤, release regression(14 files/140 tests PASS) + `next build` + `cf:build` + `wrangler login` + `cf:deploy`를 순차 실행. 배포 URL: `https://bty-arena-staging.ywamer2022.workers.dev` 확인, `/` 및 `/en/bty-arena` 접근 성공(로그인 게이트 노출). **작업 완료**
- [x] 2026-04-26 — **`/api/arena/event` unresolved binding hard-fail 일관화** — `JSON_SCENARIO_DECISION_COMPLETED` + AD2(no-change risk accrual) 경로에서 `getScenarioByDbId(dbScenarioId)`가 미해결이면 즉시 `422 action_decision_scenario_binding_unresolved` 반환하도록 보강. `unknown_incident` fallback 누적을 금지하고, risk accrual 입력의 `incidentId/axisGroup/axisIndex`는 canonical mapping으로 강제. `route.test.ts`에 invalid `dbScenarioId` 케이스 추가: `accrueNoChangeRisk` 미호출 + 422 응답 고정. **작업 완료**
- [x] 2026-04-26 — **AD1 ensure 실패(503) 직후 클라이언트 통합 렌더 고정** — 신규 통합 테스트 `BtyArenaRunPageClient.action-decision-503.integration.test.tsx` 추가: AD1 선택 후 `/api/arena/choice`가 `503 + ACTION_REQUIRED snapshot(gates.next=false, choice=false)`를 반환할 때 `BtyArenaRunPageClient`가 error body snapshot을 소비해 `arena-play-main-pending-contract` 블로킹 셸을 유지하고 `NEXT_SCENARIO_READY` 셸로 fallback 전환하지 않음을 UI 레벨에서 고정. **작업 완료**
- [x] 2026-04-26 — **Release Gate 비블로킹 안정성 2건 보강** — (1) `postArenaChoice`가 503 에러 body의 blocked snapshot(`ACTION_REQUIRED`, next/choice false)을 `ArenaChoiceHttpError.snapshot`으로 전달하고 `useArenaSession.submitActionDecision`이 이를 소비해 blocked snapshot을 유지(throw-only로 유실 방지), (2) AD2 risk accrual에서 `getScenarioByDbId` 미해결 시 `action_decision_scenario_binding_unresolved` 422로 즉시 hard-fail하여 `unknown_incident` 누적을 차단. 관련 신규 테스트: `postArenaChoice.test.ts`, `api/arena/choice/route.test.ts` 확장. **작업 완료**
- [x] 2026-04-26 — **`POST /api/arena/choice` AD1 contract 생성 실패 경계 테스트 고정** — 신규 `src/app/api/arena/choice/route.test.ts`로 AD1 action_decision 경로 경계를 추가: (1) `ensureEliteBindingActionCommitmentContract` 실패 시 503 + blocked snapshot(`runtime_state=ACTION_REQUIRED`, `gates.next_allowed=false`, `gates.choice_allowed=false`) 반환, (2) AD1 성공 시 `ACTION_REQUIRED` 유지, (3) AD2 시 contract ensure 미호출 + `NEXT_SCENARIO_READY`. Route 본문도 실패 응답에 blocked snapshot을 포함하도록 보강하여 fallback next 진행을 차단. **작업 완료**
- [x] 2026-04-26 — **AD1 이후 Action Contract runtime loop 연결 검증 강화** — `buildArenaBindingSnapshotResponse.action-contract-loop.test.ts` 신규 추가로 AD1 commitment 경로의 canonical runtime 전이(`ACTION_REQUIRED → ACTION_SUBMITTED → ACTION_AWAITING_VERIFICATION`)와 게이트(`next/choice 차단`)를 고정. AD2(`avoidance_wrap_up`)는 `NEXT_SCENARIO_READY` 유지도 함께 검증해 `isActionCommitment` 기준 분기 원칙을 테스트로 명시. **작업 완료**
- [x] 2026-04-26 — **re-exposure i18n 구키 deprecate 정리 완료** — `src` 전수 검색 후 기존 구키(`arenaReexposureTitle/Lead/EnterCta`, 구 `BlockedNext*`, 구 `InterventionSensitivityUp`) 참조가 없음을 확인하고 `src/lib/i18n.ts`에서 타입+en/ko 값 모두 제거. 새 기준 키(`Panel/BlockedNextV2/InternalStatus/Validation*`)만 유지. 지정 re-exposure 테스트 스위트 **20/20 PASS**. **작업 완료**
- [x] 2026-04-26 — **re-exposure i18n key 컨벤션 통일 (`arena.reexposure.*` 대응 prefix)** — `ArenaReexposurePanel`, `BtyArenaRunPageClient`, `useArenaSession`의 re-exposure copy를 `arenaRun.arenaReexposure...` 일관 키로 통일(`Panel/BlockedNext/InternalStatus/Validation changed·unstable·no_change`). 기존 하드코딩 문구 제거 및 validation toast도 i18n key 사용. en/ko 렌더 + 숫자 미노출 회귀 테스트 포함 re-exposure 관련 **20/20 PASS**. **작업 완료**
- [x] 2026-04-26 — **re-exposure UI copy i18n key 승격 (en/ko)** — `BtyArenaRunPageClient`의 하드코딩 re-exposure 문구(차단 타이틀/설명/버튼, intervention sensitivity 안내)를 `src/lib/i18n.ts`의 `arenaRun` 키(`arenaReexposureBlockedNextTitle/Description/Button`, `arenaReexposureInterventionSensitivityUp`)로 이동. 컴포넌트는 `t` 기반 렌더로 전환하고 raw count/score는 노출하지 않도록 유지. snapshot-gates 테스트에 en/ko key 렌더 + 숫자 미노출 검증 추가. **작업 완료**
- [x] 2026-04-26 — **useArenaSession server-shell 우선 단위 테스트 보강** — `deriveReexposureValidateLocalAssist(...)` 헬퍼를 추가해 re-exposure validate 보조 전이 규칙을 순수 함수로 고정하고, 새 테스트 `useArenaSession.reexposure-transition.test.ts`에서 `server runtime_state=REEXPOSURE_DUE` 상태일 때 validate `next_runtime_state=NEXT_SCENARIO_READY`가 와도 local assist snapshot이 생성되지 않아 server shell이 유지됨을 검증. `re_exposure_clear_candidate=true`는 local clear 신호만 유지(override 없음)도 함께 검증. **작업 완료**
- [x] 2026-04-26 — **re-exposure validate 응답 기반 UI 전이 동기화 (`useArenaSession` + `BtyArenaRunPageClient`)** — `POST /api/arena/re-exposure/validate` 응답의 `next_runtime_state`/`re_exposure_clear_candidate`/`intervention_sensitivity_up`를 클라이언트가 직접 소비하도록 연결. 서버 entry shell snapshot이 있으면 서버 우선, 없으면 validate 응답으로 로컬 `bindingRuntimeSnapshot` 보조 전이(`NEXT_SCENARIO_READY` or `REEXPOSURE_DUE`). `re_exposure_clear_candidate=true` 시 로컬 due 후보 플래그 정리, `intervention_sensitivity_up=true` 시 raw 수치 없이 짧은 내부 상태 copy 노출. 검증: re-exposure client/snapshot/json + validate route **21/21 PASS**. **작업 완료**
- [x] 2026-04-26 — **REEXPOSURE_DUE 실제 re-exposure 로드 + validation 결과 분기 연결** — `POST /api/arena/choice` AD2 임계치 도달 시 동일 scenario 기반 pending re-exposure를 즉시 생성(`arena_pending_outcomes`)하고 snapshot `re_exposure`에 `pending_outcome_id/incident_id/axis_group/axis_index/pattern_family`를 포함. `POST /api/arena/re-exposure/validate` 응답에 `next_runtime_state`, `re_exposure_clear_candidate(changed)`, `intervention_sensitivity_up(no_change)`를 추가해 changed/unstable/no_change 후속 상태를 명시. 검증: re-exposure validate + client re-exposure chain + snapshot gates + noChangeRisk **18/18 PASS**. **작업 완료**
- [x] 2026-04-26 — **BTY Scenario Runtime 27-core registry/merge/validation/lookup 연결** — `src/data/scenario/index.ts`를 27개 core static registry(incident별 core_01~09) + `getIncident`/`getScenarioById`/`getScenarioByDbId`/`getNextScenario`/`getPreviousScenario` + runtime merge(base canonical + locale content + DB choice binding) + flow state helpers + decision event builder로 확장. `src/data/scenario/types.ts` 신규 추가, `src/lib/bty/scenario/loader.ts`/`browserLoader.ts`는 새 registry 기반 로드로 정렬. **작업 완료**
- [x] 2026-04-26 — **public/data/scenario 27-core mirror 동기화 + action-decision public test PASS** — `src/data/scenario/core_01~core_27`를 canonical source로 `public/data/scenario` 전량 미러링하고, `core_01_training_system_exposure`의 envelope JSON(`base.json`, `en.json`)을 src에서 정규화한 뒤 public 재동기화. `npm test -- src/data/scenario/public-core-scenarios.action-decision.test.ts` **54/54 PASS**. **작업 완료**
- [x] 2026-04-26 — **core_01~core_27 shape 검증 테스트 추가 (`core-scenarios.shape.test.ts`)** — envelope key 금지, base/en/ko 파일 존재, base 필수 필드/구조(primary A-D, tradeoff X/Y, action_decision A_X~D_X), en/ko 구조 동형성, AD1/AD2 commitment 규칙을 core별 path 단위 에러로 출력하도록 추가. 실행: `npm test -- src/data/scenario/core-scenarios.shape.test.ts` (현재 canonical 데이터 불일치 core 다수 리포트), `npm test -- src/data/scenario/public-core-scenarios.action-decision.test.ts` **54/54 PASS**. **작업 완료**
- [x] 2026-04-26 — **shape 불일치 canonical 정규화 완료 (13 core)** — `scripts/normalize-core-scenario-shapes.mjs`로 `core_07/10/11/12/13/14/15/16/18/19/20/21/22`의 구스키마(`primaryChoices`, `secondChoices`, `action_decision_mapping`)를 표준 스키마(`choices`, `second_choices`, `meaning.is_action_commitment`, `base.structure.*`)로 정규화하고 누락된 incident/stage/axis/DB mapping을 base에 명시. 이후 public 미러 재동기화. 결과: `npm test -- src/data/scenario/core-scenarios.shape.test.ts` **28/28 PASS**, `npm test -- src/data/scenario/public-core-scenarios.action-decision.test.ts` **54/54 PASS**. **작업 완료**
- [x] 2026-04-26 — **Arena session UI runtime-layer 연결 (snapshot 우선 + flow helper 강제)** — `BtyArenaRunPageClient` JSON runtime strip에 `initializeScenarioFlow/activatePrimaryChoice/selectPrimaryChoice/selectTradeoffChoice/selectActionDecision/getNextScenario/getScenarioById`를 연결해 Primary→Tradeoff→Action Decision 순서를 강제하고, Action Decision 이전 ACTION_REQUIRED 전이를 차단. AD1(commitment=true)만 ACTION_REQUIRED, AD2는 NEXT_SCENARIO_READY + no_change risk 안내 표시, `nextScenarioId` 기반 Load Next Scenario 이동 활성화(로케일 유지). 회귀 확인: `core-scenarios.shape` + `public-core-scenarios.action-decision` + `BtyArenaRunPageClient.snapshot-gates` **89/89 PASS**. **작업 완료**
- [x] 2026-04-26 — **Arena JSON Runtime behavioral decision event 기록 연결** — `BtyArenaRunPageClient`에서 Primary→Tradeoff→Action Decision 완료 시 `createScenarioDecisionEvent(...)` payload를 생성해 `/api/arena/event`로 전달(`eventType: JSON_SCENARIO_DECISION_COMPLETED`, step 5, action choice, meta.scenarioDecisionEvent + action_contract_candidate/no_change_risk_candidate). 서버 route는 `meta.scenarioDecisionEvent.userId`를 인증 유저로 강제 정규화. 신규 테스트 `src/data/scenario/scenario-decision-event.payload.test.ts` 추가(AD1/AD2 + base db mapping 검증). 검증: shape/public/snapshot 포함 **91/91 PASS**. **작업 완료**
- [x] 2026-04-26 — **JSON_SCENARIO_DECISION_COMPLETED 기반 no_change risk 서버 누적 + reExposureDue 후보화** — `/api/arena/event`에서 `isActionCommitment` 기준 분기 확장(AD2만 risk accrual, AD1은 contract candidate 유지), `src/lib/bty/arena/noChangeRisk.server.ts` 추가 및 `arena_no_change_risks` 누적 집계(incident+axis 또는 pattern 반복 임계치 >=2 → `reExposureDueCandidate`/`intervention_sensitivity_candidate`), 서버에서 `scenarioDecisionEvent.userId`를 인증 유저로 override. 마이그레이션 `supabase/migrations/20260502000000_arena_no_change_risks.sql` 추가(RLS 포함). 신규 테스트 `src/lib/bty/arena/noChangeRisk.server.test.ts` 추가. 검증: 관련 5 files **94/94 PASS**. **작업 완료**
- [x] 2026-04-26 — **reExposureDueCandidate → REEXPOSURE_DUE UI 승격 연결 (snapshot 우선)** — `BtyArenaRunPageClient` JSON runtime 경로에서 `/api/arena/event` 응답 `reExposureDueCandidate`를 수신해 `jsonReExposureDueCandidate`로 반영하고, 우선순위 `server snapshot(REEXPOSURE_DUE) > reExposureDueCandidate > local jsonFlow`로 렌더 분기. REEXPOSURE_DUE 활성 시 일반 next scenario 버튼 차단(`json-placeholder-load-next-scenario-blocked-reexposure`) + pattern validation 안내 surface 표시. AD1은 기존 ACTION_REQUIRED 유지, AD2 candidate=false는 NEXT_SCENARIO_READY 유지. 신규 테스트 `src/app/[locale]/bty-arena/BtyArenaRunPageClient.json-reexposure.test.tsx` 추가(4케이스). 검증: snapshot/shape/public/noChangeRisk 포함 **96/96 PASS**. **작업 완료**
- [x] 2026-04-26 — **useArenaSession/canonical 경로 REEXPOSURE_DUE 승격 일관화** — 일반 runtime 경로에서 action decision AD2 threshold 후보를 `POST /api/arena/choice` 응답 snapshot으로 승격하도록 연결(`runtime_state=REEXPOSURE_DUE`, next/choice gate 차단, re_exposure due slice 포함)하고, `BtyArenaRunPageClient` re-exposure shell 우선 판정을 `arenaServerSnapshot` 단일에서 `effectiveArenaSnapshot` 기반으로 확장해 binding/canonical 승격도 동일하게 반영. snapshot gate 테스트에 effective snapshot REEXPOSURE_DUE 케이스 추가. 검증: runtime+json+shape+public+risk **97/97 PASS**. **작업 완료**
- [x] 2026-04-25 — **Canonical reward loop integration test + API contract note** — 신규 통합 테스트 `src/app/api/arena/canonical-reward-loop.integration.test.ts` 추가: `run/complete`(contract present → `xpDeferredToContractVerification=true`, `coreXp/weeklyXp=0`) → `qr/validate`(deferred run reward 적용, AIR reflection log write, Core/Weekly 분리 업데이트) → `re-exposure/validate`(`changed` positive, `unstable` partial+follow-up, `no_change` weekly+1/core+0+follow-up) 단일 시나리오 검증. `run/complete` 주석 계약에 `xpDeferredToContractVerification` 명시. 관련 Vitest **8 files / 69 tests PASS**. **작업 완료**
- [x] 2026-04-25 — **XP/AIR reflection hardening (Action Contract verify + Re-exposure branches)** — `run/complete`는 Action Contract가 생성된 경우 XP를 즉시 지급하지 않고 `xpDeferredToContractVerification`로 지연, `qr/validate`에서 계약 검증 완료 시점에만 deferred run XP(Core/Weekly 분리) + AIR reflection(write `le_activation_log`/`le_verification_log`) 수행, `re-exposure/validate`는 `changed/unstable/no_change`별 분기 반영(`changed` 성장 신호, `unstable` 부분 성장, `no_change` 최소 XP+follow-up). `submit-validation`(evidence stage)에는 XP/AIR write 없음 유지. 관련 Vitest **7 files / 68 tests PASS**. **작업 완료**
- [x] 2026-04-25 — **REEXPOSURE_DUE no_change explicit regression + full related suite** — `re-exposure/validate`에 `validation_result:"no_change"` 전용 테스트를 추가해 pending consume + `follow_up_scheduled:true` + `new_pending_outcome_id`/`next_scheduled_for` 존재를 명시 검증. 관련 전체 스위트(`action-contract`, `qr/validate`, `re-exposure/validate`, `session/next`, `snapshot-gates`) 실행 결과 **6 files / 38 tests PASS**. **작업 완료**
- [x] 2026-04-25 — **REEXPOSURE_DUE regression tests** — `session/next` delayed outcome 경로에서 `REEXPOSURE_DUE + scenario:null` 계약 재확인, `BtyArenaRunPageClient.snapshot-gates`에 completed contract 동반 `REEXPOSURE_DUE` 패널 우선 렌더 회귀 테스트 추가, `re-exposure/validate`에 cross-axis(scenario/history mismatch) 거부 + `changed` no-follow-up + `unstable` follow-up scheduling 회귀 테스트 추가. Vitest 대상 3 files **19/19 PASS**. **작업 완료**
- [x] 2026-04-25 — **Canonical Action Contract transition targeted tests** — `toDisplayState` canonical mapping 6케이스 + `submit-validation`(submitted/awaiting/self_report auto-approve) + `qr/validate`(awaiting finalize, legacy pending shortcut flag guard) + `BtyArenaRunPageClient` NEXT_SCENARIO_READY defensive blocking(계약 미완료/re-exposure due) 테스트 추가. Vitest 대상 4 files **24/24 PASS**. **작업 완료**
- [x] 2026-04-25 — **Action Contract canonical state separation** — `domain/action-contract` display state를 `action_required / action_submitted / action_awaiting_verification / verified_completed`로 분리하고 My Page Hub/Arena pending gate에서 상태별 UI를 분리 렌더. `submit-validation`은 기본적으로 제출 시 `submitted` 유지 + `validation_approved_at`로 awaiting 분리(단, `verification_type==="self_report"` + `details.self_report_auto_approve===true`면 auto-approve+complete), `qr/validate`는 awaiting(`submitted|approved` + `validation_approved_at` + `verified_at null`) 완료 시점에서만 verify/complete 전이하며 legacy `pending→approved`는 `BTY_ALLOW_LEGACY_PENDING_QR_APPROVE=true`일 때만 허용. `BtyArenaRunPageClient`는 snapshot 우선 유지 + `NEXT_SCENARIO_READY` 추가 방어 가드 반영. `npm run build` ✓ — **작업 완료**
- [x] 2026-04-25 — **JSON Action Contract Draft UI → API 연결** — `BtyArenaRunPageClient`가 `Save Action Contract` 클릭 시 `saveJsonActionContract()`로 로컬 필드 검증 후 same-origin `POST /api/arena/action-contracts` 호출(`credentials:"same-origin"`, fake auth header 없음); 200/401/400/500+network 응답 메시지·fieldErrors·saved id 표시; 버튼 saving 중 disabled. Vitest route 4/4 ✓ · JSON draft Playwright 1/1 ✓ · `npm run build` ✓ · `npm run lint`는 기존 QR test `ContractRow.user_id` 타입 오류로 FAIL(본 변경 파일 lint diagnostics 없음). **작업 완료**
- [ ] 2026-04-25 — **Action Contract insert RLS policy** — migration `bty-app/supabase/migrations/20260501000000_bty_action_contracts_insert_policy.sql` 추가(INSERT policy only; select/update/RLS enablement 미변경). Route Vitest 4/4 ✓. **BLOCKED:** Supabase 원격 토큰/MCP auth 없음 + 로컬 DB `127.0.0.1:54322` 미기동으로 migration apply 및 authenticated POST insert 확인 미완료.
- [x] 2026-04-24 — **JSON flow E2E selectors + core_03 branch A** — `BtyArenaRunPageClient` `data-testid` 패널·버튼(`json-primary-panel`, `json-primary-choice-*`, `json-tradeoff-choice-*`, `json-action-choice-*`); `json-action-contract-draft.public.spec.ts`에서 `section`/xpath 제거; `core_03` public·src locale에 **`escalationBranches.A`**(A→X→AD1/2) 보강; `npm run build` ✓ · Vitest `public-core-scenarios.action-decision` ✓ · **작업 완료**
- [x] 2026-04-24 — **POST `/api/arena/action-contracts` (JSON dev draft save) + route tests** — App Router `NextRequest` + `requireUser`/`unauthenticated`/`copyCookiesAndDebug` 패턴 준수, zod body 검증(잘못된 JSON/필수 필드 누락 400), `bty_action_contracts` insert(`status:"pending"`, `verification_mode:"hybrid"`, `required:true`, `details`, `source:"json_dev_runtime"`) 후 `.select("id,status").single()` 반환; Vitest `route.test.ts` 4/4 ✓, `npm run build` ✓ · **작업 완료**
- [x] 2026-04-24 — **JSON dev Action Contract Draft (local-only)** — `jsonEngineState === "ACTION_REQUIRED"`에서 **Create Action Contract** 활성 → 패널(`scenarioId`/`dbScenarioId`/path/action label + suggested `jsonActionLabel`) + Who/What/When/Evidence 검증 + **Save Draft Locally** (API 없음) → 확인 문구 **Action draft ready for engine binding**; `NEXT_SCENARIO_READY`는 비활성 **Load Next Scenario** 유지; `npm run build` ✓ · **작업 완료**
- [x] 2026-04-24 — **JSON runtime 4 core scenarios** — `scenarioList` 셀렉트 + `browserLoader` 재로드, 기본 `core_04`; `public-core-scenarios.action-decision.test.ts`로 en.json AD1·AD2 패턴 검증; `npm run build` ✓ · **작업 완료**
- [x] 2026-04-24 — **JSON strip ACTION_REQUIRED / NEXT UI** — `ArenaBlockedSurface` `GenericBlockedState` 셸(`bg-bty-surface/90` 등) 정렬 + id·label 경로 + 비활성 **Create Action Contract** / **Load Next Scenario**; Supabase/API 없음 · **작업 완료**
- [x] 2026-04-24 — **`BtyArenaRunPageClient` dev JSON-only** — `NODE_ENV === "development"`이고 `loadScenario(core_04)` 완료 시 세션 UI·게이트 스킵, 고정 제목 **Stay Neutral or Set the Line**만 표시; `npm run build` ✓ · **작업 완료**
- [x] 2026-04-24 — **Dev bypass auth (bty-arena JSON testing)** — `NEXT_PUBLIC_BTY_DEV_BYPASS_AUTH === "true"` ∧ `NODE_ENV !== "production"` → `middleware.ts`에서 `/${locale}/bty-arena`만 `getUser` 전 `next()`; 프로덕션·Supabase·가짜 유저 없음 · **작업 완료**
- [x] 2026-04-24 — **C2 Delayed Outcome Engine E2E 완료** — `scheduleOutcomes`가 scenario JSON `delay_days`/`if.pattern` 소비(7d fallback 유지) + `user_memory_trigger_queue(delayed_outcome)` enqueue/consumer(processed idempotent) + `runArenaSessionNextCore` `REEXPOSURE_DUE`/`re_exposure.trigger_*` 연동 + 통합 테스트 `delayed-outcome-e2e.test.ts` · **작업 완료**
- [x] 2026-04-10 — **C5 — PatternSignaturePanel i18n** — labels use **`getMessages(locale).myPageStub`** (repeat / last shift / confidence / shift bands); fixes empty UI + **`MyPageLeadershipConsole.test.tsx`** assertion · Vitest **11** ✓ · **작업 완료**
- [x] 2026-04-10 — **Arena Phase A reinforcement loop** — `POST /api/arena/re-exposure/validate` drives next state: `changed` ends loop; `unstable`/`no_change` reschedule same-axis pending (`reinforcement_loop` jsonb, `reinforcement_seeded_from_pending_id`); `reinforcementLoopSchedule.server.ts` + migration `20260410120000_arena_pending_outcomes_reinforcement_loop.sql` · Vitest `reinforcementLoopSchedule.server.test.ts` · **작업 완료**
- [x] 2026-04-10 — **Arena Phase B — pattern signature aggregation** — `user_pattern_signatures` migration; `domain/arena/patternSignatureAggregation` state machine; `patternSignatureUpsert.server` after re-exposure validate; My Page `pattern_signatures` + `PatternSignaturePanel` · **작업 완료**
- [x] 2026-04-09 — **C3-Fix2 OWN-RE-02-R1 identity + re-exposure validation** — `eliteCanonicalRuntimeTruth.ts` (`VERTICAL_SLICE_CANONICAL_SCENARIO_ID`); `POST /api/arena/re-exposure/validate` + `reexposureValidation.server.ts`; migration `validation_payload` on `arena_pending_outcomes`; `useArenaSession` stores pending id through tradeoff then validates (no early dismiss) · **작업 완료**
- [x] 2026-04-05 — **C4 AIR / Pattern Shift UI separation** — bands only in AIRTrendWidget + onboarding step 4 + SessionSummaryOverlay + LeAirWidget; `last7DayWindowBand` on `AIRTrend` + score-card payload; My Page execution-integrity copy + Pattern Shift placeholder panel; awakening milestone copy; team page removes fake **0.72**; dead LE fetches removed from Foundry dashboard client · **작업 완료**
- [x] 2026-04-05 — **C2 AIR/Pattern Shift doc baseline (post–C3 lock)** — `docs/BTY_AIR_PATTERN_SHIFT_BASELINE_V2.md`; `LEADERSHIP_ENGINE_SPEC` / `ENGINE_ARCHITECTURE_DIRECTIVE_PLAN` / `FOUNDRY_DOMAIN_SPEC` / `arena-domain-rules` / `# BTY ENGINE` ruleset / `AIR_PATTERN_SHIFT_VOCABULARY_MAP` / `BTY_DETERMINISTIC_LEADERSHIP_ENGINE_BRIEF`; `BTY_RELEASE_GATE_CHECK` cross-link; obsolete **0.4/0.7** AIR bands + **0.70** forced-reset narrative marked 폐기 · **작업 완료**
- [x] 2026-04-05 — **C3 forced reset runtime wiring** — `runForcedResetAfterAirIfStage3` after `computeAIRSnapshot` on **`GET /api/arena/leadership-engine/air`**; `buildForcedResetEvalInputs` + two-week AIR gate requires in-window data; **`POST /api/cron/forced-reset-scan`** (CRON_SECRET) for stage-3 users; Vitest air route + eval-inputs · **작업 완료**
- [x] 2026-04-05 — **C3 AIR bands + vocabulary (LOCKED v2)** — `AIR_BAND_LOW_MID` **0.50** / `AIR_BAND_MID_HIGH` **0.80**; `air.ts` + air route adapter comments; forced-reset reason `air_7d_below_high_band_two_consecutive_weeks`; domain `patternShift.ts` + tests; `bty-app/docs/AIR_PATTERN_SHIFT_VOCABULARY_MAP.md` · Vitest leadership-engine + `domain/index` · **작업 완료**
- [x] 2026-04-05 — **C3 action contract `user_id` = run owner** — `ensureActionContract` / draft lifecycle / QR mint+validate / `submit-validation` (incl. approve) / `POST /api/arena/event` / admin `recover-contract` / `handleChoiceConfirmed` trace; TEMP `[action_contract_actor]` logs; **`POST .../qr/validate`** **409** `run_actor_token_mismatch` when token `userId` ≠ `arena_runs.user_id` · Vitest validate+submit-validation · **작업 완료**
- [x] 2026-04-02 — **`arena_contract=resolve`:** `/{locale}/bty` server **`redirect` → `/{locale}/my-page?arena_contract=resolve`**; My Page scroll + URL strip; **`ActionContractHub`** `#bty-action-contract-hub`; **`ENGINE_ARCHITECTURE_V1`** §6.7; arena pipeline test mocks **`"new" | "legacy"`** · **작업 완료**
- [x] 2026-04-02 — **G-B06/G-B07** — Vitest **`bty-app/src/app/api/bty/action-contract/submit-validation/route.test.ts`** (multi-field L1 + approve/reject/escalate JSON shape); **`CI_RELEASE_GATE_MATRIX.md`** · **`qa-integrity-gates.yml`** comment · **`docs/BTY_RELEASE_GATE_CHECK.md`** · **작업 완료**
- [x] 2026-03-28 — **G-B09 — Full-repo forbidden pattern sweep** — normative **`bty-app/docs/terminology-locks/UX_FLOW_LOCK_V1.md`** §5 added; automated probe **`bty-app/scripts/ux-flow-lock-gb09-sweep.mjs`** → **PASS** (966 `src/` files); evidence **`docs/BTY_RELEASE_GATE_CHECK.md`** G-B09 line · **작업 완료**
- [x] 2026-04-02 — **C3 PENDING-014 & PENDING-017 (remain open)** — **must appear** on cutover readiness checklist (**`bty-app/docs/ARENA_PIPELINE_CUTOVER.md`**, **`bty-app/docs/CI_RELEASE_GATE_MATRIX.md`**, **`docs/BTY_RELEASE_GATE_CHECK.md`**); **non-blocking** cutover; **post-cutover resolution** required · **작업 완료**
- [x] 2026-03-31 — **Action Contract ensure:** `ensureActionContractForArenaRun` uses internal `getSupabaseAdmin` + CRITICAL log; `run/complete` 멱등/첫 완료 **503 제거**·`contractId` 항상; `getSupabaseAdmin` 누락 env 로그; `docs/ARENA_CANONICAL_CONTRACT.md` §6; **`pnpm lint` + Vitest 2712** ✓ · **작업 완료**
- [x] 2026-03-30 — **C3 Action Contract on `POST /api/arena/run/complete`** — migration **`20260431230100_bty_action_contracts.sql`**; **`ensureActionContractForArenaRun`** (service role, idempotent `user_id`+`session_id`); response **`actionContractCreated`**, **`contractId?`**, **`myPageRefetchRequired`**; **`session/next`** selects **`contract_description`/`verification_mode`**; tests **`run/complete`**, **`ensureActionContractForArenaRun`**, **`session/next`** · **작업 완료**
- [x] 2026-03-30 — **C3 mirror immediate-repeat fix** — **root cause:** `pickLeastRecentMirror` read last mirror only from `fetchPlayedScenarioIds` (aggregate/legacy `session/choice`); canonical 7-step Arena records **`CHOICE_CONFIRMED` in `arena_events` only** → **`fetchLastServedMirrorScenarioId`** (`arena_events` + `user_scenario_choice_history`, max timestamp) + **`pickLeastRecentMirror(..., lastMirrorFromDb)`** + UUID **canonical compare**; **`ARENA_MIRROR_PICK_DEBUG=1`** log; **`scenario-type-router.mirror-pick.test.ts`** +2 · **작업 완료**
- [x] 2026-03-30 — **C3 legacy Arena route unification** — `middleware.ts`: **`/{locale}/arena` → `/{locale}/bty-arena` (308)**; onboarding gate + post-onboarding redirect → **`/bty-arena`**; **`OnboardingShell`** **`router.replace`** → **`/bty-arena`**; **`[locale]/arena/page.tsx`** **`permanentRedirect`**; **`middleware.legacy-arena-redirect.test.ts`** · **작업 완료**
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
- [x] 2026-03-25 — Arena release **final signoff** recorded: `BASE_URL=https://bty-arena-staging.ywamer2022.workers.dev`, run `23525350606`, artifact `arena-release-gate-evidence` — **작업 완료**

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