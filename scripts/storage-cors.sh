#!/usr/bin/env bash
# Avatars bucket CORS for leaderboard (BTY). Run from bty-app: ./scripts/storage-cors.sh
# Requires: supabase CLI with "storage update-bucket-cors" (npx supabase or brew supabase).

set -e
CORS='{"allowedOrigins":["https://bty-website.ywamer2022.workers.dev","http://localhost:3000"],"allowedMethods":["GET","POST","PUT","DELETE"],"allowedHeaders":["*"],"maxAgeSeconds":3600}'
if command -v supabase &>/dev/null; then
  supabase storage update-bucket-cors --bucket-name avatars --cors-config "$CORS"
else
  npx supabase storage update-bucket-cors --bucket-name avatars --cors-config "$CORS"
fi
