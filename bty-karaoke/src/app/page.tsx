// Canonical public entry for the browser Host: https://<domain>/
// The single URL a Host must remember. All branching (login / auto-enter / chooser
// / empty) lives in HostEntryScreen, driven by the pure resolveHostEntry().
// Guests never need this URL — they join an event by its room link (/r/<slug>).

import HostEntryScreen from './host/HostEntryScreen';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ notice?: string; view?: string }>;
}) {
  const { notice, view } = await searchParams;
  return <HostEntryScreen notice={notice} view={view} />;
}
