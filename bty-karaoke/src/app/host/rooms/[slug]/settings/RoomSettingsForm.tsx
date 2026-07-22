'use client';

// Room Settings + Branding — the name / welcome / theme editor (one explicit Save).
//
// A NATIVE form POST to /api/host/rooms/{slug}/settings — works with zero JS. Client
// behaviour is progressive enhancement: on submit it locks the value-carrying fields
// with `readOnly` (NOT `disabled` — a disabled control is omitted from the POST body,
// the first-room bad_name defect) and shows a loading state. Selecting a theme card
// live-updates the preview swatch (data-theme drives server-controlled CSS variables);
// only an allowlisted theme id is ever submitted — never raw colors/CSS.

import { useState } from 'react';
import { BRANDING_THEMES, THEME_META, type BrandingTheme, normalizeTheme } from '@/domain/branding';

export default function RoomSettingsForm({
  slug,
  csrf,
  csrfField,
  initialName,
  initialWelcome,
  initialTheme,
}: {
  slug: string;
  csrf: string;
  csrfField: string;
  initialName: string;
  initialWelcome: string;
  initialTheme: string;
}) {
  const [submitting, setSubmitting] = useState(false);
  const [theme, setTheme] = useState<BrandingTheme>(normalizeTheme(initialTheme));

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

      <fieldset className="theme-picker" aria-label="테마 선택">
        <legend>테마 선택</legend>
        {BRANDING_THEMES.map((id) => (
          <label key={id} className={`theme-card${theme === id ? ' is-selected' : ''}`} data-theme={id}>
            <input
              type="radio"
              name="theme"
              value={id}
              checked={theme === id}
              disabled={submitting}
              onChange={() => setTheme(id)}
            />
            <span className="theme-swatch" aria-hidden="true">
              <span className="theme-swatch-accent" />
            </span>
            <span className="theme-card-text">
              <b>{THEME_META[id].label}</b>
              <span className="muted">{THEME_META[id].hint}</span>
            </span>
          </label>
        ))}
      </fieldset>

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
