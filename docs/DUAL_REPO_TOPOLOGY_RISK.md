# Dual-Repo Topology Risk

Measurement record produced by the DUAL-REPO-TOPOLOGY-RISK track (DRTR-1, DRTR-2).

---

## 1. Purpose

DUAL-REPO-TOPOLOGY-RISK is a **measurement-complete observability track**. Its output is a
structured description of the current dual-repository topology so the structure is
explainable, not opaque.

**Non-goals (explicitly out of scope for this track):**
repository consolidation, history rewrite, path-prefix change, remote redesign, and
submodule/worktree migration are **not executed** by this track. This document records
measurements and option surfaces only — it is not a change design.

---

## 2. Baseline (measurement time)

Each repository is judged independently. A "both repos simultaneously CLEAN" baseline is
not assumed.

| repo | HEAD | branch | working tree | origin ahead/behind |
|------|------|--------|--------------|---------------------|
| outer | `157a9b4` | `main` | CLEAN | 0 / 0 |
| inner (`bty-app/`) | `ec42eba1` | `inner-main` | CLEAN | 556 / 99 vs stale `origin/main` ref |

`bty-app/` carries its own `.git` and is a separate repository from the outer repository.
Both repositories share the same remote URL `git@github.com:dentistchi/bty-website.git`.

---

## 3. Risk taxonomy (T1–T5)

| ID | Risk | Measurement source |
|----|------|---------------------|
| T1 | Shared remote + duplicated `main` branch name | DRTR-1 |
| T2 | Co-tracked surface (2513 files) with bidirectional side-effect path | DRTR-1 |
| T3 | `.gitignore` divergence between the two repositories | DRTR-1 |
| T4 | Dead stale third copy `bty-website/` (323 files) | DRTR-2 |
| T5 | inner branches without configured upstream + `main` name collision | DRTR-2 |

### T1 — Shared remote + duplicated `main` name
Both repositories point `origin` at the same GitHub URL (fetch URL = push URL). The name
`main` exists both as a local branch inside the inner repository (`a916c66f`) and as the
production branch on the remote (`origin/main` = `157a9b4`). The two histories are
disjoint (no merge-base), so a plain push between them is non-fast-forward and is
rejected; a forced push is the only path that reaches across.

### T2 — Co-tracked surface (2513 files)
The outer repository tracks 2514 files under the `bty-app/` prefix; the inner repository
tracks 2513 files. The intersection is 2513 — every inner-tracked file is also tracked by
the outer repository under a `bty-app/` prefix. Because the files are physically shared on
disk, a commit or checkout in one repository that alters a co-tracked file's on-disk
content is observed by the other repository as working-tree drift. The single outer-only
file inside that prefix is `tsconfig 2.tsbuildinfo` (a build artifact).

### T3 — `.gitignore` divergence
The outer and inner `.gitignore` files have independently evolved and differ
substantially. One observed consequence: the outer repository tracks
`bty-app/tsconfig 2.tsbuildinfo` and `bty-website/bty-app/tsconfig 2.tsbuildinfo` (build
artifacts), while the inner repository tracks no `tsbuildinfo` file.

### T4 — Dead stale third copy `bty-website/`
The outer repository tracks a `bty-website/` directory (323 files), including
`bty-website/bty-app/` (114 files). Measurements:

- **Content relation.** Of the 114 `bty-website/bty-app/` paths, 74 share a path name with
  the current `bty-app/`; 40 are unique to the third copy. Sampled overlapping files
  (`src/lib/i18n.ts`, `package.json`, `tsconfig.json`) all have differing blob hashes. The
  third copy is a divergent snapshot of an earlier application generation (pre-`[locale]`
  routing; many `* 2.*` duplicate-suffix files), not a copy of the current `bty-app/`.
- **Introduction.** Added at outer-repository inception — commit `0f1a6040` (2026-02-13,
  "Initial commit with OpenNext Cloudflare deploy workflow") and `38b7ee90` (2026-02-13,
  "Track bty-website as regular directory"). Frozen since.
