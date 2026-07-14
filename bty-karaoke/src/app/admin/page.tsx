import ManagerConsole from './ManagerConsole';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// The manager Event Home. Renders a shell only; all authority checks happen
// client-side against the server (the passcode → HttpOnly session cookie). The
// page never reveals whether the feature is configured — an unauthenticated
// visitor always sees the same passcode prompt, and a wrong/absent passcode
// yields the same uniform failure. No credential ever lands in the URL or HTML.
export default function AdminHome() {
  return (
    <main>
      <ManagerConsole />
    </main>
  );
}
