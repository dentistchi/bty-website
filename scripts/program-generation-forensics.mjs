#!/usr/bin/env node
/**
 * PROGRAM GENERATION FORENSICS — the canonical engineering read (Slice 3.2P-R0.2).
 *
 * WHY THIS EXISTS AS A FILE. Every forensic report so far queried the ledger from an ad-hoc
 * script written in the moment, and twice a compact print template silently omitted the field
 * that mattered: once the three dependency columns (leading to a report that the diagnostics
 * were missing when they were recorded and correct), and once the per-call detail behind a
 * repaired attempt. A projection nobody has to remember to write is the fix.
 *
 * It selects EVERY diagnostic column on both tables and prints all of them, so a future
 * omission has to be deliberate rather than accidental.
 *
 * Engineering observability only — not a Founder-facing surface, not imported by the app.
 * Read-only: it issues SELECTs and nothing else.
 *
 *   node scripts/program-generation-forensics.mjs [draftId]
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";

const env = Object.fromEntries(
  readFileSync(".env.local", "utf8")
    .split("\n")
    .filter((l) => l.includes("=") && !l.trim().startsWith("#"))
    .map((l) => [l.slice(0, l.indexOf("=")).trim(), l.slice(l.indexOf("=") + 1).trim()]),
);

/** Every parent column that carries diagnostic meaning. Add here, never to a call site. */
const PARENT_COLS = [
  "id", "draft_id", "submission_intent_id", "proposal_version", "deploy_version", "locale",
  "lifecycle_state", "outcome", "refusal_code", "refusal_kind", "proposal_digest", "applied_at",
  "element_count", "started_at", "finished_at", "duration_ms", "context_fingerprint",
];

/**
 * Every CHILD column that carries diagnostic meaning, including the two added in 3.2P-R0.2.
 * A repaired attempt has two of these rows and they can differ in every one of these fields.
 */
const CALL_COLS = [
  "call_sequence", "call_kind", "lifecycle_state", "outcome",
  "refusal_code", "refusal_kind",
  "validation_stage", "offending_path", "expected_type", "actual_type", "structural_retryable",
  "dependency_branch", "dependency_construct_kind", "dependency_counterpart_kind",
  "behavior_contract_field", "behavior_contract_reason",
  "provider_http_status", "provider_error_category", "finish_reason",
  "prompt_tokens", "completion_tokens", "total_tokens",
  "response_bytes", "response_sha256", "duration_ms",
];

const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const draftId = process.argv[2] ?? null;

let q = db.from("foundry_program_generation_attempts").select(PARENT_COLS.join(", ")).order("started_at");
if (draftId) q = q.eq("draft_id", draftId);
const { data: parents, error } = await q;
if (error) {
  console.error("parent read failed:", error.message);
  process.exit(1);
}

console.log(`=== ${parents.length} parent attempt(s)${draftId ? ` for draft ${draftId.slice(0, 8)}` : ""} ===`);
for (const p of parents) {
  console.log(`\n── ${p.id}  ${String(p.started_at).slice(0, 16)}`);
  for (const c of PARENT_COLS) {
    if (c === "id" || c === "started_at") continue;
    const v = p[c];
    if (v === null || v === undefined) continue;
    console.log(`   ${c}: ${typeof v === "string" && v.length > 100 ? v.slice(0, 100) + "…" : v}`);
  }
  const { data: calls } = await db
    .from("foundry_program_generation_attempt_calls")
    .select(CALL_COLS.join(", "))
    .eq("attempt_id", p.id)
    .order("call_sequence");
  for (const call of calls ?? []) {
    console.log(`   ├─ seq${call.call_sequence} ${call.call_kind} → ${call.outcome}`);
    for (const c of CALL_COLS) {
      if (["call_sequence", "call_kind", "outcome"].includes(c)) continue;
      const v = call[c];
      // NULL is meaningful here — it is how "no semantic refusal" is expressed — but printing
      // every null would bury the signal. Absence in this list means the column was null.
      if (v === null || v === undefined) continue;
      console.log(`   │    ${c}: ${v}`);
    }
  }
}
