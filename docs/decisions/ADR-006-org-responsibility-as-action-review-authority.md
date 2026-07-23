# ADR-006 — Org Responsibility as Action Review Authority

**Status:** Accepted
**Date:** 2026-07-23
**Slice:** 3.1B-3N — Host Action Verification & Revision V1

## Context

Arena Action Contracts are **Arena-born** (`bty_action_contracts`, scoped by `user_id` / `run_id` / `pattern_family`) and have **no Foundry event owner** — they carry no `event_id`, `assignment_id`, or `owner_user_id`. Slice 3.1B-3N introduces **remote Host approval** (Founder-authorized for `verification_mode ∈ {hybrid, link}`; `qr` stays QR-witness-only), which requires a **safe, provable reviewer→learner authority edge**: "may this Host review *this* learner's contract?"

Measurement (Phase 0/0.1) established:

- The existing `bty_org_membership_responsibilities` table stores **unary identity facts** — a role key (`PARTNER`, `CLINICAL_DIRECTOR`, `TRAINER`, `TEAM_LEAD`, `PEOPLE_MANAGER`) on **one** membership. It declares "IDENTITY FACTS ONLY … grants nothing" and is "never used for access decisions." It has **no target column** and therefore cannot express which learner a reviewer may review.
- No other table carries a reviewer↔learner edge; Foundry `foundry_event_participants` are **not account-bound** (no `user_id`), so Foundry ownership/participation cannot bridge to Action Contracts.

Deriving authority from *role + same organization* would expose every learner to every role-holder — a cross-owner privacy breach. That inference is explicitly forbidden.

## Decision

Action-review authority is granted **only** through an **explicit, active, one-hop `reviewer_membership → learner_membership` edge** with `authority_key = 'ACTION_REVIEWER'`, stored in the new table `bty_org_action_review_authority`.

- **Same organization** is required (enforced at the DB layer via a validation trigger, plus the curation RPC — defense in depth).
- **Self-review is forbidden** (reviewer membership ≠ learner membership **and** reviewer user ≠ learner user).
- **Both memberships must be active and user-bound** (Action Contracts are `user_id`-scoped).
- **Membership responsibilities, role titles, same-organization membership, Foundry event ownership, and Foundry participation grant NO authority on their own.**
- **V1 is explicit one-hop only** — no transitive/hierarchical/delegated review. `Regional Manager → Office Manager` + `Office Manager → Employee` does **not** imply `Regional Manager → Employee` without a separate explicit edge.
- **Default deny:** absence of an active edge ⇒ no list visibility and no mutation permission. Every list read and every mutation re-runs the authority resolver.
- The edge table is **Action-review-specific**, not a generic organization-hierarchy engine.

Curation is a **service-role-only `SECURITY DEFINER` RPC** (`bty_curate_action_review_authority`, assign/revoke) with a server-resolved actor; the browser never supplies membership, organization, or actor identifiers. All changes write an **append-only audit** row with immutable FK-free snapshots.

## Reason

- A binary edge is the only representation that safely answers "reviewer X may review learner Y." Unary role facts cannot, and org/role inference over-grants.
- Reuses the proven 3.1B-1 durability contract (state table + append-only audit + atomic `SECURITY DEFINER` RPC) rather than inventing a parallel authorization framework.
- Keeps the QR trust path untouched: remote Host approval is a *separate* authorized method, gated by this explicit edge, for `hybrid`/`link` only.

## Consequences

- **No Action Contract ownership migration** is needed — no `event_id`/`owner_user_id` is added to `bty_action_contracts`; the authority lives in its own additive edge table.
- **Responsibility data is not authority.** Production use requires explicitly granting `ACTION_REVIEWER` edges; role assignments alone change nothing.
- **Hierarchy inheritance, delegated/substitute review, and org-wide review remain future work** (a later slice may add explicit scoped grants — never silent transitivity).
- **Owner-scoping is reusable** across the list queue and all mutations through one central resolver.
- **Escalation resolution is out of scope** here (deferred to Slice 3.1B-3O, which must first reconcile the out-of-band escalation-reviewer schema drift). This ADR does not decide the escalation model.
- **Delete-semantics note:** membership FKs use `ON DELETE RESTRICT`; because `bty_org_memberships.user_id → auth.users` cascades, an active edge blocks user deletion until revoked. Audit history survives teardown via immutable snapshots. (Flagged for apply-review.)
