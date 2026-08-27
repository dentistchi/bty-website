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
    current_step: 9,
    answers: {
      // Slice 3.2R-R2.1 — a complete draft carries a NAME distinct from its problem.
      title: "Read Back Before Sign-Off",
      problem: "Handoffs skip the double-check.",
      audienceType,
      audienceDetail: null,
      recurringMoment: "at each handoff point",
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
      // Default: echo an AUTHORITATIVE committed result matching the requested mode.
      const committed =
        body.participationMode === "assigned_overlay"
          ? { mode: "assigned_overlay", assignmentCount: 1, audienceType: "leaders" }
          : { mode: "open_link", assignmentCount: 0, audienceType: null };
      const res = opts.publish
        ? opts.publish(body)
        : { status: 200, body: { event: { id: "ev-1" }, participation: committed } };
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

/**
 * Slice R4-R8A — Review starts a program generation by itself, and publication is leased out
 * while one is in flight (`generationPending`). Clicking the CTA before that settles lands on a
 * disabled button, so every publish here waits for the lease to be released first. That wait is
 * the product behaviour, not a test workaround: a Host cannot create a session on top of a
 * program that is still being written.
 */
async function publishNow() {
  await waitFor(() => expect((screen.getByTestId("publish-cta") as HTMLButtonElement).disabled).toBe(false));
  fireEvent.click(screen.getByTestId("publish-cta"));
}

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
    await publishNow();
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
    await publishNow();
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
    await publishNow();
    await waitFor(() => expect(screen.getByTestId("publish-zero-recipients")).toBeTruthy());
    expect(calls.publish).toHaveLength(1);
  });
});

describe("Review screen distinguishes OPEN_LINK vs ASSIGNED (3.1B-3C fix)", () => {
  it("OPEN_LINK selected shows 'No member assignments will be created'", async () => {
    mockServers({ audienceType: "leaders" });
    renderShell();
    await waitFor(() => expect(screen.getByTestId("participation-mode")).toBeTruthy());
    // default is open link
    const summary = await screen.findByTestId("participation-open-summary");
    expect(summary.textContent).toMatch(/No member assignments will be created/i);
    // and it is NOT visually implying assignment despite the audience being Leaders
    expect(screen.queryByTestId("participation-intended-count")).toBeNull();
  });

  it("Leaders + Assigned shows the intended count 'This will create 1 required-learning assignment'", async () => {
    mockServers({ audienceType: "leaders" });
    renderShell();
    await waitFor(() => expect(screen.getByTestId("participation-mode-assigned")).toBeTruthy());
    fireEvent.click(screen.getByTestId("participation-mode-assigned"));
    const intended = await screen.findByTestId("participation-intended-count");
    expect(intended.textContent).toMatch(/This will create 1 required-learning assignment/i);
    expect(screen.getByTestId("participation-room-note").textContent).toMatch(/room remains link-based/i);
  });
});

