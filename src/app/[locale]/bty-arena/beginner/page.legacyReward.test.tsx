/** @vitest-environment jsdom */
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const navigation = vi.hoisted(() => ({ locale: "en" }));
vi.mock("next/navigation", () => ({ useParams: () => ({ locale: navigation.locale }) }));
vi.mock("next/link", () => ({ default: ({ href, children }: { href: string; children: React.ReactNode }) => <a href={href}>{children}</a> }));
vi.mock("@/components/bty-arena", () => ({ CardSkeleton: () => <div>Loading</div> }));
vi.mock("@/lib/bty/scenario/beginnerScenarios", () => ({
  pickRandomBeginnerScenario: () => ({
    scenarioId: "beginner-client-test", title: "Synthetic beginner", context: "Local context",
    emotionOptions: ["Emotion A", "Emotion B", "Emotion C", "Emotion D"],
    hiddenRiskQuestion: "Risk?", riskOptions: ["Risk A", "Risk B"],
    integrityTrigger: "Value?", integrityOptions: ["Value A", "Value B"],
    decisionOptions: [{ id: "A", label: "Decision A" }, { id: "B", label: "Decision B" }, { id: "C", label: "Decision C" }],
    growth: "A growth message",
  }),
}));

import BeginnerArenaPage from "./page";

const acknowledged = { ok: true, beginner_maturity_score: 11, band: "aware", label: "Aware", message: "Saved feedback",
  receiptId: "27e9d375-a6d1-45e1-9b97-f7d3e75a576f", idempotent: false };

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json" } });
}

describe("beginner completion reward acknowledgement", () => {
  const fetchMock = vi.fn();
  let completionResponse: () => Promise<Response>;

  beforeEach(() => {
    navigation.locale = "en";
    completionResponse = async () => json(acknowledged);
    fetchMock.mockReset();
    fetchMock.mockImplementation(async (path: string) => {
      if (path === "/api/arena/beginner-run") return json({ run: { run_id: "beginner-client-run" } });
      if (path === "/api/arena/beginner-event") return json({ ok: true });
      if (path === "/api/arena/beginner-complete") return completionResponse();
      throw new Error(`Unexpected local test request: ${path}`);
    });
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

  async function click(name: string) {
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: (label) => label === name })); });
  }

  async function reflectionReady() {
    render(<BeginnerArenaPage />);
    await waitFor(() => expect(screen.getByRole("button", { name: navigation.locale === "ko" ? "성찰 시작" : "Start reflection" })).toBeTruthy());
    const next = navigation.locale === "ko" ? "다음" : "Next";
    await click(navigation.locale === "ko" ? "성찰 시작" : "Start reflection");
    for (const answer of ["Emotion B", "Risk B", "Value B", "Decision C"]) {
      await click(answer);
      await click(next);
    }
    await click(next);
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "Keep my reflection for retry" } });
  }

  it.each<[string, () => Promise<Response>]>([
    ["HTTP failure", () => Promise.resolve(json({ error: "XP_AWARD_FAILED" }, 500))],
    ["network failure", () => Promise.reject(new Error("offline"))],
    ["HTML 200", () => Promise.resolve(new Response("<html>Sign in</html>"))],
    ["empty success", () => Promise.resolve(json({ ok: true }))],
    ["false success", () => Promise.resolve(json({ ...acknowledged, ok: false }))],
    ["out of range score", () => Promise.resolve(json({ ...acknowledged, beginner_maturity_score: 21 }))],
    ["invalid band", () => Promise.resolve(json({ ...acknowledged, band: "expert" }))],
    ["empty label", () => Promise.resolve(json({ ...acknowledged, label: " " }))],
    ["missing receipt", () => Promise.resolve(json({ ...acknowledged, receiptId: undefined }))],
    ["legacy review", () => Promise.resolve(json({ error: "LEGACY_REWARD_REVIEW_REQUIRED" }, 409))],
    ["input conflict", () => Promise.resolve(json({ error: "REWARD_INPUT_CONFLICT" }, 409))],
  ])("preserves reflection and answers on %s; retry displays the stored result", async (_name, response) => {
    completionResponse = response;
    await reflectionReady();
    await click("Complete");
    expect(screen.queryByText("Your result")).toBeNull();
    expect((screen.getByRole("textbox") as HTMLTextAreaElement).value).toBe("Keep my reflection for retry");
    expect(screen.getByRole("button", { name: "Complete" }).hasAttribute("disabled")).toBe(false);
    const alert = screen.getByRole("alert");
    expect(alert.textContent).not.toMatch(/REWARD_|XP_AWARD|offline|<html>/);

    completionResponse = async () => json({ ...acknowledged, idempotent: true });
    await click("Complete");
    expect(screen.getByText("Your result")).toBeTruthy();
    expect(screen.getByText("Score: 11 / 20")).toBeTruthy();
    const requests = fetchMock.mock.calls.filter((call) => call[0] === "/api/arena/beginner-complete");
    expect(requests).toHaveLength(2);
    expect(JSON.parse(requests[1][1].body)).toMatchObject({ runId: "beginner-client-run", emotionIndex: 1, riskIndex: 1,
      integrityIndex: 1, decisionIndex: 2, reflectionText: "Keep my reflection for retry" });
    expect(requests[1][1].credentials).toBe("include");
  });

  it("shows Korean review feedback while retaining the reflection", async () => {
    navigation.locale = "ko";
    completionResponse = async () => json({ error: "LEGACY_REWARD_REVIEW_REQUIRED" }, 409);
    await reflectionReady();
    await click("완료");
    expect(screen.getByRole("alert").textContent).toMatch(/[가-힣]/);
    expect(screen.getByRole("alert").textContent).not.toContain("LEGACY_REWARD");
    expect((screen.getByRole("textbox") as HTMLTextAreaElement).value).toBe("Keep my reflection for retry");
  });

  it("keeps completion pending until its receipt arrives", async () => {
    let accept!: (response: Response) => void;
    completionResponse = () => new Promise((resolve) => { accept = resolve; });
    await reflectionReady();
    act(() => { fireEvent.click(screen.getByRole("button", { name: "Complete" })); });
    await waitFor(() => expect(accept).toBeTypeOf("function"));
    expect(screen.queryByText("Your result")).toBeNull();
    expect(screen.getByRole("button", { name: "Complete" }).hasAttribute("disabled")).toBe(true);
    expect((screen.getByRole("textbox") as HTMLTextAreaElement).value).toBe("Keep my reflection for retry");
    await act(async () => { accept(json(acknowledged)); });
    expect(screen.getByText("Your result")).toBeTruthy();
  });
});
