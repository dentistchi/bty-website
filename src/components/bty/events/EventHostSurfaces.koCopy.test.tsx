/** @vitest-environment jsdom */
import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, cleanup, waitFor } from "@testing-library/react";
import EventHostDetail from "./EventHostDetail";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * MY EVENTS AND ONE EVENT, READ AS KOREAN.
 *
 * The Learn landing and the create screen are both Founder-verified closed, on one vocabulary:
 * 이벤트 만들기 / 내가 만든 이벤트 / QR 코드 / 스캔 / 배우기. The two screens BEHIND them had not
 * moved: the list called itself "내 이벤트" over "내가 연 리얼리티 이벤트의 참여 현황입니다",
 * its empty state offered "이벤트 열기", both screens sent the Host back to "학습", and the
 * detail QR aria label still said "리얼리티 이벤트 QR 코드" — the internal product name in the
 * one string a screen reader announces, the same defect the create screen had.
 *
 * STATE LABELS NOW SAY WHAT THE HOST WANTS TO KNOW. The API derives exactly three states
 * (cancelled → CANCELLED; valid_until in the past → ENDED; otherwise ACTIVE) and no more, so no
 * distinction is invented: ACTIVE → 참여 가능, ENDED → 참여 마감, CANCELLED → 취소됨.
 *
 * TWO WORDS FOR TWO JOBS, on purpose. Scanning requires a valid QR and a signed-in account and
 * NOT org membership, so the roster can hold people who are not on the Host's team: counts and
 * the roster say 참여자, which is true of whoever scanned. The QR instruction keeps 팀원 and is
 * byte-identical to the Founder-verified sentence on the create screen, because it addresses the
 * Host's intent — who they mean to show it to — not the roster's contents.
 *
 * QR IS STILL THE WHOLE JOIN STORY: re-checked on this surface, there is no share-link control
 * here either, so nothing in this copy mentions a link.
 *
 * KO ONLY. English, state derivation, the API, the QR payload and every handler are untouched.
 */

const read = (p: string) => readFileSync(join(process.cwd(), p), "utf8");
const LIST = read("src/components/bty/events/EventHostList.tsx");
const DETAIL = read("src/components/bty/events/EventHostDetail.tsx");
const CREATE = read("src/components/bty/events/EventCreateClient.tsx");

/** The KO half of one file's COPY table. */
const koOf = (src: string) => {
  const start = src.indexOf("  ko: {");
  const end = src.indexOf("};", start);
  return src.slice(start, end);
};
const enOf = (src: string) => src.slice(src.indexOf("  en: {"), src.indexOf("  ko: {"));

const KO_LIST = koOf(LIST);
const KO_DETAIL = koOf(DETAIL);

afterEach(() => cleanup());

describe("[KO host events T1-T2] no internal or translated language", () => {
  it("T1 no 리얼리티 이벤트, including the aria label", () => {
    expect(KO_LIST).not.toContain("리얼리티");
    expect(KO_DETAIL).not.toContain("리얼리티");
  });

  it("T2 no 실제 순간 and no architecture nouns", () => {
    for (const ko of [KO_LIST, KO_DETAIL]) {
      for (const term of ["실제 순간", "Room", "룸", "세션", "자리", "참여 현황"]) {
        expect(ko, term).not.toContain(term);
      }
    }
  });
});

describe("[KO host events T3-T5] one vocabulary across the closed surfaces", () => {
  it("T3 the owned list names itself the way the Learn landing does", () => {
    expect(KO_LIST).toContain('heading: "내가 만든 이벤트"');
    expect(KO_DETAIL).toContain('back: "‹ 내가 만든 이벤트"');
    // The retired heading and the create-verb mismatch are gone.
    expect(KO_LIST).not.toContain('heading: "내 이벤트"');
    expect(KO_LIST).toContain('emptyCta: "이벤트 만들기"');
    expect(KO_LIST).not.toContain('emptyCta: "이벤트 열기"');
  });

  it("T4 the QR wording matches the Founder-verified create screen exactly", () => {
    const sentence = "팀원에게 이 QR 코드를 보여주세요. 스캔하면 참여가 기록됩니다.";
    expect(koOf(CREATE), "the create screen is the reference").toContain(sentence);
    expect(KO_DETAIL).toContain(sentence);
    expect(KO_DETAIL).toContain('qrAria: "이벤트 참여 QR 코드"');
    expect(KO_DETAIL).not.toContain("— 스캔하면");
  });

  it("T5 nothing promises a share link, because none exists on these surfaces", () => {
    for (const src of [LIST, DETAIL]) {
      expect(src).not.toContain("링크");
      expect(src.toLowerCase()).not.toContain("share");
    }
  });
});

