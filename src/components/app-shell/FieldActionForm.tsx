"use client";

import { useCallback, useEffect, useRef, useState, type RefObject } from "react";
import { blurActiveThen } from "@/components/app-shell/viewportFocus";

type Layer1Signal = { rule?: string; signal?: string };

/**
 * Field Action producer surface (Slice 3.1B-3N-5C.3) — Today/Reality-owned, in-shell.
 *
 * The learner AUTHORS a real-world Field Action (Who/What/How/When) after completing a Foundry
 * module, or edits + resubmits a rejected one. Module title shows as read-only context; a Host
 * revision note (if any) shows above the form. On submit it reuses the canonical
 * `submit-validation` state machine → the contract lands `submitted` (Verification Pending) and
 * enters the authorized Host Action Review. No legacy `/bty-arena` navigation, no arena-run
 * assumptions. `eventId` opens/creates the draft; `contractId` prefills an existing one.
 */

type FieldActionContract = {
  contractId: string;
  status: string;
  who: string | null;
  what: string | null;
  how: string | null;
  stepWhen: string | null;
  revisionNote: string | null;
  moduleTitle: string;
};

const COPY = {
  en: {
    back: "Back",
    loading: "Loading…",
    notFound: "This isn't available.",
    loadError: "Couldn't load this action. Try again.",
    retry: "Try again",
    heading: "Apply this in real life",
    context: "From your learning:",
    who: "Who",
    what: "What",
    how: "How",
    when: "When",
    whoPh: "Who is this action with?",
    whatPh: "What exactly will you do?",
    howPh: "How will you do it?",
    whenPh: "When will you do it?",
    revisionRequested: "Revision requested",
    submit: "Submit",
    working: "Working…",
    validation: "Please complete Who, What, How, and When.",
    reviseHeading: "Please make this action more specific.",
    error: "Something went wrong. Please try again.",
  },
  ko: {
    back: "뒤로",
    loading: "불러오는 중…",
    notFound: "이용할 수 없습니다.",
    loadError: "이 행동을 불러오지 못했습니다. 다시 시도해 주세요.",
    retry: "다시 시도",
    heading: "현실에서 적용하기",
    context: "학습에서:",
    who: "누가",
    what: "무엇을",
    how: "어떻게",
    when: "언제",
    whoPh: "누구와 함께하는 행동인가요?",
    whatPh: "정확히 무엇을 할 건가요?",
    howPh: "어떻게 할 건가요?",
    whenPh: "언제 할 건가요?",
    revisionRequested: "수정 요청",
    submit: "제출",
    working: "처리 중…",
    validation: "누가 / 무엇을 / 어떻게 / 언제를 모두 입력해 주세요.",
    reviseHeading: "행동을 조금 더 구체적으로 작성해 주세요.",
    error: "문제가 발생했습니다. 다시 시도해 주세요.",
  },
} as const;

