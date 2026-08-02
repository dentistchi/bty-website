/**
 * PRACTICE EDITOR ACTION STATE (Slice 3.2I-R5B2-R2).
 *
 * The device defect had two halves. Layout is fixed in the component; this is the other half —
 * every action used to render in every state, told apart only by `disabled`, and Publish stayed
 * ENABLED for a revision that was already live, offering to publish what was already published.
 */

import { describe, it, expect } from "vitest";
import { resolveEditorActions, type EditorActionInput } from "./editorActions";

const base: EditorActionInput = {
  dirty: false,
  saveState: "idle",
  publishState: "idle",
  livePracticeId: null,
  view: "edit",
  busy: false,
};
const at = (o: Partial<EditorActionInput> = {}) => resolveEditorActions({ ...base, ...o });

describe("[R2] exactly one primary action, in every reachable state", () => {
  const STATES: Array<[string, Partial<EditorActionInput>]> = [
    ["clean, never published", {}],
    ["unsaved edits", { dirty: true }],
    ["unsaved edits while saving", { dirty: true, saveState: "saving" }],
    ["save failed", { dirty: true, saveState: "error" }],
    ["saved, live at this revision", { livePracticeId: "prac-1" }],
    ["saved, live, then edited again", { livePracticeId: "prac-1", dirty: true }],
    ["publishing", { publishState: "publishing" }],
    ["publish stale", { publishState: "stale" }],
    ["publish failed", { publishState: "error" }],
    ["preview, clean", { view: "preview" }],
    ["preview, dirty", { view: "preview", dirty: true }],
    ["regenerating", { busy: true }],
  ];

  it.each(STATES)("%s resolves a single primary", (_label, o) => {
    const a = at(o);
    const primaries = [
      a.primary === "save" && a.showSave,
      a.primary === "publish" && a.showPublish,
      a.primary === "test" && a.showTest,
    ].filter(Boolean);
    // Either exactly one visible primary, or an explicit "none" — never two competing golds.
    expect(primaries.length + (a.primary === "none" ? 1 : 0)).toBe(1);
  });

  it.each(STATES)("%s never stacks more than one explanation line", (_label, o) => {
    expect([null, "save_before_testing", "save_before_publish", "publish_stale", "publish_error", "save_error"]).toContain(
      at(o).hint,
    );
  });
});

describe("[R2] the published state is honest", () => {
  it("a revision that is already live does NOT offer Publish", () => {
    const a = at({ livePracticeId: "prac-1" });
    expect(a.liveAtThisRevision).toBe(true);
    expect(a.showPublish).toBe(false);
    // What is genuinely useful now is trying it as a learner.
    expect(a.primary).toBe("test");
  });

  it("editing a live revision brings Publish back — the new bytes are genuinely unpublished", () => {
    const a = at({ livePracticeId: "prac-1", dirty: true });
    expect(a.liveAtThisRevision).toBe(false);
    expect(a.showPublish).toBe(true);
    expect(a.publishDisabled).toBe(true); // save first
    expect(a.primary).toBe("save");
    expect(a.hint).toBe("save_before_publish");
  });

  it("after a successful publish the action is withdrawn, not left as a dead label", () => {
    expect(at({ publishState: "published" }).showPublish).toBe(false);
  });
});

describe("[R2] unsaved work outranks everything", () => {
  it("dirty makes saving primary and blocks the actions that would act on stale bytes", () => {
    const a = at({ dirty: true });
    expect(a.primary).toBe("save");
    expect(a.publishDisabled).toBe(true);
    expect(a.testDisabled).toBe(true);
  });

  it("a save failure is reported above every other hint", () => {
    expect(at({ dirty: true, saveState: "error", publishState: "stale" }).hint).toBe("save_error");
  });

  it("a clean, never-published draft leads with Publish", () => {
    const a = at();
    expect(a.primary).toBe("publish");
    expect(a.publishDisabled).toBe(false);
    expect(a.testDisabled).toBe(false);
  });
});

describe("[R2] replacement actions are never primary, and preview only reads", () => {
  it("regenerate and start-over are offered but never carry primary weight", () => {
    for (const o of [{}, { dirty: true }, { livePracticeId: "p" }]) {
      const a = at(o);
      expect(a.showRegenerate).toBe(true);
      expect(a.showStartOver).toBe(true);
      expect(["save", "publish", "test", "none"]).toContain(a.primary);
      // They are not representable as primary at all — the type has no such value.
      expect(a.primary).not.toBe("regenerate" as never);
    }
  });

  it("preview withdraws the actions that edit or replace what is being read", () => {
    const a = at({ view: "preview" });
    expect(a.showSave).toBe(false);
    expect(a.showRegenerate).toBe(false);
    expect(a.showStartOver).toBe(false);
    // Reading it and shipping it are both still true in preview.
    expect(a.showTest).toBe(true);
    expect(a.showPublish).toBe(true);
  });

  it("a regenerate in flight disables the actions that would race it", () => {
    const a = at({ busy: true });
    expect(a.saveDisabled).toBe(true);
    expect(a.publishDisabled).toBe(true);
    expect(a.testDisabled).toBe(true);
  });
});
