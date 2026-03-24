# BTY Release Gate Check

## Arena release gate

- /[locale]/bty-arena first fetch includes /api/arena/session/next
- /[locale]/bty-arena/run lands on canonical Arena flow
- stale local state / invalid runId recovers to canonical session flow
- session/next returns at least one valid scenario or explicit guarded fallback
- /api/arena/session/next must never silently return empty pool without logs or fallback