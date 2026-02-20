import type { AssessmentAnswers, AssessmentResult, Question } from "./types";
import { computeDimensionScores } from "./scoring";
import { buildOnePageSummary, detectBarriers, detectPattern, recommendTrack } from "./patterns";

export function scoreAssessment(questions: Question[], answers: AssessmentAnswers): AssessmentResult {
  const scores = computeDimensionScores(questions, answers);
  const pattern = detectPattern(scores);
  const barriers = detectBarriers(scores);
  const recommendedTrack = recommendTrack(scores);
  const summary = buildOnePageSummary(scores);

  return {
    version: 1,
    createdAtISO: new Date().toISOString(),
    scores,
    pattern,
    barriers,
    recommendedTrack,
    ...summary,
  };
}
