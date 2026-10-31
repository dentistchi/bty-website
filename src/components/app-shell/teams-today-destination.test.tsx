/** @vitest-environment jsdom */
import {afterEach,describe,it,expect,vi} from 'vitest';
import {cleanup,fireEvent,render,screen} from '@testing-library/react';
vi.mock('next/navigation',()=>({useRouter:()=>({push:vi.fn()}),usePathname:()=>'/teams',useSearchParams:()=>new URLSearchParams()}));
vi.mock('@/components/LangSwitch',()=>({LangSwitch:()=>null}));
vi.mock('@/components/app-shell/TodayHome',()=>({default:({onOpenItem}:{onOpenItem:(href:string)=>boolean})=><button onClick={()=>onOpenItem('/en/app?tab=foundry&assignment=11111111-2222-4333-8444-555555555555')}>Open required learning</button>}));
vi.mock('@/components/app-shell/LearnHeader',()=>({default:()=>null}));
vi.mock('@/components/foundry/event-rooms/FoundryEventRooms',()=>({default:()=> <div data-testid="learning-surface">learning</div>}));
import BtyDailyAppShell from '@/components/app-shell/BtyDailyAppShell';
afterEach(()=>{cleanup();vi.unstubAllGlobals();window.history.replaceState({},'', '/');});
describe('Today destination keeps the active document frame-safe',()=>{
 it('keeps /teams while opening the requested in-shell learning destination',async()=>{
  vi.stubGlobal('fetch',vi.fn(async()=>Response.json({ok:true,items:[]})));
  window.history.replaceState({},'', '/teams');
  render(<BtyDailyAppShell locale="en" runtime="teams"/>);
  fireEvent.click(await screen.findByText('Open required learning'));
  expect(screen.getByTestId('learning-surface')).toBeTruthy();
  expect(window.location.pathname).toBe('/teams');
  expect(new URLSearchParams(window.location.search).get('assignment')).toBe('11111111-2222-4333-8444-555555555555');
 });
 it('keeps the normal canonical app address on the web',async()=>{
  vi.stubGlobal('fetch',vi.fn(async()=>Response.json({ok:true,items:[]})));
  window.history.replaceState({},'', '/en/app');
  render(<BtyDailyAppShell locale="en" runtime="web"/>);
  fireEvent.click(await screen.findByText('Open required learning'));
  expect(window.location.pathname).toBe('/en/app');
 });
});
