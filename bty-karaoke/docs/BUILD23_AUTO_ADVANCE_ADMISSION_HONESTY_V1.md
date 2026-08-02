# BUILD 23 — AUTO-ADVANCE ADMISSION FAILURE HONESTY V1

**Status:** `PASS / CLOSED` (Founder-approved, 2026-08-02)
**Scope:** truthfulness of the finish → next auto-advance path. No migration, no RPC change, no
schema change, no production data mutation.
**Isolated project:** bty-karaoke Supabase (ref `zycwaqignioawtqynopj`).
**Predecessor:** BUILD 21, which fixed the same class of lie on the empty-stage `/dj/start` path only.

---

## 1. The defect this build closed

`promoteRequestToPlaying` always produced the full admission result, but `promoteNextReady`
narrowed it through a 5-member `PromoteOutcome`. `duration_unavailable` and `pass_insufficient`
fell into the catch-all → `blocked_not_ready` → `reason:'needs_ready'`.

BUILD 21 had covered `/dj/start` — the **first** song of an event. The finish/skip → next path,
which is **every song after the first**, was never covered:

- **Web** rendered `다음 준비된 참가자를 기다리는 중이에요.` — false. The next singer *had* pressed
  Ready; that is precisely why the server selected them.
- **Native was worse: completely silent.** `finishCurrentAndOpenNext` fell into
  `guard let next = playingSong … else { if !outcome.completed {…} }`; the current song *had*
  completed, so `outcome.completed` was true and the method took a bare `return`. Empty stage,
  Ready queue, zero explanation — and for `too_long` / `video_unavailable`, an unwinnable loop.

## 2. Canonical references

| Layer | Reference |
|---|---|
| Server | `52ef3e26` — `feat(karaoke): BUILD 23 — auto-advance admission failure honesty (server)` |
| Web | `c58a2c60` — `feat(karaoke): BUILD 23 — web DJ console auto-advance notice parity` |
| Native (product) | `becd6a6` — build **74** |
| Worker (deployed) | `d49c3835-49d2-4051-a68e-28c7876b8767` |
| Live build id | `GET /api/karaoke-build` → `c58a2c60e945` |
| Migration | **none** |

Gate harness (test-only; ships no product behaviour):

| Harness commit | Contents |
|---|---|
| `13355975` | GATE-R3 — isolated end-to-end G1 authority, no server bypass (`scripts/gate-b23-seed.mjs`, `docs/GATE_B23_END_TO_END_HARNESS.md`) |
| `efb95cb1` | GATE-R3.1 — device-run ergonomics for the G1 harness |
| `db126b55` | GATE-R5 — G2 `too_long` fixture (`npm run gate:b23:rearm:g2`) |
| `d35a67c8` | GATE-R6 — G3 `lookup_failed` fixture + re-arm ordering fix |
| `a05c217a` | GATE-R7 — G4 `quota_exceeded` fixture (`scripts/gate-b23-upstream-fault.mjs`) |
| native `a77f858` / `b1835b7` / `4264ee1` | GATE-R2 (build 75) observability · GATE-R3 (build 76) end-to-end seam + client-injection demotion · GATE-R4 (build 77) local-harness pairing entry |

## 3. Gate results — G1–G11 PASS

| Gate | Subject | Result |
|---|---|---|
| G1 | `pass_insufficient` end-to-end, real backdated ACTIVE Timed Pass | **PASS** |
| G2 | `too_long` — duration classified above the 900s bound | **PASS** |
| G3 | `lookup_failed` — genuine upstream transient, one retry | **PASS** |
| G4 | `quota_exceeded` — process-boundary upstream fault | **PASS** |
| G5–G7 | Founder device gates | **PASS** |
| G8 | **Web DJ Console parity — Safari** | **PASS** |
| G8 | **Web DJ Console parity — Chrome** | **PASS** |
| G9–G11 | Founder device gates | **PASS** |

G1–G4 and G8 are the gates whose fixtures are defined in this repository
(`docs/GATE_B23_END_TO_END_HARNESS.md`). **G5–G7 and G9–G11 were run and attested by the Founder;
their definitions are not recorded in this repository**, so this ledger records their verdicts
rather than restating criteria it cannot verify.

