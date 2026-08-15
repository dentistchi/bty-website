# Release assets

Binary/visual artifacts submitted to App Store Connect. Nothing here is compiled or imported by
the app or the server — these files exist so a submitted asset is reproducible and auditable.

```
release-assets/appstore/<version>/screenshots/   App Store product-page screenshots
release-assets/appstore/<version>/iap/           In-App Purchase App Review screenshots (review-only)
```

## Rules

1. **Real app only.** Every screenshot is captured from the shipping **Release** build on a real
   device. No mockup, no simulator-faked commerce state, no composited UI, no invented feature.
2. **No private data.** No customer name, email, address, phone, or any identifier belonging to a
   person who is not the Founder.
3. **Checksums are recorded** in the build closure doc that submits them, so the file ASC received
   can be re-identified later.
4. **Naming**: `<size>-<NN>-<screen>.png`, e.g. `6.9-01-queue.png`, `iap-1h.png`.

## Accepted iPhone dimensions (portrait)

```
6.9"   1320 × 2868   (iPhone 17 Pro Max / 16 Pro Max — native device screenshot)
6.9"   1290 × 2796   (iPhone 15/16 Plus / 14 Pro Max — also accepted at this size)
6.5"   1284 × 2778   or   1242 × 2688
```

A native screenshot taken on the device (Side button + Volume Up) is already at the required
pixel size; do not crop or scale it.
