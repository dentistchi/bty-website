import { getLlmClient, getLlmModel, isLlmAvailable } from "@/lib/bty/llm/client";
import { validateQuiz, type Quiz } from "@/domain/foundry/events/quickTrainingQuiz";

/** Generates an unpersisted manager-review draft from only intentionally supplied source text. */
export async function generateQuizDraft(sourceText: unknown, questionCount: unknown, locale: unknown) {
  const source = typeof sourceText === "string" ? sourceText.trim() : "";
  const count = questionCount === 5 || questionCount === 10 ? questionCount : 0;
  if (!source || !count) return { ok: false as const, code: "invalid_input" };
  if (!isLlmAvailable()) return { ok: false as const, code: "provider_unavailable" };
  const controller = new AbortController(); const timer = setTimeout(() => controller.abort(), 20_000);
  try {
    const reply = await getLlmClient().chat.completions.create({ model: getLlmModel(), temperature: 0, max_tokens: 5000, messages: [
      { role: "system", content: "Return JSON only. Create objective single-answer quiz questions strictly grounded in supplied source. Shape: {schemaVersion:1,questions:[{id,text,position,choices:[{id,label}],correctChoiceId,explanation,sourceEvidence}]}. 2-4 choices. sourceEvidence must be a verbatim substring of source." },
      { role: "user", content: `Locale: ${locale === "ko" ? "ko" : "en"}\nQuestions: ${count}\nSOURCE:\n${source}` },
    ] }, { signal: controller.signal });
    const content = reply.choices?.[0]?.message?.content; if (!content) return { ok: false as const, code: "invalid_output" };
    const quiz = JSON.parse(content) as Quiz; if (validateQuiz(quiz) || quiz.questions.length !== count) return { ok: false as const, code: "invalid_output" };
    if (quiz.questions.some((q) => !q.sourceEvidence || !source.toLocaleLowerCase().includes(q.sourceEvidence.toLocaleLowerCase()))) return { ok: false as const, code: "source_ungrounded" };
    return { ok: true as const, quiz };
  } catch { return { ok: false as const, code: controller.signal.aborted ? "timeout" : "provider_error" }; }
  finally { clearTimeout(timer); }
}
