/** @vitest-environment jsdom */
import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, cleanup, fireEvent, waitFor } from "@testing-library/react";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

vi.mock("./PdfReader", () => ({ PdfReader: () => null }));
vi.mock("./YouTubePlayer", () => ({ YouTubePlayer: () => null }));

import { mergeSnapshot, suppliedSnapshotFields } from "./snapshotMerge";
import FoundryJoinClient from "./FoundryJoinClient";
import FoundryDocumentClient from "./FoundryDocumentClient";
import FoundryGuidanceClient from "./FoundryGuidanceClient";

/**
 * R4-R3B1-R1 — THE PATH THE PREVIOUS TESTS DID NOT DRIVE.
 *
 * R4-R3B1 proved the server exposes `follow_up_days` and that the terminal renders it when the
 * snapshot carries it. Both were true, and the feature still failed on the Founder's device,
 * because every one of those tests seeded state through `load()` — the GET. The learner does not
 * arrive that way. They arrive through an ACTION: declare, complete, claim. Each of those went
 * through `applyResult`, which rebuilt the snapshot from an exhaustive object literal and dropped
 * every key it did not name.
 *
 * So the shape under test here is the real one:
 *
 *     GET /snapshot (carries follow_up_days: 7)
 *       → learner presses the button
 *       → action response WITHOUT follow_up_days
 *       → applyResult
 *       → terminal render
 *
 * Every test below fails against b57e5295 and passes after the repair. The generic ones matter
 * more than the specific ones: `journey` was lost this way in 3.2R-R8A-R1 and `follow_up_days` in
 * R4-R3B1, each time repaired by naming the key that had just gone missing, which left the next
 * additive field exposed. What is pinned now is that a field NOBODY HAS WRITTEN YET survives.
 */

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const TOKEN = "btyroom.a.b";

/** A pre-terminal snapshot: the learner is at the completion question, not finished yet. */
function atResponseStage(over: Record<string, unknown> = {}) {
  return {
    content_type: "written_guidance",
    event: { title: "Confirm Patient Understanding", status: "open" },
    participant: { display_name: "Hojin" },
    training: { youtube_video_id: "vid", completion_prompt: null, shared_question: null },
    document: {
      page_count: 2, min_read_seconds: 1, intro: null, last_page: 2, distinct_pages_viewed: 2,
      active_read_ms: 99_999, reading_complete: true, completion_prompt: null, shared_question: null,
    },
    guidance: { material_text: "Read this", completion_prompt: null, shared_question: null },
    declared: true,
    journey: null,
    reflection_required: false,
    stage: "response",
    xp_status: "none",
    follow_up_days: 7,
    ...over,
  };
}

/**
 * The action response, shaped like a server that does not echo every field.
 *
 * This is the whole point: `follow_up_days` is ABSENT here, exactly as `journey` was absent from
 * the heartbeat response that deleted the program in 3.2R-R8A-R1.
 */
function completionResponseWithoutFollowUpDays() {
  const { follow_up_days: _dropped, ...rest } = atResponseStage();
  return { ok: true, ...rest, stage: "completed_claimable", xp_status: "claimable" };
}

/** GET → the seeded snapshot. POST → the action response. Signed out throughout. */
function mockFetch(getSnapshot: Record<string, unknown>, postResponse: Record<string, unknown>) {
  const posted: string[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.includes("/api/auth/session")) {
        return { ok: true, status: 200, json: async () => ({}) } as unknown as Response;
      }
      if (url.includes("/file")) {
        return { ok: true, status: 200, json: async () => ({ ok: true, url: "blob:pdf", expires_in: 600 }) } as unknown as Response;
      }
      if ((init?.method ?? "GET").toUpperCase() === "POST") {
        posted.push(url);
        return { ok: true, status: 200, json: async () => postResponse } as unknown as Response;
      }
      return { ok: true, status: 200, json: async () => getSnapshot } as unknown as Response;
    }),
  );
  return posted;
}

const ROOMS = [
  { name: "Join (YouTube)", el: <FoundryJoinClient token={TOKEN} />, finish: "Complete training" },
  { name: "Document (PDF)", el: <FoundryDocumentClient token={TOKEN} />, finish: "Complete training" },
  {
    name: "Guidance (written)",
    el: <FoundryGuidanceClient token={TOKEN} contentType="written_guidance" />,
    // This room labels its button "Complete", not "Complete training".
    finish: "Complete",
  },
];

/** Answer the completion question and press this room's own finish control. */
async function finishTraining(label: string) {
  fireEvent.change(await screen.findByRole("textbox"), {
    target: { value: "I will confirm understanding at the next visit." },
  });
  fireEvent.click(await screen.findByRole("button", { name: label }));
}

