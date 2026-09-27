/** @vitest-environment jsdom */
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { AnnouncementEvidenceCard } from "./AnnouncementEvidenceCard";
import AnnouncementTrackingSummary from "./AnnouncementTrackingSummary";
import { TRACKING_COPY, summariseTracking, type TrackingEvidence } from "@/domain/announcement/trackingEvidence";
afterEach(()=> {cleanup();vi.unstubAllGlobals();});
const evidence:TrackingEvidence={trackingMode:"acknowledgment",openedAt:null,acknowledgedAt:null,responseSubmittedAt:null};
const item={...evidence,announcementId:"fixture",hostFraming:"Notice",sourceUrl:"https://teams.microsoft.com/l/message/fixture"};
describe("announcement V1 screens",()=> {
 it.each(["en","ko"] as const)("%s: opening is separate from acknowledging, with a real Teams source link",async locale=> {
  const t=TRACKING_COPY[locale];const fetch=vi.fn(async(_url: unknown, _init?: RequestInit)=>new Response('{"ok":true}'));vi.stubGlobal("fetch",fetch);
  const changed=vi.fn(async()=>{});
  render(<AnnouncementEvidenceCard item={item} locale={locale} onChanged={changed}/>);
  expect(fetch).not.toHaveBeenCalled();
  expect(screen.queryByText("Notice")).toBeNull();
  fireEvent.click(screen.getByText(t.open));await screen.findByText("Notice");
  expect(JSON.parse(fetch.mock.calls[0][1]!.body as string)).toEqual({action:"open"});
  expect(screen.getByText(t.source).getAttribute("href")).toBe(item.sourceUrl);
  fireEvent.click(screen.getByText(t.acknowledge));
  await waitFor(()=>expect(changed).toHaveBeenCalledTimes(2));
  expect(JSON.parse(fetch.mock.calls[1][1]!.body as string)).toEqual({action:"acknowledge"});
 });
 it.each(["en","ko"] as const)("%s: response cannot be replaced by acknowledgment or empty submission",async locale=> {
  const t=TRACKING_COPY[locale];const fetch=vi.fn(async(_url: unknown, _init?: RequestInit)=>new Response('{"ok":true}'));vi.stubGlobal("fetch",fetch);
  render(<AnnouncementEvidenceCard item={{...item,trackingMode:"response"}} locale={locale} onChanged={async()=>{}}/>);
  fireEvent.click(screen.getByText(t.open));await screen.findByText(t.answer);
  expect(screen.queryByText(t.acknowledge)).toBeNull();
  expect((screen.getByText(t.submit) as HTMLButtonElement).disabled).toBe(true);
  fireEvent.change(screen.getByLabelText(t.answer),{target:{value:"My answer"}});
  fireEvent.click(screen.getByText(t.submit));
  await waitFor(()=>expect(fetch).toHaveBeenCalledTimes(2));
  expect(JSON.parse(fetch.mock.calls[1][1]!.body as string)).toEqual({action:"respond",text:"My answer"});
 });
 it("failure stays visible and does not claim recorded evidence",async()=> {
  vi.stubGlobal("fetch",vi.fn(async(_url: unknown, _init?: RequestInit)=>new Response('{}',{status:409})));
  const changed=vi.fn(async()=>{});render(<AnnouncementEvidenceCard item={item} locale="ko" onChanged={changed}/>);
  fireEvent.click(screen.getByText(TRACKING_COPY.ko.open));await screen.findByRole("alert");expect(changed).not.toHaveBeenCalled();
 });
 it.each(["en","ko"] as const)("%s: host denominator includes unbound recipients and honest evidence states",locale=> {
  const audience=Array.from({length:10},(_,i)=>({...evidence,recipientId:String(i),display:null,responseText:null}));
  audience[0].openedAt="now";audience[1].acknowledgedAt="now";
  render(<AnnouncementTrackingSummary counts={summariseTracking(10,audience)} audience={audience} locale={locale}/>);
  expect(screen.getAllByRole("listitem")).toHaveLength(10);
  expect(screen.getByText("10")).toBeTruthy();
  expect(screen.getAllByText(TRACKING_COPY[locale].noEvidence)).toHaveLength(8);
  expect(document.body.textContent).not.toMatch(/unread|읽지 않음/i);
 });
});
