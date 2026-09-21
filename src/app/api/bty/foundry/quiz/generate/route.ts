import { NextRequest } from "next/server";
import { requireManager, managerJson } from "@/lib/bty/foundry/events/managerGate";
import { generateQuizDraft, type QuizGenerationCode } from "@/lib/bty/foundry/events/quickTrainingQuizGeneration";

export const runtime = "nodejs";

/**
 * POST /api/bty/foundry/quiz/generate — draft a quiz from the manager's own study content.
 *
 * READ-ONLY BY CONSTRUCTION: it persists nothing. The draft goes back to the manager's editor,
 * and only what they submit with the training is ever stored.
 */
const STATUS: Readonly<Record<QuizGenerationCode, number>> = {
  invalid_input: 400,
  source_too_short: 400,
  provider_unavailable: 503,
  structured_output_unavailable: 503,
  timeout: 504,
  provider_error: 502,
  invalid_output: 502,
  source_ungrounded: 422,
};

export async function POST(req: NextRequest) {
  const gate = await requireManager(req);
  if (!gate.ok) return gate.response;
  const body = await req.json().catch(() => ({}));
  const result = await generateQuizDraft(body?.sourceText, body?.questionCount, body?.locale);
  return managerJson(gate.ctx.base, req, result, result.ok ? 200 : (STATUS[result.code] ?? 400));
}
