# Unified Program + Live Experience — Canonical Contract V1

**Slice 3.2B — DOCUMENTATION-ONLY RATIFICATION.** No code, migration, data, deploy, or
production change. This document converts the closed Slice 3.2A reality measurement and the
Founder-ratified decisions into the smallest durable canonical contract.

**Status:** Ratified · V1 · 2026-07-26
**Supersedes local assumptions about:** "Quick Training", "Module", "Event", "Practice",
"Field Day", "Activity", "Checkpoint".
**Authority:** This contract governs product/domain *meaning* only. It creates no schema and
renames no table. Where it names a table, that mapping is descriptive of current reality.
Read alongside `ARENA_CANONICAL_CONTRACT.md`, `FOUNDRY_DOMAIN_SPEC.md`, and
`FOUNDRY_IDENTITY_BOUND_PARTICIPATION_CONTRACT.md`; on any conflict about Program/Experience
*vocabulary*, this document wins.

---

## 0. Verdict carried forward (from Slice 3.2A)

**C — Program and Live Experience are separate canonical roots that reuse shared
infrastructure.**

- **Program ≈ B:** the Foundry runtime spine already implements most Program behavior
  (definition → published occurrence → audience → assignment → participation → completion →
  evidence → reward linkage). Naming it is mostly projection + a thin lineage extension.
- **Live Experience = C:** its defining primitives — schedule (`starts_at`/`ends_at`/
  timezone), location, one Experience Run → many Activities, and Checkpoints — **do not
  exist in any table today** and require a new root.

No structural conflict blocks additive introduction. The naming/lineage debt (two "event"
tables, two membership tables, "run"/"practice" overloading, dormant Arena quick_mode) is
isolated and must simply never be collapsed.

---

## 1–25. Canonical terms

Each term separates: **Product meaning** · **Current implementation mapping** ·
**Future extension boundary**. `NOT CURRENTLY PERSISTED` marks concepts with no table today.

### 1. Program
- **Meaning:** A durable *learning identity* — the stable name/thing a learner returns to,
  independent of any single design revision or run.
- **Now:** `NOT CURRENTLY PERSISTED` as a first-class identity. The nearest live proxy is a
  `program_catalog` row (static tag catalog) and the module-draft lineage. A Program identity
  spanning versions does not yet exist as a row.
- **Future:** A `program` identity row is the target of the *next* implementation slice
  (§Next Boundary). It owns nothing runnable — only identity + discovery policy.

### 2. Program Version
- **Meaning:** A versioned *learning design* under a Program identity. Immutable once
  published; a new design = a new Version.
- **Now:** `foundry_module_drafts` (mutable authoring, `status draft→approved→published`,
  lineage via `parent_module_id`, `module_version`) is the nearest reusable-definition
  representation. There is no `program_version` row binding versions to a Program identity.
- **Future:** V1 canonical rule: **one Program Version = one Module** (see §3). Multi-module
  composition is deferred.

### 3. Module
- **Meaning:** The *learning design unit* within a Program Version (problem → capability →
  observable behavior → evidence → reflection/action prompts).
- **Now:** `foundry_module_drafts` (authoring) + `foundry_event_module` (immutable published
  snapshot, 1:1 with a `foundry_events` row via `event_id` PK, `source_draft_id UNIQUE` =
  publish idempotency). A Module is **not** a runnable object — it is a design snapshot bolted
  onto an occurrence.
- **Future:** Multi-module Programs are a future extension **only after a concrete product
  need is measured**. V1 treats Module and Program Version as effectively 1:1.

### 4. Quick Program
- **Meaning:** A Program created through a *faster authoring path* — a single-Module,
  lightweight format. Same object family as Program, not a separate system.
- **Now:** A quick-**created** `foundry_events` row (a Foundry event published without the
  Guided Module Builder). Per `foundryPublishService`, such an event is "indistinguishable
  from a published-module event except its snapshot/lineage."
- **Future:** No `quick_training` table. **Not** Arena `quick_mode` (a dormant, unapplied,
  shell-orphaned Arena session preset — `user_pattern_history.source_mode='quick_mode'` lives
  only in `migrations-hold/`). Quick Program is a preset of Program authoring, nothing more.

### 5. Program Run
- **Meaning:** One executable *occurrence* of a Program Version. The runtime unit a learner
  actually engages. **Owns** audience snapshot, assignments, participation, completion,
  evidence, and reward linkage (Founder decision 1).
