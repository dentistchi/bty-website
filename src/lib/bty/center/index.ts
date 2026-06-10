/**
 * Center service layer — 단일 진입.
 * API는 이 모듈만 import. resilience·letter·assessment 서비스 재export.
 */
export {
  getResilienceEntries,
  parsePeriodDays,
} from "./resilienceService";

export {
  getLetterAuth,
  type LetterAuth,
} from "./letterAuth";

export {
  submitLetter,
  submitCenterLetter,
  getLetterHistory,
  getLetterCalendar,
  type SubmitLetterInput,
  type SubmitLetterResult,
  type SubmitCenterLetterInput,
  type SubmitCenterLetterResult,
  type LetterCalendarEntry,
} from "./letterService";

export {
  submitDayReflection,
  type SubmitDayReflectionInput,
  type SubmitDayReflectionResult,
  type DayReflectionResponses,
  type DayReflectionQA,
} from "./dayReflectionService";

export {
  submitAssessment,
  getAssessmentHistory,
  type SubmitAssessmentInput,
  type SubmitAssessmentResult,
} from "./assessmentService";

export {
  getCurrentPhase,
  getHealingPhaseTrackerState,
  advanceHealingPhase,
  type HealingPhaseTrackerState,
} from "./healingPhaseService";

export { DEAR_ME_SUBMITTED_EVENT } from "./dearMeEvents";
