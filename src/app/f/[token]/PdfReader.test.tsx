/** @vitest-environment jsdom */
import { describe, it, expect, vi, afterEach } from "vitest";
import React from "react";
import { render, screen, fireEvent, waitFor, cleanup } from "@testing-library/react";

/**
 * Slice 2.3A.2 — the participant PDF "Next" progression. react-pdf is mocked so
 * we can drive onLoadSuccess (numPages) and assert the page index + indicator
 * advance. The advance test is a REGRESSION guard for the stale-closure bug:
 * goNext captured numPages=0 from the first render, so one tap left the reader
 * stuck on 1/2 even though the button looked enabled.
 */
let loadPages = 2; // how many pages the mocked Document reports on load (0 = never loads)

vi.mock("react-pdf", () => ({
  pdfjs: { GlobalWorkerOptions: {} },
  Document: ({ onLoadSuccess, children }: { onLoadSuccess?: (d: { numPages: number }) => void; children: React.ReactNode }) => {
    React.useEffect(() => {
      if (loadPages > 0) onLoadSuccess?.({ numPages: loadPages });
    }, [onLoadSuccess]);
    return React.createElement("div", { "data-testid": "doc" }, children);
  },
  Page: ({ pageNumber }: { pageNumber: number }) =>
    React.createElement("div", { "data-testid": "pdf-page" }, `page ${pageNumber}`),
}));

import { PdfReader, type PdfReaderCopy } from "./PdfReader";

const copy: PdfReaderCopy = {
  loading: "Loading…",
  unavailable: "unavailable",
  unavailableHint: "hint",
  pageOf: (p, t) => `${p} / ${t}`,
  prev: "Back",
  nextPage: "Next page",
  continueToReflection: "Continue to reflection",
};

function renderReader(over: Partial<React.ComponentProps<typeof PdfReader>> = {}) {
  return render(
    <PdfReader
      fileUrl="blob:doc"
      initialPage={1}
      onHeartbeat={() => {}}
      readingComplete={false}
      onContinue={() => {}}
      copy={copy}
      {...over}
    />,
  );
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  loadPages = 2;
});

describe("PdfReader — Next progression (2.3A.2)", () => {
  it("renders and shows 1 / 2 after the document loads", async () => {
    renderReader();
    expect(await screen.findByText("1 / 2")).toBeTruthy();
    expect(screen.getByTestId("pdf-page").textContent).toBe("page 1");
    expect(screen.getByRole("button", { name: "Next page" })).toBeTruthy();
  });

  it("ONE Next tap advances 1 / 2 → 2 / 2 and renders page 2 (regression: stale closure)", async () => {
    renderReader();
    await screen.findByText("1 / 2");
    fireEvent.click(screen.getByRole("button", { name: "Next page" }));
    expect(await screen.findByText("2 / 2")).toBeTruthy();
    expect(screen.getByTestId("pdf-page").textContent).toBe("page 2");
  });

  it("Next is DISABLED while the document is still loading (numPages unknown)", async () => {
    loadPages = 0; // Document never reports numPages
    renderReader();
    const next = (await screen.findByRole("button", { name: "Next page" })) as HTMLButtonElement;
    expect(next.disabled).toBe(true);
  });

  it("on the last page, before reading is complete, the control is a disabled 'Next page' (no enabled no-op)", async () => {
    renderReader({ initialPage: 2, readingComplete: false });
    await screen.findByText("2 / 2");
    const btn = screen.getByRole("button", { name: "Next page" }) as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
    expect(screen.queryByRole("button", { name: "Continue to reflection" })).toBeNull();
  });

  it("on the last page, once reading is complete, it becomes an enabled 'Continue to reflection' → onContinue", async () => {
    const onContinue = vi.fn();
    renderReader({ initialPage: 2, readingComplete: true, onContinue });
    await screen.findByText("2 / 2");
    const btn = screen.getByRole("button", { name: "Continue to reflection" }) as HTMLButtonElement;
    expect(btn.disabled).toBe(false);
    fireEvent.click(btn);
    expect(onContinue).toHaveBeenCalledTimes(1);
  });

  it("clicking Next never advances past the last page (idempotent clamp)", async () => {
    renderReader();
    await screen.findByText("1 / 2");
    const next = () => screen.getByRole("button", { name: "Next page" });
    fireEvent.click(next()); // → 2/2
    await screen.findByText("2 / 2");
    // now last page, not complete → disabled "Next page"; a further click is a no-op
    const btn = next() as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
    fireEvent.click(btn);
    expect(screen.getByText("2 / 2")).toBeTruthy();
    expect(screen.getByTestId("pdf-page").textContent).toBe("page 2");
  });

  it("Back is disabled on page 1 and re-enabled after advancing", async () => {
    renderReader();
    await screen.findByText("1 / 2");
    expect((screen.getByRole("button", { name: "Back" }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "Next page" }));
    await screen.findByText("2 / 2");
    expect((screen.getByRole("button", { name: "Back" }) as HTMLButtonElement).disabled).toBe(false);
  });
});
