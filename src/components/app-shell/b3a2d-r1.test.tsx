/** @vitest-environment jsdom */
import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen, cleanup, fireEvent, within } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import BtyDailyAppShell from "./BtyDailyAppShell";
import MeOrbDoor from "./MeOrbDoor";
import { ORB_HOLD_MS } from "@/components/orb/orbEntryContract";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

// ── Gesture resolution — isolated MeOrbDoor via the accessible keyboard mirror (the on-device
//    pointer gesture is owned by OrbLiving, whose canvas path is unavailable in jsdom). ──────────
describe("MeOrbDoor — short tap vs long hold (B3A.2D-R1)", () => {
  beforeEach(() => vi.useFakeTimers());

  function setup() {
    const onEnter = vi.fn();
    const onOpenWeek = vi.fn();
    render(<MeOrbDoor locale="en" onEnter={onEnter} onOpenWeek={onOpenWeek} />);
    const control = screen.getByTestId("me-orb-door-control");
    return { onEnter, onOpenWeek, control };
  }

  it("a quick tap opens This Week exactly once and never enters", () => {
    const { onEnter, onOpenWeek, control } = setup();
    fireEvent.keyDown(control, { key: "Enter" });
    fireEvent.keyUp(control, { key: "Enter" }); // released well before the threshold
    vi.advanceTimersByTime(ORB_HOLD_MS + 100);
    expect(onOpenWeek).toHaveBeenCalledTimes(1);
    expect(onEnter).not.toHaveBeenCalled();
  });

  it("early release (before threshold) resolves as a tap, not an entry", () => {
    const { onEnter, onOpenWeek, control } = setup();
    fireEvent.keyDown(control, { key: "Enter" });
    vi.advanceTimersByTime(ORB_HOLD_MS - 200); // held, but not long enough
    fireEvent.keyUp(control, { key: "Enter" });
    vi.advanceTimersByTime(500);
    expect(onEnter).not.toHaveBeenCalled();
    expect(onOpenWeek).toHaveBeenCalledTimes(1);
  });

  it("a completed hold enters exactly once and suppresses the trailing tap", () => {
    const { onEnter, onOpenWeek, control } = setup();
    fireEvent.keyDown(control, { key: "Enter" });
    vi.advanceTimersByTime(ORB_HOLD_MS + 10); // crosses the threshold → enter
    expect(onEnter).toHaveBeenCalledTimes(1);
    fireEvent.keyUp(control, { key: "Enter" }); // release AFTER completion
    expect(onOpenWeek).not.toHaveBeenCalled(); // tap suppressed
    expect(onEnter).toHaveBeenCalledTimes(1); // still once
  });

  it("blur cancels an incomplete hold (no enter, no tap)", () => {
    const { onEnter, onOpenWeek, control } = setup();
    fireEvent.keyDown(control, { key: "Enter" });
    vi.advanceTimersByTime(ORB_HOLD_MS - 500);
    fireEvent.blur(control);
    vi.advanceTimersByTime(ORB_HOLD_MS);
    expect(onEnter).not.toHaveBeenCalled();
    expect(onOpenWeek).not.toHaveBeenCalled();
  });
});

// ── Shell semantics — return labels, root reselect, weekly refresh, short-tap detail. ──────────
function stub() {
  const calls: string[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => {
      const u = String(url);
      calls.push(u);
      const body = u.includes("/api/auth/session")
        ? { ok: true, user: { email: "ywamer2022@gmail.com" } }
        : u.includes("/api/me/today/weekly-activity")
          ? { ok: true, summary: { weeklyPoints: 12, forgeStage: 1, activeDays: 3, trainingsCompleted: 1 }, window: { startIso: "", endIso: "" }, attendance: [] }
          : u.includes("/api/me/daily-trace")
            ? { dailyTrace: [] }
            : u.includes("/api/me/today/brief")
              ? { ok: true, reminders: [] }
              : u.includes("/api/foundry/my-learning") || u.includes("/api/bty/foundry")
                ? { ok: true, items: [], reviewedPlans: [] }
                : {};
      return new Response(JSON.stringify(body), { status: 200 });
    }),
  );
  return calls;
}

async function gotoMe() {
  render(<BtyDailyAppShell locale="en" />);
  const nav = await screen.findByRole("navigation", { name: /App navigation/i });
  const tapMe = () => fireEvent.click(within(nav).getByText("Me"));
  tapMe();
  return { nav, tapMe };
}

