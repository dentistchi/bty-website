/** @vitest-environment jsdom */
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, waitFor, cleanup } from "@testing-library/react";

vi.mock("./PdfReader", () => ({ PdfReader: () => null }));
vi.mock("./YouTubePlayer", () => ({ YouTubePlayer: () => null }));

import FoundryDocumentClient from "./FoundryDocumentClient";
import FoundryJoinClient from "./FoundryJoinClient";

/**
 * SLICE 3.2R-R8C-R1 — THE SCREEN PROMISED SOMETHING THAT EXISTS NOWHERE.
 *
 * After a successful authenticated claim both learner clients said:
 *
 *   "Your reflection is private and available in My Learning."
 *
 * Live forensics (R8C) measured that against the real projections. My Learning DOES return this
 * completed training — `listUserFoundryHistory` for the linked account contained the event, the
 * title and the completion time. It does NOT return `learner_reflection_text`; no read path in
 * the product does, and a repository-wide search finds the column only in the two completion
 * services that write it. `response_text` is fetched by My Learning and deliberately not
 * rendered, which is why that surface links out to Center instead.
 *
 * So the sentence named the REFLECT answer the learner had just written and sent them to a place
 * it does not exist. R8B created that: before it, "your reflection" had one referent; after it,
 * the word points at a specific labelled question whose answer is write-only.
 *
 * ═══ COPY ONLY ═══
 *
 * This slice repairs the promise, not the gap. Reading the reflection back is deferred product
 * work with its own home (likely Center, where private answers already live). Nothing here
 * touches a projection, a column, XP, the follow-up, or the handoff destination.
 */

const FALSE_PROMISE_EN = "Your reflection is private and available in My Learning.";
const FALSE_PROMISE_KO = "이 성찰은 비공개이며 내 학습에서 다시 볼 수 있습니다.";
const TRUE_EN = "Your training is saved in My Learning.";
const TRUE_KO = "이 교육은 내 학습에 저장되었습니다.";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

/** Snapshot for a claimed, awarded, open-link learner — the only state that renders this copy. */
function awardedDoc(xp: string) {
  return {
    content_type: "document",
    event: { title: "Building Accountability in Huddles", status: "open" },
    participant: { display_name: "조인람" },
    document: { page_count: 4, min_read_seconds: 20, intro: null, last_page: 4, distinct_pages_viewed: 4, active_read_ms: 712000, reading_complete: true, completion_prompt: null, shared_question: null },
    stage: xp === "awarded" ? "completed_awarded" : "completed_claimable",
    xp_status: xp,
  };
}
function awardedVideo(xp: string) {
  return {
    event: { title: "Building Accountability in Huddles", status: "open" },
    participant: { display_name: "조인람" },
    training: { youtube_video_id: "abc123", completion_prompt: null, shared_question: null },
    stage: xp === "awarded" ? "completed_awarded" : "completed_claimable",
    xp_status: xp,
  };
}

function mock(snapshot: unknown) {
  vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url.includes("/file")) return { ok: true, status: 200, json: async () => ({ ok: true, url: "blob:pdf", expires_in: 600 }) } as unknown as Response;
    if (url.includes("claim-xp")) return { ok: true, status: 200, json: async () => ({ ok: true, ...(snapshot as object) }) } as unknown as Response;
    return { ok: true, status: 200, json: async () => snapshot } as unknown as Response;
  }));
}

