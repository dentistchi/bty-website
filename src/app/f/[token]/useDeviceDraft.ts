"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { DEVICE_DRAFT_KEY_PREFIX } from "@/lib/bty/foundry/device-draft-store";

/**
 * DEVICE-LOCAL DRAFT CONTAINMENT — Slice R4-R5C4A.
 *
 * R4-R5C4 measured the defect: a learner writes a completion check, a shared understanding and a
 * decision, refreshes, and every word is gone. Eight ordinary exits lose it; none warns them. The
 * product durably records THAT they opened the PDF and how long they read it, and records nothing
 * of what they thought.
 *
 * This is the whole repair, and it is deliberately small. No table, no column, no endpoint, no
 * migration. The draft never leaves the device, which is why the copy may only ever say "on this
 * device" — and why nothing here can make an unfinished training look completed: it cannot write
 * to a server at all.
 *
 * WHY DEVICE-LOCAL IS NOT A LESSER SERVER DRAFT. Drafts are participant-scoped (R4-R5C4 §12,
 * following C3's no-canonical-participant policy), and a participant IS a device cookie. A
 * server-stored draft keyed by participant would therefore be reachable from exactly one device
 * too — the same recovery surface, bought with a migration, an API, an account-edge guard, a
 * cleanup lifecycle, and server-stored unfinished private text belonging to anonymous learners.
 *
 * HYDRATION ORDER IS THE CORRECTNESS PROPERTY. A late restore effect that lands ON TOP of
 * someone's typing would be a worse bug than the one being fixed. So the caller keeps its
 * controls disabled until `hydrated` is true; restoration happens exactly once, before the
 * learner can reach the field.
 */

export const DRAFT_VERSION = 1;
/** Matches the participant cookie's 30-day life: a draft cannot outlive the participant it belongs to. */
export const DRAFT_TTL_MS = 30 * 24 * 60 * 60 * 1000;
/** Long enough to coalesce a sentence, short enough that an abrupt kill loses very little. */
export const DRAFT_DEBOUNCE_MS = 1000;

export type DraftFields = {
  response: string;
  sharedResponse: string;
  decisionResponse: string;
  reflectResponse: string;
};

type StoredDraft = DraftFields & { version: number; savedAt: number };

const EMPTY: DraftFields = { response: "", sharedResponse: "", decisionResponse: "", reflectResponse: "" };

/*
  The prefix is OWNED by `device-draft-store`, not restated here. The sign-out purge sweeps that
  prefix, and a second copy of the string is how a rename quietly leaves private text behind.
*/
export function draftKey(ns: string): string {
  return `${DEVICE_DRAFT_KEY_PREFIX}${ns}`;
}

/**
 * Every storage call goes through these. Private-mode Safari throws on `setItem`, a locked-down
 * WebView can throw on mere ACCESS to `window.localStorage`, and a full quota throws mid-session.
 * A learner whose browser refuses storage must still be able to finish their training — so a
 * failure here is swallowed and reported as "not saved", never raised.
 */
function store(): Storage | null {
  try {
    if (typeof window === "undefined") return null;
    return window.localStorage;
  } catch {
    return null;
  }
}

export function readDraft(ns: string, now = Date.now()): DraftFields | null {
  const s = store();
  if (!s) return null;
  const key = draftKey(ns);
  try {
    const raw = s.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<StoredDraft> | null;
    // An unrecognised VERSION and a malformed body are the same event to a learner: we do not
    // know what this is, so we must not present it as their words.
    if (!parsed || parsed.version !== DRAFT_VERSION || typeof parsed.savedAt !== "number") {
      s.removeItem(key);
      return null;
    }
    if (now - parsed.savedAt > DRAFT_TTL_MS) {
      s.removeItem(key);
      return null;
    }
    const out: DraftFields = {
      response: typeof parsed.response === "string" ? parsed.response : "",
      sharedResponse: typeof parsed.sharedResponse === "string" ? parsed.sharedResponse : "",
      decisionResponse: typeof parsed.decisionResponse === "string" ? parsed.decisionResponse : "",
      reflectResponse: typeof parsed.reflectResponse === "string" ? parsed.reflectResponse : "",
    };
    return isEmpty(out) ? null : out;
  } catch {
    // Corrupt entry: remove it if we can, and behave as though there were no draft.
    try {
      s.removeItem(key);
    } catch {
      /* storage is refusing everything; nothing else to do */
    }
    return null;
  }
}

