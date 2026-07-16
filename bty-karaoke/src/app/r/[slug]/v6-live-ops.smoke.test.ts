// V6.1 live-operations wiring guards: the authenticated room admin lands on the
// Admin Player; the Display shows the waiting queue (not a big QR) when songs are
// waiting; and the DJ terminology is gone from user-facing copy.

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../../', import.meta.url)); // src/app/
const admin = readFileSync(root + 'r/[slug]/admin/AdminConsole.tsx', 'utf8');
const display = readFileSync(root + 'r/[slug]/display/DisplayClient.tsx', 'utf8');
const board = readFileSync(root + 'r/[slug]/dj/DjBoard.tsx', 'utf8');
const manager = readFileSync(root + 'admin/ManagerConsole.tsx', 'utf8');
const pair = readFileSync(root + 'r/[slug]/dj/pair/PairClient.tsx', 'utf8');
const adminMenu = readFileSync(root + 'r/[slug]/dj/DjAdminMenu.tsx', 'utf8');
const uiFiles = { admin, display, board, manager, pair, adminMenu };

describe('canonical Admin entry renders the Admin Player (V6.1)', () => {
  it('the authenticated room admin renders DjConsole directly (no "Open DJ Console" hop)', () => {
    expect(admin).toContain("import DjConsole from '../dj/DjConsole'");
    expect(admin).toMatch(/return <DjConsole slug=\{slug\} displayName=\{displayName\} \/>;/);
  });
});

describe('Display shows the WAITING queue, not a big QR, when songs wait (V6.1)', () => {
  it('has a waiting-stage branch keyed off next before the empty (big-QR) state', () => {
    // Order in source: playing → next(waiting-stage) → empty(big QR).
    const playingIdx = display.indexOf('{playing ? (');
    const waitingIdx = display.indexOf(') : next ? (');
    const emptyIdx = display.indexOf('kd-empty');
    expect(playingIdx).toBeGreaterThan(-1);
    expect(waitingIdx).toBeGreaterThan(playingIdx);
    expect(emptyIdx).toBeGreaterThan(waitingIdx);
  });

  it('the waiting-stage shows UP NEXT / READY + a COMING UP list', () => {
    expect(display).toContain('UP NEXT');
    expect(display).toContain('READY TO PLAY');
    expect(display).toContain('kd-comingup');
    expect(display).toContain('COMING UP');
    expect(display).toContain('comingUp');
  });

  it('the big central QR empty state no longer claims "N곡 대기 중" (that path means empty)', () => {
    expect(display).not.toContain('곡이 대기 중이에요');
  });
});

describe('terminology: DJ is gone from user-facing copy (V6.1)', () => {
  it('no "Connect a DJ iPad" / "Show DJ Setup QR" / "Open DJ Console" / "Join as DJ"', () => {
    for (const [name, src] of Object.entries(uiFiles)) {
      expect(src, name).not.toContain('Connect a DJ iPad');
      expect(src, name).not.toContain('Show DJ Setup QR');
      expect(src, name).not.toContain('Open DJ Console');
      expect(src, name).not.toContain('Join as DJ');
    }
  });

  it('uses the Display / Admin Player vocabulary instead', () => {
    expect(manager).toContain('Open Admin Player');
    expect(manager).toContain('Connect Display');
    expect(pair).toContain('Connect Display');
    expect(adminMenu).toContain('Display iPad 연결');
  });
});

describe('Admin Hub actions (V6.1)', () => {
  it('has an Open Display action pointing at /r/[slug]/display', () => {
    expect(board).toContain('🖥 Open Display');
    expect(board).toMatch(/\/r\/\$\{encodeURIComponent\(slug\)\}\/display/);
  });
});
