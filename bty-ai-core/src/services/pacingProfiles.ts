/**
 * Pacing Profiles
 * Defines response pacing based on maturity stage, role, and risk level
 */

import type { MaturityStage } from "./maturityStage";

export type Role = "leader" | "doctor" | "staff";

export type PacingProfile = {
  maxSentences: number;
  allowQuestion: boolean;
  questionStyle: "none" | "one_short" | "offer_two_choices";
  allowActionSuggestion: boolean;
  allowedLens: Array<"emotion" | "meaning" | "perspective" | "ownership" | "alignment">;
};

/**
 * Gets pacing profile based on maturity stage, role, and risk level
 */
export function getPacingProfile(
  stage: MaturityStage,
  role: Role,
  riskLevel: "low" | "medium" | "high"
): PacingProfile {
  // High risk override: reduce to 1-2 sentences, no questions
  if (riskLevel === "high") {
    return {
      maxSentences: 2,
      allowQuestion: false,
      questionStyle: "none",
      allowActionSuggestion: false,
      allowedLens: ["emotion"], // Only emotion lens for high risk
    };
  }

  // Stage-based profiles
  switch (stage) {
    case "blame":
    case "reaction":
      return {
        maxSentences: 2,
        allowQuestion: true, // Can use one_short question
        questionStyle: "one_short",
        allowActionSuggestion: false,
        allowedLens: ["emotion", "meaning"], // Focus on emotion and meaning
      };

    case "awareness":
      return {
        maxSentences: 3,
        allowQuestion: true,
        questionStyle: "one_short",
        allowActionSuggestion: false,
        allowedLens: ["emotion", "meaning", "perspective"], // Add perspective
      };

    case "ownership":
      return {
        maxSentences: 3,
        allowQuestion: true,
        questionStyle: "one_short",
        allowActionSuggestion: true, // ONE small action only
        allowedLens: ["emotion", "meaning", "perspective", "ownership"], // Add ownership
      };

    case "alignment":
      // Alignment stage: leaders only, SERI ok
      if (role === "leader") {
        return {
          maxSentences: 3,
          allowQuestion: true,
          questionStyle: "one_short",
          allowActionSuggestion: true,
          allowedLens: [
            "emotion",
            "meaning",
            "perspective",
            "ownership",
            "alignment",
          ], // All lenses available
        };
      } else {
        // Non-leaders: treat as ownership stage
        return {
          maxSentences: 3,
          allowQuestion: true,
          questionStyle: "one_short",
          allowActionSuggestion: true,
          allowedLens: ["emotion", "meaning", "perspective", "ownership"],
        };
      }

    default:
      // Default to awareness profile
      return {
        maxSentences: 3,
        allowQuestion: true,
        questionStyle: "one_short",
        allowActionSuggestion: false,
        allowedLens: ["emotion", "meaning", "perspective"],
      };
  }
}
