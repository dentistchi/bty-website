/**
 * REVIEW CONTRACT DIGEST (Slice 3.2I-R5B1A.1-R2.25).
 *
 * One digest over everything that defines HOW a scenario is reviewed: the system prompt, the JSON
 * schema, and the sampling settings. It is part of the frozen review subject, so a rerun that would
 * be judged under a different contract fails closed instead of silently producing a verdict about a
 * different question.
 *
 * It depends on no input, so it changes only when the reviewer contract itself changes.
 */

import { createHash } from "node:crypto";
import { canonicalJson } from "@/domain/foundry/arena-draft/reviewSubject";
import { PRACTICE_SAMPLING, REVIEW_SYSTEM_PROMPT } from "./arenaScenarioGenerationService";
import { SEMANTIC_REVIEW_JSON_SCHEMA, SEMANTIC_REVIEW_SCHEMA_NAME } from "@/domain/foundry/arena-draft/semanticReview";

export function buildReviewSubjectContract(): { sha256: string; parts: Record<string, string> } {
  const d = (v: unknown) => createHash("sha256").update(canonicalJson(v)).digest("hex");
  const parts = {
    prompt: d(REVIEW_SYSTEM_PROMPT),
    schemaName: d(SEMANTIC_REVIEW_SCHEMA_NAME),
    schema: d(SEMANTIC_REVIEW_JSON_SCHEMA),
    sampling: d(PRACTICE_SAMPLING.review),
  };
  return { sha256: d(parts), parts };
}
