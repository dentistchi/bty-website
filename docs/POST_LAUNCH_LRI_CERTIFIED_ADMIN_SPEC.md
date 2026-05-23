# POST_LAUNCH_LRI_CERTIFIED_ADMIN_SPEC

**Status**: DRAFT (author: Claude session 2026-05-23, awaiting Commander review)
**Scope**: Post-launch (5/31 이후) admin lane — LRI + Leader-track approval + Certified
**Baseline at draft time**: inner `35013b74` / outer `ed2fed3c` / worker `6528ecf2` / tests 3314-0-6
**Anchor**: `a27781f5` (CF Worker version UUID prefix, NOT git) — rollback safety preserved
**Authority chain**: Claude author → Commander review (this doc) → Claude Code commit & implement

---

## §1. Scope & Authority

### 1.1 Decision provenance

Commander 결정 (2026-05-23 D-7 session):

- **Q1 작업 범위**: (a) + (b) — LRI sub-tab + approval workflow + Certified sub-tab
- **Q2 deploy 시점**: Launch 후 (5/31 이후), Stage 8 gate 이전 deploy 금지
- **Q3 Stage 8 영향**: (a)+(b) deploy는 launch 후 lane이므로 Stage 8 worker version 기대값 변경 없음

### 1.2 Authority source

LEADERSHIP_ENGINE_SPEC.md 인용 (line-anchored, grep-verified 2026-05-23):

- **L5**: "역할 기반 시나리오 훈련 제품. 동일 4단계 엔진이 모든 역할(Doctor/Manager/DSO/Staff/Executive)에 적용. 개인 점수 비공개, 팀 수준 지수만 공개."
- **L168**: "팀 뷰에서 **개인 AIR·개인 순위 노출 금지**."
- **L194**: "LRI는 **비공개**. 임계 도달 시 **Ready Flag** 생성."
- **L210**: "approveLeaderTrack(supabase, userId, approverId, getLRIInputs, getCertifiedInputs) → { approved, reason? }. 승인 시 leadership_engine_state에 is_leader_track, leader_approved_at, leader_approver_id 저장."

### 1.3 LRI "비공개" 해석 (Commander 2026-05-23 확정)

Spec의 "비공개"는 **end-user 간 비교 방지가 목적**. Admin/approver surface는 spec과 정합:

- L168이 "팀 뷰" 한정 명시 → admin은 별개 surface
- L210이 approver_id 받는 워크플로우 명시 → approver는 후보자의 readiness_flag를 볼 수 있어야 함 (그렇지 않으면 함수 작동 불가)
- 현재 admin AIR 탭이 이미 개인 metric을 운영자에게만 공개 — LRI도 같은 패턴

### 1.4 Out of scope

- 5개 핵심가치(Trust Compounds, Ownership, Respect, Action-driven) metric화 → 별도 lane, 본 spec 대상 아님
- Role Mirror (Module 6) admin 노출 → 메모리 #30 참조, spec naming drift 정리 후 별도 lane

---

## §2. Sub-tab Layout

### 2.1 Current state (2026-05-23 observed)

| Tab | Status | API |
|---|---|---|
| AIR | ✅ live | `/api/admin/leadership-metrics` (base) |
| Stage | ✅ live | `.../stage` |
| MWD | ✅ live | `.../mwd` |
| TII | ✅ live | `.../tii` |

### 2.2 Target state (4 → 6 tabs)

| Tab | Status | API |
|---|---|---|
| AIR | unchanged | unchanged |
| Stage | unchanged | unchanged |
| MWD | unchanged | unchanged |
| TII | unchanged | unchanged |
| **LRI** | **NEW** | **`.../lri` (NEW)** |
| **Certified** | **NEW** | **`.../certified` (NEW)** |

### 2.3 Tab order rationale

AIR → Stage → MWD → TII → LRI → Certified

- 좌측 4개는 measurement (객관 측정)
- 우측 2개는 readiness / status (qualification)
- LRI가 Certified 좌측 → "readiness candidates → certified members" 흐름

---

## §3. API Contracts

### 3.1 GET `/api/admin/leadership-metrics/lri`

**Purpose**: Admin이 모든 (또는 필터된) 비리더 사용자의 LRI를 본다

**Auth**: Admin email gate (existing `requireAdminEmail` 패턴 재사용)

