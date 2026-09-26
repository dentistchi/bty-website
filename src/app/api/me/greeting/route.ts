/**
 * GET /api/me/greeting — how Today addresses the signed-in person (Today Personal Greeting).
 *
 * OWNER-SCOPED. Returns ONLY `{ ok, address: { kind, addressee } }`: the form of address and the
 * single name token that goes in it. The canonical position that CHOSE that form is read
 * server-side and never serialized — no job title, no role, no email leaves this route.
 *
 * Unauthenticated / no usable identity → the generic address, so Today renders exactly the
 * greeting it renders today. private, no-store.
 */
import { NextResponse } from "next/server";
import { consentRequiredResponse, isConsentCurrent } from "@/lib/legal/activeConsent";
import { getSupabaseServer } from "@/lib/supabase-server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { GENERIC_GREETING_ADDRESS } from "@/domain/daily/greetingAddress";
import { resolveGreetingIdentity } from "@/lib/bty/daily/greetingIdentity.server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const noStore = (res: NextResponse) => {
  res.headers.set("Cache-Control", "private, no-store");
  return res;
};

const generic = (status: number) =>
  noStore(NextResponse.json({ ok: status === 200, address: GENERIC_GREETING_ADDRESS }, { status }));

export async function GET() {
  try {
    const supabase = await getSupabaseServer();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return generic(401);
    if (!(await isConsentCurrent(supabase, user.id))) return consentRequiredResponse();

    const admin = getSupabaseAdmin();
    if (!admin) return generic(200);

    const address = await resolveGreetingIdentity(admin, user.id, user.user_metadata);
    return noStore(NextResponse.json({ ok: true, address }, { status: 200 }));
  } catch {
    return generic(200);
  }
}
