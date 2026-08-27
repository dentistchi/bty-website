/** Self-contained en/ko copy for the Guided Module Builder (Slice 2.1). Plain,
 *  operational, HOST-oriented language — never "capability", "module schema",
 *  "evidence ladder", "learning objective", etc. */

import type { Locale } from "./copy";
import {
  BTY_SUGGESTED_COMPLETION_PROMPTS,
  BTY_SUGGESTED_SHARED_QUESTIONS,
} from "@/domain/foundry/module/learnerQuestionRole";

/** Direction Copilot (Slice 2.4A) — product-tone copy for the assistive suggestion
 *  flow on the problem step. Neutral product language, NOT the Dr. Chi mentor voice. */
export type DirectionCopilotCopy = {
  entryPrompt: string;
  trigger: string;
  entrySupport: string;
  loading: string;
  resultsHeading: string;
  draftBadge: string;
  viewDetails: string;
  hideDetails: string;
  labelTitle: string;
  labelCapability: string;
  /** Why Apply is unavailable while the capability is empty (Slice R4-R2F). */
  capabilityBlocker: string;
  labelWhy: string;
  labelBehavior: string;
  labelEvidence: string;
  labelAssumption: string;
  useThis: string;
  describeAnother: string;
  reviewHeading: string;
  reviewLead: string;
  reviewApplies: string;
  backToDirections: string;
  apply: string;
  applied: string;
  appliedDismiss: string;
  failTitle: string;
  tryAgain: string;
  continueWithout: string;
  rateLimited: string;
  staleTitle: string;
  staleHint: string;
  generateAgain: string;
};

/** Direction-to-Module Draft Copilot (Slice 2.4B) — self-contained copy for the
 *  "draft the rest of this training" assistive flow on the Learning Approach step. */
export type ModuleDraftCopilotCopy = {
  entryPrompt: string;
  trigger: string;
  entrySupport: string;
  loading: string;
  reviewHeading: string;
  reviewLead: string;
  applyNote: string;
  secLearning: string;
  secCompletion: string;
  secArena: string;
  secFollow: string;
  secMaterial: string;
  currentLabel: string;
  suggestedLabel: string;
  whyLabel: string;
  assumptionsLabel: string;
  warningsLabel: string;
  materialTypesLabel: string;
  keep: string;
  use: string;
  skip: string;
  apply: string;
  applied: string;
  appliedDismiss: string;
  failTitle: string;
  tryAgain: string;
  continueManually: string;
  rateLimited: string;
  staleTitle: string;
  staleHint: string;
  regenerate: string;
  needs: { know: string; decide: string; practice: string; shared_standard: string };
  follow: { d0: string; d7: string; d30: string };
  arenaYes: string;
  arenaNo: string;
  materialTypes: { youtube: string; pdf: string; written: string; live_discussion: string };
  /** Adaptive Clarification (Slice 2.4C) — the smallest-question pre-draft step. */
  clarification: ClarificationCopy;
};

/** Adaptive Clarification (Slice 2.4C) — localized questions + suggested-answer labels.
 *  Keyed by the domain's ClarificationDimension / choice keys; the domain stays string-free. */
export type ClarificationCopy = {
  intro: string;
  submit: string;
  customPlaceholder: string;
  draftAnyway: string;
  /** One localized question per dimension (matches ClarificationDimension). */
  questions: {
    target: string;
    observable_behavior: string;
    success_evidence: string;
    role_authority: string;
    learning_context: string;
    field_application: string;
    follow_up: string;
  };
  /** Suggested-answer labels keyed by the domain's choice keys. */
  choices: {
    ev_seen: string;
    ev_heard: string;
    ev_recorded: string;
    ev_confirmed: string;
  };
};

