/** @vitest-environment jsdom */
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, cleanup, act } from "@testing-library/react";
import FoundryGuidanceClient from "./FoundryGuidanceClient";

/**
 * R4-R2G — the LEARNER half. F5, F10 and F16.
 *
 * F5/F10: the Host's own text reaches the learner as learning content — readable, not metadata.
 *
 * F16 is the one that matters most, and it is asserted twice over: rendering a live-discussion
 * material must never produce a completion, an award, or any word claiming BTY knows the
 * discussion happened. The wording test is deliberately a BANNED-PHRASE sweep rather than a
 * spot check, because the failure mode here is a plausible sentence added later by someone who
 * did not read D1.
 */

const jsonRes = (body: unknown, status = 200) => ({
  ok: status >= 200 && status < 300,
  status,
  json: async () => body,
});

type Snap = Record<string, unknown>;

function mockRoom(initial: Snap, opts: { onDeclare?: (s: Snap) => Snap } = {}) {
  let snapshot: Snap = { ...initial };
  const calls: string[] = [];
  const fn = vi.fn(async (url: string, o?: { method?: string }) => {
    calls.push(`${o?.method ?? "GET"} ${url}`);
    if (url.includes("/declare")) {
      snapshot = opts.onDeclare ? opts.onDeclare(snapshot) : { ...snapshot, declared: true, stage: "response" };
      return jsonRes({ ok: true, ...snapshot });
    }
    if (url.includes("/complete")) {
      snapshot = { ...snapshot, stage: "completed_awarded", xp_status: "awarded" };
      return jsonRes({ ok: true, ...snapshot });
    }
    return jsonRes(snapshot);
  });
  // @ts-expect-error test shim
  global.fetch = fn;
  return { calls, get snapshot() { return snapshot; }, fn };
}

