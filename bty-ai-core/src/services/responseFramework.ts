/**
 * BTY_MATURITY_FRAMEWORK
 * Structured 5-step reflection system. Does NOT give direct advice.
 * Guides the user through self-reflection before any action.
 */

import type { IntentExtractionResult } from "./intentExtractor";
import { decideSilenceMode, type SilenceDecision, selectSilenceSentence, type SilenceSentenceContext } from "./silenceEngine";

/**
 * Key Point Reflection (HARD RULE)
 * Builds the mandatory first sentence: a reflection of intent.key_point.
 * Style: "~라는 말이네요.", "~가 핵심인 것 같아요.", "~때문에 마음이 흔들리는 느낌이군요."
 * No advice, no questions, no banned phrases.
 */
function hasJongseong(char: string): boolean {
  const code = char.charCodeAt(0);
  if (code < 0xac00 || code > 0xd7a3) return false;
  return (code - 0xac00) % 28 !== 0;
}

export function buildKeyPointReflection(keyPoint: string): string {
  const kp = (keyPoint || "사용자의 말씀").trim();
  if (!kp) return "지금 마음에 와 닿는 말씀이 있으시군요.";

  // "~때문에 마음이 흔들리는 느낌이군요." — when key_point expresses cause
  if (/때문에|때문엔|해서|하니/.test(kp)) {
    return `${kp} 마음이 흔들리는 느낌이군요.`;
  }
  // "~라는 말이네요." / "~다는 말이네요." — for statements
  if (/다\s*\.?\s*$/.test(kp)) {
    return `${kp.replace(/\s*\.?\s*$/, "")}는 말이네요.`;
  }
  // "~가 핵심인 것 같아요." / "~이 핵심인 것 같아요." — for noun phrases (이/가 by 받침)
  const lastChar = kp.replace(/\s/g, "").slice(-1);
  const particle = lastChar && hasJongseong(lastChar) ? "이" : "가";
  return `${kp}${particle} 핵심인 것 같아요.`;
}
import { estimateStage, type MaturityStage } from "./maturityStage";
import { getPacingProfile, type PacingProfile, type Role } from "./pacingProfiles";
import { countSentences } from "./guardrails";
import { getBannedPhrases } from "../config/patchConfig";

export type BTYRole = "leader" | "doctor" | "staff";

/**
 * Silence Sentence Library
 * Pre-written sentences for silence mode responses
 */
const SILENCE_LIBRARY = [
  "지금은 결론보다 숨을 고르는 게 먼저예요.",
  "그건 가볍게 넘길 일이 아니죠.",
  "지금 마음이 먼저 다친 것 같아요.",
  "그 말 속에 이미 핵심이 있어요.",
  "지금은 정답보다 중심이 중요해 보여요.",
  "그 상황에서 버틴 것만으로도 충분히 큰 일이에요.",
  "이건 당신이 대충 살고 있지 않다는 증거네요.",
  "지금은 서두르지 않아도 됩니다.",
  "그건 책임감이 있는 사람만 느끼는 무게예요.",
  "여기서 한 번 멈추는 게 더 성숙할 수 있어요.",
  "지금은 판단보다 이해가 먼저 같아요.",
  "그 말을 꺼낸 것 자체가 이미 한 걸음이에요.",
];

/**
 * Validates and filters prompts according to BTY Output Contract
 */
