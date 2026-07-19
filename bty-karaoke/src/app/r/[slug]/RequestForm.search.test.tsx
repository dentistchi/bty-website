// @vitest-environment jsdom
//
// Search-note copy: the daily YouTube quota-exhausted state must be HONEST and
// distinct from a temporary blip, and the direct-link paste path must stay usable.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import RequestForm from './RequestForm';

function installFetch(searchResp: Record<string, unknown>) {
  global.fetch = vi.fn(async (url: unknown) => {
    const u = String(url);
    const body = u.includes('/api/youtube/search') ? searchResp : { items: [] };
    return { ok: true, status: 200, headers: { get: () => null }, json: async () => body };
  }) as unknown as typeof fetch;
}

async function runSearch(query = '아이유 밤편지') {
  const input = screen.getByPlaceholderText('노래 제목 또는 가수') as HTMLInputElement;
  fireEvent.change(input, { target: { value: query } });
  fireEvent.submit(input.closest('form')!);
}

const base = { ok: false, gated: false, items: [], fallbackUrl: 'https://www.youtube.com/results?search_query=x' };

beforeEach(() => window.localStorage.clear());
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('search-note copy — quota vs temporary vs direct-link', () => {
  it('quota exhausted → daily-limit copy, NOT "검색이 잠시 붐벼요"', async () => {
    installFetch({ ...base, degraded: true, quotaExceeded: true });
    render(<RequestForm slug="bty-home" roomOpen eventId="evt-1" />);
    await runSearch();
    await waitFor(() => expect(screen.getByText(/오늘 YouTube 검색 한도를 모두 사용했어요/)).toBeTruthy());
    expect(screen.queryByText(/검색이 잠시 붐벼요/)).toBeNull();
    // The direct-link paste path stays visible/usable.
    expect(screen.getByText('YouTube 링크 직접 붙여넣기')).toBeTruthy();
  });

  it('temporary upstream failure (degraded, not quota) → "검색이 잠시 붐벼요" (different copy)', async () => {
    installFetch({ ...base, degraded: true, quotaExceeded: false });
    render(<RequestForm slug="bty-home" roomOpen eventId="evt-1" />);
    await runSearch();
    await waitFor(() => expect(screen.getByText(/검색이 잠시 붐벼요/)).toBeTruthy());
    expect(screen.queryByText(/오늘 YouTube 검색 한도/)).toBeNull();
  });
});
