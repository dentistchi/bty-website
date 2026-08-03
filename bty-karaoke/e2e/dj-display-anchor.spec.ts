// BUILD 26B D-6a — the "Open Display on this device" anchor.
//
// It shipped as `className="ghost"`. On an <a> that supplies NOTHING: `.ghost` is
// only defined as `.btn.ghost` (colour), while the chrome — padding, radius,
// min-height — comes from the `.btn, button` rule, which an anchor does not match.
// Measured live before the fix: transparent background, 0px border, 0px radius,
// 0px padding, default link blue rgb(158,158,255) — bare text between two gold
// buttons. Same defect class as the Google CTA (D-1).
//
// The fix is one class token, `btn ghost`, which the codebase's own comment already
// documents as the intended pattern for an anchor-as-button.
import { test, expect } from '@playwright/test';
import { WIDTHS, MIN_TAP } from './widths';
import { ACTIVE, HARNESS_SLUG } from './fixtures/queue';

const ANCHOR = '.dj-actions-bar a[href$="/display"]';

for (const { w, h, label } of WIDTHS) {
  test(`Open Display anchor is a real secondary button @ ${label}`, async ({ page }) => {
    await page.setViewportSize({ width: w, height: h });
    await page.route(`**/api/rooms/${HARNESS_SLUG}/dj/queue`, (r) =>
      r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(ACTIVE) }),
    );
    await page.route(`**/api/rooms/${HARNESS_SLUG}/dj/usage`, (r) =>
      r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ usage: null }) }),
    );
    await page.addInitScript((slug) => {
      window.localStorage.setItem(`bty-dj-cred:${slug}`, 'e2e-fixture-token');
    }, HARNESS_SLUG);
    await page.goto(`/r/${HARNESS_SLUG}/dj`);

    const anchor = page.locator(ANCHOR).first();
    await expect(anchor).toBeVisible();

    const m = await anchor.evaluate((el) => {
      const r = el.getBoundingClientRect();
      const s = getComputedStyle(el);
      return {
        classes: Array.from(el.classList),
        href: el.getAttribute('href'),
        target: el.getAttribute('target'),
        height: Math.round(r.height),
        right: r.right,
        display: s.display,
        decoration: s.textDecorationLine,
        background: s.backgroundColor,
        borderWidth: s.borderTopWidth,
        radius: s.borderTopLeftRadius,
        padding: s.paddingLeft,
        color: s.color,
      };
    });

    // The class contract — this is the one-token regression.
    expect(m.classes, 'anchor must carry both btn and ghost').toEqual(
      expect.arrayContaining(['btn', 'ghost']),
    );

    // Presentation contract.
    expect(m.display, 'must not render as inline text').not.toBe('inline');
    expect(m.decoration, 'must not be underlined').not.toContain('underline');
    expect(m.height, 'effective touch height').toBeGreaterThanOrEqual(MIN_TAP);

    // The chrome that was entirely absent before the fix. These are what actually
    // caught D-6a; an underline assertion alone would have passed on the defect.
    expect(m.background, 'must have a ghost surface, not transparent').not.toBe('rgba(0, 0, 0, 0)');
    expect(m.borderWidth, 'must have a border').not.toBe('0px');
    expect(m.radius, 'must have the button radius').not.toBe('0px');
    expect(m.padding, 'must have button padding').not.toBe('0px');
    expect(m.color, 'must not be the default link blue').not.toBe('rgb(158, 158, 255)');

    // Navigation is unchanged by this build.
    expect(m.href).toBe(`/r/${HARNESS_SLUG}/display`);
    expect(m.target).toBe('_blank');

    // Layout contract.
    const clientWidth = await page.evaluate(() => document.documentElement.clientWidth);
    expect(m.right, 'must stay within the viewport').toBeLessThanOrEqual(clientWidth + 1);
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);
  });
}
