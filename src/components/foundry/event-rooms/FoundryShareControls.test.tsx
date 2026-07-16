/** @vitest-environment jsdom */
import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, cleanup } from "@testing-library/react";
import { FoundryShareControls } from "./FoundryShareControls";
import { EVENT_ROOMS_COPY } from "./copy";
import type { ManagerEvent } from "./types";

const URL = "https://bty-arena-staging.ywamer2022.workers.dev/f/btyfr1.ABC.DEF";

function docEvent(over: Partial<ManagerEvent> = {}): ManagerEvent {
  return {
    id: "e1",
    title: "Monthly Clinical Update",
    status: "open",
    content_type: "document",
    join_url: URL,
    created_at: "2026-07-15T00:00:00Z",
    closed_at: null,
    document: {
      source_type: "uploaded_pdf",
      file_name: "handbook.pdf",
      page_count: 3,
      min_read_seconds: 15,
      intro: "Read every page.",
      completion_prompt: "What will you apply?",
    },
    ...over,
  } as ManagerEvent;
}

function setClipboard(writeText: (t: string) => Promise<void> | undefined) {
  Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
}
function clearClipboard() {
  Object.defineProperty(navigator, "clipboard", { value: undefined, configurable: true });
}

const t = EVENT_ROOMS_COPY.en;

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});
beforeEach(() => {
  clearClipboard();
  delete (window as unknown as { Capacitor?: unknown }).Capacitor; // web path by default
  delete (navigator as unknown as { share?: unknown }).share;
});

function setNative() {
  (window as unknown as { Capacitor?: unknown }).Capacitor = { isNativePlatform: () => true };
}
function setNativeShare(fn: (d: { title?: string; text?: string; url?: string }) => Promise<void>) {
  setNative();
  Object.defineProperty(navigator, "share", { value: fn, configurable: true });
}

describe("FoundryShareControls — Copy invitation", () => {
  it("copies the full invitation (title + URL) and confirms calmly", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    setClipboard(writeText);
    render(<FoundryShareControls event={docEvent()} locale="en" t={t} />);
    fireEvent.click(screen.getByRole("button", { name: t.copyInvitation }));
    await waitFor(() => expect(writeText).toHaveBeenCalledTimes(1));
    const copied = writeText.mock.calls[0][0] as string;
    expect(copied).toContain("Monthly Clinical Update");
    expect(copied).toContain("Read the document and complete the reflection.");
    expect(copied).toContain(URL);
    expect(copied).not.toMatch(/owner_user_id|storage|core_xp|signedURL/i);
    await waitFor(() => expect(screen.getAllByText(t.invitationCopied).length).toBeGreaterThan(0));
  });

  it("clipboard DENIED → manual selectable fallback (no silent failure)", async () => {
    setClipboard(vi.fn().mockRejectedValue(new Error("denied")));
    render(<FoundryShareControls event={docEvent()} locale="en" t={t} />);
    fireEvent.click(screen.getByRole("button", { name: t.copyInvitation }));
    const area = (await screen.findByRole("textbox")) as HTMLTextAreaElement;
    expect(area.tagName).toBe("TEXTAREA");
    expect(area.value).toContain(URL);
    expect(screen.getAllByText(t.copyFailedManual).length).toBeGreaterThan(0);
  });

  it("clipboard UNAVAILABLE (no API) → manual fallback", async () => {
    clearClipboard();
    render(<FoundryShareControls event={docEvent()} locale="en" t={t} />);
    fireEvent.click(screen.getByRole("button", { name: t.copyInvitation }));
    const area = (await screen.findByRole("textbox")) as HTMLTextAreaElement;
    expect(area.value).toContain(URL);
  });
});

