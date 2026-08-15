# App Review Notes — **FINAL** (build 106, FREE-only 1.0)

**`APP_REVIEW_NOTES = FINAL_PENDING_ASC_ENTRY`. NOT entered into ASC.**

Re-read line by line against the **physically verified build 106 UI**, not against intent. Every
step below was observed on the device: sign-in, My Norebang, the LIVE room, guest search with
results, a request reaching the host queue, and the absence of every retired commerce surface.

## The final text

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
5. Search for a song. Results come from YouTube and are labelled as such. Tap "Request"
   on one — it appears in the shared queue on the host screen with the requester's name.
   A second request queues behind the first and shows as "Waiting".
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

## What changed from v2, and why

```
step 5   added "Results come from YouTube and are labelled as such."
         Build 106 renders the official developed-with-YouTube mark above live search
         results. A reviewer meets that mark on screen, so the notes should not leave it
         unexplained — and it pre-empts "where does this content come from?".

step 5   added "A second request queues behind the first and shows as Waiting."
         This is the exact state the build-105 defect corrupted. Naming it means a
         reviewer who sees it knows it is intended, and it is now verified correct.

unchanged  everything else. v2 was written against the retirement and the retirement is
           what shipped, so re-reading it against 106 changed almost nothing — which is
           the outcome to want from a notes draft.
```

## Founder's required truths — each mapped to a line

```
signs in with ASC-supplied credentials      "SIGNING IN" — the demo account, typed in ASC
returning account reaches My Norebang       step 2
existing LIVE room is available             step 2 ("its card shows Live")
can inspect room / queue / guest flow       steps 3-5
can search and request a song               step 5
YouTube provides search + playback          opening line, step 5, step 6
no purchase required                        the standalone paragraph
no in-app pass purchasing in this version   same paragraph
```

## Deliberately absent

```
Access Status purchasing · Buy a pass · prices · "passes not on sale" · future commerce
```

Saying passes are unavailable would still advertise a product the binary cannot sell, so the
notes do not mention them at all.

**No secret appears here.** The demo credential is typed straight into ASC by the Founder.

## Not entered into ASC

Correct order is: apply E1 to production under its own authorization, then enter these notes, then
the screenshots. Entering them now would describe a build whose server contract is still the old
one.
