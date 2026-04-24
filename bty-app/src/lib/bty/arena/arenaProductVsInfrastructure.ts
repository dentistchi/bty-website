/**
 * BTY Arena — **product entry** vs **infrastructure routing** (P4)
 *
 * **Product entry** — user-facing “continue in Arena”, return-to-Arena, onboarding exit, growth CTAs:
 * use {@link fetchArenaEntryResolutionClient} or {@link useArenaEntryResolution} so the target href follows
 * GET session-router snapshot authority (Arena shell vs My Page action-contract vs Center forced-reset via destination + href).
 *
 * **Infrastructure** — canonical URL stabilization, middleware 308s, legacy route redirects, historical run deeplinks
 * (`/bty-arena/run/:id`): may keep static `/${locale}/bty-arena` path strings; they do not encode live product state.
 * Arena shell pages still hydrate session from GET `/api/arena/n/session` on load.
 *
 * @see `productArenaEntryGuard.ts` — P5 policy marker for new product links.
 */

export {};