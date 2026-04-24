[BTY RULES]
- user_scenario_history is the only source of truth
- interpretArenaDecision must remain pure
- QR validation: /api/qr/validate only
- Migrations must be idempotent
- Never break tests
- ARENA_CANONICAL_CONTRACT.md overrides assumptions

You are debugging an existing production codebase.

Problem:
[PASTE ERROR OR DESCRIPTION]

Relevant code:
[PASTE CODE]

Scope:
Only inspect these files:
- [file1]
- [file2]

Constraints:
- Do not refactor unrelated code
- Preserve behavior
- Respect project rules

Task:
1. Identify root cause
2. Explain briefly
3. Do NOT write code yet
