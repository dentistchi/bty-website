/**
 * KO ACTION CONTRACT V1-R1 — the WHEN detector, repaired (Slice R4-R10A-R1).
 *
 * THE MEASURED FALSE POSITIVE, on the Founder's live draft `e32d05f2`. V1 refused a WHEN reclaim
 * whenever the action shared two content tokens with the Host's `recurringMoment`. On a training
 * whose moment is "고객의 요청이나 변경 사항을 들었을 때", the words 고객 and 요청 are the OBJECT
 * of almost every legitimate action — so `고객 요청을 CRM에 기록한다`, a fixture the audit itself
 * listed as must-accept, was refused.
 *
 * Content vocabulary overlap is not temporal reclamation. Every context below is deliberately one
 * where the trigger's nouns recur as the action's object — the property my original five contexts
 * all lacked, which is precisely why the corpus passed while the product did not.
 */
import { describe, it, expect } from "vitest";
import { validateBehaviorContract, CANONICAL_ACTOR, composeObservableAction } from "./program-coherence";
import type { BuilderAnswers } from "./module-builder";

type Case = { readonly trigger: string; readonly action: string; readonly expect: "accept" | "refuse"; readonly why: string };

const answersFor = (trigger: string): BuilderAnswers =>
  ({ audienceType: "everyone", recurringMoment: trigger, observableBehavior: "x", successEvidence: "y" } as unknown as BuilderAnswers);

function judge(c: Case) {
  const action = composeObservableAction("확인하다", c.action);
  const r = validateBehaviorContract(
    { observable_action: action },
    { actor: CANONICAL_ACTOR, trigger: c.trigger, criterion: "기록에 남는다." },
    { locale: "ko", answers: answersFor(c.trigger) },
  );
  return { ok: r.ok, reason: r.ok ? "" : r.defect.reason };
}

const A = "고객의 요청이나 변경 사항을 들었을 때";
const B = "환자가 통증을 이야기했을 때";
const C = "업무를 다른 사람에게 넘길 때";
const D = "회의가 끝나기 전에";
const E = "문제가 다시 발생했을 때";

