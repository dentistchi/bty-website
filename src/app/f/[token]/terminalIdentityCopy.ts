import { isFollowUpDays, type FollowUpDays } from "@/domain/foundry/followup/followUpObligation";

/**
 * WHAT SIGNING IN IS ACTUALLY FOR (Slice R4-R3B1).
 *
 * An anonymous learner who finishes a training was told one thing: "10 Core XP is ready to save."
 * Measured in production, 27 of 39 completions declined it — and 17 of those sit in trainings whose
 * Host DID set a 7- or 30-day checkpoint, so the follow-up they were owed can never reach them. The
 * product had a reason to ask for identity and never said it out loud.
 *
 * ONE MODULE, THREE ROOMS. The video, document and guidance clients each carry their own copy
 * dictionary, and this sentence has to mean the same thing in all three. Held here so it cannot
 * drift — the alternative is the same promise written three times and corrected twice.
 *
 * THE TRUTH CONSTRAINTS, AND WHY THE WORDING IS SHAPED THIS WAY:
 *
 *   1. `isFollowUpDays` IS THE AUTHORITY, ASKED NOT RESTATED. It is the same predicate
 *      `materializeFollowupObligation` asks before creating an obligation, so this screen can never
 *      promise a check-in the writer would refuse to create. R4-R3A-R1 is the standing reason: the
 *      follow-up question is answered by `followUpDays` and by nothing else — never by the Journey,
 *      never by `action_decision`.
 *
 *   2. NO COUNTDOWN, EVER. `computeFollowUpDue` anchors the due date on `completed_at`, and the
 *      claim path passes the STORED completion instant — so a learner who finishes today and signs
 *      in on day 10 of a 7-day checkpoint receives a follow-up that is already due. "We'll check in
 *      with you in 7 days" would therefore be false for exactly the people this slice is trying to
 *      reach. So the copy states a PROPERTY OF THE TRAINING ("this training includes a 7-day
 *      follow-up") and an ACTION ("signing in connects it to you"), both of which stay true whether
 *      the learner signs in in ten seconds or ten days.
 *
 *   3. NO CHECKPOINT, NO PROMISE. `followUp` is null for 0, absent, out-of-domain and no-module-row
 *      alike, and every one of those rooms says nothing about a follow-up at all.
 *
 *   4. THE COMPLETION LINE IS UNCONDITIONAL. Completion is durable the moment the server writes
 *      `completed_at`, with or without an account — but a screen whose only verb is "save" implies
 *      the opposite, that finishing is at risk until you sign in. It is not, and saying so is what
 *      makes the follow-up reason land as something to gain rather than something to rescue.
 */

export type TerminalLocale = "en" | "ko";

export type TerminalIdentityCopy = {
  /** Always shown in the not-yet-claimed state: finishing is already durable. */
  completionSaved: string;
  /** Null when no checkpoint is configured — then nothing about follow-up is shown at all. */
  followUp: { meaning: string; signInReason: string; xpSecondary: string } | null;
};

const EN = {
  completionSaved: "Your completion is already saved.",
  meaning: (days: FollowUpDays) => `This training includes a ${days}-day follow-up.`,
  signInReason: "Sign in so we can connect that follow-up to you.",
  xpSecondary: "Your 10 Core XP will be saved too.",
};

const KO = {
  completionSaved: "완료 기록은 이미 저장되었습니다.",
  /* Korean needs no plural inflection; 일 is correct for both 7 and 30. */
  meaning: (days: FollowUpDays) => `이 훈련에는 ${days}일 후속 확인이 있습니다.`,
  signInReason: "로그인하면 그 후속 확인을 연결할 수 있습니다.",
  xpSecondary: "코어 XP 10도 함께 저장됩니다.",
};

/**
 * Build the terminal identity copy from the frozen snapshot value.
 *
 * `raw` is `snapshot.follow_up_days` — passed through unwidened so the authority, not the caller,
 * decides what counts. A room whose Host set no checkpoint gets `followUp: null` and says nothing.
 */
export function terminalIdentityCopy(raw: unknown, locale: TerminalLocale): TerminalIdentityCopy {
  const t = locale === "ko" ? KO : EN;
  if (!isFollowUpDays(raw)) return { completionSaved: t.completionSaved, followUp: null };
  return {
    completionSaved: t.completionSaved,
    followUp: { meaning: t.meaning(raw), signInReason: t.signInReason, xpSecondary: t.xpSecondary },
  };
}

/**
 * THE CODE AN ANONYMOUS FINISHER KEEPS (Deferred Completion Claim V1).
 *
 * ALWAYS VISIBLE, NEVER BEHIND A TAP. The measured failure is that learners leave without taking
 * another action — 30 of 45 completions carry no account. Putting the code behind a disclosure
 * would recreate exactly that, one step earlier. It is rendered as SECONDARY text under the
 * completion, and it blocks nothing: the exit is still the primary control.
 *
 * WHAT IT HAS TO ANSWER, in four lines and no BTY vocabulary: I finished · I do not have to sign
 * in now · I can connect this later · this is the one thing to keep.
 */
export type ClaimCodeCopy = { lead: string; validity: string; label: string };

export function claimCodeCopy(locale: TerminalLocale): ClaimCodeCopy {
  return locale === "ko"
    ? {
        lead: "나중에 내 계정에 연결하려면 이 코드를 저장해 두세요.",
        validity: "90일 동안 한 번 사용할 수 있습니다.",
        label: "완료 코드",
      }
    : {
        lead: "Save this code to add this training to your account later.",
        validity: "It works once, for 90 days.",
        label: "Completion code",
      };
}
