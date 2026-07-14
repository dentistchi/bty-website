import FoundryJoinClient from "./FoundryJoinClient";

export const dynamic = "force-dynamic";

/**
 * Public employee join landing — `/f/[token]`.
 *
 * DELIBERATELY locale-less and outside `/[locale]` and `/bty`: it is NOT in the
 * middleware matcher, so no auth redirect fires and no Arena top-nav / BottomNav
 * shell wraps it. An employee scans the QR, opens this on mobile web with no app
 * install and no account, and joins by name. All state is read from the server
 * snapshot — nothing is trusted from the client.
 */
export default async function FoundryJoinPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  return <FoundryJoinClient token={token} />;
}
