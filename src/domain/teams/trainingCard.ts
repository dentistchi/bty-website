/**
 * Teams chat-native training — Adaptive Cards and their actions. PURE.
 * Slice Teams Chat-Native Text Training + Quiz V1.
 *
 * WHY THE TRAINING LIVES IN A CHAT AT ALL. Repeated real-iPhone evidence showed Teams iOS controls
 * the personal-tab HTTPS handoff and does not reliably preserve a training destination: the app
 * opened, the training did not. So the internal path stops asking it to. The BTY bot sends the
 * text and the quiz as cards, the employee answers them where they already are, and no browser,
 * no Safari and no second sign-in is involved at any point.
 *
 * ★ WHAT A CARD IS ALLOWED TO CARRY.
 *
 * A card's action data travels to the client and back, so it is treated as attacker-controllable
 * on the way back. It therefore carries exactly two kinds of thing:
 *
 *   - the OPAQUE delivery id — a random uuid that names one (training, recipient) pair and is
 *     meaningless without the server row it points at;
 *   - fixed BTY verbs and the learner's own answer.
 *
 * It never carries an event id, a user id, a tenant id, an address, a score, a total, or a correct
 * answer. The answer key is not in the card, not in the session, and not in any payload the client
 * can see — it is read server-side from the immutable event quiz at scoring time.
 *
 * UNIVERSAL ACTIONS, WITH THE DOCUMENTED FALLBACK. `Action.Execute` is the current Teams contract
 * and is what lets one card evolve in place instead of the bot posting five messages. Older clients
 * that do not know it use the `fallback` `Action.Submit`, which carries the same verb in its data.
 */

/** The only verbs this integration answers to. Anything else is refused. */
export const BTY_TRAINING_VERBS = {
  read: "btyTrainingRead",
  answer: "btyQuizAnswer",
  resume: "btyQuizResume",
} as const;

export type BtyTrainingVerb = (typeof BTY_TRAINING_VERBS)[keyof typeof BTY_TRAINING_VERBS];

const VERB_VALUES: readonly string[] = Object.values(BTY_TRAINING_VERBS);

export const ADAPTIVE_CARD_CONTENT_TYPE = "application/vnd.microsoft.card.adaptive";
export const TEAMS_INVOKE_ADAPTIVE_CARD_ACTION = "adaptiveCard/action" as const;

/** The field name the single-choice input submits under. */
export const QUIZ_CHOICE_INPUT_ID = "btyChoice";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type TrainingCardAction =
  | { ok: true; verb: BtyTrainingVerb; deliveryId: string; questionIndex: number | null; choiceId: string | null }
  | { ok: false; code: "not_a_card_action" | "unknown_verb" | "bad_delivery" | "bad_answer" };

function asRecord(v: unknown): Record<string, unknown> | null {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
}

/**
 * Read a card action out of an activity — BOTH shapes, one grammar.
 *
 *   Action.Execute  `activity.name = "adaptiveCard/action"`, data under `value.action.data`
 *   Action.Submit   an ordinary message activity whose `value` IS the data
 *
 * TOTAL and CLOSED. An unknown verb, a delivery id that is not a uuid, or an answer without a
 * question index all refuse by CODE rather than throwing, and the caller turns the code into a
 * calm sentence. The verb allow-list is checked here so a future verb cannot be answered by
 * accident.
 */
