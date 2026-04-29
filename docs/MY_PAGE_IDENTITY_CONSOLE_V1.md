# My Page — Premium Identity Console (v1)

**Intent:** “나는 어떤 리더로 형성되고 있는가” — not a KPI dashboard, not a shallow profile.

## Data (live)

- `MyPageLeadershipConsole` → `loadSignals()` → `computeMetrics` → `computeLeadershipState(metrics, locale, reflections)` → `mergeLeadershipReflectionLayer(...)` → **`PremiumMyPageIdentityScreen`**
- Mock-free on `/[locale]/my-page` overview.

## Visual / tone

- Dark navy / slate-black glass island inside ScreenShell, muted cyan, soft borders.
- **Interpreted labels only** — no AIR/TII raw floats in UI.

## Layout (single implementation file)

Primary implementation: **`src/features/my-page/PremiumMyPageIdentityScreen.tsx`**

1. **IdentityHero** — codename, stage, headline, core trace line, MiniCrest (initials from codename), system note card  
2. **State row** — AIR / TII / Rhythm (`StateCard`)  
3. **Two columns** — Pattern field (`FieldRow`) + Reflection depth | Influence + Recovery (support note)  
4. **NextFocusCommand** — next focus, development cue, suggested route  
5. **Footer** — suggested module line + Arena / Growth links  

Thin wrapper: **`MyPageLeadershipScreen.tsx`** → passes `reflections` + metrics + state.

## i18n

- `myPageStub`: `leadershipSuggestedRoute*`, `leadershipRecoveryStableNote`, `leadershipSupportNoteLabel`, `leadershipRecoveryStatusLabel`, etc.
