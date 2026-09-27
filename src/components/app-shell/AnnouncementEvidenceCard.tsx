"use client";
import { openSourceLink } from "@/lib/bty/teams/openSourceLink";
import { useState } from "react";
import { TRACKING_COPY, trackingComplete, type TrackingEvidence } from "@/domain/announcement/trackingEvidence";
export function AnnouncementEvidenceCard({ item, locale, onChanged }: {
  item: TrackingEvidence & { announcementId: string; hostFraming: string; sourceUrl: string | null };
  locale: "en" | "ko"; onChanged: () => Promise<void>;
}) {
  const t = TRACKING_COPY[locale];
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  async function record(action: "open" | "acknowledge" | "respond") {
    setBusy(true); setFailed(false);
    try {
      const res = await fetch(`/api/bty/announcements/${encodeURIComponent(item.announcementId)}/evidence`, {
        method: "POST", credentials: "include", headers: { "content-type": "application/json" },
        body: JSON.stringify({ action, ...(action === "respond" ? { text } : {}) }),
      });
      if (!res.ok) { setFailed(true); return; }
      if (action === "open") setOpen(true);
      await onChanged();
    } catch { setFailed(true); } finally { setBusy(false); }
  }
  return <article className="flex flex-col gap-3 rounded-2xl border border-white/10 p-4" data-testid="announcement-evidence">
    <h3>{item.trackingMode === "response" ? t.response : t.acknowledgment}</h3>
    {!open ? <button className="min-h-11" disabled={busy} onClick={() => void record("open")}>{t.open}</button> : <>
      <p>{item.hostFraming}</p>
      {item.sourceUrl ? <a href={item.sourceUrl} target="_blank" rel="noopener noreferrer" onClick={e => { e.preventDefault(); void openSourceLink(item.sourceUrl).then(ok => { if (!ok) setFailed(true); }); }}>{t.source}</a> : null}
      {trackingComplete(item) ? <p>{t.complete}</p> : item.trackingMode === "response" ? <>
        <label htmlFor={`answer-${item.announcementId}`}>{t.answer}</label>
        <textarea id={`answer-${item.announcementId}`} maxLength={1000} value={text} onChange={e => setText(e.target.value)} />
        <button className="min-h-11" disabled={busy || !text.trim()} onClick={() => void record("respond")}>{t.submit}</button>
      </> : <button className="min-h-11" disabled={busy} onClick={() => void record("acknowledge")}>{t.acknowledge}</button>}
    </>}
    {failed ? <p role="alert">{t.failed}</p> : null}
  </article>;
}
