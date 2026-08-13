#!/usr/bin/env npx tsx
/**
 * SEMANTIC REASON DIAGNOSTICS — the live proof (Slice 3.2P-A5-R2A).
 *
 * WHY THIS IS A SCRIPT AND NOT A TEST. It writes to the staging database. The unit suite runs
 * in CI on every change and must never touch a live environment, so this stays out of it and
 * is invoked deliberately. It is engineering observability, not a Founder surface.
 *
 * WHAT IT PROVES, end to end and without a single provider call:
 *
 *   1. both new columns exist and are nullable
 *   2. the LIVE CHECK vocabularies, derived by probe rather than read from the migration text
 *   3. the real recorder path durably stores the subtype the real validator computed
 *   4. every historical row still holds NULL
 *   5. every disposable row it created is gone, and the counts are back
 *
 * THE NON-WRITING PROBE. A CHECK constraint is evaluated BEFORE the foreign key trigger, so an
 * insert carrying an `attempt_id` that does not exist tells us which constraint the value hit
 * without ever creating a row: rejected by the CHECK means the value is refused; rejected by
 * the FK means the CHECK accepted it. Nothing is written either way.
 *
 * THE WRITE PROBE. §5 asks for durable readback, which needs real rows. Every one carries a
 * unique fingerprint, and cleanup runs in `finally` — a probe that threw before its cleanup
 * once left three orphans in this very table, which is why the sweep at the end enumerates by
 * fingerprint rather than trusting the happy path.
 *
 *   npx tsx scripts/verify-semantic-reason-diagnostics.ts
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";

import { validateProgramProposal, requiredProgramKinds } from "../src/domain/foundry/module/program-authorship";
import { SCENARIO_DEFECT_REASONS } from "../src/domain/foundry/module/program-coherence";
import { EVIDENCE_POLICY } from "../src/domain/foundry/module/evidence-policy";
import { finalizeProgramCall, LIVE_SEMANTIC_REASON_VOCABULARY } from "../src/lib/bty/foundry/events/programGenerationRecorder";
import type { BuilderAnswers } from "../src/domain/foundry/module/module-builder";

const env = Object.fromEntries(
  readFileSync(".env.local", "utf8")
    .split("\n")
    .filter((l) => l.includes("=") && !l.trim().startsWith("#"))
    .map((l) => [l.slice(0, l.indexOf("=")).trim(), l.slice(l.indexOf("=") + 1).trim()]),
);
const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
}) as SupabaseClient;

const ATTEMPTS = "foundry_program_generation_attempts";
const CALLS = "foundry_program_generation_attempt_calls";
const DRAFTS = "foundry_module_drafts";
/** Every disposable row this run creates carries it, so cleanup never has to guess. */
const FINGERPRINT = `a5r2a-probe-${randomUUID()}`;

let failures = 0;
const check = (ok: boolean, label: string, detail = "") => {
  if (!ok) failures++;
  console.log(`  ${ok ? "PASS" : "FAIL"}  ${label}${detail ? `  ${detail}` : ""}`);
};

// ---------------------------------------------------------------------------
// §1 — the columns, and the live CHECK vocabularies, by non-writing probe
// ---------------------------------------------------------------------------

async function columnExists(column: string): Promise<boolean> {
  const { error } = await db.from(CALLS).select(column).limit(1);
  return !error;
}

/**
 * Does the LIVE CHECK accept this value? Never writes: the `attempt_id` cannot exist, so the
 * insert dies either on the CHECK (refused) or on the foreign key (accepted).
 */
async function checkAccepts(column: string, value: string | null): Promise<{ accepted: boolean; by: string }> {
  const { error } = await db.from(CALLS).insert({
    attempt_id: randomUUID(),
    call_kind: "authorship",
    call_sequence: 1,
    model: "probe-no-provider",
    provider_timeout_ms: 1,
    structured_output_mode: "json_schema_strict",
    lifecycle_state: "prepared",
    [column]: value,
  });
  if (!error) throw new Error(`probe unexpectedly WROTE a row for ${column}=${value} — investigate immediately`);
  const msg = error.message.toLowerCase();
  const hitCheck = msg.includes(`${column}_check`) || (msg.includes("check constraint") && msg.includes(column));
  return { accepted: !hitCheck, by: hitCheck ? "CHECK" : "foreign key (CHECK passed)" };
}

