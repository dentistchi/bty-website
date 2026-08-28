/**
 * KO ACTION CONTRACT V1 — the corpus, run against the real validator (Slice R4-R10A).
 *
 * Pure. No provider, no network, no fixture rewritten to fit an implementation.
 */
import { describe, it, expect } from "vitest";
import { KO_ACTION_FIXTURES, EN_ACTION_FIXTURES, KO_CONTEXTS, type Fixture } from "./koActionContract.fixtures";
import { validateBehaviorContract, CANONICAL_ACTOR, composeObservableAction, actionLanguageMismatchKo } from "./program-coherence";
import type { BuilderAnswers } from "./module-builder";

const CTX = new Map(KO_CONTEXTS.map((c) => [c.id, c]));

type Outcome = { ok: boolean; reason: string };

export function judge(fx: Fixture, locale: "en" | "ko"): Outcome {
  const c = CTX.get(fx.context)!;
  const action = composeObservableAction(fx.verb, fx.detail);
  const r = validateBehaviorContract(
    { observable_action: action },
    { actor: CANONICAL_ACTOR, trigger: c.trigger, criterion: c.criterion },
    { locale, answers: c.answers as BuilderAnswers },
  );
  return { ok: r.ok, reason: r.ok ? "" : r.defect.reason };
}

/**
 * What the fixture's expectation means in validator terms.
 *
 * WHO and WHEN share one reason: `foundry_program_call_behavior_contract_reason_check` is a
 * closed nine-value CHECK, so splitting them needs a migration and is not smuggled in here.
 */
function matches(expect: Fixture["expect"], o: Outcome): boolean {
  if (expect === "accept") return o.ok;
  if (o.ok) return false;
  return o.reason === "action_reclaims_authority";
}

/**
 * The language rule is SPECIFIED and DETECTED but not yet REFUSED (Slice R4-R10A).
 *
 * These six fixtures keep their `refuse_language` expectation — the specification does not bend
 * to the implementation — and are held against the pure detector instead of the validator, with
 * the reason recorded: a refusal needs a storable reason, and the ledger's vocabulary is closed.
 * Listing them explicitly means the debt is visible rather than absorbed into a passing suite.
 */
const LANGUAGE_DEFERRED = KO_ACTION_FIXTURES.filter((f) => f.expect === "refuse_language");

function report(name: string, list: readonly Fixture[], locale: "en" | "ko") {
  const rows = list.map((fx) => {
    const o = judge(fx, locale);
    return { fx, o, pass: matches(fx.expect, o) };
  });
  const failed = rows.filter((r) => !r.pass);
  console.log(`\n=== ${name}: ${rows.length - failed.length}/${rows.length} as specified ===`);
  for (const r of failed) {
    console.log(`  MISS ${r.fx.context}/${r.fx.label}  expected=${r.fx.expect}  got=${r.o.ok ? "accept" : "refuse:" + r.o.reason}`);
  }
  return { rows, failed };
}

describe("KO action contract — corpus", () => {
  it("KO fixtures behave as the authority boundary requires", () => {
    const enforced = KO_ACTION_FIXTURES.filter((f) => f.expect !== "refuse_language");
    const { failed } = report("KO (enforced)", enforced, "ko");
    expect(failed.map((f) => `${f.fx.context}/${f.fx.label}`)).toEqual([]);
  });

  it("the deferred language rule is detected by the pure rule, and named as debt", () => {
    expect(LANGUAGE_DEFERRED.length).toBe(6);
    for (const fx of LANGUAGE_DEFERRED) {
      const action = `${fx.verb} ${fx.detail}`;
      expect(actionLanguageMismatchKo(action), fx.label).toBe(true);
      /*
        Whether the VALIDATOR also refuses it is deliberately not pinned. A fully-English action
        may independently trip an English authority rule — one of these six does — and asserting
        "still accepted" would turn that correct refusal into a failure. What is pinned is the
        thing this slice owns: the pure detector sees the mismatch, and no reason is emitted for
        it yet.
      */
      const o = judge(fx, "ko");
      console.log(`  deferred ${fx.label}: validator=${o.ok ? "accept" : "refuse:" + o.reason}`);
      expect(o.ok || o.reason === "action_reclaims_authority", fx.label).toBe(true);
    }
    // The allowance that must never regress: Korean prose carrying Latin terms is not a mismatch.
    for (const ok of ["확인하다 KPI를 확인한다", "기록하다 CRM에 기록한다", "스캔하다 QR 코드를 스캔한다", "공유하다 Slack에 공유한다"]) {
      expect(actionLanguageMismatchKo(ok), ok).toBe(false);
    }
  });

  it("EN regression is unchanged", () => {
    const { failed } = report("EN", EN_ACTION_FIXTURES, "en");
    expect(failed.map((f) => `${f.fx.context}/${f.fx.label}`)).toEqual([]);
  });

  it("the corpus is large enough not to overfit one sentence", () => {
    expect(KO_ACTION_FIXTURES.length + EN_ACTION_FIXTURES.length).toBeGreaterThanOrEqual(60);
    expect(new Set(KO_ACTION_FIXTURES.map((f) => f.context)).size).toBeGreaterThanOrEqual(5);
  });
});
