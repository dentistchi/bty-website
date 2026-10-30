# BTY song picks V1

Guests who do not have a song in mind can open **BTY song picks**, choose a category,
and select a title. That selection runs the existing backing-track search. A guest
still reviews the returned video and explicitly requests it. The DJ add-song sheet
uses the same catalog and its existing search/add path.

## Content

- `src/data/bty-song-picks.json` is the single editorial catalog: 60 distinct songs,
  ten each in Sing together, Party songs, Ballads, Old favorites, K-pop, and Pop songs.
- Version: `bty-picks-v1-2026-10-30`. The date is the editorial selection date, not a
  provider verification date or a live popularity measurement.
- This is an independent BTY selection, not a Melon, TJ, KY, Spotify, or Circle ranking.
  No chart is copied or fetched. No album art, lyrics, provider video IDs, durations,
  or provenance tokens are authored into this catalog.
- Each item has an ID, title, artist, category, main lyric language, and search query.
  Known cover recordings are identified by the credited artist in the query.
- New releases do not enter this list automatically. Review the selection manually
  when needed, retain IDs for unchanged songs, and update the version/date on edits.

## Search and cost boundary

Opening the list or changing categories performs no network request. An explicit
title selection makes the same search call as typed input, with the currently
selected MR/karaoke/original setting. Existing caching, quota/degraded messages,
direct-link fallback, duration admission, provenance, and idempotent submission are
preserved. There is no new chart subscription, AI request, scheduled refresh, table,
migration, or paid feature. Existing YouTube search quota still applies to selections.

## Surfaces and delivery

- Browser guest: `src/app/r/[slug]/RequestForm.tsx`.
- Browser DJ add sheet: `src/app/r/[slug]/dj/DjAddSongSheet.tsx`.
- Guest controls use the existing English/Korean dictionary and locale provider.
- The Swift iOS app has its own UI; this change does not update the native app or
  submit a new App Store build. It also does not deploy the web app automatically.
- No real YouTube search or production queue write was used during verification;
  backing-track availability and matching are determined by the existing search
  results when a user chooses a song.

## Validation

- `npm run lint` and `npm run build` passed.
- Eight relevant Vitest files passed, 63 tests total: catalog integrity, guest/DJ
  selection, bilingual controls, quota fallback, explicit result confirmation,
  provider provenance transport, and the existing submission/re-request contracts.
- A local Chromium component harness mounted the real guest form at 375px and
  1440px with intercepted fixture responses. Both widths showed six categories with
  ten choices each, no horizontal document overflow, single-line category labels,
  and touch targets at least 44px tall. Browsing made zero search calls; choosing a
  song made one search; confirmation made one request carrying the provider video ID,
  provenance, and an idempotency key. No browser page errors were observed.

## Manual review

1. Open a running room in a browser and expand **BTY song picks** below the search.
2. Browse categories, then choose a title. Confirm its artist/title populates search.
3. Verify the existing search style remains selected and review the available version.
4. Request the chosen result; confirm it appears once in the guest's requests/queue.
5. Repeat in the DJ add-song sheet and in English/Korean guest mode.
