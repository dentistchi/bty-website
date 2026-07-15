import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Decouple from .dev.vars: read the key straight from process.env so these
// tests are deterministic regardless of local secret files.
vi.mock('./env.server', () => ({
  optionalEnv: (name: string) => {
    const v = process.env[name];
    return v && v.trim() ? v.trim() : undefined;
  },
}));

import { searchYoutube, searchYoutubeWithCache, type SearchKv } from './youtube.server';

const ORIGINAL_KEY = process.env.YOUTUBE_API_KEY;

afterEach(() => {
  if (ORIGINAL_KEY === undefined) delete process.env.YOUTUBE_API_KEY;
  else process.env.YOUTUBE_API_KEY = ORIGINAL_KEY;
  vi.unstubAllGlobals();
});

describe('searchYoutube — credential gate', () => {
  beforeEach(() => delete process.env.YOUTUBE_API_KEY);

  it('is gated (no network) when the API key is absent, with a fallback url', async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);

    const r = await searchYoutube('아이유 밤편지');
    expect(r.gated).toBe(true);
    expect(r.ok).toBe(false);
    expect(r.items).toEqual([]);
    expect(r.fallbackUrl).toContain('search_query=');
    expect(r.biasedQuery).toBe('아이유 밤편지 노래방');
    expect(fetchSpy).not.toHaveBeenCalled(); // never hit the network without a key
  });
});

describe('searchYoutube — Performance Style bias', () => {
  beforeEach(() => delete process.env.YOUTUBE_API_KEY); // gated: no network, biasedQuery only

  it('MR style biases toward instrumental (non-Korean) / MR (Korean)', async () => {
    vi.stubGlobal('fetch', vi.fn());
    expect((await searchYoutube('Dancing Queen', { style: 'mr' })).biasedQuery).toBe(
      'Dancing Queen instrumental',
    );
    expect((await searchYoutube('아이유 밤편지', { style: 'mr' })).biasedQuery).toBe('아이유 밤편지 MR 반주');
  });

  it('Karaoke style biases toward 노래방 / karaoke', async () => {
    vi.stubGlobal('fetch', vi.fn());
    expect((await searchYoutube('밤편지', { style: 'karaoke' })).biasedQuery).toBe('밤편지 노래방');
  });

  it('Original style sends the raw query (no bias)', async () => {
    vi.stubGlobal('fetch', vi.fn());
    expect((await searchYoutube('Dancing Queen', { style: 'original' })).biasedQuery).toBe(
      'Dancing Queen',
    );
  });
});

describe('searchYoutube — with key', () => {
  beforeEach(() => {
    process.env.YOUTUBE_API_KEY = 'test-key';
  });

  it('projects safe items on success and never leaks the key', async () => {
    let calledUrl = '';
    vi.stubGlobal(
      'fetch',
      vi.fn(async (u: URL) => {
        calledUrl = u.toString();
        return {
          ok: true,
          json: async () => ({
            items: [
              {
                id: { videoId: 'dQw4w9WgXcQ' },
                snippet: {
                  title: 'IU &#39;Blueming&#39;',
                  channelTitle: 'IU',
                  thumbnails: { medium: { url: 'http://d/m.jpg' } },
                },
              },
            ],
          }),
        };
      }),
    );

    const r = await searchYoutube('IU Blueming');
    expect(r.ok).toBe(true);
    expect(r.gated).toBe(false);
    expect(r.degraded).toBe(false);
    expect(r.items).toEqual([
      {
        videoId: 'dQw4w9WgXcQ',
        title: "IU 'Blueming'",
        channelTitle: 'IU',
        thumbnailUrl: 'http://d/m.jpg',
      },
    ]);
    expect(calledUrl).toContain('key=test-key'); // sent to google, not to our client
  });

  it('degrades with a fallback url when the API fails/quota', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 403, json: async () => ({}) })));
    const r = await searchYoutube('IU Blueming');
    expect(r.degraded).toBe(true);
    expect(r.ok).toBe(false);
    expect(r.items).toEqual([]);
    expect(r.fallbackUrl).toContain('IU%20Blueming%20karaoke');
  });
});

describe('searchYoutubeWithCache — KV cache', () => {
  const ITEM = { videoId: 'v1', title: 'T', channelTitle: 'C', thumbnailUrl: null };

  beforeEach(() => {
    process.env.YOUTUBE_API_KEY = 'test-key';
  });

  it('returns cached items without hitting the API', async () => {
    const kv: SearchKv = {
      get: vi.fn(async () => [ITEM]),
      put: vi.fn(async () => {}),
    };
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);

    const r = await searchYoutubeWithCache('IU', kv);
    expect(r.ok).toBe(true);
    expect(r.items).toEqual([ITEM]);
    expect(kv.get).toHaveBeenCalledWith('ytq:IU karaoke', 'json');
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(kv.put).not.toHaveBeenCalled();
  });

  it('on a cache miss, fetches then writes the result under the biased-query key', async () => {
    const kv: SearchKv = {
      get: vi.fn(async () => null),
      put: vi.fn(async () => {}),
    };
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        json: async () => ({
          items: [{ id: { videoId: 'v1' }, snippet: { title: 'T', channelTitle: 'C' } }],
        }),
      })),
    );

    const r = await searchYoutubeWithCache('IU', kv);
    expect(r.items).toHaveLength(1);
    expect(kv.put).toHaveBeenCalledTimes(1);
    expect((kv.put as ReturnType<typeof vi.fn>).mock.calls[0][0]).toBe('ytq:IU karaoke');
  });

  it('does not touch the cache when the key is absent (gated)', async () => {
    delete process.env.YOUTUBE_API_KEY;
    const kv: SearchKv = {
      get: vi.fn(async () => null),
      put: vi.fn(async () => {}),
    };
    const r = await searchYoutubeWithCache('IU', kv);
    expect(r.gated).toBe(true);
    expect(kv.get).not.toHaveBeenCalled();
    expect(kv.put).not.toHaveBeenCalled();
  });
});
