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
import { resolveUserTzContext } from "@/lib/bty/daily/userDay";
import { userDayStartInstant } from "@/domain/daily/userDayStartInstant";
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
 * Redemption is now ONE call to `bty_foundry_redeem_completion_claim`, which invokes the same four
 * plpgsql authorities in-process so they share its transaction. This file performs NO mutation
 * after it: everything below the RPC is read-only preparation above it.
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
  | { ok: true; progressId: string; eventId: string }
  /** One reason for every refusal. The endpoint must not distinguish them to the caller. */
  | { ok: false; reason: "invalid" };

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
 * ONE REFUSAL REASON, DELIBERATELY. Invalid, expired, already spent, already owned and never
 * existed are indistinguishable from outside — telling them apart would let someone probe which
 * codes are real. The endpoint adds rate limiting; between them a 60-bit code is not guessable.
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
    const { data: prog } = await admin
      .from("foundry_event_training_progress")
      .select("id, event_id, participant_id, completed_at")
      .eq("claim_secret_hash", claimHash)
      .is("linked_user_id", null)
      .is("claim_consumed_at", null)
      .maybeSingle<{ id: string; event_id: string; participant_id: string; completed_at: string | null }>();
    if (!prog?.completed_at) return { ok: false, reason: "invalid" };

    const { data: participant } = await admin
      .from("foundry_event_participants")
      .select("user_id")
      .eq("id", prog.participant_id)
      .maybeSingle<{ user_id: string | null }>();
    if (!mayAttributeToAccount(participant?.user_id ?? null, authUserId)) return { ok: false, reason: "invalid" };

    const { data: ev } = await admin
      .from("foundry_events")
      .select("title, owner_user_id")
      .eq("id", prog.event_id)
      .maybeSingle<{ title: string | null; owner_user_id: string | null }>();
    const title = (ev?.title ?? "Foundry training").trim().slice(0, 120) || "Foundry training";

    const { data: mod } = await admin
      .from("foundry_event_module")
      .select("module_snapshot")
      .eq("event_id", prog.event_id)
      .maybeSingle<{ module_snapshot: { followUpDays?: unknown; realityGroundedJourneyV1?: unknown } | null }>();

    const { data: asn } = await admin
      .from("foundry_event_assignments")
      .select("id, organization_id")
      .eq("event_id", prog.event_id)
      .eq("user_id_snapshot", authUserId)
      .maybeSingle<{ id: string; organization_id: string | null }>();

    /*
      Apply eligibility WITHOUT reading the learner's decision: the predicate lives in the query,
      so only the row id comes back.
    */
    const { data: hasDecision } = await admin
      .from("foundry_event_training_progress")
      .select("id")
      .eq("id", prog.id)
      .not("decision_response_text", "is", null)
      .neq("decision_response_text", "")
      .maybeSingle<{ id: string }>();

    const { timezone } = await resolveUserTzContext(admin, authUserId, deviceTz ?? null);

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
    const dayStart = userDayStartInstant(new Date(nowMs), timezone, 5);
    const dayEnd = userDayStartInstant(new Date(dayStart.getTime() + 86_400_000 + 1), timezone, 5);

    // --- the one write --------------------------------------------------------
    const { data, error } = await admin.rpc("bty_foundry_redeem_completion_claim", {
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
    const row = Array.isArray(data) ? data[0] : null;
    if (error || !row) return { ok: false, reason: "invalid" };
    return { ok: true, progressId: row.progress_id as string, eventId: row.event_id as string };
  } catch {
    return { ok: false, reason: "invalid" };
  }
}
