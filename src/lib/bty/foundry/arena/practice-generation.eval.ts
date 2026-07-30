/**
 * Live practice-generation EVALUATION corpus + harness helpers (Slice 3.2I-R2).
 *
 * This is NOT a product surface and NOT a deterministic fixture factory. It exercises the
 * EXACT production generation contract (`generateArenaScenarioDraft`) against synthetic,
 * non-private training inputs, so an internal reviewer can judge live-model quality. It
 * never persists a draft, never publishes, never creates a run, never writes Supabase, and
 * never substitutes deterministic output — when no live model is configured, the contract
 * returns `generation_unavailable` and the harness records exactly that.
 *
 * Run it with `npm run evaluate:practice-generation` (RUN_LIVE_EVAL=1). Output is written
 * under the git-ignored `.eval-artifacts/`.
 */

import type { ScenarioGenInput } from "./arenaScenarioTemplate";
import type { ModuleSourceFacts } from "./arenaScenarioSource";
import type { ArenaScenarioDraft } from "@/domain/foundry/arena-draft/types";

export type EvalCase = {
  id: string;
  dilemma: string;
  role: string;
  locale: "en" | "ko";
  /** Some cases are KNOW/COMPLIANCE hard-stops that must be DECLINED, not turned into a dilemma. */
  expectDecline?: boolean;
  /** Expected eligibility class (Slice 3.2I-R3) — the harness asserts generate/decline accordingly. */
  expectClass?: "know_only" | "judgment_only" | "mixed_with_non_negotiables" | "unresolved_safety_boundary";
  input: ScenarioGenInput;
};

function facts(over: Partial<ModuleSourceFacts>): ModuleSourceFacts {
  return {
    problem: null,
    observableBehavior: null,
    successEvidence: null,
    audienceType: "leaders",
    audienceDetail: null,
    learningNeeds: ["decide"],
    ...over,
  };
}
const g = (choice: ScenarioGenInput["guided"]["hardestWhen"]["choice"], text: string): ScenarioGenInput["guided"] => ({
  hardestWhen: { choice },
  avoidancePressure: { text },
});

/** ≥12 synthetic, non-private inputs across dilemma types, roles, and locales (≥8 en, ≥4 ko). */
export const EVAL_CORPUS: EvalCase[] = [
  { id: "c01-missed-commitment", dilemma: "missed leadership commitment", role: "team leader", locale: "en",
    input: { locale: "en", facts: facts({ problem: "Your team missed a delivery you personally promised the client", observableBehavior: "Own the miss and reset the client honestly" }), guided: g("time_limited", "admitting the miss feels like losing the client's trust") } },
  { id: "c02-uncertain-customer", dilemma: "uncertain customer information", role: "customer-facing lead", locale: "en",
    input: { locale: "en", facts: facts({ problem: "A customer is waiting on a fix that is only ninety percent confirmed", observableBehavior: "Communicate clearly under uncertainty" }), guided: g("time_limited", "sending it before it is confirmed could be wrong") } },
  { id: "c03-fairness-retention", dilemma: "fairness versus retention", role: "office manager", locale: "en",
    input: { locale: "en", facts: facts({ problem: "A top performer is accused of treating a teammate unfairly", observableBehavior: "Hold a fair standard consistently" }), guided: g("other_resists", "acting on it risks losing your best person") } },
  { id: "c04-safety-hardstop", dilemma: "clinical safety hard stop", role: "clinical leader", locale: "en", expectDecline: true, expectClass: "know_only",
    input: { locale: "en", facts: facts({ problem: "Staff must confirm two patient identifiers before medication administration", observableBehavior: "Confirm two identifiers before every dose", learningNeeds: ["know"] }), guided: g("time_limited", "the ward is busy and it feels like a delay") } },
  { id: "c05-speed-accuracy", dilemma: "operational speed versus accuracy", role: "regional manager", locale: "en",
    input: { locale: "en", facts: facts({ problem: "A dashboard executives rely on shows a figure that looks wrong during a critical week", observableBehavior: "Correct errors even when it is disruptive" }), guided: g("performance_pressure", "pausing reporting during the critical week is costly") } },
  { id: "c06-authority-escalation", dilemma: "authority versus escalation", role: "individual contributor", locale: "en",
    input: { locale: "en", facts: facts({ problem: "You spot a serious problem outside your area that a peer owns", observableBehavior: "Escalate concerns responsibly" }), guided: g("authority_unclear", "acting oversteps a peer's authority") } },
  { id: "c07-limited-staffing", dilemma: "limited staffing or resources", role: "office manager", locale: "en",
    input: { locale: "en", facts: facts({ problem: "Two urgent requests arrive with only enough staff to cover one well", observableBehavior: "Allocate limited resources under pressure" }), guided: g("time_limited", "someone will be left waiting either way") } },
  { id: "c08-two-strong-members", dilemma: "conflict between two strong team members", role: "team leader", locale: "en",
    input: { locale: "en", facts: facts({ problem: "Two strong performers openly disagree on the approach in front of the team", observableBehavior: "Resolve conflict without picking a favorite" }), guided: g("other_resists", "both push hard and the team is watching") } },
  { id: "c09-transparency-verification", dilemma: "transparency versus controlled verification", role: "regional manager", locale: "ko",
    input: { locale: "ko", facts: facts({ problem: "확인되지 않은 오류 가능성을 팀 전체에 지금 알릴지 먼저 검증할지 결정해야 한다", observableBehavior: "불확실할 때 투명성과 검증 사이에서 판단한다" }), guided: g("time_limited", "확인 전에 알리면 불필요한 혼란을 부를 수 있다") } },
  { id: "c10-consistency-context", dilemma: "consistency versus individual context", role: "trainer", locale: "ko",
    input: { locale: "ko", facts: facts({ problem: "규정을 일관되게 적용할지 개인 사정을 고려할지 선택해야 하는 요청이 들어왔다", observableBehavior: "일관성과 개별 맥락 사이에서 판단한다" }), guided: g("other_resists", "예외를 두면 형평성 문제가 생긴다") } },
  { id: "c11-relationship-accountability", dilemma: "relationship protection versus public accountability", role: "clinical leader", locale: "ko",
    input: { locale: "ko", facts: facts({ problem: "동료의 실수를 공개적으로 책임지게 할지 관계를 지키며 조용히 처리할지 결정해야 한다", observableBehavior: "관계와 공적 책임 사이에서 판단한다" }), guided: g("other_resists", "공개하면 관계가 상한다") } },
  { id: "c12-autonomy-standardization", dilemma: "autonomy versus standardization", role: "team leader", locale: "ko",
    input: { locale: "ko", facts: facts({ problem: "팀에 자율을 줄지 공통 표준을 강제할지 정해야 한다", observableBehavior: "자율성과 표준화 사이에서 판단한다" }), guided: g("authority_unclear", "표준을 강제하면 반발이 생긴다") } },
  // Slice 3.2I-R3 — mixed safety + judgment, and an ambiguous boundary.
  { id: "c13-mixed-clinical", dilemma: "mixed clinical safety constraint", role: "clinical leader", locale: "en", expectClass: "mixed_with_non_negotiables",
    input: { locale: "en", facts: facts({ problem: "Two patient identifiers must be verified before treatment begins. Decide how to pause, reassign, notify, and recover while patients are waiting.", observableBehavior: "Uphold the verification while managing the delay" }), guided: g("time_limited", "the ward is backed up and every pause costs time") } },
  { id: "c14-mixed-privacy", dilemma: "mixed privacy constraint", role: "office manager", locale: "en", expectClass: "mixed_with_non_negotiables",
    input: { locale: "en", facts: facts({ problem: "You must not disclose private employee information. Decide how to answer the team, investigate, and communicate timing.", observableBehavior: "Answer honestly without revealing protected details" }), guided: g("other_resists", "the team is pressing for details you cannot share") } },
  { id: "c15-mixed-reporting", dilemma: "mixed mandatory reporting duty", role: "regional manager", locale: "en", expectClass: "mixed_with_non_negotiables",
    input: { locale: "en", facts: facts({ problem: "A safety incident must be reported. Decide who to notify first, how much work to pause, and how to communicate.", observableBehavior: "Report the incident while managing operations" }), guided: g("performance_pressure", "reporting will disrupt a critical delivery week") } },
  { id: "c16-ambiguous-boundary", dilemma: "ambiguous safety boundary", role: "team leader", locale: "en", expectDecline: true, expectClass: "unresolved_safety_boundary",
    input: { locale: "en", facts: facts({ problem: "There is a recurring safety concern the team keeps raising but no clear rule has been set", observableBehavior: "Address the concern" }), guided: g("authority_unclear", "it is unclear whose call this is") } },
];

