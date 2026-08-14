# BTY AI Onboarding

**Purpose:** This document set does not exist to educate AI.  
It exists so AI **cannot break BTY**.

Every new session — ChatGPT, Claude, Gemini, Cursor, or future tools — must read this stack **before** writing code.  
If an AI has not passed the Self Test at the end, it is not ready to implement.

BTY has two operating systems:

| OS | What it is |
|----|------------|
| **First** | The application — Arena, Center, Foundry |
| **Second** | This document set — how AI must think |

When both are in place, the model can change; the project's direction should not.

**Design is finished above the code line.** Constitution → Boot → State → Roadmap → Rules → ADR — then Code implements. Code no longer leads design.

---

## One question per document

| Question | Document |
|----------|----------|
| What must we believe? | [`BTY_PRODUCT_CONSTITUTION.md`](./BTY_PRODUCT_CONSTITUTION.md) |
| How must we think? | [`BTY_AI_BOOT.md`](./BTY_AI_BOOT.md) |
| Where are we now? | [`BTY_PROJECT_STATE.md`](./BTY_PROJECT_STATE.md) |
| Where are we going? | [`BTY_PRODUCT_ROADMAP.md`](./BTY_PRODUCT_ROADMAP.md) |
| How do we build safely? | [`BTY_IMPLEMENTATION_RULES.md`](./BTY_IMPLEMENTATION_RULES.md) |
| Why was it decided this way? | [`decisions/README.md`](./decisions/README.md) (ADR) |
| What was actually shipped? | [`CURSOR_TASK_BOARD.md`](./CURSOR_TASK_BOARD.md) · [`CURRENT_TASK.md`](./CURRENT_TASK.md) (Ledger) |

Roles do not overlap. If two documents answer the same question, one of them is wrong.

### History → Knowledge → Code

BTY now has two kinds of time:

| Kind | Document | Question |
|------|----------|----------|
| **History** | Ledger | *What happened?* |
| **Knowledge** | ADR | *Why did it happen that way?* |

```
History (Ledger)
        ↓
Knowledge (ADR)
        ↓
Code
```

Ledger records deploys and closures. ADR records reasoning that must survive years. Neither replaces the other.

---

## Last resort principle (operating law)

**New documents are the last resort.**

Before creating any document — or before proposing one — ask whether the idea is already explainable within **Constitution**, **Boot**, or an **existing ADR**.

| If the answer fits here… | Then… |
|--------------------------|--------|
| Existing Constitution / Boot / ADR | **Write code.** No new doc. |
| New philosophy (eternal law) | Almost never — Commander only |
| New Boot / new Rule | Almost never |
| New **Why** (product-wide fork) | **One new ADR** — then stop |
| Sprint shipped / deployed | **Ledger line** only |
| Where we are / where we go | Update **State** or **Roadmap** |

**Example — "Build Learning Engine":**  
New philosophy? No. New rule? No. New why? No (ADR-003 already covers the contract). → **Build code.**

**Example — "Split Evidence and Verification product-wide":**  
Already in ADR-005? If the fork is new and binding → **ADR-006** — then build.

BTY is no longer a project that grows by adding documents.  
It grows by **shipping product** and occasionally **appending one ADR**.

### Architecture Freeze (default: code)

**Architecture is frozen.** Every new feature must first fit inside Constitution, Reality OS, Implementation Rules §0, and existing ADRs.

| Question | Default answer |
|----------|----------------|
| New document for this feature? | **No** — if Constitution/ADR already covers it |
| New ADR? | Only when existing architecture cannot explain the **Why** |
| New Canon? | Commander approval only — almost never |

Development flow: **Think → ADR (if needed) → Code → Evidence.**

Proof of progress is the **running app** — not another spec.

---

## Read order (mandatory)

```
AI Onboarding (this file)
        │
        ▼
Product Constitution     ← what to believe
        │
        ▼
AI Boot                  ← how to think
        │
        ▼
Project State            ← where we are now
        │
        ▼
Product Roadmap          ← where we are going
        │
        ▼
Implementation Rules     ← how to implement safely
        │
        ▼
Decision Records (ADR)   ← why we decided
        │
        ▼
Code (task scope only)
```

