/** @vitest-environment jsdom */
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, waitFor, cleanup, fireEvent } from "@testing-library/react";
import { parseTodayDeepLink } from "./todayDeepLink";
import TodayHome from "./TodayHome";
import FoundryRequiredLearning from "@/components/foundry/event-rooms/FoundryRequiredLearning";
import FoundryMyLearning from "@/components/foundry/event-rooms/FoundryMyLearning";

/**
 * R4-R5C1 — TODAY INTENT FIDELITY.
 *
 * Today names a specific thing. Tapping it was rebooting the shell and handing over a container:
 * `Required learning · Handling an angry customer` opened the Learn ROOT, where the learner had to
 * find the same card again; `Apply this week · <their own sentence>` asked for `tab=me`, which the
 * deep-link contract has never owned, and dropped `entry` so the record was never focused.
 *
 * These tests hold the line at both ends — the URL the server produces, and what the surface does
 * with it — and they deliberately DO NOT claim precision the product cannot express: an Arena
 * action or a due practice still resolves to a container, because no focused-practice contract
 * exists to resolve to.
 */

const ASSIGNMENT = "4dc5f309-1111-4222-8333-444444444444";
const OTHER_ASSIGNMENT = "9ab0c1d2-5555-4666-8777-888888888888";
const ENTRY = "11112222-3333-4444-8555-666677778888";
const OTHER_ENTRY = "aaaabbbb-cccc-4ddd-8eee-ffff00001111";
const FOLLOWUP = "5f5f5f5f-7777-4888-8999-aaaaaaaaaaaa";
const CONTRACT = "0c2ec756-2b35-471a-9b2a-145c71b6177d";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

// ── T1 / T5 / T12 — the URL contract, at the sanitizer boundary ─────────────────────────────────
describe("T1/T5/T12 — what a Today link means", () => {
  it("T1 — a Required Learning link names its real assignment id", () => {
    expect(parseTodayDeepLink(`/en/app?tab=foundry&assignment=${ASSIGNMENT}`)).toEqual({
      kind: "learn-assignment",
      assignmentId: ASSIGNMENT,
    });
  });

  it("T5 — My Learning resolves to LEARN, the canonical owner, and carries the focused record", () => {
    // Measured: every durable My-Learning link in the repository uses tab=foundry, and the shell's
    // view=my-learning branch resolves to Learn. `tab=me` was the single outlier, now corrected.
    expect(parseTodayDeepLink(`/en/app?tab=foundry&view=my-learning&entry=${ENTRY}`)).toEqual({
      kind: "learn-my-learning",
      entryId: ENTRY,
    });
    // Even if a legacy tab=me link is still in flight somewhere, it lands on the same surface —
    // the view, not the tab, is what has always decided this destination.
    expect(parseTodayDeepLink(`/en/app?tab=me&view=my-learning&entry=${ENTRY}`)).toEqual({
      kind: "learn-my-learning",
      entryId: ENTRY,
    });
  });

  it("T12 — Arena actions and due practices stay HONEST containers", () => {
    // No `practice=<id>` contract exists in the shell, so nothing here may pretend otherwise.
    expect(parseTodayDeepLink("/en/app?tab=arena")).toEqual({ kind: "tab", tab: "practice" });
    expect(parseTodayDeepLink("/ko/app?tab=arena")).toEqual({ kind: "tab", tab: "practice" });
    expect(parseTodayDeepLink("/en/app?tab=foundry")).toEqual({ kind: "tab", tab: "learn" });
  });

  it("T8/T9 — the already-exact links are unchanged", () => {
    expect(parseTodayDeepLink(`/en/app?tab=foundry&followup=${FOLLOWUP}`)).toEqual({
      kind: "learn-followup",
      followupId: FOLLOWUP,
    });
    expect(parseTodayDeepLink(`/en/app?tab=practice&fieldAction=${CONTRACT}`)).toEqual({
      kind: "practice-field-action",
      contractId: CONTRACT,
    });
    expect(parseTodayDeepLink(`/en/app?tab=today&fieldActionContract=${CONTRACT}`)).toEqual({
      kind: "today-field-action-contract",
      contractId: CONTRACT,
    });
  });

  it("T4/T7 — malformed, foreign or stale shapes parse to null so the anchor just navigates", () => {
    for (const bad of [
      "https://evil.com/en/app?tab=foundry",
      "//evil.com/en/app",
      "\\\\evil.com",
      "/en/bty-arena",
      "/en/appfoo?tab=foundry",
      "/fr/app?tab=foundry",
      "",
      "not-a-url",
    ]) {
      expect(parseTodayDeepLink(bad), bad).toBeNull();
    }
    // A short/junk id is not treated as a focus — the destination is still right, just unfocused.
    expect(parseTodayDeepLink("/en/app?tab=foundry&assignment=abc")).toEqual({ kind: "tab", tab: "learn" });
    expect(parseTodayDeepLink("/en/app?tab=foundry&view=my-learning&entry=xx")).toEqual({
      kind: "learn-my-learning",
      entryId: null,
    });
  });
});

