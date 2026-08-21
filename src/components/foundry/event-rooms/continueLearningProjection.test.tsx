/** @vitest-environment jsdom */
import { describe, it, expect, vi, afterEach } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { render, screen, cleanup } from "@testing-library/react";
import FoundryRequiredLearning from "./FoundryRequiredLearning";

/**
 * R4-R5C3A2 — the learner-visible half of the Continue projection.
 *
 * The SQL truth is proven against real PostgreSQL in
 * `listMyAssignmentsInProgress.execution.test.ts`. This file covers what the learner actually
 * sees, and — just as importantly — what the copy must NOT claim.
 */

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

const A = (over: Record<string, unknown> = {}) => ({
  assignmentId: "4dc5f309-1111-4222-8333-444444444444",
  eventId: "ev-1",
  status: "assigned",
  title: "Handling an angry customer",
  assignedAt: "2026-08-01T00:00:00Z",
  completedAt: null,
  roomUrl: "https://x/f/tok",
  participationMode: "assigned_overlay",
  ...over,
});
const stub = (assignments: unknown[]) =>
  vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ ok: true, assignments }), { status: 200 })));

describe("T13 — the label follows the projected status", () => {
  it("assigned → Start learning", async () => {
    stub([A()]);
    render(<FoundryRequiredLearning locale="en" />);
    const cta = await screen.findByText("Start learning");
    expect(cta.getAttribute("data-status")).toBe("assigned");
  });

  it("in_progress → Continue learning, on the SAME room URL", async () => {
    stub([A({ status: "in_progress" })]);
    render(<FoundryRequiredLearning locale="en" />);
    const cta = await screen.findByText("Continue learning");
    expect(cta.getAttribute("data-status")).toBe("in_progress");
    // No participant id, user id, resume token or progress id is added to the link.
    expect(cta.getAttribute("href")).toBe("https://x/f/tok?return=%2Fen%2Fapp%3Ftab%3Dfoundry");
    expect(cta.getAttribute("href")).not.toMatch(/participant|user|resume|progress/i);
  });

  it("in_progress stays in REQUIRED, never in Completed", async () => {
    stub([A({ status: "in_progress" })]);
    render(<FoundryRequiredLearning locale="en" />);
    await screen.findByText("Continue learning");
    expect(screen.getByText("Required learning")).toBeTruthy();
    expect(screen.queryByTestId("completed-disclosure")).toBeNull();
    expect(screen.queryByTestId("required-empty")).toBeNull();
  });

  it("completed keeps its existing behaviour", async () => {
    stub([A({ status: "completed", completedAt: "2026-08-10T00:00:00Z" })]);
    render(<FoundryRequiredLearning locale="en" />);
    expect(await screen.findByTestId("completed-disclosure")).toBeTruthy();
    expect(screen.queryByText("Continue learning")).toBeNull();
    expect(screen.getByTestId("required-empty")).toBeTruthy(); // nothing required remains
  });

  it("KO reuses the product's established pair, not a new phrasing", () => {
    const src = readFileSync(join(process.cwd(), "src/components/foundry/event-rooms/FoundryRequiredLearning.tsx"), "utf8");
    expect(src).toContain('continueCta: "Continue learning"');
    expect(src).toContain('continueCta: "학습 계속하기"');
    // The same pair TodayHome already ships — one idea, one phrasing.
    const today = readFileSync(join(process.cwd(), "src/components/app-shell/TodayHome.tsx"), "utf8");
    expect(today).toContain('continueCta: "Continue learning"');
    expect(today).toContain('continueCta: "학습 계속하기"');
  });
});

describe("T14 — the copy promises only what this slice proves", () => {
  it("no resume / saved / cross-device claim is introduced anywhere in the card", () => {
    /*
      COMMENTS STRIPPED FIRST. The card's own comment ENUMERATES the phrases it refuses to use
      ("Resume", "Your progress is saved"), so a whole-file scan would flag the very note that
      documents the restraint — testing the prose instead of the copy.
    */
    const src = readFileSync(join(process.cwd(), "src/components/foundry/event-rooms/FoundryRequiredLearning.tsx"), "utf8")
      .replace(/\{\/\*[\s\S]*?\*\/\}/g, "")
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/^\s*\/\/.*$/gm, "");
    const strings = [...src.matchAll(/"((?:[^"\\\n]|\\.)*)"/g)].map((m) => m[1] ?? "");
    const forbidden =
      /resume|your progress is saved|continue where you left off|your answers are saved|이어서 계속|저장되었습니다|진행 상황이 저장/i;
    expect(strings.filter((v) => forbidden.test(v))).toEqual([]);
  });

  it("`in_progress` means started — the type says so and nothing more", () => {
    const svc = readFileSync(join(process.cwd(), "src/lib/bty/foundry/events/foundryLearnerAssignmentService.ts"), "utf8");
    expect(svc).toContain('export type LearnerAssignmentStatus = "assigned" | "in_progress" | "completed";');
    // Derived, never persisted.
    expect(svc).toMatch(/DERIVED at read time/);
  });
});

describe("service — the third value is admitted, not dropped", () => {
  it("the allow-list filter accepts in_progress", () => {
    const svc = readFileSync(join(process.cwd(), "src/lib/bty/foundry/events/foundryLearnerAssignmentService.ts"), "utf8");
    expect(svc).toContain('r.status === "assigned" || r.status === "in_progress" || r.status === "completed"');
  });

  it("T12 — Today still counts an in_progress assignment as outstanding work", () => {
    // Today reads the SAME RPC. Before this slice its filter was `=== "assigned"`, so the third
    // value would have silently removed the item from Today — and with it R4-R5C1's focus target.
    const today = readFileSync(join(process.cwd(), "src/lib/bty/daily/todayReminders.server.ts"), "utf8");
    expect(today).toContain('r.status === "assigned" || r.status === "in_progress"');
    // R4-R5C1's focused deep link is untouched.
    expect(today).toContain("app?tab=foundry&assignment=${encodeURIComponent(r.assignment_id)}");
  });
});
