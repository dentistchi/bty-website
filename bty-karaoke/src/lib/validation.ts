import { z } from 'zod';
import { MAX_QUERY_LEN } from '@/domain/youtube-search';
import { MAX_LYRICS_LEN } from '@/domain/lyrics';

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

// First-room onboarding: the Host supplies ONLY a Norebang display name. The slug
// is generated server-side; no owner, slug, or redirect is ever accepted from the
// client. Bounded 1..80 to match the workspace-name and account display-name limits.
export const CreateRoomSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(80),
});
export type CreateRoomInput = z.infer<typeof CreateRoomSchema>;

// Room Settings V1: the owner edits ONLY the guest-facing identity — display name
// (required, 1..80) and an optional welcome message (0..160). Trimmed + bounded
// server-side; Korean/Unicode text passes unchanged. NO slug, owner, account, or
// workspace field is part of the contract — the route rejects/ignores anything else.
// An absent or empty welcome normalizes to null (guest renders the default, no
// empty placeholder).
export const RoomSettingsSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(80),
  guestWelcomeMessage: z.string().trim().max(160, 'Welcome message is too long').optional(),
});
export type RoomSettingsInput = z.infer<typeof RoomSettingsSchema>;

// The DJ credential now travels in the Authorization header, not the body.
// 'move_next' (먼저 부르기) is a reorder, not a status change — handled separately.
export const DjActionSchema = z.object({
  action: z.enum(['play', 'complete', 'skip', 'remove', 'move_next']),
});
export type DjActionInput = z.infer<typeof DjActionSchema>;

// DJ reorders the waiting queue: the full waiting line in the DJ's desired order.
// Ids are the request UUIDs the DJ currently sees; the server re-validates them
// against the live waiting set (room-scoped) and appends any new arrivals. The
// cap bounds a single request; a real karaoke line never approaches it.
export const ReorderQueueSchema = z.object({
  orderedRequestIds: z.array(z.string().uuid()).min(1).max(200),
});
export type ReorderQueueInput = z.infer<typeof ReorderQueueSchema>;

// DJ adds a song on a guest's behalf. Same video fields as a guest request, but
// the guest name is OPTIONAL (defaults to "DJ" server-side). Auth is the DJ
// bearer, not a guest identity.
export const DjAddRequestSchema = z
  .object({
    guestName: z.string().trim().min(1).max(40).optional(),
    searchQuery: z.string().trim().max(MAX_QUERY_LEN).optional(),
    youtubeVideoId: z.string().trim().min(1).max(20).optional(),
    youtubeTitle: z.string().trim().max(300).optional(),
    youtubeChannelTitle: z.string().trim().max(200).optional(),
    youtubeThumbnailUrl: z.string().url().max(600).optional(),
    youtubeInput: z.string().trim().max(300).optional(),
  })
  .refine((v) => Boolean(v.youtubeVideoId || v.youtubeInput), {
    message: 'Select a song or paste a YouTube link',
    path: ['youtubeVideoId'],
  });
export type DjAddRequestInput = z.infer<typeof DjAddRequestSchema>;

// Admin sets / clears the current (or a queued) song's lyrics. Plain text only —
// bounded here; the server ALSO sanitizes (control chars, blank lines) before
// storing. An empty string is a valid "clear". NOT trimmed: internal line breaks
// and indentation are the lyrics. The generous bound covers a long song.
export const SetLyricsSchema = z.object({
  lyrics: z.string().max(MAX_LYRICS_LEN, 'Lyrics are too long'),
});
export type SetLyricsInput = z.infer<typeof SetLyricsSchema>;

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

// Guest cancels their own request with the bounded capability issued at submit.
export const CancelRequestSchema = z.object({
  token: z.string().trim().min(1).max(512),
});
export type CancelRequestInput = z.infer<typeof CancelRequestSchema>;

// Guest starts / finishes their OWN song. Same bounded capability as cancel —
// it proves "this device submitted this request". The queue rules (first in
// line, single stage) are enforced server-side, not by the token.
export const OwnerActionSchema = z.object({
  token: z.string().trim().min(1).max(512),
});
export type OwnerActionInput = z.infer<typeof OwnerActionSchema>;

// Admin PIN enrollment. `pin` is only bounded here; the real policy (NFC, no
// whitespace, ≥6 digits / ≥8 passphrase) is enforced server-side by normalizePin.
// Do NOT .trim() the pin — whitespace handling is the normalizer's job.
export const AdminSetupSchema = z.object({
  token: z.string().min(1).max(256),
  pin: z.string().min(1).max(128),
});
export const AdminEnrollSchema = z.object({
  pin: z.string().min(1).max(128),
});

// Slug-free admin device enrollment (mobile app). Same PIN field; an optional
// device label. The room is resolved server-side (sole-admin-PIN room).
export const AdminDeviceEnrollSchema = z.object({
  pin: z.string().min(1).max(128),
  deviceName: z.string().max(60).optional(),
});
export const AdminPinRotateSchema = z.object({
  pin: z.string().min(1).max(128),
});

// Manager (global operator) login — a single shared passcode exchanged for a
// signed session token. Bounded only here; the real check is constant-time.
export const ManagerLoginSchema = z.object({
  passcode: z.string().min(1).max(256),
});

// Manager (operator) manually assigns a Host plan (FREE ↔ PRO). accountId is the
// CANONICAL Host account; reason is mandatory (audited); idempotencyKey makes the
// operation replay-safe. planCode is a closed enum — anything else is rejected here
// before the RPC is ever reached.
export const HostPlanAssignSchema = z.object({
  accountId: z.string().uuid(),
  planCode: z.enum(['FREE', 'PRO']),
  reason: z.string().trim().min(1, 'Reason is required').max(300),
  idempotencyKey: z.string().trim().min(1).max(128),
});

// Manager creates an event. Name is required; host is optional. `startNow`
// starts the karaoke night immediately (defaults to true).
export const CreateEventSchema = z.object({
  name: z.string().trim().min(1, 'Event name is required').max(80),
  hostName: z.string().trim().max(80).optional(),
  startNow: z.boolean().optional(),
});
export type CreateEventInput = z.infer<typeof CreateEventSchema>;