- **Now:** `foundry_events` (+ its 1:1 content child: `foundry_event_training_content` /
  `foundry_event_document_content` / `foundry_event_module`). Repetition = a **new**
  `foundry_events` row sharing module lineage, never a child occurrence.
- **Future:** A Program Run may later carry an explicit FK to a `program`/`program_version`
  identity; today the link is lineage columns (`source_draft_id`, `module_version`).

### 6. Program discovery
- **Meaning:** Who may *find* a Program (distinct from who is assigned it).
- **Now:** `program_catalog` RLS is `select using(true)` (global) — this is legacy reality,
  **not** the canonical default.
- **Future (Founder decision 2):** Canonical default discovery is **organization-scoped**.
  Open-link / public discovery must be an **explicit publication mode**, never inherited from
  today's broad `program_catalog` reads.

### 7. Program audience and assignment
- **Meaning:** *Audience* = the declared intended set at publish. *Assignment* = the frozen
  recipient set derived from it. Both belong to the **Program Run**, never to the Program
  definition (Founder decision 1). A Program may be discoverable without being assigned.
- **Now:** `foundry_event_audience_snapshot` (declaration: `everyone|leaders|job_group|
  specific_role`, org-scoped, resolver-versioned) + `foundry_event_assignments` (recipient
  set, one row per (event, membership), immutable `*_snapshot` columns, `status assigned|
  claimed|completed|revoked`). Resolution reads canonical `bty_org_memberships` only.
- **Future:** Reused unchanged by the Program root. No assignment redesign.

### 8. Program participation and completion
- **Meaning:** *Participation* = actual engagement. *Completion* = the engagement reached its
  defined end. Distinct from assignment and from verification.
- **Now:** `foundry_event_participants` (anonymous join; name + token hash; `status joined|
  removed`) + `foundry_event_training_progress` (`completed_at`, `completion_state pass|
  review|incomplete`, private `response_text`). Assignment→participation bridge = nullable
  `foundry_event_assignments.participant_id`, filled only at claim.
- **Future:** Reused unchanged.

### 9. Practice
- **Meaning:** A scenario a learner rehearses. Two current meanings kept distinct:
  - **Foundry Practice** = an authored practice, isolated, **zero XP by construction**.
  - **Canonical Arena run** = the XP-bearing scenario playthrough.
- **Now:** Foundry Practice = `foundry_published_arena_practices` (immutable
  `scenario_snapshot`, `availability='all_members'`) + `foundry_arena_practice_runs`
  (`in_progress|completed`, no XP columns). Canonical Arena = `arena_runs` + `arena_events`.
- **Future:** A Practice may become a Program component or an Activity target. Its zero-XP
  isolation must be preserved.

### 10. Field Action
- **Meaning:** A Foundry-anchored *real-world action* a learner commits to after completing a
  Module. A Program **component**, not a standalone system.
- **Now:** `bty_action_contracts` where `action_type='field_action'` (derived from a completed
  `foundry_event_assignments` + `foundry_event_training_progress`; `run_id` NULL). Rides the
  shared `submit-validation` → `bty_org_action_review_authority` → `bty_resolve_action_review`
  → `bty_action_review_decision_audit` spine.
- **Future (Founder decision 3):** Submission = **zero XP**; approval = **verified evidence,
  zero XP**. Do **not** add XP here or in the next Program-root slice. A future dedicated XP
  reconciliation may later decide whether approved Field Action earns **Core XP only**.

### 11. Follow-up
- **Meaning:** A dated, **self-reported** later outcome. Evidence of intent to sustain, never
  third-party verification.
- **Now:** `foundry_participant_followups` (`status PENDING|RESPONDED`, `outcome APPLIED|
  PARTLY_APPLIED|NOT_YET|BLOCKED`, `due_at`). Foundry-only today.
- **Future:** Maps to the SUSTAINED Evidence rung when re-confirmed (Founder decision 4). Not
  a required V1 state.

### 12. Live Experience
- **Meaning:** A reusable *identity* for a shared real-world experience (Field Day, Doctor's
  Day, Benefit Day, Mission Trip, Annual Retreat). The durable name, not a single occurrence.
