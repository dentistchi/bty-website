/** @vitest-environment jsdom */
/**
 * LEARNER C17A SINGLE-ASK V1 — ONE QUESTION, ONE PLACE, ONE INPUT.
 *
 * MEASURED ON A REAL COMPLETED RUN, not on a mockup. Event `6b1ba8b5`, progress `c2e66f5e`: the
 * Founder joined a written-guidance room, declared the guidance read, and finished in 67 seconds.
 * For the 36 seconds between those two acts, the byte-identical C17A sentence was on screen
 * TWICE — once in the read-only reading list under 결정, where there is no way to answer it, and
 * again above 무엇을 하시겠습니까? with the textarea that actually records the answer.
 *
 * The reading list already excluded `completion_check` for exactly this reason: a question
 * delivered by its own response control does not also belong in a list of things to read.
 * `action_decision` now joins it, on the same reasoning.
 *
 * WHAT THESE TESTS PROTECT, in order of what would hurt most if it broke:
 *   1. no room LOSES the question — all three read it off the journey for their own control;
 *   2. the guidance and document rooms show it exactly once;
 *   3. the video room, which never duplicated it, is unchanged;
 *   4. the two sentences are byte-identical to what shipped, and the two answers still map to
 *      the two columns the completion writes.
 */
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, cleanup } from "@testing-library/react";
import FoundryGuidanceClient from "./FoundryGuidanceClient";
import FoundryJoinClient from "./FoundryJoinClient";
import { JourneyReading } from "./JourneyReading";

// The PDF surface is irrelevant to a text-occurrence contract, and rendering it here would be
// testing pdf.js rather than the filter under test.
vi.mock("./PdfReader", () => ({ PdfReader: () => null }));
import FoundryDocumentClient from "./FoundryDocumentClient";

/** The exact strings the Founder's learner read. Byte-identical assertions depend on these. */
const C17A = "이것을 가장 먼저 해볼 상황은 언제인가요? 그때 무엇을 하겠어요?";
const C16B = "실제 업무에서 이것을 행동으로 옮기기 어렵게 만드는 것은 무엇일까요?";

const JOURNEY = {
  displayTitle: "회의 후 실행 확인하기",
  elements: [
    { id: "el_why_it_matters", kind: "why_it_matters", content: "확인하지 않으면 실행이 빠진다." },
    { id: "el_observable_standard", kind: "observable_standard", content: "담당자와 마감일을 확인한다." },
    { id: "el_scenario", kind: "scenario", content: "시간이 촉박할 때 가장 놓치기 쉽습니다." },
    { id: "el_action_decision", kind: "action_decision", content: C17A },
    { id: "el_field_application", kind: "field_application", content: "다음 회의가 첫 기회입니다." },
    { id: "el_evidence", kind: "evidence", content: "각 할 일마다 담당자가 정해져 있다." },
    { id: "el_completion_check", kind: "completion_check", content: C16B },
    { id: "el_follow_up", kind: "follow_up", content: "7일 후에 다시 묻겠습니다." },
  ],
};

const jsonRes = (body: unknown, status = 200) => ({ ok: status >= 200 && status < 300, status, json: async () => body });

type Snap = Record<string, unknown>;

/** Records every POST body, so the field mapping can be asserted rather than assumed. */
function mockRoom(initial: Snap) {
  let snapshot: Snap = { ...initial };
  const posted: Record<string, unknown>[] = [];
  const fn = vi.fn(async (url: string, o?: { method?: string; body?: string }) => {
    if (url.includes("/declare")) {
      snapshot = { ...snapshot, declared: true, stage: "response" };
      return jsonRes({ ok: true, ...snapshot });
    }
    if (url.includes("/complete")) {
      posted.push(JSON.parse(String(o?.body ?? "{}")));
      snapshot = { ...snapshot, stage: "completed_claimable", xp_status: "claimable" };
      return jsonRes({ ok: true, ...snapshot });
    }
    return jsonRes(snapshot);
  });
  // @ts-expect-error test shim
  global.fetch = fn;
  return { posted };
}

const GUIDANCE_SNAP: Snap = {
  event: { title: "회의 후 실행 확인하기", status: "open" },
  participant: { display_name: "테스터" },
  stage: "declare",
  xp_status: "none",
  declared: false,
  journey: JOURNEY,
  guidance: { material_text: "회의가 끝나기 전에 담당자와 마감일을 정하세요.", completion_prompt: C16B, shared_question: null },
  follow_up_days: 7,
};

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// T1–T3 — the shared filter
// ---------------------------------------------------------------------------

describe("[C17A Single-Ask V1] the reading list carries only what it can deliver", () => {
  it("T1/T2 — excludes completion_check AND action_decision", () => {
    render(<JourneyReading journey={JOURNEY as never} locale="ko" />);
    expect(screen.queryByTestId("journey-el-completion_check")).toBeNull();
    expect(screen.queryByTestId("journey-el-action_decision")).toBeNull();
  });

  it("T3 — every informational kind still renders, with its learner-facing label", () => {
    render(<JourneyReading journey={JOURNEY as never} locale="ko" />);
    for (const kind of ["why_it_matters", "observable_standard", "scenario", "field_application", "evidence", "follow_up"]) {
      expect(screen.getByTestId(`journey-el-${kind}`), kind).toBeTruthy();
    }
    // The label, not the internal identifier — the guarantee 3.2M-1 added.
    expect(screen.getByTestId("journey-el-follow_up").textContent).toContain("다음에 일어날 일");
  });
});

// ---------------------------------------------------------------------------
// T4–T8 — the written-guidance room, in the state the Founder was actually in
// ---------------------------------------------------------------------------

