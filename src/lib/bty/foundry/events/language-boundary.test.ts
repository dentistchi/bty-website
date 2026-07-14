import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Product-language boundary (§8): YouTube `ENDED` is a PLAYER completion signal,
 * not verified comprehension. Foundry training copy must never overstate that —
 * no "verified learning / verified comprehension / certified viewing / fully
 * watched". Allowed framing is "video complete" / "training complete". This test
 * scans the real employee + manager copy so a future edit can't reintroduce it.
 */
const ROOT = join(__dirname, "..", "..", "..", ".."); // -> src/
const SCANNED = [
  "app/f/[token]/FoundryJoinClient.tsx",
  "app/f/[token]/YouTubePlayer.tsx",
  "components/foundry/event-rooms/copy.ts",
  "app/api/bty/foundry/public/[token]/progress/video-complete/route.ts",
];

const FORBIDDEN = [
  "verified learning",
  "verified comprehension",
  "certified viewing",
  "fully watched",
  "comprehension verified",
  "certificate",
];

describe("Foundry training language boundary", () => {
  for (const rel of SCANNED) {
    it(`${rel} contains no over-claiming completion language`, () => {
      const src = readFileSync(join(ROOT, rel), "utf8").toLowerCase();
      for (const phrase of FORBIDDEN) {
        expect(src, `"${phrase}" must not appear in ${rel}`).not.toContain(phrase);
      }
    });
  }

  it("the video-complete route documents ENDED as a player signal, not comprehension", () => {
    const src = readFileSync(
      join(ROOT, "app/api/bty/foundry/public/[token]/progress/video-complete/route.ts"),
      "utf8",
    );
    expect(src).toMatch(/ENDED/);
    expect(src.toLowerCase()).toMatch(/no xp|unlocks the response|not.*comprehension|player/);
  });
});
