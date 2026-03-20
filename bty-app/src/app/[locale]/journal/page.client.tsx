"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import HubTopNav from "@/components/bty/HubTopNav";
import { PageLoadingFallback } from "@/components/bty-arena";
import { getMessages, type Locale } from "@/lib/i18n";

export default function JournalPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const params = useParams();
  const locale = params?.locale === "ko" ? "ko" : "en";
  const t = getMessages(locale as Locale).journal;
  const [chatOpen, setChatOpen] = useState(false);

  useEffect(() => {
    if (!loading && !user) {
      const next = `/${locale}/journal`;
      router.replace(`/${locale}/bty/login?next=${encodeURIComponent(next)}`);
    }
  }, [loading, user, router, locale]);

  if (loading) {
    return (
      <main aria-label={t.journalLoadingMainRegionAria} className="min-h-screen bg-white">
        <PageLoadingFallback />
      </main>
    );
  }
  if (!user) {
    return (
      <main aria-label={t.journalRedirectingMainRegionAria} className="min-h-screen bg-white">
        <p className="p-6 text-sm text-neutral-600">{t.journalRedirectingMessage}</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-white" aria-label={t.journalMainRegionAria}>
      <div className="max-w-xl mx-auto p-6 space-y-4">
        <HubTopNav theme="dear" showLangSwitch />
        <h1 className="text-2xl font-semibold">{t.title}</h1>
        <p className="opacity-70 text-sm">{t.subtitle}</p>

        <div className="rounded-lg border p-4 space-y-3">
          <div className="font-medium">{t.prompt}</div>
          <textarea className="w-full border rounded p-2 min-h-[120px]" placeholder={t.placeholder} />
          <button type="button" className="px-3 py-2 border rounded" aria-label={t.saveAria}>
            {t.save}
          </button>
        </div>
      </div>

      <p className="max-w-xl mx-auto px-6 pb-4 text-center text-sm text-gray-500">{t.footerDrChi}</p>

      <button
        type="button"
        className="fixed bottom-6 right-6 w-14 h-14 rounded-full border shadow bg-white"
        onClick={() => setChatOpen((v) => !v)}
        aria-label={t.chatToggleAria}
      >
        {t.chatToggle}
      </button>

      {chatOpen && (
        <div className="fixed inset-0 z-50 bg-black/30" onClick={() => setChatOpen(false)}>
          <div
            className="absolute right-0 bottom-0 top-0 w-[90%] max-w-md bg-white"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="h-12 border-b px-4 flex items-center justify-between">
              <div className="font-semibold">{t.chatTitle}</div>
              <button type="button" className="text-sm underline" onClick={() => setChatOpen(false)} aria-label={t.chatCloseAria}>
                {t.chatClose}
              </button>
            </div>
            <div className="p-4 text-sm">{t.chatStub}</div>
          </div>
        </div>
      )}
    </main>
  );
}
