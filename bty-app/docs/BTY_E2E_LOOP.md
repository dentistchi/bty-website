# BTY E2E — full leadership loop

> Product + philosophy baseline for Cursor: **`docs/BTY_CURSOR_MASTER_PROMPT.md`**

## Purpose

End-to-end coverage for **Arena → Reflection (write) → History → Recovery → My Page** using **Playwright** and **`data-testid` only** (no brittle copy selectors in primary flows).

## Run

```bash
npx playwright test --project=bty-loop
```

Uses the same `setup` + `storageState` as the default app E2E (`e2e/.auth/user.json`). Guest-style flows still work where tests clear `sessionStorage` / `localStorage` before Arena steps.

## Files

| File | Scope |
|------|--------|
| `e2e/bty/arena-flow.spec.ts` | Lobby → Play → Result |
| `e2e/bty/growth-flow.spec.ts` | Result → Reflection airlock → **Write** → History |
| `e2e/bty/recovery-flow.spec.ts` | Recovery save → History |
| `e2e/bty/my-page-flow.spec.ts` | My Page identity regions |
| `e2e/bty/full-loop.spec.ts` | **Product lifeline** — full path ending on My Page |
| `e2e/bty/guards.spec.ts` | Result URL guard; reflection write empty seed (API stub) |

## Flow detail (Growth)

`Review Reflection` opens **`/growth/reflection`** (airlock). Tests then click **`open-reflection-write`** to reach **`/growth/reflection/write`** where `reflection-prompt-title` and answer fields live.

## Test IDs (stable)

See implementation: `arena-enter`, `primary-A`, `reinforce-X`, `resolve-decision`, `resolve-interpretation`, `review-reflection`, `open-reflection-write`, `reflection-*`, `save-reflection`, `growth-history-list`, `reflection-history-card`, `recovery-signal-strip`, `open-latest-reflection`, `open-recovery`, `recovery-prompt-title`, `recovery-pattern-note`, `save-recovery`, `identity-hero`, `leadership-state-row`, `pattern-field`, `reflection-depth-panel`, `recovery-awareness-panel`, `next-focus-command`, etc.

## Layers

1. **UI flow** — routes, visibility, save navigation (current specs).
2. **API integration** (optional next step) — assert network 200 / state after save using `page.waitForResponse` or Supabase checks in CI.
