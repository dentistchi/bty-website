// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react';
import { renderGuest } from '@/components/guest/guest-test-render';
import RequestForm from './RequestForm';
import { guestNameKey } from '@/domain/guest-identity';

beforeEach(() => {
  window.localStorage.clear();
  vi.stubGlobal('fetch', vi.fn(async () => ({
    ok: true, status: 200, json: async () => ({ items: [] }),
  })));
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

const searchCalls = () => vi.mocked(fetch).mock.calls.filter(([url]) => String(url).startsWith('/api/youtube/search?'));

describe('BTY song picks reuse the guest search', () => {
  it('shows the guest catalog expanded without focusing search or fetching', () => {
    renderGuest(<RequestForm slug="bty-home" roomOpen />);
    expect(screen.getByText('BTY 추천곡').closest('details')!.open).toBe(true);
    expect(screen.getAllByRole('button', { name: /반주 찾기$/ })).toHaveLength(10);
    expect(document.activeElement).not.toBe(screen.getByPlaceholderText('노래 제목 또는 가수'));
    fireEvent.click(screen.getByRole('button', { name: '팝송' }));
    expect(screen.getByText('Just the Way You Are')).toBeTruthy();
    expect(searchCalls()).toHaveLength(0);
    expect(vi.mocked(fetch).mock.calls.some(([, options]) => options?.method === 'POST')).toBe(false);
  });

  it('searches the selected title, not stale typed text, and preserves the selected style', async () => {
    renderGuest(<RequestForm slug="bty-home" roomOpen />);
    const input = screen.getByPlaceholderText('노래 제목 또는 가수') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'previous typed query' } });
    fireEvent.click(screen.getByRole('button', { name: 'DAY6 한 페이지가 될 수 있게 반주 찾기' }));
    await waitFor(() => expect(searchCalls()).toHaveLength(1));
    const url = new URL(String(searchCalls()[0][0]), 'http://localhost');
    expect(url.pathname).toBe('/api/youtube/search');
    expect(url.searchParams.get('q')).toBe('DAY6 한 페이지가 될 수 있게');
    expect(url.searchParams.get('style')).toBe('mr');
    expect(input.value).toBe('DAY6 한 페이지가 될 수 있게');
    expect(screen.getByText('BTY 추천곡').closest('details')!.open).toBe(false);
  });

  it('keeps the existing honest quota fallback after choosing a song', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true, status: 200,
      json: async () => ({ items: [], degraded: true, quotaExceeded: true, fallbackUrl: 'https://www.youtube.com/results?search_query=DAY6' }),
    })));
    renderGuest(<RequestForm slug="bty-home" roomOpen />);
    fireEvent.click(screen.getByRole('button', { name: 'DAY6 한 페이지가 될 수 있게 반주 찾기' }));
    await waitFor(() => expect(screen.getByText(/오늘 YouTube 검색 한도를 모두 사용했어요/)).toBeTruthy());
    expect(screen.getByText('YouTube 링크 직접 붙여넣기')).toBeTruthy();
  });

  it('does not start a search from picks in a closed room', () => {
    renderGuest(<RequestForm slug="bty-home" roomOpen={false} />);
    const button = screen.getByRole('button', { name: 'DAY6 한 페이지가 될 수 있게 반주 찾기' });
    expect((button as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(button);
    expect(searchCalls()).toHaveLength(0);
  });

  it('requests only the selected provider result and preserves its provenance', async () => {
    const item = {
      videoId: 'fixture1234', title: 'DAY6 한 페이지가 될 수 있게 MR',
      channelTitle: 'Test provider', thumbnailUrl: null,
      youtubeProvenance: 'fixture-provider-seal', durationSeconds: 205, durationAdmission: 'fits',
    };
    const submitted = vi.fn();
    window.localStorage.setItem(guestNameKey('bty-home'), 'Guest');
    vi.stubGlobal('fetch', vi.fn(async (url: unknown, options?: RequestInit) => {
      const path = String(url);
      let body: Record<string, unknown> = {};
      if (path.startsWith('/api/youtube/search?')) body = { items: [item] };
      if (path.endsWith('/requests') && options?.method === 'POST') {
        body = { ok: true, request: { id: 'req-fixture', youtube_video_id: item.videoId, youtube_title: item.title }, cancelToken: 'fixture-cancel' };
      }
      return { ok: true, status: 200, headers: new Headers(), json: async () => body };
    }));
    renderGuest(<RequestForm slug="bty-home" roomOpen onSubmitted={submitted} />);
    fireEvent.click(screen.getByRole('button', { name: 'DAY6 한 페이지가 될 수 있게 반주 찾기' }));
    const requestButton = await screen.findByRole('button', { name: `${item.title} 신청하기` });
    // Choosing an editorial title must never auto-submit a provider video.
    expect(vi.mocked(fetch).mock.calls.filter(([url, options]) => String(url).endsWith('/requests') && options?.method === 'POST')).toHaveLength(0);
    fireEvent.click(requestButton);
    await waitFor(() => expect(submitted).toHaveBeenCalledOnce());
    const post = vi.mocked(fetch).mock.calls.find(([url, options]) => String(url).endsWith('/requests') && options?.method === 'POST');
    const payload = JSON.parse(String(post![1]!.body));
    expect(payload.youtubeVideoId).toBe(item.videoId);
    expect(payload.youtubeTitle).toBe(item.title);
    expect(payload.youtubeProvenance).toBe(item.youtubeProvenance);
    expect(payload.idempotencyKey).toBeTruthy();
  });

  it('shows the same catalog with English controls for English guests', () => {
    renderGuest(<RequestForm slug="bty-home" roomOpen />, 'en');
    expect(screen.getByText('BTY song picks').closest('details')!.open).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'Pop songs' }));
    expect(screen.getByRole('button', { name: 'Find a track for Perfect by Ed Sheeran' })).toBeTruthy();
    expect(searchCalls()).toHaveLength(0);
  });
});
