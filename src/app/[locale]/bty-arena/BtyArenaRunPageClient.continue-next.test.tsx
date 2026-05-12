/** @vitest-environment jsdom */
/**
 * Task 1 regression — continueNextScenario must clear bindingRuntimeSnapshot so the new scenario renders.
 *
 * Flow: init (elite scenario) → primary choice → TRADEOFF_ACTIVE → second choice
 *       → NEXT_SCENARIO_READY → Continue click → new session → new scenario title visible.
 *
 * Without the fix (setBindingRuntimeSnapshot(null) missing) the binding snapshot stays
 * NEXT_SCENARIO_READY after the GET session returns, so the Continue screen never exits.
 */
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ARENA_SESSION_MODE } from "@/lib/bty/arena/arenaRuntimeSnapshot.types";
import type { Scenario } from "@/lib/bty/scenario/types";

const mockGetScenarioById = vi.fn();

vi.mock("next/navigation", () => ({
  useParams: () => ({ locale: "en" }),
  usePathname: () => "/en/bty-arena",
  useRouter: () => ({ replace: vi.fn(), push: vi.fn(), prefetch: vi.fn() }),
}));

vi.mock("@/data/scenario", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/data/scenario")>();
  return {
    ...actual,
    getScenarioById: (...args: unknown[]) => mockGetScenarioById(...args),
  };
});

