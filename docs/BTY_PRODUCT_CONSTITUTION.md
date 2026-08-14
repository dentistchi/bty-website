# BTY Product Constitution

**Status: LOCKED (BIOS)** — Do not edit except by explicit Commander decision.  
This file will not change with sprints or features.

**Audience:** Humans and every AI agent on BTY  
**Read first** in the AI stack — *what to believe* before [`BTY_AI_BOOT.md`](./BTY_AI_BOOT.md) (*how to think*). Code is *how it works*.

---

## Article I — What BTY Is

BTY (Better Than Yesterday) is a **Culture Operating System**.

It is a deterministic leadership and behavioral alignment engine.  
It compares people to **yesterday's self**, not to each other.  
It deals with **behavior**, not opinions.

> BTY does not record thoughts.  
> It verifies whether behavior changed under the same pressure.

Identity vocabulary and cultural voice: [`BTY_CANON.md`](./BTY_CANON.md) (locked identity layer).

---

## Article II — What BTY Is Not

BTY is **not**:

- a game whose goal is winning
- a dashboard whose goal is engagement metrics
- a course platform whose goal is content completion
- a leaderboard whose goal is competition for its own sake

Any design that optimizes screen time over real-world action violates this Constitution.

---

## Article III — The Root of Value

**Core XP** is the only permanent growth record.

Everything else — Avatar, Identity, Codes, Stages, TII, Leaderboards, Weekly views, Season progress — is a **derived view** of Core XP.

Rules:

1. Core XP is **lifetime**. It never decreases because of weekly resets.
2. Weekly XP resets at the weekly boundary and is used **only** for weekly ranking.
3. Season progression **must not** affect leaderboard ranking.
4. No system may award derived status without a verified path to Core XP.

---

## Article IV — Reality Engines

Verified reality enters BTY only through **Reality Engines**.

Each engine:

1. Verifies that something happened in the real world
2. Awards Core XP atomically
3. Reprojects all derived fields from the returned `new_core_xp`

Engines **do not** calculate growth. They **submit** verified reality.

Known engines (growing set):

| Engine | Role |
|--------|------|
| Action Engine | Verified action contracts (QR-backed commitments) |
| Reality Event Engine | Verified event attendance |
| Learning Engine | Verified learning completion *(planned — third engine)* |

Future engines (Mission, Volunteer, etc.) use the **same contract**.

---

## Article V — Verification

Without verification, there is no trusted growth.

QR is not the product. QR is the **verification language** — one of several proof mechanisms, not the goal itself.

Arena leadership QR and Event QR are **separate families**. They must not be overloaded into one validation path.

---

## Article VI — TODAY

The home of BTY is **TODAY** — not a dashboard.

TODAY answers: *What should I do in the real world today?*

ACTION, EVENT, and LEARNING are surfaces that feed TODAY.  
All product roads return to TODAY.

---

## Article VII — Identity and Avatar

Avatar visualizes **verified growth**. It is not decoration.

Identity is **earned**, never fabricated.  
Codes, tiers, and stages are expressions of accumulated verified behavior — not shortcuts.

---

## Article VIII — Culture Before Gamification

Points recognize actions that already matter culturally.  
People must not perform hollow actions merely to earn points.

If gamification and culture conflict, **culture wins**.

---

## Article IX — System Boundaries

BTY has three implementation systems. Each modifies **only its own code**:

| System | Domain | Purpose |
|--------|--------|---------|
| **Arena** | Practice, verification, XP, leaderboard | Reflection of verified leadership behavior |
| **Center** | Recovery, reflection, letters, train | Inner alignment and reset |
| **Foundry** | Programs, rehearsal | Skill building toward action |

Cross-system domain modification is forbidden without explicit architecture review.

Boundary map: [`architecture/ARCHITECTURE_MAP.md`](./architecture/ARCHITECTURE_MAP.md)

---

## Article X — Documentation Law

Only three document **types** grow the permanent product record:

1. **Constitution** — this file; almost never changes
2. **Architecture** — one doc per major system when that system is born
3. **Decision Records (ADR)** — why a specific choice was made; append-only

**Ledger** (shipped work log) is automatic: [`CURSOR_TASK_BOARD.md`](./CURSOR_TASK_BOARD.md), [`CURRENT_TASK.md`](./CURRENT_TASK.md).

Everything else is either code or disposable planning.

### Last resort

**New documents are the last resort.**

Before any new doc: can the idea be explained within Constitution, Boot, or an existing ADR?  
If yes → **write code**, not docs.

| Add… | When |
|------|------|
| ADR | A new **Why** that will be questioned in a year |
| State / Roadmap | Reality or priority changed |
| Canon / Boot / Rules | Almost never |

Product progress is proven by the **running app**, not by new specifications.

**Architecture Freeze:** architecture is closed. New features default to **code only**. See [`BTY_IMPLEMENTATION_RULES.md`](./BTY_IMPLEMENTATION_RULES.md) §0.

Before creating any new document, ask:

> *Will this prevent the same AI mistake ten times?*

If no — do not create it.

Boot and onboarding meta-docs (`BTY_AI_BOOT`, `BTY_AI_ONBOARDING`) are LOCKED.  
`BTY_PROJECT_STATE` and `BTY_PRODUCT_ROADMAP` update as the product moves.  
**ADR** (`docs/decisions/`) records *why* — append-only, never re-debate without a new ADR.

---

## Article XI — The Override Question

Every implementation must pass:

> *Does this bring people back into reality?*

If no — it does not belong in BTY.

---

## Related permanent docs

| Doc | Role |
|-----|------|
| [`BTY_CANON.md`](./BTY_CANON.md) | Identity voice, 7-step loop, AIR — locked |
| [`BTY_AI_BOOT.md`](./BTY_AI_BOOT.md) | AI thinking boot sequence |
| [`decisions/README.md`](./decisions/README.md) | Decision Records — why choices were made |
| [`ARENA_CANONICAL_CONTRACT.md`](./ARENA_CANONICAL_CONTRACT.md) | Arena action-contract field authority |
| [`architecture/DOMAIN_LAYER_TARGET_MAP.md`](./architecture/DOMAIN_LAYER_TARGET_MAP.md) | Layer import law |

---

*Version: 1.0 · Status: LOCKED (BIOS) · Established: 2026-06-25*