describe("[KO host events T6-T8] states, counts, and the way back", () => {
  it("T6 every derived state has a truthful label, and no fourth state is invented", () => {
    for (const ko of [KO_LIST, KO_DETAIL]) {
      expect(ko).toContain('ACTIVE: "참여 가능"');
      expect(ko).toContain('ENDED: "참여 마감"');
      expect(ko).toContain('CANCELLED: "취소됨"');
      expect(ko).not.toContain("진행 중");
    }
    // The API derives exactly these three and nothing else.
    const api = read("src/app/api/bty/events/mine/route.ts");
    expect(api).toContain('state: "ACTIVE" | "ENDED" | "CANCELLED"');
  });

  it("T7 counts are counted the way Korean counts people", () => {
    for (const ko of [KO_LIST, KO_DETAIL]) {
      expect(ko).toContain("${n}명 참여");
      expect(ko).not.toContain("참여 ${n}");
    }
    /*
      FOUNDER-OBSERVED: the detail's empty roster printed the same sentence twice, one line
      apart — the header count and the body under it. The header COUNTS ("0명 참여") and the body
      keeps the sentence, because the body is the only thing that explains an empty list. The
      list has no such body, so its zero case still carries the sentence itself.
    */
    expect(KO_DETAIL).toContain("count: (n: number) => `${n}명 참여`");
    expect(KO_DETAIL).toContain('emptyRoster: "아직 참여한 사람이 없습니다."');
    expect(KO_LIST).toContain('n === 0 ? "아직 참여한 사람이 없습니다"');
    // The roster names the people it lists, and an unnamed row is still one of them.
    expect(KO_DETAIL).toContain('rosterHeading: "참여자"');
    expect(KO_DETAIL).toContain('fallbackName: "참여자"');
  });

  it("T8 the way back names the tab it returns to", () => {
    expect(KO_LIST).toContain('back: "‹ 배우기"');
    expect(KO_LIST).not.toContain('back: "‹ 학습"');
  });
});

describe("[KO host events T9-T12] English, behaviour, aria, length", () => {
  it("T9 English is byte-identical on both files", () => {
    expect(enOf(LIST)).toContain('heading: "My events"');
    expect(enOf(LIST)).toContain('intro: "Participation in the Reality Events you opened."');
    expect(enOf(LIST)).toContain('state: { ACTIVE: "Active", ENDED: "Ended", CANCELLED: "Cancelled" }');
    expect(enOf(DETAIL)).toContain('qrAria: "Reality Event QR code"');
    expect(enOf(DETAIL)).toContain('rosterHeading: "Participation"');
    expect(enOf(DETAIL)).toContain('fallbackName: "Participant"');
  });

  it("T10 handlers, API calls and testids are untouched", () => {
    for (const anchor of ['"/api/bty/events/mine"', 'data-testid="event-host-row"', "onOpenDetail(e.eventId)", "onOpenCreate"]) {
      expect(LIST, anchor).toContain(anchor);
    }
    for (const anchor of ["/api/bty/events/mine/", 'data-testid="event-detail-qr"', "QRCodeSVG", 'data-testid="event-detail-participant"']) {
      expect(DETAIL, anchor).toContain(anchor);
    }
  });

  it("T11 the row aria label is built from the same repaired strings", () => {
    // It interpolates state + count, so it inherits the repair rather than holding its own copy.
    expect(LIST).toContain("aria-label={`${e.title} — ${t.state[e.state]}, ${t.count(e.participationCount)}`}");
  });

  it("T12 every KO line is short enough for a phone", () => {
    const quoted = new RegExp(String.fromCharCode(34) + "([^" + String.fromCharCode(34) + "]{2,})" + String.fromCharCode(34), "g");
    for (const ko of [KO_LIST, KO_DETAIL]) {
      for (const m of ko.matchAll(quoted)) {
        expect(m[1].length, m[1]).toBeLessThanOrEqual(44);
      }
    }
  });
});

// ---------------------------------------------------------------------------
// The empty roster, as it actually renders
// ---------------------------------------------------------------------------

const detailResponse = (participationCount: number, participants: { displayName: string | null; participatedAt: string }[]) => ({
  ok: true,
  json: async () => ({
    event: {
      eventId: "e1",
      title: "아침 모임",
      state: "ACTIVE" as const,
      createdAt: "2026-08-26T05:00:00.000Z",
      closesAt: "2026-08-30T08:00:00.000Z",
      participationCount,
      qr: { available: true, payload: "btyev1.test" },
    },
    participants,
  }),
});

describe("[KO host events] the empty roster says it once", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("an empty roster shows a zero COUNT in the header and the sentence only in the body", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => detailResponse(0, [])));
    render(<EventHostDetail locale="ko" eventId="e1" onBack={() => {}} />);
    await waitFor(() => expect(screen.getByTestId("event-detail-count")).toBeTruthy());

    // T1 — the header counts.
    expect(screen.getByTestId("event-detail-count").textContent).toBe("0명 참여");
    // T2 — the sentence appears exactly once on the whole screen.
    const body = document.body.textContent ?? "";
    expect(body.split("아직 참여한 사람이 없습니다").length - 1).toBe(1);
    expect(screen.getByTestId("event-detail-roster-empty").textContent).toBe("아직 참여한 사람이 없습니다.");
  });

  it("T3 a non-empty roster counts the same way", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => detailResponse(2, [
      { displayName: "홍길동", participatedAt: "2026-08-26T05:14:00.000Z" },
      { displayName: null, participatedAt: "2026-08-26T05:20:00.000Z" },
    ])));
    render(<EventHostDetail locale="ko" eventId="e1" onBack={() => {}} />);
    await waitFor(() => expect(screen.getByTestId("event-detail-count")).toBeTruthy());
    expect(screen.getByTestId("event-detail-count").textContent).toBe("2명 참여");
    expect(screen.queryByTestId("event-detail-roster-empty")).toBeNull();
    // The unnamed row still reads as one of the people counted.
    expect(document.body.textContent).toContain("참여자");
  });
});