- **References.** `bty-app/tsconfig.json` lists `"../bty-website"` in its `exclude` array
  (explicit non-compilation). The outer build script enters only `bty-app/`. No source
  import of the `bty-website/` directory exists. The directory has zero functional
  build / import / CI reference — it is a dead stale copy as a measured fact.

### T5 — inner upstream absence + `main` name collision
No inner branch has a configured upstream (`branch.<name>.remote` / `branch.<name>.merge`
are absent on all 17 inner local branches; only VSCode `vscode-merge-base` metadata is
present). The four-way branch relation:

| ref | hash | relation |
|-----|------|----------|
| `origin/main` | `157a9b4` | outer production |
| `origin/inner-main` | `a916c66f` | equals inner local `main` |
| inner local `main` | `a916c66f` | equals `origin/inner-main` (name differs from local) |
| inner local `inner-main` | `ec42eba1` | descendant of `a916c66f` (+2 sync commits), not on origin |

`origin/main` and `a916c66f` are disjoint. Because no upstream is configured, every inner
push requires an explicit refspec; and because the name `main` exists both as an inner
local branch and as `origin/main`, an explicit `git push origin main` issued from the
inner repository targets the production branch with inner local `main` content. The
disjoint non-fast-forward rejection is the only non-forced guard on that path.

---

## 4. Operational vs theoretical risk separation

This separation is the core output of the track. Operational risk is not promoted from,
nor merged with, theoretical risk.

### Operational — failures that actually occurred
1. `BTY_12_CORE_AXIS.md` content divergence between outer and inner (38 lines, later 44
   lines). Closed by the DUALSYNC track.
2. An inner `git checkout` of a co-tracked file altered the outer repository's working
   tree through the shared file (observed during an earlier baseline-correction step).
   Restored at the time.

Both operational items are resolved. No other operational failure is measurable at this
time.

### Theoretical — structurally possible, not yet occurred
1. A forced push carrying inner content over `origin/main` (production), enabled by the
   shared remote and the duplicated `main` name (T1, T5).
2. A checkout/commit side-effect on any of the 2513 co-tracked files reflecting into the
   other repository's working tree (T2).
3. `.gitignore` divergence leading to build artifacts being tracked (T3).
4. The nested `bty-website/bty-app/` third copy drifting independently of the current
   application (T4).
5. Ambiguous push targets arising from inner upstream absence (T5).

None of the theoretical items is an active failure at measurement time.

---

## 5. Option surface (T1–T5)

The following are **measurement-based candidates only**. Each is listed without blast-radius
evaluation, without priority, and without recommendation. They are inputs for a Commander
decision, not a change design.

- **T1.** Candidate surfaces: rename the inner local `main` branch to remove the name
  collision; an inner push-guard hook on production branches; remote branch protection on
  `origin/main`.
- **T2.** Candidate surfaces: a procedure to check both repositories' status when a
  co-tracked file changes; documenting the co-tracked surface explicitly.
- **T3.** Candidate surfaces: one-directional `.gitignore` alignment; untracking
  already-tracked build artifacts.
- **T4.** Candidate surfaces: untrack `bty-website/` from the outer repository; relocate it
  to a separate archive location; retain as-is with the dead-surface status documented.
- **T5.** Candidate surfaces: configure an upstream for `inner-main`; rename the inner local
  `main` branch; an inner push-guard hook.

Blast radius for each candidate is unevaluated. Selection, ordering, and execution are out
of scope for this track.

---

## 6. Evidence source

| Track step | Scope |
|------------|-------|
| DRTR-1 | Topology observability inventory — baseline, shared remote, co-tracked surface taxonomy, drift recurrence vectors, mutation blast radius, operational/theoretical separation (T1–T3, plus T4/T5 first surfacing) |
| DRTR-2 | T4/T5 option-surface inventory — third-copy measurement, branch/upstream mapping |
| DRTR-3 | This document — DRTR-1 + DRTR-2 measurement consolidation |

---

## 7. Freeze

> **Topology risk existence does not imply topology rewrite necessity.**

This document makes the topology explainable. It does not design, recommend, or prioritize
any change to the topology. Any structural change is a separate decision with its own
authorization and its own blast-radius measurement.