/* ------------------------------------------------------------- 1 / 2 / 3 / 4 */

describe("R4-R3B1-R1 · 1–4 · follow_up_days survives the completion action in every room", () => {
  for (const room of ROOMS) {
    it(`${room.name}: GET carries 7, the completion response does not, the terminal still says 7`, async () => {
      mockFetch(atResponseStage(), completionResponseWithoutFollowUpDays());
      render(room.el);

      // Answer and finish, exactly as a learner does.
      await finishTraining(room.finish);

      // The terminal is reached THROUGH applyResult — this is the path R4-R3B1 never drove.
      const fu = await screen.findByTestId("terminal-followup");
      expect(fu.textContent).toContain("This training includes a 7-day follow-up.");
      expect(fu.textContent).toContain("Sign in so we can connect that follow-up to you.");
      expect(screen.getByTestId("terminal-xp-secondary").textContent).toBe(
        "Your 10 Core XP will be saved too.",
      );
    });
  }

  it("2b — Guidance: declare, THEN complete — two actions, and 7 survives both", async () => {
    const undeclared = atResponseStage({ declared: false, stage: "declare" });
    // The declare response also omits the key, so the field must cross two merges.
    const declareResponse = { ok: true, ...atResponseStage({ declared: true }), follow_up_days: undefined };
    delete (declareResponse as Record<string, unknown>).follow_up_days;

    const posted = mockFetch(undeclared, declareResponse);
    render(<FoundryGuidanceClient token={TOKEN} contentType="written_guidance" />);

    fireEvent.click(await screen.findByTestId("guidance-declare"));
    await waitFor(() => expect(posted.some((u) => u.includes("/declare"))).toBe(true));

    // Now finish, with a completion response that also omits it.
    vi.unstubAllGlobals();
    mockFetch(undeclared, completionResponseWithoutFollowUpDays());
    await finishTraining("Complete");

    const fu = await screen.findByTestId("terminal-followup");
    expect(fu.textContent).toContain("This training includes a 7-day follow-up.");
  });

  it("16 — a room with no checkpoint still promises nothing after the same action", async () => {
    const noCheckpoint = atResponseStage({ follow_up_days: null });
    const { follow_up_days: _d, ...rest } = noCheckpoint;
    mockFetch(noCheckpoint, { ok: true, ...rest, stage: "completed_claimable", xp_status: "claimable" });
    render(<FoundryJoinClient token={TOKEN} />);

    await finishTraining("Complete training");

    expect((await screen.findByTestId("terminal-completion-saved")).textContent).toBe(
      "Your completion is already saved.",
    );
    expect(screen.queryByTestId("terminal-followup")).toBeNull();
    expect(document.body.textContent).not.toContain("follow-up");
  });
});

/* --------------------------------------------------------------------- 5 / 6 */

describe("R4-R3B1-R1 · 5/6 · the rule is generic, not a list of known keys", () => {
  type Fake = { a: string; b: number | null; stage: string; futureField?: string };
  const base: Fake = { a: "base", b: null, stage: "x" };

  it("5 — a key nobody has written yet survives an action that omits it", () => {
    const prev: Fake = { a: "loaded", b: 7, stage: "response", futureField: "not-invented-yet" };
    const merged = mergeSnapshot<Fake>(prev, { ok: true, a: "acted", stage: "completed" }, base, {
      stage: "completed",
    });
    // The whole point: this assertion names no real snapshot field.
    expect(merged.futureField).toBe("not-invented-yet");
    expect(merged.b).toBe(7);
    expect(merged.a).toBe("acted");
  });

  it("an EXPLICIT null still overwrites — absent is not the same as cleared", () => {
    const prev: Fake = { a: "loaded", b: 7, stage: "response" };
    const merged = mergeSnapshot<Fake>(prev, { ok: true, b: null, stage: "s" }, base, { stage: "s" });
    // A server saying "this is locked now" must be honoured, not preserved away.
    expect(merged.b).toBeNull();
  });

  it("with nothing on screen yet, the room's own defaults are the base", () => {
    const merged = mergeSnapshot<Fake>(null, { ok: true, a: "first", stage: "s" }, base, { stage: "s" });
    expect(merged).toEqual({ a: "first", b: null, stage: "s" });
  });

  it("6 — transport fields never become snapshot state", () => {
    const supplied = suppliedSnapshotFields<Record<string, unknown>>({
      ok: true,
      error: "nope",
      reason: "no_session",
      assignmentClaim: "claimed",
      assignment_claim: "claimed",
      stage: "completed",
      follow_up_days: 7,
    });
    expect(Object.keys(supplied).sort()).toEqual(["follow_up_days", "stage"]);
  });

  it("a non-object response contributes nothing rather than corrupting state", () => {
    const prev: Fake = { a: "loaded", b: 7, stage: "response" };
    for (const junk of [null, undefined, "string", 42, [1, 2, 3]]) {
      expect(mergeSnapshot<Fake>(prev, junk, base)).toEqual(prev);
    }
  });
});

