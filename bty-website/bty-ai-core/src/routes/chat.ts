import { Router, Request, Response } from "express";
import {
  getMaturityResponse,
  generateMaturityReply,
} from "../services/aiEngine";
import { generateMaturityResponse } from "../services/responseFramework";
import { calculateMaturityDelta } from "../services/maturityScoring";
import { insertEmotionalMetric } from "../models/organizationEmotionalMetrics";
import { checkDependency } from "../services/dependencyTracker";
import {
  updateIntegrityScore,
  isIntegrityMode,
  getIntegrityScore,
  detectIntegrityContent,
  checkIntegrityDensity,
} from "../services/integrityScoring";
import { extractIntent } from "../services/intentExtractor";
import { applyGuardrails, calculateResponseStability, detectToneDrift } from "../services/guardrails";
import {
  detectEmotionProbe,
  checkEmotionOverprocessing,
  updateEmotionTracking,
} from "../services/emotionTracking";
import { incrementToneDrift } from "../services/toneTracking";
import { calculateCSS, updateCSSInMetrics } from "../services/conversationStability";
import { checkAndGenerateSilenceResponse } from "../services/responseFramework";
import { buildReflectionFromLibrary } from "../services/keyPointReflectionLibrary";
import {
  getLastUsedReflections,
  recordReflectionUsed,
} from "../services/reflectionHistoryTracker";
import {
  getPreviousWasQuestion,
  updatePreviousWasQuestion,
  responseHasQuestion,
  updatePreviousWasSilence,
} from "../services/previousTurnTracker";
import { estimateStage } from "../services/maturityStage";
import { getPacingProfile } from "../services/pacingProfiles";
import { recordQualityEvent, type QualityEventRoute } from "../services/qualityEvents";

const router = Router();

type ChatRequestBody = {
  userId: string;
  role: "leader" | "doctor" | "staff";
  message: string;
};

