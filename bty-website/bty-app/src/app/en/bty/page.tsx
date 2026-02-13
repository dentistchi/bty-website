import { AuthGate } from "@/components/AuthGate";
import { Comeback } from "@/components/Comeback";
import { IntegritySimulator } from "@/components/IntegritySimulator";
import { Nav } from "@/components/Nav";
import { PracticeJournal } from "@/components/PracticeJournal";
import { ThemeBody } from "@/components/ThemeBody";
import { getMessages } from "@/lib/i18n";

export default function BTYEnPage() {
  const t = getMessages("en").bty;
  return (
    <AuthGate>
      <ThemeBody theme="dojo" />
      <main className="min-h-screen bg-dojo-white">
        <Comeback />
        <div className="max-w-xl mx-auto px-4 py-6 sm:py-10">
          <Nav locale="en" pathname="/en/bty" />
          <header className="text-center mb-10">
            <h1 className="text-2xl sm:text-3xl font-semibold text-dojo-purple-dark">{t.title}</h1>
            <p className="text-dojo-ink-soft mt-1">{t.tagline}</p>
          </header>
          <div className="space-y-8">
            <IntegritySimulator />
            <PracticeJournal />
          </div>
          <footer className="mt-12 pt-6 border-t border-dojo-purple-muted text-center text-sm text-dojo-ink-soft">
            <a href="/en" className="text-dojo-purple hover:underline">
              {t.linkToTodayMe}
            </a>
          </footer>
        </div>
      </main>
    </AuthGate>
  );
}
