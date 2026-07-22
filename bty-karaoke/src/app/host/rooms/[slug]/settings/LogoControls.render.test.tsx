// @vitest-environment jsdom
//
// Room Branding V1 — LogoControls rendered-form contract. The multipart upload posts
// to /logo with the CSRF field, and the value-carrying FILE input is NEVER disabled
// on submit (a disabled control is dropped from the POST — the bad_name lesson). The
// remove form appears only when a logo exists.

import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import LogoControls from './LogoControls';

afterEach(cleanup);

describe('LogoControls', () => {
  it('upload form posts multipart to the slug-scoped /logo with a csrf field', () => {
    const { container } = render(<LogoControls slug="chi-norebang-xqjbyszq" csrf="csrf-token" csrfField="csrf" currentLogoUrl={null} />);
    const file = screen.getByLabelText('새 로고 선택') as HTMLInputElement;
    const form = file.closest('form')!;
    expect(form.getAttribute('action')).toBe('/api/host/rooms/chi-norebang-xqjbyszq/logo');
    expect(form.getAttribute('enctype')).toBe('multipart/form-data');
    expect((container.querySelector('input[name="csrf"]') as HTMLInputElement).value).toBe('csrf-token');
    expect(file.getAttribute('accept')).toBe('image/png,image/jpeg,image/webp');
  });

  it('the file input is never disabled while submitting (so the file still POSTs)', () => {
    render(<LogoControls slug="s" csrf="c" csrfField="csrf" currentLogoUrl={null} />);
    const file = screen.getByLabelText('새 로고 선택') as HTMLInputElement;
    fireEvent.submit(file.closest('form')!);
    expect(file.disabled).toBe(false);
  });

  it('shows a "로고 없음" fallback and NO remove form when there is no logo', () => {
    render(<LogoControls slug="s" csrf="c" csrfField="csrf" currentLogoUrl={null} />);
    expect(screen.getByText('로고 없음')).toBeTruthy();
    expect(screen.queryByRole('button', { name: /로고 제거/ })).toBeNull();
  });

  it('renders the current logo + a remove form (posting to /logo/remove) when a logo exists', () => {
    render(<LogoControls slug="chi-norebang-xqjbyszq" csrf="c" csrfField="csrf" currentLogoUrl="/api/public/rooms/chi-norebang-xqjbyszq/logo?v=ver123" />);
    expect((screen.getByAltText('현재 로고') as HTMLImageElement).getAttribute('src')).toContain('/api/public/rooms/chi-norebang-xqjbyszq/logo?v=ver123');
    const removeForm = screen.getByRole('button', { name: /로고 제거/ }).closest('form')!;
    expect(removeForm.getAttribute('action')).toBe('/api/host/rooms/chi-norebang-xqjbyszq/logo/remove');
  });
});
