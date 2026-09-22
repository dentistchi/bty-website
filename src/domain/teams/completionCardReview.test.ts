import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { buildCompletionCard } from "./trainingCard";
import { buildProactiveMessage } from "./proactiveMessage";

/**
 * Slice My Learning — Canonical Training History V1.
 *
 * The bot card stays a NOTIFICATION, and now carries NO navigation at all.
 *
 * A "View in My Learning" button lived here briefly. Real-iPhone evidence: a bot `Action.OpenUrl`
 * pointing at a personal-tab entity link leaves the Teams client before BTY is evaluated — the URL
 * 302s to Microsoft's own `dl/launcher` web page, which follows `webUrl` into a browser. No URL
 * fixes that, so the card has no link, and this file exists to keep it that way.
 */
const base = { correctCount: 5, totalCount: 5, scorePercent: 100 } as const;
const actions = (card: Record<string, unknown>) =>
  (card.actions as { type: string; title: string; url: string }[] | undefined) ?? [];

describe("buildCompletionCard", () => {
  it("states the fact and offers no navigation whatsoever", () => {
    const card = buildCompletionCard({ ...base }) as Record<string, unknown>;
    expect(card.actions).toBeUndefined();
    const json = JSON.stringify(card);
    expect(json).toContain("Training complete");
    expect(json).toContain("5 / 5");
    expect(json).toContain("100%");
  });

  it("carries NO url, no OpenUrl action and no BTY address in either language", () => {
    for (const locale of ["en", "ko"] as const) {
      const card = buildCompletionCard({ ...base, locale }) as Record<string, unknown>;
      /*
        `$schema` is the Adaptive Card format declaration, not a destination — it is dropped before
        asking whether anything here points somewhere.
      */
      const { $schema, ...rest } = card as { $schema?: unknown } & Record<string, unknown>;
      expect(typeof $schema).toBe("string");
      const json = JSON.stringify(rest);
      for (const forbidden of [
        "Action.OpenUrl",
        "teams.microsoft.com",
        "arena.btydaily.com",
        "http",
        '"url"',
        "View in My Learning",
      ]) {
        expect(json, `${locale}/${forbidden}`).not.toContain(forbidden);
      }
    }
  });

  it("never carries the quiz itself into the chat", () => {
    const json = JSON.stringify(buildCompletionCard({ ...base }));
    for (const forbidden of ["choices", "explanation", "correctChoiceId", "selectedChoiceId"]) {
      expect(json, forbidden).not.toContain(forbidden);
    }
  });
});

describe("no bot surface mints a BTY deep link any more", () => {
  it("the product has no personal-app link builder left to reuse", () => {
    expect(existsSync(join(process.cwd(), "src/domain/teams/personalAppLink.ts"))).toBe(false);
  });

  it("the proactive announcement message carries no link", () => {
    const text = buildProactiveMessage({ hostName: "Dr Chi", hostFraming: "Please read this." });
    expect(text).toContain("Dr Chi");
    expect(text).toContain("Please read this.");
    for (const forbidden of ["http", "Open BTY", "](", "arena.btydaily.com"]) {
      expect(text, forbidden).not.toContain(forbidden);
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
      'data-testid="reviewed-plans"',    // the Host-workflow artefact
      "/api/bty/action-contract/reviewed-plans", // and the fetch behind it
      "t.reviewedTitle",                 // "Reviewed action plans"
    ]) {
      expect(src, gone).not.toContain(gone);
    }
    for (const leak of ["explanation", "correctChoiceId", "selectedChoiceId", "quiz.questions"]) {
      expect(src, leak).not.toContain(leak);
    }
    // No internal workflow vocabulary survives as rendered copy.
    for (const label of ["Reviewed action plans", "What I understood", "Since this training", "Learned"]) {
      expect(src.replace(/\/\*[\s\S]*?\*\//g, ""), label).not.toContain(label);
    }
    // What the row IS — and the only thing it fetches.
    expect(src).toContain("my-learning-open-detail");
    expect(src).toContain("{t.completedOn}");
    /*
      TWO fetches, and only two: the completions, and the obligations that decide which of them may
      never be archived. The obligations are never RENDERED here — the assertions above prove the
      strip and its labels are gone — they only pick which rows the default list keeps.
    */
    expect(src.match(/fetch\(/g) ?? []).toHaveLength(2);
    expect(src).toContain("/api/bty/foundry/evidence/mine");
    expect(src).toContain("splitLearningHistory");
  });
});
