import { describe, it, expect, afterEach } from "vitest";
import {
  resolveYoutubeEmbeddable,
  embedCheckAllowsCreate,
  embedCheckReason,
} from "./youtubeEmbed";

const savedKey = process.env.YOUTUBE_API_KEY;
const savedEnv = process.env.BTY_ENV;
afterEach(() => {
  if (savedKey === undefined) delete process.env.YOUTUBE_API_KEY;
  else process.env.YOUTUBE_API_KEY = savedKey;
  if (savedEnv === undefined) delete process.env.BTY_ENV;
  else process.env.BTY_ENV = savedEnv;
});

function fakeFetch(status: number, body: unknown): typeof fetch {
  return (async () => ({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  })) as unknown as typeof fetch;
}

const item = (embeddable: boolean) => ({ items: [{ status: { embeddable } }] });

describe("resolveYoutubeEmbeddable", () => {
  it("returns embeddable when status.embeddable is true", async () => {
    process.env.YOUTUBE_API_KEY = "k";
    expect(await resolveYoutubeEmbeddable("vid", fakeFetch(200, item(true)))).toBe("embeddable");
  });

  it("returns not_embeddable when status.embeddable is false", async () => {
    process.env.YOUTUBE_API_KEY = "k";
    expect(await resolveYoutubeEmbeddable("vid", fakeFetch(200, item(false)))).toBe("not_embeddable");
  });

  it("returns not_found when items is empty (missing/removed video)", async () => {
    process.env.YOUTUBE_API_KEY = "k";
    expect(await resolveYoutubeEmbeddable("vid", fakeFetch(200, { items: [] }))).toBe("not_found");
  });

  it("returns check_failed on a non-200 API response (quota/bad key)", async () => {
    process.env.YOUTUBE_API_KEY = "k";
    expect(await resolveYoutubeEmbeddable("vid", fakeFetch(403, { error: {} }))).toBe("check_failed");
  });

  it("returns check_failed when the request throws", async () => {
    process.env.YOUTUBE_API_KEY = "k";
    const throwing = (async () => {
      throw new Error("network");
    }) as unknown as typeof fetch;
    expect(await resolveYoutubeEmbeddable("vid", throwing)).toBe("check_failed");
  });

  it("no key in prod/staging → check_failed (fail closed, never create unverified)", async () => {
    delete process.env.YOUTUBE_API_KEY;
    process.env.BTY_ENV = "staging";
    expect(await resolveYoutubeEmbeddable("vid")).toBe("check_failed");
  });

  it("no key in local/test → unconfigured (skip check so dev works)", async () => {
    delete process.env.YOUTUBE_API_KEY;
    delete process.env.BTY_ENV;
    expect(await resolveYoutubeEmbeddable("vid")).toBe("unconfigured");
  });
});

describe("embedCheckAllowsCreate / embedCheckReason", () => {
  it("only embeddable and unconfigured allow create", () => {
    expect(embedCheckAllowsCreate("embeddable")).toBe(true);
    expect(embedCheckAllowsCreate("unconfigured")).toBe(true);
    expect(embedCheckAllowsCreate("not_embeddable")).toBe(false);
    expect(embedCheckAllowsCreate("not_found")).toBe(false);
    expect(embedCheckAllowsCreate("check_failed")).toBe(false);
  });

  it("maps blocking states to field reasons", () => {
    expect(embedCheckReason("not_embeddable")).toBe("video_not_embeddable");
    expect(embedCheckReason("not_found")).toBe("video_not_found");
    expect(embedCheckReason("check_failed")).toBe("youtube_check_failed");
  });
});
