/** @vitest-environment jsdom */
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
const H = vi.hoisted(() => ({ open: vi.fn() }));
vi.mock("@/lib/supabase", () => ({ supabase: null }));
vi.mock("@/lib/bty/teams/openSourceLink", () => ({ openSourceLink: H.open }));
import TrackingSent from "@/components/app-shell/TrackingSent";
const url = "https://teams.microsoft.com/l/message/synthetic/message";
const item = { id: "a", hostFraming: "Synthetic QA", createdAt: "2026-10-01T00:00:00Z", previewText: null, sourceUrl: url,
 status: "active", funnel: { announcedTo: 1, gotIt: 1, question: 0, needHelp: 0, noResponse: 0, notYetActivated: 0 },
 responders: { acknowledged: [], question: [], needHelp: [], noResponse: [] } };
afterEach(() => { cleanup(); vi.clearAllMocks(); vi.unstubAllGlobals(); });
function mount(){
 vi.stubGlobal("fetch", vi.fn(async()=>new Response(JSON.stringify({ok:true,items:[item]}))));
 render(<TrackingSent locale="en"/>);
}
describe("Track source uses the established Teams-aware opener",()=>{
 it("opens the stored source without an uncontrolled _blank navigation",async()=>{
  H.open.mockResolvedValue(true);mount();
  const open=await screen.findByTestId("tracking-source-link");
  fireEvent.click(open);
  await waitFor(()=>expect(H.open).toHaveBeenCalledWith(url));
  expect(open.getAttribute("href")).toBeNull();
 });
 it("preserves the Track and displays a failed source open",async()=>{
  H.open.mockResolvedValue(false);mount();
  fireEvent.click(await screen.findByTestId("tracking-source-link"));
  expect(await screen.findByRole("alert")).toBeTruthy();
  expect(screen.getByTestId("tracking-item")).toBeTruthy();
 });
});
