import type { SupabaseClient } from "@supabase/supabase-js";
import { after } from "next/server";
import { trackingComplete, type TrackingEvidence } from "@/domain/announcement/trackingEvidence";
import { notifyRecipient, type NotifyResult } from "./notifyRecipient.server";

type TrackedRecipient = {
  id: string;
  opened_at: string | null;
  acknowledged_at: string | null;
  response_submitted_at: string | null;
  bty_tracked_announcements: { status: string; tracking_mode: TrackingEvidence["trackingMode"] } | null;
};

export type TrackNotificationDispatch = {
  attempted: number;
  sent: number;
  alreadyNotified: number;
  waiting: number;
  needsReview: number;
  failed: number;
  completed: number;
  lookupFailed: boolean;
};

type TrackNotificationInput = { announcementId: string; ownerUserId: string };

const empty = (): TrackNotificationDispatch => ({
  attempted: 0, sent: 0, alreadyNotified: 0, waiting: 0, needsReview: 0,
  failed: 0, completed: 0, lookupFailed: false,
});

/**
 * Initial delivery only, for one successfully persisted Track. Fetch the frozen audience
 * from the owned announcement, never the submitted people-picker values. Existing delivery
 * claims remain the send authority: repeating Track can retry a definitive failure but cannot
 * resend a delivered or ambiguous message. Nothing resets notified_at or a send marker.
 */
export async function dispatchTrackNotifications(
  admin: SupabaseClient,
  input: TrackNotificationInput,
): Promise<TrackNotificationDispatch> {
  const result = empty();
  let rows: TrackedRecipient[];
  try {
    const { data, error } = await admin
      .from("bty_tracked_announcement_recipients")
      .select("id, opened_at, acknowledged_at, response_submitted_at, bty_tracked_announcements!inner(status, tracking_mode)")
      .eq("announcement_id", input.announcementId)
      .eq("bty_tracked_announcements.owner_user_id", input.ownerUserId)
      .is("notified_at", null);
    if (error || !Array.isArray(data)) {
      result.lookupFailed = true;
      return result;
    }
    rows = data as unknown as TrackedRecipient[];
  } catch {
    result.lookupFailed = true;
    return result;
  }

  // Bounded fan-out avoids serial Connector waits delaying every later recipient.
  // Promise.all is returned/awaited inside Next after(), which OpenNext binds to waitUntil.
  let next = 0;
  const deliver = async () => {
    while (next < rows.length) {
      const row = rows[next++];
      const announcement = row.bty_tracked_announcements;
      if (!announcement || announcement.status !== "active" || trackingComplete({
        trackingMode: announcement.tracking_mode,
        openedAt: row.opened_at,
        acknowledgedAt: row.acknowledged_at,
        responseSubmittedAt: row.response_submitted_at,
      })) {
        result.completed += 1;
        continue;
      }
      result.attempted += 1;
      let outcome: NotifyResult;
      try {
        outcome = await notifyRecipient(admin, { recipientId: row.id, ownerUserId: input.ownerUserId });
      } catch {
        // A thrown callback may have crossed the send boundary. Never release or resend here.
        result.needsReview += 1;
        continue;
      }
      if (outcome.ok) result.sent += 1;
      else if (outcome.reason === "already_notified") result.alreadyNotified += 1;
      else if (outcome.reason === "in_progress" || outcome.reason === "conversation_in_progress") result.waiting += 1;
      else if (["delivery_unknown", "conversation_creation_unknown", "confirm_failed", "claim_lost"].includes(outcome.reason)) result.needsReview += 1;
      else result.failed += 1;
    }
  };
  await Promise.all(Array.from({ length: Math.min(4, rows.length) }, deliver));
  return result;
}

/**
 * Schedule only after Track committed. No network promise starts until after the response.
 * The receipt confirms tracking, never message delivery; scheduled is not a sent receipt.
 * A runtime without background support keeps Track and reports unavailable without sending.
 */
export function scheduleTrackNotifications(
  admin: SupabaseClient,
  input: TrackNotificationInput,
): "scheduled" | "unavailable" {
  try {
    after(async () => {
      const result = await dispatchTrackNotifications(admin, input);
      // Counts only: no message bodies, identities, routing coordinates or tokens.
      console.info("[teams-track-notifications] initial delivery", result);
    });
    return "scheduled";
  } catch {
    console.error("[teams-track-notifications] background unavailable");
    return "unavailable";
  }
}
