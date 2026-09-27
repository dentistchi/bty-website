import { describe, it, expect } from "vitest";
import { isTrackingMode, trackingComplete, trackingState, summariseTracking, TRACKING_COPY, type TrackingEvidence } from "./trackingEvidence";
import { parseTeamsTrackSubmission } from "@/domain/teams/invokeActivity";
import { trackDialogCard } from "@/lib/bty/teams/trackDialogCard";
import { selectTodayOpenWork } from "@/domain/daily/todayOpenWork";
const empty: TrackingEvidence = { trackingMode:"acknowledgment", openedAt:null, acknowledgedAt:null, responseSubmittedAt:null };
describe("announcement evidence contract",()=> {
 it.each(["acknowledgment","response"] as const)("serializes and parses explicit %s without a default", mode=> {
  for(const locale of ["en","ko"] as const) {
   const card=trackDialogCard(locale).card.content;
   const choice=card.body.find(x=>"id" in x && x.id==="trackingMode");
   expect(choice).toMatchObject({isMultiSelect:false,choices:expect.arrayContaining([{title:TRACKING_COPY[locale][mode],value:mode}])});
   expect(choice).not.toHaveProperty("value");
   const submitted=JSON.parse(JSON.stringify({value:{data:{hostFraming:"Notice",recipients:"00000000-0000-0000-0000-000000000001",trackingMode:mode}}}));
   expect(parseTeamsTrackSubmission(submitted)).toMatchObject({ok:true,trackingMode:mode});
  }
 });
 it("refuses omitted or invented modes",()=> {
  for(const trackingMode of [undefined,null,"legacy","ACKNOWLEDGED",""]) {
   expect(isTrackingMode(trackingMode)).toBe(false);
   expect(parseTeamsTrackSubmission({value:{data:{hostFraming:"Notice",recipients:"person",trackingMode}}})).toEqual({ok:false,code:"missing_mode"});
  }
 });
 it("targeted/opened cannot complete either mode; each mode requires its own explicit action",()=> {
  for(const trackingMode of ["acknowledgment","response"] as const) {
   const opened={...empty,trackingMode,openedAt:"time"};
   expect(trackingState({...empty,trackingMode})).toBe("targeted");
   expect(trackingState(opened)).toBe("opened");expect(trackingComplete(opened)).toBe(false);
   expect(trackingComplete({...opened,acknowledgedAt:"time"})).toBe(trackingMode==="acknowledgment");
   expect(trackingComplete({...opened,responseSubmittedAt:"time"})).toBe(trackingMode==="response");
  }
 });
 it("host counts agree with ten individual states and Today/reminder use the same completion rule",()=> {
  const rows=Array.from({length:10},()=>({...empty}));
  rows[0].openedAt="time"; rows[1].openedAt="time"; rows[1].acknowledgedAt="time";
  rows[2]={...empty,trackingMode:"response",responseSubmittedAt:"time"};
  const counts=summariseTracking(10,rows);
  expect(counts).toEqual({targeted:10,opened:2,acknowledged:1,responded:1,remaining:8});
  expect(selectTodayOpenWork([],[],rows).openCount).toBe(counts.remaining);
  expect(selectTodayOpenWork([],[],rows.filter(trackingComplete)).openCount).toBe(0);
 });
 it("legacy rows are not silently assigned a mode or completion evidence",()=> {
  expect(trackingComplete({...empty,trackingMode:null,acknowledgedAt:"legacy-time"})).toBe(false);
  expect(selectTodayOpenWork([],[],[{...empty,trackingMode:null}]).openCount).toBe(0);
 });
});