const BASE = {
  event: { title: "Ask Before You Assume", status: "open" },
  participant: { display_name: "Ari" },
  stage: "declare",
  xp_status: "none",
  declared: false,
};

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("R4-R2G · F5 — written guidance reaches the learner as learning content", () => {
  it("renders the Host's text, readable, with its own heading", async () => {
    mockRoom({
      ...BASE,
      content_type: "written_guidance",
      guidance: { material_text: "Ask one question before you act.\n\nThen say the number back.", completion_prompt: null, shared_question: null },
    });
    render(<FoundryGuidanceClient token="tok" contentType="written_guidance" />);

    const material = await screen.findByTestId("guidance-material-text");
    expect(material.textContent).toContain("Ask one question before you act.");
    // Line breaks the Host wrote survive — an agenda is written in lines.
    expect(material.className).toContain("whitespace-pre-wrap");
    expect(screen.getByText("Read this")).toBeTruthy();
  });

  it("the acknowledgement is offered AFTER the guidance, and is first-person", async () => {
    mockRoom({
      ...BASE,
      content_type: "written_guidance",
      guidance: { material_text: "The guidance.", completion_prompt: null, shared_question: null },
    });
    render(<FoundryGuidanceClient token="tok" contentType="written_guidance" />);

    const declare = await screen.findByTestId("guidance-declare");
    expect(declare.textContent).toBe("I’ve read this guidance");

    const material = screen.getByTestId("guidance-material");
    expect(material.compareDocumentPosition(declare) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("the completion question appears only once the learner has acknowledged", async () => {
    const room = mockRoom({
      ...BASE,
      content_type: "written_guidance",
      guidance: { material_text: "The guidance.", completion_prompt: null, shared_question: null },
    }, {
      onDeclare: (s) => ({
        ...s,
        declared: true,
        stage: "response",
        guidance: { material_text: "The guidance.", completion_prompt: "What will you ask?", shared_question: null },
      }),
    });
    render(<FoundryGuidanceClient token="tok" contentType="written_guidance" />);

    await screen.findByTestId("guidance-declare");
    expect(screen.queryByTestId("guidance-complete")).toBeNull();

    await act(async () => {
      fireEvent.click(screen.getByTestId("guidance-declare"));
    });
    await waitFor(() => expect(screen.getByTestId("guidance-completion-prompt").textContent).toBe("What will you ask?"));
    expect(screen.getByTestId("guidance-complete")).toBeTruthy();
    expect(room.calls.some((c) => c.startsWith("POST") && c.includes("/declare"))).toBe(true);
  });
});

describe("R4-R2G · F10 — live discussion reaches the learner as a team discussion", () => {
  it("renders the topic under a discussion heading, not a reading one", async () => {
    mockRoom({
      ...BASE,
      content_type: "live_discussion",
      guidance: { material_text: "Where did we act on half a handover?", completion_prompt: null, shared_question: null },
    });
    render(<FoundryGuidanceClient token="tok" contentType="live_discussion" />);

    expect((await screen.findByTestId("guidance-material-text")).textContent).toContain("Where did we act on half a handover?");
    expect(screen.getByText("Discuss this with your team")).toBeTruthy();
    expect(screen.queryByText("Read this")).toBeNull();
  });

  it("the control is the learner's own statement, never a claim about the discussion", async () => {
    mockRoom({
      ...BASE,
      content_type: "live_discussion",
      guidance: { material_text: "The topic.", completion_prompt: null, shared_question: null },
    });
    render(<FoundryGuidanceClient token="tok" contentType="live_discussion" />);
    expect((await screen.findByTestId("guidance-declare")).textContent).toBe("I took part in this discussion");
  });
});

describe("R4-R2G · F16 — no evidence state is falsely upgraded by rendering a live discussion", () => {
  /*
    THE BANNED PHRASES. Each is a sentence BTY has no standing to say about a discussion it did
    not observe. Swept over the whole rendered room rather than a single element, because a
    later well-meaning edit is far more likely to add one somewhere new than to change the
    control's own label.
  */
  const FORBIDDEN = [
    "discussion completed",
    "attendance",
    "attended",
    "verified",
    "observed",
    "confirmed",
    "we recorded that the discussion",
  ];

  it("says nothing that claims BTY knows the discussion happened — before OR after declaring", async () => {
    mockRoom({
      ...BASE,
      content_type: "live_discussion",
      guidance: { material_text: "The topic.", completion_prompt: "What will you raise?", shared_question: null },
    });
    render(<FoundryGuidanceClient token="tok" contentType="live_discussion" />);
    await screen.findByTestId("guidance-declare");

    const before = (document.body.textContent ?? "").toLowerCase();
    for (const phrase of FORBIDDEN) expect(before).not.toContain(phrase);

    await act(async () => {
      fireEvent.click(screen.getByTestId("guidance-declare"));
    });
    await screen.findByTestId("guidance-declared");

    const after = (document.body.textContent ?? "").toLowerCase();
    for (const phrase of FORBIDDEN) expect(after).not.toContain(phrase);
  });

  it("states plainly that BTY was not there", async () => {
    mockRoom({
      ...BASE,
      content_type: "live_discussion",
      guidance: { material_text: "The topic.", completion_prompt: null, shared_question: null },
    });
    render(<FoundryGuidanceClient token="tok" contentType="live_discussion" />);

    const honesty = await screen.findByTestId("guidance-discussion-honesty");
    expect(honesty.textContent).toContain("BTY wasn’t in the room");
    expect(honesty.textContent).toContain("not a record that the discussion happened");
  });

  it("the honesty line is NOT shown for written guidance — it would be a claim about nothing", async () => {
    mockRoom({
      ...BASE,
      content_type: "written_guidance",
      guidance: { material_text: "The guidance.", completion_prompt: null, shared_question: null },
    });
    render(<FoundryGuidanceClient token="tok" contentType="written_guidance" />);
    await screen.findByTestId("guidance-declare");
    expect(screen.queryByTestId("guidance-discussion-honesty")).toBeNull();
  });

  it("after declaring, the room reports the DECLARATION and no completion or XP", async () => {
    mockRoom({
      ...BASE,
      content_type: "live_discussion",
      guidance: { material_text: "The topic.", completion_prompt: "What will you raise?", shared_question: null },
    });
    render(<FoundryGuidanceClient token="tok" contentType="live_discussion" />);
    await screen.findByTestId("guidance-declare");

    await act(async () => {
      fireEvent.click(screen.getByTestId("guidance-declare"));
    });

    const declared = await screen.findByTestId("guidance-declared");
    expect(declared.textContent).toBe("Recorded: you said you took part.");
    // The completion step is now OFFERED — it has not happened.
    expect(screen.getByTestId("guidance-complete")).toBeTruthy();
    expect(screen.queryByText("Training complete")).toBeNull();
    expect(screen.queryByText("10 Core XP added.")).toBeNull();
  });

  it("XP appears only after the ordinary completion, never from the declaration", async () => {
    mockRoom({
      ...BASE,
      content_type: "live_discussion",
      declared: true,
      stage: "response",
      guidance: { material_text: "The topic.", completion_prompt: "What will you raise?", shared_question: null },
    });
    render(<FoundryGuidanceClient token="tok" contentType="live_discussion" />);

    const field = (await screen.findByLabelText("Before you finish")) as HTMLTextAreaElement;
    expect(screen.queryByText("10 Core XP added.")).toBeNull();

    await act(async () => {
      fireEvent.change(field, { target: { value: "I'll raise the missed check." } });
    });
    await act(async () => {
      fireEvent.click(screen.getByTestId("guidance-complete"));
    });

    await waitFor(() => expect(screen.getByText("Training complete")).toBeTruthy());
    expect(screen.getByText("10 Core XP added.")).toBeTruthy();
  });
});

describe("R4-R2G · the room fails closed when its content cannot be read", () => {
  it("shows an honest unavailable state rather than an empty training", async () => {
    mockRoom({ ...BASE, content_type: "written_guidance", guidance: null });
    render(<FoundryGuidanceClient token="tok" contentType="written_guidance" />);
    expect(await screen.findByText("This training can’t be opened right now.")).toBeTruthy();
    expect(screen.queryByTestId("guidance-declare")).toBeNull();
  });
});
