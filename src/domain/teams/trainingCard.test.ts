/**
 * Teams training cards and their actions. Slice Teams Chat-Native Text Training + Quiz V1.
 *
 * The security property proved here is about what a card MAY CARRY and what an action MAY SAY: a
 * card's data round-trips through a client, so on the way back it is attacker input.
 */
import { describe, it, expect } from "vitest";
import {
  BTY_TRAINING_VERBS,
  QUIZ_CHOICE_INPUT_ID,
  adaptiveCardResponse,
  buildCompletionCard,
  buildNoticeCard,
  buildQuestionCard,
  buildReadCard,
  parseTrainingCardAction,
} from "./trainingCard";

const DELIVERY = "5f1c2a3b-0000-4000-8000-00000000abcd";
const QUESTION = {
  text: "How soon must an incident be reported?",
  choices: [
    { id: "a", label: "Within 24 hours" },
    { id: "b", label: "Within a week" },
  ],
};

const json = (v: unknown) => JSON.stringify(v);

describe("the card never carries an answer key or an internal identifier", () => {
  it("a question card contains the choices but nothing about correctness", () => {
    const card = buildQuestionCard({ deliveryId: DELIVERY, questionIndex: 0, total: 5, question: QUESTION });
    const s = json(card);
    expect(s).toContain("Within 24 hours");
    expect(s).not.toContain("correctChoiceId");
    expect(s).not.toMatch(/correct/i);
    expect(s).not.toContain("explanation");
  });

  it("no card carries an event id, a user id, a tenant, an email or a score", () => {
    for (const card of [
      buildReadCard({ deliveryId: DELIVERY, title: "Morning Office Opening", materialText: "Escalate within 24 hours." }),
      buildQuestionCard({ deliveryId: DELIVERY, questionIndex: 1, total: 5, question: QUESTION }),
    ]) {
      const s = json(card);
      expect(s).not.toMatch(/eventId|event_id/);
      expect(s).not.toMatch(/userId|user_id|aadObjectId|tenant/i);
      expect(s).not.toMatch(/@/);
      expect(s).not.toMatch(/scorePercent|correctCount/);
      // The only identifier is the opaque delivery handle.
      expect(s).toContain(DELIVERY);
    }
  });

  it("the completion card states a fact — no pass, fail, label, ranking or link", () => {
    const card = buildCompletionCard({ correctCount: 4, totalCount: 5, scorePercent: 80 }) as {
      body: unknown[];
      actions?: unknown[];
    };
    // The BODY is what the learner reads. (`$schema` is the Adaptive Card declaration, not a link.)
    const body = json(card.body).toLowerCase();
    expect(body).toContain("4 / 5");
    expect(body).toContain("80%");
    for (const banned of ["pass", "fail", "good", "poor", "rank", "mastery", "http", "save", "sign in", "claim", "xp"]) {
      expect(body, banned).not.toContain(banned);
    }
    // Nothing to press: a terminal card has no actions at all.
    expect(card.actions).toBeUndefined();
  });
});

describe("universal actions, with the documented fallback", () => {
  it("every action is Action.Execute with an Action.Submit fallback carrying the same verb", () => {
    const card = buildReadCard({ deliveryId: DELIVERY, title: "T", materialText: "M" }) as {
      actions: { type: string; verb: string; data: Record<string, unknown>; fallback: { type: string; data: Record<string, unknown> } }[];
    };
    const action = card.actions[0]!;
    expect(action.type).toBe("Action.Execute");
    expect(action.verb).toBe(BTY_TRAINING_VERBS.read);
    expect(action.fallback.type).toBe("Action.Submit");
    // The fallback must be self-describing: a Submit arrives with no verb of its own.
    expect(action.fallback.data.verb).toBe(BTY_TRAINING_VERBS.read);
    expect(action.data.verb).toBe(BTY_TRAINING_VERBS.read);
  });

  it("the question card submits a single-choice input, expanded for mobile", () => {
    const card = buildQuestionCard({ deliveryId: DELIVERY, questionIndex: 2, total: 5, question: QUESTION }) as {
      body: Record<string, unknown>[];
      actions: { data: Record<string, unknown> }[];
    };
    const input = card.body.find((b) => b.type === "Input.ChoiceSet")!;
    expect(input.id).toBe(QUIZ_CHOICE_INPUT_ID);
    expect(input.isMultiSelect).toBe(false);
    expect(input.style).toBe("expanded");
    expect(card.actions[0]!.data.questionIndex).toBe(2);
  });

  it("the invoke response is the documented envelope, so the card replaces itself in place", () => {
    const res = adaptiveCardResponse(buildNoticeCard("hi"));
    expect(res.statusCode).toBe(200);
    expect(res.type).toBe("application/vnd.microsoft.card.adaptive");
    expect((res.value as { type: string }).type).toBe("AdaptiveCard");
  });
});

