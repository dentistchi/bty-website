"use client";

/**
 * Center — RENEWAL awakening milestones: GET `/api/center/awakening-progress`,
 * Realtime `user_awakening_milestones` INSERT → refetch + completion flash, RENEWAL overlay when all done,
 * Dr. Chi CTA + {@link MentorChatShell} when mentor milestone is pending.
 */

import React from "react";
import { MentorChatShell } from "@/components/foundry/MentorChatShell";
import { getSupabase } from "@/lib/supabase";
import { getMessages } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n";
import type { AwakeningProgress } from "@/engine/healing/awakening-phase.service";

const REALTIME_CHANNEL_PREFIX = "awakening_milestones_";

type MilestoneRow = {
  id: string;
  titleKo: string;
  titleEn: string;
  conditionKo: string;
  conditionEn: string;
  completed: boolean;
};

type AwakeningProgressApi = AwakeningProgress & {
  milestones: MilestoneRow[];
  mentorMilestonePending: boolean;
};

export type AwakeningMilestoneTrackerProps = {
  userId: string;
  locale: Locale | string;
  /** Route locale segment e.g. `ko` */
  routeLocale: string;
};

export function AwakeningMilestoneTracker({ userId, locale, routeLocale }: AwakeningMilestoneTrackerProps) {
  const loc = locale === "ko" ? "ko" : "en";
  const b = getMessages(loc).bty;

  const [data, setData] = React.useState<AwakeningProgressApi | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [flashMilestoneId, setFlashMilestoneId] = React.useState<string | null>(null);
  const [renewalOverlayDismissed, setRenewalOverlayDismissed] = React.useState(false);
  const [mentorChatOpen, setMentorChatOpen] = React.useState(false);
  const flashClearRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = React.useCallback(async () => {
    const uid = userId.trim();
    if (!uid) {
      setError(b.awakeningMilestoneTrackerError);
      setData(null);
      setLoading(false);
      return;
    }
    setError(null);
    try {
      const qs = new URLSearchParams({ userId: uid });
      const r = await fetch(`/api/center/awakening-progress?${qs.toString()}`, { credentials: "include" });
      const json = (await r.json().catch(() => ({}))) as AwakeningProgressApi & { error?: string };
      if (!r.ok) {
        setError(json.error ?? b.awakeningMilestoneTrackerError);
        setData(null);
        return;
      }
      setData(json);
    } catch {
      setError(b.awakeningMilestoneTrackerError);
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [userId, b.awakeningMilestoneTrackerError]);

  React.useEffect(() => {
    setLoading(true);
    void load();
  }, [load]);

  React.useEffect(() => {
    const uid = userId.trim();
    if (!uid) return;

    let client: ReturnType<typeof getSupabase> | null = null;
    try {
      client = getSupabase();
    } catch {
      return;
    }

    const channel = client
      .channel(`${REALTIME_CHANNEL_PREFIX}${uid}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "user_awakening_milestones",
          filter: `user_id=eq.${uid}`,
        },
        (payload: { new?: Record<string, unknown> }) => {
          const mid = typeof payload.new?.milestone_id === "string" ? payload.new.milestone_id : null;
          if (mid) {
            if (flashClearRef.current) clearTimeout(flashClearRef.current);
            setFlashMilestoneId(mid);
            flashClearRef.current = setTimeout(() => {
              setFlashMilestoneId(null);
              flashClearRef.current = null;
            }, 1200);
          }
          void load();
        },
      )
      .subscribe();

    return () => {
      if (flashClearRef.current) clearTimeout(flashClearRef.current);
      client?.removeChannel(channel);
    };
  }, [userId, load]);

  const allComplete =
    Boolean(data?.milestones?.length === 4 && data.milestones.every((m) => m.completed));
  const showRenewalOverlay = allComplete && !renewalOverlayDismissed && Boolean(data);

  const nextHint = data?.nextHint;
  const nextHintTitle = nextHint ? (loc === "ko" ? nextHint.titleKo : nextHint.titleEn) : null;

  if (loading && !data) {
    return (
      <section role="status" aria-busy="true" aria-label={b.awakeningMilestoneTrackerLoading}>
        <p style={{ margin: 0, fontSize: 14, color: "#64748b" }}>{b.awakeningMilestoneTrackerLoading}</p>
      </section>
    );
  }

  if (error || !data) {
    return (
      <section role="alert" aria-label={b.awakeningMilestoneTrackerRegionAria}>
        <p style={{ margin: 0, fontSize: 14, color: "#b91c1c" }}>{error ?? b.awakeningMilestoneTrackerError}</p>
      </section>
    );
  }

  return (
    <>
      <style
        dangerouslySetInnerHTML={{
          __html: `
          @keyframes awakeningMilestonePulse {
            0% { box-shadow: 0 0 0 0 rgba(13, 148, 136, 0.45); transform: scale(1); }
            40% { box-shadow: 0 0 0 10px rgba(13, 148, 136, 0.15); transform: scale(1.01); }
            100% { box-shadow: 0 0 0 0 rgba(13, 148, 136, 0); transform: scale(1); }
          }
          .awakening-milestone-flash {
            animation: awakeningMilestonePulse 1s ease-out 1;
          }
        `,
        }}
      />
      <section
        role="region"
        aria-label={b.awakeningMilestoneTrackerRegionAria}
        style={{
          maxWidth: 480,
          padding: "16px",
          borderRadius: 12,
          border: "1px solid #e2e8f0",
          background: "#fff",
          position: "relative",
        }}
      >
        <h2 style={{ margin: "0 0 16px", fontSize: 18, fontWeight: 700 }}>{b.awakeningMilestoneTrackerTitle}</h2>

        <ol
          style={{
            margin: 0,
            padding: 0,
            listStyle: "none",
            display: "flex",
            flexDirection: "column",
            gap: 12,
          }}
        >
          {data.milestones.map((m) => {
            const title = loc === "ko" ? m.titleKo : m.titleEn;
            const condition = loc === "ko" ? m.conditionKo : m.conditionEn;
            const isFlash = flashMilestoneId === m.id;
            const isNextIncomplete =
              Boolean(nextHint && nextHint.milestoneId === m.id && !m.completed);

            return (
              <li
                key={m.id}
                className={isFlash ? "awakening-milestone-flash" : undefined}
                style={{
                  display: "grid",
                  gridTemplateColumns: "24px 1fr",
                  columnGap: 12,
                  alignItems: "start",
                  padding: "12px 14px",
                  borderRadius: 10,
                  border: `1px solid ${isNextIncomplete ? "#99f6e4" : "#e2e8f0"}`,
                  background: isNextIncomplete ? "#f0fdfa" : "#f8fafc",
                  transition: "border-color 0.2s ease, background 0.2s ease",
                }}
              >
                <span
                  aria-hidden
                  style={{
                    width: 20,
                    height: 20,
                    borderRadius: "50%",
                    marginTop: 2,
                    flexShrink: 0,
                    background: m.completed ? "#0d9488" : "transparent",
                    border: m.completed ? "none" : "2px solid #cbd5e1",
                    boxSizing: "border-box",
                  }}
                />
                <div>
                  <p style={{ margin: "0 0 6px", fontWeight: 700, color: "#0f172a", fontSize: 15 }}>{title}</p>
                  <p style={{ margin: "0 0 8px", fontSize: 13, lineHeight: 1.5, color: "#475569" }}>{condition}</p>
                  <span
                    style={{
                      fontSize: 12,
                      fontWeight: 600,
                      color: m.completed ? "#0d9488" : "#94a3b8",
                    }}
                    aria-label={m.completed ? (loc === "ko" ? "완료" : "Completed") : loc === "ko" ? "미완료" : "Incomplete"}
                  >
                    {m.completed ? (loc === "ko" ? "완료" : "Done") : loc === "ko" ? "진행 중" : "In progress"}
                  </span>
                </div>
              </li>
            );
          })}
        </ol>

        {nextHintTitle && !allComplete ? (
          <p
            style={{
              margin: "16px 0 0",
              fontSize: 13,
              color: "#0f766e",
              fontWeight: 600,
              lineHeight: 1.45,
            }}
          >
            {b.awakeningMilestoneTrackerNextLabel}: {nextHintTitle}
          </p>
        ) : null}

        {data.mentorMilestonePending ? (
          <div style={{ marginTop: 16 }}>
            {!mentorChatOpen ? (
              <button
                type="button"
                className="rounded-lg border border-teal-600 bg-teal-600 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-700"
                onClick={() => setMentorChatOpen(true)}
              >
                {b.awakeningMilestoneTrackerChatCta}
              </button>
            ) : (
              <div style={{ marginTop: 8 }}>
                <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 8 }}>
                  <button
                    type="button"
                    className="text-sm text-slate-600 underline"
                    onClick={() => setMentorChatOpen(false)}
                  >
                    {b.awakeningMilestoneTrackerCollapseChat}
                  </button>
                </div>
                <div
                  style={{
                    borderRadius: 12,
                    border: "1px solid #e2e8f0",
                    overflow: "hidden",
                    minHeight: 320,
                  }}
                >
                  <MentorChatShell locale={locale} routeLocale={routeLocale} />
                </div>
              </div>
            )}
          </div>
        ) : null}
      </section>

      {showRenewalOverlay ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="awakening-renewal-overlay-title"
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 60,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 24,
            background: "rgba(15, 23, 42, 0.55)",
            backdropFilter: "blur(4px)",
          }}
        >
          <div
            style={{
              maxWidth: 400,
              width: "100%",
              padding: "32px 28px",
              borderRadius: 16,
              background: "linear-gradient(145deg, #f0fdfa 0%, #ffffff 55%)",
              border: "2px solid #14b8a6",
              boxShadow: "0 25px 50px -12px rgba(15, 118, 110, 0.35)",
              textAlign: "center",
            }}
          >
            <div
              id="awakening-renewal-overlay-title"
              style={{
                display: "inline-block",
                padding: "10px 20px",
                borderRadius: 999,
                background: "#0d9488",
                color: "#fff",
                fontWeight: 800,
                fontSize: 18,
                letterSpacing: "0.06em",
                marginBottom: 16,
              }}
            >
              RENEWAL
            </div>
            <p style={{ margin: "0 0 8px", fontSize: 20, fontWeight: 700, color: "#0f172a" }}>
              {b.awakeningMilestoneTrackerRenewalUnlocked}
            </p>
            <p style={{ margin: "0 0 24px", fontSize: 14, color: "#475569", lineHeight: 1.5 }}>
              {b.awakeningMilestoneTrackerRenewalSub}
            </p>
            <button
              type="button"
              className="rounded-lg border border-slate-300 bg-white px-5 py-2.5 text-sm font-semibold text-slate-800 hover:bg-slate-50"
              onClick={() => setRenewalOverlayDismissed(true)}
            >
              {b.awakeningMilestoneTrackerDismiss}
            </button>
          </div>
        </div>
      ) : null}
    </>
  );
}