describe("Me → What I learned return semantics (B3A.2D-R1)", () => {
  it("shows back label 'Me' and never 'Required learning'", async () => {
    stub();
    await gotoMe();
    fireEvent.click(await screen.findByTestId("me-row-learned"));
    const back = await screen.findByTestId("my-learning-back");
    expect(back.textContent).toContain("Me");
    expect(back.textContent).not.toMatch(/Required learning/i);
  });

  it("back returns to the Me root", async () => {
    stub();
    const { } = await gotoMe();
    fireEvent.click(await screen.findByTestId("me-row-learned"));
    fireEvent.click(await screen.findByTestId("my-learning-back"));
    expect(await screen.findByTestId("me-home")).toBeTruthy();
  });
});

describe("Bottom Me tab = root reselect (B3A.2D-R1)", () => {
  it("clears a nested Account view and returns to the Me root", async () => {
    stub();
    const { tapMe } = await gotoMe();
    fireEvent.click(await screen.findByTestId("me-account-row"));
    expect(await screen.findByTestId("me-account")).toBeTruthy();
    tapMe();
    expect(await screen.findByTestId("me-home")).toBeTruthy();
    expect(screen.queryByTestId("me-account")).toBeNull();
  });

  it("clears a nested What-I-learned view and returns to the Me root", async () => {
    stub();
    const { tapMe } = await gotoMe();
    fireEvent.click(await screen.findByTestId("me-row-learned"));
    expect(await screen.findByTestId("foundry-my-learning")).toBeTruthy();
    tapMe();
    expect(await screen.findByTestId("me-home")).toBeTruthy();
    expect(screen.queryByTestId("foundry-my-learning")).toBeNull();
  });

  it("re-fetches the weekly projection on Me reselect", async () => {
    const calls = stub();
    const { tapMe } = await gotoMe();
    await screen.findByTestId("me-home");
    const before = calls.filter((c) => c.includes("/api/me/today/weekly-activity")).length;
    tapMe();
    await screen.findByTestId("me-home");
    const after = calls.filter((c) => c.includes("/api/me/today/weekly-activity")).length;
    expect(after).toBeGreaterThan(before);
  });
});

describe("Me Orb short tap → This Week detail (B3A.2D-R1)", () => {
  it("opens the This Week detail and returns to root via back", async () => {
    stub();
    await gotoMe();
    const control = await screen.findByTestId("me-orb-door-control");
    fireEvent.keyDown(control, { key: "Enter" });
    fireEvent.keyUp(control, { key: "Enter" }); // quick tap (real timers → resolves as tap)
    expect(await screen.findByTestId("me-this-week-detail")).toBeTruthy();
    fireEvent.click(await screen.findByTestId("me-this-week-back"));
    expect(await screen.findByTestId("me-home")).toBeTruthy();
  });
});

// ── Source contracts — single Orb runtime, canonical wiring, origin-explicit Learn label. ──────
describe("Single canonical Orb runtime + wiring (B3A.2D-R1)", () => {
  const read = (rel: string) => readFileSync(join(__dirname, rel), "utf8");

  it("MeOrbDoor renders the canonical OrbLiving with the shared threshold — no forked engine", () => {
    const src = read("./MeOrbDoor.tsx");
    expect(src).toMatch(/import OrbLiving from "@\/components\/orb\/OrbLiving"/);
    expect(src).toMatch(/ORB_HOLD_MS/);
    expect(src).toMatch(/holdMs={ORB_HOLD_MS}/);
    expect(src).toMatch(/onCommit={enter}/);
    expect(src).toMatch(/onTap={onOpenWeek}/);
    // No second canvas/animation runtime is defined here.
    expect(src).not.toMatch(/getContext\(/);
    expect(src).not.toMatch(/requestAnimationFrame/);
  });

  it("the shell passes Me-origin backLabel and keeps the Learn-origin default", () => {
    const src = read("./BtyDailyAppShell.tsx");
    expect(src).toMatch(/backLabel={locale === "ko" \? "나" : "Me"}/);
    // Learn-side FoundryMyLearning keeps its own default parent (no backLabel override).
    expect(src).toMatch(/onBack={\(\) => setFoundryView\("rooms"\)}/);
  });
});
