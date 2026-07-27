import EventCreateClient from "@/components/bty/events/EventCreateClient";

export const dynamic = "force-dynamic";

/**
 * Reality Event Host-create page (Slice 3.2D-EVENT). Under (protected): auth is
 * enforced by the existing gate. Leader-track authority is enforced by the create
 * API (POST /api/bty/events → 403 LEADER_TRACK_REQUIRED), surfaced by the client
 * as the canonical denial — no separate page-level org/actor derivation.
 */
export default async function EventCreatePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  return <EventCreateClient locale={locale} />;
}
