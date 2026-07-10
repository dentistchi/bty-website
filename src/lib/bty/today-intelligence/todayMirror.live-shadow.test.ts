/**
 * Today AI Mirror — REAL-PROVIDER shadow evaluation (hard-gated, NOT part of default suite).
 *
 * Runs ONLY when TODAY_MIRROR_LIVE=1 and a provider is configured. Calls the configured
 * server-side provider once per synthetic fixture (baseline), captures value-safe structured
 * results, and writes them to an untracked artifact for review. No user data, no secrets, no
 * full system prompt, no credentials are recorded. maxRetries=0 → exactly one generation each.
 */
import { describe, it, expect } from "vitest";
import { writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { isLlmAvailable, getLlmModel } from "@/lib/bty/llm/client";
import { generateTodayMirror } from "@/lib/bty/today-intelligence/todayMirrorGenerate";
import { MIRROR_PROMPT_VERSION } from "@/lib/bty/today-intelligence/todayMirrorPrompt";
import { EMPTY_RECENT_CONTEXT } from "@/domain/daily/todayMirror.types";
import { MIRROR_FIXTURES, KOREAN_REVIEW_FIXTURES, KOREAN_TARGETED_FIXTURES } from "@/lib/bty/today-intelligence/__fixtures__/todayMirrorFixtures";

const LIVE = process.env.TODAY_MIRROR_LIVE === "1" && isLlmAvailable();
// Machine-agnostic default so the committed baseline carries no session-specific absolute path.
// Override with MIRROR_ARTIFACT. Only written when the hard-gated LIVE provider run executes.
const ARTIFACT = process.env.MIRROR_ARTIFACT ?? join(tmpdir(), "today_mirror_baseline_v1.json");

describe.skipIf(!LIVE)("Today Mirror — real provider baseline V1", () => {
  it("runs all 20 fixtures once, writes value-safe artifact", async () => {
    const model = getLlmModel();
    const rows: unknown[] = [];
    const tagged = [
      ...MIRROR_FIXTURES.map((f) => ({ f, set: "orig20" })),
      ...(process.env.MIRROR_KO_REVIEW === "1"
        ? KOREAN_REVIEW_FIXTURES.map((f) => ({ f, set: "ko-review" }))
        : []),
      ...(process.env.MIRROR_KO_REVIEW === "1"
        ? KOREAN_TARGETED_FIXTURES.map((f) => ({ f, set: "ko-targeted" }))
        : []),
    ];
    for (const { f: fx, set } of tagged) {
      const started = Date.now();
      const res = await generateTodayMirror({
        packet: fx.packet,
        recent: fx.recent ?? EMPTY_RECENT_CONTEXT,
        locale: fx.locale,
        maxRetries: 0, // exactly one generation; no quality-driven regen
      });
      const durationMs = Date.now() - started;
      const common = {
        fixture: fx.name,
        set,
        locale: fx.locale,
        lens: res.analysis.selectedLens,
        confidence: res.analysis.confidence,
        model,
        promptVersion: MIRROR_PROMPT_VERSION,
        durationMs,
        retryCount: 0,
      };
      if (res.ok) {
        rows.push({
          ...common,
          outcome: "ACCEPTED",
          mirror: res.response.mirror,
          perspective: res.response.perspective,
          suggestedStep: res.response.suggestedStep,
          uncertaintyNote: res.response.uncertaintyNote,
          evidenceIds: res.response.evidenceIds,
          noveltySignature: res.response.noveltySignature,
        });
      } else {
        rows.push({
          ...common,
          outcome: res.reason === "validation_failed" ? "REJECTED" : "FAILED_QUIET",
          reason: res.reason,
          violations: res.violations ?? [],
        });
      }
    }
    writeFileSync(ARTIFACT, JSON.stringify({ model, promptVersion: MIRROR_PROMPT_VERSION, rows }, null, 2));
    expect(rows.length).toBeGreaterThanOrEqual(20);
  }, 120_000);
});
