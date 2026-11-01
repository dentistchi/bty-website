import type { SupabaseClient } from "@supabase/supabase-js";
import {
  generateClaimCode,
  hashClaimCode,
  claimCodeExpiresAt,
  normalizeClaimCode,
} from "./completion-claim-code";
import { isFollowUpDays, computeFollowUpDue } from "@/domain/foundry/followup/followUpObligation";
import { journeyActionDecision } from "@/domain/foundry/module/journey";
import { computeApplyWindow, APPLY_WINDOW_DAYS } from "@/domain/foundry/apply-window/applyWindow";
import { userDayWindow } from "@/domain/daily/userDayWindow";
import { parseFoundryAwardAcknowledgement, readFoundryRewardTimezone, syncFoundryAvatarAfterAward, foundryOutcomeToXpStatus, type FoundryXpStatus } from "./foundryXpAtomic.server";
import { FOUNDRY_TRAINING_XP } from "@/domain/foundry/events/foundry-training";
import { mayAttributeToAccount } from "@/domain/foundry/events/participant-account";

/**
 * DEFERRED COMPLETION CLAIM — issuing the credential, and spending it.
 *
 * WHAT THIS SLICE DOES NOT REBUILD. The forward rule is already shipped and correct: an anonymous
 * completion materialises no Apply window and no learner follow-up, because all three room
 * services guard that work behind `if (linkableUserId)` and `materializeFollowupObligation`
 * refuses a null user on its own. Redemption below therefore performs exactly the same sequence
 * the ROOM claim path already performs, in the same order, through the same functions — a second
 * XP or Apply idempotency system is the thing most likely to go wrong here, so none is written.
 *
 * ONE TRANSACTION, CORRECTED (V1-R1). This first shipped as an ownership UPDATE followed by four
 * service calls — six transactions. A downstream failure left the completion linked, the code
 * spent, and the same code refused on retry: partial state that only the 30-day same-device room
 * path could repair, which is precisely the population this feature does not serve. Idempotent
 * downstream functions cannot rescue an operation that can never be retried.
 *
 * Redemption is ONE call to `bty_foundry_redeem_completion_claim_atomic`, which reuses the shipped
 * claim authorities with their ledger-only XP path disabled, then commits Core and both receipts
 * in the outer transaction. Preparation is strictly read-only. There is no claim/reward mutation
 * after it; only a best-effort derived avatar refresh may run after a fresh committed receipt.
 */

/** What the terminal needs in order to show the learner something they can keep. */
export type IssuedClaim = { code: string; expiresAt: string };

/**
 * Mint a claim code for a completion nobody owns yet.
 *
 * Returns null — not an error — for every case where a code would be wrong to hand out: the
 * completion already belongs to an account, one was already issued, or the write did not take.
 * Fail-soft on purpose: a learner has finished their training, and a credential problem must
 * never turn that into a failed completion.
 */
export async function issueCompletionClaim(
  admin: SupabaseClient,
  progressId: string,
): Promise<IssuedClaim | null> {
  if (!progressId) return null;
  try {
    const code = generateClaimCode();
    const expiresAt = claimCodeExpiresAt();
    const { data, error } = await admin
      .from("foundry_event_training_progress")
      .update({ claim_secret_hash: hashClaimCode(code), claim_secret_expires_at: expiresAt })
      .eq("id", progressId)
      .not("completed_at", "is", null)
      .is("linked_user_id", null)
      .is("claim_secret_hash", null)
      .select("id");
    if (error || !data || data.length === 0) return null;
    return { code, expiresAt };
  } catch {
    return null;
  }
}

/**
 * Retire a deferred code because the completion just became owned by another route.
 *
 * The room's own `claim-xp` path can link a completion at any time inside the participant-session
 * window. When it does, a written-down code is still out there pointing at a completion that now
 * has an owner — so it is consumed here rather than left to expire. Fail-soft: the linkage that
 * just happened is the important part.
 */
export async function invalidateDeferredClaim(admin: SupabaseClient, progressId: string): Promise<void> {
  if (!progressId) return;
  try {
    await admin
      .from("foundry_event_training_progress")
      .update({ claim_consumed_at: new Date().toISOString() })
      .eq("id", progressId)
      .not("claim_secret_hash", "is", null)
      .is("claim_consumed_at", null);
  } catch {
    /* the completion is linked; a stale credential row is not worth failing that */
  }
}


