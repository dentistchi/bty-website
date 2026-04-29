import { NextRequest, NextResponse } from "next/server";
import { requireAdminEmail } from "@/lib/authz";

export const runtime = "nodejs";

const BTY_AI_URL = process.env.NEXT_PUBLIC_BTY_AI_URL || "";
const ADMIN_API_KEY = process.env.ADMIN_API_KEY || "";
const DEPLOY_WEBHOOK_URL = process.env.DEPLOY_WEBHOOK_URL || ""; // Cloudflare Pages deploy hook or similar

/** POST: 패치 생성 + 배포 웹훅 (admin only when BTY_ADMIN_EMAILS set) */
export async function POST(req: NextRequest) {
  const auth = await requireAdminEmail(req);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const steps: { step: string; ok: boolean; detail?: string }[] = [];

  // 1) bty-ai-core 패치 생성 (선택)
  if (BTY_AI_URL && ADMIN_API_KEY) {
    try {
      const res = await fetch(`${BTY_AI_URL}/api/patch/generate?window=7d`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-admin-api-key": ADMIN_API_KEY,
        },
        body: JSON.stringify({}),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && (data.created || data.id)) {
        steps.push({ step: "patch_generate", ok: true, detail: data.id || "created" });
      } else {
        steps.push({ step: "patch_generate", ok: false, detail: data.message || data.error || `HTTP ${res.status}` });
      }
    } catch (e) {
      steps.push({ step: "patch_generate", ok: false, detail: e instanceof Error ? e.message : String(e) });
    }
  } else {
    steps.push({ step: "patch_generate", ok: true, detail: "skipped (BTY_AI_URL/ADMIN_API_KEY not set)" });
  }

  // 2) 배포 웹훅 호출
  if (DEPLOY_WEBHOOK_URL) {
    try {
      const res = await fetch(DEPLOY_WEBHOOK_URL, { method: "POST" });
      steps.push({
        step: "deploy_webhook",
        ok: res.ok,
        detail: res.ok ? `HTTP ${res.status}` : `HTTP ${res.status}`,
      });
    } catch (e) {
      steps.push({ step: "deploy_webhook", ok: false, detail: e instanceof Error ? e.message : String(e) });
    }
  } else {
    steps.push({ step: "deploy_webhook", ok: true, detail: "skipped (DEPLOY_WEBHOOK_URL not set)" });
  }

  const allOk = steps.every((s) => s.ok);
  return NextResponse.json({
    ok: allOk,
    steps,
    hint: !DEPLOY_WEBHOOK_URL
      ? "Set DEPLOY_WEBHOOK_URL in .env for one-click deploy (e.g. Cloudflare Pages deploy hook)"
      : undefined,
  });
}
