"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import { getMessages } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n";
import { AuthGate } from "@/components/AuthGate";
import { ThemeBody } from "@/components/ThemeBody";
import { Nav } from "@/components/Nav";
import { CardSkeleton, EmptyState } from "@/components/bty-arena";

/** API 응답 계약(UI 기대). replyMessage (dear-me/letter). */
type DearMeLetterResponse = { replyMessage?: string; reply?: string; replyText?: string; error?: string };

type LetterHistoryItem = { id: string; locale: string; body: string; reply: string | null; created_at: string };

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

  const [history, setHistory] = useState<LetterHistoryItem[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const fetchHistory = useCallback(async () => {
    setHistoryLoading(true);
    setHistoryError(null);
    try {
      const res = await fetch("/api/dear-me/letters", { credentials: "include" });
      const data: { letters?: LetterHistoryItem[]; error?: string } = await res.json().catch(() => ({}));
      if (data.error) { setHistoryError(data.error); return; }
      setHistory(data.letters ?? []);
    } catch {
      setHistoryError(t.letterHistoryError);
    } finally {
      setHistoryLoading(false);
    }
  }, [t.letterHistoryError]);

  useEffect(() => { fetchHistory(); }, [fetchHistory]);

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
      fetchHistory();
    } catch {
      setError(lang === "ko" ? "연결에 실패했어요. 잠시 후 다시 시도해 주세요." : "Connection failed. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  const replyDisplay = reply ?? null;
  const replySectionRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (replyDisplay && replySectionRef.current) {
      replySectionRef.current.focus();
    }
  }, [replyDisplay]);

  return (
    <AuthGate loadingMessage={t.loading}>
      <ThemeBody theme="dear" />
      <main className="min-h-screen" aria-label={t.mainAriaLabel}>
        <div className="max-w-xl mx-auto px-4 py-6 sm:py-10" role="region" aria-label={t.contentLabel}>
          <Nav locale={lang} pathname={pathname} theme="dear" />
          <header className="text-center mb-10 pt-4" role="region" aria-label={t.headerLabel}>
            <h1 className="font-serif text-2xl sm:text-3xl font-medium text-dear-charcoal">
              {lang === "ko" ? "Dear Me — 나에게 쓰는 편지" : "Dear Me — Letter to yourself"}
            </h1>
            <p id="dear-me-hint" className="mt-2 text-dear-charcoal-soft text-sm">
              {t.letterPrompt}
            </p>
          </header>

          {!replyDisplay ? (
            <section className="space-y-6" role="region" aria-labelledby="letter-heading" aria-label={t.letterStepTitle}>
              <h2 id="letter-heading" className="text-lg font-medium text-dear-charcoal sr-only">
                {t.letterStepTitle}
              </h2>
              <div className="space-y-4" role="group" aria-label={t.letterFormLabel}>
              <textarea
                value={letterBody}
                onChange={(e) => setLetterBody(e.target.value)}
                placeholder={t.letterPlaceholder}
                rows={6}
                className="w-full rounded-xl border border-dear-sage/30 bg-white/80 px-4 py-3 text-dear-charcoal placeholder:text-dear-charcoal-soft/60 resize-y"
                aria-label={t.letterPlaceholder}
                aria-describedby="dear-me-hint"
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
                aria-label={t.submitLetter}
              >
                {submitting ? t.sendingLetter : t.submitLetter}
              </button>
              {submitting && (
                <div className="mt-3" aria-busy="true" aria-label={lang === "ko" ? "편지 제출 중" : "Submitting letter"}>
                  <CardSkeleton showLabel={false} lines={2} style={{ padding: "16px 20px" }} />
                </div>
              )}
              </div>
            </section>
          ) : (
            <section ref={replySectionRef} tabIndex={-1} className="space-y-6 outline-none" role="region" aria-label={t.replyStepTitle} aria-labelledby="reply-heading">
              <h2 id="reply-heading" className="text-lg font-medium text-dear-charcoal">
                {t.replyStepTitle}
              </h2>
              <div role="group" aria-label={t.replySummaryLabel}>
              {/* Dear Me 완료 화면 보강: 오늘의 편지 완료 문구 (Center completedTitle/Sub 재사용) */}
              <div role="region" aria-label={lang === "ko" ? "오늘의 편지 완료 안내" : "Today's letter completed"} className="rounded-2xl border border-dear-sage/20 bg-dear-sage/5 px-4 py-3 text-center">
                <p className="font-medium text-dear-charcoal">{t.completedTitle}</p>
                <p className="mt-1 text-sm text-dear-charcoal-soft">{t.completedSub}</p>
              </div>
              <div role="region" aria-label={lang === "ko" ? "답장 내용" : "Reply content"} className="rounded-2xl border border-dear-sage/30 bg-dear-sage/5 p-5 text-dear-charcoal whitespace-pre-wrap">
                {replyDisplay}
              </div>
              </div>
              <div className="flex flex-col sm:flex-row gap-3" role="group" aria-label={t.replyActionsLabel}>
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
                  aria-label={lang === "ko" ? "Center로 가기" : "Go to Center"}
                >
                  {lang === "ko" ? "Center로 가기" : "Go to Center"}
                </Link>
              </div>
            </section>
          )}

          {/* ── 편지 이력 ── */}
          <section className="mt-14" role="region" aria-labelledby="letter-history-heading" aria-label={t.letterHistoryTitle}>
            <h2 id="letter-history-heading" className="text-lg font-medium text-dear-charcoal mb-4">
              {t.letterHistoryTitle}
            </h2>

            {historyLoading && (
              <div aria-busy="true" aria-label={t.letterHistoryLoading}>
                <CardSkeleton showLabel={false} lines={3} style={{ padding: "16px 20px" }} />
              </div>
            )}

            {historyError && (
              <p className="text-red-600 text-sm" role="alert">{t.letterHistoryError}</p>
            )}

            {!historyLoading && !historyError && history.length === 0 && (
              <div role="region" aria-label={t.letterHistoryTitle}>
                <EmptyState
                  icon="✉️"
                  message={t.letterHistoryEmpty}
                  style={{ padding: "24px 16px", color: "var(--dear-charcoal, #3d3d3d)" }}
                />
              </div>
            )}

            {!historyLoading && !historyError && history.length > 0 && (
              <ul className="space-y-3" role="list" aria-label={t.letterHistoryListAria}>
                {history.map((item) => {
                  const date = new Date(item.created_at);
                  const dateStr = date.toLocaleDateString(lang === "ko" ? "ko-KR" : "en-US", {
                    year: "numeric", month: "short", day: "numeric",
                  });
                  const isOpen = expandedId === item.id;
                  const excerpt = item.body.length > 80 ? item.body.slice(0, 80) + "…" : item.body;
                  return (
                    <li
                      key={item.id}
                      className="rounded-2xl border border-dear-sage/20 bg-dear-sage/5 overflow-hidden"
                    >
                      <button
                        type="button"
                        onClick={() => setExpandedId(isOpen ? null : item.id)}
                        aria-expanded={isOpen}
                        aria-label={lang === "ko" ? `${dateStr} 편지 ${isOpen ? "접기" : "펼치기"}` : `${dateStr} letter ${isOpen ? "collapse" : "expand"}`}
                        className="w-full text-left px-4 py-3 cursor-pointer hover:bg-dear-sage/10 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-dear-sage"
                      >
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <time className="text-xs text-dear-charcoal-soft" dateTime={item.created_at}>
                            {dateStr}
                          </time>
                          <span className={`text-xs font-medium ${item.reply ? "text-dear-charcoal" : "text-dear-charcoal-soft/60"}`}>
                            {item.reply ? t.letterHistoryReplied : t.letterHistoryNoReply}
                          </span>
                        </div>
                        {!isOpen && (
                          <p className="text-sm text-dear-charcoal leading-relaxed m-0">{excerpt}</p>
                        )}
                      </button>

                      {isOpen && (
                        <div className="px-4 pb-4 space-y-3">
                          <div>
                            <div className="text-xs font-medium text-dear-charcoal-soft mb-1">
                              {lang === "ko" ? "편지" : "Letter"}
                            </div>
                            <p className="text-sm text-dear-charcoal leading-relaxed whitespace-pre-wrap m-0">
                              {item.body}
                            </p>
                          </div>
                          <div className="border-t border-dear-sage/20 pt-3">
                            <div className="text-xs font-medium text-dear-charcoal-soft mb-1">
                              {t.replyStepTitle}
                            </div>
                            {item.reply ? (
                              <p className="text-sm text-dear-charcoal leading-relaxed whitespace-pre-wrap m-0">
                                {item.reply}
                              </p>
                            ) : (
                              <p className="text-sm text-dear-charcoal-soft/60 italic m-0">
                                {lang === "ko" ? "답장 대기 중" : "Awaiting reply"}
                              </p>
                            )}
                          </div>
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          <footer className="mt-12 pt-6 border-t border-dear-charcoal/10 text-center text-sm text-dear-charcoal-soft" role="contentinfo" aria-label={t.footerLabel}>
            <Link
              href={`/${locale}/center`}
              className="inline-block rounded-xl px-6 py-3 font-medium text-dear-charcoal bg-dear-sage/10 border border-dear-sage/30 hover:bg-dear-sage/20 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-dear-sage"
              aria-label={lang === "ko" ? "Center로 가기" : "Go to Center"}
            >
              {lang === "ko" ? "Center로 가기" : "Go to Center"}
            </Link>
          </footer>
        </div>
      </main>
    </AuthGate>
  );
}
