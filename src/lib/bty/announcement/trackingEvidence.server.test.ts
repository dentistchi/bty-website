import { selectTodayOpenWork } from "@/domain/daily/todayOpenWork";
import { describe,it,expect,vi } from "vitest";
import { listMyAnnouncements,listHostAnnouncements } from "./announcementService.server";
vi.mock("./recipientDisplayName.server",()=>({resolveDisplayNames:async()=>new Map()}));
vi.mock("./announcementThread.server",()=>({allMessageIds:()=>[],loadReadReceipts:async()=>new Set(),loadThreadMeta:async()=>new Map(),messageCountFrom:()=>0,unreadFrom:()=>0}));
vi.mock("@/lib/bty/daily/todayDismissal.server",()=>({loadTodayDismissals:async()=>new Map()}));
function db(rows: Record<string,unknown[]>) {
 const filters: unknown[]=[];
 return {filters,client:{from:(table:string)=> {
  const q={select:()=>q,eq:(k:string,v:unknown)=>{filters.push([table,k,v]);return q;},in:()=>q,order:()=>q,returns:async()=>({data:rows[table]??[],error:null})};return q;
 }} as never};
}
const ann={id:"a",host_framing:"Notice",status:"active",tracking_mode:"acknowledgment",owner_user_id:"owner",resolved_count:10,bty_action_captures:{source_url:"https://teams.microsoft.com/x"}};
const row={id:"r",announcement_id:"a",response:null,responded_at:null,opened_at:null,acknowledged_at:null,response_submitted_at:null,bty_tracked_announcements:ann};
describe("V1 projections and Today membership",()=> {
 it("open remains Today; acknowledgment moves exactly to Past; response mode ignores acknowledgment",async()=> {
  const fixture={...row};const {client}=db({bty_tracked_announcement_recipients:[fixture]});
  fixture.opened_at="now" as never;
  expect(await listMyAnnouncements(client,"person")).toHaveLength(1);
  fixture.acknowledged_at="now" as never;
  expect(await listMyAnnouncements(client,"person")).toHaveLength(0);
  expect(await listMyAnnouncements(client,"person",{scope:"past"})).toHaveLength(1);
  fixture.bty_tracked_announcements={...ann,tracking_mode:"response"};
  expect(await listMyAnnouncements(client,"person")).toHaveLength(1);
  fixture.response_submitted_at="now" as never;
  expect(await listMyAnnouncements(client,"person")).toHaveLength(0);
 });
 it("legacy acknowledged rows retain the existing Today behavior",async()=> {
  const {client}=db({bty_tracked_announcement_recipients:[{...row,response:"ACKNOWLEDGED",responded_at:"legacy",bty_tracked_announcements:{...ann,tracking_mode:null}}]});
  const items=await listMyAnnouncements(client,"person");expect(items).toHaveLength(1);expect(items[0].trackingMode).toBeNull();expect(items[0].acknowledgedAt).toBeNull();
 });
 it("host sees all ten targeted people, including unbound, and counts match rows",async()=> {
  const rows=Array.from({length:10},(_,i)=>({...row,id:String(i),user_id:i===9?null:"user",opened_at:i<4?"now":null,acknowledged_at:i<2?"now":null}));
  const {client,filters}=db({bty_tracked_announcements:[ann],bty_tracked_announcement_recipients:rows});
  const [host]=await listHostAnnouncements(client,"owner");expect(host.tracking).toEqual({targeted:10,opened:4,acknowledged:2,responded:0,remaining:8});expect(host.audience).toHaveLength(10);
  expect(filters).toContainEqual(["bty_tracked_announcements","owner_user_id","owner"]);
 });
});

it.each([[null,null],["opened",null],["opened","ack"]])("legacy responded_at is never required-response evidence (%s,%s)",async(opened,ack)=> {
 const responseAnn={...ann,tracking_mode:"response",resolved_count:1};
 const shadow={...row,user_id:"person",response:"ACKNOWLEDGED",responded_at:"legacy-shadow",opened_at:opened,acknowledged_at:ack,response_submitted_at:null,bty_tracked_announcements:responseAnn};
 const {client}=db({bty_tracked_announcements:[responseAnn],bty_tracked_announcement_recipients:[shadow]});
 const pending=await listMyAnnouncements(client,"person");expect(pending).toHaveLength(1);
 expect(pending[0].responseSubmittedAt).toBeNull();
 const [host]=await listHostAnnouncements(client,"owner");
 expect(host.tracking?.responded).toBe(0);expect(host.tracking?.remaining).toBe(1);expect(host.responders.noResponse).toHaveLength(1);
 // Both Today and the 08:00 native reminder consume this production selector.
 expect(selectTodayOpenWork([],[],pending).openCount).toBe(1);
});
