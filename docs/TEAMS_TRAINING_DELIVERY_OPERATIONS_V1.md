# Teams Training Delivery — Operational Requirements V1

Status: measured in production 2026-09-22. Companion to
`TEAMS_CHAT_NATIVE_TRAINING_V1.md` (what the feature does) and
`TEAMS_NATIVE_TRAINING_DELIVERY_V1.md` (how a Host sends).

This document exists because "Send in Teams" can be **fully correct in code and still
deliver nothing**, for a reason that lives in the Microsoft 365 tenant rather than in this
repository. That reason is recorded here so it is treated as an operating step, not
re-diagnosed as a bug.

---

## 1. The hard requirement

> **The BTY app must be installed in a person's PERSONAL scope before the bot can send
> them anything.**

A bot may not open a 1:1 chat with someone who has not installed it. This is a Microsoft
platform rule, not a BTY policy and not a permission we can widen our way around. There is
no Graph scope in our consent grant that changes it, and requesting one is explicitly out
of scope: `User.Read.All` (application) is the only Graph application permission this
product is authorized to hold.

So delivery has two independent preconditions, and both must hold:

| Precondition | Owned by | Proven by |
|---|---|---|
| The recipient is a real, enabled, same-tenant Member | Microsoft Entra | `graph_validation` = `eligible` |
| The BTY app is installed for that recipient personally | **the tenant / the recipient** | `conversation_resolution` ≠ `not_installed` |

The second one is the operational step. Nothing in this codebase can satisfy it.

---

## 2. How the tenant satisfies it

Either path works; the first is what an organization normally does.

1. **Admin-driven (recommended).** A Teams administrator publishes the BTY app to the
   tenant's app catalog and assigns it to the relevant people with an **app setup policy**
   that installs it in personal scope. Everyone in the policy becomes reachable without
   being asked to do anything.
2. **Self-service.** The person opens Teams → Apps → finds BTY → **Add**. One message to
   the bot also suffices, because the first inbound activity is what gives us a durable
   conversation reference.

Until one of these happens for a given person, that person cannot be sent training in
chat. They can still be trained through the existing web room link, which is unaffected.

---

## 3. What the Host sees, and why that is the fix

Before this slice the Host saw a generic failure and the product recorded nothing, so a
tenant-side install gap was indistinguishable from a broken deploy. The Host now reads a
plain product sentence naming the actual cause — for `not_installed`:

> *"These people have not added the BTY app in Teams yet. Ask them to open Teams, find
> BTY under Apps, and add it — then send again."*

That sentence is the deliverable of the diagnosis. It is grouped by cause with the
affected names beneath it, and it is copy, never a Microsoft error string: raw Graph and
Bot Framework messages are never shown to a Host and never stored.

---

## 4. Where the evidence lives

`foundry_teams_training_delivery_attempts` records one row per recipient per stage:

- `graph_validation` → `eligible` | `not_eligible`
- `conversation_resolution` → `reusable_conversation` | `not_installed` | `conversation_failed`
- `card_send` → `delivered` | `send_failed` | `delivery_unknown`

It is **server-only**: RLS on with zero policies, and `anon`/`authenticated` grants
revoked, so no client can read it. It stores no token, no email, no UPN, no serviceUrl and
no Microsoft message text — only a short symbolic failure code matching
`^[A-Za-z0-9._-]{1,80}$`, which is enforced in code as an allow-list rather than a
length/whitespace filter (a compact JSON error body passes a naive filter).

To check a single recipient without sending anything, the admin-gated preflight
`POST /api/bty/admin/teams-delivery-preflight` runs the Graph check and **reads** the
conversation reference. It never creates a conversation, never posts an activity and never
writes a delivery row.

---

## 5. Production state as measured 2026-09-22

- Graph client-credentials: working (`graph_validation` = `eligible` for every probed recipient).
- Tenant route: present, one tenant, one serviceUrl.
- Bot Framework token: acquired successfully.
- Conversation references in the whole tenant: **2**, both created 2026-09-03, i.e. before
  this feature existed. Both resolve as reusable.
- Deliveries ever sent: 0. Chat-native sessions ever created: 0.

Read together: the pipeline is healthy end to end for a person the bot can reach, and the
population the bot can reach is two accounts. Everyone else is blocked at §1's second
precondition. **Installing the app for the intended recipients is the remaining step**,
and it is a tenant action.

---

## 6. Rules for whoever touches this next

- A recipient who cannot be reached is **not** an error to retry, log louder, or work
  around. Surface the reason and stop.
- Never substitute a web link, an email, or an anonymous room for a person the bot cannot
  reach silently — if the Host chose Teams delivery, a different channel is the Host's
  decision to make, not a fallback to perform.
- Identity stays `tenant_id` + `aadObjectId`. Email, UPN, display name and any
  client-supplied id remain non-identities here.
- Do not add Graph `TeamsAppInstallation.*` scopes to make installation programmatic
  without an explicit, separate authorization.
