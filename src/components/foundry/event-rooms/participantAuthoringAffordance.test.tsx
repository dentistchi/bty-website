/** @vitest-environment jsdom */
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";

afterEach(cleanup);
import fs from "node:fs";
import path from "node:path";
import { LearnDoors } from "./LearnDoors";

/**
 * ★ ZERO-EXPLANATION AUTHORITY UX (section E).
 *
 * THE FAILURE THIS CLOSES. A demonstration reached "Open an event" → the full Event form →
 * "You're not authorized to open events." Measured afterwards, that refusal was guaranteed for
 * EVERYONE: `arena_membership_requests` had 0 rows and `leadership_engine_state` had 0 rows, so
 * both gates on `POST /api/bty/events` refused every user, and `bty_events` has never held a row.
 * Worse, the door was gated on a THIRD authority — `hasHostCapability` — which neither gate
 * consulted, so the people who could SEE the form were exactly the people the form would refuse.
 *
 * The repair is that the room now uses the door's authority. These tests hold both directions: a
 * participant is never offered the affordance, and a Manager+ still is.
 *
 * ★ UI HIDING IS NOT THE SECURITY BOUNDARY. The server check is asserted separately, in
 * `src/domain/authority/collaborationParticipant.test.ts`. This file is about not showing someone
 * a form they cannot submit.
 */

const code = (p: string) =>
  fs.readFileSync(path.join(process.cwd(), p), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");

const doors = (canCreate: boolean) =>
  render(
    <LearnDoors
      locale="en"
      canCreate={canCreate}
      onOpenLearning={() => {}}
      onCreate={() => {}}
      onOpenEvent={vi.fn()}
      onOpenMyEvents={vi.fn()}
    />,
  );

describe("★ a participant is offered no authoring affordance", () => {
  it("★ 5. no Event creation entry point", () => {
    doors(false);
    expect(screen.queryByRole("button", { name: /event/i })).toBeNull();
  });

  it("no Training/Module creation entry point", () => {
    doors(false);
    expect(screen.queryByRole("button", { name: /create|new training|module/i })).toBeNull();
  });

  it("★ no dead gold CTA — the learning door is still there and still works", () => {
    doors(false);
    // A participant's Learn surface is not empty; it simply carries nothing they cannot finish.
    expect(screen.getAllByText(/learn/i).length).toBeGreaterThan(0);
    expect(screen.getAllByRole("button").length).toBeGreaterThan(0);
  });
});

describe("★ 6. a Manager+ still sees every authoring surface", () => {
  it("Event creation is offered", () => {
    doors(true);
    expect(screen.getAllByRole("button", { name: /event/i }).length).toBeGreaterThan(0);
  });

  it("Training/Module creation is offered", () => {
    doors(true);
    expect(screen.queryAllByRole("button").length).toBeGreaterThan(1);
  });
});

describe("★ the door and the room now ask the SAME question", () => {
  it("the door is gated on host capability, resolved from the manager route's own refusal", () => {
    const rooms = code("src/components/foundry/event-rooms/FoundryEventRooms.tsx");
    expect(rooms).toContain('canCreate={access === "host"}');
    expect(rooms).toContain("foundry_host_required");
  });

  it("★ the Event room asks host capability too — no third authority left", () => {
    const route = code("src/app/api/bty/events/route.ts");
    expect(route).toMatch(/await hasHostCapability\(/);
    expect(route).toContain("foundry_host_required");
  });

  it("★ the two refusals that rendered the SAME sentence are gone", () => {
    const route = code("src/app/api/bty/events/route.ts");
    expect(route).not.toContain("LEADER_TRACK_REQUIRED");
    expect(route).not.toContain("MEMBERSHIP_REQUIRED");
    expect(route).not.toContain("requireApprovedMembership");
  });

  it("★ Arena practice keeps its membership gate — only the Event route stopped borrowing it", () => {
    const arena = [
      "src/app/api/arena/run/route.ts",
      "src/app/api/arena/beginner-run/route.ts",
      "src/app/api/arena/quick/start/route.ts",
      "src/app/api/arena/session/next/route.ts",
      "src/app/api/arena/n/session/route.ts",
    ];
    for (const r of arena) expect(code(r), r).toContain("requireApprovedMembership");
  });
});
