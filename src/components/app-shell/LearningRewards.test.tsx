/** @vitest-environment jsdom */
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { LearningRewardBadgeId, LearningRewardsSummary } from "@/domain/learning-rewards/types";
import LearningRewards from "./LearningRewards";

const IDS: LearningRewardBadgeId[] = ["first", "circle", "second", "weeks", "patient", "clinical", "follow", "insight", "together", "return", "level10", "level50"];
const NAMES = ["First Step", "Full Circle", "A Second Look", "Four Learning Weeks", "Patient Conversations", "Clinical Explorer", "Follow-through", "Shared Insight", "Better Together", "Thirty-day Return", "Level 10", "Level 50"];
const AT = "2026-10-30T15:00:00.000Z";
function summary(overrides: Partial<LearningRewardsSummary> = {}): LearningRewardsSummary {
  return {
    policyVersion: "learning-rewards/v1", totalXp: 2090, weeklyXp: 30, weeklyGoal: 60, weeklyGoalReached: false, weeklyProgressPercent: 50,
    level: { current: 9, next: 10, xpToNextLevel: 10, progressPercent: 96.666, xpIntoLevel: 290, xpForNextLevel: 300, nextLevelTotalXp: 2100, nextMilestone: 10, nextMilestoneXp: 2100 },
    week: { startsAt: "2026-10-26T12:00:00.000Z", endsAt: "2026-11-02T13:00:00.000Z", timezone: "America/Los_Angeles" },
    badges: IDS.map((id, index) => ({ id, name: NAMES[index], description: `Verified condition for ${NAMES[index]}.`, icon: id === "first" ? "sprout" : "sparkles", frame: index % 2 ? "octagon" : "circle", earnedAt: id === "first" ? AT : null, progress: id === "first" ? 1 : 0, target: 1, available: !["insight", "together"].includes(id) })),
    featuredBadgeId: null, recentAchievements: [], pendingAchievements: [], team: { status: "unavailable", reason: "Verified roster required" }, ...overrides,
  };
}
function response(body: unknown, ok = true) { return { ok, json: async () => body }; }
function served(s = summary(), sync: Record<string, unknown> = {}) {
  return vi.fn(async (_url: unknown, options?: RequestInit) => response(options?.method === "POST" ? { ok: true, enabled: true, summary: s, xpAwarded: 0, newAchievements: [], awards: [], ...sync } : { ok: true, enabled: true, summary: s }));
}
afterEach(() => { cleanup(); vi.useRealTimers(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe("Learning Rewards: real canonical values inside Me", () => {
  it("renders nothing and makes no reward write when the server disables the feature", async () => {
    const fetch = vi.fn(async (_url: unknown, _options?: RequestInit) => response({ ok: true, enabled: false }));
    vi.stubGlobal("fetch", fetch);
    const { container } = render(<LearningRewards locale="en" />);
    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));
    expect(container.textContent).toBe("");
    expect(fetch.mock.calls[0][1]).toMatchObject({ credentials: "include", cache: "no-store" });
  });

  it("shows cumulative and weekly Learning XP separately and sends no chosen XP or user identity", async () => {
    const fetch = served(); vi.stubGlobal("fetch", fetch);
    render(<LearningRewards locale="en" />);
    await waitFor(() => expect(screen.getByTestId("learning-total-xp").textContent).toBe("2,090"));
    await waitFor(() => expect(screen.queryByText("Checking your recent learning…")).toBeNull());
    expect(screen.getByTestId("learning-weekly-xp").textContent).toBe("30 / 60 XP");
    expect(screen.getByTestId("learning-level").textContent).toBe("9");
    expect(screen.getByText("10 XP to Level 10")).toBeTruthy();
    expect(screen.getByText(/Earlier Arena points stay separate/)).toBeTruthy();
    expect(fetch.mock.calls).toHaveLength(2);
    expect(JSON.parse(String(fetch.mock.calls[1][1]?.body))).toEqual({ operation: "sync" });
    expect(fetch.mock.calls[1][1]).toMatchObject({ method: "POST", credentials: "include", cache: "no-store" });
  });

  it("opens all twelve badge conditions and leaves unavailable badges unearned", async () => {
    vi.stubGlobal("fetch", served()); render(<LearningRewards locale="en" />);
    await waitFor(() => expect(screen.queryByText("Checking your recent learning…")).toBeNull());
    await waitFor(() => screen.getByText(/Explore all badges/));
    fireEvent.click(screen.getByText(/Explore all badges/));
    const grid = screen.getByTestId("learning-badge-grid");
    expect(within(grid).getAllByRole("button")).toHaveLength(12);
    fireEvent.click(within(grid).getByRole("button", { name: "Shared Insight · Not available yet" }));
    const detail = screen.getByTestId("learning-badge-detail");
    expect(within(detail).getByText("Verified condition for Shared Insight.")).toBeTruthy();
    expect(within(detail).getByText(/This badge needs an assigned learning path/)).toBeTruthy();
    expect(within(detail).queryByRole("button", { name: "Feature on my profile" })).toBeNull();
    expect(document.activeElement).toBe(within(detail).getByRole("heading", { name: "Shared Insight" }));
  });

  it("persists a featured badge only after server acknowledgement", async () => {
    const s = summary();
    const fetch = served(s); vi.stubGlobal("fetch", fetch);
    render(<LearningRewards locale="en" />);
    await waitFor(() => screen.getByRole("button", { name: "First Step · Earned" }));
    await waitFor(() => expect(screen.queryByText("Checking your recent learning…")).toBeNull());
    fireEvent.click(screen.getByRole("button", { name: "First Step · Earned" }));
    fetch.mockResolvedValueOnce(response({ ok: true, enabled: true, summary: { ...s, featuredBadgeId: "first" } }));
    fireEvent.click(screen.getByRole("button", { name: "Feature on my profile" }));
    await waitFor(() => expect(screen.getAllByText(/Featured on your profile/)).toHaveLength(2));
    expect(JSON.parse(String(fetch.mock.calls[2][1]?.body))).toEqual({ operation: "feature", badgeId: "first" });
    expect(screen.getByTestId("learning-total-xp").textContent).toBe("2,090");
  });

  it("reports feature-save failure without claiming success", async () => {
    const fetch = served(); vi.stubGlobal("fetch", fetch);
    render(<LearningRewards locale="en" />);
    await waitFor(() => screen.getByRole("button", { name: "First Step · Earned" }));
    await waitFor(() => expect(screen.queryByText("Checking your recent learning…")).toBeNull());
    fireEvent.click(screen.getByRole("button", { name: "First Step · Earned" }));
    fetch.mockResolvedValueOnce(response({}, false));
    fireEvent.click(screen.getByRole("button", { name: "Feature on my profile" }));
    await waitFor(() => expect(screen.getByRole("alert").textContent).toContain("couldn't be saved"));
    expect(screen.queryByText("Featured on your profile")).toBeNull();
    expect(screen.getByRole("button", { name: "Feature on my profile" })).toBeTruthy();
  });

  it("groups new achievements with the awarded XP and replay never writes or adds XP", async () => {
    const after = summary({ totalXp: 2110, weeklyXp: 50, level: { current: 10, next: 11, xpToNextLevel: 290, progressPercent: 3.333, xpIntoLevel: 10, xpForNextLevel: 300, nextLevelTotalXp: 2400, nextMilestone: 20, nextMilestoneXp: 5100 } });
    const fetch = served(after, { xpAwarded: 20, newAchievements: [
      { id: "level:10", kind: "milestone", title: "Level 10", earnedAt: AT },
      { id: "badge:second", kind: "badge", title: "A Second Look", earnedAt: AT },
      { id: "badge:level10", kind: "badge", title: "Level 10", earnedAt: AT },
    ] }); vi.stubGlobal("fetch", fetch);
    render(<LearningRewards locale="en" />);
    await waitFor(() => screen.getByTestId("learning-celebration"));
    expect(screen.getByTestId("learning-celebration").textContent).toContain("+20 Learning XP");
    expect(screen.getByTestId("learning-celebration").textContent).toContain("A Second Look");
    expect(within(screen.getByTestId("learning-celebration")).getAllByText("Level 10")).toHaveLength(1);
    expect(screen.getByTestId("learning-level").textContent).toBe("10");
    const calls = fetch.mock.calls.length;
    fireEvent.click(screen.getByRole("button", { name: "Replay animation" }));
    fireEvent.click(screen.getByRole("button", { name: "Replay animation" }));
    expect(fetch.mock.calls.length).toBe(calls);
    expect(screen.getByTestId("learning-total-xp").textContent).toBe("2,110");
    fireEvent.click(screen.getByRole("button", { name: "Continue learning" }));
    await waitFor(() => expect(screen.queryByTestId("learning-celebration")).toBeNull());
    expect(JSON.parse(String(fetch.mock.calls[calls][1]?.body))).toEqual({ operation: "acknowledge", achievementIds: ["level:10", "badge:second", "badge:level10"] });
  });

  it("shows an unseen achievement from a previous session until the user acknowledges it", async () => {
    const pending = [{ id: "badge:first", kind: "badge" as const, title: "First Step", earnedAt: AT }];
    const s = summary({ pendingAchievements: pending, recentAchievements: pending });
    const fetch = served(s); vi.stubGlobal("fetch", fetch);
    render(<LearningRewards locale="en" />);
    await waitFor(() => screen.getByTestId("learning-celebration"));
    await waitFor(() => expect(screen.queryByText("Checking your recent learning…")).toBeNull());
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(screen.getByTestId("learning-celebration").textContent).not.toContain("+0");
    fetch.mockResolvedValueOnce(response({ ok: true, enabled: true, summary: { ...s, pendingAchievements: [] } }));
    fireEvent.click(screen.getByRole("button", { name: "Continue learning" }));
    await waitFor(() => expect(screen.queryByTestId("learning-celebration")).toBeNull());
    expect(JSON.parse(String(fetch.mock.calls[2][1]?.body))).toEqual({ operation: "acknowledge", achievementIds: ["badge:first"] });
    expect(screen.getByTestId("learning-total-xp").textContent).toBe("2,090");
  });

  it("uses a small notice for XP alone and dismissing it doesn't write", async () => {
    const fetch = served(summary(), { xpAwarded: 20 }); vi.stubGlobal("fetch", fetch);
    render(<LearningRewards locale="en" />);
    await waitFor(() => screen.getByTestId("learning-xp-toast"));
    expect(screen.getByTestId("learning-xp-toast").textContent).toContain("+20 Learning XP");
    expect(screen.queryByTestId("learning-celebration")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Got it" }));
    expect(screen.queryByTestId("learning-xp-toast")).toBeNull();
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it("keeps the pending achievement visible if acknowledgement fails", async () => {
    const pending = [{ id: "badge:first", kind: "badge" as const, title: "First Step", earnedAt: AT }];
    const fetch = served(summary({ pendingAchievements: pending })); vi.stubGlobal("fetch", fetch);
    render(<LearningRewards locale="en" />);
    await waitFor(() => screen.getByTestId("learning-celebration"));
    await waitFor(() => expect(screen.queryByText("Checking your recent learning…")).toBeNull());
    fetch.mockResolvedValueOnce(response({}, false));
    fireEvent.click(screen.getByRole("button", { name: "Continue learning" }));
    await waitFor(() => expect(screen.getByRole("alert").textContent).toContain("achievement view couldn't be saved"));
    expect(screen.getByTestId("learning-celebration")).toBeTruthy();
    expect(screen.getByTestId("learning-total-xp").textContent).toBe("2,090");
  });

  it("retains last confirmed totals when reward reconciliation fails and allows a retry", async () => {
    const fetch = served(); fetch.mockResolvedValueOnce(response({ ok: true, enabled: true, summary: summary() })).mockResolvedValueOnce(response({}, false));
    vi.stubGlobal("fetch", fetch); render(<LearningRewards locale="en" />);
    await waitFor(() => expect(screen.getByRole("alert").textContent).toContain("last confirmed totals"));
    expect(screen.getByTestId("learning-total-xp").textContent).toBe("2,090");
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(4));
    await waitFor(() => expect(screen.queryByRole("alert")).toBeNull());
  });

  it("doesn't turn an unavailable read into zero XP or an endless spinner", async () => {
    const fetch = vi.fn(async () => response({}, false)); vi.stubGlobal("fetch", fetch);
    render(<LearningRewards locale="en" />);
    await waitFor(() => screen.getByTestId("learning-rewards-error"));
    expect(screen.getByRole("alert").textContent).toContain("couldn't be loaded");
    expect(screen.queryByTestId("learning-total-xp")).toBeNull();
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("ends a stalled request with a recoverable error", async () => {
    vi.useFakeTimers();
    vi.stubGlobal("fetch", vi.fn((_url: unknown, options?: RequestInit) => new Promise((_resolve, reject) => options?.signal?.addEventListener("abort", () => reject(Error("aborted"))))));
    render(<LearningRewards locale="en" />);
    await act(async () => { await vi.advanceTimersByTimeAsync(16_000); });
    expect(screen.getByRole("alert").textContent).toContain("couldn't be loaded");
    expect(screen.getByRole("button", { name: "Try again" })).toBeTruthy();
    expect(screen.queryByText("Checking your recent learning…")).toBeNull();
  });

  it("doesn't make an unearned badge featureable from an old client selection", async () => {
    const s = summary();
    let resolveSync: ((value: ReturnType<typeof response>) => void) | undefined;
    const fetch = served(s).mockResolvedValueOnce(response({ ok: true, enabled: true, summary: s })).mockImplementationOnce(() => new Promise(resolve => { resolveSync = resolve; }));
    vi.stubGlobal("fetch", fetch);
    render(<LearningRewards locale="en" />);
    await waitFor(() => screen.getByRole("button", { name: "First Step · Earned" }));
    fireEvent.click(screen.getByRole("button", { name: "First Step · Earned" }));
    expect((screen.getByRole("button", { name: "Feature on my profile" }) as HTMLButtonElement).disabled).toBe(true);
    await act(async () => resolveSync?.(response({ ok: true, enabled: true, summary: { ...s, badges: s.badges.map(b => ({ ...b, earnedAt: null })) }, xpAwarded: 0, newAchievements: [] })));
    expect(screen.queryByRole("button", { name: "Feature on my profile" })).toBeNull();
    expect(screen.getByTestId("learning-badge-detail").textContent).toContain("In progress");
  });

  it("clears account values before reselect and ignores an old in-flight response", async () => {
    let resolveOld: ((value: ReturnType<typeof response>) => void) | undefined;
    const fetch = served();
    fetch.mockImplementationOnce(() => new Promise(resolve => { resolveOld = resolve; }));
    vi.stubGlobal("fetch", fetch);
    const view = render(<LearningRewards locale="en" refreshKey={0} />);
    view.rerender(<LearningRewards locale="en" refreshKey={1} />);
    await waitFor(() => screen.getByTestId("learning-total-xp"));
    resolveOld?.(response({ ok: true, enabled: true, summary: summary({ totalXp: 9999 }) }));
    await waitFor(() => expect(screen.getByTestId("learning-total-xp").textContent).toBe("2,090"));
    expect(fetch).toHaveBeenCalledTimes(3);
  });

  it("uses the existing Me locale without adding a language control", async () => {
    vi.stubGlobal("fetch", served()); render(<LearningRewards locale="ko" />);
    await waitFor(() => screen.getByText("누적 Learning XP"));
    expect(screen.getByText("레벨 10까지 10 XP")).toBeTruthy();
    expect(screen.getByRole("button", { name: "첫걸음 · 획득" })).toBeTruthy();
    expect(screen.queryByRole("combobox")).toBeNull();
  });
});
