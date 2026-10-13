import { afterEach, describe, expect, it, vi } from "vitest";

/**
 * Issue #64 — Teams iPhone: the native recorder opens, recording works, and the error appears only
 * after Save. Every stage after Save must be told apart, and none of them is "the microphone didn't
 * start".
 */

type Cb = (error: { errorCode?: number } | null, files: unknown[]) => void;
let selectImpl: (inputs: unknown, cb: Cb) => void = () => undefined;
vi.mock("@microsoft/teams-js", () => ({
  media: {
    MediaType: { Audio: 4 },
    selectMedia: (inputs: unknown, cb: Cb) => selectImpl(inputs, cb),
  },
}));

import { CaptureError, decodeBase64Clip, formatCaptureDiagnostic, recordWithTeams } from "./voiceCapture";
// The REAL TeamsJS 2.55 validator that Media.getMedia() runs before transferring anything. The
// internal module ships no type declarations; @ts-expect-error fails loudly if TeamsJS ever adds them.
// @ts-expect-error TS7016 — untyped internal TeamsJS module, imported only to pin the SDK contract
import { validateGetMediaInputs as untypedValidateGetMediaInputs } from "@microsoft/teams-js/dist/esm/packages/teams-js/src/internal/mediaUtil.js";
const validateGetMediaInputs = untypedValidateGetMediaInputs as (mimeType?: string, format?: string, content?: string) => boolean;

afterEach(() => {
  selectImpl = () => undefined;
});

const AUDIO_B64 = Buffer.from(new Uint8Array(4096).map((_, i) => i % 251)).toString("base64");

async function failure(): Promise<CaptureError> {
  try {
    await recordWithTeams(1);
  } catch (e) {
    if (e instanceof CaptureError) return e;
    throw e;
  }
  throw new Error("expected a CaptureError");
}

describe("[#64] the SDK contract the fix rests on", () => {
  it("TeamsJS getMedia() accepts only format 'id' — an inline (base64) audio attachment is rejected before any transfer", () => {
    expect(validateGetMediaInputs("audio/mp4", "id", "file-id-1")).toBe(true);
    expect(validateGetMediaInputs("audio/mp4", "base64", AUDIO_B64)).toBe(false); // → 4000 INVALID_ARGUMENTS
    expect(validateGetMediaInputs(undefined, "id", "file-id-1")).toBe(false);
    expect(validateGetMediaInputs("audio/mp4", "id", undefined)).toBe(false);
  });
});

describe("[#64] inline audio after Save is read from the attachment, never sent to getMedia()", () => {
  it("decodes a base64 attachment's content into an audio Blob of the declared type", async () => {
    const getMedia = vi.fn();
    selectImpl = (_i, cb) => cb(null, [{ format: "base64", mimeType: "audio/mp4", content: AUDIO_B64, preview: "", getMedia }]);
    const blob = await recordWithTeams(1);
    expect(blob.type).toBe("audio/mp4");
    expect(blob.size).toBe(4096);
    expect(getMedia).not.toHaveBeenCalled();
  });

  it("falls back to the preview when content is empty (Microsoft's audio sample reads the preview)", async () => {
    selectImpl = (_i, cb) => cb(null, [{ format: "base64", mimeType: "audio/x-m4a", content: "", preview: AUDIO_B64 }]);
    const blob = await recordWithTeams(1);
    expect(blob.size).toBe(4096);
    expect(blob.type).toBe("audio/x-m4a");
  });

  it("an inline attachment with no usable data is no_audio at blob_validation — with its shape, never its data", async () => {
    selectImpl = (_i, cb) => cb(null, [{ format: "base64", mimeType: "audio/mp4", content: "%%%not-base64%%%", preview: "" }]);
    const e = await failure();
    expect(e.kind).toBe("no_audio");
    expect(e.diagnostic).toMatchObject({ stage: "blob_validation", format: "base64", hasContent: true, hasPreview: false, blobSize: 0 });
  });
});

