# Terminology lock copies (G-B11)

## Lint source (must match normative locks)

These four files are the **only input** to `scripts/terminology-lint.mjs` for forbidden-substitution rules. **CI does not read** any other path.

| File here | Section parsed by the linter |
| --- | --- |
| `PHILOSOPHY_LOCK_V1.md` | `## [LOCKED] Section 6 — Locked Terminology` |
| `DIFFICULTY_LEVEL_MODEL_V1.md` | `## Section 6 — Terminology Lock Addendum` |
| `PATTERN_ACTION_MODEL_V1.md` | `## Section 7 — Terminology Lock Addendum` |
| `VALIDATOR_ARCHITECTURE_V1.md` | `## Section 6 — Terminology Lock Addendum` |

The **normative** documents are the approved specs those sections belong to (same titles/§ numbers). The copies in **`docs/terminology-locks/`** must stay **identical** to the normative lock tables for those sections. If governance changes the authoritative text, **sync** the matching excerpt here before relying on CI.

The linter **does not** scan this directory (it contains the forbidden-substitution vocabulary verbatim).

## Future lock amendment process (always include sync)

1. Change the **normative** document (or complete governance review) for the relevant §.
2. **Sync:** Update the corresponding file in **`docs/terminology-locks/`** so headings and **Forbidden Substitutions** cells match the normative source.
3. Run **`npm run lint:terminology`** from `bty-app` until green.

See **`scripts/terminology-lint/README.md`** for tokenizer rules, scan scope, and CI.
