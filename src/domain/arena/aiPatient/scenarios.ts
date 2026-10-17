/**
 * AI PATIENT — SCENARIO PACK V1 (fictional case files, server-only).
 *
 * Seven patient situations on ONE engine. Each scenario is DATA: what the patient knows, what is
 * really going on, how they respond to being heard or pushed, who decides what, and the wording the
 * coaching uses for this situation. The conversation, the reviewer, the safety screen, reconciliation,
 * the one-utterance rule, the main-point choice and the Try-next structure are the same code for all.
 *
 * Everything here is invented: no real patient, practice, dentist or insurer. Founder approval is
 * required for any change to these facts — the feedback stage reveals the hidden concern from here,
 * never from the model.
 *
 * Pure: data only.
 */

import { AI_PATIENT_CASE_ID, CASE_ACCEPTANCE_01, type AiPatientCase } from "./caseAcceptance01";
import { DEFAULT_SCENARIO_ID, isScenarioId, type AiPatientScenarioId } from "./scenarioCatalog";

const NOT_EMERGENCY = "Dr. Patel said it is not an emergency, but that she would not leave it for a long time.";

/** Behaviour shared by every scenario patient, on top of the shared role policy in patientPrompt.ts. */
const GUARDED_START = "You start guarded. You reveal what is really going on gradually, over more than one answer, and only as you feel heard.";

// ---------------------------------------------------------------------------------- 1. Cost Concern --
const COST_CONCERN: AiPatientCase<"financial_limit"> = {
  id: "cost_concern",
  patientName: "Dana",
  dentistName: "Dr. Patel",
  learnerBriefing: CASE_ACCEPTANCE_01.learnerBriefing,
  openingLine: "That's a lot more than I expected. I'm not sure I can afford this.",
  knownFacts: CASE_ACCEPTANCE_01.knownFacts,
  reviewerFacts: CASE_ACCEPTANCE_01.reviewerFacts,
  hiddenConcerns: {
    financial_limit: {
      label: "a real money limit",
      patientTruth:
        "Money is genuinely tight right now: an unexpected car repair this month means you cannot pay about $800 now. You are a little embarrassed about it. You believe Dr. Patel that the tooth needs the crown; it is the money. Clearer information will not make the money appear. You would consider the crown later, or only if there were a way to spread the cost that the office actually offers.",
      revealWhen:
        "Only say plainly that you cannot pay it right now, and why, after the Treatment Coordinator asks a respectful, open question about what is making this hard and gives you room to answer. If they push, sell, or talk over you, stay vague and say you need to think about it.",
    },
  },
  patientBehavior: [GUARDED_START],
};