function applyOutputContract(
  prompts: string[],
  intent: IntentExtractionResult,
  userEnergy: string,
  riskLevel: string
): string[] {
  const isLowEnergy = userEnergy === "low";
  const isHighRisk = riskLevel === "high";
  const allowBannedPhrases = intent.next_step === "suggest_action";
  
  // Filter out banned phrases unless suggest_action
  let filtered = prompts.filter((prompt) => {
    if (allowBannedPhrases) return true;
    return !getBannedPhrases().some((phrase) => prompt.includes(phrase));
  });

  // For low energy or high risk: reduce to 1-2 sentences, ensure question_style is appropriate
  if (isLowEnergy || isHighRisk) {
    filtered = filtered.slice(0, 2);
    // Enforce: question_style MUST be "one_short_question" or "offer_choices" (not "none")
    const effectiveQuestionStyle = 
      intent.question_style === "none" ? "one_short_question" : intent.question_style;
    
    if (effectiveQuestionStyle === "one_short_question") {
      // Keep only one question
      const questions = filtered.filter((p) => p.includes("?") || p.includes("까요") || p.includes("나요"));
      const nonQuestions = filtered.filter((p) => !p.includes("?") && !p.includes("까요") && !p.includes("나요"));
      filtered = [...nonQuestions.slice(0, 1), ...questions.slice(0, 1)];
    } else if (effectiveQuestionStyle === "offer_choices") {
      // Keep prompts that offer choices (up to 2)
      filtered = filtered.slice(0, 2);
    }
  }

  // Ensure max 1 question mark total (global rule)
  const questions = filtered.filter((p) => p.includes("?") || p.includes("까요") || p.includes("나요"));
  const nonQuestions = filtered.filter((p) => !p.includes("?") && !p.includes("까요") && !p.includes("나요"));
  if (questions.length > 1) {
    filtered = [...nonQuestions, questions[0]];
  }
  
  // Ensure max 3 sentences total (global rule)
  if (filtered.length > 3) {
    filtered = filtered.slice(0, 3);
  }

  return filtered;
}

export type MaturityStep = {
  step: number;
  name: string;
  purpose: string;
  reflectionPrompts: string[];
};

export type MaturityResponse = {
  userInput: string;
  role: BTYRole;
  steps: MaturityStep[];
};

/**
 * Generates a structured maturity response with 5 reflection steps.
 * Adapts tone, length, and focus based on emotionTag and riskLevel (from emotion analysis).
 * Does not give direct advice—guides the user through reflection.
 */
