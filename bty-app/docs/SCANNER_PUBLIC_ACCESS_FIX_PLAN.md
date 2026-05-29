# Scanner Public Access Fix — Lane Plan

**Status:** Locked v1 — Commander approved 2026-05-28
**Lane:** Scanner Public Access Fix (post-Client-QR-Render-Fix, pre-L4)
**Authored:** 2026-05-28 by Commander, dispatch by C3 (Claude)
**Executor:** Claude Code (VSCode), sole mutation runner
**Mode:** BTY Infra Mode (middleware) + boundary surface only

**Commander Decisions (verbatim):**
- Option 1 — middleware exception only (no dedicated route)
- Exception scope: all 3 conditions required (`/{locale}/my-page` + `arena_action_loop=commit` + `aalo` present)
- Test scope: middleware unit test + manual Probe 1-4 (no new integration infra)
- Out of scope: dedicated public route (not even post-launch backlog), qr/validate rewrite, MyPage RSC rewrite, aalo useEffect rewrite

**Authority:**
- Spec v2 §3.5 (mvp_open principle 5): "Scanner 식별: 누구나 (optional auth) / Self-scan: 기록+flag, hard block 없음" (docs/QR_VERIFICATION_ARCHITECTURE_V1.md L23, L38, L173-174, L188)
- STEP 0 inventory @ f359f434 (verified spec violation in middleware)
- DB-proven contracts: `dd3a3a99` (17-min login delay) + `4ed18b46` (fresh incognito, verified_at NULL = render≠commit working)
- L5+L6 (f214cdcc) + Client QR Render Fix (5a0174b4) + URL-hide (f359f434) — all CLOSED, preserved

**Core principle (Commander):**
> "BTY 핵심은 'Action → QR → Verification → Progression' 루프이고, QR 실행은 진행 제한을 닫는 핵심 게이트다. Binding spec상 클라이언트는 서버 snapshot을 렌더해야 하며, 의미 판정은 서버/DB 계층이 담당한다."

---

## 1. Goal

Restore spec intent: `mvp_open = ANYONE / optional auth` for external QR verifier scan, without opening general My Page access.

## 2. The Defect (STEP 0 evidence)

`middleware.ts` matcher includes `/{locale}/:path*` → fires on `/{locale}/my-page?arena_action_loop=commit&aalo=TOKEN`. `isPublicPath()` does NOT list my-page → auth check runs → unauthenticated scanner → redirect to `/bty/login?next=<aalo URL>`. Scanner without an account is permanently blocked.

All downstream layers (qr/validate route, MyPage RSC, MyPage layout, aalo useEffect) are already session-independent. The middleware is the SOLE auth gate — and it currently violates spec.

## 3. Patch Surface

**Single file:** `src/middleware.ts`

**Insertion point:** the public-bypass area at ~L224 (`isPublicPath → NextResponse.next()`), BEFORE the auth block (L242-282).

**Code (Commander-issued):**

```ts
const isAaloPublicScan =
  /^\/(en|ko)\/my-page$/.test(pathname) &&
  request.nextUrl.searchParams.get("arena_action_loop") === "commit" &&
  request.nextUrl.searchParams.has("aalo");

if (isAaloPublicScan) {
  return NextResponse.next();
}
```

Place BEFORE the `await supabase.auth.getUser()` block. After `isPublicPath` bypass, mirroring the same pattern.

**No other files touched:**
- ❌ qr/validate route (already token-only — STEP 0 confirmed)
- ❌ MyPage RSC (no server auth — STEP 0 confirmed)
- ❌ MyPage layout chain (no server auth)
- ❌ aalo useEffect (session-independent fetch)
- ❌ Any action contract API
- ❌ L5+L6 / Client QR Render Fix / URL-hide files

## 4. Sequencing

```
STEP 0 inventory — DONE (yields this plan)
STEP 1 — middleware patch (narrow exception, ~8 lines)
STEP 2 — unit test (5 assertions minimum)
STEP 3 — atomic commit + push + Commander deploy
STEP 4 — manual Probes 1-4
STEP 5 — ledger close
```

## 5. Tests (STEP 2)

Add or extend the relevant middleware unit test (5 existing test files cover consent, membership-gate, arena-matcher, etc. — use the most aligned one or add a new dedicated test).

**Minimum 5 assertions:**

