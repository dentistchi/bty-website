"use client";

import { useEffect, useRef, useState } from "react";
import { ClinicalReasoningTrainer } from "./ClinicalReasoningTrainer";
import { ClinicalDiscoveryAttempt } from "./ClinicalDiscoveryAttempt";
import { discoveryReplyLabel, discoveryTurns, initialAssessment, isDiscoveryTrace, type DiscoveryReply } from "@/domain/clinical-pilot/discovery";
import { blankAnswers, initialAnswers, latestAnswers, releasedReference, responseFields,
  type Answers, type PilotCase, type PilotTrace, type Reaction } from "@/domain/clinical-pilot/pilot";

const endpoint = "/api/bty/clinical-pilot";
const button = "rounded-xl border border-slate-300 px-4 py-3 text-sm font-semibold disabled:opacity-40";
const primary = `${button} bg-slate-900 text-white`;
async function request(url: string, body?: object) {
  const r = await fetch(url, { credentials: "same-origin", cache: "no-store", ...(body ? {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
  } : {}) });
  const data = await r.json();
  if (!r.ok || !data.ok) throw Object.assign(Error(data.error ?? "UNAVAILABLE"), { status: r.status });
  return data;
}

export function ClinicalCasesPractice() {
  const [cases, setCases] = useState<PilotCase[]>([]);
  const [userId, setUserId] = useState("");
  const [admin, setAdmin] = useState(false);
  const [selected, setSelected] = useState<PilotCase | null>(null);
  const [writtenHistory, setWrittenHistory] = useState(false);
  const [mode, setMode] = useState<"library" | "interview" | "review">("library");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [reload, setReload] = useState(0);
  useEffect(() => {
    let cancelled = false;
    setLoading(true); setError("");
    void request(endpoint).then(data => {
      if (cancelled) return;
      setCases(data.cases); setUserId(data.userId); setAdmin(data.isAdmin);
    }).catch((e: Error) => { if (!cancelled) setError(e.message === "PILOT_NOT_ENABLED" ? "The author case pilot is not open yet. You can use the interview simulator." : "Could not load clinical cases. Sign in and try again."); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [reload]);

  if (selected) return writtenHistory
    ? <CaseAttempt key={selected.caseId} c={selected} userId={userId} onBack={() => { setSelected(null); setWrittenHistory(false); }} />
    : <ClinicalDiscoveryAttempt key={selected.caseId} c={selected} userId={userId} onBack={() => setSelected(null)} onWrittenHistory={() => setWrittenHistory(true)} />;
  return <section className="mx-auto max-w-3xl space-y-5 p-4 sm:p-6" aria-label="Clinical case practice">
    <header className="space-y-2">
      <p className="text-xs font-semibold uppercase tracking-wider text-teal-700">Clinical cases · author pilot</p>
      <h1 className="text-2xl font-bold">How would you approach this patient?</h1>
      <p className="text-sm text-slate-600">Start with the patient's concern. Ask your own questions, choose what to examine, and develop your assessment.</p>
      <p className="text-xs text-slate-500">Fictional cases · English clinical content · author references are drafts</p>
    </header>
    <div className="flex flex-wrap gap-2">
      {mode !== "library" && <button className={button} onClick={() => setMode("library")}>Case library</button>}
      {mode !== "interview" && <button className={button} onClick={() => setMode("interview")}>Interview simulator</button>}
      {admin && mode !== "review" && <button className={button} onClick={() => setMode("review")}>Review responses</button>}
    </div>
    {mode === "interview" ? <ClinicalReasoningTrainer /> : mode === "review" ? <ResponseReview /> : <>
      {loading && <p role="status">Loading cases…</p>}
      {error && <div role="alert"><p>{error}</p><button className={button} onClick={() => setReload(n => n + 1)}>Retry loading</button></div>}
      {!loading && !error && <>
        <p className="text-sm text-slate-500">{cases.filter(c => c.available).length} available · {cases.length} recorded cases</p>
        <div className="grid gap-3 sm:grid-cols-2">
          {cases.map(c => <button key={c.caseId} className="rounded-2xl border border-slate-200 p-4 text-left hover:border-teal-600 disabled:opacity-50" disabled={!c.available} onClick={() => setSelected(c)}>
            <span className="text-xs font-semibold text-teal-700">Case {String(c.number).padStart(3, "0")} · {c.available ? "Practice" : "Draft"}</span>
            <span className="mt-2 block font-semibold">{c.title}</span>
          </button>)}
        </div>
      </>}
    </>}
  </section>;
}

type Pending = Record<string, unknown>;
type ReactionDraft = Omit<Reaction, "helpful"> & { helpful: Reaction["helpful"] | "" };
function CaseAttempt({ c, userId, onBack }: { c: PilotCase; userId: string; onBack: () => void }) {
  const [trace, setTrace] = useState<PilotTrace | null>(null);
  const [answers, setAnswers] = useState<Answers>(blankAnswers);
  const [reaction, setReaction] = useState<ReactionDraft>({ helpful: "", comment: "", revisedPlan: "" });
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const [reload, setReload] = useState(0);
  const pending = useRef<Pending | null>(null);
  const lock = useRef(false);
  const cacheKey = `bty-clinical-pilot:${userId}:${c.caseId}:${c.version}`;

  function install(t: PilotTrace, restoreDraft = false) {
    setTrace(t); setAnswers(latestAnswers(t));
    if (restoreDraft && t.phase === "draft") {
      try {
        const cached = JSON.parse(localStorage.getItem(cacheKey) ?? "null");
        if (cached?.traceId === t.traceId && responseFields.every(([key]) => typeof cached.answers?.[key] === "string")) {
          setAnswers(cached.answers); setStatus("Recovered browser draft. Save it to the server before leaving.");
        }
      } catch { /* Browser recovery is optional, never the authority. */ }
    }
    if (restoreDraft && t.phase === "submitted") try {
      const cached = JSON.parse(localStorage.getItem(`${cacheKey}:reaction`) ?? "null");
      if (cached?.traceId === t.traceId && ["", "yes", "partly", "no"].includes(cached.reaction?.helpful)
        && typeof cached.reaction.comment === "string" && typeof cached.reaction.revisedPlan === "string") setReaction(cached.reaction);
    } catch { /* Optional recovery. */ }
  }
  useEffect(() => {
    let cancelled = false;
    setLoading(true); setError("");
    void request(`${endpoint}?caseId=${encodeURIComponent(c.caseId)}`).then(data => {
      if (cancelled) return;
      const current = data.traces.find((row: { raw_trace: PilotTrace }) => !isDiscoveryTrace(row.raw_trace));
      if (current) install(current.raw_trace, true);
    }).catch(() => { if (!cancelled) setError("Could not load previous attempts. Retry loading before starting."); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
    // Case/version are fixed for this keyed component.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reload]);

  function changeAnswer(key: keyof Answers, value: string) {
    const next = { ...answers, [key]: value }; setAnswers(next);
    if (trace) try { localStorage.setItem(cacheKey, JSON.stringify({ traceId: trace.traceId, answers: next })); } catch { /* Optional recovery. */ }
    setStatus("Browser draft · not yet saved to server");
  }
  function changeReaction(next: ReactionDraft) {
    setReaction(next);
    if (trace) try { localStorage.setItem(`${cacheKey}:reaction`, JSON.stringify({ traceId: trace.traceId, reaction: next })); } catch { /* Optional recovery. */ }
    setStatus("Reaction draft · not yet saved to server");
  }
  async function write(body: Pending) {
    if (lock.current) return;
    lock.current = true; setBusy(true); setError(""); pending.current = body;
    try {
      const data = await request(endpoint, body);
      install(data.trace); pending.current = null;
      if (body.operation === "start") setReaction({ helpful: "", comment: "", revisedPlan: "" });
      setStatus(body.operation === "react" ? "Response and reaction saved to server" : body.operation === "submit" ? "Initial response saved to server" : "Saved to server");
      if (body.operation === "submit" || body.operation === "react") try { localStorage.removeItem(cacheKey); if (body.operation === "react") localStorage.removeItem(`${cacheKey}:reaction`); } catch { /* Optional recovery. */ }
    } catch (e) {
      const code = e instanceof Error ? e.message : "UNAVAILABLE";
      if ((e as { status?: number }).status && (e as { status: number }).status < 500) pending.current = null;
      setStatus("Not saved to server");
      setError(code === "CONFLICT" || code === "IMMUTABLE" ? "This attempt changed in another tab. Your browser draft is retained. Reload the attempt before continuing."
        : code === "REASONING_REQUIRED" ? "Enter an evaluation, working diagnosis, treatment plan, and reasoning before submitting."
        : "Save could not be confirmed. Your text is still here. Retry the same save.");
    } finally { lock.current = false; setBusy(false); }
  }
  const submitted = trace ? initialAnswers(trace) : null;
  const reference = trace ? releasedReference(trace) : null;
  const shown = trace?.caseSnapshot ?? c;
  return <section className="mx-auto max-w-3xl space-y-5 p-4 sm:p-6">
    <button className="text-sm underline" onClick={onBack} disabled={busy || !!pending.current}>← Case library</button>
    <header><p className="text-xs font-semibold text-teal-700">Case {String(shown.number).padStart(3, "0")} · fictional patient</p><h1 className="mt-1 text-2xl font-bold">{shown.title}</h1></header>
    <article className="space-y-3 rounded-2xl bg-slate-50 p-4">
      <p className="whitespace-pre-wrap">{shown.scenario}</p>
      <ul className="list-disc space-y-2 pl-5 text-sm">{shown.findings.map((finding, i) => <li key={i}>{finding}</li>)}</ul>
      <p className="font-medium">{shown.question}</p>
    </article>
    {loading && <p role="status">Loading attempt…</p>}
    {!!status && <p role="status" className="text-sm">{status}</p>}
    {error && <div role="alert" className="space-y-3 rounded-xl border border-amber-400 p-4"><p>{error}</p>
      {pending.current ? <button className={button} disabled={busy} onClick={() => pending.current && void write(pending.current)}>Retry save</button>
        : <button className={button} onClick={() => setReload(n => n + 1)}>Retry loading</button>}
    </div>}
    {!loading && !error && !trace && <p>No previous written attempt is available. Return to the case library to begin an interview.</p>}
    {trace?.phase === "draft" && <form className="space-y-4" onSubmit={e => { e.preventDefault(); void write({ operation: "submit", traceId: trace.traceId, requestId: crypto.randomUUID(), answers }); }}>
      <p className="text-sm text-slate-600">Write your own approach first. Dr. Chi’s recorded approach appears after submission.</p>
      {trace.priorReferenceExposure === "prior_submission" && <p className="text-sm text-amber-800">You have previously submitted this case. This attempt is recorded as a repeat.</p>}
      <fieldset disabled={busy || !!pending.current} className="space-y-4">
        {responseFields.map(([key, label, hint]) => <label className="block space-y-1" key={key}><span className="font-semibold">{label}</span><span className="block text-sm text-slate-500">{hint}</span>
          <textarea required maxLength={10000} rows={4} value={answers[key]} onChange={e => changeAnswer(key, e.target.value)} className="block w-full rounded-xl border border-slate-300 p-3" />
        </label>)}
        <div className="flex flex-wrap gap-2"><button type="button" className={button} onClick={() => void write({ operation: "save", traceId: trace.traceId, requestId: crypto.randomUUID(), answers })}>Save draft</button><button className={primary}>Submit & compare</button></div>
      </fieldset>
    </form>}
    {submitted && reference && <>
      <section className="space-y-4" aria-label="Approach comparison">
        <h2 className="text-xl font-bold">Compare approaches</h2>
        <p className="text-sm text-slate-600">Notice priorities, reasoning, and conditions that change the plan. Agreement is not a medical accuracy score.</p>
        <div className="grid gap-4 md:grid-cols-2">
          <article className="space-y-3 rounded-2xl border p-4"><h3 className="font-bold">Your initial response</h3>{responseFields.map(([key, label]) => <div key={key}><h4 className="text-sm font-semibold">{label}</h4><p className="whitespace-pre-wrap break-words text-sm">{submitted[key]}</p></div>)}</article>
          <article className="space-y-3 rounded-2xl border border-teal-200 bg-teal-50 p-4"><h3 className="font-bold">Dr. Chi’s recorded approach</h3><p className="text-xs">English paraphrase · awaiting author review</p><p className="whitespace-pre-wrap break-words text-sm">{reference.paraphrase}</p>
            <details><summary className="cursor-pointer text-sm">Original response</summary><p lang="ko" className="mt-2 whitespace-pre-wrap break-words text-sm">{reference.original}</p></details>
            <p className="text-xs">{reference.label}</p>
            {reference.limitations.length > 0 && <details><summary className="cursor-pointer text-sm">What remains unspecified</summary><ul className="mt-2 list-disc space-y-2 pl-4 text-xs">{reference.limitations.map((x, i) => <li key={i}>{x}</li>)}</ul></details>}
          </article>
        </div>
        {reference.evidenceNotes.length > 0 && <details open className="rounded-xl border p-4"><summary className="cursor-pointer font-semibold">Clinical evidence notes · separate from the author response</summary><div className="mt-3 space-y-3 text-sm">{reference.evidenceNotes.map((x, i) => <p className="whitespace-pre-wrap break-words" key={i}>{x}</p>)}</div></details>}
      </section>
      {trace?.phase === "submitted" && <form className="space-y-3 rounded-2xl border p-4" onSubmit={e => { e.preventDefault(); void write({ operation: "react", traceId: trace.traceId, requestId: crypto.randomUUID(), reaction }); }}>
        <h2 className="text-lg font-bold">What was useful?</h2>
        <fieldset disabled={busy || !!pending.current} className="space-y-3">
          <label className="block">Was this comparison helpful?<select required className="ml-2 rounded border p-2" value={reaction.helpful} onChange={e => changeReaction({ ...reaction, helpful: e.target.value as ReactionDraft["helpful"] })}><option value="">Choose one</option><option value="yes">Yes</option><option value="partly">Partly</option><option value="no">No</option></select></label>
          <label className="block">What stood out, or what do you disagree with? (optional)<textarea maxLength={10000} rows={3} className="mt-1 block w-full rounded-xl border p-3" value={reaction.comment} onChange={e => changeReaction({ ...reaction, comment: e.target.value })} /></label>
          <label className="block">Would you change your plan? (optional)<textarea maxLength={10000} rows={3} className="mt-1 block w-full rounded-xl border p-3" value={reaction.revisedPlan} onChange={e => changeReaction({ ...reaction, revisedPlan: e.target.value })} /></label>
          <button className={primary}>Save reaction & finish</button>
        </fieldset>
      </form>}
      {trace?.phase === "completed" && <p className="rounded-xl bg-teal-50 p-4 font-semibold">Case completed. Your initial response and reaction are saved separately.</p>}
    </>}
  </section>;
}

type ReviewRow = { trace_id: string; doctorRef: string; raw_trace: PilotTrace; status: string; updated_at: string };
function ResponseReview() {
  const [rows, setRows] = useState<ReviewRow[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let cancelled = false;
    void request(`${endpoint}?view=review`).then(data => { if (!cancelled) setRows(data.rows); })
      .catch(() => { if (!cancelled) setError("Could not load responses. Platform-admin access is required."); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);
  function download() {
    const url = URL.createObjectURL(new Blob([JSON.stringify({ schema: "neurosight-author-pilot-export/v2", scope: "latest-50-attempts", rows }, null, 2)], { type: "application/json" }));
    const a = document.createElement("a"); a.href = url; a.download = "clinical-pilot-responses.json"; a.click(); URL.revokeObjectURL(url);
  }
  return <section className="space-y-4"><h2 className="text-xl font-bold">Response review</h2><p className="text-sm">Latest 50 attempts · questions, examinations, decisions, and reactions · pseudonymous doctor references</p>
    {loading && <p role="status">Loading responses…</p>}{error && <p role="alert">{error}</p>}
    {!loading && !error && <><button className={button} onClick={download}>Download these responses (JSON)</button>{!rows.length && <p>No responses yet.</p>}
      {rows.map(row => <details key={row.trace_id} className="rounded-xl border p-4"><summary className="cursor-pointer text-sm">{row.raw_trace.caseSnapshot.title} · {row.raw_trace.phase} · {row.doctorRef}</summary>
        <p className="mt-3 text-xs">{row.updated_at} · {row.raw_trace.priorReferenceExposure}</p>
        {isDiscoveryTrace(row.raw_trace) ? <div className="mt-4 space-y-4">
          <p className="text-xs">Question-led encounter · {row.raw_trace.discovery!.packVersion} · prior full case context: {row.raw_trace.discovery!.priorCaseContextExposure}</p>
          {row.raw_trace.discovery!.scenarioProvenance && <p className="text-xs text-amber-800">Fictional interview variant · additional patient details awaiting author review</p>}
          <h3 className="font-semibold">Question and examination sequence</h3>
          <p className="text-sm">Opening: {row.raw_trace.caseSnapshot.scenario}</p>
          <ol className="space-y-3">{row.raw_trace.events.filter(e => ["discovery_turn", "working_assessment", "assessment_submitted"].includes(e.type)).map(e => <li key={e.sequence} className="rounded-xl border p-3 text-sm">
            <p className="text-xs text-slate-500">Event {e.sequence} · {e.at}</p>
            {e.type === "discovery_turn" ? <><p className="mt-2 font-semibold">{String(e.payload.channel) === "exam" ? "Examination request" : "Patient question"}</p><p className="whitespace-pre-wrap break-words">{String(e.payload.question)}</p>
              <p className="mt-2 font-semibold">{discoveryReplyLabel(e.payload.reply as DiscoveryReply)}</p>
              <p className="mt-2 whitespace-pre-wrap break-words">{String((e.payload.reply as { text: string }).text)}</p>
              {!!(e.payload.reply as DiscoveryReply).recognizedTopicIds?.length && <p className="mt-2 text-xs">Recognized topics: {(e.payload.reply as DiscoveryReply).recognizedTopicIds!.join(", ")}{(e.payload.reply as DiscoveryReply).unavailableTopicIds?.length ? ` · not supplied: ${(e.payload.reply as DiscoveryReply).unavailableTopicIds!.join(", ")}` : ""}</p>}
              {!!(e.payload.reply as { fictionalExtensionFactIds?: string[] }).fictionalExtensionFactIds?.length && <p className="mt-2 text-xs text-amber-800">Includes fictional practice details awaiting author review</p>}
              <p className="mt-2 text-xs">{(e.payload.reply as { resolution: string }).resolution} · information available beforehand: {(e.payload.informationBefore as string[]).join(", ") || "opening only"}</p></>
              : <><p className="mt-2 font-semibold">{e.type === "working_assessment" ? "Working assessment" : "Submitted assessment"}</p><p className="whitespace-pre-wrap break-words">{String(e.payload.text)}</p><p className="mt-2 text-xs">Information available: {(e.payload.informationAvailable as string[]).join(", ") || "opening only"}</p></>}
          </li>)}</ol>
          <p className="text-sm">{discoveryTurns(row.raw_trace).length} requests recorded · initial assessment: {initialAssessment(row.raw_trace) ?? "Not submitted"}</p>
        </div> : <dl className="mt-4 space-y-3">{responseFields.map(([key, label]) => <div key={key}><dt className="text-sm font-semibold">{label}{row.raw_trace.phase === "draft" ? " · draft" : " · initial response"}</dt><dd className="whitespace-pre-wrap break-words text-sm">{latestAnswers(row.raw_trace)[key] || "Not recorded"}</dd></div>)}</dl>}
        {row.raw_trace.events.filter(e => e.type === "reaction_submitted").map(e => {
          const r = e.payload.reaction as Reaction;
          return <div key={e.sequence} className="mt-4 space-y-2 rounded-xl bg-teal-50 p-3 text-sm"><h3 className="font-semibold">Learner reaction</h3><p>Helpful: {r.helpful}</p><p className="whitespace-pre-wrap break-words">{r.comment || "No comment"}</p><p className="whitespace-pre-wrap break-words">Revised plan: {r.revisedPlan || "Not provided"}</p></div>;
        })}
        <details className="mt-4"><summary className="cursor-pointer text-sm">Event timeline</summary><ol className="mt-2 space-y-1 text-xs">{row.raw_trace.events.map(e => <li key={e.sequence}>{e.sequence}. {e.type.replaceAll("_", " ")} · {e.at}</li>)}</ol></details>
      </details>)}</>}
  </section>;
}
