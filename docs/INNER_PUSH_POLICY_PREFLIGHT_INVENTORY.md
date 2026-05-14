# Inner Push Policy Sprint — Pre-flight Inventory

**Authority context:** [`docs/closures/HK8_OUTER_INNER_SYNC_POLICY_CLOSURE.md`](closures/HK8_OUTER_INNER_SYNC_POLICY_CLOSURE.md) (`d45d4d8`) §3 clauses 1-5, §7 backlog #2 + #6.
**Produced by:** Inner Push Policy Sprint, 2026-05-14.
**Status:** read-only inventory. Mutation count = 0 from probe activity. (This doc is committed alongside [`INNER_PUSH_POLICY.md`](INNER_PUSH_POLICY.md) in the same commit as the sprint deliverable.)

---

## AREA 1 — Disjoint topology measurement

| Measurement | Value |
|---|---|
| `git merge-base origin/main HEAD` | **empty** (no common ancestor) |
| `git merge-base --all origin/main HEAD` | **empty** (no merge bases at any depth) |
| Inner HEAD | `99da02d25e0ca6903eb6289c2cef3e3e12ca0a05` — *"fix(my-page): correct DEFAULT_CODE_NAME fallback STILLWATER -> QUIETFLAME"* (2026-05-12) |
| Origin/main HEAD (inner's last-fetch view, 2026-05-12 09:54) | `a66867341699b8e22b83effc97dc7b1071f757a8` — *"chore(gitignore): untrack bty-app/tsconfig.tsbuildinfo"* (2026-05-11) |
| Inner root commit | `6934a7c31e82011347ecd168db53951403730d4f` — *"initial commit"* (**2026-04-29 14:08:19**) |
| Origin/main root commit | `076a060afb87879a19732ef4aa7b38f6e3bd4e76` — *"Change BTY to bty"* (**2026-01-31 10:18:32**) |
| Ahead/behind | `530 / 71` (origin-only / inner-only) |

**Verdict:** Disjointness is **total** — two independent commit DAGs with different roots ~3 months apart. No hidden ancestor at any depth. "Shared remote, separate timelines" pattern HK8 §2 documents is structural.

---

## AREA 2 — The 71 inner-ahead commits

**Sprint-prefix grouping** (counts overlap — multiple prefixes per commit):

| Prefix family | Count |
|---|---|
| AL-* (AL-1.7 / AL-1.8 / AL-1.9 / AL-2 / AL-LAUNCH) | 26 |
| HK* (HK7) | 2 |
| feat: | 6 |
| fix: | 9 |
| refactor: | 2 |
| docs: | 1 |
| chore: | 4 |
| test: | 6 |

**Cherry-pick equivalence:** `git cherry origin/main HEAD` returns **all 71 with `+` prefix** — i.e., **none** of the 71 have content-equivalent commits in origin/main. They are genuinely inner-only.

**Critical subset (the 6 leak-producing commits):**
- `99da02d2` — HK9 C-β: `computeLeadershipState.ts` (leak #1)
- `a1dc742a` — HK7 4/4: `layer2Semantic.ts` + `llm.ts` deletion (leaks #4 + #5)
- `cb7512fd` — HK7 3/4: `letterService.ts` (leak #2)
- `b0f13eed` — HK7 2/4: mentor route migration
- `bcbfc6dc` — HK7 1/4: subject `...` (placeholder-message commit)
- `4fc7df16` — HK6: `getMyPageIdentityState.ts` (leak #3)

---

## AREA 3 — The 530 origin-ahead commits

| Measurement | Value |
|---|---|
| Count | 530 |
| Date range | 2026-01-31 → 2026-05-11 (~3.5 months) |
| Oldest | `076a060a` *"Change BTY to bty"* (root) |
| Newest | `a6686734` *"chore(gitignore): untrack bty-app/tsconfig.tsbuildinfo"* |

**File-touch test for the 5 HK8-leak paths:**

| Path | Commits in origin/main not in HEAD touching this path |
|---|---|
| `src/features/my-page/logic/computeLeadershipState.ts` | **0** |
| `src/lib/bty/center/letterService.ts` | **0** |
| `src/lib/bty/identity/getMyPageIdentityState.ts` | **0** |
| `src/lib/bty/validator/layer2Semantic.ts` | **0** |
| `src/lib/llm.ts` | **0** |

**All 0.** Origin/main does not have parallel history at any of the 5 leak paths. Inner and origin/main track disjoint file trees as well as disjoint commit trees.

---

## AREA 4 — Backup branches

| Branch | HEAD | vs origin/main | vs inner main | C7/E3/F2/G5 in commit messages |
|---|---|---|---|---|
| `backup/dep-clean1-local-39-commits-20260512-0956` | `e15c4b07` | `530 / 39` | `32 / 0` (32 behind inner main, 0 ahead) | none |
| `backup/local-39-commits-20260512-0957` | `e15c4b07` | `530 / 39` | `32 / 0` | none |

**Diff between the two backups:** `0 / 0` (identical content). Two snapshot labels on the same commit, seconds apart.

**Relationship to C7/E3/F2/G5:** no direct evidence. Backups appear to be a "dep-clean1" sprint safety capture.

---

## AREA 5 — 5 HK8 leaks + 1 stash position

### 5 leak files at inner

All 5 files are **CLEAN at inner HEAD** (committed in inner, not uncommitted WIP):

| Leak path | Last inner commit | Last origin/main commit |
|---|---|---|
| `src/features/my-page/logic/computeLeadershipState.ts` | `99da02d2` (HK9 C-β, 2026-05-12) | (none — origin/main has no history here) |
| `src/lib/bty/center/letterService.ts` | `cb7512fd` (HK7 3/4, 2026-05-12) | (none) |
| `src/lib/bty/identity/getMyPageIdentityState.ts` | `4fc7df16` (HK6, 2026-05-06) | (none) |
| `src/lib/bty/validator/layer2Semantic.ts` | `a1dc742a` (HK7 4/4, 2026-05-12) | (none) |
| `src/lib/llm.ts` (deleted) | `a1dc742a` (HK7 4/4 atomic deletion, 2026-05-12) | (none) |

The 5 outer-side "leaks" are 5 inner-committed changes that origin/main has no history for. They are NOT uncommitted working-tree changes.

### Stash — basic position (detail in §7)

- 1 stash: `stash@{0}` with auto-message *"WIP on main: aa5cd07 feat(AL-1.9-E-P1.1-A/D-sub1): extract fetchRecentServedScenarioIds helper"*.
- Stash parent: `aa5cd07` (commit #54 in the 71-ahead set).
- Actual scope: 82 files, +2040 / -1749 lines (far wider than message suggests).

---

## 6. SCOPE VERDICT

**For TRUE history normalization (Scope 1-A): LARGE.** Multi-sprint, high risk, requires Commander commitment to which timeline is canonical. **Per Commander lock: DEFERRED to post-deadline backlog.**

**For PUSH POLICY DEFINITION (Scope 1-B disciplined coexistence): MEDIUM.** One focused sprint can produce the discipline (push gate, branch targeting, leak-integration pattern, WIP discipline). **Per Commander lock: 1-B is the scope of this sprint. Output = [`INNER_PUSH_POLICY.md`](INNER_PUSH_POLICY.md).**

---

## 7. Part 1 Stash Probe — Detailed Findings

### 7.1 Full stash content size

- **7583 lines** in the full unified diff (`git stash show -p stash@{0}`).
- **82 files** changed (per `git stash show --name-status`).
- Line stats: **+2040 / -1749**.

### 7.2 File grouping by area (82 total)

| Area | Count |
|---|---|
| Config (`.env*`, `.eslintrc.json`, `package.json`) | 3 |
| Docs (`docs/ENVIRONMENT.md`) | 1 |
| E2E tests (`e2e/my-page.spec.ts`) | 1 |
| Avatar PNG assets (`public/avatars/.../thumbs/*.png`) | 15 (12 modified + 2 deleted + 1 misc per awk grouping) |
| Scenario JSON content (`public/data/scenario/core_NN_*/ko.json`) | 27 (full core_01–core_27 set) |
| Supabase (`supabase/.temp/cli-latest`) | 1 |
| API routes (`src/app/api/...`) | 9 |
| `app/bty-arena` (page.tsx, BtyArenaRunPageClient.tsx, hooks/useArenaSession.ts) | 3 |
| `app/bty` (login, layout) | 2 |
| `app/my-page` (progress/page.tsx) | 1 |
| `app/train` | 1 |
| `src/components` | 3 |
| `src/domain` (rules/stage.ts) | 1 |
| `src/engine` | 6 |
| `src/features` (my-page/logic/computeLeadershipState.ts) | 1 |
| `src/lib/bty` | 5 |
| `src/lib` (other; i18n.ts) | 1 |
| `src/middleware.ts` | 1 |
| **Total** | **82** |

### 7.3 C7 / E3 / F2 / G5 codename evidence

`grep -nE "\bC7\b|\bE3\b|\bF2\b|\bG5\b"` against the full 7583-line stash diff: **0 matches.**

The stash is **NOT** the C7/E3/F2/G5 cluster. C7/E3/F2/G5 file-scope remains **UNKNOWN** (consistent with prior probes; not present in branches, not present in this stash content).

### 7.4 Sprint marker evidence

Sprint markers found in the stash diff (selection from `grep -nE "AL-[12]\.[0-9]|HK[0-9]|sprint"`):
- `AL-1.9-E-P5-A` (append wiring tests, line 6609)
- `AL-1.9-E-P5-A.2` (cold-start backfill, line 7349)
- `AL-1.9-E-P1` (arena_runs query expansion, lines 6717, 6735, 6758, 7321)
- `AL-1.9-D-R4-H-B1/H-B2/H-B3` (server-side event-driven archetype trigger, evaluator throws, parity extension; lines 6678, 6825, 7425)
- `AL-1.9-D-R4-D-sub3-A2` (insertUserScenarioChoiceHistory, line 7307)

**Verdict:** the stash is **AL-1.9 sprint family WIP** — most likely accumulated WIP from sprints D-R4 → E-P1 → E-P5-A → E-P1.1-A around the parent commit `aa5cd07`. Not C7/E3/F2/G5.

### 7.5 Stage 2 Lobby file impact

#### `src/app/[locale]/bty-arena/page.tsx` (Lobby canonical)

Stash hunk (verbatim):

```diff
-import BtyArenaRunPageClient from "./BtyArenaRunPageClient";
+import ArenaEntryClient from "./ArenaEntryClient";

-/**
- * Canonical Arena route: `useArenaSession` + `POST /api/arena/run` + session router
- * (`/api/arena/session/next` when `ARENA_PIPELINE_DEFAULT=legacy`, `/api/arena/n/session` when `new`).
- */
-export default function BtyArenaPage() {
-  return <BtyArenaRunPageClient pipelineDefault="new" />;
+/** Arena landing: mode select (Full Arena 7-step / Quick Decision). */
+type Props = { params: Promise<{ locale: string }> };
+
+export default async function BtyArenaPage({ params }: Props) {
+  const { locale } = await params;
+  return <ArenaEntryClient locale={locale} />;
 }
```

**Status: SUPERSEDED.** This change (ArenaEntryClient wrapping) was already committed to inner main via commit `66af5946` *"feat(arena): wrap entry route with ArenaEntryClient mode-select"* (commit #6 in the 71-ahead set). The current `bty-arena/page.tsx` on disk already matches the `+` side of this hunk. Re-applying via `git stash pop` would be a no-op or a benign redundant change.

#### `src/app/[locale]/bty-arena/BtyArenaRunPageClient.tsx`

Stash hunk: adds a new `playUiSegment === "legacy_escalation"` rendering block (escalation text + acknowledge button) into the elite play UI segment.

**Status: REVERTED-WORK BACKUP.** This block corresponds to inner commit `fb9d700b` *"arena: elite escalation step intermediate UI (step 3 ESCALATION phase)"* (commit #20 in 71-ahead set), which was reverted by `a92e531f` *"Revert 'arena: elite escalation step intermediate UI'"* (commit #18, immediately before). Current inner main does NOT have this block. The stash captures the pre-revert state.

#### `src/app/[locale]/bty-arena/hooks/useArenaSession.ts`

Stash hunk: rewires the elite primary-choice flow — instead of immediately POST-ing step 3 then advancing to `FORCED_TRADEOFF` step 4, it shows an `ESCALATION` phase at step 3 (defers step 3 API call to `acknowledgeEscalation()`).

**Status: REVERTED-WORK BACKUP** (paired with the BtyArenaRunPageClient.tsx hunk above). Same revert chain `fb9d700b` → `a92e531f`.

### 7.6 Stage 2 Lobby blocking verdict

**Does the stash BLOCK Stage 2 Lobby?** **No.**

- The `page.tsx` change in the stash is **already on main** — irrelevant to Stage 2 Lobby (which will refactor page.tsx further).
- The `BtyArenaRunPageClient.tsx` and `useArenaSession.ts` changes in the stash are **elite-flow ESCALATION UI** — orthogonal to Lobby surface scope.
- Stage 2 Lobby work can proceed with the stash **held** (not popped, not dropped). No conflict expected during Stage 2 Lobby file edits.

**Risk if stash is popped during/after Stage 2 Lobby:**
- `page.tsx` re-application would conflict if Stage 2 changes page.tsx beyond the ArenaEntryClient pattern (Stage 2 likely will, e.g., separating entry/play). Manual conflict resolution would be needed.
- `BtyArenaRunPageClient.tsx` + `useArenaSession.ts` re-application would re-introduce the previously-reverted ESCALATION UI. Whether that's wanted is a separate question.

**Recommendation:** **HOLD the stash** for the duration of Stage 2 Lobby work. Triage as a separate post-Stage-2 step.

### 7.7 Recommended stash disposition (for Commander review later, NOT executed by this policy)

| Option | Action | Pros | Cons |
|---|---|---|---|
| **A** | Drop the stash | Removes drift risk; reverted-work is already in git history (`a92e531f` records the revert; `fb9d700b` is recoverable from history if needed) | Loses any genuinely novel WIP not captured in any commit (e.g., scenario JSON edits, avatar updates) |
| **B (recommended)** | Commit-and-name: save the stash to a named safety branch `wip/stash-2026-05-12-al19-era-snapshot`, then drop the active stash | Preserves content immutably; trackable by branch name; removes drift risk | Adds one more branch to inner's branch list |
| **C** | Hold indefinitely | No effort | Noise in stash list; future-pop risk grows with each new commit |
| **D** | Partial apply (cherry-pick specific files) | Surgical | Highest manual effort; not justified given most content is either superseded or reverted-work |

**This policy does NOT execute disposition.** Commander decides in a separate turn.

---

## 8. Open items carry-forward (Commander direction needed in follow-up turns)

1. **inner-main branch creation** — execution step (push from inner). Authority lives in [`INNER_PUSH_POLICY.md`](INNER_PUSH_POLICY.md); execution is a separate step.
2. **5-leak integration sprint** — separate sprint, prerequisite = inner-main exists + inner has pushed 71 commits.
3. **Stash disposition** (recommendation B above) — Commander decision.
4. **C7/E3/F2/G5 cluster file-scope** — separate WIP-triage probe needed; codenames remain undefined in available artifacts.
5. **origin/main 530-commit timeline** — Commander awareness only; not blocking.

---

## 9. Provenance footer

- Anthropic conversational memory: unchanged
- Hanbit harness memory: unchanged
- Outer repo: this doc + policy doc + 2 board updates committed in single commit (see commit subject + log)
- Outer working tree: 5 HK8 leaks preserved unchanged
- Inner repo: unchanged (read-only `git log`, `git stash show`, `git merge-base`, `git rev-list`, `git cherry`, `git diff` only)
- bty-app/: unchanged (no code touched)
- Stash: unchanged (1 stash, read-only inspection)
- AL-2-D-P1 freeze: untouched (`src/data/scenario/`, `src/lib/bty/runtime/`, `wrangler.toml`)
- Sandbox: n/a
- Mutation count this turn: 4 outer-docs writes (this doc + policy doc + CURSOR_TASK_BOARD row + CURRENT_TASK row), 1 commit. No code mutation.
- 4-check gate: ran upfront before staging — see commit-time output.
