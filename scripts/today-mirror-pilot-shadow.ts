/**
 * BTY Today AI Mirror — pilot read-only evidence shadow (DEVELOPER-INVOKED SCRIPT).
 *
 * NOT an API route, page, cron, startup hook, imported side effect, or test. It runs ONLY when a
 * developer invokes it directly and prints VALUE-SAFE status only.
 *
 * Default behavior: validate the pilot config and print value-safe status. NO database query,
 * NO provider call, NO real evidence.
 *
 * Real read-only execution requires BOTH explicit arms (belt-and-braces against accidents):
 *     TODAY_MIRROR_REAL_SHADOW=1   AND   --execute-read-only
 * When armed, a read-only-wrapped Supabase admin client is lazy-constructed (never at import time)
 * and every reader is scoped to the single configured pilot user. The packet is assembled in memory
 * and discarded; only value-safe status is printed. No mutation surface is reachable.
 *
 * This script never prints or logs env values. During the build arc it is left UNARMED.
 *
 * Usage:
 *   npm run today-mirror:pilot-shadow                 # inert: config check + status only
 *   TODAY_MIRROR_REAL_SHADOW=1 npm run today-mirror:pilot-shadow -- --execute-read-only   # armed
 */
import { loadPilotShadowConfig } from "@/lib/bty/today-intelligence/pilotShadowConfig";
import {
  runPilotEvidenceShadow,
  makeSupabaseReadOnlyReaders,
  type PilotSignalReaders,
} from "@/lib/bty/today-intelligence/pilotShadow";

function isArmed(argv: string[], env: NodeJS.ProcessEnv): boolean {
  const flag = argv.includes("--execute-read-only");
  const envArm = env.TODAY_MIRROR_REAL_SHADOW === "1";
  return flag && envArm;
}

async function main() {
  const armed = isArmed(process.argv.slice(2), process.env);
  const config = loadPilotShadowConfig(); // reads env in memory; values never printed

  // Readers are constructed ONLY when armed — the unarmed path builds no client and issues no query.
  let readers: PilotSignalReaders | undefined;
  if (armed && config.ok) {
    const { getSupabaseAdmin } = await import("@/lib/supabase-admin");
    const client = getSupabaseAdmin();
    if (!client) {
      console.error(JSON.stringify({ verdict: "BLOCKED_CONFIG", reason: "SUPABASE_CLIENT_UNAVAILABLE" }));
      process.exit(2);
    }
    readers = makeSupabaseReadOnlyReaders(client);
  }

  const status = await runPilotEvidenceShadow({ config, now: new Date(), armed, readers });

  // Value-safe: `status` contains booleans, machine codes, lens name, and confidence only.
  console.log(JSON.stringify({ armed, ...status }, null, 2));
}

main().catch((e) => {
  // Never surface a value: emit the error NAME only, not its message (which could echo input).
  console.error(JSON.stringify({ verdict: "BLOCKED_CONFIG", error: e instanceof Error ? e.name : "UnknownError" }));
  process.exit(1);
});
