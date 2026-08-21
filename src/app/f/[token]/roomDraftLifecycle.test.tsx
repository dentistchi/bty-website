/** @vitest-environment jsdom */
import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { render, screen, act, cleanup, fireEvent } from "@testing-library/react";
import { useState, useCallback, useMemo } from "react";
import { useRoomDraft, readDraft, writeDraft, draftKey, DRAFT_DEBOUNCE_MS, type DraftFields } from "./useDeviceDraft";
import { participantDraftNamespace } from "@/lib/bty/foundry/events/participant-draft-namespace";

/**
 * R4-R5C4A — the lifecycle the learner actually experiences, exercised through the REAL hook.
 *
 * The room clients differ in layout and in nothing else that matters here: all three hold the
 * same four answers and call `useRoomDraft` with the same arguments. This harness is that call,
 * so what passes here is what the three families do.
 */

const EV = "11111111-1111-4111-8111-111111111111";
const P_A = "aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa";
const P_B = "bbbbbbbb-2222-4222-8222-bbbbbbbbbbbb";
const NS_A = participantDraftNamespace(EV, P_A);
const NS_B = participantDraftNamespace(EV, P_B);

/** A faithful stand-in for a room: four answers, one hook call, controls gated on `ready`. */
function Room({ ns, completed = false }: { ns: string | null; completed?: boolean }) {
  const [response, setResponse] = useState("");
  const [sharedResponse, setSharedResponse] = useState("");
  const [decisionResponse, setDecisionResponse] = useState("");
  const [reflectResponse, setReflectResponse] = useState("");
  const fields: DraftFields = useMemo(
    () => ({ response, sharedResponse, decisionResponse, reflectResponse }),
    [response, sharedResponse, decisionResponse, reflectResponse],
  );
  const restore = useCallback((d: DraftFields) => {
    setResponse(d.response);
    setSharedResponse(d.sharedResponse);
    setDecisionResponse(d.decisionResponse);
    setReflectResponse(d.reflectResponse);
  }, []);
  const { ready, saved } = useRoomDraft(ns, fields, restore, completed);
  return (
    <div>
      <textarea aria-label="response" value={response} disabled={!ready} onChange={(e) => setResponse(e.target.value)} />
      <textarea aria-label="shared" value={sharedResponse} disabled={!ready} onChange={(e) => setSharedResponse(e.target.value)} />
      <span data-testid="ready">{String(ready)}</span>
      <span data-testid="saved">{String(saved)}</span>
    </div>
  );
}

const ta = (label: string) => screen.getByLabelText(label) as HTMLTextAreaElement;

beforeEach(() => {
  window.localStorage.clear();
  vi.useFakeTimers();
});
afterEach(() => {
  vi.runOnlyPendingTimers();
  vi.useRealTimers();
  cleanup();
  vi.restoreAllMocks();
});

const settle = () => act(() => { vi.advanceTimersByTime(DRAFT_DEBOUNCE_MS + 50); });

describe("T1/T2 — restore on remount (refresh, tab close, app restart are all this)", () => {
  it("restores every field into a fresh component instance", () => {
    writeDraft(NS_A, { response: "half a sentence", sharedResponse: "and a second", decisionResponse: "", reflectResponse: "" });
    render(<Room ns={NS_A} />);
    expect(ta("response").value).toBe("half a sentence");
    expect(ta("shared").value).toBe("and a second");
  });

  it("a room with no stored draft starts empty and does not error", () => {
    render(<Room ns={NS_A} />);
    expect(ta("response").value).toBe("");
    expect(screen.getByTestId("ready").textContent).toBe("true");
  });
});

