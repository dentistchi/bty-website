# BUILD 26U-R4D-R1 — post-expiry re-entry · PASS / CLOSED

One pass ending does not spend the next one, does not strand the Host, and does not resurrect
itself. Proven deterministically. **Production behaviour delta: NONE.**

## Lifecycle (measured)

| instant | A status | A entitled | B status | B activated_at | C | ready |
|---|---|---|---|---|---|---|
| after A cutoff | ACTIVE (stale) | **false** | AVAILABLE | null | AVAILABLE | **2** |
| after B select | ACTIVE (stale) | false | SELECTED | **null** | AVAILABLE | 1 |
| after reopen | ACTIVE (stale) | false | SELECTED | null | AVAILABLE | 1 |
| Start New Room | **EXPIRED** | false | **ACTIVE** | `02:43:25.390034` | AVAILABLE | 1 |
| retry | EXPIRED | false | ACTIVE | unchanged | AVAILABLE | 1 |

## Audit chain

```
A ISSUED     ->AVAILABLE          02:43:21.955119
A SELECTED   AVAILABLE->SELECTED  02:43:22.580036
A ACTIVATED  SELECTED->ACTIVE     02:43:22.645418
A expires_at (logical cutoff)     01:43:22.646882
A EXPIRED    ACTIVE->EXPIRED      02:43:25.390034
B ISSUED     ->AVAILABLE          02:43:22.028925
B SELECTED   AVAILABLE->SELECTED  02:43:24.091359
B ACTIVATED  SELECTED->ACTIVE     02:43:25.390034
```

`B.SELECTED (02:43:24)` precedes `A.EXPIRED (02:43:25)` — legal, because selection does not
sweep. The boundary that matters holds: **A.EXPIRED ≤ B.ACTIVATED**, same transaction, which is
what keeps `timed_pass_one_active_per_account_idx` satisfiable.

`A.EXPIRED` is later than `A.expires_at` by design — lazy materialization (R4C), never extended
entitlement.

## B's clock is its own

`expires_at = activated_at + duration_seconds + carryover_seconds`, verified against stored
values; window exactly **3600s**; carryover **0**. Nothing from A enters it. A's own window is
still 3600s afterwards.

## Two measured findings

**1. The two paths do not share an advisory lock.**

```
select_/switch_timed_access_pass    hashtext('timed_pass:' || account)
karaoke_start_premium_room_session  hashtextextended('acct:' || account, 0)
```

R0 listed both locks without comparing their keys, and this harness first asserted that a
concurrent selection must BLOCK. It does not, and should not be expected to. Safety here is
**declarative**, not exclusionary: the partial unique indexes (one SELECTED, one ACTIVE, one
ACTIVATED-audit-per-grant) plus guarded conditional updates cannot be raced past. The test now
proves something stronger than blocking — connection 1 committed *inside* connection 2's open
transaction (88 ms vs 1977 ms of remaining hold), genuinely concurrent, and every illegal-state
negative still held.

**2. The audit log is immutable.** `timed_access_pass_audit_immutable()` refuses UPDATE outright.
The fixture therefore shifts the grant *window* only; audit timestamps stay true wall-clock. An
earlier draft tried to shift them, had the UPDATE silently refused behind `>/dev/null`, then
asserted an ordering across a mixture of shifted and unshifted values. Immutability is now
asserted rather than worked around.

## Negatives — all PASS

A's expiry selected nothing and activated nothing · stale A did not block selecting B · selection
did not start B's clock · A contributed zero carryover · A not selectable while stale-ACTIVE
(`not_selectable`) and not selectable once EXPIRED · A has exactly one ACTIVATED audit ever and
one EXPIRED audit · B exactly one of each · C byte-identical throughout with zero audit delta ·
account D byte-identical, audit count unchanged · one-ACTIVE and one-SELECTED indexes intact ·
no grant created or deleted · expiry created no Event, no room, no queue/QR/playback rows · retry
returned `already_live` and duplicated nothing · concurrency produced no illegal state.

## Regression

R4C harness re-run: **0 failures**. Web 274 files / 3438 tests, lint clean. R4D harness: **96
PASS, 0 failures**.

## Founder device retest — NOT REQUIRED

No executable production code changed; My Norebang behaviour is unchanged; the R4B device
observation remains applicable. No new build was minted for this proof.
