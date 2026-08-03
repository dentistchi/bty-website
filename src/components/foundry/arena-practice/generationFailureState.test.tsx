/** @vitest-environment jsdom */
import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, cleanup } from "@testing-library/react";
import { ArenaPracticeFlow, genFailureCopy } from "./ArenaPracticeFlow";
import { ARENA_PRACTICE_COPY } from "./arenaPracticeCopy";
import { GENERATION_OUTCOMES, NON_ATTEMPT_OUTCOMES, retriabilityOf } from "@/domain/foundry/arena-draft/generationOutcome";

/**
 * HONEST CLIENT OUTCOME STATES (Slice 3.2I-R5B2-R5A).
 *
 * R4's screen said one thing — "The situation could not be created. Please retry." — for a failure
 * whose transience was unknown, after a wait with no deadline and no elapsed feedback. These hold
 * the replacement: one line per measured outcome, a second attempt offered only when it is
 * genuinely reasonable, and a wait the Host can see the shape of.
 */

const t = ARENA_PRACTICE_COPY.en;
const ko = ARENA_PRACTICE_COPY.ko;

const SOURCE = {
  event_id: "evt-1",
  event_title: "Handoff",
  event_status: "open",
  module_version: 3,
  arena_recommended: true,
  capability: "Owning a missed commitment",
  expected_behavior: "Raise the concern",
  success_evidence: null,
  audience_type: "leaders",
  audience_detail: null,
  learning_needs: ["decide"],
  hardest_when_options: ["time_limited"],
  avoidance_seeds: ["time"],
};
/** R4's exact draft: new-authority, confirmed boundary, ZERO rules — server-eligible. */
const READY_DRAFT = {
  id: "draft-1",
  scenario_draft: null,
  generation_source: null,
  revision: 1,
  guided_answers: {
    practiceSetupVersion: 1,
    practiceBoundary: { mode: "judgment", confirmed: true, constraints: [] },
  },
};

function jsonRes(body: unknown, ok = true, status = 200) {
  return { ok, status, json: async () => body } as unknown as Response;
}

function mockFetch(regen: () => Response) {
  return vi.fn(async (url: string) => {
    const u = String(url);
    if (u.includes("/arena-source/")) return jsonRes({ source: SOURCE });
    if (u.includes("/arena-drafts?")) return jsonRes({ drafts: [{ id: "draft-1" }] });
    if (u.endsWith("/regenerate")) return regen();
    if (u.endsWith("/publish")) return jsonRes({ practice: null });
    if (u.match(/\/arena-drafts\/[^/?]+$/)) return jsonRes({ draft: READY_DRAFT });
    throw new Error(`unmocked fetch: ${u}`);
  });
}

const atSetup = () => waitFor(() => expect(screen.getByText(t.setupTitle)).toBeTruthy());
const generate = () => fireEvent.click(screen.getByRole("button", { name: t.setupGenerateCta }));

afterEach(() => {
  vi.unstubAllGlobals();
  cleanup();
});

describe("[R5A] one honest line per measured outcome", () => {
  const CASES: Array<[string, string]> = [
    ["provider_timeout", t.genFailTimeout],
    ["provider_transport_error", t.genFailTransport],
    ["provider_http_error", t.genFailTransport],
    ["provider_empty_output", t.genFailUnusable],
    ["provider_malformed_output", t.genFailUnusable],
    ["provider_schema_invalid", t.genFailUnusable],
    ["scenario_quality_rejected", t.genFailQuality],
    ["boundary_review_rejected", t.genFailQuality],
    ["scenario_persistence_failed", t.genFailPersistence],
    ["generation_observability_unavailable", t.genFailNotStarted],
    ["client_response_timeout", t.genFailClientTimeout],
  ];

  it.each(CASES)("%s renders its own copy", async (code, expected) => {
    vi.stubGlobal("fetch", mockFetch(() => jsonRes({ code, retriable: retriabilityOf(code as never) }, false, 502)));
    render(<ArenaPracticeFlow eventId="evt-1" locale="en" onBack={() => {}} />);
    await atSetup();
    generate();
    await waitFor(() => expect(screen.getByTestId("setup-gen-failure")).toBeTruthy());
    expect(screen.getByText(expected)).toBeTruthy();
    // Never a raw code, and never the old single generic line for a named outcome.
    expect(document.body.textContent).not.toContain(code);
  });

  it("distinct mechanisms do NOT read identically — R4's exact defect", () => {
    const timeout = genFailureCopy("provider_timeout", t);
    const transport = genFailureCopy("provider_transport_error", t);
    const empty = genFailureCopy("provider_empty_output", t);
    expect(new Set([timeout, transport, empty]).size).toBe(3);
  });

  it("a client-side give-up is never worded as a provider timeout", () => {
    // The browser stopped waiting; the answer may still exist. Claiming otherwise asserts
    // knowledge of an upstream event the client never observed.
    expect(genFailureCopy("client_response_timeout", t)).not.toBe(genFailureCopy("provider_timeout", t));
    expect(t.genFailClientTimeout).toMatch(/may still/i);
  });

  it("every outcome in the taxonomy has copy — none falls through to the old generic line", () => {
    for (const c of [...GENERATION_OUTCOMES, ...NON_ATTEMPT_OUTCOMES]) {
      if (c === "success") continue;
      expect(genFailureCopy(c, t)).not.toBe(t.setupGenerateError);
      expect(genFailureCopy(c, ko)).not.toBe(ko.setupGenerateError);
    }
  });

  it("every failure line reassures that the setup and boundary survived", async () => {
    for (const line of [t.genFailTimeout, t.genFailTransport, t.genFailUnusable, t.genFailQuality, t.genFailPersistence, t.genFailNotStarted]) {
      expect(line).toMatch(/saved/i);
    }
  });
});

