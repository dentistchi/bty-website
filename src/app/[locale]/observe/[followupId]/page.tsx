import ObserverClient from "./ObserverClient";
import type { Locale } from "@/components/foundry/event-rooms/copy";

export const dynamic = "force-dynamic";

/**
 * `/{locale}/observe/{followupId}` — the observer's door (Slice 3.2M-5).
 *
 * A top-level static segment under `[locale]` with one dynamic child, so no dynamic sibling can
 * shadow it on the Cloudflare runtime. Inside `[locale]`, so the middleware auth gate applies:
 * an anonymous visitor is sent to sign in rather than shown a page that would then fail.
 *
 * The page itself decides nothing. It renders a client that asks the server who this observer
 * is authorised to observe; possession of the link is not authority and never becomes any.
 */
export default async function ObservePage({
  params,
}: {
  params: Promise<{ locale: string; followupId: string }>;
}) {
  const { locale, followupId } = await params;
  return <ObserverClient followupId={followupId} locale={locale === "ko" ? "ko" : ("en" as Locale)} />;
}