export function generateMaturityResponse(
  userInput: string,
  role: BTYRole,
  emotionTag: string,
  riskLevel: string,
  intent: IntentExtractionResult
): MaturityResponse {
  const isHighRisk = riskLevel === "high";
  const isShame = emotionTag === "shame";
  const isAnger = emotionTag === "anger";
  const isDebugProduct = intent.intent === "debug_product";
  const isLowEnergy = intent.user_energy === "low";

  const take = (arr: string[], n: number) =>
    isHighRisk ? arr.slice(0, n) : arr;

  const step1Prompts = (): string[] => {
    // Debug product mode: acknowledge feedback briefly, ask ONE concrete clarification OR propose a fix
    // Do NOT ask about emotions
    if (isDebugProduct) {
      const keyPointOpening = intent.key_point || "피드백 감사합니다.";
      const prompts = [
        keyPointOpening,
        "어떤 부분이 기대와 달랐나요?",
      ];
      return applyOutputContract(prompts, intent, intent.user_energy, riskLevel);
    }
    
    if (isHighRisk) {
      const prompts = [
        "지금 이 순간, 몸은 어떤 느낌인가요?",
        "지금 여기서 가장 크게 느끼는 감정을 한 단어로 말해보면요.",
      ];
      return applyOutputContract(prompts, intent, intent.user_energy, riskLevel);
    }
    if (isAnger) {
      const prompts = [
        "지금 몸은 어떤 느낌인가요?",
        "지금 이 상황에서 가장 크게 느끼는 감정은 무엇인가요?",
      ];
      return applyOutputContract(prompts, intent, intent.user_energy, riskLevel);
    }
    if (isShame) {
      const prompts = [
        "지금 이 상황에서 느끼는 감정이 있다면, 편하게 말해보세요.",
        role === "leader"
          ? "팀이나 조직에 대한 감정도 섞여 있나요?"
          : role === "doctor"
          ? "환자나 진료 상황과 연결된 감정이 있나요?"
          : "함께 일하는 사람들과의 관계에서 오는 감정이 있나요?",
      ];
      return applyOutputContract(prompts, intent, intent.user_energy, riskLevel);
    }
    
    // Default: Use intent.key_point as opening line (rewrite naturally)
    const keyPointOpening = intent.key_point 
      ? intent.key_point 
      : "지금 이 상황에서 가장 크게 느끼는 감정은 무엇인가요?";
    
    const prompts = [
      keyPointOpening,
      role === "leader"
        ? "팀이나 조직에 대한 감정도 섞여 있나요?"
        : role === "doctor"
        ? "환자나 진료 상황과 연결된 감정이 있나요?"
        : "함께 일하는 사람들과의 관계에서 오는 감정이 있나요?",
    ];
    return applyOutputContract(prompts, intent, intent.user_energy, riskLevel);
  };

  const step2Prompts = (): string[] => {
    if (isHighRisk) {
      const prompts = [
        "실제로 일어난 일만, 짧게 적어보면요.",
        "그걸 인정한 뒤에, 지금은 어떤가요?",
      ];
      return applyOutputContract(prompts, intent, intent.user_energy, riskLevel);
    }
    if (isShame) {
      const prompts = [
        "실제로 일어난 일을 객관적으로 적어보면요.",
        "다른 사람이 같은 상황을 봤다면 어떻게 묘사했을까요?",
      ];
      return applyOutputContract(prompts, intent, intent.user_energy, riskLevel);
    }
    const prompts = [
      "실제로 일어난 일을 객관적으로 적어보면요.",
      "다른 사람이 같은 상황을 봤다면 어떻게 묘사했을까요?",
    ];
    return applyOutputContract(prompts, intent, intent.user_energy, riskLevel);
  };

  const step3Prompts = (): string[] => {
    if (isHighRisk) {
      const prompts = [
        "지금 당신이 할 수 있는 작은 것이 하나 있다면요?",
        "그 한 가지만 생각해 보면 어떤가요?",
      ];
      return applyOutputContract(prompts, intent, intent.user_energy, riskLevel);
    }
    const prompts = [
      "이 상황에서 당신이 직접 할 수 있는 부분은 무엇인가요?",
      role === "leader"
        ? "리더로서 당신의 의사결정이 이 상황에 어떤 역할을 했나요?"
        : role === "doctor"
        ? "의료인으로서 당신의 전문적 역할과 책임은 어디까지인가요?"
        : "당신의 역할 범위 안에서 바꿀 수 있는 것은 무엇인가요?",
    ];
    return applyOutputContract(prompts, intent, intent.user_energy, riskLevel);
  };

  const step4Prompts = (): string[] => {
    const base = [
      "상대방 입장에서 보면 이 상황이 어떻게 보일까요?",
      role === "leader"
        ? "조직 전체의 맥락에서 이 일의 의미는 무엇일까요?"
        : role === "doctor"
        ? "환자 중심으로 이 상황을 다시 보면 어떤 점이 달라지나요?"
        : "팀 전체의 흐름 안에서 이 일의 위치는 어디인가요?",
    ];
    const prompts = take(base, isHighRisk ? 1 : 2);
    return applyOutputContract(prompts, intent, intent.user_energy, riskLevel);
  };

  const step5Prompts = (): string[] => {
    if (isHighRisk) {
      const prompts = [
        "오늘 당신이 할 수 있는 가장 작은 한 걸음은 무엇일까요?",
      ];
      return applyOutputContract(prompts, intent, intent.user_energy, riskLevel);
    }
    const prompts = [
      "지금 당신이 할 수 있는 가장 작은 첫 걸음은 무엇일까요?",
    ];
    return applyOutputContract(prompts, intent, intent.user_energy, riskLevel);
  };

  const steps: MaturityStep[] = [
    {
      step: 1,
      name: "Emotional Clarification",
      purpose: isDebugProduct
        ? "Acknowledge feedback briefly and ask ONE concrete clarification about expected behavior OR propose a fix."
        : isHighRisk
        ? "Gently help name feelings and stabilize before going further."
        : "Help the user name and acknowledge what they are feeling before moving to problem-solving.",
      reflectionPrompts: step1Prompts(),
    },
    {
      step: 2,
      name: "Fact vs Interpretation Separation",
      purpose:
        "Distinguish what actually happened from assumptions, stories, or interpretations.",
      reflectionPrompts: step2Prompts(),
    },
    {
      step: 3,
      name: "Responsibility Re-centering",
      purpose:
        "Focus on what is within the user's control, without blame or avoidance.",
      reflectionPrompts: step3Prompts(),
    },
    {
      step: 4,
      name: "Perspective Expansion",
      purpose:
        "Invite alternative viewpoints without forcing a single 'right' answer.",
      reflectionPrompts: step4Prompts(),
    },
    {
      step: 5,
      name: "Mature Action Suggestion",
      purpose:
        "Elicit self-generated next steps through questions, not prescriptive advice.",
      reflectionPrompts: step5Prompts(),
    },
  ];

  return {
    userInput,
    role,
    steps,
  };
}

