import type { SupabaseClient } from "@supabase/supabase-js";
import { isActiveFoundryHost } from "@/lib/bty/foundry/events/foundryHostService";
import { classifyFollowUpDue } from "@/domain/foundry/followup/followUpObligation";
import {
  sortHostAttention,
  type HostAttentionItem,
} from "@/domain/foundry/host-attention/hostAttention";

/**
 * Host Leadership Attention V1 — owner-scoped read projection (Slice 3.1B-3L).
 *
 * Aggregates, for ONE authenticated Foundry Host, the leadership review obligations that today
 * require the Host to open a specific Event Control Room. Read-only: it writes nothing, mints no
 * acknowledgement, and needs NO migration — every category derives from EXISTING durable state and
 * clears through its own existing canonical transition:
 *   FOLLOW_UP_OVERDUE  — foundry_participant_followups.status='PENDING' + classifyFollowUpDue=overdue
 *                        (clears when the learner responds → RESPONDED)
 *   FOLLOW_UP_NEEDED   — foundry_event_training_progress.host_review_status='FOLLOW_UP_NEEDED'
 *                        (clears when the Host re-reviews → ALIGNED / PARTIALLY_CLEAR)
 *   SHARED_REVIEW_DUE  — shared_understanding_response present + host_review_status NULL|'NOT_REVIEWED'
 *                        (the NULL case is included because submit paths may not persist the literal
 *                         'NOT_REVIEWED'; a row with NO shared response is NEVER an unreviewed item)
 *
 * AUTHORIZATION: the caller must hold an ACTIVE Foundry Host grant, and only rows belonging to events
 * where foundry_events.owner_user_id = ownerUserId are ever read (a foreign event resolves nothing —
 * never another Host's data). Canonical Trainer/People-Manager/Team-Lead responsibility keys do NOT
 * grant this in V1 (they are not sufficiently populated in live org data).
 *
 * PRIVACY: the projection is a NAVIGATION SUMMARY. It never selects/returns response_text (private
 * Reflection), the full shared_understanding_response body, the Host private review note, Center
 * content, or any AI/inferred value — the SELECTs below are explicit safe allow-lists (the shared read
 * does not even select the response body; it only tests it for NULL).
 *
 * RESILIENCE: the Host gate + owned-event resolution are structural (a failure propagates so a real
 * authorization/schema defect is never silently masked as an empty inbox — Commander requirement).
 * Each optional attention projection is independently fail-soft (an unavailable read → that category
 * contributes nothing, never a thrown 500 into Today).
 *
 * DEFERRED — NEW_RESPONSE ("a learner responded, Host hasn't acknowledged"): NOT implemented. A
 * RESPONDED learner follow-up has no durable Host seen/acknowledged/handled state, and V1 must not
 * fake one with client-local dismissal, browser storage, viewed-once behavior, responded_at, or a
 * permanent history dump. A future ADDITIVE slice would add: host_acknowledged_at, an optional
 * append-only HOST_ACK audit event, and an explicit Host-owner RPC — no migration here.
 */

type OwnedEvent = { id: string; title: string | null };

const FALLBACK_TITLE = "Foundry training";

function trainingTitle(raw: string | null | undefined): string {
  const t = (raw ?? "").trim();
  return t.length > 0 ? t : FALLBACK_TITLE;
}

/** Localized one-line status reason. Service-layer display composition (never in pure domain). */
function overdueReason(followUpDays: number, locale: string): string {
  return locale === "ko"
    ? `${followUpDays}일 후 확인에 아직 응답하지 않았습니다`
    : `${followUpDays}-day follow-up has not been answered`;
}
function followUpNeededReason(locale: string): string {
  return locale === "ko"
    ? "이전에 추가 확인이 필요하다고 표시한 응답입니다"
    : "You previously marked this response for further attention";
}
function sharedReviewDueReason(locale: string): string {
  return locale === "ko"
    ? "학습자의 공유 이해가 검토를 기다리고 있습니다"
    : "A learner's shared understanding is ready for review";
}

