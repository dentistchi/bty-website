import OpenAI from "openai";

const EMOTION_ANALYZER_SYSTEM_PROMPT = `You are an emotional pattern detection engine.
Analyze the user's message and return:

1. detected_emotion (choose one):
   anger | shame | fear | frustration | confusion | elevation | mission_drive | creative_fulfillment | relational_dependency | isolation_signal

2. maturity_risk_level:
   low | medium | high

Emotion categories:
- anger: defensive, blaming, aggressive tone
- shame: self-critical, guilt, inadequacy
- fear: anxiety, worry, uncertainty
- frustration: blocked goals, impatience, irritation
- confusion: unclear, lost, seeking direction
- elevation: positive inspiration, uplifted feeling
- mission_drive: purpose-driven, mission-focused enthusiasm
- creative_fulfillment: joy from creation, artistic satisfaction
- relational_dependency: emotional reliance on others, seeking external validation
- isolation_signal: loneliness, disconnection, feeling alone

IMPORTANT: Analyze full sentence intent before tagging.
- Do NOT treat "alone" keyword as loneliness automatically
- Consider context: "working alone" vs "feeling alone"
- "Alone" can indicate independence, focus, or isolation depending on context
- Examine surrounding words and emotional tone

Risk level meaning:
- low = calm reflection
- medium = emotionally reactive but stable
- high = defensive, aggressive, or destabilized tone

Return strictly JSON format:

{
  "detected_emotion": "...",
  "maturity_risk_level": "..."
}

Do not explain.
Do not add extra text.
Only return JSON.`;

const EMOTION_ANALYZER_OPTIONS = {
  temperature: 0.2,
  max_tokens: 150,
} as const;

export type DetectedEmotion =
  | "anger"
  | "shame"
  | "fear"
  | "frustration"
  | "confusion"
  | "elevation"
  | "mission_drive"
  | "creative_fulfillment"
  | "relational_dependency"
  | "isolation_signal";

export type MaturityRiskLevel = "low" | "medium" | "high";

export type EmotionalStateResult = {
  detected_emotion: DetectedEmotion;
  maturity_risk_level: MaturityRiskLevel;
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
 * Analyzes the user's message for emotional pattern and maturity risk level
 * via Azure OpenAI (or OpenAI when Azure env vars are not set).
 */
export async function analyzeEmotionalState(
  userInput: string
): Promise<EmotionalStateResult> {
  try {
    const client = getOpenAIClient();

    const completion = await client.chat.completions.create({
      model: process.env.AZURE_OPENAI_DEPLOYMENT ?? "gpt-4o",
      messages: [
        { role: "system", content: EMOTION_ANALYZER_SYSTEM_PROMPT },
        { role: "user", content: userInput },
      ],
      ...EMOTION_ANALYZER_OPTIONS,
    });

    let content =
      completion.choices[0]?.message?.content?.trim() ?? "{}";
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) content = jsonMatch[0];

    const parsed = JSON.parse(content) as EmotionalStateResult;

  const validEmotions: DetectedEmotion[] = [
    "anger",
    "shame",
    "fear",
    "frustration",
    "confusion",
    "elevation",
    "mission_drive",
    "creative_fulfillment",
    "relational_dependency",
    "isolation_signal",
  ];
  const validRiskLevels: MaturityRiskLevel[] = ["low", "medium", "high"];

  const detected_emotion = validEmotions.includes(parsed.detected_emotion)
    ? parsed.detected_emotion
    : "confusion";
  const maturity_risk_level = validRiskLevels.includes(
    parsed.maturity_risk_level
  )
    ? parsed.maturity_risk_level
    : "medium";

    return { detected_emotion, maturity_risk_level };
  } catch (err: any) {
    console.error("[emotionAnalyzer] Error:", {
      message: err?.message,
      code: err?.code,
      status: err?.response?.status,
    });
    // Fallback to safe defaults on error
    return {
      detected_emotion: "confusion",
      maturity_risk_level: "medium",
    };
  }
}
