import { test, expect } from "@playwright/test";

/**
 * GOVERNANCE SURFACE GEOMETRY AT PHONE VIEWPORTS (Slice 3.2I-R5B2-R5C-4B-R1).
 *
 * jsdom performs no layout, so the component tests prove what renders but never the pixels. The
 * defects this file exists to catch are pixel defects: governance copy overflowing horizontally,
 * a sticky action covering a field, and a confirmation sheet whose buttons sit below the fold.
 *
 * HONEST SCOPE. There is no server and no auth here, so this is not the deployed React tree — the
 * surfaces' REAL metrics are reproduced inline (app-shell `px-5` → 350px of content at 390px, the
 * same paddings, radii, font sizes and line heights). What is proven is that these metrics leave
 * no overflow and no collision. That the deployed screens use them is the component tests' job;
 * that the Host sees it is Founder gate G7.
 *
 * `browserName` is a PROJECT option and cannot be set per file, and playwright.config.ts is tracked
 * by both repository indexes, so this runs in the default engine at iPhone-class widths.
 */

const VIEWPORTS = [
  { name: "iphone-390", width: 390, height: 844 },
  { name: "iphone-430", width: 430, height: 932 },
];

const PANEL_HTML = (title: string, body: string, actions: string[]) => `
<!doctype html><html><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<style>
  *,*::before,*::after{box-sizing:border-box}
  body{margin:0;background:#0b0b0b;color:#fff;font-family:system-ui,-apple-system,sans-serif}
  .shell{padding-left:20px;padding-right:20px}
  .panel{display:flex;flex-direction:column;gap:12px;border:1px solid rgba(255,255,255,.12);
         background:rgba(255,255,255,.04);border-radius:16px;padding:16px;max-width:100%}
  .row{display:flex;align-items:flex-start;gap:10px}
  .glyph{flex-shrink:0;font-size:.95rem;line-height:1.5rem;margin-top:2px}
  .col{display:flex;flex-direction:column;gap:6px;min-width:0}
  h3{margin:0;font-size:.98rem;line-height:1.5rem;font-weight:500}
  p{margin:0;font-size:.9rem;line-height:1.5rem;color:rgba(255,255,255,.65);
    overflow-wrap:break-word;word-break:break-word}
  .actions{display:flex;flex-direction:column;gap:8px}
  button{width:100%;border-radius:12px;padding:12px 16px;font-size:.95rem;
         border:1px solid rgba(255,255,255,.12);background:rgba(255,255,255,.03);color:#fff}
  /* The confirmation sheet: bottom-anchored, scrollable, safe-area padded. */
  .sheet-wrap{position:fixed;inset:0;display:flex;align-items:flex-end;justify-content:center;background:rgba(0,0,0,.7)}
  .sheet{display:flex;flex-direction:column;gap:16px;width:100%;max-width:28rem;max-height:85vh;
         overflow-y:auto;border-radius:16px 16px 0 0;background:#141414;padding:20px;
         border:1px solid rgba(255,255,255,.12)}
  ul{margin:0;padding-left:1.1rem;display:flex;flex-direction:column;gap:8px;
     font-size:.92rem;line-height:1.5rem;color:rgba(255,255,255,.65)}
  li{overflow-wrap:break-word}
</style></head><body>
<div class="shell"><section class="panel" data-testid="panel">
  <div class="row"><span class="glyph">■</span><div class="col">
    <h3 data-testid="title">${title}</h3><p data-testid="body">${body}</p></div></div>
  <div class="actions">${actions.map((a, i) => `<button data-testid="action-${i}">${a}</button>`).join("")}</div>
</section></div></body></html>`;

const SHEET_HTML = `
<!doctype html><html><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<style>
  *,*::before,*::after{box-sizing:border-box}
  body{margin:0;background:#0b0b0b;color:#fff;font-family:system-ui,-apple-system,sans-serif}
  .sheet-wrap{position:fixed;inset:0;display:flex;align-items:flex-end;justify-content:center;background:rgba(0,0,0,.7)}
  .sheet{display:flex;flex-direction:column;gap:16px;width:100%;max-width:28rem;max-height:85vh;
         overflow-y:auto;border-radius:16px 16px 0 0;background:#141414;padding:20px;
         border:1px solid rgba(255,255,255,.12)}
  h2{margin:0;font-size:1.05rem;line-height:1.75rem;font-weight:500}
  ul{margin:0;padding-left:1.1rem;display:flex;flex-direction:column;gap:8px;
     font-size:.92rem;line-height:1.5rem;color:rgba(255,255,255,.65)}
  li{overflow-wrap:break-word}
  .acts{display:flex;flex-direction:column;gap:8px}
  button{width:100%;border-radius:12px;padding:12px 16px;font-size:.95rem;
         border:1px solid rgba(255,255,255,.12);background:rgba(255,255,255,.03);color:#fff}
</style></head><body>
<div class="sheet-wrap"><div class="sheet" data-testid="sheet">
  <h2 data-testid="sheet-title">Try this same setup once more?</h2>
  <ul><li>The setup has not changed since the last attempt.</li>
      <li>This creates one more practice situation.</li>
      <li>The result may still be one you cannot use.</li></ul>
  <div class="acts">
    <button data-testid="sheet-review">Review setup instead</button>
    <button data-testid="sheet-confirm">Try once more</button>
    <button data-testid="sheet-cancel">Cancel</button>
  </div></div></div></body></html>`;

