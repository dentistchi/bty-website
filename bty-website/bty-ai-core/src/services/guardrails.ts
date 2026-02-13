import { openai } from "../config/openai";
import { getBannedPhrases } from "../config/patchConfig";

// Coaching language patterns (corporate coaching tone)
const COACHING_PATTERNS = [
  /방향성|direction|roadmap|전략/i,
  /목표.*설정|goal.*setting|목표.*달성/i,
  /성장.*기회|growth.*opportunity|개발.*영역/i,
  /핵심.*역량|core.*competency|역량.*개발/i,
  /리더십.*스킬|leadership.*skill|스킬.*향상/i,
  /효과적.*방법|effective.*way|효율적.*접근/i,
  /최적화|optimization|최적.*해결/i,
  /프레임워크|framework|모델.*적용/i,
  /KPI|지표.*관리|성과.*측정/i,
  /비즈니스.*관점|business.*perspective|조직.*관점/i,
  /전략적.*사고|strategic.*thinking|전략.*수립/i,
  /실행.*계획|action.*plan|실행.*로드맵/i,
];

/**
 * Detects coaching language in text
 */
export function detectCoachingLanguage(text: string): boolean {
  return COACHING_PATTERNS.some((pattern) => pattern.test(text));
}

// Tone drift patterns (deviations from warm mentor tone)
const TONE_DRIFT_PATTERNS = [
  // Therapy language
  /치료|therapy|therapeutic|상담|counseling|심리.*치료/i,
  /트라우마|trauma|PTSD|정신.*건강|mental.*health/i,
  /치유|healing|회복.*과정|recovery.*process/i,
  
  // Corporate coaching tone (already detected separately, but also tone drift)
  ...COACHING_PATTERNS,
  
  // Generic praise
  /인상적입니다|impressive|훌륭합니다|excellent|대단합니다|amazing/i,
  /잘하고.*있어요|doing.*great|좋은.*일|good.*job/i,
  
  // Over-validation
  /완전히.*이해|completely.*understand|정말.*맞아|absolutely.*right/i,
  /당신.*맞아요|you.*right|그렇게.*생각|think.*so/i,
  
  // Moral superiority
  /옳은.*선택|right.*choice|올바른|correct|선한|good.*thing/i,
  /윤리적|ethical|도덕적|moral|정의|justice/i,
  
  // Over-enthusiastic
  /정말.*좋아요|really.*good|너무.*좋아|so.*great|완벽해|perfect/i,
  /대단해요|wonderful|멋져요|awesome|훌륭해요|fantastic/i,
];

/**
 * Detects tone drift (deviation from warm mentor tone)
 */
export function detectToneDrift(text: string): boolean {
  if (!text || text.trim().length === 0) return false;
  return TONE_DRIFT_PATTERNS.some((pattern) => pattern.test(text));
}

// Maturity stage patterns (detecting multiple maturity moves)
const MATURITY_STAGE_PATTERNS = [
  // Step 1: Emotional Clarification
  {
    name: "emotional_clarification",
    patterns: [
      /어떤.*감정|어떤.*느낌|어떤.*기분|what.*feel|how.*feel|감정.*이름|name.*feeling/i,
      /지금.*느끼|지금.*감정|지금.*기분|right.*now.*feel|마음.*어떤/i,
    ],
  },
  // Step 2: Fact vs Interpretation
  {
    name: "fact_interpretation",
    patterns: [
      /실제.*일어난|actually.*happened|fact.*only|사실.*만|객관적/i,
      /해석|interpretation|의미.*부여|story.*about/i,
      /다른.*사람.*봤다면|how.*others.*see|other.*person.*view/i,
    ],
  },
  // Step 3: Responsibility Re-centering
  {
    name: "responsibility",
    patterns: [
      /통제|control|할.*수.*있는|within.*influence|책임|responsibility/i,
      /당신.*부분|your.*part|내.*부분|my.*part|역할|role/i,
    ],
  },
  // Step 4: Perspective Expansion
  {
    name: "perspective",
    patterns: [
      /상대방.*입장|other.*person.*perspective|다른.*관점|alternative.*view/i,
      /6개월.*후|1년.*후|6.*months.*later|year.*later|미래.*돌아보/i,
      /조직.*맥락|organizational.*context|팀.*흐름|team.*flow/i,
    ],
  },
  // Step 5: Mature Action Suggestion
  {
    name: "action",
    patterns: [
      /할.*수.*있는.*걸음|next.*step|다음.*단계|small.*action/i,
      /실험|experiment|바꿔보|try.*change|한.*가지만/i,
    ],
  },
];

/**
 * Counts maturity moves (stages) in response
 */
export function countMaturityMoves(text: string): number {
  if (!text || text.trim().length === 0) return 0;
  
  const detectedStages = new Set<string>();
  
  MATURITY_STAGE_PATTERNS.forEach((stage) => {
    if (stage.patterns.some((pattern) => pattern.test(text))) {
      detectedStages.add(stage.name);
    }
  });
  
  return detectedStages.size;
}

/**
 * Reduces response to only one maturity move if >= 2 moves detected
 */
async function reduceToSingleMaturityMove(text: string): Promise<string> {
  const moveCount = countMaturityMoves(text);
  
  if (moveCount < 2) {
    return text; // No reduction needed
  }
  
  try {
    const client = openai;
    const completion = await client.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content:
            "Reduce this response to focus on ONLY ONE maturity stage. Choose the most relevant stage for the user's current state. Keep warm mentor tone, Korean, <=3 sentences, max 1 question. Do not combine multiple maturity stages.",
        },
        {
          role: "user",
          content: text,
        },
      ],
      temperature: 0.5,
      max_tokens: 200,
    });

    const reduced =
      completion.choices[0]?.message?.content?.trim() ?? text;
    return reduced;
  } catch (err: any) {
    console.error("[guardrails] Error reducing maturity moves:", {
      message: err?.message,
      code: err?.code,
    });
    // Fallback: return original text
    return text;
  }
}

