/** @vitest-environment jsdom */
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Scenario } from "@/lib/bty/scenario/types";
import { ARENA_SESSION_MODE } from "@/lib/bty/arena/arenaRuntimeSnapshot.types";

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

function jsonRes(data: unknown, status = 200): Response {
  const body = JSON.stringify(data);
  return {
    ok: status >= 200 && status < 300,
    status,
    text: () => Promise.resolve(body),
    json: () => Promise.resolve(data),
  } as Response;
}

const RUN_ID = "run-ad1-503-1";

const scenario: Scenario = {
  scenarioId: "core_action_contract_boundary_test",
  dbScenarioId: "INCIDENT-01-OWN-01",
  title: "Boundary scenario",
  context: "Context",
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
  ],
  coachNotes: { whatThisTrains: [], whyItMatters: "" },
  eliteSetup: { role: "Lead", pressure: "Pressure", tradeoff: "Tradeoff" },
  escalationBranches: {
    A: {
      escalation_text: "Escalation",
      pressure_increase: 0.2,
      second_choices: [{ id: "X", label: "Tradeoff X", cost: "cost", direction: "entry" }],
      action_decision: {
        prompt: "Action?",
        choices: [
          {
            id: "AD1",
            label: "Commit",
            dbChoiceId: "db-ad1",
            meaning: { is_action_commitment: true },
          },
          {
            id: "AD2",
            label: "Avoid",
            dbChoiceId: "db-ad2",
            meaning: { is_action_commitment: false },
          },
        ],
      },
    },
  },
};

