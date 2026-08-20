/** @vitest-environment jsdom */
import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, cleanup, waitFor } from "@testing-library/react";

vi.mock("./PdfReader", () => ({ PdfReader: () => null }));
vi.mock("./YouTubePlayer", () => ({ YouTubePlayer: () => null }));

import { terminalIdentityCopy } from "./terminalIdentityCopy";
import FoundryJoinClient from "./FoundryJoinClient";
import FoundryDocumentClient from "./FoundryDocumentClient";
import FoundryGuidanceClient from "./FoundryGuidanceClient";

/**
 * R4-R3B1 — WHAT SIGNING IN IS FOR.
 *
 * 27 of 39 production completions declined the account, and 17 of those sit in trainings whose
 * Host set a 7- or 30-day checkpoint — so a follow-up was owed and can never reach them. The only
 * thing the terminal screen ever said was "10 Core XP is ready to save."
 *
 * The two things these tests exist to stop:
 *
 *   PROMISING A FOLLOW-UP THAT WILL NOT EXIST. The writer creates an obligation only when the
 *   frozen `followUpDays` is 7 or 30, so a room without one must say nothing at all.
 *
 *   PROMISING A COUNTDOWN. `computeFollowUpDue` anchors on `completed_at`, and the claim path
 *   passes the STORED instant — so a learner who signs in on day 10 of a 7-day checkpoint gets a
 *   follow-up that is already due. "In 7 days from now" would be false for exactly the people this
 *   slice is for.
 */

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

/** A snapshot in the anonymous terminal state — completed, XP not yet claimed. */
function completedSnapshot(over: Record<string, unknown> = {}) {
  return {
    event: { title: "Confirm Patient Understanding", status: "open" },
    participant: { display_name: "Hojin" },
    training: { youtube_video_id: "vid", completion_prompt: null, shared_question: null },
    document: {
      page_count: 2, min_read_seconds: 1, intro: null, last_page: 2, distinct_pages_viewed: 2,
      active_read_ms: 99_999, reading_complete: true, completion_prompt: null, shared_question: null,
    },
    content_type: "written_guidance",
    guidance: { material_text: "Read this", completion_prompt: null, shared_question: null },
    declared: true,
    stage: "completed_claimable",
    xp_status: "claimable",
    ...over,
  };
}

/** Every GET returns the snapshot; the account probe returns signed-out. */
function mockFetch(snapshot: Record<string, unknown>) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      // Signed out — the terminal state we are testing is the anonymous one.
      if (url.includes("/api/auth/session")) {
        return { ok: true, status: 200, json: async () => ({}) } as unknown as Response;
      }
      if (url.includes("/file")) {
        return { ok: true, status: 200, json: async () => ({ ok: true, url: "blob:pdf", expires_in: 600 }) } as unknown as Response;
      }
      return { ok: true, status: 200, json: async () => snapshot } as unknown as Response;
    }),
  );
}

const CLIENTS = [
  { name: "Join (YouTube)", render: () => render(<FoundryJoinClient token="btyroom.a.b" />) },
  { name: "Document (PDF)", render: () => render(<FoundryDocumentClient token="btyroom.a.b" />) },
  { name: "Guidance (written)", render: () => render(<FoundryGuidanceClient token="btyroom.a.b" contentType="written_guidance" />) },
];

/* ------------------------------------------------------------------ 1/2/3 */

describe("R4-R3B1 · 1/2/3 · all three rooms explain the follow-up when one is configured", () => {
  for (const c of CLIENTS) {
    it(`${c.name}: completion is saved, follow-up meaning is visible, XP is secondary`, async () => {
      mockFetch(completedSnapshot({ follow_up_days: 7 }));
      c.render();

      const saved = await screen.findByTestId("terminal-completion-saved");
      expect(saved.textContent).toBe("Your completion is already saved.");

      const fu = await screen.findByTestId("terminal-followup");
      expect(fu.textContent).toContain("This training includes a 7-day follow-up.");
      expect(fu.textContent).toContain("Sign in so we can connect that follow-up to you.");

      // XP is still present, but it is no longer the whole explanation.
      const xp = screen.getByTestId("terminal-xp-secondary");
      expect(xp.textContent).toBe("Your 10 Core XP will be saved too.");
      // The old XP-only line is gone from this state.
      expect(document.body.textContent).not.toContain("10 Core XP is ready to save.");
    });
  }
});

/* -------------------------------------------------------------------- 4/5 */

describe("R4-R3B1 · 4/5 · the checkpoint decides, and only the checkpoint", () => {
  it("4 — followUpDays 30 renders the truthful 30-day variant", async () => {
    mockFetch(completedSnapshot({ follow_up_days: 30 }));
    render(<FoundryJoinClient token="btyroom.a.b" />);
    const fu = await screen.findByTestId("terminal-followup");
    expect(fu.textContent).toContain("This training includes a 30-day follow-up.");
    expect(fu.textContent).not.toContain("7-day");
  });

  for (const value of [null, undefined, 0] as const) {
    it(`5 — follow_up_days=${String(value)} promises no follow-up at all`, async () => {
      mockFetch(completedSnapshot({ follow_up_days: value }));
      render(<FoundryJoinClient token="btyroom.a.b" />);
      // The completion line is unconditional — finishing is durable either way.
      expect((await screen.findByTestId("terminal-completion-saved")).textContent).toBe(
        "Your completion is already saved.",
      );
      expect(screen.queryByTestId("terminal-followup")).toBeNull();
      const body = document.body.textContent ?? "";
      expect(body).not.toContain("follow-up");
      // The existing XP framing is untouched where there is nothing else to say.
      expect(body).toContain("10 Core XP is ready to save.");
    });
  }

  it("an out-of-domain value is not silently honoured — the writer would create nothing", () => {
    // 14 materializes no obligation, so it must promise none either.
    expect(terminalIdentityCopy(14, "en").followUp).toBeNull();
    expect(terminalIdentityCopy("7", "en").followUp).toBeNull();
  });
});