1. `/{locale}/my-page?arena_action_loop=commit&aalo=TOKEN` (logged-out) → ALLOWED
2. `/{locale}/my-page` (logged-out, no params) → login wall (unchanged)
3. `/{locale}/my-page?aalo=TOKEN` without `arena_action_loop=commit` → login wall
4. `/{locale}/my-page?arena_action_loop=commit` without `aalo` → login wall
5. subpath `/{locale}/my-page/anything?arena_action_loop=commit&aalo=TOKEN` → login wall (path regex anchored)

**Gate (memory #13):**
```bash
pnpm vitest
pnpm tsc --noEmit
```

Both green required.

## 6. STEP 3 — Commit + Push + Deploy

Atomic single-file commit:
```
fix: allow public action loop QR commit scan
```

Inner + outer push (dual-tree, memory #9). Commander direct deploy (memory infra mode includes deploy workflows but this lane is small enough that deploy follows commit immediately).

## 7. STEP 4 — Manual Probes (post-deploy)

**Probe 1 — Public scan unblock (CLOSURE GATE):**
Logged-out phone (different device, fresh incognito if same device). QR scan → opens commit URL → NO login wall → MyPage RSC renders → aalo useEffect fires → qr/validate POST → verified_at SET within seconds. DB confirms.

Test contract: `38ce28d2-79e4-4de5-b554-c10404714d9f` (active test user). Run Arena → 3-of-axis → "complete by QR" → scan from logged-out device → check DB.

**Probe 2 — General My Page still gated (RELEASE SAFETY GATE):**
Logged-out browser navigates to `/{locale}/my-page` (no params) → login wall persists. Exception didn't open general access.

**Probe 3 — Invalid token defense in depth:**
Logged-out phone opens `/{locale}/my-page?arena_action_loop=commit&aalo=INVALID_TOKEN` → page loads (middleware bypass) → useEffect fires → qr/validate returns 401 → no DB change. Defense-in-depth proof (middleware allows, route rejects).

**Probe 4 — Logged-in user regression:**
Existing logged-in user navigates MyPage normally → all features work, no regression. (DRY refactor + URL-hide previously verified MyPage QR render still works.)

## 8. HALT Gates

Halt if:
- H1: middleware exception opens general My Page (test 2/3/4/5 fail)
- H2: qr/validate requires session after patch (should be 0 change to route)
- H3: aalo useEffect modified
- H4: tests require new integration infra (Invariant 6 — build no new infra)
- H5: tsc fails
- H6: vitest baseline regression
- H7: any file other than middleware.ts modified
- H8: L5+L6 / Client QR Render Fix / URL-hide files in diff
- H9: Probe 1 still hits login wall (fix incomplete)
- H10: Probe 2 lets unauthenticated user into general my-page (exception too wide)

## 9. Closure Criteria

- Single-file middleware patch (no other files in diff)
- Unit test added (5 assertions minimum, all green)
- vitest green
- tsc --noEmit green
- Probe 1+2 documented and GREEN (closure gates)
- Probe 3+4 confirmed (defense-in-depth + regression safety)
- No route/API/RSC behavior changes (server-side identity flow preserved)

## 10. Out of Scope

- ❌ Dedicated public route (Option 2) — NOT even in post-launch backlog (Commander)
- ❌ qr/validate rewrite (already correct)
- ❌ MyPage RSC rewrite (no server auth, correct)
- ❌ aalo useEffect rewrite (session-independent, correct)
- ❌ Action contract API changes
- ❌ L4 server self-scan hardening (sequential next lane)

## 11. Open Items (post-lane)

1. **MyPage shell briefly visible to logged-out scanner** (LogoutButton, tabs). Minor UX oddity, accepted by Commander as acceptable trade-off for launch-critical minimum fix. Post-launch observation may revisit (Option 2 candidate IF UX matters in practice).
2. **L4 server self-scan hardening** — sequential next lane after this lane closes.

## 12. Version History

| Date | Version | Change | Author |
|---|---|---|---|
| 2026-05-28 | **Locked v1** | Commander-issued plan. Option 1 single-file middleware exception, 3-condition narrow scope, 5-assertion test minimum + manual Probe 1-4. No new infra. Spec v2 §3.5 mvp_open principle 5 restoration. | Commander + C3 |
