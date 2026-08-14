# BTY Project State

**Purpose:** Where BTY is **right now** — not the roadmap, not how features work.  
**Updated:** 2026-06-25  
**Companion:** [`BTY_PRODUCT_ROADMAP.md`](./BTY_PRODUCT_ROADMAP.md) (what we build next)

**Refresh rule:** Update when a **system ships**, a **deploy** changes live behavior, or **ledger** records a material state change.

Read [`BTY_PRODUCT_CONSTITUTION.md`](./BTY_PRODUCT_CONSTITUTION.md) and [`BTY_AI_BOOT.md`](./BTY_AI_BOOT.md) before this file.

---

## Snapshot

| Area | State |
|------|-------|
| **Architecture Phase** | **CLOSED** — frozen; see Implementation Rules §0 |
| **Project mode** | **Product-Driven** — evidence = running app |
| Action Engine | Backend mature; partial TODAY UI |
| Reality Event Engine | Backend slices 1–2b done; **no UI** |
| Learning Engine | **Not started** |
| TODAY Home | Early slice only — **not unified** |
| Avatar platform | Infrastructure exists; 12-avatar journey **not built** |
| TII / Team Culture | **Deferred** |

---

## What is solid (do not re-litigate)

**Locked OS (Architecture Freeze):** Constitution · Boot · Reality OS · ADR · Ledger · Reality Engine contract · Event Engine · Core XP Root · SDK contract · AI Onboarding.

| Layer | State |
|-------|-------|
| Permanent law | [`BTY_PRODUCT_CONSTITUTION.md`](./BTY_PRODUCT_CONSTITUTION.md) — LOCKED |
| AI thinking | [`BTY_AI_BOOT.md`](./BTY_AI_BOOT.md) — LOCKED |
| Identity voice | [`BTY_CANON.md`](./BTY_CANON.md) |
| Code architecture | Domain → Service → API → UI; Arena / Center / Foundry boundaries |
| Core XP model | Core XP = root; Weekly XP = ranking window only; season ≠ leaderboard |
| Reality Engine contract | `award() → new_core_xp → reproject(new_core_xp)` |
| Arena engine core | Scenarios, action contracts, leadership engine, pattern engine, Action QR (`aalo1`) |
| Auth & deploy | Supabase + NextAuth; Cloudflare Workers staging; release gate checklist exists |

---

## Reality Engines — current

| Engine | Backend | UI / experience |
|--------|---------|-----------------|
| **Action** | Mature — contracts, QR, pending API | Partial — `PendingActionList` on `/bty` |
| **Reality Event** | Schema live; create + scan routes; RPC award + ACL revoke applied | **None** |
| **Learning** | **Not started** | **Not started** |

Event Engine: code committed to inner-main; **confirm staging deploy** before assuming live (see ledger).

---

## TODAY home — current

- `GET /api/arena/action-contracts/pending` — exists
- `PendingActionList` on `/bty` — exists (actionable filter applied)
- EVENT surface — not integrated
- LEARNING surface — not integrated
- Full ACTION / EVENT / LEARNING unification — **not built**

---

## Avatar & identity — current

- Avatar platform, code badges, outfit lock (MVP), Core XP → display pipeline — **exists**
- 12-avatar growth **experience** — not built (on roadmap)

---

## TII & team culture — current

**Deferred.** Event Engine slice 1 excluded org/TII by design.

---

## Recent ledger (2026-06-24)

Full ledger: [`CURSOR_TASK_BOARD.md`](./CURSOR_TASK_BOARD.md) · [`CURRENT_TASK.md`](./CURRENT_TASK.md)

- Reality Event Engine: tables + create/scan + `bty_event_scan_award` RPC live; PUBLIC EXECUTE revoked on definer fn
- Root rule: Verified Reality → Core XP → all else derived
- `/bty` hub: pending actions UI
- AI onboarding system established (2026-06-25)
- ADR index: [`decisions/README.md`](./decisions/README.md) — ADR-001 through ADR-005

---

## What not to do (from current state)

- Do not write Event/Learning "Design v4" docs — build engines
- Do not merge Event QR into Action QR validation paths
- Do not duplicate XP/leaderboard rules in UI
- Do not scope-creep TII into engine slices without Commander go

---

## Code pointers (not specs)

| System | Path |
|--------|------|
| App root | `bty-app/` |
| Event Engine | `bty-app/src/app/api/bty/events/`, `bty-app/src/lib/bty/event-qr/` |
| Action pending | `bty-app/src/app/api/arena/action-contracts/pending/` |
| Migrations | `bty-app/supabase/migrations/` |

Feature behavior: **read the code**.

---

*Next update trigger: Learning Engine started, deploy changes live Event routes, or TODAY milestone ships.*
