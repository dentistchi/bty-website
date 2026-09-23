import { describe, expect, it } from "vitest";
import { RECENT_WITHOUT_OBLIGATION, splitLearningHistory } from "./myLearningArchive";

type Row = { id: string; actionable?: boolean };
const rows = (n: number, actionable: string[] = []): Row[] =>
  Array.from({ length: n }, (_, i) => ({ id: `r${i + 1}`, actionable: actionable.includes(`r${i + 1}`) }));
const act = (r: Row) => r.actionable === true;
const ids = (r: Row[]) => r.map((x) => x.id);

describe("splitLearningHistory", () => {
  it("keeps everything when the history is short", () => {
    const { visible, archived } = splitLearningHistory(rows(4), act);
    expect(ids(visible)).toEqual(["r1", "r2", "r3", "r4"]);
    expect(archived).toEqual([]);
  });

  it("keeps the 10 most recent obligation-free trainings and archives the rest", () => {
    const { visible, archived } = splitLearningHistory(rows(46), act);
    expect(visible).toHaveLength(RECENT_WITHOUT_OBLIGATION);
    expect(ids(visible)).toEqual(ids(rows(10)));
    expect(archived).toHaveLength(36);
  });

  it("NEVER archives a training with something still to do, however old it is", () => {
    const { visible, archived } = splitLearningHistory(rows(46, ["r46"]), act);
    expect(ids(visible)).toContain("r46");
    expect(ids(archived)).not.toContain("r46");
    // The obligation is IN ADDITION to the ten recent ones, not instead of one of them.
    expect(visible).toHaveLength(11);
    expect(archived).toHaveLength(35);
  });

  it("preserves order — an obligation is kept, never hoisted to the top", () => {
    const { visible } = splitLearningHistory(rows(46, ["r46"]), act);
    expect(ids(visible)).toEqual([...ids(rows(10)), "r46"]);
  });

  it("does not let obligations consume the recent allowance", () => {
    const { visible, archived } = splitLearningHistory(rows(20, ["r1", "r2", "r3"]), act);
    // 3 actionable + 10 obligation-free = 13 visible, whichever order they arrived in.
    expect(visible).toHaveLength(13);
    expect(archived).toHaveLength(7);
    expect(ids(archived)).toEqual(["r14", "r15", "r16", "r17", "r18", "r19", "r20"]);
  });

  it("shows everything when every record is actionable", () => {
    const all = rows(30).map((r) => ({ ...r, actionable: true }));
    const { visible, archived } = splitLearningHistory(all, act);
    expect(visible).toHaveLength(30);
    expect(archived).toEqual([]);
  });

  it("archives nothing from an empty or malformed history", () => {
    expect(splitLearningHistory([], act)).toEqual({ visible: [], archived: [] });
    expect(splitLearningHistory(undefined as never, act)).toEqual({ visible: [], archived: [] });
  });

  it("archived plus visible is always the whole history, with nothing lost or duplicated", () => {
    const all = rows(46, ["r20", "r45"]);
    const { visible, archived } = splitLearningHistory(all, act);
    expect([...ids(visible), ...ids(archived)].sort()).toEqual(ids(all).sort());
    expect(new Set([...ids(visible), ...ids(archived)]).size).toBe(46);
  });
});
