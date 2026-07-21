// Compatibility shim. /host predates the single-URL entry; the canonical Host
// address is now the site root. Preserve any inbound bookmarks/QRs by redirecting
// to `/`, which applies the identical resolveHostEntry() logic. `/` never redirects
// back to `/host`, so there is no loop. The auth sub-routes (/host/auth/google,
// /host/connect, /host/logout, /host/rooms/*) are unaffected.

import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export default async function HostPage({
  searchParams,
}: {
  searchParams: Promise<{ notice?: string }>;
}) {
  const { notice } = await searchParams;
  redirect(notice ? `/?notice=${encodeURIComponent(notice)}` : '/');
}
