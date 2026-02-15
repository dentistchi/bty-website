/** @type {import('next').NextConfig} */
const path = require("path");
const nextConfig = {
  outputFileTracingRoot: path.join(__dirname),
  // 빌드타임 env 주입 (클라이언트 번들 + 서버/Edge). 빌드 시 반드시 NEXT_PUBLIC_* 설정.
  env: {
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
  },

  images: {
    unoptimized: true,
  },

  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
};

module.exports = nextConfig;
