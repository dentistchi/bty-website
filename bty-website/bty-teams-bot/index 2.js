const dotenv = require("dotenv");
dotenv.config();

const express = require("express");
const {
  BotFrameworkAdapter,
  TeamsActivityHandler,
  CardFactory,
} = require("botbuilder");
const { ConfidentialClientApplication } = require("@azure/msal-node");

const BACKEND_URL =
  process.env.BTY_BACKEND_URL || "http://localhost:4000";

const AZURE_AD_GROUP_LEADER = process.env.AZURE_AD_GROUP_LEADER?.trim() || null;
const AZURE_AD_GROUP_DOCTOR = process.env.AZURE_AD_GROUP_DOCTOR?.trim() || null;
const AZURE_AD_TENANT_ID = process.env.AZURE_AD_TENANT_ID?.trim() || "common";

let msalClient = null;

function getMsalClient() {
  if (msalClient) return msalClient;
  const appId = process.env.MicrosoftAppId;
  const appPassword = process.env.MicrosoftAppPassword;
  if (!appId || !appPassword) return null;
  msalClient = new ConfidentialClientApplication({
    auth: {
      clientId: appId,
      clientSecret: appPassword,
      authority: `https://login.microsoftonline.com/${AZURE_AD_TENANT_ID}`,
    },
  });
  return msalClient;
}

/**
 * Acquire access token for Microsoft Graph API (client credentials flow).
 */
async function getGraphToken() {
  const client = getMsalClient();
  if (!client) return null;
  try {
    const result = await client.acquireTokenByClientCredential({
      scopes: ["https://graph.microsoft.com/.default"],
    });
    return result?.accessToken || null;
  } catch (err) {
    console.error("Graph token error:", err.message);
    return null;
  }
}

/**
 * Fetch user's group membership via Microsoft Graph API.
 * Returns array of group object IDs, or [] on error.
 */
async function getUserGroupIds(aadObjectId) {
  const token = await getGraphToken();
  if (!token) return [];

  try {
    const res = await fetch(
      `https://graph.microsoft.com/v1.0/users/${aadObjectId}/getMemberGroups`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ securityEnabledOnly: false }),
      }
    );

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      console.error("Graph getMemberGroups error:", res.status, err);
      return [];
    }

    const data = await res.json();
    return Array.isArray(data.value) ? data.value : [];
  } catch (err) {
    console.error("Graph getMemberGroups error:", err.message);
    return [];
  }
}

/**
 * Resolve role from Azure AD group membership.
 * - Leadership group → leader
 * - Doctor group → doctor
 * - Default → staff
 */
async function resolveRole(turnContext) {
  const aadObjectId = turnContext.activity.from.aadObjectId;
  if (!aadObjectId) return "staff";

  if (!AZURE_AD_GROUP_LEADER && !AZURE_AD_GROUP_DOCTOR) {
    return "staff";
  }

  const groupIds = await getUserGroupIds(aadObjectId);
  const groupSet = new Set(groupIds.map((id) => (id || "").toLowerCase()));

  if (AZURE_AD_GROUP_LEADER && groupSet.has(AZURE_AD_GROUP_LEADER.toLowerCase())) {
    return "leader";
  }
  if (AZURE_AD_GROUP_DOCTOR && groupSet.has(AZURE_AD_GROUP_DOCTOR.toLowerCase())) {
    return "doctor";
  }

  return "staff";
}

/**
 * Call bty-ai-core backend /chat endpoint.
 */
async function callBackend(userId, role, message) {
  const res = await fetch(`${BACKEND_URL.replace(/\/$/, "")}/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      userId,
      role,
      message,
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Backend returned ${res.status}`);
  }

  return res.json();
}

/**
 * Build adaptive card for maturity signal.
 */
function buildMaturitySignalCard(signalText) {
  return {
    type: "AdaptiveCard",
    $schema: "http://adaptivecards.io/schemas/adaptive-card.json",
    version: "1.4",
    body: [
      {
        type: "Container",
        items: [
          {
            type: "TextBlock",
            text: signalText,
            size: "medium",
            weight: "bolder",
            wrap: true,
          },
        ],
        style: "emphasis",
        bleeding: true,
      },
    ],
  };
}

class BTYTeamsBot extends TeamsActivityHandler {
  constructor() {
    super();

    this.onMessage(async (context, next) => {
      const text = (context.activity.text || "").trim();
      if (!text) {
        await context.sendActivity("메시지를 입력해주세요.");
        await next();
        return;
      }

      const userId =
        context.activity.from.aadObjectId || context.activity.from.id || "";
      const role = await resolveRole(context);

      try {
        const { reply, maturitySignal } = await callBackend(
          userId,
          role,
          text
        );

        const replyText =
          typeof reply === "string" && reply.trim()
            ? reply
            : "지금 이 상황에서 가장 크게 느끼는 감정은 무엇인가요?";
        await context.sendActivity(replyText);

        if (maturitySignal && typeof maturitySignal === "string") {
          const card = CardFactory.adaptiveCard(
            buildMaturitySignalCard(maturitySignal)
          );
          await context.sendActivity({ attachments: [card] });
        }
      } catch (err) {
        console.error("Backend error:", err);
        try {
          await context.sendActivity(
            "일시적인 오류가 발생했습니다. 잠시 후 다시 시도해주세요."
          );
        } catch (sendErr) {
          console.error("Failed to send error message:", sendErr);
        }
      }

      await next();
    });
  }
}

const adapter = new BotFrameworkAdapter({
  appId: process.env.MicrosoftAppId || undefined,
  appPassword: process.env.MicrosoftAppPassword || undefined,
});

adapter.onTurnError = async (context, error) => {
  console.error("Turn error:", error);
  await context.sendActivity("오류가 발생했습니다.");
};

const bot = new BTYTeamsBot();

const app = express();
const port = process.env.port || process.env.PORT || 3978;
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.post("/api/messages", (req, res) => {
  adapter.processActivity(req, res, async (context) => {
    await bot.run(context);
  });
});

app.listen(port, () => {
  console.log(`\nBTY Teams Bot listening on http://localhost:${port}`);
  console.log("BTY Backend:", BACKEND_URL);
  if (AZURE_AD_GROUP_LEADER || AZURE_AD_GROUP_DOCTOR) {
    console.log(
      "Role mapping: Graph API enabled (Leader:", !!AZURE_AD_GROUP_LEADER,
      "| Doctor:", !!AZURE_AD_GROUP_DOCTOR, ")"
    );
  }
});
