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
      initialTheme="midnight_gold"
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
        initialTheme="neon_night"
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

  it('submits the pre-selected theme, and switching cards updates the submitted theme', () => {
    const { container } = render(
      <RoomSettingsForm slug="s" csrf="c" csrfField="csrf" initialName="A" initialWelcome="" initialTheme="midnight_gold" />,
    );
    const form = container.querySelector('form')!;
    expect(new FormData(form).get('theme')).toBe('midnight_gold');
    fireEvent.click(container.querySelector('input[value="warm_stage"]')!);
    expect(new FormData(form).get('theme')).toBe('warm_stage');
    // only an allowlisted id is ever a submittable value
    const values = [...container.querySelectorAll('input[name="theme"]')].map((el) => (el as HTMLInputElement).value);
    expect(values).toEqual(['midnight_gold', 'neon_night', 'warm_stage']);
  });

  // Gate C regression: the selected theme must survive the submitting-state re-render.
  // The browser builds FormData AFTER onSubmit fires (which flips submitting=true and
  // re-renders); a disabled checked radio would be dropped here, silently reverting the
  // Room to midnight_gold. Build FormData from the real form POST-submit, like a browser.
  it('select neon_night → submit → FormData carries branding theme=neon_night (once)', () => {
    const { container } = render(
      <RoomSettingsForm slug="s" csrf="c" csrfField="csrf" initialName="A" initialWelcome="" initialTheme="midnight_gold" />,
    );
    const form = container.querySelector('form')!;
    fireEvent.click(container.querySelector('input[value="neon_night"]')!);
    fireEvent.submit(form); // drives the submitting=true re-render, as a real submit does
    const fd = new FormData(form);
    expect(fd.getAll('theme')).toEqual(['neon_night']); // present exactly once
  });

  it('select warm_stage → submit → FormData carries branding theme=warm_stage', () => {
    const { container } = render(
      <RoomSettingsForm slug="s" csrf="c" csrfField="csrf" initialName="A" initialWelcome="" initialTheme="midnight_gold" />,
    );
    const form = container.querySelector('form')!;
    fireEvent.click(container.querySelector('input[value="warm_stage"]')!);
    fireEvent.submit(form);
    expect(new FormData(form).getAll('theme')).toEqual(['warm_stage']);
  });

  it('midnight_gold remains a valid submitted theme after submit', () => {
    const { container } = render(
      <RoomSettingsForm slug="s" csrf="c" csrfField="csrf" initialName="A" initialWelcome="" initialTheme="midnight_gold" />,
    );
    const form = container.querySelector('form')!;
    fireEvent.submit(form);
    expect(new FormData(form).getAll('theme')).toEqual(['midnight_gold']);
  });

  it('theme radios are NEVER disabled while submitting — so the checked value still POSTs', () => {
    const { container } = render(
      <RoomSettingsForm slug="s" csrf="c" csrfField="csrf" initialName="A" initialWelcome="" initialTheme="neon_night" />,
    );
    const form = container.querySelector('form')!;
    fireEvent.submit(form);
    const radios = [...container.querySelectorAll('input[name="theme"]')] as HTMLInputElement[];
    expect(radios.every((r) => r.disabled === false)).toBe(true);
    expect(new FormData(form).get('theme')).toBe('neon_night');
  });

  it('value-carrying fields are readOnly (never disabled) while submitting — so they still POST', () => {
    render(
      <RoomSettingsForm slug="s" csrf="c" csrfField="csrf" initialName="A" initialWelcome="" initialTheme="midnight_gold" />,
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