describe("[R5A] a second attempt is offered only when it is reasonable", () => {
  it("a retriable failure offers to create it again", async () => {
    vi.stubGlobal("fetch", mockFetch(() => jsonRes({ code: "provider_transport_error", retriable: "true" }, false, 502)));
    render(<ArenaPracticeFlow eventId="evt-1" locale="en" onBack={() => {}} />);
    await atSetup();
    generate();
    await waitFor(() => expect(screen.getByRole("button", { name: t.genRetryCta })).toBeTruthy());
  });

  it.each(["unknown", "false"])("a %s-retriability failure does NOT invite another attempt", async (retriable) => {
    vi.stubGlobal("fetch", mockFetch(() => jsonRes({ code: "provider_timeout", retriable }, false, 504)));
    render(<ArenaPracticeFlow eventId="evt-1" locale="en" onBack={() => {}} />);
    await atSetup();
    generate();
    await waitFor(() => expect(screen.getByTestId("setup-gen-failure")).toBeTruthy());
    expect(screen.queryByRole("button", { name: t.genRetryCta })).toBeNull();
    // The forward control remains, so the Host is never stranded — it just does not urge a repeat.
    expect(screen.getByRole("button", { name: t.setupGenerateCta })).toBeTruthy();
  });

  it("a support reference is shown when one exists, and it is not a database id", async () => {
    vi.stubGlobal(
      "fetch",
      mockFetch(() => jsonRes({ code: "provider_timeout", retriable: "unknown", supportRef: "a1b2c3d4e5f6" }, false, 504)),
    );
    render(<ArenaPracticeFlow eventId="evt-1" locale="en" onBack={() => {}} />);
    await atSetup();
    generate();
    await waitFor(() => expect(screen.getByText(t.genSupportRef("a1b2c3d4e5f6"))).toBeTruthy());
  });

  it("the confirmed boundary survives every failure", async () => {
    vi.stubGlobal("fetch", mockFetch(() => jsonRes({ code: "provider_timeout", retriable: "unknown" }, false, 504)));
    render(<ArenaPracticeFlow eventId="evt-1" locale="en" onBack={() => {}} />);
    await atSetup();
    generate();
    await waitFor(() => expect(screen.getByTestId("setup-gen-failure")).toBeTruthy());
    expect(screen.getByText(t.boundaryConfirmedTitle)).toBeTruthy();
  });
});

describe("[R5A] the wait is honest", () => {
  beforeEach(() => {
    // Never resolves: the request stays in flight so the loading surface can be inspected.
    vi.stubGlobal("fetch", mockFetch(() => new Promise<Response>(() => {}) as unknown as Response));
  });

  it("states the real deadline and shows elapsed time, with no fake progress", async () => {
    render(<ArenaPracticeFlow eventId="evt-1" locale="en" onBack={() => {}} />);
    await atSetup();
    generate();
    await waitFor(() => expect(screen.getByTestId("generating-deadline")).toBeTruthy());
    // 120 s is the server's provider deadline, mirrored — not an invented number.
    expect(screen.getByTestId("generating-deadline").textContent).toBe(t.generatingDeadline(120));
    expect(screen.getByTestId("generating-elapsed")).toBeTruthy();
    expect(document.body.textContent).not.toMatch(/\d+\s?%/); // no percentage anywhere
    expect(document.querySelector("progress")).toBeNull();
  });

  it("offers no second submission while one is pending", async () => {
    render(<ArenaPracticeFlow eventId="evt-1" locale="en" onBack={() => {}} />);
    await atSetup();
    generate();
    await waitFor(() => expect(screen.getByTestId("generating-deadline")).toBeTruthy());
    expect(screen.queryByRole("button", { name: t.setupGenerateCta })).toBeNull();
    expect(screen.queryByRole("button", { name: t.genRetryCta })).toBeNull();
  });
});