describe("FoundryShareControls — Share to Teams", () => {
  it("opens the official Teams share URL with the SAME canonical URL as href (no auth/graph)", async () => {
    const open = vi.fn((_url?: string) => ({}) as Window);
    vi.stubGlobal("open", open);
    render(<FoundryShareControls event={docEvent()} locale="en" t={t} />);
    fireEvent.click(screen.getByRole("button", { name: t.shareToTeams }));
    await waitFor(() => expect(open).toHaveBeenCalledTimes(1));
    const url = String(open.mock.calls[0][0]);
    expect(url.startsWith("https://teams.microsoft.com/share?")).toBe(true);
    expect(url).not.toMatch(/login|oauth|graph|auth/i);
    const href = new URLSearchParams(url.split("?")[1]).get("href");
    expect(href).toBe(URL); // exact canonical participant URL
    // Never claims "shared" — no success text asserting completion.
    expect(screen.queryByText(/shared to teams/i)).toBeNull();
  });

  it("NATIVE opens the iOS share sheet (navigator.share) with the SAME canonical URL — never the web Teams/login URL", async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    setNativeShare(share);
    const winOpen = vi.fn((_u?: string) => null);
    vi.stubGlobal("open", winOpen);
    render(<FoundryShareControls event={docEvent()} locale="en" t={t} />);
    fireEvent.click(screen.getByRole("button", { name: t.shareToTeams }));
    await waitFor(() => expect(share).toHaveBeenCalledTimes(1));
    const payload = share.mock.calls[0][0] as { title: string; text: string; url: string };
    expect(payload.url).toBe(URL); // same canonical URL as the QR
    expect(payload.title).toBe("Monthly Clinical Update");
    expect(payload.text).toContain("Read the document and complete the reflection.");
    expect(payload.text).not.toContain(URL); // URL rides in `url`, not duplicated in text
    // Never opens the web Teams share / Microsoft login in native.
    expect(winOpen).not.toHaveBeenCalled();
    const anyTeamsWeb = winOpen.mock.calls.some((c) => String(c[0]).includes("teams.microsoft.com/share"));
    expect(anyTeamsWeb).toBe(false);
    expect(screen.queryByText(/shared to teams/i)).toBeNull();
  });

  it("NATIVE cancel (AbortError) does NOT claim success and does not fall back", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    setClipboard(writeText);
    const abort = Object.assign(new Error("cancel"), { name: "AbortError" });
    setNativeShare(vi.fn().mockRejectedValue(abort));
    render(<FoundryShareControls event={docEvent()} locale="en" t={t} />);
    fireEvent.click(screen.getByRole("button", { name: t.shareToTeams }));
    await waitFor(() => expect(screen.queryByText(/opening/i)).toBeNull());
    expect(screen.queryByText(/shared to teams/i)).toBeNull();
    expect(writeText).not.toHaveBeenCalled(); // cancel is not a failure → no copy fallback
  });

  it("NATIVE share API failure → copy/manual invitation fallback (never claims shared)", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    setClipboard(writeText);
    setNativeShare(vi.fn().mockRejectedValue(new Error("share failed")));
    render(<FoundryShareControls event={docEvent()} locale="en" t={t} />);
    fireEvent.click(screen.getByRole("button", { name: t.shareToTeams }));
    await waitFor(() => expect(writeText).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(screen.getAllByText(t.readyToPaste).length).toBeGreaterThan(0));
    expect(screen.queryByText(/shared to teams/i)).toBeNull();
  });

  it("QR rotation: a new join_url is the URL shared natively", async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    setNativeShare(share);
    const rotated = "https://bty-arena-staging.ywamer2022.workers.dev/f/btyfr1.ROTATED.XYZ";
    const { rerender } = render(<FoundryShareControls event={docEvent()} locale="en" t={t} />);
    rerender(<FoundryShareControls event={docEvent({ join_url: rotated })} locale="en" t={t} />);
    fireEvent.click(screen.getByRole("button", { name: t.shareToTeams }));
    await waitFor(() => expect(share).toHaveBeenCalledTimes(1));
    expect((share.mock.calls[0][0] as { url: string }).url).toBe(rotated);
  });

  it("YouTube room shares natively with the SAME canonical URL (content-agnostic)", async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    setNativeShare(share);
    render(<FoundryShareControls event={docEvent({ content_type: "youtube", document: undefined })} locale="en" t={t} />);
    fireEvent.click(screen.getByRole("button", { name: t.shareToTeams }));
    await waitFor(() => expect(share).toHaveBeenCalledTimes(1));
    const payload = share.mock.calls[0][0] as { text: string; url: string };
    expect(payload.url).toBe(URL);
    expect(payload.text).toContain("Watch the training video and complete the reflection.");
  });

  it("popup BLOCKED → copies invitation + 'ready to paste' fallback (never claims shared)", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    setClipboard(writeText);
    vi.stubGlobal("open", vi.fn(() => null));
    render(<FoundryShareControls event={docEvent()} locale="en" t={t} />);
    fireEvent.click(screen.getByRole("button", { name: t.shareToTeams }));
    await waitFor(() => expect(writeText).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(screen.getAllByText(t.readyToPaste).length).toBeGreaterThan(0));
    expect(screen.queryByText(/shared to teams/i)).toBeNull();
  });
});

describe("FoundryShareControls — YouTube copy variant", () => {
  it("YouTube event copies the watch instruction, not the reading line", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    setClipboard(writeText);
    render(<FoundryShareControls event={docEvent({ content_type: "youtube", document: undefined })} locale="en" t={t} />);
    fireEvent.click(screen.getByRole("button", { name: t.copyInvitation }));
    await waitFor(() => expect(writeText).toHaveBeenCalled());
    const copied = writeText.mock.calls[0][0] as string;
    expect(copied).toContain("Watch the training video and complete the reflection.");
    expect(copied).not.toContain("reading progress");
    expect(copied).toContain(URL);
  });
});
