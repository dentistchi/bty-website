import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { buildCompletionCard } from "./trainingCard";
import { buildPersonalAppLink } from "./personalAppLink";

/**
 * Slice My Learning — Canonical Training History V1.
 *
 * The bot card stays a NOTIFICATION. Its one link opens the app at this training, and a web URL is
 * refused outright — a generic browser handoff from inside Teams is the escape this product
 * forbids, and "the caller meant well" is not a check.
 */
const link = (search: string) =>
  buildPersonalAppLink({ origin: "https://arena.btydaily.com", search, label: "Morning Office Opening" })!;

const base = { correctCount: 5, totalCount: 5, scorePercent: 100 } as const;
const actions = (card: Record<string, unknown>) =>
  (card.actions as { type: string; title: string; url: string }[] | undefined) ?? [];

describe("buildCompletionCard", () => {
  it("still states the fact and nothing else when no link is given", () => {
    const card = buildCompletionCard({ ...base });
    expect(actions(card)).toHaveLength(0);
    expect(JSON.stringify(card)).toContain("Training complete");
    expect(JSON.stringify(card)).toContain("5 / 5");
  });

  it("adds exactly one View in My Learning action for a Personal App link", () => {
    const url = link("?tab=learn&view=my-learning&entry=e1");
    const card = buildCompletionCard({ ...base, reviewUrl: url });
    expect(actions(card)).toHaveLength(1);
    expect(actions(card)[0]).toMatchObject({ type: "Action.OpenUrl", title: "View in My Learning", url });
  });

  it("routes to THIS training, not a generic surface", () => {
    const card = buildCompletionCard({ ...base, reviewUrl: link("?tab=learn&view=my-learning&entry=e1") });
    const params = new URL(actions(card)[0].url).searchParams;
    expect(params.get("webUrl")).toContain("view=my-learning");
    expect(params.get("webUrl")).toContain("entry=e1");
  });

  it("REFUSES a BTY web URL — that is the browser escape, not a review link", () => {
    for (const bad of [
      "https://arena.btydaily.com/",
      "https://arena.btydaily.com/en/app?tab=learn&view=my-learning&entry=e1",
      "https://example.com/",
      "",
      null,
    ]) {
      const card = buildCompletionCard({ ...base, reviewUrl: bad });
      expect(actions(card), String(bad)).toHaveLength(0);
    }
  });

  it("never carries the quiz itself into the chat", () => {
    const json = JSON.stringify(buildCompletionCard({ ...base, reviewUrl: link("?tab=learn&view=my-learning&entry=e1") }));
    for (const forbidden of ["choices", "explanation", "correctChoiceId", "selectedChoiceId"]) {
      expect(json, forbidden).not.toContain(forbidden);
    }
  });
});

describe("My Learning stays quiet at level 1", () => {
  it("the list renders a title, a date and a door — and nothing else", () => {
    const src = readFileSync(
      join(process.cwd(), "src/components/foundry/event-rooms/FoundryMyLearning.tsx"),
      "utf8",
    );
    /*
      Everything below was on the card and answered a question the learner had not asked yet, which
      is what made a hundred-item history unscannable. Each now lives one tap in.
    */
    for (const gone of [
      "my-learning-quiz-score",      // the score
      "my-learning-shared",          // WHAT I UNDERSTOOD
      "my-learning-decision",        // the decision block
      "my-learning-evidence",        // SINCE THIS TRAINING
      "view-reflection-in-center",   // the reflection link
      "contentTypeLabel(it.contentType", // the GUIDANCE badge
      "/api/bty/foundry/evidence/mine",  // and the fetch that fed the strip
    ]) {
      expect(src, gone).not.toContain(gone);
    }
    for (const leak of ["explanation", "correctChoiceId", "selectedChoiceId", "quiz.questions"]) {
      expect(src, leak).not.toContain(leak);
    }
    // What the row IS.
    expect(src).toContain("my-learning-open-detail");
    expect(src).toContain("{t.completedOn}");
  });
});
