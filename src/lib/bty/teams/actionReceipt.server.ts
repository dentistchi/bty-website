import type { SupabaseClient } from "@supabase/supabase-js";
import { after } from "next/server";
import { getBotFrameworkToken } from "./botToken.server";
import { sendProactiveMessage } from "./proactiveConversation.server";
import { resolveTeamsConversation } from "./resolveTeamsConversation.server";

const RECEIPT_COPY = {
  save: {
    en: "✓ Saved. Find it in Today → Saved for later.",
    ko: "✓ 저장했습니다. 오늘 → 나중에 보기에서 확인하세요.",
  },
  track: {
    en: "✓ Tracking started. Find it in Today → Track announcement.",
    ko: "✓ 공지 추적을 시작했습니다. 오늘 → 공지 추적에서 확인하세요.",
  },
};

// Keep the regional path Teams supplied, but send bot credentials only to official Connectors.
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

type ActionReceipt = {
  tenantId: string;
  aadObjectId: string;
  serviceUrl: string;
  action: keyof typeof RECEIPT_COPY;
  locale: "en" | "ko";
};

/** A newly committed action can send a private receipt to its verified Teams caller.
 * Use the existing bot conversation lease. The inline receipt remains available if the
 * personal chat is unavailable. An ambiguous send is never retried by this callback. */
export function scheduleActionReceipt(admin: SupabaseClient, receipt: ActionReceipt): void {
  if (!isTeamsConnector(receipt.serviceUrl)) return;
  try {
    after(async () => {
      try {
        const appId = process.env.TEAMS_BOT_APP_ID;
        if (!appId) return;
        const token = await getBotFrameworkToken({ appId });
        if (!token.ok) {
          console.warn("[teams-action-receipt] token unavailable", { action: receipt.action, reason: token.reason });
          return;
        }
        const conversation = await resolveTeamsConversation(admin, {
          tenantId: receipt.tenantId,
          aadObjectId: receipt.aadObjectId,
          serviceUrl: receipt.serviceUrl,
          appId,
          token: token.token,
        });
        if (!conversation.ok) {
          console.warn("[teams-action-receipt] personal chat unavailable", { action: receipt.action, reason: conversation.reason });
          return;
        }
        if (!isTeamsConnector(conversation.serviceUrl)) {
          console.warn("[teams-action-receipt] stored Connector route rejected", { action: receipt.action });
          return;
        }
        await sendProactiveMessage({
          token: token.token,
          serviceUrl: conversation.serviceUrl,
          conversationId: conversation.conversationId,
          text: RECEIPT_COPY[receipt.action][receipt.locale],
        });
      } catch {
        console.error("[teams-action-receipt] delivery callback failed", { action: receipt.action });
      }
    });
  } catch {
    console.error("[teams-action-receipt] background unavailable", { action: receipt.action });
  }
}
