import { describe, it, expect } from "vitest";
import {
  arenaRunDetailSkeletonDisplayKey,
  ARENA_RUN_DETAIL_LOADING_DISPLAY_KEY,
  ARENA_RUN_DETAIL_EMPTY_DISPLAY_KEY,
} from "./arenaRunDetailDisplay";

describe("arenaRunDetailSkeletonDisplayKey (250)", () => {
  it("maps loading and empty phases", () => {
    expect(arenaRunDetailSkeletonDisplayKey("loading")).toBe(
      ARENA_RUN_DETAIL_LOADING_DISPLAY_KEY
    );
    expect(arenaRunDetailSkeletonDisplayKey("empty")).toBe(
      ARENA_RUN_DETAIL_EMPTY_DISPLAY_KEY
    );
    expect(ARENA_RUN_DETAIL_LOADING_DISPLAY_KEY).toBe("arena.run_detail.loading");
    expect(ARENA_RUN_DETAIL_EMPTY_DISPLAY_KEY).toBe("arena.run_detail.empty");
  });
});