router.post("/", async (req: Request, res: Response) => {
  const body = req.body as ChatRequestBody;

  if (!body.userId || !body.role || !body.message) {
    res.status(400).json({
      error: "Missing required fields: userId, role, message",
    });
    return;
  }

  const validRoles = ["leader", "doctor", "staff"];
  if (!validRoles.includes(body.role)) {
    res.status(400).json({
      error: "Invalid role. Must be leader, doctor, or staff",
    });
    return;
  }

  const { userId, role, message } = body;

  try {
    // 1. Extract intent first
    const intentJson = await extractIntent(message, role);

    // 2. Analyze emotion, then generate maturity response (5-step reflection)
    const {
      maturityResponse,
      detected_emotion: emotionTag,
      maturity_risk_level: riskLevel,
    } = await getMaturityResponse(message, role, intentJson);

    // 2. Get integrity alignment score (for leaders only, otherwise 0)
    let integrityAlignmentScore = 0;
    if (role === "leader" && isIntegrityMode(message)) {
      integrityAlignmentScore = await getIntegrityScore(userId);
    }

    // 3. Calculate maturity delta (internal scoring, no raw scores exposed)
    const maturityResult = await calculateMaturityDelta(
      message,
      emotionTag,
      riskLevel,
      integrityAlignmentScore,
      userId,
      role
    );

    // 5.6. Get previous turn information for silence mode (needed for early silence check)
    const previousWasQuestion = await getPreviousWasQuestion(userId);

    // 6. Check silence mode EARLY to bypass maturity stage escalation, integrity layer, action suggestion
    // Note: CSS score not yet calculated, will use 5 as default for initial check
    const silenceCheck = await checkAndGenerateSilenceResponse(
      message,
      emotionTag,
      riskLevel,
      5, // Default CSS for initial check
      previousWasQuestion,
      intentJson,
      userId
    );

    // HARD RULE: If silence mode is active, bypass:
    // - maturity stage escalation
    // - integrity layer
    // - action suggestion
    if (silenceCheck.useSilence) {
      // Key Point Reflection (HARD RULE): first sentence = reflection, then optional silence sentence
      const lastUsed = await getLastUsedReflections(userId);
      const reflection = buildReflectionFromLibrary(
        intentJson.key_point,
        emotionTag,
        intentJson.intent,
        lastUsed
      );
      await recordReflectionUsed(userId, reflection);
      const silenceSentence = silenceCheck.response || "지금 이 순간을 느껴보세요.";
      const reply = reflection + " " + silenceSentence;
      
      // Minimal tracking for silence mode (bypass escalation, integrity, action suggestion)
      const currentResponseHasQuestion = responseHasQuestion(reply);
      await updatePreviousWasQuestion(userId, currentResponseHasQuestion);
      
      // Update previous_was_silence flag for next turn
      await updatePreviousWasSilence(userId, true);
      
      // Save minimal emotional metrics (no escalation tracking, no integrity tracking)
      await insertEmotionalMetric({
        user_id: userId,
        role,
        detected_emotion: emotionTag,
        maturity_risk_level: riskLevel,
        response_stability: 0, // Silence mode: no stability tracking needed
      });
      
      const response: { reply: string } = {
        reply,
      };
      
      return res.json(response);
    }

    // Continue with normal flow (silence mode is NOT active)
    // 3.5. Estimate maturity stage (BYPASSED if silence mode was active)
    const maturityStage = estimateStage(message, emotionTag);

    // 3.5.5. Get pacing profile based on stage (BYPASSED if silence mode was active)
    const pacingProfile = getPacingProfile(
      maturityStage,
      role,
      riskLevel as "low" | "medium" | "high"
    );

    // 3.6. Check if Integrity Deepening Layer should activate (BYPASSED if silence mode was active)
    // SERI is calculated and stored internally (not exposed to user)
    const internalScore = maturityResult._internalScore;
    const seri = internalScore?.seri ?? 0;
    
    // Activate Deepening Layer ONLY if ALL conditions met:
    // - role === "leader"
    // - SERI >= 3.5
    // - stage in ["ownership", "alignment"]
    // - maturity_risk_level != "high"
    // Deactivate if SERI < 3 (automatic)
    // Deactivate if stage is blame/reaction/awareness
    const deepeningLayerActive =
      role === "leader" &&
      seri >= 3.5 &&
      seri >= 3 && // Explicit check: deactivate if SERI drops below 3
      riskLevel !== "high" &&
      (maturityStage === "ownership" || maturityStage === "alignment");

    // 4. Check for dependency patterns
    const dependencyInfo = await checkDependency(userId, message);

    // 5. Update integrity alignment score ONLY for leaders when Integrity Mode is active (BYPASSED if silence mode was active)
    if (role === "leader" && isIntegrityMode(message)) {
      await updateIntegrityScore(userId, message);
    }

    // 5.5. Check for integrity content in user message
    const userMessageHasIntegrity = isIntegrityMode(message);

    // 6. Build reply: Key Point Reflection (HARD RULE) + optional follow-up
    // generateMaturityReply returns full reply (reflection + follow-up), runs critic+rewrite flow
    const lastUsed = await getLastUsedReflections(userId);
    const keyPointReflection = buildReflectionFromLibrary(
      intentJson.key_point,
      emotionTag,
      intentJson.intent,
      lastUsed
    );
    await recordReflectionUsed(userId, keyPointReflection);
    let reply = await generateMaturityReply(
      message,
      dependencyInfo,
      role,
      deepeningLayerActive,
      userId,
      pacingProfile,
      keyPointReflection,
      { intent: intentJson.intent, route: "web" as QualityEventRoute }
    );
    reply = (reply || "").trim();

    // 7. Apply guardrails before returning response
    reply = await applyGuardrails(reply);

    // 8. Calculate response stability based on sentence count
    const responseStability = calculateResponseStability(reply);

    // 9. Detect emotion probe in current response
    const currentEmotionProbe = detectEmotionProbe(reply);

    // 10. Check for consecutive emotion probes and set emotion_overprocessing_flag
    const emotionOverprocessingFlag = await checkEmotionOverprocessing(
      userId,
      currentEmotionProbe
    );

    // 11. Update emotion tracking in user_sessions
    await updateEmotionTracking(
      userId,
      currentEmotionProbe,
      emotionOverprocessingFlag
    );

    // 12. Detect tone drift and increment tone_drift if detected
    if (detectToneDrift(reply)) {
      await incrementToneDrift(userId);
    }

    // 12.5. Check for integrity density (integrity content in response)
    const responseHasIntegrity = detectIntegrityContent(reply);
    // Check density: if both user message and response have integrity content, set flag
    const integrityDensityFlag = await checkIntegrityDensity(
      userId,
      userMessageHasIntegrity || responseHasIntegrity
    );

    // 13. Calculate Conversation Stability Score (CSS) with pacing profile
    // Note: silenceCheck.useSilence is false here since we already handled silence mode with early return
    const cssResult = await calculateCSS(
      reply,
      userId,
      emotionOverprocessingFlag,
      pacingProfile,
      false // silenceMode: false (already handled with early return)
    );

    // 13.5. Re-check silence mode with actual CSS score if not already in silence mode
    let finalSilenceMode: boolean = silenceCheck.useSilence;
    if (!silenceCheck.useSilence && cssResult.css <= 2) {
      const silenceRecheck = await checkAndGenerateSilenceResponse(
        message,
        emotionTag,
        riskLevel,
        cssResult.css,
        previousWasQuestion,
        intentJson,
        userId
      );
      if (silenceRecheck.useSilence) {
        const lastUsed = await getLastUsedReflections(userId);
        const reflection = buildReflectionFromLibrary(
          intentJson.key_point,
          emotionTag,
          intentJson.intent,
          lastUsed
        );
        await recordReflectionUsed(userId, reflection);
        const silenceSentence = silenceRecheck.response || reply;
        reply = reflection + " " + silenceSentence;
        finalSilenceMode = true;
      }
    }

    // 13.6. Update previous_was_question flag for next turn
    const currentResponseHasQuestion = responseHasQuestion(reply);
    await updatePreviousWasQuestion(userId, currentResponseHasQuestion);

    // 13.7. Update previous_was_silence flag for next turn
    await updatePreviousWasSilence(userId, finalSilenceMode);

    // 14. Save emotional metrics metadata with response stability (no conversation content)
    await insertEmotionalMetric({
      user_id: userId,
      role,
      detected_emotion: emotionTag,
      maturity_risk_level: riskLevel,
      response_stability: responseStability,
    });

    // 15. Update CSS score in the same row
    await updateCSSInMetrics(userId, cssResult.css);

    // 15.5. Record quality event for admin dashboard tracking
    // Only record if CSS score indicates issues (low CSS) or if there were quality problems
    // Note: aiEngine already records quality events when critic fails, but we also record here
    // for tracking all interactions in admin dashboard
    if (cssResult.css <= 3 || responseStability < 0) {
      try {
        await recordQualityEvent({
          role,
          intent: intentJson.intent,
          issues: cssResult.css <= 2 ? ["low_css_score"] : [],
          severity: cssResult.css <= 2 ? "high" : cssResult.css <= 3 ? "medium" : "low",
          cssScore: cssResult.css,
          modelVersion: "gpt-4o",
          route: "web" as QualityEventRoute,
        });
      } catch (err) {
        console.error("[chat] Failed to record quality event:", err);
      }
    }

    const response: { reply: string; maturitySignal?: string } = {
      reply,
    };

    if (maturityResult.signals.length > 0) {
      response.maturitySignal = maturityResult.signals[0];
    }

    res.json(response);
  } catch (err: any) {
    console.error("[chat] Error:", {
      message: err?.message,
      stack: err?.stack,
      code: err?.code,
      status: err?.response?.status,
      data: err?.response?.data,
    });

    // 할당량 초과 등 API 에러 시에도 fallback으로 응답
    if (err?.code === "insufficient_quota" || err?.code === "rate_limit_exceeded") {
      console.warn("[chat] API quota exceeded, using fallback response");
      try {
        // 감정 분석 실패 시 기본값 사용
        const emotionTag = "confusion";
        const riskLevel = "medium";
        // Intent extraction 실패 시 기본값 사용
        const fallbackIntent = {
          intent: "other" as const,
          user_energy: "medium" as const,
          tone_needed: "warm_mentor" as const,
          next_step: "reflect" as const,
          key_point: "의도 파악 중 오류가 발생했습니다.",
          question_style: "one_short_question" as const,
          interpretation_confidence: 0.5,
        };
        const maturityResponse = generateMaturityResponse(
          message,
          role,
          emotionTag,
          riskLevel,
          fallbackIntent
        );
        const maturityResult = await calculateMaturityDelta(
          message,
          emotionTag,
          riskLevel,
          0, // integrityAlignmentScore
          userId,
          role
        );
        
        const firstStep = maturityResponse.steps[0];
        const fallbackReflection = buildReflectionFromLibrary(
          fallbackIntent.key_point,
          emotionTag,
          fallbackIntent.intent,
          []
        );
        const fallbackExtra =
          firstStep?.reflectionPrompts
            .filter((p) => !p.includes("?"))
            .slice(0, 1)[0] ?? "";
        let fallbackReply = fallbackReflection + (fallbackExtra ? " " + fallbackExtra : "");

        // Apply guardrails to fallback reply
        fallbackReply = await applyGuardrails(fallbackReply);

        const response: { reply: string; maturitySignal?: string } = {
          reply: `[API 할당량 초과 - 테스트 모드]\n\n${fallbackReply}`,
        };

        if (maturityResult.signals.length > 0) {
          response.maturitySignal = maturityResult.signals[0];
        }

        return res.json(response);
      } catch (fallbackErr) {
        console.error("[chat] Fallback also failed:", fallbackErr);
      }
    }

    res.status(500).json({
      error: "Failed to generate response",
      details: process.env.NODE_ENV === "development" ? err?.message : undefined,
    });
  }
});

export default router;
