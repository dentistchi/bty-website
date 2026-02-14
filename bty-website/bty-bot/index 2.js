require("dotenv").config();
const express = require("express");
const { BotFrameworkAdapter, ActivityTypes } = require("botbuilder");
const axios = require("axios");

const PORT = process.env.PORT || 3978;
const BTY_AI_CORE_URL =
  process.env.BTY_AI_CORE_URL || "http://localhost:4000";
const DEFAULT_ROLE = process.env.DEFAULT_ROLE || "leader";
const DEFAULT_USER_ID = process.env.DEFAULT_USER_ID || "emulator-user";

// 로컬 에뮬레이터: App ID/Password 비워두기 (null). "" 빈 문자열이면 400 오류 발생
const adapter = new BotFrameworkAdapter({
  appId: process.env.MicrosoftAppId || null,
  appPassword: process.env.MicrosoftAppPassword || null,
});

adapter.onTurnError = async (context, error) => {
  console.error("[Bot] onTurnError:", error);
  await context.sendActivity("오류가 났어요. 잠시 후 다시 시도해 주세요.");
};

const app = express();
app.use(express.json());

// 연결 상태 확인 (브라우저나 curl http://localhost:3978/health 로 확인)
app.get("/health", async (req, res) => {
  const backendUrl = BTY_AI_CORE_URL.replace(/\/$/, "");
  try {
    const { data, status } = await axios.get(`${backendUrl}/health`, {
      timeout: 3000,
    });
    res.json({
      status: "ok",
      bot: "bty-bot",
      bty_ai_core: { reachable: true, status, data },
    });
  } catch (err) {
    res.status(503).json({
      status: "degraded",
      bot: "bty-bot",
      bty_ai_core: {
        reachable: false,
        error: err.code || err.message,
        url: `${backendUrl}/health`,
        hint: "Run: cd bty-website/bty-ai-core && npm run dev",
      },
    });
  }
});

app.post("/api/messages", (req, res) => {
  adapter.processActivity(req, res, async (context) => {
    if (context.activity.type === "conversationUpdate") {
      const members = context.activity.membersAdded || [];
      if (members.some((m) => m.id !== context.activity.recipient?.id)) {
        await context.sendActivity(
          "BTY 리더십 성숙도 AI에 연결되었어요. 마음껏 말해 주세요."
        );
      }
      return;
    }
    if (context.activity.type !== "message") return;

    const userMessage = context.activity.text?.trim() || "";
    if (!userMessage) {
      await context.sendActivity("메시지를 입력해 주세요.");
      return;
    }

    try {
      // Typing indicator 보내기 (봇이 타이핑 중임을 표시)
      await context.sendActivity({ type: ActivityTypes.Typing });
      
      // "..." 애니메이션 메시지 보내기
      const dotsActivity = await context.sendActivity("...");
      let dotsUpdateInterval = null;
      let dotsCount = 0;
      
      // "..." 애니메이션 업데이트 (1초마다)
      const updateDots = async () => {
        if (dotsActivity && dotsActivity.id) {
          try {
            const dots = ["...", "..", ".", ".."];
            const dotsText = dots[dotsCount % dots.length];
            dotsCount++;
            await context.updateActivity({
              id: dotsActivity.id,
              type: ActivityTypes.Message,
              text: dotsText,
            });
          } catch (updateErr) {
            // 업데이트 실패 시 무시
            console.warn("[Bot] Failed to update dots:", updateErr.message);
          }
        }
      };
      
      // Typing indicator를 주기적으로 재전송 (3초마다)
      const typingInterval = setInterval(async () => {
        try {
          await context.sendActivity({ type: ActivityTypes.Typing });
        } catch (typingErr) {
          console.warn("[Bot] Failed to send typing indicator:", typingErr.message);
        }
      }, 3000);
      
      // "..." 애니메이션 시작 (1초마다 업데이트)
      dotsUpdateInterval = setInterval(updateDots, 1000);
      
      try {
        // 백엔드 API 호출
        const { data } = await axios.post(`${BTY_AI_CORE_URL}/chat`, {
          userId: DEFAULT_USER_ID,
          role: DEFAULT_ROLE,
          message: userMessage,
        });
        
        // 인터벌 정리
        if (dotsUpdateInterval) {
          clearInterval(dotsUpdateInterval);
        }
        if (typingInterval) {
          clearInterval(typingInterval);
        }
        
        // "..." 메시지 삭제 (실제 응답 전에)
        if (dotsActivity && dotsActivity.id) {
          try {
            await context.deleteActivity(dotsActivity.id);
          } catch (deleteErr) {
            // 삭제 실패해도 계속 진행
            console.warn("[Bot] Failed to delete dots message:", deleteErr.message);
          }
        }
        
        // 실제 응답 전송
        const reply = data.reply || "응답을 생성하지 못했어요.";
        await context.sendActivity(reply);
      } catch (apiErr) {
        // API 에러 발생 시에도 인터벌 정리
        if (dotsUpdateInterval) {
          clearInterval(dotsUpdateInterval);
        }
        if (typingInterval) {
          clearInterval(typingInterval);
        }
        
        // "..." 메시지 삭제
        if (dotsActivity && dotsActivity.id) {
          try {
            await context.deleteActivity(dotsActivity.id);
          } catch (deleteErr) {
            console.warn("[Bot] Failed to delete dots message:", deleteErr.message);
          }
        }
        
        // 에러를 상위로 전파하여 기존 에러 처리 로직 실행
        throw apiErr;
      }
    } catch (err) {
      const isConnectionError =
        err.code === "ECONNREFUSED" ||
        err.code === "ETIMEDOUT" ||
        err.message?.includes("connect");
      const is400 = err.response?.status === 400;

      console.error("[Bot] bty-ai-core call failed:", {
        code: err.code,
        message: err.message,
        status: err.response?.status,
        url: `${BTY_AI_CORE_URL}/chat`,
      });

      const msg = is400
        ? "요청 형식 오류예요. 다시 말해 주세요."
        : isConnectionError
        ? `BTY AI 서버에 연결할 수 없어요. bty-ai-core가 실행 중인지 확인해 주세요 (${BTY_AI_CORE_URL}).`
        : "BTY AI 서버에서 오류가 발생했어요. 잠시 후 다시 시도해 주세요.";
      await context.sendActivity(msg);
    }
  });
});

const server = app.listen(PORT, async () => {
  console.log(`BTY Bot listening on http://localhost:${PORT}`);
  console.log(`Emulator: connect to http://localhost:${PORT}/api/messages`);
  console.log(`Backend:  ${BTY_AI_CORE_URL}/chat`);

  // Startup health check
  try {
    const healthUrl = `${BTY_AI_CORE_URL.replace("/chat", "")}/health`;
    const { data } = await axios.get(healthUrl, { timeout: 2000 });
    console.log(`✓ bty-ai-core is reachable: ${JSON.stringify(data)}`);
  } catch (err) {
    console.warn(
      `⚠ bty-ai-core health check failed: ${err.message}. Make sure it's running on ${BTY_AI_CORE_URL}`
    );
  }
});

server.on("error", (err) => {
  if (err.code === "EADDRINUSE") {
    console.error(`\n포트 ${PORT}이(가) 이미 사용 중입니다.`);
    console.error(`기존 프로세스 종료: lsof -i :${PORT} -t | xargs kill`);
    console.error(`또는 .env에서 PORT를 다른 값(예: 3979)으로 변경하세요.\n`);
  } else {
    console.error(err);
  }
  process.exit(1);
});
