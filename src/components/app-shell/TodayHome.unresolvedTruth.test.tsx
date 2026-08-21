/** @vitest-environment jsdom */
/**
 * Today — UNKNOWN IS NOT EMPTY (Slice R4-R5A, Repair A).
 *
 * The learner-visible defect this file locks shut: on every cold open, `reminders` was initialised
 * to `[]`, so the FIRST SYNCHRONOUS PAINT took the empty branch and asserted
 *
 *     "You're all caught up for today."   +   a CTA leading away from the pending work
 *     "Yesterday was quiet. Begin with one small step today."
 *
 * before either read had answered — and then replaced itself with the required training. Both are
 * factual claims about the learner's day, made from no data.
 *
 * WHY THESE TESTS DO NOT USE `waitFor` FOR THE CENTRAL ASSERTION. Every pre-existing Today test
 * awaits the settled state, which is exactly why none of them saw this: the false claim lives only
 * in the frames before resolution. So the reads here are held OPEN (a promise that never settles,
 * or a gate the test opens by hand) and the unresolved render is asserted directly — synchronously
 * on mount, and again after the microtask queue has drained.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import TodayHome from "./TodayHome";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

/** The exact learner-visible emptiness claims, EN + KO. None may precede the read that supports it. */
const EMPTINESS_CLAIM_EN = "You're all caught up for today.";
const EMPTINESS_CLAIM_KO = "오늘 할 일을 모두 마쳤습니다.";
const QUIET_CLAIM_EN = "Yesterday was quiet.";
const RETURNED_CLAIM_EN = "You showed up yesterday.";

const REQUIRED = {
  stableId: "req:a1",
  category: "REQUIRED_LEARNING",
  title: "Handling an angry customer",
  state: "incomplete_required",
  canonicalDeepLink: "/en/app?tab=foundry",
};

/** A fetch stub whose per-endpoint answers are promises the TEST decides when (or whether) to settle. */
function stubFetch(route: (url: string) => Promise<Response>) {
  vi.stubGlobal("fetch", vi.fn((url: string) => route(String(url))));
}

const never = () => new Promise<Response>(() => {});

/** Drain microtasks inside act() so React commits everything the settled promises produced. */
async function settle() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
  });
}

describe("G1 — Today asserts no emptiness while the brief is unresolved", () => {
  it("the FIRST SYNCHRONOUS PAINT carries no emptiness claim and no empty-state CTA", () => {
    stubFetch(never);
    render(<TodayHome locale="en" onNavigate={() => {}} />);

    // Read the DOM directly, with no awaiting of any kind — this is the frame the learner sees.
    const home = screen.getByTestId("today-home");
    expect(home.textContent).not.toContain(EMPTINESS_CLAIM_EN);
    expect(screen.queryByTestId("today-empty")).toBeNull();
    expect(screen.queryByTestId("today-empty-cta")).toBeNull();
    // The frame around the claim goes with it — a "Today" header over nothing reads as a failure.
    expect(screen.queryByTestId("today-list")).toBeNull();
  });

  it("KO parity — the Korean emptiness claim is equally absent while unresolved", () => {
    stubFetch(never);
    render(<TodayHome locale="ko" onNavigate={() => {}} />);
    expect(screen.getByTestId("today-home").textContent).not.toContain(EMPTINESS_CLAIM_KO);
    expect(screen.queryByTestId("today-empty")).toBeNull();
  });

  it("stays silent across the whole unresolved window, not just the first frame", async () => {
    stubFetch(never);
    render(<TodayHome locale="en" onNavigate={() => {}} />);
    await settle();
    expect(screen.queryByTestId("today-empty")).toBeNull();
    expect(screen.getByTestId("today-home").textContent).not.toContain(EMPTINESS_CLAIM_EN);
  });

  it("a FAILED brief is unknown, not empty — the read never answered, so nothing is claimed", async () => {
    stubFetch(async (u) => {
      if (u.includes("/api/me/today/brief")) return json({ error: "boom" }, 500);
      if (u.includes("/api/me/daily-trace")) return json({ dailyTrace: [] });
      return json({});
    });
    render(<TodayHome locale="en" onNavigate={() => {}} />);
    await settle();
    // The yesterday read DID answer, so that block is allowed; the brief did not, so this is not.
    expect(screen.queryByTestId("today-empty")).toBeNull();
    expect(screen.getByTestId("today-home").textContent).not.toContain(EMPTINESS_CLAIM_EN);
  });
});

