/** @vitest-environment jsdom */
import {afterEach,describe,it,expect,vi} from 'vitest';
import {act,cleanup,fireEvent,render,screen,waitFor} from '@testing-library/react';
vi.mock('next/navigation',()=>({useRouter:()=>({push:vi.fn()})}));
vi.mock('@/components/app-shell/FieldActionForm',()=>({default:({onBack}:{onBack:()=>void})=><button onClick={onBack}>Return after submit</button>}));
vi.mock('@/components/app-shell/HostActionReviewDetail',()=>({default:({onBack}:{onBack:()=>void})=><button onClick={onBack}>Return after review</button>}));
import FieldActionsFocus from '@/components/app-shell/FieldActionsFocus';
afterEach(()=>{cleanup();vi.unstubAllGlobals()});
const response=(body:unknown)=>Response.json(body);
describe('field action return reflects acknowledged server change',()=>{
 it('re-reads learner group after canonical child returns from successful submission',async()=>{
  let submitted=false;
  vi.stubGlobal('fetch',vi.fn(async(url:string)=>{
   if(String(url).includes('/action-contract/mine'))return response({ok:true,items:[{contractId:'contract-a',status:submitted?'submitted':'rejected',who:'A',what:'Try plan',contractDescription:'Try plan',revisionNote:submitted?null:'Specify how',reviewedAt:null}]});
   return response({ok:true,items:[],stageCounts:null});
  }));
  render(<FieldActionsFocus locale="en" onBack={()=>{}}/>);
  const item=await screen.findByTestId('fa-item');expect(item.getAttribute('data-group')).toBe('needs_revision');
  fireEvent.click(item);submitted=true;fireEvent.click(await screen.findByText('Return after submit'));
  await waitFor(()=>expect(screen.getByTestId('fa-item').getAttribute('data-group')).toBe('awaiting_review'));
 });
 it('removes a completed host-review item after returning from canonical review child',async()=>{
  let reviewed=false;
  vi.stubGlobal('fetch',vi.fn(async(url:string)=>{
   if(String(url).includes('/action-contract/mine'))return response({ok:true,items:[]});
   if(String(url).includes('/action-review-queue'))return response({items:reviewed?[]:[{actionContractId:'review-a',learnerLabel:'A',actionSummary:'Try plan',submittedAt:null,statusLabel:'Submitted'}],stageCounts:{verificationPending:reviewed?0:1,needsRevision:0,reviewedAccepted:0,awaitingResolution:0}});
   return response({ok:true,items:[]});
  }));
  render(<FieldActionsFocus locale="en" onBack={()=>{}}/>);
  fireEvent.click(await screen.findByTestId('fa-host-queue-item'));reviewed=true;fireEvent.click(await screen.findByText('Return after review'));
  await waitFor(()=>expect(screen.queryByTestId('fa-host-queue-item')).toBeNull());
 });
});

it('does not overwrite a newer inventory with a late response from the prior locale',async()=>{
 let oldReply:(value:Response)=>void=()=>{};let reads=0;
 const item=(status:string)=>({contractId:'contract-a',status,who:'A',what:'Try plan',contractDescription:'Try plan',revisionNote:null,reviewedAt:null});
 vi.stubGlobal('fetch',vi.fn(async(url:string)=>{
  if(String(url).includes('/action-contract/mine')){
   reads++;
   if(reads===1)return new Promise<Response>(resolve=>{oldReply=resolve});
   return response({ok:true,items:[item('approved')]});
  }
  return response({ok:true,items:[],stageCounts:null});
 }));
 const {rerender}=render(<FieldActionsFocus locale="en" onBack={()=>{}}/>);
 rerender(<FieldActionsFocus locale="ko" onBack={()=>{}}/>);
 expect((await screen.findByTestId('fa-item')).getAttribute('data-group')).toBe('reviewed');
 await act(async()=>{oldReply(response({ok:true,items:[item('rejected')]}));await Promise.resolve();await Promise.resolve();});
 expect(screen.getByTestId('fa-item').getAttribute('data-group')).toBe('reviewed');
});
it('does not present stale learner state when the return reconciliation fails',async()=>{
 let afterSave=false;
 vi.stubGlobal('fetch',vi.fn(async(url:string)=>{
  if(String(url).includes('/action-contract/mine'))return afterSave?new Response('{}',{status:500}):response({ok:true,items:[{contractId:'contract-a',status:'rejected',who:'A',what:'Try plan',contractDescription:'Try plan',revisionNote:null,reviewedAt:null}]});
  return response({ok:true,items:[],stageCounts:null});
 }));
 render(<FieldActionsFocus locale="en" onBack={()=>{}}/>);
 fireEvent.click(await screen.findByTestId('fa-item'));afterSave=true;fireEvent.click(await screen.findByText('Return after submit'));
 expect(await screen.findByTestId('fa-error')).toBeTruthy();
 expect(screen.queryByTestId('fa-item')).toBeNull();
});
