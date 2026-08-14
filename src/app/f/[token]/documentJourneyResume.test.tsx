/** @vitest-environment jsdom */
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, waitFor, cleanup } from "@testing-library/react";
/*
  pdfjs needs DOMMatrix, which jsdom lacks. The stub also FIRES a heartbeat on mount, because
  that is the whole point: the live defect was the POST result coming back through `applyResult`
  and deleting the journey. A stub that renders nothing would never reproduce it.
*/
vi.mock("./PdfReader", () => ({
  PdfReader: ({ onHeartbeat }: { onHeartbeat: (b: { lastPage: number; viewedPages: number[]; activeMsDelta: number }) => void }) => {
    setTimeout(() => onHeartbeat({ lastPage: 4, viewedPages: [1, 2, 3, 4], activeMsDelta: 5000 }), 0);
    return null;
  },
}));
import FoundryDocumentClient from "./FoundryDocumentClient";

/**
 * SLICE 3.2R-R8A-R1 — THE DEVICE SAID NO, AND THE DEVICE WAS RIGHT.
 *
 * R8A shipped the journey to the document learner: the server returned it, the client bundle
 * contained the renderer, the HTML was `no-store`, and the chunk hash matched. Every check
 * passed and a real iPhone still showed title → PDF → completion surface, with no program.
 *
 * The failing boundary was `applyResult`, which rebuilt the snapshot field by field from a POST
 * response and named every key except the new one. So `load()` fetched the journey correctly and
 * the PDF reader's FIRST heartbeat came back through `applyResult` and replaced the snapshot with
 * an object that had no journey. It rendered and vanished within a second.
 *
 * R8A's own tests could not catch it: they rendered `JourneyReading` directly with a fresh
 * fixture. This one drives the CLIENT, in the exact live state — joined, all pages read,
 * `document_read_completed_at` non-null, `completed_at` null — and then fires a heartbeat.
 */
const JOURNEY = {
  displayTitle: "Building Accountability in Huddles",
  elements: [
    { id: "el_why_it_matters", kind: "why_it_matters", content: "When a problem is raised and nobody is named, the next step belongs to no one." },
    { id: "el_observable_standard", kind: "observable_standard", content: "During morning huddles, you must state the owner, action, and deadline for each agreed item." },
    { id: "el_scenario", kind: "scenario", content: "During morning huddles, even when it is not obvious who should take it, you must state the owner." },
    { id: "el_reflection", kind: "reflection", content: "What usually happens when an action needs an owner after a huddle?" },
    { id: "el_field_application", kind: "field_application", content: "The next time this happens, you must state the owner, action, and deadline." },
    { id: "el_evidence", kind: "evidence", content: "The huddle note records one owner and one deadline for every agreed action." },
    { id: "el_completion_check", kind: "completion_check", content: "What exactly will you say when you state the owner, action, and deadline for each agreed item?" },
    { id: "el_follow_up", kind: "follow_up", content: "In 7 days you will be asked what happened. That is your own account of it, not an observation." },
  ],
};

/** The EXACT live state: joined, 4/4 read, reading complete, not yet completed. */
const RESUMED = {
  content_type: "document",
  event: { title: "Building Accountability in Huddles", status: "open" },
  participant: { display_name: "조인람" },
  document: {
    page_count: 4, min_read_seconds: 20, intro: null, last_page: 4,
    distinct_pages_viewed: 4, active_read_ms: 418000, reading_complete: true,
    completion_prompt: "What exactly will you say when you state the owner, action, and deadline for each agreed item?",
    shared_question: "In your own words, what is the most important standard from this training?",
  },
  journey: JOURNEY,
  stage: "response",
  xp_status: "none",
};

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function mockFetch(snapshot: unknown, heartbeat: unknown) {
  vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    if (init?.method === "POST" && url.includes("/reading")) {
      return { ok: true, status: 200, json: async () => heartbeat } as unknown as Response;
    }
    if (url.includes("/snapshot")) {
      return { ok: true, status: 200, json: async () => snapshot } as unknown as Response;
    }
    // The signed file url must SUCCEED, or the client renders its error block instead of the
    // reader — and the heartbeat this test depends on would never fire.
    if (url.includes("/file")) {
      return { ok: true, status: 200, json: async () => ({ ok: true, url: "blob:pdf", expires_in: 600 }) } as unknown as Response;
    }
    return { ok: false, status: 404, json: async () => ({ ok: false }) } as unknown as Response;
  }));
}

describe("[3.2R-R8A-R1] a resumed, read-complete learner still sees the program", () => {
  it("renders the journey on load", async () => {
    mockFetch(RESUMED, { ok: true, ...RESUMED });
    render(<FoundryDocumentClient token="btyroom.a.b" />);
    await waitFor(() => expect(screen.getByTestId("journey-el-reflection")).toBeTruthy());
    expect(screen.getByText("What usually happens when an action needs an owner after a huddle?")).toBeTruthy();
    expect(screen.getByTestId("journey-el-why_it_matters")).toBeTruthy();
    expect(screen.getByTestId("journey-el-follow_up")).toBeTruthy();
  });

  it("AND SURVIVES a POST result that omits the journey — the exact live defect", async () => {
    /*
      The heartbeat response here deliberately has NO `journey` key, which is what a partial or
      older payload looks like. Before the fix, this deleted the program from the screen.
    */
    /*
      The heartbeat response carries NO journey and a VISIBLY different participant name, so the
      test can wait for `applyResult`'s state update to actually flush before asserting. Without
      that anchor the assertion runs before React re-renders and passes even when the journey is
      being dropped — which is exactly how a first version of this test gave a false pass.
    */
    const withoutJourney = { ok: true, ...RESUMED, document: { ...RESUMED.document, distinct_pages_viewed: 2 }, journey: undefined };
    mockFetch(RESUMED, withoutJourney);
    render(<FoundryDocumentClient token="btyroom.a.b" />);
    await waitFor(() => expect(screen.getByTestId("journey-el-reflection")).toBeTruthy());

    // Wait until the heartbeat's snapshot has REPLACED state — the page counter is rendered
    // from `document`, so a changed value proves `applyResult` flushed before we assert.
    await waitFor(() => expect(screen.getByText("2 of 4 pages read")).toBeTruthy());

    // THE ASSERTION THE DEVICE FAILED: the program is still on the screen afterwards.
    expect(screen.getByTestId("journey-el-reflection")).toBeTruthy();
    expect(screen.getByText("What usually happens when an action needs an owner after a huddle?")).toBeTruthy();
  });

  it("the completion surface stays exactly as it was — R8B owns that correction", () => {
    mockFetch(RESUMED, { ok: true, ...RESUMED });
    render(<FoundryDocumentClient token="btyroom.a.b" />);
    return waitFor(() => {
      // Still the completion prompt, still under its current label. Unchanged on purpose.
      expect(screen.getByText("What exactly will you say when you state the owner, action, and deadline for each agreed item?")).toBeTruthy();
      // And it is NOT part of the journey reading list.
      expect(screen.queryByTestId("journey-el-completion_check")).toBeNull();
    });
  });
});