async function proveVocabulary(column: string, expected: readonly string[]): Promise<string[]> {
  const live: string[] = [];
  for (const value of expected) {
    const r = await checkAccepts(column, value);
    if (r.accepted) live.push(value);
    else console.log(`    ${column}: live CHECK REFUSES "${value}" — expected it to accept`);
  }
  const nul = await checkAccepts(column, null);
  check(nul.accepted, `${column} accepts NULL`, nul.by);
  for (const invented of ["banana", `${expected[0]}_v2`, "NO_PRESSURE"]) {
    const r = await checkAccepts(column, invented);
    check(!r.accepted, `${column} refuses invented "${invented}"`, r.by);
  }
  return live;
}

// ---------------------------------------------------------------------------
// §5/§6 — the real validator, through the real recorder, read back from the DB
// ---------------------------------------------------------------------------

const ANSWERS = {
  problem: "During morning huddles, team members report problems but leave without naming who will act.",
  audienceType: "leaders",
  recurringMoment: "During morning huddles",
  observableBehavior: "Confirm the owner and the deadline for every agreed item.",
  successEvidence: "The huddle note records one owner and one deadline for every agreed action.",
  learningNeeds: ["shared_standard", "practice"],
  materialIntent: "pdf",
  followUpDays: 7,
  arenaRecommended: true,
  completionPrompt: "What specific phrases will you use at the next huddle?",
  sharedQuestion: "In your own words, what is the most important standard from this training?",
} as unknown as BuilderAnswers;

const CONTENT: Record<string, string> = {
  why_it_matters: "When a problem is raised and nobody is named, the next step quietly belongs to no one.",
  observable_standard: "Confirm the owner and the deadline for every agreed item.",
  scenario: "Two people are talking over each other and the item has no owner yet.",
  reflection: "What usually happens when an action needs an owner?",
  action_decision: "I will name one owner and one deadline for every item I raise.",
  completion_check: "What exact words will you use to confirm the owner and the deadline?",
  follow_up: "At follow-up you will be asked what you said and what happened next.",
};

type Program = {
  display_title: string;
  warnings: string[];
  scenario_contract: { pressure_condition: string; pressure_detail: string | null };
};

function baseline(): Record<string, unknown> {
  return {
    program: {
      display_title: "Naming an Owner for Every Agreed Action",
      elements: requiredProgramKinds(ANSWERS).map((kind) => ({
        kind,
        content: CONTENT[kind] ?? "A short, concrete statement about this part of the training.",
      })),
      assumptions: ["Participants are able to attend the session."],
      warnings: ["Training alone cannot settle a staffing shortage."],
      behavior_contract: { action_verb: "confirm", action_detail: "the owner and the deadline for every agreed item" },
      scenario_contract: { pressure_condition: "only two minutes remain", pressure_detail: null },
      completion_contract: { verification_target: "the_behaviour", response_mode: "state_what_you_will_say" },
      follow_up_contract: { review_focus: "what_you_said", confirmer: "self_report" },
    },
  };
}

/** One disposable parent, so the child rows have something legal to hang from. */
async function createProbeAttempt(draftId: string, ownerId: string): Promise<string> {
  const { data, error } = await db
    .from(ATTEMPTS)
    .insert({
      draft_id: draftId,
      owner_user_id: ownerId,
      submission_intent_id: randomUUID(),
      context_fingerprint: FINGERPRINT,
      proposal_version: "program_authorship_v20",
      locale: "en",
      // The column is CHECK-constrained to a 40-hex sha, so the fingerprint cannot live here;
      // `context_fingerprint` is free text and is what cleanup enumerates by.
      deploy_version: "0".repeat(40),
      correlation_id: randomUUID(),
      // The live CHECK allows only 'started' with a null outcome — read from
      // `foundry_program_gen_attempt_lifecycle_consistent`, not assumed.
      lifecycle_state: "started",
    })
    .select("id")
    .single<{ id: string }>();
  if (error || !data) throw new Error(`probe attempt insert failed: ${error?.message}`);
  return data.id;
}