/* -------------------------------------------------------------------- 6/7 */

describe("R4-R3B1 · 6/7 · the Journey never answers the follow-up question", () => {
  it("6 — a grounded action_decision with NO checkpoint promises nothing", async () => {
    mockFetch(
      completedSnapshot({
        follow_up_days: null,
        journey: {
          displayTitle: "Close the loop",
          elements: [{ id: "e1", kind: "action_decision", content: "Name one owner." }],
        },
      }),
    );
    render(<FoundryJoinClient token="btyroom.a.b" />);
    await screen.findByTestId("terminal-completion-saved");
    expect(screen.queryByTestId("terminal-followup")).toBeNull();
  });

  it("7 — no Journey at all, checkpoint 7: the follow-up meaning DOES render", async () => {
    mockFetch(completedSnapshot({ follow_up_days: 7, journey: undefined }));
    render(<FoundryJoinClient token="btyroom.a.b" />);
    const fu = await screen.findByTestId("terminal-followup");
    expect(fu.textContent).toContain("This training includes a 7-day follow-up.");
  });
});

/* ---------------------------------------------------------------------- 8 */

describe("R4-R3B1 · 8 · the copy is still true for a late claim", () => {
  /*
    Day 0 completion, 7-day checkpoint, sign-in on day 10. The claim materializes an obligation
    anchored on the STORED `completed_at`, so it is already due. Nothing on this screen may have
    implied that signing in starts a fresh countdown.
  */
  const FORBIDDEN = [
    "in 7 days",
    "in 30 days",
    "from now",
    "next week",
    "we will check in with you in",
    "we'll check in with you in",
    "starting today",
    "over the next",
  ];

  for (const days of [7, 30] as const) {
    it(`followUpDays ${days}: states a property of the training, never a countdown`, async () => {
      mockFetch(completedSnapshot({ follow_up_days: days }));
      render(<FoundryJoinClient token="btyroom.a.b" />);
      await screen.findByTestId("terminal-followup");
      const body = (document.body.textContent ?? "").toLowerCase();
      for (const bad of FORBIDDEN) expect(body, `must not promise "${bad}"`).not.toContain(bad);
    });
  }

  it("both locales avoid a countdown", () => {
    for (const days of [7, 30] as const) {
      const en = terminalIdentityCopy(days, "en").followUp!;
      const ko = terminalIdentityCopy(days, "ko").followUp!;
      // "includes a N-day follow-up" is a fact about the training, true on day 0 and on day 10.
      expect(en.meaning).toBe(`This training includes a ${days}-day follow-up.`);
      expect(en.meaning).not.toMatch(/from now|in \d+ days? we|next/i);
      expect(ko.meaning).toBe(`이 훈련에는 ${days}일 후속 확인이 있습니다.`);
      expect(ko.meaning).not.toContain("지금부터");
      expect(ko.meaning).not.toContain("후에");
    }
  });
});

/* --------------------------------------------------------------------- 16 */

describe("R4-R3B1 · 16 · EN / KO parity", () => {
  it("every field exists in both locales and is genuinely translated", () => {
    for (const days of [7, 30] as const) {
      const en = terminalIdentityCopy(days, "en");
      const ko = terminalIdentityCopy(days, "ko");
      expect(en.followUp).toBeTruthy();
      expect(ko.followUp).toBeTruthy();
      expect(ko.completionSaved).not.toBe(en.completionSaved);
      expect(ko.followUp!.meaning).not.toBe(en.followUp!.meaning);
      expect(ko.followUp!.signInReason).not.toBe(en.followUp!.signInReason);
      expect(ko.followUp!.xpSecondary).not.toBe(en.followUp!.xpSecondary);
      // The Korean sentence still names the configured number.
      expect(ko.followUp!.meaning).toContain(String(days));
    }
    // And the unconfigured shape is identical in both.
    expect(terminalIdentityCopy(0, "ko").followUp).toBeNull();
    expect(terminalIdentityCopy(0, "en").followUp).toBeNull();
  });

  it("no Journey terminology reaches this copy", () => {
    for (const l of ["en", "ko"] as const) {
      const c = terminalIdentityCopy(7, l);
      const all = [c.completionSaved, c.followUp!.meaning, c.followUp!.signInReason, c.followUp!.xpSecondary].join(" ");
      for (const bad of ["journey", "action decision", "action_decision", "여정"]) {
        expect(all.toLowerCase()).not.toContain(bad);
      }
    }
  });
});

/* --------------------------------------------------------------------- 10 */

describe("R4-R3B1 · 10/11 · nothing about completion or sign-in changed", () => {
  it("11 — the completion stands on its own before any sign-in", async () => {
    mockFetch(completedSnapshot({ follow_up_days: 7 }));
    render(<FoundryJoinClient token="btyroom.a.b" />);
    // Rendered in the anonymous, unclaimed state — no account, no claim, and it says so plainly.
    expect((await screen.findByTestId("terminal-completion-saved")).textContent).toBe(
      "Your completion is already saved.",
    );
    await waitFor(() => expect(screen.getByTestId("claim-signin")).toBeTruthy());
  });

  it("10 — the sign-in control is the existing one, unchanged", async () => {
    mockFetch(completedSnapshot({ follow_up_days: 7 }));
    render(<FoundryJoinClient token="btyroom.a.b" />);
    const btn = await screen.findByTestId("claim-signin");
    expect(btn.textContent).toBe("Sign in to save");
  });
});
