import "dotenv/config";
import { app, InvocationContext, Timer } from "@azure/functions";

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { generatePatchSuggestions } = require("../../../bty-ai-core/dist/services/patchGenerator") as {
  generatePatchSuggestions: (window: "7d" | "30d") => Promise<{ id: string; suggestion: Record<string, unknown> } | null>;
};

const TEAMS_WEBHOOK_URL = process.env.TEAMS_WEBHOOK_URL;

async function notifyTeams(record: { id: string; suggestion: Record<string, unknown> }): Promise<void> {
  if (!TEAMS_WEBHOOK_URL) return;

  const sug = record.suggestion as { patch_version?: string; rule_patches?: Array<{ change?: string }>; top_targets?: Array<{ issues_signature?: string }> };
  const rulePatches = sug.rule_patches ?? [];
  const topTargets = sug.top_targets ?? [];
  const summary =
    rulePatches.map((p) => p?.change).filter(Boolean).join("; ") ||
    topTargets.map((t) => t?.issues_signature).filter(Boolean).join(", ");

  const patchVersion = sug.patch_version ?? "unknown";
  const body = {
    "@type": "MessageCard",
    "@context": "https://schema.org/extensions",
    "summary": `BTY Patch Draft ${patchVersion}`,
    "themeColor": "0076D7",
    "title": `BTY Quality Patch Draft (${patchVersion})`,
    "text": summary || "No rule changes proposed.",
    "potentialAction": [
      {
        "@type": "OpenUri",
        "name": "View in Admin",
        "targets": [{ "os": "default", "uri": process.env.TEAMS_ADMIN_URL || "https://your-admin-url/admin/quality" }],
      },
    ],
  };

  try {
    const res = await fetch(TEAMS_WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      console.error("[WeeklyPatchTimer] Teams webhook failed:", res.status, await res.text());
    }
  } catch (err: unknown) {
    console.error("[WeeklyPatchTimer] Teams notify error:", err);
  }
}

app.timer("WeeklyPatchTimer", {
  schedule: "0 0 8 * * 1",
  handler: async (myTimer: Timer, context: InvocationContext): Promise<void> => {
    context.log("WeeklyPatchTimer: starting");

    try {
      const record = await generatePatchSuggestions("7d");
      if (!record) {
        context.log("WeeklyPatchTimer: no quality events in window, skipping");
        return;
      }

      context.log("WeeklyPatchTimer: draft stored, id=", record.id);

      if (TEAMS_WEBHOOK_URL) {
        await notifyTeams(record);
        context.log("WeeklyPatchTimer: Teams notified");
      }
    } catch (err: unknown) {
      context.error("WeeklyPatchTimer error:", err);
      throw err;
    }
  },
});
