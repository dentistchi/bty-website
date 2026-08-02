import { test, expect } from "@playwright/test";

/**
 * PRACTICE EDITOR FIELD GEOMETRY AT AN iPHONE VIEWPORT (Slice 3.2I-R5B2-R3).
 *
 * jsdom performs no layout, so the unit tests can prove the sizing RULE but never the pixels. The
 * Founder's defect was pixels: the title's second line and the last lines of the opening situation
 * and escalation were cut off by the field border.
 *
 * This runs a real engine — WebKit, the engine the Capacitor shell actually uses — at 390 CSS
 * pixels, with the fields' REAL metrics: the app-shell scroll layout (`px-5` → 350px of field
 * width), the same padding, font size and line height, and the same `rows` minimums.
 *
 * HONEST SCOPE. This is not the deployed React tree; there is no server and no auth here. The
 * three-line sizing routine is reproduced inline, so what is proven is that the RULE plus these
 * METRICS leave no clipped line and no field/action collision at 390px. That the deployed editor
 * uses this rule is the unit tests' job; that the Host sees it is device gates R3-A–R3-E.
 */

/**
 * `viewport` IS settable per file; `browserName` is NOT — it is a project option, and asking for
 * webkit here would be silently ignored. Adding a project would mean editing playwright.config.ts,
 * which is tracked by BOTH repository indexes, so this runs in the default engine (Blink) at an
 * iPhone-class width instead. The measurement at issue — scrollHeight being the padding box while
 * `height` under border-box is the border box — is spec-defined and identical across engines; the
 * shortfall was first observed in WebKit and reproduces here.
 */
test.use({ viewport: { width: 390, height: 844 } });

/** Values of the shape the recording showed, at and beyond the domain maxima that matter. */
const TITLE = "The handoff nobody wants to own at the end of a very long shift today";
const OPENING =
  "It is the end of a long shift. A colleague hands over a task that is not finished, and the person who could fix it has already left for the day. Do you raise it now, or carry it quietly and sort it out tomorrow morning before anyone else notices what happened?";
const ESCALATION =
  "You raise it, and the room goes quiet. Someone points out that raising it now means the whole team stays late, and that the same thing happened last month without any consequence at all for anyone involved.";
const PROMPT = "What will you actually do before you leave the building tonight, and who exactly will you tell about it?";
const KO_OPENING =
  "긴 교대 근무가 끝날 무렵입니다. 동료가 끝내지 못한 일을 넘겼고, 그것을 바로잡을 수 있는 사람은 이미 그날 퇴근했습니다. 지금 문제를 제기하시겠습니까, 아니면 조용히 안고 갔다가 내일 아침에 정리하시겠습니까?";
/** The domain ceiling for opening / escalation — sizing must hold for the largest accepted value. */
const AT_MAX = "낱".repeat(0) + "A sentence that keeps going and going. ".repeat(30); // ~1170 chars

const FIELDS = [
  { id: "title", value: TITLE, rows: 1, scale: "body" },
  { id: "opening", value: OPENING, rows: 4, scale: "body" },
  { id: "escalation", value: ESCALATION, rows: 3, scale: "body" },
  { id: "prompt", value: PROMPT, rows: 2, scale: "body" },
  { id: "choice", value: "Raise it now, and accept that the whole team stays late tonight", rows: 2, scale: "choice" },
  { id: "ko-opening", value: KO_OPENING, rows: 4, scale: "body" },
  { id: "at-max", value: AT_MAX, rows: 4, scale: "body" },
] as const;

/**
 * The app-shell layout and the fields' real classes, as CSS. `box-sizing: border-box` matches
 * Tailwind preflight; `px-5` on the scroll region is what makes the field 350px wide at 390.
 */