describe("parsing an action — both shapes, one grammar", () => {
  const execute = (data: Record<string, unknown>, verb?: string) => ({
    name: "adaptiveCard/action",
    value: { action: { type: "Action.Execute", verb: verb ?? data.verb, data } },
  });
  const submit = (data: Record<string, unknown>) => ({ type: "message", value: data });

  it("reads an Action.Execute", () => {
    expect(parseTrainingCardAction(execute({ deliveryId: DELIVERY }, BTY_TRAINING_VERBS.read))).toEqual({
      ok: true, verb: BTY_TRAINING_VERBS.read, deliveryId: DELIVERY, questionIndex: null, choiceId: null,
    });
  });

  it("reads the Action.Submit compatibility shape", () => {
    expect(parseTrainingCardAction(submit({ verb: BTY_TRAINING_VERBS.read, deliveryId: DELIVERY }))).toMatchObject({
      ok: true, verb: BTY_TRAINING_VERBS.read, deliveryId: DELIVERY,
    });
  });

  it("reads an answer, with the index the card believed it was showing", () => {
    expect(
      parseTrainingCardAction(execute({ deliveryId: DELIVERY, questionIndex: 3, [QUIZ_CHOICE_INPUT_ID]: "b" }, BTY_TRAINING_VERBS.answer)),
    ).toEqual({ ok: true, verb: BTY_TRAINING_VERBS.answer, deliveryId: DELIVERY, questionIndex: 3, choiceId: "b" });
  });

  it("★ refuses any verb outside the allow-list", () => {
    for (const verb of ["btyAdmin", "btyQuizScore", "delete", "", "BTYTRAININGREAD", "btyTrainingRead ", null, 7]) {
      expect(parseTrainingCardAction(execute({ deliveryId: DELIVERY }, verb as string)), String(verb)).toMatchObject({
        ok: false,
      });
    }
  });

  it("★ refuses a delivery id that is not a uuid — a card cannot name a row by guessing", () => {
    for (const id of ["", "1", "not-a-uuid", "../../admin", DELIVERY + "x", null, 42, {}]) {
      expect(
        parseTrainingCardAction(execute({ deliveryId: id, verb: BTY_TRAINING_VERBS.read })),
        String(id),
      ).toEqual({ ok: false, code: "bad_delivery" });
    }
  });

  it("★ an action carrying identity or a score is parsed WITHOUT any of it", () => {
    const parsed = parseTrainingCardAction(
      execute(
        {
          deliveryId: DELIVERY,
          questionIndex: 0,
          [QUIZ_CHOICE_INPUT_ID]: "a",
          // Everything an attacker might hope is believed:
          userId: "user-B", user_id: "user-B", tenantId: "other", aadObjectId: "other-oid",
          eventId: "ev-1", participantId: "pt-1", score: 100, correctCount: 5, correctChoiceId: "a",
        },
        BTY_TRAINING_VERBS.answer,
      ),
    );
    expect(parsed).toEqual({
      ok: true, verb: BTY_TRAINING_VERBS.answer, deliveryId: DELIVERY, questionIndex: 0, choiceId: "a",
    });
    // The parse result has no room for any of it.
    expect(Object.keys(parsed as object).sort()).toEqual(["choiceId", "deliveryId", "ok", "questionIndex", "verb"]);
  });

  it("refuses a malformed answer rather than guessing a position", () => {
    for (const bad of [
      { deliveryId: DELIVERY, [QUIZ_CHOICE_INPUT_ID]: "a" },
      { deliveryId: DELIVERY, questionIndex: -1, [QUIZ_CHOICE_INPUT_ID]: "a" },
      { deliveryId: DELIVERY, questionIndex: 99, [QUIZ_CHOICE_INPUT_ID]: "a" },
      { deliveryId: DELIVERY, questionIndex: 1 },
      { deliveryId: DELIVERY, questionIndex: 1, [QUIZ_CHOICE_INPUT_ID]: "" },
    ]) {
      expect(parseTrainingCardAction(execute(bad, BTY_TRAINING_VERBS.answer)), json(bad)).toEqual({
        ok: false, code: "bad_answer",
      });
    }
  });

  it("is not fooled by an activity that is neither shape", () => {
    for (const a of [null, undefined, {}, { name: "composeExtension/submitAction" }, { type: "message" }, "x", 5]) {
      expect(parseTrainingCardAction(a)).toMatchObject({ ok: false });
    }
  });
});
