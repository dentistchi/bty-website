/** @vitest-environment jsdom */
import { describe, it, expect, vi, afterEach } from "vitest";
import { useEffect } from "react";
import { render, screen, waitFor, cleanup } from "@testing-library/react";

// Stub the real IFrame player with a component that immediately fires a client-
// identity error (153) — proving the client preserves the raw code and locks.
vi.mock("./YouTubePlayer", () => ({
  YouTubePlayer: ({ onError }: { onError?: (k: string, code: number) => void }) => {
    useEffect(() => {
      onError?.("client_identity_missing", 153);
    }, [onError]);
    return <div data-testid="yt-stub" />;
  },
}));

import FoundryJoinClient from "./FoundryJoinClient";

const WATCH = {
  event: { title: "T", status: "open" },
  participant: { display_name: "S" },
  training: { youtube_video_id: "dQw4w9WgXcQ", completion_prompt: null },
  stage: "watch",
  xp_status: "none",
};

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("FoundryJoinClient — player error keeps the response locked (no completion/XP)", () => {
  it("shows the calm error surface and never calls video-complete", async () => {
    const calls: string[] = [];
    const fetchMock = vi.fn(async (url: string) => {
      calls.push(url);
      return { ok: true, status: 200, json: async () => WATCH };
    });
    // @ts-expect-error test shim
    global.fetch = fetchMock;

    render(<FoundryJoinClient token="tok" />);

    // The player error surface appears with the RAW code preserved as a reference...
    expect(await screen.findByText(/THIS VIDEO CAN.?T PLAY HERE/i)).toBeTruthy();
    expect(screen.getByText(/let the host know/i)).toBeTruthy();
    expect(screen.getByText(/Reference:\s*YT-153/)).toBeTruthy();

    // ...and NO completion/XP request was ever made (response stays locked).
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(calls.some((u) => u.includes("/progress/video-complete"))).toBe(false);
    expect(calls.some((u) => u.includes("/progress/complete"))).toBe(false);
    expect(calls.some((u) => u.includes("/progress/claim-xp"))).toBe(false);
  });
});
