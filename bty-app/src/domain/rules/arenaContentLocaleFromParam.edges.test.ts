import { describe, it, expect } from "vitest";
import { arenaContentLocaleFromParam } from "./arenaContentLocaleFromParam";

describe("arenaContentLocaleFromParam (edges)", () => {
  it("returns ko when param is exactly 'ko'", () => {
    expect(arenaContentLocaleFromParam("ko")).toBe("ko");
  });

  it("returns en for null, undefined, empty, or non-ko", () => {
    expect(arenaContentLocaleFromParam(null)).toBe("en");
    expect(arenaContentLocaleFromParam(undefined)).toBe("en");
    expect(arenaContentLocaleFromParam("")).toBe("en");
    expect(arenaContentLocaleFromParam("en")).toBe("en");
    expect(arenaContentLocaleFromParam("KO")).toBe("en");
    expect(arenaContentLocaleFromParam("ja")).toBe("en");
  });
});
