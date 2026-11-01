# Isolated public Foundry XP browser check

From the repository, using its installed dependencies and Playwright Chromium:

```sh
node scripts/qa/public-foundry-xp.browser.mjs
```

The command creates a new temporary evidence directory and prints its path after
successful cleanup. To retain a chosen destination or use an existing Chromium:

```sh
node scripts/qa/public-foundry-xp.browser.mjs \
  --output-dir /absolute/new-empty-evidence-directory \
  --browser-executable /absolute/installed/chromium
```

A missing browser or failed check exits nonzero; it is never skipped. Existing
nonempty evidence directories are refused. `PLAYWRIGHT_BROWSERS_PATH` is honored
by the installed Playwright package; no application `.env` file is loaded.

The fixed English matrix renders the actual video, document, written-guidance and
live-discussion clients with real Tailwind at 320, 390 and 1280 CSS pixels. It checks
24 pending/review screens plus 12 explicit retry-to-awarded transitions (36 flow
checks), panel bounds, horizontal overflow, minimum 4.5:1 composited text contrast,
touch target size and page errors.
Pending/review must never auto-claim or show earned XP. Review has no payment retry.

All API replies are fixed synthetic fixtures; unexpected and external requests are
blocked. PDF canvas rendering is stubbed because these are terminal completion
states. No Next server, production endpoint, model, database, login session or
learner record is used. This is UI regression evidence, not reward-receipt/SQL
correctness, physical-device verification or Korean visual-layout coverage.
