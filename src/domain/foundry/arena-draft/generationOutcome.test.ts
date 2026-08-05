/**
 * GENERATION OUTCOME TAXONOMY (Slice 3.2I-R5B2-R5A).
 *
 * 3.2K-R4's finding, stated as tests: three materially different provider failures collapsed into
 * one code, so the mechanism of a real outage could not be named. These pin the vocabulary that
 * replaces it, and the two properties that make it safe to persist — a closed set, and no path by
 * which provider or prompt text can reach a stored field.
 */

import { describe, it, expect } from "vitest";
import {
  GENERATION_OUTCOMES,
  NON_ATTEMPT_OUTCOMES,
  PROVIDER_ERROR_CATEGORIES,
  categorizeHttpStatus,
  categorizeThrown,
  isUpstreamFailure,
  retriabilityOf,
  supportReference,
  type GenerationProductCode,
} from "./generationOutcome";

describe("[R5A] the collapsed code is gone and every mechanism is nameable", () => {
  it("names all twelve terminal outcomes, and generation_failed is not among them", () => {
    expect(GENERATION_OUTCOMES).toHaveLength(12);
    expect(GENERATION_OUTCOMES as readonly string[]).not.toContain("generation_failed");
  });

  it("separates the three failures R4 could not tell apart", () => {
    for (const c of ["provider_timeout", "provider_transport_error", "provider_empty_output"] as const) {
      expect(GENERATION_OUTCOMES).toContain(c);
    }
    expect(new Set(["provider_timeout", "provider_transport_error", "provider_empty_output"]).size).toBe(3);
  });

  it("keeps the two non-attempt outcomes OUT of the attempt vocabulary", () => {
    // Neither describes a generation. One means no attempt row could be created, so nothing was
    // spent; the other belongs to the browser alone.
    for (const c of NON_ATTEMPT_OUTCOMES) {
      expect(GENERATION_OUTCOMES as readonly string[]).not.toContain(c);
    }
    expect(NON_ATTEMPT_OUTCOMES).toEqual(["generation_observability_unavailable", "client_response_timeout"]);
  });

  it("every code has a retriability answer, and every answer is a real one", () => {
    const all: GenerationProductCode[] = [...GENERATION_OUTCOMES, ...NON_ATTEMPT_OUTCOMES];
    for (const c of all) expect(["true", "false", "unknown"]).toContain(retriabilityOf(c));
    // The point of the taxonomy is that they are not all the same answer.
    expect(new Set(all.map(retriabilityOf)).size).toBe(3);
  });

  it("does not promise a retry it cannot keep", () => {
    // R4's case. Whether a repeat finishes inside the deadline is genuinely unknown, and the
    // screen said "Please retry" anyway.
    expect(retriabilityOf("provider_timeout")).toBe("unknown");
    expect(retriabilityOf("client_response_timeout")).toBe("unknown");
    // Genuinely transient, or nothing was spent at all.
    expect(retriabilityOf("provider_transport_error")).toBe("true");
    expect(retriabilityOf("provider_http_error")).toBe("true");
    expect(retriabilityOf("generation_observability_unavailable")).toBe("true");
    expect(retriabilityOf("scenario_persistence_failed")).toBe("true");
  });

  it("distinguishes upstream faults from this product's own", () => {
    expect(isUpstreamFailure("provider_timeout")).toBe(true);
    expect(isUpstreamFailure("provider_http_error")).toBe(true);
    expect(isUpstreamFailure("scenario_persistence_failed")).toBe(false);
    expect(isUpstreamFailure("scenario_quality_rejected")).toBe(false);
    expect(isUpstreamFailure("internal_failure")).toBe(false);
  });
});

describe("[R5A] no provider or prompt text can reach a stored field", () => {
  it("an HTTP status becomes a category from a closed set — the body never travels", () => {
    expect(categorizeHttpStatus(429)).toBe("rate_limited");
    expect(categorizeHttpStatus(401)).toBe("unauthorized");
    expect(categorizeHttpStatus(403)).toBe("unauthorized");
    expect(categorizeHttpStatus(400)).toBe("bad_request");
    expect(categorizeHttpStatus(503)).toBe("server_error");
    for (const s of [100, 200, 301, 399]) expect(PROVIDER_ERROR_CATEGORIES).toContain(categorizeHttpStatus(s));
  });

  it("a thrown value becomes a category WITHOUT consulting its message", () => {
    // The message is the leak risk: an upstream error can quote the prompt back verbatim.
    const leak = new Error("prompt was: Never disclose a patient identifier before consent");
    expect(categorizeThrown(leak, false)).toBe("unknown");
    expect(PROVIDER_ERROR_CATEGORIES).toContain(categorizeThrown(leak, false));

    const abort = new Error("aborted");
    abort.name = "AbortError";
    expect(categorizeThrown(abort, false)).toBe("aborted");
    expect(categorizeThrown(new Error("x"), true)).toBe("aborted");

    const net = new TypeError("fetch failed");
    expect(categorizeThrown(net, false)).toBe("network");
  });

  it("every category output is a member of the closed vocabulary", () => {
    const thrown: unknown[] = [new Error("x"), new TypeError("y"), "a string", null, undefined, { message: "z" }, 42];
    for (const e of thrown) {
      for (const aborted of [true, false]) {
        expect(PROVIDER_ERROR_CATEGORIES).toContain(categorizeThrown(e, aborted));
      }
    }
  });
});

describe("[R5A] the support reference identifies without exposing", () => {
  it("is stable, short, hex, and not the attempt id", () => {
    const id = "3f0b0f4e-1c2d-4a5b-8e9f-0a1b2c3d4e5f";
    const ref = supportReference(id);
    expect(ref).toMatch(/^[0-9a-f]{12}$/);
    expect(ref).toBe(supportReference(id)); // stable
    expect(id).not.toContain(ref); // not a slice of the identifier
  });

  it("different attempts get different references", () => {
    const refs = new Set(
      ["a", "b", "c", "3f0b0f4e-1c2d-4a5b-8e9f-0a1b2c3d4e5f", "3f0b0f4e-1c2d-4a5b-8e9f-0a1b2c3d4e60"].map(supportReference),
    );
    expect(refs.size).toBe(5);
  });
});
