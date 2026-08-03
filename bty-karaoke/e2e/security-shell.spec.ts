// BUILD 26B — the unauthenticated Host shell.
//
// AUDITED VERDICT: PASS — INTENTIONAL PUBLIC SHELL · NO PRIVILEGED DATA EXPOSED.
// `/r/{slug}/admin` and `/r/{slug}/dj` answer 200 without a session. That is by
// design: they are shells that authenticate client-side ("no credential is ever
// placed in the URL or the server-rendered HTML"). Their HTTP status and routing
// are deliberately NOT changed by this build.
//
// What must stay true is that the shell leaks nothing and that every privileged
// call still refuses an unauthenticated caller. That is what this file pins.
import { test, expect } from '@playwright/test';
import { HARNESS_SLUG } from './fixtures/queue';

const SHELLS = [`/r/${HARNESS_SLUG}/admin`, `/r/${HARNESS_SLUG}/dj`];

test.describe('unauthenticated shell confidentiality', () => {
  for (const path of SHELLS) {
    test(`${path} exposes no privileged data`, async ({ request }) => {
      const res = await request.get(path);
      expect(res.status(), 'the public shell is intentionally reachable').toBe(200);
      const html = await res.text();

      // Nothing that identifies a Host, a Guest, an Event, the queue, or any
      // credential may appear in the server-rendered HTML.
      const forbidden = [
        'service_role',
        'Bearer ',
        'bty_room',
        'bty_host',
        'karaoke_host_sessions',
        'account_id',
        'workspace_id',
        'dj_secret',
        'guest_name',
        'youtube_title',
        'resolution_code',
        'eyJhbGciOi', // any JWT
      ];
      for (const needle of forbidden) {
        expect(html, `shell leaked ${needle}`).not.toContain(needle);
      }
    });
  }

  test('every privileged API refuses an unauthenticated caller', async ({ request }) => {
    const calls: Array<[string, () => Promise<{ status(): number }>]> = [
      [`GET dj/queue`, () => request.get(`/api/rooms/${HARNESS_SLUG}/dj/queue`)],
      [`GET dj/usage`, () => request.get(`/api/rooms/${HARNESS_SLUG}/dj/usage`)],
      [
        `POST dj/pass-turn`,
        () =>
          request.post(`/api/rooms/${HARNESS_SLUG}/dj/pass-turn`, {
            data: { currentId: '00000000-0000-4000-8000-000000000000' },
          }),
      ],
      [`POST dj/end-event`, () => request.post(`/api/rooms/${HARNESS_SLUG}/dj/end-event`)],
      [
        `PATCH requests/{id}`,
        () =>
          request.patch(`/api/rooms/${HARNESS_SLUG}/requests/00000000-0000-4000-8000-000000000000`, {
            data: { action: 'skip' },
          }),
      ],
      [`GET host/me`, () => request.get('/api/host/me')],
      [`GET host/identities`, () => request.get('/api/host/identities')],
    ];
    for (const [name, call] of calls) {
      const res = await call();
      expect(res.status(), `${name} must reject an unauthenticated caller`).toBe(401);
    }
  });
});