/* ------------------------------------------------------------------ 6 (live) */

describe("R4-R3B1-R1 · 6 · no room leaks `ok` into its rendered state", () => {
  for (const room of ROOMS) {
    it(`${room.name}: the action response's ok/assignmentClaim do not persist`, async () => {
      mockFetch(atResponseStage(), {
        ...completionResponseWithoutFollowUpDays(),
        assignmentClaim: "no_matching_assignment",
      });
      render(room.el);
      await finishTraining(room.finish);
      await screen.findByTestId("terminal-completion-saved");
      // Nothing from the envelope reached the screen as training content.
      expect(document.body.textContent).not.toContain("no_matching_assignment");
    });
  }
});

/* ------------------------------------------------------------------- 7 / 8 */

describe("R4-R3B1-R1 · 7/8 · sign-in returns the learner to their own training", () => {
  /**
   * The measured defect: Guidance navigated to `/bty/login?next=…`. The platform 307s an
   * unprefixed path to `/en/bty/login` and DROPS THE QUERY, so login had no return target and
   * defaulted to `/en/bty`. The Founder signed in, landed on the legacy Arena page, and the claim
   * endpoint was never reached — production showed linked_user_id, xp_awarded_at, the follow-up
   * and the apply window all still empty, with updated_at unchanged since completion.
   */
  function captureNavigation() {
    const nav: string[] = [];
    Object.defineProperty(window, "location", {
      configurable: true,
      value: {
        pathname: `/f/${TOKEN}`,
        search: "",
        get href() {
          return nav[nav.length - 1] ?? "";
        },
        set href(v: string) {
          nav.push(v);
        },
      },
    });
    return nav;
  }

  for (const locale of ["en", "ko"] as const) {
    it(`9/10 — Guidance builds the locale-prefixed URL for ${locale}`, async () => {
      const nav = captureNavigation();
      /*
        Every learner room resolves its locale from the DEVICE, not from the URL. jsdom's
        `navigator` is not replaceable wholesale, so the getter is redefined in place.
      */
      Object.defineProperty(window.navigator, "language", {
        configurable: true,
        get: () => (locale === "ko" ? "ko-KR" : "en-US"),
      });
      vi.stubGlobal(
        "fetch",
        vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
          const url = String(input);
          if (url.includes("/api/auth/session")) {
            return { ok: true, status: 200, json: async () => ({}) } as unknown as Response;
          }
          if ((init?.method ?? "GET").toUpperCase() === "POST") {
            // Anonymous claim — the server's correct answer, and the trigger for sign-in.
            return { ok: false, status: 401, json: async () => ({ ok: false, error: "no_session" }) } as unknown as Response;
          }
          return {
            ok: true,
            status: 200,
            json: async () => atResponseStage({ stage: "completed_claimable", xp_status: "claimable" }),
          } as unknown as Response;
        }),
      );

      render(<FoundryGuidanceClient token={TOKEN} contentType="written_guidance" />);
      fireEvent.click(await screen.findByTestId("guidance-claim-xp"));

      await waitFor(() => expect(nav.length).toBeGreaterThan(0));
      expect(nav[0]).toBe(`/${locale}/bty/login?next=${encodeURIComponent(`/f/${TOKEN}`)}`);
      // The exact shape that lost the query string on the redirect.
      expect(nav[0]).not.toMatch(/^\/bty\/login/);
    });
  }

  it("8 — NO learner client emits an unprefixed /bty/login or /bty/logout", () => {
    const dir = join(process.cwd(), "src/app/f/[token]");
    const offenders: string[] = [];
    for (const file of readdirSync(dir).filter((f) => f.endsWith(".tsx") && !f.includes(".test."))) {
      const src = readFileSync(join(dir, file), "utf8");
      /*
        Match the NAVIGATION, not prose. The comment that documents this very defect quotes the
        broken path, and a guard that cannot tell an assignment from an explanation would either
        fail forever or push someone to delete the explanation.
      */
      for (const m of src.matchAll(/location\.href\s*=\s*`\/bty\/(login|logout)/g)) {
        offenders.push(`${file}: ${m[0]}`);
      }
    }
    expect(offenders).toEqual([]);
  });
});