- **Now:** `NOT CURRENTLY PERSISTED`.
- **Future:** New canonical root (own slice, after Program root). Owns only identity; runnable
  detail lives on the Experience Run.

### 13. Experience Run
- **Meaning:** One *scheduled occurrence* of a Live Experience. Owns start/end/timezone,
  location, host/owner, invitation/audience, and lifecycle status.
- **Now:** `NOT CURRENTLY PERSISTED`. No event table has `starts_at`/`ends_at`/timezone or
  `location` (`bty_events` has only `valid_until`; `foundry_events` only `created_at`/
  `closed_at`).
- **Future:** New root. Reuses the assignment/participation/QR-signing/XP/evidence patterns;
  must **not** reuse the `foundry_events` row itself (Program Run ≠ Experience Run).

### 14. Activity
- **Meaning:** A *child unit within an Experience Run* (one Run → many Activities).
- **Now:** `NOT CURRENTLY PERSISTED`. No one-to-many child relationship exists anywhere; every
  current content table is strictly 1:1 with its event. Foundry "content types" are variants
  of one event, **not** Activities.
- **Future:** New one-to-many table. An Activity may optionally launch/reference a Program Run
  (§21). Field Day ≠ Activity (the Experience is the parent, the Activity is the child).

### 15. Checkpoint
- **Meaning:** A *verifiable point* within an Activity or Experience Run.
- **Now:** `NOT CURRENTLY PERSISTED`. No table, column, or code.
- **Future:** New child object. Verification reuses the QR-verify + `le_verification_log`
  OBSERVED seam. Checkpoint completion ≠ participation.

### 16. Invitation / Assignment
- **Meaning:** The *intended recipient/invitee set* — who should receive/attend. Pre-
  participation. Never proof of attendance.
- **Now:** Program Run = `foundry_event_assignments`. Experience Run invitation =
  `NOT CURRENTLY PERSISTED` (reuses the assignment pattern when built). Reality QR events have
  no audience at all.
- **Future:** Experience invitation reuses the frozen-recipient-set pattern; open-link joining
  remains possible where explicitly enabled.

### 17. Participation
- **Meaning:** *Actual* engagement/attendance. Structurally separate from invitation/
  assignment and from completion.
- **Now:** `foundry_event_participants` / `foundry_event_training_progress` (Foundry);
  `bty_event_participation` (Reality QR scan, identity-bound, idempotent). Bridge to assignment
  is the nullable `participant_id`.
- **Future:** Experience participation is a new table following the same anonymous-join +
  optional-identity-claim shape.

### 18. Evidence
- **Meaning:** The honest ladder of what actually happened. Rungs:
  `ASSIGNED · EXPOSED · REFLECTED · DECIDED · PRACTICED · APPLIED · OBSERVED · SUSTAINED`.
- **Now (current persistence):**
  - ASSIGNED — `foundry_event_assignments.status='assigned'` / `bty_action_contracts.status='pending'`
  - EXPOSED — **weak**: `video_started_at` / participant `joined` only
  - REFLECTED — `foundry_event_training_progress.response_text` / `reflection`
  - DECIDED — `arena_events CHOICE_CONFIRMED` / contract creation
  - PRACTICED — `arena_runs` / `foundry_arena_practice_runs` / Foundry completion
  - APPLIED — **self-reported**: contract `status='submitted'` / follow-up `outcome='APPLIED'`
  - OBSERVED — **third-party**: `le_verification_log.verified` + `bty_action_contracts.verified_at` + decision audit + QR verify
  - SUSTAINED — **partial, Foundry-only, self-reported**: `foundry_participant_followups`
- **Future (Founder decision 4):** SUSTAINED stays a valid rung, not a required Arena/Program
  V1 state. `PRACTICED = practice completed`, `APPLIED = field application self-reported`,
  `OBSERVED = third-party verification`, `SUSTAINED = later persistence re-confirmed`.

### 19. QR
- **Meaning:** A *trigger / access mechanism*. It opens a Program Run, Activity, Field Action,
  or Checkpoint. It is **not** a content type, a Program, an Activity, a Checkpoint, or an XP
  source by itself (Founder decision 9).
- **Now:** Three hard-coded, separately-secured token families — `aalo1` (action-loop /
  Field-Action verify), `btyev1` (Reality event scan), `btyfr1` (Foundry room join). **No
  polymorphic target** (`target_type`/`target_id` do not exist).
