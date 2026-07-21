'use client';

// The first-room onboarding form (New Host Onboarding V1).
//
// A NATIVE form POST to /api/host/rooms — it works with zero JavaScript (the
// iPhone native WebView and Android Chrome both submit and follow the 303 into
// Admin), which is the correctness floor. The client behaviour here is pure
// progressive enhancement: on submit it disables the field + button and swaps the
// label to a loading state so a double tap can't fire a second request. The DB is
// the real duplicate guard (an account-scoped advisory lock + the already-owns-a-
// Room check in create_karaoke_room); this only smooths the UX.

import { useState } from 'react';

export default function FirstRoomForm({
  csrf,
  csrfField,
}: {
  csrf: string;
  csrfField: string;
}) {
  const [submitting, setSubmitting] = useState(false);

  return (
    <form
      action="/api/host/rooms"
      method="post"
      className="host-form"
      onSubmit={() => setSubmitting(true)}
    >
      <input type="hidden" name={csrfField} value={csrf} />
      <label htmlFor="room-name">노래방 이름</label>
      <input
        id="room-name"
        name="name"
        type="text"
        inputMode="text"
        autoComplete="off"
        maxLength={80}
        required
        // MUST NOT be `disabled` while submitting: a disabled control is omitted
        // from the POST body, so the typed name would never reach the route (it
        // then fails validation → ?notice=bad_name and no Room is created). Use
        // `readOnly` — it locks editing during submit yet is still submitted. Only
        // the button carries `disabled` for double-submit prevention.
        readOnly={submitting}
        placeholder="예: 우리집 노래방"
        aria-describedby="room-name-help"
      />
      <p id="room-name-help" className="muted">
        표시 이름은 나중에 바꿀 수 있어요.
      </p>
      <button
        className="host-btn host-btn-primary"
        type="submit"
        disabled={submitting}
        aria-busy={submitting}
      >
        {submitting ? '만드는 중…' : '내 노래방 만들기'}
      </button>
    </form>
  );
}