**Request**: `GET` with optional query params:
- `?team_id=<uuid>` (optional filter)
- `?ready_only=true` (optional: readiness_flag=true 사용자만)

**Response shape** (proposed):
```typescript
type LRIMetricsResponse = {
  computed_at: string; // ISO8601
  users: UserLRIRow[];
};

type UserLRIRow = {
  user_id: string;
  email: string;
  lri: number; // 0.0~1.0
  air_14d: number;
  mwd_14d_normalized: number;
  personal_pulse_normalized: number;
  readiness_flag: boolean;
  integrity_slip: boolean;
  reasons: string[]; // computeLRI returns reasons
  is_leader_track: boolean; // already-promoted 여부
  last_activity_at: string | null;
};
```

**Server logic**:
1. Query non-leader users (`is_leader_track = false`)
2. For each, call existing `getLRI(userId, getInputs)` from `certified-lri-service`
3. Return array sorted by `lri` desc

**Privacy gate**: 본 endpoint는 admin email gate가 통과해야만 응답. End-user는 자신의 LRI도 접근 불가 (spec L194 준수).

### 3.2 POST `/api/admin/leadership-metrics/approve-leader-track`

**Purpose**: Certified leader가 ready 후보를 leader track으로 승인

**Auth**: Admin email gate **AND** approver 본인이 Certified leader 상태여야 함 (`canApproveLeaderTrack` gate)

**Request body**:
```typescript
{
  candidate_user_id: string;
  approver_user_id: string; // 보통 session user
  confirmation_token: string; // double-confirm UI에서 생성
}
```

**Response**:
```typescript
{
  approved: boolean;
  reason?: string; // 거절 시 사유 (예: candidate_not_ready, approver_not_certified)
  leader_approved_at?: string; // 성공 시
}
```

**Server logic**:
1. `getLRI(candidate_user_id, ...)` → readiness_flag 확인
2. `getCertifiedStatus(approver_user_id, ...)` → approver 자격 확인
3. `canApproveLeaderTrack(readiness_flag, approver_is_certified)` → true 일 때만 진행
4. `approveLeaderTrack(supabase, candidate, approver, ...)` 호출
5. `leadership_engine_state`에 `is_leader_track=true`, `leader_approved_at=now()`, `leader_approver_id=approver` 기록

**Audit**: 모든 호출은 로그 기록 (성공/실패 무관). 향후 audit trail.

### 3.3 GET `/api/admin/leadership-metrics/certified`

**Purpose**: 현재 Certified 상태 사용자 목록 + 4 조건 체크리스트 + 90일 재평가일

**Auth**: Admin email gate

**Response shape**:
```typescript
type CertifiedMetricsResponse = {
  computed_at: string;
  users: UserCertifiedRow[];
};

type UserCertifiedRow = {
  user_id: string;
  email: string;
  is_certified: boolean; // 현재 상태
  air_14d_ok: boolean; // ≥ 0.80
  mwd_14d_ok: boolean; // ≥ target_mwd (default 0.30)
  reset_compliance_ok: boolean;
  no_integrity_slip_ok: boolean;
  reasons_met: string[];
  reasons_missing: string[];
  certified_since: string | null; // grant 시작일
  next_reevaluation_at: string | null; // 90일 cycle
  last_activity_at: string | null;
};
```

**Server logic**:
1. Query all leader-track users (`is_leader_track = true`)
2. For each, call `getCertifiedStatus(userId, ...)` from `certified-lri-service`
3. Compute `next_reevaluation_at` from `certified_since + 90 days`

---

## §4. UI Components

### 4.1 File location

**Target**: 기존 admin leadership page 파일에 sub-tab 2개 추가

**Note**: 정확한 파일 경로는 Claude Code가 commit 시 inventory로 재확인 필요. 2026-05-23 dispatch 결과 기준 `page.tsx` 463 lines, `urlMap` (L80-85), 4 `<table>` blocks (L257/L315/L367/L414). LRI tab은 L414 뒤에 5번째 block, Certified tab은 6번째 block 추가 예상.

### 4.2 LRI tab UI

**Header**:
- Title: "LRI (Leadership Readiness Index)"
- Subtitle: "비리더 사용자의 리더 트랙 준비도 — 14일 롤링 윈도우"
- Privacy notice: "이 화면은 운영자 전용. 개인에게는 노출되지 않음."

**Table columns**:

| 이메일 | LRI | AIR 14d | MWD 14d | Pulse | 상태 | 슬립 | 마지막 활동 | 액션 |
|---|---|---|---|---|---|---|---|---|
| user@x.com | 0.82 | 0.85 | 0.40 | 0.75 | **Ready** | none | 5/22 | [승인] |
| user@y.com | 0.65 | 0.70 | 0.30 | 0.50 | Pending | none | 5/21 | — |
| user@z.com | 0.40 | 0.50 | 0.20 | 0.40 | Far | — | 5/15 | — |

**Status badge**:
- `Ready` (green) — readiness_flag=true (LRI≥0.80 AND no integrity_slip)
- `Pending` (yellow) — LRI 0.60~0.79
- `Far` (gray) — LRI < 0.60
- `Slipped` (red) — integrity_slip=true (LRI 값 무관)

**Privacy band display option (future)**: spec L194 "비공개" 강화를 원할 경우 LRI 숫자 대신 band("low/mid/high")만 노출하는 toggle 가능. **본 spec v1은 admin에 raw value 노출 (운영 필요)**.

**Action button**:
- `Ready` status일 때만 [승인] 버튼 활성화
- 클릭 시 double-confirm modal: "이 사용자를 리더 트랙으로 승인합니다. 되돌릴 수 없습니다."
- Confirm 시 `POST .../approve-leader-track` 호출
- 응답 후 row refresh

**Footer (정의)**:
- "LRI = AIR_14d × 0.50 + MWD_normalized × 0.30 + Pulse × 0.20"
- "Ready 조건: LRI ≥ 0.80 AND integrity_slip 없음"
- "승인 권한: Certified leader만"

### 4.3 Certified tab UI

**Header**:
- Title: "Certified Leaders"
- Subtitle: "90일 주기 재평가 — 4 조건 유지 시 자격 보존"

**Table columns**:

| 이메일 | 현재 | AIR 14d | MWD | Reset | Slip | 재평가일 | 마지막 활동 |
|---|---|---|---|---|---|---|---|
| user@x.com | ✅ Certified | ✅ 0.85 | ✅ | ✅ | ✅ | 2026-07-20 | 5/22 |
| user@y.com | ⚠️ At Risk | ✅ 0.82 | ❌ 0.18 | ✅ | ✅ | 2026-08-01 | 5/19 |
| user@z.com | ❌ Revoked | — | — | — | ❌ | — | 4/30 |

**Status badge**:
- `Certified` (green) — 4 조건 모두 통과
- `At Risk` (yellow) — 1~2 조건 fail, but still in grant period
- `Revoked` (red) — 자격 박탈 (재평가 fail)

**Footer (정의)**:
- "Certified 4 조건: AIR_14d ≥ 0.80 / MWD_14d ≥ 0.30 / Reset 준수 / 14d 내 integrity_slip 없음"
- "재평가 주기: 90일"

### 4.4 Tab navigation update

기존 `Tab` type 확장:
```typescript
type Tab = "air" | "stage" | "mwd" | "tii" | "lri" | "certified";
```

`urlMap` 확장:
```typescript
const urlMap: Record<Tab, string> = {
  air: "/api/admin/leadership-metrics",
  stage: "/api/admin/leadership-metrics/stage",
  mwd: "/api/admin/leadership-metrics/mwd",
  tii: "/api/admin/leadership-metrics/tii",
  lri: "/api/admin/leadership-metrics/lri",        // NEW
  certified: "/api/admin/leadership-metrics/certified", // NEW
};
```

---

## §5. Approval Workflow

### 5.1 Sequence

```
1. Admin이 LRI 탭 진입 → GET .../lri
2. Ready 사용자 row의 [승인] 버튼 클릭
3. UI: double-confirm modal 표시 (candidate 정보 + approver 정보)
4. Confirm 시 POST .../approve-leader-track
   - body: { candidate_user_id, approver_user_id, confirmation_token }
5. Server: canApproveLeaderTrack gate
   - candidate readiness_flag == true?
   - approver isCertified == true?
   - 둘 다 true → approveLeaderTrack 실행
6. DB: leadership_engine_state UPDATE
   - is_leader_track=true
   - leader_approved_at=now()
   - leader_approver_id=approver_user_id
7. Response: { approved: true, leader_approved_at: ... }
8. UI: row 갱신 (해당 사용자 LRI 탭에서 사라짐 = is_leader_track=true 필터)
9. Admin이 Certified 탭으로 이동 → 신규 승진자가 At Risk 상태로 시작 (Certified 4 조건 충족까지 시간 필요)
```