export function parseTrainingCardAction(activity: unknown): TrainingCardAction {
  const a = asRecord(activity);
  if (!a) return { ok: false, code: "not_a_card_action" };

  let data: Record<string, unknown> | null = null;
  let verbRaw: unknown = null;

  if (a.name === TEAMS_INVOKE_ADAPTIVE_CARD_ACTION) {
    const action = asRecord(asRecord(a.value)?.action);
    if (!action) return { ok: false, code: "not_a_card_action" };
    data = asRecord(action.data) ?? {};
    verbRaw = action.verb ?? data.verb;
  } else if (a.type === "message") {
    // The documented Action.Submit compatibility path: the data arrives as the activity value.
    data = asRecord(a.value);
    if (!data) return { ok: false, code: "not_a_card_action" };
    verbRaw = data.verb;
  } else {
    return { ok: false, code: "not_a_card_action" };
  }

  if (typeof verbRaw !== "string" || !VERB_VALUES.includes(verbRaw)) {
    return { ok: false, code: "unknown_verb" };
  }
  const verb = verbRaw as BtyTrainingVerb;

  const deliveryId = typeof data.deliveryId === "string" ? data.deliveryId.trim() : "";
  if (!UUID.test(deliveryId)) return { ok: false, code: "bad_delivery" };

  if (verb !== BTY_TRAINING_VERBS.answer) {
    return { ok: true, verb, deliveryId, questionIndex: null, choiceId: null };
  }

  /*
    THE ANSWER. `questionIndex` is the position the CARD believed it was showing; the server
    compares it with the session's own index and refuses a mismatch, which is what makes a replayed
    or out-of-order card inert. The choice id is validated against the real question server-side —
    this only checks it is a plausible token, never that it is correct.
  */
  const rawIndex = data.questionIndex;
  const questionIndex = typeof rawIndex === "number" ? rawIndex : Number.parseInt(String(rawIndex ?? ""), 10);
  if (!Number.isInteger(questionIndex) || questionIndex < 0 || questionIndex > 19) {
    return { ok: false, code: "bad_answer" };
  }
  const rawChoice = data[QUIZ_CHOICE_INPUT_ID] ?? data.choiceId;
  const choiceId = typeof rawChoice === "string" ? rawChoice.trim() : "";
  if (!choiceId || choiceId.length > 64) return { ok: false, code: "bad_answer" };

  return { ok: true, verb, deliveryId, questionIndex, choiceId };
}

// ---------------------------------------------------------------------------
// Card builders
// ---------------------------------------------------------------------------

type Card = Record<string, unknown>;

const shell = (body: unknown[], actions: unknown[] = []): Card => ({
  $schema: "http://adaptivecards.io/schemas/adaptive-card.json",
  type: "AdaptiveCard",
  // 1.4 is what this repository's existing Teams card already targets.
  version: "1.4",
  body,
  ...(actions.length > 0 ? { actions } : {}),
});

/** An Action.Execute with the documented Action.Submit fallback carrying the same verb. */
function universalAction(input: { title: string; verb: BtyTrainingVerb; data: Record<string, unknown> }) {
  const data = { ...input.data, verb: input.verb };
  return {
    type: "Action.Execute",
    title: input.title,
    verb: input.verb,
    data,
    fallback: { type: "Action.Submit", title: input.title, data },
  };
}

export type TrainingCardCopy = {
  readCta: string;
  next: string;
  questionOf: (n: number, total: number) => string;
  completeTitle: string;
  viewInMyLearning: string;
  readLead: string;
};

export const TRAINING_CARD_COPY: Record<"en" | "ko", TrainingCardCopy> = {
  en: {
    readCta: "I've read this",
    next: "Next",
    questionOf: (n, total) => `Question ${n} of ${total}`,
    completeTitle: "Training complete",
    viewInMyLearning: "View in My Learning",
    readLead: "Read this first:",
  },
  ko: {
    readCta: "읽었습니다",
    next: "다음",
    questionOf: (n, total) => `${total}문제 중 ${n}번`,
    completeTitle: "훈련 완료",
    viewInMyLearning: "내 학습에서 보기",
    readLead: "먼저 아래 내용을 읽어 주세요:",
  },
};

/** The opening card: the training's name, the Host's own text, and one acknowledgement. */
export function buildReadCard(input: {
  deliveryId: string;
  title: string;
  materialText: string;
  locale?: "en" | "ko";
}): Card {
  const t = TRAINING_CARD_COPY[input.locale ?? "en"];
  return shell(
    [
      { type: "TextBlock", text: input.title, wrap: true, weight: "Bolder", size: "Medium" },
      { type: "TextBlock", text: t.readLead, wrap: true, isSubtle: true, spacing: "Small" },
      { type: "TextBlock", text: input.materialText, wrap: true, spacing: "Small" },
    ],
    [universalAction({ title: t.readCta, verb: BTY_TRAINING_VERBS.read, data: { deliveryId: input.deliveryId } })],
  );
}