The client-side native injection (`-BTYAdmissionFailureInjection`) is **not** a G-gate. It returns
upstream of the network, so it can never establish a server contract; it is retained only as
client-render sub-gates **C1/C2/C3**, and `GateB23Validity` refuses to let its verdict string
contain "G1".

## 4. Production remained unchanged throughout

Every isolated fixture — G2, G3, G4 and G8 — ran against a **local** Supabase authority
(`127.0.0.1:54421` API / `54422` DB, project `bty-karaoke-gate-b23`, all real migrations applied)
with the real Worker code and no server debug bypass. Only the *data* differed from production.

The guarantees, each independently enforced:

- `scripts/gate-b23-seed.mjs` **refuses** the production ref `zycwaqignioawtqynopj` — **even with**
  `GATE_B23_ALLOW_REMOTE=1` — and refuses any non-local host without it.
- Every seeded row carries the `gate-b23` marker; `npm run gate:b23:clean` removes exactly those.
- Exporting **both** `KARAOKE_SUPABASE_URL` and `KARAOKE_SUPABASE_SERVICE_ROLE_KEY` before
  `next dev` makes `hydrateFromDevVars()` early-return, so `.dev.vars` — which points at production
  — is never read and no production credential enters the process.
- Native device runs reached the local authority through `-BTYAPIBaseURL`, a **Debug-only**
  override: `DebugAPIBaseOverride.resolved` is a compile-time `nil` in Release, so a shipped build
  can never be pointed anywhere.
- No deploy, no `wrangler`, no `cf:deploy`, no migration was applied to the linked project during
  gate work. `GET /api/karaoke-build` still reports `c58a2c60e945` — the BUILD 23 product deploy,
  unchanged.

**No production row was read, written, or deleted by any BUILD 23 fixture.**

## 5. Design decisions worth reusing

- **HTTP 200 and `completed:true` are frozen on a block.** The current song genuinely completed;
  a 4xx/5xx would make every shipped client treat a successful terminal transition as a total
  failure and re-fire the mutation. Mutants `200→503` and `completed→false` both kill.
- The server publishes **`blockedRequestId`**. A client cannot reliably derive which request the
  server chose to promote, and an 18B same-song repeat is a legitimately different request — so
  both notices key on that id and never on videoId / title / artist / position.
- `src/domain/admission-copy.ts` (pure) is the single wording source shared by `/dj/start` and
  `/dj/pass-turn`, together with the `publishAdmissionFields` allowlist. A route importing another
  route's private constants would make one endpoint's presentation an implicit dependency of
  another's; the allowlist is what makes field leakage a reviewable event rather than an accident.
- The web console's `resolvePassTurnDecision` / `clearBlockSupersededBy` are pure, so every branch
  is testable without rendering `DjConsole`. Nothing in the return type can represent a retry,
  removal, skip or reorder — a blocked song stays exactly where the server left it.
- **Pin an invariant at every layer that re-spreads it.** `passTurnAndPromote` re-spreads
  `durationFailureReason`, so pinning "never defaulted" only on `promoteNextReady` left a default
  free to be introduced one function later. That mutant survived until a pass-turn-layer test was
  added.

## 6. Verification baseline at closure

| | |
|---|---|
| Web unit tests | **197 files / 1983 passed**, `tsc --noEmit` clean |
| Native host tests | 1412 passed; guest 642 unchanged; Debug + Release SUCCEEDED |
| Mutation sweep | 10 mutants killed (widening removed, reason flattened at server/route/console, 200→503, completed→false, reason defaulted at both layers, notice keyed by videoId, reconciler clears every poll, another request's start clears the notice, identifier leakage) |

## 7. Frozen by this build (unchanged)

The 900s bound, BUILD 22 pre-queue admission, `karaoke_begin_song_v2`, lease math, entitlement
resolution, queue ordering, cancellation, `EVENT_ENDED`, FREE reset/expiry, Guest UI, and Timed
Pass purchasing.

## 8. Still open after BUILD 23

- The 900s `MAX_LEASE_SECONDS` bound is applied **before** any entitlement check at all three
  gates, so a PRO or 24-Hour-Pass Host cannot play a 16-minute song and a Guest cannot queue one in
  a PRO room. Deferred for a third consecutive build — it is a product/pricing decision for the
  Founder, not a defect fix.
- No in-product Timed Pass purchase path (BUILD 18C G1–G7).
- Duration-cache preheating.
