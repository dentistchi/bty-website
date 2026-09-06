import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { requireUser, unauthenticated, copyCookiesAndDebug } from "@/lib/supabase/route-client";
import { postThreadMessage, readThread } from "@/lib/bty/announcement/announcementThread.server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * ONE PRIVATE HOST ↔ RECIPIENT CONVERSATION.
 *
 *   GET  /api/bty/announcements/recipients/[recipientId]/thread   read it, and mark my side read
 *   POST /api/bty/announcements/recipients/[recipientId]/thread   say one thing
 *
 * ★ THE ADDRESS IS A RECIPIENT, NOT AN ANNOUNCEMENT, AND THAT IS THE PRIVACY MODEL.
 *
 * An announcement has many recipients. If this route took an announcement id, three people picked
 * out of one Teams message would share one thread, and Person B asking "I don't understand the pay
 * change" would become something A and C could read. The unit is therefore the recipient ROW — the
 * same row that already owns the response, the question, the handled state and the delivery lease —
 * and each one is a separate two-party conversation the Host holds independently.
 *
 * ★ AUTHORITY IS NEVER TAKEN FROM THE REQUEST, INCLUDING THE PATH.
 *
 * Possessing a recipient id proves nothing. Both verbs resolve the caller through
 * `bty_resolve_announcement_thread_role`, which joins the row to its announcement owner in SQL and
 * answers HOST, RECIPIENT, or `none`. A different Host, ANOTHER RECIPIENT OF THE SAME ANNOUNCEMENT,
 * an unbound person and a uuid that names nothing all receive the identical `404` — so this cannot
 * be used to discover that a conversation exists, let alone read one.
 *
 * ★ THE BODY CARRIES TEXT AND A NONCE. NOTHING ELSE.
 *
 * There is no author, no role, no user id, no announcement id and no recipient id in the payload.
 * `role` in particular is DERIVED and stored server-side: a request that claims to be the Host is
 * not treated differently from one that does not, because nothing reads the claim. A crafted body
 * has one field to aim at, and that field is the message.
 *
 * ★ APPEND-ONLY. There is deliberately no PATCH, no PUT and no DELETE here, and none is possible
 * further down either: service_role holds SELECT and INSERT on the message table and no UPDATE or
 * DELETE grant at all.
 *
 * Arena learner consent is deliberately not consulted — the same boundary already corrected on the
 * Host, recipient and handle routes. This is a workplace message workflow.
 */

const POST_STATUS: Record<string, number> = {
  not_found: 404,
  empty_message: 400,
  message_too_long: 400,
  failed: 500,
};

export async function GET(req: NextRequest, ctx: { params: Promise<{ recipientId: string }> }) {
  const { user, base } = await requireUser(req);
  if (!user) return unauthenticated(req, base);

  const admin = getSupabaseAdmin();
  if (!admin) return NextResponse.json({ ok: false }, { status: 503 });

  const { recipientId } = await ctx.params;
  const result = await readThread(admin, { recipientId, actorUserId: user.id });

  if (!result.ok) {
    // `failed` is a real server fault; `not_found` covers both "no such thread" and "not yours".
    const res = NextResponse.json(
      { ok: false, code: result.reason },
      { status: result.reason === "not_found" ? 404 : 500 },
    );
    res.headers.set("Cache-Control", "private, no-store");
    return res;
  }

  const res = NextResponse.json({ ok: true, role: result.role, messages: result.messages }, { status: 200 });
  res.headers.set("Cache-Control", "private, no-store");
  copyCookiesAndDebug(base, res, req, true);
  return res;
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ recipientId: string }> }) {
  const { user, base } = await requireUser(req);
  if (!user) return unauthenticated(req, base);

  const admin = getSupabaseAdmin();
  if (!admin) return NextResponse.json({ ok: false }, { status: 503 });

  const { recipientId } = await ctx.params;
  const body = (await req.json().catch(() => ({}))) as { body?: unknown; clientMessageId?: unknown };

  const result = await postThreadMessage(admin, {
    recipientId,
    actorUserId: user.id,
    body: body?.body,
    // A double-tapped Send carries the same nonce, and the second one returns the FIRST message
    // instead of writing a second. It addresses nothing: it is scoped under (recipient, author).
    clientMessageId: body?.clientMessageId,
  });

  if (!result.ok) {
    const res = NextResponse.json({ ok: false, code: result.reason }, { status: POST_STATUS[result.reason] ?? 500 });
    res.headers.set("Cache-Control", "private, no-store");
    return res;
  }

  // `duplicate` is a 200: from the person's point of view the thing they said is in the thread,
  // exactly once, which is what they asked for.
  const res = NextResponse.json(
    { ok: true, messageId: result.messageId, role: result.role, duplicate: result.duplicate },
    { status: 200 },
  );
  res.headers.set("Cache-Control", "private, no-store");
  copyCookiesAndDebug(base, res, req, true);
  return res;
}
