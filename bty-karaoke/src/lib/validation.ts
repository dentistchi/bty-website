import { z } from 'zod';
import { MAX_QUERY_LEN } from '@/domain/youtube-search';

// Guest enqueue. Primary path: a selected search result (videoId + metadata).
// Fallback path: a manually pasted YouTube URL/ID (`youtubeInput`), resolved to
// a video id server-side. At least one of the two must be present.
export const CreateRequestSchema = z
  .object({
    guestName: z.string().trim().min(1, 'Name is required').max(40),
    searchQuery: z.string().trim().max(MAX_QUERY_LEN).optional(),
    // Selected-result path:
    youtubeVideoId: z.string().trim().min(1).max(20).optional(),
    youtubeTitle: z.string().trim().max(300).optional(),
    youtubeChannelTitle: z.string().trim().max(200).optional(),
    youtubeThumbnailUrl: z.string().url().max(600).optional(),
    // Manual fallback path:
    youtubeInput: z.string().trim().max(300).optional(),
  })
  .refine((v) => Boolean(v.youtubeVideoId || v.youtubeInput), {
    message: 'Select a song or paste a YouTube link',
    path: ['youtubeVideoId'],
  });
export type CreateRequestInput = z.infer<typeof CreateRequestSchema>;

// The DJ credential now travels in the Authorization header, not the body.
export const DjActionSchema = z.object({
  action: z.enum(['play', 'complete', 'skip']),
});
export type DjActionInput = z.infer<typeof DjActionSchema>;

export const SearchQuerySchema = z.object({
  q: z.string().trim().min(2, 'Enter at least 2 characters').max(MAX_QUERY_LEN),
});

// iPad redeems a one-use pairing token (read from the pairing URL, sent in the
// body — never logged). Optional label lets the operator name the device.
export const PairRedeemSchema = z.object({
  token: z.string().trim().min(1).max(256),
  label: z.string().trim().max(60).optional(),
});
export type PairRedeemInput = z.infer<typeof PairRedeemSchema>;

// Admin mints a DJ pairing token; optional friendly label for the device.
export const PairMintSchema = z
  .object({ label: z.string().trim().max(60).optional() })
  .optional();
