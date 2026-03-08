"use client";

import { useState } from "react";
import Link from "next/link";
import { getMessages } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n";
import { AuthGate } from "@/components/AuthGate";
import { ThemeBody } from "@/components/ThemeBody";
import { Nav } from "@/components/Nav";
import { CardSkeleton } from "@/components/bty-arena";

/** API 응답 계약(UI 기대). replyMessage (dear-me/letter). */
type DearMeLetterResponse = { replyMessage?: string; reply?: string; replyText?: string; error?: string };

/**
 * Dear Me 편지 쓰기·답장 화면. 편지 입력·제출·답장 표시.
 * Render-only: POST /api/dear-me/letter → 응답 reply 표시.
 */
export default function DearMeClient({ locale }: { locale: string }) {
  const lang = (locale === "ko" ? "ko" : "en") as Locale;
  const t = getMessages(lang).center;
  const [letterBody, setLetterBody] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [reply, setReply] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const pathname = `/${locale}/dear-me`;

  async function handleSubmit() {
    const trimmed = letterBody.trim();
    if (!trimmed || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const r = await fetch("/api/dear-me/letter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ letterText: trimmed, lang }),
        credentials: "include",
      });
      const data: DearMeLetterResponse = await r.json().catch(() => ({}));
      if (data.error) {
        setError(data.error);
        return;
      }
      const replyText = data.replyMessage ?? data.reply ?? data.replyText ?? null;
      setReply(replyText);
    } catch {
      setError(lang === "ko" ? "연결에 실패했어요. 잠시 후 다시 시도해 주세요." : "Connection failed. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  const replyDisplay = reply ?? null;

  return (
    <AuthGate loadingMessage={t.loading}>
      <ThemeBody theme="dear" />
      <main className="min-h-screen">
        <div className="max-w-xl mx-auto px-4 py-6 sm:py-10">
          <Nav locale={lang} pathname={pathname} theme="dear" />
          <header className="text-center mb-10 pt-4">
            <h1 className="font-serif text-2xl sm:text-3xl font-medium text-dear-charcoal">
              {lang === "ko" ? "Dear Me — 나에게 쓰는 편지" : "Dear Me — Letter to yourself"}
            </h1>
            <p className="mt-2 text-dear-charcoal-soft text-sm">
              {t.letterPrompt}
            </p>
          </header>

          {!replyDisplay ? (
            <section className="space-y-6" aria-labelledby="letter-heading">
              <h2 id="letter-heading" className="text-lg font-medium text-dear-charcoal sr-only">
                {t.letterStepTitle}
              </h2>
              <textarea
                value={letterBody}
                onChange={(e) => setLetterBody(e.target.value)}
                placeholder={t.letterPlaceholder}
                rows={6}
                className="w-full rounded-xl border border-dear-sage/30 bg-white/80 px-4 py-3 text-dear-charcoal placeholder:text-dear-charcoal-soft/60 resize-y"
                aria-label={t.letterPlaceholder}
              />
              {error && (
                <p className="text-red-600 text-sm" role="alert">
                  {error}
                </p>
              )}
              <button
                type="button"
                disabled={!letterBody.trim() || submitting}
                onClick={handleSubmit}
                className="w-full rounded-2xl border border-dear-sage/30 bg-dear-sage/5 py-4 text-center hover:bg-dear-sage/10 transition-colors font-medium text-dear-charcoal disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-dear-sage"
                aria-busy={submitting}
              >
                {submitting ? t.sendingLetter : t.submitLetter}
              </button>
              {submitting && (
                <div className="mt-3" aria-busy="true" aria-label={lang === "ko" ? "편지 제출 중" : "Submitting letter"}>
                  <CardSkeleton showLabel={false} lines={2} style={{ padding: "16px 20px" }} />
                </div>
              )}
            </section>
          ) : (
            <section className="space-y-6" aria-labelledby="reply-heading">
              <h2 id="reply-heading" className="text-lg font-medium text-dear-charcoal">
                {t.replyStepTitle}
              </h2>
              {/* Dear Me 완료 화면 보강: 오늘의 편지 완료 문구 (Center completedTitle/Sub 재사용) */}
              <div className="rounded-2xl border border-dear-sage/20 bg-dear-sage/5 px-4 py-3 text-center">
                <p className="font-medium text-dear-charcoal">{t.completedTitle}</p>
                <p className="mt-1 text-sm text-dear-charcoal-soft">{t.completedSub}</p>
              </div>
              <div className="rounded-2xl border border-dear-sage/30 bg-dear-sage/5 p-5 text-dear-charcoal whitespace-pre-wrap">
                {replyDisplay}
              </div>
              <div className="flex flex-col sm:flex-row gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setReply(null);
                    setLetterBody("");
                    setError(null);
                  }}
                  className="rounded-2xl border border-dear-sage/30 bg-dear-sage/5 py-3 px-5 text-center hover:bg-dear-sage/10 transition-colors font-medium text-dear-charcoal focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-dear-sage"
                  aria-label={lang === "ko" ? "편지 다시 쓰기" : "Write letter again"}
                >
                  {lang === "ko" ? "다시 쓰기" : "Write again"}
                </button>
                <Link
                  href={`/${locale}/center`}
                  className="rounded-2xl border border-dear-sage/30 bg-dear-sage/5 py-3 px-5 text-center hover:bg-dear-sage/10 transition-colors font-medium text-dear-charcoal inline-block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-dear-sage"
                >
                  {lang === "ko" ? "Center로 가기" : "Go to Center"}
                </Link>
              </div>
            </section>
          )}

          <footer className="mt-12 pt-6 border-t border-dear-charcoal/10 text-center text-sm text-dear-charcoal-soft">
            <Link
              href={`/${locale}/center`}
              className="inline-block rounded-xl px-6 py-3 font-medium text-dear-charcoal bg-dear-sage/10 border border-dear-sage/30 hover:bg-dear-sage/20 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-dear-sage"
            >
              {lang === "ko" ? "Center로 가기" : "Go to Center"}
            </Link>
          </footer>
        </div>
      </main>
    </AuthGate>
  );
}
