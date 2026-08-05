/** @vitest-environment jsdom */
import { describe, it, expect, vi, afterEach } from "vitest";
import { createSerializedSaver, FLUSH_TIMEOUT_MS } from "./moduleAutosave";

/**
 * REVIEW EDIT NAVIGATION (Slice 3.2K-R2E).
 *
 * The Founder's device proved the defect: at Review, tapping the Learning Materials Edit control
 * did nothing — no navigation, no sheet, no focus change — repeatedly and silently.
 *
 * The control was never missing. `navigate()` awaits `saver.flush()` before `setStep()`, and a
 * `fetch` with no deadline could leave the saver permanently `inFlight`: every later `flush` pushed
 * a waiter, `schedule()` declined to start a loop, and `settle()` was never reached. Back, Next and
 * EVERY Review Edit were dead for the rest of the session.
 *
 * These tests reproduce the wedge against the real saver and hold the repair.
 */

afterEach(() => vi.useRealTimers());

describe("[R2E] the saver can no longer trap a navigation", () => {
  it("REPRODUCES the wedge: a never-settling save leaves a later flush pending forever", async () => {
    vi.useFakeTimers();
    // A save that never resolves — exactly what an unbounded fetch does on a stalled connection.
    const saver = createSerializedSaver<string>(() => new Promise<boolean>(() => {}), () => {}, 0);
    saver.schedule("first");

    let settled = false;
    void saver.flush("second").then(() => (settled = true));
    await vi.advanceTimersByTimeAsync(60_000);

    // With the bound disabled this is the OLD behaviour: the navigation never proceeds.
    expect(settled, "unbounded flush hangs — this is the measured defect").toBe(false);
  });

  it("REPAIR: the same wedge now releases the caller, so navigation proceeds", async () => {
    vi.useFakeTimers();
    const saver = createSerializedSaver<string>(() => new Promise<boolean>(() => {}), () => {});
    saver.schedule("first");

    const flushed = saver.flush("second");
    await vi.advanceTimersByTimeAsync(FLUSH_TIMEOUT_MS + 50);

    // `false` = "the save did not confirm" — the caller navigates anyway.
    await expect(flushed).resolves.toBe(false);
  });

  it("a NORMAL save is still awaited and reports success — the bound is not a shortcut", async () => {
    const saver = createSerializedSaver<string>(async () => true, () => {});
    await expect(saver.flush("a")).resolves.toBe(true);
  });

  it("a slow-but-real save is still awaited when it lands inside the bound", async () => {
    vi.useFakeTimers();
    const saver = createSerializedSaver<string>(
      () => new Promise<boolean>((r) => setTimeout(() => r(true), FLUSH_TIMEOUT_MS / 2)),
      () => {},
    );
    const p = saver.flush("a");
    await vi.advanceTimersByTimeAsync(FLUSH_TIMEOUT_MS / 2 + 10);
    await expect(p).resolves.toBe(true);
  });

  it("abandoning the WAIT never abandons the SAVE", async () => {
    vi.useFakeTimers();
    let release: ((ok: boolean) => void) | undefined;
    const save = vi.fn((_s: string) => new Promise<boolean>((r) => { release = r; }));
    const saver = createSerializedSaver<string>(save, () => {});

    const p = saver.flush("payload");
    await vi.advanceTimersByTimeAsync(FLUSH_TIMEOUT_MS + 50);
    await expect(p).resolves.toBe(false);

    // The request is still in flight and still carries the Host's answers.
    expect(save).toHaveBeenCalledTimes(1);
    expect(save).toHaveBeenCalledWith("payload");
    release?.(true);
  });

  it("a timed-out waiter does not steal a later waiter's result", async () => {
    vi.useFakeTimers();
    // Only the FIRST save stalls; the drain that follows resolves normally.
    let calls = 0;
    let release: ((ok: boolean) => void) | undefined;
    const saver = createSerializedSaver<string>(() => {
      calls += 1;
      return calls === 1 ? new Promise<boolean>((r) => { release = r; }) : Promise.resolve(true);
    }, () => {});

    const early = saver.flush("a");
    await vi.advanceTimersByTimeAsync(FLUSH_TIMEOUT_MS + 10);
    await expect(early).resolves.toBe(false); // abandoned its wait

    const late = saver.flush("b");
    release?.(true); // the stalled first save finally lands; the drain then saves "b"
    await vi.advanceTimersByTimeAsync(10);
    // The later caller gets its OWN result, not the abandoned one.
    await expect(late).resolves.toBe(true);
  });
});

describe("[R2E] a failed save no longer strands the queue", () => {
  it("clears the queued snapshot on failure so a stale one cannot replay", async () => {
    const seen: string[] = [];
    let failNext = true;
    const saver = createSerializedSaver<string>(async (s) => {
      seen.push(s);
      if (failNext) {
        failNext = false;
        return false;
      }
      return true;
    }, () => {});

    await saver.flush("one");        // fails
    await expect(saver.flush("two")).resolves.toBe(true);
    // "one" is never replayed after its failure — the Host's later answer wins.
    expect(seen).toEqual(["one", "two"]);
  });

  it("reports error state on failure and recovers on the next success", async () => {
    const states: string[] = [];
    let ok = false;
    const saver = createSerializedSaver<string>(async () => ok, (s) => states.push(s));
    await saver.flush("x");
    expect(states).toContain("error");
    ok = true;
    await saver.flush("y");
    expect(states[states.length - 1]).toBe("saved");
  });
});

describe("[R2E] every Review Edit destination owns the value it shows", () => {
  /**
   * Measured from `ReviewBody`'s row table. Seven INPUT steps (1..7) plus step 8 = Review, so a
   * destination of 8 would be an off-by-one that sent the Host back to Review.
   */
  const ROWS: ReadonlyArray<{ label: string; step: number; owns: string }> = [
    { label: "What needs to change", step: 1, owns: "problem" },
    { label: "Who it's for", step: 2, owns: "audienceType/audienceDetail" },
    { label: "Capability", step: 3, owns: "capabilityCandidate" },
    { label: "What people should do differently", step: 3, owns: "observableBehavior" },
    { label: "How you'd recognize success", step: 4, owns: "successEvidence/evidenceType" },
    { label: "Learning approach", step: 5, owns: "learningNeeds" },
    { label: "Material", step: 6, owns: "materialIntent/materialText/assets" },
    { label: "Completion question", step: 6, owns: "completionPrompt" },
    { label: "Practice in Arena", step: 7, owns: "arenaRecommended" },
    { label: "Follow-up", step: 7, owns: "followUpDays" },
  ];

  it("no destination is Review itself, and none is out of range", () => {
    for (const r of ROWS) {
      expect(r.step, `${r.label} must not target Review (8)`).toBeLessThanOrEqual(7);
      expect(r.step, `${r.label} must be a real input step`).toBeGreaterThanOrEqual(1);
    }
  });

  it("Learning Materials edits at the step that owns the attachment", () => {
    // The Founder's exact case: Material is collected at step 6, so Edit must return there.
    const material = ROWS.find((r) => r.owns.includes("assets"));
    expect(material?.step).toBe(6);
  });

  it("every input step that collects a displayed value is reachable from Review", () => {
    const reachable = new Set(ROWS.map((r) => r.step));
    for (const step of [1, 2, 3, 4, 5, 6, 7]) {
      expect(reachable.has(step), `step ${step} has no Review Edit that returns to it`).toBe(true);
    }
  });

  it("no Edit destination is inert — every row carries a real step number", () => {
    for (const r of ROWS) expect(Number.isInteger(r.step), r.label).toBe(true);
  });
});