async function createProbeCall(attemptId: string, sequence: number): Promise<string> {
  const { data, error } = await db
    .from(CALLS)
    .insert({
      attempt_id: attemptId,
      call_kind: "authorship",
      call_sequence: sequence,
      model: "probe-no-provider",
      provider_timeout_ms: 1,
      structured_output_mode: "json_schema_strict",
      // `in_flight` requires an invocation timestamp; `finalizeProgramCall` supplies the rest.
      lifecycle_state: "in_flight",
      provider_invoked_at: new Date().toISOString(),
    })
    .select("id")
    .single<{ id: string }>();
  if (error || !data) throw new Error(`probe call insert failed: ${error?.message}`);
  return data.id;
}

/**
 * The SAME mapping the service performs. It is duplicated here on purpose and asserted against
 * the validator's own output, so this script proves the shape the service passes rather than
 * inventing a friendlier one.
 */
function recorderInputFor(candidate: Record<string, unknown>) {
  const v = validateProgramProposal(candidate, ANSWERS, []);
  return {
    validation: v,
    refusal: v.ok ? null : { code: v.code, kind: v.kind ?? null },
    scenarioReason: v.ok ? null : (v.scenario?.reason ?? null),
    evidenceRule: v.ok ? null : (v.evidenceRule ?? null),
  };
}