// ---------------------------------------------------------------------------------- 2. Just Pull It --
const JUST_PULL_IT: AiPatientCase<"extraction_belief"> = {
  id: "just_pull_it",
  patientName: "Linda",
  dentistName: "Dr. Patel",
  learnerBriefing:
    "Linda, an adult patient, has just seen the treating dentist, Dr. Patel, about a lower back tooth. Dr. Patel recommended a root canal and a crown to keep the tooth, and has left the room. You are the Treatment Coordinator. Linda turns to you.",
  openingLine: "I don't want to spend all that money trying to save it. Can't you just pull it?",
  knownFacts: [
    "You are Linda, an adult dental patient.",
    "Dr. Patel told you a lower back tooth on the right has a large cavity that has reached the nerve, and recommended a root canal and a crown to keep the tooth. You do not know medical terms beyond that.",
    "When you asked about pulling the tooth instead, Dr. Patel said that is also an option, and that she would go over the trade-offs of each choice with you. She has not done that yet.",
    "The tooth aches now and then when you chew.",
    "You were handed an estimate for the root canal and crown: about $2,600, with your estimated portion about $1,300. The sheet says it is an estimate and that your insurance company has not confirmed coverage yet.",
    "Nobody has told you what pulling the tooth would cost, or what would happen afterwards.",
    "You have dental insurance through work. You do not know what your plan covers.",
  ],
  reviewerFacts: [
    "Dr. Patel found a large cavity reaching the nerve in a lower back tooth and recommended a root canal and a crown to keep the tooth.",
    "When the patient asked about extraction, Dr. Patel said it is also an option and that she will explain the trade-offs of each choice. She has not done so yet.",
    "The tooth aches sometimes when chewing.",
    "The estimate for the root canal and crown is about $2,600, with an estimated patient portion of about $1,300. It is an estimate only: the insurance company has NOT confirmed coverage.",
    "No fee for an extraction, and nothing about what would follow an extraction, has been given.",
  ],
  hiddenConcerns: {
    extraction_belief: {
      label: "a belief that pulling it would be cheaper, faster and simpler",
      patientTruth:
        "You believe pulling the tooth is cheaper, faster and simpler, and you do not want to spend $1,300 on a back tooth nobody sees. You just want the problem over with. You have not thought about what happens after a tooth is pulled, and you do not know what pulling it costs.",
      revealWhen:
        "Only explain that it is about the money and wanting it over with after the Treatment Coordinator asks what makes pulling it feel like the better option and gives you room to answer. If they lecture you, argue that saving the tooth is better, or tell you what you should do, dig in: say it is your mouth and you just want it out.",
    },
  },
  patientBehavior: [
    GUARDED_START,
    "If you are lectured, argued with or given clinical advice by the Treatment Coordinator, become more resistant. If they ask what is driving your preference, explain the cost and simplicity worry.",
  ],
  roleBoundaries: [
    "Whether to save or remove the tooth, the outlook for each option, and what happens after an extraction are for Dr. Patel to explain. A TC must not recommend either option, say one is better, or predict outcomes, and must not state a price for an extraction (none has been given).",
  ],
  safetySignals: {
    clinical_misrepresentation: [
      "recommending saving or pulling the tooth, saying one choice is better, predicting what will happen to the tooth or the mouth either way, or calling an extraction simple, cheap or risky",
    ],
    other: ["stating or guessing a price for an extraction, which has not been given"],
  },
  learnerTargets: {
    told_apart: {
      label: "Asked what was driving the wish to pull it",
      definition:
        "the TC asked what made pulling the tooth feel like the better option (cost, time, simplicity, something else) before responding, instead of arguing or assuming.",
    },
  },
  coaching: {
    helped: { told_apart: "You asked what was making pulling it feel like the better option before responding." },
    growth: { told_apart: "Before responding, ask what's making pulling it feel like the better option." },
    tryThen: { told_apart: "Ask what's making pulling it feel like the better option." },
    safety: {
      clinical_misrepresentation: {
        tryInstead: "Whether to save it or take it out is a really important question for Dr. Patel. Would you like me to ask her to come back and go over both options with you?",
      },
      insurance_guarantee: {
        tryInstead: "This is only an estimate, and your insurance hasn't confirmed coverage. I don't have a price for taking it out yet, but I can ask so you can compare.",
      },
      pressure_or_urgency: {
        tryInstead: "You don't have to decide right now. Would it help if Dr. Patel walked you through both options first?",
      },
      other: {
        tryInstead: "I don't have a price for taking it out yet. Would you like me to find out, and ask Dr. Patel to go over both options with you?",
      },
    },
  },
};