export function isEmpty(d: DraftFields): boolean {
  return !d.response && !d.sharedResponse && !d.decisionResponse && !d.reflectResponse;
}

/** Returns true when the draft was actually persisted — the ONLY thing that may show a saved signal. */
export function writeDraft(ns: string, fields: DraftFields, now = Date.now()): boolean {
  const s = store();
  if (!s) return false;
  try {
    // DELETION IS A REAL EDIT. A learner who clears a field is telling us to forget it, so an
    // all-empty draft is REMOVED rather than stored as an empty husk that would later "restore"
    // nothing over something.
    if (isEmpty(fields)) {
      s.removeItem(draftKey(ns));
      return false;
    }
    const payload: StoredDraft = { version: DRAFT_VERSION, savedAt: now, ...fields };
    s.setItem(draftKey(ns), JSON.stringify(payload));
    return true;
  } catch {
    return false;
  }
}

export function clearDraft(ns: string): void {
  const s = store();
  if (!s) return;
  try {
    s.removeItem(draftKey(ns));
  } catch {
    /* nothing to do — a draft we cannot delete is one we also could not have written */
  }
}

export type DeviceDraft = {
  /** True once restoration has run. Controls must stay disabled until then. */
  hydrated: boolean;
  /** The restored values, or null. Read ONCE by the caller when `hydrated` flips. */
  restored: DraftFields | null;
  /** Debounced persist. Newest call wins; nothing is written when nothing changed. */
  save: (fields: DraftFields) => void;
  /** Write any pending state immediately — for deliberate navigation. Synchronous. */
  flush: (fields: DraftFields) => void;
  /** Remove the draft. Only ever called on server-confirmed completion. */
  clear: () => void;
  /** True only after a real successful write. Never true when storage is unavailable. */
  saved: boolean;
};

/**
 * @param ns the opaque per-participant namespace from the room snapshot; null until it arrives.
 */
export function useDeviceDraft(ns: string | null): DeviceDraft {
  const [hydrated, setHydrated] = useState(false);
  const [saved, setSaved] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  /*
    NEWEST WINS. The pending fields live in a ref, so a burst of keystrokes collapses into one
    write of the LATEST value — an earlier snapshot can never land after a later one, because
    there is only ever one pending value and one timer.
  */
  const pending = useRef<DraftFields | null>(null);

  const restored = useMemo(() => (ns ? readDraft(ns) : null), [ns]);

  useEffect(() => {
    if (ns) setHydrated(true);
  }, [ns]);

  const commit = useCallback(
    (fields: DraftFields) => {
      if (!ns) return;
      const ok = writeDraft(ns, fields);
      // An emptied draft is a successful REMOVAL, not a save — so the signal goes away with the text.
      setSaved(ok);
    },
    [ns],
  );

  const save = useCallback(
    (fields: DraftFields) => {
      if (!ns) return;
      pending.current = fields;
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => {
        timer.current = null;
        const next = pending.current;
        pending.current = null;
        if (next) commit(next);
      }, DRAFT_DEBOUNCE_MS);
    },
    [ns, commit],
  );

  const flush = useCallback(
    (fields: DraftFields) => {
      if (!ns) return;
      if (timer.current) {
        clearTimeout(timer.current);
        timer.current = null;
      }
      pending.current = null;
      commit(fields);
    },
    [ns, commit],
  );

  const clear = useCallback(() => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
    // Drop anything still queued, so a late timer cannot resurrect a completed training's draft.
    pending.current = null;
    if (ns) clearDraft(ns);
    setSaved(false);
  }, [ns]);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  return { hydrated, restored, save, flush, clear, saved };
}

export const DRAFT_EMPTY = EMPTY;

