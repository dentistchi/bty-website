"use client";

import { useEffect, useRef, useState } from "react";
import { CASE_001_ENCOUNTER, type EncounterTraceV2 } from "@/domain/clinical-encounter/encounter";
import { compareEncounter } from "@/domain/clinical-encounter/comparison";
import { validateEncounterTrace } from "@/domain/clinical-encounter/serverPersistence";
import {
  completeEncounter, decisionFromTrace, emptyDecision, isEncounterCompleted,
  recordDecision, sameEncounterTrace, startEncounter, submit, type EncounterDecision,
} from "@/domain/clinical-encounter/session";

const endpoint = "/api/bty/clinical-encounter/traces";
const fields: [keyof EncounterDecision, string][] = [
  ["differential", "Differential (optional)"], ["diagnosis", "Diagnosis"],
  ["treatment", "Treatment"], ["followup", "Follow-up"],
  ["confidence", "Confidence"], ["rationale", "Rationale"],
];
const currentCase = (t: EncounterTraceV2) => t.caseId === CASE_001_ENCOUNTER.caseId && t.caseVersion === CASE_001_ENCOUNTER.version;

export function ClinicalReasoningTrainer() {
  const [trace, setTrace] = useState<EncounterTraceV2 | null>(null);
  const [resumeCandidate, setResumeCandidate] = useState<EncounterTraceV2 | null>(null);
  const traceRef = useRef<EncounterTraceV2 | null>(null);
  const [input, setInput] = useState("");
  const [decision, setDecision] = useState<EncounterDecision>({ ...emptyDecision });
  const [ready, setReady] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [completing, setCompleting] = useState(false);
  const [restarting, setRestarting] = useState(false);
  const [confirmRestart, setConfirmRestart] = useState(false);
  const completionLock = useRef(false);
  const [saveState, setSaveState] = useState("Loading encounter…");
  const [error, setError] = useState<string | null>(null);
  // Serialize writes so a slow active save cannot replace newer client events.
  const queue = useRef<Promise<void>>(Promise.resolve());
  const revision = useRef(0);

  function install(next: EncounterTraceV2) {
    traceRef.current = next;
    setTrace(next);
  }
  function persist(next: EncounterTraceV2, operation: "save" | "complete") {
    const version = ++revision.current;
    setSaveState(operation === "complete" ? "Completing…" : "Saving…");
    setError(null);
    const task = queue.current.then(async () => {
      const response = await fetch(endpoint, {
        method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ trace: next, operation }),
      });
      const result = await response.json();
      if (!response.ok || !result.ok || result.status !== (operation === "complete" ? "completed" : "active")) {
        throw new Error("SAVE_FAILED");
      }
      if (version === revision.current) setSaveState(operation === "complete" ? "Completed and saved" : "Saved to server");
    });
    queue.current = task.catch(() => {});
    return task;
  }
  function saveActive(next: EncounterTraceV2) {
    const task = persist(next, "save");
    const version = revision.current;
    void task.catch(() => {
      if (version !== revision.current) return;
      setSaveState("Not saved to server");
      setError("Save failed. Your encounter remains on this page. Retry saving before leaving.");
    });
  }

  useEffect(() => {
    let cancelled = false;
    async function load() {
      let resumed: EncounterTraceV2 | undefined;
      let failed = false;
      try {
        const params = new URLSearchParams({ caseId: CASE_001_ENCOUNTER.caseId, caseVersion: CASE_001_ENCOUNTER.version, status: "active" });
        const response = await fetch(`${endpoint}?${params}`, { credentials: "same-origin", cache: "no-store" });
        const result = await response.json();
        if (!response.ok || !result.ok || !Array.isArray(result.traces)) throw new Error("LOAD_FAILED");
        resumed = result.traces.find((row: { status: string; raw_trace: unknown }) => row.status === "active"
          && validateEncounterTrace(row.raw_trace) && currentCase(row.raw_trace) && !isEncounterCompleted(row.raw_trace))?.raw_trace;
      } catch { failed = true; }
      if (cancelled) return;
      if (resumed) {
        setResumeCandidate(resumed);
        setReady(true);
        setSaveState("Unfinished case");
        return;
      }
      const next = startEncounter(crypto.randomUUID());
      install(next);
      setDecision(decisionFromTrace(next));
      setReady(true);
      if (failed) {
        setSaveState("Not saved to server");
        setError("Could not load a saved encounter. This new encounter remains on this page until a save succeeds.");
      } else saveActive(next);
    }
    void load();
    return () => { cancelled = true; };
    // One load per mounted encounter; all writes are initiated by explicit actions.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function continuePreviousAttempt() {
    if (!resumeCandidate) return;
    install(resumeCandidate);
    setDecision(decisionFromTrace(resumeCandidate));
    setResumeCandidate(null);
    setSaveState("Resumed from server");
  }
  async function restartAttempt() {
    if (restarting) return;
    setRestarting(true);
    setError(null);
    try {
      await queue.current;
      const response = await fetch(endpoint, {
        method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ operation: "restart", caseId: CASE_001_ENCOUNTER.caseId, caseVersion: CASE_001_ENCOUNTER.version }),
      });
      const result = await response.json();
      if (!response.ok || !result.ok || !validateEncounterTrace(result.trace) || !currentCase(result.trace)) throw new Error("RESTART_FAILED");
      install(result.trace);
      setDecision({ ...emptyDecision });
      setInput("");
      setCompleted(false);
      setResumeCandidate(null);
      setConfirmRestart(false);
      setSaveState("Started new attempt");
    } catch {
      setError("Could not start a new attempt. Your current attempt has not been removed.");
    } finally { setRestarting(false); }
  }

  function send() {
    if (!traceRef.current || completionLock.current || isEncounterCompleted(traceRef.current) || !input.trim()) return;
    const next = submit(traceRef.current, input.trim());
    install(next);
    setInput("");
    saveActive(next);
  }
  function saveDecision() {
    if (!traceRef.current || completionLock.current || isEncounterCompleted(traceRef.current)) return;
    const next = recordDecision(traceRef.current, decision);
    install(next);
    saveActive(next);
  }
  async function finish() {
    if (!traceRef.current || completionLock.current || completed) return;
    let next = traceRef.current;
    try { if (!isEncounterCompleted(next)) next = completeEncounter(next, decision); }
    catch { setError("Enter diagnosis, treatment, follow-up, confidence and rationale before completing."); return; }
    completionLock.current = true;
    setCompleting(true);
    install(next);
    try {
      await persist(next, "complete");
      setCompleted(true);
    } catch {
      // An acknowledgement may be lost after commit. Confirm the canonical completed
      // row through an authenticated read; never change an immutable trace to retry.
      try {
        const response = await fetch(`${endpoint}?${new URLSearchParams({ traceId: next.traceId })}`, { credentials: "same-origin", cache: "no-store" });
        const result = await response.json();
        const saved = response.ok && result.ok && Array.isArray(result.traces)
          ? result.traces.find((row: { status: string; raw_trace: unknown }) => row.status === "completed"
            && validateEncounterTrace(row.raw_trace) && row.raw_trace.traceId === next.traceId && currentCase(row.raw_trace)
            && isEncounterCompleted(row.raw_trace) && sameEncounterTrace(row.raw_trace, next)) : undefined;
        if (!saved) throw new Error("COMPLETION_UNCONFIRMED");
        install(saved.raw_trace);
        setDecision(decisionFromTrace(saved.raw_trace));
        setSaveState("Completed and saved");
        setCompleted(true);
      } catch {
        setSaveState("Completion not saved");
        setError("Completion failed. All encounter data is still here. Retry completion.");
      }
    } finally { completionLock.current = false; setCompleting(false); }
  }

  const pendingCompletion = trace ? isEncounterCompleted(trace) : false;
  const review = completed && trace ? compareEncounter(trace, CASE_001_ENCOUNTER.hiddenReference.rubric.map(id => ({
    id, domain: id, importance: "important" as const, acceptableIds: [id],
  }))) : null;
  const korean = typeof document !== "undefined" && document.documentElement.lang.startsWith("ko");
  const copy = korean ? { title: "미완료 케이스", body: "이 케이스의 미완료 시도가 있습니다.", continue: "이전 시도 계속하기", restart: "새 시도 시작", over: "처음부터 다시 시작", confirm: "현재 시도를 중단하고 새로 시작하시겠습니까?", yes: "새 시도 시작", no: "취소" } : { title: "Unfinished case", body: "You have an unfinished attempt for this case.", continue: "Continue previous attempt", restart: "Start new attempt", over: "Start over", confirm: "Abandon this attempt and start a new one?", yes: "Start new attempt", no: "Cancel" };
  if (resumeCandidate) return <main className="mx-auto flex min-h-screen max-w-2xl flex-col gap-4 p-6">
    <p className="text-xs font-semibold uppercase">Synthetic clinical encounter · content validation pending</p>
    <h1 className="text-2xl font-bold">{copy.title}</h1>
    <p>{copy.body}</p>
    {error && <p role="alert">{error}</p>}
    <div className="flex gap-2"><button type="button" className="rounded border p-3" onClick={continuePreviousAttempt} disabled={restarting}>{copy.continue}</button><button type="button" className="rounded bg-black p-3 text-white" onClick={() => void restartAttempt()} disabled={restarting}>{copy.restart}</button></div>
  </main>;
  return <main className="mx-auto flex min-h-screen max-w-2xl flex-col gap-4 p-6">
    <p className="text-xs font-semibold uppercase">Synthetic clinical encounter · content validation pending</p>
    <h1 className="text-2xl font-bold">{CASE_001_ENCOUNTER.caseId}</h1>
    <p role="status">{saveState}</p>
    {error && <p role="alert">{error}</p>}
    {review && <section className="space-y-2 rounded border p-4">
      <h2 className="text-xl font-bold">Your reasoning review</h2>
      <dl>{fields.map(([key, label]) => <div key={key}><dt className="font-semibold">{label}</dt><dd>{decision[key] || "Not recorded"}</dd></div>)}</dl>
      <p>Author Reference · clinical validation pending</p>
      <p>Important domains covered: {review.importantDomainsCovered.join(", ") || "None"}</p>
      <p>Important domains missed: {review.importantDomainsMissed.join(", ") || "None"}</p>
    </section>}
    <section aria-label={completed ? "Encounter timeline" : "Conversation"} className="space-y-3">
      {!trace && <p>{CASE_001_ENCOUNTER.chiefComplaint}</p>}
      {trace?.events.filter(e => completed || e.doctorMessage || e.response).map(e => <div key={e.sequence} className={e.doctorMessage ? "rounded bg-slate-900 p-3 text-white" : "rounded bg-slate-100 p-3"}>
        {completed && <span className="block text-xs">{e.sequence} · {e.type.replaceAll("_", " ")} · {Math.round(e.elapsedMs / 1000)}s</span>}
        {e.doctorMessage ?? e.response}
      </div>)}
    </section>
    {!completed && <>
      <div>{confirmRestart ? <div className="flex items-center gap-2"><span>{copy.confirm}</span><button type="button" className="rounded bg-black p-2 text-white" onClick={() => void restartAttempt()} disabled={restarting}>{copy.yes}</button><button type="button" className="rounded border p-2" onClick={() => setConfirmRestart(false)} disabled={restarting}>{copy.no}</button></div> : <button type="button" className="self-start text-sm underline" onClick={() => setConfirmRestart(true)} disabled={!ready || restarting}>{copy.over}</button>}</div>
      <form className="mt-auto flex gap-2" onSubmit={e => { e.preventDefault(); send(); }}>
        <input aria-label="Clinical encounter message" className="flex-1 rounded border p-3" value={input} onChange={e => setInput(e.target.value)} disabled={!ready || pendingCompletion} placeholder="Ask the patient or request an examination…" />
        <button className="rounded bg-black px-4 text-white" disabled={!ready || pendingCompletion || !input.trim()}>Send</button>
      </form>
      <details><summary>Make decision / Finish case</summary>
        <fieldset disabled={!ready || pendingCompletion} className="space-y-3 py-3">
          {fields.map(([key, label]) => <label key={key} className="block">{label}<textarea className="block w-full rounded border p-2" value={decision[key]} onChange={e => setDecision(d => ({ ...d, [key]: e.target.value }))} /></label>)}
          <button type="button" className="rounded border p-2" onClick={saveDecision}>Record decision</button>
        </fieldset>
        <button type="button" className="rounded bg-black p-3 text-white" disabled={!ready || completing} onClick={() => void finish()}>
          {pendingCompletion && !completing ? "Retry completion" : "Complete case"}
        </button>
      </details>
      {error && !pendingCompletion && <button type="button" onClick={() => traceRef.current && saveActive(traceRef.current)}>Retry save</button>}
    </>}
  </main>;
}