export type RedeemResult =
  | { ok: true; progressId: string; eventId: string; xpStatus: FoundryXpStatus }
  /** Credential refusals remain indistinguishable; infrastructure/review never assert payment. */
  | { ok: false; reason: "invalid" | "unavailable" | "review_required" };

/**
 * Spend a claim code on behalf of a signed-in account.
 *
 * READ, THEN ONE WRITE. Everything before the RPC is a read: which completion the hash points at,
 * what the Host froze into the module, whether an assignment exists, the learner's timezone and
 * the day arithmetic. None of it mutates anything, so a code consumed by someone else between the
 * read and the call simply fails the RPC's predicate and nothing commits.
 *
 * ELIGIBILITY IS DECIDED HERE, ENFORCED THERE. A null `follow_up_days` or `apply_days` tells the
 * transaction this training owes no such obligation; anything else and the RPC refuses the whole
 * claim unless the materializer reports `created` or `exists`.
 *
 * PRIVATE TEXT IS NEVER SELECTED. The Apply window depends on whether the learner recorded a
 * decision, so this asks the database for the row's ID under a non-empty predicate rather than
 * reading `decision_response_text` into the claim path.
 *
 * Invalid, expired and foreign-account credentials remain indistinguishable. An identical owned
 * claim may replay only its frozen receipt inside the original expiry. Infrastructure failures
 * and ambiguous historical XP are not successful claims or assertions that a credential is bad.
 * The endpoint retains rate limiting and never exposes the raw database error.
 */
