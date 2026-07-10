/**
 * BTY Today AI Mirror — shadow evaluation harness (service layer, shadow-only).
 *
 * Runs synthetic fixtures through the REAL pipeline (selectMirrorLens → buildMirrorPrompt →
 * generateTodayMirror → validators) with an injected client. Produces a deterministic
 * scorecard. This is developer-only introspection: it is NOT wired to any route or UI and
 * is NOT part of the default test suite unless a test imports it with a mock client.
 *
 * Deterministic scorecard only. A model-based grader would be advisory; Commander sensory
 * review is the final authority for voice/emotional quality (never asserted here).
 */
import { EMPTY_RECENT_CONTEXT } from "@/domain/daily/todayMirror.types";
import { generateTodayMirror, type MirrorLlmClient } from "@/lib/bty/today-intelligence/todayMirrorGenerate";
import type { MirrorFixture } from "@/lib/bty/today-intelligence/__fixtures__/todayMirrorFixtures";

export type ShadowRow = {
  name: string;
  selectedLens: string;
  outcome: "ok" | "fail_quiet";
  violations: string[];
  /** Deterministic scorecard checks (hard pass/fail). */
  checks: {
    lensAsExpected: boolean;
    evidenceBound: boolean; // ok result ⇒ validators passed ⇒ every claim maps to evidence
    restraintWhenThin: boolean;
    contractNotOverwritten: boolean;
    actionObservableOrNull: boolean;
  };
  sample?: { mirror: string; perspective: string; step: string | null };
};

export async function runShadow(
  client: MirrorLlmClient,
  fixtures: MirrorFixture[],
): Promise<ShadowRow[]> {
  const rows: ShadowRow[] = [];
  for (const f of fixtures) {
    const res = await generateTodayMirror({
      packet: f.packet,
      recent: f.recent ?? EMPTY_RECENT_CONTEXT,
      locale: f.locale,
      client,
    });
    const lens = res.analysis.selectedLens;
    const thin = res.analysis.confidence === "low" || res.analysis.confidence === "none";
    if (res.ok) {
      const step = res.response.suggestedStep;
      rows.push({
        name: f.name,
        selectedLens: lens,
        outcome: "ok",
        violations: [],
        checks: {
          lensAsExpected: lens === f.expectLens,
          evidenceBound: true,
          restraintWhenThin: !thin || Boolean(res.response.uncertaintyNote),
          contractNotOverwritten: f.packet.openContract === null || step === null,
          actionObservableOrNull: step === null || step.observableCompletion.trim().length > 0,
        },
        sample: {
          mirror: res.response.mirror,
          perspective: res.response.perspective,
          step: step?.text ?? null,
        },
      });
    } else {
      rows.push({
        name: f.name,
        selectedLens: lens,
        outcome: "fail_quiet",
        violations: res.violations ?? [res.reason],
        checks: {
          lensAsExpected: lens === f.expectLens,
          evidenceBound: true, // no text emitted ⇒ nothing unsupported reached output
          restraintWhenThin: true,
          contractNotOverwritten: true,
          actionObservableOrNull: true,
        },
      });
    }
  }
  return rows;
}
