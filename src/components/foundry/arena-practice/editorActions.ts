/**
 * PRACTICE EDITOR ACTION STATE (Slice 3.2I-R5B2-R2).
 *
 * Founder device evidence: on an iPhone the editor's controls overlapped each other and the
 * scenario content, labels were ambiguous, and the lower part of the screen could not be read or
 * operated. Five controls and up to four conditional explanation lines lived in one bare
 * `sticky bottom-2` stack with NO background, so the scenario scrolled visibly through the gaps
 * between the buttons, and nothing reserved the stack's height at the end of the content.
 *
 * Layout is fixed in the component. This module fixes the other half: WHICH actions are true at
 * once. Every action was previously rendered in every state, with only `disabled` to tell them
 * apart — including Publish, which stayed enabled for a revision that was already live and so
 * offered to publish what was already published.
 *
 * One primary action per state. Replacement actions ("Try a different draft", "Start a new one")
 * are always secondary, because they destroy work and must never sit at the same weight as saving
 * it. Pure: no React, no I/O, no copy.
 */

export type EditorView = "edit" | "preview";
export type EditorSaveState = "idle" | "saving" | "saved" | "error";
export type EditorPublishState = "idle" | "publishing" | "published" | "stale" | "error";

export type EditorActionInput = {
  /** Unsaved edits exist. */
  dirty: boolean;
  saveState: EditorSaveState;
  publishState: EditorPublishState;
  /** The published practice id for the CURRENT saved revision, when this revision is live. */
  livePracticeId: string | null;
  view: EditorView;
  /** A regenerate request is in flight. */
  busy: boolean;
};

export type EditorPrimary = "save" | "publish" | "test" | "none";

export type EditorActions = {
  /** Exactly one, and it is the only action rendered at primary weight. */
  primary: EditorPrimary;
  showSave: boolean;
  saveDisabled: boolean;
  showPublish: boolean;
  publishDisabled: boolean;
  showTest: boolean;
  testDisabled: boolean;
  showRegenerate: boolean;
  showStartOver: boolean;
  /** This exact saved revision is already published — Publish is not offered for it. */
  liveAtThisRevision: boolean;
  /** At most one explanation line, so the region cannot grow by stacking hints. */
  hint: "save_before_testing" | "save_before_publish" | "publish_stale" | "publish_error" | "save_error" | null;
};

export function resolveEditorActions(input: EditorActionInput): EditorActions {
  const { dirty, saveState, publishState, livePracticeId, view, busy } = input;
  const preview = view === "preview";
  const liveAtThisRevision = !dirty && livePracticeId !== null;

  // Preview is a reading surface. Editing and replacement actions are not offered there — they
  // would act on a draft the Host is not currently looking at in an editable form.
  const showRegenerate = !preview;
  const showStartOver = !preview;
  const showSave = !preview;

  // Publishing what is already live is not an action, it is a lie about state.
  const showPublish = !liveAtThisRevision && publishState !== "published";
  const publishDisabled = dirty || publishState === "publishing" || busy;

  const showTest = true;
  const testDisabled = dirty || busy;
  const saveDisabled = saveState === "saving" || busy;

  // Unsaved work is the only thing that can be lost, so saving it outranks everything.
  const primary: EditorPrimary = dirty
    ? preview
      ? "none"
      : "save"
    : showPublish
      ? "publish"
      : "test";

  const hint: EditorActions["hint"] =
    saveState === "error"
      ? "save_error"
      : publishState === "error"
        ? "publish_error"
        : publishState === "stale"
          ? "publish_stale"
          : dirty && showPublish
            ? "save_before_publish"
            : dirty
              ? "save_before_testing"
              : null;

  return {
    primary,
    showSave,
    saveDisabled,
    showPublish,
    publishDisabled,
    showTest,
    testDisabled,
    showRegenerate,
    showStartOver,
    liveAtThisRevision,
    hint,
  };
}