- **Future:** A new trigger (Activity/Checkpoint) follows the `btyfr1` template (signed token +
  `version` rotation + service-role redemption RPC + idempotency). QR generalization is **out
  of scope** for the next Program-root slice.

### 20. XP
- **Meaning:** A *reward/projection* layer. It does **not** own Program, Experience, Activity,
  Checkpoint, or participation (Founder decision 10).
- **Now:** `core_xp_ledger` (permanent, polymorphic `source_type`, idempotent on
  `(user_id, source_type, source_id)`) + `weekly_xp` (ranking, resets). Known debt to respect:
  `core_xp_ledger` is incomplete for Reality-event XP; `weekly_xp_ledger` is unused; two
  overlapping Core-XP uniqueness indexes exist (legacy one is source-global).
- **Future:** New reward sources add a `source_type` string only — no new engine. XP changes
  are **out of scope** for the next slice.

### 21. Program ↔ Live Experience reference
- **Meaning:** **One-directional only:** `Live Experience → Activity → optional Program Run`.
  An Activity may launch or reference a Program Run. A Program must never own or embed a Live
  Experience (Founder decision 8).
- **Now:** `NOT CURRENTLY PERSISTED` (no Activity object).
- **Future:** Activity carries a nullable reference to a Program Run. Never the reverse.

### 22. Definition vs occurrence
- **Meaning:** A reusable *definition* is authored, versioned, and immutable once published; an
  *occurrence* is one runnable instance produced from it. Never the same object.
- **Now:** Definition = `foundry_module_drafts` / `foundry_event_module` snapshot /
  `foundry_published_arena_practices`. Occurrence = `foundry_events` + per-user runs
  (`foundry_event_training_progress` / `foundry_arena_practice_runs`). Bridge = `source_draft_id`
  + version columns.
- **Future:** Program identity/version (definition) vs Program Run (occurrence); Live Experience
  (definition) vs Experience Run (occurrence). Same discipline both sides.

### 23. Versioning and immutable snapshots
- **Meaning:** Versions advance by **new row + monotonic counter + parent lineage**, never
  in-place edit. Publish **freezes** a whitelist snapshot; the snapshot is the authority for
  that occurrence forever.
- **Now:** `foundry_module_drafts.module_version` + `parent_module_id`; `buildModuleSnapshot()`
  whitelist copy into `foundry_event_module`; `source_draft_id UNIQUE` = publish idempotency;
  `foundry_published_arena_practices` unique `(source_draft_id, source_draft_revision)`.
- **Future:** Program Version and Experience Run snapshots follow the identical pattern.

### 24. Current persisted-object mapping
See the consolidated table in §Current Implementation Mapping below.

### 25. Explicit non-collapse invariants
See §Non-Collapse Invariants below (normative).

---

## Current Implementation Mapping

| Canonical term | Current persisted object | State |
|---|---|---|
| Program | *(program_catalog proxy only)* | `NOT CURRENTLY PERSISTED` as identity |
| Program Version | `foundry_module_drafts` (nearest) | partial (no version↔identity binding) |
| Module | `foundry_module_drafts` + `foundry_event_module` | persisted |
| Quick Program | quick-created `foundry_events` row | persisted (format, not a table) |
| Program Run | `foundry_events` (+ 1:1 content child) | persisted |
| Practice | `foundry_published_arena_practices` + `foundry_arena_practice_runs` (zero-XP) · vs `arena_runs` (XP) | persisted |
| Field Action | `bty_action_contracts` (`action_type='field_action'`) | persisted |
| Follow-up | `foundry_participant_followups` | persisted |
| Live Experience | — | `NOT CURRENTLY PERSISTED` |
| Experience Run | — (no schedule/location anywhere) | `NOT CURRENTLY PERSISTED` |
| Activity | — (no one-to-many child) | `NOT CURRENTLY PERSISTED` |
| Checkpoint | — | `NOT CURRENTLY PERSISTED` |
| Assignment | `foundry_event_assignments` (+ `foundry_event_audience_snapshot`) | persisted |
| Participation | `foundry_event_participants` · `foundry_event_training_progress` · `bty_event_participation` | persisted |
| QR | `aalo1` · `btyev1` · `btyfr1` (3 families, no polymorphic target) | persisted |
| XP | `core_xp_ledger` (Core) · `weekly_xp` (Weekly) | persisted |
| Evidence | `bty_action_contracts.verified_at` · `le_verification_log` · `bty_action_review_decision_audit` · `foundry_event_training_progress` · `foundry_participant_followups` | persisted (ladder partial: EXPOSED weak, SUSTAINED Foundry-only) |
| Org / Membership | `bty_organizations` + `bty_org_memberships` (canonical) · legacy `memberships` (separate) | persisted |

