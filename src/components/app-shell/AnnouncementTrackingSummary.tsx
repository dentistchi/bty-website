"use client";
import { TRACKING_COPY, trackingState, trackingComplete, type TrackingEvidence, type summariseTracking } from "@/domain/announcement/trackingEvidence";
export default function AnnouncementTrackingSummary({ counts, audience, locale }: {
  counts: ReturnType<typeof summariseTracking>;
  audience: (TrackingEvidence & { recipientId: string; display: string | null; responseText: string | null })[];
  locale: "en" | "ko";
}) {
  const t = TRACKING_COPY[locale];
  return <section data-testid="announcement-tracking-summary" className="flex flex-col gap-3">
    <dl className="flex flex-wrap gap-3">{(["targeted", "opened", "acknowledged", "responded", "remaining"] as const).map(key =>
      <div key={key}><dt>{t[key]}</dt><dd>{counts[key]}</dd></div>)}</dl>
    <p className="text-xs text-white/60">{t.evidence}</p>
    <details><summary>{locale === "ko" ? "사람별 상태" : "Status by recipient"}</summary>
      <ul>{audience.map((r, i) => <li key={r.recipientId} className="py-2">
        <span>{r.display ?? `${t.someone} ${i + 1}`}</span>{" · "}
        <span>{trackingState(r) === "targeted" ? t.noEvidence : t[trackingState(r)]}</span>{" · "}
        <span>{trackingComplete(r) ? t.complete : t.remaining}</span>
        {r.responseText ? <p>{r.responseText}</p> : null}
      </li>)}</ul>
    </details>
  </section>;
}
