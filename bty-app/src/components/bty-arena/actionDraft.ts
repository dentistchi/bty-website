// A1b: action-draft persistence + dirty predicate.
// syncSessionGate uses hasNonEmptyActionDraft to skip full resync while the form
// is dirty (mobile visibilitychange unmount fix). Accepted tradeoff: a cross-tab QR
// completion (storage event) is skipped while another tab is mid-input; resyncs on
// next gate event after submit/clear.
//
// STAB-A1-DRAFT: who/what/result live in component state only, and the form is
// unmounted on every focus/visibility resync (useArenaSession `syncSessionGate`)
// while the contract gate is active — so a tab switch silently wiped in-progress
// text. We mirror the three fields to one sessionStorage key per contract so the
// remount restores them. SSR/Worker-safe via `typeof window` guards; the parse is
// guarded so a malformed value falls back to the no-draft path (never throws in render).

const DRAFT_KEY_PREFIX = "bty-arena-action-draft:";

export type ActionDraft = { who: string; what: string; result: string };

export function readActionDraft(contractId: string): ActionDraft | null {
  if (typeof window === "undefined") return null;
  const raw = window.sessionStorage.getItem(`${DRAFT_KEY_PREFIX}${contractId}`);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<ActionDraft>;
    return {
      who: typeof parsed.who === "string" ? parsed.who : "",
      what: typeof parsed.what === "string" ? parsed.what : "",
      result: typeof parsed.result === "string" ? parsed.result : "",
    };
  } catch {
    return null;
  }
}

export function writeActionDraft(contractId: string, draft: ActionDraft): void {
  if (typeof window === "undefined") return;
  window.sessionStorage.setItem(`${DRAFT_KEY_PREFIX}${contractId}`, JSON.stringify(draft));
}

export function clearActionDraft(contractId: string): void {
  if (typeof window === "undefined") return;
  window.sessionStorage.removeItem(`${DRAFT_KEY_PREFIX}${contractId}`);
}

export function hasNonEmptyActionDraft(contractId: string): boolean {
  const d = readActionDraft(contractId);
  if (!d) return false;
  return (
    d.who.trim().length > 0 ||
    d.what.trim().length > 0 ||
    d.result.trim().length > 0
  );
}