export default function FieldActionForm({
  locale,
  assignmentId,
  contractId: contractIdProp,
  onBack,
}: {
  locale: string;
  assignmentId?: string | null;
  contractId?: string | null;
  onBack: () => void;
}) {
  const loc: "en" | "ko" = locale === "ko" ? "ko" : "en";
  const t = COPY[loc];

  const [loaded, setLoaded] = useState(false);
  const [contract, setContract] = useState<FieldActionContract | null>(null);
  /** 'notfound' = safe unavailable (404); 'loaderror' = transient/retryable (500/network). */
  const [initError, setInitError] = useState<"notfound" | "loaderror" | null>(null);
  const [who, setWho] = useState("");
  const [what, setWhat] = useState("");
  const [how, setHow] = useState("");
  const [when, setWhen] = useState("");
  const [pending, setPending] = useState(false);
  const [invalid, setInvalid] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /** Server Layer-1 "revise" signals — the form stays OPEN and the learner corrects + resubmits. */
  const [reviseSignals, setReviseSignals] = useState<Layer1Signal[] | null>(null);

  const whoRef = useRef<HTMLTextAreaElement>(null);
  const whatRef = useRef<HTMLTextAreaElement>(null);
  const howRef = useRef<HTMLTextAreaElement>(null);
  const whenRef = useRef<HTMLTextAreaElement>(null);
  const clearRevise = useCallback(() => setReviseSignals(null), []);

  const prime = useCallback((c: FieldActionContract) => {
    setContract(c);
    setWho(c.who ?? "");
    setWhat(c.what ?? "");
    setHow(c.how ?? "");
    setWhen(c.stepWhen ?? "");
  }, []);

  // Initialize: create/resume by assignmentId (idempotent — a retry never duplicates) or load by
  // contractId. 404 → unavailable (never leak); non-404 non-ok / network → retryable load error.
  const initLoad = useCallback(async () => {
    setLoaded(false);
    setInitError(null);
    try {
      let res: Response | null = null;
      if (assignmentId) {
        res = await fetch("/api/bty/action-contract/field-action", {
          method: "POST",
          credentials: "include",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ assignmentId }),
        });
      } else if (contractIdProp) {
        res = await fetch(
          `/api/bty/action-contract/field-action?contractId=${encodeURIComponent(contractIdProp)}`,
          { credentials: "include", cache: "no-store" },
        );
      }
      if (res && res.ok) {
        const d = (await res.json()) as { contract?: FieldActionContract | null };
        if (d?.contract) prime(d.contract);
        else setInitError("loaderror");
      } else if (res && res.status === 404) {
        setInitError("notfound");
      } else {
        setInitError("loaderror");
      }
    } catch {
      setInitError("loaderror");
    }
    setLoaded(true);
  }, [assignmentId, contractIdProp, prime]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      if (!cancelled) await initLoad();
    })();
    return () => {
      cancelled = true;
    };
  }, [initLoad]);

  async function onSubmit() {
    if (pending || !contract) return;
    const w = who.trim();
    const x = what.trim();
    const h = how.trim();
    const wh = when.trim();
    if (!w || !x || !h || !wh) {
      setInvalid(true);
      return;
    }
    setInvalid(false);
    setPending(true);
    setError(null);
    setReviseSignals(null);
    try {
      const res = await fetch("/api/bty/action-contract/submit-validation", {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ contractId: contract.contractId, who: w, what: x, how: h, when: wh, raw_text: x }),
      });
      if (res.ok) {
        // res.ok alone is NOT success — submit-validation returns 200 for a Layer-1 "revise".
        const d = (await res.json().catch(() => ({}))) as {
          outcome?: string;
          layer1_errors?: Layer1Signal[];
          contract_state?: string;
        };
        const errs = Array.isArray(d.layer1_errors) ? d.layer1_errors : [];
        if (d.outcome === "revise" || errs.length > 0) {
          // Stay OPEN: keep values, show the server signals, focus the first related field. Defer
          // the focus to AFTER the re-render (the field is disabled while pending; a disabled
          // control cannot take focus) — this is also the "keep focus on the invalid field" path
          // (no blur/close), distinct from a canonical success.
          setReviseSignals(errs.length > 0 ? errs : [{ rule: "R1", signal: "" }]);
          setPending(false);
          const firstRule = errs[0]?.rule;
          const raf = typeof requestAnimationFrame === "function" ? requestAnimationFrame : (f: FrameRequestCallback) => setTimeout(() => f(0), 0);
          raf(() => focusForRule(firstRule));
          return;
        }
        if (d.contract_state === "awaiting_qr" || d.contract_state === "terminal") {
          // Canonical submitted (verified_at null) → Today Verification Pending. Release focus
          // (dismiss keyboard, reset iOS zoom) BEFORE returning. Not called on 'revise'.
          blurActiveThen(onBack);
          return;
        }
        // Ambiguous 200 without a canonical landing → treat as retryable, do not close.
        setError(t.error);
        setPending(false);
        return;
      }
      setError(t.error);
      setPending(false);
    } catch {
      setError(t.error);
      setPending(false);
    }
  }

  function focusForRule(rule?: string) {
    const ref = rule === "R2" ? whatRef : rule === "R4" ? howRef : rule === "R1" || !rule ? whoRef : whenRef;
    try { ref.current?.focus(); } catch { /* focus best-effort */ }
  }

  return (
    <section data-testid="field-action-form" className="flex flex-col gap-4 rounded-2xl border border-white/8 bg-white/[0.02] px-4 py-4">
      <button type="button" data-testid="field-action-back" onClick={onBack} className="self-start text-xs text-white/55 hover:text-white/85">
        ← {t.back}
      </button>

      {!loaded ? (
        <div data-testid="field-action-loading" className="h-16 animate-pulse rounded-lg bg-white/[0.03]" />
      ) : initError === "loaderror" ? (
        <div data-testid="field-action-loaderror" className="flex flex-col items-start gap-2">
          <p className="text-sm text-white/60">{t.loadError}</p>
          <button
            type="button"
            data-testid="field-action-retry"
            onClick={() => { void initLoad(); }}
            className="touch-manipulation rounded-lg border border-white/15 bg-white/[0.03] px-3 py-1.5 text-xs font-medium text-white/80 hover:bg-white/[0.06]"
          >
            {t.retry}
          </button>
        </div>
      ) : !contract ? (
        <p data-testid="field-action-notfound" className="text-sm text-white/60">{t.notFound}</p>
      ) : (
        <div className="flex flex-col gap-3">
          <h2 className="text-base font-semibold text-white/90">{t.heading}</h2>
          {contract.moduleTitle ? (
            <p className="text-xs text-white/45">
              <span className="text-white/35">{t.context} </span>
              {contract.moduleTitle}
            </p>
          ) : null}

          {contract.revisionNote && contract.revisionNote.trim() ? (
            <div data-testid="field-action-revision-note" className="flex flex-col gap-0.5 rounded-lg border border-[#C9A66B]/25 bg-[#C9A66B]/[0.06] px-3 py-2">
              <span className="text-[0.6rem] font-semibold uppercase tracking-[0.12em] text-[#E5B769]/80">{t.revisionRequested}</span>
              <span className="whitespace-pre-wrap text-xs leading-5 text-white/75">{contract.revisionNote.trim()}</span>
            </div>
          ) : null}

          {reviseSignals && reviseSignals.length > 0 ? (
            <div data-testid="field-action-revise" className="flex flex-col gap-1 rounded-lg border border-amber-400/25 bg-amber-400/[0.06] px-3 py-2">
              <span className="text-[0.66rem] font-semibold uppercase tracking-[0.12em] text-amber-200/85">{t.reviseHeading}</span>
              {reviseSignals
                .filter((s) => typeof s.signal === "string" && s.signal.trim() !== "")
                .map((s, i) => (
                  <span key={`${s.rule ?? "r"}-${i}`} data-testid="field-action-revise-signal" className="text-xs leading-5 text-white/80">
                    {s.signal}
                  </span>
                ))}
            </div>
          ) : null}

          <Field label={t.who} value={who} onChange={(v) => { setWho(v); clearRevise(); }} placeholder={t.whoPh} testid="field-action-who" disabled={pending} inputRef={whoRef} />
          <Field label={t.what} value={what} onChange={(v) => { setWhat(v); clearRevise(); }} placeholder={t.whatPh} testid="field-action-what" disabled={pending} inputRef={whatRef} />
          <Field label={t.how} value={how} onChange={(v) => { setHow(v); clearRevise(); }} placeholder={t.howPh} testid="field-action-how" disabled={pending} inputRef={howRef} />
          <Field label={t.when} value={when} onChange={(v) => { setWhen(v); clearRevise(); }} placeholder={t.whenPh} testid="field-action-when" disabled={pending} inputRef={whenRef} />

          {invalid ? (
            <span data-testid="field-action-validation" className="text-xs text-amber-300/80">{t.validation}</span>
          ) : null}
          {error ? (
            <span data-testid="field-action-error" className="text-xs text-rose-300/80">{error}</span>
          ) : null}

          <button
            type="button"
            data-testid="field-action-submit"
            disabled={pending}
            onClick={onSubmit}
            className="mt-1 touch-manipulation rounded-lg bg-white/90 px-3 py-2 text-sm font-medium text-neutral-900 hover:bg-white disabled:opacity-50"
          >
            {pending ? t.working : t.submit}
          </button>
        </div>
      )}
    </section>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  testid,
  disabled,
  inputRef,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  testid: string;
  disabled: boolean;
  inputRef?: RefObject<HTMLTextAreaElement | null>;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[0.66rem] font-semibold uppercase tracking-[0.14em] text-white/40">{label}</span>
      <textarea
        ref={inputRef}
        data-testid={testid}
        value={value}
        placeholder={placeholder}
        disabled={disabled}
        rows={2}
        onChange={(e) => onChange(e.target.value)}
        // text-base (16px) prevents iOS form-control auto-zoom on focus (Slice 3.1B-3N-5C.4).
        className="w-full resize-none rounded-md border border-white/12 bg-black/20 px-2.5 py-2 text-base text-white/85 outline-none focus:border-white/25 disabled:opacity-50"
      />
    </label>
  );
}