describe("[#64] a format 'id' attachment still goes through getMedia(), stage by stage", () => {
  it("success: the Blob is returned, typed from the attachment when the host leaves it untyped", async () => {
    selectImpl = (_i, cb) => cb(null, [{ format: "id", mimeType: "audio/mp4", content: "file-1", getMedia: (done: (e: null, b: Blob) => void) => done(null, new Blob([new Uint8Array(2048)])) }]);
    const blob = await recordWithTeams(1);
    expect(blob.size).toBe(2048);
    expect(blob.type).toBe("audio/mp4");
  });

  it("getMedia callback error → handoff_failed at get_media_callback, with the SDK code", async () => {
    selectImpl = (_i, cb) => cb(null, [{ format: "id", mimeType: "audio/mp4", content: "file-1", getMedia: (done: (e: { errorCode: number }, b: Blob) => void) => done({ errorCode: 4000 }, new Blob()) }]);
    const e = await failure();
    expect(e.kind).toBe("handoff_failed");
    expect(e.diagnostic).toMatchObject({ stage: "get_media_callback", sdkErrorCode: 4000, format: "id", attachmentCount: 1 });
  });

  it("getMedia throwing → handoff_failed at get_media_invocation", async () => {
    selectImpl = (_i, cb) => cb(null, [{ format: "id", mimeType: "audio/mp4", content: "file-1", getMedia: () => { throw new Error("boom"); } }]);
    const e = await failure();
    expect(e.kind).toBe("handoff_failed");
    expect(e.diagnostic).toMatchObject({ stage: "get_media_invocation", errorName: "Error" });
  });

  it("a plain-object attachment without getMedia → handoff_failed at get_media_invocation (TypeError)", async () => {
    selectImpl = (_i, cb) => cb(null, [{ format: "id", mimeType: "audio/mp4", content: "file-1" }]);
    const e = await failure();
    expect(e.diagnostic).toMatchObject({ stage: "get_media_invocation", errorName: "TypeError" });
  });

  it("an empty Blob → no_audio at blob_validation", async () => {
    selectImpl = (_i, cb) => cb(null, [{ format: "id", mimeType: "audio/mp4", content: "file-1", getMedia: (done: (e: null, b: Blob) => void) => done(null, new Blob()) }]);
    const e = await failure();
    expect(e.kind).toBe("no_audio");
    expect(e.diagnostic).toMatchObject({ stage: "blob_validation", blobSize: 0 });
  });
});

describe("[#64] selectMedia after Save", () => {
  it.each([
    [500, "handoff_failed"],
    [4000, "handoff_failed"],
    [10000, "handoff_failed"],
    [1000, "permission_denied"],
    [8000, "cancelled"],
    [100, "unsupported"],
  ])("callback error %i → %s at select_media_callback", async (code, kind) => {
    selectImpl = (_i, cb) => cb({ errorCode: code }, []);
    const e = await failure();
    expect(e.kind).toBe(kind);
    expect(e.diagnostic).toMatchObject({ stage: "select_media_callback", sdkErrorCode: code, attachmentCount: 0 });
  });

  it("no attachment → cancelled", async () => {
    selectImpl = (_i, cb) => cb(null, []);
    expect((await failure()).kind).toBe("cancelled");
  });

  it("selectMedia throwing synchronously → failed at select_media_call (the recorder never opened)", async () => {
    selectImpl = () => {
      throw new Error("not initialized");
    };
    const e = await failure();
    expect(e.kind).toBe("failed");
    expect(e.diagnostic).toMatchObject({ stage: "select_media_call", errorName: "Error" });
  });

  it("asks Teams for exactly one audio clip", async () => {
    const seen: unknown[] = [];
    selectImpl = (inputs, cb) => {
      seen.push(inputs);
      cb(null, []);
    };
    await failure();
    expect(seen[0]).toEqual({ mediaType: 4, maxMediaCount: 1, audioProps: { maxDuration: 1 } });
  });
});

describe("[#64] the diagnostic line carries no audio, text or identity", () => {
  it("is codes and shapes only — attachment data never appears, and unsafe values are dropped", () => {
    const line = formatCaptureDiagnostic({
      stage: "get_media_callback",
      sdkErrorCode: 4000,
      errorName: "Error with spaces and secrets sk-abc",
      attachmentCount: 1,
      format: "base64",
      mimeType: "audio/mp4",
      hasContent: true,
      hasPreview: false,
      blobSize: 0,
    });
    expect(line).toBe("AIP-VOICE get_media_callback code=4000 n=1 fmt=base64 mime=audio/mp4 content=y preview=n bytes=0");
    expect(line).not.toContain(AUDIO_B64.slice(0, 20));
  });

  it("decodeBase64Clip refuses non-base64 and accepts a data: URL", () => {
    expect(decodeBase64Clip("not base64!", "audio/mp4")).toBeNull();
    expect(decodeBase64Clip(42, "audio/mp4")).toBeNull();
    expect(decodeBase64Clip(`data:audio/mp4;base64,${AUDIO_B64}`, "audio/mp4")?.size).toBe(4096);
  });
});
