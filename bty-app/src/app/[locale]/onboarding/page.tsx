import { redirect } from "next/navigation";
import OnboardingShell from "@/components/onboarding/OnboardingShell";
import { getSupabaseServerClient } from "@/lib/bty/arena/supabaseServer";
import { isPostLoginOnboardingWizardEnabled } from "@/lib/bty/arena/postLoginEliteEntry";

type Props = { params: Promise<{ locale: string }> };

export const dynamic = "force-dynamic";

/**
 * Five-step onboarding — {@link OnboardingShell} (client).
 * **Middleware:** when `BTY_POST_LOGIN_ONBOARDING_ENABLED=1`, `user_onboarding_progress.step_completed < 5` → this page from gated routes.
 *
 * **Infrastructure redirects (static `/${locale}/bty-arena`):** wizard disabled or unauthenticated login bounce —
 * canonical Arena shell URL only; live routing still resolves in the shell via GET session-router. Not a product CTA.
 * @see `arenaProductVsInfrastructure.ts`
 */
export default async function OnboardingPage({ params }: Props) {
  const { locale } = await params;
  if (!isPostLoginOnboardingWizardEnabled()) {
    redirect(`/${locale}/bty-arena`);
  }
  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect(`/${locale}/bty/login?next=/${locale}/onboarding`);
  }
  return <OnboardingShell userId={user.id} locale={locale} />;
}
