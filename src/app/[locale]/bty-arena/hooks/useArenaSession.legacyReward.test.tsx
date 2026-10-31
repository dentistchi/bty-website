/** @vitest-environment jsdom */
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Scenario } from "@/lib/bty/scenario/types";
import { BTY_ARENA_STATE_STORAGE_KEY } from "@/lib/bty/arena/arenaLocalState";

const navigation = vi.hoisted(() => ({ locale: "en" }));
vi.mock("next/navigation", () => ({
  useParams: () => ({ locale: navigation.locale }),
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
}));

import { useArenaSession } from "./useArenaSession";

const receiptId = "27e9d375-a6d1-45e1-9b97-f7d3e75a576f";
const acknowledged = { ok: true, reExposureDueCandidate: false, xp: 37, receiptId, idempotent: false };
const scenario: Scenario = {
  scenarioId: "legacy-reward-client-test",
  title: "A local choice",
  context: "A local synthetic scenario",
  choices: [{ choiceId: "A", label: "Preserve my choice", intent: "integrity", xpBase: 10,
    difficulty: 1, hiddenDelta: {}, result: "Result", microInsight: "Insight" }],
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json" } });
}

describe("legacy primary choice reward acknowledgement", () => {
  const fetchMock = vi.fn();
  let rewardResponse: () => Promise<Response>;
  let servedScenario: Scenario;
  let startedEventFails: boolean;

  beforeEach(() => {
    navigation.locale = "en";
    vi.stubEnv("NEXT_PUBLIC_ARENA_PIPELINE_DEFAULT", "legacy");
    localStorage.clear();
    servedScenario = scenario;
    startedEventFails = false;
    rewardResponse = async () => json(acknowledged);
    fetchMock.mockReset();
    fetchMock.mockImplementation(async (path: string, init?: RequestInit) => {
      if (path === "/api/arena/core-xp") return json({ coreXpTotal: 500, tier: 2, requiresBeginnerPath: false });
      if (path.startsWith("/api/arena/session/next?")) return json({ ok: true, scenario: servedScenario });
      if (path === "/api/arena/run") return json({ run: { run_id: "legacy-client-run" } });
      if (path === "/api/arena/choice") return json({ mode: "arena", runtime_state: "TRADEOFF_ACTIVE", state_priority: 20,
        gates: { choice_allowed: true, next_allowed: false, qr_allowed: false },
        action_contract: { exists: false, id: null, status: null, verification_type: null, deadline_at: null } });
      if (path === "/api/arena/event") {
        const body = JSON.parse(String(init?.body));
        if (body.eventType === "SCENARIO_STARTED" && startedEventFails) throw new Error("telemetry unavailable");
        return body.eventType === "CHOICE_CONFIRMED" ? rewardResponse() : json({ ok: true });
      }
      throw new Error(`Unexpected local test request: ${path}`);
    });
    vi.stubGlobal("fetch", fetchMock);
    vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  async function ready() {
    const hook = renderHook(() => useArenaSession());
    await waitFor(() => expect(hook.result.current.runId).toBe("legacy-client-run"));
    act(() => hook.result.current.selectChoice("A"));
    return hook;
  }

  it.each<[string, () => Promise<Response>]>([
    ["HTTP failure", () => Promise.resolve(json({ error: "XP_AWARD_FAILED" }, 500))],
    ["network failure", () => Promise.reject(new Error("offline"))],
    ["HTML 200", () => Promise.resolve(new Response("<html>Sign in</html>"))],
    ["empty success", () => Promise.resolve(json({ ok: true }))],
    ["false success", () => Promise.resolve(json({ ...acknowledged, ok: false }))],
    ["invalid XP", () => Promise.resolve(json({ ...acknowledged, xp: 1.5 }))],
    ["missing receipt", () => Promise.resolve(json({ ...acknowledged, receiptId: undefined }))],
    ["legacy review", () => Promise.resolve(json({ error: "LEGACY_REWARD_REVIEW_REQUIRED" }, 409))],
    ["input conflict", () => Promise.resolve(json({ error: "REWARD_INPUT_CONFLICT" }, 409))],
  ])("keeps choice, draft, step and XP on %s; a valid retry then advances", async (_name, response) => {
    rewardResponse = response;
    const { result } = await ready();
    act(() => result.current.setOtherText("Keep this draft"));
    await act(async () => result.current.onConfirmChoice());

    expect(result.current.phase).toBe("CHOOSING");
    expect(result.current.step).toBe(2);
    expect(result.current.lastXp).toBe(0);
    expect(result.current.selectedChoiceId).toBe("A");
    expect(result.current.otherText).toBe("Keep this draft");
    expect(result.current.confirmingChoice).toBe(false);
    expect(result.current.toast).toBeTruthy();
    expect(result.current.toast).not.toMatch(/REWARD_|XP_AWARD|offline|<html>/);
    expect(JSON.parse(localStorage.getItem(BTY_ARENA_STATE_STORAGE_KEY)!)).toMatchObject({ phase: "CHOOSING", step: 2 });

    rewardResponse = async () => json({ ...acknowledged, idempotent: true });
    await act(async () => result.current.onConfirmChoice());
    expect(result.current.phase).toBe("SHOW_RESULT");
    expect(result.current.lastXp).toBe(37);
    expect(JSON.parse(localStorage.getItem(BTY_ARENA_STATE_STORAGE_KEY)!)).toMatchObject({ phase: "SHOW_RESULT", lastXp: 37 });
  });

  it("waits for the acknowledgement and displays its stored XP instead of local computed XP", async () => {
    let accept!: (response: Response) => void;
    rewardResponse = () => new Promise((resolve) => { accept = resolve; });
    const { result } = await ready();
    let pending!: Promise<void>;
    act(() => { pending = result.current.onConfirmChoice(); });
    await waitFor(() => expect(accept).toBeTypeOf("function"));
    expect(result.current.confirmingChoice).toBe(true);
    expect(result.current.phase).toBe("CHOOSING");
    expect(result.current.lastXp).toBe(0);
    await act(async () => { accept(json(acknowledged)); await pending; });
    expect(result.current.phase).toBe("SHOW_RESULT");
    expect(result.current.lastXp).toBe(37);
    const event = fetchMock.mock.calls.find((call) => call[0] === "/api/arena/event" && String(call[1]?.body).includes("CHOICE_CONFIRMED"));
    expect(JSON.parse(event![1].body)).toMatchObject({ runId: "legacy-client-run", choiceId: "A", eventType: "CHOICE_CONFIRMED" });
    expect(event![1].credentials).toBe("include");
  });

  it("uses a Korean confirmation error without exposing a backend code", async () => {
    navigation.locale = "ko";
    rewardResponse = async () => json({ error: "LEGACY_REWARD_REVIEW_REQUIRED" }, 409);
    const { result } = await ready();
    await act(async () => result.current.onConfirmChoice());
    expect(result.current.phase).toBe("CHOOSING");
    expect(result.current.toast).toMatch(/[가-힣]/);
    expect(result.current.toast).not.toContain("LEGACY_REWARD");
  });

  it("keeps nonreward telemetry best effort while still requiring the choice receipt", async () => {
    startedEventFails = true;
    const { result } = await ready();
    await act(async () => result.current.onConfirmChoice());
    expect(result.current.phase).toBe("SHOW_RESULT");
    expect(result.current.lastXp).toBe(37);
  });

  it("preserves the canonical binding endpoint and payload without a legacy reward event", async () => {
    servedScenario = { ...scenario, source: "json", dbScenarioId: "INCIDENT-CLIENT-TEST",
      eliteSetup: { role: "Role", pressure: "Pressure", tradeoff: "Tradeoff" },
      choices: scenario.choices.map((choice) => ({ ...choice, dbChoiceId: "canonical-primary-A" })) };
    const { result } = await ready();
    await act(async () => result.current.onConfirmChoice());
    expect(result.current.phase).toBe("FORCED_TRADEOFF");
    const binding = fetchMock.mock.calls.find((call) => call[0] === "/api/arena/choice");
    expect(JSON.parse(binding![1].body)).toEqual({ run_id: "legacy-client-run", json_scenario_id: scenario.scenarioId,
      db_scenario_id: "INCIDENT-CLIENT-TEST", json_choice_id: "A", db_choice_id: "canonical-primary-A" });
    expect(fetchMock.mock.calls.filter((call) => call[0] === "/api/arena/event" && String(call[1]?.body).includes("CHOICE_CONFIRMED"))).toHaveLength(0);
    expect(fetchMock.mock.calls.filter((call) => call[0] === "/api/arena/run/step")).toHaveLength(0);
  });
});