### 5.2 Failure modes

| 시나리오 | 처리 |
|---|---|
| Candidate not ready (LRI < 0.80 or integrity_slip) | `{ approved: false, reason: "candidate_not_ready" }` |
| Approver not Certified | `{ approved: false, reason: "approver_not_certified" }` |
| DB write fail | `{ approved: false, reason: "db_error" }` + log |
| Concurrent approval (race) | DB unique constraint on (user_id, is_leader_track=true) prevents duplicate. 2nd request → `{ approved: false, reason: "already_approved" }` |

### 5.3 Audit

모든 POST 시도는 별도 audit log table에 기록 (성공/실패 무관). 본 spec에서는 minimal log: console + structured log line. 향후 audit table 추가 가능.

---

## §6. Schema

### 6.1 New migrations

**없음.** 기존 schema 재사용:

- `leadership_engine_state` table에 이미 `is_leader_track`, `leader_approved_at`, `leader_approver_id` 컬럼 존재 (migration `20260316000000_leadership_engine_leader_track.sql` 적용 확인됨, 2026-05-23 inventory)
- `leadership_readiness_index` table (`20260419..._leadership_readiness_index.sql`)에 LRI snapshot 기록 가능

### 6.2 Indexes

신규 인덱스 필요성 평가 (post-launch performance 보고 결정):

- `leadership_engine_state(is_leader_track)` partial index — LRI 탭 query에 유리
- `leadership_engine_state(leader_approved_at DESC)` — 최근 승인 정렬용

**본 spec v1은 인덱스 추가 없음** (성능 문제 발견 시 별도 dispatch).

### 6.3 Supabase topology (메모리 #24 reminder)

**Critical**: Single Supabase project이므로 본 spec 구현 시 schema 변경은 production-effective. 인덱스 추가 등을 후속 결정할 때 mandatory guard:
- Snapshot before/after
- Governance check
- No rehearsal-only assumption

---

## §7. Tests

### 7.1 Required new tests

| Test file | Coverage |
|---|---|
| `lri/route.test.ts` | GET /lri — auth gate / sort order / readiness_flag 필터 |
| `approve-leader-track/route.test.ts` | POST — gate failure modes / DB write / idempotency |
| `certified/route.test.ts` | GET /certified — 4 조건 mapping / next_reevaluation_at 계산 |

### 7.2 Existing tests unchanged

`lri.test.ts`, `lri.edges.test.ts`, `certified-lri-service.test.ts` (incl. `approveLeaderTrack describe block`) 모두 그대로 유지. 본 spec은 service layer 변경 없음, route + UI만 추가.

### 7.3 Baseline projection

- 현재: 3314 / 0 / 6
- 신규 tests +3 routes × 평균 5 case = ~15 tests
- 예상 baseline: **3329 / 0 / 6** (±0 skipped)

