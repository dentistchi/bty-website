# B2 — Daily FREE Karaoke Minutes: Server Contract (native + web)

The **single server truth** both the native SwiftUI Admin and the web Admin render from.
Neither client re-computes thresholds, remaining time, or the reset boundary — the
server (`karaoke_free_minutes_entitlement_at` SQL RPC → `domain/usage.ts` projection)
decides everything and returns a resolved `bannerKind` + `startBlocked`.

Enforcement is gated by one row: `karaoke_usage_policy.enforcement_enabled`.
**Rollback = `enforcement_enabled = false`.** No code revert, no migration, no data change.

---

## 1. Usage projection endpoint (poll this)

```
GET /api/rooms/{slug}/dj/usage
Authorization: Bearer {dj-or-admin-credential}
```

Returns the owner account's live usage state. Poll it on the same cadence as
`/dj/queue` (~4 s). Response:

```jsonc
{
  "usage": {
    "plan": "FREE",              // or "PRO"
    "enforcementEnabled": true,  // false in B1 / after rollback
    "unlimited": false,          // true for PRO
    "limitSeconds": 900,         // null for PRO
    "remainingSeconds": 742,     // server-clamped >= 0 (never negative); null for PRO
    "usedSeconds": 158,
    "nextResetAt": "2026-07-24T11:00:00.000Z", // server-computed instant
    "timezone": "America/Los_Angeles",
    "isPlaying": true,           // a song is currently on stage for this account
    "bannerKind": "normal",      // the resolved state — SEE §3
    "startBlocked": false        // true iff a new metered start is blocked right now
  }
}
```

`usage` is `null` when the room has no unambiguous single owner → render no banner.

---

## 2. Start / lifecycle endpoints (unchanged shapes + one new outcome)

All the existing endpoints keep their behavior; the only addition is the
`upgrade_required` outcome + a `usage` snapshot when the FREE limit blocks a start.

| Action | Endpoint | Blocked result |
|---|---|---|
| Manual play (Admin) | `PATCH /rooms/{slug}/requests/{id}` `{action:"play"}` | **HTTP 402** `{code:"upgrade_required", usage}` |
| First-song ensure | `POST /rooms/{slug}/dj/start` | **HTTP 402** `{code:"upgrade_required", usage}` |
| Pass-turn (complete + next) | `POST /rooms/{slug}/dj/pass-turn` | **HTTP 200** `{completed:true, promoted:null, reason:"upgrade_required", usage}` |
| Auto-next after complete/skip | `PATCH /rooms/{slug}/requests/{id}` `{action:"complete"\|"skip"}` | **HTTP 200** `{ok:true, promoted:null, upgradeRequired:true, usage}` |

Key guarantees the client can rely on:

- **A blocked start mutates NOTHING** — no request status change, no segment, no queue
  move. The 402 body's `usage` is the truthful post-check snapshot.
- **The current song is never force-stopped.** On pass-turn/auto-next the current song
  has already **completed normally** (`completed:true`); only the *next* start is blocked.
- **Reopen is not a start.** Re-opening the currently-playing request's YouTube URL does
  NOT hit these gates (it never opens a new segment) — keep it available at zero.

---

## 3. `bannerKind` → what to render (the ONE decision table)

| `bannerKind` | When | Render (calm, non-red for warnings) |
|---|---|---|
| `pro` | PRO plan | nothing (or a simple "PRO · 무제한") — **no FREE countdown** |
| `disabled` | `enforcementEnabled=false` | nothing — no active-enforcement warning |
| `normal` | FREE, remaining > 300 s | `FREE · 오늘 남은 무료 시간 mm:ss` + `Resets at {nextResetAt}` |
| `five_min` | 120 < remaining ≤ 300 | "5분 남았어요 — 재생 중인 곡은 끝까지 부를 수 있어요." (amber) |
| `two_min` | 0 < remaining ≤ 120 | "2분 남았어요 — 지금 시작한 곡은 끝까지 부를 수 있어요." (amber) |
| `zero_playing` | remaining ≤ 0 **and** a song is playing | "무료 시간을 모두 사용했어요. 이 곡은 끝까지, 다음 곡은 시작할 수 없어요." |
| `zero_idle` | remaining ≤ 0 **and** nothing playing | "무료 시간을 모두 사용했어요. PRO로 업그레이드하면 다음 곡을 시작할 수 있어요. {reset}에 초기화돼요." (block/red) |

Rules (§10/§11): the five-minute and two-minute states are **mutually exclusive** — show
only the strongest. Warnings are **not** red. Red is reserved for `zero_idle` (the true
block). `remainingSeconds` is already clamped ≥ 0 — never display a negative.

---

## 4. Native SwiftUI (separate `BTYNorebangAdmin` repo)

The native app stays **fully native** — no WKWebView player, no `/player` navigation,
no web fallback. It already polls `/dj/queue` with a Bearer credential; add:

1. Poll `GET /dj/usage` on the same timer; decode `usage`.
2. Render the banner from `bannerKind` (§3). Format `remainingSeconds` as `mm:ss` and
   `nextResetAt` in `timezone` — **do not** recompute the reset locally.
3. Before opening YouTube on a Start, call the existing Start endpoint. On **402
   `upgrade_required`**, do **not** call `ExternalURLOpener` — show the zero state from
   the 402 body's `usage`. On **200**, hand off through `UIApplication.shared.open` as
   today.
4. **Reopen** of the current song calls the opener directly (no Start endpoint) — never
   blocked.
5. The banner is reconstructed from `/dj/usage` on every foreground/relaunch, so the
   correct state survives app restarts and a second device on the same account.

---

## 5. Rollback

```sql
update public.karaoke_usage_policy set enforcement_enabled = false where policy_key = 'default';
```

With enforcement off: every start succeeds as in B1, `bannerKind` is `disabled` (no
banner), `startBlocked` is always `false`. No other change is required.
