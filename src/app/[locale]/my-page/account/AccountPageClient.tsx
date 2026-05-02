"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type Labels = {
  profileSection: string;
  profileLink: string;
  avatarLink: string;
  securitySection: string;
  passwordDesc: string;
  passwordResetCta: string;
  langSection: string;
  langKo: string;
  langEn: string;
  signOut: string;
};

type Props = { locale: string; labels: Labels };

export default function AccountPageClient({ locale, labels }: Props) {
  const [email, setEmail] = useState<string | null>(null);
  const [resetSent, setResetSent] = useState(false);
  const [resetError, setResetError] = useState<string | null>(null);
  const [resetLoading, setResetLoading] = useState(false);

  useEffect(() => {
    fetch("/api/arena/session/next", { credentials: "include" })
      .then((r) => r.json())
      .then((d) => {
        if (d?.user?.email) setEmail(d.user.email);
      })
      .catch(() => {});
  }, []);

  async function sendResetEmail() {
    if (!email || resetLoading) return;
    setResetLoading(true);
    setResetError(null);
    try {
      const res = await fetch("/api/auth/send-reset-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
        credentials: "include",
      });
      if (res.ok) {
        setResetSent(true);
      } else {
        const d = await res.json().catch(() => ({}));
        setResetError((d as { error?: string }).error ?? "Failed to send");
      }
    } catch {
      setResetError("Failed to send");
    } finally {
      setResetLoading(false);
    }
  }

  const isKo = locale === "ko";
  const otherLocale = isKo ? "en" : "ko";

  return (
    <div className="space-y-4">
      {/* Profile section */}
      <div className="rounded-[28px] border border-[#E8E3D8] bg-white p-5 shadow-sm">
        <p className="mb-3 text-sm font-medium uppercase tracking-wide text-[#667085]">
          {labels.profileSection}
        </p>
        {email && (
          <div className="mb-3 flex items-center justify-between text-sm">
            <span className="text-[#667085]">{isKo ? "이메일" : "Email"}</span>
            <span className="font-mono text-xs text-[#1E2A38]">{email}</span>
          </div>
        )}
        <div className="flex flex-col gap-2 sm:flex-row sm:gap-3">
          <Link
            href={`/${locale}/bty/profile`}
            className="flex-1 rounded-2xl border border-[#E8E3D8] bg-[#F6F4EE] px-4 py-2.5 text-center text-sm font-medium text-[#1E2A38] hover:bg-[#eeeae0] transition-colors"
          >
            {labels.profileLink}
          </Link>
          <Link
            href={`/${locale}/bty/profile/avatar`}
            className="flex-1 rounded-2xl border border-[#E8E3D8] bg-[#F6F4EE] px-4 py-2.5 text-center text-sm font-medium text-[#1E2A38] hover:bg-[#eeeae0] transition-colors"
          >
            {labels.avatarLink}
          </Link>
        </div>
      </div>

      {/* Language section */}
      <div className="rounded-[28px] border border-[#E8E3D8] bg-white p-5 shadow-sm">
        <p className="mb-3 text-sm font-medium uppercase tracking-wide text-[#667085]">
          {labels.langSection}
        </p>
        <div className="flex gap-2">
          {isKo ? (
            <span className="rounded-full px-3 py-1 text-sm font-medium bg-[#1E2A38] text-white">
              {labels.langKo}
            </span>
          ) : (
            <Link
              href="/ko/my-page/account"
              className="rounded-full px-3 py-1 text-sm font-medium border border-[#E8E3D8] text-[#667085] hover:bg-[#F6F4EE]"
            >
              {labels.langKo}
            </Link>
          )}
          {!isKo ? (
            <span className="rounded-full px-3 py-1 text-sm font-medium bg-[#1E2A38] text-white">
              {labels.langEn}
            </span>
          ) : (
            <Link
              href="/en/my-page/account"
              className="rounded-full px-3 py-1 text-sm font-medium border border-[#E8E3D8] text-[#667085] hover:bg-[#F6F4EE]"
            >
              {labels.langEn}
            </Link>
          )}
        </div>
      </div>

      {/* Security section */}
      <div className="rounded-[28px] border border-[#E8E3D8] bg-white p-5 shadow-sm">
        <p className="mb-2 text-sm font-medium uppercase tracking-wide text-[#667085]">
          {labels.securitySection}
        </p>
        <p className="text-sm leading-relaxed text-[#667085] mb-3">{labels.passwordDesc}</p>
        {resetSent ? (
          <p className="text-sm text-green-700">{locale === "ko" ? "재설정 이메일을 보냈습니다. 받은 편지함을 확인해 주세요." : "Reset email sent. Check your inbox."}</p>
        ) : (
          <>
            <button
              type="button"
              onClick={() => void sendResetEmail()}
              disabled={!email || resetLoading}
              className="rounded-xl px-4 py-2 text-sm font-medium border border-[#E8E3D8] bg-[#F6F4EE] text-[#1E2A38] hover:bg-[#eeeae0] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {resetLoading ? "Sending…" : labels.passwordResetCta}
            </button>
            {resetError && <p className="mt-2 text-xs text-red-600">{resetError}</p>}
          </>
        )}
      </div>

      {/* Sign out */}
      <div className="pt-2 text-center">
        <Link
          href={`/${locale}/bty/logout`}
          className="text-sm text-[#98A2B3] underline-offset-2 hover:text-[#667085] hover:underline"
        >
          {labels.signOut}
        </Link>
      </div>
    </div>
  );
}
