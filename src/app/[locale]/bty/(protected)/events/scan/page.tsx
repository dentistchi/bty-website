import EventScanClient from "@/components/bty/events/EventScanClient";

export const dynamic = "force-dynamic";

/**
 * Reality Event scan page (Slice 3.2D-EVENT) — the canonical Event QR target
 * (`/{locale}/bty/events/scan?ev=<btyev1 token>`). Under (protected): an
 * unauthenticated visitor is routed to login by the existing gate; the client
 * confirms participation against POST /api/bty/events/scan. Server-only job here
 * is to hand the opaque token to the client; the token is never verified here.
 */
export default async function EventScanPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ ev?: string }>;
}) {
  const { locale } = await params;
  const sp = await searchParams;
  const token = typeof sp.ev === "string" ? sp.ev : "";
  return <EventScanClient locale={locale} token={token} />;
}
