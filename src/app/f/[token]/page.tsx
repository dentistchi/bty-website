import FoundryJoinClient from "./FoundryJoinClient";
import FoundryDocumentClient from "./FoundryDocumentClient";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { resolveEventByToken } from "@/lib/bty/foundry/events/foundryEventService";

export const dynamic = "force-dynamic";

/**
 * Public employee join landing — `/f/[token]`.
 *
 * DELIBERATELY locale-less and outside `/[locale]` and `/bty`: it is NOT in the
 * middleware matcher, so no auth redirect fires and no Arena top-nav / BottomNav
 * shell wraps it. An employee scans the QR, opens this on mobile web with no app
 * install and no account, and joins by name. All state is read from the server
 * snapshot — nothing is trusted from the client.
 *
 * The room's content_type (resolved server-side from the signed token) selects
 * the client: the YouTube training experience or the PDF Study Room. An invalid/
 * unresolvable token falls back to the YouTube client, which renders the same
 * calm "inactive" state.
 */
export default async function FoundryJoinPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  const admin = getSupabaseAdmin();
  if (admin) {
    const resolved = await resolveEventByToken(admin, token);
    if (resolved.ok && resolved.event.content_type === "document") {
      return <FoundryDocumentClient token={token} />;
    }
  }
  return <FoundryJoinClient token={token} />;
}
