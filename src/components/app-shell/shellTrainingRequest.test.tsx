/** @vitest-environment jsdom */
/**
 * The SHELL's half of the resume fix. Slice Teams iOS Deep-Link Resume.
 *
 * `BtyDailyAppShell` used to copy the deep-link target into state in a mount-time initialiser, so a
 * training arriving after mount — which is every training on a resumed Teams iOS tab — was ignored.
 * These tests drive the real shell with the real request contract.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent, waitFor, within } from "@testing-library/react";

const H = vi.hoisted(() => ({ roomProps: [] as Array<Record<string, unknown>> }));

vi.mock("next/navigation", async (importOriginal) => ({
  ...await importOriginal<typeof import("next/navigation")>(),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn() }),
}));

vi.mock("@/components/foundry/learner/InShellLearnerRoom", () => ({
  default: (props: Record<string, unknown>) => {
    H.roomProps.push(props);
    const target = props.target as { joinToken: string };
    return (
      <div data-testid="room" data-token={target.joinToken}>
        <button type="button" data-testid="room-exit" onClick={props.onExit as () => void}>
          exit
        </button>
      </div>
    );
  },
}));

import BtyDailyAppShell from "./BtyDailyAppShell";

const TOKEN = "btyfr1.eyJ0eXBlIjoiZm91bmRyeV9yb29tIn0.c2lnbmF0dXJlLXZhbHVl";
const TOKEN_B = "btyfr1.eyJiIjoxfQ.c2Vjb25kLXNpZ25hdHVyZQ";
const request = (joinToken: string, requestKey: string) =>
  ({ target: { joinToken }, requestKey, transport: "context" }) as const;

beforeEach(() => {
  H.roomProps.length = 0;
  vi.stubGlobal("fetch", vi.fn(async () => new Response("{}", { status: 200 })));
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("a request arriving AFTER mount opens the room", () => {
  it("mounts on ordinary shell, then opens when a request appears", async () => {
    const { rerender } = render(<BtyDailyAppShell locale="en" trainingRequest={null} />);
    expect(screen.queryByTestId("room")).toBeNull();

    rerender(<BtyDailyAppShell locale="en" trainingRequest={request(TOKEN, "refresh:1")} />);
    await waitFor(() => expect(screen.getByTestId("room")).toBeTruthy());
    expect(screen.getByTestId("room").getAttribute("data-token")).toBe(TOKEN);
    expect(screen.getByTestId("in-shell-training")).toBeTruthy();
  });

  it("a COLD request is committed on the first render — no ordinary-shell flash", () => {
    render(<BtyDailyAppShell locale="en" trainingRequest={request(TOKEN, "bootstrap:0")} />);
    expect(screen.getByTestId("room")).toBeTruthy();
    expect(H.roomProps).toHaveLength(1);
  });
});

describe("Teams quick tour", () => {
  const guide = (name: string) => screen.getByRole("dialog", { name });
  const action = (name: string, label: string) => fireEvent.click(within(guide(name)).getByRole("button", { name: label }));
  const appTab = (name: string) =>
    fireEvent.click(within(screen.getByRole("navigation", { name: "App navigation" })).getByRole("button", { name }));

  function mockLearner(aiPatient: boolean, withTodayData = false) {
    const fetchStub = vi.fn(async (input: RequestInfo | URL, _init?: RequestInit) => {
      const url = String(input);
      if (url === "/api/bty/foundry/events") {
        return Response.json({ error: "foundry_author_required" }, { status: 403 });
      }
      if (url === "/api/arena/ai-patient/access") return Response.json({ enabled: aiPatient });
      if (withTodayData && url === "/api/bty/announcements/mine") {
        return Response.json({ items: [{
          announcementId: "announcement", recipientId: "recipient", hostFraming: "Please review",
          hostDisplay: "Test host", sourceUrl: null, response: null, respondedAt: null, unreadCount: 0, messageCount: 0,
        }] });
      }
      if (withTodayData && url === "/api/bty/action-capture/mine") {
        return Response.json({ ok: true, items: ["first", "second"].map((id) => ({
          id, sourceType: "teams_message", previewText: id, sourceUrl: null,
          sourceMetadata: { provider: "teams", tenant_id: "test", conversation_id: "19:chat@unq.gbl.spaces" },
          status: "captured", capturedAt: "2026-08-31T10:00:00Z", triageChoice: null, triagedAt: null,
        })) });
      }
      return Response.json({});
    });
    vi.stubGlobal("fetch", fetchStub);
    return fetchStub;
  }

  it("walks all four tabs and opens the actual feature screens with their real controls", async () => {
    const onDismiss = vi.fn();
    const fetchStub = mockLearner(true);
    render(<BtyDailyAppShell locale="en" runtime="teams" teamsTour={{ offer: true, onDismiss }} />);

    expect(screen.getByRole("heading", { name: "Start with Today" })).toBe(document.activeElement);
    action("Start with Today", "Continue");
    action("Respond to a Track", "Continue");
    action("Follow up on a Track you sent", "Continue");
    fireEvent.click(screen.getByTestId("today-saved-entry"));
    expect(screen.getByTestId("saved-view")).toBeTruthy();
    action("Use your saved list", "Continue");
    fireEvent.click(screen.getByTestId("saved-back"));
    expect(guide("Open Learn")).toBeTruthy();

    appTab("Learn");
    await screen.findByTestId("door-my-learning");
    action("Find your assigned training", "Continue");
    fireEvent.click(screen.getByTestId("door-my-learning"));
    expect(screen.getByTestId("foundry-my-learning")).toBeTruthy();
    fireEvent.click(screen.getByTestId("my-learning-back"));
    expect(guide("Open Practice")).toBeTruthy();

    appTab("Practice");
    fireEvent.click(screen.getByTestId("practice-arena-entry"));
    expect(screen.getByTestId("practice-arena")).toBeTruthy();
    fireEvent.click(screen.getByTestId("practice-arena-back"));
    action("Open Clinical Cases", "Open Clinical Cases");
    expect(screen.getByTestId("practice-clinical")).toBeTruthy();
    fireEvent.click(screen.getByTestId("practice-clinical-back"));
    await screen.findByTestId("practice-ai-patient-entry");
    fireEvent.click(screen.getByTestId("practice-ai-patient-entry"));
    expect(screen.getByTestId("ai-patient-intro")).toBeTruthy();
    fireEvent.click(screen.getByTestId("ai-patient-back"));
    fireEvent.click(screen.getByTestId("practice-field-actions"));
    expect(screen.getByTestId("field-actions-focus")).toBeTruthy();
    fireEvent.click(screen.getByTestId("field-actions-back"));

    appTab("Me");
    action("Choose your language", "Continue");
    action("Review your week", "Continue");
    fireEvent.click(screen.getByTestId("me-weekly-orb"));
    expect(screen.getByTestId("me-attendance-popup")).toBeTruthy();
    fireEvent.click(screen.getByTestId("me-attendance-close"));
    fireEvent.click(screen.getByTestId("me-row-past-tracks"));
    expect(screen.getByTestId("past-tracks")).toBeTruthy();
    fireEvent.click(screen.getByTestId("past-tracks-back"));
    fireEvent.click(screen.getByTestId("me-row-center"));
    expect(screen.getByTestId("me-center")).toBeTruthy();
    fireEvent.click(screen.getByTestId("me-center-back"));
    fireEvent.click(screen.getByTestId("me-account-row"));
    expect(screen.getByTestId("account-block")).toBeTruthy();
    fireEvent.click(screen.getByTestId("me-account-back"));
    action("You’re ready to use BTY", "Finish tour");
    expect(screen.queryByRole("navigation", { name: "Tour chapters" })).toBeNull();
    expect(onDismiss).toHaveBeenCalledTimes(1);
    expect(fetchStub.mock.calls.map(([input]) => String(input)).some((url) =>
      /ai-patient\/(start|message)|clinical.*attempt/.test(url))).toBe(false);
  });

  it("replays by chapter in Korean, keeps Practice guidance active, and skips disabled AI Patient", async () => {
    mockLearner(false);
    const onDismiss = vi.fn();
    render(<BtyDailyAppShell locale="ko" runtime="teams" teamsTour={{ offer: false, onDismiss }} />);

    appTab("나");
    fireEvent.click(screen.getByRole("button", { name: "BTY 둘러보기" }));
    expect(guide("오늘 할 일 확인")).toBeTruthy();
    const panel = guide("오늘 할 일 확인");
    appTab("연습");
    fireEvent.click(screen.getByTestId("today-saved-entry"));
    expect(guide("오늘 할 일 확인")).toBe(panel);
    expect(screen.queryByTestId("saved-view")).toBeNull();
    expect(screen.queryByTestId("practice-landing")).toBeNull();
    const chapters = screen.getByRole("navigation", { name: "둘러보기 목차" });
    fireEvent.click(within(chapters).getByRole("button", { name: "연습" }));
    expect(guide("아레나 연습 열기")).toBe(panel);
    fireEvent.click(screen.getByTestId("practice-clinical-entry"));
    expect(guide("아레나 연습 열기")).toBe(panel);
    expect(screen.queryByTestId("practice-clinical")).toBeNull();
    fireEvent.click(screen.getByTestId("practice-arena-entry"));
    expect(guide("준비되면 연습 선택")).toBe(panel);
    fireEvent.click(screen.getByTestId("practice-arena-back"));
    expect(guide("임상 케이스 열기")).toBe(panel);
    fireEvent.click(screen.getByTestId("practice-arena-entry"));
    expect(guide("임상 케이스 열기")).toBe(panel);
    fireEvent.click(screen.getByTestId("practice-clinical-entry"));
    expect(guide("케이스 목록 살펴보기")).toBeTruthy();
    fireEvent.click(screen.getByTestId("practice-clinical-back"));
    await screen.findByTestId("practice-ai-patient-unavailable");
    action("AI 환자 찾기", "계속");
    expect(guide("행동 계획 열기")).toBeTruthy();
    fireEvent.keyDown(document.activeElement!, { key: "Escape" });
    expect(screen.queryByRole("navigation", { name: "둘러보기 목차" })).toBeNull();
    expect(screen.getByTestId("practice-field-actions")).toBe(document.activeElement);
    expect(onDismiss).not.toHaveBeenCalled();
  });

  it("opens the real question form and saved conversation when data exists without sending or changing records", async () => {
    const fetchStub = mockLearner(false, true);
    render(<BtyDailyAppShell locale="en" runtime="teams" teamsTour={{ offer: true, onDismiss: vi.fn() }} />);

    await screen.findByTestId("announcement-question");
    action("Start with Today", "Continue");
    action("Respond to a Track", "Continue");
    fireEvent.click(screen.getByTestId("announcement-question"));
    expect(guide("Write a question here")).toBeTruthy();
    expect(screen.getByTestId("announcement-question-form")).toBeTruthy();
    action("Write a question here", "Continue");
    action("Follow up on a Track you sent", "Continue");
    fireEvent.click(screen.getByTestId("today-saved-entry"));
    await screen.findByTestId("saved-conversation-header");
    action("Use your saved list", "Continue");
    expect(guide("Expand a saved conversation")).toBeTruthy();
    fireEvent.click(screen.getByTestId("saved-conversation-header"));
    expect(screen.getByTestId("saved-conversation-messages")).toBeTruthy();
    expect(guide("Return to Today")).toBeTruthy();
    expect(fetchStub.mock.calls.some(([input, init]) =>
      String(input) !== "/api/me/day/open" && (init?.method === "POST" || init?.method === "PATCH"))).toBe(false);
  });

  it("lets a late Teams training invitation take over an active tour", async () => {
    const teamsTour = { offer: true, onDismiss: vi.fn() };
    const { rerender } = render(<BtyDailyAppShell locale="en" runtime="teams" teamsTour={teamsTour} />);
    expect(screen.getByRole("dialog", { name: "Start with Today" })).toBeTruthy();
    rerender(<BtyDailyAppShell locale="en" runtime="teams" teamsTour={teamsTour}
      trainingRequest={request(TOKEN, "refresh:tour")} />);
    await waitFor(() => expect(screen.getByTestId("room")).toBeTruthy());
    expect(screen.queryByRole("dialog")).toBeNull();
    fireEvent.click(screen.getByTestId("room-exit"));
    fireEvent.click(screen.getByRole("button", { name: /^Today$/ }));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(teamsTour.onDismiss).not.toHaveBeenCalled();
  });

  it("renders a cold training invitation ahead of the first-use guide", () => {
    render(<BtyDailyAppShell locale="en" runtime="teams"
      trainingRequest={request(TOKEN, "bootstrap:0")}
      teamsTour={{ offer: true, onDismiss: vi.fn() }} />);
    expect(screen.getByTestId("room")).toBeTruthy();
    expect(screen.queryByRole("dialog", { name: "Start with Today" })).toBeNull();
  });
});

describe("occurrence semantics inside the shell", () => {
  it("re-delivering the SAME occurrence is inert", async () => {
    const req = request(TOKEN, "refresh:1");
    const { rerender } = render(<BtyDailyAppShell locale="en" trainingRequest={null} />);
    rerender(<BtyDailyAppShell locale="en" trainingRequest={req} />);
    await waitFor(() => expect(screen.getByTestId("room")).toBeTruthy());
    const node = screen.getByTestId("room");

    rerender(<BtyDailyAppShell locale="en" trainingRequest={{ ...req }} />);
    rerender(<BtyDailyAppShell locale="en" trainingRequest={{ ...req }} />);
    expect(screen.getByTestId("room")).toBe(node);
  });

  it("★ a NEW occurrence for the training already open does not remount it", async () => {
    const { rerender } = render(
      <BtyDailyAppShell locale="en" trainingRequest={request(TOKEN, "bootstrap:0")} />,
    );
    const node = screen.getByTestId("room");
    rerender(<BtyDailyAppShell locale="en" trainingRequest={request(TOKEN, "refresh:1")} />);
    rerender(<BtyDailyAppShell locale="en" trainingRequest={request(TOKEN, "refresh:2")} />);
    await waitFor(() => expect(screen.getByTestId("room")).toBe(node));
    /*
      The room never changed WHICH training it is showing. (`roomProps` records every render of the
      stand-in, not every mount, so node identity above is what proves nothing remounted.)
    */
    expect(new Set(H.roomProps.map((p) => (p.target as { joinToken: string }).joinToken))).toEqual(
      new Set([TOKEN]),
    );
  });

  it("★ the SAME training reopens after Back to Learn", async () => {
    const { rerender } = render(
      <BtyDailyAppShell locale="en" trainingRequest={request(TOKEN, "bootstrap:0")} />,
    );
    expect(screen.getByTestId("room")).toBeTruthy();

    fireEvent.click(screen.getByTestId("room-exit"));
    await waitFor(() => expect(screen.queryByTestId("room")).toBeNull());

    rerender(<BtyDailyAppShell locale="en" trainingRequest={request(TOKEN, "refresh:5")} />);
    await waitFor(() => expect(screen.getByTestId("room")).toBeTruthy());
    expect(screen.getByTestId("room").getAttribute("data-token")).toBe(TOKEN);
  });

  it("a different training replaces the open one", async () => {
    const { rerender } = render(
      <BtyDailyAppShell locale="en" trainingRequest={request(TOKEN, "bootstrap:0")} />,
    );
    rerender(<BtyDailyAppShell locale="en" trainingRequest={request(TOKEN_B, "refresh:1")} />);
    await waitFor(() => expect(screen.getByTestId("room").getAttribute("data-token")).toBe(TOKEN_B));
  });
});