vi.mock("next/link", () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

import BtyArenaRunPageClient from "./BtyArenaRunPageClient";

const RUN_ID = "run-continue-next-1";
const INITIAL_SCENARIO_ID = "core_01_training_system_exposure";
const NEXT_SCENARIO_TITLE = "This Can't Stay Internal";

function jsonRes(data: unknown, status = 200): Response {
  const body = JSON.stringify(data);
  return {
    ok: status >= 200 && status < 300,
    status,
    text: () => Promise.resolve(body),
    json: () => Promise.resolve(data),
  } as Response;
}

const mockCurrentScenario: Scenario = {
  scenarioId: INITIAL_SCENARIO_ID,
  dbScenarioId: "INCIDENT-01-INTEGRITY-01",
  title: "Initial Scenario",
  context: "Context text",
  choices: [
    {
      choiceId: "A",
      dbChoiceId: "CHOICE-A-01",
      label: "Choice A",
      intent: "intent",
      xpBase: 10,
      difficulty: 0.5,
      hiddenDelta: { integrity: 1 },
      result: "Result A",
      microInsight: "Insight A",
    },
  ],
  coachNotes: { whatThisTrains: [], whyItMatters: "" },
  eliteSetup: { role: "Manager", pressure: "High", tradeoff: "Integrity vs. speed" },
  escalationBranches: {
    A: {
      escalation_text: "Escalation text",
      pressure_increase: 0.5,
      second_choices: [
        {
          id: "sec1",
          label: "Second choice",
          cost: "Cost",
          direction: "exit",
          pattern_family: "integrity_slip",
        },
      ],
    },
  },
};

const mockNextScenario: Scenario = {
  scenarioId: "core_15_system_exposure",
  dbScenarioId: "INCIDENT-02-INTEGRITY-15",
  title: NEXT_SCENARIO_TITLE,
  context: "Next scenario context",
  choices: [
    {
      choiceId: "A",
      label: "Next Choice A",
      intent: "intent",
      xpBase: 10,
      difficulty: 0.5,
      hiddenDelta: {},
      result: "Result A",
      microInsight: "Insight A",
    },
  ],
  coachNotes: { whatThisTrains: [], whyItMatters: "" },
  eliteSetup: { role: "Director", pressure: "Critical", tradeoff: "Transparency vs. calm" },
};

function makeSnap(runtimeState: string, extra: Record<string, unknown> = {}) {
  return {
    mode: ARENA_SESSION_MODE,
    runtime_state: runtimeState,
    state_priority: 10,
    gates: {
      next_allowed: runtimeState === "NEXT_SCENARIO_READY" || runtimeState === "ARENA_SCENARIO_READY",
      choice_allowed: runtimeState === "ARENA_SCENARIO_READY" || runtimeState === "TRADEOFF_ACTIVE",
      qr_allowed: false,
    },
    action_contract: { exists: false, id: null, status: null, verification_type: null, deadline_at: null },
    ...extra,
  };
}

describe("BtyArenaRunPageClient — continueNextScenario clears bindingRuntimeSnapshot", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.stubEnv("NEXT_PUBLIC_ARENA_PIPELINE_DEFAULT", "new");
    localStorage.clear();

    mockGetScenarioById.mockReturnValue({
      base: {
        structure: {
          tradeoff: {
            A: [{ choiceId: "sec1", dbChoiceId: "db-sec1-choice" }],
          },
          primary: [],
        },
      },
    });

    // Flip to true after POST run/complete — only then does session return the next scenario.
    let runCompleted = false;

    fetchMock.mockImplementation((input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
      const url = typeof input === "string" ? input : "url" in input ? input.url : String(input);
      const method = (init?.method ?? "GET").toUpperCase();

      // run/complete must be matched before generic run/* to avoid URL prefix overlap
      if (url.includes("/api/arena/run/complete") && method === "POST") {
        runCompleted = true;
        return Promise.resolve(jsonRes({ ok: true, ...makeSnap("NEXT_SCENARIO_READY") }));
      }

      // Session: return current scenario until run/complete fires, then return next scenario
      if ((url.includes("/api/arena/n/session") || url.includes("/api/arena/session/next")) && method === "GET") {
        return Promise.resolve(
          jsonRes({
            ok: true,
            ...makeSnap("ARENA_SCENARIO_READY"),
            scenario: runCompleted ? mockNextScenario : mockCurrentScenario,
          }),
        );
      }

      if (url.includes("/api/arena/core-xp")) {
        return Promise.resolve(
          jsonRes({ coreXpTotal: 100, tier: 1, requiresBeginnerPath: false, codeName: "T", subName: "Test" }),
        );
      }

      // POST /api/arena/run → create run (must come after run/complete check)
      if (url.includes("/api/arena/run") && !url.includes("/api/arena/run/") && method === "POST") {
        return Promise.resolve(
          jsonRes({ run: { run_id: RUN_ID, started_at: new Date().toISOString() } }),
        );
      }

      if (url.includes("/api/arena/event")) {
        return Promise.resolve(jsonRes({ ok: true }));
      }

      // POST /api/arena/choice (primary binding) → TRADEOFF_ACTIVE; tradeoff binding → NEXT_SCENARIO_READY
      if (url.includes("/api/arena/choice") && method === "POST") {
        let body: Record<string, unknown> = {};
        try { body = JSON.parse(String(init?.body ?? "{}")); } catch { /* */ }
        const phase = body.binding_phase;
        if (!phase || phase === "primary") {
          return Promise.resolve(
            jsonRes({ ok: true, ...makeSnap("TRADEOFF_ACTIVE") }),
          );
        }
        return Promise.resolve(
          jsonRes({ ok: true, ...makeSnap("NEXT_SCENARIO_READY") }),
        );
      }

      if (url.includes("/api/arena/lab/usage")) {
        return Promise.resolve(jsonRes({ ok: true, used: 0, limit: 10 }));
      }

      if (url.includes("/api/arena/leaderboard")) {
        return Promise.resolve(jsonRes({ ok: true, rows: [] }));
      }

      if (url.includes("/api/arena/runs")) {
        return Promise.resolve(jsonRes({ ok: true, runs: [{ run_id: RUN_ID, status: "IN_PROGRESS", started_at: new Date().toISOString(), scenario_id: INITIAL_SCENARIO_ID }] }));
      }

      if (url.includes("/api/arena/run/") && method === "GET") {
        return Promise.resolve(
          jsonRes({ run: { run_id: RUN_ID, scenario_id: INITIAL_SCENARIO_ID, status: "IN_PROGRESS" } }),
        );
      }

      return Promise.resolve(jsonRes({ ok: true }));
    });
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("shows new scenario title after Continue click (bindingRuntimeSnapshot cleared)", async () => {
    await act(async () => {
      render(<BtyArenaRunPageClient />);
    });

    // Wait for initial scenario to load (play area or choice screen)
    await waitFor(() => {
      expect(
        screen.getByTestId("elite-arena-primary-pick") ||
          screen.getByTestId("arena-play-main"),
      ).toBeTruthy();
    }, { timeout: 3000 });

    // Submit primary choice → TRADEOFF_ACTIVE binding
    const primaryRegion = screen.getByTestId("elite-arena-primary-pick");
    await act(async () => {
      fireEvent.click(primaryRegion.querySelectorAll("button")[0]!);
    });

    // Wait for tradeoff to appear
    await waitFor(() => {
      expect(screen.getByTestId("elite-forced-tradeoff-sec1")).toBeTruthy();
    }, { timeout: 3000 });

    // Submit second choice → NEXT_SCENARIO_READY binding
    await act(async () => {
      fireEvent.click(screen.getByTestId("elite-forced-tradeoff-sec1"));
    });

    // Continue button should appear
    await waitFor(() => {
      expect(screen.getByTestId("arena-next-scenario-continue")).toBeTruthy();
    }, { timeout: 3000 });

    // Click Continue — triggers continueNextScenario()
    await act(async () => {
      fireEvent.click(screen.getByTestId("arena-next-scenario-continue"));
    });

    // NEW scenario title must appear — verifies bindingRuntimeSnapshot is cleared
    await waitFor(() => {
      expect(screen.getByText(NEXT_SCENARIO_TITLE)).toBeTruthy();
    }, { timeout: 3000 });

    // The Continue screen must no longer be shown
    expect(screen.queryByTestId("arena-play-snapshot-next-scenario-ready")).toBeNull();
  });
});
