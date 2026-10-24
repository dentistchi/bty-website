"use client";

import { useEffect, useRef, useState } from "react";
import { releasedReference, type PilotCase, type PilotTrace, type Reaction } from "@/domain/clinical-pilot/pilot";
import {
  DISCOVERY_INTERACTION_VERSION, discoveryReplyLabel, discoveryTurns, initialAssessment, isDiscoveryTrace, latestAssessment,
  type DiscoveryChannel,
} from "@/domain/clinical-pilot/discovery";

const endpoint = "/api/bty/clinical-pilot";
const button = "rounded-xl border border-slate-300 px-4 py-3 text-sm font-semibold disabled:opacity-40";
const primary = button + " bg-slate-900 text-white";
type ReactionDraft = Omit<Reaction, "helpful"> & { helpful: Reaction["helpful"] | "" };
const emptyReaction = (): ReactionDraft => ({ helpful: "", comment: "", revisedPlan: "" });
type Identity = { traceId: string; requestId: string };
type WriteBody = Identity & (
  | { operation: "start"; caseId: string; caseVersion: string }
  | { operation: "message"; text: string; channel: DiscoveryChannel; expectedEventCount: number }
  | { operation: "decision" | "conclude"; text: string; expectedEventCount: number }
  | { operation: "react"; reaction: ReactionDraft }
);
type AssessmentMode = "working" | "final" | null;
type Draft = { question: string; channel: DiscoveryChannel; assessment: string; assessmentMode: AssessmentMode; reaction: ReactionDraft };
const emptyDraft = (): Draft => ({ question: "", channel: "patient", assessment: "", assessmentMode: null, reaction: emptyReaction() });

async function request(url: string, body?: WriteBody) {
  const r = await fetch(url, { credentials: "same-origin", cache: "no-store", ...(body ? {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
  } : {}) });
  const data = await r.json();
  if (!r.ok || !data.ok) throw Object.assign(Error(data.error ?? "UNAVAILABLE"), { status: r.status });
  return data;
}
function readDraft(key: string): Draft | null {
  try {
    const d = JSON.parse(localStorage.getItem(key) ?? "null");
    if (typeof d?.question !== "string" || typeof d.assessment !== "string"
      || !["patient", "exam"].includes(d.channel) || ![null, "working", "final"].includes(d.assessmentMode)
      || !["", "yes", "partly", "no"].includes(d.reaction?.helpful)
      || typeof d.reaction.comment !== "string" || typeof d.reaction.revisedPlan !== "string") return null;
    return d as Draft;
  } catch { return null; }
}

