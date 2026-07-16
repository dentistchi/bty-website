// ManagerConsole must build Open Admin Player / Connect Display / Guest QR from
// CANONICAL server-provided identifiers — never a room slug derived from the event
// public code (which yields "Room not found" for an event on a pre-existing room).
// The suite runs in a Node environment, so we assert on the client source (as the
// repo's other UI smoke tests do) rather than rendering the component.

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const console_ = readFileSync(fileURLToPath(new URL('./ManagerConsole.tsx', import.meta.url)), 'utf8');

describe('ManagerConsole — canonical room-slug links', () => {
  it('does NOT derive a room slug from the public code (the removed `evt-${...}` bug)', () => {
    expect(console_).not.toMatch(/evt-\$\{/);
    expect(console_).not.toContain('function djRoomSlug');
    expect(console_).not.toMatch(/djRoomSlug\(/);
  });

  it('Open Admin Player links using the server-provided detail.roomSlug', () => {
    expect(console_).toMatch(/href=\{`\/r\/\$\{encodeURIComponent\(detail\.roomSlug\)\}\/dj`\}/);
  });

  it('disables Open Admin Player (honest state) when roomSlug is missing', () => {
    // A ternary on detail.roomSlug: link when present, disabled button when null.
    expect(console_).toMatch(/detail\.roomSlug \?/);
    expect(console_).toMatch(/disabled/);
    expect(console_).toContain('no room mapped');
  });

  it('Guest QR uses the server-provided guestUrl (keyed on guest_slug), not a room slug', () => {
    expect(console_).toMatch(/url: detail\.guestUrl/);
  });

  it('Connect Display goes through the server enrollment call (canonical slug resolved server-side)', () => {
    expect(console_).toMatch(/showDjQr\(detail\.event\.id/);
  });

  it('the roomSlug is part of the DetailView contract', () => {
    expect(console_).toMatch(/roomSlug: string \| null/);
  });
});