/** The longest real strings these surfaces must hold, including Korean (no spaces to wrap on). */
const LONG_TITLE = "This setup produced two situations you could not use";
const LONG_BODY =
  "Change something about the situation setup or the practice boundary, then create a new situation.";
const KO_BODY = "상황 설정이나 연습 경계를 바꾼 뒤 새 상황을 만들어 주세요. 저장해도 상황이 만들어지지 않습니다.";

for (const vp of VIEWPORTS) {
  test.describe(`governance surfaces at ${vp.name}`, () => {
    test.use({ viewport: { width: vp.width, height: vp.height } });

    test("the panel never overflows horizontally, in either language", async ({ page }) => {
      for (const body of [LONG_BODY, KO_BODY]) {
        await page.setContent(PANEL_HTML(LONG_TITLE, body, ["Review setup", "Try once more"]));
        const doc = await page.evaluate(() => ({
          scrollW: document.documentElement.scrollWidth,
          clientW: document.documentElement.clientWidth,
        }));
        // The single defect a Host feels first: a page that scrolls sideways.
        expect(doc.scrollW, `${vp.name} horizontal overflow`).toBeLessThanOrEqual(doc.clientW);

        const panel = await page.locator('[data-testid="panel"]').boundingBox();
        expect(panel!.width).toBeLessThanOrEqual(vp.width - 40 + 1); // inside the shell's px-5
      }
    });

    test("copy wraps instead of clipping, and every line is inside the panel", async ({ page }) => {
      await page.setContent(PANEL_HTML(LONG_TITLE, KO_BODY, ["Review setup"]));
      const m = await page.evaluate(() => {
        const p = document.querySelector('[data-testid="body"]') as HTMLElement;
        const panel = document.querySelector('[data-testid="panel"]') as HTMLElement;
        return {
          clipped: p.scrollHeight > p.clientHeight + 1,
          bottomInside: p.getBoundingClientRect().bottom <= panel.getBoundingClientRect().bottom + 1,
          scrollW: p.scrollWidth,
          clientW: p.clientWidth,
        };
      });
      expect(m.clipped, "body copy is clipped").toBe(false);
      expect(m.bottomInside).toBe(true);
      expect(m.scrollW).toBeLessThanOrEqual(m.clientW + 1);
    });

    test("actions never overlap the copy above them", async ({ page }) => {
      await page.setContent(PANEL_HTML(LONG_TITLE, LONG_BODY, ["Review setup", "Try once more"]));
      const body = await page.locator('[data-testid="body"]').boundingBox();
      const first = await page.locator('[data-testid="action-0"]').boundingBox();
      const second = await page.locator('[data-testid="action-1"]').boundingBox();
      expect(first!.y, "action overlaps the explanation").toBeGreaterThanOrEqual(body!.y + body!.height - 1);
      expect(second!.y).toBeGreaterThanOrEqual(first!.y + first!.height - 1);
      // Full-width stacked actions at phone widths — never a cramped side-by-side row.
      expect(Math.round(first!.width)).toBe(Math.round(second!.width));
    });

    test("every confirmation action is reachable inside the sheet", async ({ page }) => {
      await page.setContent(SHEET_HTML);
      const sheet = await page.locator('[data-testid="sheet"]').boundingBox();
      for (const id of ["sheet-review", "sheet-confirm", "sheet-cancel"]) {
        const b = await page.locator(`[data-testid="${id}"]`).boundingBox();
        expect(b, id).not.toBeNull();
        expect(b!.width, `${id} width`).toBeGreaterThan(100);
        // Inside the sheet's own scroll box, so it is reachable even when the sheet is capped.
        expect(b!.y).toBeGreaterThanOrEqual(sheet!.y - 1);
      }
      const m = await page.evaluate(() => {
        const s = document.querySelector('[data-testid="sheet"]') as HTMLElement;
        return { canScroll: s.scrollHeight <= s.clientHeight || getComputedStyle(s).overflowY === "auto" };
      });
      expect(m.canScroll, "sheet content must be reachable").toBe(true);
      const doc = await page.evaluate(() => ({
        scrollW: document.documentElement.scrollWidth,
        clientW: document.documentElement.clientWidth,
      }));
      expect(doc.scrollW).toBeLessThanOrEqual(doc.clientW);
    });

    test("the sheet stays within the viewport height", async ({ page }) => {
      await page.setContent(SHEET_HTML);
      const sheet = await page.locator('[data-testid="sheet"]').boundingBox();
      // 85vh cap plus bottom anchoring: the sheet can never be taller than the screen.
      expect(sheet!.height).toBeLessThanOrEqual(vp.height * 0.85 + 1);
      expect(sheet!.y + sheet!.height).toBeLessThanOrEqual(vp.height + 1);
    });
  });
}
