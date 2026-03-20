import { describe, it, expect } from "vitest";
import {
  ARENA_AVATAR_UPLOAD_MAX_BYTES,
  ARENA_AVATAR_UPLOAD_ALLOWED_MIME_TYPES,
  isAllowedArenaAvatarMimeType,
} from "./arenaAvatarUploadLimits";

describe("arenaAvatarUploadLimits (edges)", () => {
  it("max bytes is 2MB", () => {
    expect(ARENA_AVATAR_UPLOAD_MAX_BYTES).toBe(2 * 1024 * 1024);
  });

  it("allows jpeg, png, webp, gif", () => {
    expect(isAllowedArenaAvatarMimeType("image/jpeg")).toBe(true);
    expect(isAllowedArenaAvatarMimeType("image/png")).toBe(true);
    expect(isAllowedArenaAvatarMimeType("image/webp")).toBe(true);
    expect(isAllowedArenaAvatarMimeType("image/gif")).toBe(true);
  });

  it("rejects other types", () => {
    expect(isAllowedArenaAvatarMimeType("image/svg+xml")).toBe(false);
    expect(isAllowedArenaAvatarMimeType("text/plain")).toBe(false);
    expect(isAllowedArenaAvatarMimeType("")).toBe(false);
  });

  it("allowed MIME list matches constant", () => {
    expect(ARENA_AVATAR_UPLOAD_ALLOWED_MIME_TYPES).toHaveLength(4);
  });
});
