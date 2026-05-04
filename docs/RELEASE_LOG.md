# Release Log

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
