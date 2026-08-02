/**
 * PRACTICE SURFACE AUTHORITY (Slice 3.2I-R5B2-R2).
 *
 * The R1 defect in one sentence: the Host authoring entry was a sibling of a component that kept
 * its own view state private, so "Practice again" opened the learner runtime with "Create practice"
 * still above it. These tests pin the rule that replaced that blindness, including the two
 * behaviours a naive "only show on a loaded list" rule would get wrong.
 */

import { describe, it, expect } from "vitest";
import { PRACTICE_SURFACES, isPracticeExecution, showsAuthoringEntry, type PracticeSurface } from "./practiceSurface";

describe("[R2] the authoring entry belongs to the index, never to execution", () => {
  it.each(["index_loading", "index_error", "index_empty", "index_list"] as PracticeSurface[])(
    "%s shows it",
    (s) => {
      expect(showsAuthoringEntry(s)).toBe(true);
      expect(isPracticeExecution(s)).toBe(false);
    },
  );

  it.each(["runtime_starting", "runtime_playing"] as PracticeSurface[])("%s hides it", (s) => {
    expect(showsAuthoringEntry(s)).toBe(false);
    expect(isPracticeExecution(s)).toBe(true);
  });

  it("the vocabulary is closed — a new surface cannot default to visible by accident", () => {
    expect(PRACTICE_SURFACES).toHaveLength(6);
    expect(PRACTICE_SURFACES.filter(showsAuthoringEntry)).toEqual([
      "index_loading",
      "index_error",
      "index_empty",
      "index_list",
    ]);
  });

  it("loading is INDEX, not unresolved — otherwise the control blinks on every return", () => {
    // ArenaRoom reloads its list each time it comes back from a practice. If loading hid the
    // control it would disappear and reappear on every single return.
    expect(showsAuthoringEntry("index_loading")).toBe(true);
  });

  it("a failed list does not remove the way in — authoring does not depend on the list loading", () => {
    expect(showsAuthoringEntry("index_error")).toBe(true);
  });
});
