import YoutubeUsageConsole from './YoutubeUsageConsole';
import LegalLinks from '@/components/legal/LegalLinks';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// The Manager YouTube quota console (read-only). Renders a shell only; every authority check
// happens server-side against the Manager session cookie, and the API returns a uniform 401 to an
// unauthenticated visitor — which the client turns into the shared Manager passcode prompt. This
// page changes nothing: no search runs, no quota is spent by viewing it.
export default function YoutubeUsagePage() {
  return (
    <main>
      <YoutubeUsageConsole />
      <LegalLinks showContact />
    </main>
  );
}
