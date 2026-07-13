import { defineCloudflareConfig } from '@opennextjs/cloudflare/config';

// Minimal OpenNext config for the btyNorebang worker. Pages are force-dynamic,
// so no incremental cache is wired. The dedicated Karaoke KV namespace (binding
// KARAOKE_SEARCH_KV) is used directly by the YouTube search cache, not by
// OpenNext's page cache.
export default defineCloudflareConfig({});
