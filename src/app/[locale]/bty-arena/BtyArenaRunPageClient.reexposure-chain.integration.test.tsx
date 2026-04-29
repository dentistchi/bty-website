/** @vitest-environment jsdom */
/**
 * C5 — Executes the real client path: REEXPOSURE_DUE → beginReexposurePlay → elite play → submitSecondChoice → POST validate.
 * fetch is sequenced (not mocking useArenaSession / beginReexposurePlay / submitSecondChoice).
 */
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Scenario } from "@/lib/bty/scenario/types";
import { ARENA_SESSION_MODE } from "@/lib/bty/arena/arenaRuntimeSnapshot.types";

vi.mock("next/navigation", () => ({
  useParams: () => ({ locale: "en" }),
  usePathname: () => "/en/bty-arena",
  useRouter: () => ({ replace: vi.fn(), push: vi.fn(), prefetch: vi.fn() }),
}));

vi.mock("next/link", () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

import BtyArenaRunPageClient from "./BtyArenaRunPageClient";

const REX_SCENARIO_ID = "reexposure_ix_non_chain";
const PENDING_OUTCOME_ID = "pend-c5-chain-1";
const RUN_ID = "run-c5-rex-1";

type ValidateResponseShape = {
  ok: true;
  validation_result: "changed" | "unstable" | "no_change";
  next_runtime_state?: "NEXT_SCENARIO_READY" | "REEXPOSURE_DUE";
  re_exposure_clear_candidate?: boolean;
  intervention_sensitivity_up?: boolean;
  validation_payload?: Record<string, unknown>;
};

function jsonRes(data: unknown, status = 200): Response {
  const body = JSON.stringify(data);
  return {
    ok: status >= 200 && status < 300,
    status,
    text: () => Promise.resolve(body),
    json: () => Promise.resolve(data),
  } as Response;
}

const sessionReexposureBody = {
  ok: true,
  mode: ARENA_SESSION_MODE,
  runtime_state: "REEXPOSURE_DUE" as const,
  state_priority: 55,
  gates: { next_allowed: false, choice_allowed: false, qr_allowed: false },
  action_contract: {
    exists: false,
    id: null,
    status: null,
    verification_type: null,
    deadline_at: null,
  },
  scenario: null,
  re_exposure: {
    due: true,
    scenario_id: REX_SCENARIO_ID,
    pending_outcome_id: PENDING_OUTCOME_ID,
    incident_id: "INCIDENT-C5-CHAIN-1",
    axis_group: "OWN",
    axis_index: 1,
    pattern_family: "deflection",
  },
};

const mockEliteScenario: Scenario = {
  scenarioId: REX_SCENARIO_ID,
  title: "Re-exposure chain IX",
  context: "Integration context",
  choices: [
    {
      choiceId: "A",
      label: "Primary A",
      intent: "intent",
      xpBase: 10,
      difficulty: 0.5,
      hiddenDelta: { integrity: 1 },
      result: "r",
      microInsight: "m",
    },
    {
      choiceId: "B",
      label: "Primary B",
      intent: "intent",
      xpBase: 10,
      difficulty: 0.5,
      hiddenDelta: {},
      result: "r",
      microInsight: "m",
    },
    {
      choiceId: "C",
      label: "Primary C",
      intent: "intent",
      xpBase: 10,
      difficulty: 0.5,
      hiddenDelta: {},
      result: "r",
      microInsight: "m",
    },
  ],
  coachNotes: { whatThisTrains: [], whyItMatters: "" },
  eliteSetup: { role: "r", pressure: "p", tradeoff: "t" },
  escalationBranches: {
    A: {
      escalation_text: "esc",
      pressure_increase: 0.5,
      second_choices: [
        {
          id: "s1",
          label: "Second pick",
          cost: "cost",
          direction: "exit",
          pattern_family: "blame_shift",
        },
      ],
    },
  },
};

describe("BtyArenaRunPageClient — re-exposure → validate client chain", () => {
  const fetchMock = vi.fn();
  let validateResponse: ValidateResponseShape;

  beforeEach(() => {
    validateResponse = {
      ok: true,
      validation_result: "changed",
      next_runtime_state: "NEXT_SCENARIO_READY",
      re_exposure_clear_candidate: true,
      intervention_sensitivity_up: false,
      validation_payload: { validation_result: "changed" },
    };
    vi.stubEnv("NEXT_PUBLIC_ARENA_PIPELINE_DEFAULT", "new");
    localStorage.clear();
    fetchMock.mockImplementation((input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
      const url = typeof input === "string" ? input : "url" in input ? input.url : String(input);
      const method = (init?.method ?? "GET").toUpperCase();

      if (url.includes("/api/arena/core-xp")) {
        return Promise.resolve(
          jsonRes({
            coreXpTotal: 5000,
            tier: 3,
            requiresBeginnerPath: false,
            codeName: "IX",
            subName: "Test",
          }),
        );
      }

      if (url.includes("/api/arena/n/session") || url.includes("/api/arena/session/next")) {
        return Promise.resolve(jsonRes(sessionReexposureBody));
      }

      if (url.includes("/api/arena/session/delayed-outcomes")) {
        return Promise.resolve(jsonRes({ ok: true, outcomes: [] }));
      }

      if (url.includes(`/api/arena/re-exposure/${encodeURIComponent(REX_SCENARIO_ID)}`)) {
        return Promise.resolve(jsonRes({ ok: true, scenario: mockEliteScenario }));
      }

      if (url.includes("/api/arena/run") && method === "POST") {
        return Promise.resolve(
          jsonRes({
            run: { run_id: RUN_ID, started_at: new Date().toISOString() },
          }),
        );
      }

      if (url.includes("/api/arena/event") && method === "POST") {
        return Promise.resolve(jsonRes({ ok: true }));
      }

      if (url.includes("/api/arena/run/step") && method === "POST") {
        return Promise.resolve(jsonRes({ ok: true, step: (JSON.parse(String(init?.body ?? "{}")) as { step?: number }).step }));
      }

      if (url.includes("/api/arena/re-exposure/validate") && method === "POST") {
        return Promise.resolve(jsonRes(validateResponse));
      }

      if (url.includes("/api/arena/lab/usage")) {
        return Promise.resolve(jsonRes({ ok: true, used: 0, limit: 10 }));
      }

      if (url.includes("/api/arena/leaderboard")) {
        return Promise.resolve(jsonRes({ ok: true, rows: [] }));
      }

      if (url.includes("/api/arena/runs")) {
        return Promise.resolve(jsonRes({ ok: true, runs: [] }));
      }

      return Promise.reject(new Error(`unhandled fetch in re-exposure chain test: ${method} ${url}`));
    });
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("runs beginReexposurePlay → play → second choice → POST /api/arena/re-exposure/validate once", async () => {
    await act(async () => {
      render(<BtyArenaRunPageClient />);
    });

    await waitFor(() => {
      expect(screen.getByTestId("arena-play-snapshot-reexposure")).toBeTruthy();
    });

    const catalogBootstrapCalls = fetchMock.mock.calls.filter(
      (c) =>
        typeof c[0] === "string" &&
        c[0].includes("/api/arena/n/session") &&
        c[0].includes("core_01"),
    );
    expect(catalogBootstrapCalls.length).toBe(0);

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /Enter scenario/i }));
    });

    await waitFor(() => {
      expect(screen.getByTestId("arena-play-main")).toBeTruthy();
    });

    expect(
      fetchMock.mock.calls.some(
        (c) => typeof c[0] === "string" && c[0].includes(`/api/arena/re-exposure/${REX_SCENARIO_ID}`),
      ),
    ).toBe(true);

    expect(
      fetchMock.mock.calls.some(
        (c) =>
          typeof c[0] === "string" &&
          c[0].includes("/api/arena/run") &&
          (c[1]?.method === "POST" || c[1]?.method === "post"),
      ),
    ).toBe(true);

    const primaryRegion = screen.getByTestId("elite-arena-primary-pick");
    await act(async () => {
      fireEvent.click(primaryRegion.querySelectorAll("button")[0]!);
    });

    await waitFor(() => {
      expect(screen.getByTestId("elite-forced-tradeoff-s1")).toBeTruthy();
    });

    await act(async () => {
      fireEvent.click(screen.getByTestId("elite-forced-tradeoff-s1"));
    });

    await waitFor(() => {
      const validatePosts = fetchMock.mock.calls.filter(
        (c) =>
          typeof c[0] === "string" &&
          c[0].includes("/api/arena/re-exposure/validate") &&
          (c[1]?.method === "POST" || c[1]?.method === "post"),
      );
      expect(validatePosts.length).toBe(1);
    });

    const validatePosts = fetchMock.mock.calls.filter(
      (c) =>
        typeof c[0] === "string" &&
        c[0].includes("/api/arena/re-exposure/validate") &&
        (c[1]?.method === "POST" || c[1]?.method === "post"),
    );
    const body = JSON.parse(String(validatePosts[0]![1]?.body ?? "{}")) as {
      pendingOutcomeId?: string;
      runId?: string;
      scenarioId?: string;
    };
    expect(body.pendingOutcomeId).toBe(PENDING_OUTCOME_ID);
    expect(body.runId).toBe(RUN_ID);
    expect(body.scenarioId).toBe(REX_SCENARIO_ID);
    expect(screen.queryByTestId("arena-play-snapshot-reexposure")).toBeNull();
  });

});
