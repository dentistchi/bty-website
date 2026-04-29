/**
 * Dr. Chi 멘토 챗 RAG 맥락 — 세션 시 AIR 패턴·힐링 단계·역지사지 미러를 모아 시스템 프롬프트 prefix로 넣는다.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { HealingPhase } from "@/engine/healing/healing-phase.service";
import { getCurrentPhase } from "@/engine/healing/healing-phase.service";
import { getResilienceScore, type ResilienceScore } from "@/engine/resilience/resilience-tracker.service";
import {
  formatBehaviorPatternNarrativeLines,
  getBehaviorPatterns,
} from "@/engine/integrity/behavior-pattern.service";
import { getPatternNarrativeLines } from "@/engine/memory/pattern-history.service";
import type { MirrorScenario } from "@/engine/perspective-switch/mirror-scenario.service";
import { getMirrorScenarios } from "@/engine/perspective-switch/mirror-scenario.service";
import { getSupabaseServerClient } from "@/lib/bty/arena/supabaseServer";

export type MentorContext = {
  /** Set by {@link buildMentorContext} for example-bank / RAG injection. */
  userId?: string;
  /** Arena/Center-derived resilience snapshot ({@link getResilienceScore}, no DB snapshot on each chat). */
  resilience?: ResilienceScore | null;
  narratives: string[];
  /** Arena choice / AIR-trend behavior labels (see `user_behavior_patterns`). */
  behaviorPatternLines: string[];
  phase: HealingPhase | null;
  mirrors: MirrorScenario[];
  /** Appended by {@link injectExamplesIntoContext} (Dr. Chi example bank). */
  mentorExampleRagLines?: string[];
  /** Appended by `expandContextByPhase` (mentor-rag-expander.service). */
  mentorRagExpansionLines?: string[];
};

/**
 * Dr. Chi 세션 오픈 시 사용: 패턴 5줄·힐링 phase·미러 시나리오를 병렬 로드.
 * 하위 조회 실패 시 빈 맥락을 반환해 챗 API가 깨지지 않게 한다.
 */
export async function buildMentorContext(
  userId: string,
  supabase?: SupabaseClient,
): Promise<MentorContext> {
  const client = supabase ?? (await getSupabaseServerClient());
  try {
    const [narratives, patterns, phase, mirrors] = await Promise.all([
      getPatternNarrativeLines(userId, client),
      getBehaviorPatterns(userId, { refresh: true }),
      getCurrentPhase(userId, client),
      getMirrorScenarios(userId, client),
    ]);
    return {
      userId,
      narratives,
      behaviorPatternLines: formatBehaviorPatternNarrativeLines(patterns),
      phase,
      mirrors,
    };
  } catch (e) {
    console.warn("[buildMentorContext]", e);
    return { userId, narratives: [], behaviorPatternLines: [], phase: null, mirrors: [] };
  }
}

/**
 * `buildChatMessagesForModel` 등에 넘길 시스템 프롬프트 **접두어** (언어 규칙·BTY override 앞에 붙임).
 * 모델은 이 블록을 사용자 배경 힌트로만 쓰고, 그대로 인용하지 않는다고 안내.
 */
export function mentorContextToSystemPromptPrefix(ctx: MentorContext): string {
  const blocks: string[] = [];
  if (ctx.narratives.length > 0) {
    blocks.push(
      "Recent AIR / activation pattern lines (Korean):\n" +
        ctx.narratives.map((n, i) => `  ${i + 1}. ${n}`).join("\n"),
    );
  }
  if (ctx.behaviorPatternLines.length > 0) {
    blocks.push(
      "Detected behavior patterns from Arena choices / AIR trend (Korean):\n" +
        ctx.behaviorPatternLines.map((n, i) => `  ${i + 1}. ${n}`).join("\n"),
    );
  }
  if (ctx.phase) {
    blocks.push(`Current healing phase (Center track): ${ctx.phase}`);
  }
  if (ctx.resilience != null) {
    const r = ctx.resilience;
    blocks.push(
      `Resilience score (0–100): ${r.score}. Components: CLEAN streak length ${r.consecutive_clean_choices}, recovery days (slip→CLEAN) ${r.recovery_days.toFixed(1)} (penalty ${r.recovery_speed_component.toFixed(1)}), healing phase completions ${r.center_phase_completions}.`,
    );
  }
  if (ctx.mirrors.length > 0) {
    const lines = ctx.mirrors.map(
      (m) =>
        `  - [${m.origin_scenario_id} → ${m.target_role}] ${m.mirror_title}`,
    );
    blocks.push("Perspective-mirror scenarios queued (Korean titles):\n" + lines.join("\n"));
  }
  if (ctx.mentorExampleRagLines && ctx.mentorExampleRagLines.length > 0) {
    blocks.push(
      "Coaching pattern examples (matched to recent Arena flag_type):\n" +
        ctx.mentorExampleRagLines.join("\n\n"),
    );
  }
  if (ctx.mentorRagExpansionLines && ctx.mentorRagExpansionLines.length > 0) {
    blocks.push(
      "Healing-phase expansion (coaching micro-pattern):\n" +
        ctx.mentorRagExpansionLines.join("\n\n"),
    );
  }
  if (blocks.length === 0) return "";

  return (
    "[RAG — user context for Dr. Chi. Use as background only; do not quote verbatim.]\n" +
    blocks.join("\n\n") +
    "\n[/RAG]"
  );
}
