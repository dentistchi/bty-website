// Server-side QR rendering. We generate an inline SVG (pure string output — no
// canvas/Buffer, so it runs on the Node and Cloudflare Workers runtimes) and
// hand it to the client, which drops it straight into the DOM. Rendering QRs on
// the server keeps the `qrcode` dependency out of the client bundle.

import QRCode from 'qrcode';

/** A bright, high-contrast QR as an inline SVG string for a light surface. */
export async function qrSvg(text: string): Promise<string> {
  return QRCode.toString(text, {
    type: 'svg',
    margin: 1,
    errorCorrectionLevel: 'M',
    color: { dark: '#0B1020', light: '#FFFFFF' },
  });
}
