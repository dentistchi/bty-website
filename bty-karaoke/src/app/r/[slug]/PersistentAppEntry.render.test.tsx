// @vitest-environment jsdom
//
// BUILD 19C — PERSISTENT web-to-app entry CTA. Proves the two states render as specified:
// INFORMATIONAL before a link exists (visible, not tappable, no dead link), and ACTIVE with the
// canonical Universal Link (a real 앱에서 보기 link that fires the tap callback). Also pins the
// copy and asserts the forbidden install / App Store wording never appears before BUILD 19D.

import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import PersistentAppEntry from './PersistentAppEntry';

afterEach(cleanup);

describe('PersistentAppEntry (persistent web-to-app CTA)', () => {
  it('always shows the label + supporting copy', () => {
    render(<PersistentAppEntry active={false} universalLink={null} onOpen={() => {}} />);
    expect(screen.getByText('내 노래 순서와 준비 상태를 앱에서 바로 확인하세요')).toBeTruthy();
    // the CTA label appears (as the disabled button in the informational state)
    expect(screen.getByRole('button', { name: '앱에서 보기' })).toBeTruthy();
  });

  it('INFORMATIONAL before a link exists: not tappable, no dead link', () => {
    const onOpen = vi.fn();
    render(<PersistentAppEntry active={false} universalLink={null} onOpen={onOpen} />);
    const btn = screen.getByRole('button', { name: '앱에서 보기' }) as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
    // no anchor / no href → never a dead App Store or broken link
    expect(screen.queryByRole('link')).toBeNull();
  });

  it('ACTIVE with a Universal Link: renders a real link that fires the tap callback', () => {
    const onOpen = vi.fn();
    const link = 'https://norebang.btydaily.com/app/join/abc123';
    render(<PersistentAppEntry active universalLink={link} onOpen={onOpen} />);
    const a = screen.getByRole('link', { name: '앱에서 보기' }) as HTMLAnchorElement;
    expect(a.getAttribute('href')).toBe(link);
    fireEvent.click(a);
    expect(onOpen).toHaveBeenCalledTimes(1);
  });

  it('never uses the forbidden install / App Store wording before BUILD 19D', () => {
    const { container } = render(
      <PersistentAppEntry active universalLink="https://norebang.btydaily.com/app/join/x" onOpen={() => {}} />,
    );
    const text = container.textContent ?? '';
    expect(text).not.toContain('앱 설치하기');
    expect(text).not.toContain('App Store');
  });
});
