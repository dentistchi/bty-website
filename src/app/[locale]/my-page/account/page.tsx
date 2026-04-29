import Link from "next/link";
import { Suspense } from "react";
import ScreenShell from "@/components/bty/layout/ScreenShell";
import { BtyMyPageTabs } from "@/components/bty/navigation/BtyMyPageTabs";
import { DashboardBackLink } from "@/components/bty/navigation/DashboardBackLink";
import { getMessages } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n";
import AccountPageClient from "./AccountPageClient";

type Props = { params: Promise<{ locale: string }> };

export const dynamic = "force-dynamic";

export default async function AccountPage({ params }: Props) {
  const { locale } = await params;
  const loc = (locale === "ko" ? "ko" : "en") as Locale;
  const m = getMessages(loc).myPageStub;
  const isKo = locale === "ko";

  const labels = {
    title: isKo ? "계정 설정" : "Account Settings",
    subtitle: isKo ? "프로필, 언어, 비밀번호 설정" : "Profile, language, and password settings",
    profileSection: isKo ? "프로필" : "Profile",
    profileLink: isKo ? "프로필 편집" : "Edit Profile",
    avatarLink: isKo ? "아바타 설정" : "Avatar Settings",
    securitySection: isKo ? "보안" : "Security",
    passwordDesc: isKo ? "비밀번호 변경은 이메일 재설정 링크를 통해 진행합니다." : "Password changes are handled via email reset link.",
    langSection: isKo ? "언어" : "Language",
    langKo: "한국어",
    langEn: "English",
    signOut: isKo ? "로그아웃" : "Sign out",
  };

  return (
    <ScreenShell
      locale={locale}
      eyebrow={m.myPageTabAccount}
      title={labels.title}
      subtitle={labels.subtitle}
    >
      <DashboardBackLink locale={locale} />
      <div className="mb-5">
        <BtyMyPageTabs locale={locale} />
      </div>

      <Suspense>
        <AccountPageClient locale={locale} labels={labels} />
      </Suspense>
    </ScreenShell>
  );
}
