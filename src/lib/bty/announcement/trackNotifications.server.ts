import type { SupabaseClient } from "@supabase/supabase-js";
import { after } from "next/server";
import { dispatchTrackNotifications } from "./trackNotificationDelivery.server";

type TrackNotificationInput = { announcementId: string; ownerUserId: string };

/**
 * Attempt prompt delivery after the response. New recipient rows also remain
 * eligible for the scheduled Worker, including when this callback cannot run.
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