export function ClinicalDiscoveryAttempt({ c, userId, onBack, onWrittenHistory }: {
  c: PilotCase; userId: string; onBack: () => void; onWrittenHistory: () => void;
}) {
  const [trace, setTrace] = useState<PilotTrace | null>(null);
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [hasWrittenHistory, setHasWrittenHistory] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const [needsReload, setNeedsReload] = useState(false);
  const [reload, setReload] = useState(0);
  const pending = useRef<WriteBody | null>(null);
  const lock = useRef(false);
  const logEnd = useRef<HTMLDivElement>(null);
  const assessmentInput = useRef<HTMLTextAreaElement>(null);
  const cacheBase = "bty-clinical-discovery:" + userId + ":" + c.caseId + ":" + c.version + ":" + DISCOVERY_INTERACTION_VERSION;
  const outboxKey = cacheBase + ":outbox";
  const draftKey = (traceId: string) => cacheBase + ":" + traceId;

  function storeDraft(traceId: string, next: Draft) {
    try { localStorage.setItem(draftKey(traceId), JSON.stringify(next)); } catch { /* Browser recovery is optional. */ }
  }
  function changeDraft(patch: Partial<Draft>) {
    const next = { ...draft, ...patch };
    setDraft(next);
    if (trace) storeDraft(trace.traceId, next);
    setStatus("Draft · not yet sent.");
  }
  function forgetPending() {
    pending.current = null;
    try { localStorage.removeItem(outboxKey); } catch { /* Optional recovery. */ }
  }
  function draftAfterAcknowledgement(body: WriteBody, current: Draft): Draft {
    if (body.operation === "start") return emptyDraft();
    if (body.operation === "message") return { ...current, question: "" };
    if (body.operation === "decision") return { ...current, assessment: body.text, assessmentMode: null };
    if (body.operation === "conclude") return { ...current, assessment: body.text, assessmentMode: null };
    return current;
  }

  useEffect(() => {
    let cancelled = false;
    setLoading(true); setError("");
    void request(endpoint + "?caseId=" + encodeURIComponent(c.caseId)).then(data => {
      if (cancelled) return;
      const all = (data.traces ?? []) as { raw_trace: PilotTrace }[];
      const discovery = all.filter(row => isDiscoveryTrace(row.raw_trace));
      setHasWrittenHistory(all.some(row => !isDiscoveryTrace(row.raw_trace)));
      let queued: WriteBody | null = pending.current;
      if (!queued && !trace) try {
        const value = JSON.parse(localStorage.getItem(outboxKey) ?? "null");
        if (typeof value?.traceId === "string" && typeof value.requestId === "string"
          && ["start", "message", "decision", "conclude", "react"].includes(value.operation)) queued = value as WriteBody;
      } catch { /* Optional recovery. */ }
      const desiredTraceId = queued?.traceId ?? trace?.traceId;
      const current = desiredTraceId ? discovery.find(row => row.raw_trace.traceId === desiredTraceId) : discovery[0];
      if (current) {
        const t = current.raw_trace;
        // Another tab may have overwritten the shared browser cache after a
        // conflict. Keep this tab's own unsent text during an explicit reload.
        let recovered = (trace?.traceId === t.traceId ? draft : null)
          ?? readDraft(draftKey(t.traceId)) ?? { ...emptyDraft(), assessment: latestAssessment(t) };
        const acknowledged = !!queued && t.events.some(e => e.requestId === queued!.requestId);
        if (acknowledged && queued) {
          recovered = draftAfterAcknowledgement(queued, recovered);
          forgetPending();
          storeDraft(t.traceId, recovered);
        } else pending.current = queued;
        setTrace(t); setDraft(recovered);
        setStatus(pending.current ? "A previous save could not be confirmed. Retry the same request."
          : recovered.question || recovered.assessmentMode ? "Recovered browser draft. It has not been sent."
            : "Saved conversation restored.");
      } else if (trace && !queued) {
        setNeedsReload(true);
        setError("This attempt is no longer in the recent history returned by the server. Your text is retained. Return to the case library to choose an encounter.");
        return;
      } else {
        setTrace(null); setDraft(queued ? readDraft(draftKey(queued.traceId)) ?? emptyDraft() : emptyDraft());
        pending.current = queued;
        setStatus(queued ? "A previous save could not be confirmed. Retry the same request." : "");
      }
      setNeedsReload(false);
      if (pending.current) setError("Save could not be confirmed. Your text is retained. Retry the same request.");
    }).catch(() => { if (!cancelled) setError("Could not load your conversation. Retry loading before continuing."); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
    // User, case and presentation are fixed for this keyed component.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reload]);

  const turns = trace ? discoveryTurns(trace) : [];
  useEffect(() => { logEnd.current?.scrollIntoView?.({ block: "nearest", behavior: "smooth" }); }, [turns.length]);
  useEffect(() => {
    if (draft.assessmentMode) assessmentInput.current?.scrollIntoView?.({ block: "nearest", behavior: "smooth" });
  }, [draft.assessmentMode]);

  async function write(body: WriteBody) {
    if (lock.current || needsReload) return;
    lock.current = true; pending.current = body;
    setBusy(true); setError("");
    storeDraft(body.traceId, draft);
    try { localStorage.setItem(outboxKey, JSON.stringify(body)); } catch { /* Optional recovery. */ }
    try {
      const data = await request(endpoint, body);
      const saved = data.trace as PilotTrace;
      if (!isDiscoveryTrace(saved)) throw Error("UNEXPECTED_ATTEMPT");
      const nextDraft = draftAfterAcknowledgement(body, draft);
      setTrace(saved); setDraft(nextDraft); storeDraft(saved.traceId, nextDraft); forgetPending();
      setStatus(body.operation === "message" ? "Question and response saved to server."
        : body.operation === "decision" ? "Working assessment saved. You can continue the interview."
          : body.operation === "conclude" ? "Assessment and conversation saved to server."
            : body.operation === "react" ? "Comparison reaction saved to server." : "Encounter started and saved to server.");
    } catch (e) {
      const code = e instanceof Error ? e.message : "UNAVAILABLE";
      const statusCode = (e as { status?: number }).status;
      if (statusCode && statusCode < 500) forgetPending();
      const conflict = code === "CONFLICT" || code === "IMMUTABLE";
      setNeedsReload(conflict);
      setStatus("Save not confirmed.");
      setError(conflict ? "This attempt changed in another tab. Your text is retained. Reload the attempt before continuing."
        : code === "REASONING_REQUIRED" || code === "ASSESSMENT_REQUIRED" ? "Record your assessment and plan before finishing."
          : statusCode === 400 ? "That request could not be accepted. Your text is retained; review it and try again."
            : "Save could not be confirmed. Your text is retained. Retry the same request.");
    } finally { lock.current = false; setBusy(false); }
  }
  function start() {
    void write({ operation: "start", traceId: crypto.randomUUID(), requestId: crypto.randomUUID(), caseId: c.caseId, caseVersion: c.version });
  }
  function identity(): Identity {
    return { traceId: trace!.traceId, requestId: crypto.randomUUID() };
  }
  const locked = busy || !!pending.current;
  const readOnly = locked || needsReload;
  const shown = trace?.caseSnapshot ?? c;
  const submitted = trace ? initialAssessment(trace) : null;
  const reference = trace ? releasedReference(trace) : null;

  return <section className="mx-auto max-w-3xl space-y-4 p-4 pb-8 sm:p-6" aria-label="Clinical discovery encounter">
    <div className="flex flex-wrap items-center gap-3">
      <button className="text-sm underline" disabled={locked} onClick={onBack}>← Case library</button>
      {hasWrittenHistory && <button className="text-sm underline" disabled={locked} onClick={onWrittenHistory}>View previous written attempt</button>}
    </div>
    <header className="space-y-2">
      <p className="text-xs font-semibold text-teal-700">Case {String(shown.number).padStart(3, "0")} · fictional patient</p>
      <h1 className="text-2xl font-bold">Meet your patient</h1>
      <p className="text-sm text-slate-600">Ask your own questions and request the examinations you choose. Finish when you are ready to record your assessment.</p>
      {trace?.discovery?.scenarioProvenance && <p className="text-xs text-slate-500">Fictional interview variant · scenario details awaiting author review</p>}
    </header>
    {loading && <p role="status">Loading conversation…</p>}
    {status && <p role="status" className="text-sm text-slate-600">{status}</p>}
    {error && <div role="alert" className="space-y-3 rounded-xl border border-amber-400 p-4 text-sm">
      <p>{error}</p>
      {pending.current ? <button className={button} disabled={busy} onClick={() => pending.current && void write(pending.current)}>Retry same request</button>
        : <button className={button} disabled={busy} onClick={() => setReload(n => n + 1)}>{needsReload ? "Reload attempt" : "Retry loading"}</button>}
    </div>}
    {!loading && !trace && !error && <>
      <p className="rounded-2xl bg-slate-50 p-4 text-sm">Your patient is ready. Begin the encounter to hear their concern.</p>
      <button className={primary} disabled={locked} onClick={start}>Begin encounter</button>
    </>}
    {trace && <>
      {trace.priorReferenceExposure === "prior_submission" && <p className="text-sm text-amber-800">You have previously submitted this case. This attempt is recorded as a repeat.</p>}
      {trace.discovery?.priorCaseContextExposure === "prior-written-case" && <p className="text-sm text-amber-800">You previously opened this as a written case. That prior case information is recorded as already seen.</p>}
      <div role="log" aria-label="Patient conversation" aria-live="polite" className="max-h-[48dvh] min-h-40 space-y-4 overflow-y-auto rounded-2xl border border-slate-200 p-3 sm:p-4">
        <article className="mr-6 rounded-2xl bg-teal-50 p-3"><p className="mb-1 text-xs font-semibold text-teal-800">Patient</p><p className="whitespace-pre-wrap break-words text-sm">{shown.scenario}</p></article>
        {turns.map(turn => <div key={turn.sequence} className="space-y-2">
          <article className="ml-6 rounded-2xl bg-slate-100 p-3"><p className="mb-1 text-xs font-semibold text-slate-600">You · {turn.channel === "patient" ? "Question" : "Examination request"}</p><p className="whitespace-pre-wrap break-words text-sm">{turn.question}</p></article>
          <article className={turn.channel === "patient" && turn.reply.resolution === "answered" && turn.reply.responseKind !== "case-information" ? "mr-6 rounded-2xl bg-teal-50 p-3" : "mr-6 rounded-2xl border border-slate-200 p-3"}><p className="mb-1 text-xs font-semibold text-teal-800">{discoveryReplyLabel(turn.reply)}</p><p className="whitespace-pre-wrap break-words text-sm">{turn.reply.text}</p></article>
        </div>)}
        <div ref={logEnd} />
      </div>
      {trace.phase === "draft" && <>
        {latestAssessment(trace) && <details className="rounded-xl border p-3 text-sm"><summary className="cursor-pointer font-semibold">Last recorded working assessment</summary><p className="mt-2 whitespace-pre-wrap break-words">{latestAssessment(trace)}</p></details>}
        {!draft.assessmentMode ? <>
          <form onSubmit={e => { e.preventDefault(); if (draft.question.trim()) void write({ ...identity(), operation: "message", text: draft.question, channel: draft.channel, expectedEventCount: trace.events.length }); }} className="space-y-3 rounded-2xl border bg-white p-3 sm:p-4">
            <fieldset disabled={readOnly} className="space-y-3">
              <legend className="sr-only">Choose who to address</legend>
              <div className="flex flex-wrap gap-2">
                <button type="button" aria-pressed={draft.channel === "patient"} className={draft.channel === "patient" ? primary : button} onClick={() => changeDraft({ channel: "patient" })}>Ask patient</button>
                <button type="button" aria-pressed={draft.channel === "exam"} className={draft.channel === "exam" ? primary : button} onClick={() => changeDraft({ channel: "exam" })}>Examine or test</button>
              </div>
              <label className="block space-y-2"><span className="text-sm font-semibold">Your question or examination request</span>
                <textarea required maxLength={2000} rows={3} value={draft.question} onChange={e => changeDraft({ question: e.target.value })} className="block w-full rounded-xl border border-slate-300 p-3 text-base" />
              </label>
              <button className={primary} disabled={!draft.question.trim() || readOnly}>{busy ? "Saving…" : draft.channel === "patient" ? "Send question" : "Request examination"}</button>
            </fieldset>
          </form>
          <div className="flex flex-wrap gap-2">
            <button className={button} disabled={readOnly} onClick={() => changeDraft({ assessmentMode: "working" })}>Record working assessment</button>
            <button className={button} disabled={readOnly} onClick={() => changeDraft({ assessmentMode: "final" })}>Finish assessment</button>
          </div>
        </> : <form className="space-y-3 rounded-2xl border p-4" onSubmit={e => {
          e.preventDefault();
          if (draft.assessment.trim()) void write({ ...identity(), operation: draft.assessmentMode === "final" ? "conclude" : "decision", text: draft.assessment, expectedEventCount: trace.events.length });
        }}>
          <fieldset disabled={readOnly} className="space-y-3">
            <label className="block space-y-2"><span className="font-semibold">Your assessment and plan</span>
              <span className="block text-sm text-slate-600">Record your current assessment, next steps, and reasoning. Include uncertainty.</span>
              <textarea ref={assessmentInput} required maxLength={10000} rows={5} value={draft.assessment} onChange={e => changeDraft({ assessment: e.target.value })} className="block w-full rounded-xl border border-slate-300 p-3 text-base" />
            </label>
            {draft.assessmentMode === "final" && <p className="text-sm text-slate-600">Finishing saves your initial assessment and opens the recorded author comparison.</p>}
            {draft.question.trim() && <p className="text-sm text-slate-600">Your unsent question is retained. It will only become part of the conversation if you return to the interview and send it.</p>}
            <div className="flex flex-wrap gap-2"><button className={primary}>{draft.assessmentMode === "final" ? "Submit assessment & compare" : "Save working assessment"}</button>
              <button type="button" className={button} onClick={() => changeDraft({ assessmentMode: null })}>Return to interview</button></div>
          </fieldset>
        </form>}
      </>}
      {submitted !== null && reference && <section className="space-y-4" aria-label="Approach comparison">
        <h2 className="text-xl font-bold">Compare approaches</h2>
        {trace.discovery?.scenarioProvenance && <p className="text-sm text-slate-600">This interview includes fictional details added for practice. The recorded author perspective below predates those additions; their alignment is awaiting author review.</p>}
        <p className="text-sm text-slate-600">Review the questions you chose, the information you obtained, and the reasoning behind your plan. Agreement is not a medical accuracy score.</p>
        <div className="grid gap-4 md:grid-cols-2">
          <article className="space-y-3 rounded-2xl border p-4"><h3 className="font-bold">Your initial assessment and plan</h3><p className="whitespace-pre-wrap break-words text-sm">{submitted}</p></article>
          <article className="space-y-3 rounded-2xl border border-teal-200 bg-teal-50 p-4"><h3 className="font-bold">Dr. Chi’s recorded approach</h3><p className="text-xs">English paraphrase · awaiting author review</p><p className="whitespace-pre-wrap break-words text-sm">{reference.paraphrase}</p>
            <details><summary className="cursor-pointer text-sm">Original response</summary><p lang="ko" className="mt-2 whitespace-pre-wrap break-words text-sm">{reference.original}</p></details>
            <p className="text-xs">{reference.label}</p>
            {reference.limitations.length > 0 && <details><summary className="cursor-pointer text-sm">What remains unspecified</summary><ul className="mt-2 list-disc space-y-2 pl-4 text-xs">{reference.limitations.map((x, i) => <li key={i}>{x}</li>)}</ul></details>}
          </article>
        </div>
        {reference.interviewContext && <details className="rounded-xl border p-4"><summary className="cursor-pointer font-semibold">Review the patient information after your assessment</summary>
          <p className="mt-2 text-sm text-slate-600">Compare what you asked with the case information. Unavailable results remain unknown.</p>
          <dl className="mt-3 space-y-3">{reference.interviewContext.facts.map(f => <div key={f.factId} className="text-sm"><dt className="font-semibold">{f.label}{!f.available ? " · unavailable" : ""}</dt><dd className="mt-1 whitespace-pre-wrap break-words">{f.answer}</dd>
            {f.provenance === "fictional-extension-awaiting-review" && <dd className="mt-1 text-xs text-slate-500">Fictional practice detail · awaiting author review</dd>}</div>)}</dl>
        </details>}
        {reference.evidenceNotes.length > 0 && <details open className="rounded-xl border p-4"><summary className="cursor-pointer font-semibold">Clinical evidence notes · separate from the author response</summary><div className="mt-3 space-y-3 text-sm">{reference.evidenceNotes.map((x, i) => <p className="whitespace-pre-wrap break-words" key={i}>{x}</p>)}</div></details>}
      </section>}
      {trace.phase === "submitted" && <form className="space-y-3 rounded-2xl border p-4" onSubmit={e => { e.preventDefault(); void write({ ...identity(), operation: "react", reaction: draft.reaction }); }}>
        <h2 className="text-lg font-bold">What was useful?</h2>
        <fieldset disabled={readOnly} className="space-y-3">
          <label className="block text-sm">Was this comparison helpful?<select required className="ml-2 rounded border p-2" value={draft.reaction.helpful} onChange={e => changeDraft({ reaction: { ...draft.reaction, helpful: e.target.value as ReactionDraft["helpful"] } })}><option value="">Choose one</option><option value="yes">Yes</option><option value="partly">Partly</option><option value="no">No</option></select></label>
          <label className="block text-sm">What stood out, or what do you disagree with? (optional)<textarea maxLength={10000} rows={3} className="mt-1 block w-full rounded-xl border p-3 text-base" value={draft.reaction.comment} onChange={e => changeDraft({ reaction: { ...draft.reaction, comment: e.target.value } })} /></label>
          <label className="block text-sm">Would you change your plan? (optional)<textarea maxLength={10000} rows={3} className="mt-1 block w-full rounded-xl border p-3 text-base" value={draft.reaction.revisedPlan} onChange={e => changeDraft({ reaction: { ...draft.reaction, revisedPlan: e.target.value } })} /></label>
          <button className={primary}>Save reaction & finish</button>
        </fieldset>
      </form>}
      {trace.phase === "completed" && <>
        <p className="rounded-xl bg-teal-50 p-4 font-semibold">Encounter completed. Your conversation, initial assessment, and reaction are saved separately.</p>
        <button className={button} disabled={readOnly} onClick={start}>Start new attempt</button>
      </>}
    </>}
  </section>;
}