| Step | File | Question it answers |
|------|------|---------------------|
| 1 | [`BTY_PRODUCT_CONSTITUTION.md`](./BTY_PRODUCT_CONSTITUTION.md) | *What must I believe?* |
| 2 | [`BTY_AI_BOOT.md`](./BTY_AI_BOOT.md) | *How must I think?* |
| 3 | [`BTY_PROJECT_STATE.md`](./BTY_PROJECT_STATE.md) | *What exists today?* |
| 4 | [`BTY_PRODUCT_ROADMAP.md`](./BTY_PRODUCT_ROADMAP.md) | *What do we build next?* |
| 5 | [`BTY_IMPLEMENTATION_RULES.md`](./BTY_IMPLEMENTATION_RULES.md) | *What must I never break?* |
| 6 | [`decisions/README.md`](./decisions/README.md) | *Why was it decided this way?* |
| 7 | Task-specific code & architecture | *How does this system work?* |

**Why Constitution before Boot:** Belief comes before reasoning.  
Read the law first — then Boot's 12 principles explain *why* they exist.

---

## What stays frozen (BIOS)

These files are **locked**. They do not change with sprints, models, or features.

| File | Status |
|------|--------|
| [`BTY_PRODUCT_CONSTITUTION.md`](./BTY_PRODUCT_CONSTITUTION.md) | **LOCKED** — Commander-only amendment |
| [`BTY_AI_BOOT.md`](./BTY_AI_BOOT.md) | **LOCKED** — Commander-only amendment |
| This onboarding file | **LOCKED** — structure fixed; Self Test may gain rows only if a mistake repeats 10× |

**What updates:** [`BTY_PROJECT_STATE.md`](./BTY_PROJECT_STATE.md) and [`BTY_PRODUCT_ROADMAP.md`](./BTY_PRODUCT_ROADMAP.md) only — when reality ships or priorities shift.

[`BTY_IMPLEMENTATION_RULES.md`](./BTY_IMPLEMENTATION_RULES.md) changes **rarely** — only when a guardrail is learned the hard way (e.g. SECURITY DEFINER ACL).

---

## After onboarding

| Need | Go to |
|------|-------|
| Why a past decision | [`decisions/README.md`](./decisions/README.md) |
| Current sprint task | [`CURSOR_TASK_BOARD.md`](./CURSOR_TASK_BOARD.md) |
| Latest decisions | [`CURRENT_TASK.md`](./CURRENT_TASK.md) |
| System map | [`architecture/ARCHITECTURE_MAP.md`](./architecture/ARCHITECTURE_MAP.md) |
| Arena field contract | [`ARENA_CANONICAL_CONTRACT.md`](./ARENA_CANONICAL_CONTRACT.md) |
| Identity voice | [`BTY_CANON.md`](./BTY_CANON.md) |
| Agent runtime (C1–C5) | [`agent-runtime/README.md`](./agent-runtime/README.md) |
| Claude Code entry | [`../CLAUDE.md`](../CLAUDE.md) |

---

## Document taxonomy

| Type | Examples | Mutable? |
|------|----------|----------|
| **Constitution** | `BTY_PRODUCT_CONSTITUTION.md` | No |
| **AI Boot** | `BTY_AI_BOOT.md`, this file | No |
| **Project State** | `BTY_PROJECT_STATE.md` | Yes — when systems ship |
| **Product Roadmap** | `BTY_PRODUCT_ROADMAP.md` | Yes — when priorities shift |
| **Implementation Rules** | `BTY_IMPLEMENTATION_RULES.md` | Rarely |
| **Decision Records (ADR)** | `docs/decisions/ADR-*.md` | Append-only — new ADR when a "why" must survive |
| **Architecture** | Per-system docs when a system is born | Add only with new system |
| **Ledger** | `CURSOR_TASK_BOARD.md`, `CURRENT_TASK.md` | Automatic — History |

