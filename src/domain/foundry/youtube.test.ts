import { describe, it, expect } from "vitest";
import {
  parseYoutubeVideoId,
  youtubeWatchUrl,
  youtubeThumbnailUrl,
  classifyYoutubePlayerError,
  foundryPlayerVars,
} from "./youtube";

const ID = "dQw4w9WgXcQ"; // canonical 11-char sample

describe("parseYoutubeVideoId", () => {
  it("accepts a bare 11-char id", () => {
    expect(parseYoutubeVideoId(ID)).toBe(ID);
  });

  it("parses a standard watch URL", () => {
    expect(parseYoutubeVideoId(`https://www.youtube.com/watch?v=${ID}`)).toBe(ID);
  });

  it("parses a watch URL with extra params", () => {
    expect(parseYoutubeVideoId(`https://youtube.com/watch?v=${ID}&t=42s&list=abc`)).toBe(ID);
  });

  it("parses youtu.be short links", () => {
    expect(parseYoutubeVideoId(`https://youtu.be/${ID}`)).toBe(ID);
    expect(parseYoutubeVideoId(`https://youtu.be/${ID}?t=10`)).toBe(ID);
  });

  it("parses /embed/, /shorts/, /v/ forms", () => {
    expect(parseYoutubeVideoId(`https://www.youtube.com/embed/${ID}`)).toBe(ID);
    expect(parseYoutubeVideoId(`https://www.youtube.com/shorts/${ID}`)).toBe(ID);
    expect(parseYoutubeVideoId(`https://www.youtube.com/v/${ID}`)).toBe(ID);
  });

  it("parses m. and music. hosts", () => {
    expect(parseYoutubeVideoId(`https://m.youtube.com/watch?v=${ID}`)).toBe(ID);
    expect(parseYoutubeVideoId(`https://music.youtube.com/watch?v=${ID}`)).toBe(ID);
  });

  it("trims surrounding whitespace", () => {
    expect(parseYoutubeVideoId(`   https://youtu.be/${ID}   `)).toBe(ID);
  });

  it("rejects non-YouTube hosts", () => {
    expect(parseYoutubeVideoId(`https://vimeo.com/${ID}`)).toBeNull();
    expect(parseYoutubeVideoId(`https://evil.com/watch?v=${ID}`)).toBeNull();
    expect(parseYoutubeVideoId(`https://notyoutube.com/watch?v=${ID}`)).toBeNull();
  });

  it("rejects malformed / short ids", () => {
    expect(parseYoutubeVideoId("https://www.youtube.com/watch?v=short")).toBeNull();
    expect(parseYoutubeVideoId("https://youtu.be/tooooolongid123")).toBeNull();
    expect(parseYoutubeVideoId("abc")).toBeNull();
  });

  it("rejects non-http protocols and junk", () => {
    expect(parseYoutubeVideoId(`javascript:alert(1)//${ID}`)).toBeNull();
    expect(parseYoutubeVideoId("not a url")).toBeNull();
    expect(parseYoutubeVideoId("")).toBeNull();
    expect(parseYoutubeVideoId("   ")).toBeNull();
  });

  it("rejects non-strings", () => {
    expect(parseYoutubeVideoId(null)).toBeNull();
    expect(parseYoutubeVideoId(undefined)).toBeNull();
    expect(parseYoutubeVideoId(42)).toBeNull();
    expect(parseYoutubeVideoId({ v: ID })).toBeNull();
  });

  it("rejects a youtube host with no id", () => {
    expect(parseYoutubeVideoId("https://www.youtube.com/")).toBeNull();
    expect(parseYoutubeVideoId("https://www.youtube.com/feed/subscriptions")).toBeNull();
  });
});

describe("url helpers", () => {
  it("builds a watch URL", () => {
    expect(youtubeWatchUrl(ID)).toBe(`https://www.youtube.com/watch?v=${ID}`);
  });
  it("builds a keyless thumbnail URL", () => {
    expect(youtubeThumbnailUrl(ID)).toBe(`https://i.ytimg.com/vi/${ID}/hqdefault.jpg`);
  });
});

describe("classifyYoutubePlayerError", () => {
  it("101 and 150 → embedding_not_allowed (owner disabled embedding)", () => {
    expect(classifyYoutubePlayerError(101)).toBe("embedding_not_allowed");
    expect(classifyYoutubePlayerError(150)).toBe("embedding_not_allowed");
  });
  it("100 → video_unavailable", () => {
    expect(classifyYoutubePlayerError(100)).toBe("video_unavailable");
  });
  it("153 → client_identity_missing", () => {
    expect(classifyYoutubePlayerError(153)).toBe("client_identity_missing");
  });
  it("anything else → unknown", () => {
    expect(classifyYoutubePlayerError(2)).toBe("unknown");
    expect(classifyYoutubePlayerError(5)).toBe("unknown");
    expect(classifyYoutubePlayerError(undefined)).toBe("unknown");
  });
});

describe("foundryPlayerVars (identity fix for error 153)", () => {
  it("uses the passed origin verbatim (the caller's window.location.origin)", () => {
    const pv = foundryPlayerVars("https://bty-arena-staging.ywamer2022.workers.dev");
    expect(pv.origin).toBe("https://bty-arena-staging.ywamer2022.workers.dev");
    // no path / trailing slash beyond what was passed
    expect(String(pv.origin)).not.toMatch(/\/$/);
  });

  it("enables the JS API + inline iOS playback + keeps approved params", () => {
    const pv = foundryPlayerVars("https://x.example");
    expect(pv.enablejsapi).toBe(1);
    expect(pv.playsinline).toBe(1);
    expect(pv.rel).toBe(0);
    expect(pv.modestbranding).toBe(1);
  });

  it("does NOT hardcode localhost / staging / production hosts", () => {
    const pv = foundryPlayerVars("https://the-real-origin.example");
    const s = JSON.stringify(pv);
    expect(s).not.toMatch(/localhost/i);
    expect(s).not.toMatch(/workers\.dev/); // only appears if the caller passes it
    expect(pv.origin).toBe("https://the-real-origin.example");
  });
});
