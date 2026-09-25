import { describe, expect, it } from "vitest";
import {
  APP_INITIALIZE_TIMEOUT_MS,
  BOOT_STAGES,
  GET_AUTH_TOKEN_TIMEOUT_MS,
  MAX_BOOT_EVENTS,
  TOTAL_PRE_BOOTSTRAP_BUDGET_MS,
  platformClass,
  readBootTimeline,
  redactErrorClass,
} from "./bootDiagnostics";

/**
 * Slice B — the server does not trust the client.
 *
 * A boot timeline arrives from a pre-session browser, so every field is validated rather than
 * stored. These pin that, and pin the bound that keeps BTY's own failure ahead of the host's.
 */

const ID = "3f1a2b4c-5d6e-4f70-8123-456789abcdef";
const good = { bootAttemptId: ID, terminalStage: "app_initialize_timeout", events: [{ stage: "shell_start", elapsedMs: 0 }, { stage: "app_initialize_timeout", elapsedMs: 5001 }] };

describe("the bound stays under the host window", () => {
  it("is conservative and stated, not incidental", () => {
    expect(APP_INITIALIZE_TIMEOUT_MS).toBe(5_000);
    expect(GET_AUTH_TOKEN_TIMEOUT_MS).toBe(7_000);
    expect(TOTAL_PRE_BOOTSTRAP_BUDGET_MS).toBe(12_000);
    // Comfortably inside the smallest commonly-observed host tab-load window (~15s), so BTY's own
    // caught failure always wins the race and the learner gets a retry that can work.
    expect(TOTAL_PRE_BOOTSTRAP_BUDGET_MS).toBeLessThan(15_000);
  });
});

describe("readBootTimeline", () => {
  it("accepts a well-formed timeline", () => {
    expect(readBootTimeline(good)).toMatchObject({ bootAttemptId: ID, terminalStage: "app_initialize_timeout" });
  });

  it("refuses anything that is not a timeline", () => {
    for (const bad of [null, undefined, 42, "x", {}, { bootAttemptId: ID }]) {
      expect(readBootTimeline(bad), String(bad)).toBeNull();
    }
  });

  it("refuses a correlation id that is not uuid-shaped", () => {
    expect(readBootTimeline({ ...good, bootAttemptId: "../../etc/passwd" })).toBeNull();
    expect(readBootTimeline({ ...good, bootAttemptId: "short" })).toBeNull();
  });

  it("refuses an unknown terminal stage, and drops unknown event stages", () => {
    expect(readBootTimeline({ ...good, terminalStage: "made_up" })).toBeNull();
    const r = readBootTimeline({ ...good, events: [{ stage: "shell_start", elapsedMs: 0 }, { stage: "made_up", elapsedMs: 1 }] });
    expect(r?.events.map((e) => e.stage)).toEqual(["shell_start"]);
  });

  it("drops a non-finite elapsed rather than storing it", () => {
    const r = readBootTimeline({ ...good, events: [{ stage: "shell_start", elapsedMs: 0 }, { stage: "react_ready", elapsedMs: Number.POSITIVE_INFINITY }] });
    expect(r?.events).toHaveLength(1);
  });

  it("bounds the payload to the number of stages that exist", () => {
    const many = Array.from({ length: 500 }, () => ({ stage: "shell_start", elapsedMs: 1 }));
    expect(readBootTimeline({ ...good, events: many })?.events.length).toBeLessThanOrEqual(MAX_BOOT_EVENTS);
    expect(MAX_BOOT_EVENTS).toBe(BOOT_STAGES.length);
  });

  it("keeps only a symbolic error class, never a message", () => {
    const r = readBootTimeline({ ...good, events: [{ stage: "app_initialize_failure", elapsedMs: 1, errorClass: "TypeError" }] });
    expect(r?.events[0].errorClass).toBe("TypeError");
    const bad = readBootTimeline({ ...good, events: [{ stage: "app_initialize_failure", elapsedMs: 1, errorClass: "failed to fetch https://x/y?token=abc" }] });
    expect(bad?.events[0].errorClass).toBeUndefined();
  });

  it("keeps a build sha only when it is one, and a platform only when it is a class", () => {
    expect(readBootTimeline({ ...good, buildSha: "z".repeat(40) })?.buildSha).toBeNull();
    expect(readBootTimeline({ ...good, buildSha: "a".repeat(40) })?.buildSha).toBe("a".repeat(40));
    expect(readBootTimeline({ ...good, platform: "Mozilla/5.0 (iPhone…)" })?.platform).toBeNull();
    expect(readBootTimeline({ ...good, platform: "ios-teams" })?.platform).toBe("ios-teams");
  });

  it("ignores any extra key a client invents", () => {
    const r = readBootTimeline({ ...good, accessToken: "secret", email: "a@b.c" }) as Record<string, unknown>;
    expect(Object.keys(r).sort()).toEqual(["bootAttemptId", "buildSha", "events", "platform", "terminalStage"]);
  });
});

describe("redactErrorClass / platformClass", () => {
  it("reduces a thrown value to a short class and never its message", () => {
    expect(redactErrorClass(new TypeError("fetch https://x?token=abc failed"))).toBe("TypeError");
    expect(redactErrorClass("some free text with spaces")).toBe("UnknownError");
    expect(redactErrorClass({ name: "AbortError" })).toBe("AbortError");
    expect(redactErrorClass(null)).toBe("UnknownError");
  });

  it("classifies the runtime coarsely, never echoing the user agent", () => {
    expect(platformClass("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0) Teams/6.0")).toBe("ios-teams");
    expect(platformClass("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)")).toBe("macos");
    expect(platformClass(null)).toBe("unknown");
    expect(platformClass("x")).toBe("other");
  });
});
