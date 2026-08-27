/** @vitest-environment jsdom */
import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen, cleanup, act, fireEvent } from "@testing-library/react";
import { ModuleBuilderShell } from "./ModuleBuilderShell";
import { draftIdentityStatement } from "@/domain/foundry/module/module-builder";

/**
 * Slice 3.2L-R1.2 — which training draft is open, visible on screen.
 *
 * THE LIVE FAILURE. Two drafts both restored at Step 8 under the same global Learn
 * header ("What do you want to get better at?"), and the only distinguishing text sat
 * inside a collapsed "All training details" disclosure. The first controlled Founder
 * window ran against the wrong training as a result.
 *
 * These tests assert the visible statement AND the loaded payload together, so a stale
 * label can never falsely identify another draft.
 */

const CANONICAL_ID = "093b0361-7cc8-4688-9f93-396d60582501";
const CANONICAL_PROBLEM = "Our handoffs are inconsistent.";
const CANONICAL_TITLE = "Consistent Handoffs";
const INCIDENT_ID = "35773b57-0000-4000-8000-000000000001";
const INCIDENT_PROBLEM = "새로운 의사들의 교만이 문제야";
const INCIDENT_TITLE = "새 의사 온보딩";

/*
  Slice 3.2R-R2.1 — each draft now carries its own NAME, and the name is what identifies it. That
  strengthens 3.2L-R1.2 rather than replacing it: the guarantee was always "two drafts must never
  present identically", and a distinct title is a better distinguisher than a problem's first line.
  A title is also required for completeness now, so without one the Review details panel would
  auto-open (a blocker must never hide) and these fixtures would no longer be the settled drafts
  they are meant to represent.
*/
const answersFor = (problem: string, title: string) => ({
  title,
  problem,
  audienceType: "everyone",
  recurringMoment: "at each handoff point",
  observableBehavior: "Create a shared handoff standard.",
  successEvidence: "Handoff record",
  learningNeeds: ["know", "decide", "practice"],
  materialIntent: "youtube",
  materialText: "https://youtu.be/x",
  completionPrompt: "What will you include in your handoff record?",
  arenaRecommended: true,
  followUpDays: 7,
});

/** Serves each draft id its OWN payload — the server is the source of truth. */
function mockServer(drafts: Record<string, { current_step: number; answers: Record<string, unknown> }>) {
  const seen: string[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const method = (init?.method ?? "GET").toUpperCase();
      const id = Object.keys(drafts).find((d) => url.includes(d));
      if (method === "GET" && id) {
        seen.push(id);
        return new Response(
          JSON.stringify({
            draft: { id, status: "draft", current_step: drafts[id].current_step, answers: drafts[id].answers, assets: [] },
            program_generation_active: false,
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }
      return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { "Content-Type": "application/json" } });
    }),
  );
  return { seen };
}

async function open(draftId: string) {
  const r = render(<ModuleBuilderShell draftId={draftId} locale="en" onExit={() => {}} />);
  await act(async () => {
    await Promise.resolve();
  });
  await screen.findByTestId("draft-identity");
  return r;
}

