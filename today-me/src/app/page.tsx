import { AuthGate } from "@/components/AuthGate";
import { SafeMirror } from "@/components/SafeMirror";
import { SmallWinsStack } from "@/components/SmallWinsStack";
import { SelfEsteemTest } from "@/components/SelfEsteemTest";

export default function TodayMePage() {
  return (
    <AuthGate>
    <main className="min-h-screen">
      <div className="max-w-xl mx-auto px-4 py-8 sm:py-12">
        <header className="text-center mb-10">
          <h1 className="text-2xl sm:text-3xl font-medium text-sanctuary-text mb-2">
            Today-Me
          </h1>
          <p className="text-sanctuary-text-soft">
            나는 안전하다. 잠시 쉬어가도 돼요.
          </p>
        </header>

        <div className="space-y-8">
          <SafeMirror />
          <SmallWinsStack />
          <SelfEsteemTest />
        </div>

        <footer className="mt-12 pt-6 border-t border-sanctuary-peach/40 text-center text-sm text-sanctuary-text-soft">
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