/**
 * Counts sentences in text (Korean and English sentence endings)
 */
export function countSentences(text: string): number {
  if (!text || text.trim().length === 0) return 0;
  
  // Split by sentence endings: . ! ? (Korean and English)
  // Also handle Korean sentence endings: 다, 요, 지, 네, 게, etc.
  const sentenceEndings = /[.!?。！？]\s*|다\s+|요\s+|지\s+|네\s+|게\s+|까\s+/g;
  const sentences = text.split(sentenceEndings).filter(s => s.trim().length > 0);
  
  // If no clear sentence endings, count by line breaks or estimate
  if (sentences.length === 0) {
    return text.split(/\n+/).filter(s => s.trim().length > 0).length || 1;
  }
  
  return sentences.length;
}

/**
 * Calculates stability adjustment based on sentence count and coaching language:
 * - If sentences <= 3 → +1 stability
 * - If sentences >= 5 → -2 stability
 * - If coaching language detected → +2 coaching penalty (subtracted from stability)
 */
export function calculateResponseStability(text: string): number {
  const sentenceCount = countSentences(text);
  let stability = 0;
  
  if (sentenceCount <= 3) {
    stability = 1; // +1 stability
  } else if (sentenceCount >= 5) {
    stability = -2; // -2 stability
  }
  
  // Apply coaching penalty
  let coaching_penalty = 0;
  if (detectCoachingLanguage(text)) {
    coaching_penalty += 2;
  }
  
  // Subtract coaching penalty from stability
  return stability - coaching_penalty;
}

/**
 * Applies guardrails to ensure output contract compliance:
 * 1. Max 1 question mark
 * 2. Max 280 chars
 * 3. Remove banned phrases
 */
export async function applyGuardrails(text: string): Promise<string> {
  if (!text || text.trim().length === 0) {
    return text;
  }

  let result = text;

  // Rule 1: If more than 1 '?', trigger compression rewrite
  const questionCount = (result.match(/\?/g) || []).length;
  if (questionCount > 1) {
    try {
      const client = openai;
      const completion = await client.chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content:
              "Rewrite into <=2 sentences and only ONE question, warm mentor tone, Korean. Compress and keep the core meaning intact.",
          },
          {
            role: "user",
            content: result,
          },
        ],
        temperature: 0.5,
        max_tokens: 200,
      });

      const rewritten =
        completion.choices[0]?.message?.content?.trim() ?? result;
      result = rewritten;
      
      // Ensure compression: if still > 280 chars after rewrite, compress again
      if (result.length > 280) {
        const compressCompletion = await client.chat.completions.create({
          model: "gpt-4o",
          messages: [
            {
              role: "system",
              content:
                "Compress this text to <=280 characters while preserving core meaning and warm mentor tone. Korean. Keep only ONE question.",
            },
            {
              role: "user",
              content: result,
            },
          ],
          temperature: 0.5,
          max_tokens: 150,
        });

        const compressed =
          compressCompletion.choices[0]?.message?.content?.trim() ?? result;
        if (compressed.length <= 280) {
          result = compressed;
        } else {
          // Fallback: truncate with ellipsis
          result = result.substring(0, 277) + "...";
        }
      }
    } catch (err: any) {
      console.error("[guardrails] Error rewriting multiple questions:", {
        message: err?.message,
        code: err?.code,
      });
      // Fallback: manually remove extra questions and compress
      const parts = result.split("?");
      if (parts.length > 1) {
        result = parts[0] + "?";
        if (parts[1]) {
          result += " " + parts[1].split(".")[0] + ".";
        }
      }
      // Ensure length limit
      if (result.length > 280) {
        result = result.substring(0, 277) + "...";
      }
    }
  }

  // Rule 2: If length > 320 chars, compress to <=280 chars
  if (result.length > 320) {
    try {
      const client = openai;
      const completion = await client.chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content:
              "Compress this text to <=280 characters while preserving core meaning and warm mentor tone. Korean.",
          },
          {
            role: "user",
            content: result,
          },
        ],
        temperature: 0.5,
        max_tokens: 150,
      });

      const compressed =
        completion.choices[0]?.message?.content?.trim() ?? result;
      // Ensure it's actually <=280 chars
      if (compressed.length <= 280) {
        result = compressed;
      } else {
        // Fallback: truncate with ellipsis
        result = result.substring(0, 277) + "...";
      }
    } catch (err: any) {
      console.error("[guardrails] Error compressing text:", {
        message: err?.message,
        code: err?.code,
      });
      // Fallback: truncate with ellipsis
      result = result.substring(0, 277) + "...";
    }
  }

  // Rule 3: Remove banned phrases
  for (const phrase of getBannedPhrases()) {
    if (result.includes(phrase)) {
      // Remove the phrase and clean up extra spaces
      result = result.replace(new RegExp(phrase, "g"), "");
      result = result.replace(/\s+/g, " ").trim();
    }
  }

  // Rule 4: If maturity_moves >= 2, reduce to 1 move only
  const maturityMoves = countMaturityMoves(result);
  if (maturityMoves >= 2) {
    result = await reduceToSingleMaturityMove(result);
  }

  return result.trim();
}
