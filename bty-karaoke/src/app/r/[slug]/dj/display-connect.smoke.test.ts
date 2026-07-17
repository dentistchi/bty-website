// V1.2 Display connection discoverability — served-code invariants for the Admin/DJ
// console: a "Connect iPad Display" QR (canonical Display URL + copy link + scan
// instruction) and a clearly same-device "Open Display on this device".

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const djBoard = readFileSync(fileURLToPath(new URL('./DjBoard.tsx', import.meta.url)), 'utf8');

describe('Display connection — Connect iPad Display + Open Display', () => {
  it('offers a "Connect iPad Display" action that fetches the canonical display-qr', () => {
    expect(djBoard).toContain('Connect iPad Display');
    expect(djBoard).toMatch(/\/api\/rooms\/\$\{encodeURIComponent\(slug\)\}\/display-qr/);
  });

  it('shows the scan instruction and a copyable Display link', () => {
    expect(djBoard).toContain('iPad 카메라로 QR을 스캔하세요');
    expect(djBoard).toContain('Copy Display Link');
    expect(djBoard).toMatch(/navigator\.clipboard\.writeText\(displayQr\.url\)/);
  });

  it('renders the Display QR image in a modal', () => {
    expect(djBoard).toMatch(/displayQr &&/);
    expect(djBoard).toMatch(/dangerouslySetInnerHTML=\{\{ __html: displayQr\.qrSvg \}\}/);
  });

  it('"Open Display" is explicitly labeled same-device and links to the room Display', () => {
    expect(djBoard).toContain('Open Display on this device');
    expect(djBoard).toMatch(/href=\{`\/r\/\$\{encodeURIComponent\(slug\)\}\/display`\}/);
  });

  it('the Display QR link targets /display (canonical route), never a derived event slug', () => {
    // The server route (display-qr) builds /r/<room.slug>/display; the client only
    // renders what the server returns — no evt-<code> derivation anywhere here.
    expect(djBoard).not.toMatch(/evt-\$\{/);
  });
});