function followupsDeepLink(locale: string, eventId: string, followupId: string): string {
  return `/${locale}/app?tab=foundry&event=${eventId}&section=followups&focus=${followupId}`;
}
function sharedDeepLink(locale: string, eventId: string, progressId: string): string {
  return `/${locale}/app?tab=foundry&event=${eventId}&section=shared-understanding&focus=${progressId}`;
}

/** Batch progress_id → participant_id (across owned events). No private column selected. */
async function participantByProgress(
  admin: SupabaseClient,
  progressIds: string[],
): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  if (progressIds.length === 0) return out;
  const { data } = await admin
    .from("foundry_event_training_progress")
    .select("id, participant_id")
    .in("id", progressIds);
  for (const p of (data ?? []) as Array<{ id: string; participant_id: string }>) {
    out.set(p.id, p.participant_id);
  }
  return out;
}

/** Batch participant_id → display_name (the identity already visible to the event owner). */
async function displayNameById(
  admin: SupabaseClient,
  participantIds: string[],
): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  if (participantIds.length === 0) return out;
  const { data } = await admin
    .from("foundry_event_participants")
    .select("id, display_name")
    .in("id", participantIds);
  for (const p of (data ?? []) as Array<{ id: string; display_name: string }>) {
    out.set(p.id, p.display_name);
  }
  return out;
}

/** FOLLOW_UP_OVERDUE — owned PENDING follow-ups whose BTY day has passed (reader-tz day boundary). */
async function overdueFollowups(
  admin: SupabaseClient,
  eventIds: string[],
  titleById: Map<string, string>,
  now: Date,
  tz: string,
  locale: string,
): Promise<HostAttentionItem[]> {
  try {
    const { data } = await admin
      .from("foundry_participant_followups")
      .select("id, event_id, progress_id, follow_up_days, due_at, status, source_training_title")
      .in("event_id", eventIds)
      .eq("status", "PENDING")
      .not("due_at", "is", null);

    const rows = ((data ?? []) as Array<{
      id: string;
      event_id: string | null;
      progress_id: string | null;
      follow_up_days: number;
      due_at: string;
      status: string;
      source_training_title: string | null;
    }>).filter((r) => r.event_id && classifyFollowUpDue(r.due_at, now, tz) === "overdue");

    const progressIds = rows.map((r) => r.progress_id).filter((v): v is string => Boolean(v));
    const partByProgress = await participantByProgress(admin, progressIds);
    const nameById = await displayNameById(admin, [...new Set(partByProgress.values())]);

    return rows.map((r): HostAttentionItem => {
      const participantId = r.progress_id ? partByProgress.get(r.progress_id) ?? null : null;
      const eventId = r.event_id as string;
      return {
        stableId: `host-followup-overdue:${r.id}`,
        category: "FOLLOW_UP_OVERDUE",
        eventId,
        focusId: r.id,
        participantDisplayName: (participantId && nameById.get(participantId)) || "",
        trainingTitle: trainingTitle(r.source_training_title ?? titleById.get(eventId)),
        reason: overdueReason(r.follow_up_days, locale),
        sourceTimestamp: r.due_at,
        deepLink: followupsDeepLink(locale, eventId, r.id),
      };
    });
  } catch {
    return []; // optional projection unavailable → contribute nothing (never a thrown 500)
  }
}

