# BTY Decision Records (ADR)

**Purpose:** Permanent record of **why** a decision was made — not what exists (Project State), not what we build next (Roadmap), not eternal law (Constitution).

Six months from now, an AI will ask: *"Why did we return 200 on duplicate scan?"*  
The answer lives here — not in Constitution, not in Project State, not in Ledger.

### Ledger vs ADR

| | Ledger | ADR |
|---|--------|-----|
| Question | *What was done?* | *Why was it done that way?* |
| Time | History | Knowledge |
| Example | "Slice 2b deployed" | "Duplicate scan returns 200 because reality already happened" |

You do not need to read code or Ledger to understand a **why** — read the ADR.

```
History (Ledger) → Knowledge (ADR) → Code
```

---

## When to write an ADR

Create a new ADR when:

- A design choice will be **questioned again** in future sessions
- The choice is **not** Constitution-level (too specific) but **is** permanent (should not be re-debated)
- Reversing it would **break user trust** or **security**

Do **not** create an ADR for:

- Sprint progress → use [`CURRENT_TASK.md`](../CURRENT_TASK.md) / [`CURSOR_TASK_BOARD.md`](../CURSOR_TASK_BOARD.md)
- Eternal philosophy → belongs in [`BTY_PRODUCT_CONSTITUTION.md`](../BTY_PRODUCT_CONSTITUTION.md)
- How to implement safely → belongs in [`BTY_IMPLEMENTATION_RULES.md`](../BTY_IMPLEMENTATION_RULES.md)

**Rule:** ADRs are **append-only**. Supersede with a new ADR; do not silently edit history.

---

## Index

| ID | Title | Status | Date |
|----|-------|--------|------|
| [ADR-001](./ADR-001-core-xp-root.md) | Core XP as Root — Direct Award | Accepted | 2026-06-24 |
| [ADR-002](./ADR-002-reality-event-engine.md) | Reality Event Engine — Scan Semantics | Accepted | 2026-06-24 |
| [ADR-003](./ADR-003-verified-learning-engine.md) | Verified Learning Engine — Same Contract | Accepted | 2026-06-25 |
| [ADR-004](./ADR-004-security-definer-revoke.md) | SECURITY DEFINER — Explicit REVOKE Required | Accepted | 2026-06-24 |
| [ADR-005](./ADR-005-evidence-vs-verification.md) | Evidence vs Verification | Accepted | 2026-06-25 |

---

## ADR template (for new records)

```markdown
# ADR-NNN — Title

**Status:** Accepted | Superseded by ADR-XXX
**Date:** YYYY-MM-DD

## Context
What problem or fork did we face?

## Decision
What we chose — one paragraph.

## Reason
Why — the part that must survive 6 months.

## Consequences
What implementers must respect. What we explicitly did not do.
```

---

## Read order

ADRs are read **after** Implementation Rules, **before** code:

```
Constitution → Boot → Project State → Roadmap → Implementation Rules → Decision Records → Code
```

When implementing a system, read ADRs for that system first.

---

*Append new rows to the index when an ADR is accepted.*