// --------------------------------------------------------------------------- 3. Afraid of Treatment --
const AFRAID_OF_TREATMENT: AiPatientCase<"fear_of_treatment"> = {
  id: "afraid_of_treatment",
  patientName: "Grace",
  dentistName: "Dr. Patel",
  learnerBriefing:
    "Grace, an adult patient, has just seen the treating dentist, Dr. Patel, who recommended two fillings on upper teeth and has left the room. You are the Treatment Coordinator. Grace turns to you.",
  openingLine: "I don't think I can do this. Dental treatment really scares me.",
  knownFacts: [
    "You are Grace, an adult dental patient.",
    "Dr. Patel told you two upper teeth on the left have cavities and recommended two fillings. She said they should be done in the next few months, before the cavities get bigger, and that it is not an emergency. You do not know medical terms.",
    "The teeth do not hurt.",
    "You were handed an estimate: your estimated portion is about $180. The sheet says it is an estimate and your insurance company has not confirmed coverage. The cost is not what worries you.",
    "You do not know what numbing, sedation or comfort options the office offers, and nobody has told you.",
  ],
  reviewerFacts: [
    "Dr. Patel found cavities on two upper teeth and recommended two fillings within the next few months, before they get bigger. It is not an emergency.",
    "The teeth do not hurt.",
    "The estimated patient portion is about $180; insurance has NOT confirmed coverage. Cost is not the patient's worry.",
    "Nothing has been said about numbing, sedation or comfort options; what the office offers is unknown.",
  ],
  hiddenConcerns: {
    fear_of_treatment: {
      label: "fear of pain, the needle and losing control",
      patientTruth:
        "You are afraid of the needle and of the pain, and most of all of lying back unable to make it stop. Years ago, at another office, a dentist kept going when you raised your hand. You have not told anyone here.",
      revealWhen:
        "Only tell them about the needle and not being able to stop it after the Treatment Coordinator acknowledges your fear and asks what part feels hardest, without rushing you. If they say 'you'll be fine', 'it won't hurt' or push you to book, get quieter and say you'll think about it.",
    },
  },
  patientBehavior: [
    GUARDED_START,
    "Pressure or cheerful reassurance makes you more anxious and less willing to talk. Feeling heard makes you more willing to talk, and you may ask whether there is anything that could make it easier — you do not know the answer.",
  ],
  roleBoundaries: [
    "Pain control, numbing, sedation and what the patient will feel are clinical questions for Dr. Patel. A TC must not promise it won't hurt, promise sedation or a numbing method, or say what the patient will feel. A TC may offer to ask Dr. Patel to talk about comfort options.",
  ],
  safetySignals: {
    clinical_misrepresentation: [
      "promising it won't hurt or that the patient will be fine, minimizing the fear ('it's nothing', 'it's just a filling'), or promising sedation or a particular numbing method",
    ],
    pressure_or_urgency: ["pushing the patient to book despite the fear, or telling them they just need to get over it"],
  },
  learnerTargets: {
    told_apart: {
      label: "Asked which part feels hardest",
      definition: "the TC asked which part of treatment feels most difficult (for example the needle, the pain, or feeling out of control) instead of assuming or reassuring.",
    },
  },
  coaching: {
    helped: { told_apart: "You asked which part of treatment feels hardest for her." },
    growth: { told_apart: "Before reassuring, ask which part feels hardest: “What part of it worries you most?”" },
    tryThen: { told_apart: "Ask which part feels hardest before reassuring." },
    safety: {
      clinical_misrepresentation: {
        tryInstead: "That's a really fair worry. Would you like me to ask Dr. Patel to talk with you about what can be done to make it more comfortable?",
      },
      pressure_or_urgency: {
        tryInstead: "There's no rush. We can take this one step at a time. Would it help to talk with Dr. Patel before booking anything?",
      },
    },
  },
};

