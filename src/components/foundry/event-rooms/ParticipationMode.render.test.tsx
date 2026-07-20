/** @vitest-environment jsdom */
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, waitFor, cleanup, fireEvent } from "@testing-library/react";
import { ModuleBuilderShell } from "./ModuleBuilderShell";

/**
 * Slice 3.1B-3C — the participation-mode controls must be REALLY MOUNTED in the Builder
 * review step, not merely present in source (the 3.1B-1 lesson). Also pins the
 * non-assignment copy contract and that an assigned publish sends only the declared
 * audience.
 */

const jsonRes = (body: unknown, status = 200) => ({
  ok: status >= 200 && status < 300,
  status,
  json: async () => body,
});

// A review-ready draft (all required fields present) parked on the review step.
function readyDraft(audienceType: string) {
  return {
    id: "d-1",
    status: "draft",
    current_step: 8,
    answers: {
      problem: "Handoffs skip the double-check.",
      audienceType,
      audienceDetail: null,
      observableBehavior: "The charge nurse reads back the dosage.",
      successEvidence: "Sign-offs include a witnessed read-back.",
      evidenceType: "seen",
      learningNeeds: ["practice"],
      materialIntent: "youtube",
      materialText: "https://youtu.be/dQw4w9WgXcQ",
      followUpDays: 7,
      completionPrompt: "What read-back will you commit to?",
    } as Record<string, unknown>,
    module_version: 1,
    parent_module_id: null,
    document_asset_ref_present: false,
    attachment: null,
    assets: [],
    created_at: "t",
    updated_at: "t",
  };
}

function mockServers(opts: { audienceType?: string; publish?: (body: unknown) => { status: number; body: unknown } } = {}) {
  const draft = readyDraft(opts.audienceType ?? "leaders");
  const calls: { publish: unknown[] } = { publish: [] };
  global.fetch = vi.fn().mockImplementation((url: string, init?: RequestInit) => {
    const u = String(url);
    if (u.includes("/audience/leaders-preview")) {
      return Promise.resolve(jsonRes({ ok: true, preview: true, assigns: false, eligibleCount: 1, members: [{ displayName: "Hanbit Chi" }] }));
    }
    if (u.endsWith("/publish")) {
      const body = init?.body ? JSON.parse(String(init.body)) : {};
      calls.publish.push(body);
      const res = opts.publish ? opts.publish(body) : { status: 200, body: { event: { id: "ev-1" } } };
      return Promise.resolve(jsonRes(res.body, res.status));
    }
    if (u.includes("/modules/d-1")) {
      if (init?.method === "PATCH") return Promise.resolve(jsonRes({ ok: true }));
      return Promise.resolve(jsonRes({ draft }));
    }
    return Promise.resolve(jsonRes({ ok: true }));
  }) as unknown as typeof fetch;
  return calls;
}

const renderShell = () => render(<ModuleBuilderShell draftId="d-1" locale="en" onExit={() => {}} />);

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("Participation-mode controls in the Builder review step", () => {
  it("(25) mounts the participation-mode chooser at review", async () => {
    mockServers();
    renderShell();
    await waitFor(() => expect(screen.getByTestId("participation-mode")).toBeTruthy());
    expect(screen.getByTestId("participation-mode-open")).toBeTruthy();
    expect(screen.getByTestId("participation-mode-assigned")).toBeTruthy();
  });

  it("defaults to Open link (assigned detail hidden until chosen)", async () => {
    mockServers();
    renderShell();
    await waitFor(() => expect(screen.getByTestId("participation-mode")).toBeTruthy());
    expect(screen.getByTestId("participation-mode-open").getAttribute("aria-pressed")).toBe("true");
    expect(screen.queryByTestId("participation-mode-assigned-detail")).toBeNull();
  });

  it("choosing Assigned reveals the Leaders eligibility preview and non-assignment copy", async () => {
    mockServers({ audienceType: "leaders" });
    renderShell();
    await waitFor(() => expect(screen.getByTestId("participation-mode")).toBeTruthy());
    fireEvent.click(screen.getByTestId("participation-mode-assigned"));
    await waitFor(() => expect(screen.getByTestId("participation-mode-assigned-detail")).toBeTruthy());
    // reuses the 3.1B-2 preview
    await waitFor(() => expect(screen.getByTestId("leaders-eligibility-preview")).toBeTruthy());
    const note = screen.getByTestId("participation-mode-note").textContent ?? "";
    expect(note).toMatch(/No invitation is sent/i);
    expect(note).toMatch(/no login is required/i);
    expect(note).toMatch(/does not restrict entry/i);
  });

  it("an OPEN_LINK publish sends open_link and NO audience fields", async () => {
    const calls = mockServers({ audienceType: "leaders" });
    renderShell();
    await waitFor(() => expect(screen.getByTestId("publish-cta")).toBeTruthy());
    fireEvent.click(screen.getByTestId("publish-cta"));
    await waitFor(() => expect(calls.publish).toHaveLength(1));
    const body = calls.publish[0] as Record<string, unknown>;
    expect(body.participationMode).toBe("open_link");
    expect(body).not.toHaveProperty("audienceType");
  });

  it("an ASSIGNED publish sends ONLY the declared audience (type + detail), never member ids", async () => {
    const calls = mockServers({ audienceType: "leaders" });
    renderShell();
    await waitFor(() => expect(screen.getByTestId("participation-mode-assigned")).toBeTruthy());
    fireEvent.click(screen.getByTestId("participation-mode-assigned"));
    fireEvent.click(screen.getByTestId("publish-cta"));
    await waitFor(() => expect(calls.publish).toHaveLength(1));
    const body = calls.publish[0] as Record<string, unknown>;
    expect(body.participationMode).toBe("assigned_overlay");
    expect(body.audienceType).toBe("leaders");
    expect(Object.keys(body).sort()).toEqual(["audienceDetail", "audienceType", "locale", "participationMode"].sort());
  });

  it("(12) surfaces a zero-recipient block instead of publishing", async () => {
    const calls = mockServers({
      audienceType: "leaders",
      publish: () => ({ status: 409, body: { error: "zero_recipients" } }),
    });
    renderShell();
    await waitFor(() => expect(screen.getByTestId("participation-mode-assigned")).toBeTruthy());
    fireEvent.click(screen.getByTestId("participation-mode-assigned"));
    fireEvent.click(screen.getByTestId("publish-cta"));
    await waitFor(() => expect(screen.getByTestId("publish-zero-recipients")).toBeTruthy());
    expect(calls.publish).toHaveLength(1);
  });
});
