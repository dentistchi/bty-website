/** @vitest-environment jsdom */
import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, waitFor, cleanup } from "@testing-library/react";

// The document reader pulls in react-pdf/pdfjs (needs DOMMatrix, absent in jsdom) and is not
// exercised on the terminal completion stages under test — stub it so the client can mount.
vi.mock("./PdfReader", () => ({ PdfReader: () => null }));

import FoundryDocumentClient from "./FoundryDocumentClient";

/**
 * Slice 3.1B-3F — the PDF/document Room must connect the assignment on BOTH terminal completion
 * stages. An AUTHENTICATED learner's completeDocumentTraining awards XP inline and lands on
 * `completed_awarded` (never `completed_claimable`); the assignment-claim lives ONLY in claim-xp,
 * so the client must fire a silent claim-xp on `completed_awarded` too — otherwise the assignment
 * is never connected and the Required Learning card never moves to Completed. The video client
 * (FoundryJoinClient) already reconciles on `completed_awarded`; this proves document parity.
 *
 * These assert the CLIENT fires exactly one silent claim-xp per terminal stage (idempotent).
 */

function docSnapshot(stage: "completed_awarded" | "completed_claimable", xp: string) {
  return {
    content_type: "document",
    event: { title: "배가 고파", status: "open" },
    participant: { display_name: "Hanbit" },
    document: null,
    stage,
    xp_status: xp,
  };
}

function mockFetch(stage: "completed_awarded" | "completed_claimable", onClaim: () => void) {
  const loaded = docSnapshot(stage, stage === "completed_awarded" ? "awarded" : "claimable");
  return vi.fn(async (url: string, init?: RequestInit) => {
    const u = String(url);
    if (u.includes("/doc/claim-xp") && init?.method === "POST") {
      onClaim();
      // After claim-xp the assignment is connected; XP already awarded → stays awarded.
      return { ok: true, status: 200, json: async () => ({ ...docSnapshot("completed_awarded", "awarded"), ok: true, assignmentClaim: "claimed" }) };
    }
    // /doc/snapshot (and any other GET) returns the terminal snapshot.
    return { ok: true, status: 200, json: async () => loaded };
  });
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("FoundryDocumentClient — assignment reconcile parity (Slice 3.1B-3F)", () => {
  it("RECONCILE: authenticated PDF completion arriving as completed_awarded fires ONE silent claim-xp", async () => {
    let claimCalls = 0;
    // @ts-expect-error test shim
    global.fetch = mockFetch("completed_awarded", () => { claimCalls += 1; });
    render(<FoundryDocumentClient token="tok" />);
    // The card title proves we rendered the terminal (awarded) surface…
    await waitFor(() => expect(screen.getByText("배가 고파")).toBeTruthy());
    // …and the assignment-connecting claim-xp fired exactly once (the fix).
    await waitFor(() => expect(claimCalls).toBe(1));
    // Stable: no second claim-xp on subsequent renders.
    await new Promise((r) => setTimeout(r, 20));
    expect(claimCalls).toBe(1);
  });

  it("completed_claimable still fires exactly one silent claim-xp (unchanged path)", async () => {
    let claimCalls = 0;
    // @ts-expect-error test shim
    global.fetch = mockFetch("completed_claimable", () => { claimCalls += 1; });
    render(<FoundryDocumentClient token="tok" />);
    await waitFor(() => expect(claimCalls).toBe(1));
    await new Promise((r) => setTimeout(r, 20));
    expect(claimCalls).toBe(1);
  });
});