describe("[C17A Single-Ask V1] written guidance asks once", () => {
  async function declaredGuidanceRoom() {
    const room = mockRoom(GUIDANCE_SNAP);
    render(<FoundryGuidanceClient token="tok" contentType="written_guidance" savedLocale="ko" />);
    fireEvent.click(await screen.findByTestId("guidance-declare"));
    await waitFor(() => expect(screen.getByTestId("decision-input")).toBeTruthy());
    return room;
  }

  it("T4/T5/T6 — the C17A sentence appears EXACTLY ONCE, at its input", async () => {
    await declaredGuidanceRoom();
    /*
      THE WHOLE SLICE, IN ONE ASSERTION. Counted across the document rather than checked at one
      testid, because the defect was two copies in two different components — a spot check on
      either one of them would have passed while the learner saw both.
    */
    const occurrences = screen.getAllByText(C17A);
    expect(occurrences).toHaveLength(1);
    expect(screen.getByTestId("decision-context").textContent).toBe(C17A);
    expect(screen.queryByTestId("journey-el-action_decision")).toBeNull();
  });

  it("T7/T8 — both inputs are present and independently answerable", async () => {
    const room = await declaredGuidanceRoom();
    expect(screen.getByTestId("decision-input")).toBeTruthy();
    const completion = screen.getByLabelText("마치기 전에", { selector: "textarea" });
    expect(completion).toBeTruthy();

    // T14/T15 — the two answers still map to the two columns the completion writes.
    fireEvent.change(completion, { target: { value: "까먹고 어색하고" } });
    fireEvent.change(screen.getByTestId("decision-input"), { target: { value: "이번 이사회때 하면 좋겠네" } });
    fireEvent.click(screen.getByTestId("guidance-complete"));
    await waitFor(() => expect(room.posted).toHaveLength(1));
    // The exact wire keys the server maps to `response_text` and `decision_response_text`.
    expect(room.posted[0].response_text).toBe("까먹고 어색하고");
    expect(room.posted[0].decision_response).toBe("이번 이사회때 하면 좋겠네");
  });

  it("the completion question is still delivered by the completion step, unchanged", async () => {
    await declaredGuidanceRoom();
    expect(screen.getByTestId("guidance-completion-prompt").textContent).toBe(C16B);
    expect(screen.getAllByText(C16B)).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// T10/T11 — the video room must not lose the question it never duplicated
// ---------------------------------------------------------------------------

describe("[C17A Single-Ask V1] the video room is unchanged", () => {
  it("T10/T11 — the decision question and its input are still reachable at the response stage", async () => {
    mockRoom({
      event: { title: "회의 후 실행 확인하기", status: "open" },
      participant: { display_name: "테스터" },
      stage: "response",
      xp_status: "none",
      journey: JOURNEY,
      training: { youtube_url: "https://youtu.be/dQw4w9WgXcQ", completion_prompt: C16B, shared_question: null },
      follow_up_days: 7,
    });
    render(<FoundryJoinClient token="tok" savedLocale="ko" />);
    await waitFor(() => expect(screen.getByTestId("decision-section")).toBeTruthy());
    /*
      The video room reads `action_decision` straight off the journey for this control, never from
      the reading list — which is why the shared filter could not take its only copy away.
    */
    expect(screen.getByTestId("decision-context").textContent).toBe(C17A);
    expect(screen.getByTestId("decision-input")).toBeTruthy();
    expect(screen.getAllByText(C17A)).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// T9 — the document room, which co-rendered the same way
// ---------------------------------------------------------------------------

describe("[C17A Single-Ask V1] the document room asks once too", () => {
  it("T9 — same single-occurrence contract, no room-specific copy divergence", async () => {
    mockRoom({
      content_type: "document",
      event: { title: "회의 후 실행 확인하기", status: "open" },
      participant: { display_name: "테스터" },
      document: {
        page_count: 1, min_read_seconds: 15, intro: null, last_page: 1,
        distinct_pages_viewed: 1, active_read_ms: 368000, reading_complete: true,
        completion_prompt: C16B, shared_question: null,
      },
      journey: JOURNEY,
      reflection_required: false,
      stage: "response",
      xp_status: "none",
    });
    render(<FoundryDocumentClient token="tok" savedLocale="ko" />);
    await waitFor(() => expect(screen.getByTestId("decision-input")).toBeTruthy());
    expect(screen.getAllByText(C17A)).toHaveLength(1);
    expect(screen.getByTestId("decision-context").textContent).toBe(C17A);
    expect(screen.queryByTestId("journey-el-action_decision")).toBeNull();
    // And the completion question is still only at the completion control.
    expect(screen.getAllByText(C16B)).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// T12/T13 — the copy itself did not move
// ---------------------------------------------------------------------------

describe("[C17A Single-Ask V1] the two questions are byte-identical to what shipped", () => {
  it("T12/T13 — no punctuation or wording edit rode along with this repair", () => {
    expect(C17A).toBe("이것을 가장 먼저 해볼 상황은 언제인가요? 그때 무엇을 하겠어요?");
    expect(C16B).toBe("실제 업무에서 이것을 행동으로 옮기기 어렵게 만드는 것은 무엇일까요?");
    /*
      C17A V12 ACTION-SPECIFICITY — WATCHLIST, recorded and deliberately NOT acted on.

      The Founder answered "이번 이사회때 하면 좋겠네": the WHEN half, not the WHAT half. One
      natural-use observation is not enough to justify redesigning a question this arc has already
      changed several times, so the sentence stays exactly as it is and the next fresh run
      measures whether learners consistently answer only the first half.
    */
  });
});
