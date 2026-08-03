// BUILD 26B — the signed-out Host entry, at every contracted width.
//
// This is the regression guard for D-1: the primary Google sign-in action shipped
// as a bare inline hyperlink (125x18, link-blue, underlined) because the
// `.host-btn` rules it referenced were never written. These tests fail if it ever
// returns to that state.
//
// The signed-out entry makes NO database call (`authorizeHost(null)` short-
// circuits), so this suite is fully deterministic and needs no Google account.
import { test, expect } from '@playwright/test';
import { WIDTHS, MIN_TAP } from './widths';

const CTA = 'a.host-btn.host-btn-primary[href="/host/auth/google"]';

for (const { w, h, label } of WIDTHS) {
  test.describe(`host entry @ ${label}`, () => {
    test.use({ viewport: { width: w, height: h } });

    test('primary Google action is a real, touch-sized primary control', async ({ page }) => {
      await page.goto('/');
      const cta = page.locator(CTA);
      await expect(cta).toBeVisible();

      const box = (await cta.boundingBox())!;
      expect(box, 'the sign-in action must be laid out').toBeTruthy();

      // D-1 REGRESSION GUARD — an inline default hyperlink is ~18px tall.
      expect.soft(box.height, 'sign-in CTA height').toBeGreaterThanOrEqual(MIN_TAP);
      expect(box.height).toBeGreaterThanOrEqual(MIN_TAP);

      const styles = await cta.evaluate((el) => {
        const s = getComputedStyle(el);
        return {
          display: s.display,
          decoration: s.textDecorationLine,
          backgroundImage: s.backgroundImage,
          minHeight: s.minHeight,
        };
      });
      expect(styles.display, 'must not be an inline text link').not.toBe('inline');
      expect(styles.decoration, 'must not be underlined like default link text').toBe('none');
      expect(styles.backgroundImage, 'must carry the primary gold surface').toContain('gradient');
      expect(styles.minHeight).not.toBe('0px');
    });

    test('no document-level horizontal overflow', async ({ page }) => {
      await page.goto('/');
      const { scrollWidth, clientWidth } = await page.evaluate(() => ({
        scrollWidth: document.documentElement.scrollWidth,
        clientWidth: document.documentElement.clientWidth,
      }));
      expect(scrollWidth).toBeLessThanOrEqual(clientWidth);
    });
  });
}

test.describe('host style contract', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('every referenced host-* class receives its intended styling', async ({ page }) => {
    await page.goto('/?notice=signed_out');

    // .host-shell + .host-notice are on the page in this state.
    await expect(page.locator('main.host-shell')).toBeVisible();
    const notice = page.locator('p.host-notice');
    await expect(notice).toBeVisible();
    const noticeStyled = await notice.evaluate((el) => {
      const s = getComputedStyle(el);
      return { border: s.borderLeftWidth, padding: s.paddingLeft, radius: s.borderTopLeftRadius };
    });
    // Unstyled <p> would be 0 on all three.
    expect(noticeStyled.border).not.toBe('0px');
    expect(noticeStyled.padding).not.toBe('0px');
    expect(noticeStyled.radius).not.toBe('0px');

    // The stylesheet must actually define the whole family — a missing rule here
    // is precisely what BUILD 26B fixed.
    const defined = await page.evaluate(() => {
      const wanted = [
        '.host-btn',
        '.host-btn-primary',
        '.host-btn-ghost',
        '.host-shell',
        '.host-form',
        '.host-notice',
        '.host-unavailable',
      ];
      const seen = new Set<string>();
      for (const sheet of Array.from(document.styleSheets)) {
        let rules: CSSRuleList;
        try {
          rules = (sheet as CSSStyleSheet).cssRules;
        } catch {
          continue;
        }
        for (const rule of Array.from(rules)) {
          const sel = (rule as CSSStyleRule).selectorText;
          if (!sel) continue;
          for (const wantedSel of wanted) {
            if (sel.split(',').some((s) => s.trim().split(/[\s>:[]/)[0] === wantedSel)) {
              seen.add(wantedSel);
            }
          }
        }
      }
      return wanted.filter((wsel) => !seen.has(wsel));
    });
    expect(defined, 'host-* classes with no CSS rule').toEqual([]);
  });

  test('a ghost action is visually distinct from the primary action', async ({ page }) => {
    // Rendered in a static probe so the assertion does not depend on an
    // authenticated surface; the classes are the product's own.
    await page.goto('/');
    const distinct = await page.evaluate(() => {
      const mk = (cls: string) => {
        const b = document.createElement('button');
        b.className = cls;
        b.textContent = 'x';
        document.body.appendChild(b);
        const s = getComputedStyle(b);
        const v = { bg: s.backgroundImage, color: s.color, minHeight: s.minHeight };
        b.remove();
        return v;
      };
      return { primary: mk('host-btn host-btn-primary'), ghost: mk('host-btn host-btn-ghost') };
    });
    expect(distinct.primary.bg).toContain('gradient');
    expect(distinct.ghost.bg, 'ghost must not reuse the primary gold gradient').not.toContain(
      'gradient',
    );
    expect(distinct.primary.minHeight).not.toBe('0px');
    expect(distinct.ghost.minHeight).not.toBe('0px');
  });
});
