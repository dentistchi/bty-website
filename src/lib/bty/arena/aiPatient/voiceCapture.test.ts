import { describe, expect, it } from "vitest";
import { browserErrorKind, pickRecorderMime, teamsErrorKind } from "./voiceCapture";

describe("[AI patient] voice capture failures are told apart", () => {
  it("maps browser microphone errors to what the learner can do", () => {
    expect(browserErrorKind("NotAllowedError")).toBe("permission_denied");
    expect(browserErrorKind("SecurityError")).toBe("permission_denied"); // Permissions-Policy block
    expect(browserErrorKind("NotSupportedError")).toBe("unsupported");
    expect(browserErrorKind("NotFoundError")).toBe("no_audio");
    expect(browserErrorKind("NotReadableError")).toBe("failed"); // device busy: worth a retry
    expect(browserErrorKind(undefined)).toBe("failed");
  });

  it("maps the documented Teams SDK error codes", () => {
    expect(teamsErrorKind(1000)).toBe("permission_denied");
    expect(teamsErrorKind(8000)).toBe("cancelled");
    expect(teamsErrorKind(100)).toBe("unsupported");
    expect(teamsErrorKind(9000)).toBe("unsupported");
    expect(teamsErrorKind(500)).toBe("failed");
  });

  it("prefers a format the transcription provider accepts, and tolerates a throwing probe", () => {
    expect(pickRecorderMime((t) => t === "audio/mp4")).toBe("audio/mp4"); // iOS WebKit
    expect(pickRecorderMime((t) => t.startsWith("audio/webm"))).toBe("audio/webm;codecs=opus");
    expect(pickRecorderMime(() => { throw new Error("no"); })).toBe("");
  });
});
