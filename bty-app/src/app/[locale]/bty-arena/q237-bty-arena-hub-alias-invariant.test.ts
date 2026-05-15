import { describe, expect, it, vi } from 'vitest';

vi.mock('next/navigation', () => ({ redirect: vi.fn() }));

import { redirect } from 'next/navigation';
import ArenaHubPage from './hub/page';

/**
 * §8-Open#1 alias invariant (Stage 2 step 6 2E natural closure lock).
 *
 * Hub is a redirect alias for /bty-arena. This test ensures:
 *  - NEXT_SCENARIO_READY → Hub alias resolves to the canonical Arena entry
 *  - No second playable surface exists at /bty-arena/hub
 *
 * Invariant: hub/page.tsx must redirect to /[locale]/bty-arena, not render
 * playable content. Any future re-introduction of Hub content (entry card,
 * summary, etc.) must explicitly invalidate this test.
 */
describe('bty-arena hub alias invariant (§8-Open#1)', () => {
  it('redirects /en/bty-arena/hub → /en/bty-arena (no second playable surface)', async () => {
    await ArenaHubPage({ params: Promise.resolve({ locale: 'en' }) });
    expect(redirect).toHaveBeenCalledWith('/en/bty-arena');
  });

  it('redirects /ko/bty-arena/hub → /ko/bty-arena (locale preserved)', async () => {
    await ArenaHubPage({ params: Promise.resolve({ locale: 'ko' }) });
    expect(redirect).toHaveBeenCalledWith('/ko/bty-arena');
  });
});
