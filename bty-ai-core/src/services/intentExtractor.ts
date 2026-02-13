import OpenAI from "openai";

const INTENT_EXTRACTOR_SYSTEM_PROMPT = `You are an intent extraction engine for BTY.
Return ONLY valid JSON. No extra text.

Decide:
- intent: one of ["debug_product","share_story","seek_advice","venting","conflict","money","clinical","relationship","leadership_reflection","other"]
- user_energy: one of ["low","medium","high"]
- tone_needed: one of ["warm_mentor","calm_direct","light_playful"]
- next_step: one of ["reflect","clarify","suggest_action","redirect_to_human","ask_for_example"]
- key_point: 1 short phrase capturing the user's core meaning. MUST be in Korean. Maximum 18 words. No advice, no questions.
- question_style: one of ["none","one_short_question","offer_choices"]
- interpretation_confidence: number 0-1. How confident you are that key_point accurately captures the user's meaning. Use < 0.6 when unclear, ambiguous, or user message is vague.

Output JSON:
{
  "intent": "...",
  "user_energy": "...",
  "tone_needed": "...",
  "next_step": "...",
  "key_point": "...",
  "question_style": "...",
  "interpretation_confidence": 0.0
}

Rules:
- If user complains about AI quality, set intent="debug_product".
- If user says '단어에 집중하지 말고 의미에 집중', set intent="debug_product" and key_point accordingly.
- If user shares personal experience or story, set intent="share_story".
- If user asks for direct advice or solution, set intent="seek_advice".
- If user expresses frustration without seeking solution, set intent="venting".
- If user mentions conflict or disagreement, set intent="conflict".
- If user talks about money, salary, or financial concerns, set intent="money".
- If user discusses clinical cases or medical situations, set intent="clinical".
- If user talks about relationships or interpersonal dynamics, set intent="relationship".
- If user engages in self-reflection or leadership growth, set intent="leadership_reflection".
- Otherwise, set intent="other".

Energy levels:
- low: tired, exhausted, overwhelmed, drained
- medium: neutral, balanced, steady
- high: energetic, enthusiastic, motivated, urgent

Tone needed:
- warm_mentor: gentle, supportive, understanding (default for most cases)
- calm_direct: clear, focused, no-nonsense (for urgent or high-energy situations)
- light_playful: friendly, encouraging, less serious (for low-energy or creative contexts)

Next step:
- reflect: guide through reflection questions
- clarify: ask for more specific information
- suggest_action: propose concrete next steps
- redirect_to_human: suggest human support
- ask_for_example: request specific examples

Question style:
- none: no question needed, just acknowledgment
- one_short_question: single focused question
- offer_choices: present 2-3 options to choose from

key_point rules (HARD):
- Always output key_point in Korean only.
- key_point must be 18 words or fewer. Truncate if longer.
- Captures user's core meaning; no advice, no questions.

Do not explain.
Do not add extra text.
Only return JSON.`;

const INTENT_EXTRACTOR_OPTIONS = {
  temperature: 0.3,
  max_tokens: 200,
} as const;

export type Intent =
  | "debug_product"
  | "share_story"
  | "seek_advice"
  | "venting"
  | "conflict"
  | "money"
  | "clinical"
  | "relationship"
  | "leadership_reflection"
  | "other";

export type UserEnergy = "low" | "medium" | "high";

export type ToneNeeded = "warm_mentor" | "calm_direct" | "light_playful";

export type NextStep =
  | "reflect"
  | "clarify"
  | "suggest_action"
  | "redirect_to_human"
  | "ask_for_example";

export type QuestionStyle = "none" | "one_short_question" | "offer_choices";

export type IntentExtractionResult = {
  intent: Intent;
  user_energy: UserEnergy;
  tone_needed: ToneNeeded;
  next_step: NextStep;
  key_point: string;
  question_style: QuestionStyle;
  interpretation_confidence: number;
};