Reality-event lineage (`bty_events` / `bty_event_participation`) is a **separate** thin QR/
Core-XP spine and is **not** a Program Run.

---

## Non-Collapse Invariants (NORMATIVE)

These are locked. Violating any requires explicit Founder re-ratification.

1. Program definition ≠ Program Run
2. Live Experience definition ≠ Experience Run
3. Program Run ≠ Experience Run
4. Module ≠ runnable occurrence
5. Quick Program ≠ separate system
6. Field Day (Live Experience) ≠ Activity
7. Assignment ≠ Participation
8. Participation ≠ Completion
9. Completion ≠ Verification
10. APPLIED ≠ OBSERVED
11. OBSERVED ≠ SUSTAINED
12. QR ≠ target object
13. XP ≠ domain owner
14. `bty_events` ≠ `foundry_events`
15. `bty_org_memberships` ≠ legacy `memberships`
16. Reusable definition ≠ immutable run snapshot

---

## Founder-Ratified Decisions (recorded)

1. **Program assignment ownership** — the Program *definition* owns no assignments; the
   *Program Run* owns audience, assignments, participation, completion, evidence, reward
   linkage. A Program may be discoverable without being assigned.
2. **Program discovery** — default is organization-scoped; open/public discovery is an
   explicit publication mode, never inherited from today's global `program_catalog` reads.
3. **Field Action XP** — preserve current behavior: submission = zero XP, approval = verified
   evidence with zero XP. No XP added in this contract or the next Program-root slice. A future
   dedicated reconciliation may consider Core-XP-only for approval.
4. **SUSTAINED evidence** — valid ladder state, not a required Arena/Program V1 state.
   PRACTICED/APPLIED/OBSERVED/SUSTAINED interpretations locked as in §18.
5. **Program → Module** — V1: Program = identity, Program Version = versioned design,
   Module = the design unit; effectively one Version = one Module. No speculative multi-module
   hierarchy; multi-module composition deferred until a concrete need is measured.
6. **Quick Program** — a faster authoring path / single-Module lightweight format; not a
   separate system, not a `quick_training` table, not Arena `quick_mode`.
7. **Live Experience** — reusable identity; Experience Run owns start/end/timezone, location,
   host/owner, invitation/audience, lifecycle; Activity is a child of a Run; Checkpoint is a
   verifiable point; participation stays separate from invitation/assignment.
8. **Program ↔ Live Experience** — one-directional: Experience → Activity → optional Program
   Run. A Program must not own/embed a Live Experience. Do not collapse Program Run with
   Experience Run, Activity with Program, assignment with participation, or participation with
   checkpoint completion.
9. **QR** — a trigger/access mechanism; not a content type, Program, Activity, Checkpoint, or
   standalone XP source.
10. **XP** — a reward/projection layer; owns no domain object.

---

## Next Implementation Boundary (recommended — do NOT implement in 3.2B)

**Slice 3.2C — Minimal Program Root / Lineage Extension.**

Scope guardrails (all mandatory):
- Reuse the Foundry runtime spine (`foundry_module_drafts` → `foundry_events` +
  `foundry_event_module`); introduce only a durable Program **identity/lineage** seam.
- Additive only. No `foundry_events` rewrite.
- **No** Live Experience tables (Experience Run / Activity / Checkpoint stay unbuilt).
- **No** QR generalization (the three families stay hard-coded).
- **No** XP changes (no new source_type, no Field Action XP).
- **No** assignment/participation redesign.
- Preserve all current open-link and assigned-overlay behavior (absence-of-mode-row =
  open_link; no NOT-NULL column that breaks the 19 legacy events).
- No historical destructive backfill.

Live Experience root, Activity/Checkpoint model, and any QR/XP generalization are **separate
later slices**, each gated on this contract and its own measurement.

---

*Contract ends. Documentation-only. No code, migration, data, deploy, or production change.*