Deploy 직전 vitest + tsc 둘 다 PASS 의무 (메모리 #13).

---

## §8. Deploy Plan

### 8.1 Pre-deploy checklist

메모리 #7 (dirty-tree deploy) + #3 (.env.local bake) 준수:

1. `.env.local` dev-only vars 주석 처리 (LLM_BASE_URL, Tailscale IP)
2. `git status` 확인 — WIP commit 또는 인지
3. vitest + tsc 둘 다 PASS 확인
4. 메모리 #18 baseline 갱신 노트 준비

### 8.2 Deploy steps

```
1. inner: commit on inner-main (NOT origin/main per memory #9 FOOTGUN)
2. outer: leak-integration commit (bty-app/ prefix 공-track)
3. outer: push origin/main
4. wrangler deploy → version ID 기록 (메모리 #8 신뢰 source)
5. Smoke: hanbitchi UID로 LRI 탭 fetch, Certified 탭 fetch, no [승인] 클릭
6. Update memory #18 baseline (inner/outer/worker version)
```

### 8.3 Rollback plan

- Worker rollback target: 새 deploy 이전 version (deploy 직전 wrangler version ID 기록)
- Canonical rollback anchor `a27781f5` 변경 없음 — 본 lane은 STAB-07-P0 무관
- DB rollback: schema 변경 없으므로 worker rollback만으로 충분

### 8.4 Forbidden windows

- D-3 mid-check (2026-05-27) 진행 중 deploy 금지
- D-1 Stage 8 gate (2026-05-29) 진행 중 deploy 금지
- D-0 launch (2026-05-30) 당일 deploy 금지
- **본 spec deploy는 D+1 (2026-05-31) 이후만 허용**

---

## §9. Provenance

### 9.1 Decision trail

- 2026-05-23 D-7 session
- Commander confirmations:
  - "리더십 지표 어디까지 구현되어 있어?" → inventory dispatch (read-only)
  - "LRI / Module 6 admin에서 노출되는지" → 두 번째 inventory dispatch
  - "우리에게 가장 중요한 4개의 지표가 코드로 구현된거지? admin에 UI로 넣어. 그리고 배포는 admin UI도 진행할꺼야."
  - "a+B. Q2- launch후. Q3- a+b에 대한 deploy."
- Spec interpretation: "LRI 비공개"는 end-user only, admin은 spec L168 (팀 뷰 한정 noteise) + L210 (approver workflow 전제)로 정합

### 9.2 Memory references

- #16 (mvp 2026-05-22) — launch context
- #18 (baseline_2026_05_22_post_DOC2) — pre-spec baseline
- #19 (anchor_schema_discipline) — anchor type discipline + bty_action_contracts canonical
- #24 (supabase_topology_lock) — single Supabase project
- #26 (stab_07_p0 CLOSED-pending-gate) — Stage 8 boundary
- #27 (provenance_self_correction) — author chain discipline (본 spec이 따르는 원칙)
- #28 (lri_certified_admin_lane) — 본 spec의 메모리 carrier
- #30 (spec_naming_drift_module6) — spec 인용 시 verbatim drift 주의

### 9.3 Author chain

| Step | Actor | Output |
|---|---|---|
| 1. Draft | Claude (this session) | 본 문서 (author-drafted) |
| 2. Review | Commander | 본 문서에 대한 verbatim 승인 또는 수정 지시 |
| 3. Commit | Claude Code | docs/POST_LAUNCH_LRI_CERTIFIED_ADMIN_SPEC.md (final) |
| 4. Implement | Claude Code dispatch (post-launch) | routes + UI + tests + deploy |

**Critical**: Step 1 → Step 3 사이에 본문 변경이 있다면 author chain은 새로 시작 (메모리 #27 lesson). Commander가 verbatim 승인하지 않은 변경분은 dispatch 본문에 별도 명시.

---

## §10. Open questions (Commander 결정 필요)

본 spec을 commit 전 Commander가 결정해야 할 사항:

1. **LRI raw value vs band display**: §4.2 표에서 LRI를 숫자(0.82)로 보일지 band(low/mid/high)로 보일지. 본 spec v1은 raw value, spec L194 "비공개" 엄격 해석 시 band 권장.

2. **Approver 자격 자동 검증 vs 명시적 권한 부여**: §3.2에서 `canApproveLeaderTrack`이 approver의 Certified 상태를 자동 확인. 그러나 향후 "Certified 아니어도 특정 admin은 승인 가능" 같은 권한 모델이 필요하면 별도 admin role table 필요.

3. **Audit trail 저장 위치**: §5.3에서 console+structured log만 명시. 향후 audit table 만들면 별도 migration. 본 spec v1 범위 결정 필요.

4. **승인 취소 (revoke leader track)**: 본 spec v1은 승인만, 취소 없음. 90일 재평가 fail 시 자동 박탈 (Certified)이 있지만 leader track 자체를 admin이 수동 취소하는 워크플로우는 별도 spec.

5. **다국어**: 현재 admin 페이지가 ko/en 지원. LRI/Certified 탭의 한국어 라벨 본 spec 기준이 정답인지 Commander 확인 필요.

---

## §11. Version history

| Version | Date | Author | Change |
|---|---|---|---|
| 0.1 DRAFT | 2026-05-23 | Claude (session) | Initial author-drafted spec |
| (pending) | TBD | Commander review | Verbatim approval or amendment |
| (pending) | TBD | Claude Code | Commit to docs/ |

---

*This file is the single source of truth for post-launch LRI/Certified admin lane. Implementation dispatches must reference this spec by version; any divergence requires explicit Commander re-confirmation.*
