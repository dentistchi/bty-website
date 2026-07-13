import { PRODUCT_NAME, PRODUCT_TAGLINE_KO } from '@/lib/brand';

export default function Home() {
  return (
    <main>
      <h1 className="brand">{PRODUCT_NAME}</h1>
      <p className="muted">{PRODUCT_TAGLINE_KO}</p>
      <div className="card">
        <p>
          Open a room by its link: <code>/r/&lt;room-slug&gt;</code>
        </p>
        <p className="muted">
          The DJ view lives at <code>/r/&lt;room-slug&gt;/dj?secret=&lt;dj-secret&gt;</code>.
        </p>
        <p className="muted">
          Seed a demo room with <code>npm run seed:room</code> (after the migration is applied),
          then open <code>/r/demo</code>.
        </p>
      </div>
    </main>
  );
}
