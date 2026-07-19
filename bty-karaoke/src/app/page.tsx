import { PRODUCT_NAME, PRODUCT_TAGLINE_KO } from '@/lib/brand';
import LegalLinks from '@/components/legal/LegalLinks';

export default function Home() {
  return (
    <main>
      <h1 className="brand">{PRODUCT_NAME}</h1>
      <p className="muted">{PRODUCT_TAGLINE_KO}</p>
      <div className="card">
        <p>
          {PRODUCT_NAME} is a private-event karaoke web app: guests search publicly available YouTube
          videos and add them to a shared song queue. Playback is handed off to YouTube.
        </p>
        <p className="muted">
          Guests join an event by its room link (<code>/r/&lt;room-slug&gt;</code>) — no account or
          Google sign-in required.
        </p>
      </div>
      <LegalLinks showContact />
    </main>
  );
}
