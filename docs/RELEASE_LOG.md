# Release Log

---

## 2026-05-04 — AL-1.8-E full LIVE (Secure link auto-commit visibility banner)

**Worker version**: `1ca9f98b-8482-4b56-b910-3246ef035897`
**HEAD**: `33e8283` AL-1.8-E full on top of AL-1.8-E partial chain
**Deploy mode**: dirty tree (single-env standard)

### Sprint scope
**Inventory 결과 (메모리 #9 적용)**: AL-1.8-E full handler 인프라(`MyPageLeadershipConsole.tsx:225-274` useEffect + qr/validate endpoint + cross-tab dispatch + PostCompletionSheet modal)는 **이미 구현되어 있었음**. 진짜 결손은 **user-perceivable feedback** — failure path는 console.error만, success는 modal 일시 표시 후 사라짐, pending state 0.

→ AL-1.8-E full = "feature 추가"가 아닌 "visibility 보강". sprint scope 재정의 case.

### Code changes (1 commit, 3 files, 235 insertions)

**`33e8283`** — Inline 5-state banner + i18n + tests:
- `MyPageLeadershipConsole.tsx` (+99/-2):
  - `validationStatus` state (`idle/pending/success/error/expired/unauthenticated`)
  - validate handler 보강: HTTP status별 분기 (401→unauthenticated, 422→expired, !ok→error, ok+success→success), pending 진입 시 setStatus
  - Inline banner JSX (`data-testid="action-loop-validation-banner"`): role=alert/status, aria-live=polite, color-coded (gray pending / emerald success / amber expired / red error+unauthenticated), spinner, dismiss button
- `i18n.ts` (+16): 5 keys × 2 locales (validating, validationSuccess, validationFailed, validationExpired, validationUnauthenticated)
- `MyPageLeadershipConsole.test.tsx` (+120): 5 신규 테스트 (success/expired/unauthenticated/error/idle)

### Live verification (4 gates, 모두 PASS)

**V1 Success path** ✅:
- "Complete by secure link" 클릭 → 새 탭에서 URL navigate → pending banner (gray + spinner + "Verifying secure link…") 잠깐 → success banner (emerald + "Action committed successfully." + ✕)
- 동시에 PostCompletionSheet modal: "EXECUTION RECORDED. Next scenario unlocked."
- 스크린샷 확인됨

**V1.5 SQL contract status** ✅:
```sql
SELECT id, status, submitted_at, deadline_at, pattern_family
FROM bty_action_contracts WHERE id = '6728c029-b853-4ea1-b8ef-3c8c9c1c27ab';
```
결과: `status='submitted'`, `submitted_at=2026-05-04 21:21:25.001-07` (tail의 `[qr/validate] pending->submitted transition complete` 시각과 정확히 일치).

**V2 Failure path** ✅:
- 가짜 token URL 새 탭 hard load → pending → unauthenticated banner (red + "Please log in to continue." + ✕) 시각 확인
- 401 분기 정상

**V3 3-signal crosscheck (memory #12)** ✅:
- Deploy Version ID: `1ca9f98b` (deploy 출력 직접 확인)
- git log HEAD: `33e8283`
- Live runtime: `[qr/validate] pending->submitted transition complete { contractId: '6728c029-...', finalStatus: 'submitted', submittedAt: '2026-05-04T21:21:25.001-07:00' }`

### 7-step canonical loop product identity 의미

Step 5 (Action/QR/Contract) → Step 6 (Re-exposure) 전환 과정에서 **사용자가 시스템의 검증 결과를 명확히 인지**하는 마지막 layer 완성. "행동을 시키는 시스템 ❌ / 행동하게 되는 상태를 만드는 시스템 ⭕" identity의 두 번째 측면 강화.

### Test status

- 신규 5건 (banner state machine) PASS
- 기존 13건 PASS, 1건 fail은 WIP-induced (`MyPageLeadershipConsole.test.tsx > 401 → retry → setServerPack`) — AL-1.8-F backlog, AL-1.8-E full 변경과 무관

### Next backlog 갱신
- ~~AL-1.8-E full~~ ✅ LIVE (2026-05-04)
- **AL-1.8-F** (P2): WIP test mock interference (1 test fail, MyPageLeadershipConsole core-xp fetch가 retry test 깨뜨림)
- **AL-1.8-C** (P2): top-level reinforcement column dead state cleanup

---

## 2026-05-04 — AL-1.8-E partial LIVE (My Page UI contrast + layout reorder + overflow fix)

**Final worker version**: `55fd3759-e021-4064-acbf-f40306991a9c` (4 commits 모두 live)
**Deploy chain**:
- `600e919a-b72b-4164-9545-e8af668e4793` — `5c3fbf1` (secure link + dismiss contrast)
- `73a88260-3907-4c8e-b134-1ece7055b789` — `6ce36e1` 추가 (JSX reorder)
- `c89d6eab-44d0-4586-99f4-da5cfecbaebd` — `d9e6fff` 추가 (PatternSignaturePanel contrast)
- `55fd3759-e021-4064-acbf-f40306991a9c` — `834d582` 추가 (Identity Hero + state cards overflow fix)

**HEAD chain**: `834d582` → `d9e6fff` → `6ce36e1` → `5c3fbf1` → `1c91674` AL-1.8-D → `885ded1` AL-1.8-A → `cf240c4` AL-1.7
**Deploy mode**: dirty tree (single-env standard)

### Sprint scope
**Hanbit 보고**: My Page에서 "QR code/secure link 흰색 배경에 흰색 글씨 거의 안 보임" + "Pattern Signatures 흰색 글씨" + "QR이 화면 한참 밑에 생성됨, Core/Weekly XP 바로 밑에 와야 함"

→ AL-1.8-E partial = **frontend UI contrast + layout** 영역만 fix. QR/secure link 백엔드 (token 발급, secure-link API) 정상 작동 — frontend 렌더링 문제만 처리. Action Contract `commit` flow의 token validation/UI feedback은 별도 backlog (AL-1.8-E full).

### Code changes (4 commits, 5 files)

**`5c3fbf1` — secure link 클릭 가능 + dismiss 버튼 contrast**:
- `MyPageLeadershipConsole.tsx:431-441`: secure link container styling을 light/dark variant로 분리
- secure link 텍스트 `<p>` → `<a href={secureLinkUrl} target="_blank" rel="noopener noreferrer">` (underline + cyan-700 + hover)
- `dismiss button:464`: `text-white/40` → `text-gray-500 dark:text-white/40`

**`6ce36e1` — JSX rendering order reorder**:
- Before: ActionContractHub → PatternSignaturePanel → secureLink → PostCompletionSheet → QRPanel → LeadershipScreen
- After: ActionContractHub → **QRPanel → secureLink** → PostCompletionSheet → PatternSignaturePanel → LeadershipScreen
- "Complete by QR / secure link" 버튼 클릭 시 결과 패널이 버튼 직후 visual proximity로 표시 (이전엔 Pattern Signatures 한참 밑)
- "QR code는 Core xp/weekly xp 바로 밑에 생성되어야 함" 요구사항 충족

**`d9e6fff` — PatternSignaturePanel 전체 contrast (deploy 후 추가)**:
- 23 lines 1:1 replacement: 모든 `text-white/*` `border-white/*` `bg-white/*` 클래스에 light mode variant 추가
- stateBadgeClass: resolved/improving/unstable/active 4종 모두 light variant
- Confidence bar: `bg-cyan-400/55` → `bg-cyan-500 dark:bg-cyan-400/55` (light에서 진한 cyan으로 가시성 확보)

**`834d582` — Identity Hero + state cards overflow fix**:
- `PremiumMyPageIdentityScreen.tsx` (10/+ 10/−):
  - Identity Hero grid 자식들: `min-w-0` 추가 (flex/grid item 자연 shrink 허용)
  - codeName / stage / headline / coreTrace / systemNote: `break-words` 추가 (단어 단위 wrap)
  - AIR/TII/RHYTHM 행: `sm:grid-cols-3` → **`md:grid-cols-3`** (640px → 768px breakpoint 상향, 좁은 viewport는 1-column 유지)
  - StateCard: `min-w-0` + value `break-words` (overflow 방지)
- Hanbit 보고: 좁은 viewport에서 "Leadership pattern is emerging from recent decisions." 한 단어씩 깨짐 + ST circle/SYSTEM NOTE overlap + AIR/TII/RHYTHM 박스 밖 텍스트 overflow 해결

### Live verification
- Worker `600e919a` deploy 후: secure link clickable + cyan, layout 정렬 정상 ✅
- Worker `73a88260` deploy 후: 위 + reorder 효과 (QR/secure link가 버튼 직후 표시) ✅
- Worker `c89d6eab` deploy 후: 위 + PatternSignaturePanel light-mode contrast (제목/lead/배지/카드/메트릭/confidence bar/footer 전체 가시성 확보) ✅
- Worker `55fd3759` deploy 후: 위 + Identity Hero `min-w-0` + `break-words` 가드, AIR/TII/RHYTHM grid breakpoint `sm` → `md` 상향 + StateCard `min-w-0` + value `break-words` (좁은 viewport에서 글자 깨짐 + 박스 overflow 해결) ✅

### 발견된 부수 이슈

**AL-1.8-F (P2)** — WIP test mock interference:
- `MyPageLeadershipConsole`의 WIP `void fetch("/api/arena/core-xp", ...)`가 `MyPageLeadershipConsole.test.tsx > 401 → retry → setServerPack on success` 테스트 깨뜨림
- 격리 검증: HEAD only 14/14 PASS, HEAD+WIP only 13/14 (1 fail), HEAD+WIP+QR fix 13/14 (동일 — 제 변경 무관)
- 원인: WIP 추가 fetch가 `fetchMock.mockResolvedValueOnce` 순차 mock 소비 순서 변경
- Fix 후보: (a) test mock URL-aware로 변경, (b) `void fetch` 호출 위치를 별도 useEffect로 분리, (c) 테스트가 fake timer 환경에서 명시 await
- AL-1.8-E partial fix와 무관, WIP commit 시 함께 다룰 backlog

### Next backlog 갱신
- ~~AL-1.8-D~~ ✅ LIVE (2026-05-04)
- **AL-1.8-E** (P1, partial): UI contrast/layout 완료. **Full 잔여**: secure link 클릭 시 새 탭 commit flow의 token validation + UI feedback 디버깅 (`?arena_action_loop=commit&aalo=...` 처리)
- **AL-1.8-F** (P2, 신규): WIP test mock interference (위 참조)
- AL-1.8-C (P2): top-level reinforcement column dead state cleanup

---

## 2026-05-04 — AL-1.8-D LIVE (Reinforcement filter expansion)

**Worker version**: `d56e6cb7-6706-42ad-a247-6c37d3e82cca`
**HEAD**: `1c91674` AL-1.8-D on `885ded1` AL-1.8-A on `cf240c4` AL-1.7
**Deploy mode**: dirty tree (single-env standard, see `memory/project_single_env_dirty_tree.md`)

### Fix scope
Reinforcement loop choice_type filter expansion — 1 line filter fix. Architectural change 0, ~5 lines code, 3 files (1 prod + 2 test).

### Code change
File: `src/engine/scenario/delayed-outcome-trigger.service.ts:663`
```diff
- .eq("choice_type", "no_change_reexposure")
+ .or("choice_type.eq.no_change_reexposure,choice_type.like.reinforcement*")
```
PostgREST `*` → SQL `%` wildcard. Reinforcement choice_types from `reinforcementLoopSchedule.server.ts:83` — pattern `reinforcement_${intensity}_iter${N}_${family}` — now match.

### Test verification
- `delayed-outcome-trigger.service.test.ts`: **10/10 PASS** (5 신규 + 5 기존)
  - 신규: regression no_change_reexposure / iter2 reinforcement / iter3 reinforcement / delayed_*_v* negative / co-presence
- `delayed-outcome-e2e.test.ts`: **1/1 PASS** (mock builder에 `.or()` 메서드 추가 후)
- 회귀 가드: 8 files / **55/55 PASS**

### Live verification (3-signal crosscheck)
1. Deploy output Version ID: `d56e6cb7-6706-42ad-a247-6c37d3e82cca` ✅
2. `git log` HEAD: `1c91674` ✅
3. Runtime evidence:
   - SQL hack: iter3 truth_naming pending의 `scheduled_for`를 NOW로 당김
   - test user `38ce28d2` `/en/bty-arena` 접속
   - UI: "Re-exposure round" 셸 + "재노출 후속 · 축 점검 (3차)" 라벨 ✅
   - SQL: `reinforcement_medium_iter3_truth_naming` row를 trigger picker가 식별 ✅

`wrangler deployments list` stale 표시 (`ad0de466`, 5월 3일) 모순은 무시 — wrangler quirk, 코드 실행 결과가 deploy 확인의 결정적 증거.

### Operational impact
Pre-deploy 운영 누적 pending rows 자동 처리:
- `reinforcement_medium_iter2_integrity_compromise` × 1 (user `2322beb7`)
- `reinforcement_medium_iter2_performance_blame` × 1 (user `2322beb7`)
- `reinforcement_medium_iter3_truth_naming` × 1 (user `38ce28d2`)
→ 5월 9일 trigger 사이클에 자동 consume 예정. 마이그레이션 0.

### Architecture findings (별도 cleanup 후보)
- `fetchFirstDueReexposureMeta` (`delayed-outcome-trigger.service.ts:598`) — unfiltered 동등 함수, 호출자 0건 (dead code). 별도 PR.
- 함수 이름 `fetchFirstDueNoChangeReexposureMeta` 정확성 약화 — 본 fix 후 reinforcement도 매칭. `fetchFirstDueReexposureShellMeta` rename 별도 PR 후보.

### Sprint chain
AL-1.5 (2026-05-02) → AL-1.7 (`cf240c4`, 11:55 PT) → AL-1.8-A (`885ded1`, 14:13 PT) → **AL-1.8-D (`1c91674`, 15:XX PT)** sequence 완료. 7-step canonical loop가 reinforcement chain 자동 발화까지 catalog 전체에서 작동 LIVE.

### Next backlog
- **AL-1.8-E** (P1): Action Contract QR display 미렌더 — frontend 디버깅
- **AL-1.8-C** (P2): Top-level reinforcement column dead state cleanup

---

## 2026-05-04 — AL-1.7 + AL-1.8-A LIVE (G1~G7 PASS)

**Worker version**: `256e2184-e3cf-4fd1-9409-36a6df2167be` (bty-arena-staging, 14:13 PT)
**Prior version**: `27a8f394-163e-4e06-a4d2-ff3177bd0fd3` (AL-1.7 only, 11:55 PT)
**HEAD**: `885ded1` AL-1.8-A on `cf240c4` AL-1.7 Phase 1

### Sprint scope
- AL-1.7 Phase 1 hold 해제 (2026-05-03 hold → 2026-05-04 C3 inventory + staging 검증으로 closure)
- AL-1.8-A G6 RC2 wiring fix (chain registry 외 24개 시나리오 G6 활성화)

### Code changes (885ded1, 3 files, 38 lines)
- `src/domain/arena/scenarios/types.ts`: `SecondChoice`에 `axis?: string` 추가 (live scenario JSON에는 존재했으나 TS type 누락)
- `src/app/api/arena/choice/route.ts`: tradeoff binding 시 `picked.axis`를 `BINDING_V1_SECOND` meta에 주입
- `src/lib/bty/arena/reexposureValidation.server.ts`: `getEliteScenarioById` 실패 시 `BINDING_V1_SECOND` meta의 axis로 graceful fallback (chain workspace registry 3개 vs 운영 catalog 27개)

### Verification matrix (이중 사용자 / 이중 시나리오)
| Gate | User A (`38ce28d2`) | User B (`2322beb7`) | Result |
|---|---|---|---|
| G1 BINDING_V1_SECOND meta | `direction=exit, pattern_family=blame_shift, axis=Truth` | `direction=exit, pattern_family=integrity_compromise, axis=Integrity` | ✅ |
| G2' arena_pending_outcomes 삽입 | ✅ AD2 path | ✅ AD2 path | ✅ |
| G3 REEXPOSURE_DUE 발화 | ✅ no_change_reexposure | ✅ no_change_reexposure | ✅ |
| G4 UI shell render | ✅ "Re-exposure round" 카드 | ✅ | ✅ |
| G5 validate 자동 호출 | ✅ POST /api/arena/re-exposure/validate | ✅ | ✅ |
| G6 user_pattern_signatures | ✅ truth_naming/Truth | ✅ integrity_compromise/Integrity | ✅ |
| G7-loop reinforcement (1차) | ✅ iter1→iter2 | ✅ | ✅ |

### Staging DB 적용된 마이그레이션
- `20260410120000_arena_pending_outcomes_reinforcement_loop.sql` (직접 SQL 적용 — `supabase db push` 미사용)
- 컬럼 추가: `reinforcement_seeded_from_pending_id`, `reinforcement_loop` (단 코드는 `validation_payload` JSONB에 저장 — top-level dead column 상태, AL-1.8-C cleanup 후보)

### Discovered during verification (별도 backlog로 등록)

**AL-1.8-D (P0)** — Reinforcement choice_type filter mismatch:
- `delayed-outcome-trigger.service.ts:660` `fetchFirstDueNoChangeReexposureMeta`가 `choice_type='no_change_reexposure'`만 매칭
- `reinforcementLoopSchedule.server.ts`는 follow-up을 `choice_type='reinforcement_*_pattern'` 으로 insert
- → Reinforcement iter2+ follow-up은 운영 사용자에게 영영 발화 안 됨 (1차 reinforcement에서 chain 정지)
- 본 sprint 검증 시 SQL hack `UPDATE choice_type='no_change_reexposure'`로 우회
- Fix scope: 5분 (filter 확장 또는 reinforcement insert가 'no_change_reexposure' 사용)

**AL-1.8-E (P1)** — Action Contract QR display 미렌더:
- Backend: `/api/arena/leadership-engine/qr/action-loop-token` 200 OK, secure-link 200 OK (tail 확인)
- Frontend: My Page Leadership Console "Complete by QR" 클릭 시 QR 코드 미렌더
- AL-1.8-A 변경 영역 외 (별도 frontend 디버깅 필요)

**AL-1.8-C (P2)** — Top-level reinforcement column dead state:
- 마이그레이션 추가 컬럼 미사용 (코드는 JSONB nested에 저장)
- Cleanup decision 필요 (write or drop)

### Discovered during deploy (메모리 박힘)

**Repo state — single-env + dirty-tree deploy 표준** (`memory/project_single_env_dirty_tree.md`):
- `bty-app/wrangler.toml`은 `name="bty-arena-staging"` 단일 워커 (`[env.production]` 블록 부재)
- Single Supabase project (`mveycersmqfiuddslnrj`) — staging/prod 분리 없음
- HEAD가 untracked WIP 파일 import (`@/content/assessment/questions.en.json`, `./CenterPageClient`, `@/lib/llm`) → standalone build 불가능
- → 모든 deploy = working tree 전체 dirty tree 번들. Isolation deploy 물리적으로 불가능
- 본 sprint에서 `git stash` isolation 시도 → build 실패로 검증됨 → 메모리 #11 정정

### Sprint references
- AL-1.5 OFFICIAL CLOSURE (2026-05-02) — HALTED, cutover deferred to AL-1.7
- AL-1.7 Phase 1 cutover 보류 → 사전 인프라 재분류 (2026-05-03)
- AL-1.7 Phase 1 staging verification (2026-05-04, this entry) — hold 해제 후 G1~G7 검증 완료

---

## 2026-05-01 — Public Repo Secret Exposure Incident

**Trigger**: Initial commit (3957a68) pushed to public github.com/dentistchi/bty-app
contained .env with live credentials.

**Rotated**:
- Supabase service_role key (new key system, old key deleted)
- OpenAI API key (auto-revoked by GitHub secret scanning, new key issued)
- ARENA_ACTION_LOOP_QR_SECRET (rotated twice — first value was exposed in
  remediation chat, second is the current acdaa6... prefix)

**Discovered during remediation**:
1. opennextjs-cloudflare's `populateProcessEnv` bakes `.env.local` values into
   worker bundle at `cf:build` time. `LLM_BASE_URL=http://localhost:11434/v1`
   was getting baked, routing OpenAI calls to localhost. Fix: comment out
   dev-only env vars in `.env.local` before production build.
2. `wrangler secret put` accepts empty strings as success. `SUPABASE_SERVICE_ROLE_KEY`
   was set to `""` at one point during rotation; `populateProcessEnv` wrote `""` to
   `process.env`, and validate route's `!key.trim()` check returned `500 server_config_error`.
   Fix: verify variable length (`echo ${#VAR}`) before secret put; verify post-put
   via `/api/debug` endpoint `hasServiceRole: true`.

**Worker affected**: bty-arena-staging (sole production worker; "bty-website" in
older docs was the prior worker name — no longer exists on the account).

**Final state**: All secrets rotated, all 3 worker secrets verified non-empty,
mentor + validate routes confirmed live. Worker Version: 8a8fd1f0 → 7be041a7
(secret-only changes, no code redeploy required for the final fix).

**Issues closed in same session**:
- Issue A (QR completion link silent failure): UI surface error + HMAC secret rotation
- Issue B (Phase 4 completion signal absent): green completion banner + i18n keys

**Repo cleanup**: github.com/dentistchi/bty-app no longer exists on GitHub
(`gh repo view` returned "Could not resolve to a Repository"). Local history
was rewritten with git-filter-repo for hygiene; force push was skipped as
remote is absent. If a new remote is created later, the cleaned history
will be the basis. Separate finding: github.com/dentistchi/bty-website
emitted GitHub Security Tab alert for OpenAI key in js/chatbot.js —
unrelated to bty-app, OpenAI auto-revoked, tracked as separate audit
(see backlog #4).