describe("Back to Learn", () => {
  it("closes the room locally and reports the exit to the host", async () => {
    const onTrainingExit = vi.fn();
    render(
      <BtyDailyAppShell
        locale="en"
        trainingRequest={request(TOKEN, "bootstrap:0")}
        onTrainingExit={onTrainingExit}
      />,
    );
    fireEvent.click(screen.getByTestId("room-exit"));
    await waitFor(() => expect(screen.queryByTestId("in-shell-training")).toBeNull());
    expect(onTrainingExit).toHaveBeenCalledTimes(1);
  });

  it("works without a host handler — the web shell has no subpage to clear", async () => {
    render(<BtyDailyAppShell locale="en" trainingRequest={request(TOKEN, "bootstrap:0")} />);
    fireEvent.click(screen.getByTestId("room-exit"));
    await waitFor(() => expect(screen.queryByTestId("room")).toBeNull());
  });
});

describe("the ordinary web shell is unaffected", () => {
  it("renders normally with no training props at all", () => {
    render(<BtyDailyAppShell locale="en" />);
    expect(screen.queryByTestId("room")).toBeNull();
    expect(screen.queryByTestId("in-shell-training")).toBeNull();
    // The ordinary app root is what rendered instead.
    expect(document.querySelector("[data-bty-app-root]")).toBeTruthy();
  });
});
