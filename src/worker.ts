// @ts-ignore OpenNext generates this module immediately before Wrangler bundles the wrapper.
import app from "../.open-next/worker.js";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { syncMicrosoftDirectoryAuthority } from "@/lib/bty/microsoft/directoryAuthority.server";

type ExecutionContext = { waitUntil(promise: Promise<unknown>): void };

export default {
  fetch: app.fetch,
  scheduled(_event: unknown, _env: unknown, ctx: ExecutionContext) {
    const admin = getSupabaseAdmin();
    if (!admin) {
      console.error("[microsoft-authority-sync] scheduled admin unavailable");
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