const PAGE = `
<meta name="viewport" content="width=device-width, initial-scale=1">
<style>
  *, *::before, *::after { box-sizing: border-box; }
  body { margin: 0; font-family: system-ui, -apple-system, sans-serif; }
  .shell { display: flex; flex-direction: column; height: 100dvh; overflow: hidden; background: #0B1F3A; }
  main { flex: 1 1 0%; overflow-y: auto; padding: 2rem 1.25rem 1rem; }
  .field { display: block; width: 100%; border: 1px solid rgba(255,255,255,0.12); border-radius: 0.75rem;
           background: rgba(0,0,0,0.3); color: rgba(255,255,255,0.9); outline: none; resize: none; }
  .body  { padding: 0.75rem 1rem; font-size: 0.95rem; line-height: 1.5rem; }
  .choice{ padding: 0.5rem 0.75rem; font-size: 0.9rem;  line-height: 1.5rem; }
  .label { display: block; font-size: 0.75rem; color: rgba(255,255,255,0.4); margin: 1.25rem 0 0.375rem; }
  #actions { margin-top: 0.5rem; display: flex; flex-direction: column; gap: 0.75rem;
             border: 1px solid rgba(255,255,255,0.1); border-radius: 1rem;
             background: rgba(255,255,255,0.03); padding: 1rem 1rem max(1rem, env(safe-area-inset-bottom)); }
  #actions button { min-height: 3rem; width: 100%; border-radius: 0.75rem; padding: 0.75rem 1.25rem;
                    font-size: 0.95rem; font-weight: 600; border: 1px solid rgba(201,166,107,0.5);
                    background: transparent; color: #C9A66B; }
  nav { flex-shrink: 0; border-top: 1px solid rgba(255,255,255,0.1); background: #0B1F3AF2;
        padding: 0.75rem 0 max(0.5rem, env(safe-area-inset-bottom)); color: #fff; text-align: center; }
</style>
<div class="shell">
  <main>
    ${FIELDS.map(
      (f) =>
        `<span class="label">${f.id}</span><textarea id="${f.id}" class="field ${f.scale}" rows="${f.rows}">${f.value}</textarea>`,
    ).join("")}
    <div id="actions">
      <button>Publish practice</button><button>Save draft</button><button>Try it as a learner</button>
    </div>
  </main>
  <nav id="nav">Today · Learn · Practice · Me</nav>
</div>
<script>
  // The same three-line rule the AutoTextarea component applies. Reset first, or scrollHeight can
  // never report less than the height already set.
  for (const el of document.querySelectorAll('textarea')) {
    el.style.height = 'auto';
    const next = el.scrollHeight;
    if (next <= 0) continue;
    // scrollHeight is the PADDING box; under border-box the height property is the BORDER box.
    const cs = getComputedStyle(el);
    const border = cs.boxSizing === 'border-box'
      ? (parseFloat(cs.borderTopWidth) || 0) + (parseFloat(cs.borderBottomWidth) || 0) : 0;
    el.style.height = (next + border) + 'px';
  }
</script>
`;

test.describe("Practice editor fields at 390px", () => {
  test.beforeEach(async ({ page }) => {
    await page.setContent(PAGE);
    await page.waitForFunction(() => document.querySelectorAll("textarea").length > 0);
  });

  test("the viewport really is iPhone-class", async ({ page }) => {
    expect(page.viewportSize()?.width).toBe(390);
    // The field is what `px-5` leaves of it — the width the wrapping is decided at.
    const w = await page.locator("#opening").evaluate((el) => Math.round(el.getBoundingClientRect().width));
    expect(w).toBe(350);
  });

  for (const f of FIELDS) {
    test(`${f.id}: no line is clipped and no inner scrollbar is needed`, async ({ page }) => {
      const m = await page.locator(`#${f.id}`).evaluate((el) => {
        const t = el as HTMLTextAreaElement;
        return { scrollHeight: t.scrollHeight, clientHeight: t.clientHeight, overflow: getComputedStyle(t).overflowY };
      });
      // 1px of tolerance for sub-pixel rounding; anything more is a clipped line.
      expect(m.scrollHeight - m.clientHeight).toBeLessThanOrEqual(1);
      expect(m.overflow).not.toBe("hidden"); // nothing is being concealed to pass this
    });

    test(`${f.id}: the last line sits inside the visible box`, async ({ page }) => {
      const inside = await page.locator(`#${f.id}`).evaluate((el) => {
        const t = el as HTMLTextAreaElement;
        // Scrolling to the very end must move nothing — there is nothing below the fold.
        t.scrollTop = t.scrollHeight;
        return t.scrollTop <= 1;
      });
      expect(inside).toBe(true);
    });
  }

  test("no field rectangle intersects the action panel", async ({ page }) => {
    const hits = await page.evaluate(() => {
      const a = document.getElementById("actions")!.getBoundingClientRect();
      const bad: string[] = [];
      for (const el of Array.from(document.querySelectorAll("textarea"))) {
        const r = el.getBoundingClientRect();
        if (r.left < a.right && r.right > a.left && r.top < a.bottom && r.bottom > a.top) bad.push(el.id);
      }
      return bad;
    });
    expect(hits).toEqual([]);
  });

  test("the action panel does not intersect the bottom navigation", async ({ page }) => {
    const overlap = await page.evaluate(() => {
      const a = document.getElementById("actions")!.getBoundingClientRect();
      const n = document.getElementById("nav")!.getBoundingClientRect();
      return a.left < n.right && a.right > n.left && a.top < n.bottom && a.bottom > n.top;
    });
    expect(overlap).toBe(false);
  });

  test("every field is reachable by scrolling the page, not the field", async ({ page }) => {
    const reachable = await page.evaluate(async () => {
      const main = document.querySelector("main")!;
      main.scrollTop = main.scrollHeight;
      await new Promise((r) => requestAnimationFrame(r));
      const a = document.getElementById("actions")!.getBoundingClientRect();
      // The action panel is reachable at the end of the page scroll.
      return a.bottom <= window.innerHeight + 1;
    });
    expect(reachable).toBe(true);
  });
});
