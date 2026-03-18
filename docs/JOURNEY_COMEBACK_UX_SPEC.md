# Journey Comeback Flow & JourneyBoard — UX Spec (implementation-ready)

**Status:** Locked alignment with `docs/JOURNEY_BOUNCEBACK_IA.md`.  
**Audience:** Next.js frontend + UX copy.

---

## 0. Constraints (non-negotiable)

| Rule | Implication |
|------|-------------|
| Journey under **Growth** | Route and nav live under Growth, not Arena / not My Page / not top-level. |
| 28-day recovery loop | Board shows Days 1–28; copy frames **recovery**, not play or rank. |
| Comeback after **3+ days** inactivity | Same trigger as today (`shouldShowComeback()`); logged-in users only. |
| Bounce-back = recovery event only | No XP, leaderboard, or season coupling in UI or API usage from this flow. |
| Default progression | Continue from **`current_day`**; no forced reset. |
| Restart | Optional, user-initiated, **never** default on comeback. |
| **Bounce-back recording** | **`POST /api/journey/bounce-back` only when user taps “Resume Journey”.** Not on dismiss, not on backdrop, not on “Not now”. |

---

## 1. Comeback modal — copy and behavior

### 1.1 Purpose

Inform the user that an **interruption** was detected and offer a **calm path back** into Journey. Do not imply failure, guilt, or competition.

### 1.2 When it shows

- User is **authenticated**.
- Local rule: **≥3 calendar days** since last recorded visit (`shouldShowComeback()`).
- Not on login/auth-only screens (avoid modal over password flows).
- **Once per session** where trigger fires (after show, update last-visit timestamp so repeat spam is avoided — existing pattern).

### 1.3 Modal structure (accessibility)

- `role="dialog"` · `aria-modal="true"` · `aria-labelledby` → title id.
- Focus moves to dialog on open; trap focus inside; Escape closes with **same behavior as “Not now”** (no bounce-back POST).

### 1.4 Copy (locked tone)

| Element | EN | KO |
|---------|----|----|
| **Title** | Interruption noted | 일시 중단이 감지되었습니다 |
| **Body** (1–2 short paragraphs) | Your Journey is still here. You can continue from where you left off—no progress is reset unless you choose to restart later. | 여정은 그대로 남아 있어요. 원하시면 멈춘 지점부터 이어가실 수 있어요. 별도로 다시 시작을 선택하지 않는 한 진행이 초기화되지 않습니다. |
| **Primary CTA** | Resume Journey | 여정 이어가기 |
| **Secondary CTA** | Not now | 나중에 |

**Avoid in all strings:** “missed you,” “finally back,” streaks, points, rank, “level up,” shame, urgency countdowns.

### 1.5 Behavior matrix

| User action | Navigate | `POST /api/journey/bounce-back` | Notes |
|-------------|----------|----------------------------------|-------|
| **Resume Journey** | Yes → `/{locale}/growth/journey` | **Yes** (await or fire-and-forget; then navigate) | Primary recovery path. |
| **Not now** | No | **No** | Modal closes only. |
| Backdrop click / Escape | No | **No** | Same as Not now. |

**Implementation bug to fix if present:** Any code that calls bounce-back on dismiss or “Not now” **violates this spec** and must be removed.

---

## 2. JourneyBoard — text wireframe

**Route:** `/{locale}/growth/journey` (Growth subtree; not Arena).

```
┌─────────────────────────────────────────────────────────────┐
│  [Growth breadcrumb or back → Growth hub]   (optional)      │
├─────────────────────────────────────────────────────────────┤
│  Journey                                                     │
│  28-day recovery sequence · continue at your pace            │
│  (subline: observational, no streak language)                │
├─────────────────────────────────────────────────────────────┤
│  Progress                                                    │
│  Day {current_day} of 28                                     │
│  (linear indicator or calm progress bar — not XP-shaped)     │
├─────────────────────────────────────────────────────────────┤
│  Grid or list: Day 1 … Day 28                                │
│  · Completed days: muted check or filled state               │
│  · Current day: emphasis, tappable                           │
│  · Future days: locked OR soft-disabled with short reason    │
│    (e.g. “Available in sequence” — not punitive)             │
├─────────────────────────────────────────────────────────────┤
│  [ Optional: Start over ]  (secondary, destructive confirm)  │
│  Only if product enables restart; never shown as comeback     │
│  default.                                                    │
├─────────────────────────────────────────────────────────────┤
│  Recovery note (optional, single line):                      │
│  “Returning is recorded for your recovery path only.”        │
│  (Only if legal/product approves; else omit.)                │
│  If bounce_back_count shown: see §5.                         │
└─────────────────────────────────────────────────────────────┘
```

---

## 3. Journey step screen — text wireframe

**Context:** User taps **Day N** on JourneyBoard (N ≤ `current_day` or allowed by day-unlock rules).

```
┌─────────────────────────────────────────────────────────────┐
│  ← Back to Journey                                           │
├─────────────────────────────────────────────────────────────┤
│  Day {N} · {short mission title from content JSON}           │
│  (subtitle: one calm line, e.g. theme of the day)            │
├─────────────────────────────────────────────────────────────┤
│  Body: mission copy (short paragraphs + optional list)         │
├─────────────────────────────────────────────────────────────┤
│  Primary action area:                                        │
│  · Checkbox / reflection input / link to Center tool           │
│    (per existing MissionCard pattern)                          │
├─────────────────────────────────────────────────────────────┤
│  [ Mark complete ]  or  [ Save reflection ]                  │
│  (success: calm toast, e.g. “Saved.” / “Marked for today.”)    │
├─────────────────────────────────────────────────────────────┤
│  No XP badge · no rank · no season mention on this screen.    │
└─────────────────────────────────────────────────────────────┘
```