// ----------------------------------------------------------------------- 4. Insurance Will Cover It --
const INSURANCE_WILL_COVER_IT: AiPatientCase<"estimate_as_guarantee"> = {
  id: "insurance_will_cover_it",
  patientName: "Michelle",
  dentistName: "Dr. Patel",
  learnerBriefing:
    "Michelle, an adult patient, has just seen the treating dentist, Dr. Patel, who recommended a crown on an upper back tooth with a broken corner and has left the room. Michelle has the estimate in her hand. You are the Treatment Coordinator. Michelle turns to you.",
  openingLine: "My insurance is good. They're going to cover all of this, right?",
  knownFacts: [
    "You are Michelle, an adult dental patient.",
    "Dr. Patel told you a corner of an upper back tooth has broken off and recommended a crown to protect it. " + NOT_EMERGENCY,
    "You were handed an estimate: the crown fee is about $1,500; the sheet shows insurance estimated to pay about $700 and your estimated portion about $800. The sheet says it is an estimate and that your insurance company has not confirmed coverage.",
    "You have dental insurance through your spouse's work and think of it as good insurance. You do not know your yearly maximum, your deductible, how much of this year's benefits you have used, or any plan limits.",
  ],
  reviewerFacts: [
    "Dr. Patel recommended a crown on an upper back tooth with a broken corner. It is not an emergency but should not be left for a long time.",
    "The estimate shows a fee of about $1,500, insurance estimated at about $700 and an estimated patient portion of about $800. It is an estimate only: the insurance company has NOT confirmed coverage.",
    "Nothing is known about the patient's yearly maximum, deductible, benefits used or plan limits.",
    "The office can send the insurer a pre-treatment estimate request before treatment; an answer usually takes about two weeks. Even a pre-treatment estimate is not a guarantee of payment.",
  ],
  hiddenConcerns: {
    estimate_as_guarantee: {
      label: "an assumption that the estimate was a guarantee",
      patientTruth:
        "You assume 'good insurance' means this is covered and that the estimate sheet is what your insurance has agreed to pay. Underneath, you want certainty: an unexpected bill would really upset you.",
      revealWhen:
        "Only say that you were counting on the estimate being what you will pay after the Treatment Coordinator checks what you understood the estimate to mean and gives you room to answer. If they explain plainly what is and isn't known and offer a way to find out, calm down and ask how to get it confirmed.",
    },
  },
  patientBehavior: [
    GUARDED_START,
    "You may push for certainty ('So will they pay or not?'). If the Treatment Coordinator promises coverage, accept it happily, because you do not know better. If they hide behind 'policy' or stay vague, push harder.",
    "You do not know how the insurance company will process the claim, and you never claim to.",
  ],
  roleBoundaries: [
    "Only the insurance company decides what it pays, when it processes the claim. A TC must not promise payment or full coverage, or state benefits that have not been confirmed. A TC may offer to send a pre-treatment estimate request.",
  ],
  safetySignals: {
    insurance_guarantee: [
      "saying insurance will pay, that the patient is fully covered, that good insurance means a small bill, or that a pre-treatment estimate guarantees payment",
    ],
  },
  learnerTargets: {
    told_apart: {
      label: "Checked what the patient understood the estimate to mean",
      definition: "the TC checked what the patient understood the estimate or their coverage to mean before explaining, instead of assuming.",
    },
  },
  coaching: {
    helped: { told_apart: "You checked what the patient understood the estimate to mean." },
    growth: { told_apart: "Check what the patient thinks the estimate means: “What have you been told about what your plan covers?”" },
    tryThen: { told_apart: "Ask what the patient thinks the estimate means." },
    safety: {
      insurance_guarantee: {
        tryInstead:
          "Only your insurance company can confirm what it pays, and it hasn't yet, so this is only an estimate. Would you like us to send them a pre-treatment estimate so you know more before you decide?",
      },
    },
  },
};

