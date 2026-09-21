"use client";
import { useEffect, useState } from "react";

export function FoundryQuizResults({ eventId, participantIds }: { eventId: string; participantIds: { id: string; display_name: string }[] }) {
  const [data, setData] = useState<{ submitted: number; averageScore: number | null; byParticipant: Record<string, { correctCount: number; totalCount: number }> } | null>(null);
  useEffect(() => { let live = true; void fetch(`/api/bty/foundry/events/${encodeURIComponent(eventId)}/quiz-results`, { credentials: "include", cache: "no-store" }).then(async (r) => r.ok ? r.json() : null).then((next) => { if (live) setData(next); }).catch(() => {}); return () => { live = false; }; }, [eventId]);
  if (!data) return null;
  return <section className="flex flex-col gap-2 rounded-xl border border-white/[0.08] bg-white/[0.02] p-4"><p className="text-xs font-medium uppercase tracking-[0.14em] text-white/45">퀴즈</p><p className="text-sm text-white/75">퀴즈 완료 {data.submitted} / {participantIds.length}{data.averageScore !== null ? ` · 평균 점수 ${data.averageScore}%` : ""}</p>{participantIds.map((participant) => { const score = data.byParticipant[participant.id]; return score ? <p key={participant.id} className="text-sm text-white/65">{participant.display_name} · {score.correctCount} / {score.totalCount} · {Math.round(score.correctCount * 100 / score.totalCount)}%</p> : null; })}</section>;
}