export type ModuleBuilderCopy = {
  // entry
  entryEyebrow: string;
  startNew: string;
  entrySupport: string;
  starting: string;
  continueLead: string;
  // draft card
  untitled: string;
  stepProgress: (n: number) => string;
  editedRel: (rel: string) => string;
  relJustNow: string;
  relMin: (n: number) => string;
  relHour: (n: number) => string;
  relDay: (n: number) => string;
  otherDrafts: string;
  // delete
  deleteDraft: string;
  deleteAction: string;
  moreActions: string;
  deleteConfirm: string;
  deleted: string;
  // draft identity (Slice 3.2L-R1.2) — which training is open, visible on every step
  identityLabel: string;
  identityFallback: string;
  // shell chrome
  stepOf: (n: number, total: number) => string;
  back: string;
  next: string;
  saveAndLeave: string;
  editSection: string;
  // save states
  saving: string;
  saved: string;
  saveError: string;
  retry: string;
  // restore states
  restoreLoading: string;
  restoreUnavailable: string;
  restoreGone: string;
  // step 1 problem
  /* Slice 3.2R-R2.1 — Step 1 names the training AND describes the problem, as two fields. */
  s1Heading: string;
  s1TitleLabel: string;
  s1TitleHelp: string;
  s1TitlePlaceholder: string;
  s1TitleBlocker: string;
  /** Why Back / Next / Save are unavailable while a file is still uploading (Slice R4-R2F). */
  docBusyBlocker: string;
  s1ProblemLabel: string;
  s1Q: string;
  s1Help: string;
  s1Placeholder: string;
  s1Blocker: string;
  // step 2 audience
  s2Q: string;
  audEveryone: string;
  audLeaders: string;
  // Leaders eligibility preview (Slice 3.1B-2) — preview copy, never targeting copy.
  audLeadersEligible: (n: number) => string;
  audLeadersZero: string;
  audLeadersPreviewNote: string;
  audLeadersPreviewLoading: string;
  audLeadersPreviewError: string;
  // Participation mode (Slice 3.1B-3C)
  pmTitle: string;
  pmOpenLabel: string;
  pmOpenDesc: string;
  pmAssignedLabel: string;
  pmAssignedDesc: string;
  pmAssignedNote: string;
  pmAudienceHint: string;
  pmZeroRecipients: string;
  pmOpenNoAssign: string;
  pmRoomLinkBased: string;
  pmWillCreate: (n: number) => string;
  pmDoneAssignedTitle: string;
  pmDoneAssignedCount: (n: number) => string;
  pmDoneOpenTitle: string;
  pmDoneOpenNoAssign: string;
  pmDoneContinue: string;
  /**
   * R4-R7A — the Host asked for behaviour follow-through this training cannot yet deliver.
   * Ordinary language only: never "Journey", "grounded", "field_application", "action_decision".
   */
  realityMissingFieldAction: string;
  realityMissingDecision: string;
  realityFixCta: string;
  publishErrYoutube: string;
  publishErrPdf: string;
  publishErrNotHost: string;
  publishErrAssignment: string;
  audJobGroup: string;
  audRole: string;
  audJobGroupDetail: string;
  audRoleDetail: string;
  s2Blocker: string;
  s2DetailBlocker: string;
  /*
    step 3 — the Host's recurring moment (Slice 3.2P-R3.6-R1).

    KEYED BY MEANING, NOT BY POSITION. Every other question is `sNQ`, numbered when the sequence
    was fixed. Inserting one proved that numbering is a second, drifting record of step order —
    renaming forty keys across two locales to keep it true would be churn with real risk and no
    product value, so the new question is named for what it asks and the old numbers stay as the
    historical labels they now are.
  */
  sMomentQ: string;
  sMomentHelp: string;
  sMomentPlaceholder: string;
  sMomentBlocker: string;
  /** Advisory, never blocking: the answer is stored, but no repeatable occasion derives from it. */
  sMomentNotRepeatable: string;
  reviewWhenItHappens: string;
  // step 4 behavior
  s3Q: string;
  s3Help: string;
  s3Placeholder: string;
  s3Blocker: string;
  /** Slice R4-R1A — the answer is a question, so nobody could ever have SEEN it. */
  s3QuestionBlocker: string;
  s3VagueGuidance: string;
  // step 3 capability (optional; applied by the Direction Copilot, editable here)
  s3CapabilityLabel: string;
  s3CapabilityHelp: string;
  s3CapabilityPlaceholder: string;
  // step 4 evidence
  s4Q: string;
  s4Help: string;
  s4Placeholder: string;
  s4BehaviorLead: string;
  s4VerifyQ: string;
  verifyObserved: string;
  verifyHeard: string;
  verifyRecorded: string;
  verifyConfirmed: string;
  s4VerifyGuidance: string;
  s4Honesty: string;
  s4Blocker: string;
  // step 5 learning needs (multi-select)
  /**
   * RETIRED SCREENS, KEPT COPY (Slice R4-R8B).
   *
   * `s5*` was the learning-need screen and `s7Arena*` / `s7Follow*` the Arena + follow-up screen.
   * Both are derived now and neither renders. The keys stay because the vocabulary they carry is
   * still spoken elsewhere — `needInfoTitle`…`needSharedTitle`, `arenaYes/No` and `followNone/7/30`
   * label the override controls on Review — and because deleting half a locale table is how the
   * two halves drift apart. `s5Blocker` and `s7Blocker` name codes no step can emit any more.
   */
  s5Q: string;
  s5Help: string;
  needInfoTitle: string;
  needInfoDesc: string;
  needDecideTitle: string;
  needDecideDesc: string;
  needPracticeTitle: string;
  needPracticeDesc: string;
  needSharedTitle: string;
  needSharedDesc: string;
  s5ArenaHint: string;
  s5Blocker: string;
  // step 6 material intent — all FOUR approved V1 types since R4-R2G
  s6Q: string;
  matYoutube: string;
  matPdf: string;
  matYoutubePlaceholder: string;
  ytMissingTitle: string;
  requiredBeforeApproval: string;
  pdfMissingLead: string;
  s6Blocker: string;
  /** R4-R2G — the specific "what to add" sentences, mapped from the two new blocking codes. */
  s6WrittenBlocker: string;
  s6LiveDiscussionBlocker: string;
  // pdf attachment
  pdfAttachLead: string;
  attachPdf: string;
  replacePdf: string;
  removePdf: string;
  uploadingPdf: string;
  removingPdf: string;
  uploadFailed: string;
  removeFailed: string;
  pdfReadyBadge: string;
  pagesLabel: (n: number) => string;
  // files & documents (multi-format assets)
  matFiles: string;
  /*
    R4-R2G — the two material types the Builder never offered. The labels name the thing a Host
    already understands ("Written guidance", "Live discussion"); the one-line descriptions say
    what the LEARNER will do, because that is the difference a Host is actually choosing between.
  */
  matWritten: string;
  matWrittenDesc: string;
  matWrittenPlaceholder: string;
  matWrittenMissing: string;
  matLiveDiscussion: string;
  matLiveDiscussionDesc: string;
  matLiveDiscussionPlaceholder: string;
  matLiveDiscussionMissing: string;
  /**
   * The one thing a Host must not be allowed to believe: choosing "Live discussion" does not
   * make BTY a witness to it. Stated once, on the screen where the choice is made.
   */
  matLiveDiscussionHonesty: string;
  /** The two Review row values for the new types. */
  reviewMatWritten: string;
  reviewMatLiveDiscussion: string;
  /** Slice 3.2R-R3 — open the REAL attached document before publishing it. */
  viewDocument: string;
  /** Slice 3.2R-R6 — an unverified page count blocks publish; it is never defaulted to 1. */
  publishErrPageCount: string;
  viewDocumentError: string;
  materialReviewTitle: string;
  materialReviewBody: string;
  materialReviewConfirm: string;
  materialReviewConfirmed: string;
  filesHeader: string;
  filesLead: string;
  attachFiles: string;
  addPhoto: string;
  assetAttached: string;
  assetUploading: string;
  assetRemove: string;
  errUnsupported: string;
  errTooLarge: string;
  errGeneric: string;
  deliveryReady: string;
  deliveryDeferred: string;
  reviewMaterials: string;
  noFilesYet: string;
  // quick-event discoverability
  quickLead: string;
  // step 7 practice + follow-up
  s7ArenaQ: string;
  s7ArenaRecommended: string;
  s7ArenaAccept: string;
  s7ArenaDecline: string;
  s7FollowQ: string;
  followNone: string;
  follow7: string;
  follow30: string;
  s7Blocker: string;
  // step 8 review
  reviewEyebrow: string;
  revisionTitle: string;
  revisionNote: string;
  journeyApprovalBlocked: string;
  journeyStart: string;
  reviewSaved: string;
  reviewLead: string;
  sectionsNeedAttention: (n: number) => string;
  requiredLabel: string;
  reviewChange: string;
  reviewWho: string;
  reviewCapability: string;
  reviewBehavior: string;
  reviewEvidence: string;
  reviewLearning: string;
  reviewMaterial: string;
  reviewArena: string;
  reviewFollow: string;
  /**
   * Slice R4-R2C — what "No follow-up" MEANS, said on the review screen before publish.
   * A valid choice with a lower evidence ceiling, never an error and never a blocker.
   */
  reviewFollowNoneMeaning: string;
  reviewEmpty: string;
  arenaYes: string;
  arenaNo: string;
  // review needs-attention inline guidance
  gBehaviorNeeds: string;
  gBehaviorHint: string;
  gPdfMissing: string;
  gYtMissing: string;
  // step 6 completion question (participant-facing; host-authored, prefilled with a suggestion)
  s6CompletionQ: string;
  s6CompletionHelp: string;
  s6CompletionPlaceholder: string;
  s6SharedQ: string;
  s6SharedHelp: string;
  s6SharedPlaceholder: string;
  /** R4-R5C12A — Review advisory when a learner question can be answered by repeating the material. */
  questionCopyLike: string;
  questionCopyLikeCta: string;
  /** R4-R5C15 — Host-facing program authorship + learner-preview labels, in the Host's language. */
  paEntryTitle: string;
  paEntryBody: string;
  paGenerateCta: string;
  paNotReadyHint: string;
  paWorking: string;
  paWorkingNote: string;
  paApplying: string;
  paReviewEyebrow: string;
  paReviewBody: string;
  paReviewGrammar: string;
  paProgramTitleLabel: string;
  paStateKeep: string;
  paStateEdited: string;
  paStateUseBty: string;
  paStateUnavailable: string;
  paBadgeYourWording: string;
  paBadgeAdjusted: string;
  paBadgeDraftedByBty: string;
  paBadgeFromYourSetup: string;
  paKeepYours: string;
  paUseBtyDraft: string;
  paEditDetails: string;
  paEditDetailsDone: string;
  paUnavailableNote: string;
  paDerivedNote: string;
  paApplyCta: string;
  paResetCta: string;
  paDiscardCta: string;
  paAppliedTitle: string;
  paAppliedPending: string;
  paAppliedShow: string;
  paAppliedHide: string;
  paApplyFailedTitle: string;
  paApplyFailedBody: string;
  paStillNeeded: (kinds: string) => string;
  jbNeedsConfirmation: (label: string) => string;
  jbMissingFromProgram: (label: string) => string;
  paTargetAriaLabel: string;
  paUntitledDraft: string;
  paApplyFootnote: string;
  /**
   * SIMPLIFICATION A — the automatic single-generator path (Slice R4-R8A).
   *
   * The canonical fresh flow never asks whether BTY should draft the training, and never asks
   * the Host to adopt what it drafted. These five lines are the whole visible surface of a
   * generation that runs, applies itself and gets out of the way.
   */
  paAutoWorking: string;
  paAutoDone: string;
  paAutoFailedTitle: string;
  paAutoRetry: string;
  paAutoManual: string;
  /** The collapsed Builder-source detail disclosure on the single working preview. */
  reviewDetailsToggle: string;
  reviewDetailsHint: string;
  reviewDetailsAttention: (n: number) => string;
  paCeilingHeading: string;
  paAssumptionsHeading: string;
  paWarningsHeading: string;
  /** Learner-preview surface (the Host reads what the learner will get). */
  jpEyebrow: string;
  jpBody: string;
  jpHandoffNote: string;
  jpTitleLabel: string;
  jpTitleConfirm: string;
  jpTitleOk: string;
  jpNeedsConfirmation: string;
  jpPlaceholder: string;
  jpFromSetup: string;
  jpYourEdit: string;
  jpDraftedByBty: string;
  jpFromYour: (field: string) => string;
  /** One label per Journey section, shared by every Host surface that names them. */
  journeyKind: Record<"why_it_matters" | "observable_standard" | "scenario" | "reflection" | "action_decision" | "field_application" | "evidence" | "completion_check" | "follow_up", string>;
  /** Which Builder answer a preview section came from. */
  journeyField: Record<string, string>;
  /** R4-R5C14A-R3 — the way out of a refused adoption. */
  programRefusedRecovery: string;
  programRefusedRecoveryCta: string;
  // step 8 review — completion-question row + publish action
  reviewCompletion: string;
  publishCta: string;
  publishTrust: string;
  publishing: string;
  publishError: string;
  /** The session EXISTS and could not be shown (Slice 3.2Q-R1) — never a creation failure. */
  publishErrSessionCreated: string;
  // Direction Copilot (Slice 2.4A)
  copilot: DirectionCopilotCopy;
  // Module-draft Copilot (Slice 2.4B)
  moduleDraft: ModuleDraftCopilotCopy;
};

const arenaFollowLabel = (
  days: number | undefined,
  none: string,
  seven: string,
  thirty: string,
): string => (days === 7 ? seven : days === 30 ? thirty : none);

