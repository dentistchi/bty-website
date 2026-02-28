---
name: refactor-code-constraints
description: Refactors pasted or selected code without changing business logic. Improves naming, modularity, and testability; preserves exports and updates imports when moving code; ends with a short diff-style summary. Use when the user asks to refactor code with constraints, paste code in <<< >>> blocks, or requests naming/modularity/testability improvements without logic changes.
---

# Refactor Code (Constraints)

Apply when the user provides code (e.g. in `<<< {PASTE CODE HERE} >>>`) and asks for refactoring with these constraints.

## Non-negotiables

1. **Do not change business logic.** Inputs, outputs, and behavior must remain identical. Only structure, names, and organization may change.
2. **Improve naming, modularity, and testability.** Prefer clear names, smaller focused units, and code that is easy to unit test.
3. **If you move code, preserve exports and update imports.** Any symbol that was public stays exported; every file that imported it must be updated to the new path/symbol.

## Workflow

1. **Parse** the pasted/selected code and identify files or modules.
2. **Refactor** in this order:
   - Rename variables, functions, types for clarity (no logic change).
   - Extract pure logic into small, testable functions or modules.
   - Split large blocks into smaller modules; keep single responsibility.
   - Ensure moved code is exported and all imports are updated.
3. **Verify** behavior is unchanged (describe or add a one-line test plan if helpful).
4. **Deliver** the refactored code plus a **short diff-style summary** at the end.

## Diff-style summary format

End the response with a section like:

```markdown
## Refactor summary (diff-style)

- `oldPath/someModule.ts`: renamed `x` → `computeTotal`, extracted `validateInput()` to `utils/validation.ts`
- `utils/validation.ts`: new file; contains `validateInput()` (was in someModule)
- `oldPath/someModule.ts`: now imports `validateInput` from `../utils/validation`
- `index.ts`: export added for `validateInput` (re-export from utils)
```

Keep the summary brief: what moved, what was renamed, and what import/export changes were made.

## What not to do

- Do not add new features or change algorithms.
- Do not introduce new dependencies unless necessary for testability (e.g. dependency injection).
- Do not change public API contract (function signatures, exported names) unless the user asks for it.