/**
 * THE ONE ENTRY POINT the three room families use. Video, Document and Guidance/Discussion hold
 * the same four learner text states, so they get the same storage contract from the same code —
 * a parity test asserts none of them grows its own.
 *
 * @param ns       opaque namespace from the room snapshot; null until the snapshot arrives
 * @param fields   the caller's CURRENT four values (the caller keeps owning its own state)
 * @param onRestore called AT MOST ONCE, before `ready` turns true
 * @param completed the server's own completion truth. The draft is cleared only when this says so.
 */
export function useRoomDraft(
  ns: string | null,
  fields: DraftFields,
  onRestore: (d: DraftFields) => void,
  completed: boolean,
): { ready: boolean; saved: boolean; flush: () => void } {
  const draft = useDeviceDraft(ns);
  /*
    DESTRUCTURED ON PURPOSE. `useDeviceDraft` returns a fresh object literal every render, so an
    effect that depended on `draft` re-ran on every render — including the ones caused by its own
    `saved` state — and re-scheduled a write of unchanged text. These three are `useCallback`s
    with stable identities, so the effects below fire on real changes only. A test asserts that
    settling twice with no edit performs no second write.
  */
  const { save: saveDraft, flush: flushDraft, clear: clearStoredDraft, restored } = draft;
  const [ready, setReady] = useState(false);
  const restoreRef = useRef(onRestore);
  restoreRef.current = onRestore;
  const fieldsRef = useRef(fields);
  fieldsRef.current = fields;

  /*
    RESTORE EXACTLY ONCE, AND BEFORE THE FIELDS ARE EDITABLE.

    `onRestore` and `setReady` land in ONE React commit, so the first render in which the caller
    reports `ready` is also the first render carrying the restored text. The caller keeps its
    controls disabled until then, which is what makes it impossible for this to overwrite
    something the learner typed — the failure mode that would be worse than the bug being fixed.
  */
  useEffect(() => {
    if (ready || !ns) return;
    if (restored) restoreRef.current(restored);
    setReady(true);
  }, [ns, ready, restored]);

  // Debounced persistence. Runs only after restoration, so the empty pre-hydration state can
  // never be written over a real stored draft.
  useEffect(() => {
    if (!ready || completed) return;
    saveDraft(fields);
  }, [ready, completed, fields, saveDraft]);

  /*
    CLEANUP ON SERVER-CONFIRMED COMPLETION ONLY.

    `completed` comes from `isCompletedStage(snapshot)` — the server's own stage, not the fact
    that a button was pressed. So a failed or unresolved completion leaves the draft exactly
    where it is, and the learner's retry still finds their words. This is the difference between
    "we submitted" and "it is finished", and only the second one may delete anything.
  */
  useEffect(() => {
    if (completed) clearStoredDraft();
  }, [completed, clearStoredDraft]);

  const flush = useCallback(() => {
    if (!ready || completed) return;
    flushDraft(fieldsRef.current);
  }, [ready, completed, flushDraft]);

  /*
    THE EXIT FLUSH — one listener instead of a callback threaded through every navigation control.

    The debounce leaves a window of at most `DRAFT_DEBOUNCE_MS` in which typing is not yet on
    disk. `visibilitychange -> hidden` closes it for every way a learner actually leaves: tapping
    Back to Learn (a full-page navigation), closing the tab, and sending the WebView to the
    background. The write is synchronous localStorage, so nothing about leaving is delayed.

    Deliberately NOT `beforeunload` (unreliable in WKWebView, and it invites the "are you sure"
    dialog this product should never show) and NOT `sendBeacon` (there is no server to beacon to).
    A step transition needs no flush at all — the component stays mounted and the timer keeps
    running. Sudden process termination inside the debounce window remains a bounded, accepted
    loss, which is exactly why the copy never promises zero loss.
  */
  useEffect(() => {
    if (typeof document === "undefined") return;
    const onHide = () => {
      if (document.visibilityState === "hidden") flush();
    };
    document.addEventListener("visibilitychange", onHide);
    return () => document.removeEventListener("visibilitychange", onHide);
  }, [flush]);

  return { ready, saved: draft.saved && !completed, flush };
}