describe("G2 — a resolved, genuinely empty day still renders the honest empty state", () => {
  it("brief resolves ok with zero reminders → the existing empty card + CTA render unchanged", async () => {
    stubFetch(async (u) => {
      if (u.includes("/api/me/today/brief")) return json({ ok: true, reminders: [], hostAttention: [] });
      if (u.includes("/api/me/daily-trace")) return json({ dailyTrace: [] });
      if (u.includes("/api/arena/practice")) return json({ practices: [] });
      if (u.includes("/api/bty/foundry/learning-path")) return json({ ok: true, programs: [] });
      return json({});
    });
    render(<TodayHome locale="en" onNavigate={() => {}} />);
    const empty = await screen.findByTestId("today-empty");
    expect(empty.textContent).toContain(EMPTINESS_CLAIM_EN);
    expect(screen.getByTestId("today-empty-cta").textContent).toContain("Find a program");
    expect(screen.getByTestId("today-list")).toBeTruthy();
  });
});

describe("G3 — a resolved, non-empty day shows the real item with no intermediate false claim", () => {
  it("required learning appears, and the emptiness claim was never rendered on the way there", async () => {
    let openBrief: (() => void) | null = null;
    const briefGate = new Promise<void>((r) => {
      openBrief = r;
    });
    stubFetch(async (u) => {
      if (u.includes("/api/me/today/brief")) {
        await briefGate;
        return json({ ok: true, reminders: [REQUIRED], hostAttention: [] });
      }
      if (u.includes("/api/me/daily-trace")) return json({ dailyTrace: [] });
      if (u.includes("/api/arena/practice")) return json({ practices: [] });
      if (u.includes("/api/bty/foundry/learning-path")) return json({ ok: true, programs: [] });
      return json({});
    });

    render(<TodayHome locale="en" onNavigate={() => {}} />);

    // While the brief is held open — the exact window the defect lived in — nothing is claimed.
    await settle();
    expect(screen.queryByTestId("today-empty")).toBeNull();
    expect(screen.getByTestId("today-home").textContent).not.toContain(EMPTINESS_CLAIM_EN);

    await act(async () => {
      openBrief!();
      await briefGate;
    });

    const item = await screen.findByTestId("today-item");
    expect(item.textContent).toContain("Handling an angry customer");
    expect(screen.queryByTestId("today-empty")).toBeNull();
  });
});

