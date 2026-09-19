# BTY Arena application instructions

Read `docs/CURRENT_TASK.md`, then `docs/CODEX_WORKFLOW.md` before acting. These are explicit reads; do not assume linked documents are automatically injected.

## Repository authority and ownership

- This inner application repository is the sole application-code authority. Its integration branch is `inner-main`, not `main`.
- The setup worktree is `/Users/hanbit/Dev/worktrees/bty-arena-codex-setup`; the original inner checkout is `/Users/hanbit/Dev/btytrainingcenter/bty-app`.
- Every Git command must use `git -C` with the exact absolute path of the intended inner checkout or worktree. Verify root, branch, HEAD and status before mutations. In another worktree, use its verified absolute root, never this path by habit.
- Never operate on `/Users/hanbit/Dev/btytrainingcenter` implicitly. Its documentation is historical/reference material only; it is not an active task ledger or application-code authority.
- `docs/CURRENT_TASK.md` in this repository is the active application task contract. Do not copy the outer ledger, resume its tasks automatically, or update outer documentation as a completion side effect.
- One writer per working tree. Preserve unrelated and concurrent work. Stop on unexpected status changes and coordinate ownership; never stash, clean, reset, switch, or overwrite another writer's work to proceed.
- Stage only explicitly named reviewed files. Never use `git add .`, `git add -A`, or `git commit -a`.

## Change and evidence discipline

- Follow: reproduce → diagnose → smallest fix → focused tests → full relevant verification → diff review.
- Never claim PASS without observed evidence. Record commands, exit results, scope, baseline failures and unrun checks. Never regress the existing test baseline.
- No deploy, migration, production write, Supabase mutation, Teams/Entra permission change, Cloudflare publish, merge, or direct push to `inner-main` without explicit authorization. A code change, test request or PR does not imply that authorization.
- Inspect scripts before running them. Tests, setup hooks, builds, replay and seed scripts may call external services or write data; use isolated local verification and do not manufacture production evidence.

## Product and engine invariants

- Capture != Commitment. Saved != Promised. Capturing or saving does not establish a commitment or promise.
- Microsoft identity uses `tid` + `oid`, never email. See `src/domain/identity-link/microsoftIdentity.ts`.
- `user_scenario_history` is the only source of truth for scenario rotation.
- `interpretArenaDecision` remains pure: no I/O, database access or side effects.
- Arena QR validation routes only through `POST /api/arena/leadership-engine/qr/validate`. The route implementation, caller and tests establish this path; `/api/qr/validate` in the old local instruction is incorrect. See the evidence in `docs/CODEX_WORKFLOW.md`. Do not create an alias to accommodate stale instructions.
- A run reaches `complete_verified` only after approval and `verified_at` is set.
- Core XP is permanent. Weekly XP alone determines weekly ranking; season progression must not change leaderboard ranking. UI renders API/engine decisions, never recomputes XP, league, season or rotation rules.
- Pattern signals: at most one per family per run, Steps 2–4 only.
- Domain functions remain pure; services orchestrate I/O; API handlers deserialize and delegate; UI renders. Keep Arena, Center and Foundry ownership boundaries intact.
- Migrations, when separately authorized, must be ordered and idempotent.
- `ARENA_CANONICAL_CONTRACT.md` overrides local assumptions and summaries on domain behavior. The outer copy may be read as a historical contract reference; it does not grant task or operational authority. Surface conflicts with current code or explicit instructions before changing behavior.