export const MODULE_BUILDER_COPY: Record<Locale, ModuleBuilderCopy> = {
  en: {
    entryEyebrow: "TRAINING BUILDER",
    startNew: "Create training",
    entrySupport: "Turn a recurring problem into a training your team can use.",
    starting: "Starting…",
    continueLead: "Pick up where you left off.",
    untitled: "Untitled training",
    stepProgress: (n) => `Step ${n} of 8`,
    editedRel: (rel) => `Edited ${rel}`,
    relJustNow: "just now",
    relMin: (n) => `${n} min ago`,
    relHour: (n) => (n === 1 ? "1 hr ago" : `${n} hrs ago`),
    relDay: (n) => (n === 1 ? "1 day ago" : `${n} days ago`),
    otherDrafts: "Other drafts",
    deleteDraft: "Delete draft",
    deleteAction: "Delete",
    moreActions: "More",
    deleteConfirm: "Delete this draft? This can’t be undone.",
    deleted: "Draft deleted",
    identityLabel: "Training focus",
    identityFallback: "Untitled training draft",
    stepOf: (n, total) => `Step ${n} of ${total}`,
    back: "Back",
    next: "Next",
    saveAndLeave: "Save and leave",
    editSection: "Edit",
    saving: "Saving…",
    saved: "Saved",
    saveError: "Couldn’t save",
    retry: "Retry",
    restoreLoading: "Opening your draft…",
    restoreUnavailable: "Couldn’t open this draft. Please try again.",
    restoreGone: "This draft is no longer available.",
    s1Heading: "Define the training",
    s1TitleLabel: "Training title",
    s1TitleHelp: "Give this training a short, clear name.",
    s1TitlePlaceholder: "e.g. Close the Loop on One Commitment",
    s1TitleBlocker: "Give this training a short name.",
    docBusyBlocker: "Your file is still uploading — this will unlock when it finishes.",
    s1ProblemLabel: "What keeps going wrong?",
    s1Q: "What keeps going wrong?",
    s1Help: "Describe a specific situation that repeats — not a general topic.",
    s1Placeholder: "e.g. Handoffs at shift change keep missing the double-check step.",
    s1Blocker: "Add a sentence about what keeps happening.",
    s2Q: "Who needs to do something differently?",
    audEveryone: "Everyone",
    audLeaders: "Leaders",
    audLeadersEligible: (n: number) =>
      n === 1 ? "1 member currently qualifies as a leader." : `${n} members currently qualify as leaders.`,
    audLeadersZero:
      "No one in your organization has an assigned leadership responsibility yet, so this preview is empty. Ask an administrator to assign responsibilities on the Member Identity page.",
    audLeadersPreviewNote:
      "Preview only. This is based on explicitly assigned leadership responsibilities. Choosing Leaders describes who this module is for — it does not assign members, invite anyone, or restrict entry. Foundry participation stays anonymous and link-based.",
    audLeadersPreviewLoading: "Checking who qualifies…",
    audLeadersPreviewError: "Could not check leader eligibility right now.",
    pmTitle: "Participation",
    pmOpenLabel: "Open link session",
    pmOpenDesc:
      "Anyone with the link may join. Participation remains anonymous unless a participant later claims their work.",
    pmAssignedLabel: "Assigned to organization members",
    pmAssignedDesc:
      "Create required-learning assignments for the eligible members shown below. The room itself remains link-based and is not access-restricted.",
    pmAssignedNote:
      "No invitation is sent and no login is required to open the room. Assignment records who this learning is for; it does not restrict entry or verify behavior.",
    pmAudienceHint: "Choose an audience on the audience step to see who will be assigned.",
    pmZeroRecipients:
      "No eligible members match this audience, so no assignments can be created. Change the audience or choose Open link session.",
    pmOpenNoAssign: "No member assignments will be created. Anyone with the link may join.",
    pmRoomLinkBased: "The room remains link-based.",
    pmWillCreate: (n: number) =>
      n === 1 ? "This will create 1 required-learning assignment." : `This will create ${n} required-learning assignments.`,
    pmDoneAssignedTitle: "Assigned session created",
    pmDoneAssignedCount: (n: number) =>
      n === 1 ? "1 assignment created." : `${n} assignments created.`,
    pmDoneOpenTitle: "Open link session created",
    pmDoneOpenNoAssign: "No assignments created. Anyone with the link may join.",
    pmDoneContinue: "Continue to room",
    realityMissingFieldAction:
      "You scheduled a follow-up, but this training does not yet say what the learner should try in real work.",
    realityMissingDecision:
      "This training asks the learner to make a decision, but the decision they should make is not defined yet.",
    realityFixCta: "Complete this part",
    publishErrYoutube: "The video link isn't a valid YouTube URL. Fix the material and try again.",
    publishErrPdf: "Attach the training PDF before publishing.",
    publishErrNotHost: "You don't have permission to create Foundry sessions.",
    publishErrAssignment:
      "The assignments couldn't be created, so nothing was published. Please try again.",
    audJobGroup: "A job group",
    audRole: "A specific role",
    audJobGroupDetail: "Which group?",
    audRoleDetail: "Which role?",
    s2Blocker: "Choose who this is for.",
    s2DetailBlocker: "Add the group or role.",
    sMomentQ: "When does this usually happen?",
    sMomentHelp: "Name the real moment that comes around again.",
    sMomentPlaceholder: "e.g. During morning huddles.",
    sMomentBlocker: "Add when this situation usually happens.",
    sMomentNotRepeatable: "This sounds like one specific time. Add the kind of moment that happens again — for example, “at each morning huddle”.",
    reviewWhenItHappens: "When it happens",
    s3Q: "After this training, what should they do differently?",
    s3Help: "Describe something another person could see or hear.",
    s3Placeholder: "e.g. The charge nurse reads the dosage back at every handoff before signing off.",
    s3Blocker: "Describe the new action.",
    s3QuestionBlocker:
      "That is a question, so nobody could say they saw it happen. Write what the person does \u2014 for example, \u201cBefore the huddle ends, name one owner and one deadline for each open action item.\u201d",
    s3VagueGuidance: "This sounds general. Try naming something someone could actually see or hear.",
    s3CapabilityLabel: "Capability (optional)",
    s3CapabilityHelp: "The ability this training builds. You can fill this from a suggested direction, or write your own.",
    s3CapabilityPlaceholder: "e.g. Accurate shift handoff",
    s4Q: "After the training, what would show that people are doing this differently?",
    s4Help: "Describe something you could see, hear, record, or have someone confirm in real work.",
    s4Placeholder: "e.g. The read-back is noted on the handoff record.",
    s4BehaviorLead: "You said people should:",
    s4VerifyQ: "How would this be verified?",
    verifyObserved: "Observed directly",
    verifyHeard: "Heard in conversation",
    verifyRecorded: "Recorded in the workflow",
    verifyConfirmed: "Confirmed by another person",
    s4VerifyGuidance: "Choose the clearest source of evidence.",
    s4Honesty: "Completing the training is not proof that the behavior changed — this is what you’d look for in real work.",
    s4Blocker: "Describe what you’d notice.",
    s5Q: "What does this training need to include?",
    s5Help: "Select all that apply.",
    needInfoTitle: "Information",
    needInfoDesc: "People need to understand something.",
    needDecideTitle: "Decision",
    needDecideDesc: "People need to make a judgment or commitment.",
    needPracticeTitle: "Practice",
    needPracticeDesc: "People need to rehearse the behavior.",
    needSharedTitle: "Shared standard",
    needSharedDesc: "The team needs one common way of working.",
    s5ArenaHint: "This kind of change usually needs practice under pressure — Arena can help later.",
    s5Blocker: "Select at least one.",
    s6Q: "What will people learn from?",
    matYoutube: "YouTube video",
    matPdf: "PDF document",
    matYoutubePlaceholder: "Paste a YouTube link.",
    ytMissingTitle: "Link not added yet",
    requiredBeforeApproval: "Required before approval",
    pdfMissingLead: "You’ll add the PDF before approval.",
    s6Blocker: "Choose what people will learn from.",
    s6WrittenBlocker: "Write the guidance your team will read.",
    s6LiveDiscussionBlocker: "Add what the team should discuss.",
    pdfAttachLead: "Attach a PDF your team will read.",
    attachPdf: "Attach PDF",
    replacePdf: "Replace PDF",
    removePdf: "Remove",
    uploadingPdf: "Uploading PDF…",
    removingPdf: "Removing…",
    uploadFailed: "Couldn’t upload the PDF — Try again",
    removeFailed: "Couldn’t remove the PDF — Try again",
    pdfReadyBadge: "Ready",
    pagesLabel: (n) => (n === 1 ? "1 page" : `${n} pages`),
    matFiles: "Files and documents",
    matWritten: "Written guidance",
    matWrittenDesc: "Your team reads what you write, here in BTY.",
    matWrittenPlaceholder: "Write the guidance your team should read.",
    matWrittenMissing: "Guidance not written yet",
    matLiveDiscussion: "Live discussion",
    matLiveDiscussionDesc: "Your team talks it through together, led by you or a facilitator.",
    matLiveDiscussionPlaceholder: "What should the team discuss? A topic, a question, or a short agenda.",
    matLiveDiscussionMissing: "Discussion topic not added yet",
    matLiveDiscussionHonesty:
      "BTY shows your team what to discuss. It can’t see the discussion, so it will only ever record that someone said they took part.",
    reviewMatWritten: "Written guidance",
    reviewMatLiveDiscussion: "Live discussion",
    viewDocument: "View document",
    publishErrPageCount: "We couldn’t read how many pages this document has. Open it, or replace the file, before you create the session.",
    viewDocumentError: "We couldn’t open this document. Check it before you create the session.",
    materialReviewTitle: "Check the document",
    materialReviewBody:
      "BTY can’t read this file, so it can’t tell whether it matches this training. Open it and check it is the right document for what you wrote.",
    materialReviewConfirm: "I reviewed this document for this training",
    materialReviewConfirmed: "You reviewed this document",
    filesHeader: "FILES AND DOCUMENTS",
    filesLead: "Add the material your team will use.",
    attachFiles: "Attach files",
    addPhoto: "Add photo or screenshot",
    assetAttached: "Attached",
    assetUploading: "Uploading…",
    assetRemove: "Remove",
    errUnsupported: "Unsupported file type",
    errTooLarge: "File is too large",
    errGeneric: "Couldn’t upload — Try again",
    deliveryReady: "Ready for participant delivery",
    deliveryDeferred: "Delivery setup will be completed before approval.",
    reviewMaterials: "LEARNING MATERIALS",
    noFilesYet: "No files attached yet",
    quickLead: "Need to launch something quickly?",
    s7ArenaQ: "Should people practice this in Arena?",
    s7ArenaRecommended: "Recommended for this kind of change.",
    s7ArenaAccept: "Yes, recommend practice",
    s7ArenaDecline: "Not needed",
    s7FollowQ: "When should you check what happened?",
    followNone: "No follow-up",
    follow7: "In 7 days",
    follow30: "In 30 days",
    s7Blocker: "Choose a follow-up timing.",
    reviewEyebrow: "TRAINING DRAFT",
    revisionTitle: "Create new version",
    revisionNote: "Your current published training will remain unchanged.",
    journeyApprovalBlocked: "Confirm the learner title and resolve every “Needs confirmation” element before creating this training.",
    journeyStart: "Review the training",
    reviewSaved: "Saved",
    reviewLead: "Review what you’ve built.",
    sectionsNeedAttention: (n) => (n === 1 ? "1 section needs attention" : `${n} sections need attention`),
    requiredLabel: "Required",
    reviewChange: "What needs to change",
    reviewWho: "Who it’s for",
    reviewCapability: "Capability",
    reviewBehavior: "What people should do differently",
    reviewEvidence: "How you’d recognize success",
    reviewLearning: "Learning approach",
    reviewMaterial: "Material",
    reviewArena: "Practice in Arena",
    reviewFollow: "Follow-up",
    reviewFollowNoneMeaning:
      "No follow-up will be created, and no independent observation will be requested for this training.",
    reviewEmpty: "Not added yet",
    arenaYes: "Recommended",
    arenaNo: "Not recommended",
    gBehaviorNeeds: "Needs clarification",
    gBehaviorHint: "Describe something another person could see or hear.",
    gPdfMissing: "PDF file not added yet",
    gYtMissing: "Link not added yet",
    s6CompletionQ: "Completion question",
    s6CompletionHelp: "Ask for one concrete decision or next action in the learner's own words. If they can answer it by repeating the material, it is not asking them for anything.",
    s6CompletionPlaceholder: "What is one thing you will do differently the next time this happens?",
    s6SharedQ: "Shared understanding question",
    s6SharedHelp: "Ask what happens in their work today, before this training changes anything. The learner is told this answer is shared with you. Proposed by default for judgment, practice, and shared-standard training \u2014 edit it, or clear it to remove.",
    s6SharedPlaceholder: "What usually happens when you are in this situation today?",
    questionCopyLike:
      "This question can be answered by repeating the training above. Ask for the learner\u2019s own experience or next decision instead.",
    questionCopyLikeCta: "Edit question",
    paEntryTitle: "Let BTY draft this training for you",
    paEntryBody:
      "From what you’ve described, BTY will write the whole program your team will experience — why it matters, the standard, a situation to practise, the decision, and what happens afterwards. You review every section before anything is applied.",
    paGenerateCta: "Draft my training program",
    paNotReadyHint: "Add the problem, who it’s for, the behaviour and the evidence first.",
    paWorking: "Writing your training program…",
    paWorkingNote: "Nothing in your draft changes until you apply it.",
    paApplying: "Adding this program to your training…",
    paReviewEyebrow: "BTY drafted this for you",
    paReviewBody: "Nothing is approved or published yet. Keep, use or rewrite each section — you decide what your team sees.",
    paReviewGrammar: "A gold box is yours to type in. Plain text with a line beside it is BTY’s wording, shown here to read.",
    paProgramTitleLabel: "Program title",
    paStateKeep: "Keep yours",
    paStateEdited: "Edited",
    paStateUseBty: "Use BTY",
    paStateUnavailable: "Needs a repeating moment",
    paBadgeYourWording: "Your wording",
    paBadgeAdjusted: "Adjusted by you",
    paBadgeDraftedByBty: "Drafted by BTY",
    paBadgeFromYourSetup: "From your setup",
    paKeepYours: "Keep yours",
    paUseBtyDraft: "Use BTY draft",
    paEditDetails: "Edit details",
    paEditDetailsDone: "Done",
    paUnavailableNote: "Waiting on a moment that comes round again, in “When should they do it?” above.",
    paDerivedNote: "This comes from the problem you described in your training setup, and isn’t rewritten here.",
    paApplyCta: "Add this program to my training",
    paResetCta: "Reset to BTY’s draft",
    paDiscardCta: "Discard",
    paAppliedTitle: "✓ Added to your training.",
    paAppliedPending: "Added to your training. Finishing the record…",
    paAppliedShow: "Review BTY draft ▾",
    paAppliedHide: "Hide BTY draft ▴",
    paApplyFailedTitle: "This program wasn’t added.",
    paApplyFailedBody: "Nothing was saved, and your draft is unchanged. Your review is still here — try adding it again.",
    paStillNeeded: (kinds) => `Still needed for a complete program: ${kinds}`,
    jbNeedsConfirmation: (label) => `${label} still needs your confirmation`,
    jbMissingFromProgram: (label) => `${label} is missing from the program`,
    paTargetAriaLabel: "Training program target",
    paUntitledDraft: "Untitled training draft",
    paApplyFootnote: "Applying adds it to your draft. It still isn’t approved, published, or visible to anyone.",
    paAutoWorking: "BTY is drafting your training…",
    paAutoDone: "BTY drafted your training.",
    paAutoFailedTitle: "BTY couldn’t draft your training.",
    paAutoRetry: "Draft it again",
    paAutoManual: "Continue on your own",
    reviewDetailsToggle: "All training details",
    reviewDetailsHint: "Everything you entered, and where to change it",
    reviewDetailsAttention: (n) => `${n} still needs attention`,
    paCeilingHeading: "What this can and cannot show",
    paAssumptionsHeading: "This assumes",
    paWarningsHeading: "Worth noting",
    jpEyebrow: "Learner preview",
    jpBody: "This is exactly what your team will experience. Every gold box below is text you can rewrite.",
    jpHandoffNote: "BTY’s draft is now here. Change any line below to make it yours.",
    jpTitleLabel: "Learner title",
    jpTitleConfirm: "Confirm title",
    jpTitleOk: "Approved",
    jpNeedsConfirmation: "Needs confirmation",
    jpPlaceholder: "Add this in your own words — BTY will not invent it.",
    jpFromSetup: "From your setup",
    jpYourEdit: "Your edit",
    jpDraftedByBty: "Drafted by BTY",
    jpFromYour: (field) => `From your: ${field}`,
    journeyKind: {
      why_it_matters: "Why this matters",
      observable_standard: "The standard",
      scenario: "In context",
      reflection: "Reflect",
      action_decision: "Your decision",
      field_application: "Apply it",
      evidence: "What success looks like",
      completion_check: "Before you finish",
      follow_up: "What happens next",
    },
    journeyField: {
      problem: "What keeps going wrong",
      recurringMoment: "at each handoff point",
      observableBehavior: "Expected behavior",
      successEvidence: "Success evidence",
      sharedQuestion: "Shared question",
      completionPrompt: "Completion question",
    },
    programRefusedRecovery:
      "This training changed after BTY drafted it. Create a new draft using your latest changes.",
    programRefusedRecoveryCta: "Draft again",
    reviewCompletion: "COMPLETION QUESTION",
    publishCta: "Create training",
    publishTrust: "This creates a live training session with its own join QR. Participants will be able to join and complete it.",
    publishing: "Creating session…",
    publishError: "Couldn’t create the session. Please try once more.",
    publishErrSessionCreated: "Your session was created — we just couldn’t show it here. Reopen this training to see it. Do not create it again.",
    copilot: {
      entryPrompt: "Not sure how to turn this into training?",
      trigger: "Show me three possible directions",
      entrySupport: "BTY will suggest three approaches. You can review and edit before anything is applied.",
      loading: "Finding three possible directions…",
      resultsHeading: "THREE POSSIBLE DIRECTIONS",
      draftBadge: "Suggested direction",
      viewDetails: "View details",
      hideDetails: "Hide details",
      labelTitle: "Direction",
      labelCapability: "Capability",
      capabilityBlocker: "Name the capability before you apply this.",
      labelWhy: "Why it fits",
      labelBehavior: "Draft behavior",
      labelEvidence: "Evidence to look for",
      labelAssumption: "Assumption",
      useThis: "Use this direction",
      describeAnother: "Describe another direction",
      reviewHeading: "REVIEW THIS DIRECTION",
      reviewLead: "Edit anything you like. Nothing changes in your draft until you apply it.",
      reviewApplies: "This will be added to your draft:",
      backToDirections: "Back to three directions",
      apply: "Apply this direction",
      applied: "Added to your draft — you can still edit every part.",
      appliedDismiss: "Done",
      failTitle: "We couldn’t generate directions right now.",
      tryAgain: "Try again",
      continueWithout: "Continue without suggestions",
      rateLimited: "Please wait a moment, then try again.",
      staleTitle: "Your problem changed.",
      staleHint: "Generate directions again to match it.",
      generateAgain: "Generate again",
    },
    moduleDraft: {
      entryPrompt: "Ready to draft the rest?",
      trigger: "Draft the rest of this training",
      entrySupport: "BTY will suggest a learning approach, completion question, Arena recommendation, and follow-up. You will review every section before anything is applied.",
      loading: "Drafting the remaining sections…",
      reviewHeading: "REVIEW THE DRAFT",
      reviewLead: "Keep your own values or use a suggestion. Nothing changes until you apply.",
      applyNote: "Only the sections set to “Use suggestion” will be added.",
      secLearning: "Learning approach",
      secCompletion: "Completion question",
      secArena: "Arena practice",
      secFollow: "Follow-up",
      secMaterial: "Material guidance",
      currentLabel: "Your current value",
      suggestedLabel: "Suggested",
      whyLabel: "Why",
      assumptionsLabel: "Assumptions",
      warningsLabel: "Worth noting",
      materialTypesLabel: "Formats that may help",
      keep: "Keep current",
      use: "Use suggestion",
      skip: "Skip",
      apply: "Apply reviewed draft",
      applied: "Added to your draft — every section is still editable.",
      appliedDismiss: "Done",
      failTitle: "We couldn’t draft the remaining sections right now.",
      tryAgain: "Try again",
      continueManually: "Continue manually",
      rateLimited: "Please wait a moment, then try again.",
      staleTitle: "Your training changed.",
      staleHint: "Generate the draft again to match it.",
      regenerate: "Generate again",
      needs: { know: "Information", decide: "Decision", practice: "Practice", shared_standard: "Shared standard" },
      follow: { d0: "No follow-up", d7: "In 7 days", d30: "In 30 days" },
      arenaYes: "Recommended",
      arenaNo: "Not recommended",
      materialTypes: { youtube: "YouTube video", pdf: "PDF document", written: "Written guidance", live_discussion: "Live discussion" },
      clarification: {
        intro: "One quick thing so the draft fits your situation:",
        submit: "Continue",
        customPlaceholder: "Type a short answer",
        draftAnyway: "Draft with what I have",
        questions: {
          target: "Who specifically needs to do this differently?",
          observable_behavior: "What exactly should someone be seen or heard doing differently?",
          success_evidence: "How would you actually notice this is happening in real work?",
          role_authority: "Does this group have the authority to change this on their own?",
          learning_context: "What do people most need — to know, decide, or practice this?",
          field_application: "Where in the real workflow should this show up?",
          follow_up: "When would you want to check whether this stuck?",
        },
        choices: {
          ev_seen: "You'd see it",
          ev_heard: "You'd hear it",
          ev_recorded: "It'd be recorded",
          ev_confirmed: "Someone would confirm it",
        },
      },
    },
  },
  ko: {
    entryEyebrow: "훈련 빌더",
    startNew: "트레이닝 만들기",
    entrySupport: "반복되는 문제를 팀이 쓸 수 있는 훈련으로 바꾸세요.",
    starting: "시작하는 중…",
    continueLead: "이어서 계속하세요.",
    untitled: "제목 없는 훈련",
    stepProgress: (n) => `8단계 중 ${n}단계`,
    editedRel: (rel) => `${rel} 편집`,
    relJustNow: "방금",
    relMin: (n) => `${n}분 전`,
    relHour: (n) => `${n}시간 전`,
    relDay: (n) => `${n}일 전`,
    otherDrafts: "다른 초안",
    deleteDraft: "초안 삭제",
    deleteAction: "삭제",
    moreActions: "더보기",
    deleteConfirm: "이 초안을 삭제할까요? 되돌릴 수 없습니다.",
    deleted: "초안이 삭제되었습니다",
    identityLabel: "훈련 초점",
    identityFallback: "제목 없는 훈련 초안",
    stepOf: (n, total) => `${total}단계 중 ${n}단계`,
    back: "뒤로",
    next: "다음",
    saveAndLeave: "저장하고 나가기",
    editSection: "편집",
    saving: "저장 중…",
    saved: "저장됨",
    saveError: "저장하지 못했습니다",
    retry: "다시 시도",
    restoreLoading: "초안을 여는 중…",
    restoreUnavailable: "이 초안을 열지 못했습니다. 다시 시도해 주세요.",
    restoreGone: "이 초안은 더 이상 사용할 수 없습니다.",
    s1Heading: "교육 정의",
    s1TitleLabel: "교육 제목",
    s1TitleHelp: "이 교육을 짧고 분명하게 표현하는 이름을 적어주세요.",
    s1TitlePlaceholder: "예: 약속 하나를 끝까지 매듭짓기",
    s1TitleBlocker: "이 교육의 짧은 이름을 적어주세요.",
    docBusyBlocker: "파일 업로드가 끝나면 다시 사용할 수 있어요.",
    s1ProblemLabel: "무엇이 반복해서 잘못되고 있나요?",
    s1Q: "무엇이 계속 잘못되나요?",
    s1Help: "일반적인 주제가 아니라 반복되는 구체적인 상황을 적어주세요.",
    s1Placeholder: "예: 교대 인수인계에서 이중 확인 단계가 계속 누락됩니다.",
    s1Blocker: "무엇이 반복되는지 한 문장으로 적어 주세요.",
    s2Q: "누가 다르게 행동해야 하나요?",
    audEveryone: "모두",
    audLeaders: "리더",
    audLeadersEligible: (n: number) => `현재 ${n}명이 리더 조건을 충족합니다.`,
    audLeadersZero:
      "아직 조직에 지정된 리더십 책임이 없어 미리보기가 비어 있습니다. 관리자에게 회원 신원 페이지에서 리더십 책임을 지정해 달라고 요청하세요.",
    audLeadersPreviewNote:
      "미리보기입니다. 조직에 지정된 리더십 책임만 셉니다. 리더를 고르면 이 훈련이 누구를 위한 것인지 정해질 뿐, 배정하거나 초대하거나 입장을 막지는 않습니다. 참여는 링크로 열려 있고 이름은 남지 않습니다.",
    audLeadersPreviewLoading: "대상을 확인하는 중…",
    audLeadersPreviewError: "지금은 리더 조건을 확인할 수 없습니다.",
    pmTitle: "참여 방식",
    pmOpenLabel: "링크로 참여",
    pmOpenDesc:
      "링크가 있는 사람은 누구나 들어올 수 있습니다. 나중에 본인이 기록을 연결하기 전까지는 누가 했는지 알 수 없습니다.",
    pmAssignedLabel: "구성원에게 배정",
    pmAssignedDesc:
      "아래 구성원에게 필수 학습으로 배정합니다. 참여 링크는 그대로 열려 있어, 배정받지 않은 사람도 링크로 들어올 수 있습니다.",
    pmAssignedNote:
      "초대 메일은 가지 않고, 훈련을 열 때 로그인도 필요 없습니다. 배정은 누구를 위한 학습인지 기록할 뿐, 입장을 막거나 실제로 했는지 확인하지는 않습니다.",
    pmAudienceHint: "대상 단계에서 대상을 선택하면 배정될 구성원을 확인할 수 있습니다.",
    pmZeroRecipients:
      "이 대상에 해당하는 구성원이 없어 배정할 수 없습니다. 대상을 바꾸거나 링크로 참여를 선택하세요.",
    pmOpenNoAssign: "아무에게도 배정하지 않습니다. 링크가 있는 사람은 누구나 들어올 수 있습니다.",
    pmRoomLinkBased: "참여 링크로도 들어올 수 있습니다.",
    pmWillCreate: (n: number) => `구성원 ${n}명에게 필수 학습으로 배정합니다.`,
    pmDoneAssignedTitle: "훈련을 만들었습니다",
    pmDoneAssignedCount: (n: number) => `구성원 ${n}명에게 배정했습니다.`,
    pmDoneOpenTitle: "훈련을 만들었습니다",
    pmDoneOpenNoAssign: "아무에게도 배정하지 않았습니다. 링크가 있는 사람은 누구나 들어올 수 있습니다.",
    pmDoneContinue: "훈련 열기",
    realityMissingFieldAction:
      "후속 확인이 예정되어 있지만, 학습자가 실제 업무에서 무엇을 해볼지는 아직 정해지지 않았습니다.",
    realityMissingDecision:
      "이 학습은 학습자에게 결정을 요청하지만, 어떤 결정을 해야 하는지가 아직 정해지지 않았습니다.",
    realityFixCta: "이 부분 완성하기",
    publishErrYoutube: "유효한 YouTube 링크가 아닙니다. 자료를 수정한 후 다시 시도하세요.",
    publishErrPdf: "게시하기 전에 학습 PDF를 첨부하세요.",
    publishErrNotHost: "Foundry 세션을 생성할 권한이 없습니다.",
    publishErrAssignment:
      "배정을 생성하지 못해 게시되지 않았습니다. 다시 시도하세요.",
    audJobGroup: "직군",
    audRole: "특정 역할",
    audJobGroupDetail: "어떤 직군인가요?",
    audRoleDetail: "어떤 역할인가요?",
    s2Blocker: "대상을 선택하세요.",
    s2DetailBlocker: "직군 또는 역할을 적어 주세요.",
    sMomentQ: "이런 일은 보통 언제 일어나나요?",
    sMomentHelp: "다시 돌아오는 실제 순간을 적어 주세요.",
    sMomentPlaceholder: "예: 아침 허들 때마다.",
    sMomentBlocker: "이 상황이 보통 언제 일어나는지 적어 주세요.",
    sMomentNotRepeatable: "한 번뿐인 시점처럼 읽힙니다. 다시 돌아오는 순간을 적어 주세요 — 예: “아침 허들 때마다”.",
    reviewWhenItHappens: "언제 일어나는지",
    s3Q: "이 훈련 후, 무엇을 다르게 해야 하나요?",
    s3Help: "다른 사람이 보거나 들을 수 있는 것을 설명하세요.",
    s3Placeholder: "예: 담당 간호사가 인수인계마다 서명 전 투약량을 복창합니다.",
    s3Blocker: "새로운 행동을 설명해 주세요.",
    s3QuestionBlocker:
      "질문 형태라서 누군가가 그것을 보았다고 말할 수 없습니다. 그 사람이 무엇을 하는지를 써 주세요 — 예: “허들이 끝나기 전에 각 안건의 담당자 한 명과 기한 하나를 말한다.”",
    s3VagueGuidance: "다소 일반적입니다. 누군가 실제로 보거나 들을 수 있는 것을 적어 보세요.",
    s3CapabilityLabel: "역량 (선택)",
    s3CapabilityHelp: "이 훈련이 길러 주는 능력입니다. 제안된 방향에서 채우거나 직접 작성할 수 있습니다.",
    s3CapabilityPlaceholder: "예: 정확한 교대 인수인계",
    s4Q: "훈련 후, 사람들이 이것을 다르게 하고 있다는 것을 무엇으로 알 수 있나요?",
    s4Help: "실제 업무에서 보거나, 듣거나, 기록하거나, 누군가 확인해 줄 수 있는 것을 설명하세요.",
    s4Placeholder: "예: 복창이 인수인계 기록에 표시됩니다.",
    s4BehaviorLead: "이렇게 해야 한다고 했습니다:",
    s4VerifyQ: "이것을 어떻게 확인하나요?",
    verifyObserved: "직접 관찰",
    verifyHeard: "대화에서 들음",
    verifyRecorded: "업무 흐름에 기록됨",
    verifyConfirmed: "다른 사람이 확인",
    s4VerifyGuidance: "가장 분명한 증거 출처를 선택하세요.",
    s4Honesty: "훈련 완료가 행동 변화의 증거는 아닙니다 — 실제 업무에서 확인할 것을 말합니다.",
    s4Blocker: "무엇을 확인할지 설명해 주세요.",
    s5Q: "이 훈련에는 무엇이 포함되어야 하나요?",
    s5Help: "해당하는 것을 모두 선택하세요.",
    needInfoTitle: "정보",
    needInfoDesc: "사람들이 무언가를 이해해야 합니다.",
    needDecideTitle: "결정",
    needDecideDesc: "사람들이 판단이나 다짐을 해야 합니다.",
    needPracticeTitle: "연습",
    needPracticeDesc: "사람들이 행동을 연습해야 합니다.",
    needSharedTitle: "공통 기준",
    needSharedDesc: "팀에 하나의 공통된 방식이 필요합니다.",
    s5ArenaHint: "이런 변화는 보통 압박 속 연습이 필요합니다 — 나중에 Arena가 도울 수 있습니다.",
    s5Blocker: "최소 하나를 선택하세요.",
    s6Q: "사람들은 무엇으로 배우나요?",
    matYoutube: "YouTube 영상",
    matPdf: "PDF 문서",
    matYoutubePlaceholder: "YouTube 링크를 붙여넣으세요.",
    ytMissingTitle: "링크가 아직 없습니다",
    requiredBeforeApproval: "승인 전 필요",
    pdfMissingLead: "승인 전에 PDF를 추가하게 됩니다.",
    s6Blocker: "사람들이 무엇으로 배울지 선택하세요.",
    s6WrittenBlocker: "팀이 읽을 가이드를 작성하세요.",
    s6LiveDiscussionBlocker: "팀이 논의할 내용을 추가하세요.",
    pdfAttachLead: "팀이 읽을 PDF를 첨부하세요.",
    attachPdf: "PDF 첨부",
    replacePdf: "PDF 교체",
    removePdf: "제거",
    uploadingPdf: "PDF 업로드 중…",
    removingPdf: "제거 중…",
    uploadFailed: "PDF를 업로드하지 못했습니다 — 다시 시도",
    removeFailed: "PDF를 제거하지 못했습니다 — 다시 시도",
    pdfReadyBadge: "준비됨",
    pagesLabel: (n) => `${n}페이지`,
    matFiles: "파일 및 문서",
    matWritten: "문서 가이드",
    matWrittenDesc: "작성한 내용을 팀이 BTY 안에서 읽습니다.",
    matWrittenPlaceholder: "팀이 읽어야 할 가이드를 작성하세요.",
    matWrittenMissing: "가이드가 아직 작성되지 않았습니다",
    matLiveDiscussion: "라이브 논의",
    matLiveDiscussionDesc: "본인이나 진행자가 이끄는 자리에서 팀이 함께 이야기합니다.",
    matLiveDiscussionPlaceholder: "팀이 무엇을 논의해야 하나요? 주제, 질문 또는 짧은 진행 순서.",
    matLiveDiscussionMissing: "논의 주제가 아직 없습니다",
    matLiveDiscussionHonesty:
      "BTY는 팀에게 무엇을 논의할지 보여 줍니다. 논의 자체는 볼 수 없으므로, 참여했다는 본인의 진술만 기록됩니다.",
    reviewMatWritten: "문서 가이드",
    reviewMatLiveDiscussion: "라이브 논의",
    viewDocument: "문서 보기",
    publishErrPageCount: "이 문서의 페이지 수를 확인하지 못했습니다. 세션을 만들기 전에 문서를 열어 보거나 파일을 교체해 주세요.",
    viewDocumentError: "문서를 열지 못했습니다. 세션을 만들기 전에 확인해 주세요.",
    materialReviewTitle: "문서를 확인하세요",
    materialReviewBody:
      "BTY는 이 파일을 읽을 수 없어 이 트레이닝과 맞는지 판단할 수 없습니다. 직접 열어 작성한 내용에 맞는 문서인지 확인하세요.",
    materialReviewConfirm: "이 트레이닝을 위해 이 문서를 확인했습니다",
    materialReviewConfirmed: "이 문서를 확인했습니다",
    filesHeader: "파일 및 문서",
    filesLead: "팀이 사용할 자료를 추가하세요.",
    attachFiles: "파일 첨부",
    addPhoto: "사진 또는 스크린샷 추가",
    assetAttached: "첨부됨",
    assetUploading: "업로드 중…",
    assetRemove: "제거",
    errUnsupported: "지원하지 않는 파일 형식",
    errTooLarge: "파일이 너무 큽니다",
    errGeneric: "업로드하지 못했습니다 — 다시 시도",
    deliveryReady: "참가자 전달 준비됨",
    deliveryDeferred: "승인 전에 전달 설정이 완료됩니다.",
    reviewMaterials: "학습 자료",
    noFilesYet: "아직 첨부된 파일이 없습니다",
    quickLead: "바로 시작해야 하나요?",
    s7ArenaQ: "사람들이 Arena에서 연습해야 하나요?",
    s7ArenaRecommended: "이런 변화에 권장됩니다.",
    s7ArenaAccept: "네, 연습을 권장합니다",
    s7ArenaDecline: "필요 없음",
    s7FollowQ: "언제 결과를 확인할까요?",
    followNone: "후속 없음",
    follow7: "7일 후",
    follow30: "30일 후",
    s7Blocker: "후속 시점을 선택하세요.",
    reviewEyebrow: "훈련 초안",
    revisionTitle: "새 버전 만들기",
    revisionNote: "현재 게시된 트레이닝은 그대로 유지됩니다.",
    journeyApprovalBlocked: "학습자 제목을 확인하고 “확인 필요” 요소를 모두 해결한 후 트레이닝을 만들 수 있습니다.",
    journeyStart: "트레이닝 검토",
    reviewSaved: "저장됨",
    reviewLead: "만든 내용을 검토하세요.",
    sectionsNeedAttention: (n) => `주의가 필요한 항목 ${n}개`,
    requiredLabel: "필수",
    reviewChange: "무엇을 바꿔야 하는가",
    reviewWho: "누구를 위한 것인가",
    reviewCapability: "역량",
    reviewBehavior: "무엇을 다르게 해야 하는가",
    reviewEvidence: "성공을 어떻게 알아볼까",
    reviewLearning: "학습 방식",
    reviewMaterial: "자료",
    reviewArena: "Arena 연습",
    reviewFollow: "후속 확인",
    reviewFollowNoneMeaning: "이 트레이닝에는 후속 확인이 생성되지 않으며, 제3자 관찰도 요청되지 않습니다.",
    reviewEmpty: "아직 추가되지 않음",
    arenaYes: "권장됨",
    arenaNo: "권장되지 않음",
    gBehaviorNeeds: "명확히 필요",
    gBehaviorHint: "다른 사람이 보거나 들을 수 있는 것을 설명하세요.",
    gPdfMissing: "PDF 파일이 아직 없습니다",
    gYtMissing: "링크가 아직 없습니다",
    s6CompletionQ: "완료 질문",
    s6CompletionHelp: "학습자가 스스로 정한 구체적인 결정이나 다음 행동 한 가지를 묻습니다. 자료를 그대로 반복해서 답할 수 있다면 아무것도 묻지 않은 것입니다.",
    s6CompletionPlaceholder: "다음에 이런 상황이 생기면 한 가지 무엇을 다르게 해보겠습니까?",
    s6SharedQ: "공유 이해 질문",
    s6SharedHelp: "이 교육으로 무엇이 바뀌기 전에, 지금 실제 업무에서 어떤 일이 일어나는지 묻습니다. 이 답변이 담당자에게 공유된다고 학습자에게 안내됩니다. 판단·연습·공통 기준 교육에는 기본 제안됩니다 — 수정하거나 비워서 제거할 수 있습니다.",
    s6SharedPlaceholder: "지금은 이런 상황에서 보통 어떻게 하고 있나요?",
    questionCopyLike:
      "이 질문은 위 내용을 그대로 반복해서 답할 수 있습니다. 학습자의 실제 경험이나 다음 결정을 묻는 질문이 더 좋습니다.",
    questionCopyLikeCta: "질문 수정",
    paEntryTitle: "BTY가 이 훈련의 초안을 만들어 드릴까요?",
    paEntryBody:
      "지금까지 적어 주신 내용으로, 팀이 실제로 경험할 훈련을 처음부터 끝까지 씁니다 — 왜 중요한지, 어떤 행동 기준인지, 어떤 상황에서 어려운지, 무엇을 정할지, 그다음에 무엇이 일어나는지. 적용 전에 한 칸씩 직접 확인하실 수 있습니다.",
    paGenerateCta: "BTY가 훈련 초안 만들기",
    paNotReadyHint: "먼저 어떤 문제인지, 누구에게 필요한지, 무엇을 다르게 할지, 잘됐는지 어떻게 알지를 적어 주세요.",
    paWorking: "훈련 초안을 쓰고 있습니다…",
    paWorkingNote: "적용하기 전까지 초안은 그대로입니다.",
    paApplying: "훈련에 적용하는 중…",
    paReviewEyebrow: "BTY가 제안한 내용",
    paReviewBody: "아직 아무것도 확정되거나 공개되지 않았습니다. 칸마다 그대로 둘지, BTY 제안을 쓸지, 직접 고칠지 정하세요.",
    paReviewGrammar: "금색 칸은 직접 쓰는 곳입니다. 옆에 선이 있는 일반 글씨는 BTY가 쓴 문장이고, 읽어 보시라고 둔 것입니다.",
    paProgramTitleLabel: "훈련 이름",
    paStateKeep: "내 내용 유지",
    paStateEdited: "직접 고침",
    paStateUseBty: "BTY 제안 사용",
    paStateUnavailable: "반복되는 시점이 필요합니다",
    paBadgeYourWording: "내가 쓴 문장",
    paBadgeAdjusted: "내가 고침",
    paBadgeDraftedByBty: "BTY 제안",
    paBadgeFromYourSetup: "내가 입력한 내용",
    paKeepYours: "내 내용 유지",
    paUseBtyDraft: "BTY 제안 사용",
    paEditDetails: "세부 내용 고치기",
    paEditDetailsDone: "완료",
    paUnavailableNote: "위의 “언제 해야 하나요?”에 반복되는 시점을 적어 주시면 이 칸이 채워집니다.",
    paDerivedNote: "훈련을 만들 때 적으신 문제에서 나온 문장이라, 여기서는 고치지 않습니다.",
    paApplyCta: "이 내용을 훈련에 적용",
    paResetCta: "BTY 제안으로 되돌리기",
    paDiscardCta: "제안 버리기",
    paAppliedTitle: "✓ 훈련에 적용했습니다.",
    paAppliedPending: "훈련에 적용했습니다. 기록을 마무리하는 중…",
    paAppliedShow: "BTY 제안 다시 보기 ▾",
    paAppliedHide: "접기 ▴",
    paApplyFailedTitle: "적용하지 못했습니다.",
    paApplyFailedBody: "아무것도 저장되지 않았고 초안도 그대로입니다. 확인하던 내용은 그대로 있으니 다시 시도해 보세요.",
    paStillNeeded: (kinds) => `아직 필요한 부분: ${kinds}`,
    jbNeedsConfirmation: (label) => `${label} — 아직 확인이 필요합니다`,
    jbMissingFromProgram: (label) => `${label} — 아직 없습니다`,
    paTargetAriaLabel: "초안을 만들 훈련",
    paUntitledDraft: "이름 없는 훈련",
    paApplyFootnote: "적용하면 내 초안에 들어갑니다. 아직 확정되거나 공개되지 않고, 아무에게도 보이지 않습니다.",
    paAutoWorking: "BTY가 초안을 만드는 중…",
    paAutoDone: "BTY가 초안을 만들었습니다.",
    paAutoFailedTitle: "BTY가 초안을 만들지 못했습니다.",
    paAutoRetry: "다시 시도",
    paAutoManual: "직접 계속하기",
    reviewDetailsToggle: "세부 내용 보기",
    reviewDetailsHint: "입력하신 내용과, 어디서 고칠 수 있는지",
    reviewDetailsAttention: (n) => `${n}개는 아직 확인이 필요합니다`,
    paCeilingHeading: "이 훈련으로 알 수 있는 것과 알 수 없는 것",
    paAssumptionsHeading: "이런 전제를 두고 있습니다",
    paWarningsHeading: "함께 알아 두실 점",
    jpEyebrow: "학습자 화면 미리보기",
    jpBody: "팀이 실제로 보게 될 화면입니다. 아래 금색 칸은 모두 직접 고치실 수 있습니다.",
    jpHandoffNote: "BTY 제안이 여기로 들어왔습니다. 아래에서 원하는 문장을 고치세요.",
    jpTitleLabel: "학습자에게 보일 이름",
    jpTitleConfirm: "이름 확정",
    jpTitleOk: "확정됨",
    jpNeedsConfirmation: "확인 필요",
    jpPlaceholder: "직접 적어 주세요 — BTY가 임의로 채우지 않습니다.",
    jpFromSetup: "내가 입력한 내용",
    jpYourEdit: "내가 고침",
    jpDraftedByBty: "BTY 제안",
    jpFromYour: (field) => `내가 정한 ${field}`,
    journeyKind: {
      why_it_matters: "왜 중요한가",
      observable_standard: "행동 기준",
      scenario: "이런 상황에서",
      reflection: "돌아보기",
      action_decision: "내가 정할 것",
      field_application: "실제로 해보기",
      evidence: "잘된 모습",
      completion_check: "마치기 전에",
      follow_up: "다음에는",
    },
    journeyField: {
      problem: "반복되는 문제",
      recurringMoment: "반복되는 시점",
      observableBehavior: "행동 기준",
      successEvidence: "성공 기준",
      sharedQuestion: "함께 나눌 질문",
      completionPrompt: "마무리 질문",
    },
    programRefusedRecovery:
      "BTY가 초안을 만든 뒤 교육 내용이 변경되었습니다. 최신 내용으로 다시 초안을 만드세요.",
    programRefusedRecoveryCta: "다시 초안 만들기",
    reviewCompletion: "완료 질문",
    publishCta: "훈련 만들기",
    publishTrust: "참여용 QR이 있는 실제 훈련 세션을 만듭니다. 참가자가 입장하고 완료할 수 있게 됩니다.",
    publishing: "세션을 만드는 중…",
    publishError: "세션을 만들지 못했습니다. 다시 시도해 주세요.",
    publishErrSessionCreated: "세션은 생성되었지만 여기에 표시하지 못했습니다. 이 트레이닝을 다시 열어 확인하세요. 다시 생성하지 마세요.",
    copilot: {
      entryPrompt: "이 문제를 어떤 교육으로 만들지 막막하신가요?",
      trigger: "가능한 교육 방향 3개 보기",
      entrySupport: "BTY가 세 가지 접근을 제안합니다. 검토하고 수정한 뒤에만 적용됩니다.",
      loading: "가능한 세 가지 방향을 찾는 중…",
      resultsHeading: "가능한 세 가지 방향",
      draftBadge: "제안된 방향",
      viewDetails: "자세히 보기",
      hideDetails: "접기",
      labelTitle: "방향",
      labelCapability: "역량",
      capabilityBlocker: "적용하기 전에 역량 이름을 입력해 주세요.",
      labelWhy: "적합한 이유",
      labelBehavior: "행동 초안",
      labelEvidence: "확인할 증거",
      labelAssumption: "가정",
      useThis: "이 방향 사용",
      describeAnother: "다른 방향 직접 쓰기",
      reviewHeading: "이 방향 검토",
      reviewLead: "원하는 대로 수정하세요. 적용하기 전까지 초안은 바뀌지 않습니다.",
      reviewApplies: "초안에 추가될 내용:",
      backToDirections: "세 가지 방향으로 돌아가기",
      apply: "이 방향 적용",
      applied: "초안에 추가되었습니다 — 모든 부분을 계속 수정할 수 있습니다.",
      appliedDismiss: "완료",
      failTitle: "지금은 방향을 생성하지 못했습니다.",
      tryAgain: "다시 시도",
      continueWithout: "제안 없이 계속하기",
      rateLimited: "잠시 후 다시 시도해 주세요.",
      staleTitle: "문제가 변경되었습니다.",
      staleHint: "일치하도록 방향을 다시 생성하세요.",
      generateAgain: "다시 생성",
    },
    moduleDraft: {
      entryPrompt: "나머지 교육 초안을 만들어볼까요?",
      trigger: "나머지 교육 초안 만들기",
      entrySupport: "BTY가 학습 방식, 완료 질문, Arena 연습, 후속 확인을 제안합니다. 각 항목을 검토한 뒤에만 적용됩니다.",
      loading: "나머지 항목 초안을 만드는 중…",
      reviewHeading: "초안 검토",
      reviewLead: "기존 값을 유지하거나 제안을 사용하세요. 적용하기 전까지 아무것도 바뀌지 않습니다.",
      applyNote: "“제안 사용”으로 설정한 항목만 추가됩니다.",
      secLearning: "학습 방식",
      secCompletion: "완료 질문",
      secArena: "Arena 연습",
      secFollow: "후속 확인",
      secMaterial: "자료 가이드",
      currentLabel: "현재 값",
      suggestedLabel: "제안",
      whyLabel: "이유",
      assumptionsLabel: "가정",
      warningsLabel: "참고 사항",
      materialTypesLabel: "도움이 될 형식",
      keep: "현재 값 유지",
      use: "제안 사용",
      skip: "건너뛰기",
      apply: "검토한 초안 적용",
      applied: "초안에 추가되었습니다 — 모든 항목을 계속 수정할 수 있습니다.",
      appliedDismiss: "완료",
      failTitle: "지금은 나머지 항목 초안을 만들지 못했습니다.",
      tryAgain: "다시 시도",
      continueManually: "수동으로 계속하기",
      rateLimited: "잠시 후 다시 시도해 주세요.",
      staleTitle: "교육 내용이 변경되었습니다.",
      staleHint: "일치하도록 초안을 다시 생성하세요.",
      regenerate: "다시 생성",
      needs: { know: "정보", decide: "결정", practice: "연습", shared_standard: "공통 기준" },
      follow: { d0: "후속 없음", d7: "7일 후", d30: "30일 후" },
      arenaYes: "권장됨",
      arenaNo: "권장되지 않음",
      materialTypes: { youtube: "YouTube 영상", pdf: "PDF 문서", written: "문서 가이드", live_discussion: "라이브 논의" },
      clarification: {
        intro: "초안이 상황에 맞도록 한 가지만 확인할게요:",
        submit: "계속",
        customPlaceholder: "짧게 답해 주세요",
        draftAnyway: "지금 정보로 초안 만들기",
        questions: {
          target: "누가 구체적으로 이것을 다르게 해야 하나요?",
          observable_behavior: "누군가 무엇을 다르게 하는 것을 정확히 보거나 들을 수 있어야 하나요?",
          success_evidence: "실제 업무에서 이것이 일어나고 있음을 무엇으로 알아챌 수 있나요?",
          role_authority: "이 그룹이 스스로 이것을 바꿀 권한이 있나요?",
          learning_context: "사람들에게 가장 필요한 것은 무엇인가요 — 알기, 결정하기, 아니면 연습하기?",
          field_application: "실제 업무 흐름의 어디에서 이것이 드러나야 하나요?",
          follow_up: "이것이 정착됐는지 언제 확인하고 싶으신가요?",
        },
        choices: {
          ev_seen: "직접 보게 됨",
          ev_heard: "듣게 됨",
          ev_recorded: "기록으로 남음",
          ev_confirmed: "다른 사람이 확인해 줌",
        },
      },
    },
  },
};

