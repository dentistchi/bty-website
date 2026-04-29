import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET() {
  const deployVersion =
    process.env.BTY_DEPLOY_VERSION?.trim() ||
    process.env.DEPLOY_VERSION?.trim() ||
    process.env.CF_PAGES_COMMIT_SHA?.trim() ||
    process.env.BTY_APP_VERSION?.trim() ||
    "0.1.0";

  const buildTime =
    process.env.BTY_BUILD_TIME?.trim() ||
    process.env.BUILD_TIME?.trim() ||
    null;

  const envName = process.env.BTY_ENV?.trim() || "unknown";
  const workerName = process.env.BTY_WORKER_NAME?.trim() || "bty-arena-staging";

  return NextResponse.json({
    app: "bty-arena",
    env: envName,
    version: deployVersion,
    buildTime,
    worker: workerName,
  });
}