function getOpenAIClient(): OpenAI {
  const apiKey =
    process.env.AZURE_OPENAI_API_KEY ?? process.env.OPENAI_API_KEY;
  const baseURL = process.env.AZURE_OPENAI_ENDPOINT
    ? `${process.env.AZURE_OPENAI_ENDPOINT}/openai/deployments/${process.env.AZURE_OPENAI_DEPLOYMENT ?? "gpt-4o"}/`
    : undefined;

  if (!apiKey) {
    throw new Error(
      "Missing API key: set AZURE_OPENAI_API_KEY or OPENAI_API_KEY"
    );
  }

  return new OpenAI({ apiKey, baseURL });
}

/**
 * Extracts user intent and interaction metadata from user input.
 * Returns structured intent, energy level, tone preference, next step, key point, and question style.
 */
export async function extractIntent(
  userInput: string,
  role: "leader" | "doctor" | "staff"
): Promise<IntentExtractionResult> {
  try {
    const client = getOpenAIClient();

    const completion = await client.chat.completions.create({
      model: process.env.AZURE_OPENAI_DEPLOYMENT ?? "gpt-4o",
      messages: [
        { role: "system", content: INTENT_EXTRACTOR_SYSTEM_PROMPT },
        {
          role: "user",
          content: `Role: ${role}\nUser message: ${userInput}`,
        },
      ],
      ...INTENT_EXTRACTOR_OPTIONS,
    });

    let content =
      completion.choices[0]?.message?.content?.trim() ?? "{}";
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) content = jsonMatch[0];

    const parsed = JSON.parse(content) as Partial<IntentExtractionResult>;

    const validIntents: Intent[] = [
      "debug_product",
      "share_story",
      "seek_advice",
      "venting",
      "conflict",
      "money",
      "clinical",
      "relationship",
      "leadership_reflection",
      "other",
    ];
    const validEnergies: UserEnergy[] = ["low", "medium", "high"];
    const validTones: ToneNeeded[] = [
      "warm_mentor",
      "calm_direct",
      "light_playful",
    ];
    const validNextSteps: NextStep[] = [
      "reflect",
      "clarify",
      "suggest_action",
      "redirect_to_human",
      "ask_for_example",
    ];
    const validQuestionStyles: QuestionStyle[] = [
      "none",
      "one_short_question",
      "offer_choices",
    ];

    const intent: Intent = validIntents.includes(parsed.intent as Intent)
      ? (parsed.intent as Intent)
      : "other";
    const user_energy: UserEnergy = validEnergies.includes(
      parsed.user_energy as UserEnergy
    )
      ? (parsed.user_energy as UserEnergy)
      : "medium";
    const tone_needed: ToneNeeded = validTones.includes(
      parsed.tone_needed as ToneNeeded
    )
      ? (parsed.tone_needed as ToneNeeded)
      : "warm_mentor";
    const next_step: NextStep = validNextSteps.includes(
      parsed.next_step as NextStep
    )
      ? (parsed.next_step as NextStep)
      : "reflect";
    let key_point: string =
      parsed.key_point && typeof parsed.key_point === "string"
        ? parsed.key_point.trim()
        : "사용자의 의도를 파악 중입니다.";
    // Enforce: Korean only, <= 18 words (hard rule)
    const words = key_point.split(/\s+/).filter((w) => w.length > 0);
    if (words.length > 18) {
      key_point = words.slice(0, 18).join(" ");
    }
    const question_style: QuestionStyle = validQuestionStyles.includes(
      parsed.question_style as QuestionStyle
    )
      ? (parsed.question_style as QuestionStyle)
      : "one_short_question";

    const rawConf = parsed.interpretation_confidence;
    const interpretation_confidence =
      typeof rawConf === "number" && rawConf >= 0 && rawConf <= 1
        ? rawConf
        : 0.8;

    return {
      intent,
      user_energy,
      tone_needed,
      next_step,
      key_point,
      question_style,
      interpretation_confidence,
    };
  } catch (err: any) {
    console.error("[intentExtractor] Error:", {
      message: err?.message,
      code: err?.code,
      status: err?.response?.status,
    });
    // Fallback to safe defaults on error
    return {
      intent: "other",
      user_energy: "medium",
      tone_needed: "warm_mentor",
      next_step: "reflect",
      key_point: "의도 파악 중 오류가 발생했습니다.",
      question_style: "one_short_question",
      interpretation_confidence: 0.5,
    };
  }
}