describe("BtyArenaRunPageClient — AD1 503 snapshot integration", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.stubEnv("NEXT_PUBLIC_ARENA_PIPELINE_DEFAULT", "new");
    localStorage.clear();
    mockGetScenarioById.mockReturnValue({
      base: {
        structure: {
          tradeoff: {
            A: [
              { choiceId: "X", dbChoiceId: "db-tradeoff-x-base" },
              { choiceId: "Y", dbChoiceId: "db-tradeoff-y-base" },
            ],
          },
          action_decision: {
            A_X: [
              { choiceId: "AD1", dbChoiceId: "db-ad1-base", is_action_commitment: true },
              { choiceId: "AD2", dbChoiceId: "db-ad2-base", is_action_commitment: false },
            ],
          },
          primary: [],
        },
      },
    });
    fetchMock.mockImplementation((input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
      const url = typeof input === "string" ? input : "url" in input ? input.url : String(input);
      const method = (init?.method ?? "GET").toUpperCase();

      if (url.includes("/api/arena/core-xp")) {
        return Promise.resolve(
          jsonRes({
            coreXpTotal: 3000,
            tier: 2,
            requiresBeginnerPath: false,
            codeName: "IX",
            subName: "Boundary",
          }),
        );
      }

      if (url.includes("/api/arena/n/session") || url.includes("/api/arena/session/next")) {
        return Promise.resolve(
          jsonRes({
            ok: true,
            mode: ARENA_SESSION_MODE,
            runtime_state: "ARENA_SCENARIO_READY",
            state_priority: 10,
            gates: { next_allowed: true, choice_allowed: true, qr_allowed: false },
            action_contract: {
              exists: false,
              id: null,
              status: null,
              verification_type: null,
              deadline_at: null,
            },
            scenario,
          }),
        );
      }

      if (url.includes("/api/arena/session/delayed-outcomes")) {
        return Promise.resolve(jsonRes({ ok: true, outcomes: [] }));
      }

      if (url.includes("/api/arena/run") && method === "POST") {
        return Promise.resolve(jsonRes({ run: { run_id: RUN_ID, started_at: new Date().toISOString() } }));
      }

      if (url.includes("/api/arena/event") && method === "POST") {
        return Promise.resolve(jsonRes({ ok: true }));
      }

      if (url.includes("/api/arena/run/step") && method === "POST") {
        return Promise.resolve(jsonRes({ ok: true }));
      }

      if (url.includes("/api/arena/choice") && method === "POST") {
        const body = JSON.parse(String(init?.body ?? "{}")) as { binding_phase?: string; json_choice_id?: string };
        if (body.binding_phase === "tradeoff" && body.json_choice_id === "X") {
          if (
            (body as { primary_choice_id?: string }).primary_choice_id !== "A" ||
            (body as { parent_choice_id?: string }).parent_choice_id !== "A"
          ) {
            return Promise.resolve(jsonRes({ error: "missing_primary_choice_id_for_tradeoff" }, 400));
          }
          if ((body as { db_choice_id?: string }).db_choice_id !== "db-tradeoff-x-base") {
            return Promise.resolve(jsonRes({ error: "second_choice_binding_mismatch" }, 400));
          }
          return Promise.resolve(
            jsonRes({
              mode: ARENA_SESSION_MODE,
              runtime_state: "ACTION_DECISION_ACTIVE",
              state_priority: 30,
              gates: { next_allowed: false, choice_allowed: true, qr_allowed: false },
              action_contract: {
                exists: false,
                id: null,
                status: null,
                verification_type: null,
                deadline_at: null,
              },
              re_exposure: { due: false, scenario_id: null },
            }),
          );
        }
        if (body.binding_phase === "action_decision" && body.json_choice_id === "AD1") {
          if (
            (body as { primary_choice_id?: string }).primary_choice_id !== "A" ||
            (body as { second_choice_id?: string }).second_choice_id !== "X"
          ) {
            return Promise.resolve(jsonRes({ error: "action_decision_requires_tradeoff_meta" }, 409));
          }
          if ((body as { db_choice_id?: string }).db_choice_id !== "db-ad1-base") {
            return Promise.resolve(jsonRes({ error: "action_decision_binding_mismatch" }, 400));
          }
          return Promise.resolve(
            jsonRes(
              {
                error: "elite_action_contract_ensure_failed",
                mode: ARENA_SESSION_MODE,
                runtime_state: "ACTION_REQUIRED",
                state_priority: 90,
                gates: { next_allowed: false, choice_allowed: false, qr_allowed: true },
                action_contract: {
                  exists: false,
                  id: null,
                  status: null,
                  verification_type: null,
                  deadline_at: null,
                },
              },
              503,
            ),
          );
        }
        return Promise.resolve(jsonRes({ ok: true }));
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

      return Promise.reject(new Error(`unhandled fetch in AD1 503 integration test: ${method} ${url}`));
    });
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("keeps ACTION_REQUIRED blocked shell from 503 error-body snapshot and does not show next-ready shell", async () => {
    await act(async () => {
      render(<BtyArenaRunPageClient />);
    });

    await waitFor(() => {
      expect(screen.getByTestId("arena-play-main")).toBeTruthy();
    });

    expect(screen.getByTestId("arena-flow-phase-instruction-primary").textContent).toContain(
      "First, choose how you respond under pressure.",
    );

    const primaryRegion = screen.getByTestId("elite-arena-primary-pick");
    await act(async () => {
      fireEvent.click(primaryRegion.querySelectorAll("button")[0]!);
    });

    await waitFor(() => {
      expect(screen.getByTestId("elite-forced-tradeoff-X")).toBeTruthy();
    });

    expect(screen.getByTestId("arena-flow-phase-instruction-tradeoff").textContent).toContain(
      "Now face the cost of that response. Neither option is free.",
    );

    await act(async () => {
      fireEvent.click(screen.getByTestId("elite-forced-tradeoff-X"));
    });

    await waitFor(() => {
      expect(screen.getByTestId("elite-action-decision-step")).toBeTruthy();
    });

    expect(screen.getByTestId("arena-flow-phase-instruction-action-decision").textContent).toContain(
      "Now choose the observable action. This is not interpretation.",
    );

    await act(async () => {
      fireEvent.click(screen.getByTestId("elite-action-decision-AD1"));
    });

    await waitFor(() => {
      expect(screen.getByTestId("arena-play-main-pending-contract")).toBeTruthy();
    });

    expect(screen.getByTestId("arena-observable-action-confirmation").textContent).toContain(
      "You chose an observable action. Progress now depends on completing it.",
    );

    const ad1ChoicePosts = fetchMock.mock.calls.filter(
      (c) =>
        typeof c[0] === "string" &&
        c[0].includes("/api/arena/choice") &&
        (c[1]?.method === "POST" || c[1]?.method === "post") &&
        JSON.parse(String(c[1]?.body ?? "{}")).json_choice_id === "AD1",
    );
    expect(ad1ChoicePosts.length).toBe(1);
    const tradeoffChoicePosts = fetchMock.mock.calls.filter(
      (c) =>
        typeof c[0] === "string" &&
        c[0].includes("/api/arena/choice") &&
        (c[1]?.method === "POST" || c[1]?.method === "post") &&
        JSON.parse(String(c[1]?.body ?? "{}")).binding_phase === "tradeoff",
    );
    expect(tradeoffChoicePosts.length).toBe(1);
    const tradeoffBody = JSON.parse(String(tradeoffChoicePosts[0]?.[1]?.body ?? "{}")) as { db_choice_id?: string };
    expect(tradeoffBody.db_choice_id).toBe("db-tradeoff-x-base");
    const runStepPosts = fetchMock.mock.calls.filter(
      (c) =>
        typeof c[0] === "string" &&
        c[0].includes("/api/arena/run/step") &&
        (c[1]?.method === "POST" || c[1]?.method === "post"),
    );
    expect(runStepPosts.length).toBe(0);
    expect(screen.queryByTestId("arena-play-snapshot-next-scenario-ready")).toBeNull();
    expect(screen.queryByTestId("arena-play-snapshot-next-scenario-blocked")).toBeNull();
  });
});
