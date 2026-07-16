import { describe, it, expect } from "vitest";
import { createSerializedSaver, type SaveState } from "./moduleAutosave";

const tick = () => new Promise((r) => setTimeout(r, 0));

/** A save you can resolve on demand, recording the order snapshots were sent. */
function controllable() {
  const calls: string[] = [];
  const resolvers: Array<(ok: boolean) => void> = [];
  const save = (snap: string) =>
    new Promise<boolean>((res) => {
      calls.push(snap);
      resolvers.push(res);
    });
  const resolveNext = (ok = true) => resolvers.shift()?.(ok);
  return { save, calls, resolveNext, inFlight: () => resolvers.length };
}

describe("createSerializedSaver", () => {
  it("keeps only one save in flight and coalesces to the NEWEST queued snapshot", async () => {
    const c = controllable();
    const states: SaveState[] = [];
    const saver = createSerializedSaver(c.save, (s) => states.push(s));

    saver.schedule("A");
    await tick();
    expect(c.calls).toEqual(["A"]); // only A is in flight

    saver.schedule("B");
    saver.schedule("C");
    await tick();
    expect(c.calls).toEqual(["A"]); // still just A — B/C queued, not concurrent

    c.resolveNext(true); // A done → drains to the newest queued (C), skipping B
    await tick();
    expect(c.calls).toEqual(["A", "C"]);

    c.resolveNext(true);
    await tick();
    expect(states).toContain("saving");
    expect(states[states.length - 1]).toBe("saved");
  });

  it("flush resolves only after the snapshot is persisted", async () => {
    const c = controllable();
    const saver = createSerializedSaver(c.save, () => {});
    let resolved = false;
    const p = saver.flush("X").then((ok) => {
      resolved = ok;
    });
    await tick();
    expect(resolved).toBe(false); // not yet persisted
    c.resolveNext(true);
    await p;
    expect(resolved).toBe(true);
  });

  it("a failed save surfaces error and is retryable with the latest snapshot", async () => {
    const c = controllable();
    const states: SaveState[] = [];
    const saver = createSerializedSaver(c.save, (s) => states.push(s));

    saver.schedule("A1");
    await tick();
    c.resolveNext(false); // fail
    await tick();
    expect(states[states.length - 1]).toBe("error");

    const p = saver.retry();
    await tick();
    expect(c.calls).toEqual(["A1", "A1"]); // retry re-sends the last snapshot
    c.resolveNext(true);
    await p;
    expect(states[states.length - 1]).toBe("saved");
  });

  it("an in-flight (older) response never causes a newer queued snapshot to be lost", async () => {
    const c = controllable();
    const saver = createSerializedSaver(c.save, () => {});
    saver.schedule("v1");
    await tick();
    saver.schedule("v2"); // newer, queued while v1 in flight
    c.resolveNext(true); // v1 resolves late
    await tick();
    // v2 (newer) is still saved after v1 settles — not dropped.
    expect(c.calls).toEqual(["v1", "v2"]);
  });
});