// ── T10 — the shell reboot is gone, the durable href is not ─────────────────────────────────────
describe("T10/T11 — in-shell navigation with a durable address", () => {
  const reminder = {
    stableId: `req:${ASSIGNMENT}`,
    category: "REQUIRED_LEARNING",
    title: "Handling an angry customer",
    state: "incomplete_required",
    canonicalDeepLink: `/en/app?tab=foundry&assignment=${ASSIGNMENT}`,
  };
  function stub(reminders: unknown[]) {
    const json = (b: unknown) => new Response(JSON.stringify(b), { status: 200 });
    vi.stubGlobal("fetch", vi.fn(async (url: string) => {
      const u = String(url);
      if (u.includes("/api/me/today/brief")) return json({ ok: true, reminders, hostAttention: [] });
      if (u.includes("/api/me/daily-trace")) return json({ dailyTrace: [] });
      return json({});
    }));
  }

  it("T11 — the card keeps a real href, so the address stays copyable and reload-able", async () => {
    stub([reminder]);
    render(<TodayHome locale="en" onOpenItem={() => true} />);
    const item = await screen.findByTestId("today-item");
    expect(item.tagName).toBe("A");
    expect(item.getAttribute("href")).toBe(`/en/app?tab=foundry&assignment=${ASSIGNMENT}`);
  });

  it("T10 — a plain tap is handled in-shell and the document navigation is prevented", async () => {
    stub([reminder]);
    const opened: string[] = [];
    render(<TodayHome locale="en" onOpenItem={(href) => { opened.push(href); return true; }} />);
    const item = await screen.findByTestId("today-item");
    const ev = new MouseEvent("click", { bubbles: true, cancelable: true, button: 0 });
    item.dispatchEvent(ev);
    expect(opened).toEqual([`/en/app?tab=foundry&assignment=${ASSIGNMENT}`]);
    expect(ev.defaultPrevented, "the shell handled it, so the browser must not also navigate").toBe(true);
  });

  it("T10 — when the shell CANNOT resolve the link, the anchor navigates as before", async () => {
    stub([reminder]);
    render(<TodayHome locale="en" onOpenItem={() => false} />);
    const item = await screen.findByTestId("today-item");
    const ev = new MouseEvent("click", { bubbles: true, cancelable: true, button: 0 });
    item.dispatchEvent(ev);
    expect(ev.defaultPrevented, "an unresolvable link must keep its native behaviour").toBe(false);
  });

  it("a modified click (new tab / long-press intent) is never intercepted", async () => {
    stub([reminder]);
    const opened: string[] = [];
    render(<TodayHome locale="en" onOpenItem={(h) => { opened.push(h); return true; }} />);
    const item = await screen.findByTestId("today-item");
    for (const mod of [{ metaKey: true }, { ctrlKey: true }, { shiftKey: true }, { altKey: true }]) {
      const ev = new MouseEvent("click", { bubbles: true, cancelable: true, button: 0, ...mod });
      item.dispatchEvent(ev);
      expect(ev.defaultPrevented, JSON.stringify(mod)).toBe(false);
    }
    expect(opened).toEqual([]);
  });
});