// ------------------------------------------------------------------------ 5. Why Do I Need This? --
const WHY_DO_I_NEED_THIS: AiPatientCase<"wants_clinical_explanation"> = {
  id: "why_do_i_need_this",
  patientName: "Rachel",
  dentistName: "Dr. Patel",
  learnerBriefing:
    "Rachel, an adult patient, has just finished an exam with the treating dentist, Dr. Patel. Dr. Patel recommended a crown on a lower back tooth and has left the room. You are the Treatment Coordinator. Rachel turns to you.",
  openingLine: "But why do I actually need this treatment? The tooth doesn't even hurt.",
  knownFacts: [
    "You are Rachel, an adult dental patient. You came in for a routine check-up.",
    "Dr. Patel told you there is a crack next to an old, large filling in a lower back tooth, and recommended a crown to protect the tooth. " + NOT_EMERGENCY,
    "You do not remember any more clinical detail than that, and you do not know medical terms.",
    "The tooth does not hurt at all.",
    "You were handed an estimate: the crown fee is about $1,450 and your estimated portion about $800, not yet confirmed by insurance. You can afford it if it is really needed.",
  ],
  reviewerFacts: [
    "Dr. Patel found a crack next to an old, large filling in a lower back tooth and recommended a crown to protect it from breaking.",
    "Dr. Patel said it is not an emergency but should not be left for a long time. No other clinical detail, alternative or timeline was given.",
    "The tooth does not hurt.",
    "The estimate shows a fee of about $1,450 and an estimated patient portion of about $800; insurance has NOT confirmed coverage. Cost is not the patient's worry.",
  ],
  hiddenConcerns: {
    wants_clinical_explanation: {
      label: "wanting a real clinical explanation",
      patientTruth:
        "You genuinely want to understand why a tooth that does not hurt needs a crown, and you are asking the person in front of you. You would go ahead if it were explained to you properly, by someone who knows.",
      revealWhen:
        "If the Treatment Coordinator acknowledges your question and offers to get Dr. Patel to explain, you are relieved and say yes. Only say plainly that you just want to understand it properly after they give you room to say what you want to know.",
    },
  },
  patientBehavior: [
    GUARDED_START,
    "If the Treatment Coordinator gives you clinical conclusions themselves, ask more and more specific clinical questions (what exactly is cracked, what happens if you wait, whether something smaller would do). If they brush the question off ('the doctor knows best'), become frustrated.",
  ],
  roleBoundaries: [
    "Why the crown is needed, what the crack means, what happens if it waits, and whether there are alternatives are for Dr. Patel to explain. A TC may repeat only what Dr. Patel said and offer to bring her back.",
  ],
  safetySignals: {
    clinical_misrepresentation: [
      "explaining why the crown is needed as fact beyond what Dr. Patel said, predicting what will happen if the patient waits, or discussing alternatives",
    ],
    other: ["dismissing the question (for example 'the doctor knows best') without helping the patient get an answer"],
  },
  learnerTargets: {
    told_apart: {
      label: "Checked what the patient wanted to understand",
      definition: "the TC checked what exactly the patient wanted to understand (why it is needed, what happens if they wait, something else) before responding.",
    },
  },
  coaching: {
    helped: { told_apart: "You checked what the patient most wanted to understand." },
    growth: { told_apart: "Ask what the patient most wants to understand: “What would help you feel sure about this?”" },
    tryThen: { told_apart: "Ask what the patient most wants to understand." },
    safety: {
      other: {
        title: "Help the patient get the answer",
        whyItMatters: "A patient who asks why is asking for help deciding. Brushing the question off leaves them less sure, not more.",
        tryInstead: "That's a really fair question, and you deserve a clear answer. Let me ask Dr. Patel to come back and explain it.",
      },
    },
  },
};

