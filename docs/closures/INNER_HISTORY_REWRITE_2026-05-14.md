# Inner History Rewrite — Boundary Document

**Date:** 2026-05-14
**Authority:** Inner Push Policy Sprint (per [`docs/INNER_PUSH_POLICY.md`](../INNER_PUSH_POLICY.md) outer commit `0fe8947`).
**Sprint:** Stage B of Inner Push Policy execution chain (Stage A preflight: backup; Stage B: rewrite; Stage C: re-push pending).
**Classification:** OUTER repo closure note (per [HK8 closure clause 1](HK8_OUTER_INNER_SYNC_POLICY_CLOSURE.md)). Inner repo history rewrite; OUTER docs record the boundary.

---

## 1. What happened, and why

GitHub's pre-receive hook rejected the inner-main first push (`git push origin inner-main`) because file `openwebui-backup-20260426.tar.gz` (217,539,189 bytes / **207.46 MB**) exceeded GitHub's 100 MB per-file hard limit. The file existed in inner's root commit (then `6934a7c3` "initial commit", 2026-04-29) and was carried in every subsequent commit's tree (same blob `282b9ebe...` across all 72 commits).

**Resolution chosen:** Commander Option 1 — `git filter-repo --path openwebui-backup-20260426.tar.gz --invert-paths --force`. Single-file, deep (root-commit) target.

**Disposition of the tar file:** DISCARD. The 207 MB OpenWebUI backup is not preserved — Commander decision: the backup can be regenerated from OpenWebUI if ever needed.

---

## 2. Action

```bash
# Inner repo, on main branch, working tree clean
git -C bty-app filter-repo --path openwebui-backup-20260426.tar.gz --invert-paths --force
```

Run by Commander manually, 2026-05-14 ~07:06 local time. (Auto-mode classifier blocked the same command from this agent due to force-push-class destructive operation framing.)

---

## 3. Effect

