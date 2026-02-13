import { AuthGate } from "@/components/AuthGate";
import { EmotionalBridge } from "@/components/EmotionalBridge";
import { Nav } from "@/components/Nav";
import { ResilienceGraph } from "@/components/ResilienceGraph";
import { SafeMirror } from "@/components/SafeMirror";
import { SelfEsteemTest } from "@/components/SelfEsteemTest";
import { SmallWinsStack } from "@/components/SmallWinsStack";
import { ThemeBody } from "@/components/ThemeBody";
import { getMessages } from "@/lib/i18n";

export default function TodayMeEnPage() {
  const t = getMessages("en").todayMe;
  return (
    <AuthGate>
      <ThemeBody theme="sanctuary" />
      <main className="min-h-screen">
        <div className="max-w-xl mx-auto px-4 py-6 sm:py-10">
          <Nav locale="en" pathname="/en" />
          <header className="text-center mb-10">
            <h1 className="text-2xl sm:text-3xl font-medium text-sanctuary-text mb-2">{t.title}</h1>
            <p className="text-sanctuary-text-soft">{t.tagline}</p>
          </header>
          <div className="space-y-8">
            <SafeMirror locale="en" />
            <SmallWinsStack locale="en" />
            <ResilienceGraph theme="sanctuary" locale="en" />
            <SelfEsteemTest locale="en" />
            <EmotionalBridge theme="sanctuary" locale="en" />
          </div>
          <footer className="mt-12 pt-6 border-t border-sanctuary-peach/40 text-center text-sm text-sanctuary-text-soft">
            <a href="/en/bty" className="underline hover:text-sanctuary-text">
              {t.linkToBty}
            </a>
          </footer>
        </div>
      </main>
    </AuthGate>
  );
}
