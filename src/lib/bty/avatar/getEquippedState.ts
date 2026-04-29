/**
 * Client helper: GET `/api/bty/avatar/equipped` — used by {@link AvatarComposite} with Realtime refresh.
 */
export type ClientEquippedState = {
  equipped_assets: string[];
  equipped_slots: (string | null)[];
};

export async function getEquippedState(userId: string): Promise<ClientEquippedState> {
  const uid = userId.trim();
  if (!uid) {
    return { equipped_assets: [], equipped_slots: Array.from({ length: 5 }, () => null) };
  }

  const res = await fetch(`/api/bty/avatar/equipped?userId=${encodeURIComponent(uid)}`, {
    credentials: "include",
  });
  if (!res.ok) {
    throw new Error("EQUIPPED_LOAD_FAILED");
  }
  const json = (await res.json()) as {
    equipped_assets?: string[];
    equipped_slots?: (string | null)[];
    error?: string;
  };
  if (json.error) throw new Error(json.error);
  const equipped_assets = Array.isArray(json.equipped_assets) ? json.equipped_assets : [];
  const rawSlots = json.equipped_slots;
  const equipped_slots =
    Array.isArray(rawSlots) && rawSlots.length > 0
      ? [...rawSlots]
      : Array.from({ length: 5 }, () => null);
  while (equipped_slots.length < 5) equipped_slots.push(null);
  return { equipped_assets, equipped_slots: equipped_slots.slice(0, 5) };
}