export { arenaFollowLabel };

/**
 * BTY's suggested completion question — the same sentence for every training (Slice R4-R5C12A).
 *
 * WHAT THIS REPLACES, and why it was wrong. The old template read
 * `Thinking about "<observableBehavior>", what is one thing you will apply this week?` — it put
 * the Host's own standard INSIDE the question, so the learner met the answer and the question in
 * one breath. Measured across the live corpus: 10 of 37 completion questions came out of that
 * template, 8 carry effectively the standard's whole vocabulary, and 22 overlap it at 0.50 or
 * more. Not one of the 37 asked the learner for something only they could supply.
 *
 * So it quotes nothing. "The next time this happens" is a pointer to the learner's own next real
 * occasion — the same pointer APPLY IT has used since R4-R5C11 — and "one thing you will do
 * differently" is answerable only from their own judgment. The Host's answers are no longer read;
 * the parameter stays so every call site and its tests are untouched, and so a later suggestion
 * that legitimately needs context still has somewhere to read it from.
 */
export function suggestCompletionPrompt(
  _answers: { observableBehavior?: string; problem?: string } | undefined,
  loc: Locale,
): string {
  return loc === "ko" ? BTY_SUGGESTED_COMPLETION_PROMPTS[1] : BTY_SUGGESTED_COMPLETION_PROMPTS[0];
}

/**
 * BTY's suggested Shared Understanding question (Slice 3.1B-3G; rewritten in R4-R5C12A).
 *
 * WHAT THIS REPLACES. It read "In your own words, what is the most important standard from this
 * training?" — and 15 of the 16 shared questions in the live corpus are that sentence, byte for
 * byte. Its documented job was articulation of the standard, which is exactly what a learner can
 * do by scrolling up; zero questions in the corpus asked what actually happens in their work
 * today.
 *
 * The new question is answerable ONLY from the learner's own week, and it stays truthfully
 * answerable by someone who does not do the trained behaviour at all — the property the
 * generator's REFLECT contract has required since Slice 3.2P-A2-R2, now required of BTY's own
 * prefill too. It follows the wording the learner room already uses beneath this question
 * ("Write what usually happens…" / "평소 어떤 일이 일어나는지 적어 주세요…") rather than inventing a
 * second dialect for the same act.
 *
 * The caller decides WHETHER to propose it (shouldProposeSharedQuestion by need). Non-AI.
 */
export function suggestSharedQuestion(loc: Locale): string {
  return loc === "ko" ? BTY_SUGGESTED_SHARED_QUESTIONS[1] : BTY_SUGGESTED_SHARED_QUESTIONS[0];
}
