import { describe, it, expect, vi } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  CLAIM_CODE_ENTROPY_BITS,
  CLAIM_CODE_SYMBOLS,
  CLAIM_CODE_TTL_DAYS,
  claimCodeExpiresAt,
  claimHashEquals,
  formatClaimCodeForDisplay,
  generateClaimCode,
  hashClaimCode,
  normalizeClaimCode,
} from "./completion-claim-code";

/**
 * DEFERRED COMPLETION CLAIM V1 — the credential, and the refusals that make it safe.
 *
 * MEASURED CAUSE. An anonymous learner's only route back to their own completion was the
 * participant session: 256-bit and hash-at-rest, but `HttpOnly`, 30 days, one device — and by
 * design unshowable. On 2026-08-26: 45 completions, 15 linked, 30 unclaimed. The cryptography was
 * never the problem; the transport was.
 *
 * WHY A SEPARATE SECRET. The session token authenticates a PARTICIPANT — whoever holds it
 * re-enters the room as that person and reads their own answers. A claim code proves one thing,
 * "I finished this", and can do nothing else. Reusing the session token would have turned a claim
 * artifact into a private-content bearer token.
 *
 * THE ENTROPY ARGUMENT IS HALF A LIMIT. 60 bits only holds because the endpoint caps attempts;
 * both halves are asserted below, the second by reading the route.
 */

const read = (p: string) => readFileSync(join(process.cwd(), p), "utf8");

describe("[claim code · T1-T4] the credential", () => {
  it("carries the specified entropy, calculated not asserted", () => {
    expect(CLAIM_CODE_SYMBOLS).toBe(12);
    // Crockford Base32 minus the checksum symbol: 32 symbols → exactly 5 bits each, no bias.
    expect(CLAIM_CODE_ENTROPY_BITS).toBe(60);
    expect(CLAIM_CODE_ENTROPY_BITS).toBeGreaterThanOrEqual(60);
  });

  it("generates codes from the safe alphabet only, and does not repeat", () => {
    const seen = new Set<string>();
    for (let i = 0; i < 500; i++) {
      const c = generateClaimCode();
      expect(c).toMatch(/^[0-9A-HJKMNP-TV-Z]{12}$/); // no I, L, O, U
      seen.add(c);
    }
    expect(seen.size).toBe(500);
  });

  it("normalises what a person actually types", () => {
    const code = generateClaimCode();
    const display = formatClaimCodeForDisplay(code);
    expect(display).toMatch(/^.{4}-.{4}-.{4}$/);
    expect(normalizeClaimCode(display)).toBe(code);
    expect(normalizeClaimCode(display.toLowerCase())).toBe(code);
    expect(normalizeClaimCode(` ${display} `)).toBe(code);
    // The three Crockford confusables map rather than fail.
    expect(normalizeClaimCode("IL0O123456789".slice(0, 12))?.startsWith("110")).toBe(true);
  });

  it("refuses anything that cannot be a code, rather than padding a guess", () => {
    for (const bad of ["", "SHORT", "0".repeat(11), "0".repeat(13), null, undefined, 12, {}]) {
      expect(normalizeClaimCode(bad as unknown), String(bad)).toBeNull();
    }
  });

  it("hashes one way, and compares in constant time", () => {
    const code = generateClaimCode();
    const h = hashClaimCode(code);
    expect(h).toMatch(/^[0-9a-f]{64}$/);
    expect(h).not.toContain(code);
    expect(claimHashEquals(h, hashClaimCode(code))).toBe(true);
    expect(claimHashEquals(h, hashClaimCode(generateClaimCode()))).toBe(false);
  });

  it("expires 90 days out, single use", () => {
    expect(CLAIM_CODE_TTL_DAYS).toBe(90);
    const from = new Date("2026-01-01T00:00:00.000Z");
    expect(claimCodeExpiresAt(from)).toBe("2026-04-01T00:00:00.000Z");
  });
});

// ---------------------------------------------------------------------------
// The refusals, read where they are actually enforced
// ---------------------------------------------------------------------------

const MIGRATION = read("supabase/migrations/20260827000000_foundry_deferred_completion_claim_v1.sql");
const SERVICE = read("src/lib/bty/foundry/events/completionClaimService.ts");
const ROUTE = read("src/app/api/bty/foundry/completion-claim/route.ts");

