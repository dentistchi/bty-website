/** @vitest-environment jsdom */
import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import EventCreateClient from "./EventCreateClient";

/**
 * THE EVENT-CREATE SCREEN, READ AS KOREAN.
 *
 * The Learn landing closed with "이벤트 만들기 / 내가 만든 이벤트", Founder-verified. The screen
 * that door OPENS still said "이벤트 열기" over "팀이 참여할 실제 순간을 여세요" — a
 * different verb from the door that led there, and the same translated phrase the landing pass
 * removed. It also called its own QR a "리얼리티 이벤트 QR 코드", which is the internal
 * name for this product, in the accessible label a screen reader announces.
 *
 * MEASURED, not assumed, before a word moved:
 *   - `POST /api/bty/events` inserts one `bty_events` row and returns a signed `btyev1` token as
 *     `/{locale}/bty/events/scan?ev=...`.
 *   - That URL is rendered ONLY as a QR. There is no share-link control here, and none on the
 *     Host detail screen either — so the copy does not promise link participation. QR is the
 *     whole join story, and it is what the copy says.
 *   - This is NOT the Foundry quick training room: that one takes a video or a document and
 *     creates a training, and the landing pass already stopped it borrowing the word "이벤트".
 *
 * KO ONLY. English, the API call, the QR payload, validation and navigation are untouched.
 */

const SOURCE = readFileSync(join(process.cwd(), "src/components/bty/events/EventCreateClient.tsx"), "utf8");
const ko = () => {
  render(<EventCreateClient locale="ko" />);
  return document.body.textContent ?? "";
};

afterEach(() => cleanup());

describe("[KO event create T1-T3] no translated or internal language", () => {
  it("T1 no 실제 순간", () => {
    expect(ko()).not.toContain("실제 순간");
    expect(SOURCE).not.toContain("팀이 참여할 실제 순간을 여세요.");
  });

  it("T2 no 리얼리티 이벤트 anywhere in the KO strings, including the QR aria label", () => {
    const koBlock = SOURCE.slice(SOURCE.indexOf("  ko: {"), SOURCE.indexOf("type CreatedEvent"));
    expect(koBlock).not.toContain("리얼리티");
  });

  it("T3 no architecture terminology in Korean", () => {
    const text = ko();
    for (const term of ["Room", "룸", "세션", "Foundry", "파운드리", "모듈", "생성되었"]) {
      expect(text, term).not.toContain(term);
    }
  });
});

describe("[KO event create T4-T5] it agrees with the door that opened it", () => {
  it("T4 the heading and submit use the landing's verb", () => {
    const text = ko();
    expect(text).toContain("이벤트 만들기");
    // The retired verb pair is gone from the KO strings.
    const koBlock = SOURCE.slice(SOURCE.indexOf("  ko: {"), SOURCE.indexOf("type CreatedEvent"));
    expect(koBlock).not.toContain('heading: "이벤트 열기"');
    expect(koBlock).not.toContain('submit: "이벤트 열기"');
  });

  it("T5 the intro says who joins and how, which the title does not", () => {
    const text = ko();
    expect(text).toContain("QR");
    expect(text).toContain("참여");
    // No link participation is promised, because no share control exists on this surface.
    expect(text).not.toContain("링크");
  });
});

describe("[KO event create T6-T9] success state, English, behaviour, length", () => {
  it("T6 the success copy says what happened and what to do next", () => {
    const koBlock = SOURCE.slice(SOURCE.indexOf("  ko: {"), SOURCE.indexOf("type CreatedEvent"));
    expect(koBlock).toContain('createdHeading: "이벤트가 만들어졌습니다"');
    expect(koBlock).toContain("이 QR 코드를 보여주세요");
    // Founder micro-repair: the device read "찍어/찍으면" as clipped; the KO surface says
    // "QR 코드" and "스캔" throughout, so the two sentences match each other and the object.
    expect(koBlock).toContain("스캔하면 참여가 기록됩니다");
    expect(koBlock).not.toContain("찍으면");
    expect(koBlock).not.toContain("찍어 참여");
    expect(koBlock).toContain("내가 만든 이벤트 보기");
    expect(koBlock).not.toContain("준비됨");
  });

  it("T7 English is byte-identical", () => {
    render(<EventCreateClient locale="en" />);
    const en = document.body.textContent ?? "";
    expect(en).toContain("Open an event");
    expect(en).toContain("Open a real moment for your team to participate in.");
    expect(en).toContain("Event name");
    const enBlock = SOURCE.slice(SOURCE.indexOf("  en: {"), SOURCE.indexOf("  ko: {"));
    expect(enBlock).toContain('qrAria: "Reality Event QR code"');
    expect(enBlock).toContain('createdHeading: "Event ready"');
    expect(enBlock).toContain('submit: "Open event"');
  });

  it("T8 the API call, QR payload and validation are untouched", () => {
    for (const anchor of [
      "/api/bty/events?locale=",
      "QRCodeSVG",
      'setErrorReason("title_required")',
      'setErrorReason("event_type_required")',
      'setErrorReason("xp_value_invalid")',
      'data-testid="event-create-another"',
    ]) {
      expect(SOURCE, anchor).toContain(anchor);
    }
  });

  it("T9 every KO line is short enough for a phone", () => {
    const koBlock = SOURCE.slice(SOURCE.indexOf("  ko: {"), SOURCE.indexOf("type CreatedEvent"));
      for (const m of koBlock.matchAll(new RegExp(String.fromCharCode(34) + "([^" + String.fromCharCode(34) + "]{2,})" + String.fromCharCode(34), "g"))) {
      expect(m[1].length, m[1]).toBeLessThanOrEqual(42);
    }
  });
});

void vi;
