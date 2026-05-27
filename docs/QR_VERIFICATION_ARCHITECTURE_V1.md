# QR Verification Architecture v1

**Status:** Locked v1 — Commander approved
**Authored:** 2026-05-27 by C3 (Claude), non-mutating dispatch author
**Implementation lanes:** L1–L9 (see `docs/UNIVERSAL_QR_ARCHITECTURE_RECOVERY_PLAN.md`)
**Decisions baked in:** Commander 2026-05-27 (D1 / D2 / D3)
**Code baseline:** inner HEAD `90e5c13a`

---

## 1. Executive Summary

이 문서는 BTY Arena의 QR 기반 행동 검증(action verification) 아키텍처를 정의한다. 본 spec은 **정의(definition)** 만 다루며, 구현은 L1–L9 lane으로 분리된다.

핵심 변경 3가지:

**(1) 검증의 본질 재정립.** Action verification은 **외부 관찰자(external witness)** 가 행동 완료를 확인할 때만 성립한다. Self-attestation은 production 목적상 검증으로 인정되지 않는다. 이는 BTY Constitution v1 "Leader = Decision + Action Completion" 및 BTY QR Product Spec v1 §13 "사람은 타인의 검증이 있을 때 행동한다"를 코드 invariant로 변환한 것이다.

**(2) Tier-aware verification (Three-tier).** 검증 강도를 phase·context에 따라 3단계로 분리한다.