export async function redeemCompletionClaim(
  admin: SupabaseClient,
  rawCode: unknown,
  authUserId: string,
  deviceTz?: string | null,
): Promise<RedeemResult> {
  const normalized = normalizeClaimCode(rawCode);
  if (!normalized || !authUserId) return { ok: false, reason: "invalid" };
  const claimHash = hashClaimCode(normalized);

  try {
    // --- read-only preparation ------------------------------------------------
    const { data: prog, error: progressError } = await admin
      .from("foundry_event_training_progress")
      .select("id, event_id, participant_id, completed_at, linked_user_id, claim_secret_expires_at")
      .eq("claim_secret_hash", claimHash)
      .maybeSingle<{ id: string; event_id: string; participant_id: string; completed_at: string | null; linked_user_id: string | null; claim_secret_expires_at: string | null }>();
    if (progressError) return { ok: false, reason: "unavailable" };
    if (!prog?.completed_at || (prog.linked_user_id !== null && prog.linked_user_id !== authUserId)
      || !prog.claim_secret_expires_at || Date.parse(prog.claim_secret_expires_at) <= Date.now()) return { ok: false, reason: "invalid" };

    const { data: participant, error: participantError } = await admin
      .from("foundry_event_participants")
      .select("user_id")
      .eq("id", prog.participant_id)
      .maybeSingle<{ user_id: string | null }>();
    if (participantError) return { ok: false, reason: "unavailable" };
    if (!participant) return { ok: false, reason: "invalid" };
    if (!mayAttributeToAccount(participant?.user_id ?? null, authUserId)) return { ok: false, reason: "invalid" };

    const { data: ev, error: eventError } = await admin
      .from("foundry_events")
      .select("title, owner_user_id")
      .eq("id", prog.event_id)
      .maybeSingle<{ title: string | null; owner_user_id: string | null }>();
    if (eventError) return { ok: false, reason: "unavailable" };
    if (!ev?.owner_user_id) return { ok: false, reason: "invalid" };
    const title = (ev?.title ?? "Foundry training").trim().slice(0, 120) || "Foundry training";

    const { data: mod, error: moduleError } = await admin
      .from("foundry_event_module")
      .select("module_snapshot")
      .eq("event_id", prog.event_id)
      .maybeSingle<{ module_snapshot: { followUpDays?: unknown; realityGroundedJourneyV1?: unknown } | null }>();
    if (moduleError) return { ok: false, reason: "unavailable" };

    const { data: asn, error: assignmentError } = await admin
      .from("foundry_event_assignments")
      .select("id, organization_id")
      .eq("event_id", prog.event_id)
      .eq("user_id_snapshot", authUserId)
      .neq("status", "revoked")
      .maybeSingle<{ id: string; organization_id: string | null }>();
    if (assignmentError) return { ok: false, reason: "unavailable" };

    /*
      Apply eligibility WITHOUT reading the learner's decision: the predicate lives in the query,
      so only the row id comes back.
    */
    const { data: hasDecision, error: decisionError } = await admin
      .from("foundry_event_training_progress")
      .select("id")
      .eq("id", prog.id)
      .not("decision_response_text", "is", null)
      .neq("decision_response_text", "")
      .maybeSingle<{ id: string }>();
    if (decisionError) return { ok: false, reason: "unavailable" };

    const timezone = await readFoundryRewardTimezone(admin, authUserId, deviceTz ?? null);

    const followUpDays = mod?.module_snapshot?.followUpDays;
    const fu = isFollowUpDays(followUpDays)
      ? computeFollowUpDue(prog.completed_at, timezone, followUpDays)
      : null;

    const applyEligible =
      !!hasDecision && journeyActionDecision(mod?.module_snapshot?.realityGroundedJourneyV1 as never);
    const ap = applyEligible ? computeApplyWindow(prog.completed_at, timezone) : null;

    const xpEligible = !!ev?.owner_user_id && ev.owner_user_id !== authUserId;
    /*
      The BTY-day window the XP cap is measured in. Same 05:00 anchor and same helper the room
      path uses; recomputed here rather than imported because that helper is file-private.
    */
    const nowMs = Date.now();
    const { start: dayStart, end: dayEnd } = userDayWindow(new Date(nowMs), timezone, 5);

    // --- the one write --------------------------------------------------------
    const { data, error } = await admin.rpc("bty_foundry_redeem_completion_claim_atomic", {
      p_claim_hash: claimHash,
      p_user_id: authUserId,
      p_timezone: timezone,
      p_source_training_title: title,
      p_assignment_id: asn?.id ?? null,
      p_organization_id: asn?.organization_id ?? null,
      p_follow_up_days: fu ? (followUpDays as number) : null,
      p_fu_completion_bty_day: fu?.completionBtyDay ?? null,
      p_fu_due_bty_day: fu?.dueBtyDay ?? null,
      p_fu_due_at: fu?.dueAtIso ?? null,
      p_apply_days: ap ? APPLY_WINDOW_DAYS : null,
      p_ap_completion_bty_day: ap?.completionBtyDay ?? null,
      p_ap_due_bty_day: ap?.dueBtyDay ?? null,
      p_ap_due_at: ap?.dueAtIso ?? null,
      p_xp: FOUNDRY_TRAINING_XP,
      p_xp_eligible: xpEligible,
      p_day_start: dayStart.toISOString(),
      p_day_end: dayEnd.toISOString(),
    });
    if (error) return { ok: false, reason: error.message === "FOUNDRY_XP_REVIEW_REQUIRED" ? "review_required" : "unavailable" };
    if (data?.outcome === "invalid") return { ok: false, reason: "invalid" };
    if (!data || Array.isArray(data) || data.policyVersion !== "foundry-claim-atomic/v1"
      || data.progressId !== prog.id || data.eventId !== prog.event_id || typeof data.replayed !== "boolean"
      || typeof data.claimReceiptId !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(data.claimReceiptId)
      || typeof data.expiresAt !== "string" || !Number.isFinite(Date.parse(data.expiresAt))
      || Date.parse(data.expiresAt) > Date.parse(prog.claim_secret_expires_at)
      || Date.parse(data.expiresAt) <= Date.now()) return { ok: false, reason: "unavailable" };
    const xp = parseFoundryAwardAcknowledgement(data.xp, { userId: authUserId, eventId: prog.event_id, progressId: prog.id });
    if (!xp) return { ok: false, reason: "unavailable" };
    if (xp.outcome === "review_required") return { ok: false, reason: "review_required" };
    syncFoundryAvatarAfterAward(admin, xp, data.replayed);
    return { ok: true, progressId: prog.id, eventId: prog.event_id, xpStatus: foundryOutcomeToXpStatus(xp.outcome) };
  } catch {
    return { ok: false, reason: "unavailable" };
  }
}
