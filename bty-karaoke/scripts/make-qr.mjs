// Generate the guest QR for btyNorebang. Encodes the PUBLIC GUEST URL ONLY.
// The DJ URL / DJ credential must NEVER be encoded into a public QR.
//
// Usage: node scripts/make-qr.mjs <guest-url> [out-basename]
//   e.g. node scripts/make-qr.mjs https://bty-karaoke.<acct>.workers.dev/r/bty-home qr-bty-home

import QRCode from 'qrcode';
import { writeFileSync } from 'node:fs';
import { isPublicGuestUrl } from './url-guard.mjs';

const url = process.argv[2];
const out = process.argv[3] ?? 'qr-guest';

if (!url) {
  console.error('Usage: node scripts/make-qr.mjs <guest-url> [out-basename]');
  process.exit(1);
}

if (!isPublicGuestUrl(url)) {
  console.error('❌ Refusing: the URL contains a DJ path or a credential/token. Guest URL only.');
  process.exit(1);
}

const png = `${out}.png`;
const svg = `${out}.svg`;

await QRCode.toFile(png, url, { width: 720, margin: 2, errorCorrectionLevel: 'M' });
const svgStr = await QRCode.toString(url, { type: 'svg', margin: 2, errorCorrectionLevel: 'M' });
writeFileSync(svg, svgStr);

console.log('✅ Guest QR generated');
console.log(`   destination: ${url}`);
console.log(`   files: ${png}, ${svg}`);