describe("[claim · T5-T9] every precondition is in the one atomic statement", () => {
  it("ownership and consumption are separate statements, with the work between them", () => {
    /*
      RETARGETED BY V1-R1. This asserted that ownership and consumption were ONE statement, which
      is exactly the defect: the credential was spent before a single downstream step ran, so a
      failure left partial state and a code that could never be retried. What must hold now is the
      opposite — ownership first, every required effect, consumption last. The predicates that make
      the claim safe moved into the locking SELECT and are asserted in FI-7 and FI-9/10.
    */
    const fn = MIGRATION.slice(MIGRATION.indexOf("create or replace function public.bty_foundry_redeem_completion_claim"));
    expect(fn).toContain("set linked_user_id = p_user_id");
    expect(fn).toContain("set claim_consumed_at = now()");
    expect(fn.indexOf("set claim_consumed_at = now()")).toBeGreaterThan(fn.indexOf("set linked_user_id = p_user_id"));
  });

  it("the active-claim index is unique, so two completions cannot share a secret", () => {
    expect(MIGRATION).toContain("create unique index if not exists foundry_progress_active_claim_hash_uidx");
    expect(MIGRATION).toContain("where claim_secret_hash is not null and claim_consumed_at is null");
  });

  it("the migration is forward-only: nullable, no default, no backfill", () => {
    expect(MIGRATION).toContain("add column if not exists claim_secret_hash text");
    // Scanned on the STATEMENTS, not the prose: the header explains why there is no default.
    const sql = MIGRATION.split("\n").filter((l) => !l.trim().startsWith("--")).join("\n");
    expect(sql).not.toMatch(/add column[^;]*default/i);
    expect(MIGRATION.toLowerCase()).not.toContain("update public.foundry_event_training_progress\n   set claim_secret_hash");
    expect(MIGRATION.toLowerCase()).not.toContain("insert into");
  });

  it("the RPC is service_role only", () => {
    expect(MIGRATION).toContain("revoke all on function public.bty_foundry_redeem_completion_claim(");
    expect(MIGRATION).toContain(") from public, anon, authenticated;");
    expect(MIGRATION).toContain(") to service_role;");
    // The superseded two-argument form is dropped rather than left callable alongside it.
    expect(MIGRATION).toContain("drop function if exists public.bty_foundry_redeem_completion_claim(text, uuid);");
  });

  it("issuance happens only for a completed, unowned, un-issued progress", () => {
    for (const guard of [
      '.not("completed_at", "is", null)',
      '.is("linked_user_id", null)',
      '.is("claim_secret_hash", null)',
    ]) {
      expect(SERVICE, guard).toContain(guard);
    }
  });
});

