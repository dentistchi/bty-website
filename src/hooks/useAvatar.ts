"use client";

import { useState, useEffect, useCallback } from "react";
import type { AvatarUiResponse, PatchAvatarRequest } from "@/types/arena";

const AVATAR_API = "/api/arena/profile/avatar";

/**
 * AVATAR_LAYER_SPEC §5.2: GET /api/arena/profile/avatar → data (AvatarUiResponse), patch(payload).
 */
export function useAvatar() {
  const [data, setData] = useState<AvatarUiResponse | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch(AVATAR_API, { credentials: "include" });
      const j = await r.json();
      if (r.ok) setData(j);
      else setData(null);
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  const patch = useCallback(
    async (payload: PatchAvatarRequest) => {
      const r = await fetch(AVATAR_API, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        credentials: "include",
      });
      const j = await r.json();
      if (r.ok) await refresh();
      return j;
    },
    [refresh]
  );

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { data, loading, refresh, patch };
}