// ── T2 / T3 / T4 — Required Learning focus ──────────────────────────────────────────────────────
describe("T2/T3/T4 — Learn opens with the named assignment focused", () => {
  function stubAssignments(rows: unknown[]) {
    vi.stubGlobal("fetch", vi.fn(async () =>
      new Response(JSON.stringify({ ok: true, assignments: rows }), { status: 200 })));
  }
  const row = (id: string, title: string) => ({
    assignmentId: id, eventId: "ev-" + id.slice(0, 4), status: "assigned", title,
    assignedAt: "2026-08-01T00:00:00Z", completedAt: null, roomUrl: "https://x/f/tok",
    participationMode: "assigned_overlay",
  });

  it("T2/T3 — the matching card is outlined and scrolled into view; the others are not", async () => {
    const scrolled: string[] = [];
    // jsdom has no layout, so scrollIntoView is stubbed to record WHICH element was asked for.
    Element.prototype.scrollIntoView = function (this: Element) {
      scrolled.push(this.getAttribute("data-assignment-id") ?? "?");
    } as unknown as typeof Element.prototype.scrollIntoView;
    stubAssignments([row(OTHER_ASSIGNMENT, "Something else"), row(ASSIGNMENT, "Handling an angry customer")]);

    render(<FoundryRequiredLearning locale="en" focusAssignmentId={ASSIGNMENT} />);

    const cards = await screen.findAllByTestId("required-card");
    const focused = cards.filter((c) => c.getAttribute("data-focused") === "1");
    expect(focused).toHaveLength(1);
    expect(focused[0]!.getAttribute("data-assignment-id")).toBe(ASSIGNMENT);
    expect(focused[0]!.getAttribute("class")).toContain("ring-1");
    await waitFor(() => expect(scrolled).toContain(ASSIGNMENT));
    // and the card still offers its own control — nothing auto-starts.
    expect(screen.getAllByText("Start learning").length).toBe(2);
  });

  it("T4 — a stale/unknown assignment focuses nothing and Learn stays usable", async () => {
    stubAssignments([row(OTHER_ASSIGNMENT, "Something else")]);
    render(<FoundryRequiredLearning locale="en" focusAssignmentId={ASSIGNMENT} />);
    const cards = await screen.findAllByTestId("required-card");
    expect(cards.filter((c) => c.getAttribute("data-focused") === "1")).toHaveLength(0);
    expect(screen.getByText("Something else")).toBeTruthy();
    expect(screen.getByText("Start learning")).toBeTruthy();
  });

  it("no focus id → no card is outlined (the ordinary Learn surface)", async () => {
    stubAssignments([row(ASSIGNMENT, "Handling an angry customer")]);
    render(<FoundryRequiredLearning locale="en" />);
    const cards = await screen.findAllByTestId("required-card");
    expect(cards.filter((c) => c.getAttribute("data-focused") === "1")).toHaveLength(0);
  });
});

// ── T6 / T7 — Apply this week lands on the record ───────────────────────────────────────────────
describe("T6/T7 — My Learning opens on the exact record", () => {
  function stubHistory(items: unknown[]) {
    const json = (b: unknown) => new Response(JSON.stringify(b), { status: 200 });
    vi.stubGlobal("fetch", vi.fn(async (url: string) => {
      const u = String(url);
      // The history endpoint answers under `history` (measured), not `items`.
      if (u.includes("/api/bty/foundry/history")) return json({ ok: true, history: items });
      return json({ ok: true, items: [] });
    }));
  }
  const entry = (id: string, title: string) => ({
    entryId: id, eventId: "ev-1", eventTitle: title, contentType: "document",
    completedAt: "2026-08-10T00:00:00Z", sharedUnderstanding: null, decisionResponse: "I will ask one question.",
  });

  it("T6 — the named record is outlined and scrolled to; an unrelated record is not", async () => {
    const scrolled: string[] = [];
    Element.prototype.scrollIntoView = function (this: Element) {
      scrolled.push(this.getAttribute("data-entry-id") ?? "?");
    } as unknown as typeof Element.prototype.scrollIntoView;
    stubHistory([entry(OTHER_ENTRY, "Another training"), entry(ENTRY, "Listening under pressure")]);

    render(<FoundryMyLearning locale="en" onBack={() => {}} focusEntryId={ENTRY} />);

    const rows = await screen.findAllByTestId("my-learning-item");
    const focused = rows.filter((r) => r.getAttribute("data-focused") === "1");
    expect(focused).toHaveLength(1);
    expect(focused[0]!.getAttribute("data-entry-id")).toBe(ENTRY);
    expect(focused[0]!.getAttribute("class")).toContain("ring-1");
    await waitFor(() => expect(scrolled).toContain(ENTRY));
  });

  it("T7 — a stale entry focuses nothing and the list still renders", async () => {
    stubHistory([entry(OTHER_ENTRY, "Another training")]);
    render(<FoundryMyLearning locale="en" onBack={() => {}} focusEntryId={ENTRY} />);
    const rows = await screen.findAllByTestId("my-learning-item");
    expect(rows.filter((r) => r.getAttribute("data-focused") === "1")).toHaveLength(0);
    expect(screen.getByText("Another training")).toBeTruthy();
  });
});