describe("[claim · FI] the whole claim is one transaction, or none of it", () => {
  const FN = MIGRATION.slice(MIGRATION.indexOf("create or replace function public.bty_foundry_redeem_completion_claim"));

  it("FI-1 every required effect happens inside the one function", () => {
    // The four authorities are invoked IN-PROCESS, so they share this function's transaction.
    for (const nested of [
      "public.bty_foundry_claim_assignment(",
      "public.bty_foundry_materialize_followup(",
      "public.bty_foundry_materialize_apply_window(",
      "public.bty_foundry_award_daily_capped(",
    ]) {
      expect(FN, nested).toContain(nested);
    }
    // …and the service performs NO mutation after the call. This is the whole correction.
    const afterRpc = SERVICE.slice(SERVICE.indexOf('admin.rpc("bty_foundry_redeem_completion_claim"'));
    for (const mutation of ["materializeFollowupObligation", "materializeApplyWindow", "claimAssignmentForParticipant", "awardTrainingCoreXp", ".update("]) {
      expect(afterRpc, mutation).not.toContain(mutation);
    }
  });

  it("FI-2/3/4/5 an unexpected nested result RAISES, so the whole claim rolls back", () => {
    /*
      A `skipped` from a materializer that was told an obligation is owed means the claim did NOT
      converge. Accepting it would reproduce the six-transaction defect one level down: linked,
      consumed, and missing the thing the contract promised.
    */
    expect(FN).toContain("raise exception 'claim_followup_unexpected: %'");
    expect(FN).toContain("raise exception 'claim_apply_unexpected: %'");
    expect(FN).toContain("if v_result is distinct from 'created' and v_result is distinct from 'exists' then");
    // XP has different truthful non-awards (daily_limit / already_awarded) and must NOT raise.
    expect(FN).not.toContain("raise exception 'claim_xp");
  });

  it("FI-6 consumption is last, so a rolled-back claim leaves the code usable", () => {
    const ownership = FN.indexOf("set linked_user_id = p_user_id");
    const consume = FN.indexOf("set claim_consumed_at = now()");
    const followup = FN.indexOf("bty_foundry_materialize_followup(");
    const apply = FN.indexOf("bty_foundry_materialize_apply_window(");
    const xp = FN.indexOf("bty_foundry_award_daily_capped(");
    expect(ownership).toBeGreaterThan(-1);
    for (const step of [followup, apply, xp]) expect(step).toBeGreaterThan(ownership);
    // Every required effect precedes consumption.
    for (const step of [followup, apply, xp]) expect(consume).toBeGreaterThan(step);
    // And consumption is no longer part of the ownership statement, which is what V1 got wrong.
    expect(FN).not.toMatch(/set\s+linked_user_id\s*=\s*p_user_id,\s*\n?\s*claim_consumed_at/);
  });

  it("FI-7 concurrency is decided by the row lock, once", () => {
    expect(FN).toContain("for update;");
    for (const predicate of [
      "p.claim_secret_hash = p_claim_hash",
      "p.completed_at is not null",
      "p.linked_user_id is null",
      "p.claim_consumed_at is null",
      "p.claim_secret_expires_at > now()",
    ]) {
      expect(FN, predicate).toContain(predicate);
    }
    // A loser finds nothing and returns before any write.
    expect(FN).toContain("if v_progress_id is null then");
  });

  it("FI-8 cross-account refusal happens before any mutation", () => {
    const guard = FN.indexOf("if v_participant_user is not null and v_participant_user <> p_user_id then");
    const firstUpdate = FN.indexOf("update public.foundry_event_training_progress");
    expect(guard).toBeGreaterThan(-1);
    expect(guard).toBeLessThan(firstUpdate);
    // Same semantics as mayAttributeToAccount: anonymous is never a conflict, no Host override.
    expect(FN).toContain("v_participant_user is not null");
    expect(SERVICE).toContain("mayAttributeToAccount");
  });

  it("FI-9/10 expired and already-consumed codes never reach a write", () => {
    const select = FN.indexOf("from public.foundry_event_training_progress p");
    const firstUpdate = FN.indexOf("update public.foundry_event_training_progress");
    expect(select).toBeLessThan(firstUpdate);
    expect(FN.slice(select, firstUpdate)).toContain("p.claim_secret_expires_at > now()");
    expect(FN.slice(select, firstUpdate)).toContain("p.claim_consumed_at is null");
  });

  it("the service prepares by READING only, and writes exactly once", () => {
    const before = SERVICE.slice(SERVICE.indexOf("export async function redeemCompletionClaim"), SERVICE.indexOf('admin.rpc("bty_foundry_redeem_completion_claim"'));
    for (const mutation of [".update(", ".insert(", ".upsert(", ".delete("]) {
      expect(before, mutation).not.toContain(mutation);
    }
    expect((SERVICE.match(/admin\.rpc\(/g) ?? []).length).toBe(1);
  });

  it("the learner's decision text is never selected, only predicated on", () => {
    expect(SERVICE).toContain('.not("decision_response_text", "is", null)');
    expect(SERVICE).not.toContain('.select("decision_response_text")');
    expect(SERVICE).not.toContain("decision_response_text as");
  });

  it("a completion linked through the room retires any outstanding code", () => {
    expect(SERVICE).toContain("export async function invalidateDeferredClaim");
    for (const f of ["foundryGuidanceService", "foundryTrainingService", "foundryDocumentService"]) {
      const src = read(`src/lib/bty/foundry/events/${f}.ts`);
      expect(src, f).toContain("await invalidateDeferredClaim(admin, prog.id);");
    }
  });

  it("T13 anonymous completion still materialises no Apply and no follow-up", () => {
    for (const f of ["foundryGuidanceService", "foundryTrainingService", "foundryDocumentService"]) {
      const src = read(`src/lib/bty/foundry/events/${f}.ts`);
      expect(src, f).toContain("if (linkableUserId) {\n    await materializeFollowupObligation(admin, {");
      expect(src, f).toContain("const deferredClaim = linkableUserId ? null : await issueCompletionClaim(admin, progressId);");
    }
  });

  it("all three room families issue and surface the code identically", () => {
    for (const f of ["FoundryGuidanceClient", "FoundryJoinClient", "FoundryDocumentClient"]) {
      const src = read(`src/app/f/[token]/${f}.tsx`);
      expect(src, f).toContain('data-testid="terminal-claim-code"');
      expect(src, f).toContain("formatClaimCodeForDisplay(claimCode)");
      expect(src, f).toContain("claimCodeCopy(locale)");
    }
  });
});

describe("[claim · T15-T18] the endpoint", () => {
  it("T17 is rate limited by account, and the limit is what the entropy argument rests on", () => {
    expect(ROUTE).toContain("rateLimitKV");
    expect(ROUTE).toContain('endpoint: "foundry_completion_claim"');
    expect(ROUTE).toContain("limit: 10");
    expect(ROUTE).toContain("identifier: `${user.id}:${getCfClientIp(req)}`");
  });

  it("requires an authenticated, consented account", () => {
    expect(ROUTE).toContain('return priv({ ok: false, error: "unauthenticated" }, 401)');
    expect(ROUTE).toContain("isConsentCurrent");
  });

  it("gives one refusal reason, so it cannot be used as an oracle", () => {
    expect(SERVICE).toContain('reason: "invalid"');
    for (const leak of ["expired", "consumed", "already_linked", "not_found"]) {
      expect(ROUTE, leak).not.toContain(`error: "${leak}"`);
    }
    expect(ROUTE).toContain('error: "invalid"');
  });

  it("T18 no learner response text crosses the claim route", () => {
    for (const priv of ["response_text", "decision_response_text", "learner_reflection_text", "shared_understanding_response"]) {
      expect(ROUTE, priv).not.toContain(priv);
    }
    /*
      The SERVICE names `decision_response_text` exactly once, and only inside a PREDICATE — Apply
      eligibility depends on whether a decision exists, and asking the database that question is
      not the same as reading it. The "never selected" assertion below is what keeps them apart.
    */
    const selects = [...SERVICE.matchAll(/\.select\(\s*"([^"]*)"/g)].map((m) => m[1]);
    expect(selects.length).toBeGreaterThan(0);
    for (const list of selects) {
      for (const priv of ["response_text", "reflection", "shared_understanding"]) {
        expect(list, `${list} must not select ${priv}`).not.toContain(priv);
      }
    }
  });

  it("T3/T23 the raw code is never stored, logged or serialised", () => {
    expect(SERVICE).not.toContain("console.log");
    expect(SERVICE).not.toContain("console.error");
    expect(ROUTE).not.toContain("console.");
    // Only the hash is written.
    expect(SERVICE).toContain("claim_secret_hash: hashClaimCode(code)");
    expect(SERVICE).not.toMatch(/claim_secret\s*:\s*code/);
  });
});

describe("[claim · T24] the door is where the result appears", () => {
  it("one permanent entry, in My Learning", () => {
    const ml = read("src/components/foundry/event-rooms/FoundryMyLearning.tsx");
    expect(ml).toContain('data-testid="my-learning-claim"');
    expect(ml).toContain("/api/bty/foundry/completion-claim");
    // Success reloads the list, which is the canonical destination for a claimed training.
    expect(ml).toContain("await load();");
    // T22 — both languages, no internal vocabulary.
    expect(ml).toContain("완료한 학습 가져오기");
    expect(ml).toContain("Add a training you finished");
    for (const internal of ["progress", "participant", "lineage", "claim-xp"]) {
      expect(ml.slice(ml.indexOf("claimTitle"), ml.indexOf("claimBad") + 400), internal).not.toContain(internal);
    }
  });

  it("no second door was added", () => {
    const others = ["src/components/foundry/event-rooms/LearnDoors.tsx", "src/components/app-shell/MeEntries.tsx"];
    for (const p of others) expect(read(p), p).not.toContain("completion-claim");
  });
});

void vi;
