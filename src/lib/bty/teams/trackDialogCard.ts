/**
 * The "Track with BTY" dialog — a pure card builder. Slice A1.
 *
 * ONE dialog, two questions, one button. No follow-up timing, no AI rewrite, no Practice
 * selection, no deadline, no scoring, no advanced audience rules — every one of those is a later
 * decision that would make this one harder to answer.
 *
 * ★ THE AUDIENCE CONTROL IS THE WHOLE DESIGN.
 *
 * `graph.microsoft.com/users?scope=currentContext` searches "within the members of the current
 * conversation, such as chat or channel in which the particular card is sent". That matters for
 * three reasons, and the third is the one that made it the choice:
 *
 *   1. It needs NO Graph permission of BTY's own — the Teams client resolves the dataset.
 *   2. On submit it returns Microsoft Entra IDs, which is exactly the identity BTY already
 *      resolves on. No email, no UPN, no Bot Framework address.
 *   3. It makes selecting someone OUTSIDE the conversation structurally impossible, rather than
 *      something BTY has to filter for afterwards.
 *
 * WHAT IT CANNOT DO, AND WHY THERE IS NO "EVERYONE HERE". A picker searches; it does not
 * enumerate. There is no roster call behind it and no count. So V1 offers only "choose people" —
 * an "Everyone here — 12" that BTY could not verify would be a denominator it invented.
 */

const ADAPTIVE_CARD = "application/vnd.microsoft.card.adaptive";

/** The dataset that scopes the picker to this conversation. Exact string; a typo silently widens it. */
export const PEOPLE_PICKER_CURRENT_CONTEXT = "graph.microsoft.com/users?scope=currentContext";

export const TRACK_FIELD_FRAMING = "hostFraming" as const;
export const TRACK_FIELD_RECIPIENTS = "recipients" as const;

const COPY = {
  title: "Track with BTY",
  framingLabel: "What should they know or do?",
  framingPlaceholder: "In your own words",
  audienceLabel: "Who should respond?",
  submit: "Track",
} as const;

/**
 * The dialog Teams renders for `composeExtension/fetchTask` on the Track command.
 *
 * `continue` with an Adaptive Card, matching the shape T1 already proved on device: a `message`
 * response rendered NOTHING on the Founder's iPhone on invokes that were otherwise completely
 * successful, so this integration returns cards.
 */
export function trackDialogCard() {
  return {
    title: COPY.title,
    height: "medium",
    width: "medium",
    card: {
      contentType: ADAPTIVE_CARD,
      content: {
        $schema: "http://adaptivecards.io/schemas/adaptive-card.json",
        type: "AdaptiveCard",
        // 1.2 is the version the People Picker extension is specified against.
        version: "1.2",
        body: [
          { type: "TextBlock", text: COPY.framingLabel, wrap: true, weight: "Bolder" },
          {
            type: "Input.Text",
            id: TRACK_FIELD_FRAMING,
            isMultiline: true,
            maxLength: 1000,
            placeholder: COPY.framingPlaceholder,
          },
          { type: "TextBlock", text: COPY.audienceLabel, wrap: true, weight: "Bolder" },
          {
            type: "Input.ChoiceSet",
            id: TRACK_FIELD_RECIPIENTS,
            // Empty static choices + a dynamic dataset is the documented People Picker shape.
            choices: [],
            "choices.data": { type: "Data.Query", dataset: PEOPLE_PICKER_CURRENT_CONTEXT },
            isMultiSelect: true,
          },
        ],
        actions: [{ type: "Action.Submit", title: COPY.submit }],
      },
    },
  };
}

/** Measured on a phone, not chosen for looks — see the note inside. */
export const TRACK_CONFIRM_HEIGHT = 170;

/** The one-line confirmation after a successful Track. Calm, and it states the denominator. */
export function trackConfirmationCard(count: number) {
  const people = count === 1 ? "1 person" : `${count} people`;
  return {
    // No `title` — see the note on the Save confirmation. Teams already attributes this to BTY.
    /*
      ★ DEVICE-GATED EXPERIMENT (2026-09-07): an explicit pixel height, because Teams iOS renders
      this inside a nearly full-height sheet even at "small" and the empty space is the DIALOG
      CONTAINER rather than card padding. 170 rather than Save's 130 because this receipt carries a
      second line — the destination guidance, which is navigation and stays.

      The SETUP dialog above is untouched at medium/medium: it holds a people picker and a text
      input, and shrinking it would be a different change with a different risk.
    */
    height: TRACK_CONFIRM_HEIGHT,
    width: "small",
    card: {
      contentType: ADAPTIVE_CARD,
      content: {
        $schema: "http://adaptivecards.io/schemas/adaptive-card.json",
        type: "AdaptiveCard",
        version: "1.4",
        body: [
          { type: "TextBlock", text: "\u2713 Tracking started", wrap: true },
          /*
            ★ SAY WHERE IT WENT, STILL. A confirmation that only says "done" leaves the person to
            guess whether BTY kept anything and where to look -- measured: a real Track succeeded
            and the Host went looking for it and found nothing. The destination is part of the
            receipt, so it survives the 2026-09-07 lightening; only the HEADLINE became a check
            mark, and the denominator moved down beside the destination instead of competing with it.
          */
          {
            type: "TextBlock",
            text: `${people} \u00b7 See it in Today \u2192 Tracking.`,
            wrap: true,
            isSubtle: true,
            spacing: "Small",
          },
        ],
      },
    },
  };
}
