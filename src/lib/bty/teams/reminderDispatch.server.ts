import type { SupabaseClient } from "@supabase/supabase-js";
import { BTY_TEAMS_APP_ID, BTY_TEAMS_PERSONAL_TAB_ENTITY_ID } from "@/domain/teams/trainingTarget";
import { getBotFrameworkToken } from "./botToken.server";
import { sendProactiveMessage } from "./proactiveConversation.server";
import { resolveTeamsConversation } from "./resolveTeamsConversation.server";
import { readTenantRoute } from "./tenantRoute.server";

const BATCH_SIZE = 24;
const CONCURRENCY = 4;
const TEAMS_APP_LINK = `https://teams.microsoft.com/l/entity/${BTY_TEAMS_APP_ID}/${BTY_TEAMS_PERSONAL_TAB_ENTITY_ID}?label=BTY&openInMeeting=false`;
const COPY = {
  save: "Reminder: you still have a saved message. Open Today → Saved for later.",
  track_owner: "Reminder: a message you’re tracking still needs attention. Open Today → Track announcement.",
  track_recipient: "Reminder: a tracked message still needs your attention. Open Today → Needs your response.",
};

// Preserve the observed regional path. Never give bot credentials to another origin.
const CONNECTOR_ORIGINS = new Set([
  "https://smba.trafficmanager.net",
  "https://smba.infra.gcc.teams.microsoft.com",
  "https://smba.infra.gov.teams.microsoft.us",
  "https://smba.infra.dod.teams.microsoft.us",
]);

function isTeamsConnector(serviceUrl: string): boolean {
  try {
    const url = new URL(serviceUrl);
    return CONNECTOR_ORIGINS.has(url.origin) && !url.username && !url.password && !url.search && !url.hash;
  } catch {
    return false;
  }
}

type Reminder = {
  id: string;
  claim_token: string;
  kind: keyof typeof COPY;
  tenant_id: string;
  aad_object_id: string;
  subject_id: string;
};
type Finish = "sent" | "retry" | "skipped" | "unknown";

export type TeamsReminderDispatch = Record<Finish, number> & {
  claimed: number;
  unconfirmed: number;
  claimFailed: boolean;
  botConfigured: boolean;
};

/** Deliver due jobs from the scheduled Worker. The DB owns due times, claims, and whether the
 * current action still needs a reminder. An ambiguous send stays terminal across cron runs. */
export async function dispatchTeamsReminders(admin: SupabaseClient): Promise<TeamsReminderDispatch> {
  const appId = process.env.TEAMS_BOT_APP_ID ?? "";
  const result: TeamsReminderDispatch = {
    claimed: 0, sent: 0, retry: 0, skipped: 0, unknown: 0, unconfirmed: 0,
    claimFailed: false, botConfigured: !!appId,
  };
  if (!appId) return result;

  let reminders: Reminder[];
  try {
    const { data, error } = await admin.rpc("bty_claim_due_teams_reminders", { p_limit: BATCH_SIZE });
    if (error || !Array.isArray(data)) {
      result.claimFailed = true;
      return result;
    }
    reminders = data as Reminder[];
  } catch {
    result.claimFailed = true;
    return result;
  }
  result.claimed = reminders.length;
  if (reminders.length === 0) return result;

  const botToken = getBotFrameworkToken({ appId }).catch(() => null);
  const deliver = async (reminder: Reminder) => {
    const claim = { p_id: reminder.id, p_claim_token: reminder.claim_token };
    let started = false;
    let outcome: Finish;

    try {
      outcome = await send();
    } catch {
      outcome = started ? "unknown" : "retry";
    }

    try {
      const { data, error } = await admin.rpc("bty_finish_teams_reminder", { ...claim, p_result: outcome });
      if (error || data !== true) {
        result.unconfirmed += 1;
        return;
      }
      result[outcome] += 1;
    } catch {
      // A lost confirmation does not undo a known or possible send. The DB send marker
      // prevents a new attempt from sending it again.
      result.unconfirmed += 1;
    }

    async function send(): Promise<Finish> {
      if (!Object.hasOwn(COPY, reminder.kind)) return "skipped";
      const token = await botToken;
      if (!token?.ok) return "retry";
      let serviceUrl = await readTenantRoute(admin, reminder.tenant_id);
      if (!serviceUrl && reminder.kind !== "save") {
        // Track stores the verified route on its own announcement, even when no
        // Teams activity has populated the tenant-wide route yet.
        const { data, error } = await admin.from("bty_tracked_announcements")
          .select("service_url")
          .eq("id", reminder.subject_id)
          .eq("tenant_id", reminder.tenant_id)
          .eq("status", "active")
          .maybeSingle<{ service_url: string | null }>();
        if (error) return "retry";
        serviceUrl = data?.service_url ?? null;
      }
      if (!serviceUrl) return "retry";
      if (!isTeamsConnector(serviceUrl)) return "skipped";

      const conversation = await resolveTeamsConversation(admin, {
        tenantId: reminder.tenant_id,
        aadObjectId: reminder.aad_object_id,
        serviceUrl,
        appId,
        token: token.token,
      });
      if (!conversation.ok) return conversation.reason === "not_installed" ? "skipped" : "retry";
      if (!isTeamsConnector(conversation.serviceUrl)) return "skipped";

      const { data, error } = await admin.rpc("bty_start_teams_reminder", claim);
      if (error) return "retry";
      if (data !== true) return "skipped";
      started = true;
      const sent = await sendProactiveMessage({
        token: token.token,
        serviceUrl: conversation.serviceUrl,
        conversationId: conversation.conversationId,
        text: `${COPY[reminder.kind]} [Open BTY in Teams](${TEAMS_APP_LINK})`,
      });
      if (sent.ok) return "sent";
      if (sent.ambiguous) return "unknown";
      return sent.failure === "throttled" || sent.failure === "unauthorized" ? "retry" : "skipped";
    }
  };

  let next = 0;
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, reminders.length) }, async () => {
    while (next < reminders.length) await deliver(reminders[next++]!);
  }));
  return result;
}