/** Five contexts whose trigger nouns are also the natural object of the action. */
export const WHEN_CASES: readonly Case[] = [
  // ── A · the Founder's own context ──────────────────────────────────────────
  { trigger: A, action: "고객 요청을 CRM에 기록한다", expect: "accept", why: "T9 — the exact Founder fixture; shares 고객+요청, no temporal clause" },
  { trigger: A, action: "고객의 요청을 자신의 말로 다시 확인한다", expect: "accept", why: "T10 — the exact Founder fixture" },
  { trigger: A, action: "고객 요청을 다시 확인한다", expect: "accept", why: "T1 — shared nouns only" },
  { trigger: A, action: "고객의 요청이나 변경 사항을 기록한다", expect: "accept", why: "T3 — four shared tokens, still no temporal clause" },
  { trigger: A, action: "고객의 요청이나 변경 사항을 들었을 때 핵심 내용을 다시 확인한다", expect: "refuse", why: "T4 — the Host's clause, verbatim" },
  { trigger: A, action: "고객의 요청을 들은 뒤 핵심 내용을 다시 확인한다", expect: "refuse", why: "T11/T5 — same event + 뒤" },
  { trigger: A, action: "고객 요청을 들은 후 확인한다", expect: "refuse", why: "T6 — same event + 후" },
  { trigger: A, action: "고객 요청을 듣기 전에 확인한다", expect: "refuse", why: "T7 — same event + 전에" },
  { trigger: A, action: "확인 후 결과를 기록한다", expect: "accept", why: "T8 — a temporal word unrelated to the Host's event" },
  { trigger: A, action: "처리 후 CRM에 저장한다", expect: "accept", why: "T8 — unrelated temporal clause" },

  // ── B · patient pain ───────────────────────────────────────────────────────
  { trigger: B, action: "환자의 통증 정도를 기록한다", expect: "accept", why: "shared 환자+통증, no clause" },
  { trigger: B, action: "환자가 이야기한 통증을 그대로 기록한다", expect: "accept", why: "three shared tokens, no temporal clause" },
  { trigger: B, action: "환자가 통증을 이야기했을 때 기록한다", expect: "refuse", why: "the Host's clause" },
  { trigger: B, action: "통증을 들은 후 기록한다", expect: "refuse", why: "trigger noun inside a temporal clause" },

  // ── C · handover ───────────────────────────────────────────────────────────
  { trigger: C, action: "업무 내용과 마감일을 확인한다", expect: "accept", why: "shared 업무, no clause" },
  { trigger: C, action: "다른 사람에게 넘길 업무의 마감일을 확인한다", expect: "accept", why: "shares the trigger's words as objects, no temporal ending" },
  { trigger: C, action: "업무를 다른 사람에게 넘길 때 마감일을 확인한다", expect: "refuse", why: "the Host's clause, verbatim" },

  // ── D · meeting ────────────────────────────────────────────────────────────
  { trigger: D, action: "담당자와 마감일을 확인한다", expect: "accept", why: "no overlap at all" },
  { trigger: D, action: "회의록에 담당자와 마감일을 적는다", expect: "accept", why: "shares 회의 as an object word" },
  { trigger: D, action: "회의가 끝나기 전에 담당자와 마감일을 확인한다", expect: "refuse", why: "the Host's clause" },

  // ── E · recurring problem ──────────────────────────────────────────────────
  { trigger: E, action: "문제 원인을 기록한다", expect: "accept", why: "shared 문제, no clause" },
  { trigger: E, action: "다시 발생한 문제의 원인을 기록한다", expect: "accept", why: "three shared tokens, no temporal ending" },
  { trigger: E, action: "문제가 다시 발생했을 때 원인을 기록한다", expect: "refuse", why: "the Host's clause" },
  { trigger: E, action: "문제가 발생한 뒤 원인을 기록한다", expect: "refuse", why: "same event + 뒤" },

  // ── frequency stands alone ─────────────────────────────────────────────────
  { trigger: A, action: "매번 고객 요청을 확인한다", expect: "refuse", why: "a bare frequency adverbial claims an occasion" },
  { trigger: D, action: "항상 담당자를 확인한다", expect: "refuse", why: "same" },
];

describe("R4-R10A-R1 — Korean WHEN authority is anchored to temporal structure", () => {
  it("shared vocabulary alone never refuses; a reproduced temporal clause always does", () => {
    const misses = WHEN_CASES.map((c) => ({ c, o: judge(c) }))
      .filter(({ c, o }) => (c.expect === "accept" ? !o.ok : o.ok));
    for (const m of misses) {
      console.log(`  MISS [${m.c.expect}] ${JSON.stringify(m.c.action)}  got=${m.o.ok ? "accept" : "refuse:" + m.o.reason}  (${m.c.why})`);
    }
    expect(misses.map((m) => m.c.action)).toEqual([]);
  });

  it("a WHEN reclaim is classified as one, without changing what the ledger stores", () => {
    /*
      §10 — the finer truth lives on the pure result. `reason` stays inside the closed nine-value
      CHECK so nothing needs a migration; `authority` says which of the two failures it was, which
      is the distinction that made the Founder's own refusal unresolvable from telemetry alone.
    */
    const r = validateBehaviorContract(
      { observable_action: composeObservableAction("확인하다", "고객의 요청을 들은 뒤 핵심 내용을 다시 확인한다") },
      { actor: CANONICAL_ACTOR, trigger: A, criterion: "기록에 남는다." },
      { locale: "ko", answers: answersFor(A) },
    );
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.defect.reason, "the stored vocabulary is unchanged").toBe("action_reclaims_authority");
      expect(r.defect.authority).toBe("moment");
    }
  });

  it("the corpus covers enough shared-vocabulary contexts to matter", () => {
    expect(WHEN_CASES.length).toBeGreaterThanOrEqual(20);
    expect(new Set(WHEN_CASES.map((c) => c.trigger)).size).toBeGreaterThanOrEqual(5);
  });
});
