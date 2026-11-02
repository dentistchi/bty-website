/** @vitest-environment jsdom */
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
// The PDF canvas is outside this terminal-state test; completion/claim clients remain real.
vi.mock("./PdfReader", () => ({ PdfReader: () => null }));
import FoundryJoinClient from "./FoundryJoinClient";
import FoundryDocumentClient from "./FoundryDocumentClient";
import FoundryGuidanceClient from "./FoundryGuidanceClient";

type Kind = "video" | "document" | "guidance" | "discussion";
type Status = "claimable" | "awarded" | "unavailable" | "review_required";
const KINDS: Kind[] = ["video", "document", "guidance", "discussion"];
const awardCopy = (kind: Kind) => (kind === "guidance" || kind === "discussion") ? "10 Core XP added." : "+10 Core XP";
const PENDING = "Your training is complete and saved. XP has not been confirmed.";
const REVIEW = "Your training is complete and saved. This XP claim needs review before it can be confirmed.";
const json = (body: unknown, status = 200) => ({ ok: status >= 200 && status < 300, status, json: async () => body });
function snapshot(kind: Kind, status: Status, stage?: string) {
  const common = { event: { title: "A completed synthetic training", status: "open" }, participant: { display_name: "Learner" },
    stage: stage ?? (status === "awarded" ? "completed_awarded" : "completed_claimable"), xp_status: status,
    reflection_required: false, follow_up_days: null, journey: null };
  if (kind === "video") return { ...common, training: { youtube_video_id: "dQw4w9WgXcQ", completion_prompt: "What will you do?", shared_question: null } };
  if (kind === "document") return { ...common, content_type: "document", document: { page_count: 1, min_read_seconds: 0,
    intro: null, last_page: 1, distinct_pages_viewed: 1, active_read_ms: 0, reading_complete: true,
    completion_prompt: "What will you do?", shared_question: null } };
  return { ...common, content_type: kind === "discussion" ? "live_discussion" : "written_guidance", declared: true,
    guidance: { material_text: "Name the next step.", completion_prompt: "What will you do?", shared_question: null } };
}
function mount(kind: Kind, locale: "en" | "ko" = "en") {
  if (kind === "video") return render(<FoundryJoinClient token="xp-synthetic" savedLocale={locale} />);
  if (kind === "document") return render(<FoundryDocumentClient token="xp-synthetic" savedLocale={locale} />);
  return render(<FoundryGuidanceClient token="xp-synthetic" contentType={kind === "discussion" ? "live_discussion" : "written_guidance"} savedLocale={locale} />);
}
function room(kind: Kind, initial: Status, options: { responseStage?: boolean; completion?: Status;
  claims?: Array<Status | "503" | "throw" | "malformed">; reconcile?: Status; claimReady?: Promise<void> } = {}) {
  let state = snapshot(kind, initial, options.responseStage ? "response" : undefined);
  let claimIndex = 0;
  const claims: string[] = [];
  vi.stubGlobal("fetch", vi.fn(async (url: string, init?: RequestInit) => {
    const path = String(url);
    if (path.includes("/api/auth/session")) return json({ ok: true, user: { email: "learner@example.test" } });
    if (path.includes("/reflection")) return json({ ok: true, reflection: null });
    if (init?.method === "POST" && path.endsWith("/claim-xp")) {
      claims.push(path);
      const result = options.claims?.[claimIndex++] ?? "awarded";
      if (result === "503") { if (options.reconcile) state = snapshot(kind, options.reconcile); return json({ ok: false, error: "UNEXPECTED_PRIVATE_SQL_SENTINEL" }, 503); }
      if (result === "throw") { if (options.reconcile) state = snapshot(kind, options.reconcile); throw new Error("private transport sentinel"); }
      if (result === "malformed") { if (options.reconcile) state = snapshot(kind, options.reconcile); return json({ ok: true }); }
      if (options.claimReady) await options.claimReady;
      state = snapshot(kind, result); return json({ ok: true, ...state });
    }
    if (init?.method === "POST" && path.endsWith("/complete")) {
      state = snapshot(kind, options.completion ?? "unavailable"); return json({ ok: true, ...state });
    }
    return json(state);
  }));
  return { claims };
}
afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

