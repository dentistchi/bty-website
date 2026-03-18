/**
 * Client-side Journey API helpers (same-origin, session + Bearer).
 * @see /api/journey/profile · /api/journey/bounce-back
 */

function authHeaders(): HeadersInit {
  const headers: Record<string, string> = {};
  if (typeof window !== "undefined") {
    const token = localStorage.getItem("bty_auth_token");
    if (token) headers.Authorization = `Bearer ${token}`;
  }
  return headers;
}

export type JourneyProfile = {
  current_day: number;
  total_days?: number;
  is_comeback_eligible?: boolean;
  bounce_back_count?: number;
  started_at?: string;
  updated_at?: string;
  season?: number;
  last_completed_at?: string | null;
  is_new?: boolean;
};

function parseProfile(json: unknown): JourneyProfile {
  if (!json || typeof json !== "object" || Array.isArray(json)) {
    throw new Error("Invalid journey profile response");
  }
  const o = json as Record<string, unknown>;
  if (typeof o.error === "string" && o.error) {
    throw new Error(o.error);
  }
  const current_day = Math.min(28, Math.max(1, Number(o.current_day) || 1));
  return {
    current_day,
    total_days: typeof o.total_days === "number" ? o.total_days : 28,
    is_comeback_eligible: Boolean(o.is_comeback_eligible),
    bounce_back_count: typeof o.bounce_back_count === "number" ? o.bounce_back_count : 0,
    started_at: typeof o.started_at === "string" ? o.started_at : undefined,
    updated_at: typeof o.updated_at === "string" ? o.updated_at : undefined,
    season: typeof o.season === "number" ? o.season : 1,
    last_completed_at:
      o.last_completed_at === null
        ? null
        : typeof o.last_completed_at === "string"
          ? o.last_completed_at
          : null,
    is_new: Boolean(o.is_new),
  };
}

export async function getJourneyProfile(): Promise<JourneyProfile> {
  const res = await fetch("/api/journey/profile", {
    method: "GET",
    credentials: "include",
    headers: authHeaders(),
    cache: "no-store",
  });

  if (res.status === 401) {
    throw new Error("Unauthorized");
  }
  if (!res.ok) {
    let msg = "Failed to load journey profile";
    try {
      const j = (await res.json()) as { error?: string };
      if (j.error) msg = j.error;
    } catch {
      /* ignore */
    }
    throw new Error(msg);
  }

  const json: unknown = await res.json();
  return parseProfile(json);
}

export async function recordBounceBack(): Promise<{ bounce_back_count: number }> {
  const res = await fetch("/api/journey/bounce-back", {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...authHeaders(),
    },
  });

  if (!res.ok) {
    let msg = "Failed to record bounce-back";
    try {
      const j = (await res.json()) as { error?: string };
      if (j.error) msg = j.error;
    } catch {
      /* ignore */
    }
    throw new Error(msg);
  }

  const json = (await res.json()) as { bounce_back_count?: number };
  return { bounce_back_count: json.bounce_back_count ?? 0 };
}

/** Manual restart from Day 1 (optional); does not touch XP/leaderboard. */
export async function restartJourneyFromDayOne(season: number): Promise<void> {
  const res = await fetch("/api/journey/profile", {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...authHeaders(),
    },
    body: JSON.stringify({
      current_day: 1,
      season: Math.max(1, season),
      last_completed_at: null,
    }),
  });

  if (!res.ok) {
    let msg = "Failed to restart journey";
    try {
      const j = (await res.json()) as { error?: string };
      if (j.error) msg = j.error;
    } catch {
      /* ignore */
    }
    throw new Error(msg);
  }
}
