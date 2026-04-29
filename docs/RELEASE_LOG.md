# Release Log

## 2026-03-25 — Arena state & release evidence (aligned record; C5)

**Runtime verification (live origin):** Not re-checked in this workspace (`BASE_URL` / E2E secrets unset). **Recorded truth** remains aligned: green HTTP gate run [`23525350606`](https://github.com/dentistchi/bty-website/actions/runs/23525350606), artifact **`arena-release-gate-evidence`**, **`BASE_URL=https://bty-website.ywamer2022.workers.dev`**, signoff docs commit **`85a5e94`**.

**Workspace validation (this session):** Lint **PASS** (`tsc --noEmit` via `self-healing-ci.sh`). Full tests **PASS** — **377** files / **2693** tests. Build **PASS**. **`verify:arena-guards`** **PASS** (5 files / 17 tests). Scenario fallback unit tests **PASS** (`scenario-selector.fallback` + `empty-catalog`, 3 tests).

**Fallback behavior:** Engine staged fallback + `[arena] arena_scenario_selection` logging **active in codebase**; **production log counts** for `fallback_stage` **not queried this session** — treat as **no new production snapshot** in this record.

**Product status (aligned):** Functional recovery **achieved** (canonical `/bty-arena` flow + session/next contract per guards). Scenario fallback **active**. Guard system **active** (`verify:arena-guards` + CI). Observability **added** (structured arena selection logs; see [`ARENA_FALLBACK_OPERATOR_OBSERVABILITY.md`](./ARENA_FALLBACK_OPERATOR_OBSERVABILITY.md)).

| Field | Value |
|--------|--------|
| **deployment_git_sha** (workspace) | `85a5e9495ad2e81a0e95aeb259b3dbda37e120cf` |
| **Evidence timestamp (UTC)** | `2026-03-25T13:10:14Z` |

---

## 2026-03-22 — Arena fallback rollout (observability + evidence)

- **Avatar MVP fallback:** `avatarOverlayEnabled` + composite visibility aligned (Foundry / Arena).
- **Arena guard automation:** Vitest CI guards + `npm run verify:arena-guards` (`session/next` contract, bootstrap, redirects, scenario guards).
- **Scenario fallback:** `selectNextScenario` staged fallback through archive → replay → locale-union → explicit static; structured **`[arena] arena_scenario_selection`** JSON logs with stable **`fallback_stage`**.
- **Observability / release evidence:** [`ARENA_RELEASE_EVIDENCE_TEMPLATE.md`](./ARENA_RELEASE_EVIDENCE_TEMPLATE.md) (lint/test/build, arena guards, fallback tests, deployed HTTP gate, SHA + fallback-stage review); [`ARENA_FALLBACK_OPERATOR_OBSERVABILITY.md`](./ARENA_FALLBACK_OPERATOR_OBSERVABILITY.md) (log grep, release-window health summary); repo root [`docs/BTY_RELEASE_GATE_CHECK.md`](../../docs/BTY_RELEASE_GATE_CHECK.md) § observability.

---

## Arena Release

- URL: https://bty-website.ywamer2022.workers.dev
- Status: **Release-complete** (recorded evidence; see Verification)

### Verification Status
- **Release truth:** recorded **arena-release-gate** artifact + **`BASE_URL`** match (`BTY_RELEASE_GATE_CHECK`) — canonical signoff
- **Local/workspace live smoke:** optional; does not override artifact-backed release-complete

### Evidence
- GitHub Actions run: 23525350606
- Artifact: arena-release-gate-evidence
- Commit signoff: 85a5e94

### Note
Ongoing behavior work (avatar MVP, guards, scenario fallback, observability) is tracked above and in linked docs; it is **functional recovery / iteration**, not a substitute for the release truth model in § Verification.