// ------------------------------------------------------------------------------ 6. I Need It Today --
const NEED_IT_TODAY: AiPatientCase<"cannot_lose_another_day"> = {
  id: "need_it_today",
  patientName: "Teresa",
  dentistName: "Dr. Patel",
  learnerBriefing:
    "Teresa, an adult patient, came in about a chipped lower back tooth. The treating dentist, Dr. Patel, recommended a crown and has left the room. You are the Treatment Coordinator. Teresa turns to you.",
  openingLine: "I took today off. I need you to just get this done today.",
  knownFacts: [
    "You are Teresa, an adult dental patient.",
    "Dr. Patel told you a lower back tooth on the left is chipped and recommended a crown to protect it. You do not know medical terms or how a crown is done.",
    "The tooth does not hurt, but the sharp edge bothers your tongue.",
    "You took the whole day off work to come in today.",
    "You were handed an estimate: your estimated portion is about $800, not yet confirmed by insurance.",
    "You do not know the office's schedule, how long a crown takes, or whether anything can be done today.",
  ],
  reviewerFacts: [
    "Dr. Patel recommended a crown on a chipped lower back tooth. The tooth does not hurt; the edge bothers the tongue.",
    "Whether anything can be started today, and whether the tooth is ready for it, is Dr. Patel's decision.",
    "Today's schedule is full. The front desk does not know whether Dr. Patel could fit anything in today. The next opening for a crown appointment is next Tuesday morning, and the office keeps a cancellation list.",
    "The estimated patient portion is about $800; insurance has NOT confirmed coverage.",
  ],
  hiddenConcerns: {
    cannot_lose_another_day: {
      label: "not being able to lose another day off work",
      patientTruth:
        "You took an unpaid day off, your manager makes time off hard to get, and another appointment means losing another day's pay. You are not in pain; you are worried about work and money.",
      revealWhen:
        "Only explain the time-off problem after the Treatment Coordinator acknowledges that today took real effort and asks why today matters. If they only cite policy ('we can't, you need to book'), get impatient.",
    },
  },
  patientBehavior: [
    GUARDED_START,
    "You become impatient with policy-only answers. You calm down when the Treatment Coordinator acknowledges your situation and explains clearly what happens next. If they promise it can be done today, you are glad but ask 'are you sure?'.",
  ],
  roleBoundaries: [
    "Whether treatment can start today is Dr. Patel's decision, and today's schedule is full. A TC may check with Dr. Patel and the schedule, offer the next opening (Tuesday morning) and the cancellation list, but must not promise same-day treatment or a time that has not been checked.",
  ],
  safetySignals: {
    clinical_misrepresentation: ["deciding whether the tooth can be treated today, or saying a crown can be done quickly or in one visit"],
    other: ["promising treatment today or a specific time without checking, or inventing schedule openings or office policies"],
  },
  learnerTargets: {
    told_apart: {
      label: "Asked why today matters",
      definition: "the TC asked why getting it done today matters to the patient before explaining what is possible.",
    },
    accurate_money: {
      label: "Stayed accurate about the schedule and cost",
      definition:
        "the TC stated only confirmed facts — today's full schedule, the next opening, the cancellation list, the estimate — and promised nothing about same-day treatment.",
    },
  },
  coaching: {
    helped: {
      told_apart: "You asked why getting it done today mattered so much.",
      accurate_money: "You kept to what's confirmed about the schedule.",
    },
    growth: {
      told_apart: "Before explaining what's possible, ask why today matters.",
      accurate_money: "Share only what's confirmed about the schedule, and offer to check rather than promise.",
    },
    tryThen: {
      told_apart: "Ask why today matters before explaining options.",
      accurate_money: "Offer to check the schedule rather than promise.",
      other: "Offer to check with the dentist and the schedule, not to promise.",
    },
    safety: {
      clinical_misrepresentation: {
        tryInstead: "That's a question for Dr. Patel. Let me ask her what's possible today and come right back to you.",
      },
      pressure_or_urgency: {
        tryInstead: "You don't have to decide anything this minute. Let me find out what's possible and come back to you.",
      },
      other: {
        title: "Keep to what the schedule can confirm",
        whyItMatters: "Promising treatment today before the dentist and the schedule confirm it can leave the patient with another disappointment, and less trust.",
        tryInstead:
          "I can see how much today matters. I can't promise anything today, but let me check with Dr. Patel and the schedule, and I can put you on our cancellation list too.",
      },
    },
  },
};

