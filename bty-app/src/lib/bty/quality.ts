/**
 * Send quality events from bty-app (chat/mentor) to bty-ai-core for Admin Quality dashboard.
 * Fire-and-forget; failures are logged but do not affect the user response.
 */

const BTY_AI_URL = process.env.NEXT_PUBLIC_BTY_AI_URL || "";
const ADMIN_API_KEY = process.env.ADMIN_API_KEY;

export type QualityEventReason =
  | "fallback"
  | "empty_response"
  | "error"
  | "low_quality";

export type RecordQualityPayload = {
  route: "chat" | "mentor";
  reason: QualityEventReason;
  intent?: string;
  mode?: string;
  lang?: string;
};

function severityForReason(reason: QualityEventReason): "low" | "medium" | "high" {
  if (reason === "error") return "high";
  if (reason === "fallback" || reason === "empty_response") return "medium";
  return "low";
}

function issueForReason(reason: QualityEventReason, route: "chat" | "mentor"): string {
  const prefix = route === "chat" ? "chat" : "mentor";
  if (reason === "fallback") return `${prefix}_fallback: OpenAI unreachable or no key`;
  if (reason === "empty_response") return `${prefix}_empty: model returned no content`;
  if (reason === "error") return `${prefix}_error: exception in handler`;
  return `${prefix}_low_quality`;
}

/**
 * Record a quality event to bty-ai-core. Does not throw; logs and returns on failure.
 */
export function recordQualityEventApp(payload: RecordQualityPayload): void {
  if (!BTY_AI_URL || !ADMIN_API_KEY) return;

  const intent =
    payload.intent ||
    (payload.route === "chat" ? `chat_${payload.mode ?? "unknown"}` : "mentor");
  const issues = [issueForReason(payload.reason, payload.route)];
  const severity = severityForReason(payload.reason);

  const body = {
    role: "user",
    intent,
    issues,
    severity,
    route: "app" as const,
    model_version: "gpt-4o-mini",
  };

  fetch(`${BTY_AI_URL}/api/quality/event`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-admin-api-key": ADMIN_API_KEY,
    },
    body: JSON.stringify(body),
  }).catch((e) => {
    console.error("[quality] recordQualityEventApp failed:", e);
  });
}
