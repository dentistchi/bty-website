import { test, expect } from "@playwright/test";

/**
 * PROGRAM REVIEW FIELD GEOMETRY IN WEBKIT AT AN iPHONE VIEWPORT (Slice 3.2L-R4).
 *
 * THE DEFECT. The fifth controlled window's recording showed the final line of WHY THIS
 * MATTERS, IN CONTEXT and WHAT HAPPENS NEXT cut off by the field's lower border while the
 * Founder scrolled the review normally. THIS ASSUMES and WORTH NOTING rendered in full.
 *
 * That split is the whole diagnosis: the clipped sections were `<textarea rows={3}>`, the
 * intact ones were free-flowing `<p>`/`<li>`. `rows` is a FIXED height, element content is
 * allowed 700 characters, and iOS draws no scrollbar at rest — so overflow reads as
 * truncation. A Founder cannot exercise review authority over text they cannot read.
 *
 * This project runs WEBKIT — the engine the Capacitor shell actually uses — at an iPhone
 * viewport, which the earlier practice geometry spec could not do (`browserName` is a
 * project option, so that file documented running in Blink instead).
 *
 * HONEST SCOPE. This is not the deployed React tree; there is no server and no auth here.
 * The sizing routine and the review surface's real metrics are reproduced inline, so what
 * is proven is that the RULE plus THESE metrics leave no clipped line at 390px. That the
 * deployed component uses the rule is `AutoTextarea.test.tsx` and the render suite's job;
 * that the Host sees it is still a device gate.
 */

/** The seven sections at the lengths the live window actually produced, and at the ceiling. */
const SECTIONS = [
  {
    id: "why_it_matters",
    value:
      "When a handoff misses a step, the next person starts without knowing what changed, and the risk quietly lands on them instead of on the person who left it behind.",
  },
  {
    id: "observable_standard",
    value:
      "At the end of every shift, before leaving the floor, the outgoing person states each unfinished task, its deadline and its risk out loud to the person taking over. It is complete when the person taking over repeats the list back and confirms they have it.",
  },
  {
    id: "scenario",
    value:
      "You are finishing a long shift and two people are already asking you questions. The handoff is the last thing standing between you and the door, and the person taking over has not arrived yet.",
  },
  { id: "action_decision", value: "I will state every open item aloud at handoff, even when the shift ran late." },
  {
    id: "field_application",
    value:
      "During the next project handoff meeting, I will actively state each unfinished task and its deadline so the information is communicated clearly.",
  },
  { id: "completion_check", value: "What will you say aloud at your next handoff that you did not say before?" },
  {
    id: "follow_up",
    value:
      "In seven days you will be asked what you actually said at handoff and what happened next. That is your own account of it, not an observation of it.",
  },
  /** The domain ceiling — sizing must hold for the largest value the validator accepts. */
  { id: "at-max", value: "A sentence that keeps going and going and going. ".repeat(14).slice(0, 700) },
] as const;

/**
 * The review surface's real classes as CSS: `px-4 py-3` card inside a `p-5` modal at 390,
 * `text-sm` / `leading-6`, a 1px border, and the modal's own `max-h-[85dvh]` scroll region.
 */
const PAGE = `
<meta name="viewport" content="width=device-width, initial-scale=1">
<style>
  *, *::before, *::after { box-sizing: border-box; }
  body { margin: 0; font-family: system-ui, -apple-system, sans-serif; background: #0B1F3A; }
  #modal { max-height: 85dvh; overflow-y: auto; overscroll-behavior: contain; padding: 1.25rem;
           background: #0B1F3A; display: flex; flex-direction: column; gap: 1rem; }
  .card { border: 1px solid rgba(255,255,255,0.1); background: rgba(255,255,255,0.02);
          border-radius: 0.75rem; padding: 0.75rem 1rem; display: flex; flex-direction: column; gap: 0.5rem; }
  .label { font-size: 0.75rem; letter-spacing: 0.12em; text-transform: uppercase; color: rgba(201,166,107,0.85); }
  .field { display: block; width: 100%; border: 1px solid rgba(255,255,255,0.12); border-radius: 0.5rem;
           background: rgba(255,255,255,0.03); color: rgba(255,255,255,0.85); outline: none; resize: none;
           padding: 0.5rem 0.75rem; font-size: 0.875rem; line-height: 1.5rem; }
  .advisory { font-size: 0.875rem; line-height: 1.5rem; color: rgba(255,255,255,0.7); }
  #apply { min-height: 2.75rem; border-radius: 0.75rem; background: #C9A66B; color: #0B1F3A;
           font-weight: 600; border: 0; padding: 0.625rem 1.25rem; }
</style>
<div id="modal">
  ${SECTIONS.map(
    (s) =>
      `<div class="card"><span class="label">${s.id}</span><textarea id="${s.id}" class="field" rows="3">${s.value}</textarea></div>`,
  ).join("")}
  <div class="card" id="assumptions"><span class="label">This assumes</span>
    <p class="advisory">Participants are willing to engage in the training process.</p>
    <p class="advisory">Participants understand the importance of consistent handoffs in their work.</p>
  </div>
  <button id="apply">Add this program to my training</button>
</div>
<script>
  // The exact rule AutoTextarea applies. Reset first, or scrollHeight can never report
  // less than the height already set; then add the border, because scrollHeight measures
  // the PADDING box while height under border-box sets the BORDER box.
  for (const el of document.querySelectorAll('textarea')) {
    el.style.height = 'auto';
    const next = el.scrollHeight;
    if (next <= 0) continue;
    const cs = getComputedStyle(el);
    const border = cs.boxSizing === 'border-box'
      ? (parseFloat(cs.borderTopWidth) || 0) + (parseFloat(cs.borderBottomWidth) || 0) : 0;
    el.style.height = (next + border) + 'px';
  }
</script>
`;