describe("Post-publish confirmation uses the AUTHORITATIVE committed result", () => {
  it("OPEN_LINK publish confirms zero assignments", async () => {
    mockServers({ audienceType: "leaders" });
    renderShell();
    await publishNow();
    const confirm = await screen.findByTestId("publish-confirmation");
    expect(confirm).toBeTruthy();
    expect(screen.getByTestId("publish-confirm-open").textContent).toMatch(/No assignments created/i);
    expect(screen.queryByTestId("publish-confirm-count")).toBeNull();
  });

  it("ASSIGNED publish confirms the COMMITTED assignment count (not the preview)", async () => {
    // server commits 1 even though we don't read the preview here
    mockServers({ audienceType: "leaders" });
    renderShell();
    await waitFor(() => expect(screen.getByTestId("participation-mode-assigned")).toBeTruthy());
    fireEvent.click(screen.getByTestId("participation-mode-assigned"));
    await publishNow();
    const count = await screen.findByTestId("publish-confirm-count");
    expect(count.textContent).toMatch(/1 assignment created/i);
    expect(screen.getByTestId("publish-confirm-room").textContent).toMatch(/room remains link-based/i);
  });

  it("a compensated/failed publish never shows assignment success", async () => {
    // server-side compensation surfaces as an assignment_write_failed error, not a success
    const calls = mockServers({
      audienceType: "leaders",
      publish: () => ({ status: 500, body: { error: "assignment_write_failed" } }),
    });
    renderShell();
    await waitFor(() => expect(screen.getByTestId("participation-mode-assigned")).toBeTruthy());
    fireEvent.click(screen.getByTestId("participation-mode-assigned"));
    await publishNow();
    await waitFor(() => expect(calls.publish).toHaveLength(1));
    // no confirmation panel, no count
    expect(screen.queryByTestId("publish-confirmation")).toBeNull();
    expect(screen.queryByTestId("publish-confirm-count")).toBeNull();
  });

  it("the confirmation reflects the SERVER mode even if the client requested assigned but server committed open_link", async () => {
    // defence: server is source of truth. Client toggled assigned; server says open_link/0.
    mockServers({
      audienceType: "leaders",
      publish: () => ({ status: 200, body: { event: { id: "ev-1" }, participation: { mode: "open_link", assignmentCount: 0, audienceType: null } } }),
    });
    renderShell();
    await waitFor(() => expect(screen.getByTestId("participation-mode-assigned")).toBeTruthy());
    fireEvent.click(screen.getByTestId("participation-mode-assigned"));
    await publishNow();
    const confirm = await screen.findByTestId("publish-confirmation");
    expect(confirm).toBeTruthy();
    // shows the OPEN_LINK confirmation because the server committed open_link
    expect(screen.getByTestId("publish-confirm-open")).toBeTruthy();
    expect(screen.queryByTestId("publish-confirm-count")).toBeNull();
  });
});

describe("Publish errors are specific and actionable (3.1B-3C-fix2, real-app repro)", () => {
  it("the EXACT failed-gate path: assigned Leaders + invalid YouTube URL shows a YouTube message, not generic retry", async () => {
    // Reproduces the live failure: preflight/UI fine, but createTrainingEvent rejects the
    // material with youtube_url_invalid (a Foundry room link pasted as the video), so no
    // event is created. The Host must see WHY, not "try once more".
    const calls = mockServers({
      audienceType: "leaders",
      publish: () => ({ status: 400, body: { error: "youtube_url_invalid" } }),
    });
    renderShell();
    await waitFor(() => expect(screen.getByTestId("participation-mode-assigned")).toBeTruthy());
    fireEvent.click(screen.getByTestId("participation-mode-assigned"));
    await publishNow();
    const err = await screen.findByTestId("publish-error");
    expect(err.textContent).toMatch(/valid YouTube URL/i);
    // no false success
    expect(screen.queryByTestId("publish-confirmation")).toBeNull();
    expect(calls.publish).toHaveLength(1);
  });

  it("a genuine assignment write failure is now distinctly surfaced (no longer hidden)", async () => {
    mockServers({
      audienceType: "leaders",
      publish: () => ({ status: 500, body: { error: "assignment_write_failed" } }),
    });
    renderShell();
    await waitFor(() => expect(screen.getByTestId("participation-mode-assigned")).toBeTruthy());
    fireEvent.click(screen.getByTestId("participation-mode-assigned"));
    await publishNow();
    const err = await screen.findByTestId("publish-error");
    expect(err.textContent).toMatch(/assignments couldn't be created/i);
    expect(screen.queryByTestId("publish-confirmation")).toBeNull();
  });

  it("an unknown reason still falls back to the generic message", async () => {
    mockServers({
      audienceType: "leaders",
      publish: () => ({ status: 409, body: { error: "publish_conflict" } }),
    });
    renderShell();
    await publishNow();
    const err = await screen.findByTestId("publish-error");
    expect(err.textContent).toBeTruthy();
  });
});
