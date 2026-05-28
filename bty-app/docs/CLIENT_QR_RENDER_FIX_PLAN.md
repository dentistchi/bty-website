# Client QR Render Fix — Lane Plan

**Status:** Locked v1.1 — Commander approved 2026-05-28 (v1 amendment: §3.2 props + H4 refinement)

**Commander lock statement (verbatim):**
> Approved:
> - Shared ActionLoopQrPanel
> - Staged STEP 1A→1B→1C→1D
> - Tier-specific copy deferred
> - qr-debug-value retained for STEP 1
> - L4 self-scan enforcement remains sequential next lane
> - f214cdcc preserved; no rollback
>
> Core principle: BTY는 "선택"이 아니라 "행동 완료"로 닫히는 시스템이고, QR은 진행 제한의 실행 게이트다.
**Lane:** Client QR Render Fix (new lane, post-L5+L6, pre-L4)
**Authored:** 2026-05-28 by C3 (Claude), non-mutating dispatch author
**Executor:** Claude Code (VSCode), sole mutation runner
**Mode:** BTY Product Mode

**Authority:**
- Spec v2 §3.5 progression model (QR = sole gate, external witness required)
- L5+L6 ledger close (outer 5dfaab2a / inner f214cdcc) — open item: client self-completion path
- STEP 0 inventory @ f214cdcc (this plan's basis)

**Commander decisions baked in (2026-05-28):**
- (A) Single Component with shared `<ActionLoopQrPanel>` extracted
- (b) "Client QR Render Fix" naming (separate from recovery plan L1-L9)
- (I) Sequential — L4 follows after this lane closes
- Forward fix only — f214cdcc preserved, NO rollback
- Self-scan enforcement = L4 (server authority); this lane = client render only
- Core principle: "L5+L6는 rollback 금지. Server auto-approve는 닫혔다. 이제 client self-completion을 닫아야 한다."

---

## 1. Lane Overview

### 1.1 What this lane does
Brings the client into spec v2 §3.5 alignment by making "external-witness QR" a UI
system invariant: every surface that awaits QR verification renders a QR for an
external device to scan, instead of self-navigating the actor's own browser into the
commit deep-link.

### 1.2 The defect (STEP 0 evidence)
- `useArenaSession.ts:2122 — window.location.assign(json.url)` self-navigates the
  actor's own browser to the commit URL.
- `MyPageLeadershipConsole.tsx:225-274` useEffect auto-POSTs the aalo token to
  qr/validate on mount with no actor/witness distinction.
- Combined effect: actor clicks "complete by QR" → own browser opens commit deep-link →
  auto-commit → `verified_at` set → "Execution recorded" — with NO QR ever rendered.

This is a pre-existing path that auto-approve had masked (token mint returned 409
terminal pre-L5+L6). L5+L6 server fix correctly unmasked it for forward fix.

### 1.3 The pattern — system invariant via shared component
Component 5 made "QR scan = sole gate" a SERVER invariant by routing GET + POST through
the same `snapshotForBlockedContract` helper. This lane makes "QR rendered for external
witness" a UI invariant by routing both awaiting_qr surfaces (Arena resolve, My Page)
through one shared `<ActionLoopQrPanel>` render component.

### 1.4 What's NOT in scope
- ❌ L4 server-side self-scan enforcement (Tier-aware qr/validate hardening) — sequential, next lane after this closes
- ❌ Rollback f214cdcc (forbidden — L5+L6 server fix preserved)
- ❌ verification_confidence write @ scan — L4 scope
- ❌ aalo deep-link useEffect modification beyond what's required to support shared component
  (the witness path stays — actor's browser hitting the deep-link is the L4 problem)
- ❌ Removing the selectable `<pre data-testid="qr-debug-value">` URL (minor self-vector, manual not auto;
  consider in STEP 1 only if it doesn't add scope)

---

## 2. Sequencing

```
L5+L6 (CLOSED — server invariant)
  └─→ THIS LANE: Client QR Render Fix
        ├─ STEP 0 inventory — DONE
        ├─ STEP 1 — shared <ActionLoopQrPanel> + consumer migration
        ├─ STEP 2 — tests
        └─ STEP 3 — atomic commit + Commander deploy + probes
              └─→ L4 (Tier-aware self-scan server hardening + verification_confidence write)
```

---

## 3. Component — Shared `<ActionLoopQrPanel>` + Consumer Migration

### 3.1 Files involved
| Role | File | Change |
|---|---|---|
| NEW shared component | `<ActionLoopQrPanel>` (path TBD STEP 1 — likely `src/components/arena/` or `src/components/qr/`) | CREATE (extract from MyPage L445-468) |
| Producer (Arena resolve) | `src/lib/bty/arena/useArenaSession.ts:2075-2129` (startPendingContractQrFlow) | replace self-navigate with render-state expose |
| Consumer A (Arena gate button) | `src/components/.../ArenaPendingContractGate.tsx:100-113` | button surfaces shared QR panel |
| Consumer A (Arena resolve client) | `src/components/.../ArenaResolveClient.tsx:213` | wire shared QR panel into resolve surface |
| Consumer B (MyPage refactor) | `MyPageLeadershipConsole.tsx:276-318,445-468` | consume shared component instead of inline QRCodeSVG |

(Exact component path + line refs verified in STEP 1 PART A. Allow drift report; minimal-change principle.)

### 3.2 Shared component spec — `<ActionLoopQrPanel>`

Props (amended v1.1, Commander 2026-05-28 H4 catch):
```typescript
type ActionLoopQrPanelProps = {
  url: string;            // commit deep-link URL (the QR payload)
  onDismiss: () => void;  // panel close handler
  locale: string;         // i18n parameter for source parity (getMessages(locale).actionContract.dismiss)
};
```

**locale rationale (v1.1):** STEP 1A H4 catch revealed the source MyPage dismiss button
renders `getMessages(loc).actionContract.dismiss` ("닫기"/"Close"). Faithful extraction
(plan §3.6 verbatim render parity) requires preserving that i18n binding. `locale` is
NOT business/state coupling — it is a pure i18n parameter, sibling arena components
universally take `locale`. Replacing the localized dismiss with `×` icon would be
redesign, not extraction, and would break visual+i18n parity. The original §3.2 prop
cap missed this because STEP 0 inventory captured render structure but not the i18n
binding. v1.1 amendment restores extraction faithfulness.

Render (extracted verbatim from MyPage L445-468):
- `<QRCodeSVG value={url} size={200} />` (from `qrcode.react ^4.2.0`)
- `<pre data-testid="qr-debug-value">{url}</pre>` — keep for testability (do not remove without separate scope decision; see §1.4)
- Dismiss button (existing pattern from MyPage)

★ NO copy-link button (existing MyPage doesn't have one; adding = scope creep).
★ NO auto-POST. NO useEffect that fires qr/validate. Pure render.

### 3.3 Producer migration — `startPendingContractQrFlow`

Current (useArenaSession.ts:2075-2129):
```typescript
// L2087  mint token
// L2101  if 409 → terminal
// L2122  window.location.assign(json.url)  ← VIOLATION
```

New:
```typescript
// L2087  mint token (unchanged)
// L2101  if 409 → terminal (unchanged — terminal contracts still 409)
// L2122  REPLACE: expose URL to QR-render state
//        setPendingContractQrUrl(json.url)   // NEW state in useArenaSession
//        setPendingContractQrOpen(true)      // NEW state, panel open
```

Add to `useArenaSession` hook return (~L2484): `pendingContractQrUrl`, `pendingContractQrOpen`, `setPendingContractQrOpen` (for dismiss).

NO `window.location.assign`. NO `router.push`. The button click renders, does not navigate.

### 3.4 Consumer A — Arena resolve surface

ArenaPendingContractGate.tsx:100-113 button (`data-testid="arena-pending-contract-complete-by-qr"`):
- onClick still calls `onCompleteByQr()` → `startPendingContractQrFlow` → mints + sets state
- Adjacent (or modal) render: `<ActionLoopQrPanel url={pendingContractQrUrl} onDismiss={...} locale={locale} />`
  conditionally rendered when `pendingContractQrOpen === true`. (v1.1: pass locale — Arena resolve surface already receives locale per route convention.)

ArenaResolveClient.tsx:213: wire the new state through (mirroring how MyPage wires
qrUrl/qrPanelOpen). Pass to ArenaPendingContractGate as props if that's the existing
convention.

### 3.5 Consumer B — MyPage refactor (DRY)

MyPageLeadershipConsole.tsx:
- Replace inline `QRCodeSVG` block (L445-468) with `<ActionLoopQrPanel url={qrUrl} onDismiss={() => setQrPanelOpen(false)} locale={loc} />` (v1.1: pass loc — already in scope at MyPage via getMessages call site)
- handleRequestQr (L276-318) UNCHANGED — it already does mint + setQrUrl + setQrPanelOpen
- aalo auto-commit useEffect (L225-274) UNCHANGED — that's the witness path (separate from QR render); L4 handles self-scan enforcement

### 3.6 Constraints (Commander minimal-change)
- L5+L6 (f214cdcc) untouched
- aalo useEffect untouched (L4 scope)
- qr/validate route untouched (L4 scope)
- NO client self-scan guard (defense-in-depth optional, deferred to L4 for authority unity)
- Shared component is the ONLY new file; consumer changes are minimal surface

### 3.7 Why shared, not inline-on-Arena (per Commander A)
Inline replication on Arena (no extraction) leaves two QR render paths. If one drifts
(props, payload semantics, render details), invariant breaks. One shared component =
one render contract = UI invariant structurally guaranteed. This mirrors C5's "one
shared blocking helper" for server invariant.

---

## 4. STEP Plan (lock cycle)

```
STEP 0  inventory — DONE (this plan is its output)
STEP 1A Component extraction — create <ActionLoopQrPanel>
STEP 1B Producer migration — useArenaSession startPendingContractQrFlow → render state
STEP 1C Consumer A wiring — Arena resolve surface renders shared panel
STEP 1D Consumer B refactor — MyPage consumes shared component (DRY)
        (1A→1B→1C→1D may be 1 combined dispatch or sub-staged at Commander preference)
STEP 2  tests — add render+no-navigate+no-auto-POST tests; verify existing tests
STEP 3  atomic commit + Commander deploy + probes (★ visible QR + actor cannot self-commit)
STEP 4  ledger close (open item resolved)
```

Each STEP = separate dispatch, Commander approval between.

---

## 5. STEP 2 — Test Impact

### 5.1 Existing tests (review, not rewrite unless asserting old behavior)
- `BtyArenaRunPageClient.snapshot-gates.test.tsx:186` ("starts QR flow from ACTION_SUBMITTED gate") — asserts onQr spy called. Button→callback wiring unchanged → test STAYS VALID.
- `MyPageLeadershipConsole.test.tsx` — covers handleRequestQr + qrPanelOpen + QRCodeSVG + aalo useEffect (witness auto-commit). After Consumer B refactor, asserts on rendered output stay valid (QR still rendered). Verify no test asserts INLINE QRCodeSVG component specifically — if so, update to shared component.
- STEP 0: no test enshrines `window.location.assign` (startPendingContractQrFlow is always mocked).

### 5.2 New tests required
- **Actor click → render, no navigation:** ArenaPendingContractGate button click triggers `startPendingContractQrFlow` → `<ActionLoopQrPanel>` rendered (QRCodeSVG visible) → window.location.assign NOT called → qr/validate NOT POSTed
- **Shared component contract:** `<ActionLoopQrPanel url={...} onDismiss={...} />` renders QRCodeSVG with provided URL, shows debug pre, dismiss button calls onDismiss
- **Arena resolve QR visibility:** in ACTION_SUBMITTED state, after clicking "complete by QR", QR panel mounts (data-testid query)
- **MyPage continuity (regression guard):** MyPage handleRequestQr still triggers QR render via shared component

### 5.3 Gate (memory #13)
- vitest all pass
- tsc --noEmit exit 0
- (eslint ajv crash = pre-existing backlog, not gate)

---

## 6. STEP 3 — Deploy + Probes (★ Commander's "QR 안보임" direct resolution)

Atomic commit (Component + Consumer A + Consumer B + tests). Push inner+outer (memory #9).
Commander-direct worker deploy (§5.3, same pattern as L2+L6 + L5+L6).

### 6.1 Probes

★ **Probe 1 — actor sees QR (THE regression fix proof):**
Test user (`38ce28d2`) runs Arena → 3-of-axis → contract creates → submit-validation
→ Arena resolve surface shows ACTION_SUBMITTED. Click "complete by QR" button.
**Expected:** QR image (QRCodeSVG) renders on screen. NO browser navigation. URL still
`/bty-arena/...` (NOT redirected to `/my-page?arena_action_loop=commit&aalo=...`).
This is the direct resolution of Commander's "QR 안보임."

★ **Probe 2 — verified_at stays NULL until external scan:**
Immediately after Probe 1 (QR visible), query:
```sql
SELECT status, verified_at, validation_approved_at FROM bty_action_contracts
WHERE id='<contract>';
```
Expected: status='submitted', verified_at NULL, validation_approved_at SET.
QR rendered does NOT trigger auto-commit. Progression still gated by an actual scan.

★ **Probe 3 — external scan completes the loop:**
Have a DIFFERENT device (or DIFFERENT user account if available) scan the rendered QR
→ opens commit deep-link on that device → My Page useEffect auto-POSTs → qr/validate
sets verified_at. Confirm progression unlocks for the actor.
(Note: with current self-scan tolerance — spec principle 5, L4-pending — the actor
opening the URL on their own browser would still commit. The fix here is that the
default UI flow no longer self-navigates; manual self-scan path remains until L4.)

**Probe 4 — MyPage regression:**
On My Page (existing handleRequestQr flow), trigger QR render. Confirm
`<ActionLoopQrPanel>` (shared) renders correctly (DRY refactor didn't break MyPage).

**Probe 5 — no auto-POST on QR render:**
Network tab during Probe 1: no POST to `/api/arena/leadership-engine/qr/validate`
fires until an external scan happens. Confirms render ≠ commit.

### 6.2 Rollback boundary
- Probe 1 fail (no QR visible, still navigates) → HALT, debug
- Probe 5 fail (auto-POST fires on render) → HALT (render contaminated)
- Probe 4 fail (MyPage broken by DRY) → HALT (refactor regressed existing path)
- Rollback target if catastrophic: revert lane commit; f214cdcc remains live (L5+L6 unaffected)

---

## 7. HALT Gates

| Gate | Condition | Action |
|---|---|---|
| H1 | STEP 0 file/line refs differ | HALT, report |
| H2 | startPendingContractQrFlow modified beyond render-state swap | HALT |
| H3 | tsc error | HALT |
| H4 | Shared component extraction introduces business/state coupling or non-render-parity props beyond minimum (pure render/i18n params required for source parity, such as `locale`, are allowed — v1.1 refinement) | HALT |
| H5 | aalo useEffect modified | HALT (L4 scope) |
| H6 | qr/validate route touched | HALT (L4 scope) |
| H7 | window.location.assign still present in startPendingContractQrFlow | HALT (fix incomplete) |
| H8 | Test baseline regression | HALT |
| H9 | L5+L6 files (submit-validation, binding builder) touched | HALT (f214cdcc preserved) |
| H10 | Probe 1 still navigates (no QR visible) | HALT (fix incomplete) |
| H11 | Probe 5 auto-POST fires on render | HALT (render contaminated) |
| H12 | Inner push to origin/main | HALT (memory #9) |

---

## 8. Open Items for Commander (none blocking lock)

1. **Shared component path** — `src/components/arena/ActionLoopQrPanel.tsx` vs `src/components/qr/ActionLoopQrPanel.tsx`. STEP 1A decision; codebase convention guides.
2. **Tier-specific copy in `<ActionLoopQrPanel>`** — optional label "Have anyone scan" (mvp_open) vs "Have a btyARENA user scan" (member_only). Defer if not in MVP scope; lane keeps render-pure.
3. **`<pre data-testid="qr-debug-value">` selectable URL** — minor manual self-vector. Keep for STEP 1 (test continuity); revisit in L4 or later.
4. **Sub-staging of STEP 1** — 1A→1B→1C→1D as one combined dispatch (L2+L6 pattern) or staged (L5+L6 pattern). Commander preference.

---

## 9. Version History

| Date | Version | Change | Author |
|---|---|---|---|
| 2026-05-28 | Draft v0.1 | STEP 0 inventory → lane plan. Single shared component (A), separate lane (b), L4 sequential (I). Open items deferred to lock review. | C3 (Claude) |
| 2026-05-28 | **Locked v1** | Commander approved: shared ActionLoopQrPanel, STEP 1 staged 1A→1B→1C→1D, tier copy deferred, qr-debug-value retained for STEP 1, L4 sequential, f214cdcc preserved. Core principle: "BTY는 '선택'이 아니라 '행동 완료'로 닫히는 시스템이고, QR은 진행 제한의 실행 게이트다." | C3 + Commander |
| 2026-05-28 | **Locked v1.1** | STEP 1A H4 catch (correct halt): MyPage dismiss uses `getMessages(loc).actionContract.dismiss` ("닫기"/"Close"). Faithful extraction needs locale. §3.2 props amended to (url, onDismiss, locale). §3.4/§3.5 consumer call sites updated. H4 refined: pure render/i18n params required for source parity (e.g. locale) are allowed; business/state coupling stays banned. Commander principle: "UI는 서버 의미를 만들지 않고 snapshot을 렌더해야 하며, JSON/표현 계층과 판단 계층은 분리되어야 한다." locale is presentation-layer parity. | C3 + Commander |
