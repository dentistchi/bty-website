# Orb Haptic Exclusivity Lock (#배타성 LOCK)

**Status:** LOCKED (Product A · Spine v1 · P0c) · presentation convention

**Rule (one line):** `navigator.vibrate()` / any haptic call is permitted **only**
inside the Orb component (`src/components/orb/Orb.tsx`, sole call site
`triggerOrbHaptic()`). It is **forbidden** on buttons, toasts, notifications,
XP events, or anywhere else.

**Why:** Touch is the Orb's exclusive language. If everything buzzes, nothing
means anything — haptic scarcity is what makes the ritual touch feel alive.

**Enforcement:** convention + in-file LOCK comment. A second `vibrate()` call
site anywhere outside the Orb is a lock violation; remove it, route the intent
through the Orb instead.
