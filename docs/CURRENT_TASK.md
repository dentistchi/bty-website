# Active application task contract

## CODEX-SETUP-1 — repository-native Codex workflow

This file is the active application task contract for the inner repository. The integration branch is `inner-main`. Outer documentation is historical/reference material only. No outer task ledger is copied here, and no historical task is implicitly authorized.

- Verified base: `728d7ae4b5c126f5ab4479e7041f6fc9eafd99db` (live `origin` branch `refs/heads/inner-main`, checked 2026-09-18).
- Worktree: `/Users/hanbit/Dev/worktrees/bty-arena-codex-setup`.
- Working branch: `codex/arena-agentic-workflow-setup`.
- Objective: establish durable application instructions, this active task contract, and an evidence-based workflow; submit a PR to `inner-main` without merging.
- Sole writer: the Codex session assigned CODEX-SETUP-1. No concurrent writer may edit this worktree.
- Allowed changes: exactly `AGENTS.md`, `docs/CURRENT_TASK.md`, `docs/CODEX_WORKFLOW.md`.
- Excluded: application changes, copying unrelated dirty work, outer edits, deployment, migrations, database/service access, Teams/Entra changes and Cloudflare actions.
- Authorized delivery: commit and push only the setup branch; open a PR targeting `inner-main`. Merge and direct push to `inner-main` are not authorized.

## Acceptance and handoff

- Prove the live base before worktree creation; stop if the destination exists or the base cannot be proven.
- Preserve both original checkouts: status, HEAD, index and tracked/untracked file contents must match the initial snapshot. Stop on any unexpected change.
- Resolve the QR instruction discrepancy from source, without changing application code.
- Verify instruction discovery in this worktree and explicitly read both linked documents.
- Review the exact three-file diff, run whitespace and scope checks, and confirm no application-code changes.
- Record observed verification and delivery evidence in the PR and final handoff. Do not infer that a requested action has completed.

Status: setup documentation prepared; verification and PR delivery must be established by observed evidence. This contract does not authorize the next application task. Before new work, replace this task's scope and acceptance criteria with the newly authorized task; do not turn this file into a duplicate historical ledger.