for (const kind of KINDS) describe(`${kind}: completed learning and unconfirmed XP`, () => {
  it("shows saved completion and an explicit retry without falsely showing earned XP or auto-claiming", async () => {
    const r = room(kind, "unavailable"); mount(kind);
    expect(await screen.findByText(PENDING)).toBeTruthy();
    expect(screen.getByRole("button", { name: "Try XP again" })).toBeTruthy();
    expect(screen.queryByText(awardCopy(kind))).toBeNull();
    expect(screen.queryByText("10 Core XP is ready to save.")).toBeNull();
    expect(r.claims).toHaveLength(0);
  });
  it("shows review-required truth without an automatic claim or an impossible payment retry", async () => {
    const r = room(kind, "review_required"); mount(kind);
    expect(await screen.findByText(REVIEW)).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Try XP again" })).toBeNull();
    expect(screen.queryByText(awardCopy(kind))).toBeNull(); expect(r.claims).toHaveLength(0);
  });
  it("preserves completed learning after a 503 and lets an explicit retry reach the awarded result", async () => {
    const r = room(kind, "unavailable", { claims: ["503", "awarded"] }); mount(kind);
    fireEvent.click(await screen.findByRole("button", { name: "Try XP again" }));
    const error = await screen.findByRole("alert");
    expect(error.textContent).toBe("XP still could not be confirmed. Please try again.");
    expect(document.body.textContent).not.toMatch(/UNEXPECTED_PRIVATE_SQL_SENTINEL|private transport/i);
    expect(screen.getByText(PENDING)).toBeTruthy();
    const retry = screen.getByRole("button", { name: "Try XP again" }) as HTMLButtonElement;
    await waitFor(() => expect(retry.disabled).toBe(false)); fireEvent.click(retry);
    expect(await screen.findByText(awardCopy(kind))).toBeTruthy();
    expect(screen.queryByText(PENDING)).toBeNull(); expect(r.claims).toHaveLength(2);
  });
  it("does not convert a review-required claim response into an awarded or Saved-to-BTY success", async () => {
    room(kind, "unavailable", { claims: ["review_required"] }); mount(kind);
    fireEvent.click(await screen.findByRole("button", { name: "Try XP again" }));
    expect(await screen.findByText(REVIEW)).toBeTruthy();
    expect(screen.queryByText(awardCopy(kind))).toBeNull(); expect(screen.queryByText((kind === "guidance" || kind === "discussion") ? "Saved" : "Saved to your BTY")).toBeNull();
  });
  it("reconciles a lost claim acknowledgement against the saved awarded snapshot", async () => {
    room(kind, "unavailable", { claims: ["throw"], reconcile: "awarded" }); mount(kind);
    fireEvent.click(await screen.findByRole("button", { name: "Try XP again" }));
    expect(await screen.findByText(awardCopy(kind))).toBeTruthy(); expect(screen.queryByText(PENDING)).toBeNull();
  });
  it("keeps malformed HTTP200 responses pending and retryable", async () => {
    room(kind, "unavailable", { claims: ["malformed"] }); mount(kind);
    fireEvent.click(await screen.findByRole("button", { name: "Try XP again" }));
    expect(await screen.findByRole("alert")).toBeTruthy(); expect(screen.getByText(PENDING)).toBeTruthy();
    expect(screen.queryByText(awardCopy(kind))).toBeNull();
  });
  it.each(["503", "malformed"] as const)("keeps pending recovery after %s then a healthy GET reports claimable", async result => {
    const r = room(kind, "unavailable", { claims: [result, "awarded"], reconcile: "claimable" }); mount(kind);
    fireEvent.click(await screen.findByRole("button", { name: "Try XP again" }));
    expect(await screen.findByRole("alert")).toBeTruthy();
    expect(screen.getByText(PENDING)).toBeTruthy();
    expect(screen.queryByText("10 Core XP is ready to save.")).toBeNull();
    expect(screen.queryByText(awardCopy(kind))).toBeNull();
    const retry = screen.getByRole("button", { name: "Try XP again" }) as HTMLButtonElement;
    await waitFor(() => expect(retry.disabled).toBe(false)); fireEvent.click(retry);
    expect(await screen.findByText(awardCopy(kind))).toBeTruthy();
    expect(screen.queryByText(PENDING)).toBeNull(); expect(r.claims).toHaveLength(2);
  });
  it("keeps the pending panel while a subsequent claim is still in flight", async () => {
    let finish!: () => void; const ready = new Promise<void>(resolve => { finish = resolve; });
    room(kind, "unavailable", { claims: ["503", "awarded"], reconcile: "claimable", claimReady: ready }); mount(kind);
    fireEvent.click(await screen.findByRole("button", { name: "Try XP again" }));
    await screen.findByRole("alert");
    fireEvent.click(screen.getByRole("button", { name: "Try XP again" }));
    try {
      const checking = await screen.findByRole("button", { name: "Checking…" }) as HTMLButtonElement;
      expect(checking.disabled).toBe(true); expect(screen.getByText(PENDING)).toBeTruthy();
      expect(screen.queryByText("10 Core XP is ready to save.")).toBeNull();
      expect(screen.queryByText(awardCopy(kind))).toBeNull();
    } finally { await act(async () => { finish(); }); }
    expect(await screen.findByText(awardCopy(kind))).toBeTruthy();
  });
  it("accepts durable completion with pending XP without resubmitting the learning", async () => {
    const r = room(kind, "claimable", { responseStage: true, completion: "unavailable" }); mount(kind);
    const field = await screen.findByRole("textbox");
    fireEvent.change(field, { target: { value: "I will confirm the next step." } });
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: /^(?:Complete training|Complete)$/ })); });
    expect(await screen.findByText(PENDING)).toBeTruthy(); expect(screen.queryByText(awardCopy(kind))).toBeNull();
    expect(r.claims).toHaveLength(0);
  });
  it("provides Korean pending and review copy without backend codes", async () => {
    room(kind, "unavailable"); const view = mount(kind, "ko");
    expect(await screen.findByText("훈련 완료 기록은 저장됐습니다. XP 지급은 확인되지 않았습니다.")).toBeTruthy();
    expect(screen.getByRole("button", { name: "XP 다시 확인" })).toBeTruthy();
    view.unmount(); room(kind, "review_required"); mount(kind, "ko");
    expect(await screen.findByText("훈련 완료 기록은 저장됐습니다. XP 지급 여부는 검토가 필요합니다.")).toBeTruthy();
  });
});