/** FOLLOW_UP_NEEDED + SHARED_REVIEW_DUE — from owned submitted shared responses. Body never selected. */
async function sharedReviewAttention(
  admin: SupabaseClient,
  eventIds: string[],
  titleById: Map<string, string>,
  locale: string,
): Promise<HostAttentionItem[]> {
  try {
    // SAFE allow-list — the shared_understanding_response BODY is never selected; it is only tested
    // for NULL via the filter. response_text / host_review_note are never touched.
    const { data } = await admin
      .from("foundry_event_training_progress")
      .select("id, event_id, participant_id, shared_response_submitted_at, host_review_status, host_reviewed_at")
      .in("event_id", eventIds)
      .not("shared_understanding_response", "is", null);

    const rows = (data ?? []) as Array<{
      id: string;
      event_id: string | null;
      participant_id: string;
      shared_response_submitted_at: string | null;
      host_review_status: string | null;
      host_reviewed_at: string | null;
    }>;

    const nameById = await displayNameById(admin, [...new Set(rows.map((r) => r.participant_id))]);

    const items: HostAttentionItem[] = [];
    for (const r of rows) {
      if (!r.event_id) continue;
      const status = r.host_review_status;
      const submittedAt = r.shared_response_submitted_at ?? "";
      const displayName = nameById.get(r.participant_id) ?? "";
      const eventId = r.event_id;
      if (status === "FOLLOW_UP_NEEDED") {
        items.push({
          stableId: `host-followup-needed:${r.id}`,
          category: "FOLLOW_UP_NEEDED",
          eventId,
          focusId: r.id,
          participantDisplayName: displayName,
          trainingTitle: trainingTitle(titleById.get(eventId)),
          reason: followUpNeededReason(locale),
          // Flagged-at when available (stable, meaningful), else submission time.
          sourceTimestamp: r.host_reviewed_at ?? submittedAt,
          deepLink: sharedDeepLink(locale, eventId, r.id),
        });
      } else if (status === null || status === "NOT_REVIEWED") {
        // NULL included: submit paths may not persist the literal 'NOT_REVIEWED'. A row with NO shared
        // response never reaches here (filtered out above), so this is never a legacy backlog.
        items.push({
          stableId: `host-shared-review:${r.id}`,
          category: "SHARED_REVIEW_DUE",
          eventId,
          focusId: r.id,
          participantDisplayName: displayName,
          trainingTitle: trainingTitle(titleById.get(eventId)),
          reason: sharedReviewDueReason(locale),
          sourceTimestamp: submittedAt,
          deepLink: sharedDeepLink(locale, eventId, r.id),
        });
      }
      // ALIGNED / PARTIALLY_CLEAR → reviewed, no longer an obligation → skip.
    }
    return items;
  } catch {
    return [];
  }
}

/**
 * The authenticated Host's deterministic Leadership Attention items, priority-ordered. Returns [] for
 * a non-Host / revoked Host / a Host who owns no events / a Host whose owned events have no obligations.
 * Never includes another Host's rows and never any private body/note/reflection.
 */
export async function getHostDailyAttention(
  admin: SupabaseClient,
  ownerUserId: string,
  now: Date,
  tz: string,
  locale: string,
): Promise<HostAttentionItem[]> {
  if (!ownerUserId) return [];

  // 1) Eligibility — ONLY an active Foundry Host grant (V1 authority model). Structural: not fail-soft.
  const isHost = await isActiveFoundryHost(admin, ownerUserId);
  if (!isHost) return [];

  // 2) Owned events — the exact authorization scope. A foreign event is never in this set.
  const { data: evs } = await admin
    .from("foundry_events")
    .select("id, title")
    .eq("owner_user_id", ownerUserId);
  const events = (evs ?? []) as OwnedEvent[];
  if (events.length === 0) return [];
  const eventIds = events.map((e) => e.id);
  const titleById = new Map(events.map((e) => [e.id, trainingTitle(e.title)]));

  // 3) Optional attention projections (each independently fail-soft), then deterministic priority sort.
  const [overdue, shared] = await Promise.all([
    overdueFollowups(admin, eventIds, titleById, now, tz, locale),
    sharedReviewAttention(admin, eventIds, titleById, locale),
  ]);

  return sortHostAttention([...overdue, ...shared]);
}
