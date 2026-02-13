import { AuthGate } from "@/components/AuthGate";
import { DearMeChat } from "@/components/DearMeChat";

export default function TodayMePage() {
  return (
    <AuthGate>
      <main className="min-h-screen">
        <div className="max-w-2xl mx-auto px-4 py-12 sm:py-16">
          <header className="text-center mb-12">
            <h1 className="text-2xl sm:text-3xl font-medium text-sanctuary-text mb-2">
              Dear Me
            </h1>
            <p className="text-sanctuary-text-soft">
              나는 안전하다. 잠시 쉬어가도 돼요.
            </p>
          </header>

          <DearMeChat />

          <footer className="mt-16 pt-6 border-t border-sanctuary-peach/40 text-center text-sm text-sanctuary-text-soft space-x-4">
            <a href="/journey" className="underline hover:text-sanctuary-text">
              28일 여정
            </a>
            <span>·</span>
            <a
              href="https://bty-website.pages.dev"
              className="underline hover:text-sanctuary-text"
            >
              어제보다 나은 연습하러 가기 (bty)
            </a>
          </footer>
        </div>
      </main>
    </AuthGate>
  );
}
