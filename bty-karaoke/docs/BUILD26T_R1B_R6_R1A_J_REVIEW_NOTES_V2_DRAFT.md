# App Review Notes — v2 DRAFT (FREE-ONLY 1.0)

**§D. NOT entered into ASC. Awaiting Founder approval.**

## Why v1 is obsolete

The approved v1 notes end at *"tap the access-status chip … scroll to Buy a pass: the 1 hour,
4 hours and 24 hours passes are listed there with their App Store prices."* Under this build that
path is being removed: Release 1.0 cannot purchase a pass, PRO confers no playback privilege, and
pass state does not gate playback. Sending a reviewer to a surface that will not exist is the
fastest possible rejection, and it would also describe the product untruthfully.

v2 also drops every mention of passes, prices and availability. §D is explicit that the 1.0 notes
must not mention paid passes **or** unavailable commerce — saying "passes are not on sale" would
still be advertising a product the binary cannot sell.

## The defensive line, re-checked rather than copied

v1's step-3 parenthetical ("if the card shows no norebang running, tapping it starts one") is
**still true** — an event ends only by an explicit call, so the review room's session persists, and
if anyone ends it the reviewer must not be stranded. It is kept, unchanged in substance.

## Proposed v2 text

```
BTY Norebang is a karaoke session app for private gatherings. The host opens a "norebang"
(room), guests join by QR code and request songs, and everyone watches the same shared
queue. Songs are searched on YouTube and played on YouTube.

SIGNING IN
Sign in with Apple and Google Sign-In are the only login methods; there is no password
login. The demo account above signs in with the "Continue with Google" button on the
first screen. You may also use your own Apple ID via the Sign in with Apple button.

GETTING INTO THE APP
1. Sign in with the demo account.
2. You will land on "My Norebang". The demo account already has one norebang, and its
   card shows "Live" — a session is already running.
3. Tap the card ("Enter Norebang"). You are taken straight to the queue screen.
   (If the card ever shows "No norebang running", tapping it simply starts a new
   session — nothing else is needed.)

TRYING THE CORE FLOW
4. Tap the QR code to display it. Scanning it on a second device opens the guest request
   screen in a browser. "Guest mode" is also reachable inside this app without signing in.
5. Search for a song and submit a request. It appears in the shared queue on the host
   screen, with the requester's name.
6. Tap play on a queued song. Playback is handed off to YouTube: the video opens in
   YouTube. The app does not embed, re-host or modify YouTube content, and it requests no
   access to any YouTube account.

There is nothing to purchase in this version, and no sign-up, subscription or entitlement
is required to search, request or play a song.

ACCOUNT
"Sign-In Methods" shows the connected Apple/Google logins. "Delete Account" permanently
deletes the account from inside the app.

LANGUAGES
Korean and English, following the device language.
```

## What changed from v1, line by line

```
added     "Songs are searched on YouTube and played on YouTube."  — states the dependency the
          developed-with-YouTube mark also expresses, so the reviewer meets it in words first
added     step 6: playing a song, which v1 never actually asked the reviewer to do
added     the explicit "nothing to purchase … no entitlement required" line, which is now the
          product's truth and pre-empts a reviewer hunting for a paywall
removed   the entire "IN-APP PURCHASES — how to reach them" section (steps 7-8)
removed   the daily-allowance / pass-extension / wall-clock paragraph
kept      sign-in, first-run routing, QR/guest, account deletion, languages — all still true
kept      the "No norebang running" fallback, re-verified as still true
```

**No secret appears in these notes.** The demo credential is typed straight into ASC by the
Founder and is not written here.

## Status

```
APP_REVIEW_NOTES   UPDATED_PENDING_ASC_ENTRY
```

Not entered into ASC. It should not be entered until the §B/§C UI retirement actually ships,
because until then the notes would describe a build that does not exist yet — the same error v1
made in the other direction.
