/** @vitest-environment jsdom */
import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, cleanup } from "@testing-library/react";
import PracticeLanding from "./PracticeLanding";
import type { ArenaScenarioDraft } from "@/domain/foundry/arena-draft/types";

/**
 * HOST CTA SCOPING (Slice 3.2I-R5B2-R2).
 *
 * Founder device evidence on 698c7d6e: Practice → Practice situations → "Practice again" opened
 * the learner runtime with "Create practice" still sitting above it. R1 mounted the entry as a
 * blind sibling of ArenaRoom, which keeps its own view state private.
 *
 * This walks the exact reported path with the REAL ArenaRoom and the REAL player, mocking only the
 * fetch boundary, and holds the control to the surfaces it belongs on.
 */

function validScenario(): ArenaScenarioDraft {
  return {
    title: "T",
    opening: "An opening situation.",
    primary: { choices: [{ id: "p1", label: "A" }, { id: "p2", label: "B" }] },
    tradeoff: { escalationText: "It gets harder.", choices: [{ id: "t1", label: "C" }, { id: "t2", label: "D" }] },
    actionDecision: {
      prompt: "Decide?",
      choices: [
        { id: "a1", label: "Act", isActionCommitment: true },
        { id: "a2", label: "Wait", isActionCommitment: false },
      ],
    },
  };
}

const COMPLETED = [
  { id: "prac-1", practice_title: "A finished situation", source_training_title: "Handoff", completed: true },
];

function jsonRes(body: unknown, ok = true, status = 200) {
  return { ok, status, json: async () => body } as unknown as Response;
}

function mockFetch(over: { events?: () => Response; list?: () => Response } = {}) {
  return vi.fn(async (url: string, init?: RequestInit) => {
    const u = String(url);
    if (u.includes("/api/bty/foundry/events")) return over.events ? over.events() : jsonRes({ events: [{ id: "evt-1", title: "Handoff" }] });
    if (u === "/api/arena/practice") return over.list ? over.list() : jsonRes({ practices: COMPLETED });
    if (u.startsWith("/api/arena/practice/") && (init?.method ?? "GET") === "GET") {
      return jsonRes({
        practice: {
          id: "prac-1",
          practice_title: "A finished situation",
          source_training_title: "Handoff",
          source_module_version: 1,
          scenario: validScenario(),
        },
      });
    }
    // start / complete
    if (u.startsWith("/api/arena/practice/")) return jsonRes({ run_id: "run-1", runId: "run-1" });
    throw new Error(`unmocked fetch: ${u}`);
  });
}

const base = { locale: "en", lockedTag: "tag", lockedBody: "body" };
const openSituations = () => fireEvent.click(screen.getByTestId("practice-arena-entry"));
const cta = () => screen.queryByTestId("practice-create-cta");

beforeEach(() => vi.stubGlobal("fetch", mockFetch()));
afterEach(() => {
  vi.unstubAllGlobals();
  cleanup();
});

describe("[R2] the Host CTA lives on the situations index only", () => {
  it("it is present on the populated index, next to the completed history", async () => {
    render(<PracticeLanding {...base} />);
    openSituations();
    await waitFor(() => expect(cta()).toBeTruthy());
    expect(screen.getByText("A finished situation")).toBeTruthy();
    expect(screen.getByText("Practice again")).toBeTruthy();
  });

  it("it is present on an EMPTY index", async () => {
    vi.stubGlobal("fetch", mockFetch({ list: () => jsonRes({ practices: [] }) }));
    render(<PracticeLanding {...base} />);
    openSituations();
    await waitFor(() => expect(cta()).toBeTruthy());
    expect(screen.getByText("body")).toBeTruthy(); // the calm empty state, unchanged
  });

  it("it survives a failed list — authoring does not depend on the list loading", async () => {
    vi.stubGlobal("fetch", mockFetch({ list: () => jsonRes({}, false, 500) }));
    render(<PracticeLanding {...base} />);
    openSituations();
    await waitFor(() => expect(screen.getByText("We couldn't load your Practices.")).toBeTruthy());
    expect(cta()).toBeTruthy();
  });

  it("PRACTICE AGAIN removes it — the reported defect", async () => {
    render(<PracticeLanding {...base} />);
    openSituations();
    await waitFor(() => expect(cta()).toBeTruthy());
    fireEvent.click(screen.getByText("Practice again"));
    // The learner runtime takes the screen…
    await waitFor(() => expect(screen.getByText("An opening situation.")).toBeTruthy());
    // …and the Host control is GONE, not merely styled away.
    expect(cta()).toBeNull();
    expect(screen.queryByTestId("practice-authoring-entry")).toBeNull();
  });

  it("STARTING already hides it, and returning to the list brings it back", async () => {
    // A snapshot failure holds ArenaRoom in `starting` with a "Back to list" way out — a reachable
    // runtime state, and the shortest honest route through the same return-to-index logic that
    // finishing a practice takes.
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        const u = String(url);
        if (u.includes("/api/bty/foundry/events")) return jsonRes({ events: [{ id: "evt-1", title: "Handoff" }] });
        if (u === "/api/arena/practice") return jsonRes({ practices: COMPLETED });
        if (u.startsWith("/api/arena/practice/")) return jsonRes({}, false, 500);
        throw new Error(`unmocked fetch: ${u}`);
      }),
    );
    render(<PracticeLanding {...base} />);
    openSituations();
    await waitFor(() => expect(cta()).toBeTruthy());
    fireEvent.click(screen.getByText("Practice again"));
    await waitFor(() => expect(screen.getByText("We couldn't start this practice.")).toBeTruthy());
    expect(cta()).toBeNull(); // runtime_starting is execution, not the index

    // Back to list reloads the list. Loading is still the INDEX, so the control returns and does
    // not blink out on the way.
    fireEvent.click(screen.getByText("Back to list"));
    await waitFor(() => expect(cta()).toBeTruthy());
  });

  it("entering authoring removes the list-level CTA too", async () => {
    render(<PracticeLanding {...base} />);
    openSituations();
    await waitFor(() => expect(cta()).toBeTruthy());
    fireEvent.click(screen.getByTestId("practice-create-cta"));
    await waitFor(() => expect(screen.getByTestId("practice-authoring")).toBeTruthy());
    expect(cta()).toBeNull();
    expect(screen.queryByTestId("practice-authoring-entry")).toBeNull();
  });

  it("a learner never sees it on any surface, runtime included", async () => {
    vi.stubGlobal("fetch", mockFetch({ events: () => jsonRes({ error: "foundry_host_required" }, false, 403) }));
    render(<PracticeLanding {...base} />);
    openSituations();
    await waitFor(() => expect(screen.getByText("A finished situation")).toBeTruthy());
    expect(cta()).toBeNull();
    fireEvent.click(screen.getByText("Practice again"));
    await waitFor(() => expect(screen.getByText("An opening situation.")).toBeTruthy());
    expect(cta()).toBeNull();
  });

  it("the CTA never flashes before the surface and role are both resolved", async () => {
    // A never-resolving events call: role is unknown, so nothing Host-shaped may appear.
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        const u = String(url);
        if (u.includes("/api/bty/foundry/events")) return new Promise<Response>(() => {});
        if (u === "/api/arena/practice") return jsonRes({ practices: COMPLETED });
        throw new Error(`unmocked fetch: ${u}`);
      }),
    );
    render(<PracticeLanding {...base} />);
    openSituations();
    await waitFor(() => expect(screen.getByText("A finished situation")).toBeTruthy());
    expect(cta()).toBeNull();
  });
});
