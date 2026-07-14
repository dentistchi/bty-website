/**
 * Server-side YouTube embeddability check (Foundry Embeddability Gate V1).
 *
 * A manager can paste a video whose owner disabled embedding ("Playback on other
 * websites has been disabled") — it parses to a valid id but throws IFrame error
 * 101/150 at play time, stranding employees. So at Event creation we call the
 * YouTube Data API `videos.list?part=status` and require `status.embeddable`.
 *
 * Server-only: reads `YOUTUBE_API_KEY` from the process env (never `NEXT_PUBLIC`).
 * No key is committed. In the deployed envs the key is REQUIRED (fail-closed); in
 * local/test only, an absent key skips the check so dev works (tests mock this).
 */

export type EmbedCheck =
  | "embeddable"
  | "not_embeddable"
  | "not_found"
  | "check_failed" // network / quota / bad-key / unexpected
  | "unconfigured"; // no YOUTUBE_API_KEY present

function isProdEnv(): boolean {
  const env = process.env.BTY_ENV;
  return env === "production" || env === "staging";
}

/**
 * Resolve whether a video may be embedded in Foundry. Pure I/O wrapper around the
 * Data API; the caller maps the result to a field-level reason. `fetchImpl` is
 * injectable for tests.
 */
export async function resolveYoutubeEmbeddable(
  videoId: string,
  fetchImpl: typeof fetch = fetch,
): Promise<EmbedCheck> {
  const key = process.env.YOUTUBE_API_KEY?.trim();
  if (!key) {
    // In prod/staging a missing key is a misconfiguration → fail closed so we
    // never create an event we could not verify. In dev/test, skip the check.
    return isProdEnv() ? "check_failed" : "unconfigured";
  }

  let res: Response;
  try {
    const url =
      "https://www.googleapis.com/youtube/v3/videos?part=status&id=" +
      encodeURIComponent(videoId) +
      "&key=" +
      encodeURIComponent(key);
    res = await fetchImpl(url, { method: "GET" });
  } catch {
    return "check_failed";
  }

  if (!res.ok) return "check_failed";

  let body: { items?: Array<{ status?: { embeddable?: boolean } }> };
  try {
    body = (await res.json()) as typeof body;
  } catch {
    return "check_failed";
  }

  const items = body.items ?? [];
  if (items.length === 0) return "not_found";
  return items[0]?.status?.embeddable === true ? "embeddable" : "not_embeddable";
}

/** Whether an EmbedCheck permits creating the event. `unconfigured` (dev-only) passes. */
export function embedCheckAllowsCreate(check: EmbedCheck): boolean {
  return check === "embeddable" || check === "unconfigured";
}

/** Map a blocking EmbedCheck to the field-level reason the create route returns. */
export function embedCheckReason(check: EmbedCheck): string {
  if (check === "not_embeddable") return "video_not_embeddable";
  if (check === "not_found") return "video_not_found";
  return "youtube_check_failed"; // check_failed (and any non-create state)
}
