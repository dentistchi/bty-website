/**
 * ONE LIVE REVIEW OF A FROZEN SUBJECT (Slice 3.2I-R5B1A.1-R2.25).
 *
 * The live half of the reviewer replay: exactly one structured review call over a frozen scenario,
 * using the SAME prompt, schema and sampling as production. It evaluates; it never authors. There is
 * no generation import here and no path that could add one.
 *
 * Not executed in R2.25 — the replay runner is prepared and bound, not run.
 */

import { canonicalJson, type ReviewSubject } from "@/domain/foundry/arena-draft/reviewSubject";
import { SEMANTIC_REVIEW_JSON_SCHEMA, SEMANTIC_REVIEW_SCHEMA_NAME, validateSemanticReview } from "@/domain/foundry/arena-draft/semanticReview";
import { enumerateChoices } from "@/domain/foundry/arena-draft/choiceConstruction";
import { isContradiction } from "@/domain/foundry/arena-draft/reviewRerun";
import { getLlmClient, getLlmModel } from "@/lib/bty/llm/client";
import { PRACTICE_SAMPLING, REVIEW_SYSTEM_PROMPT } from "./arenaScenarioGenerationService";
import type { ReplayReviewResult } from "./reviewReplay";
import type { ArenaScenarioDraft } from "@/domain/foundry/arena-draft/types";

export async function reviewFrozenSubject(subject: ReviewSubject): Promise<ReplayReviewResult> {
  const draft = subject.scenario as ArenaScenarioDraft;
  const payload = {
    constraints: subject.confirmedBoundaries,
    visibleChoices: enumerateChoices(draft).map((c) => ({ phase: c.phase, branchIndex: c.branchIndex, choiceIndex: c.index, label: c.label, construction: null })),
    opening: draft.opening,
    primary: draft.primary.choices,
    branches: Object.fromEntries(
      Object.entries(draft.branches ?? {}).map(([k, b]) => [k, { escalation: b.escalationText, tradeoff: b.tradeoffChoices, action: b.actionDecision.choices }]),
    ),
    flatTradeoff: draft.tradeoff.choices,
    flatAction: draft.actionDecision.choices,
  };

  try {
    const completion = await getLlmClient().chat.completions.create({
      model: getLlmModel(),
      messages: [
        { role: "system", content: REVIEW_SYSTEM_PROMPT },
        { role: "user", content: canonicalJson(payload) },
      ],
      temperature: PRACTICE_SAMPLING.review.temperature,
      top_p: PRACTICE_SAMPLING.review.topP,
      max_tokens: PRACTICE_SAMPLING.review.maxTokens,
      response_format: { type: "json_schema", json_schema: { name: SEMANTIC_REVIEW_SCHEMA_NAME, strict: true, schema: SEMANTIC_REVIEW_JSON_SCHEMA } },
    });
    const rc = completion.choices[0];
    const finishReason = rc?.finish_reason ?? null;
    if (finishReason === "length") return { kind: "malformed", errors: ["review_truncated"], finishReason };
    const raw = rc?.message?.content;
    if (!raw) return { kind: "transport_failed", sanitizedError: "empty_review_content" };

    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      return { kind: "malformed", errors: ["review_not_json"], finishReason };
    }
    const v = validateSemanticReview(parsed, {
      primaryCount: draft.primary.choices.length,
      branchCount: Object.keys(draft.branches ?? {}).length,
      constraintIds: subject.confirmedBoundaries.map((c) => c.id),
      choices: enumerateChoices(draft),
    });
    if (!v.ok) {
      return isContradiction(v.errors)
        ? {
            kind: "contradiction",
            parsed: v.value ?? parsed,
            overallVerdict: (v.value?.overallVerdict as string | undefined) ?? null,
            derivedDefects: v.derivedDefects ?? [],
            errors: v.errors,
            finishReason,
          }
        : { kind: "malformed", errors: v.errors, finishReason };
    }
    return v.verdict === "reject"
      ? { kind: "reject", parsed: v.value, overallVerdict: "reject", derivedDefects: v.defects, finishReason }
      : { kind: "ok", parsed: v.value, overallVerdict: String(v.value.overallVerdict), derivedDefects: [], finishReason };
  } catch {
    // Sanitized: no headers, no body, no provider account metadata.
    return { kind: "transport_failed", sanitizedError: "review_request_failed" };
  }
}
