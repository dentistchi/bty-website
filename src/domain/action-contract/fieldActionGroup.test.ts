/** @vitest-environment node */
import { describe, it, expect } from "vitest";
import {
  fieldActionLearnerGroup,
  FIELD_ACTION_GROUP_ORDER,
  FIELD_ACTION_INVENTORY_STATUSES,
} from "./fieldActionGroup";

describe("fieldActionLearnerGroup — canonical lifecycle → learner group", () => {
  it("maps each canonical status by existing lifecycle meaning", () => {
    expect(fieldActionLearnerGroup("rejected")).toBe("needs_revision");
    expect(fieldActionLearnerGroup("submitted")).toBe("awaiting_review");
    expect(fieldActionLearnerGroup("pending")).toBe("upcoming");
    expect(fieldActionLearnerGroup("approved")).toBe("reviewed");
  });

  it("keeps submitted and escalated DISTINCT (escalated → awaiting_resolution, never awaiting_review)", () => {
    expect(fieldActionLearnerGroup("escalated")).toBe("awaiting_resolution");
    expect(fieldActionLearnerGroup("escalated")).not.toBe("awaiting_review");
    expect(fieldActionLearnerGroup("submitted")).not.toBe("awaiting_resolution");
  });

  it("never fabricates a group for unknown/absent status (→ other, not silently mislabeled)", () => {
    expect(fieldActionLearnerGroup("completed")).toBe("other");
    expect(fieldActionLearnerGroup("missed")).toBe("other");
    expect(fieldActionLearnerGroup(null)).toBe("other");
    expect(fieldActionLearnerGroup(undefined)).toBe("other");
  });

  it("group display order is most-action-needed first (escalated distinct from submitted)", () => {
    expect(FIELD_ACTION_GROUP_ORDER).toEqual([
      "needs_revision",
      "awaiting_review",
      "awaiting_resolution",
      "upcoming",
      "reviewed",
    ]);
  });

  it("inventory status scope covers the full field_action lifecycle", () => {
    expect([...FIELD_ACTION_INVENTORY_STATUSES].sort()).toEqual(
      ["approved", "escalated", "pending", "rejected", "submitted"].sort(),
    );
  });
});