describe("G4 — no yesterday claim before the yesterday reads answer", () => {
  it("neither 'quiet' nor 'you showed up' is asserted while both yesterday sources are unresolved", async () => {
    // The brief resolves (so Today itself settles) but the daily-trace read is held open, which is
    // the source the fallback sentence depends on. `counts` answers with no counts → still unknown.
    stubFetch(async (u) => {
      if (u.includes("/api/me/today/brief")) return json({ ok: true, reminders: [REQUIRED], hostAttention: [] });
      if (u.includes("/api/me/today/yesterday-activity")) return json({});
      if (u.includes("/api/me/daily-trace")) return never();
      return json({});
    });
    render(<TodayHome locale="en" onNavigate={() => {}} />);

    await screen.findByTestId("today-item"); // Today itself has resolved…
    const home = screen.getByTestId("today-home");
    expect(home.textContent).not.toContain(QUIET_CLAIM_EN); // …and yesterday still says nothing
    expect(home.textContent).not.toContain(RETURNED_CLAIM_EN);
    expect(screen.queryByTestId("today-yesterday")).toBeNull();
    expect(screen.queryByTestId("today-yesterday-sentence")).toBeNull();
  });

  it("the first synchronous paint carries no yesterday claim either", () => {
    stubFetch(never);
    render(<TodayHome locale="en" onNavigate={() => {}} />);
    const home = screen.getByTestId("today-home");
    expect(home.textContent).not.toContain(QUIET_CLAIM_EN);
    expect(home.textContent).not.toContain(RETURNED_CLAIM_EN);
  });

  it("once the trace answers 'yes', the measured sentence renders (the claim is restored, not removed)", async () => {
    stubFetch(async (u) => {
      if (u.includes("/api/me/today/brief")) return json({ ok: true, reminders: [], hostAttention: [] });
      if (u.includes("/api/me/today/yesterday-activity")) return json({});
      if (u.includes("/api/me/daily-trace")) return json({ dailyTrace: [{ date: "d6", intensity: 1 }, { date: "d7", intensity: 1 }] });
      if (u.includes("/api/arena/practice")) return json({ practices: [] });
      if (u.includes("/api/bty/foundry/learning-path")) return json({ ok: true, programs: [] });
      return json({});
    });
    render(<TodayHome locale="en" onNavigate={() => {}} />);
    await waitFor(() => expect(screen.getByTestId("today-yesterday-sentence").textContent).toContain(RETURNED_CLAIM_EN));
  });

  it("once the trace answers 'no', the quiet sentence renders — measured, not assumed", async () => {
    stubFetch(async (u) => {
      if (u.includes("/api/me/today/brief")) return json({ ok: true, reminders: [], hostAttention: [] });
      if (u.includes("/api/me/today/yesterday-activity")) return json({});
      if (u.includes("/api/me/daily-trace")) return json({ dailyTrace: [{ date: "d6", intensity: 0 }, { date: "d7", intensity: 1 }] });
      if (u.includes("/api/arena/practice")) return json({ practices: [] });
      if (u.includes("/api/bty/foundry/learning-path")) return json({ ok: true, programs: [] });
      return json({});
    });
    render(<TodayHome locale="en" onNavigate={() => {}} />);
    await waitFor(() => expect(screen.getByTestId("today-yesterday-sentence").textContent).toContain(QUIET_CLAIM_EN));
  });

  it("canonical counts alone are enough to know yesterday (the trace is not required)", async () => {
    stubFetch(async (u) => {
      if (u.includes("/api/me/today/brief")) return json({ ok: true, reminders: [], hostAttention: [] });
      if (u.includes("/api/me/today/yesterday-activity")) {
        return json({ counts: { trainingsCompleted: 1, actionsSubmitted: 0, practicesCompleted: 0, followUpsAnswered: 0 } });
      }
      if (u.includes("/api/me/daily-trace")) return never();
      return json({});
    });
    render(<TodayHome locale="en" onNavigate={() => {}} />);
    await waitFor(() => expect(screen.getByTestId("today-yesterday")).toBeTruthy());
    expect(screen.getByTestId("today-yesterday-sentence").textContent).not.toContain(QUIET_CLAIM_EN);
  });
});

describe("R4-R5A containment — Repair A changed truth-gating only", () => {
  it("opening Today still writes nothing (no method other than GET leaves this component)", async () => {
    const methods: string[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init?: RequestInit) => {
        methods.push((init?.method ?? "GET").toUpperCase());
        const u = String(url);
        if (u.includes("/api/me/today/brief")) return json({ ok: true, reminders: [REQUIRED], hostAttention: [] });
        if (u.includes("/api/me/daily-trace")) return json({ dailyTrace: [] });
        return json({});
      }),
    );
    render(<TodayHome locale="en" onNavigate={() => {}} />);
    await screen.findByTestId("today-item");
    expect(methods.every((m) => m === "GET")).toBe(true);
  });

  it("the item's canonical deep link is untouched (no deep-link work in this slice)", async () => {
    stubFetch(async (u) => {
      if (u.includes("/api/me/today/brief")) return json({ ok: true, reminders: [REQUIRED], hostAttention: [] });
      if (u.includes("/api/me/daily-trace")) return json({ dailyTrace: [] });
      return json({});
    });
    render(<TodayHome locale="en" onNavigate={() => {}} />);
    const item = await screen.findByTestId("today-item");
    expect(item.getAttribute("href")).toBe("/en/app?tab=foundry");
  });
});