describe("§5 — restoration can never land on top of live typing", () => {
  it("controls are DISABLED until the namespace arrives, and enabled only with the draft applied", () => {
    writeDraft(NS_A, { response: "restored", sharedResponse: "", decisionResponse: "", reflectResponse: "" });
    // ns === null models the window before the room snapshot resolves.
    const { rerender } = render(<Room ns={null} />);
    expect(screen.getByTestId("ready").textContent).toBe("false");
    expect(ta("response").disabled).toBe(true);
    expect(ta("response").value).toBe("");

    rerender(<Room ns={NS_A} />);
    // The first render reporting ready is the SAME render carrying the text.
    expect(screen.getByTestId("ready").textContent).toBe("true");
    expect(ta("response").disabled).toBe(false);
    expect(ta("response").value).toBe("restored");
  });

  it("restoration happens at most once — a later re-render never re-applies it over new typing", () => {
    writeDraft(NS_A, { response: "old draft", sharedResponse: "", decisionResponse: "", reflectResponse: "" });
    const { rerender } = render(<Room ns={NS_A} />);
    fireEvent.change(ta("response"), { target: { value: "what I am typing now" } });
    rerender(<Room ns={NS_A} />);
    settle();
    rerender(<Room ns={NS_A} />);
    expect(ta("response").value).toBe("what I am typing now");
  });
});

describe("T10/T11 — autosave", () => {
  it("newest wins: a burst of keystrokes persists only the final value", () => {
    render(<Room ns={NS_A} />);
    for (const v of ["a", "ab", "abc", "abcd"]) {
      fireEvent.change(ta("response"), { target: { value: v } });
      act(() => { vi.advanceTimersByTime(100); }); // faster than the debounce
    }
    expect(readDraft(NS_A)).toBeNull(); // nothing written yet — no per-keystroke writes
    settle();
    expect(readDraft(NS_A)?.response).toBe("abcd");
  });

  it("does not write when nothing changed", () => {
    render(<Room ns={NS_A} />);
    fireEvent.change(ta("response"), { target: { value: "once" } });
    settle();
    const spy = vi.spyOn(Storage.prototype, "setItem");
    settle();
    settle();
    expect(spy).not.toHaveBeenCalled();
  });

  it("two fields edited together persist as ONE draft snapshot", () => {
    render(<Room ns={NS_A} />);
    fireEvent.change(ta("response"), { target: { value: "first" } });
    fireEvent.change(ta("shared"), { target: { value: "second" } });
    settle();
    const d = readDraft(NS_A);
    expect(d?.response).toBe("first");
    expect(d?.sharedResponse).toBe("second");
  });

  it("T11 — emptying every field removes the stored draft", () => {
    render(<Room ns={NS_A} />);
    fireEvent.change(ta("response"), { target: { value: "typed" } });
    settle();
    expect(readDraft(NS_A)).not.toBeNull();
    fireEvent.change(ta("response"), { target: { value: "" } });
    settle();
    expect(window.localStorage.getItem(draftKey(NS_A))).toBeNull();
  });
});

describe("T3/T4 — participant and account-switch isolation", () => {
  it("T3 — a different participant in the same event sees nothing", () => {
    writeDraft(NS_A, { response: "A's private words", sharedResponse: "", decisionResponse: "", reflectResponse: "" });
    render(<Room ns={NS_B} />);
    expect(ta("response").value).toBe("");
  });

  it("T4 — after an account switch creates a NEW participant, A's draft never reaches B", () => {
    /*
      The C3A1 containment rule refuses participant P-A for account B, so B joins and receives
      P-B. The namespace is derived from the participant, so B's storage slot differs — A's draft
      is not hidden from B, it is UNREACHABLE, and it stays that way until TTL removes it.
    */
    writeDraft(NS_A, { response: "A's private words", sharedResponse: "", decisionResponse: "", reflectResponse: "" });
    render(<Room ns={NS_B} />);
    expect(ta("response").value).toBe("");
    fireEvent.change(ta("response"), { target: { value: "B's own words" } });
    settle();
    expect(readDraft(NS_B)?.response).toBe("B's own words");
    expect(readDraft(NS_A)?.response).toBe("A's private words"); // untouched, still A's
    expect(NS_A).not.toBe(NS_B);
  });

  it("T5 — anonymous → signed in: the SAME participant keeps the SAME namespace, no re-keying", () => {
    // Signing in does not create a participant; the cookie survives, so the namespace is identical.
    writeDraft(NS_A, { response: "written while signed out", sharedResponse: "", decisionResponse: "", reflectResponse: "" });
    render(<Room ns={participantDraftNamespace(EV, P_A)} />);
    expect(ta("response").value).toBe("written while signed out");
  });
});

