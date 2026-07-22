'use client';

// Room Branding V1 — logo upload / remove controls with a local preview.
//
// Two NATIVE form POSTs (multipart upload, and remove). Progressive enhancement only:
// a local object-URL preview appears when a file is picked, and the SUBMIT BUTTONS
// disable on submit to stop double-taps. The value-carrying FILE input is NEVER
// disabled (a disabled control is dropped from the POST — the bad_name lesson). The
// server does all validation/normalization; nothing here is a security boundary.

import { useState } from 'react';

export default function LogoControls({
  slug,
  csrf,
  csrfField,
  currentLogoUrl,
}: {
  slug: string;
  csrf: string;
  csrfField: string;
  currentLogoUrl: string | null;
}) {
  const [preview, setPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [removing, setRemoving] = useState(false);
  const base = `/api/host/rooms/${encodeURIComponent(slug)}/logo`;

  return (
    <div className="logo-controls">
      <div className="logo-preview">
        {preview ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={preview} alt="새 로고 미리보기" />
        ) : currentLogoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={currentLogoUrl} alt="현재 로고" />
        ) : (
          <div className="logo-empty" aria-hidden="true">로고 없음</div>
        )}
      </div>

      <form
        action={base}
        method="post"
        encType="multipart/form-data"
        className="host-form"
        onSubmit={() => setUploading(true)}
      >
        <input type="hidden" name={csrfField} value={csrf} />
        <label htmlFor="logo-file">새 로고 선택</label>
        <input
          id="logo-file"
          name="logo"
          type="file"
          accept="image/png,image/jpeg,image/webp"
          required
          onChange={(e) => {
            const f = e.target.files?.[0];
            setPreview(f ? URL.createObjectURL(f) : null);
          }}
        />
        <p className="muted">PNG · JPEG · WebP · 최대 2MB · 정사각형 권장 (512×512로 저장돼요)</p>
        <button className="host-btn host-btn-primary" type="submit" disabled={uploading} aria-busy={uploading}>
          {uploading ? '업로드 중…' : '로고 저장'}
        </button>
      </form>

      {currentLogoUrl && (
        <form action={`${base}/remove`} method="post" onSubmit={() => setRemoving(true)}>
          <input type="hidden" name={csrfField} value={csrf} />
          <button className="host-btn host-btn-ghost" type="submit" disabled={removing} aria-busy={removing}>
            {removing ? '제거 중…' : '로고 제거'}
          </button>
        </form>
      )}
    </div>
  );
}
