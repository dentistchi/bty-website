/**
 * AutoRewrite
 * Rewrites draft responses to fix critic issues via GPT-4o.
 */

import { openai } from "../config/openai";
import type { PacingProfile } from "./pacingProfiles";
import {
  getFalsePersonaPatterns,
  getFalsePersonaReplacement,
  getRewriteConstraints,
} from "../config/patchConfig";

export type RewriteProfile = Pick<PacingProfile, "maxSentences">;

/** Hard banned: replace false persona phrases with neutral leader framing. */
function sanitizeFalsePersona(draft: string): string {
  let out = draft;
  const replacement = getFalsePersonaReplacement();
  for (const p of getFalsePersonaPatterns()) {
    const global = new RegExp(p.source, "g");
    out = out.replace(global, replacement);
  }
  return out;
}

/**
 * Rewrites the draft to fix the given issues, respecting profile constraints.
 */
export async function rewriteWithConstraints(
  userText: string,
  draft: string,
  issues: string[],
  profile: RewriteProfile
): Promise<string> {
  let workingDraft = draft;
  const hasFalsePersona = issues.some(
    (i) => i.startsWith("false_persona") || i.includes("false_persona")
  );
  if (hasFalsePersona) {
    workingDraft = sanitizeFalsePersona(draft);
  }

  const constraints = getRewriteConstraints();
  const maxSent = profile.maxSentences ?? constraints.max_sentences;
  const issuesText =
    issues.length > 0 ? issues.join("\n- ") : "No specific issues listed.";

  const personaRule = hasFalsePersona
    ? `\n- NEVER claim personal experience, memories, feelings, or biography. Replace any such phrasing with "리더 입장에서 함께 정리해볼게요."`
    : "";

  const systemPrompt = `Rewrite the assistant message to fix these issues:
- ${issuesText}

Rules:
- Korean
- Warm mentor tone
- First sentence must reflect the user's key meaning
- Max ${maxSent} sentences (or fewer)
- Max 1 question, optional
- Do not mention your own experience${personaRule}
- Do not use coaching phrases (방향성, 구체적으로 생각해, 통제할 수 있는 부분, etc.)
- Do not moralize
Return only the final rewritten message. No explanations.`;

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: systemPrompt },
        {
          role: "user",
          content: `User said: ${userText}\n\nCurrent assistant draft:\n${workingDraft}`,
        },
      ],
      temperature: 0.3,
      max_tokens: 220,
    });

    const rewritten =
      completion.choices[0]?.message?.content?.trim() ?? workingDraft;
    return rewritten;
  } catch (err: any) {
    console.error("[autoRewrite] Error:", {
      message: err?.message,
      code: err?.code,
    });
    return workingDraft;
  }
}
