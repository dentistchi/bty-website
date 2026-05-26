import { redirect } from "next/navigation";
import ScreenShell from "@/components/bty/layout/ScreenShell";
import { BtyMyPageTabs } from "@/components/bty/navigation/BtyMyPageTabs";
import { DashboardBackLink } from "@/components/bty/navigation/DashboardBackLink";
import TeamMembershipForm, {
  type TeamMembershipRequest,
} from "@/components/bty/membership/TeamMembershipForm";
import { getSupabaseServerClient } from "@/lib/bty/arena/supabaseServer";
import { getMessages } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n";

type Props = { params: Promise<{ locale: string }> };

export const dynamic = "force-dynamic";

/** Team — membership submission (S2: profile → admin approve → Arena access). */
export default async function Page({ params }: Props) {
  const { locale } = await params;
  const loc = (locale === "ko" ? "ko" : "en") as Locale;
  const m = getMessages(loc).myPageStub;

  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/${locale}/bty/login`);

  // Server-fetch the caller's membership (RLS self-read returns only their row).
  // On query error → treat as no row (the form renders; the POST is safe to re-submit).
  const { data } = await supabase
    .from("arena_membership_requests")
    .select("job_function, joined_at, leader_started_at, status, approved_at")
    .eq("user_id", user.id)
    .maybeSingle();
  const initialRequest = (data as TeamMembershipRequest | null) ?? null;

  return (
    <ScreenShell
      locale={locale}
      eyebrow={m.teamTitle}
      title={m.myPageShellTeamTitle}
      subtitle={m.myPageShellTeamSubtitle}
    >
      <DashboardBackLink locale={locale} />
      <div className="mb-5">
        <BtyMyPageTabs locale={locale} />
      </div>

      <TeamMembershipForm locale={loc} initialRequest={initialRequest} />
    </ScreenShell>
  );
}
