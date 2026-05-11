import type { SupabaseClient } from "@supabase/supabase-js";
import type { FingerprintInput } from "./fingerprint";
import { buildArchetypeFingerprint, FINGERPRINT_VERSION } from "./fingerprint";
import { selectArchetype } from "./selector";
import { checkTransitionEligibility } from "./transition";
import type { EvidenceContext } from "./earnedNaming";
import { isEarnedNamingEligible, ENTRY_THRESHOLD, EXIT_THRESHOLD } from "./earnedNaming";
import { getSupabaseAdmin } from "../../supabase-admin";

const MAX_RETRIES = 3;

// ── Types ─────────────────────────────────────────────────────────────────────

export type ArchetypeLockRow = {
  id: string;
  archetype_name: string;
  archetype_class: string;
  input_hash: string;
  locked_at: string;
  scenarios_completed_at_lock: number;
  contracts_completed_at_lock: number;
};

export type ResolveArchetypeResult =
  | {
      ok: true;
      source: "cached_match" | "transition_blocked" | "newly_locked";
      archetypeName: string;
      archetypeClass: string;
      blockReason?: string;
    }
  | {
      ok: true;
      source: "pattern_forming";
      progress: EvidenceContext;
      threshold: typeof ENTRY_THRESHOLD | typeof EXIT_THRESHOLD;
    }
  | { ok: false; error: string; code: "ARCHETYPE_LOCK_RETRY_EXHAUSTED" | "DB_ERROR" };

export class ArchetypeLockExhaustedError extends Error {
  readonly userId: string;
  readonly inputHash: string;
  readonly attempts: number;
  readonly cause: unknown;

  constructor(params: { userId: string; inputHash: string; attempts: number; lastError: unknown }) {
    super(
      `bty_create_archetype_lock: exhausted ${params.attempts} retries for user ${params.userId}`,
    );
    this.name = "ArchetypeLockExhaustedError";
    this.userId = params.userId;
    this.inputHash = params.inputHash;
    this.attempts = params.attempts;
    this.cause = params.lastError;
  }
}

// ── DB helpers ────────────────────────────────────────────────────────────────

async function findActiveLockByHash(
  supabase: SupabaseClient,
  userId: string,
  inputHash: string,
): Promise<ArchetypeLockRow | null> {
  const { data, error } = await supabase
    .from("bty_archetype_naming_locks")
    .select(
      "id, archetype_name, archetype_class, input_hash, locked_at, scenarios_completed_at_lock, contracts_completed_at_lock",
    )
    .eq("user_id", userId)
    .eq("input_hash", inputHash)
    .is("superseded_at", null)
    .maybeSingle();
  if (error) throw error;
  return (data as ArchetypeLockRow | null);
}

