"use client";

/**
 * Elite 5% 1차 해금 전용 페이지 (PHASE_4_ELITE_5_PERCENT_SPEC §10 3차, §7 서클 모임 카드).
 * ELITE_3RD_SPEC_AND_CHECKLIST §1: GET/POST /api/me/mentor-request, GET/PATCH /api/arena/mentor-requests 연동.
 * Render-only: isElite from GET /api/me/elite; mentor request from GET /api/me/mentor-request. No XP/ranking or status computation in UI.
 */
import React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { getMessages } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n";
import { CardSkeleton } from "@/components/bty-arena";

type MentorRequestRes = {
  request: {
    id: string;
    status: "pending" | "approved" | "rejected";
    message?: string;
    mentorId: string;
    createdAt: string;
    updatedAt?: string;
    respondedAt?: string;
    respondedBy?: string;
  } | null;
};

type EliteRes = { isElite?: boolean; badges?: Array<{ kind: string; labelKey: string }> };

export default function ElitePageClient() {
  const params = useParams();
  const locale = (typeof params?.locale === "string" ? params.locale : "en") as Locale;
  const t = getMessages(locale).mentorRequest;
  const tElite = getMessages(locale).elitePage;
  const [isElite, setIsElite] = React.useState<boolean | null>(null);
  const [badges, setBadges] = React.useState<EliteRes["badges"]>([]);
  const [request, setRequest] = React.useState<MentorRequestRes["request"]>(null);
  const [loading, setLoading] = React.useState(true);
  const [submitLoading, setSubmitLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [message, setMessage] = React.useState("");

  React.useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const [eliteRes, mentorRes] = await Promise.all([
          fetch("/api/me/elite", { credentials: "include" }),
          fetch("/api/me/mentor-request", { credentials: "include" }),
        ]);
        if (!alive) return;
        const eliteData: EliteRes = await eliteRes.json().catch(() => ({}));
        setIsElite(Boolean(eliteData?.isElite));
        setBadges(eliteData?.badges ?? []);
        if (mentorRes.ok) {
          const mentorData: MentorRequestRes = await mentorRes.json().catch(() => ({ request: null }));
          setRequest(mentorData.request ?? null);
        } else {
          setRequest(null);
        }
      } catch {
        if (alive) setIsElite(false);
        if (alive) setRequest(null);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  if (loading) {
    return (
      <div
        style={{ maxWidth: 640, margin: "0 auto", padding: "24px 16px" }}
        aria-busy="true"
        aria-label={locale === "ko" ? "Elite 페이지 불러오는 중" : "Loading Elite page"}
      >
        <div style={{ display: "grid", gap: 28, marginTop: 24 }}>
          <CardSkeleton lines={3} showLabel={true} />
          <CardSkeleton lines={2} showLabel={true} />
        </div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 640, margin: "0 auto", padding: "24px 16px" }}>
      <div style={{ marginTop: 24 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 16 }}>
          {locale === "ko" ? "Elite 전용" : "Elite only"}
        </h1>
        {isElite ? (
          <div style={{ fontSize: 15, lineHeight: 1.6 }}>
            <p style={{ marginBottom: 16 }}>
              {locale === "ko"
                ? "주간 리더보드 상위 5%에 진입하셨습니다. 여기서는 Elite 전용 콘텐츠를 이용할 수 있습니다."
                : "You're in the top 5% on the weekly leaderboard. Here you can access Elite-only content."}
            </p>
            {/* ELITE_4TH_SPECIAL_OR_UNLOCK_1PAGE §3 옵션 B: 해금 조건·노출 — render-only. isElite from API만 사용. */}
            <section aria-labelledby="elite-unlock-heading" style={{ marginBottom: 20, padding: 16, border: "1px solid #e5e7eb", borderRadius: 12, backgroundColor: "#f9fafb" }}>
              <h2 id="elite-unlock-heading" style={{ fontSize: 14, fontWeight: 600, marginBottom: 10 }}>{tElite.unlockConditionTitle} · {tElite.unlockExposureTitle}</h2>
              <p style={{ fontSize: 13, marginBottom: 6 }}><strong>{tElite.unlockConditionTitle}:</strong> {tElite.unlockConditionMet}</p>
              <p style={{ fontSize: 13 }}><strong>{tElite.unlockExposureTitle}:</strong> {tElite.unlockExposureMet}</p>
            </section>
            {badges && badges.length > 0 && (
              <div style={{ marginBottom: 20 }}>
                <h2 style={{ fontSize: 14, fontWeight: 600, marginBottom: 8 }}>{locale === "ko" ? "증정 배지" : "Badges"}</h2>
                <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexWrap: "wrap", gap: 8 }}>
                  {badges.map((b) => (
                    <li key={b.kind} style={{ padding: "6px 12px", borderRadius: 8, background: "rgba(0,0,0,0.06)", fontSize: 13, fontWeight: 500 }}>
                      {tElite.badgeLabels?.[b.labelKey] ?? b.labelKey}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {/* 멘토 대화 신청 카드 — render-only: request 상태·에러는 API 응답만 표시 */}
            <section
              aria-labelledby="mentor-request-heading"
              style={{
                marginBottom: 20,
                padding: 16,
                border: "1px solid #e5e7eb",
                borderRadius: 12,
                backgroundColor: "#fafafa",
              }}
            >
              <h2 id="mentor-request-heading" style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>{t.cardTitle}</h2>
              <p style={{ fontSize: 14, opacity: 0.9, marginBottom: 12 }}>{t.cardDesc}</p>
              {request?.status === "pending" && (
                <p style={{ fontSize: 14, marginBottom: 12 }}>{t.statusPending}</p>
              )}
              {request?.status === "approved" && (
                <p style={{ fontSize: 14, marginBottom: 12 }}>{t.statusApproved}</p>
              )}
              {request?.status === "rejected" && (
                <p style={{ fontSize: 14, marginBottom: 12 }}>{t.statusRejected}</p>
              )}
              {error && <p id="mentor-request-error" role="alert" style={{ fontSize: 14, color: "#b91c1c", marginBottom: 12 }}>{error}</p>}
              {(!request || request.status !== "pending") && request?.status !== "approved" && (
                <>
                  <label id="mentor-request-message-label" htmlFor="mentor-request-message" style={{ display: "block", fontSize: 13, marginBottom: 4 }}>{t.messageLabel}</label>
                  <textarea
                    id="mentor-request-message"
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder={t.messagePlaceholder}
                    aria-describedby={error ? "mentor-request-error" : undefined}
                    rows={2}
                    style={{
                      width: "100%",
                      padding: 8,
                      borderRadius: 8,
                      border: "1px solid #d1d5db",
                      fontSize: 14,
                      marginBottom: 12,
                    }}
                  />
                  <button
                    type="button"
                    disabled={submitLoading}
                    aria-label={submitLoading ? t.submitting : t.requestCta}
                    className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-neutral-800"
                    onClick={async () => {
                      setError(null);
                      setSubmitLoading(true);
                      try {
                        const r = await fetch("/api/me/mentor-request", {
                          method: "POST",
                          credentials: "include",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ message: message.trim() || undefined }),
                        });
                        const data = await r.json().catch(() => ({}));
                        if (r.ok) {
                          setRequest({
                            id: data.id,
                            status: "pending",
                            mentorId: "dr_chi",
                            createdAt: data.createdAt ?? new Date().toISOString(),
                          });
                          setMessage("");
                        } else {
                          if (data.error === "ELITE_ONLY") setError(t.errorEliteOnly);
                          else if (data.error === "PENDING_EXISTS") setError(t.errorPendingExists);
                          else setError(t.errorSubmit);
                        }
                      } catch {
                        setError(t.errorSubmit);
                      } finally {
                        setSubmitLoading(false);
                      }
                    }}
                    style={{
                      padding: "10px 16px",
                      borderRadius: 8,
                      background: "#111",
                      color: "white",
                      border: "none",
                      fontWeight: 600,
                      fontSize: 14,
                      cursor: submitLoading ? "not-allowed" : "pointer",
                      opacity: submitLoading ? 0.7 : 1,
                    }}
                  >
                    {submitLoading ? t.submitting : t.requestCta}
                  </button>
                  {submitLoading && (
                    <div style={{ marginTop: 12 }}>
                      <CardSkeleton showLabel={false} lines={1} style={{ padding: "12px 16px" }} />
                    </div>
                  )}
                </>
              )}
              {request?.status === "approved" && (
                <Link
                  href={`/${locale}/bty/mentor`}
                  aria-label={t.approvedCta}
                  style={{
                    display: "inline-block",
                    padding: "10px 16px",
                    borderRadius: 8,
                    background: "#111",
                    color: "white",
                    textDecoration: "none",
                    fontWeight: 600,
                    fontSize: 14,
                  }}
                >
                  {t.approvedCta}
                </Link>
              )}
            </section>
            {/* 목록 화면: 내 신청 목록 (render-only, API request 1건 표시) */}
            <section
              aria-labelledby="mentor-request-list-heading"
              style={{
                marginBottom: 20,
                padding: 16,
                border: "1px solid #e5e7eb",
                borderRadius: 12,
                backgroundColor: "#fafafa",
              }}
            >
              <h2 id="mentor-request-list-heading" style={{ fontSize: 16, fontWeight: 600, marginBottom: 12 }}>{t.listTitle}</h2>
              {!request ? (
                <p style={{ fontSize: 14, color: "#6b7280" }}>{t.listEmpty}</p>
              ) : (
                <div role="region" aria-label={t.listTitle}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
                    <thead>
                      <tr style={{ borderBottom: "1px solid #e5e7eb" }}>
                        <th style={{ textAlign: "left", padding: "8px 12px 8px 0", fontWeight: 600 }}>{t.colDate}</th>
                        <th style={{ textAlign: "left", padding: "8px 12px 8px 0", fontWeight: 600 }}>{t.colStatus}</th>
                        <th style={{ textAlign: "left", padding: 8 }} />
                      </tr>
                    </thead>
                    <tbody>
                      <tr style={{ borderBottom: "1px solid #f3f4f6" }}>
                        <td style={{ padding: "8px 12px 8px 0" }}>
                          {request.createdAt.slice(0, 19).replace("T", " ")}
                        </td>
                        <td style={{ padding: "8px 12px 8px 0" }}>
                          {request.status === "pending" && t.statusPending}
                          {request.status === "approved" && t.statusApproved}
                          {request.status === "rejected" && t.statusRejected}
                        </td>
                        <td style={{ padding: 8 }}>
                          {request.status === "approved" && (
                            <Link
                              href={`/${locale}/bty/mentor`}
                              style={{ fontSize: 13, fontWeight: 600, color: "#111" }}
                            >
                              {t.approvedCta}
                            </Link>
                          )}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              )}
            </section>
            {/* PHASE_4_ELITE_5_PERCENT_SPEC §7: 서클(Circle) 모임 카드 — isElite 분기 내, render-only. 일정 문구 또는 "준비 중" 플레이스홀더. */}
            {isElite && (
              <div
                style={{
                  marginBottom: 20,
                  padding: 16,
                  border: "1px solid #e5e7eb",
                  borderRadius: 12,
                  backgroundColor: "#fafafa",
                }}
              >
                <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>{tElite.circleCardTitle}</h2>
                <p style={{ fontSize: 14, opacity: 0.9, marginBottom: 8 }}>{tElite.circleCardDesc}</p>
                <p style={{ fontSize: 13, opacity: 0.75 }}>{tElite.circleCardPlaceholder}</p>
              </div>
            )}
            <ul style={{ listStyle: "disc", paddingLeft: 24, marginBottom: 20 }}>
              <li style={{ marginBottom: 8 }}>
                <Link href={`/${locale}/bty/mentor`} style={{ color: "#1a1a1a", fontWeight: 600 }}>
                  {locale === "ko" ? "Dr. Chi 멘토와 심화 대화" : "Deep conversation with Dr. Chi Mentor"}
                </Link>
              </li>
            </ul>
            <Link
              href={`/${locale}/bty/dashboard`}
              style={{
                display: "inline-block",
                padding: "10px 16px",
                borderRadius: 8,
                border: "1px solid #111",
                color: "#111",
                textDecoration: "none",
                fontWeight: 600,
                fontSize: 14,
              }}
            >
              {locale === "ko" ? "← 대시보드로" : "← Back to dashboard"}
            </Link>
          </div>
        ) : (
          <div style={{ fontSize: 15, lineHeight: 1.6 }}>
            <p style={{ marginBottom: 16, opacity: 0.9 }}>
              {locale === "ko"
                ? "이 페이지는 주간 리더보드 상위 5%에 있을 때만 이용할 수 있습니다."
                : "This page is available only when you're in the top 5% on the weekly leaderboard."}
            </p>
            {/* ELITE_4TH 해금 확장: 비Elite 시 해금 조건·노출 문구만 표시 (render-only). */}
            <section aria-labelledby="elite-unlock-locked-heading" style={{ marginBottom: 20, padding: 16, border: "1px solid #e5e7eb", borderRadius: 12, backgroundColor: "#f9fafb" }}>
              <h2 id="elite-unlock-locked-heading" style={{ fontSize: 14, fontWeight: 600, marginBottom: 10 }}>{tElite.unlockConditionTitle} · {tElite.unlockExposureTitle}</h2>
              <p style={{ fontSize: 13, marginBottom: 6 }}><strong>{tElite.unlockConditionTitle}:</strong> {tElite.unlockConditionLocked}</p>
              <p style={{ fontSize: 13 }}><strong>{tElite.unlockExposureTitle}:</strong> {tElite.unlockExposureLocked}</p>
            </section>
            <p style={{ marginBottom: 20, fontSize: 14, opacity: 0.8 }}>
              {locale === "ko"
                ? "Arena에서 시나리오를 완료하고 주간 XP를 쌓아 상위 5%에 도전해 보세요."
                : "Complete scenarios in Arena and earn weekly XP to reach the top 5%."}
            </p>
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
              <Link
                href={`/${locale}/bty/leaderboard`}
                style={{
                  display: "inline-block",
                  padding: "10px 16px",
                  borderRadius: 8,
                  background: "#111",
                  color: "white",
                  textDecoration: "none",
                  fontWeight: 600,
                  fontSize: 14,
                }}
              >
                {locale === "ko" ? "리더보드 보기" : "View leaderboard"}
              </Link>
              <Link
                href={`/${locale}/bty/dashboard`}
                style={{
                  display: "inline-block",
                  padding: "10px 16px",
                  borderRadius: 8,
                  border: "1px solid #111",
                  color: "#111",
                  textDecoration: "none",
                  fontWeight: 600,
                  fontSize: 14,
                }}
              >
                {locale === "ko" ? "대시보드로" : "To dashboard"}
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