// ---------------------------------------------------------------------------
// Cross-scenario diversity analysis — do unrelated trainings receive the same scaffold?
// ---------------------------------------------------------------------------

function fourGrams(text: string): string[] {
  const w = text.toLowerCase().replace(/[^a-z0-9가-힣\s]/g, " ").split(/\s+/).filter(Boolean);
  const out: string[] = [];
  for (let i = 0; i + 4 <= w.length; i++) out.push(w.slice(i, i + 4).join(" "));
  return out;
}

/** UI-required phrases that are allowed to repeat across scenarios. */
const ALLOWED_REPEAT = /what will you (do|actually do)|decide what you will/i;

export function crossScenarioDiversity(drafts: ArenaScenarioDraft[]): {
  repeatedFourGrams: Array<{ gram: string; count: number }>;
  repeatedPrimaryLabels: Array<{ label: string; count: number }>;
  distinctPrimaryLabelRatio: number;
} {
  const gramCounts = new Map<string, number>();
  const primaryCounts = new Map<string, number>();
  let primaryTotal = 0;
  for (const d of drafts) {
    const texts = [d.opening, ...Object.values(d.branches ?? {}).map((b) => b.escalationText)];
    const seen = new Set<string>();
    for (const t of texts) for (const gram of fourGrams(t)) {
      if (ALLOWED_REPEAT.test(gram) || seen.has(gram)) continue;
      seen.add(gram);
      gramCounts.set(gram, (gramCounts.get(gram) ?? 0) + 1);
    }
    for (const c of d.primary.choices) {
      const key = c.label.trim().toLowerCase();
      primaryCounts.set(key, (primaryCounts.get(key) ?? 0) + 1);
      primaryTotal++;
    }
  }
  const repeatedFourGrams = [...gramCounts.entries()].filter(([, n]) => n >= 3).map(([gram, count]) => ({ gram, count }));
  const repeatedPrimaryLabels = [...primaryCounts.entries()].filter(([, n]) => n >= 2).map(([label, count]) => ({ label, count }));
  const distinctPrimaryLabelRatio = primaryTotal === 0 ? 1 : primaryCounts.size / primaryTotal;
  return { repeatedFourGrams, repeatedPrimaryLabels, distinctPrimaryLabelRatio };
}
