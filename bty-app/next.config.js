/** @type {import('next').NextConfig} */
const nextConfig = {
  // 로컬 빠른 빌드: SKIP_SOURCE_MAPS=1 일 때 소스맵 비활성화
  productionBrowserSourceMaps: process.env.SKIP_SOURCE_MAPS !== "1",
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
