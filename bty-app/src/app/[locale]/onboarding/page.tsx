import { redirect } from "next/navigation";
import OnboardingShell from "@/components/onboarding/OnboardingShell";
import { getSupabaseServerClient } from "@/lib/bty/arena/supabaseServer";

type Props = { params: Promise<{ locale: string }> };

export const dynamic = "force-dynamic";

/**
 * Five-step onboarding — {@link OnboardingShell} (client).
 * **Middleware:** `user_onboarding_progress.step_completed < 5` → redirect to this page from gated routes (`/bty-arena`, `/bty/foundry`, `/center`); completed users hitting `/onboarding` → `/bty-arena`.
 */
export default async function OnboardingPage({ params }: Props) {
  const { locale } = await params;
  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect(`/${locale}/bty/login?next=/${locale}/onboarding`);
  }
  return <OnboardingShell userId={user.id} locale={locale} />;
}