async function findCurrentActiveLock(
  supabase: SupabaseClient,
  userId: string,
): Promise<ArchetypeLockRow | null> {
  const { data, error } = await supabase
    .from("bty_archetype_naming_locks")
    .select(
      "id, archetype_name, archetype_class, input_hash, locked_at, scenarios_completed_at_lock, contracts_completed_at_lock",
    )
    .eq("user_id", userId)
    .is("superseded_at", null)
    .maybeSingle();
  if (error) throw error;
  return (data as ArchetypeLockRow | null);
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Resolves the archetype for a user, enforcing determinism lock v1.
 *
 * Each attempt:
 *  (A) Cache re-read by hash — race winner's lock terminates the loop.
 *  (B) Current active lock re-read — supersede target.
 *  (C) Transition gate — ineligible → return current lock, no write.
 *  (D) Selector — deterministic archetype choice.
 *  (E) RPC — atomic supersede + insert; 23P01 → retry; other errors → throw.
 *
 * Throws ArchetypeLockExhaustedError after MAX_RETRIES consecutive 23P01s.
 */
export async function resolveArchetypeForUser(
  supabase: SupabaseClient,
  userId: string,
  input: FingerprintInput,
): Promise<ResolveArchetypeResult> {
  let inputHash: string;
  let canonicalForm: string;

  try {
    ({ inputHash, canonicalForm } = await buildArchetypeFingerprint(input));
  } catch (e) {
    return { ok: false, error: String(e), code: "DB_ERROR" };
  }

  // (A0) Earned Naming gate — §7.1 PATTERN_FORMING Response Contract.
  // Runs once before the retry loop; DB not written if threshold not met.
  const evidence: EvidenceContext = {
    scenariosCompleted: input.scenariosCompleted,
    contractsCompleted: input.contractsCompleted,
  };
  let hasExistingLock: boolean;
  try {
    const existing = await findCurrentActiveLock(supabase, userId);
    hasExistingLock = existing !== null;
  } catch (e) {
    return { ok: false, error: String(e), code: "DB_ERROR" };
  }
  const eligibility = isEarnedNamingEligible(evidence, hasExistingLock);
  if (!eligibility.eligible) {
    return {
      ok: true,
      source: "pattern_forming",
      progress: evidence,
      threshold: eligibility.threshold,
    };
  }

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    // (A) Cache re-read by hash — if a concurrent request already created this exact
    //     lock, return it immediately without writing again.
    let cached: ArchetypeLockRow | null;
    try {
      cached = await findActiveLockByHash(supabase, userId, inputHash);
    } catch (e) {
      return { ok: false, error: String(e), code: "DB_ERROR" };
    }
    if (cached) {
      return {
        ok: true,
        archetypeName: cached.archetype_name,
        archetypeClass: cached.archetype_class,
        source: "cached_match",
      };
    }

    // (B) Current active lock — supersede target + transition gate input.
    let currentLock: ArchetypeLockRow | null;
    try {
      currentLock = await findCurrentActiveLock(supabase, userId);
    } catch (e) {
      return { ok: false, error: String(e), code: "DB_ERROR" };
    }

    // (C) Transition gate.
    if (currentLock) {
      const eligibility = checkTransitionEligibility(
        currentLock.archetype_name,
        currentLock.locked_at,
        input.axisVector,
      );
      if (!eligibility.eligible) {
        return {
          ok: true,
          archetypeName: currentLock.archetype_name,
          archetypeClass: currentLock.archetype_class,
          source: "transition_blocked",
          blockReason: eligibility.reason,
        };
      }
    }

    // (D) Selector — throws SelectorInvariantError when axis is outside all rule thresholds (AL-1.7).
    let selection;
    try {
      selection = selectArchetype(input.axisVector);
    } catch (e) {
      return { ok: false, error: String(e), code: "DB_ERROR" };
    }

    // (E) RPC — service role client required (public execute revoked, §9 Forbidden).
    //     Only 23P01 triggers retry; all other errors throw immediately.
    const adminClient = getSupabaseAdmin();
    if (!adminClient) {
      return {
        ok: false,
        error: "SUPABASE_SERVICE_ROLE_KEY not configured — bty_create_archetype_lock requires service role",
        code: "DB_ERROR",
      };
    }
    try {
      const { data: newId, error: rpcErr } = await adminClient.rpc("bty_create_archetype_lock", {
        p_user_id: userId,
        p_input_hash: inputHash,
        p_fingerprint_version: FINGERPRINT_VERSION,
        p_archetype_name: selection.name,
        p_archetype_class: selection.archetypeClass,
        p_selected_by: selection.selectedBy,
        p_candidate_pool: selection.candidatePool,
        p_selection_reason: selection.selectionReason,
        p_input_snapshot: JSON.parse(canonicalForm) as Record<string, unknown>,
        p_scenarios_completed: input.scenariosCompleted,
        p_contracts_completed: input.contractsCompleted,
      });

      if (rpcErr) {
        const code = (rpcErr as { code?: string }).code;
        const isExclusion =
          code === "23P01" || String(rpcErr.message ?? "").includes("exclusion");

        if (!isExclusion) {
          return { ok: false, error: rpcErr.message, code: "DB_ERROR" };
        }

        // 23P01 on last attempt → named exhaustion error
        if (attempt === MAX_RETRIES - 1) {
          throw new ArchetypeLockExhaustedError({
            userId,
            inputHash,
            attempts: MAX_RETRIES,
            lastError: rpcErr,
          });
        }

        // Continue to next iteration — (A) cache re-read will catch the winner.
        continue;
      }

      void newId; // returned uuid; not needed client-side
      return {
        ok: true,
        archetypeName: selection.name,
        archetypeClass: selection.archetypeClass,
        source: "newly_locked",
      };
    } catch (e) {
      if (e instanceof ArchetypeLockExhaustedError) throw e;
      return { ok: false, error: String(e), code: "DB_ERROR" };
    }
  }

  // Unreachable — TypeScript exhaustiveness guard.
  throw new ArchetypeLockExhaustedError({
    userId,
    inputHash,
    attempts: MAX_RETRIES,
    lastError: new Error("loop_exit_without_result"),
  });
}
