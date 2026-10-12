const path = require("path");

/** @type {import('next').NextConfig} */
const nextConfig = {
  outputFileTracingRoot: path.join(__dirname),
  /** eslint-config-next + root `ajv` override → Ajv strict "additionalItems" throws; Gate lint = `tsc --noEmit`. */
  eslint: { ignoreDuringBuilds: true },
  // Resolve these on server from node_modules instead of vendor chunks (avoids missing chunk errors)
  serverExternalPackages: ["tailwind-merge", "clsx"],
  // 로컬 빠른 빌드: SKIP_SOURCE_MAPS=1 일 때 소스맵 비활성화
  productionBrowserSourceMaps: process.env.SKIP_SOURCE_MAPS !== "1",
  async redirects() {
    return [
      { source: "/en/bty/dashboard404", destination: "/en/bty/dashboard", permanent: false },
      { source: "/ko/bty/dashboard404", destination: "/ko/bty/dashboard", permanent: false },
    ];
  },
  async headers() {
    /*
      FRAMING (Slice A0).

      `X-Frame-Options: DENY` stays global and unconditional. `/{locale}/app`, every legacy route
      and every API keeps it exactly as before — this is not a relaxation of BTY's framing posture.

      The Teams Personal Tab is the ONE exception, and it is granted by PATH. `X-Frame-Options` has
      no allow-list (`ALLOW-FROM` is ignored by modern browsers) and a `DENY` would override CSP,
      so on `/teams/*` the header is OMITTED and `frame-ancestors` carries the allow-list instead.
      That is why the tab renders its own copy of the shell in place rather than redirecting into
      `/{locale}/app`: the exception must stay the size of the tab.

      The allow-list is Microsoft Teams hosts only. Never `*`, never a wildcard scheme, never a
      third party. `frame-ancestors 'none'` is stated explicitly on every other path so the two
      mechanisms agree rather than relying on one of them being absent.
    */
    const TEAMS_FRAME_ANCESTORS = [
      "'self'",
      "https://teams.microsoft.com",
      "https://*.teams.microsoft.com",
      "https://teams.cloud.microsoft",
      "https://*.cloud.microsoft",
      "https://*.skype.com",
      "https://*.microsoft.com",
      "https://*.office.com",
    ].join(" ");

    const BASE = [
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
    ];
    /*
      MICROPHONE (AI Patient Practice V1). The microphone is OFF everywhere except the two surfaces
      that host the Practice tab — the Teams tab and the in-shell app — and there it is granted to
      BTY's own origin only (`self`), never to an embedded third party. Camera and location stay off
      everywhere. Each path gets exactly one Permissions-Policy value, because Next.js applies every
      matching rule and the last same-key header would silently win.
    */
    const MIC_OFF = [...BASE, { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" }];
    const MIC_SELF = [...BASE, { key: "Permissions-Policy", value: "camera=(), microphone=(self), geolocation=()" }];

    return [
      {
        source: "/teams",
        headers: [
          ...MIC_SELF,
          { key: "Content-Security-Policy", value: `frame-ancestors ${TEAMS_FRAME_ANCESTORS}` },
        ],
      },
      {
        source: "/teams/:path*",
        headers: [
          ...MIC_SELF,
          { key: "Content-Security-Policy", value: `frame-ancestors ${TEAMS_FRAME_ANCESTORS}` },
        ],
      },
      {
        /*
          Every path EXCEPT the tab. Next.js applies every matching rule rather than only the
          first, so `/teams` is excluded here by a negative lookahead rather than by ordering — a
          second matching rule would otherwise re-attach `X-Frame-Options: DENY` to the tab and
          blank it, and ordering is not a contract Next.js makes.
        */
        source: "/((?!teams$|teams/|en/app$|ko/app$).*)",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
          ...MIC_OFF,
        ],
      },
      {
        /*
          The in-shell app (`/{locale}/app`). Framing is exactly as strict as every other non-tab
          path; only the microphone differs, for AI Patient Practice in a browser.
        */
        source: "/:locale(en|ko)/app",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
          ...MIC_SELF,
        ],
      },
    ];
  },
};

module.exports = nextConfig;
