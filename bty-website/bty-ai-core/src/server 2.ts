import "dotenv/config"; // .env를 가장 먼저 로드 (openai 등에서 process.env 사용 전에 필요)
import express from "express";
import cors from "cors";

import { reloadPatchConfig } from "./config/patchConfig";
import chatRoutes from "./routes/chat";
import adminRoutes from "./routes/admin";
import qualityRoutes from "./routes/quality";
import patchRoutes from "./routes/patch";

const app = express();
const PORT = Number(process.env.PORT) || 4000;

app.use(cors());
app.use(express.json());

// Load patch config at startup (DB or patches/ folder in dev)
reloadPatchConfig()
  .then(() => console.log("[patchConfig] Loaded"))
  .catch((e) => console.warn("[patchConfig] Initial load failed:", (e as Error).message));

app.use("/chat", chatRoutes);
app.use("/admin", adminRoutes);
app.use("/api/quality", qualityRoutes);
app.use("/api/patch", patchRoutes);

app.get("/health", (_, res) => {
  res.json({ status: "ok", service: "bty-ai-core" });
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`bty-ai-core server running on port ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
  console.log(`Chat endpoint: http://localhost:${PORT}/chat`);
});

process.on("unhandledRejection", (err) => {
  console.error("Unhandled rejection:", err);
});

process.on("uncaughtException", (err) => {
  console.error("Uncaught exception:", err);
  process.exit(1);
});