| Tier | 사용 시점 | Scanner 식별 | Self-scan policy |
|---|---|---|---|
| `mvp_open` | D-0 (6/02) ~ ~D-30 (~7/02) launch window | 누구나 (optional auth) | 기록 + flag, hard block 없음 |
| `member_only` | Strict-mode rollout (200-person) 이후 | 인증된 btyARENA user 필수 | Hard block (409) |
| `manager_only` | Event-restricted (Mission trip / Doctor's meeting / Training 등) | Designated manager만 | Hard block + role check |

**(3) Verification source of truth = `le_verification_log`.** 검증 audit trail은 기존 `le_verification_log` 테이블이 single source of truth다. `bty_action_contracts`에는 derived 상태(tier / status / confidence / self_scan_suspected / verified_at)만 둔다. `verified_by_user_id`, `verified_by_fingerprint_hash` 같은 검증자 식별 정보는 log table에만 존재한다. (Commander D1, 2026-05-27)

본 문서가 **다루지 않는 것:**
- 코드 구현 (L1–L9 lanes에서)
- 12-axis taxonomy collapse beyond CANONICAL_PATTERN_FAMILIES (memory #11, 별도 workstream)
- LRI/Certified admin lane UI (post-launch HIGH, memory #28)
- XP 정확 수치·level 시스템 (이미 `LEADERSHIP_ENGINE_SPEC.md`에서 다룸)

---

## 2. Current Enforcement (verified 2026-05-27)

본 spec이 대체하는 **현재 코드의 enforcement 갭**을 명시한다. L1–L9는 이 갭을 닫는 작업이다.

### 2.1 WRITE sites — 4곳에서 contract 생성

`verification_type` 컬럼에 어떤 값을 stamp하는가:

| # | File | Line | 현재 값 |
|---|---|---|---|
| 1 | `src/app/api/arena/action-contracts/route.ts` | 64 | `'self_attest'` |
| 2 | `src/lib/bty/action-contract/ensureActionContract.ts` | 280 | `'self_attest'` |
| 3 | `src/lib/bty/arena/eliteBindingActionCommitment.server.ts` | 201 | `'self_attest'` |
| 4 | `src/lib/bty/action-contract/actionContractLifecycle.server.ts` | 294 | `'hybrid'` (draft micro_win, Lane 7 A2 revert scope 외) |

WRITE 3+1 site 전부 self-attestation 계열. 이것이 L2에서 `'action_completed'` + `verification_tier` stamp로 교체된다.

### 2.2 Validate route — production self-scan hole

`src/app/api/arena/leadership-engine/qr/validate/route.ts` (237 lines):
- `requireUser: NO` — 누구나 token만 있으면 POST 가능
- Token 검증: `token.userId === contract.user_id`만 확인 (즉 token이 contract owner 것이면 통과)
- **Scanner identity 캡처 없음, scanner-actor separation check 없음**
- 결과: Actor 본인이 자기 token으로 POST해서 `verified_at` 받을 수 있음

이것이 L4에서 닫힐 production self-scan hole의 정체다.

### 2.3 Submit-validation 4-AND gate

`src/app/api/bty/action-contract/submit-validation/route.ts` L266-270:
- `canSelfReportAutoApprove` 4-AND gate가 staging-only (BTY_ENV check)이긴 하나
- 더 큰 문제는 **production Layer 2 normal path**가 `status='submitted'` + `validation_approved_at=NOW()`로 두면 그 다음에 누구나 QR validate route로 `verified_at`을 받을 수 있다는 점

즉 self-attest 차단의 진짜 invariant는 L4 (validate route)에 있지 submit-validation에 있는 게 아니다. L6에서 4-AND gate를 제거하는 이유.

### 2.4 Layer 2 evaluator — verification_type unaware

`src/lib/bty/validator/runActionContractValidation.ts` + `layer2Semantic.ts`:
- LLM payload에 contract의 who/what/how/when/raw_text + 3 criteria 포함
- **`verification_type`, `verification_tier`, `user_id`, `status` 미포함**
- 결과: Layer 2는 self_attest contract와 외부 witness 검증 contract를 구분하지 못함

L5에서 system prompt에 tier-aware instruction이 추가된다.

### 2.5 `le_verification_log` — 이미 wired (재사용 대상)

`supabase/migrations/20260313000000_leadership_engine_activation_logs.sql`:

```
le_verification_log:
  id            bigserial PK
  activation_id uuid FK (le_activation_log)
  user_id       uuid FK auth.users
  verifier_id   uuid null FK auth.users
  verifier_role text null
  verified      boolean
  verified_at   timestamptz
  method        text null
  created_at    timestamptz
```

이 테이블은 이미 verifier 식별 인프라를 가지고 있다. 본 spec은 이 구조를 **확장 + 재사용**한다.

---

## 3. Product Invariant

### 3.1 Core invariant (immutable)

> **Action verification requires an external witness.**
> A contract reaches `verification_status = 'verified'` only when a party other than the actor has confirmed the action.

코드 form:

```
INVARIANT I1:
  For any verification event recorded in le_verification_log,
  IF tier IN ('member_only', 'manager_only'):
    verifier_id IS NOT NULL
    AND verifier_id != contract.user_id

INVARIANT I2:
  For mvp_open tier:
    self_scan_suspected MAY be true
    BUT verification is still recorded (no hard block)
    AND verification_confidence reflects the integrity gap ('low')
```

### 3.2 BTY Constitution 정합

BTY Constitution v1 (Behavioral Training System Specification v1) 발췌:

> "Leader = Decision + Action Completion. 이 시스템 안에서는 생각만 하고 끝나는 리더는 존재할 수 없다."
> "패턴이 회피한 현실 안으로 들어가는 행동."
> "QR Execution System — 역할: 행동 기억 장치 / 실행 트리거 / **완료 체크**"

본 invariant는 위 3개 문장을 코드 검증 로직으로 변환한 것이다. Self-attestation은 "완료 체크" 의미를 무력화하므로 production에서 인정되지 않는다.

### 3.3 BTY QR Product Spec v1 정합

Product Spec §13 Key Insight:

> "사람은 타인의 검증이 있을 때 행동한다. BTY QR 시스템은 이 심리를 구조로 만든다."

3-role 모델 (§5):
- **Issuer** — 행동 요청 생성자
- **Actor** — 행동 수행자
- **Approver** — 행동 검증자

본 spec의 Three-tier는 위 3-role 모델을 phase별 enforcement 강도로 분리한 것이지 role 모델 자체를 바꾸지 않는다.

### 3.4 mvp_open의 정당화 (Commander posture, 2026-05-27)

> "BTY는 MVP에서 사람을 막는 시스템이 아니라 행동 루프를 여는 시스템으로 시작한다. 하지만 architecture는 처음부터 Tier 2/3 strict invariant를 품고 간다. 즉, MVP는 open, engine은 strict-ready."

mvp_open이 invariant I1을 위반하지 않는 이유:
- mvp_open에서 verification은 **여전히 외부 witness를 가정**하나 enforcement만 soft (record + flag, no block)
- `self_scan_suspected=true`인 record는 product 차원에서 **검증으로 카운트하지 않음** (relational_verified = false)
- Strict invariant I1은 tier transition 후 자동 활성화

---

## 4. Tier-Aware Verification Architecture

### 4.1 Tier 1 — `mvp_open`

**적용 시점.** Launch D-0 (6/02) ~ D-30 (~7/02). 정확한 cutover 일자는 Open Question §10-2.

**Scanner eligibility.** 인증 불필요. 누구나 QR reader로 token POST 가능.

**Self-scan policy.** Hard block 없음. 다음 정보 캡처:
- `verified_by_fingerprint_hash` — scanner 브라우저 fingerprint (User-Agent + Accept-Language + IP subnet 등의 stable hash, **le_verification_log.method** 또는 `details` field에 저장)
- `self_scan_suspected` (boolean) — `actor_device_fingerprint_hash == scanner_fingerprint_hash`이면 true (contract table에 저장)
- `verification_confidence`:
  - `self_scan_suspected=false` → `'medium'`
  - `self_scan_suspected=true` → `'low'`

**Optional auth bonus.** Scanner가 우연히 logged-in인 경우 `le_verification_log.verifier_id`에 user_id 기록. Verification confidence는 동일하게 medium/low (logged-in만으로는 member tier 진입 아님).

**Fingerprint capture mechanism.**
```
// pseudocode
function computeDeviceFingerprintHash(req) {
  const components = [
    req.headers['user-agent'],
    req.headers['accept-language'],
    ipSubnet(req.headers['x-forwarded-for']),  // /24 mask for IPv4
    req.headers['sec-ch-ua-platform'],
    req.headers['sec-ch-ua-mobile'],
  ];
  return sha256(components.join('|')).slice(0, 32);
}
```

Fingerprint는 **추적 식별자가 아닌 우연 일치(suspect 표지)** 다. spoofing 가능성을 인정하며 security boundary로 사용하지 않는다.

### 4.2 Tier 2 — `member_only`

**적용 시점.** Strict-mode cutover 이후. cutover trigger는 env flag `BTY_PHASE=tier2_member_only`.

**Scanner eligibility.** Scanner가 `auth.users`에 row 있는 사용자여야 함. 미인증 → 401.

**Self-scan enforcement.** `scanner.user_id === contract.user_id` → 409 `self_scan_blocked`. Hard block.

**Recorded fields.**
- `le_verification_log.verifier_id` = scanner.user_id (NOT NULL)
- `le_verification_log.verifier_role` = scanner의 arena role (staff/leader 등)
- `le_verification_log.method` = `'tier2_member_scan'`
- `bty_action_contracts.verification_confidence` = `'high'`
- `bty_action_contracts.self_scan_suspected` = false (block된 case는 record 자체가 안 됨)

### 4.3 Tier 3 — `manager_only`

**적용 시점.** Event-restricted context. 예: Mission trip, doctor's meeting, training, volunteer day, zoom meeting. Contract 생성 시 `event_id` link 필수.

**Scanner eligibility.** Logged-in user + designated manager check 통과. 검증 순서:
1. `requireUser` — 401 if not logged in
2. `scanner.user_id !== contract.user_id` — 409 self_scan
3. `event.designated_managers.includes(scanner.user_id)` — 403 not_designated_manager

**Designated manager source.** Open Question §10-4. 후보:
- (a) `events` table의 `designated_managers uuid[]` 컬럼
- (b) `team_memberships` 또는 별도 role table

**Recorded fields.**
- `le_verification_log.verifier_id` = manager.user_id
- `le_verification_log.verifier_role` = `'designated_manager'`
- `le_verification_log.method` = `'tier3_manager_scan'`
- `bty_action_contracts.verification_confidence` = `'high'`

**Manager review extension (Product Spec §8 Approval Logic).** Tier 3는 manager가 score (선택) + comment (권장)를 함께 기록할 수 있다. `le_verification_log`에 추가 컬럼 필요할 수 있음 (구체적 schema는 L1에서 결정):
- `evaluation_score` int null
- `evaluation_comment` text null

### 4.4 Legacy tier — `legacy_self_attest`

**적용 대상.** Migration 시점 (L1) 이전에 생성된 모든 `bty_action_contracts`.

**처리 정책 (Commander D2):**
- XP/AIR reflection: **보존**. 이미 progression을 받은 사용자에게 rollback 안 함
- `verification_tier` = `'legacy_self_attest'`
- `verification_confidence` = `'legacy'`
- Relational verification badge UI: 미부여 (`relational_verified` = false)
- Plan §3.6의 8 hotfix contracts: `details.legacy_disposition = 'external_witness_absent_but_admin_approved'` 추가

**Justification (Commander 2026-05-27):**
> "기존 사용자 기록을 되돌리면 pilot 신뢰가 깨진다. 대신 앞으로의 invariant를 분리한다."

---

## 5. QR Type Mapping

BTY QR Product Spec v1 §4의 3개 QR Type을 Three-tier에 매핑한다 (Commander D3).

| Product Spec QR Type | Phase | Verification Tier |
|---|---|---|
| **Relational QR** | D-0 ~ ~D-30 (MVP launch window) | `mvp_open` |
| **Relational QR** | Strict-mode 이후 | `member_only` |
| **Team Mission QR** | 모든 phase | `manager_only` |
| **Event QR** | 모든 phase | `manager_only` |

### 5.1 핵심 매핑 원칙

**`mvp_open` is not a separate QR Type.** Relational QR의 launch posture다. Product Spec §4.3 Relational QR 정의 ("실제 인간 관계 기반 행동 실행")는 그대로 유효하며, mvp_open은 **enforcement 강도만 완화한 phase**다.

**Team Mission / Event QR은 phase에 무관하게 항상 manager_only.** 이유:
- Issuer 구조 자체가 manager-level (팀 리더 / 관리자 / 운영자)
- Approver = 관리자 또는 지정 reviewer
- Self-scan을 허용할 product motivation이 없음 (MVP open 정신은 Relational QR의 friction 제거가 목적, manager scenario에는 적용 안 됨)

### 5.2 MVP scope (Product Spec §10)

Product Spec MVP scope는 "Relational QR 중심". 본 spec 기준으로:
- **D-0 launch 포함 QR types**: Relational QR (mvp_open posture)
- **D-30 이후 포함**: Relational QR (member_only) + Team Mission QR + Event QR (manager_only) — 단 Team Mission / Event QR 활성화는 별도 product gate (event table + designated_managers data 필요)

---

## 6. Database / Log Model

Commander D1: `le_verification_log` = verification audit trail의 single source of truth. `bty_action_contracts`에는 minimal derived state만.

### 6.1 `bty_action_contracts` — minimal state (new columns)

| 컬럼 | 타입 | 제약 | 의미 |
|---|---|---|---|
| `verification_tier` | text | CHECK IN (mvp_open / member_only / manager_only / legacy_self_attest) | 검증 강도 분류 |
| `verification_status` | text | CHECK IN (pending / verified / rejected) | 현재 검증 상태 (status 컬럼과 별도; 후자는 contract lifecycle) |
| `verification_confidence` | text NULL | CHECK IN (low / medium / high / legacy) | Tier별 신뢰도 band |
| `self_scan_suspected` | boolean | DEFAULT false | mvp_open에서 scanner==actor fingerprint match 시 true |
| `verified_at` | timestamptz NULL | — | 검증 완료 timestamp (le_verification_log 최신 verified=true row의 verified_at과 mirror) |
| `actor_device_fingerprint_hash` | text NULL | — | Contract 생성 시점 actor fingerprint (self_scan_suspected 판정용) |

**의도적으로 두지 않는 컬럼:**
- ❌ `verified_by_user_id` — `le_verification_log.verifier_id`에 존재
- ❌ `verified_by_fingerprint_hash` — `le_verification_log` 확장 컬럼에 존재

### 6.2 `le_verification_log` — extension

기존 컬럼 (그대로 유지):
- `activation_id`, `user_id`, `verifier_id`, `verifier_role`, `verified`, `verified_at`, `method`

**추가 필요 컬럼 (L1 migration):**
- `verifier_fingerprint_hash` text NULL — mvp_open에서 비인증 scanner의 fingerprint 기록
- `verification_tier` text NULL — log row가 어떤 tier 정책에서 발생했는지
- `verification_confidence` text NULL — `low`/`medium`/`high`/`legacy`
- `self_scan_suspected` boolean DEFAULT false
- `contract_id` uuid NULL FK `bty_action_contracts(id)` — 현재 `activation_id`만 있어 contract 직접 join이 불편. 둘 다 보유.
- `evaluation_score` int NULL — manager_only tier에서 사용
- `evaluation_comment` text NULL — manager_only tier에서 사용

### 6.3 verification_type 정리

기존 `bty_action_contracts.verification_type` 컬럼 운명:

**선택지 A (권장).** 컬럼 유지, 의미 단순화. 새 taxonomy 3종:
- `action_completed` (default) — 외부 행동 완료 검증
- `non_event_confirmed` — AD2 회피 commitment 확인
- `manager_reviewed` — manager 공식 평가 동반

Legacy 값(`self_attest` / `qr` / `hybrid` / `link` / `qr_peer` / `qr_system` / `qr_location` / `self_report` / `none`)은 CHECK constraint에 cutover 기간 동안 유지. 신규 contract는 새 3종 중 하나로만 생성.

**선택지 B.** `verification_type` 컬럼 제거, 전부 `verification_tier`로 통합. 단 AD2/manager_reviewed가 tier와 직교(orthogonal)한 정보라 정보 손실 발생. 권장 안 함.

→ A 채택. L1 migration이 CHECK constraint 확장.

### 6.4 무결성 trigger / 제약 (L1 단계 결정)

- `le_verification_log` row INSERT 후 `bty_action_contracts.verified_at` mirror update 책임은 **application layer** (L4 validate route)에 둠. DB trigger로 강제하지 않음 (debugging 어려움 + Supabase migration 복잡도).
- INVARIANT I1 enforcement: application layer (L4)에서 처리. `le_verification_log` row insert 직전 tier별 분기 로직 실행.
- INVARIANT I2: mvp_open record에 verifier_id NULL 허용. CHECK constraint는 두지 않음.

---

## 7. Validate Route Behavior

`src/app/api/arena/leadership-engine/qr/validate/route.ts`를 tier-aware로 재작성. 본 section은 L4에서 구현될 의도 정의.

### 7.1 공통 진입 처리

```
// pseudocode
async function POST(req):
  body = await req.json()
  token = body.token

  verified = verifyArenaActionLoopToken(token)
  if not verified.ok: return 401 invalid_token

  contractId = verified.payload.contractId
  contract = fetchContract(contractId)
  if not contract: return 404 contract_not_found

  // Awaiting verification classification (existing)
  awaitingVerification =
    contract.status IN ('approved', 'submitted')
    AND contract.validation_approved_at IS NOT NULL
    AND contract.verified_at IS NULL
  if not awaitingVerification: return 409 contract_not_pending

  tier = contract.verification_tier
  // dispatch per tier
```

### 7.2 Tier 1 — mvp_open branch

```
// pseudocode
if tier == 'mvp_open':
  scannerFingerprint = computeDeviceFingerprintHash(req)
  selfScanSuspected = scannerFingerprint == contract.actor_device_fingerprint_hash
  confidence = selfScanSuspected ? 'low' : 'medium'

  optionalUser = tryGetUser(req)  // null if not authenticated
  verifierId = optionalUser?.user_id

  // 1. Append to le_verification_log
  insert le_verification_log {
    activation_id: contract.activation_id,
    contract_id: contract.id,
    user_id: contract.user_id,
    verifier_id: verifierId,
    verifier_role: optionalUser?.arena_role,
    verifier_fingerprint_hash: scannerFingerprint,
    verified: true,
    verified_at: now(),
    method: 'tier1_mvp_open_scan',
    verification_tier: 'mvp_open',
    verification_confidence: confidence,
    self_scan_suspected: selfScanSuspected,
  }

  // 2. Mirror minimal state to bty_action_contracts
  update bty_action_contracts where id = contract.id:
    status = 'approved',
    verification_status = 'verified',
    verified_at = now(),
    completed_at = now(),
    verification_confidence = confidence,
    self_scan_suspected = selfScanSuspected

  // 3. Downstream chain (existing)
  completeArenaRunAfterContractVerification(...)
  applyArenaRunRewardsOnVerifiedCompletion(...)
  reflectContractVerificationToAir(...)  // see §9 for legacy comparison

  return 200 {
    outcome: 'verified',
    verification_confidence: confidence,
    self_scan_suspected: selfScanSuspected,
  }
```

### 7.3 Tier 2 — member_only branch

```
// pseudocode
if tier == 'member_only':
  scanner = requireUser(req)
  if not scanner: return 401 login_required

  // INVARIANT I1
  if scanner.user_id == contract.user_id:
    return 409 self_scan_blocked

  insert le_verification_log {
    ...,
    verifier_id: scanner.user_id,
    verifier_role: scanner.arena_role,
    method: 'tier2_member_scan',
    verification_tier: 'member_only',
    verification_confidence: 'high',
    self_scan_suspected: false,
  }

  update bty_action_contracts ...
  downstream chain

  return 200 { outcome: 'verified', verified_by: scanner.codename }
```

### 7.4 Tier 3 — manager_only branch

```
// pseudocode
if tier == 'manager_only':
  scanner = requireUser(req)
  if not scanner: return 401 login_required
  if scanner.user_id == contract.user_id: return 409 self_scan_blocked

  event = fetchEvent(contract.event_id)
  if not event: return 400 event_link_missing

  if not event.designated_managers.includes(scanner.user_id):
    return 403 not_designated_manager

  // optional evaluation fields from body
  evaluationScore = body.evaluation_score  // null OK
  evaluationComment = body.evaluation_comment  // null OK

  insert le_verification_log {
    ...,
    verifier_id: scanner.user_id,
    verifier_role: 'designated_manager',
    method: 'tier3_manager_scan',
    verification_tier: 'manager_only',
    verification_confidence: 'high',
    evaluation_score: evaluationScore,
    evaluation_comment: evaluationComment,
  }

  update bty_action_contracts ...
  downstream chain

  return 200 { outcome: 'verified', verified_by_manager: scanner.codename }
```

### 7.5 Legacy tier — 410 closed path

```
// pseudocode
if tier == 'legacy_self_attest':
  return 410 legacy_contract_no_verification_path

if tier IS NULL or unknown: return 400 unknown_tier
```

### 7.6 Token payload extension

`src/app/api/arena/leadership-engine/qr/action-loop-token/route.ts` (mint route). Token에 tier metadata 추가:

```
// pseudocode (new payload)
{
  sessionId, userId, actionId, issuedAt, contractId,
  verification_tier: contract.verification_tier,
  scanner_required: contract.verification_tier != 'mvp_open',
}
```

Token은 JWT-like signed payload. 변조 불가. `scanner_required`는 client UI hint이며 server enforcement는 validate route에서 contract.verification_tier 재조회로 (token-only 신뢰 안 함).

### 7.7 E2E test matrix (L4 verify gate)

| # | Tier | Scenario | Expected |
|---|---|---|---|
| 1 | mvp_open | Actor self-scan | 200, `self_scan_suspected: true`, `confidence: 'low'` |
| 2 | mvp_open | Third-party scan (anon) | 200, `self_scan_suspected: false`, `confidence: 'medium'` |
| 3 | mvp_open | Third-party scan (logged-in) | 200, `verifier_id` set, confidence still `'medium'` |
| 4 | member_only | Actor self-scan | 409 self_scan_blocked |
| 5 | member_only | Other logged-in user | 200, `confidence: 'high'` |
| 6 | member_only | Anon scan | 401 login_required |
| 7 | manager_only | Designated manager | 200 |
| 8 | manager_only | Non-designated logged-in | 403 not_designated_manager |
| 9 | manager_only | Actor self (even if manager elsewhere) | 409 self_scan_blocked |
| 10 | legacy_self_attest | Any | 410 legacy_contract_no_verification_path |

---

## 8. Legacy Compatibility

### 8.1 Pre-migration contracts (~3300+ rows, baseline 3358/0/6)

**Migration step (L1):**
```sql
UPDATE bty_action_contracts
SET verification_tier = 'legacy_self_attest',
    verification_status = CASE
      WHEN verified_at IS NOT NULL THEN 'verified'
      ELSE 'pending'
    END,
    verification_confidence = 'legacy'
WHERE verification_tier IS NULL;
```

**XP/AIR 영향**: 없음. 이미 reflected 상태 유지 (Commander D2). 별도 rollback script 없음.

**UI 영향 (L9):**
- Resolve screen에서 legacy contract 조회 시: "Action recorded (legacy mode)" 표시
- Identity Console pattern signatures: `relational_verified = false`로 표시 (`legacy` confidence는 verified relational badge에서 제외)

### 8.2 8 hotfix contracts (D-7, 2026-05-26)

추가 disposition mark:
```sql
UPDATE bty_action_contracts
SET details = jsonb_set(
  COALESCE(details, '{}'::jsonb),
  '{legacy_disposition}',
  '"external_witness_absent_but_admin_approved"'::jsonb
)
WHERE id IN (
  -- 8 hotfix contracts from D-7 hotfix
  'fe71287c...', 'b76b1da3...', 'e4632681...', '1ba8b194...',
  'c52628f0...', '9df071f9...', '38d9e485...', 'aaa3a010...'
);
```

(8개 UUID 전체는 D-7 transcript에서 확보; L8 dispatch에서 inventory-first 재확인 후 적용)

### 8.3 `verification_type` legacy 값 처리

L1 CHECK constraint:
```sql
ALTER TABLE bty_action_contracts
  ADD CONSTRAINT verification_type_check CHECK (
    verification_type IN (
      -- new canonical
      'action_completed', 'non_event_confirmed', 'manager_reviewed',
      -- legacy preserved (cutover compat)
      'self_attest', 'qr', 'link', 'hybrid',
      'qr_peer', 'qr_system', 'qr_location', 'self_report', 'none'
    )
  );
```

Post-launch에서 별도 cleanup migration으로 legacy 값 제거 검토 가능 (Out of scope for L0–L9; backlog).

### 8.4 Layer 2 evaluator backward compat

L5에서 system prompt가 확장된다. 기존 contract의 Layer 2 재평가는 없음 (verified_at 있는 contract는 evaluator path를 다시 타지 않음).

---

## 9. AIR / XP Reflection

### 9.1 기존 reflection 경로 (변경 없음)

`reflectContractVerificationToAir(...)` 함수가 contract `verified_at` set 시점에 호출됨. AIR 계산 입력:
- `le_activation_log` (chosen/due/completed timestamps)
- `le_verification_log` 최신 verified=true row

**본 spec은 reflection logic 자체를 바꾸지 않는다.** `LEADERSHIP_ENGINE_SPEC.md` §4 AIR 수식 그대로 유효.

### 9.2 Tier별 reflection 강도 결정

**Default (D-0 launch):** 모든 tier (mvp_open / member_only / manager_only)에서 verified contract는 AIR에 reflect됨. 단:
- mvp_open + `self_scan_suspected=true` + `confidence='low'` 의 경우에도 reflect (Commander posture: "MVP는 행동 루프를 여는 것이 우선")
- `legacy_self_attest`는 이미 reflected 상태 유지, 새로운 reflect 없음

**Strict-mode 이후 (re-evaluation):** Tier 1 record에서 `self_scan_suspected=true`인 row를 retroactively AIR에서 제외할지 여부는 D-30 cutover 시점 product 결정 (Open Question §10-2).

### 9.3 Relational verification badge

`bty_action_contracts.relational_verified` (derived, 별도 컬럼은 두지 않고 view로 계산):

```sql
-- Derivation rule
relational_verified =
  verification_confidence IN ('medium', 'high')
  AND verification_tier != 'legacy_self_attest'
  AND self_scan_suspected = false
```

**UI 노출:** Identity Console에서 "Relational verification: X count"로 노출. legacy/self-scan-suspected는 카운트에서 제외.

### 9.4 XP — Product Spec §7 "승인 후 지급" 정합

Product Spec 원칙: "XP는 승인 후 지급". 본 spec과의 정합:
- Tier 1/2/3: `verified_at` set 시점 = "승인" 시점 → XP 지급 (기존 로직 유지)
- Legacy contracts: 이미 verified 처리된 상태 → XP 보존 (Commander D2)
- 신규 contract는 외부 witness 검증 후에만 XP 지급되므로 Product Spec invariant 그대로 유지

---

## 10. Open Questions

본 spec에서 결정 미루는 4개 항목. L1 이후 lane 진입 전 Commander가 결정.

### 10-1. Fingerprint privacy wording

mvp_open에서 capture되는 `verifier_fingerprint_hash` (= UA + Accept-Language + IP subnet 등 hash)는 fingerprinting 인식 가능성이 있다.

**결정 필요:**
- Privacy policy / Terms에 fingerprint capture 명시 여부
- Consent banner 필요 여부 (특히 EU/GDPR context — current consent banner는 cookie + analytics 수준)
- Data retention 정책 (le_verification_log row의 fingerprint_hash 보존 기간)

**현재 default (lock 전 임시):** Privacy policy에 "verification integrity 목적의 device signal hash 캡처" 한 줄 추가, 보존 기간 contract lifetime + 90일.

### 10-2. D-30 이후 mvp_open → member_only 전환 기준

**Trigger 후보:**
- (a) Wall-clock D-30 (~2026-07-02): 단순한 시간 기준
- (b) DAU threshold (예: 50명 active 이상): 사용자 안정 후 enforcement
- (c) Manual flag flip (Commander 결정): 시점 자체를 product 판단으로
- (d) Mixed: D-30 wall-clock + manual override

**관련 결정:** 전환 시 기존 mvp_open record의 retroactive 처리 (§9.2와 연결).

### 10-3. AD2 non-event verification UX

AD2 (Avoidance Decision 2)는 회피 commitment의 "안 했음"을 검증. `verification_type='non_event_confirmed'`.

**열린 항목:**
- Approver는 누구? (Plan §4.9의 4-option open question)
  - A. Any member도 가능 ("X를 안 하는 것을 봤다" 증언)
  - B. Manager only
  - C. **Tier-aware** (mvp_open: anyone, member_only: member, manager_only: manager) ← Plan recommendation
  - D. Self-attest 허용 (회피 검증의 특수성)
- UI prompt 문구 차이 ("X가 일어났음 확인" vs "X 안 일어났음 확인")
- AD2 contract도 verification_tier를 가지나? (현재 spec assumption: yes, 일반 contract와 동일 tier 체계)

### 10-4. Designated manager source

Tier 3 `event.designated_managers` 데이터의 source는 어디?

**후보:**
- (a) `events` table 신규 생성 + `designated_managers uuid[]` 컬럼
- (b) `team_memberships` 테이블 활용 (memberships.role = 'manager')
- (c) 별도 `event_managers` 매핑 테이블 (events 1:N user)

**현재 코드 상태:** `events` 또는 `event_managers` 테이블 존재 여부 미확인 (L4 진입 전 inventory-first로 확인 필요).

**연쇄 영향:** Tier 3 활성화 시점에 영향. 데이터 모델 없으면 Team Mission / Event QR product activation 불가.

---

## 11. Cross-References

본 spec과 함께 읽어야 할 문서:

| 문서 | 용도 |
|---|---|
| `bty-app/docs/UNIVERSAL_QR_ARCHITECTURE_RECOVERY_PLAN.md` | L0–L9 lane 실행 계획. 본 spec의 implementation roadmap |
| `bty-app/docs/LEADERSHIP_ENGINE_SPEC.md` | AIR / TII / Certified / LRI 수식 — 본 spec이 reference만, 변경 안 함 |
| `bty-app/docs/ENGINE_ARCHITECTURE_DIRECTIVE_PLAN.md` | `le_activation_log` / `le_verification_log` schema canonical source |
| `BTY_QR_Product_Spec_v1` (project docs) | 3 QR Types 정의 (Event / Team Mission / Relational) + 10-step lifecycle |
| `BTY Arena — Behavioral Training System Specification v1` (Constitution) | "Leader = Decision + Action Completion" philosophy. Pattern→Action mapping 원리 |
| `docs/CURSOR_TASK_BOARD.md` | Active lane 추적 (legacy doc name 유지) |
| `docs/CURRENT_TASK.md` | L0–L9 진행 checklist |

**Memory invariants (Anthropic conversational memory):**
- #11 `[12_axis_canonical 2026-05-27]` — CANONICAL_PATTERN_FAMILIES 5개, THRESHOLD=3, WINDOW=7
- #26 `[bty_qr_arch 2026-05-27]` — Commander Option E architecture decision (본 spec이 implement)
- #21 `[file_path_drift]` — submit-validation path `/api/bty/`, validate path `/api/arena/`
- #24 `[supabase_topology_lock]` — 단일 Supabase project, migration production-effective

---

## 12. Version History

| 일자 | 변경 | 작성 |
|---|---|---|
| 2026-05-27 | Draft v1 — D1/D2/D3 lock 후 초안 | C3 (Claude) |

---

*End of spec.*
