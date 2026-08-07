import { test, expect } from "@playwright/test";

/**
 * THE NON-PAID PHYSICAL READABILITY GATE, automated (Slice 3.2L-R5) — G13/G14/G15.
 *
 * The R4 window ended in a terminal refusal and displayed no proposal, so the AutoTextarea
 * repair shipped in R4 has still never been rendered on a phone. `/dev/program-review-preview`
 * exists so that question can be answered without spending a provider call.
 *
 * This runs the REAL page in WebKit — the engine the Capacitor shell uses — at an iPhone
 * viewport, and asserts three things the unit tests cannot:
 *
 *   1. loading, editing, resetting and discarding issue ZERO network requests to any
 *      provider, generation, apply or publish endpoint;
 *   2. no section's last line is clipped, at live lengths and at the 700-character ceiling;
 *   3. the fields stay editable — review and edit share one control.
 *
 * Requires a server (`baseURL`). Skipped automatically when none is reachable, so the suite
 * does not fail on a machine with nothing running.
 */

const PATH = "/en/dev/program-review-preview";

/** Anything that would mean the preview reached a real backend. */
const FORBIDDEN = /\/api\/(bty\/foundry|arena|bty\/action-contract)|program-draft|module-draft|openai|anthropic|completions/i;

test.describe("Program review preview — non-paid readability gate", () => {
  test.beforeEach(async ({ page, baseURL }) => {
    test.skip(!baseURL, "needs a running server");
    const res = await page.goto(PATH, { waitUntil: "domcontentloaded" }).catch(() => null);
    test.skip(res === null, "server not reachable");
    test.skip(res!.status() === 404, "preview route not enabled in this environment");
    await expect(page.getByTestId("program-review-preview")).toBeVisible();
    // The entry button exists before React hydrates, and a click that lands first does
    // nothing. Wait for the page to settle so the handler is attached.
    await page.waitForLoadState("networkidle");
  });

  /** Entry → target confirmation → review, the same path the Host takes. */
  async function openReview(page: import("@playwright/test").Page) {
    await page.getByTestId("program-generate").click();
    const confirm = page.getByTestId("program-target-confirm-action");
    await expect(confirm).toBeVisible();
    await confirm.click();
    await expect(page.getByTestId("program-review")).toBeVisible();
  }

  test("G14: the route is enabled here, and says plainly that it is not real", async ({ page }) => {
    await expect(page.getByTestId("preview-banner")).toHaveText(/not a real training draft/i);
    // Never indexed.
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/i);
  });

  test("G8: the banner carries the build identity, and it matches /api/version", async ({ page, request }) => {
    // Visible BEFORE the proposal is opened, so a physical recording proves which source
    // rendered it — the ambiguity that made the R6.2 report unfalsifiable.
    const shown = ((await page.getByTestId("preview-build").textContent()) ?? "").replace("Build ", "").trim();
    expect(shown).toMatch(/^[0-9a-f]{8}$|^unidentified$/);

    const res = await request.get("/api/version", { headers: { "Cache-Control": "no-cache" } });
    const live = ((await res.json()) as { version: string }).version;
    if (shown === "unidentified") {
      // Only legitimate when the server itself cannot identify the build (local dev).
      expect(live.startsWith("0.1.0") || !/^[0-9a-f]{40}$/.test(live)).toBe(true);
    } else {
      expect(live.slice(0, 8)).toBe(shown);
    }
  });

  test("G13: opening the proposal issues no provider, generation or apply request", async ({ page }) => {
    const seen: string[] = [];
    page.on("request", (r) => {
      if (FORBIDDEN.test(r.url())) seen.push(`${r.method()} ${r.url()}`);
    });

    await openReview(page);

    // Edit a section, then discard.
    const field = page.getByTestId("program-edit-why_it_matters");
    await field.fill("A shorter rewrite of why this matters, typed by the Host during the gate.");
    await page.getByTestId("program-discard").click();
    await expect(page.getByTestId("program-authorship-entry")).toBeVisible();

    expect(seen, `preview must not call a backend: ${seen.join(", ")}`).toEqual([]);
  });

  test("G13: applying is a visible no-op and writes nothing", async ({ page }) => {
    const seen: string[] = [];
    page.on("request", (r) => {
      if (FORBIDDEN.test(r.url())) seen.push(r.url());
    });
    await openReview(page);
    await page.getByTestId("program-apply").click();
    await expect(page.getByTestId("preview-apply-noop")).toContainText(/nothing was added/i);
    expect(seen).toEqual([]);
  });

  test("G10: derived sections render as free-flowing text — clipping is structurally impossible", async ({ page }) => {
    await openReview(page);
    // R6.1 replaced six free textareas with read-only derived text plus structured controls.
    // A paragraph cannot clip the way a fixed-height textarea did.
    const derived = await page.evaluate(() =>
      Array.from(document.querySelectorAll('[data-testid^="program-derived-"]')).map((el) => ({
        id: (el as HTMLElement).dataset.testid ?? "",
        tag: el.tagName,
        chars: (el.textContent ?? "").length,
        overflow: el.scrollHeight - el.clientHeight,
      })),
    );
    expect(derived.length).toBeGreaterThanOrEqual(5);
    for (const d of derived) {
      expect(d.tag, d.id).toBe("P");
      expect(d.overflow, `${d.id} overflows by ${d.overflow}px`).toBeLessThanOrEqual(1);
      expect(d.chars, d.id).toBeGreaterThan(20);
    }
  });

  test("G10: the narrative field still grows and shrinks with its content", async ({ page }) => {
    await openReview(page);
    const field = page.getByTestId("program-edit-why_it_matters");
    /*
      The faithful fixture's narrative is SHORT — the middle of the live one was never
      stored, so it is an excerpt rather than invented prose (Slice 3.2L-R8.1). The clipping
      property still has to hold at the ceiling, so the ceiling-length text is typed in here
      instead of being baked into a fixture that would then misrepresent the live result.
    */
    const short = await field.evaluate((el) => (el as HTMLTextAreaElement).clientHeight);
    await field.fill("W".padEnd(690, "o") + ".");
    const long = await field.evaluate((el) => {
      const t = el as HTMLTextAreaElement;
      return { h: t.clientHeight, overflow: t.scrollHeight - t.clientHeight, chars: t.value.length };
    });
    expect(long.chars).toBeGreaterThan(400);
    expect(long.overflow).toBeLessThanOrEqual(1);
    expect(long.h).toBeGreaterThan(short);
  });

  test("G9: structured controls propagate to every dependent section, with zero network", async ({ page }) => {
    const seen: string[] = [];
    page.on("request", (r) => {
      if (FORBIDDEN.test(r.url())) seen.push(r.url());
    });
    await openReview(page);

    const standard = page.getByTestId("program-derived-observable_standard");
    const apply = page.getByTestId("program-derived-field_application");
    const beforeStandard = await standard.textContent();
    const beforeApply = await apply.textContent();

    await page.getByTestId("program-details-toggle-observable_standard").click();
    await page.getByTestId("program-field-actor").fill("the duty pharmacist");

    await expect(standard).toContainText("the duty pharmacist");
    await expect(apply).toContainText("the duty pharmacist");
    expect(await standard.textContent()).not.toBe(beforeStandard);
    expect(await apply.textContent()).not.toBe(beforeApply);
    await expect(page.getByTestId("program-section-observable_standard")).toContainText("Adjusted by you");

    // Reset restores BTY's draft exactly.
    await page.getByTestId("program-reset").click();
    expect(await standard.textContent()).toBe(beforeStandard);
    await expect(page.getByTestId("program-section-observable_standard")).toContainText("Drafted by BTY");

    expect(seen, `preview must not call a backend: ${seen.join(", ")}`).toEqual([]);
  });

  test("G12: all six instructional disclosures open and expose their controls", async ({ page }) => {
    await openReview(page);
    const expected: [string, string[]][] = [
      // R8 splits completion into a named confirmer and the act you would see.
      ["observable_standard", ["actor", "trigger", "action", "confirmed-by", "completion"]],
      // R8.1 removes the scenario's own "where and when": one moment, the trigger's.
      ["scenario", ["pressure", "pressure-detail"]],
      ["action_decision", ["moment"]],
      // R8 removes the competing evidence field: one completion authority, one control.
      ["field_application", ["moment-apply"]],
      ["completion_check", ["verifies", "responds"]],
      ["follow_up", ["focus", "confirmer"]],
    ];
    for (const [kind, fields] of expected) {
      await page.getByTestId(`program-details-toggle-${kind}`).click();
      await expect(page.getByTestId(`program-details-${kind}`)).toBeVisible();
      for (const f of fields) await expect(page.getByTestId(`program-field-${f}`)).toBeVisible();
      // Internal contract names must never reach the screen.
      const text = (await page.getByTestId(`program-details-${kind}`).textContent()) ?? "";
      expect(text).not.toMatch(/behavior_contract|verification_target|response_mode|scenario_contract/);
      await page.getByTestId(`program-details-toggle-${kind}`).click();
    }
  });

  test("G1: a plural actor never produces 'doctors faces' or 'doctors states'", async ({ page }) => {
    await openReview(page);
    await page.getByTestId("program-details-toggle-observable_standard").click();
    await page.getByTestId("program-field-actor").fill("Doctors");
    const all = await page.evaluate(() =>
      Array.from(document.querySelectorAll('[data-testid^="program-derived-"]')).map((el) => el.textContent ?? ""),
    );
    for (const t of all) {
      expect(t.toLowerCase(), t).not.toContain("doctors faces");
      expect(t.toLowerCase(), t).not.toContain("doctors states");
    }
    expect(all.join(" ")).toContain("doctors must");
  });

  test("G4/G13: the moment renders first-person in the decision and neutral in the instruction", async ({ page }) => {
    await openReview(page);
    const decision = await page.getByTestId("program-derived-action_decision").textContent() ?? "";
    const apply = await page.getByTestId("program-derived-field_application").textContent() ?? "";
    expect(decision).not.toMatch(/\byour\b/);
    expect(decision).toMatch(/I will /);
    expect(apply).not.toMatch(/\bmy\b/);

    await page.getByTestId("program-details-toggle-action_decision").click();
    await page.getByTestId("program-field-moment").fill("during the Monday huddle");
    await expect(page.getByTestId("program-derived-action_decision")).toContainText("During the Monday huddle");
    await expect(page.getByTestId("program-derived-field_application")).toContainText("During the Monday huddle");
  });

  test("G14/G15: the enum controls re-render grammatical text, day count fixed", async ({ page }) => {
    await openReview(page);
    await page.getByTestId("program-details-toggle-completion_check").click();
    for (const target of ["the_application_plan", "the_confirmation_step"]) {
      await page.getByTestId("program-field-verifies").selectOption(target);
      await expect(page.getByTestId("program-derived-completion_check")).toContainText("?");
    }
    for (const mode of ["state_what_you_will_say", "name_what_could_stop_you"]) {
      await page.getByTestId("program-field-responds").selectOption(mode);
      const q = await page.getByTestId("program-derived-completion_check").textContent() ?? "";
      expect(q.endsWith("?"), q).toBe(true);
    }
    await page.getByTestId("program-details-toggle-completion_check").click();

    await page.getByTestId("program-details-toggle-follow_up").click();
    for (const focus of ["what_happened_next", "the_confirmation"]) {
      await page.getByTestId("program-field-focus").selectOption(focus);
      const f = await page.getByTestId("program-derived-follow_up").textContent() ?? "";
      expect(f, f).toContain("In 7 days");
      expect(f, f).not.toMatch(/said when you say|did when you do/);
    }
    await page.getByTestId("program-field-confirmer").selectOption("the_other_person");
    await expect(page.getByTestId("program-derived-follow_up")).toContainText("In 7 days");
  });

  test("G16: only semantically affected sections show Adjusted by you", async ({ page }) => {
    await openReview(page);
    await page.getByTestId("program-details-toggle-observable_standard").click();
    await page.getByTestId("program-field-actor").fill("Doctors");
    // The actor is not rendered by the first-person decision, so that badge must not move.
    await expect(page.getByTestId("program-section-observable_standard")).toContainText("Adjusted by you");
    await expect(page.getByTestId("program-section-field_application")).toContainText("Adjusted by you");
    await expect(page.getByTestId("program-section-action_decision")).toContainText("Drafted by BTY");
    await expect(page.getByTestId("program-section-why_it_matters")).toContainText("Drafted by BTY");

    await page.getByTestId("program-reset").click();
    for (const kind of ["observable_standard", "field_application", "action_decision"]) {
      await expect(page.getByTestId(`program-section-${kind}`)).toContainText("Drafted by BTY");
    }
  });

  test("R8: the four defects the live v5 program shipped with are gone", async ({ page }) => {
    await openReview(page);
    const text = async (k: string) => (await page.getByTestId(`program-derived-${k}`).textContent()) ?? "";
    const standard = await text("observable_standard");
    const scenario = await text("scenario");
    const apply = await text("field_application");

    // 1. A completion clause with a real subject — v5 rendered "It is complete when receive…".
    expect(standard).toContain("It is complete when you see the next owner confirm");
    expect(standard).not.toMatch(/complete when receive/);

    // 2. ONE completion definition — APPLY IT repeats it rather than inventing another.
    expect(apply).toContain("You will know it happened when you see the next owner confirm");

    // 3. No doubled preposition — v5 rendered "In during a team meeting…".
    expect(scenario).not.toContain("In during");

    // 4. ONE MOMENT (Slice 3.2L-R8.1). R8 re-attached the trigger but kept the scenario's
    //    own occasion in front of it, so the program still required the behaviour at two
    //    different events. The sentence now OPENS on the trigger and there is no bridge.
    expect(scenario.startsWith("At the end of each project or task, even when")).toBe(true);
    expect(scenario).not.toContain("Even then");
    expect(scenario).not.toContain("team meeting");

    // And the ceiling no longer contradicts itself.
    const ceiling = (await page.getByTestId("program-evidence-ceiling").textContent()) ?? "";
    expect(ceiling).toContain("reflection, not competence");
    expect(ceiling).not.toMatch(/equipped to|ready to implement/i);
  });

  test("R8.1 G1/G2: the page says which result it replays, and shows the live title", async ({ page }) => {
    await expect(page.getByTestId("preview-fixture")).toHaveText(/R7 V5 live result c9718bd3/);
    await expect(page.getByTestId("preview-fixture-note")).toContainText(/never stored/i);
    await openReview(page);
    await expect(page.getByTestId("program-title-input")).toHaveValue("Improving Handoff Consistency");

    // No sentence from the retired shift-handover fixture survives anywhere on the page.
    const body = (await page.locator("body").textContent()) ?? "";
    for (const stale of ["Handing over what", "When a shift ends", "predictable shift change", "the person taking over"]) {
      expect(body, stale).not.toContain(stale);
    }
    // The outcome promise is not part of the PROGRAM. It is quoted once, deliberately, in
    // the banner note that says it was removed — so the check is scoped to the review.
    const review = (await page.getByTestId("program-review").textContent()) ?? "";
    expect(review).not.toContain("ultimately affects project success");
    expect(review).toContain("Establishing a consistent handoff standard");
    expect(review).not.toContain("….");
  });

  test("R8.1 G8/G9: exactly one evidence-ceiling paragraph", async ({ page }) => {
    await openReview(page);
    const block = page.getByTestId("program-evidence-ceiling");
    await expect(block).toBeVisible();
    // The R8 page printed a short generic ceiling and then a long one under it.
    expect(await block.locator("p").count()).toBe(1);
    const t = (await block.textContent()) ?? "";
    expect(t.match(/Nothing here can show/g) ?? []).toHaveLength(1);
    expect(t.match(/exposed to it/g) ?? []).toHaveLength(1);
    for (const claim of ["equipped to", "ready to implement", "now competent", "was observed"]) {
      expect(t, claim).not.toContain(claim);
    }
  });

  test("R8.1 G10/G11: provenance describes the sentence, not the field that moved", async ({ page }) => {
    await openReview(page);
    const apply = page.getByTestId("program-derived-field_application");
    await expect(apply).toContainText("you see the next owner confirm they understand what they are taking on");

    await page.getByTestId("program-details-toggle-observable_standard").click();
    await page.getByTestId("program-field-confirmed-by").fill("the incoming team member");
    await page.getByTestId("program-field-completion").fill("repeat back who owns the next action");

    // THE EXACT LIVE BADGE DEFECT: APPLY IT visibly changed and stayed "Drafted by BTY".
    await expect(apply).toContainText("you see the incoming team member repeat back who owns the next action");
    await expect(page.getByTestId("program-section-field_application")).toContainText("Adjusted by you");
    await expect(page.getByTestId("program-section-observable_standard")).toContainText("Adjusted by you");
    await expect(page.getByTestId("program-section-scenario")).toContainText("Adjusted by you");

    // …and the inverse: these two did NOT change, and claimed they had.
    await expect(page.getByTestId("program-section-completion_check")).toContainText("Drafted by BTY");
    await expect(page.getByTestId("program-section-follow_up")).toContainText("Drafted by BTY");

    // G12 — Reset restores values, sentences and badges together.
    await page.getByTestId("program-reset").click();
    await expect(apply).toContainText("you see the next owner confirm they understand what they are taking on");
    for (const kind of ["observable_standard", "scenario", "field_application", "completion_check", "follow_up"]) {
      await expect(page.getByTestId(`program-section-${kind}`)).toContainText("Drafted by BTY");
    }
  });

  test("R8.1 G4: the scenario control cannot give the program a second moment", async ({ page }) => {
    await openReview(page);
    await page.getByTestId("program-details-toggle-scenario").click();
    // The Host is asked what makes it hard, never when it happens.
    const labels = (await page.getByTestId("program-details-scenario").textContent()) ?? "";
    expect(labels).toContain("What makes this moment hard?");
    expect(labels).not.toMatch(/[Ww]here and when/);

    await page.getByTestId("program-field-pressure").fill("during the next team meeting nobody is listening");
    // The sentence still opens on the one canonical trigger…
    await expect(page.getByTestId("program-derived-scenario")).toContainText("At the end of each project or task, even when");
    // …and Apply is blocked rather than shipping a program with two moments in it.
    await expect(page.getByTestId("program-review-block")).toContainText(/not another moment/i);
    await expect(page.getByTestId("program-apply")).toBeDisabled();
  });

  test("G15: the page — not the field — is the scrolling surface", async ({ page }) => {
    await openReview(page);
    // Reachable by scrolling the PAGE. Nothing is trapped inside a field: the sections
    // grew to their content, so the only scroll that has to work is the document's.
    const apply = page.getByTestId("program-apply");
    await apply.scrollIntoViewIfNeeded();
    await expect(apply).toBeInViewport();

    // And no generated field needs its own inner scroll to be read.
    const innerScrollNeeded = await page.evaluate(() =>
      Array.from(document.querySelectorAll<HTMLTextAreaElement>('[data-testid^="program-edit-"]'))
        .filter((t) => t.scrollHeight - t.clientHeight > 1)
        .map((t) => t.dataset.testid),
    );
    expect(innerScrollNeeded).toEqual([]);
  });

  test("R8.1 G3: no assumption or warning is shown, because none was recorded", async ({ page }) => {
    await openReview(page);
    /*
      The R8 page carried the retired fixture's shift-change assumptions next to a
      project/task standard. This proposal's own assumptions were never stored, so the
      faithful fixture shows none rather than borrowing them.
    */
    await expect(page.getByTestId("program-assumptions")).toHaveCount(0);
    await expect(page.getByTestId("program-warnings")).toHaveCount(0);
  });
});
