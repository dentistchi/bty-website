"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from "react";
import { ConsentDocumentView } from "@/app/[locale]/legal/accept/ConsentDocumentView";
import type { ConsentDocument } from "@/domain/legal/consent-document";
import { getMessages, type Locale } from "@/lib/i18n";
import { localeToBcp47 } from "@/lib/i18n/bcp47";
import { TeamsConsentContext } from "./TeamsConsentContext";

type Agreement = { current: boolean; document: ConsentDocument; documentFingerprint: string };

const endpoint = "/api/legal/accept";
const REQUEST_TIMEOUT_MS = 15_000;
const copy = {
  en: {
    title: "BTY agreement",
    loading: "Loading the agreement…",
    unavailable: "The agreement could not be loaded.",
    retry: "Try again",
    back: "Back to BTY",
    updated: "The agreement changed. Please review it before accepting.",
  },
  ko: {
    title: "BTY 이용 동의",
    loading: "동의서를 불러오는 중입니다…",
    unavailable: "동의서를 불러오지 못했습니다.",
    retry: "다시 시도",
    back: "BTY로 돌아가기",
    updated: "동의서가 변경되었습니다. 새 내용을 확인한 뒤 동의해 주세요.",
  },
} as const;

export default function TeamsConsentBoundary({ locale, children }: { locale: Locale; children: ReactNode }) {
  const [current, setCurrent] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [agreement, setAgreement] = useState<Agreement | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [revision, setRevision] = useState(0);
  const [updated, setUpdated] = useState(false);
  const [checked, setChecked] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const submitLock = useRef(false);
  const dialogRef = useRef<HTMLElement>(null);
  const triggerRef = useRef<HTMLElement | null>(null);
  const consentLocale = localeToBcp47(locale);
  const strings = copy[locale];
  const legal = getMessages(locale).legal.accept;

  const open = useCallback(() => {
    if (!dialogRef.current && document.activeElement instanceof HTMLElement) triggerRef.current = document.activeElement;
    setDialogOpen(true);
  }, []);
  const context = useMemo(() => ({ current, open }), [current, open]);

  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    setLoadFailed(false);
    setChecked(false);
    setError(null);
    void (async () => {
      try {
        // The Teams transport attaches the active account's bearer.
        // An unrelated browser session cookie must not take precedence.
        const response = await fetch(`${endpoint}?locale=${encodeURIComponent(consentLocale)}`, {
          credentials: "omit", cache: "no-store", signal: controller.signal,
        });
        if (!response.ok) throw Error("Agreement unavailable");
        const data = (await response.json()) as Partial<Agreement> | null;
        if (typeof data?.current !== "boolean" || data.document?.locale !== consentLocale
          || typeof data.document.version !== "string" || typeof data.document.title !== "string"
          || !Array.isArray(data.document.sections) || typeof data.documentFingerprint !== "string" || !data.documentFingerprint) {
          throw Error("Agreement unavailable");
        }
        if (!active) return;
        setAgreement({ current: data.current, document: data.document, documentFingerprint: data.documentFingerprint });
        setCurrent(data.current);
        if (data.current) setDialogOpen(false);
      } catch {
        if (active) setLoadFailed(true);
      } finally {
        window.clearTimeout(timeout);
      }
    })();
    return () => {
      active = false;
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, [consentLocale, revision]);

  useEffect(() => {
    if (dialogOpen) dialogRef.current?.focus();
  }, [dialogOpen]);

  const shown = agreement?.document.locale === consentLocale ? agreement : null;

  function reloadAgreement() {
    setAgreement(null);
    setRevision((value) => value + 1);
    dialogRef.current?.scrollTo?.(0, 0);
  }

  function dismiss() {
    if (submitLock.current) return;
    setDialogOpen(false);
    setChecked(false);
    setError(null);
    const trigger = triggerRef.current;
    window.requestAnimationFrame(() => {
      if (trigger?.isConnected && !trigger.closest("[inert]")) trigger.focus();
    });
  }

  async function accept(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!shown || !checked || submitLock.current) return;
    submitLock.current = true;
    setSubmitting(true);
    setError(null);
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
      const response = await fetch(endpoint, {
        method: "POST", credentials: "omit", cache: "no-store", signal: controller.signal,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          consent_version: shown.document.version,
          consent_locale: shown.document.locale,
          document_fingerprint: shown.documentFingerprint,
        }),
      });
      if (response.status === 409) {
        setUpdated(true);
        setChecked(false);
        reloadAgreement();
        return;
      }
      if (!response.ok) {
        setError(response.status === 429 ? legal.error_rate_limit : legal.error_server);
        return;
      }
      const saved = (await response.json().catch(() => null)) as { ok?: unknown; consent_version?: unknown } | null;
      if (saved?.ok !== true || saved.consent_version !== shown.document.version) {
        setError(legal.error_server);
        return;
      }
      setCurrent(true);
      setDialogOpen(false);
    } catch {
      setError(legal.error_network);
    } finally {
      window.clearTimeout(timeout);
      submitLock.current = false;
      setSubmitting(false);
    }
  }

  return (
    <TeamsConsentContext.Provider value={context}>
      <div inert={dialogOpen || undefined} aria-hidden={dialogOpen || undefined}>{children}</div>
      {dialogOpen && (
        <section ref={dialogRef} role="dialog" aria-modal="true" aria-label={strings.title} tabIndex={-1}
          onKeyDown={(event) => { if (event.key === "Escape") dismiss(); }}
          className="fixed inset-0 z-50 overflow-y-auto overscroll-contain bg-[#0B1F3A] p-4 outline-none sm:p-6">
          <div className="mx-auto max-w-2xl space-y-5 rounded-xl bg-white p-5 text-[#1E2A38] sm:p-8">
            <button type="button" onClick={dismiss} disabled={submitting} className="text-sm font-medium underline disabled:opacity-50">
              {strings.back}
            </button>
            {updated && <p role="status" className="rounded-md bg-amber-50 p-3 text-sm">{strings.updated}</p>}
            {loadFailed ? (
              <div className="space-y-3">
                <p role="alert" className="text-sm">{strings.unavailable}</p>
                <button type="button" onClick={reloadAgreement} className="rounded-lg border px-4 py-2 text-sm font-semibold">{strings.retry}</button>
              </div>
            ) : shown ? (
              <>
                <ConsentDocumentView doc={shown.document} />
                <form onSubmit={(event) => void accept(event)} className="space-y-4 border-t pt-4">
                  <label className="flex cursor-pointer items-start gap-3 text-sm">
                    <input type="checkbox" checked={checked} onChange={(event) => setChecked(event.target.checked)}
                      disabled={submitting} className="mt-1 h-4 w-4 shrink-0" />
                    <span>{legal.checkbox_label}</span>
                  </label>
                  {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
                  <button type="submit" disabled={!checked || submitting}
                    className="w-full rounded-lg bg-[#0B1F3A] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50">
                    {submitting ? legal.submitting : legal.submit_button}
                  </button>
                </form>
              </>
            ) : <p role="status" className="text-sm">{strings.loading}</p>}
          </div>
        </section>
      )}
    </TeamsConsentContext.Provider>
  );
}