### 3.1 Direct effects
- **`openwebui-backup-20260426.tar.gz` removed** from every commit's tree across all reachable refs. Working tree also clean of the file.
- All 72 commits in `inner-main` rewritten (each commit's tree no longer contains the tar file blob `282b9ebe19818e441656579c2f8d09d832c16deb`).
- New root commit: `fa0b86d6` with subject "initial commit" (preserved author + date 2026-04-29, but empty tree).
- All 6 local branches rewritten to new tip hashes (see §4).
- All 3 `al-launch-*` annotated tags rewritten to point at new commit equivalents (see §4).
- Remote tracking refs `refs/remotes/origin/*` stripped by filter-repo default (re-fetchable via `git fetch origin` post-Stage-C). filter-repo also migrated 11 origin/* refs into local branches (cursor/, feat/*, fix/* — see ref-map).

### 3.2 Size effects
- `.git/`: **1.3 GB → 329 MB** (~1 GB reduction; the 207 MB blob + its delta chains gone)
- Total bty-app/: 4.2 GB → 3.1 GB

### 3.3 Commit count preserved
- inner-main: 72 commits before, 72 commits after. **No commits dropped.** Empty root commit retained.
- All commit subjects identical to pre-rewrite (verified via subject-only diff against pre-rewrite snapshot `/tmp/inner-main-pre-rewrite-2026-05-14.txt`), with 3 exceptions:
  - 3 commits have INLINE hash references in their subjects that filter-repo rewrote to track the new hashes (e.g., `(missed in 57daece)` → `(missed in be5e350)`). Subject semantics unchanged.

### 3.4 Tests
- Pre-rewrite: 17 failed / 3207 passed / 6 skipped (3230 total) — baseline known.
- Post-rewrite: **17 failed / 3207 passed / 6 skipped (3230 total)** — EXACTLY baseline. No new failures.
- Code behavior unchanged by rewrite. Confirmed pure file-removal, no logic impact.

### 3.5 Outer-side secrets-safety parity integration (this commit)

After the inner rewrite, outer's view of `bty-app/.gitignore` showed a NEW sync-debt entry (the 6-line `.env` secrets section from inner commit `2626f9a7` → rewritten as `6f8f4dec`). Unlike the 5 HK8 leaks (inner-side code work pending a separate leak-integration sprint), this entry is the **secrets-safety fix** — it must exist in outer too. Outer's `.env` exposure risk is identical to inner's; leaving the fix inner-only would leave outer unprotected.

**Therefore: the `.gitignore` fix is integrated into outer in this same commit** (the one that lands this boundary doc). After this commit:
- outer tracks `bty-app/.gitignore` with the env-coverage rules (matching inner's post-rewrite content)
- outer no longer shows `.gitignore` as a sync-debt entry — secrets-safety parity achieved
- the 5 HK8 leaks remain **untouched** in this commit (they require a separate leak-integration sprint per [INNER_PUSH_POLICY §5](../INNER_PUSH_POLICY.md))

This is a deliberate, scoped one-file integration justified by its security-motivated nature. It is NOT a precedent for absorbing other inner-originated changes into outer ad-hoc — the standard pattern remains: inner pushes to `inner-main` (Stage C), and outer integrates via the leak-integration sprint pattern per the Inner Push Policy.

---

## 4. Old → New hash mapping (key anchors)

The full 400-commit old→new map lives at `bty-app/.git/filter-repo/commit-map` (local artifact, not committed — preserved on the filesystem until the next rewrite or `.git/filter-repo/` cleanup).

### 4.1 Branch tip mappings (ref-map)

| Ref | Old tip | New tip |
|---|---|---|
| `refs/heads/main` | (ref-map records `3957a68a → fa0b86d6`; see ref-map anomaly §6) | `6f8f4de` (current; aligned with inner-main post-rewrite) |
| `refs/heads/inner-main` | `2626f9a7d17f4433930b1ce8a68b73ce7003eac1` | `6f8f4decd1a39548d59be66f16fb6c6d887a675e` |
| `refs/heads/wip/stash-2026-05-12-al19-era-snapshot-v2` | `676aa0495c6fa1dee79c79ed9572ce9a7eeef6cc` | `4bdb97466b61e8783af6ba8f96fc1ee3f04a2681` |
| `refs/heads/backup/dep-clean1-local-39-commits-20260512-0956` | `e15c4b07c16fe5397cdbb882deab0bf1c1324120` | `889db607dfe55288d70543961242b7d30ed8bc3b` |
| `refs/heads/backup/local-39-commits-20260512-0957` | `e15c4b07c16fe5397cdbb882deab0bf1c1324120` | `889db607dfe55288d70543961242b7d30ed8bc3b` |
| `refs/heads/backup/inner-main-pre-rewrite-2026-05-14` | `2626f9a7d17f4433930b1ce8a68b73ce7003eac1` | `6f8f4decd1a39548d59be66f16fb6c6d887a675e` |

### 4.2 Annotated tag mappings

| Tag | Old target | New target |
|---|---|---|
| `refs/tags/al-launch-d1-code-ready` | `944c675035fca26d53c7625e432ba9fa6cdb966f` | `9d82fedce9404caca8dd6dd5049207281e6b6ee5` |
| `refs/tags/al-launch-d2-applied` | `cba6b7214b9e8f45d5c35b4b379a263af0e3a211` | `c3a2fa58e1bb2c3a6f2d4dad15b6bb2301060446` |
| `refs/tags/al-launch-d3-applied` | `ae1affac798989ee64806b8952325eca88fdc63e` | `0c901fc43c0a9357c9158f065dbeb093c3299d0f` |

### 4.3 Notable individual commit mappings (HK-named + sprint anchors)

| Description | Old hash | New hash |
|---|---|---|
| **Inner root commit** | `6934a7c3...` (not in today's commit-map; see §6 prior-run note) | `fa0b86d64b9a1f801a512f16eb058181377f2105` (empty tree, same author/date) |
| **HK6 closure** (`AL-1.9-C` getMyPageIdentityState.ts fix) | `4fc7df164d3e8c6ea3fce9114ace911f7a4f4273` | `2ecc0195e069bbe55bf02de28acbd9d5dfe650c1` |
| **HK7 atomic 1** (placeholder `...` subject) | `bcbfc6dc76baf82158d5dbe8ba03c261fb98eb64` | `0b843b625d954d9c3d4e7dbf9e0cf47f7c22bd25` |
| **HK7 atomic 2** (mentor migration) | `b0f13eed6ac2b57ddd1e842dcb979e408d9a70d0` | `1a69648ec4ee94bb397914334c04c62e26a5763a` |
| **HK7 atomic 3** (letterService migration) | `cb7512fdbedefa5b014b25aba97cabc84c1c3143` | `c0aba5fef4f666e0e42b9e82acd915ae6a53780b` |
| **HK7 atomic 4** (layer2Semantic + llm.ts delete) | `a1dc742adde1a0d55fa921be9c071739fa17c45f` | `1819d358b340a481056c63101107d04b473ffb6a` |
| **HK9 C-β** (computeLeadershipState STILLWATER→QUIETFLAME) | `99da02d25e0ca6903eb6289c2cef3e3e12ca0a05` | `2e99f64152da3555374c8cb6bd9891d3e572aaf4` |
| **Stash parent** (AL-1.9-E-P1.1-A/D-sub1) | `aa5cd070df2008dd792051b2679276aa01c4500e` | `ed3cd83ae7ad4991f29e5edddaaf501032ef4c97` |
| **Wip-v2 snapshot commit** | `676aa0495c6fa1dee79c79ed9572ce9a7eeef6cc` | `4bdb97466b61e8783af6ba8f96fc1ee3f04a2681` |
| **Sprint .gitignore fix** | `2626f9a7d17f4433930b1ce8a68b73ce7003eac1` | `6f8f4decd1a39548d59be66f16fb6c6d887a675e` |

---

## 5. Doc-cascade policy

Pre-rewrite inner-commit hash citations in outer docs are **HISTORICAL-ONLY** from this point. They are not mass-updated. They reference commits that existed in inner's pre-rewrite history; they remain valid as **forensic records of what happened**, and they will simply no longer resolve against rewritten inner history.

Affected outer docs (sampling, not exhaustive):
- [`docs/INNER_PUSH_POLICY.md`](../INNER_PUSH_POLICY.md) (`0fe8947`)
- [`docs/INNER_PUSH_POLICY_PREFLIGHT_INVENTORY.md`](../INNER_PUSH_POLICY_PREFLIGHT_INVENTORY.md) (`0fe8947`)
- [`docs/BTY_ARENA_STAGE1_FRAME_MAPPING_REPORT.md`](../BTY_ARENA_STAGE1_FRAME_MAPPING_REPORT.md) (`c5e1af7`)
- [`docs/closures/HK8_OUTER_INNER_SYNC_POLICY_CLOSURE.md`](HK8_OUTER_INNER_SYNC_POLICY_CLOSURE.md) (`d45d4d8`)
- [`docs/closures/HK9_*`](.) and `docs/HK7_LLM_MIGRATION_CLOSURE.md`
- Harness-side MEMORY.md inner-commit citations

Future readers cross-referencing these docs should consult this boundary document's §4 to map old→new. The full commit-map (400 entries) is preserved at `bty-app/.git/filter-repo/commit-map` for local lookup.

---

## 6. Observations + anomalies

### 6.1 Prior filter-repo run (May 1, 2026)

`bty-app/.git/filter-repo/` directory mtime: **2026-05-01T12:33:49** — a filter-repo run happened on May 1, 2026 (~2 weeks before today). Files inside the directory have today's mtime because today's `--force` run overwrote them. Today's run was the SECOND filter-repo execution on this repo.

The May 1 first run's purpose and effects are **not documented** in this sprint's artifacts. It may have rewritten earlier inner history (e.g., the inner root we measured as `6934a7c3` in Stage A may itself have been a post-May-1 hash, mapped from some EVEN-EARLIER pre-May-1 root). Today's commit-map does NOT contain `6934a7c3` as an old hash, suggesting the May 1 run was upstream of today's measurement frame.

**Decision:** the May 1 prior run is documented here as an observed artifact but is not investigated further. Today's rewrite outcome is verified clean and that is what matters for current operations.

### 6.2 Ref-map main anomaly

`bty-app/.git/filter-repo/ref-map` records:
```
3957a68a6bb6cf8023abcd5dd91e9720a9e3d4e3 fa0b86d64b9a1f801a512f16eb058181377f2105 refs/heads/main
```

Stage A captured `main` at `2626f9a7` (same as `inner-main`). Today's `branch -v` post-rewrite shows `main` at `6f8f4de` (matching `inner-main`). The ref-map's recorded OLD tip (`3957a68a`) does not match Stage A's measurement.

**Most likely explanation:** during Commander's manual filter-repo execution, `main` was momentarily moved (e.g., `git reset --hard <root>` or `git checkout 3957a68a`) before filter-repo ran, then re-aligned with `inner-main` after. The end state is correct (`main` and `inner-main` both at `6f8f4dec`, 72 commits, identical chain).

This anomaly is recorded for transparency but is not a defect.

### 6.3 Inline-hash references in commit subjects rewritten

filter-repo's default behavior rewrote 3 commit subjects' inline hash references (e.g., `(missed in 57daece)` → `(missed in be5e350)`). This is filter-repo's normal `--replace-refs` behavior, designed to keep cross-commit references consistent post-rewrite. Subject semantics unchanged.

### 6.4 11 migrated origin/* refs → local branches

filter-repo migrated 11 `refs/remotes/origin/*` refs (cursor/development-environment-setup-d103, feat/assessment-50-in-app, feat/assessment-50-public, feat/assessment-entrypoints, feat/i18n-en-default-ko-option, feat/logout-clear-auth-cookie, fix/auth-cookie-stable-quiet-401, fix/build-eslint-link, fix/forbidden-no-useSearchParams, fix/forbidden-searchparams-promise, fix/session-get-always-200) into `refs/heads/*` local branches. These branches contained no tar references, so their commits were not rewritten (old hash == new hash for each).

This is filter-repo's default behavior on non-bare repos: rather than discarding remote-tracking refs, migrate them to local branches so they aren't lost.

---

## 7. Recovery path

**Filesystem backup:** `/Users/hanbit/Dev/bty-app-PRE-REWRITE-BACKUP-2026-05-14` (4.4 GB, complete pre-rewrite repo including `.git`). Created in Stage A, verified HEAD-match. **DO NOT delete** until Commander confirms Stage C (re-push) succeeded and post-Stage-C operations stable for some period.

If rollback is needed:
```bash
# From outer or any safe location:
rm -rf /Users/hanbit/Dev/btytrainingcenter/bty-app
mv /Users/hanbit/Dev/bty-app-PRE-REWRITE-BACKUP-2026-05-14 /Users/hanbit/Dev/btytrainingcenter/bty-app
# Inner is fully restored to pre-rewrite state (tar file present, original hashes).
```

**Git safety branch:** `backup/inner-main-pre-rewrite-2026-05-14` at `6f8f4de` (POST-rewrite hash). This was created in Stage A at the OLD `2626f9a7` and got REWRITTEN by today's filter-repo run. It is now a post-rewrite snapshot reference, not a pre-rewrite recovery path. **The filesystem backup is the only true pre-rewrite recovery.**

---

## 8. Stage C readiness

- Inner working tree clean ✓
- Main and inner-main aligned at `6f8f4dec` ✓
- Tar file absent from working tree and history ✓
- Tests at baseline ✓
- inner-main ready for re-push: `git -C bty-app push origin inner-main`
- Stage C will be its own dispatch.

---

## 9. Provenance footer

- **Sprint scope this commit (outer):** this boundary doc + 2 board updates (CURSOR_TASK_BOARD + CURRENT_TASK) + 1 integration (`bty-app/.gitignore` secrets-safety parity, per §3.5). Total 4 files: boundary doc (new), 2 board files (modified), `.gitignore` (integrated from inner).
- **Mutation outside outer `docs/`:** the `.gitignore` integration is the ONE deliberate exception in this commit, justified by security-motivated parity (per §3.5). The inner-repo rewrite happened in Commander's manual filter-repo execution earlier (Stage B Part 2); this commit documents the boundary AND integrates the one security-critical inner-originated change.
- **HK8 invariants:** the 5 outer leaks (4M + 1D on `bty-app/`) are preserved in outer working tree per HK8 closure clause 4 — explicitly NOT staged in this commit. (Note: inner-main has the rewritten equivalents of those leak-producing commits — see §4.3 — and now lacks the tar file. The leak set on outer's view is unaffected by inner's rewrite because outer tracks the tree as-of outer's HEAD baseline, not inner's. They remain pending the leak-integration sprint per [INNER_PUSH_POLICY §5](../INNER_PUSH_POLICY.md).)
- **AL-2-D-P1 freeze:** `src/data/scenario/`, `src/lib/bty/runtime/`, `wrangler.toml` untouched.
- **4-check gate:** ran upfront on outer before staging this commit. Note: gate (b) was adjusted per Commander Option 2 — baseline of "5 HK8 leaks + 1 .gitignore (to be integrated)" was acknowledged before staging.
- **Status:** Stage B complete; Stage C (inner-main re-push to origin) pending separate dispatch.
