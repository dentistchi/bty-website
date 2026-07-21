// @vitest-environment jsdom
//
// Regression proof for the Gate A `bad_name` production failure. The route's unit
// test mocked FormData directly, and the form's own render test could have checked
// only field names — so a value that the browser DROPS on submit slipped through
// both. This test binds the two: it renders the REAL form, types a name, submits
// it (driving the exact submitting-state re-render), then builds `new FormData(form)`
// — which, like a browser, EXCLUDES disabled controls — and asserts the typed name
// survives AND is accepted by the SAME CreateRoomSchema the route parses with.
//
// Root cause it locks down: the value-carrying input must never be `disabled` while
// submitting (a disabled control is omitted from the POST → the name never arrives
// → bad_name). `readOnly` locks editing yet still submits.

import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import FirstRoomForm from './FirstRoomForm';
import { CreateRoomSchema } from '@/lib/validation';

afterEach(cleanup);

/** What the browser would actually POST for this form in its current DOM state. */
function submittedFormData(name: string): FormData {
  render(<FirstRoomForm csrf="csrf-token" csrfField="csrf" />);
  const form = screen.getByRole('button', { name: /노래방 만들기/ }).closest('form')!;
  const input = screen.getByLabelText('노래방 이름') as HTMLInputElement;
  fireEvent.change(input, { target: { value: name } });
  fireEvent.submit(form); // flips submitting=true → re-render (was: disables the input)
  return new FormData(form); // excludes disabled controls, exactly like a real submit
}

describe('FirstRoomForm submitted contract (Gate A bad_name regression)', () => {
  it('English name survives submit and passes the route schema', () => {
    const fd = submittedFormData('Chi Norebang');
    expect(fd.get('name')).toBe('Chi Norebang'); // NOT dropped by a disabled input
    expect(fd.get('csrf')).toBe('csrf-token');
    expect(CreateRoomSchema.safeParse({ name: fd.get('name') }).success).toBe(true);
  });

  it('Korean display name is submitted and accepted (never rejected for being Korean)', () => {
    const fd = submittedFormData('치 패밀리 노래방');
    expect(fd.get('name')).toBe('치 패밀리 노래방');
    expect(CreateRoomSchema.safeParse({ name: fd.get('name') }).success).toBe(true);
  });

  it('leading/trailing whitespace is submitted (the schema trims it) and accepted', () => {
    const fd = submittedFormData('  My Room  ');
    expect(fd.get('name')).toBe('  My Room  ');
    const parsed = CreateRoomSchema.safeParse({ name: fd.get('name') });
    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data.name).toBe('My Room');
  });

  it('the value-carrying input is not disabled while submitting (it would drop the name)', () => {
    render(<FirstRoomForm csrf="csrf-token" csrfField="csrf" />);
    const form = screen.getByRole('button', { name: /노래방 만들기/ }).closest('form')!;
    const input = screen.getByLabelText('노래방 이름') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'Chi Norebang' } });
    fireEvent.submit(form);
    expect(input.disabled).toBe(false); // never disabled → always submitted
  });
});