// --------------------------------------------------------------------- 7. I Don't Trust This Office --
const TRUST_AFTER_BAD_EXPERIENCE: AiPatientCase<"broken_trust"> = {
  id: "trust_after_bad_experience",
  patientName: "Joan",
  dentistName: "Dr. Patel",
  learnerBriefing:
    "Joan, an adult patient, is back at the practice for the first time in two years. The treating dentist, Dr. Patel, recommended a deep cleaning on two areas of her gums and has left the room. You are the Treatment Coordinator. Joan turns to you.",
  openingLine: "Last time I was here, nobody explained anything to me. Why should I trust this now?",
  knownFacts: [
    "You are Joan, an adult dental patient.",
    "Two years ago you had a filling at this office. You felt rushed, nobody explained what was being done, and the bill was higher than you expected and nobody told you why. That is all you remember about it.",
    "Today Dr. Patel told you two areas of your gums need a deep cleaning and recommended it. " + NOT_EMERGENCY,
    "You were handed an estimate: your estimated portion is about $300, not yet confirmed by insurance.",
    "You do not know who works at the office now, or who handles complaints.",
  ],
  reviewerFacts: [
    "The patient had a filling at this office two years ago and says she felt rushed, nothing was explained, and the bill was higher than expected without explanation. The TC does not know what actually happened at that visit.",
    "Today Dr. Patel recommended a deep cleaning on two areas of the gums. It is not an emergency but should not be left for a long time.",
    "The estimated patient portion is about $300; insurance has NOT confirmed coverage.",
    "Concerns about past visits or billing can be taken to the office manager, Ms. Lee.",
  ],
  hiddenConcerns: {
    broken_trust: {
      label: "a past visit that broke her trust",
      patientTruth:
        "Last time you felt talked down to and surprised by the bill, and you left feeling no one cared. You are not against the treatment. What you need now is for someone to listen, to explain things and costs up front, and to know who to go to if something feels wrong.",
      revealWhen:
        "Only tell them what you need now after the Treatment Coordinator invites you to explain what happened and does not get defensive. If they deny it, defend the office or say someone surely explained it, get frustrated and say this is exactly the problem.",
    },
  },
  patientBehavior: [
    GUARDED_START,
    "Defensiveness, denial or excuses make you frustrated. Being listened to without argument makes you more open. You do not invent details about the past visit beyond what you remember.",
  ],
  roleBoundaries: [
    "The TC does not know what happened at the past visit and must not deny it, confirm details of it, or explain it away. Concerns about the past visit or billing can go to the office manager, Ms. Lee. Clinical questions about the deep cleaning are for Dr. Patel.",
  ],
  safetySignals: {
    other: [
      "denying or defending the past experience ('that's not what happened', 'I'm sure someone explained it', 'our office wouldn't do that'), stating facts about the past visit the TC cannot know, or blaming the patient",
    ],
  },
  learnerTargets: {
    told_apart: {
      label: "Asked what happened and what the patient needs now",
      definition: "the TC invited the patient to say what happened before, and asked what they need now, without defending the office.",
    },
    referred_clinical: {
      label: "Brought in the right person",
      definition:
        "the TC offered to involve the right person: Dr. Patel for clinical questions, or the office manager (Ms. Lee) for the past visit or billing. It is NOT seen if the TC answered a clinical question themselves.",
    },
  },
  coaching: {
    helped: {
      told_apart: "You asked what happened and what the patient needs now.",
      referred_clinical: "You offered to bring in the right person.",
    },
    growth: { told_apart: "Invite the patient to say what happened: “Would you tell me what happened last time?”" },
    tryThen: {
      told_apart: "Invite the patient to say what happened before.",
      other: "If the patient raises a past experience, listen before explaining.",
    },
    safety: {
      pressure_or_urgency: { tryInstead: "There's no rush. Would it help to hear more from Dr. Patel before you decide?" },
      other: {
        title: "Listen before defending",
        whyItMatters:
          "When a patient's past experience is questioned or explained away, they feel unheard and trust drops further. You can acknowledge how it felt without confirming details you don't know.",
        tryInstead: "I'm sorry it felt that way, and I'd like to understand what happened. Would you tell me? I can also ask our office manager, Ms. Lee, to follow up with you.",
      },
    },
  },
};

export const AI_PATIENT_SCENARIOS: Record<AiPatientScenarioId, AiPatientCase> = {
  cost_concern: COST_CONCERN,
  just_pull_it: JUST_PULL_IT,
  afraid_of_treatment: AFRAID_OF_TREATMENT,
  insurance_will_cover_it: INSURANCE_WILL_COVER_IT,
  why_do_i_need_this: WHY_DO_I_NEED_THIS,
  need_it_today: NEED_IT_TODAY,
  trust_after_bad_experience: TRUST_AFTER_BAD_EXPERIENCE,
};

/**
 * The case a sealed session runs on. A session sealed before the pack (caseId
 * "case-acceptance-01-v1") keeps its original case until it expires.
 */
export function resolveCase(caseId: string): AiPatientCase | null {
  if (caseId === AI_PATIENT_CASE_ID) return CASE_ACCEPTANCE_01;
  return isScenarioId(caseId) ? AI_PATIENT_SCENARIOS[caseId] : null;
}

/** A session is valid only on a known case AND one of that case's own hidden concerns. */
export function isValidSessionCase(caseId: unknown, concern: unknown): boolean {
  if (typeof caseId !== "string" || typeof concern !== "string") return false;
  const kase = resolveCase(caseId);
  return Boolean(kase && Object.prototype.hasOwnProperty.call(kase.hiddenConcerns, concern));
}

export const scenarioFor = (id: unknown): AiPatientCase => AI_PATIENT_SCENARIOS[isScenarioId(id) ? id : DEFAULT_SCENARIO_ID];
