// BUILD 26T-R1B-R6-R1A-J3 — the official "developed with YouTube" mark.
//
// WHY THIS VARIANT. The current YouTube API Branding Guidelines: *"You should use a developed with
// YouTube logo if removing YouTube functionality from your application would render the application
// nonfunctional or not useful."* Removing YouTube from BTY Norebang leaves no search, no song
// identity, no content and no playback — an empty queue with nothing queueable. Measured in
// docs/BUILD26T_R1B_R6_R1A_J_UI_RETIREMENT_CENSUS_V1.md.
//
// WHERE IT GOES. Adjacent to a surface where the YouTube API has a PRESENCE — i.e. a list rendering
// what the Data API just returned. It is deliberately NOT rendered next to saved songs, queue rows
// or history: those render BTY's own stored snapshots ("Denormalized snapshots captured at save
// time"), which is history about a YouTube video rather than the API's presence in the product.
//
// THE ASSET IS OFFICIAL AND UNMODIFIED. /brand/developed-with-youtube-light.png is a byte-identical
// copy of the file downloaded from the guideline page's own link
// (sha256 b0a3ef7015b44b4ecb579248409a6435692d0e01848b8da35e1b6e0462548794, 700×250). It is never
// recoloured, tinted, cropped, distorted or redrawn. `height` scales it; `width: auto` is what
// keeps the official 2.8:1 aspect ratio true at every size.
//
// SPACING IS *BTY LAYOUT DESIGN*, NOT AN OFFICIAL CLEAR-SPACE MEASUREMENT. No numeric minimum size
// or clear-space rule is published for THIS lockup — the guidelines state those for the YouTube
// logo/icon, which is a different mark with a different geometry (this one contains no play
// triangle). So nothing here claims 20dp, triangle-derived spacing or icon-height spacing.

type Props = {
  /** Rendered height in px. Ratio is preserved by `width: auto` — never set both. */
  height?: number;
  className?: string;
};

/** The destination for section-level branding: YouTube itself, which is the component the API
 *  results come from. Individual result cards keep their own watch links, separately. */
export const DEVELOPED_WITH_YOUTUBE_HREF = 'https://www.youtube.com';

export default function DevelopedWithYouTube({ height = 20, className }: Props) {
  return (
    <a
      href={DEVELOPED_WITH_YOUTUBE_HREF}
      target="_blank"
      // `noopener` is the security requirement. `noreferrer` here concerns THIS hyperlink only and
      // is unrelated to the embedded-player HTTP Referer that RMF requires — a different request,
      // from a different element. The two must not be conflated.
      rel="noopener noreferrer"
      className={['dwyt', className].filter(Boolean).join(' ')}
      aria-label="Developed with YouTube"
    >
      <img
        src="/brand/developed-with-youtube-light.png"
        alt="Developed with YouTube"
        height={height}
        // No width: the intrinsic 700×250 ratio governs, so the mark can never be distorted by a
        // container. Explicitly not `object-fit: cover`, which would crop it.
        style={{ height, width: 'auto', display: 'block' }}
      />
    </a>
  );
}