### Creation policy (default: do not add)

| New… | Create? |
|------|---------|
| Canon / Constitution | × Almost never |
| Boot | × Almost never |
| Implementation Rule | × Almost never |
| Architecture doc | × Only when a **new system** is born and code alone is insufficient |
| **ADR** | ○ Only when a new **Why** appears |
| Project State | ○ Update when reality ships |
| Roadmap | ○ Update when priorities shift |

Before creating any new document:

> *Can this be explained within Constitution, Boot, or an existing ADR?*

If **yes** — build code.  
If **no** — and only then — follow the table above.

---

## Tool-specific entry points

| Tool | Also load |
|------|-----------|
| **Cursor** | `.cursorrules`, `.cursor/rules/bty-*.mdc` |
| **Claude Code** | `CLAUDE.md`, `.claude/rules/` |
| **ChatGPT / Gemini** | Link to `docs/BTY_AI_ONBOARDING.md` or paste Constitution + Boot |

All tools share the same stack. Divergence is a bug.

---

# Self Test (required before coding)

## Part A — Reject these beliefs

**If you believe any of the following, you do not understand BTY yet.**

| | Misconception | Why it is wrong |
|---|---------------|-----------------|
| ❌ | BTY is a dashboard. | BTY is a Culture Operating System. TODAY — not a dashboard — is the home. |
| ❌ | Learning gives XP. | Learning **verifies** reality; the engine **awards** Core XP after verification. Unverified consumption awards nothing. |
| ❌ | QR is the product. | QR is a **verification language**. Without verification there is no trusted growth. |
| ❌ | Avatar is a cosmetic. | Avatar is **visualized verified growth** — earned, never fabricated. |
| ❌ | Weekly XP is permanent. | **Core XP** is permanent. Weekly XP resets and ranks **only** within the active week. |
| ❌ | Screens are more important than Reality. | The app observes and reflects reality. Reality creates growth; the app never does. |
| ❌ | Every engine calculates growth. | Reality Engines **verify** and **award**. Growth is derived **after** Core XP is confirmed. |
| ❌ | Gamification comes before culture. | Culture first. Points recognize actions that already matter culturally. |

If any row still feels true to you — **stop**. Re-read Constitution and Boot.

---

## Part B — Canonical answer (required)

Before writing a single line of code, answer this in your own words:

> **What is BTY?**

Your answer **must** include all of the following truths (wording may vary; meaning must not):

```
BTY is a Culture Operating System.
Reality is the source.
Arena is the reflection.
Verified behavior creates permanent Core XP,
and every other metric is derived from it.
```

If your answer omits any element — Core XP as root, reality as source, Arena as reflection, or derived metrics — **you have not finished booting**.

---

## Part C — The override question

Before every implementation:

> *Does this make BTY bring people back into reality?*

If no — it does not belong. Do not propose it. Do not build it.

---

## Proposals this stack should prevent

An AI that has booted correctly should find these **hard to suggest**:

- "Shall we add another dashboard?"
- "Watch a video and we'll give XP."
- "We can award XP without QR / verification."
- "Let's polish this page before the final architecture exists."
- "Weekly rank should affect season / league tier."

If you catch yourself heading here — re-run Part A.

---

## Part D — 60-second test (final gate)

Explain BTY in **less than 60 seconds**, **without using** any of these words:

`QR` · `XP` · `Avatar` · `Learning` · `Scenario`

If you cannot — you still think BTY is a **feature set**, not an **operating system**.

Your explanation must converge to this meaning (wording may vary):

```
BTY is a Culture Operating System that transforms verified real-world behavior
into permanent digital identity. Everything else is a projection of that truth.
```

Using forbidden words to explain the *mechanism* means you have not internalized the product layer.  
Describe the **operating system**, not the feature list.

---

*Version: 1.2 · Structure LOCKED · Last resort principle: 2026-06-25*
