import { NextRequest, NextResponse } from "next/server";
import { requireUser, unauthenticated, copyCookiesAndDebug } from "@/lib/supabase/route-client";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
/** Explicit BTY actions only. Listing a card, opening Teams, or reading a thread records no evidence. */
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { user, base } = await requireUser(req);
  if (!user) return unauthenticated(req, base);
  const { id } = await ctx.params;
  const body = await req.json().catch(() => null);
  if (!body || !["open", "acknowledge", "respond"].includes(body.action) ||
      (body.action === "respond" && (typeof body.text !== "string" || !body.text.trim() || body.text.trim().length > 1000))) {
    return NextResponse.json({ ok: false, code: "invalid_action" }, { status: 400 });
  }
  const admin = getSupabaseAdmin();
  if (!admin) return NextResponse.json({ ok: false }, { status: 503 });
  const { data, error } = await admin.rpc("bty_record_announcement_evidence", {
    p_announcement_id: id, p_actor_user_id: user.id, p_action: body.action,
    p_response_text: body.action === "respond" ? body.text.trim() : null,
  });
  const result = (Array.isArray(data) ? data[0] : data)?.result;
  const ok = !error && result === "recorded";
  const res = NextResponse.json({ ok }, { status: ok ? 200 : error ? 503 : result === "not_a_recipient" ? 404 : 409 });
  res.headers.set("Cache-Control", "private, no-store");
  copyCookiesAndDebug(base, res, req, true);
  return res;
}
