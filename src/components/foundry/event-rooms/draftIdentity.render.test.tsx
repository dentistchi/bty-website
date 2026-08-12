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
const INCIDENT_ID = "35773b57-0000-4000-8000-000000000001";
const INCIDENT_PROBLEM = "새로운 의사들의 교만이 문제야";

const answersFor = (problem: string) => ({
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
    const { seen } = mockServer({ [CANONICAL_ID]: { current_step: 9, answers: answersFor(CANONICAL_PROBLEM) } });
    await open(CANONICAL_ID);

    // Visible identity …
    expect(screen.getByTestId("draft-identity-statement").textContent).toBe(CANONICAL_PROBLEM);
    // … and it came from THIS draft's payload, not a cached or inferred value.
    expect(seen).toEqual([CANONICAL_ID]);
    // The details disclosure is still collapsed — identity did not depend on it.
    expect(screen.getByTestId("all-training-details-toggle").getAttribute("aria-expanded")).not.toBe("true");
    expect(screen.queryByText("Review what you’ve built.")).toBeNull();
  });

  it("G1b — the label is neutral, not an approved program title", async () => {
    mockServer({ [CANONICAL_ID]: { current_step: 9, answers: answersFor(CANONICAL_PROBLEM) } });
    await open(CANONICAL_ID);
    expect(screen.getByTestId("draft-identity").textContent).toContain("Training focus");
  });

  it("G2 — a different Step-8 draft shows ITS statement, and the previous one is gone", async () => {
    mockServer({
      [CANONICAL_ID]: { current_step: 9, answers: answersFor(CANONICAL_PROBLEM) },
      [INCIDENT_ID]: { current_step: 9, answers: answersFor(INCIDENT_PROBLEM) },
    });
    await open(CANONICAL_ID);
    expect(screen.getByTestId("draft-identity-statement").textContent).toBe(CANONICAL_PROBLEM);

    cleanup();
    await open(INCIDENT_ID);
    expect(screen.getByTestId("draft-identity-statement").textContent).toBe(INCIDENT_PROBLEM);
    // The two screens must be unmistakably different before Generate is pressed.
    expect(screen.queryByText(CANONICAL_PROBLEM)).toBeNull();
  });

  it("G3 — identity follows the OPENED draft, never the most recently updated one", async () => {
    // The incident draft is deliberately the "newest" here. Opening the canonical draft
    // explicitly must still show the canonical statement — recency is not identity.
    const { seen } = mockServer({
      [INCIDENT_ID]: { current_step: 9, answers: answersFor(INCIDENT_PROBLEM) },
      [CANONICAL_ID]: { current_step: 9, answers: answersFor(CANONICAL_PROBLEM) },
    });
    await open(CANONICAL_ID);
    expect(screen.getByTestId("draft-identity-statement").textContent).toBe(CANONICAL_PROBLEM);
    expect(seen).toEqual([CANONICAL_ID]);
    expect(screen.queryByText(INCIDENT_PROBLEM)).toBeNull();
  });

  it("G4 — identity stays visible while a generation is pending, and Approve stays disabled", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        const method = (init?.method ?? "GET").toUpperCase();
        if (url.includes("program-draft")) return new Promise(() => {}); // never settles = pending
        if (method === "GET") {
          return new Response(
            JSON.stringify({
              draft: { id: CANONICAL_ID, status: "draft", current_step: 9, answers: answersFor(CANONICAL_PROBLEM), assets: [] },
              program_generation_active: false,
            }),
            { status: 200, headers: { "Content-Type": "application/json" } },
          );
        }
        return new Response(JSON.stringify({ ok: true }), { status: 200 });
      }),
    );
    await open(CANONICAL_ID);
    // Slice 3.2L-R1.3 put a target confirmation between the button and the provider.
    await act(async () => {
      fireEvent.click(screen.getByTestId("program-generate"));
    });
    await act(async () => {
      fireEvent.click(screen.getByTestId("program-target-confirm-action"));
    });
    expect(screen.getByTestId("program-working")).toBeTruthy();
    expect(screen.getByTestId("draft-identity-statement").textContent).toBe(CANONICAL_PROBLEM);
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
              draft: { id: CANONICAL_ID, status: "draft", current_step: 9, answers: answersFor(CANONICAL_PROBLEM), assets: [] },
              program_generation_active: false,
            }),
            { status: 200, headers: { "Content-Type": "application/json" } },
          );
        }
        return new Response(JSON.stringify({ ok: true }), { status: 200 });
      }),
    );
    await open(CANONICAL_ID);
    // Slice 3.2L-R1.3 put a target confirmation between the button and the provider.
    await act(async () => {
      fireEvent.click(screen.getByTestId("program-generate"));
    });
    await act(async () => {
      fireEvent.click(screen.getByTestId("program-target-confirm-action"));
    });
    expect(screen.getByTestId("program-failure")).toBeTruthy();
    expect(screen.getByTestId("draft-identity-statement").textContent).toBe(CANONICAL_PROBLEM);
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

    mockServer({ [CANONICAL_ID]: { current_step: 9, answers: answersFor(a) } });
    await open(CANONICAL_ID);
    const el = screen.getByTestId("draft-identity-statement");
    expect(el.textContent).toBe(a);
    expect(el.className).toContain("break-words");
    expect(el.className).not.toContain("truncate");
    expect(el.className).not.toContain("whitespace-nowrap");
  });

  it("G8 — identity is a labelled region, read before the Review actions, without stealing the step heading", async () => {
    mockServer({ [CANONICAL_ID]: { current_step: 9, answers: answersFor(CANONICAL_PROBLEM) } });
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