beforeEach(() => vi.restoreAllMocks());
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("[3.2L-R1.2] the open draft names itself", () => {
  it("G1 — the canonical draft shows its own statement at Step 8, without expanding anything", async () => {
    const { seen } = mockServer({ [CANONICAL_ID]: { current_step: 9, answers: answersFor(CANONICAL_PROBLEM, CANONICAL_TITLE) } });
    await open(CANONICAL_ID);

    // Visible identity …
    expect(screen.getByTestId("draft-identity-statement").textContent).toBe(CANONICAL_TITLE);
    /*
      … and it came from THIS draft's payload, not a cached or inferred value. Asserted on the
      SET since Slice R4-R9A: Review also asks the ledger whether this context was already
      refused, which is a second GET on the same draft. The claim was never "exactly one
      request" — it is "no other draft was read", and that is what this now says.
    */
    expect([...new Set(seen)]).toEqual([CANONICAL_ID]);
    // The details disclosure is still collapsed — identity did not depend on it.
    expect(screen.getByTestId("all-training-details-toggle").getAttribute("aria-expanded")).not.toBe("true");
    expect(screen.queryByText("Review what you’ve built.")).toBeNull();
  });

  it("G1b — the label is neutral, not an approved program title", async () => {
    mockServer({ [CANONICAL_ID]: { current_step: 9, answers: answersFor(CANONICAL_PROBLEM, CANONICAL_TITLE) } });
    await open(CANONICAL_ID);
    expect(screen.getByTestId("draft-identity").textContent).toContain("Training focus");
  });

  it("G2 — a different Step-8 draft shows ITS statement, and the previous one is gone", async () => {
    mockServer({
      [CANONICAL_ID]: { current_step: 9, answers: answersFor(CANONICAL_PROBLEM, CANONICAL_TITLE) },
      [INCIDENT_ID]: { current_step: 9, answers: answersFor(INCIDENT_PROBLEM, INCIDENT_TITLE) },
    });
    await open(CANONICAL_ID);
    expect(screen.getByTestId("draft-identity-statement").textContent).toBe(CANONICAL_TITLE);

    cleanup();
    await open(INCIDENT_ID);
    expect(screen.getByTestId("draft-identity-statement").textContent).toBe(INCIDENT_TITLE);
    // The two screens must be unmistakably different before Generate is pressed.
    expect(screen.queryByText(CANONICAL_PROBLEM)).toBeNull();
  });

  it("G3 — identity follows the OPENED draft, never the most recently updated one", async () => {
    // The incident draft is deliberately the "newest" here. Opening the canonical draft
    // explicitly must still show the canonical statement — recency is not identity.
    const { seen } = mockServer({
      [INCIDENT_ID]: { current_step: 9, answers: answersFor(INCIDENT_PROBLEM, INCIDENT_TITLE) },
      [CANONICAL_ID]: { current_step: 9, answers: answersFor(CANONICAL_PROBLEM, CANONICAL_TITLE) },
    });
    await open(CANONICAL_ID);
    expect(screen.getByTestId("draft-identity-statement").textContent).toBe(CANONICAL_TITLE);
    // Slice R4-R9A — the SET, for the same reason as G1: Review makes a second read of this
    // same draft to ask the ledger about its context. No OTHER draft is read, which is the claim.
    expect([...new Set(seen)]).toEqual([CANONICAL_ID]);
    expect(screen.queryByText(INCIDENT_PROBLEM)).toBeNull();
  });

  it("G4 — identity stays visible while a generation is pending, and Approve stays disabled", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        const method = (init?.method ?? "GET").toUpperCase();
        /*
          Slice R4-R9A — only the POST hangs. Review asks the ledger first ("has this context
          already been refused?"), and hanging THAT would mean generation never starts, which is
          the opposite of the state this test is about.
        */
        if (url.includes("program-draft")) {
          if (method !== "POST") {
            return new Response(JSON.stringify({ refusal: null }), { status: 200, headers: { "Content-Type": "application/json" } });
          }
          return new Promise(() => {}); // never settles = a generation genuinely in flight
        }
        if (method === "GET") {
          return new Response(
            JSON.stringify({
              draft: { id: CANONICAL_ID, status: "draft", current_step: 9, answers: answersFor(CANONICAL_PROBLEM, CANONICAL_TITLE), assets: [] },
              program_generation_active: false,
            }),
            { status: 200, headers: { "Content-Type": "application/json" } },
          );
        }
        return new Response(JSON.stringify({ ok: true }), { status: 200 });
      }),
    );
    await open(CANONICAL_ID);
    /*
      Slice R4-R8A — no button, no confirmation: arriving on Review IS the gesture now. What
      this test holds is unchanged, and is the reason it is worth keeping through the change —
      while a generation is in flight the Host must still be able to see WHICH training it is
      for, and must not be able to publish underneath it.
    */
    await screen.findByTestId("program-auto-working");
    expect(screen.getByTestId("draft-identity-statement").textContent).toBe(CANONICAL_TITLE);
    expect((screen.getByTestId("publish-cta") as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByTestId("publish-blocked-generation").textContent).toContain("BTY is writing your training program");
  });

  it("G5 — identity survives a refusal and the Discard back to Review", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        if (url.includes("program-draft")) {
          return new Response(JSON.stringify({ error: "invalid_output", refusal: "invented_specifics" }), { status: 502 });
        }
        if ((init?.method ?? "GET").toUpperCase() === "GET") {
          return new Response(
            JSON.stringify({
              draft: { id: CANONICAL_ID, status: "draft", current_step: 9, answers: answersFor(CANONICAL_PROBLEM, CANONICAL_TITLE), assets: [] },
              program_generation_active: false,
            }),
            { status: 200, headers: { "Content-Type": "application/json" } },
          );
        }
        return new Response(JSON.stringify({ ok: true }), { status: 200 });
      }),
    );
    await open(CANONICAL_ID);
    /*
      Slice R4-R9A — this stub answers a refusal WITHOUT a retryability verdict, and an
      unestablished verdict is treated as non-retryable: the safe direction, because offering a
      retry that cannot succeed costs a paid provider call. So the surface is the blocked one.
      What this test holds is unchanged — the draft still names itself, and publish is not wedged.
    */
    await screen.findByTestId("program-auto-blocked");
    expect(screen.getByTestId("draft-identity-statement").textContent).toBe(CANONICAL_TITLE);
    // …and publication is not left wedged by the refusal.
    expect((screen.getByTestId("publish-cta") as HTMLButtonElement).disabled).toBe(false);
  });

  it("G6 — a draft with no statement shows a neutral fallback and invents nothing", async () => {
    mockServer({ [CANONICAL_ID]: { current_step: 1, answers: {} } });
    await open(CANONICAL_ID);
    expect(screen.getByTestId("draft-identity-fallback").textContent).toBe("Untitled training draft");
    expect(screen.queryByTestId("draft-identity-statement")).toBeNull();
  });

  it("G7 — a long statement wraps rather than truncating to an identical-looking prefix", async () => {
    const shared = "Our handoffs at shift change keep missing steps and this creates risk for everyone involved every single day";
    const a = `${shared}, especially on the night shift.`;
    const b = `${shared}, especially on the weekend shift.`;
    // Both exceed the 60-char card-title bound; the identity must keep them distinct.
    expect(draftIdentityStatement({ problem: a })).not.toBe(draftIdentityStatement({ problem: b }));
    expect(draftIdentityStatement({ problem: a })).toBe(a);

    /*
      Slice 3.2R-R2.1 — the rendered identity is now the TITLE, so the wrapping guarantee is
      exercised with a long title. It still matters: a title may run to TITLE_MAX (120), far past
      the 60-character card bound that would otherwise render two names identically.
    */
    const longTitle = "Consistent Handoffs at Shift Change, Especially on the Night Shift Rotation";
    mockServer({ [CANONICAL_ID]: { current_step: 9, answers: answersFor(a, longTitle) } });
    await open(CANONICAL_ID);
    const el = screen.getByTestId("draft-identity-statement");
    expect(el.textContent).toBe(longTitle);
    expect(el.className).toContain("break-words");
    expect(el.className).not.toContain("truncate");
    expect(el.className).not.toContain("whitespace-nowrap");
  });

  it("G8 — identity is a labelled region, read before the Review actions, without stealing the step heading", async () => {
    mockServer({ [CANONICAL_ID]: { current_step: 9, answers: answersFor(CANONICAL_PROBLEM, CANONICAL_TITLE) } });
    const { container } = await open(CANONICAL_ID);
    const section = screen.getByTestId("draft-identity");
    // A NAMED region carries the semantics. It is deliberately not a heading: the Builder
    // guarantees exactly one primary question (h2) per step, and orientation must not
    // compete with it.
    expect(section.tagName).toBe("SECTION");
    expect(section.getAttribute("aria-labelledby")).toBe("draft-identity-label");
    expect(document.getElementById("draft-identity-label")?.textContent).toBe("Training focus");
    expect(screen.getByTestId("draft-identity-statement").tagName).not.toBe("H2");
    // Reading order: identity precedes the publish action in the DOM.
    const html = container.innerHTML;
    expect(html.indexOf('data-testid="draft-identity"')).toBeLessThan(html.indexOf('data-testid="publish-cta"'));
  });
});

describe("[3.2L-R1.2] the identity statement is derived, never invented", () => {
  it("uses the Host's own first meaningful line, untruncated", () => {
    expect(draftIdentityStatement({ problem: CANONICAL_PROBLEM })).toBe(CANONICAL_PROBLEM);
    expect(draftIdentityStatement({ problem: "  \n\n  Second line is the first real one.\nmore" }))
      .toBe("Second line is the first real one.");
  });

  it("returns null rather than fabricating anything", () => {
    expect(draftIdentityStatement(undefined)).toBeNull();
    expect(draftIdentityStatement({})).toBeNull();
    expect(draftIdentityStatement({ problem: "   \n  \n " })).toBeNull();
    expect(draftIdentityStatement({ problem: 42 as unknown as string })).toBeNull();
  });
});
