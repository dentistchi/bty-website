/**
 * TRAINING TITLE AUTHORITY V1 — ONE TRAINING, ONE HOST-FACING NAME.
 *
 * THE MEASURED FAILURE. The Founder authored 회의 후 실행 확인하기 (draft
 * `be39c6a5`), published it, and could not find it. It was on the same screen the whole time,
 * listed as 회의 후 할 일의 담당자 및 마감일 확인하기 — because the draft card reads
 * `answers.title` and the published event read `journey.displayTitle`, which the model wrote.
 * Two Host-facing names for one training, and the one that disappeared was the one the Host
 * typed. A training you cannot find by the name you gave it is missing, whatever the database
 * says.
 *
 * WHY THE OBVIOUS REPAIR IS THE WRONG ONE. "Make `journey.displayTitle` the Host's title" looks
 * like the one-authority fix and is not available: `displayTitle` is hashed INTO
 * `proposalDigest`/`journeyDigest` (`proposal-digest.ts`), which is how adoption proves a journey
 * is the generated proposal unchanged. Seeding it from the Host would make every fresh training
 * digest as Host-EDITED, and `adoption-authority` refuses that mismatch as `proposal_mismatch` —
 * the exact refusal Recovery Truth B closed on draft `adb75f6a`. So `displayTitle` keeps its one
 * real job: identifying the PROPOSAL. It never names the training again.
 *
 * THE AUTHORITY, STATED ONCE: `answers.title` names the training. Publish reads it, both title
 * controls write it, and `displayTitle` remains the proposal's identity and nothing else.
 */
import { describe, it, expect } from "vitest";
import { publishedTrainingTitle } from "./module-publish";
import { mapAnswersToJourney } from "./journey";
import { journeyDigest } from "./proposal-digest";
import { requiredProgramKinds } from "./program-authorship";
import type { BuilderAnswers } from "./module-builder";
import type { RealityGroundedJourneyV1 } from "./journey";

/** The Founder's real draft, reduced to the two fields that disagreed. */
const HOST_TITLE = "회의 후 실행 확인하기";
const MODEL_TITLE = "회의 후 할 일의 담당자 및 마감일 확인하기";
const EDITED_TITLE = "회의 실행 항목 확인하기";

const ANSWERS: BuilderAnswers = {
  title: HOST_TITLE,
  problem: "회의에서 할 일을 정해도 담당자와 마감일을 분명히 확인하지 않아 실행이 빠진다.",
  audienceType: "leaders",
  recurringMoment: "회의가 끝나기 전에 다음 할 일을 정할 때",
  observableBehavior: "회의가 끝나기 전에 각 할 일의 담당자와 마감일을 확인한다.",
  successEvidence: "각 할 일마다 담당자와 마감일이 정해져 있다.",
  evidenceType: "seen",
  materialIntent: "written",
  materialText: "한 장짜리 안내",
} as unknown as BuilderAnswers;

/** A journey carrying the MODEL's title, exactly as adoption leaves it. */
const journeyWith = (displayTitle: string): RealityGroundedJourneyV1 => ({
  ...mapAnswersToJourney(ANSWERS, "ko"),
  displayTitle,
  displayTitleStatus: "grounded",
});

describe("[Title Authority V1] the published training keeps the Host's name", () => {
  it("REGRESSION — publish must not rename the Host's training", () => {
    const journey = journeyWith(MODEL_TITLE);
    expect(
      publishedTrainingTitle(ANSWERS, journey),
      "published training must retain the Host-authored title",
    ).toBe(HOST_TITLE);
  });

  it("the draft card and the published event now agree, byte for byte", () => {
    /*
      THE INVARIANT THE FOUNDER ACTUALLY NEEDED. `draftTitleFrom` is what the draft list renders;
      `publishedTrainingTitle` is what the room row renders. Asserting they are equal is the whole
      slice — the two sides were never compared before, which is how they drifted.
    */
    const journey = journeyWith(MODEL_TITLE);
    const beforePublish = ANSWERS.title;
    const afterPublish = publishedTrainingTitle(ANSWERS, journey);
    expect(afterPublish).toBe(beforePublish);
  });

  it("a title the Host edited in Review is the one that publishes", () => {
    // The edit writes the canonical field; publish reads it. No stale first title, no model title.
    const edited = { ...ANSWERS, title: EDITED_TITLE } as BuilderAnswers;
    const journey = journeyWith(MODEL_TITLE);
    expect(publishedTrainingTitle(edited, journey)).toBe(EDITED_TITLE);
    expect(publishedTrainingTitle(edited, journey)).not.toBe(HOST_TITLE);
    expect(publishedTrainingTitle(edited, journey)).not.toBe(MODEL_TITLE);
  });

  it("whitespace is trimmed, not treated as a title", () => {
    const blank = { ...ANSWERS, title: "   " } as BuilderAnswers;
    expect(publishedTrainingTitle(blank, journeyWith(MODEL_TITLE))).toBe(MODEL_TITLE);
    const padded = { ...ANSWERS, title: `  ${HOST_TITLE}  ` } as BuilderAnswers;
    expect(publishedTrainingTitle(padded, journeyWith(MODEL_TITLE))).toBe(HOST_TITLE);
  });
});

describe("[Title Authority V1] legacy drafts are not renamed", () => {
  it("a draft with no authored title still publishes under its journey title", () => {
    /*
      §6 — NO RETROACTIVE RENAME. Drafts authored before Step 1 asked for a name carry
      `title: undefined`, and `draftTitleFrom` would fall back to the PROBLEM's first line. Using
      that fallback here would rename historical trainings after a recurring-condition sentence,
      which is the defect Slice 3.2R-R2.1 removed from the learner-facing seed. The fallback is
      the journey's own title, so nothing about an old training changes.
    */
    const legacy = { ...ANSWERS, title: undefined } as unknown as BuilderAnswers;
    expect(publishedTrainingTitle(legacy, journeyWith(MODEL_TITLE))).toBe(MODEL_TITLE);
  });

  it("with neither a Host title nor a journey, it falls back exactly as before", () => {
    const legacy = { ...ANSWERS, title: undefined } as unknown as BuilderAnswers;
    // The non-journey publish path is untouched by this slice: problem-derived, as it always was.
    expect(publishedTrainingTitle(legacy, null)).toBe(ANSWERS.problem);
  });
});

describe("[Title Authority V1] proposal identity is untouched", () => {
  it("the journey digest does not move when the Host names the training", () => {
    /*
      THE GUARD ON THE REPAIR ITSELF. If a future change routes the Host's title back into
      `displayTitle`, this fails — and it should, because that is the change that reintroduces
      `proposal_mismatch` on every fresh adoption.
    */
    const required = requiredProgramKinds(ANSWERS);
    const modelTitled = journeyWith(MODEL_TITLE);
    const renamed = { ...ANSWERS, title: EDITED_TITLE } as BuilderAnswers;

    // Naming the training changes the published title …
    expect(publishedTrainingTitle(renamed, modelTitled)).toBe(EDITED_TITLE);
    // … and changes NOTHING about the journey that adoption hashes.
    expect(journeyDigest(modelTitled, required)).toBe(journeyDigest(journeyWith(MODEL_TITLE), required));
    expect(modelTitled.displayTitle).toBe(MODEL_TITLE);
  });

  it("displayTitle is still what the digest is computed over", () => {
    const required = requiredProgramKinds(ANSWERS);
    expect(journeyDigest(journeyWith(MODEL_TITLE), required)).not.toBe(
      journeyDigest(journeyWith(EDITED_TITLE), required),
    );
  });
});
