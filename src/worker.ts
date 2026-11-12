// @ts-ignore OpenNext generates this module immediately before Wrangler bundles the wrapper.
import app from "../.open-next/worker.js";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { syncMicrosoftDirectoryAuthority } from "@/lib/bty/microsoft/directoryAuthority.server";
import { dispatchDueTrackNotifications } from "@/lib/bty/announcement/trackNotificationDelivery.server";

type ExecutionContext = { waitUntil(promise: Promise<unknown>): void };

export default {
  fetch: app.fetch,
  scheduled(event: { cron: string }, _env: unknown, ctx: ExecutionContext) {
    const initialNotices = event.cron === "* * * * *";
    if (!initialNotices && event.cron !== "0 * * * *") return;
    const admin = getSupabaseAdmin();
    if (!admin) {
      console.error(initialNotices
        ? "[teams-track-notifications] scheduled admin unavailable"
        : "[microsoft-authority-sync] scheduled admin unavailable");
      return;
    }
    if (initialNotices) {
      ctx.waitUntil(dispatchDueTrackNotifications(admin).then(result => {
        if (result.lookupFailed || result.attempted > 0) {
          console.info("[teams-track-notifications] scheduled initial delivery", result);
        }
      }));
      return;
    }
    ctx.waitUntil(
      syncMicrosoftDirectoryAuthority(admin).then((result) => {
        console.error("[microsoft-authority-sync] scheduled run", {
          ok: result.ok, total: result.total, activeMembers: result.activeMembers,
          managers: result.managers, indeterminate: result.indeterminate,
        });
      }),
    );
  },
};
