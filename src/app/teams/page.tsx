import TeamsTabShell from "@/components/teams/TeamsTabShell";

export const dynamic = "force-dynamic";

/**
 * `/teams` — the Teams Personal Tab `contentUrl`. Slice A0.
 *
 * It does NOT redirect to `/{locale}/app`. That route is served `X-Frame-Options: DENY` like every
 * other BTY page, so navigating the Teams iframe to it would blank the tab. The frame exception is
 * granted to `/teams/*` and only `/teams/*`, so the tab stays here and renders the SAME
 * `BtyDailyAppShell` in place — one BTY UI, not a second Teams product.
 *
 * Nothing authenticated happens on the server here, exactly as on `/[locale]/app`: the shell is a
 * client component and every read is an authenticated API call.
 */
export default function TeamsTabPage() {
  return <TeamsTabShell />;
}
