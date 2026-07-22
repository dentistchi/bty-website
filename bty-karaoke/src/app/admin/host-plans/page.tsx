import HostPlansConsole from './HostPlansConsole';
import LegalLinks from '@/components/legal/LegalLinks';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// The Manager Host Plans console (read-only). Renders a shell only; all authority
// checks happen server-side against the Manager session cookie (the list/detail APIs
// return a uniform 401 to an unauthenticated visitor, which the client turns into the
// shared Manager passcode prompt). This page changes nothing and shows no plan-change
// controls — FREE↔PRO is done only via the existing operator API.
export default function HostPlansPage() {
  return (
    <main>
      <HostPlansConsole />
      <LegalLinks showContact />
    </main>
  );
}
