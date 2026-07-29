// @vitest-environment jsdom
//
// BUILD 20B-WEB7 — the collapsible 방금 부른 노래 / 내 노래 sections. Both default
// collapsed; My Songs is always shown (even empty); the two accordions toggle
// independently; request-from-saved and 저장 해제 wire to the right callbacks.

import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, within } from '@testing-library/react';
import MySongsSections from './MySongsSections';
import type { SavedSong } from '@/domain/saved-songs';
import type { RecentlySung } from '@/domain/recently-sung';

const saved: SavedSong[] = [
  { videoId: 'dQw4w9WgXcQ', title: '밤편지', artist: '아이유', thumbnailUrl: null, savedAt: 2 },
];
const recent: RecentlySung[] = [
  { requestId: 'r1', videoId: 'aaaaaaaaaaa', title: '좋은 날', artist: '아이유', thumbnailUrl: null, sungAt: 1 },
];

const baseProps = {
  recentlySung: [] as RecentlySung[],
  saved: [] as SavedSong[],
  isSaved: () => false,
  isSavePending: () => false,
  onToggleSave: vi.fn(),
  onRequestSaved: vi.fn(),
  onRemoveSaved: vi.fn(),
  canParticipate: true,
  requestPendingVideoId: null as string | null,
};

afterEach(cleanup);

describe('MySongsSections — headers & defaults', () => {
  it('내 노래 header is visible even at count 0; 방금 부른 노래 header hidden at 0', () => {
    render(<MySongsSections {...baseProps} />);
    expect(screen.getByRole('button', { name: /내 노래/ })).toBeTruthy();
    expect(screen.queryByRole('button', { name: /방금 부른 노래/ })).toBeNull();
  });

  it('both sections default COLLAPSED — rows not rendered until expanded', () => {
    render(<MySongsSections {...baseProps} saved={saved} recentlySung={recent} />);
    expect(screen.getByRole('button', { name: /내 노래/ }).getAttribute('aria-expanded')).toBe('false');
    expect(screen.getByRole('button', { name: /방금 부른 노래/ }).getAttribute('aria-expanded')).toBe('false');
    expect(screen.queryByText('밤편지')).toBeNull();
    expect(screen.queryByText('좋은 날')).toBeNull();
  });

  it('empty 내 노래 shows guidance copy ONLY when expanded', () => {
    render(<MySongsSections {...baseProps} />);
    expect(screen.queryByText('저장한 노래가 아직 없어요')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /내 노래/ }));
    expect(screen.getByText('저장한 노래가 아직 없어요')).toBeTruthy();
    expect(screen.getByText('노래를 부른 뒤 북마크를 눌러 저장해 보세요')).toBeTruthy();
  });

  it('the two accordions toggle independently', () => {
    render(<MySongsSections {...baseProps} saved={saved} recentlySung={recent} />);
    fireEvent.click(screen.getByRole('button', { name: /내 노래/ }));
    expect(screen.getByText('밤편지')).toBeTruthy();
    expect(screen.queryByText('좋은 날')).toBeNull(); // recently-sung still collapsed
  });
});

describe('MySongsSections — request & remove', () => {
  it('신청하기 on a saved row calls onRequestSaved (reuses the request pipeline)', () => {
    const onRequestSaved = vi.fn();
    render(<MySongsSections {...baseProps} saved={saved} onRequestSaved={onRequestSaved} />);
    fireEvent.click(screen.getByRole('button', { name: /내 노래/ }));
    fireEvent.click(screen.getByRole('button', { name: /신청하기/ }));
    expect(onRequestSaved).toHaveBeenCalledWith(saved[0]);
  });

  it('an in-flight request disables 신청하기 (double-tap dedupe)', () => {
    render(<MySongsSections {...baseProps} saved={saved} requestPendingVideoId="dQw4w9WgXcQ" />);
    fireEvent.click(screen.getByRole('button', { name: /내 노래/ }));
    expect((screen.getByRole('button', { name: /신청/ }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('저장 해제 removes without touching the request path', () => {
    const onRemoveSaved = vi.fn();
    const onRequestSaved = vi.fn();
    render(<MySongsSections {...baseProps} saved={saved} onRemoveSaved={onRemoveSaved} onRequestSaved={onRequestSaved} />);
    fireEvent.click(screen.getByRole('button', { name: /내 노래/ }));
    fireEvent.click(screen.getByRole('button', { name: /저장 해제/ }));
    expect(onRemoveSaved).toHaveBeenCalledWith('dQw4w9WgXcQ');
    expect(onRequestSaved).not.toHaveBeenCalled();
  });

  it('when participation is unavailable, shows the honest wait copy instead of 신청하기', () => {
    render(<MySongsSections {...baseProps} saved={saved} canParticipate={false} />);
    fireEvent.click(screen.getByRole('button', { name: /내 노래/ }));
    expect(screen.getByText('이벤트가 열리면 신청할 수 있어요')).toBeTruthy();
    expect(screen.queryByRole('button', { name: /신청하기/ })).toBeNull();
  });

  it('a Recently Sung row exposes a bookmark to save into My Songs', () => {
    const onToggleSave = vi.fn();
    render(<MySongsSections {...baseProps} recentlySung={recent} onToggleSave={onToggleSave} />);
    fireEvent.click(screen.getByRole('button', { name: /방금 부른 노래/ }));
    const row = screen.getByText('좋은 날').closest('li')!;
    fireEvent.click(within(row).getByRole('button', { name: /저장/ }));
    expect(onToggleSave).toHaveBeenCalledWith(
      expect.objectContaining({ videoId: 'aaaaaaaaaaa', title: '좋은 날' }),
    );
  });
});
