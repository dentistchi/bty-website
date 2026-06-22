# BTY Native App Direction v1 — LOCK

Status: LOCKED
Locked: 2026-06-22
Authority: Commander (meaning) · this-chat (evidence inventory, non-mutating) · Claude Code (write executor)
Depends-on: BTY behavioral loop canon (No Action → No Progression)

## Direction (Commander-authored — canonical meaning)

BTY Native App v1 is not a camera-first QR scanner app.

BTY Native App v1 is a push-based re-entry app.

Its native value is to bring the user back into the Action Loop at the exact
moment when action, verification, or re-exposure is due.

The app exists to protect the BTY principle:
No Action → No Progression.

## The three re-entry moments (app's reason to exist)

- Action Reminder — an open action commitment is still pending.
- QR Pending — witness verification is not yet complete.
- Re-entry Due — time to re-enter a similar situation and validate change.

## Delivery model (locked)

- Web-first Capacitor app. Hosted-URL mode (native shell over the deployed
  Worker URL). Static export is NOT viable (App Router + RSC + 198 server route
  handlers + server middleware auth require a live server).
- React Native / full native rebuild: rejected for v1 (server-heavy codebase →
  rebuild cost outweighs benefit).
- PWA: rejected as the v1 vehicle (native push reliability + app-store presence
  are the native-value case).

## Evidence inventory (STEP 0–2 — what is proven vs inferred vs deferred)

PROVEN (live-witnessed):
- OAuth day-one blocker solved: Google login via system browser → btyarena://
  deep-link return → server PKCE callback yields a server-cookie session that
  the middleware getUser() gate honors INSIDE the hosted WebView, and it
  persists across reload/background; reinstall persistence was observed in the
  spike and must be handled explicitly by logout/session-clearing policy.
  (STEP 1 criteria 1,5,6,7.)
- Push re-entry works: an Action Reminder notification displays, and tapping it
  routes via the shared deep-link parser into the Action Loop context
  (/protected/action) with the auth session intact — from both warm and COLD
  start. (STEP 2 criteria L1–L4.)

INFERRED (causally entailed, not separately re-witnessed):
- STEP 1 criteria 2 & 4 (system-browser open; btyarena:// receipt) — entailed
  by the existence of the authenticated server-cookie session; desktop contrast
  (btyarena:// "no registered handler") corroborates.

DEFERRED (membership-gated — NOT yet proven):
- Remote push send (APNs/FCM server → device) requires an Apple Developer
  Program membership + APNs auth key. STEP 2 proved the device-side pipe via
  local injection (xcrun simctl push) only. Remote send is structurally wired
  but unverified; to be validated after membership is provisioned.

## Carry-forward open items (not blockers to this lock)

- LoginButton "Connecting…" UX item: desktop-only (btyarena:// handler absence,
  environment mismatch); not an auth-model failure; unfixed by decision.
- WKWebView session persisted aggressively across reinstall → real app must
  clear WKWebsiteDataStore explicitly on logout.
- Real-app deltas: custom scheme + redirectTo allow-listing; initiate-from-
  WebView OAuth sequencing; protocol-conditional Secure cookies; push plugin +
  permission timing + payload→deep-link routing for all three re-entry types.
- Cold-start has a deep-link vs. home-load navigation race: the push handler
  routes to /protected/action on every tap (server-log confirmed, warm+cold),
  but on cold launch the final rendered screen can occasionally fall back to
  /protected when the home load wins the race. Routing is proven; screen-stay
  on cold is racy. Real app must defer the WebView home load until the launch
  notification is consumed.

## Sequence record

STEP 0 (inventory) → STEP 1 (OAuth proof, PASS) → STEP 2 (Push proof, PASS) →
STEP 3 (this lock). Next: provision Apple Developer membership to retire the
DEFERRED remote-send item, then real-app implementation of the auth + push seams.
