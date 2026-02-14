import { AuthGate } from "@/components/AuthGate";
import { EmotionalBridge } from "@/components/EmotionalBridge";
import { Nav } from "@/components/Nav";
import { ResilienceGraph } from "@/components/ResilienceGraph";
import { SafeMirror } from "@/components/SafeMirror";
import { SelfEsteemTest } from "@/components/SelfEsteemTest";
import { SmallWinsStack } from "@/components/SmallWinsStack";
import { ThemeBody } from "@/components/ThemeBody";
import { PaperCard } from "@/components/ui/PaperCard";
import { getMessages } from "@/lib/i18n";
import AuthHashGate from "./_components/AuthHashGate";

export default function LandingPage() {
  const t = getMessages("ko").todayMe;
  return (
    <>
      <AuthHashGate />
      <AuthGate>
      <ThemeBody theme="dear" />
      <main className="min-h-screen">
        <div className="max-w-xl mx-auto px-4 py-6 sm:py-10">
          <Nav locale="ko" pathname="/" theme="dear" />

          {/* Hero — Dear Me, I'm listening. */}
          <header className="text-center mb-14 sm:mb-16 pt-4">
            <h1 className="font-serif text-3xl sm:text-4xl md:text-[2.75rem] font-medium text-dear-charcoal tracking-tight leading-tight">
              Dear Me,
              <br />
              <span className="text-dear-sage">I&apos;m listening.</span>
            </h1>
            <p className="mt-4 text-dear-charcoal-soft text-base sm:text-lg font-sans max-w-md mx-auto">
              {t.tagline}
            </p>
          </header>

          <div className="space-y-8">
            <PaperCard>
              <SafeMirror locale="ko" theme="dear" />
            </PaperCard>
            <PaperCard>
              <SmallWinsStack locale="ko" theme="dear" />
            </PaperCard>
            <PaperCard>
              <ResilienceGraph theme="dear" />
            </PaperCard>
            <PaperCard>
              <SelfEsteemTest locale="ko" theme="dear" />
            </PaperCard>
            <PaperCard>
              <EmotionalBridge theme="dear" locale="ko" />
            </PaperCard>
          </div>

          <footer className="mt-12 pt-6 border-t border-dear-charcoal/10 text-center text-sm text-dear-charcoal-soft">
            <a href="/bty" className="text-dear-sage hover:text-dear-sage-soft underline underline-offset-2">
              {t.linkToBty}
            </a>
          </footer>
        </div>
      </main>
    </AuthGate>
    </>
  );
}