**Copy tone:** instructional and neutral. Example success: **“Recorded.”** / **“저장했습니다.”** — not “Amazing!” or “Streak!”

---

## 4. State transition flow

```
┌──────────────────┐
│ App open / login │
└────────┬─────────┘
         │
         ▼
┌────────────────────────────┐
│ lastVisit + auth check      │
└────────┬───────────────────┘
         │
    ┌────┴────┐
    │ <3 days │──────────────────────────────────┐
    └────┬────┘                                  │
         │ ≥3 days                               │
         ▼                                       │
┌────────────────────┐                           │
│ Show Comeback      │                           │
│ modal              │                           │
└────────┬───────────┘                           │
         │                                       │
    ┌────┴────────────┐                          │
    │ Resume Journey  │     Not now / Esc /      │
    ▼                 │     backdrop             │
 POST bounce-back     │                          │
 (increment count)     │                          │
    │                 │                          │
    ▼                 ▼                          │
 Navigate to         Close modal                 │
 /growth/journey     (no POST)                   │
    │                 │                          │
    └────────┬────────┘                          │
             │                                  │
             ▼                                  ▼
┌────────────────────────────┐         ┌──────────────┐
│ JourneyBoard                │         │ Previous     │
│ load GET profile + entries  │         │ surface      │
│ render current_day          │         └──────────────┘
└────────┬───────────────────┘
         │
         ▼
┌────────────────────────────┐
│ User opens Day N step       │
│ (MissionCard / step UI)     │
└────────┬───────────────────┘
         │
         ▼
┌────────────────────────────┐
│ Complete / save             │
│ → POST journey/entries      │
│ (existing API contract)     │
│ current_day may advance     │
│ per server rules            │
└────────────────────────────┘
```

**Progression rule:** After comeback, **no client-side reset** of `current_day`. Server profile is source of truth.

---

## 5. Visibility rules for `bounce_back_count`

| Location | Show? | How |
|----------|-------|-----|
| Leaderboard, Arena, weekly XP, season UI | **Never** | — |
| Comeback modal | **Never** | Do not display the number. |
| JourneyBoard header | **Optional** | If shown: single muted line, e.g. EN: “Returns logged: {n} (for your records only).” KO: “복귀 기록: {n}회 (개인 기록용).” **Max one line, small type, no icon badge.** |
| Dedicated “Recovery history” (future) | **Allowed** | Same neutral framing. |

**Default recommendation:** **Hide count entirely** on JourneyBoard unless product explicitly wants transparency; spec allows minimal disclosure only in Journey context.

---

## 6. Implementation notes (frontend)

1. **Comeback mount point**  
   - Global client shell (e.g. locale layout) so trigger works after any navigation, **excluding** routes where modal is disruptive (`/login`, password reset, etc.).

2. **Bounce-back API**  
   - Call **`POST /api/journey/bounce-back` only inside `onResumeJourney`** handler, after user gesture.  
   - Use session the app already uses for Journey (`credentials: "include"` if cookie session; align with `JourneyBoard` profile fetch).

3. **Navigation**  
   - `router.push(\`/${locale}/growth/journey\`)` after successful POST or in parallel (optimistic navigate only if product accepts; safer: await POST then navigate).

4. **i18n**  
   - Centralize strings under e.g. `uxPhase1Stub.comeback*` or `journey.comeback*` — EN/KO tables in §1.4.

5. **JourneyBoard**  
   - `variant="growth"` when rendered under Growth route for consistent chrome.  
   - No links that frame Journey as Arena or My Page primary destination.  
   - **Recovery Loop shell (optional):** `bty-app/src/components/journey/JourneyGrowthBoardShell.tsx` — same grid/modal layout as the shadcn prototype, implemented with app `Modal` + Tailwind only (`JourneyGrowthBoardShell`, `ComebackGrowthModal`, `JourneyGrowthRestartConfirmModal`). `JourneyGrowthShellDemo` is local-state only; production must wire `current_day`, `POST /api/journey/bounce-back` on Resume only, and restart API if applicable.

6. **Restart**  
   - If UI exposes restart: secondary control + confirm dialog copy: neutral (“This will start the sequence from Day 1. Continue?”) — **not** shown on comeback path.

7. **Analytics (optional)**  
   - If events are tracked, label as `journey_comeback_resume` vs `journey_comeback_dismiss` — do not map bounce-back to XP events.

8. **QA checklist**  
   - [ ] 3+ days away → modal.  
   - [ ] Resume → POST once → Journey opens.  
   - [ ] Not now / Esc / backdrop → no POST.  
   - [ ] Journey shows `current_day` from profile, not reset.  
   - [ ] No bounce_back_count on Arena/XP/leaderboard.

---

## 7. Document control

- **Supersedes:** informal “dismiss records bounce-back” behavior.  
- **Pair with:** `docs/JOURNEY_BOUNCEBACK_IA.md`, `docs/JOURNEY_NAV_WIREFRAME.md`.
