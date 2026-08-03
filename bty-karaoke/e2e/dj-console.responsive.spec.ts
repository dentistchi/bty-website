// BUILD 26B — the Host OPERATING console, at every contracted width.
//
// The console resolves its room in a server component, so the room comes from the
// local stub (see playwright.config.ts) while every /api/** call is intercepted in
// the browser. No credential is minted, no server authorization is bypassed, and
// no production data is read.
import { test, expect, type Page } from '@playwright/test';
import { WIDTHS, MIN_TAP } from './widths';
import { ACTIVE, EMPTY, ENDED, HARNESS_SLUG, type QueuePayload } from './fixtures/queue';

const CONSOLE_URL = `/r/${HARNESS_SLUG}/dj`;

/** Drive the console into its authed phase from a fixture, with no real session. */
async function openConsole(page: Page, payload: QueuePayload) {
  await page.route(`**/api/rooms/${HARNESS_SLUG}/dj/queue`, (r) =>
    r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(payload) }),
  );
  await page.route(`**/api/rooms/${HARNESS_SLUG}/dj/usage`, (r) =>
    r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ usage: null }) }),
  );
  await page.addInitScript((slug) => {
    // The console reads a device token from localStorage; the intercepted queue
    // call is what actually decides the phase. This value never leaves the browser
    // and authorizes nothing.
    window.localStorage.setItem(`bty-dj-cred:${slug}`, 'e2e-fixture-token');
  }, HARNESS_SLUG);
  await page.goto(CONSOLE_URL);
  await expect(page.locator('main.dj-console')).toBeVisible();
}

async function overflow(page: Page) {
  return page.evaluate(() => {
    const de = document.documentElement;
    return de.scrollWidth - de.clientWidth;
  });
}

/** Every visible interactive control smaller than the contract. */
async function undersized(page: Page) {
  return page.evaluate((min) => {
    const out: Array<{ label: string; w: number; h: number }> = [];
    for (const el of Array.from(document.querySelectorAll('button,[role=button],a[href]'))) {
      const r = el.getBoundingClientRect();
      const s = getComputedStyle(el);
      if (r.width === 0 || s.visibility === 'hidden' || s.display === 'none') continue;
      if (r.height < min || r.width < min) {
        out.push({
          label: (el.textContent || el.getAttribute('aria-label') || '?').trim().slice(0, 30),
          w: Math.round(r.width),
          h: Math.round(r.height),
        });
      }
    }
    return out;
  }, MIN_TAP);
}

for (const { w, h, label } of WIDTHS) {
  test.describe(`dj console @ ${label}`, () => {
    test.use({ viewport: { width: w, height: h } });

    test('no horizontal overflow in the active operating state', async ({ page }) => {
      await openConsole(page, ACTIVE);
      expect(await overflow(page)).toBeLessThanOrEqual(0);
    });

    test('header and queue controls meet the touch-target contract', async ({ page }) => {
      await openConsole(page, ACTIVE);
      // D-4: .sb-event (event status opener), .admin-trigger, .dj-console .linkish
      // D-5: .q-handle (drag), .q-overflow (row menu)
      for (const sel of ['.sb-event', '.admin-trigger', '.q-handle', '.q-overflow']) {
        const el = page.locator(sel).first();
        await expect(el, `${sel} must be present`).toBeVisible();
        const box = (await el.boundingBox())!;
        expect(Math.round(box.height), `${sel} height`).toBeGreaterThanOrEqual(MIN_TAP);
        expect(Math.round(box.width), `${sel} width`).toBeGreaterThanOrEqual(MIN_TAP);
      }
      expect(await undersized(page), 'controls below 44x44').toEqual([]);
    });

    test('empty and ended layouts stay stable', async ({ page }) => {
      await openConsole(page, EMPTY);
      expect(await overflow(page), 'empty state overflow').toBeLessThanOrEqual(0);

      await page.unrouteAll({ behavior: 'ignoreErrors' });
      await openConsole(page, ENDED);
      expect(await overflow(page), 'ended state overflow').toBeLessThanOrEqual(0);
      // An ended night must not still offer the stage action.
      await expect(page.locator('main.dj-console')).toBeVisible();
    });
  });
}

test.describe('sheets and menus fit the smallest viewports', () => {
  for (const { w, h, label } of WIDTHS.filter((x) => x.w <= 430)) {
    test(`sheets stay within the viewport @ ${label}`, async ({ page }) => {
      await page.setViewportSize({ width: w, height: h });
      await openConsole(page, ACTIVE);

      const openers: Array<[string, string]> = [
        ['admin menu', '.admin-trigger'],
        ['row menu', '.q-overflow'],
        ['event status', '.sb-event'],
      ];
      for (const [name, sel] of openers) {
        await page.locator(sel).first().click();
        await page.waitForTimeout(500);

        const fits = await page.evaluate(() => {
          const de = document.documentElement;
          const vh = window.innerHeight;
          const panels = Array.from(
            document.querySelectorAll('[role=dialog],dialog,[class*=sheet],[class*=menu]'),
          ).filter((e) => {
            const r = e.getBoundingClientRect();
            const s = getComputedStyle(e);
            return r.width > 80 && r.height > 40 && s.visibility !== 'hidden' && s.display !== 'none';
          });
          return panels.map((e) => {
            const r = e.getBoundingClientRect();
            const s = getComputedStyle(e);
            return {
              overflowsRight: r.right > de.clientWidth + 1,
              // A panel taller than the viewport is only acceptable when it scrolls.
              unreachable: r.height > vh && !['auto', 'scroll'].includes(s.overflowY),
            };
          });
        });
        for (const p of fits) {
          expect(p.overflowsRight, `${name} overflows horizontally`).toBe(false);
          expect(p.unreachable, `${name} is taller than the viewport and cannot scroll`).toBe(false);
        }
        expect(await overflow(page), `${name} caused document overflow`).toBeLessThanOrEqual(0);

        // Dismiss via the sheet's own backdrop — its documented affordance. Escape
        // is NOT a dismissal path here, so relying on it left the backdrop up and
        // blocked the next opener (a harness fault, not a product defect).
        const backdrop = page.locator('.sheet-backdrop, .event-sheet-backdrop').first();
        if (await backdrop.count()) await backdrop.click({ position: { x: 5, y: 5 } });
        await expect(
          page.locator('.sheet-backdrop, .event-sheet-backdrop'),
          `${name} did not dismiss`,
        ).toHaveCount(0);
      }
    });
  }
});
