/** @vitest-environment jsdom */
import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, waitFor, cleanup, fireEvent } from "@testing-library/react";
import FoundryMyLearning from "./FoundryMyLearning";

/**
 * Slice My Learning Archive V1 — presentation-level archiving.
 *
 * Archived is NOT deletion and NOT a stored state: it is derived from completion order and
 * obligation state, every render. A learner never tidies their own history, a record is never
 * unreachable, and a training with something still to do is never hidden however old it is.
 */

const history = (n: number) =>
  Array.from({ length: n }, (_, i) => ({
    entryId: `e${i + 1}`,
    eventId: `ev${i + 1}`,
    eventTitle: `Training ${i + 1}`,
    contentType: "written_guidance",
    completedAt: `2026-09-${String(28 - (i % 27)).padStart(2, "0")}T10:00:00Z`,
  }));

function mockApi(count: number, obligations: string[] = []) {
  // @ts-expect-error test shim
  global.fetch = vi.fn(async (url: string) => {
    const u = String(url);
    const body = u.includes("/evidence/mine")
      ? { ok: true, items: obligations.map((id) => ({ entryId: id, openFollowUp: [{ followupId: `f-${id}`, followUpDays: 7 }] })) }
      : u.includes("/api/bty/foundry/history")
        ? { ok: true, history: history(count) }
        : { ok: true };
    return { ok: true, status: 200, json: async () => body };
  });
}

const renderList = () => render(<FoundryMyLearning locale="en" onBack={() => {}} />);
const titles = () => screen.getAllByTestId("my-learning-item").map((el) => el.textContent ?? "");

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("the default list stays calm", () => {
  it("shows everything while the history is short", async () => {
    mockApi(4);
    renderList();
    await waitFor(() => expect(screen.getAllByTestId("my-learning-item")).toHaveLength(4));
    expect(screen.queryByTestId("my-learning-archived-open")).toBeNull();
  });

  it("keeps ten and offers the rest as Archived", async () => {
    mockApi(46);
    renderList();
    await waitFor(() => expect(screen.getAllByTestId("my-learning-item")).toHaveLength(10));
    expect(screen.getByTestId("my-learning-archived-open").textContent).toContain("Archived 36");
  });

  it("keeps a training with something still to do, however old", async () => {
    mockApi(46, ["e46"]);
    renderList();
    await waitFor(() => expect(screen.getAllByTestId("my-learning-item")).toHaveLength(11));
    expect(titles().join(" ")).toContain("Training 46");
    expect(screen.getByTestId("my-learning-archived-open").textContent).toContain("Archived 35");
  });

  it("shows no quiz, score or follow-up detail on any row — only title, date and a door", async () => {
    mockApi(46, ["e46"]);
    renderList();
    await waitFor(() => expect(screen.getAllByTestId("my-learning-item")).toHaveLength(11));
    const body = titles().join(" ");
    expect(body).toContain("Completed");
    for (const leak of ["Check in again", "Follow-up", "%", "/ 5", "Since this training"]) {
      expect(body, leak).not.toContain(leak);
    }
  });
});

describe("the archive is a place, not a state", () => {
  it("opens the older completions, and they are all still there", async () => {
    mockApi(46);
    renderList();
    fireEvent.click(await screen.findByTestId("my-learning-archived-open"));
    await waitFor(() => expect(screen.getAllByTestId("my-learning-item")).toHaveLength(36));
    expect(titles().join(" ")).toContain("Training 46");
  });

  it("archived rows carry exactly the same shape, and open the same detail", async () => {
    mockApi(46);
    renderList();
    fireEvent.click(await screen.findByTestId("my-learning-archived-open"));
    const row = (await screen.findAllByTestId("my-learning-open-detail"))[0];
    expect(row.textContent).toContain("Completed");
    fireEvent.click(row);
    await waitFor(() => expect(screen.getByTestId("training-detail")).toBeTruthy());
  });

  it("goes back to the recent list without leaving My Learning", async () => {
    mockApi(46);
    renderList();
    fireEvent.click(await screen.findByTestId("my-learning-archived-open"));
    await waitFor(() => expect(screen.getAllByTestId("my-learning-item")).toHaveLength(36));
    fireEvent.click(screen.getByTestId("my-learning-back"));
    await waitFor(() => expect(screen.getAllByTestId("my-learning-item")).toHaveLength(10));
    expect(screen.getByTestId("my-learning-archived-open")).toBeTruthy();
  });

  it("offers no Delete anywhere", async () => {
    mockApi(46);
    renderList();
    await waitFor(() => expect(screen.getAllByTestId("my-learning-item")).toHaveLength(10));
    const all = document.body.textContent ?? "";
    for (const word of ["Delete", "Remove", "삭제"]) expect(all, word).not.toContain(word);
  });
});
