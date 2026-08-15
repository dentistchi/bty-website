# BUILD 26T-R1B-R4 — App Store Connect Submission-Readiness Census

**Status: PASS / CLOSED — 2026-08-14. Classification `F. MULTIPLE_ASC_BLOCKERS`.**

**No build uploaded. No app submitted. No IAP submitted. No ASC value written. `PASS_1H` inactive.**

`AUTOMATED_ASC_READBACK_UNAVAILABLE` still stands — this session holds no ASC API key, no ASC
credentials and no fastlane. The census was therefore performed by the Founder against the live
App Store Connect web UI and read back here. What follows is **the measured live state**, not an
inference from repository artifacts.

> **A PASS here means the live ASC census was successfully completed.**
> **It does NOT mean submission readiness.** The census's own finding is that submission is
> blocked in five independent places.

---

## 1. Verdict

```
BUILD 26T-R1B-R4                  PASS / CLOSED     F. MULTIPLE_ASC_BLOCKERS
live ASC census                   COMPLETE          all seven surfaces read
business agreements               READY             the one surface with no blocker
app version metadata              BLOCKED           4 required fields missing
app store screenshots             BLOCKED           0 present, both required sizes
app review information            BLOCKED           6 required fields missing
app privacy                       BLOCKED           questionnaire not started
IAP review screenshots            BLOCKED           0 of 3 present
build 100                         NOT UPLOADED / NOT SELECTED   (deliberate — R1B-R3 scope)
PASS_1H production catalog        INACTIVE
```

## 2. Business — READY

The one surface that carries no blocker. R1B closed this as UNKNOWN; it is now measured.

```
Paid Apps Agreement        READY / Active
Banking                    READY / Active
Tax                        READY / Active
```

Consequence: paid IAP is **contractually** permitted for this account. Nothing about the
agreements is what stops a submission today.

## 3. App version — 4 required fields missing, 0 screenshots

```
Version                    1.0
State                      Prepare for Submission
Korean Description         MISSING
Korean Keywords            MISSING
Korean Support URL         MISSING
Copyright                  MISSING
iPhone 6.9" screenshots    0
iPhone 6.5" screenshots    0
Build 100                  NOT UPLOADED / NOT SELECTED
```

Build 100's absence here is **expected and correct**: R1B-R3 validated it deliberately without
delivering it (`processingState = null`). Upload remains its own authorized gate.

## 4. App Review — sign-in required, no credentials supplied

```
Sign-in required           YES
Reviewer username          MISSING
Reviewer password          MISSING
Contact first name         MISSING
Contact last name          MISSING
Contact phone              MISSING
Contact email              MISSING
```

`Sign-in required = YES` is the honest answer for this app — the host surface is behind
authentication — so the demo-credential requirement is real and cannot be dismissed by toggling
the flag.

## 5. App Privacy — questionnaire not started

```
Questionnaire              NOT STARTED
Published disclosure       MISSING
Privacy Policy URL         not yet proven from the ASC UI
```

The Privacy Policy URL is recorded as **not yet proven from ASC**, not as "missing". A public
`/privacy` endpoint is believed live from prior work; whether ASC's field carries it was not
established by this census and must not be assumed.

## 6. In-App Purchases — the products exist, the review asset does not

All three products created in BUILD 26Q are present and correctly configured, and all three lack
exactly one thing.

```
                              PASS_1H      PASS_4H      PASS_24H
state                         Prepare for Submission (all three)
EN localization               PRESENT      PRESENT      PRESENT
KO localization               PRESENT      PRESENT      PRESENT
pricing                       PRESENT      PRESENT      PRESENT
availability                  all countries / regions (all three)
IAP review screenshot         MISSING      MISSING      MISSING
review notes                  blank (optional)
```

**First-IAP + app-version rule — CONFIRMED by live ASC.** The first in-app purchase must be
submitted together with an app version. This is now measured, not assumed: it means the IAP
blockers and the app-version blockers cannot be sequenced apart. They clear together or not at all.

## 7. Classification — why `F`, not a single blocker

Five surfaces block independently, and no one of them dominates:

```
1  app version metadata      4 required fields
2  app store screenshots     0 of ≥1 required
3  app review information    6 required fields
4  app privacy               questionnaire not started
5  IAP review screenshots    0 of 3
```

Each is a separate ASC gate with a separate remedy. Calling this "metadata incomplete" would
understate it; calling it "submission impossible" would overstate it. `F. MULTIPLE_ASC_BLOCKERS`
is the accurate reading.

## 8. What this census did NOT do

```
build 100 upload           NOT PERFORMED
build attach / select      NOT PERFORMED
Add for Review             NOT CLICKED
app submission             NOT PERFORMED
IAP submission             NOT PERFORMED
ASC field writes           NONE
karaoke_product_catalog    NOT WRITTEN — PASS_1H is_active still false
Apple purchase             NONE
```

## 9. Carried forward to R1B-R5

Every blocker in §7 that can be truthfully prepared **before** build upload and **before**
commerce activation is R1B-R5's scope: metadata package, App Privacy forensic + answers, privacy
policy URL proof, App Store screenshot asset, three IAP review screenshot assets, App Review
account/contact strategy, and the release-mode change to **Manual**.

Build 100 upload stays out of scope. `PASS_1H` stays inactive.

---

**BUILD 26T-R1B-R4 — PASS / CLOSED. `F. MULTIPLE_ASC_BLOCKERS`.**