/**
 * Calculates user turn length from message
 */
function calculateUserTurnLength(text: string): "short" | "medium" | "long" {
  if (!text || text.trim().length === 0) return "short";
  
  const charCount = text.trim().length;
  const wordCount = text.trim().split(/\s+/).filter((w) => w.length > 0).length;
  
  if (charCount <= 30 || wordCount <= 5) {
    return "short";
  } else if (charCount <= 150 || wordCount <= 30) {
    return "medium";
  } else {
    return "long";
  }
}

/**
 * Generates silence mode response based on silence decision
 * Returns EXACTLY the selected sentence - no additional text, no question mark, no explanation, no second sentence
 */
export async function generateSilenceModeResponse(
  silenceDecision: SilenceDecision,
  intent: IntentExtractionResult,
  context: SilenceSentenceContext
): Promise<string> {
  if (!silenceDecision.use_silence) {
    return ""; // Not in silence mode
  }

  // Call selectSilenceSentence to get the sentence
  const result = await selectSilenceSentence(context);
  
  // Output EXACTLY the sentence - no modifications, no additional text
  return result.sentence;
}

/**
 * Checks if silence mode should be used and generates appropriate response
 */
export async function checkAndGenerateSilenceResponse(
  userInput: string,
  detectedEmotion: string,
  riskLevel: string,
  cssScore: number,
  previousWasQuestion: boolean,
  intent: IntentExtractionResult,
  userId?: string
): Promise<{ useSilence: boolean; response?: string; silenceDecision?: SilenceDecision }> {
  const userTurnLength = calculateUserTurnLength(userInput);
  
  const silenceDecision = await decideSilenceMode({
    userText: userInput,
    detectedEmotion,
    riskLevel: riskLevel as "low" | "medium" | "high",
    cssScore,
    previousWasQuestion,
    userTurnLength,
    userId,
  });

  if (silenceDecision.use_silence) {
    // Create context for selectSilenceSentence
    const context: SilenceSentenceContext = {
      detectedEmotion,
      userText: userInput,
      userId,
    };
    
    // Generate response using selectSilenceSentence
    const response = await generateSilenceModeResponse(silenceDecision, intent, context);
    return {
      useSilence: true,
      response,
      silenceDecision,
    };
  }

  return {
    useSilence: false,
  };
}

/**
 * Generates final response text from maturity response steps,
 * respecting pacing profile and silence mode
 */
