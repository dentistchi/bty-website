"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { AuthGate } from "@/components/AuthGate";
import { Nav } from "@/components/Nav";
import { ThemeBody } from "@/components/ThemeBody";
import { cn } from "@/lib/utils";

type SecondAwakeningRitual = {
  act1: {
    name: string;
    sessionCount: number;
    repairLoopCount: number;
    oFnRCount: number;
    coreHighlight: { statId: string; name: string; value: number }[];
    patternNote: string;
  };
  act2: {
    name: string;
    identityStatement: string;
    phaseIiIntro: string;
  };
  act3: {
    name: string;
    unlockGranted: "PRM" | "SAG" | null;
    unlockLabel: string;
  };
};

type SecondAwakeningRes = {
  eligible: boolean;
  completed: boolean;
  userDay: number;
  sessionCount: number;
  ritual?: SecondAwakeningRitual;
};

export default function SecondAwakeningPageClient() {
  const pathname = usePathname() ?? "";
  const locale = pathname.startsWith("/ko") ? "ko" : "en";
  const router = useRouter();
  const [data, setData] = useState<SecondAwakeningRes | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetch("/api/emotional-stats/second-awakening")
      .then((r) => r.json())
      .then((d: SecondAwakeningRes) => {
        setData(d);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const handleEnterNextPhase = () => {
    if (!data?.eligible || data.completed || submitting) return;
    setSubmitting(true);
    fetch("/api/emotional-stats/second-awakening/complete", { method: "POST" })
      .then((r) => r.json())
      .then((body) => {
        if (body.ok) {
          setData((prev) =>
            prev ? { ...prev, completed: true, ritual: prev.ritual } : prev
          );
          router.refresh();
        }
        setSubmitting(false);
      })
      .catch(() => setSubmitting(false));
  };

  if (loading || !data) {
    return (
      <AuthGate>
        <ThemeBody theme="foundry" />
        <main className="min-h-screen bg-foundry-white flex items-center justify-center">
          <p className="text-foundry-ink-soft">
            {locale === "ko" ? "불러오는 중…" : "Loading…"}
          </p>
        </main>
      </AuthGate>
    );
  }

  const basePath = locale === "ko" ? "/ko/bty" : "/en/bty";

  if (data.completed) {
    return (
      <AuthGate>
        <ThemeBody theme="foundry" />
        <main className="min-h-screen bg-foundry-white">
          <div className="max-w-xl mx-auto px-4 py-6 sm:py-10 min-h-screen flex flex-col">
            <Nav locale={locale} pathname={pathname} />
            <div className="flex-1 flex flex-col items-center justify-center text-center px-4">
              <h1 className="text-xl sm:text-2xl font-semibold text-foundry-purple-dark mb-3">
                {locale === "ko" ? "Phase II" : "Phase II"}
              </h1>
              <p className="text-foundry-ink-soft text-sm mb-8 max-w-sm">
                {locale === "ko"
                  ? "일반 루틴으로 돌아가며, 훈련은 더 정교해집니다."
                  : "Back to the usual routine—training grows more refined."}
              </p>
              <Link
                href={basePath}
                className={cn(
                  "rounded-xl px-6 py-3 font-medium text-white",
                  "bg-foundry-purple hover:bg-foundry-purple-dark transition-colors"
                )}
              >
                {locale === "ko" ? "Foundry로" : "To Foundry"}
              </Link>
            </div>
          </div>
        </main>
      </AuthGate>
    );
  }

  if (!data.eligible) {
    return (
      <AuthGate>
        <ThemeBody theme="foundry" />
        <main className="min-h-screen bg-foundry-white">
          <div className="max-w-xl mx-auto px-4 py-6 sm:py-10 min-h-screen flex flex-col">
            <Nav locale={locale} pathname={pathname} />
            <div className="flex-1 flex flex-col items-center justify-center text-center px-4">
              <h1 className="text-xl sm:text-2xl font-semibold text-foundry-purple-dark mb-3">
                {locale === "ko" ? "Second Awakening" : "Second Awakening"}
              </h1>
              <p className="text-foundry-ink-soft text-sm mb-4">
                {locale === "ko"
                  ? "30일 훈련과 최소 10회 세션 후 이 의식이 열립니다."
                  : "This ritual unlocks after 30 days and at least 10 sessions."}
              </p>
              <p className="text-foundry-ink-soft/80 text-xs mb-8">
                {locale === "ko"
                  ? `현재: ${data.userDay}일, ${data.sessionCount}회 세션`
                  : `Current: ${data.userDay} days, ${data.sessionCount} sessions`}
              </p>
              <Link
                href={basePath}
                className={cn(
                  "rounded-xl px-6 py-3 font-medium",
                  "border border-foundry-purple-muted text-foundry-purple",
                  "hover:bg-foundry-purple/10 transition-colors"
                )}
              >
                {locale === "ko" ? "Foundry로" : "To Foundry"}
              </Link>
            </div>
          </div>
        </main>
      </AuthGate>
    );
  }

  const ritual = data.ritual!;
  return (
    <AuthGate>
      <ThemeBody theme="foundry" />
      <main className="min-h-screen bg-foundry-white">
        <div className="max-w-xl mx-auto px-4 py-6 sm:py-10 min-h-screen flex flex-col">
          <Nav locale={locale} pathname={pathname} />
          <header className="text-center mb-8">
            <h1 className="text-2xl sm:text-3xl font-semibold text-foundry-purple-dark">
              {locale === "ko" ? "Second Awakening" : "Second Awakening"}
            </h1>
            <p className="text-foundry-ink-soft mt-1 text-sm">
              {locale === "ko" ? "30일, 당신의 성장을 돌아보는 의식" : "A 30-day ritual to reflect on your growth"}
            </p>
          </header>

          <div className="space-y-8 flex-1">
            <section className="rounded-2xl border border-foundry-purple-muted bg-foundry-purple/5 p-5">
              <h2 className="text-sm font-semibold text-foundry-purple-dark mb-3">
                {ritual.act1.name}
              </h2>
              <ul className="text-sm text-foundry-ink space-y-1 mb-3">
                <li>· {locale === "ko" ? "세션 수" : "Sessions"}: {ritual.act1.sessionCount}</li>
                <li>· {locale === "ko" ? "회복 루프 성공" : "Repair loop success"}: {ritual.act1.repairLoopCount}</li>
                <li>· O-F-N-R {locale === "ko" ? "완성" : "completed"}: {ritual.act1.oFnRCount}</li>
                {ritual.act1.coreHighlight.length > 0 && (
                  <li>
                    · {locale === "ko" ? "Core 성장 하이라이트" : "Core highlight"}:{" "}
                    {ritual.act1.coreHighlight.map((h) => `${h.name}`).join(", ")}
                  </li>
                )}
              </ul>
              <p className="text-xs text-foundry-ink-soft">{ritual.act1.patternNote}</p>
            </section>

            <section className="rounded-2xl border border-foundry-purple-muted bg-foundry-purple/5 p-5">
              <h2 className="text-sm font-semibold text-foundry-purple-dark mb-3">
                {ritual.act2.name}
              </h2>
              <p className="text-sm text-foundry-ink font-medium mb-2">
                {ritual.act2.identityStatement}
              </p>
              <p className="text-sm text-foundry-ink-soft">{ritual.act2.phaseIiIntro}</p>
            </section>

            <section className="rounded-2xl border border-foundry-purple-muted bg-foundry-purple/5 p-5">
              <h2 className="text-sm font-semibold text-foundry-purple-dark mb-3">
                {ritual.act3.name}
              </h2>
              <p className="text-sm text-foundry-ink mb-4">{ritual.act3.unlockLabel}</p>
              <button
                type="button"
                onClick={handleEnterNextPhase}
                disabled={submitting}
                className={cn(
                  "rounded-xl px-6 py-3 font-medium text-white",
                  "bg-foundry-purple hover:bg-foundry-purple-dark transition-colors",
                  "disabled:opacity-60 disabled:cursor-not-allowed"
                )}
              >
                {submitting
                  ? (locale === "ko" ? "처리 중…" : "Processing…")
                  : (locale === "ko" ? "Enter Next Phase" : "Enter Next Phase")}
              </button>
            </section>
          </div>

          <footer className="pt-6 mt-6 border-t border-foundry-purple-muted text-center text-sm">
            <Link href={basePath} className="text-foundry-purple hover:underline">
              {locale === "ko" ? "Foundry로 돌아가기" : "Back to Foundry"}
            </Link>
          </footer>
        </div>
      </main>
    </AuthGate>
  );
}
