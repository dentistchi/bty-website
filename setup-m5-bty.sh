#!/bin/bash
# =============================================================================
# setup-m5-bty.sh — BTY Arena M5 Setup (fixed)
# =============================================================================

set -euo pipefail

echo "=== BTY Arena M5 setup starting ==="

PROJECT_ROOT="$(pwd)"
BTY_DIR="$HOME/.bty"
LAUNCH_AGENTS_DIR="$HOME/Library/LaunchAgents"

mkdir -p "$LAUNCH_AGENTS_DIR"
mkdir -p "$BTY_DIR"
mkdir -p .cursor/rules .ai-prompts

# -----------------------------------------------------------------------------
# 2. Cursor 프로젝트 설정 파일
# -----------------------------------------------------------------------------
echo "=== Writing BTY Arena project config ==="

cat > .cursorrules << 'EOF'
BTY Arena global rules:
- user_scenario_history is the only source of truth for scenario rotation
- interpretArenaDecision must remain pure
- QR validation must route only through /api/qr/validate
- Migrations must be ordered and idempotent
- Never regress the existing test baseline
- ARENA_CANONICAL_CONTRACT.md overrides local assumptions and summaries
EOF

cat > .cursorignore << 'EOF'
node_modules
.next
dist
build
coverage
.vercel
tmp
temp
*.log
supabase/.branches
EOF

cat > .cursor/rules/00-bty-core.mdc << 'EOF'
---
description: BTY Arena always-on project rules
globs: ["**/*"]
alwaysApply: true
---
BTY Arena constraints:
- user_scenario_history is the only source of truth for scenario rotation
- interpretArenaDecision must remain pure and side-effect free
- QR validation must route only through /api/qr/validate
- Migrations must be ordered and idempotent
- Never regress the existing test baseline
- ARENA_CANONICAL_CONTRACT.md overrides local assumptions and summaries
EOF

cat > .cursor/rules/10-bug-analyze.mdc << 'EOF'
---
description: Analyze bug root cause before coding
globs: ["**/*"]
alwaysApply: false
---
When debugging:
1. Identify root cause first
2. Do not write code immediately
3. Ask for missing context if needed
4. Prefer smallest possible diagnosis scope
EOF

cat > .cursor/rules/20-bug-fix-minimal.mdc << 'EOF'
---
description: Minimal safe bug fix behavior
globs: ["**/*"]
alwaysApply: false
---
When fixing bugs:
- Make the smallest safe change
- Do not refactor unrelated code
- Preserve existing logic and naming
- Prefer changed code blocks over whole-file rewrites
- If unsure, ask before modifying
EOF

cat > .cursor/rules/30-sql-migration.mdc << 'EOF'
---
description: Supabase/Postgres migration behavior
globs: ["**/*.sql"]
alwaysApply: false
---
For SQL migrations:
- Must be idempotent
- Must be safe to re-run
- Prefer explicit SQL
- Avoid unrelated schema changes
- Preserve production behavior
EOF

cat > .cursor/rules/40-test-safe-change.mdc << 'EOF'
---
description: Test-safe change behavior
globs: ["**/*"]
alwaysApply: false
---
For code changes in tested areas:
- Do not break existing tests
- Prefer minimal change
- Mention edge cases briefly
- Preserve business rules over stylistic cleanup
EOF

# -----------------------------------------------------------------------------
# 3. AI 프롬프트 템플릿
# -----------------------------------------------------------------------------
cat > .ai-prompts/bty-rules.md << 'EOF'
BTY Arena rules:

- user_scenario_history is single source of truth
- interpretArenaDecision must remain pure
- QR validation: /api/qr/validate only
- Migrations must be idempotent
- Never break tests
- ARENA_CANONICAL_CONTRACT.md overrides assumptions
EOF

cat > .ai-prompts/bug-analyze.md << 'EOF'
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
EOF

cat > .ai-prompts/bug-fix-minimal.md << 'EOF'
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
EOF

cat > .ai-prompts/sql-migration.md << 'EOF'
You are writing a Supabase/PostgreSQL migration.

Request:
[PASTE REQUEST]

Constraints:
- Must be idempotent
- Safe to re-run
- No unrelated schema change

Task:
Return SQL only.
EOF

cat > .ai-prompts/test-safe-change.md << 'EOF'
You are modifying a codebase with existing tests.

Change request:
[PASTE REQUEST]

Relevant code:
[PASTE CODE]

Scope:
Only modify:
- [file1]
- [file2]

Constraints:
- Do not break tests
- Minimal change
- Preserve business logic

Task:
1. Show exact changes
2. Mention test impact
3. Mention edge cases
EOF

# -----------------------------------------------------------------------------
# 4. Modelfile 생성
# -----------------------------------------------------------------------------
echo "=== Writing Modelfiles to $BTY_DIR ==="

cat > "$BTY_DIR/bty-main.Modelfile" << 'EOF'
FROM mlx-community/gemma-4-31b-it-4bit

PARAMETER num_ctx 65536
PARAMETER temperature 0.2
PARAMETER top_p 0.9
PARAMETER repeat_penalty 1.1

SYSTEM """
You are a senior full-stack engineer working on BTY Arena.

Critical rules:
- user_scenario_history is the only source of truth
- interpretArenaDecision must remain pure
- QR validation: /api/qr/validate only
- Migrations must be ordered and idempotent
- Never break tests
- ARENA_CANONICAL_CONTRACT.md overrides everything
"""
EOF

# -----------------------------------------------------------------------------
# 완료
# -----------------------------------------------------------------------------
echo ""
echo "=== Setup complete ==="
echo ""
echo "생성된 파일:"
echo "  .cursorrules"
echo "  .cursorignore"
echo "  .cursor/rules/ (4개)"
echo "  .ai-prompts/ (5개)"
echo "  $BTY_DIR/bty-main.Modelfile"
echo ""
echo "다음 단계:"
echo "  npm install"
echo "  npm run dev"
