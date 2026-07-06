import BtyDailyAppShell from "@/components/app-shell/BtyDailyAppShell";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ locale: string }> };

/**
 * New BTY Daily App Shell v0 (skeleton) — a NEW app-like surface, deliberately
 * separate from the legacy web routes (/today, /center, /bty-arena, /bty/foundry,
 * /my-page). Those are not replaced or redirected here.
 *
 * Auth: `/[locale]/app` is a non-public locale path, so existing middleware
 * enforces the standard protected pattern (unauthenticated → /[locale]/bty/login).
 * No middleware/auth changes needed — the `/[locale]/:path*` matcher already covers it.
 * Native/Capacitor packaging is deferred until the core experience exists.
 */
export default async function BtyDailyAppPage({ params }: Props) {
  const { locale } = await params;
  const loc = locale === "ko" ? "ko" : "en";
  return <BtyDailyAppShell locale={loc} />;
}
