# SLICE 3.2L — Guided Program Authorship → Canonical Apply — **PASS · CLOSED**

**Closure date**: 2026-08-08
**Closure type**: Adoption authority proven end to end on live staging, by Founder gesture, with read-only forensic reconciliation at every step
**Mutation scope of this document**: outer-only (this closure + two board updates), **0 code changes**
**Inner HEAD at closure**: `8395b081` — *fix(foundry): make pending-proposal continuity work across tabs*
**Live staging Worker**: version `6a90061f-9e14-4fa1-aca1-6bc7eba467b1` (100%), serving source `8395b081cb9f8cff83b9463d3d12f320ffe5b241`, `/api/version` confirmed
**Production**: untouched throughout

---

## 1. What was closed

The slice began with a Guided Program Authorship feature that could produce a program, and ended
with one that can produce a **usable** program and prove, byte for byte, that what a Host reviewed
is what their training actually contains.

Nothing here was closed on reasoning. Every link was executed on live staging, most of it by a
paid provider window pressed by the Founder on a physical device, and reconciled read-only against
the durable ledger afterwards.

---

## 2. The chain, as it was proven

```
generation
  → validation, with one bounded semantic repair inside the SAME parent attempt
  → exact server-computed proposal digest
  → privacy-preserving cross-tab continuity
  → server-owned resume eligibility
  → superseded-attempt refusal
  → one-character tamper refusal (proposal_mismatch)
  → one exact controlled Apply
  → journeyDigest recomputed from the DURABLE journey == attempt.proposal_digest
  → adoption marker naming that attempt and no other
  → first-wins applied_at receipt
  → no approval, no publish, no session, no assignment side effects
```

Each arrow was measured, not assumed. Where something could not be observed — the exact proposal
body before Apply, the Founder's own browser storage — that was stated as unobservable rather than
inferred, and the missing proof was replaced by a stronger one where the architecture allowed it
(the post-Apply digest recomputation below).

---

## 3. Final canonical state

| Field | Value |
|---|---|
| Canonical draft | `093b0361-7cc8-4688-9f93-396d60582501` |
| Adopted attempt | `764411ae-d38a-4e87-9491-bd182f12d1d9` |
| `proposal_digest` | `program_proposal_digest_v1:9d2234db361481d7cb810b1836e94d49b0e6269f6567cf54bf051f37f0d1581b` |
| `programAdoptionV1.attemptId` | `764411ae-d38a-4e87-9491-bd182f12d1d9` |
| `applied_at` | `2026-08-08T20:33:49.35-07:00` |
| Applied attempts, globally | **exactly 1** |
| Parents / calls / digests | **21 / 24 / 3** |
| `status` | `draft` |
| `approved_at` · `published_at` · `program_id` | `null` · `null` · `null` |
| Durable journey | **8** elements |
| Answers digest | `e81926b75f823f314612190fcaa3c21197a7a02980907d1b367eea8e560739e1` |

**Independent verification available only after Apply:** the adopted journey is durable, so
`journeyDigest(durable journey, 7 required kinds)` was recomputed from live data and equals
`764411ae.proposal_digest` **byte for byte**. The exact proposal the Founder reviewed is the exact
proposal their training now contains.

---

## 4. Measured merge semantics — stated precisely

The final durable journey contains **the 7 required BTY program kinds, each exactly once** —
`why_it_matters`, `observable_standard`, `scenario`, `action_decision`, `field_application`,
`completion_check`, `follow_up` — **plus the preserved Host `evidence` element**. None missing,
none duplicated.

Three pre-existing seed kinds — `why_it_matters`, `observable_standard`, `completion_check` —
were **intentionally superseded** by the reviewed BTY program elements through the existing
merge-by-kind semantics. **The Host selected the BTY replacement for each of those sections.**

Two things this is *not*, and must not be recorded as:

- **Not** "four seed elements survived byte-identically." One did — `evidence`, which is not a
  required program kind, which is exactly why it survived and exactly why the digest is scoped to
  required kinds only.
- **Not** silent provenance rewriting. Provenance follows the content a Host chose, and the
  underlying **Host-authored Builder answers remain preserved** — the journey is a rendering of a
  reviewed decision, not a replacement of the Host's own inputs.

---

## 5. Closed sub-areas

| Area | Status |
|---|---|
| Adoption authority | CLOSED |
| Exact proposal identity | CLOSED |
| Receipt atomicity / recovery | CLOSED |
| Generation honesty (material) | CLOSED |
| Evidence ceiling | CLOSED |
| Proposal continuity | CLOSED |
| Cross-tab continuity | CLOSED |
| Apply authority | CLOSED |

---

## 6. Corrections carried into this record

**The R11.5 statement that the `20260811000000` migration tracker remained unreconciled is
withdrawn.** The Founder executed the linked migration-history repair successfully, and
`supabase migration list --linked` subsequently showed Local = Remote = `20260811000000`. It was
never a blocker, and no repair is to be run again. That statement was written from the limits of
this environment (PostgREST cannot reach `supabase_migrations`, and no DB credential is available
here) and was correct about those limits but wrong about the state.

**The R11.5 seed-survival description is superseded by §4 above.**

---

## 7. What the arc cost, and what it bought

Four canonical generations were refused before one succeeded, and each refusal was a real product
defect found by the validator rather than a false alarm:

- `7abebd5b` — `material_fabrication`: the program leaned on a template nobody had provided
- `cdd16aaf`, `db4eaef2` — `evidence_overclaim`: the program claimed more than a training can show
- then `496302b6` and `ece8e133` succeeded but were stranded by continuity defects
- `764411ae` succeeded **on the first provider call** and was adopted

The pattern behind three of those refusals was the same each time and is the arc's most reusable
lesson: **an instruction narrower than its rule produces a refusal the model could not have
avoided.** The fix that finally held was not better wording but a single source — one policy array
generating both the validator's predicates and the author's instructions, with a test that fails if
any rule stops reaching the prompt.

---

## 8. Next measured incomplete product loop

Not started, and deliberately not chosen here. What the measurements already show:

The canonical training is adopted but still `draft`. **"Approve & create session" is the next real
Host action, and it has never been exercised end to end in this arc.** R11.4G classified its
authority as correct-but-previously-misleading and repaired the copy; what remains unmeasured is
the loop *after* it — approve → publish → session → participant → completion — for a training whose
program came from Guided Authorship rather than from Host text alone.

That is the next measurable gap. Slice selection remains the Founder's.
