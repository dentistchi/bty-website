import type { WeeklyReportReadyPayload } from "@/engine/integrity/weekly-air-report.service";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import {
  WEEKLY_REPORT_REALTIME_CHANNEL_PREFIX,
  WEEKLY_REPORT_READY_EVENT,
} from "@/lib/bty/center/weekly-report-realtime";

/**
 * Push `weekly_report_ready` to the user’s Realtime channel (cron / server-side).
 */
export function broadcastWeeklyReportReady(payload: WeeklyReportReadyPayload): void {
  const admin = getSupabaseAdmin();
  if (!admin) return;

  const channelName = `${WEEKLY_REPORT_REALTIME_CHANNEL_PREFIX}${payload.userId}`;
  const ch = admin.channel(channelName);
  const done = () => {
    try {
      admin.removeChannel(ch);
    } catch {
      // ignore
    }
  };
  const t = setTimeout(done, 8000);
  ch.subscribe((status) => {
    if (status !== "SUBSCRIBED") return;
    void ch
      .send({
        type: "broadcast",
        event: WEEKLY_REPORT_READY_EVENT,
        payload,
      })
      .finally(() => {
        clearTimeout(t);
        done();
      });
  });
}
