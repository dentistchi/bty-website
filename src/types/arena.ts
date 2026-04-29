/**
 * Arena API boundary types — AVATAR_LAYER_SPEC §3.1, §3.2.
 * Shared by API routes and frontend (useAvatar, leaderboard, dashboard).
 */

/** Display keys for avatar composite (GET profile/avatar, leaderboard row). */
export type AvatarCompositeKeys = {
  characterKey: string;
  theme: "professional" | "fantasy";
  outfitKey: string | null;
  accessoryKeys: string[];
};

/** PATCH /api/arena/profile/avatar request body. */
export type PatchAvatarRequest = {
  theme?: "professional" | "fantasy";
  outfitKey?: string | null;
  accessoryKeys?: string[];
};

/** GET /api/arena/profile/avatar response — avatar state + allowed options for UI. */
export type AvatarUiResponse = {
  avatar: {
    characterKey: string;
    theme: "professional" | "fantasy";
    outfitKey: string | null;
    accessoryKeys: string[];
    characterLocked: boolean;
  };
  allowed: {
    outfits: Array<{ key: string; name: string; rarity?: "common" | "rare" | "epic" }>;
    accessorySlots: number;
    accessories?: Array<{ key: string; name: string }>;
  };
};
