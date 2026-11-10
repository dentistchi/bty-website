"use client";
import { TRACKING_COPY, trackingState, trackingComplete, type summariseTracking } from "@/domain/announcement/trackingEvidence";
import type { HostAnnouncement } from "@/lib/bty/announcement/announcementService.server";
export default function AnnouncementTrackingSummary({ counts, audience, locale }: {
  counts: ReturnType<typeof summariseTracking>;
  audience: NonNullable<HostAnnouncement["audience"]>;
  locale: "en" | "ko";
}) {
  const t = TRACKING_COPY[locale];
  const modes = new Set(audience.map(person => person.trackingMode).filter(Boolean));
  const mode = modes.size === 1 ? [...modes][0] : null;
  const completed = counts.targeted - counts.remaining;
  const progress = locale === "ko"
    ? `${counts.targeted}명 중 ${completed}명 ${mode === "acknowledgment" ? "확인 완료" : mode === "response" ? "답변 완료" : "완료"}`
    : `${completed} of ${counts.targeted} ${mode === "acknowledgment" ? "confirmed" : mode === "response" ? "replied" : "completed"}`;
  const pending = counts.remaining === 0
    ? (locale === "ko" ? "모두 완료" : mode === "acknowledgment" ? "All confirmed" : mode === "response" ? "All replied" : "All completed")
    : (locale === "ko"
      ? `${mode === "acknowledgment" ? "확인 대기" : mode === "response" ? "답변 대기" : "완료 대기"} ${counts.remaining}명`
      : `${counts.remaining} awaiting ${mode === "acknowledgment" ? "confirmation" : mode === "response" ? "reply" : "completion"}`);
  return <section data-testid="announcement-tracking-summary" className="flex flex-col gap-3">
    <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
      <p data-testid="tracking-progress" className="text-[0.95rem] font-medium text-white/90">{progress}</p>
      <span data-testid="tracking-pending" className="text-[0.8rem] text-[#C9A66B]">{pending}</span>
    </div>
    <details><summary className="min-h-11 cursor-pointer py-2 text-[0.8rem] text-white/65">{locale === "ko" ? "사람별 보기" : "View people"}</summary>
      <p className="text-xs leading-5 text-white/55">{t.evidence}</p>
      <ul className="mt-2">{audience.map((r, i) => <li key={r.recipientId} className="py-2 text-[0.82rem] leading-6 text-white/75">
        <span>{r.display ?? `${t.someone} ${i + 1}`}</span>{" · "}
        {r.signInStatus && trackingState(r) === "targeted" ? (
          <span>{r.signInStatus === "notified" ? t.notifiedAwaitingSignIn : t.awaitingSignIn}</span>
        ) : (
          <>
            <span>{trackingState(r) === "targeted" ? t.noEvidence : t[trackingState(r)]}</span>{" · "}
            <span>{trackingComplete(r) ? t.complete : t.remaining}</span>
          </>
        )}
        {r.responseText ? <p>{r.responseText}</p> : null}
      </li>)}</ul>
    </details>
  </section>;
}
