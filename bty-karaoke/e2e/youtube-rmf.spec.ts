import { test, expect, type Page } from '@playwright/test';

// BUILD 26T-R1B-R6-R1A-J3 — RMF structural proof, measured in a real browser.
//
// Static source inspection is explicitly NOT proof for any of this (§F/§G). Everything below reads
// live DOM geometry or a real network request.
//
// THE SEAM, stated rather than hidden. The production player route needs a room with an active
// event and a playing song, which this harness cannot seed deterministically. So the size/overlay
// proofs run against the REAL shipping route and SKIP — never silently pass — when the route
// cannot produce a live iframe in this environment. A skip is a recorded absence of proof; it is
// not a pass, and it must not be read as one.

const SLUG = process.env.BTY_RMF_ROOM_SLUG ?? 'bty-home';
const PLAYER_PATH = `/r/${SLUG}/player`;

/** Every supported shipping breakpoint. The 200x200 gate must hold at ALL of them — one desktop
 *  width proves nothing (§E). */
const BREAKPOINTS = [
  { name: 'mobile-portrait', width: 390, height: 844 },
  { name: 'mobile-landscape', width: 844, height: 390 },
  { name: 'tablet', width: 820, height: 1180 },
  { name: 'desktop', width: 1440, height: 900 },
  { name: 'narrow-min', width: 320, height: 568 },
];

type Rect = { x: number; y: number; width: number; height: number };

async function playerRect(page: Page): Promise<Rect | null> {
  const iframe = page.locator('.player-frame iframe, iframe[src*="youtube"]').first();
  if ((await iframe.count()) === 0) return null;
  return await iframe.evaluate((el) => {
    const r = el.getBoundingClientRect();
    return { x: r.x, y: r.y, width: r.width, height: r.height };
  });
}

/** Overlap area of two rects. Zero means no intersection — which is the RMF requirement. */
function intersectionArea(a: Rect, b: Rect): number {
  const w = Math.max(0, Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x));
  const h = Math.max(0, Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y));
  return w * h;
}

test.describe('RMF — embedded player size', () => {
  for (const bp of BREAKPOINTS) {
    test(`player is >= 200x200 at ${bp.name} (${bp.width}x${bp.height})`, async ({ page }) => {
      await page.setViewportSize({ width: bp.width, height: bp.height });
      await page.goto(PLAYER_PATH, { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(1500); // let the IFrame API swap the mount node

      const rect = await playerRect(page);
      test.skip(rect === null, `no live iframe at ${PLAYER_PATH} in this environment — NOT a pass`);

      // eslint-disable-next-line no-console
      console.log(`[RMF size] ${bp.name}: ${rect!.width.toFixed(1)} x ${rect!.height.toFixed(1)}`);
      expect(rect!.width, `width at ${bp.name}`).toBeGreaterThanOrEqual(200);
      expect(rect!.height, `height at ${bp.name}`).toBeGreaterThanOrEqual(200);
    });
  }
});

test.describe('RMF — no BTY element in front of a live player', () => {
  for (const bp of [BREAKPOINTS[0], BREAKPOINTS[3]]) {
    test(`zero intersection at ${bp.name}`, async ({ page }) => {
      await page.setViewportSize({ width: bp.width, height: bp.height });
      await page.goto(PLAYER_PATH, { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(1500);

      const rect = await playerRect(page);
      test.skip(rect === null, 'no live iframe in this environment — NOT a pass');

      // Every BTY element that has ever been positioned near the player, plus a sweep of anything
      // absolutely/fixed positioned, so a NEW overlay added later is caught by this test too.
      const offenders = await page.evaluate((iframeRect: Rect) => {
        const overlap = (a: DOMRect) => {
          const w = Math.max(0, Math.min(a.x + a.width, iframeRect.x + iframeRect.width) - Math.max(a.x, iframeRect.x));
          const h = Math.max(0, Math.min(a.y + a.height, iframeRect.y + iframeRect.height) - Math.max(a.y, iframeRect.y));
          return w * h;
        };
        const out: { sel: string; area: number }[] = [];
        document.querySelectorAll<HTMLElement>('body *').forEach((el) => {
          if (el.tagName === 'IFRAME') return;
          if (el.closest('.player-frame')) return; // the mount node itself is the player
          const cs = getComputedStyle(el);
          if (cs.display === 'none' || cs.visibility === 'hidden') return;
          const pos = cs.position;
          const isCandidate =
            pos === 'absolute' || pos === 'fixed' || el.className.toString().includes('player-');
          if (!isCandidate) return;
          const a = overlap(el.getBoundingClientRect());
          if (a > 0) out.push({ sel: el.className.toString() || el.tagName, area: a });
        });
        return out;
      }, rect!);

      // eslint-disable-next-line no-console
      console.log(`[RMF overlay] ${bp.name}: ${offenders.length} intersecting element(s)`);
      expect(offenders, `elements in front of the player at ${bp.name}`).toEqual([]);
    });
  }
});

test.describe('RMF — player parameters and Referer', () => {
  test('modestbranding is absent from the player URL', async ({ page }) => {
    const urls: string[] = [];
    page.on('request', (r) => {
      if (r.url().includes('youtube.com/embed') || r.url().includes('youtube-nocookie')) urls.push(r.url());
    });
    await page.goto(PLAYER_PATH, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);
    test.skip(urls.length === 0, 'no embed request observed in this environment — NOT a pass');
    for (const u of urls) expect(u, 'player URL must not carry the deprecated flag').not.toContain('modestbranding');
  });

  test('the embed request carries a Referer identifying the BTY origin', async ({ page, baseURL }) => {
    // The BROWSER generates this header; it cannot be read from source, which is precisely why
    // §G requires a runtime capture. Only the Referer is inspected — no cookies, tokens or keys.
    const seen: { url: string; referer?: string }[] = [];
    page.on('request', (r) => {
      const u = r.url();
      if (u.includes('youtube.com/embed') || u.includes('youtube-nocookie') || u.includes('youtube.com/iframe_api')) {
        const h = r.headers();
        seen.push({ url: u.split('?')[0], referer: h['referer'] ?? h['Referer'] });
      }
    });
    await page.goto(PLAYER_PATH, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2500);

    test.skip(seen.length === 0, 'no YouTube player request observed in this environment — NOT a pass');
    // eslint-disable-next-line no-console
    console.log('[RMF referer]', JSON.stringify(seen, null, 2));

    const origin = new URL(baseURL ?? 'http://127.0.0.1:3002').origin;
    const withReferer = seen.filter((s) => !!s.referer);
    expect(withReferer.length, 'at least one player request must carry a Referer').toBeGreaterThan(0);
    for (const s of withReferer) {
      expect(s.referer, `Referer on ${s.url}`).toContain(origin);
    }
  });

  test('no player path suppresses the Referer via rel=noreferrer', async ({ page }) => {
    await page.goto(PLAYER_PATH, { waitUntil: 'domcontentloaded' });
    // The BRANDING link may legitimately use noreferrer — that is a different request from the
    // embedded player's, and conflating them is the trap §B calls out. Only the player's own
    // container is inspected here.
    const bad = await page.evaluate(() => {
      const wrap = document.querySelector('.player-frame-wrap');
      if (!wrap) return null;
      return wrap.querySelectorAll('[rel*="noreferrer"]').length;
    });
    test.skip(bad === null, 'player wrap not present in this environment — NOT a pass');
    expect(bad, 'no noreferrer inside the player rectangle').toBe(0);
  });
});
