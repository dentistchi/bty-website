"use client";

import React from "react";

export type TierMilestone = 25 | 50 | 75;

export type TierMilestoneModalProps = {
  milestone: TierMilestone;
  /** Current sub name (e.g. "Ember" at tier 25). */
  subName: string;
  /** For milestone 50/75: the sub name we moved beyond (e.g. "Spark" when reaching 50). */
  previousSubName?: string;
  /** Show rename input (Tier 25 only, and not in CODELESS ZONE). */
  subNameRenameAvailable?: boolean;
  onRename?: (name: string) => Promise<void>;
  onClose: () => void;
};

export function TierMilestoneModal({
  milestone,
  subName,
  previousSubName,
  subNameRenameAvailable,
  onRename,
  onClose,
}: TierMilestoneModalProps) {
  const [renameValue, setRenameValue] = React.useState("");
  const [saving, setSaving] = React.useState(false);

  const handleSaveRename = async () => {
    const trimmed = renameValue.trim().slice(0, 7);
    if (!trimmed || !onRename) return;
    setSaving(true);
    try {
      await onRename(trimmed);
      onClose();
    } catch {
      // keep modal open
    } finally {
      setSaving(false);
    }
  };

  const showRename = milestone === 25 && subNameRenameAvailable && onRename;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 10000,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "rgba(0,0,0,0.4)",
      }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        style={{
          background: "white",
          borderRadius: 16,
          padding: 24,
          maxWidth: 400,
          width: "90%",
          boxShadow: "0 8px 32px rgba(0,0,0,0.15)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {milestone === 25 && (
          <>
            <div style={{ fontWeight: 800, fontSize: 20, marginBottom: 8 }}>
              {subName} Unlocked
            </div>
            <div style={{ fontSize: 14, color: "#555", lineHeight: 1.5 }}>
              You&apos;ve moved to a new phase. {showRename ? "You may rename this phase once." : ""}
            </div>
          </>
        )}
        {(milestone === 50 || milestone === 75) && (
          <>
            <div style={{ fontWeight: 800, fontSize: 20, marginBottom: 8 }}>
              Milestone Reached
            </div>
            <div style={{ fontSize: 14, color: "#555", lineHeight: 1.5 }}>
              You&apos;ve moved beyond {previousSubName ?? "the previous phase"}.
            </div>
          </>
        )}

        {showRename && (
          <div style={{ marginTop: 16 }}>
            <input
              type="text"
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value.slice(0, 7))}
              placeholder="Sub name (7 chars)"
              maxLength={7}
              style={{
                width: "100%",
                padding: "10px 12px",
                borderRadius: 10,
                border: "1px solid #ddd",
                marginBottom: 10,
              }}
            />
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button
                type="button"
                onClick={onClose}
                style={{
                  padding: "10px 16px",
                  borderRadius: 10,
                  border: "1px solid #ddd",
                  background: "white",
                  cursor: "pointer",
                }}
              >
                Skip
              </button>
              <button
                type="button"
                onClick={handleSaveRename}
                disabled={saving || !renameValue.trim()}
                style={{
                  padding: "10px 16px",
                  borderRadius: 10,
                  border: "none",
                  background: "#111",
                  color: "white",
                  cursor: saving || !renameValue.trim() ? "not-allowed" : "pointer",
                }}
              >
                {saving ? "Saving…" : "Save"}
              </button>
            </div>
          </div>
        )}

        {!showRename && (
          <div style={{ marginTop: 20 }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                width: "100%",
                padding: "12px 16px",
                borderRadius: 10,
                border: "none",
                background: "#111",
                color: "white",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Continue
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