describe("[3.2R-R8C-R1] A/B — the claimed completion promises only what My Learning has", () => {
  for (const [label, Client, snap] of [
    ["document", FoundryDocumentClient, awardedDoc("awarded")],
    ["youtube", FoundryJoinClient, awardedVideo("awarded")],
  ] as const) {
    it(`${label} — names the training record, never the reflection`, async () => {
      mock(snap);
      render(<Client token="btyroom.a.b" />);
      await waitFor(() => expect(screen.getByTestId("saved-to-bty")).toBeTruthy());

      expect(screen.getByText(TRUE_EN)).toBeTruthy();
      expect(screen.queryByText(FALSE_PROMISE_EN), "the promise that had no surface behind it").toBeNull();
      // Not merely the old sentence: no wording here may claim the reflection is readable.
      const panel = screen.getByTestId("saved-to-bty").textContent ?? "";
      expect(/reflection/i.test(panel), panel).toBe(false);
      // The heading is untouched, and the three lines still read together.
      expect(screen.getByText("Saved to your BTY")).toBeTruthy();
    });

    it(`${label} — C: the handoff destination is unchanged`, async () => {
      mock(snap);
      render(<Client token="btyroom.a.b" />);
      const cont = (await screen.findByTestId("continue-to-bty")) as HTMLAnchorElement;
      expect(cont.getAttribute("href")).toBe("/en/app?tab=foundry&view=my-learning");
      expect(cont.textContent).toBe("Continue to BTY");
    });

    it(`${label} — D/E: the panel appears ONLY on an awarded claim`, async () => {
      /*
        `claimable` is the pre-auth screen and `owner_ineligible` is the Host's own completion.
        Neither has saved anything to an account, so neither may say it did — the panel is gated
        on xp === "awarded" and this proves the gate, not just the sentence.
      */
      for (const xp of ["claimable", "owner_ineligible", "daily_limit"]) {
        cleanup();
        const s = label === "document" ? awardedDoc(xp) : awardedVideo(xp);
        mock(s);
        render(<Client token="btyroom.a.b" />);
        await waitFor(() => expect(screen.queryByTestId("continue-to-bty")).toBeNull());
        expect(screen.queryByText(TRUE_EN), xp).toBeNull();
        expect(screen.queryByText(FALSE_PROMISE_EN), xp).toBeNull();
      }
    });
  }

  it("H — the Korean says the same true thing, in the vocabulary the product already uses", () => {
    /*
      Checked as SOURCE, because locale here is resolved from navigator.language at mount and a
      jsdom render would only ever prove one branch. "내 학습" is the canonical KO name of My
      Learning (FoundryMyLearning title) and "교육" is already this file's word for a training.
    */
    const fs = require("node:fs") as typeof import("node:fs");
    for (const f of ["src/app/f/[token]/FoundryDocumentClient.tsx", "src/app/f/[token]/FoundryJoinClient.tsx"]) {
      const src = fs.readFileSync(f, "utf8");
      expect(src.includes(`savedBody: "${TRUE_EN}"`), f).toBe(true);
      expect(src.includes(`savedBody: "${TRUE_KO}"`), f).toBe(true);
      // The VALUE, not the file: both clients quote the retired sentence in a comment that
      // records why it went false, and a comment is not a promise to anyone.
      expect(src.includes(`savedBody: "${FALSE_PROMISE_EN}"`), `${f} still ships the false EN promise`).toBe(false);
      expect(src.includes(`savedBody: "${FALSE_PROMISE_KO}"`), `${f} still ships the false KO promise`).toBe(false);
    }
  });

  it("I/J — no projection was touched: the reflection is still written and read by nothing", () => {
    /*
      The honest boundary of this slice, asserted on the actual leak surface rather than on
      whether a file mentions the name. A first version compared the list of files containing
      the string and failed on my own comment in these two clients — a comment cannot read a
      column. What CAN is a projection, and every projection in this codebase is an explicit
      `select("a, b, c")` list, so that is what this checks.
    */
    const { execSync } = require("node:child_process") as typeof import("node:child_process");
    const inSelect = execSync(
      `grep -rn 'select(.*learner_reflection_text' src --include=*.ts --include=*.tsx | grep -v '\\.test\\.' || true`,
      { encoding: "utf8" },
    ).trim();
    expect(inSelect, "no query anywhere may project the private reflection").toBe("");

    // And the learner-facing read surfaces do not name it at all — the gap this slice defers.
    const fs = require("node:fs") as typeof import("node:fs");
    for (const f of [
      "src/lib/bty/foundry/events/foundryHistoryService.ts",
      "src/lib/bty/foundry/events/foundryCompletionReviewService.ts",
      "src/components/foundry/event-rooms/FoundryMyLearning.tsx",
    ]) {
      expect(fs.readFileSync(f, "utf8").includes("learner_reflection_text"), f).toBe(false);
    }
  });
});
