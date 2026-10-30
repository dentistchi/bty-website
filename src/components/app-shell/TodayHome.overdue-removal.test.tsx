/** @vitest-environment jsdom */
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import TodayHome from "@/components/app-shell/TodayHome";

afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });
const attention = { stableId:"host-followup-overdue:fu1",category:"FOLLOW_UP_OVERDUE",eventId:"event-1",focusId:"fu1",
  participantDisplayName:"Synthetic learner",trainingTitle:"Synthetic test training",reason:"7-day follow-up has not been answered",
  deepLink:"/en/app?tab=foundry&event=event-1&section=followups&focus=fu1",canRemoveTraining:true };
const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status});
function stub({failRemoval=false,closed=true}={}) {
  let removed=false;
  const fetcher=vi.fn(async (url:unknown,init?:RequestInit) => {
    const u=String(url);
    if(u.includes("/api/bty/foundry/event-history/event-1/dismiss")) {
      if(failRemoval)return json({ok:false,error:"WRITE_FAILED"},500);
      removed=true;return json({ok:true,changed:true});
    }
    if(u.includes("/api/me/today/brief"))return json({ok:true,reminders:[],hostAttention:removed?[]:[{...attention,canRemoveTraining:closed}]});
    return json({ok:true,items:[],programs:[],practices:[],counts:null,dailyTrace:[]});
  });
  vi.stubGlobal("fetch",fetcher);
  vi.spyOn(window,"confirm").mockReturnValue(true);
  return {fetcher,setRemoved:()=>{removed=true;}};
}
describe("prelaunch Today overdue cleanup",()=>{
  it("personally removes the closed training through the existing owned endpoint",async()=>{
    const {fetcher}=stub();
    render(<TodayHome locale="en" onNavigate={()=>{}} />);
    fireEvent.click(await screen.findByRole("button",{name:"Remove training"}));
    await waitFor(()=>expect(screen.queryByTestId("today-followup-row")).toBeNull());
    expect(fetcher.mock.calls.some(([url,init])=>String(url).includes("event-history/event-1/dismiss")&&init?.method==="POST")).toBe(true);
  });
  it("keeps the training visible and explains a failed removal",async()=>{
    stub({failRemoval:true});
    render(<TodayHome locale="en" onNavigate={()=>{}} />);
    fireEvent.click(await screen.findByRole("button",{name:"Remove training"}));
    expect(await screen.findByRole("alert")).toBeTruthy();
    expect(screen.getByTestId("today-followup-row")).toBeTruthy();
  });
  it("does not claim the day is caught up while Host follow-ups remain",async()=>{
    stub();
    render(<TodayHome locale="en" onNavigate={()=>{}} />);
    await screen.findByTestId("today-followup-row");
    expect(screen.queryByText("You're all caught up for today.")).toBeNull();
    expect(screen.getByText("Your team has follow-ups below.")).toBeTruthy();
  });
  it("does not offer personal hiding for active open training",async()=>{
    stub({closed:false});
    render(<TodayHome locale="en" onNavigate={()=>{}} />);
    await screen.findByTestId("today-followup-row");
    expect(screen.queryByRole("button",{name:"Remove training"})).toBeNull();
    expect(screen.getByText("Training is open. Open it to close the session before removing it.")).toBeTruthy();
  });
  it("rereads the brief on Today reselect instead of preserving stale overdue rows",async()=>{
    const world=stub();
    const view=render(<TodayHome locale="en" refreshKey={0} onNavigate={()=>{}} />);
    await screen.findByTestId("today-followup-row");
    world.setRemoved();
    view.rerender(<TodayHome locale="en" refreshKey={1} onNavigate={()=>{}} />);
    await waitFor(()=>expect(screen.queryByTestId("today-followup-row")).toBeNull());
    expect(world.fetcher.mock.calls.filter(([url])=>String(url).includes("/api/me/today/brief"))).toHaveLength(2);
  });
});
