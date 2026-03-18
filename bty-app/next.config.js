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
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
