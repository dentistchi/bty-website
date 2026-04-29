/**
 * P5 — Guardrail against split-authority regressions (product CTAs).
 *
 * **Product entry** (Landing, nav, Growth return-to-Arena, onboarding exit, leaderboard empty CTA, etc.) must obtain
 * href + destination from {@link useArenaEntryResolution} or {@link fetchArenaEntryResolutionClient} — never hard-code
 * `` `/${locale}/bty-arena` `` as a *routing decision* for “where should the user go next”.
 *
 * **Allowed static `/bty-arena` strings**
 * - {@link defaultArenaEntryContract} — conservative first-paint default until GET session resolves.
 * - Infrastructure: middleware redirects, canonical legacy URLs, historical run deeplinks, tests.
 * - See `arenaProductVsInfrastructure.ts`.
 *
 * This module exports markers for grep / code review; it does not throw at runtime.
 */
export const P5_PRODUCT_ARENA_ENTRY_POLICY_MARK = "P5_SNAPSHOT_ENTRY_AUTHORITY";

/** Use in comments next to rare static shell paths: `// ${P5_INFRA_STATIC_ARENA_SHELL} middleware 308` */
export const P5_INFRA_STATIC_ARENA_SHELL = "infrastructure:static-bty-arena-shell";