describe("T12/T13 — completion cleanup follows the SERVER, not the button", () => {
  it("T12 — a failed or unresolved completion leaves the draft exactly where it is", () => {
    render(<Room ns={NS_A} completed={false} />);
    fireEvent.change(ta("response"), { target: { value: "my answer" } });
    settle();
    // The learner pressed Complete and it failed: the server stage is still not complete.
    cleanup();
    render(<Room ns={NS_A} completed={false} />);
    expect(ta("response").value).toBe("my answer");
    expect(readDraft(NS_A)?.response).toBe("my answer");
  });

  it("T13 — the draft is removed once the SERVER reports the training finished", () => {
    const { rerender } = render(<Room ns={NS_A} completed={false} />);
    fireEvent.change(ta("response"), { target: { value: "my answer" } });
    settle();
    expect(readDraft(NS_A)).not.toBeNull();
    rerender(<Room ns={NS_A} completed={true} />);
    expect(readDraft(NS_A)).toBeNull();
  });

  it("a late debounce timer cannot resurrect a completed training's draft", () => {
    const { rerender } = render(<Room ns={NS_A} completed={false} />);
    fireEvent.change(ta("response"), { target: { value: "typed just before completing" } });
    rerender(<Room ns={NS_A} completed={true} />); // completes INSIDE the debounce window
    settle();
    expect(readDraft(NS_A)).toBeNull();
  });
});

describe("§7 — the exit flush closes the debounce window", () => {
  it("hiding the page persists pending typing immediately", () => {
    render(<Room ns={NS_A} />);
    fireEvent.change(ta("response"), { target: { value: "typed then left" } });
    expect(readDraft(NS_A)).toBeNull(); // still inside the debounce
    act(() => {
      Object.defineProperty(document, "visibilityState", { value: "hidden", configurable: true });
      document.dispatchEvent(new Event("visibilitychange"));
    });
    expect(readDraft(NS_A)?.response).toBe("typed then left");
    Object.defineProperty(document, "visibilityState", { value: "visible", configurable: true });
  });
});

describe("T9 — a refusing store leaves the room usable and shows no saved signal", () => {
  it("typing still works and `saved` never becomes true", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("QuotaExceededError");
    });
    render(<Room ns={NS_A} />);
    fireEvent.change(ta("response"), { target: { value: "still typeable" } });
    settle();
    expect(ta("response").value).toBe("still typeable");
    expect(screen.getByTestId("saved").textContent).toBe("false");
  });
});

/**
 * §16 PRE-FIX DIFFERENTIAL — the defect, kept reproducible.
 *
 * `LegacyRoom` is the room EXACTLY as it was before this slice: four `useState("")` and nothing
 * else. Running the same learner journey against it demonstrates the loss the slice repairs, and
 * keeps that loss visible so nobody has to take the changelog's word for it.
 *
 * The guard file's T14/T15/T16/T18 pass against pre-C4A code too — they assert that things were
 * NOT built, which was already true. They are fences, not repair evidence, and are not counted
 * as such. The repair evidence is here and in T17.
 */
function LegacyRoom() {
  const [response, setResponse] = useState("");
  return <textarea aria-label="response" value={response} onChange={(e) => setResponse(e.target.value)} />;
}

describe("PRE-FIX — the same journey against the pre-C4A room", () => {
  it("loses everything the learner typed on remount (this is the measured defect)", () => {
    const { unmount } = render(<LegacyRoom />);
    fireEvent.change(ta("response"), { target: { value: "what I will say to Minjun" } });
    expect(ta("response").value).toBe("what I will say to Minjun");
    unmount(); // refresh / tab close / Back to Learn / WebView kill — all the same event
    render(<LegacyRoom />);
    expect(ta("response").value).toBe(""); // gone, with no warning and no trace
  });

  it("wrote nothing anywhere — there was no participant namespace to write under", () => {
    render(<LegacyRoom />);
    fireEvent.change(ta("response"), { target: { value: "typed and lost" } });
    settle();
    expect(window.localStorage.length).toBe(0);
  });

  it("and the SAME journey through the repaired room keeps the text", () => {
    const { unmount } = render(<Room ns={NS_A} />);
    fireEvent.change(ta("response"), { target: { value: "what I will say to Minjun" } });
    settle();
    unmount();
    render(<Room ns={NS_A} />);
    expect(ta("response").value).toBe("what I will say to Minjun");
  });
});
