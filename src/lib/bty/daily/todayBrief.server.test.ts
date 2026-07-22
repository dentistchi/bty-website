import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Slice 3.1B-3J — assistive AI brief boundaries: consent gating, prev-BTY-day only, ≤3 reflections,
 * sensitive-text pre-gate, output validation, deterministic fallback, and TEXT-FREE logging. The raw
 * Reflection is never logged. listUserFoundryHistory + the LLM client are mocked; userDayKey is real.
 */

const mockHistory = vi.fn();
let llmAvailable = true;
const createSpy = vi.fn();

vi.mock("@/lib/bty/foundry/events/foundryHistoryService", () => ({
  listUserFoundryHistory: (...a: unknown[]) => mockHistory(...a),
}));
vi.mock("@/lib/bty/llm/client", () => ({
  getLlmClient: () => ({ chat: { completions: { create: (...a: unknown[]) => createSpy(...a) } } }),
  getLlmModel: () => "test-model",
  isLlmAvailable: () => llmAvailable,
}));

import { composeTodayBrief } from "./todayBrief.server";

const admin = {} as never;
const now = new Date("2026-07-22T12:00:00Z"); // yesterday (UTC) = 2026-07-21

function item(entryId: string, completedAt: string, responseText: string) {
  return { entryId, eventId: "e", eventTitle: "T", contentType: "youtube" as const, sharedUnderstanding: null, completedAt, responseText, responseExcerpt: "", aiReflection: null, aiReflectionLine: null, completionState: null };
}
function llmReturns(obs: string, sug: string) {
  createSpy.mockResolvedValue({ choices: [{ message: { content: JSON.stringify({ yesterdayObservation: obs, todaySuggestion: sug }) } }] });
}

beforeEach(() => {
  mockHistory.mockReset();
  createSpy.mockReset();
  llmAvailable = true;
});

describe("composeTodayBrief", () => {
  it("consent OFF → returns null and NEVER calls the LLM", async () => {
    const r = await composeTodayBrief(admin, "u1", now, "UTC", "en", false);
    expect(r).toBeNull();
    expect(createSpy).not.toHaveBeenCalled();
  });

  it("consent ON but no prior-day reflection → null (omit AI section)", async () => {
    mockHistory.mockResolvedValue([item("x", "2026-07-19T10:00:00Z", "old")]);
    expect(await composeTodayBrief(admin, "u1", now, "UTC", "en", true)).toBeNull();
    expect(createSpy).not.toHaveBeenCalled();
  });

  it("uses ONLY yesterday's reflections, at most 3, most recent first", async () => {
    llmReturns("A calm observation.", "A practical suggestion.");
    mockHistory.mockResolvedValue([
      item("y1", "2026-07-21T22:00:00Z", "yesterday one"),
      item("y2", "2026-07-21T20:00:00Z", "yesterday two"),
      item("y3", "2026-07-21T18:00:00Z", "yesterday three"),
      item("y4", "2026-07-21T16:00:00Z", "yesterday four"),
      item("today", "2026-07-22T09:00:00Z", "today not eligible"),
    ]);
    await composeTodayBrief(admin, "u1", now, "UTC", "en", true);
    const userMsg = createSpy.mock.calls[0][0].messages.find((m: { role: string }) => m.role === "user").content as string;
    expect(userMsg).toContain("yesterday one");
    expect(userMsg).not.toContain("yesterday four"); // capped at 3
    expect(userMsg).not.toContain("today not eligible"); // wrong day
  });

  it("sensitive text is NOT sent to the LLM; all-sensitive → deterministic fallback", async () => {
    mockHistory.mockResolvedValue([item("y", "2026-07-21T20:00:00Z", "email me at jane@example.com")]);
    const r = await composeTodayBrief(admin, "u1", now, "UTC", "en", true);
    expect(createSpy).not.toHaveBeenCalled();
    expect(r?.source).toBe("fallback");
  });

  it("LLM unavailable → deterministic fallback", async () => {
    llmAvailable = false;
    mockHistory.mockResolvedValue([item("y", "2026-07-21T20:00:00Z", "a safe reflection")]);
    const r = await composeTodayBrief(admin, "u1", now, "UTC", "en", true);
    expect(r?.source).toBe("fallback");
  });

  it("diagnostic/personality output is rejected → fallback", async () => {
    llmReturns("You are antisocial.", "You avoid conflict.");
    mockHistory.mockResolvedValue([item("y", "2026-07-21T20:00:00Z", "a safe reflection")]);
    const r = await composeTodayBrief(admin, "u1", now, "UTC", "en", true);
    expect(r?.source).toBe("fallback");
  });

  it("valid output → source=ai with one observation + one suggestion", async () => {
    llmReturns("Yesterday, keeping the team aligned felt important.", "Ask one person to restate the goal.");
    mockHistory.mockResolvedValue([item("y", "2026-07-21T20:00:00Z", "a safe reflection")]);
    const r = await composeTodayBrief(admin, "u1", now, "UTC", "en", true);
    expect(r?.source).toBe("ai");
    expect(r?.yesterdayObservation).toContain("aligned");
  });

  it("logging is TEXT-FREE — the raw reflection is never logged", async () => {
    const spy = vi.spyOn(console, "info").mockImplementation(() => {});
    llmReturns("A calm observation.", "A practical suggestion.");
    mockHistory.mockResolvedValue([item("y", "2026-07-21T20:00:00Z", "SECRET REFLECTION BODY")]);
    await composeTodayBrief(admin, "u1", now, "UTC", "en", true);
    const logged = spy.mock.calls.flat().join(" ");
    expect(logged).not.toContain("SECRET REFLECTION BODY");
    spy.mockRestore();
  });
});