export async function generateFinalResponseWithProfile(
  maturityResponse: MaturityResponse,
  userInput: string,
  emotionTag: string,
  riskLevel: string,
  cssScore: number,
  previousWasQuestion: boolean,
  intent: IntentExtractionResult,
  silenceDecision?: SilenceDecision,
  userId?: string
): Promise<string> {
  // If silence mode is active, it overrides profile
  if (silenceDecision?.use_silence) {
    const context: SilenceSentenceContext = {
      detectedEmotion: emotionTag,
      userText: userInput,
      userId,
    };
    return await generateSilenceModeResponse(silenceDecision, intent, context);
  }

  // 1. Estimate maturity stage
  const stage = estimateStage(userInput, emotionTag);

  // 2. Get pacing profile
  const profile = getPacingProfile(
    stage,
    maturityResponse.role,
    riskLevel as "low" | "medium" | "high"
  );

  // 3. Generate response respecting profile strictly
  // Select prompts from appropriate step based on allowed lenses
  let selectedPrompts: string[] = [];

  // Determine which step to use based on allowed lenses
  if (profile.allowedLens.includes("emotion")) {
    selectedPrompts.push(...maturityResponse.steps[0]?.reflectionPrompts || []);
  }
  if (profile.allowedLens.includes("meaning")) {
    selectedPrompts.push(...maturityResponse.steps[1]?.reflectionPrompts || []);
  }
  if (profile.allowedLens.includes("perspective")) {
    selectedPrompts.push(...maturityResponse.steps[3]?.reflectionPrompts || []);
  }
  if (profile.allowedLens.includes("ownership")) {
    selectedPrompts.push(...maturityResponse.steps[2]?.reflectionPrompts || []);
  }
  if (profile.allowedLens.includes("alignment")) {
    // Use step 5 for alignment if available
    selectedPrompts.push(...maturityResponse.steps[4]?.reflectionPrompts || []);
  }

  // If no prompts selected, use first step
  if (selectedPrompts.length === 0) {
    selectedPrompts = maturityResponse.steps[0]?.reflectionPrompts || [];
  }

  // Apply profile constraints
  let response = "";

  // Use key_point as opening if available
  if (intent.key_point) {
    response = intent.key_point;
  } else if (selectedPrompts.length > 0) {
    response = selectedPrompts[0];
  }

  // Build response respecting profile
  const sentences: string[] = [];
  
  // Add opening sentence
  if (response) {
    sentences.push(response);
  }

  // Add additional prompts up to maxSentences
  let promptIndex = 1;
  while (
    sentences.length < profile.maxSentences &&
    promptIndex < selectedPrompts.length
  ) {
    const prompt = selectedPrompts[promptIndex];
    if (prompt && prompt.trim().length > 0) {
      sentences.push(prompt);
    }
    promptIndex++;
  }

  // Join sentences
  let finalResponse = sentences.join(" ");

  // Apply question constraints
  if (!profile.allowQuestion) {
    // Remove all questions
    finalResponse = finalResponse.replace(/[?？]/g, "");
    finalResponse = finalResponse.replace(/까요|나요|인가요|을까요/g, "");
  } else if (profile.questionStyle === "none") {
    // Remove all questions
    finalResponse = finalResponse.replace(/[?？]/g, "");
    finalResponse = finalResponse.replace(/까요|나요|인가요|을까요/g, "");
  } else if (profile.questionStyle === "one_short") {
    // Keep only one question
    const questions = finalResponse.match(/[^?？]*[?？까요나요인가요을까요][^?？]*/g) || [];
    const nonQuestions = finalResponse.split(/[?？까요나요인가요을까요]/).filter((s) => s.trim().length > 0);
    if (questions.length > 0) {
      finalResponse = [...nonQuestions, questions[0]].join(" ").trim();
    }
  } else if (profile.questionStyle === "offer_two_choices") {
    // End with 2 options only, no extra question
    const questions = finalResponse.match(/[^?？]*[?？까요나요인가요을까요][^?？]*/g) || [];
    const nonQuestions = finalResponse.split(/[?？까요나요인가요을까요]/).filter((s) => s.trim().length > 0);
    if (questions.length >= 2) {
      finalResponse = [...nonQuestions, questions[0], questions[1]].join(" ").trim();
    } else if (questions.length === 1) {
      finalResponse = [...nonQuestions, questions[0]].join(" ").trim();
    }
  }

  // Apply action suggestion constraint
  if (!profile.allowActionSuggestion) {
    // Remove action-related prompts (step 5 content)
    finalResponse = finalResponse.replace(/할.*수.*있는.*걸음|next.*step|다음.*단계|small.*action/gi, "");
    finalResponse = finalResponse.replace(/실험|experiment|바꿔보|try.*change|한.*가지만/gi, "");
  }

  // Ensure sentence count <= profile.maxSentences
  const sentenceCount = countSentences(finalResponse);
  if (sentenceCount > profile.maxSentences) {
    const sentenceEndings = /[.!?。！？]\s*|다\s+|요\s+|지\s+|네\s+|게\s+|까\s+/g;
    const allSentences = finalResponse.split(sentenceEndings).filter((s) => s.trim().length > 0);
    finalResponse = allSentences.slice(0, profile.maxSentences).join(". ").trim();
    // Ensure proper ending
    if (!/[.!。！]$/.test(finalResponse)) {
      finalResponse += ".";
    }
  }

  return finalResponse.trim();
}
