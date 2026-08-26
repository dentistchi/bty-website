import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * THE CLAIM INPUT MUST NOT ZOOM THE APP — iOS auto-zoom repair.
 *
 * FOUNDER DEVICE, iPhone / Capacitor WKWebView. Tapping 완료 코드 zoomed the whole app, and it
 * STAYED zoomed after submitting — the only way back was force-quitting. The claim flow itself was
 * working: the completion reached Learning History and replaying the consumed code refused
 * correctly. This is the surface around it.
 *
 * MEASURED CAUSE, not guessed. iOS zooms a focused form control whose font-size is under 16px.
 * The input carried `text-sm`, and the shipped stylesheet resolves that to `font-size:.875rem` —
 * 14px. The app's viewport is `width=device-width, initial-scale=1, viewport-fit=cover` with NO
 * `maximum-scale` and NO `user-scalable=no`, so nothing was suppressing zoom; iOS was doing
 * exactly what it does to a small field.
 *
 * THE FIX IS THE FIELD, NOT THE VIEWPORT. Adding `maximum-scale=1` or `user-scalable=no` would
 * also stop the zoom — by taking pinch-zoom away from everyone, on every screen, permanently.
 * That trades an annoyance for an accessibility regression. Raising one input to 16px costs
 * nothing and leaves user zoom intact, which is why the tests below assert BOTH halves: the field
 * is big enough, and the viewport is still free.
 */

const read = (p: string) => readFileSync(join(process.cwd(), p), "utf8");
const SRC = read("src/components/foundry/event-rooms/FoundryMyLearning.tsx");
const LAYOUT = read("src/app/layout.tsx");

/** The className of the claim-code input, taken from the element itself. */
const inputClass = (): string => {
  const at = SRC.indexOf('data-testid="my-learning-claim-input"');
  expect(at, "the claim input should exist").toBeGreaterThan(-1);
  const after = SRC.slice(at);
  const m = after.match(/className="([^"]*)"/);
  return m?.[1] ?? "";
};

describe("[claim input zoom · T1-T3] the field is large enough, and zoom stays available", () => {
  it("T1 the claim-code input is at least 16px", () => {
    // `text-base` is Tailwind's 1rem = 16px, the smallest class that clears the iOS threshold.
    expect(inputClass()).toContain("text-base");
  });

  it("T2 it carries no sub-16px text size", () => {
    const cls = inputClass();
    for (const small of ["text-sm", "text-xs", "text-[0.", "text-[1[0-5]px]"]) {
      expect(cls, small).not.toContain(small);
    }
    // And the stylesheet's own numbers are what this rests on.
    expect(inputClass()).not.toMatch(/text-\[(?:[0-9]|1[0-5])px\]/);
  });

  it("T3 the viewport still permits user zoom", () => {
    /*
      The cheap way to stop iOS zooming is to forbid zooming. That is an accessibility regression
      for every screen in the app, so it must never appear.
    */
    expect(LAYOUT).not.toContain("maximumScale");
    expect(LAYOUT).not.toContain("userScalable");
    expect(LAYOUT).not.toContain("maximum-scale");
    expect(LAYOUT).not.toContain("user-scalable");
    // The intended viewport is unchanged.
    expect(LAYOUT).toContain('width: "device-width"');
    expect(LAYOUT).toContain("initialScale: 1");
    expect(LAYOUT).toContain('viewportFit: "cover"');
  });
});

describe("[claim input zoom · T4-T8] nothing about the claim flow moved", () => {
  it("T4 the input and the CTA are both still there", () => {
    expect(SRC).toContain('data-testid="my-learning-claim-input"');
    expect(SRC).toContain('data-testid="my-learning-claim-submit"');
    expect(SRC).toContain("{claimState === \"working\" ? t.claimWorking : t.claimCta}");
  });

  it("T5/T7 the copy is untouched, in both languages", () => {
    for (const s of [
      "완료한 학습 가져오기",
      "로그인 없이 학습을 마치셨나요? 그때 받은 완료 코드를 입력하세요.",
      "완료 코드",
      "가져오기",
      "학습을 내 계정에 연결했습니다.",
      "코드가 맞지 않습니다. 다시 확인해 주세요.",
      "Add a training you finished",
      "Completion code",
      "Add it",
      "Added to your account.",
      "That code did not work. Check it and submit it again.",
    ]) {
      expect(SRC, s).toContain(s);
    }
  });

  it("T6 submission and refusal behaviour is unchanged", () => {
    expect(SRC).toContain('"/api/bty/foundry/completion-claim"');
    expect(SRC).toContain('setClaimState("bad")');
    expect(SRC).toContain('setClaimState("done")');
    expect(SRC).toContain("await load();");
    // The input still normalises nothing client-side — the server owns that.
    expect(SRC).not.toContain("normalizeClaimCode");
  });

  it("T8 the row still shrinks rather than overflowing", () => {
    /*
      A wider font in a fixed row is how horizontal overflow starts. The input keeps `min-w-0` and
      `flex-1` so it absorbs the change, and the button keeps `shrink-0` so it is never squashed.
      Real pixel measurement lives in the viewport harnesses; this holds the layout contract that
      makes overflow impossible in the first place.
    */
    const cls = inputClass();
    expect(cls).toContain("min-w-0");
    expect(cls).toContain("flex-1");
    const at = SRC.indexOf('data-testid="my-learning-claim-submit"');
    const btn = SRC.slice(at).match(/className="([^"]*)"/)?.[1] ?? "";
    expect(btn).toContain("shrink-0");
  });
});