test.describe("Program review sections in WebKit at an iPhone viewport", () => {
  test.beforeEach(async ({ page }) => {
    await page.setContent(PAGE);
    await page.waitForFunction(() => document.querySelectorAll("textarea").length > 0);
  });

  test("the engine really is WebKit at an iPhone width", async ({ browserName, page }) => {
    expect(browserName).toBe("webkit");
    expect(page.viewportSize()?.width).toBe(390);
  });

  for (const s of SECTIONS) {
    test(`${s.id}: the full text height is represented and no line is clipped`, async ({ page }) => {
      const m = await page.locator(`#${s.id}`).evaluate((el) => {
        const t = el as HTMLTextAreaElement;
        return { scrollHeight: t.scrollHeight, clientHeight: t.clientHeight, overflow: getComputedStyle(t).overflowY };
      });
      // 1px of tolerance for sub-pixel rounding; more than that is a clipped line.
      expect(m.scrollHeight - m.clientHeight).toBeLessThanOrEqual(1);
      // Nothing is concealed to pass this — the fix is height, not hidden overflow.
      expect(m.overflow).not.toBe("hidden");
    });

    test(`${s.id}: the last line sits inside the visible box`, async ({ page }) => {
      const inside = await page.locator(`#${s.id}`).evaluate((el) => {
        const t = el as HTMLTextAreaElement;
        // Scrolling the field to its end must move nothing: there is no hidden remainder.
        t.scrollTop = t.scrollHeight;
        return t.scrollTop <= 1;
      });
      expect(inside).toBe(true);
    });
  }

  test("three rows remains the MINIMUM — a short field is not collapsed", async ({ page }) => {
    const h = await page.locator("#action_decision").evaluate((el) => (el as HTMLTextAreaElement).clientHeight);
    // 3 rows at 24px line-height plus padding; a collapsed one-line field would be far less.
    expect(h).toBeGreaterThanOrEqual(72);
  });

  test("the modal is the scrolling surface, and the apply action is reachable", async ({ page }) => {
    const reachable = await page.evaluate(async () => {
      const modal = document.getElementById("modal")!;
      modal.scrollTop = modal.scrollHeight;
      await new Promise((r) => requestAnimationFrame(r));
      const b = document.getElementById("apply")!.getBoundingClientRect();
      return b.bottom <= window.innerHeight + 1;
    });
    expect(reachable).toBe(true);
  });

  test("every field stays editable and remeasures when content changes", async ({ page }) => {
    const grew = await page.locator("#completion_check").evaluate(async (el) => {
      const t = el as HTMLTextAreaElement;
      const before = t.clientHeight;
      t.value = `${t.value} ${"And one more clause that forces another wrapped line. ".repeat(4)}`;
      t.style.height = "auto";
      const cs = getComputedStyle(t);
      const border = (parseFloat(cs.borderTopWidth) || 0) + (parseFloat(cs.borderBottomWidth) || 0);
      t.style.height = `${t.scrollHeight + border}px`;
      return { before, after: t.clientHeight, clipped: t.scrollHeight - t.clientHeight, readOnly: t.readOnly, disabled: t.disabled };
    });
    expect(grew.after).toBeGreaterThan(grew.before);
    expect(grew.clipped).toBeLessThanOrEqual(1);
    // Review and edit share this control: it must stay usable, not be made read-only.
    expect(grew.readOnly).toBe(false);
    expect(grew.disabled).toBe(false);
  });

  test("shrinking content remeasures downward too, so a reset does not leave a gap", async ({ page }) => {
    const shrank = await page.locator("#at-max").evaluate(async (el) => {
      const t = el as HTMLTextAreaElement;
      const before = t.clientHeight;
      t.value = "Short again.";
      t.style.height = "auto";
      const cs = getComputedStyle(t);
      const border = (parseFloat(cs.borderTopWidth) || 0) + (parseFloat(cs.borderBottomWidth) || 0);
      t.style.height = `${t.scrollHeight + border}px`;
      return { before, after: t.clientHeight };
    });
    expect(shrank.after).toBeLessThan(shrank.before);
  });

  /**
   * MUTATION PROOF. Without the sizing rule these same metrics clip — so the assertions
   * above are testing the fix, not passing vacuously. This is the shipped defect,
   * reproduced in the engine the Founder was holding.
   */
  test("the defect is real: the same fields at rows=3 DO clip without the rule", async ({ page }) => {
    await page.setContent(PAGE.replace(/<script>[\s\S]*<\/script>/, ""));
    const clipped = await page.evaluate(() =>
      Array.from(document.querySelectorAll("textarea"))
        .filter((el) => (el as HTMLTextAreaElement).scrollHeight - (el as HTMLTextAreaElement).clientHeight > 1)
        .map((el) => el.id),
    );
    // The exact sections the recording showed cut off.
    expect(clipped).toContain("why_it_matters");
    expect(clipped).toContain("scenario");
    expect(clipped).toContain("follow_up");
  });

  test("advisory blocks stay free-flowing, exactly as the recording showed", async ({ page }) => {
    const kind = await page.evaluate(() => {
      const block = document.getElementById("assumptions")!;
      return {
        textareas: block.querySelectorAll("textarea").length,
        paragraphs: block.querySelectorAll("p").length,
      };
    });
    expect(kind.textareas).toBe(0);
    expect(kind.paragraphs).toBeGreaterThan(0);
  });
});