/**
 * One question. The choices carry their ids as values — NOT their correctness, which is not in
 * this object and never reaches a client.
 */
export function buildQuestionCard(input: {
  deliveryId: string;
  questionIndex: number;
  total: number;
  question: { text: string; choices: { id: string; label: string }[] };
  locale?: "en" | "ko";
}): Card {
  const t = TRAINING_CARD_COPY[input.locale ?? "en"];
  return shell(
    [
      {
        type: "TextBlock",
        text: t.questionOf(input.questionIndex + 1, input.total),
        wrap: true,
        isSubtle: true,
        size: "Small",
      },
      { type: "TextBlock", text: input.question.text, wrap: true, weight: "Bolder", spacing: "Small" },
      {
        type: "Input.ChoiceSet",
        id: QUIZ_CHOICE_INPUT_ID,
        // Expanded single-select: radio buttons, which is the mobile-safe shape in a Teams card.
        style: "expanded",
        isMultiSelect: false,
        choices: input.question.choices.map((c) => ({ title: c.label, value: c.id })),
      },
    ],
    [
      universalAction({
        title: t.next,
        verb: BTY_TRAINING_VERBS.answer,
        data: { deliveryId: input.deliveryId, questionIndex: input.questionIndex },
      }),
    ],
  );
}

/**
 * The terminal card. A FACT — no pass, no fail, no label, no ranking, and nothing to sign in to.
 *
 * ★ IT STILL DOES NOT REVIEW THE QUIZ, AND MUST NOT. A chat is a stream; the question a learner
 * asks three weeks later — what did I get wrong, and why — belongs where they return, which is My
 * Learning. Putting the review here would build a second, worse copy of that surface inside a
 * conversation nobody scrolls back through.
 *
 * ★ THE ONE LINK (Slice My Learning — Canonical Training History V1). `reviewUrl` is OPTIONAL and,
 * when present, opens the BTY Personal App at THIS training's detail — never a web page. A caller
 * with nothing specific to open passes nothing and the card stays exactly as it was: the bot is
 * the trigger, the app is the experience, and a generic link into a browser is neither.
 */
export function buildCompletionCard(input: {
  correctCount: number;
  totalCount: number;
  scorePercent: number;
  locale?: "en" | "ko";
  /** Teams personal-app deep link to this completed training. A web URL is not accepted. */
  reviewUrl?: string | null;
}): Card {
  const t = TRAINING_CARD_COPY[input.locale ?? "en"];
  const card = shell([
    { type: "TextBlock", text: t.completeTitle, wrap: true, weight: "Bolder", size: "Medium" },
    {
      type: "TextBlock",
      text: `${input.correctCount} / ${input.totalCount}`,
      wrap: true,
      size: "ExtraLarge",
      spacing: "Small",
    },
    { type: "TextBlock", text: `${input.scorePercent}%`, wrap: true, isSubtle: true, spacing: "None" },
  ]);
  /*
    ONLY A PERSONAL-APP LINK EARNS A BUTTON. A `https://arena.btydaily.com/...` URL here would
    open a browser from inside Teams, which is the exact escape this product forbids — so the
    check is on the value, not on the caller's good intentions.
  */
  const review = (input.reviewUrl ?? "").trim();
  if (review.startsWith("https://teams.microsoft.com/l/entity/")) {
    card.actions = [{ type: "Action.OpenUrl", title: t.viewInMyLearning, url: review }];
  }
  return card;
}

/** A calm one-line card, for every refusal and for the unsupported material types. */
export function buildNoticeCard(text: string): Card {
  return shell([{ type: "TextBlock", text, wrap: true }]);
}

/** The documented `adaptiveCard/action` response envelope: the next card, rendered in place. */
export function adaptiveCardResponse(card: Card) {
  return { statusCode: 200, type: ADAPTIVE_CARD_CONTENT_TYPE, value: card };
}
