import { redirect } from "next/navigation";

type Props = { params: Promise<{ locale: string }> };

/**
 * LEGACY PORTAL ENTRY — a temporary compatibility door into the canonical product.
 *
 * This route rendered the D3-1 "Today" portal, and it is the ONE call site in the repository that
 * passes `surface="navy"` to `ScreenShell` — so it looked like the current product on arrival while
 * wearing the fixed 5-tab `BottomNav`, whose four other tabs cross into routes where the same
 * `ScreenShell` takes its beige default. New shell over old content, on four tabs out of five.
 *
 * WHAT WAS MEASURED BEFORE CLOSING IT. Nothing legitimate still depended on it: no canonical `/app`
 * surface navigates here, no auth flow names it as a `next`, the native shell cannot reach it,
 * middleware and root routing never choose it, and no test treats it as canonical. `git log -S`
 * over every outbound URL builder — event QR, assignment room, action-contract secure link, the one
 * mailer — is EMPTY, so no link BTY ever sent points here. The only exposure left is a bookmark,
 * which is exactly what a redirect is for.
 *
 * It parses no query parameters and has no nested routes, so there is no deep-link intent to carry.
 *
 * TEMPORARY, DELIBERATELY. `redirect` and not `permanentRedirect`: this route is auth-gated and
 * product-internal rather than SEO-sensitive, and a 308 cached in browsers would be genuinely
 * painful to walk back if the retired surface is ever wanted again.
 *
 * NOTHING ELSE MOVED. `page.client.tsx`, `CriticalGateCheckHost`, the three relationship doors,
 * `todayRoutes.ts`, `BottomNav`, `nav-items.ts` and every legacy sibling route are untouched — the
 * retired three-door IA remains preserved in code exactly as Slice 3.1B-3J.1 required. This closes
 * an entry door; it does not migrate a product.
 */
export default async function TodayPage({ params }: Props) {
  const { locale } = await params;
  const loc = locale === "ko" ? "ko" : "en";
  redirect(`/${loc}/app`);
}
