# Codex application workflow

## Start in the correct repository

The inner repository owns application code and integrates through `inner-main`. Work on an isolated topic branch with one writer per working tree. This setup uses `/Users/hanbit/Dev/worktrees/bty-arena-codex-setup`; do not use the original dirty checkouts for setup changes.

Every Git invocation must name the exact absolute inner worktree path, including status, diff, log, add, commit and push. For this worktree:

```sh
git -C /Users/hanbit/Dev/worktrees/bty-arena-codex-setup rev-parse --show-toplevel
git -C /Users/hanbit/Dev/worktrees/bty-arena-codex-setup branch --show-current
git -C /Users/hanbit/Dev/worktrees/bty-arena-codex-setup rev-parse HEAD
git -C /Users/hanbit/Dev/worktrees/bty-arena-codex-setup status --porcelain=v1 --untracked-files=all
```

Use `GIT_OPTIONAL_LOCKS=0` for read-only status snapshots. Compare the baseline before each write or delivery phase; status alone does not prove file contents are unchanged. Preserve unrelated and concurrent work and stop on unexpected changes. Do not use broad staging or cleanup to make a checkout appear clean.

## Instruction discovery and task authority

Codex discovers global instructions and project instructions from the Git root toward the working directory. `AGENTS.override.md` takes precedence over `AGENTS.md` in the same directory. Verify the actual loaded sources in a fresh read-only session; do not assume ancestor files outside this Git root are project instructions.

At this worktree root, `AGENTS.md` is the project entry point. Explicitly read `docs/CURRENT_TASK.md` and this file. The two documents are linked task/workflow context, not additional auto-discovered AGENTS files. Check global overrides and any path-scoped instructions before later work in subdirectories.

The original outer repository's AGENTS file, task board, task ledger and automation are historical/reference material only. Do not implicitly load or execute its hooks, claim its tasks are current, or update its ledger. The application task contract is this repository's `docs/CURRENT_TASK.md`. External historical domain contracts may inform a decision but cannot authorize an operation; surface discrepancies instead of silently rewriting behavior.

## Implementation and verification

1. Reproduce the reported behavior in a safe local context; record the observed failure and baseline.
2. Diagnose the cause from code, data contracts and evidence.
3. Apply the smallest fix within the active task's explicit scope.
4. Run focused regression tests that exercise the failure.
5. Run full relevant verification after inspecting scripts and configuration for side effects. `npm test` runs Vitest; `npm run lint` runs TypeScript. Builds, E2E, seed, replay and release scripts require separate scrutiny and any necessary authorization. Never borrow live credentials or mutate services to clear a gate.
6. Review unstaged, staged and base-to-branch diffs. Confirm only intended files and changes remain.

Never claim PASS without observed evidence. Report command, exit result, tested scope, baseline failures and omitted checks. A blocked or unrun gate is not PASS. Preserve the test baseline; failures do not justify deleting tests or weakening assertions.

For this documentation-only setup, relevant verification is instruction discovery, explicit linked-document reads, QR source evidence, exact three-file scope, whitespace/diff review and original-checkout preservation. Application tests and builds are not required to validate these prose-only changes, and must not be represented as run.

## QR discrepancy resolved from the verified base

At `728d7ae4b5c126f5ab4479e7041f6fc9eafd99db`:

- `src/app/api/arena/leadership-engine/qr/validate/route.ts:16` documents `POST /api/arena/leadership-engine/qr/validate`; line 21 exports its POST handler.
- `src/components/bty/my-page/MyPageLeadershipConsole.tsx:478` calls that exact route.
- `src/app/api/arena/leadership-engine/qr/validate/route.test.ts:48` names the route in its suite; line 140 constructs requests to it.
- The verified tree has no `src/app/api/qr/validate/route.ts`; searching source and `next.config.js` found no `/api/qr/validate` alias.

The prior inner untracked instruction naming `/api/qr/validate` was stale. The correct Arena validation endpoint is `/api/arena/leadership-engine/qr/validate`. This setup changes instructions only; it does not invoke the route, alter validation behavior or certify runtime behavior.

Microsoft identity evidence: `src/domain/identity-link/microsoftIdentity.ts` defines identity as `tid` + `oid` and explicitly rejects email as identity. Preserve Capture != Commitment and Saved != Promised across UI, APIs and domain transitions.

## Delivery and authorization

Stage exact reviewed paths, then review the staged diff before commit. For CODEX-SETUP-1 the only allowed paths are `AGENTS.md`, `docs/CURRENT_TASK.md`, and `docs/CODEX_WORKFLOW.md`. Never use `git add .`, `git add -A`, or `git commit -a`.

Push only the authorized topic branch with an explicit destination ref and open a PR targeting `inner-main`. Record the verified base, commit, files, validation, risks and PR URL. Do not merge automatically.

No deploy, migration, production write, Supabase mutation, Teams/Entra permission change, Cloudflare publish, merge, or direct push to `inner-main` without explicit authorization. This setup additionally prohibits all database, Supabase, Teams, Entra and Cloudflare access. Permission to commit, push a topic branch or open a PR does not authorize these operations.
