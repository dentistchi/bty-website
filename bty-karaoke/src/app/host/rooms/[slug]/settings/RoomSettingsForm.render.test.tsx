// @vitest-environment jsdom
//
// Rendered-form integration for Room Settings, using REAL browser FormData semantics
// (the lesson from the first-room bad_name defect). Renders the actual form, edits
// both fields, submits it (driving the submitting-state re-render), then builds
// `new FormData(form)` — which, like a browser, EXCLUDES disabled controls — and
// asserts BOTH the name and welcome survive AND pass the SAME RoomSettingsSchema the
// route parses with. Value-carrying fields must be readOnly (not disabled) on submit.

import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import RoomSettingsForm from './RoomSettingsForm';
import { RoomSettingsSchema } from '@/lib/validation';

afterEach(cleanup);

function submitWith(name: string, welcome: string) {
  render(
    <RoomSettingsForm
      slug="chi-norebang-xqjbyszq"
      csrf="csrf-token"
      csrfField="csrf"
      initialName="Chi Norebang"
      initialWelcome=""
    />,
  );
  const form = screen.getByRole('button', { name: /변경사항 저장/ }).closest('form')!;
  fireEvent.change(screen.getByLabelText('노래방 이름'), { target: { value: name } });
  fireEvent.change(screen.getByLabelText('손님 환영 문구'), { target: { value: welcome } });
  fireEvent.submit(form);
  return { form, fd: new FormData(form) };
}

describe('RoomSettingsForm submitted contract', () => {
  it('pre-fills current values and posts to the slug-scoped settings endpoint', () => {
    render(
      <RoomSettingsForm
        slug="chi-norebang-xqjbyszq"
        csrf="csrf-token"
        csrfField="csrf"
        initialName="Chi Norebang"
        initialWelcome="기존 문구"
      />,
    );
    expect((screen.getByLabelText('노래방 이름') as HTMLInputElement).value).toBe('Chi Norebang');
    expect((screen.getByLabelText('손님 환영 문구') as HTMLTextAreaElement).value).toBe('기존 문구');
    const form = screen.getByRole('button', { name: /변경사항 저장/ }).closest('form')!;
    expect(form.getAttribute('action')).toBe('/api/host/rooms/chi-norebang-xqjbyszq/settings');
  });

  it('English name + welcome survive submit and pass the route schema', () => {
    const { fd } = submitWith('Chi Family Norebang', 'Sing together!');
    expect(fd.get('name')).toBe('Chi Family Norebang');
    expect(fd.get('guestWelcomeMessage')).toBe('Sing together!');
    expect(fd.get('csrf')).toBe('csrf-token');
    expect(RoomSettingsSchema.safeParse({ name: fd.get('name'), guestWelcomeMessage: fd.get('guestWelcomeMessage') }).success).toBe(true);
  });

  it('Korean name + welcome survive submit and pass the schema', () => {
    const { fd } = submitWith('치 패밀리 노래방', '오늘 함께 노래하고 즐거운 추억을 만들어 보세요.');
    expect(fd.get('name')).toBe('치 패밀리 노래방');
    expect(fd.get('guestWelcomeMessage')).toBe('오늘 함께 노래하고 즐거운 추억을 만들어 보세요.');
    expect(RoomSettingsSchema.safeParse({ name: fd.get('name'), guestWelcomeMessage: fd.get('guestWelcomeMessage') }).success).toBe(true);
  });

  it('value-carrying fields are readOnly (never disabled) while submitting — so they still POST', () => {
    render(
      <RoomSettingsForm slug="s" csrf="c" csrfField="csrf" initialName="A" initialWelcome="" />,
    );
    const form = screen.getByRole('button', { name: /변경사항 저장/ }).closest('form')!;
    const name = screen.getByLabelText('노래방 이름') as HTMLInputElement;
    const welcome = screen.getByLabelText('손님 환영 문구') as HTMLTextAreaElement;
    fireEvent.submit(form);
    expect(name.disabled).toBe(false);
    expect(welcome.disabled).toBe(false);
    expect(name.readOnly).toBe(true);
    expect(welcome.readOnly).toBe(true);
  });
});
