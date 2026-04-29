/**
 * Foundry service re-export hub.
 * Aggregates mentor, scenario, and leadership-engine services under a single namespace.
 * Selective re-exports to avoid naming conflicts across modules.
 * No file moves — gradual migration principle.
 */

// --- Scenario ---
export {
  getContextForUser,
  getScenarioById,
  getRandomScenario,
  computeResult,
} from "../scenario/engine";
export { SCENARIOS } from "../scenario/legacy/bundledScenarios";
export type {
  Scenario,
  ScenarioChoice,
  ScenarioSubmitPayload,
  ScenarioSubmitResult,
  HiddenStatKey,
} from "../scenario/types";
export {
  getBeginnerScenarioById,
  pickRandomBeginnerScenario,
  BEGINNER_SCENARIOS,
} from "../scenario/beginnerScenarios";
export {
  computeBeginnerMaturityScore,
  getMaturityFeedback,
  MATURITY_BANDS,
  BEGINNER_SCORING,
} from "../scenario/beginnerTypes";
export type { BeginnerScenario, MaturityFeedback } from "../scenario/beginnerTypes";

// --- Mentor ---
export {
  DR_CHI_PHILOSOPHY,
  DR_CHI_FEW_SHOT_EXAMPLES,
} from "../mentor/drChiCharacter";
export {
  routeByWeightedRules,
  buildMentorMessagesDual,
  inferLang,
  ALL_BUNDLES,
} from "../mentor/mentor_fewshot_dropin";
export type {
  RouteResult,
  BuildOptions,
  LangKey,
} from "../mentor/mentor_fewshot_dropin";

// --- Leadership Engine Service ---
export {
  getLeadershipEngineState,
  applyStageTransition,
  ensureLeadershipEngineState,
} from "../leadership-engine/state-service";
export {
  getCertifiedStatus,
  isUserCertified,
  getLRI,
  approveLeaderTrack,
} from "../leadership-engine/certified-lri-service";
export { compute_team_tii } from "../leadership-engine/tii-service";
export { getTeamIds, buildGetTeamTIIInputs } from "../leadership-engine/tii-weekly-inputs";

// --- Dojo submit ---
export { submitDojo50 } from "./dojoSubmitService";
export type {
  Dojo50SubmitSuccess,
  Dojo50SubmitError,
  Dojo50SubmitResult,
  DojoSubmissionRow,
  DojoSubmissionsResponse,
  DojoSubmissionsErrorResponse,
} from "./dojoSubmitService";

// --- Integrity submit ---
export { submitIntegrity } from "./integritySubmitService";
export type {
  IntegritySubmitSuccess,
  IntegritySubmitError,
  IntegritySubmitResult,
  SubmitIntegrityOptions,
} from "./integritySubmitService";
