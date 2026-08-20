import { describe, it, expect, afterEach, vi } from "vitest";
import {
  LOCALE_COOKIE,
  LOCALE_COOKIE_MAX_AGE_SECONDS,
  isSavedLocale,
  readSavedLocale,
} from "./localePreference";

/**
 * R4-R4B-R1N-R1 — A LANGUAGE CHOICE MUST SURVIVE A RESTART.
 *
 * `LangSwitch` swapped the path prefix and persisted nothing, which works exactly as long as the
 * tab lives. The native shell relaunches at the locale-neutral `/start`, so the choice died with
 * the WebView and every cold launch opened in English — even on a Korean device with Korean
 * selected, which is what proved nothing was being consulted rather than the wrong thing winning.
 *
 * `NEXT_LOCALE` already existed as what `middleware.ts` calls "the single entry resolver", and
 * already outranked `Accept-Language` there. It simply had zero writers. These tests pin the
 * writer and reader as one definition so they cannot drift.
 */

afterEach(() => vi.restoreAllMocks());

describe("R4-R4B-R1N-R1 · 1/2/5 · only a real preference is a preference", () => {
  it("1/2 — the two product languages are accepted", () => {
    expect(isSavedLocale("en")).toBe(true);
    expect(isSavedLocale("ko")).toBe(true);
  });

  it("5 — anything else is not a preference, and is ignored rather than guessed at", () => {
    for (const junk of ["EN", "ko-KR", "kr", "", " ", "fr", null, undefined, 1, {}, "en;ko"]) {
      expect(isSavedLocale(junk), `${String(junk)} must not be accepted`).toBe(false);
    }
  });

  it("5 — a malformed cookie value reads as no preference, never as a fallback language", () => {
    expect(readSavedLocale("NEXT_LOCALE=kr")).toBeNull();
    expect(readSavedLocale("NEXT_LOCALE=")).toBeNull();
    expect(readSavedLocale("NEXT_LOCALE=EN")).toBeNull();
    // Returning "en" here would be indistinguishable from an explicit English choice.
  });
});

describe("R4-R4B-R1N-R1 · the reader finds it among real cookies", () => {
  it("reads the value wherever it sits in the string", () => {
    expect(readSavedLocale("NEXT_LOCALE=ko")).toBe("ko");
    expect(readSavedLocale("a=1; NEXT_LOCALE=ko; b=2")).toBe("ko");
    expect(readSavedLocale("  NEXT_LOCALE=en  ")).toBe("en");
    expect(readSavedLocale("b=2; NEXT_LOCALE=en")).toBe("en");
  });

  it("is not fooled by a cookie whose NAME merely contains the key", () => {
    // `sb-NEXT_LOCALE` or `NEXT_LOCALE_OLD` must not be mistaken for the preference.
    expect(readSavedLocale("MY_NEXT_LOCALE=ko")).toBeNull();
    expect(readSavedLocale("NEXT_LOCALE_OLD=ko")).toBeNull();
  });

  it("6 — no cookie means NO preference, so first-use resolution is left alone", () => {
    expect(readSavedLocale("")).toBeNull();
    expect(readSavedLocale(null)).toBeNull();
    expect(readSavedLocale(undefined)).toBeNull();
    expect(readSavedLocale("other=1; another=2")).toBeNull();
  });

  it("a url-encoded value still reads", () => {
    expect(readSavedLocale(`${LOCALE_COOKIE}=${encodeURIComponent("ko")}`)).toBe("ko");
  });
});

/*
  The cookie ATTRIBUTES are asserted against the live route in
  `src/app/api/locale/set/route.test.ts` — the server is the only writer, so that is where the
  shape is verified rather than against a client helper that no longer exists.
*/
describe("R4-R4B-R1N-R1-R1 · the lifetime constant is a year", () => {
  it("a language choice outlives everything else in the app", () => {
    expect(LOCALE_COOKIE_MAX_AGE_SECONDS).toBe(60 * 60 * 24 * 365);
    expect(LOCALE_COOKIE).toBe("NEXT_LOCALE");
  });
});