async function main() {
  console.log(`fingerprint ${FINGERPRINT}\n`);

  // ---- baseline counts, before anything is created --------------------------
  const countOf = async (table: string) => {
    const { count } = await db.from(table).select("id", { count: "exact", head: true });
    return count ?? -1;
  };
  const BASE = {
    attempts: await countOf(ATTEMPTS),
    calls: await countOf(CALLS),
    drafts: await countOf(DRAFTS),
  };
  console.log(`baseline attempts=${BASE.attempts} calls=${BASE.calls} drafts=${BASE.drafts}\n`);

  const createdAttempts: string[] = [];
  let probeDraftId: string | null = null;

  try {
    // ---- §1 columns + live CHECK vocabularies ------------------------------
    console.log("§1 LIVE SCHEMA");
    for (const col of ["scenario_contract_reason", "evidence_policy_rule"]) {
      check(await columnExists(col), `column ${col} exists`);
    }
    const liveScenario = await proveVocabulary("scenario_contract_reason", SCENARIO_DEFECT_REASONS);
    const liveEvidence = await proveVocabulary("evidence_policy_rule", EVIDENCE_POLICY.map((r) => r.id));

    // ---- §2 machine parity: domain === runtime === LIVE --------------------
    console.log("\n§2 MACHINE PARITY (domain === runtime === live CHECK)");
    const sameSet = (a: readonly string[], b: readonly string[]) =>
      JSON.stringify([...a].sort()) === JSON.stringify([...b].sort());
    const scenarioIdentical =
      sameSet(SCENARIO_DEFECT_REASONS, LIVE_SEMANTIC_REASON_VOCABULARY.scenario) &&
      sameSet(LIVE_SEMANTIC_REASON_VOCABULARY.scenario, liveScenario);
    const evidenceIdentical =
      sameSet(EVIDENCE_POLICY.map((r) => r.id), LIVE_SEMANTIC_REASON_VOCABULARY.evidence) &&
      sameSet(LIVE_SEMANTIC_REASON_VOCABULARY.evidence, liveEvidence);
    console.log(`  SCENARIO IDENTICAL = ${scenarioIdentical}  (${liveScenario.length}/${SCENARIO_DEFECT_REASONS.length} live)`);
    console.log(`  EVIDENCE IDENTICAL = ${evidenceIdentical}  (${liveEvidence.length}/${EVIDENCE_POLICY.length} live)`);
    check(scenarioIdentical, "scenario vocabulary identical across all three");
    check(evidenceIdentical, "evidence vocabulary identical across all three");
    if (!scenarioIdentical || !evidenceIdentical) {
      console.log("\nSTOPPING before write probes — persistence must not run against a mismatched CHECK.");
      return;
    }

    // ---- disposable draft + attempt ----------------------------------------
    const { data: anyDraft } = await db.from(DRAFTS).select("owner_user_id").limit(1).single<{ owner_user_id: string }>();
    if (!anyDraft) throw new Error("no draft to borrow an owner id from");
    const { data: draft, error: draftErr } = await db
      .from(DRAFTS)
      .insert({
        owner_user_id: anyDraft.owner_user_id,
        status: "draft",
        current_step: 1,
        answers: { probe: FINGERPRINT },
      })
      .select("id")
      .single<{ id: string }>();
    if (draftErr || !draft) throw new Error(`probe draft insert failed: ${draftErr?.message}`);
    probeDraftId = draft.id;

    /*
      ONE ATTEMPT PER CASE. `call_sequence` is CHECK-constrained to 1..2 live — read from the
      table definition, not assumed — so a single parent cannot hold nineteen probe calls. Each
      case gets its own disposable parent, which also mirrors production shape more honestly.
    */
    const ownerId = anyDraft.owner_user_id;
    const newCall = async () => {
      const a = await createProbeAttempt(probeDraftId as string, ownerId);
      createdAttempts.push(a);
      return createProbeCall(a, 1);
    };

    // ---- §5 scenario readback ----------------------------------------------
    console.log("\n§5 SCENARIO READBACK (real validator → real recorder → database)");
    const withScenario = (pressure_condition: string) => {
      const c = baseline();
      (c.program as Program).scenario_contract = { pressure_condition, pressure_detail: null };
      return c;
    };
    const SCENARIO_CASES: [string, Record<string, unknown>, string][] = [
      ["missing", withScenario("short"), "scenario_without_pressure"],
      ["too_long", withScenario(`only two minutes remain ${"and the queue is waiting ".repeat(8)}`), "scenario_without_pressure"],
      ["generic", withScenario("it is difficult"), "scenario_without_pressure"],
      ["restates_action", withScenario("confirm the owner and the deadline for every agreed item"), "scenario_without_pressure"],
      ["no_pressure", withScenario("the agenda is on the screen"), "scenario_without_pressure"],
      ["independent_moment", withScenario("after the huddle ends"), "scenario_independent_moment"],
    ];

    for (const [expectedReason, candidate, expectedCode] of SCENARIO_CASES) {
      const mapped = recorderInputFor(candidate);
      const callId = await newCall();
      await finalizeProgramCall(db, {
        callId,
        outcome: "schema_invalid",
        durationMs: 1,
        refusal: mapped.refusal,
        scenarioReason: mapped.scenarioReason,
        evidenceRule: mapped.evidenceRule,
      });
      const { data: row } = await db
        .from(CALLS)
        .select("refusal_code, scenario_contract_reason, evidence_policy_rule")
        .eq("id", callId)
        .single<{ refusal_code: string; scenario_contract_reason: string | null; evidence_policy_rule: string | null }>();
      const ok =
        row?.refusal_code === expectedCode &&
        row?.scenario_contract_reason === expectedReason &&
        row?.evidence_policy_rule === null;
      check(ok, `${expectedReason.padEnd(19)} → ${expectedCode}`, `read back reason=${row?.scenario_contract_reason} evidence=${row?.evidence_policy_rule}`);
    }

    // ---- §6 evidence readback, all twelve -----------------------------------
    console.log("\n§6 EVIDENCE READBACK (12/12)");
    for (const rule of EVIDENCE_POLICY) {
      const c = baseline();
      (c.program as Program).warnings = [rule.forbiddenSample];
      const mapped = recorderInputFor(c);
      const callId = await newCall();
      await finalizeProgramCall(db, {
        callId,
        outcome: "schema_invalid",
        durationMs: 1,
        refusal: mapped.refusal,
        scenarioReason: mapped.scenarioReason,
        evidenceRule: mapped.evidenceRule,
      });
      const { data: row } = await db
        .from(CALLS)
        .select("refusal_code, scenario_contract_reason, evidence_policy_rule")
        .eq("id", callId)
        .single<{ refusal_code: string; scenario_contract_reason: string | null; evidence_policy_rule: string | null }>();
      const ok =
        row?.refusal_code === "evidence_overclaim" &&
        row?.evidence_policy_rule === rule.id &&
        row?.scenario_contract_reason === null;
      check(ok, `${rule.id.padEnd(26)} → evidence_overclaim`, `read back rule=${row?.evidence_policy_rule} scenario=${row?.scenario_contract_reason}`);
    }

    // ---- a SUCCESS leaves both NULL ----------------------------------------
    const good = recorderInputFor(baseline());
    check(good.validation.ok, "the baseline candidate still validates");
    const successCallId = await newCall();
    await finalizeProgramCall(db, {
      callId: successCallId,
      outcome: "success",
      durationMs: 1,
      refusal: good.refusal,
      scenarioReason: good.scenarioReason,
      evidenceRule: good.evidenceRule,
    });
    const { data: successRow } = await db
      .from(CALLS)
      .select("outcome, scenario_contract_reason, evidence_policy_rule")
      .eq("id", successCallId)
      .single<{ outcome: string; scenario_contract_reason: string | null; evidence_policy_rule: string | null }>();
    check(
      successRow?.outcome === "success" &&
        successRow?.scenario_contract_reason === null &&
        successRow?.evidence_policy_rule === null,
      "a success carries neither diagnostic",
    );

    // ---- §7 historical rows stay NULL ---------------------------------------
    console.log("\n§7 HISTORICAL NULL TRUTH");
    const { data: historical } = await db
      .from(CALLS)
      .select("id, attempt_id, refusal_code, scenario_contract_reason, evidence_policy_rule")
      .not("attempt_id", "in", `(${createdAttempts.join(",")})`);
    const populated = (historical ?? []).filter(
      (r) => r.scenario_contract_reason !== null || r.evidence_policy_rule !== null,
    );
    check(populated.length === 0, `all ${historical?.length ?? 0} historical child rows hold NULL in both columns`);
    for (const [label, attempt] of [
      ["A1", "6f93f7f4-c6b4-41a5-a3b4-bfcebc5942b8"],
      ["A4", "8a7f2f6a-7522-493e-a793-891e02d8332f"],
      ["A5", "d8be3e40-56e8-4a57-96eb-7b48ae44473a"],
    ] as const) {
      const rows = (historical ?? []).filter((r) => r.attempt_id === attempt);
      const allNull = rows.every((r) => r.scenario_contract_reason === null && r.evidence_policy_rule === null);
      check(allNull && rows.length > 0, `${label} keeps NULL — historically unavailable, not backfilled`, `${rows.length} rows`);
    }
  } finally {
    // ---- §8 cleanup, whatever happened above --------------------------------
    console.log("\n§8 CLEANUP");
    const { data: strayCalls } = await db
      .from(CALLS)
      .select("id, attempt_id")
      .in("attempt_id", createdAttempts.length ? createdAttempts : [randomUUID()]);
    if (strayCalls?.length) {
      await db.from(CALLS).delete().in("id", strayCalls.map((r) => r.id));
    }
    /* Enumerated by FINGERPRINT, never by the list this run happens to remember. */
    const { data: byFingerprint } = await db.from(ATTEMPTS).select("id").eq("context_fingerprint", FINGERPRINT);
    for (const a of byFingerprint ?? []) {
      await db.from(CALLS).delete().eq("attempt_id", a.id);
      await db.from(ATTEMPTS).delete().eq("id", a.id);
    }
    if (probeDraftId) await db.from(DRAFTS).delete().eq("id", probeDraftId);

    const after = {
      attempts: await countOf(ATTEMPTS),
      calls: await countOf(CALLS),
      drafts: await countOf(DRAFTS),
    };
    const { data: leftovers } = await db.from(ATTEMPTS).select("id").eq("context_fingerprint", FINGERPRINT);
    console.log(`  after attempts=${after.attempts} calls=${after.calls} drafts=${after.drafts}`);
    check(after.attempts === BASE.attempts, `attempts restored ${BASE.attempts}`);
    check(after.calls === BASE.calls, `calls restored ${BASE.calls}`);
    check(after.drafts === BASE.drafts, `drafts restored ${BASE.drafts}`);
    check((leftovers?.length ?? 0) === 0, "probe rows remaining = 0");
  }

  console.log(`\n${failures === 0 ? "ALL CHECKS PASSED" : `${failures} CHECK(S) FAILED`}`);
  process.exit(failures === 0 ? 0 : 1);
}

void main();
