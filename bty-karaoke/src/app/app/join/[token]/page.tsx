// Web fallback for the Guest-to-App Universal Link (BUILD 19B). When the app is INSTALLED,
// iOS intercepts /app/join/* and opens the native Guest destination — this page never loads.
// When NOT installed, Safari renders this: a calm "앱 연결 준비 완료" with a safe route back to
// the public web Guest page (slug derived server-side via the resolve API, never in the URL,
// and never revealed for an invalid/expired token). No fake App Store URL, no redirect loop,
// no clipboard/fingerprinting.

import JoinFallbackClient from './JoinFallbackClient';

export const dynamic = 'force-dynamic';

export default async function Page({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return <JoinFallbackClient token={token} />;
}
