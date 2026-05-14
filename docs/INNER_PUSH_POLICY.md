# Inner Push Policy

**Authority:**
- [`docs/closures/HK8_OUTER_INNER_SYNC_POLICY_CLOSURE.md`](closures/HK8_OUTER_INNER_SYNC_POLICY_CLOSURE.md) outer commit `d45d4d8` (HK8 Option D acceptance + 5-clause policy framing).
- [`docs/INNER_PUSH_POLICY_PREFLIGHT_INVENTORY.md`](INNER_PUSH_POLICY_PREFLIGHT_INVENTORY.md) (this sprint's pre-flight measurements).
- Commander locked decisions this sprint: **Scope 1-B (disciplined coexistence)**, **inner branch name `inner-main`**.
**Status:** Active policy. Operationalizes HK8 Option D as a concrete push discipline.
**Date:** 2026-05-14.

---

## 1. Recognition clause

Inner repo (`bty-app/.git`) and origin/main (the outer-repo timeline on `git@github.com:dentistchi/bty-website.git`) are **independent codebases sharing one GitHub remote.** Their commit histories are **not expected to merge into a single unified timeline.**

Evidence (per pre-flight inventory):
- **No merge-base at any depth** (`git merge-base origin/main HEAD` empty; `--all` also empty).
- Inner root: `6934a7c3` *"initial commit"* 2026-04-29 14:08:19.
- Origin/main root: `076a060a` *"Change BTY to bty"* 2026-01-31 10:18:32. ~3 months apart, different repository identities.
- **71 inner-only commits** (all `+` on `git cherry origin/main HEAD` — 0 content-equivalent in origin/main).
- **530 origin-only commits** in a separate timeline.
- **Disjoint file trees**: all 5 HK8-leak paths under `src/...` have **0 commits in origin/main** touching them — origin/main does not have parallel history at these paths.

This is **HK8 Option D, now operationalized.** True history unification (Scope 1-A) is **deferred** to a post-deadline backlog item — not pursued by this policy.

---

## 2. Inner push targeting

### 2.1 Dedicated inner branch

Inner pushes **only** to branch **`inner-main`** on the shared remote.

```
origin = git@github.com:dentistchi/bty-website.git
├── main          ← outer's branch (origin/main). 530-commit timeline. NOT touched by inner.
└── inner-main    ← inner's branch. 71-commit timeline. Inner publishes here.
```

### 2.2 Forbidden push targets from inner

Inner MUST NOT push to:
- `origin/main` — outer's branch. Pushing inner to origin/main would either fast-forward over outer (overwriting 530 commits) or fail (disjoint roots). Either way forbidden.
- Any other branch shared with outer.

The literal forbidden command: `git push origin main` issued from `bty-app/` (inner working dir). **Use `git push origin inner-main` instead.**

### 2.3 inner-main branch lifecycle

- **Creation:** the `inner-main` branch does NOT yet exist as of this policy's authoring. Creation is a follow-up execution step (`git push origin inner-main` from inner pushes both the local branch + creates the remote tracking branch).
- **Updates:** after creation, inner publishes its 71 commits to `inner-main` once per push-gate cycle (§4).
- **Parallel to origin/main:** `inner-main` is permanent (not transient). Fetchable by outer via `git fetch origin inner-main:inner-main` (when outer needs to integrate inner's changes — see §5).

---

## 3. Push gate — 5-check (extends HK8 4-check)

Inner push to `inner-main` is permitted ONLY after all of the following:

| Gate | Method | Pass criterion |
|---|---|---|
| **(a)** Inner working tree clean | `git status --short` (in `bty-app/`) | Empty output. No untracked, no modified, no staged. |
| **(b)** Inner HEAD test-green | `npm test` in `bty-app/` | No NEW failures vs current baseline (17 pre-existing failures per project memory; **only new regressions block**). |
| **(c)** No HK6 canonical re-touch | `git diff HEAD -- src/lib/bty/identity/getMyPageIdentityState.ts` | Empty diff. The HK6 canonical file (carry-forward from HK8 clause 5) must not have unstaged changes. |
| **(d)** Inner-branch-only staging | The push command itself must be `git push origin inner-main` — explicit branch name | No `git push origin main`, no `git push` without explicit branch, no `git push --force`, no `--mirror`. |
| **(e)** Outer's last-known origin/main HEAD recorded | `git ls-remote origin main` + log the SHA to push log | Push log records the outer's main SHA at time of inner push for traceability. |

If any of (a)–(e) fails: **STOP and report.** Do not force-push or work around.

---

## 4. Leak integration pattern (the 5 current leaks, and future cohorts)

When outer needs to integrate inner's committed changes (the current 5 HK8 leaks; or future inner cohorts):

### 4.1 Sequence

1. **Outer fetches `inner-main`:**
   ```
   # from outer working dir
   git fetch origin inner-main:inner-main
   ```
   This brings inner's commits into outer's view as `refs/heads/inner-main`.

2. **Outer reviews the inner commits to integrate.** Per-leak: identify which inner commit(s) own the leak (recorded in HK8 closure §2):
   - leak #1 `computeLeadershipState.ts` → inner `99da02d2`
   - leak #2 `letterService.ts` → inner `cb7512fd`
   - leak #3 `getMyPageIdentityState.ts` → inner `4fc7df16`
   - leak #4 `layer2Semantic.ts` → inner `a1dc742a`
   - leak #5 `llm.ts` deletion → inner `a1dc742a` (atomic deletion)

3. **Cherry-pick onto outer's `main`:**
   ```
   git cherry-pick <inner-commit-sha>
   ```
   Or merge if the cohort is many commits and a merge commit is preferred (with `--allow-unrelated-histories` if needed — Commander decision per integration sprint).

4. **Conflict resolution:** because the file trees are disjoint, conflicts on cherry-pick are likely if outer has divergent content at the same paths. Resolve per change.

5. **4-check gate before the integration push** (per HK8 closure clause 5):
   - (a) outer/origin sync
   - (b) outer working tree contains expected integration changes only
   - (c) explicit-path staging
   - (d) no unintended file mutations

6. **Outer pushes integrated result to origin/main:**
   ```
   git push origin main
   ```

### 4.2 Note on actual 5-leak integration

The **actual 5-leak integration is a SEPARATE sprint.** Prerequisite: (i) this policy exists (✓ on this commit), (ii) `inner-main` branch is created on the remote (not yet — execution step), (iii) inner pushes its 71 commits to `inner-main` (so commits are fetchable). After those prerequisites, the leak-integration sprint runs §4.1 once per leak (or as a batched cohort).

This policy defines the pattern; it does not execute the integration.

---

## 5. Stash + WIP cluster policy

### 5.1 WIP naming discipline (going forward)

When inner work-in-progress is to be paused:

- **Preferred: commit with clear naming.** Use `git commit -m 'wip: <descriptive scope>'` with descriptive subject. Trackable in `git log`.
- **Acceptable: stash with descriptive message.** Use `git stash push -m '<descriptive scope>'` — NOT the auto-generated `WIP on main: <last commit>` form. The auto-form hides the scope and confuses future readers (as evidenced by the current 82-file stash — see §5.2).
- **Forbidden: stash without `-m`** — the auto-generated message references the parent commit, not the stash content. Future readers cannot infer scope.

### 5.2 Existing 82-file stash (Part 1 probe of this sprint)

A single stash exists at `stash@{0}`:
- Auto-message: *"WIP on main: aa5cd07 feat(AL-1.9-E-P1.1-A/D-sub1): extract fetchRecentServedScenarioIds helper (refactor axis)"*
- **Actual scope: 82 files, +2040 / -1749 lines** (far wider than the message suggests — see [`INNER_PUSH_POLICY_PREFLIGHT_INVENTORY.md`](INNER_PUSH_POLICY_PREFLIGHT_INVENTORY.md) §7).
- Sprint markers in the diff: `AL-1.9-E-P5-A`, `AL-1.9-E-P1`, `AL-1.9-D-R4` — **AL-1.9 sprint family WIP**, NOT C7/E3/F2/G5.
- Stage 2 Lobby blocking assessment: **does NOT block** — see §5.3.

**Disposition:** triage is a **separate Commander-decided step** (recommended next sprint: WIP triage). This policy does NOT execute disposition. Recommended option for Commander review: **commit the stash to a named safety branch** (e.g., `wip/stash-2026-05-12-al19-era-snapshot`), then drop the stash — preserves content immutably without active-stash drift risk.

### 5.3 C7 / E3 / F2 / G5 WIP clusters

HK8 closure §7 backlog #6 references "Inner WIP HOLD clusters: C7, E3, F2, G5" but **does not enumerate** the file scope.

- Pre-flight inventory search (this sprint): codenames NOT present in commit messages of inner branches or backup branches.
- The current 82-file stash does NOT contain C7/E3/F2/G5 in its diff content.
- **File-scope mapping remains UNKNOWN.** A separate WIP-triage probe is required if Commander wants this resolved.

This policy does NOT decide C7/E3/F2/G5 — defers to the WIP-triage probe.

---

## 6. Backup branch retention

Two inner backup branches exist (identical content, snapshots taken seconds apart on 2026-05-12):

| Branch | HEAD | Content |
|---|---|---|
| `backup/dep-clean1-local-39-commits-20260512-0956` | `e15c4b07` | 39 commits, snapshot 32 commits behind current inner main |
| `backup/local-39-commits-20260512-0957` | `e15c4b07` | identical to the above (0/0 diff) |

**Policy:** retain both as **immutable safety nets**. No cleanup schedule for now. If Commander later wants consolidation (delete one of the two identical labels) or a periodic retention/purge schedule, that is a separate cleanup decision.

---

## 7. Out-of-scope (deferred)

This policy explicitly does NOT cover:

| Item | Reason | Deferred to |
|---|---|---|
| True history normalization (Scope 1-A) | Per Commander lock: only 1-B (disciplined coexistence) in this sprint. 1-A is LARGE-scope. | Post-deadline backlog (future Commander direction). |
| Actual execution of 5-leak integration | This policy defines the pattern. Execution is its own sprint. | Separate leak-integration sprint, prerequisite = `inner-main` exists + inner has pushed to it. |
| C7/E3/F2/G5 cluster file-scope mapping | Codenames present in HK8 backlog but no enumeration; not found in current stash or branches. | Separate WIP-triage probe. |
| origin/main 530-commit timeline investigation | Origin/main represents outer's timeline (bty-website + bty-app docs); not blocking. | Commander awareness only. |
| Stash disposition (commit-and-name / drop / partial-apply) | Triage decision; recommendation in §5.2 but not executed here. | Commander-decided next turn. |
| `inner-main` branch creation execution | Policy defines it; creation is a follow-up push step from inner. | Inner-side execution (whenever Commander authorizes). |
| WIP-naming discipline retroactive enforcement | New discipline applies going forward; existing stash is grandfathered. | N/A (forward-only). |

---

## 8. Provenance footer

- **Sprint scope this commit:** policy doc + pre-flight inventory doc + 2 board-update rows (CURSOR_TASK_BOARD + CURRENT_TASK). All in outer `docs/`.
- **Mutation outside outer `docs/`:** none. No code touched. No inner mutation (no branch creation, no push). No outer/inner repo working-tree changes beyond what was already present (5 HK8 leaks preserved exactly).
- **HK8 invariants:** 5 outer leaks (4M + 1D) preserved per HK8 closure clause 4.
- **AL-2-D-P1 freeze:** `src/data/scenario/`, `src/lib/bty/runtime/`, `wrangler.toml` untouched.
- **4-check gate:** ran upfront before staging — see commit history for output.
- **Status:** Inner Push Policy active as of this commit. inner-main branch creation pending separate execution step.
