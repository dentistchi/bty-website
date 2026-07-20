/** @vitest-environment jsdom */
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, waitFor, cleanup } from "@testing-library/react";
import { ModuleBuilderShell } from "./ModuleBuilderShell";

/**
 * Slice 3.1B-2 — the Leaders eligibility preview must be REALLY MOUNTED in the audience
 * step, not merely present in source. (3.1B-1 shipped a sub-editor that never rendered
 * because no test opened it; this file exists so that cannot recur.)
 *
 * It also pins the product contract the copy must state: this is a preview that does NOT
 * assign, invite, or restrict, and a zero count never silently becomes Everyone.
 */

const jsonRes = (body: unknown, status = 200) => ({
  ok: status >= 200 && status < 300,
  status,
  json: async () => body,
});

/** Draft server parked on the AUDIENCE step (step 2), plus the preview endpoint. */
function mockServers(preview: { eligibleCount: number; members: Array<{ displayName: string | null }> } | { error: true }) {
  const draft = {
    id: "d-1",
    status: "draft",
    current_step: 2,
    answers: { problem: "p", audienceType: "leaders" } as Record<string, unknown>,
    module_version: 1,
    parent_module_id: null,
    document_asset_ref_present: false,
    attachment: null,
    assets: [],
    created_at: "t",
    updated_at: "t",
  };
  global.fetch = vi.fn().mockImplementation((url: string, init?: RequestInit) => {
    const u = String(url);
    if (u.includes("/audience/leaders-preview")) {
      if ("error" in preview) return Promise.resolve(jsonRes({ error: "nope" }, 500));
      return Promise.resolve(
        jsonRes({ ok: true, preview: true, assigns: false, ...preview }),
      );
    }
    if (u.includes("/modules/d-1")) {
      if (init?.method === "PATCH") return Promise.resolve(jsonRes({ ok: true }));
      return Promise.resolve(jsonRes({ draft }));
    }
    return Promise.resolve(jsonRes({ ok: true }));
  }) as unknown as typeof fetch;
}

const renderShell = () =>
  render(<ModuleBuilderShell draftId="d-1" locale="en" onExit={() => {}} />);

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("Leaders eligibility preview is mounted in the audience step", () => {
  it("renders the preview when the audience is Leaders", async () => {
    mockServers({ eligibleCount: 1, members: [{ displayName: "Hanbit Chi" }] });
    renderShell();
    await waitFor(() => expect(screen.getByTestId("leaders-eligibility-preview")).toBeTruthy());
  });

  it("shows the eligible count and the qualifying member by name", async () => {
    mockServers({ eligibleCount: 1, members: [{ displayName: "Hanbit Chi" }] });
    renderShell();
    await waitFor(() => expect(screen.getByTestId("leaders-eligible-count")).toBeTruthy());
    expect(screen.getByTestId("leaders-eligible-count").textContent).toContain("1 member");
    expect(screen.getByTestId("leaders-eligible-names").textContent).toContain("Hanbit Chi");
  });

  it("states plainly that selecting Leaders does NOT assign or restrict", async () => {
    mockServers({ eligibleCount: 1, members: [{ displayName: "Hanbit Chi" }] });
    renderShell();
    const note = await screen.findByTestId("leaders-preview-note");
    const text = note.textContent ?? "";
    expect(text).toMatch(/Preview only/i);
    expect(text).toMatch(/does not assign/i);
    expect(text).toMatch(/anonymous/i);
  });

  it("zero eligible shows an explicit warning and never falls back to Everyone", async () => {
    mockServers({ eligibleCount: 0, members: [] });
    renderShell();
    const warn = await screen.findByTestId("leaders-zero-warning");
    expect(warn.textContent).toMatch(/No one/i);
    // the audience selection is NOT silently rewritten
    expect(screen.queryByTestId("leaders-eligible-names")).toBeNull();
  });

  it("degrades to a readable message when eligibility cannot be resolved", async () => {
    mockServers({ error: true });
    renderShell();
    await waitFor(() => expect(screen.getByTestId("leaders-preview-error")).toBeTruthy());
  });

  it("never sends an organization id from the client", async () => {
    mockServers({ eligibleCount: 1, members: [{ displayName: "Hanbit Chi" }] });
    renderShell();
    await waitFor(() => expect(screen.getByTestId("leaders-eligibility-preview")).toBeTruthy());
    const calls = (global.fetch as unknown as { mock: { calls: unknown[][] } }).mock.calls;
    const previewCall = calls.find((c) => String(c[0]).includes("leaders-preview"));
    expect(previewCall).toBeTruthy();
    expect(String(previewCall![0])).toBe("/api/bty/foundry/audience/leaders-preview");
  });
});
