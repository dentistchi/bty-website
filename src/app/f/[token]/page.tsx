import FoundryJoinClient from "./FoundryJoinClient";
import FoundryDocumentClient from "./FoundryDocumentClient";
import FoundryGuidanceClient from "./FoundryGuidanceClient";
import FoundryUnsupportedRoom from "./FoundryUnsupportedRoom";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { resolveEventByToken } from "@/lib/bty/foundry/events/foundryEventService";
import { readContentType, isGuidanceContentType } from "@/domain/foundry/events/content-type";
import { cookies } from "next/headers";
import { LOCALE_COOKIE, isSavedLocale, type SavedLocale } from "@/lib/localePreference";

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
 * THE ROOM'S content_type SELECTS THE CLIENT, and since R4-R2G it does so EXHAUSTIVELY.
 *
 * This used to be `if (content_type === "document") … return <FoundryJoinClient/>`, where the
 * fall-through meant YouTube. That was safe with two values and became a silent downgrade the
 * moment a third existed: a written-guidance learner would have been handed the video room —
 * the wrong training, rendered confidently, with nothing anywhere to notice.
 *
 * Now an UNRECOGNISED discriminator gets its own honest surface. The one fall-through that
 * remains is for an UNRESOLVABLE TOKEN, which is a different fact entirely (there is no event to
 * have a type) and which the YouTube client already renders as the same calm "inactive" state it
 * always has.
 */
export default async function FoundryJoinPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  /*
    THE LANGUAGE IS DECIDED HERE, BEFORE THE FIRST PAINT (Slice R4-R5C16A).

    This route is deliberately outside `/[locale]`, so it carries no locale in its path — and the
    three clients each fell back to `navigator.language`, which is the DEVICE's language rather
    than the one the person chose in BTY. `NEXT_LOCALE` travels with this request like any other
    (`path: "/"`, not httpOnly), so the preference is readable right here and can be handed down
    as a prop. That is what removes the English-then-Korean flash: the entry screen is already in
    the right language on the first render.

    A learner who has never opened the app has no preference, and `null` is passed so the client
    can fall back to the device — which is the only signal that exists for them.
  */
  const savedLocale: SavedLocale | null = await (async () => {
    try {
      const raw = (await cookies()).get(LOCALE_COOKIE)?.value;
      return isSavedLocale(raw) ? raw : null;
    } catch {
      return null;
    }
  })();

  const admin = getSupabaseAdmin();
  if (admin) {
    const resolved = await resolveEventByToken(admin, token);
    if (resolved.ok) {
      const contentType = readContentType(resolved.event.content_type);
      if (contentType === null) return <FoundryUnsupportedRoom />;
      if (contentType === "document") return <FoundryDocumentClient token={token} savedLocale={savedLocale} />;
      if (isGuidanceContentType(contentType)) {
        return <FoundryGuidanceClient token={token} contentType={contentType} savedLocale={savedLocale} />;
      }
    }
  }
  return <FoundryJoinClient token={token} savedLocale={savedLocale} />;
}
