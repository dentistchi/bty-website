[BTY RULES]
- user_scenario_history is the only source of truth
- interpretArenaDecision must remain pure
- QR validation: /api/qr/validate only
- Migrations must be idempotent
- Never break tests
- ARENA_CANONICAL_CONTRACT.md overrides assumptions

You are fixing a bug in an existing production codebase.

Problem:
[PASTE ERROR]

Relevant code:
[PASTE CODE]

Scope:
Only modify:
- [file1]
- [file2]

Constraints:
- Minimal change only
- Do not break tests
- No unrelated refactor
- Preserve logic
- If unsure, ask

Task:
1. Provide exact fix
2. Return only changed code
3. Brief explanation
