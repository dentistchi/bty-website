'use client';

// Room Settings V1 — the display-name + guest-welcome editor (Room Settings).
//
// A NATIVE form POST to /api/host/rooms/{slug}/settings — works with zero JS (iPhone
// WebView, Android Chrome, desktop). Client behaviour is progressive enhancement:
// on submit it locks the fields with `readOnly` (NOT `disabled` — a disabled control
// is omitted from the POST body, the exact defect that broke first-room onboarding)
// and swaps the button to a loading state so a double tap can't fire twice. One
// explicit Save; never auto-saves.

import { useState } from 'react';

export default function RoomSettingsForm({
  slug,
  csrf,
  csrfField,
  initialName,
  initialWelcome,
}: {
  slug: string;
  csrf: string;
  csrfField: string;
  initialName: string;
  initialWelcome: string;
}) {
  const [submitting, setSubmitting] = useState(false);

  return (
    <form
      action={`/api/host/rooms/${encodeURIComponent(slug)}/settings`}
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
        readOnly={submitting}
        defaultValue={initialName}
        placeholder="예: 우리집 노래방"
      />

      <label htmlFor="guest-welcome">손님 환영 문구</label>
      <textarea
        id="guest-welcome"
        name="guestWelcomeMessage"
        rows={3}
        maxLength={160}
        readOnly={submitting}
        defaultValue={initialWelcome}
        placeholder="예: 오늘 함께 노래하고 즐거운 추억을 만들어 보세요."
        aria-describedby="guest-welcome-help"
      />
      <p id="guest-welcome-help" className="muted">
        비워 두면 손님 화면에 문구가 표시되지 않아요. (최대 160자)
      </p>

      <button
        className="host-btn host-btn-primary"
        type="submit"
        disabled={submitting}
        aria-busy={submitting}
      >
        {submitting ? '저장 중…' : '변경사항 저장'}
      </button>
    </form>
  );
}
